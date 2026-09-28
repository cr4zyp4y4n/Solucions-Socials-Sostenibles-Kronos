import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { getIdentidadFotoStatus } from '@/lib/identidadVerification';
import {
  evaluateIdentidadOcr,
  ocrPayloadFromResult,
  type IdentidadOcrStatus
} from '@/lib/dniOcrMatch';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const ALLOWED_STATUS = new Set<IdentidadOcrStatus>([
  'pending',
  'match',
  'no_match',
  'ilegible',
  'error',
  'skipped'
]);

/**
 * Guarda resultado OCR de la foto de identidad (señal admin; no bloquea firma).
 * Body: { status?, match?, confianza?, dniDetectado?, candidatos?, detalle?, ocrText? }
 * Si viene ocrText, el servidor re-evalúa contra el DNI de BBDD (fuente de verdad).
 */
export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const { documentoId, envioId } = getOtpScopeIds(resolved);
  if (!documentoId && !envioId) {
    return Response.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false, error: 'JSON inválido' }, { status: 400 });
  }

  const foto = await getIdentidadFotoStatus(resolved).catch(() => null);
  if (!foto?.ok) {
    return Response.json(
      { ok: false, error: 'Sube primero la foto de identidad antes del OCR.' },
      { status: 400 }
    );
  }

  const expectedDni = resolved.trabajador?.dni ?? null;
  let result;
  if (typeof body.ocrText === 'string') {
    result = evaluateIdentidadOcr(body.ocrText, expectedDni, {
      engine: (body.detalle as Record<string, unknown> | undefined)?.engine || 'client',
      ...(typeof body.detalle === 'object' && body.detalle ? (body.detalle as object) : {})
    });
  } else {
    const status = String(body.status || 'error') as IdentidadOcrStatus;
    if (!ALLOWED_STATUS.has(status)) {
      return Response.json({ ok: false, error: 'status OCR inválido' }, { status: 400 });
    }
    // Revalidar match en servidor si el cliente dice match (evita spoof trivial)
    const clientDetectado = body.dniDetectado != null ? String(body.dniDetectado) : null;
    const fakeText = [
      clientDetectado || '',
      Array.isArray(body.candidatos) ? (body.candidatos as string[]).join(' ') : '',
      status === 'match' && expectedDni ? String(expectedDni) : ''
    ].join(' ');
    if (status === 'match' && expectedDni) {
      result = evaluateIdentidadOcr(fakeText || String(expectedDni), expectedDni, {
        ...(typeof body.detalle === 'object' && body.detalle ? (body.detalle as object) : {}),
        clientStatus: status,
        clientConfianza: body.confianza
      });
    } else {
      result = {
        status,
        match: Boolean(body.match) && status === 'match',
        confianza: Math.min(1, Math.max(0, Number(body.confianza) || 0)),
        dniDetectado: clientDetectado,
        candidatos: Array.isArray(body.candidatos)
          ? (body.candidatos as unknown[]).map((c) => String(c))
          : [],
        detalle: {
          ...(typeof body.detalle === 'object' && body.detalle ? (body.detalle as object) : {}),
          clientStatus: status
        }
      };
    }
  }

  const nowIso = new Date().toISOString();
  const payload = ocrPayloadFromResult(result, nowIso);

  if (envioId) {
    const { error } = await supabaseAdmin.from('firma_envios').update(payload).eq('id', envioId);
    if (error) {
      const msg = String(error.message || '');
      return Response.json(
        {
          ok: false,
          error: msg.includes('identidad_ocr')
            ? 'Falta migrar OCR identidad. Ejecuta database/alter_firma_identidad_ocr.sql'
            : error.message
        },
        { status: 500 }
      );
    }
  } else if (documentoId) {
    const { error } = await supabaseAdmin
      .from('firma_documentos')
      .update(payload)
      .eq('id', documentoId);
    if (error) {
      const msg = String(error.message || '');
      return Response.json(
        {
          ok: false,
          error: msg.includes('identidad_ocr')
            ? 'Falta migrar OCR identidad. Ejecuta database/alter_firma_identidad_ocr.sql'
            : error.message
        },
        { status: 500 }
      );
    }
  }

  const { ip, userAgent } = await getRequestInfo();
  if (documentoId) {
    await supabaseAdmin.from('firma_auditorias').insert({
      documento_id: documentoId,
      ip,
      user_agent: userAgent,
      resultado: result.match ? 'ok' : 'aviso',
      detalle: {
        accion: 'identidad_ocr_resultado',
        envio_id: envioId,
        status: result.status,
        match: result.match,
        confianza: result.confianza,
        dni_detectado: result.dniDetectado,
        dni_esperado: expectedDni ? String(expectedDni).trim().toUpperCase() : null,
        candidatos: result.candidatos?.slice?.(0, 8) || [],
        advisory: true
      }
    });
  }

  return Response.json({
    ok: true,
    status: result.status,
    match: result.match,
    confianza: result.confianza,
    dniDetectado: result.dniDetectado,
    at: nowIso
  });
}
