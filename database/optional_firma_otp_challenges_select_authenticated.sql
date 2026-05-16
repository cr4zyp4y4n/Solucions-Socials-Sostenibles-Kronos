-- OPCIONAL: soporte para que Kronos muestre la primera solicitud OTP sin exponer
-- los hashes de códigos OTP a clientes autenticados.
--
-- IMPORTANTE: no des SELECT directo sobre public.firma_otp_challenges a authenticated.
-- La tabla contiene otp_hash de códigos de 6 dígitos y esos hashes son sensibles.

alter table if exists public.firma_otp_challenges enable row level security;

-- Corrige instalaciones donde se aplicó la política anterior demasiado amplia.
drop policy if exists "firma_otp_challenges_select_authenticated" on public.firma_otp_challenges;

revoke all on table public.firma_otp_challenges from anon;
revoke all on table public.firma_otp_challenges from authenticated;

create or replace function public.firma_otp_primera_solicitud(p_documento_ids uuid[])
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
  where auth.role() = 'authenticated'
    and c.documento_id = any(coalesce(p_documento_ids, array[]::uuid[]))
  group by c.documento_id
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
