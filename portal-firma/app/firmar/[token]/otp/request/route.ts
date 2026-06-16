import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { generateOtpCode, sha256Hex } from '@/lib/otp';
import { sendSms } from '@/lib/sms';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';
import { checkProvidedDni } from '@/lib/dniVerification';

export const runtime = 'nodejs';

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const dniProvided = String(body?.dni || '').trim();

  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const telefono = resolved.trabajador?.telefono;
  const { documentoId, envioId } = getOtpScopeIds(resolved);
  if (!documentoId || !telefono) {
    return Response.json({ ok: false, error: 'Documento o teléfono no disponible' }, { status: 400 });
  }

  const dniCheck = checkProvidedDni(resolved.trabajador?.dni, dniProvided);
  if (dniCheck.required && !dniCheck.ok) {
    const { ip, userAgent } = await getRequestInfo();
    await supabaseAdmin.from('firma_auditorias').insert({
      documento_id: documentoId,
      ip,
      user_agent: userAgent,
      resultado: 'dni_incorrecto',
      detalle: { accion: 'dni_confirmacion_fallida', envio_id: envioId }
    });
    return Response.json(
      { ok: false, error: 'El DNI o NIE no coincide con nuestros registros. Revísalo e inténtalo de nuevo.' },
      { status: 403 }
    );
  }

  const { ip, userAgent } = await getRequestInfo();
  if (dniCheck.required && dniCheck.ok) {
    await supabaseAdmin.from('firma_auditorias').insert({
      documento_id: documentoId,
      ip,
      user_agent: userAgent,
      resultado: 'ok',
      detalle: {
        accion: 'dni_confirmado',
        envio_id: envioId,
        dni_hash: dniCheck.dniHash
      }
    });
  }

  const otp = generateOtpCode(6);
  const otpHash = sha256Hex(otp);
  const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString();

  const insertPayload: Record<string, string | number> = {
    documento_id: documentoId,
    otp_hash: otpHash,
    expires_at: expiresAtIso,
    attempts: 0
  };
  if (envioId) insertPayload.envio_id = envioId;

  const { error: insertErr } = await supabaseAdmin.from('firma_otp_challenges').insert(insertPayload);
  if (insertErr) return Response.json({ ok: false, error: insertErr.message }, { status: 500 });

  const smsBody = `Código de verificación Kronos: ${otp}. Caduca en 10 minutos.`;
  const delivery = await sendSms({ to: telefono, body: smsBody });

  const otpMarcadoIso = new Date().toISOString();
  let otpSeguimiento: { ok: true; yaEstaba?: boolean } | { ok: false; error: string } = { ok: true };

  if (envioId) {
    const { data: updRows, error: otpTrackErr } = await supabaseAdmin
      .from('firma_envios')
      .update({ otp_primera_solicitud_at: otpMarcadoIso, updated_at: otpMarcadoIso })
      .eq('id', envioId)
      .is('otp_primera_solicitud_at', null)
      .select('id, otp_primera_solicitud_at');
    if (otpTrackErr) {
      otpSeguimiento = { ok: false, error: otpTrackErr.message };
    } else if (!updRows?.length) {
      otpSeguimiento = { ok: true, yaEstaba: true };
    }
  } else {
    const { data: updRows, error: otpTrackErr } = await supabaseAdmin
      .from('firma_documentos')
      .update({ otp_primera_solicitud_at: otpMarcadoIso })
      .eq('id', documentoId)
      .is('otp_primera_solicitud_at', null)
      .select('id, otp_primera_solicitud_at');
    if (otpTrackErr) {
      otpSeguimiento = { ok: false, error: otpTrackErr.message };
    } else if (!updRows?.length) {
      otpSeguimiento = { ok: true, yaEstaba: true };
    }
  }

  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documentoId,
    ip,
    user_agent: userAgent,
    resultado: 'ok',
    detalle: { accion: 'otp_solicitado', delivery: delivery.delivery, envio_id: envioId }
  });

  const includeOtp = delivery.delivery === 'debug' && process.env.NODE_ENV !== 'production';

  return Response.json({
    ok: true,
    delivery: delivery.delivery,
    expiresAt: expiresAtIso,
    otpSeguimiento,
    ...(includeOtp ? { otp } : {})
  });
}
