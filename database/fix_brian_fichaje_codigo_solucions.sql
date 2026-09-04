-- =====================================================
-- Brian: código 854124 + SMS horario → Holded SOLUCIONS
-- (contrato actual; historial Menjar se queda en su empleado_id)
-- =====================================================
-- Solucions: 6a97f324eb81ebd8ef0a0bb1
-- Menjar:    68624b2a3f991ace6e0ca957  (ya no vigilar / no usar en código)
-- =====================================================

-- 1) Código de fichaje → Solucions
UPDATE public.fichajes_codigos
SET
  empleado_id = '6a97f324eb81ebd8ef0a0bb1',
  descripcion = 'Brian Bautista Martín (Solucions)'
WHERE TRIM(codigo) = '854124';

-- Verificación código:
-- SELECT codigo, empleado_id, descripcion, activo FROM fichajes_codigos WHERE codigo = '854124';

-- 2) SMS / horario: activar Solucions, desactivar Menjar
UPDATE public.fichajes_sms_horarios
SET activo = false,
    notas = 'DESACTIVADO: Brian ficha con Solucions (6a97f324…). Historial Menjar conservado.'
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
  'Código 854124 → Solucions. Móvil de ficha Menjar (mismo email).'
)
ON CONFLICT (empleado_id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  telefono = EXCLUDED.telefono,
  hora_entrada = EXCLUDED.hora_entrada,
  hora_salida = EXCLUDED.hora_salida,
  tolerancia_minutos = EXCLUDED.tolerancia_minutos,
  dias_semana = EXCLUDED.dias_semana,
  activo = true,
  timezone = EXCLUDED.timezone,
  notas = EXCLUDED.notas,
  updated_at = now();

-- Verificación horarios:
-- SELECT empleado_id, nombre, activo, telefono FROM fichajes_sms_horarios
-- WHERE empleado_id IN ('6a97f324eb81ebd8ef0a0bb1', '68624b2a3f991ace6e0ca957');
