-- Estimados de subvención mensuales por línea PIG (CATERING / IDONI / KOIKI).
-- Cada slot admite hasta 2 tramos (importe + rango de meses).

create table if not exists public.pig_estimados_subvencion (
  id uuid not null default gen_random_uuid(),
  linea text not null,
  year int not null,
  slot int not null default 1,
  segment int not null default 1,
  month_from int not null default 1,
  month_to int not null default 12,
  amount numeric(15, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pig_estimados_subvencion_pkey primary key (id),
  constraint pig_estimados_subvencion_linea_chk check (linea in ('CATERING','IDONI','KOIKI')),
  constraint pig_estimados_subvencion_year_chk check (year >= 2000 and year <= 2100),
  constraint pig_estimados_subvencion_slot_chk check (slot >= 1 and slot <= 5),
  constraint pig_estimados_subvencion_segment_chk check (segment >= 1 and segment <= 2),
  constraint pig_estimados_subvencion_month_from_chk check (month_from >= 1 and month_from <= 12),
  constraint pig_estimados_subvencion_month_to_chk check (month_to >= 1 and month_to <= 12),
  constraint pig_estimados_subvencion_month_range_chk check (month_from <= month_to),
  constraint pig_estimados_subvencion_unique unique (linea, year, slot, segment)
);

create index if not exists idx_pig_estimados_subvencion_linea_year
  on public.pig_estimados_subvencion (linea, year);

drop trigger if exists set_pig_estimados_subvencion_updated_at on public.pig_estimados_subvencion;
create trigger set_pig_estimados_subvencion_updated_at
before update on public.pig_estimados_subvencion
for each row execute function public.set_updated_at_timestamp();
