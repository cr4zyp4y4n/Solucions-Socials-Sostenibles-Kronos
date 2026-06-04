-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y en la consola de Kronos ves: [firma] firma_otp_challenges (merge OTP): permission denied
-- (o 0 filas al listar challenges).
--
-- La app Kronos usa el rol "authenticated" de Supabase Auth. El portal usa service_role
-- y no necesita esta RPC.
--
-- Esta tabla contiene otp_hash. NO concedas SELECT directo a authenticated:
-- un OTP de 6 dígitos puede crackearse offline si se expone el hash.
-- La RPC SECURITY DEFINER devuelve solo la primera solicitud por documento.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_primera_solicitud(p_documento_ids uuid[])
returns table(documento_id uuid, primera_solicitud_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.documento_id, min(c.created_at) as primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(p_documento_ids)
  group by c.documento_id;
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
