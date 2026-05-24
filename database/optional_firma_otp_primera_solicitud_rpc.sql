-- OPCIONAL: fallback seguro para que Kronos muestre la primera solicitud OTP
-- cuando firma_documentos.otp_primera_solicitud_at no se pudo rellenar desde el portal.
--
-- A diferencia de conceder SELECT sobre firma_otp_challenges, esta RPC no expone
-- otp_hash, attempts ni otros campos sensibles: solo devuelve la primera fecha por documento.

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
  where c.documento_id = any(coalesce(p_documento_ids, array[]::uuid[]))
  group by c.documento_id;
$$;

revoke all on function public.firma_otp_primera_solicitud(uuid[]) from public;
grant execute on function public.firma_otp_primera_solicitud(uuid[]) to authenticated;
