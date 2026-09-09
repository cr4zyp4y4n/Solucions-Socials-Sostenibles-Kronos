-- =====================================================
-- Horarios SMS fichaje — altas del equipo
-- Ejecutar en SQL Editor de Supabase (idempotente).
-- =====================================================
-- Brian Bautista Martín — código 854124 → Holded SOLUCIONS
-- Lun–Vie 09:00–17:00, tolerancia 15 min
-- (No vigilar el homónimo Menjar 68624b2a… para SMS)
--
-- Paula Andrea Barbosa Cáceres — Lun–Vie 09:30–17:30, tolerancia 15 min
-- Holded: 686291bedf419aea1c071c52 · móvil 697512126
--
-- Belinda Elizabeth Cubas — Lun–Vie 07:00–15:00, tolerancia 15 min
-- Holded: 67ad1e2fffff703cda04ebe8 · móvil 674431595
-- SMS entrada ~07:15 / salida ~15:15; cierre auto ~15:20
-- =====================================================

UPDATE public.fichajes_sms_horarios
SET activo = false,
    notas = 'DESACTIVADO: Brian ficha con Solucions (6a97f324…).'
WHERE empleado_id = '68624b2a3f991ace6e0ca957';

INSERT INTO public.fichajes_sms_horarios (
  empleado_id,
  nombre,
  telefono,
  hora_entrada,
  hora_salida,
  tolerancia_minutos,
  dias_semana,
  activo,
  timezone,
  notas
) VALUES
(
  '6a97f324eb81ebd8ef0a0bb1',
  'Brian Bautista Martín (Solucions)',
  '684388282',
  '09:00',
  '17:00',
  15,
  ARRAY[1, 2, 3, 4, 5],
  true,
  'Europe/Madrid',
  'Código fichaje 854124 → Holded Solucions. Móvil de ficha Menjar (mismo email).'
),
(
  '686291bedf419aea1c071c52',
  'Paula Andrea Barbosa Cáceres',
  '697512126',
  '09:30',
  '17:30',
  15,
  ARRAY[1, 2, 3, 4, 5],
  true,
  'Europe/Madrid',
  'Lun–Vie 09:30–17:30. SMS entrada ~09:45 / salida ~17:45; cierre auto ~17:50.'
),
(
  '67ad1e2fffff703cda04ebe8',
  'Belinda Elizabeth Cubas Castellanos',
  '674431595',
  '07:00',
  '15:00',
  15,
  ARRAY[1, 2, 3, 4, 5],
  true,
  'Europe/Madrid',
  'Lun–Vie 07:00–15:00. SMS entrada ~07:15 / salida ~15:15; cierre auto ~15:20.'
)
ON CONFLICT (empleado_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  telefono = EXCLUDED.telefono,
  hora_entrada = EXCLUDED.hora_entrada,
  hora_salida = EXCLUDED.hora_salida,
  tolerancia_minutos = EXCLUDED.tolerancia_minutos,
  dias_semana = EXCLUDED.dias_semana,
  activo = EXCLUDED.activo,
  timezone = EXCLUDED.timezone,
  notas = EXCLUDED.notas,
  updated_at = now();
