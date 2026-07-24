  -- Itinerario E.I (jornadas) editable para CR GENERAL EISSS.
  -- Persistencia por año + semestre (1 | 2).

  create table if not exists public.pig_itinerario_ei (
    id uuid not null default gen_random_uuid(),
    year int not null,
    semestre int not null,
    sort_order int not null default 0,
    linea text not null default '',
    trabajador text not null default '',
    fecha text not null default '',
    jornada text not null default '',
    num_orden text not null default '',
    observaciones text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint pig_itinerario_ei_pkey primary key (id),
    constraint pig_itinerario_ei_year_chk check (year >= 2000 and year <= 2100),
    constraint pig_itinerario_ei_semestre_chk check (semestre in (1, 2))
  );

  create index if not exists idx_pig_itinerario_ei_year_sem
    on public.pig_itinerario_ei (year, semestre, sort_order);

  drop trigger if exists set_pig_itinerario_ei_updated_at on public.pig_itinerario_ei;
  create trigger set_pig_itinerario_ei_updated_at
  before update on public.pig_itinerario_ei
  for each row execute function public.set_updated_at_timestamp();

  alter table public.pig_itinerario_ei enable row level security;

  drop policy if exists "pig_itinerario_ei_select" on public.pig_itinerario_ei;
  drop policy if exists "pig_itinerario_ei_insert" on public.pig_itinerario_ei;
  drop policy if exists "pig_itinerario_ei_update" on public.pig_itinerario_ei;
  drop policy if exists "pig_itinerario_ei_delete" on public.pig_itinerario_ei;

  create policy "pig_itinerario_ei_select"
    on public.pig_itinerario_ei for select
    using (auth.role() = 'authenticated');

  create policy "pig_itinerario_ei_insert"
    on public.pig_itinerario_ei for insert
    with check (auth.role() = 'authenticated');

  create policy "pig_itinerario_ei_update"
    on public.pig_itinerario_ei for update
    using (auth.role() = 'authenticated')
    with check (auth.role() = 'authenticated');

  create policy "pig_itinerario_ei_delete"
    on public.pig_itinerario_ei for delete
    using (auth.role() = 'authenticated');
