-- Posición del sello visual de aceptación (pequeño) en plantillas y documentos.
-- Coordenadas PDF: origen abajo-izquierda, unidades en puntos.
-- Formato:
--   Un sello (legado):  {"pageIndex":0,"x":380,"y":48,"width":145,"height":38}
--   Varias páginas:     [{"pageIndex":0,...},{"pageIndex":5,...},...]

alter table if exists public.firma_plantillas
  add column if not exists sello_posicion jsonb;

alter table if exists public.firma_documentos
  add column if not exists sello_posicion jsonb;

comment on column public.firma_plantillas.sello_posicion is
  'Sello(s) de aceptación: objeto {pageIndex,x,y,width,height} o array de ellos (una entrada por página).';
comment on column public.firma_documentos.sello_posicion is
  'Sello(s) al firmar; se copia de la plantilla. Objeto único (legado) o array multi-página.';

notify pgrst, 'reload schema';
