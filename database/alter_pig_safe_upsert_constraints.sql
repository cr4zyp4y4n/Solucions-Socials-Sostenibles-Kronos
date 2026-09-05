-- Claves necesarias para guardar PIG editable con UPSERT sin borrar antes.
-- Conserva la fila mas reciente si ya hubiera duplicados por ano/bloque/posicion.

delete from public.pig_itinerario_ei a
using public.pig_itinerario_ei b
where a.ctid < b.ctid
  and a.year = b.year
  and a.semestre = b.semestre
  and a.sort_order = b.sort_order;

alter table public.pig_itinerario_ei
  drop constraint if exists pig_itinerario_ei_unique;

alter table public.pig_itinerario_ei
  add constraint pig_itinerario_ei_unique unique (year, semestre, sort_order);

delete from public.pig_tesoreria_previsiones a
using public.pig_tesoreria_previsiones b
where a.ctid < b.ctid
  and a.year = b.year
  and a.bloque = b.bloque
  and a.sort_order = b.sort_order;

alter table public.pig_tesoreria_previsiones
  drop constraint if exists pig_tesoreria_previsiones_unique;

alter table public.pig_tesoreria_previsiones
  add constraint pig_tesoreria_previsiones_unique unique (year, bloque, sort_order);

delete from public.pig_tesoreria_caja_corto a
using public.pig_tesoreria_caja_corto b
where a.ctid < b.ctid
  and a.year = b.year
  and a.bloque = b.bloque
  and a.sort_order = b.sort_order;

alter table public.pig_tesoreria_caja_corto
  drop constraint if exists pig_tesoreria_caja_corto_unique;

alter table public.pig_tesoreria_caja_corto
  add constraint pig_tesoreria_caja_corto_unique unique (year, bloque, sort_order);
