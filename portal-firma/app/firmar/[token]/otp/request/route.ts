import { supabaseAdmin } from '@/lib/supabase';
import { generateOtpCode, sha256Hex } from '@/lib/otp';
import { sendSms } from '@/lib/sms';
import { getRequestInfo } from '@/lib/requestInfo';

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

  const documento = Array.isArray(tokenRow.documento) ? tokenRow.documento[0] : tokenRow.documento;
  const trabajador = documento && Array.isArray(documento.trabajador) ? documento.trabajador[0] : documento?.trabajador;
  const telefono = trabajador?.telefono;
  if (!documento?.id || !telefono) {
    return Response.json({ ok: false, error: 'Documento o teléfono no disponible' }, { status: 400 });
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
    ...(includeOtp ? { otp } : {})
  });
}

