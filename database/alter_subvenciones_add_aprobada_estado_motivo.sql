-- Añadir "estado" boolean (aprobada/rechazada/pendiente) + motivo a subvenciones
-- Pendiente = NULL, Aprobada = TRUE, Rechazada = FALSE

alter table public.subvenciones
add column if not exists aprobada boolean null;

alter table public.subvenciones
add column if not exists estado_motivo text null;

create index if not exists idx_subvenciones_aprobada
on public.subvenciones (aprobada);

-- Backfill opcional desde el campo legacy "estado" (texto)
-- Ajusta los patrones si usas otros textos.
update public.subvenciones
set aprobada = case
  when estado ilike '%rechaz%' then false
  when estado ilike '%deneg%' then false
  when estado ilike '%no conced%' then false
  when estado ilike '%aprob%' then true
  when estado ilike '%conced%' then true
  when estado ilike '%otorg%' then true
  else aprobada
end
where aprobada is null
  and coalesce(estado, '') <> '';

