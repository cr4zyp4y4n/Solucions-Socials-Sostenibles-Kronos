-- Tramos mensuales por subvención (mismo slot, distinto importe según meses).
-- Ej.: subv. 1 → 2.100 € ene-may, 1.500 € jun-dic.

alter table public.pig_estimados_subvencion
  add column if not exists segment int not null default 1,
  add column if not exists month_from int not null default 1,
  add column if not exists month_to int not null default 12;

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_unique;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_unique unique (linea, year, slot, segment);

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_segment_chk;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_segment_chk check (segment >= 1 and segment <= 2);

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_month_from_chk;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_month_from_chk check (month_from >= 1 and month_from <= 12);

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_month_to_chk;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_month_to_chk check (month_to >= 1 and month_to <= 12);

alter table public.pig_estimados_subvencion
  drop constraint if exists pig_estimados_subvencion_month_range_chk;

alter table public.pig_estimados_subvencion
  add constraint pig_estimados_subvencion_month_range_chk check (month_from <= month_to);
