-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y Kronos necesita inferir la primera solicitud OTP para documentos antiguos.
--
-- No concedas SELECT directo sobre public.firma_otp_challenges a authenticated:
-- esa tabla contiene otp_hash de códigos de 6 dígitos. Esta RPC expone solo
-- el primer created_at por documento y evita filtrar hashes o filas completas.
--
-- Ejecuta este script si en la consola de Kronos ves:
-- [firma] firma_otp_primera_solicitud (merge OTP): ...

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
  group by c.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
