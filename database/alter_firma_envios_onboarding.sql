-- Seguimiento del onboarding del portal de firma (modal explicativo).
-- Ejecutar en Supabase SQL Editor.

alter table if exists public.firma_envios
  add column if not exists onboarding_modal_at timestamptz,
  add column if not exists onboarding_resuelto_at timestamptz,
  add column if not exists onboarding_resultado text;

comment on column public.firma_envios.onboarding_modal_at is
  'Primera vez que se mostró el modal de onboarding en el portal.';
comment on column public.firma_envios.onboarding_resuelto_at is
  'Cuando el usuario cerró el onboarding con una decisión explícita.';
comment on column public.firma_envios.onboarding_resultado is
  'completado | rechazado_inicio | abandonado_mitad';

alter table if exists public.firma_documentos
  add column if not exists onboarding_modal_at timestamptz,
  add column if not exists onboarding_resuelto_at timestamptz,
  add column if not exists onboarding_resultado text;

notify pgrst, 'reload schema';
