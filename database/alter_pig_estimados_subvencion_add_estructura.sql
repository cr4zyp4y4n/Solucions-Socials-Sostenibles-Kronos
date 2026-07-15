-- Permite guardar estimados de subvención para ESTRUCTURA (hoja PIG ESTRUCTURA SUBV 740).

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_linea_chk;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_linea_chk
  check (linea in ('CATERING', 'IDONI', 'KOIKI', 'ESTRUCTURA'));
