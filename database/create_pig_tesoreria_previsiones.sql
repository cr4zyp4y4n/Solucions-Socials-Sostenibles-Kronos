-- Previsiones editables de TESORERÍA (ingresos por subv / por aprobar).

create table if not exists public.pig_tesoreria_previsiones (
  id uuid not null default gen_random_uuid(),
  year int not null,
  bloque text not null,
  sort_order int not null default 0,
  concepto text not null default '',
  ingreso_previsto numeric(15, 2),
  observacion text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pig_tesoreria_previsiones_pkey primary key (id),
  constraint pig_tesoreria_previsiones_year_chk check (year >= 2000 and year <= 2100),
  constraint pig_tesoreria_previsiones_bloque_chk check (bloque in ('ingresos_por_subv', 'por_aprobar'))
);

create index if not exists idx_pig_tesoreria_previsiones_year_bloque
  on public.pig_tesoreria_previsiones (year, bloque, sort_order);

drop trigger if exists set_pig_tesoreria_previsiones_updated_at on public.pig_tesoreria_previsiones;
create trigger set_pig_tesoreria_previsiones_updated_at
before update on public.pig_tesoreria_previsiones
for each row execute function public.set_updated_at_timestamp();

alter table public.pig_tesoreria_previsiones enable row level security;

drop policy if exists "pig_tesoreria_previsiones_select" on public.pig_tesoreria_previsiones;
drop policy if exists "pig_tesoreria_previsiones_insert" on public.pig_tesoreria_previsiones;
drop policy if exists "pig_tesoreria_previsiones_update" on public.pig_tesoreria_previsiones;
drop policy if exists "pig_tesoreria_previsiones_delete" on public.pig_tesoreria_previsiones;

create policy "pig_tesoreria_previsiones_select"
  on public.pig_tesoreria_previsiones for select
  using (auth.role() = 'authenticated');

create policy "pig_tesoreria_previsiones_insert"
  on public.pig_tesoreria_previsiones for insert
  with check (auth.role() = 'authenticated');

create policy "pig_tesoreria_previsiones_update"
  on public.pig_tesoreria_previsiones for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "pig_tesoreria_previsiones_delete"
  on public.pig_tesoreria_previsiones for delete
  using (auth.role() = 'authenticated');
