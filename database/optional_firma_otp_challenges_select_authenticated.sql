-- Fallback seguro para Kronos cuando la columna otp_primera_solicitud_at
-- no existe o no fue rellenada todavía por un portal antiguo.
--
-- No conceder SELECT directo sobre firma_otp_challenges: contiene otp_hash
-- de códigos de 6 dígitos y permitiría fuerza bruta offline. Esta RPC solo
-- expone la primera auditoría "otp_solicitado", escrita tras un envío OTP OK.

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;
revoke select on public.firma_otp_challenges from authenticated;

create or replace function public.firma_otp_primera_solicitud(p_documento_ids uuid[])
returns table (
  documento_id uuid,
  primera_solicitud_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.documento_id,
    min(a.created_at) as primera_solicitud_at
  from public.firma_auditorias a
  where a.documento_id = any(p_documento_ids)
    and a.resultado = 'ok'
    and a.detalle->>'accion' = 'otp_solicitado'
  group by a.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
