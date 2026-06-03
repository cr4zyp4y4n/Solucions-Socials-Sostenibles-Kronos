-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y en la consola de Kronos ves: [firma] firma_otp_primera_solicitud (merge OTP): permission denied
-- (o la cronología OTP no puede inferirse cuando falta otp_primera_solicitud_at).
--
-- La app Kronos usa el rol "authenticated" de Supabase Auth. El portal usa service_role
-- y no necesita esta función.
--
-- No concedas SELECT directo sobre firma_otp_challenges: contiene otp_hash de códigos
-- de 6 dígitos, que se pueden crackear offline si un usuario autenticado los lee.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;
revoke all on table public.firma_otp_challenges from authenticated;

create or replace function public.firma_otp_primera_solicitud(documento_ids uuid[])
returns table(documento_id uuid, primera_solicitud_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.documento_id, min(c.created_at) as primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(documento_ids)
  group by c.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
