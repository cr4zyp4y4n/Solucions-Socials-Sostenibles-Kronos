-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y Kronos necesita inferir la primera solicitud OTP para el seguimiento.
--
-- IMPORTANTE: no concedas SELECT directo sobre firma_otp_challenges a authenticated.
-- La tabla contiene otp_hash de códigos de 6 dígitos; exponerlos permite brute-force
-- offline del OTP. Esta RPC devuelve solo documento_id + primera fecha.
--
-- La app Kronos usa el rol "authenticated" de Supabase Auth. El portal usa service_role
-- y no necesita esta función.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_first_requests(documento_ids uuid[])
returns table(documento_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.documento_id, min(c.created_at) as created_at
  from public.firma_otp_challenges c
  where c.documento_id = any(documento_ids)
  group by c.documento_id
$$;

revoke all on function public.firma_otp_first_requests(uuid[]) from public;
revoke all on function public.firma_otp_first_requests(uuid[]) from anon;
grant execute on function public.firma_otp_first_requests(uuid[]) to authenticated;
