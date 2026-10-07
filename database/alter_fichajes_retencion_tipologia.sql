-- =====================================================
-- Fichaje: retención ≥ 4 años + tipología de horas
-- (ordinarias / extraordinarias / complementarias)
-- Ejecutar en Supabase SQL Editor tras alter_fichajes_inalterabilidad_rls.sql
-- =====================================================

-- 1) Retención: reforzar inalterabilidad (sin purge automático)
comment on table public.fichajes is
  'Registro de jornada. Retención mínima 4 años (RDL 8/2019). No borrar; anular con soft-delete.';
comment on table public.fichajes_auditoria is
  'Auditoría inmutable de fichajes. Retención ≥ 4 años. DELETE denegado por RLS.';
comment on table public.fichajes_pausas is
  'Pausas vinculadas al fichaje. Conservar con el registro padre ≥ 4 años.';

-- DELETE denegado también en pausas (antes podía haber política permisiva)
drop policy if exists "Nadie puede borrar pausas fichaje (retencion)" on public.fichajes_pausas;
create policy "Nadie puede borrar pausas fichaje (retencion)"
  on public.fichajes_pausas
  for delete
  using (false);

drop policy if exists "Nadie borra auditoria fichajes" on public.fichajes_auditoria;
create policy "Nadie borra auditoria fichajes"
  on public.fichajes_auditoria
  for delete
  using (false);

-- Vista de control: fichajes que aún están dentro del plazo de retención
create or replace view public.fichajes_retencion_activa as
select
  f.id,
  f.empleado_id,
  f.fecha,
  f.anulado_at,
  f.created_at,
  (f.fecha + interval '4 years')::date as retenido_hasta,
  (current_date < (f.fecha + interval '4 years')::date) as dentro_plazo_legal
from public.fichajes f;

comment on view public.fichajes_retencion_activa is
  'Control de retención 4 años por fecha de jornada. No implica autorización a borrar al vencer.';

grant select on public.fichajes_retencion_activa to authenticated;

-- 2) Tipología de horas (borrador RD / prep. inspección)
alter table public.fichajes
  add column if not exists horas_ordinarias decimal(5,2),
  add column if not exists horas_extraordinarias decimal(5,2) default 0,
  add column if not exists horas_complementarias decimal(5,2) default 0,
  add column if not exists horas_jornada_ref decimal(5,2),
  add column if not exists contrato_parcial boolean default false,
  add column if not exists tipificacion_manual boolean not null default false;

comment on column public.fichajes.horas_ordinarias is
  'Horas dentro de jornada contratada (día).';
comment on column public.fichajes.horas_extraordinarias is
  'Horas extraordinarias (exceso sobre jornada, contrato a tiempo completo).';
comment on column public.fichajes.horas_complementarias is
  'Horas complementarias (exceso sobre jornada, contrato a tiempo parcial).';
comment on column public.fichajes.horas_jornada_ref is
  'Horas de jornada de referencia usadas al tipificar (snapshot).';
comment on column public.fichajes.contrato_parcial is
  'Si true, el exceso se tipifica como complementarias; si false, como extraordinarias.';
comment on column public.fichajes.tipificacion_manual is
  'Si true, no recalcular tipología automáticamente (ajuste RRHH).';

-- Backfill: todo lo trabajado → ordinarias hasta tipificar
update public.fichajes
set
  horas_ordinarias = coalesce(horas_ordinarias, horas_trabajadas, 0),
  horas_extraordinarias = coalesce(horas_extraordinarias, 0),
  horas_complementarias = coalesce(horas_complementarias, 0)
where horas_trabajadas is not null
  and horas_ordinarias is null;

-- 3) Función de tipificación
create or replace function public.fichaje_aplicar_tipologia(
  p_horas_trabajadas decimal,
  p_jornada_ref decimal,
  p_parcial boolean,
  p_manual boolean,
  p_ord decimal,
  p_ext decimal,
  p_comp decimal
)
returns table (
  horas_ordinarias decimal(5,2),
  horas_extraordinarias decimal(5,2),
  horas_complementarias decimal(5,2)
)
language plpgsql
immutable
as $$
declare
  v_trab decimal(5,2) := greatest(coalesce(p_horas_trabajadas, 0), 0);
  v_ref decimal(5,2) := nullif(p_jornada_ref, 0);
  v_ord decimal(5,2);
  v_exc decimal(5,2);
begin
  if coalesce(p_manual, false) then
    return query select
      coalesce(p_ord, v_trab)::decimal(5,2),
      coalesce(p_ext, 0)::decimal(5,2),
      coalesce(p_comp, 0)::decimal(5,2);
    return;
  end if;

  if v_ref is null then
    -- Sin jornada de referencia: todo ordinario (hasta configurar)
    return query select v_trab, 0::decimal(5,2), 0::decimal(5,2);
    return;
  end if;

  v_ord := least(v_trab, v_ref);
  v_exc := greatest(v_trab - v_ref, 0);

  if coalesce(p_parcial, false) then
    return query select v_ord, 0::decimal(5,2), v_exc;
  else
    return query select v_ord, v_exc, 0::decimal(5,2);
  end if;
end;
$$;

-- 4) Ampliar trigger de cálculo de horas
create or replace function public.calcular_horas_trabajadas()
returns trigger
language plpgsql
as $$
declare
  horas_calculadas decimal(5,2);
  minutos_pausas integer;
  tip record;
begin
  if new.hora_salida is not null and new.hora_entrada is not null then
    horas_calculadas := extract(epoch from (new.hora_salida - new.hora_entrada)) / 3600.0;

    select coalesce(sum(duracion_minutos), 0) into minutos_pausas
    from public.fichajes_pausas
    where fichaje_id = new.id and fin is not null;

    horas_calculadas := horas_calculadas - (minutos_pausas / 60.0);

    new.horas_trabajadas := round(horas_calculadas, 2);
    new.horas_totales := round(
      extract(epoch from (new.hora_salida - new.hora_entrada)) / 3600.0,
      2
    );

    select * into tip
    from public.fichaje_aplicar_tipologia(
      new.horas_trabajadas,
      new.horas_jornada_ref,
      new.contrato_parcial,
      new.tipificacion_manual,
      new.horas_ordinarias,
      new.horas_extraordinarias,
      new.horas_complementarias
    );

    new.horas_ordinarias := tip.horas_ordinarias;
    new.horas_extraordinarias := tip.horas_extraordinarias;
    new.horas_complementarias := tip.horas_complementarias;
  end if;

  return new;
end;
$$;

-- Recalcular tipología en filas existentes (sin tipificación manual)
-- Nota: no se puede pasar la tabla destino "f" como argumento en el FROM del UPDATE.
update public.fichajes f
set
  horas_ordinarias = t.horas_ordinarias,
  horas_extraordinarias = t.horas_extraordinarias,
  horas_complementarias = t.horas_complementarias
from public.fichajes src
cross join lateral public.fichaje_aplicar_tipologia(
  src.horas_trabajadas,
  src.horas_jornada_ref,
  src.contrato_parcial,
  src.tipificacion_manual,
  src.horas_ordinarias,
  src.horas_extraordinarias,
  src.horas_complementarias
) as t
where f.id = src.id
  and src.horas_trabajadas is not null
  and coalesce(src.tipificacion_manual, false) = false;

-- 5) Ampliar resumen mensual con tipología
-- DROP necesario: cambió el tipo de retorno (columnas nuevas)
drop function if exists public.get_resumen_mensual_fichajes(text, integer, integer);

create function public.get_resumen_mensual_fichajes(
  p_empleado_id text,
  p_mes integer,
  p_ano integer
)
returns table (
  total_dias integer,
  total_horas decimal(5,2),
  horas_totales decimal(5,2),
  dias_completos integer,
  dias_incompletos integer,
  horas_ordinarias decimal(5,2),
  horas_extraordinarias decimal(5,2),
  horas_complementarias decimal(5,2)
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
    count(*) filter (where f.hora_salida is null)::integer as dias_incompletos,
    coalesce(sum(f.horas_ordinarias), 0) as horas_ordinarias,
    coalesce(sum(f.horas_extraordinarias), 0) as horas_extraordinarias,
    coalesce(sum(f.horas_complementarias), 0) as horas_complementarias
  from public.fichajes f
  where f.empleado_id = p_empleado_id
    and f.anulado_at is null
    and extract(month from f.fecha) = p_mes
    and extract(year from f.fecha) = p_ano;
end;
$$;

grant execute on function public.get_resumen_mensual_fichajes(text, integer, integer) to authenticated;

notify pgrst, 'reload schema';
