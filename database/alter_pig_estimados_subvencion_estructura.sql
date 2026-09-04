-- Permite persistir la linea ESTRUCTURA en estimados de subvencion PIG.
-- Sin este cambio, el guardado de ESTRUCTURA falla por CHECK tras intentar guardar la configuracion.

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_linea_chk;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_linea_chk
  check (linea in ('CATERING','IDONI','KOIKI','ESTRUCTURA'));
