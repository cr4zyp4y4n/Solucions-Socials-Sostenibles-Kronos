-- OPCIONAL: solo si en Supabase necesitas que Kronos infiera la primera
-- solicitud OTP desde firma_otp_challenges cuando otp_primera_solicitud_at
-- no se haya rellenado en firma_documentos.
--
-- IMPORTANTE: no concedas SELECT directo a authenticated sobre
-- firma_otp_challenges. La tabla contiene otp_hash de códigos de 6 dígitos;
-- si un cliente autenticado puede leer esos hashes, puede probar los 1.000.000
-- códigos offline y saltarse la verificación OTP.
--
-- Este script elimina la política insegura antigua (si se llegó a aplicar) y
-- expone solo una RPC que devuelve documento_id + primera fecha de solicitud.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_primera_solicitud(p_documento_ids uuid[])
returns table(documento_id uuid, otp_primera_solicitud_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  select c.documento_id, min(c.created_at) as otp_primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(p_documento_ids)
  group by c.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
revoke all on function public.firma_otp_primera_solicitud(uuid[]) from anon;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
