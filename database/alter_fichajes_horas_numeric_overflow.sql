-- =====================================================
-- Fix: overflow DECIMAL(5,2) al cerrar fichajes olvidados
-- (días abiertos → miles de horas > 999.99)
-- Ejecutar en Supabase SQL Editor.
-- =====================================================

-- 1) Ampliar columnas de horas (hasta ~99_999.99 h)
alter table public.fichajes
  alter column horas_trabajadas type numeric(10,2)
    using round(coalesce(horas_trabajadas, 0)::numeric, 2),
  alter column horas_totales type numeric(10,2)
    using round(coalesce(horas_totales, 0)::numeric, 2);

alter table public.fichajes
  alter column horas_ordinarias type numeric(10,2)
    using round(coalesce(horas_ordinarias, 0)::numeric, 2);

alter table public.fichajes
  alter column horas_extraordinarias type numeric(10,2)
    using round(coalesce(horas_extraordinarias, 0)::numeric, 2);

alter table public.fichajes
  alter column horas_complementarias type numeric(10,2)
    using round(coalesce(horas_complementarias, 0)::numeric, 2);

alter table public.fichajes
  alter column horas_jornada_ref type numeric(10,2)
    using case
      when horas_jornada_ref is null then null
      else round(horas_jornada_ref::numeric, 2)
    end;

-- 2) Trigger: tope de seguridad (evita basura de fechas absurdas)
create or replace function public.calcular_horas_trabajadas()
returns trigger
language plpgsql
as $$
declare
  horas_calculadas numeric(10,2);
  minutos_pausas integer;
  tip record;
  v_totales numeric(10,2);
begin
  if new.hora_salida is not null and new.hora_entrada is not null then
    v_totales := extract(epoch from (new.hora_salida - new.hora_entrada)) / 3600.0;
    -- Cap 9999.99 (numeric 10,2); jornadas reales nunca llegan aquí si se cierra bien
    v_totales := least(greatest(v_totales, 0), 9999.99);

    select coalesce(sum(duracion_minutos), 0) into minutos_pausas
    from public.fichajes_pausas
    where fichaje_id = new.id and fin is not null;

    horas_calculadas := v_totales - (minutos_pausas / 60.0);
    horas_calculadas := least(greatest(horas_calculadas, 0), 9999.99);

    new.horas_trabajadas := round(horas_calculadas, 2);
    new.horas_totales := round(v_totales, 2);

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

-- 3) Tipología: devolver numeric(10,2)
drop function if exists public.fichaje_aplicar_tipologia(numeric, numeric, boolean, boolean, numeric, numeric, numeric);
drop function if exists public.fichaje_aplicar_tipologia(decimal, decimal, boolean, boolean, decimal, decimal, decimal);

create function public.fichaje_aplicar_tipologia(
  p_horas_trabajadas numeric,
  p_jornada_ref numeric,
  p_parcial boolean,
  p_manual boolean,
  p_ord numeric,
  p_ext numeric,
  p_comp numeric
)
returns table (
  horas_ordinarias numeric(10,2),
  horas_extraordinarias numeric(10,2),
  horas_complementarias numeric(10,2)
)
language plpgsql
immutable
as $$
declare
  v_trab numeric(10,2) := least(greatest(coalesce(p_horas_trabajadas, 0), 0), 9999.99);
  v_ref numeric(10,2) := nullif(p_jornada_ref, 0);
  v_ord numeric(10,2);
  v_exc numeric(10,2);
begin
  if coalesce(p_manual, false) then
    return query select
      least(coalesce(p_ord, v_trab), 9999.99)::numeric(10,2),
      least(coalesce(p_ext, 0), 9999.99)::numeric(10,2),
      least(coalesce(p_comp, 0), 9999.99)::numeric(10,2);
    return;
  end if;

  if v_ref is null then
    return query select v_trab, 0::numeric(10,2), 0::numeric(10,2);
    return;
  end if;

  v_ord := least(v_trab, v_ref);
  v_exc := greatest(v_trab - v_ref, 0);

  if coalesce(p_parcial, false) then
    return query select v_ord, 0::numeric(10,2), v_exc;
  else
    return query select v_ord, v_exc, 0::numeric(10,2);
  end if;
end;
$$;

notify pgrst, 'reload schema';

-- 4) RPC de cierre: mismos tipos amplios en el RETURN
drop function if exists public.cerrar_fichaje_automaticamente(uuid, text, timestamptz, text);

create function public.cerrar_fichaje_automaticamente(
  p_fichaje_id uuid,
  p_motivo text default null,
  p_hora_salida timestamptz default null,
  p_hora_salida_local text default null
)
returns table (
  id uuid,
  empleado_id text,
  fecha date,
  hora_entrada timestamptz,
  hora_salida timestamptz,
  horas_trabajadas numeric(10,2),
  horas_totales numeric(10,2)
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_fichaje record;
  v_motivo text;
  v_valor_original jsonb;
  v_salida timestamptz;
begin
  v_motivo := coalesce(
    nullif(trim(p_motivo), ''),
    'Cerrado automáticamente: el empleado no registró la salida en el horario esperado.'
  );

  if p_hora_salida is not null then
    v_salida := p_hora_salida;
  elsif p_hora_salida_local is not null and trim(p_hora_salida_local) <> '' then
    v_salida := trim(p_hora_salida_local)::timestamp at time zone 'Europe/Madrid';
  else
    v_salida := now();
  end if;

  v_valor_original := jsonb_build_object(
    'hora_salida', null,
    'cerrado_automaticamente', true,
    'aviso_visto', false,
    'motivo', v_motivo,
    'hora_salida_aplicada', v_salida,
    'aviso', 'Este fichaje se cerró automáticamente porque no registraste la salida a tiempo.'
  );

  update public.fichajes
  set
    hora_salida = v_salida,
    es_modificado = true,
    modificado_por = null,
    fecha_modificacion = now(),
    valor_original = v_valor_original,
    notificado_trabajador = true
  where fichajes.id = p_fichaje_id
    and fichajes.hora_salida is null
  returning * into v_fichaje;

  if not found then
    raise exception 'Fichaje no encontrado o ya tiene hora de salida registrada';
  end if;

  return query select
    v_fichaje.id,
    v_fichaje.empleado_id,
    v_fichaje.fecha,
    v_fichaje.hora_entrada,
    v_fichaje.hora_salida,
    v_fichaje.horas_trabajadas,
    v_fichaje.horas_totales;
end;
$$;

grant execute on function public.cerrar_fichaje_automaticamente(uuid, text, timestamptz, text) to authenticated;

notify pgrst, 'reload schema';
