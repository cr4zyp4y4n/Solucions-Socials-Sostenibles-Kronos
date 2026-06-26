import { getFirmaDocumentoLabel } from '@/lib/firmaDocumentos';
import { buildAceptacionSiLine, getFirmaDocMeta } from '@/lib/firmaDocumentosMeta';
import { updateDocumentoLecturaConfirmada } from '@/lib/firmaDocumentoOpciones';
import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const documentoId = String(body?.documentoId || '').trim();
  const confirmacion = body?.confirmacion || {};

  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }
  if (!documentoId) return Response.json({ ok: false, error: 'Falta documentoId' }, { status: 400 });
  if (!confirmacion?.lectura_confirmada) {
    return Response.json({ ok: false, error: 'Debes confirmar la lectura del documento' }, { status: 400 });
  }

  const doc = resolved.documentos.find((d) => d.id === documentoId);
  if (!doc) return Response.json({ ok: false, error: 'Documento no pertenece a este envío' }, { status: 404 });

  const nowIso = new Date().toISOString();
  const opciones = {
    lectura_confirmada: true,
    confirmado_at: nowIso,
    ...(confirmacion.formacion_acoso ? { formacion_acoso: true } : {})
  };

  const result = await updateDocumentoLecturaConfirmada(documentoId, opciones, nowIso);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 500 });

  const meta = getFirmaDocMeta(doc.tipo_documento);
  const { ip, userAgent } = await getRequestInfo();
  const { envioId } = getOtpScopeIds(resolved);

  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documentoId,
    ip: ip || null,
    user_agent: userAgent || null,
    resultado: 'ok',
    detalle: {
      accion: 'documento_lectura_confirmada',
      envio_id: envioId,
      tipo_documento: doc.tipo_documento,
      tipo_label: getFirmaDocumentoLabel(doc.tipo_documento),
      lectura_confirmada: true,
      aceptacion_si: buildAceptacionSiLine(doc.tipo_documento),
      declaracion: meta.readStatement,
      formacion_acoso: !!confirmacion.formacion_acoso,
      confirmado_at: nowIso,
      opciones_guardadas: result.opcionesGuardadas
    }
  });

  return Response.json({
    ok: true,
    revisado_at: nowIso,
    opciones,
    opciones_guardadas: result.opcionesGuardadas
  });
}
