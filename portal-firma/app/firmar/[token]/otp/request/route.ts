import { supabaseAdmin } from '@/lib/supabase';
import { generateOtpCode, sha256Hex } from '@/lib/otp';
import { sendSms } from '@/lib/sms';
import { getRequestInfo } from '@/lib/requestInfo';
import { asSingle } from '@/lib/relation';

export const runtime = 'nodejs';

export async function POST(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;

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
        trabajador:firma_trabajadores!firma_documentos_trabajador_id_fkey (
          telefono
        )
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

  const documento = asSingle(tokenRow.documento);
  const trabajador = documento ? asSingle(documento.trabajador) : undefined;
  const telefono = trabajador?.telefono;
  if (!documento?.id || !telefono) {
    return Response.json({ ok: false, error: 'Documento o teléfono no disponible' }, { status: 400 });
  }
  if (documento.estado === 'firmado') {
    return Response.json({ ok: false, error: 'Documento ya firmado' }, { status: 410 });
  }

  const otp = generateOtpCode(6);
  const otpHash = sha256Hex(otp);
  const expiresAtIso = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 minutos

  const { error: insertErr } = await supabaseAdmin.from('firma_otp_challenges').insert({
    documento_id: documento.id,
    otp_hash: otpHash,
    expires_at: expiresAtIso,
    attempts: 0
  });
  if (insertErr) return Response.json({ ok: false, error: insertErr.message }, { status: 500 });

  const smsBody = `Código de verificación Kronos: ${otp}. Caduca en 10 minutos.`;
  const delivery = await sendSms({ to: telefono, body: smsBody });

  const otpMarcadoIso = new Date().toISOString();
  const { data: updRows, error: otpTrackErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({ otp_primera_solicitud_at: otpMarcadoIso })
    .eq('id', documento.id)
    .is('otp_primera_solicitud_at', null)
    .select('id, otp_primera_solicitud_at');

  let otpSeguimiento: { ok: true; yaEstaba?: boolean } | { ok: false; error: string } = { ok: true };
  if (otpTrackErr) {
    console.warn('[firma otp] otp_primera_solicitud_at:', otpTrackErr.message);
    otpSeguimiento = { ok: false, error: otpTrackErr.message };
  } else if (!updRows?.length) {
    const { data: snap, error: snapErr } = await supabaseAdmin
      .from('firma_documentos')
      .select('otp_primera_solicitud_at')
      .eq('id', documento.id)
      .maybeSingle();
    if (snapErr) {
      console.warn('[firma otp] lectura tras update:', snapErr.message);
      otpSeguimiento = { ok: false, error: snapErr.message };
    } else if (snap?.otp_primera_solicitud_at) {
      otpSeguimiento = { ok: true, yaEstaba: true };
    } else {
      const hint =
        'El UPDATE no tocó ninguna fila. Suele ser: columna otp_primera_solicitud_at inexistente (ejecuta el SQL en el proyecto correcto y en Supabase: Settings → API → Reload schema), o clave service_role ausente en el portal.';
      console.warn('[firma otp]', hint, 'documento_id=', documento.id);
      otpSeguimiento = { ok: false, error: hint };
    }
  }

  const { ip, userAgent } = await getRequestInfo();
  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documento.id,
    ip,
    user_agent: userAgent,
    resultado: 'ok',
    detalle: { accion: 'otp_solicitado', delivery: delivery.delivery }
  });

  // En modo debug (sin Twilio) devolvemos el OTP para poder seguir el flujo.
  const includeOtp = delivery.delivery === 'debug' && process.env.NODE_ENV !== 'production';

  return Response.json({
    ok: true,
    delivery: delivery.delivery,
    expiresAt: expiresAtIso,
    otpSeguimiento,
    ...(includeOtp ? { otp } : {})
  });
}

