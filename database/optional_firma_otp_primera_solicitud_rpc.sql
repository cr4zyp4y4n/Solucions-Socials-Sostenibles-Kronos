-- OPCIONAL: fallback seguro para que Kronos muestre la primera solicitud OTP
-- cuando la columna firma_documentos.otp_primera_solicitud_at aun no esta rellena.
--
-- No concedas SELECT directo sobre public.firma_otp_challenges a usuarios
-- authenticated: esa tabla contiene otp_hash de codigos de 6 digitos.

alter table if exists public.firma_otp_challenges enable row level security;

drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

create or replace function public.firma_otp_primera_solicitud(p_documento_ids uuid[])
returns table (
  documento_id uuid,
  primera_solicitud_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    c.documento_id,
    min(c.created_at) as primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(coalesce(p_documento_ids, array[]::uuid[]))
  group by c.documento_id;
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;

comment on function public.firma_otp_primera_solicitud(uuid[]) is
  'Devuelve solo la primera fecha OTP por documento, sin exponer otp_hash ni filas completas.';
