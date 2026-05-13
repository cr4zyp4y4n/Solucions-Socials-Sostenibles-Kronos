-- Seguimiento de envío / apertura del enlace de firma (Kronos + portal-firma)
-- Ejecutar en Supabase SQL Editor si aún no existen las columnas.

alter table if exists public.firma_documentos
  add column if not exists link_compartido_at timestamptz null;

alter table if exists public.firma_documentos
  add column if not exists portal_abierto_at timestamptz null;

comment on column public.firma_documentos.link_compartido_at is
  'Primera vez que se compartió el enlace (WhatsApp, email, copiar mensaje, etc.) desde Kronos.';
comment on column public.firma_documentos.portal_abierto_at is
  'Primera vez que el trabajador abrió la página del portal con el token válido.';
