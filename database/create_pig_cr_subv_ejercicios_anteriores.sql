-- Filas manuales CR GENERAL: «Ingresos Subvenciones Ejercicios Anteriores»
-- (concepto + importe; el título fijo vive en código Kronos / Excel).

create table if not exists public.pig_cr_subv_ejercicios_anteriores (
  id uuid not null default gen_random_uuid(),
  year int not null,
  sort_order int not null default 0,
  concepto text not null default '',
  importe numeric(15, 2),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint pig_cr_subv_ejercicios_anteriores_pkey primary key (id),
  constraint pig_cr_subv_ejercicios_anteriores_year_chk check (year >= 2000 and year <= 2100)
);

create index if not exists idx_pig_cr_subv_ejercicios_anteriores_year
  on public.pig_cr_subv_ejercicios_anteriores (year, sort_order);

drop trigger if exists set_pig_cr_subv_ejercicios_anteriores_updated_at
  on public.pig_cr_subv_ejercicios_anteriores;
create trigger set_pig_cr_subv_ejercicios_anteriores_updated_at
before update on public.pig_cr_subv_ejercicios_anteriores
for each row execute function public.set_updated_at_timestamp();

alter table public.pig_cr_subv_ejercicios_anteriores enable row level security;

drop policy if exists "pig_cr_subv_ejercicios_anteriores_select"
  on public.pig_cr_subv_ejercicios_anteriores;
drop policy if exists "pig_cr_subv_ejercicios_anteriores_insert"
  on public.pig_cr_subv_ejercicios_anteriores;
drop policy if exists "pig_cr_subv_ejercicios_anteriores_update"
  on public.pig_cr_subv_ejercicios_anteriores;
drop policy if exists "pig_cr_subv_ejercicios_anteriores_delete"
  on public.pig_cr_subv_ejercicios_anteriores;

create policy "pig_cr_subv_ejercicios_anteriores_select"
  on public.pig_cr_subv_ejercicios_anteriores for select
  using (auth.role() = 'authenticated');

create policy "pig_cr_subv_ejercicios_anteriores_insert"
  on public.pig_cr_subv_ejercicios_anteriores for insert
  with check (auth.role() = 'authenticated');

create policy "pig_cr_subv_ejercicios_anteriores_update"
  on public.pig_cr_subv_ejercicios_anteriores for update
  using (auth.role() = 'authenticated')
  with check (auth.role() = 'authenticated');

create policy "pig_cr_subv_ejercicios_anteriores_delete"
  on public.pig_cr_subv_ejercicios_anteriores for delete
  using (auth.role() = 'authenticated');
