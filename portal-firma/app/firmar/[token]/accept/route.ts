import { supabaseAdmin } from '@/lib/supabase';
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
        estado
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

  // Exigimos OTP consumido recientemente (para evitar aceptar sin verificación).
  // Como el challenge se marca consumed_at, validamos que haya uno en los últimos 30 minutos.
  const sinceIso = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: consumed, error: otpErr } = await supabaseAdmin
    .from('firma_otp_challenges')
    .select('id, consumed_at')
    .eq('documento_id', documento.id)
    .not('consumed_at', 'is', null)
    .gte('consumed_at', sinceIso)
    .order('consumed_at', { ascending: false })
    .limit(1);
  if (otpErr) return Response.json({ ok: false, error: otpErr.message }, { status: 500 });
  if (!consumed?.length) {
    return Response.json({ ok: false, error: 'Falta verificación OTP' }, { status: 401 });
  }

  const nowIso = new Date().toISOString();
  const { ip, userAgent } = await getRequestInfo();

  const { error: docErr } = await supabaseAdmin
    .from('firma_documentos')
    .update({ estado: 'firmado', firmado_at: nowIso })
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
    detalle: { accion: 'aceptado_y_firmado', token_id: tokenRow.id }
  });

  return Response.json({ ok: true });
}

