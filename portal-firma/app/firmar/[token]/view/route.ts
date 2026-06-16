import { resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { updateDocumentoLecturaConfirmada } from '@/lib/firmaDocumentoOpciones';

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

  return Response.json({
    ok: true,
    revisado_at: nowIso,
    opciones,
    opciones_guardadas: result.opcionesGuardadas
  });
}
