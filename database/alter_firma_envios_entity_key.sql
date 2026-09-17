-- Empresa del envío de firma (para el sello PDF: nombre corto + NIF).
-- Ejecutar en Supabase tras create_firma_envios.sql

alter table public.firma_envios
  add column if not exists entity_key text;

alter table public.firma_envios
  drop constraint if exists firma_envios_entity_chk;

alter table public.firma_envios
  add constraint firma_envios_entity_chk
  check (entity_key is null or entity_key in ('EI_SSS', 'MENJAR_DHORT'));

comment on column public.firma_envios.entity_key is
  'Empresa Kronos del pack (EI_SSS | MENJAR_DHORT); usada en el sello de aceptación electrónica.';

notify pgrst, 'reload schema';
