-- Previsión de caja a corto plazo (PIG Normal TESORERÍA). Editable manualmente.
-- No se usa en Cuenta Resultados.

create table if not exists public.pig_tesoreria_caja_corto (
  id uuid not null default gen_random_uuid(),
  year int not null,
  bloque text not null,
  sort_order int not null default 0,
  concepto text not null default '',
  importe numeric(15, 2),
  observacion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pig_tesoreria_caja_corto_pkey primary key (id),
  constraint pig_tesoreria_caja_corto_year_chk check (year >= 2000 and year <= 2100),
  constraint pig_tesoreria_caja_corto_bloque_chk check (bloque in ('pagos', 'ingresos', 'meta')),
  constraint pig_tesoreria_caja_corto_unique unique (year, bloque, sort_order)
);

create index if not exists idx_pig_tesoreria_caja_corto_year_bloque
  on public.pig_tesoreria_caja_corto (year, bloque, sort_order);

drop trigger if exists set_pig_tesoreria_caja_corto_updated_at on public.pig_tesoreria_caja_corto;
create trigger set_pig_tesoreria_caja_corto_updated_at
before update on public.pig_tesoreria_caja_corto
for each row execute function public.set_updated_at_timestamp();

alter table public.pig_tesoreria_caja_corto enable row level security;

drop policy if exists "pig_tesoreria_caja_corto_select" on public.pig_tesoreria_caja_corto;
drop policy if exists "pig_tesoreria_caja_corto_insert" on public.pig_tesoreria_caja_corto;
drop policy if exists "pig_tesoreria_caja_corto_update" on public.pig_tesoreria_caja_corto;
drop policy if exists "pig_tesoreria_caja_corto_delete" on public.pig_tesoreria_caja_corto;

create policy "pig_tesoreria_caja_corto_select"
  on public.pig_tesoreria_caja_corto for select
  using (auth.role() = 'authenticated');

create policy "pig_tesoreria_caja_corto_insert"
  on public.pig_tesoreria_caja_corto for insert
  with check (auth.role() = 'authenticated');

create policy "pig_tesoreria_caja_corto_update"
  on public.pig_tesoreria_caja_corto for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "pig_tesoreria_caja_corto_delete"
  on public.pig_tesoreria_caja_corto for delete
  using (auth.role() = 'authenticated');
