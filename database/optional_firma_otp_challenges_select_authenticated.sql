-- OPCIONAL: fallback seguro para mostrar la primera solicitud OTP en Kronos
-- cuando firma_otp_challenges tiene RLS activo.
--
-- No concedas SELECT directo a authenticated sobre firma_otp_challenges:
-- la tabla contiene otp_hash y exponerla permite ataques offline sobre OTPs.
-- Esta RPC solo devuelve la primera fecha de solicitud por documento.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

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
