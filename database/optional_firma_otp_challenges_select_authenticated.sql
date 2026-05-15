-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y en la consola de Kronos ves: [firma] firma_otp_primera_solicitud (merge OTP): permission denied
-- (o 0 filas al listar la primera solicitud OTP).
--
-- La app Kronos usa el rol "authenticated" de Supabase Auth. El portal usa service_role
-- y no necesita esta política.
--
-- No concedas SELECT directo sobre firma_otp_challenges: contiene otp_hash de códigos
-- de 6 dígitos y se podría crackear offline. Esta función expone solo el dato
-- agregado que necesita Kronos para pintar la primera solicitud.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_primera_solicitud(p_documento_ids uuid[])
returns table(documento_id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select c.documento_id, min(c.created_at) as created_at
  from public.firma_otp_challenges c
  where c.documento_id = any(coalesce(p_documento_ids, array[]::uuid[]))
  group by c.documento_id;
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
revoke all on function public.firma_otp_primera_solicitud(uuid[]) from anon;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
