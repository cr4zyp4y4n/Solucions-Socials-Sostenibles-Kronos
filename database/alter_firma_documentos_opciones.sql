-- Opciones registradas en el portal al confirmar lectura / firmar (formación acoso, etc.)
alter table if exists public.firma_documentos
  add column if not exists opciones_aceptacion jsonb;

comment on column public.firma_documentos.opciones_aceptacion is
  'Declaraciones del trabajador en el portal: lectura_confirmada, formacion_acoso, etc.';

notify pgrst, 'reload schema';
