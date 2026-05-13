-- Primera solicitud de código OTP en el portal (SMS o modo debug sin Twilio).
-- Ejecutar en Supabase SQL Editor si aún no existe la columna.

alter table if exists public.firma_documentos
  add column if not exists otp_primera_solicitud_at timestamptz null;

comment on column public.firma_documentos.otp_primera_solicitud_at is
  'Primera vez que en el portal se solicitó el código OTP (tras envío SMS exitoso o modo debug).';
