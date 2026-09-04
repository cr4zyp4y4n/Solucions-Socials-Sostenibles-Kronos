-- =====================================================
-- Horarios SMS fichaje — altas del equipo
-- Ejecutar en SQL Editor de Supabase (idempotente).
-- =====================================================
-- Brian Bautista Martín — código 854124 → Holded SOLUCIONS
-- Lun–Vie 09:00–17:00, tolerancia 15 min
-- (No vigilar el homónimo Menjar 68624b2a… para SMS)
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
) VALUES (
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
