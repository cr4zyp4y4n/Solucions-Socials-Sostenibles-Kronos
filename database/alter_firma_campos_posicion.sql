-- Campos de texto auto-rellenados en plantillas de firma (opcionales por plantilla).
-- Solo las claves presentes se dibujan al crear el pack.
-- Claves: nombre, apellidos, dni, nombre_completo, email, telefono, fecha_nacimiento, fecha, empresa, empresa_nif.
-- Formato JSON ejemplo (puedes omitir las que no haga falta):
-- {
--   "nombre":   {"pageIndex":0,"x":120,"y":640,"width":180,"height":14,"fontSize":10},
--   "apellidos":{"pageIndex":0,"x":120,"y":620,"width":220,"height":14,"fontSize":10},
--   "dni":      {"pageIndex":0,"x":120,"y":600,"width":120,"height":14,"fontSize":10},
--   "empresa":  {"pageIndex":0,"x":120,"y":580,"width":260,"height":14,"fontSize":10}
-- }
-- Coordenadas PDF: origen abajo-izquierda, puntos.

alter table if exists public.firma_plantillas
  add column if not exists campos_posicion jsonb;

comment on column public.firma_plantillas.campos_posicion is
  'Posiciones opcionales de auto-relleno (nombre, apellidos, dni, nombre_completo, email, telefono, fecha_nacimiento, fecha, empresa, empresa_nif). Solo las claves presentes se rellenan.';

notify pgrst, 'reload schema';
