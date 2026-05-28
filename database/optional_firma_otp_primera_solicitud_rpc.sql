-- OPCIONAL: si Kronos necesita inferir la primera solicitud OTP desde
-- firma_otp_challenges cuando firma_documentos.otp_primera_solicitud_at no existe
-- o no se relleno historicamente.
--
-- No concedas SELECT directo a authenticated sobre firma_otp_challenges: contiene
-- otp_hash de codigos OTP de 6 digitos y se puede precomputar por fuerza bruta.
-- Esta RPC SECURITY DEFINER solo devuelve el agregado minimo que necesita Kronos.

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
stable
as $$
  select
    c.documento_id,
    min(c.created_at) as primera_solicitud_at
  from public.firma_otp_challenges c
  where c.documento_id = any(coalesce(p_documento_ids, array[]::uuid[]))
  group by c.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
