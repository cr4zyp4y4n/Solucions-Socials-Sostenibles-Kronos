-- Añadir campo de observaciones (texto largo) a subvenciones
alter table public.subvenciones
add column if not exists observaciones text null;

create index if not exists idx_subvenciones_observaciones
on public.subvenciones using gin (to_tsvector('spanish', coalesce(observaciones, '')));

