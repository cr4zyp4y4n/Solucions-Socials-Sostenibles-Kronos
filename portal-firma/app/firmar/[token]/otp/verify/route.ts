import { getOtpScopeIds, resolveFirmaToken } from '@/lib/resolveFirmaToken';
import { sha256Hex } from '@/lib/otp';
import { getRequestInfo } from '@/lib/requestInfo';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const otp = String(body?.otp || '').trim();
  if (!otp) return Response.json({ ok: false, error: 'Falta OTP' }, { status: 400 });

  const resolved = await resolveFirmaToken(token);
  if (!resolved) return Response.json({ ok: false, error: 'Token no válido' }, { status: 404 });
  if (resolved.isExpired || resolved.isRevoked || resolved.isUsed) {
    return Response.json({ ok: false, error: 'Token caducado, revocado o usado' }, { status: 410 });
  }

  const { documentoId, envioId } = getOtpScopeIds(resolved);
  if (!documentoId) return Response.json({ ok: false, error: 'Documento no encontrado' }, { status: 404 });

  let challQuery = supabaseAdmin
    .from('firma_otp_challenges')
    .select('id, otp_hash, expires_at, attempts, consumed_at, created_at')
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1);

  if (envioId) {
    challQuery = challQuery.eq('envio_id', envioId);
  } else {
    challQuery = challQuery.eq('documento_id', documentoId);
  }

  const { data: challenges, error: challErr } = await challQuery;
  if (challErr) return Response.json({ ok: false, error: challErr.message }, { status: 500 });
  const challenge = challenges?.[0];
  if (!challenge) return Response.json({ ok: false, error: 'No hay OTP activo. Solicita un código.' }, { status: 404 });

  const challExpires = new Date(challenge.expires_at);
  const challExpired = Number.isFinite(challExpires.getTime()) && challExpires.getTime() < Date.now();
  if (challExpired) return Response.json({ ok: false, error: 'OTP caducado. Solicita uno nuevo.' }, { status: 410 });

  const nextAttempts = Number(challenge.attempts || 0) + 1;
  if (nextAttempts > 5) {
    await supabaseAdmin.from('firma_otp_challenges').update({ attempts: nextAttempts }).eq('id', challenge.id);
    return Response.json({ ok: false, error: 'Demasiados intentos. Solicita un nuevo código.' }, { status: 429 });
  }

  const ok = sha256Hex(otp) === challenge.otp_hash;

  const { ip, userAgent } = await getRequestInfo();
  await supabaseAdmin.from('firma_auditorias').insert({
    documento_id: documentoId,
    ip,
    user_agent: userAgent,
    resultado: ok ? 'ok' : 'otp_incorrecto',
    detalle: { accion: 'otp_verificado', ok, envio_id: envioId }
  });

  if (!ok) {
    await supabaseAdmin.from('firma_otp_challenges').update({ attempts: nextAttempts }).eq('id', challenge.id);
    return Response.json({ ok: false, error: 'Código incorrecto' }, { status: 401 });
  }

  await supabaseAdmin
    .from('firma_otp_challenges')
    .update({ consumed_at: new Date().toISOString(), attempts: nextAttempts })
    .eq('id', challenge.id);

  return Response.json({ ok: true });
}
