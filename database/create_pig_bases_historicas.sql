-- Tabla para guardar bases históricas por línea/año/mes.
-- Se usa en la hoja "COMPARATIVA ANUAL" para poder comparar el año actual
-- contra el año anterior (ej: 2026 vs 2025), sin hardcodear bases nuevas.

create table if not exists public.pig_bases_historicas (
  id uuid not null default gen_random_uuid(),
  linea text not null,
  year int not null,
  month int not null,
  base numeric(15, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pig_bases_historicas_pkey primary key (id),
  constraint pig_bases_historicas_linea_chk check (linea in ('CATERING','IDONI','KOIKI')),
  constraint pig_bases_historicas_year_chk check (year >= 2000 and year <= 2100),
  constraint pig_bases_historicas_month_chk check (month >= 1 and month <= 12),
  constraint pig_bases_historicas_unique unique (linea, year, month)
);

create index if not exists idx_pig_bases_historicas_linea_year
  on public.pig_bases_historicas (linea, year);

-- Trigger updated_at (si ya existe la función en tu schema, úsala).
do $$
begin
  if exists (select 1 from pg_proc where proname = 'update_subvenciones_updated_at') then
    -- no-op: nombre distinto en algunos schemas
    null;
  end if;
exception when others then
  null;
end $$;

-- Trigger genérico para updated_at
create or replace function public.set_updated_at_timestamp()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_pig_bases_historicas_updated_at on public.pig_bases_historicas;
create trigger set_pig_bases_historicas_updated_at
before update on public.pig_bases_historicas
for each row execute function public.set_updated_at_timestamp();

