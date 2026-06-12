-- Categoría de función (brecha salarial) por trabajador — fuente manual en Supabase
-- Ejecutar en Supabase SQL Editor

create table if not exists public.brecha_empleados_categoria (
  id uuid primary key default gen_random_uuid(),
  empresa text not null check (empresa in ('solucions', 'menjar')),
  nombre text not null,
  nombre_normalizado text not null,
  categoria_funcion text not null check (
    categoria_funcion in ('DIRECCION', 'PERSONAL TECNIC', 'ADMINISTRACIÓ', 'CATERING', 'OTROS')
  ),
  holded_employee_id text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (empresa, nombre_normalizado)
);

create index if not exists idx_brecha_empleados_categoria_empresa
  on public.brecha_empleados_categoria (empresa);

create index if not exists idx_brecha_empleados_categoria_holded
  on public.brecha_empleados_categoria (empresa, holded_employee_id)
  where holded_employee_id is not null;

drop trigger if exists set_brecha_empleados_categoria_updated_at on public.brecha_empleados_categoria;
create trigger set_brecha_empleados_categoria_updated_at
before update on public.brecha_empleados_categoria
for each row execute function public.set_updated_at();

alter table public.brecha_empleados_categoria enable row level security;

drop policy if exists "read brecha empleados categoria" on public.brecha_empleados_categoria;
create policy "read brecha empleados categoria"
on public.brecha_empleados_categoria
for select
to authenticated
using (true);

drop policy if exists "write brecha empleados categoria privileged" on public.brecha_empleados_categoria;
create policy "write brecha empleados categoria privileged"
on public.brecha_empleados_categoria
for all
to authenticated
using (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and lower(coalesce(up.role, '')) in ('admin', 'management', 'manager')
  )
)
with check (
  exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and lower(coalesce(up.role, '')) in ('admin', 'management', 'manager')
  )
);

-- Seed EI SSS (solucions) — lista manual 2026
insert into public.brecha_empleados_categoria (empresa, nombre, nombre_normalizado, categoria_funcion)
values
  ('solucions', 'BRUNO LOPEZ', 'BRUNO LOPEZ', 'DIRECCION'),
  ('solucions', 'JOAN CARLES LOPEZ', 'JOAN CARLES LOPEZ', 'DIRECCION'),
  ('solucions', 'OSCAR LOPEZ', 'OSCAR LOPEZ', 'PERSONAL TECNIC'),
  ('solucions', 'PAULA BARBOSA', 'PAULA BARBOSA', 'ADMINISTRACIÓ'),
  ('solucions', 'ANGIE LIZETH CIFUENTES', 'ANGIE LIZETH CIFUENTES', 'ADMINISTRACIÓ'),
  ('solucions', 'JUAN SEBASTIAN RUIZ', 'JUAN SEBASTIAN RUIZ', 'ADMINISTRACIÓ'),
  ('solucions', 'ELVIS GARFIAS', 'ELVIS GARFIAS', 'CATERING'),
  ('solucions', 'MAMADOU BALDE', 'MAMADOU BALDE', 'CATERING'),
  ('solucions', 'MARYELIN PAEZ', 'MARYELIN PAEZ', 'CATERING'),
  ('solucions', 'DAVID LOPEZ', 'DAVID LOPEZ', 'CATERING'),
  ('solucions', 'M. ANGELES HERNANDEZ', 'M ANGELES HERNANDEZ', 'CATERING'),
  ('solucions', 'FELIPE RAMIREZ', 'FELIPE RAMIREZ', 'CATERING'),
  ('solucions', 'BELINDA CUBAS', 'BELINDA CUBAS', 'CATERING'),
  ('solucions', 'LOLA IZQUIERDO', 'LOLA IZQUIERDO', 'CATERING'),
  ('solucions', 'GIOVANA ELVIRA LAURE', 'GIOVANA ELVIRA LAURE', 'CATERING')
on conflict (empresa, nombre_normalizado) do update set
  nombre = excluded.nombre,
  categoria_funcion = excluded.categoria_funcion,
  updated_at = now();
