-- OPCIONAL: solo si en Supabase la columna firma_documentos.otp_primera_solicitud_at
-- no se actualiza desde el portal y Kronos necesita inferir la primera solicitud
-- OTP desde firma_otp_challenges.
--
-- Seguridad: NO concedas SELECT directo sobre firma_otp_challenges a authenticated.
-- Esa tabla contiene otp_hash de códigos OTP de 6 dígitos, triviales de forzar
-- offline si se exponen. Esta RPC solo devuelve la primera fecha por documento.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_primera_solicitud(documento_ids uuid[])
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
    c.documento_id,
    min(c.created_at) as primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(documento_ids)
  group by c.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;

comment on function public.firma_otp_primera_solicitud(uuid[]) is
  'Devuelve la primera fecha de solicitud OTP por documento sin exponer otp_hash.';
