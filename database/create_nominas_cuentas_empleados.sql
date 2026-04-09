-- Tabla para mapear empleado (código Innuva) -> cuentas contables Holded (nóminas)
-- Ejecutar en Supabase (SQL editor).

create table if not exists public.nominas_cuentas_empleados (
  codigo_innuva text primary key,
  trabajador text null,
  salario_compte_640 text not null,
  total_ss_compte_476 text not null,
  gasto_ss_empresa_compte_642 text not null,
  irpf_compte_4751 text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_nominas_cuentas_empleados_trabajador
on public.nominas_cuentas_empleados using btree (trabajador);

-- Trigger updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_nominas_cuentas_empleados_updated_at on public.nominas_cuentas_empleados;
create trigger set_nominas_cuentas_empleados_updated_at
before update on public.nominas_cuentas_empleados
for each row execute function public.set_updated_at();

-- RLS
alter table public.nominas_cuentas_empleados enable row level security;

-- Lectura para usuarios autenticados (roles internos ya filtran secciones en UI)
drop policy if exists "read nominas cuentas empleados" on public.nominas_cuentas_empleados;
create policy "read nominas cuentas empleados"
on public.nominas_cuentas_empleados
for select
to authenticated
using (true);

-- Escritura solo para admin/management/manager vía user_profiles.role
-- Nota: requiere que exista public.user_profiles con columna role y fila para auth.uid()
drop policy if exists "write nominas cuentas empleados privileged" on public.nominas_cuentas_empleados;
create policy "write nominas cuentas empleados privileged"
on public.nominas_cuentas_empleados
for all
to authenticated
using (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and lower(coalesce(up.role, '')) in ('admin','management','manager')
  )
)
with check (
  exists (
    select 1
    from public.user_profiles up
    where up.id = auth.uid()
      and lower(coalesce(up.role, '')) in ('admin','management','manager')
  )
);

