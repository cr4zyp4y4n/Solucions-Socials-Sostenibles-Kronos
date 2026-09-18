-- Foto de identidad (selfie + DNI delante de la cara) en el portal de firma.
-- Obligatoria antes de solicitar el SMS / firmar.
-- Ejecutar en Supabase SQL Editor.

alter table if exists public.firma_envios
  add column if not exists identidad_foto_path text,
  add column if not exists identidad_foto_at timestamptz,
  add column if not exists identidad_foto_hash text;

comment on column public.firma_envios.identidad_foto_path is
  'Ruta en bucket firma-documentos de la selfie con DNI del trabajador.';
comment on column public.firma_envios.identidad_foto_at is
  'Momento en que se subió la foto de identidad desde el portal.';
comment on column public.firma_envios.identidad_foto_hash is
  'SHA-256 de la imagen subida (evidencia).';

-- Legacy: documentos sueltos sin envio_id
alter table if exists public.firma_documentos
  add column if not exists identidad_foto_path text,
  add column if not exists identidad_foto_at timestamptz,
  add column if not exists identidad_foto_hash text;

comment on column public.firma_documentos.identidad_foto_path is
  'Foto de identidad (legacy sin pack / sin envio_id).';
comment on column public.firma_documentos.identidad_foto_at is
  'Momento de subida de la foto de identidad (legacy).';
comment on column public.firma_documentos.identidad_foto_hash is
  'SHA-256 de la imagen (legacy).';

notify pgrst, 'reload schema';
