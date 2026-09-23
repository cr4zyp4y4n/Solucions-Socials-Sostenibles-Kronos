-- Posición del sello visual de aceptación (pequeño) en plantillas y documentos.
-- Coordenadas PDF: origen abajo-izquierda, unidades en puntos.
-- Ejemplo JSON:
--   {"pageIndex":0,"x":380,"y":48,"width":145,"height":38}

alter table if exists public.firma_plantillas
  add column if not exists sello_posicion jsonb;

alter table if exists public.firma_documentos
  add column if not exists sello_posicion jsonb;

comment on column public.firma_plantillas.sello_posicion is
  'Rectángulo del sello de aceptación en el PDF plantilla (pageIndex, x, y, width, height).';
comment on column public.firma_documentos.sello_posicion is
  'Rectángulo del sello al firmar; se copia de la plantilla o se define al subir el PDF.';

notify pgrst, 'reload schema';
