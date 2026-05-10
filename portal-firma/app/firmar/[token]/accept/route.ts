import { supabaseAdmin } from '@/lib/supabase';
import { getRequestInfo } from '@/lib/requestInfo';
import { stampPdfLastPage } from '@/lib/pdfSign';
import { verifyOtpVerificationToken } from '@/lib/otpVerificationToken';

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const otpVerificationToken = String(body?.otpVerificationToken || '').trim();

  const { data: tokenRow, error } = await supabaseAdmin
    .from('firma_tokens')
    .select(
      `
      id,
      token,
      expires_at,
      used_at,
      revoked_at,
      documento:firma_documentos!firma_tokens_documento_id_fkey (
        id,
        estado,
        storage_path,
        file_name,
        hash_pdf
      )
    `
    )
    .eq('token', token)
    .maybeSingle();

  if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });
  if (!tokenRow) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });

  const expiresAt = new Date(tokenRow.expires_at);
  const isExpired = Number.isFinite(expiresAt.getTime()) && expiresAt.getTime() < Date.now();
  const isRevoked = !!tokenRow.revoked_at;
  const isUsed = !!tokenRow.used_at;
  if (isExpired || isRevoked || isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const documento = Array.isArray(tokenRow.documento) ? tokenRow.documento[0] : tokenRow.documento;
  if (!documento?.id) return Response.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 });
  if (!documento.storage_path) return Response.json({ ok: false, error: 'Documento sin PDF' }, { status: 400 });

  // El comprobante se emite únicamente tras verificar el OTP correcto y evita
  // aceptar desde otro navegador que solo tenga el enlace del documento.
  if (!verifyOtpVerificationToken(otpVerificationToken, { documentoId: documento.id, tokenId: tokenRow.id })) {
    return Response.json({ ok: false, error: 'Falta verificación OTP' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { ip, userAgent } = await getRequestInfo();

  // 1) Descargar PDF original
  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from('firma-documentos')
    .createSignedUrl(documento.storage_path, 60 * 5);
  if (signedErr) return Response.json({ ok: false, error: `Error firmando URL: ${signedErr.message}` }, { status: 500 });
  const signedUrl = signedData?.signedUrl;
  if (!signedUrl) return Response.json({ ok: false, error: 'No se pudo firmar la URL del PDF' }, { status: 500 });

  const originalRes = await fetch(signedUrl);
  if (!originalRes.ok) {
    const txt = await originalRes.text().catch(() => '');
    return Response.json({ ok: false, error: `Error descargando PDF (${originalRes.status}): ${txt}` }, { status: 502 });
  }
  const originalBuf = new Uint8Array(await originalRes.arrayBuffer());

  // 2) Estampar sello en última página con evidencias
  const uaShort = userAgent ? `${userAgent.slice(0, 48)}${userAgent.length > 48 ? '…' : ''}` : '';
  const stampLines = [
    `Fecha/hora: ${new Date(nowIso).toLocaleString('es-ES')}`,
    `Doc: ${documento.id.slice(0, 8)}…  Token: ${tokenRow.id.slice(0, 8)}…`,
    documento.hash_pdf ? `SHA-256 (orig): ${String(documento.hash_pdf).slice(0, 16)}…` : '',
    ip ? `IP: ${ip}` : '',
    uaShort ? `UA: ${uaShort}` : ''
  ].filter(Boolean);
  const signedPdf = await stampPdfLastPage({ pdfBytes: originalBuf, stampLines });

  // 3) Subir PDF firmado como archivo aparte
  const baseName = String(documento.file_name || 'documento.pdf').replace(/[^\w.-]/g, '_');
  const signedPath = `${documento.id}/SIGNED-${Date.now()}-${baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('firma-documentos')
    .upload(signedPath, signedPdf, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true
    });
  if (uploadErr) return Response.json({ ok: false, error: `Error subiendo PDF firmado: ${uploadErr.message}` }, { status: 500 });

  const { error: docErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({
      estado: 'firmado',
      firmado_at: nowIso,
      // Requiere columnas nuevas en DB (ver SQL de migración)
      storage_path_firmado: signedPath,
      file_name_firmado: `SIGNED-${baseName}`
    })
    .eq('id', documento.id);
  if (docErr) return Response.json({ ok: false, error: docErr.message }, { status: 500 });

  const { error: tokenErr } = await supabaseAdmin
    .from('firma_tokens')
    .update({ used_at: nowIso })
    .eq('id', tokenRow.id);
  if (tokenErr) return Response.json({ ok: false, error: tokenErr.message }, { status: 500 });

  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documento.id,
    ip,
    user_agent: userAgent,
    resultado: 'ok',
    detalle: { accion: 'aceptado_y_firmado', token_id: tokenRow.id, storage_path_firmado: signedPath }
  });

  return Response.json({ ok: true });
}

