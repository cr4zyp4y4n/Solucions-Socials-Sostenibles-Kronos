-- OPCIONAL: solo si en Supabase la tabla firma_otp_challenges tiene RLS activo
-- y en la consola de Kronos ves: [firma] firma_otp_challenges (merge OTP): permission denied
-- (o 0 filas al listar challenges).
--
-- IMPORTANTE: no concedas SELECT directo sobre public.firma_otp_challenges.
-- La tabla contiene otp_hash de codigos OTP de 6 digitos; exponerlo al rol
-- authenticated permite crackeo offline y bypass del SMS.
--
-- Este script elimina la politica amplia anterior (si existia) y expone solo
-- la primera fecha de solicitud por documento mediante una RPC de lectura segura.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;
revoke select on public.firma_otp_challenges from authenticated;

create or replace function public.firma_otp_primera_solicitud(documento_ids uuid[])
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

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;

comment on function public.firma_otp_primera_solicitud(uuid[]) is
  'Devuelve la primera solicitud OTP por documento sin exponer otp_hash ni intentos.';
