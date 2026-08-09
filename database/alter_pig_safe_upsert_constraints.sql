-- Claves únicas necesarias para que los guardados PIG editables usen upsert seguro.
-- Antes de crear la constraint se deduplican filas antiguas conservando la más reciente.

delete from public.pig_itinerario_ei old
using public.pig_itinerario_ei keep
where old.year = keep.year
  and old.semestre = keep.semestre
  and old.sort_order = keep.sort_order
  and old.id <> keep.id
  and (
    keep.updated_at > old.updated_at
    or (keep.updated_at = old.updated_at and keep.id::text > old.id::text)
  );

alter table public.pig_itinerario_ei
  drop constraint if exists pig_itinerario_ei_unique;

alter table public.pig_itinerario_ei
  add constraint pig_itinerario_ei_unique unique (year, semestre, sort_order);

delete from public.pig_tesoreria_previsiones old
using public.pig_tesoreria_previsiones keep
where old.year = keep.year
  and old.bloque = keep.bloque
  and old.sort_order = keep.sort_order
  and old.id <> keep.id
  and (
    keep.updated_at > old.updated_at
    or (keep.updated_at = old.updated_at and keep.id::text > old.id::text)
  );

alter table public.pig_tesoreria_previsiones
  drop constraint if exists pig_tesoreria_previsiones_unique;

alter table public.pig_tesoreria_previsiones
  add constraint pig_tesoreria_previsiones_unique unique (year, bloque, sort_order);
