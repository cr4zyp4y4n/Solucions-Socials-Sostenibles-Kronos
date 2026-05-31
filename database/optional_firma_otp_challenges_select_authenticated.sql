-- OPCIONAL: historial de primera solicitud OTP sin exponer otp_hash.
-- Ejecutar si en Kronos ves:
-- [firma] firma_otp_primera_solicitud (merge OTP): function ... does not exist
--
-- La app Kronos usa el rol "authenticated" de Supabase Auth. El portal usa service_role
-- y no necesita SELECT directo. No concedas SELECT sobre firma_otp_challenges:
-- otp_hash es equivalente a una contraseña de 6 dígitos y se puede atacar offline.
--
alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_primera_solicitud(doc_ids uuid[])
returns table(documento_id uuid, primera_solicitud_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.documento_id, min(c.created_at) as primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(doc_ids)
  group by c.documento_id;
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
