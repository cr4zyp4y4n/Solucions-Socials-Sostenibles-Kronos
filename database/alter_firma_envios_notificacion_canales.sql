-- Registro separado de notificación por WhatsApp y email (packs de baja / fin de relación).
-- Ejecutar en Supabase SQL Editor.

alter table if exists public.firma_envios
  add column if not exists link_whatsapp_at timestamptz null,
  add column if not exists link_email_at timestamptz null;

comment on column public.firma_envios.link_whatsapp_at is
  'Primera vez que RRHH abrió WhatsApp con el enlace del portal desde Kronos.';
comment on column public.firma_envios.link_email_at is
  'Primera vez que RRHH abrió el cliente de email con el enlace del portal desde Kronos.';

notify pgrst, 'reload schema';
