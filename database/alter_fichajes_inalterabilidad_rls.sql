-- =====================================================
-- Fichaje: inalterabilidad (soft-delete) + RLS por empleado
-- Cumplimiento RDL 8/2019 / preparación borrador RD
-- Ejecutar en Supabase SQL Editor.
-- =====================================================

-- 1) Soft-delete en fichajes
alter table public.fichajes
  add column if not exists anulado_at timestamptz,
  add column if not exists anulado_por uuid references public.user_profiles(id) on delete set null,
  add column if not exists anulado_motivo text;

create index if not exists idx_fichajes_anulado_at
  on public.fichajes (anulado_at)
  where anulado_at is null;

comment on column public.fichajes.anulado_at is
  'Anulación lógica (no borrado). Conserva el registro y la auditoría ≥ 4 años.';
comment on column public.fichajes.anulado_motivo is
  'Motivo obligatorio al anular un fichaje.';

-- Unicidad solo entre fichajes activos (permite re-fichar el mismo día tras anular)
alter table public.fichajes drop constraint if exists fichaje_unico_dia;
drop index if exists fichaje_unico_dia_activo;
create unique index if not exists fichaje_unico_dia_activo
  on public.fichajes (empleado_id, fecha)
  where anulado_at is null;

-- 2) Auditoría: no perder rastro si alguien fuerza un DELETE
alter table public.fichajes_auditoria
  drop constraint if exists fichajes_auditoria_fichaje_id_fkey;

alter table public.fichajes_auditoria
  alter column fichaje_id drop not null;

alter table public.fichajes_auditoria
  add constraint fichajes_auditoria_fichaje_id_fkey
  foreign key (fichaje_id) references public.fichajes(id) on delete set null;

-- Ampliar acciones de auditoría
alter table public.fichajes_auditoria
  drop constraint if exists fichajes_auditoria_accion_check;

alter table public.fichajes_auditoria
  add constraint fichajes_auditoria_accion_check
  check (accion in (
    'creado',
    'modificado',
    'eliminado',
    'anulado',
    'pausa_iniciada',
    'pausa_finalizada',
    'salida_registrada'
  ));

-- 3) Prohibir DELETE duro desde la app (solo anulación)
drop policy if exists "Admin y gestión pueden eliminar fichajes" on public.fichajes;
drop policy if exists "Admin puede eliminar fichajes" on public.fichajes;

-- Política explícita: nadie autenticado puede DELETE
drop policy if exists "Nadie puede borrar fichajes (usar anulación)" on public.fichajes;
create policy "Nadie puede borrar fichajes (usar anulación)"
  on public.fichajes
  for delete
  using (false);

-- 4) Tabla de vinculación usuario Kronos/portal ↔ empleado Holded
create table if not exists public.fichajes_empleado_usuarios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.user_profiles(id) on delete cascade,
  empleado_id text not null,
  activo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint fichajes_empleado_usuarios_unique unique (user_id, empleado_id)
);

create index if not exists idx_fichajes_empleado_usuarios_user
  on public.fichajes_empleado_usuarios (user_id)
  where activo = true;

create index if not exists idx_fichajes_empleado_usuarios_empleado
  on public.fichajes_empleado_usuarios (empleado_id)
  where activo = true;

comment on table public.fichajes_empleado_usuarios is
  'Vincula auth.uid() con empleado_id (Holded) para RLS de fichajes. Si el usuario no tiene filas, se mantiene acceso amplio (transición).';

alter table public.fichajes_empleado_usuarios enable row level security;

drop policy if exists "fichajes_empleado_usuarios_select_own" on public.fichajes_empleado_usuarios;
create policy "fichajes_empleado_usuarios_select_own"
  on public.fichajes_empleado_usuarios for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and lower(coalesce(up.role, '')) in (
          'admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión'
        )
    )
  );

drop policy if exists "fichajes_empleado_usuarios_write_own" on public.fichajes_empleado_usuarios;
create policy "fichajes_empleado_usuarios_write_own"
  on public.fichajes_empleado_usuarios for all to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and lower(coalesce(up.role, '')) in (
          'admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión'
        )
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.user_profiles up
      where up.id = auth.uid()
        and lower(coalesce(up.role, '')) in (
          'admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión'
        )
    )
  );

-- 5) Helper RLS
create or replace function public.fichaje_es_privilegiado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and lower(coalesce(up.role, '')) in (
        'admin', 'management', 'manager', 'jefe', 'administrador',
        'gestion', 'gestión', 'inspeccion', 'inspector'
      )
  );
$$;

create or replace function public.fichaje_puede_ver_empleado(p_empleado_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.fichaje_es_privilegiado()
    or exists (
      select 1 from public.fichajes_empleado_usuarios m
      where m.user_id = auth.uid()
        and m.empleado_id = p_empleado_id
        and m.activo = true
    )
    -- Transición: sin vinculación aún → mismo acceso que antes (cualquier autenticado)
    or not exists (
      select 1 from public.fichajes_empleado_usuarios m2
      where m2.user_id = auth.uid() and m2.activo = true
    );
$$;

revoke all on function public.fichaje_es_privilegiado() from public;
revoke all on function public.fichaje_puede_ver_empleado(text) from public;
grant execute on function public.fichaje_es_privilegiado() to authenticated;
grant execute on function public.fichaje_puede_ver_empleado(text) to authenticated;

-- 6) RLS SELECT refinada (fichajes + pausas + auditoría)
drop policy if exists "Trabajadores pueden ver sus fichajes" on public.fichajes;
drop policy if exists "Cualquier usuario autenticado puede ver fichajes" on public.fichajes;
drop policy if exists "fichajes_select_scoped" on public.fichajes;

create policy "fichajes_select_scoped"
  on public.fichajes
  for select
  to authenticated
  using (public.fichaje_puede_ver_empleado(empleado_id));

drop policy if exists "Usuarios pueden ver pausas de sus fichajes" on public.fichajes_pausas;
drop policy if exists "Cualquier usuario autenticado puede ver pausas" on public.fichajes_pausas;
drop policy if exists "fichajes_pausas_select_scoped" on public.fichajes_pausas;

create policy "fichajes_pausas_select_scoped"
  on public.fichajes_pausas
  for select
  to authenticated
  using (
    exists (
      select 1 from public.fichajes f
      where f.id = fichajes_pausas.fichaje_id
        and public.fichaje_puede_ver_empleado(f.empleado_id)
    )
  );

drop policy if exists "Usuarios autenticados pueden ver auditoría" on public.fichajes_auditoria;
drop policy if exists "fichajes_auditoria_select_scoped" on public.fichajes_auditoria;

create policy "fichajes_auditoria_select_scoped"
  on public.fichajes_auditoria
  for select
  to authenticated
  using (
    public.fichaje_es_privilegiado()
    or (
      fichaje_id is not null
      and exists (
        select 1 from public.fichajes f
        where f.id = fichajes_auditoria.fichaje_id
          and public.fichaje_puede_ver_empleado(f.empleado_id)
      )
    )
  );

-- Bloquear DELETE en auditoría desde clientes
drop policy if exists "Nadie borra auditoria fichajes" on public.fichajes_auditoria;
create policy "Nadie borra auditoria fichajes"
  on public.fichajes_auditoria
  for delete
  using (false);

-- 7) RPC anular fichaje (soft-delete + auditoría)
create or replace function public.anular_fichaje(
  p_fichaje_id uuid,
  p_motivo text
)
returns public.fichajes
language plpgsql
security definer
set search_path = public
as $$
declare
  v_antes public.fichajes;
  v_row public.fichajes;
  v_motivo text := nullif(trim(coalesce(p_motivo, '')), '');
begin
  if v_motivo is null or char_length(v_motivo) < 3 then
    raise exception 'El motivo de anulación es obligatorio (mín. 3 caracteres)';
  end if;

  if not exists (
    select 1 from public.user_profiles up
    where up.id = auth.uid()
      and lower(coalesce(up.role, '')) in (
        'admin', 'management', 'manager', 'jefe', 'administrador', 'gestion', 'gestión'
      )
  ) then
    raise exception 'No tienes permiso para anular fichajes';
  end if;

  select * into v_antes from public.fichajes where id = p_fichaje_id for update;
  if not found then
    raise exception 'Fichaje no encontrado';
  end if;
  if v_antes.anulado_at is not null then
    raise exception 'El fichaje ya estaba anulado';
  end if;

  update public.fichajes
  set
    anulado_at = now(),
    anulado_por = auth.uid(),
    anulado_motivo = v_motivo,
    updated_at = now()
  where id = p_fichaje_id
  returning * into v_row;

  insert into public.fichajes_auditoria (
    fichaje_id, accion, quien, cuando, valor_anterior, valor_nuevo, motivo
  ) values (
    p_fichaje_id,
    'anulado',
    auth.uid(),
    now(),
    to_jsonb(v_antes),
    jsonb_build_object(
      'anulado_at', v_row.anulado_at,
      'anulado_por', v_row.anulado_por,
      'anulado_motivo', v_motivo
    ),
    v_motivo
  );

  return v_row;
end;
$$;

revoke all on function public.anular_fichaje(uuid, text) from public;
grant execute on function public.anular_fichaje(uuid, text) to authenticated;

-- 8) Vincular usuario ↔ empleado (tras validar código)
create or replace function public.vincular_empleado_fichaje(p_empleado_id text)
returns public.fichajes_empleado_usuarios
language plpgsql
security definer
set search_path = public
as $$
declare
  v_emp text := nullif(trim(coalesce(p_empleado_id, '')), '');
  v_row public.fichajes_empleado_usuarios;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;
  if v_emp is null then
    raise exception 'Falta empleado_id';
  end if;

  insert into public.fichajes_empleado_usuarios (user_id, empleado_id, activo)
  values (auth.uid(), v_emp, true)
  on conflict (user_id, empleado_id) do update
    set activo = true, updated_at = now()
  returning * into v_row;

  return v_row;
end;
$$;

revoke all on function public.vincular_empleado_fichaje(text) from public;
grant execute on function public.vincular_empleado_fichaje(text) to authenticated;

-- 9) Resúmenes / listados: excluir fichajes anulados
-- DROP necesario si el tipo de retorno cambió (TIMESTAMP → TIMESTAMPTZ)
drop function if exists public.get_fichajes_empleado(text, date, date);

create function public.get_fichajes_empleado(
  p_empleado_id text,
  p_fecha_inicio date default null,
  p_fecha_fin date default null
)
returns table (
  id uuid,
  fecha date,
  hora_entrada timestamptz,
  hora_salida timestamptz,
  horas_trabajadas decimal(5,2),
  horas_totales decimal(5,2),
  es_modificado boolean,
  num_pausas bigint
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
  select
    f.id,
    f.fecha,
    f.hora_entrada,
    f.hora_salida,
    f.horas_trabajadas,
    f.horas_totales,
    f.es_modificado,
    count(fp.id) as num_pausas
  from public.fichajes f
  left join public.fichajes_pausas fp on f.id = fp.fichaje_id
  where f.empleado_id = p_empleado_id
    and f.anulado_at is null
    and (p_fecha_inicio is null or f.fecha >= p_fecha_inicio)
    and (p_fecha_fin is null or f.fecha <= p_fecha_fin)
  group by f.id, f.fecha, f.hora_entrada, f.hora_salida, f.horas_trabajadas, f.horas_totales, f.es_modificado
  order by f.fecha desc;
end;
$$;

grant execute on function public.get_fichajes_empleado(text, date, date) to authenticated;

create or replace function public.get_resumen_mensual_fichajes(
  p_empleado_id text,
  p_mes integer,
  p_ano integer
)
returns table (
  total_dias integer,
  total_horas decimal(5,2),
  horas_totales decimal(5,2),
  dias_completos integer,
  dias_incompletos integer
)
language plpgsql
stable
security invoker
set search_path = public
as $$
begin
  return query
  select
    count(*)::integer as total_dias,
    coalesce(sum(f.horas_trabajadas), 0) as total_horas,
    coalesce(sum(f.horas_totales), 0) as horas_totales,
    count(*) filter (where f.hora_salida is not null)::integer as dias_completos,
    count(*) filter (where f.hora_salida is null)::integer as dias_incompletos
  from public.fichajes f
  where f.empleado_id = p_empleado_id
    and f.anulado_at is null
    and extract(month from f.fecha) = p_mes
    and extract(year from f.fecha) = p_ano;
end;
$$;

notify pgrst, 'reload schema';
