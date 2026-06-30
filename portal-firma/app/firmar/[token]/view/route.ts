import { getFirmaDocumentoLabel } from '@/lib/firmaDocumentos';
import {
  buildAceptacionRespuestaLine,
  getFirmaDocMeta,
  getReadStatementNo
} from '@/lib/firmaDocumentosMeta';
import { updateDocumentoLecturaConfirmada } from '@/lib/firmaDocumentoOpciones';
import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';

function parseRespuesta(raw: unknown): 'si' | 'no' | null {
  const v = String(raw || '').trim().toLowerCase();
  if (v === 'si' || v === 'sí' || v === 'yes' || v === 'true') return 'si';
  if (v === 'no' || v === 'false') return 'no';
  return null;
}

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

  const respuesta =
    parseRespuesta(confirmacion.respuesta) ??
    (confirmacion.lectura_confirmada === true
      ? 'si'
      : confirmacion.lectura_confirmada === false
        ? 'no'
        : null);

  if (!respuesta) {
    return Response.json(
      { ok: false, error: 'Selecciona Sí o No antes de continuar.' },
      { status: 400 }
    );
  }

  const doc = resolved.documentos.find((d) => d.id === documentoId);
  if (!doc) return Response.json({ ok: false, error: 'Documento no pertenece a este envío' }, { status: 404 });

  const nowIso = new Date().toISOString();
  const opciones = {
    respuesta,
    lectura_confirmada: respuesta === 'si',
    confirmado_at: nowIso,
    ...(doc.tipo_documento === 'acoso' && respuesta === 'si' && confirmacion.formacion_acoso
      ? { formacion_acoso: true }
      : {})
  };

  const result = await updateDocumentoLecturaConfirmada(documentoId, opciones, nowIso);
  if (!result.ok) return Response.json({ ok: false, error: result.error }, { status: 500 });

  const meta = getFirmaDocMeta(doc.tipo_documento);
  const declaracion =
    respuesta === 'si' ? meta.readStatement : getReadStatementNo(doc.tipo_documento);
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
      respuesta,
      lectura_confirmada: respuesta === 'si',
      aceptacion_linea: buildAceptacionRespuestaLine(doc.tipo_documento, respuesta),
      declaracion,
      formacion_acoso: respuesta === 'si' && !!confirmacion.formacion_acoso,
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
