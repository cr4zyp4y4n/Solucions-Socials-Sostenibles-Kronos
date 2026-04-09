-- Soporte multi-empresa para el conversor Innuva → Holded
-- Permite tener cuentas distintas por empleado (mismo CODIGO) según empresa.

alter table public.nominas_cuentas_empleados
add column if not exists empresa text not null default 'solucions';

-- Migración de PK: de (codigo_innuva) a (empresa, codigo_innuva)
alter table public.nominas_cuentas_empleados
drop constraint if exists nominas_cuentas_empleados_pkey;

alter table public.nominas_cuentas_empleados
add constraint nominas_cuentas_empleados_pkey
primary key (empresa, codigo_innuva);

