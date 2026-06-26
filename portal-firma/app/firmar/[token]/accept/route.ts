import { getFirmaDocumentoLabel } from '@/lib/firmaDocumentos';
import { buildAceptacionRespuestaLine, buildStampLinesForDoc, getFirmaDocMeta, normalizeRespuestaAceptacion } from '@/lib/firmaDocumentosMeta';
import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { supabaseAdmin } from '@/lib/supabase';
import { getRequestInfo } from '@/lib/requestInfo';
import { stampPdfLastPage } from '@/lib/pdfSign';
import { hasRecentDniConfirmation } from '@/lib/dniVerification';
import { normalizeDni } from '@/lib/normalizeDni';
import { loadDocumentoOpciones } from '@/lib/firmaDocumentoOpciones';

async function stampAndUploadDocument({
  documento,
  tokenRowId,
  nowIso,
  ip,
  userAgent,
  trabajadorNombre,
  trabajadorDni,
  dniConfirmadoEnPortal,
  smsVerificadoAt
}: {
  documento: {
    id: string;
    tipo_documento: string;
    storage_path: string | null;
    file_name: string | null;
    hash_pdf: string | null;
    firmado_at: string | null;
    storage_path_firmado: string | null;
  };
  tokenRowId: string;
  nowIso: string;
  ip: string;
  userAgent: string;
  trabajadorNombre?: string | null;
  trabajadorDni?: string | null;
  dniConfirmadoEnPortal?: boolean;
  smsVerificadoAt?: string | null;
}) {
  if (documento.firmado_at && documento.storage_path_firmado) {
    return { signedPath: documento.storage_path_firmado, skipped: true };
  }
  if (!documento.storage_path) {
    throw new Error(`Documento ${documento.id} sin PDF`);
  }

  const { tipoDocumento: tipoFromDb, opciones } = await loadDocumentoOpciones(documento.id);
  const tipo = tipoFromDb || documento.tipo_documento;

  const { data: signedData, error: signedErr } = await supabaseAdmin.storage
    .from('firma-documentos')
    .createSignedUrl(documento.storage_path, 60 * 5);
  if (signedErr) throw new Error(`Error firmando URL: ${signedErr.message}`);
  const signedUrl = signedData?.signedUrl;
  if (!signedUrl) throw new Error('No se pudo firmar la URL del PDF');

  const originalRes = await fetch(signedUrl);
  if (!originalRes.ok) {
    const txt = await originalRes.text().catch(() => '');
    throw new Error(`Error descargando PDF (${originalRes.status}): ${txt}`);
  }
  const originalBuf = new Uint8Array(await originalRes.arrayBuffer());

  const stampLines = buildStampLinesForDoc({
    trabajadorNombre,
    trabajadorDni,
    tipoDocumento: tipo,
    opciones,
    nowIso,
    documentoId: documento.id,
    tokenRowId,
    hashPdf: documento.hash_pdf,
    ip,
    userAgent,
    dniConfirmadoEnPortal,
    smsVerificado: true,
    smsVerificadoAt: smsVerificadoAt || null
  });

  const signedPdf = await stampPdfLastPage({ pdfBytes: originalBuf, stampLines });

  const baseName = String(documento.file_name || 'documento.pdf').replace(/[^\w.-]/g, '_');
  const signedPath = `${documento.id}/SIGNED-${Date.now()}-${baseName.endsWith('.pdf') ? baseName : `${baseName}.pdf`}`;

  const { error: uploadErr } = await supabaseAdmin.storage
    .from('firma-documentos')
    .upload(signedPath, signedPdf, {
      contentType: 'application/pdf',
      cacheControl: '3600',
      upsert: true
    });
  if (uploadErr) throw new Error(`Error subiendo PDF firmado: ${uploadErr.message}`);

  const { error: docErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({
      estado: 'firmado',
      firmado_at: nowIso,
      storage_path_firmado: signedPath,
      file_name_firmado: `SIGNED-${baseName}`
    })
    .eq('id', documento.id);
  if (docErr) throw new Error(docErr.message);

  return { signedPath, skipped: false };
}

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  await _req.json().catch(() => ({}));

  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const pendingReview = resolved.documentos.filter((d) => !d.revisado_at && d.estado !== 'firmado');
  if (pendingReview.length) {
    return Response.json(
      {
        ok: false,
        error: `Debes indicar Sí o No en todos los documentos antes de firmar (faltan ${pendingReview.length}).`
      },
      { status: 400 }
    );
  }

  const vrpConsent = resolved.documentos.some((d) => d.tipo_documento === 'vrp_consentimiento');
  const vrpRenuncia = resolved.documentos.some((d) => d.tipo_documento === 'vrp_renuncia');
  if (vrpConsent && vrpRenuncia) {
    return Response.json(
      {
        ok: false,
        error: 'El pack no puede incluir a la vez VRP consentimiento y VRP renuncia. Usa solo uno.'
      },
      { status: 400 }
    );
  }

  const { documentoId, envioId } = getOtpScopeIds(resolved);
  if (!documentoId) return Response.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 });

  const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  let otpQuery = supabaseAdmin
    .from('firma_otp_challenges')
    .select('id, consumed_at')
    .not('consumed_at', 'is', null)
    .gte('consumed_at', sinceIso)
    .order('consumed_at', { ascending: false })
    .limit(1);

  if (envioId) {
    otpQuery = otpQuery.eq('envio_id', envioId);
  } else {
    otpQuery = otpQuery.eq('documento_id', documentoId);
  }

  const { data: consumed, error: otpErr } = await otpQuery;
  if (otpErr) return Response.json({ ok: false, error: otpErr.message }, { status: 500 });
  if (!consumed?.length) {
    return Response.json({ ok: false, error: 'Falta verificación OTP' }, { status: 401 });
  }

  const requiereDni = Boolean(normalizeDni(resolved.trabajador?.dni));
  if (requiereDni) {
    const dniOk = await hasRecentDniConfirmation({ documentoId, envioId });
    if (!dniOk) {
      return Response.json(
        { ok: false, error: 'Falta confirmación de DNI. Vuelve a solicitar el código SMS.' },
        { status: 401 }
      );
    }
  }

  const nowIso = new Date().toISOString();
  const { ip, userAgent } = await getRequestInfo();
  const trabajadorNombre = resolved.trabajador?.nombre || null;
  const trabajadorDni = resolved.trabajador?.dni || null;
  const dniConfirmadoEnPortal = requiereDni;
  const smsVerificadoAt = consumed[0]?.consumed_at || null;

  const signedPaths: string[] = [];
  for (const doc of resolved.documentos) {
    const result = await stampAndUploadDocument({
      documento: doc,
      tokenRowId: resolved.tokenRow.id,
      nowIso,
      ip,
      userAgent,
      trabajadorNombre,
      trabajadorDni,
      dniConfirmadoEnPortal,
      smsVerificadoAt
    });
    signedPaths.push(result.signedPath);
  }

  if (envioId) {
    await supabaseAdmin
      .from('firma_envios')
      .update({ estado: 'firmado', firmado_at: nowIso, updated_at: nowIso })
      .eq('id', envioId);
  }

  const { error: tokenErr } = await supabaseAdmin
    .from('firma_tokens')
    .update({ used_at: nowIso })
    .eq('id', resolved.tokenRow.id);
  if (tokenErr) return Response.json({ ok: false, error: tokenErr.message }, { status: 500 });

  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documentoId,
    ip,
    user_agent: userAgent,
    resultado: 'ok',
    detalle: {
      accion: resolved.isPack ? 'pack_aceptado_y_firmado' : 'aceptado_y_firmado',
      token_id: resolved.tokenRow.id,
      envio_id: envioId,
      trabajador: trabajadorNombre,
      dni: trabajadorDni,
      dni_confirmado_portal: dniConfirmadoEnPortal,
      sms_verificado_at: smsVerificadoAt,
      num_documentos: resolved.documentos.length,
      storage_paths_firmados: signedPaths,
      declaraciones_aceptadas: await Promise.all(
        resolved.documentos.map(async (d) => {
          const { opciones } = await loadDocumentoOpciones(d.id);
          const respuesta = normalizeRespuestaAceptacion(opciones) || 'si';
          return {
            documento_id: d.id,
            tipo_documento: d.tipo_documento,
            respuesta,
            lectura_confirmada: respuesta === 'si',
            declaracion: getFirmaDocMeta(d.tipo_documento).readStatement,
            aceptacion_linea: buildAceptacionRespuestaLine(d.tipo_documento, respuesta)
          };
        })
      )
    }
  });

  return Response.json({ ok: true, firmados: resolved.documentos.length });
}
