-- =====================================================
-- Ampliar cierre automático: hora de salida opcional (horario)
-- + marca aviso_visto=false para avisar al trabajador al fichar
-- =====================================================
-- Ejecutar en SQL Editor de Supabase.

DROP FUNCTION IF EXISTS cerrar_fichaje_automaticamente(UUID, TEXT);
DROP FUNCTION IF EXISTS cerrar_fichaje_automaticamente(UUID, TEXT, TIMESTAMPTZ);
DROP FUNCTION IF EXISTS cerrar_fichaje_automaticamente(UUID, TEXT, TIMESTAMPTZ, TEXT);

CREATE FUNCTION cerrar_fichaje_automaticamente(
    p_fichaje_id UUID,
    p_motivo TEXT DEFAULT NULL,
    p_hora_salida TIMESTAMPTZ DEFAULT NULL,
    -- Wall-clock Europe/Madrid: 'YYYY-MM-DD HH24:MI:SS'
    p_hora_salida_local TEXT DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    empleado_id TEXT,
    fecha DATE,
    hora_entrada TIMESTAMPTZ,
    hora_salida TIMESTAMPTZ,
    horas_trabajadas DECIMAL(5,2),
    horas_totales DECIMAL(5,2)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_fichaje RECORD;
    v_motivo TEXT;
    v_valor_original JSONB;
    v_salida TIMESTAMPTZ;
BEGIN
    v_motivo := COALESCE(
      NULLIF(TRIM(p_motivo), ''),
      'Cerrado automáticamente: el empleado no registró la salida en el horario esperado.'
    );

    IF p_hora_salida IS NOT NULL THEN
      v_salida := p_hora_salida;
    ELSIF p_hora_salida_local IS NOT NULL AND TRIM(p_hora_salida_local) <> '' THEN
      v_salida := TRIM(p_hora_salida_local)::timestamp AT TIME ZONE 'Europe/Madrid';
    ELSE
      v_salida := now();
    END IF;

    v_valor_original := jsonb_build_object(
        'hora_salida', NULL,
        'cerrado_automaticamente', true,
        'aviso_visto', false,
        'motivo', v_motivo,
        'hora_salida_aplicada', v_salida,
        'aviso', 'Este fichaje se cerró automáticamente porque no registraste la salida a tiempo.'
    );

    UPDATE fichajes
    SET
        hora_salida = v_salida,
        es_modificado = true,
        modificado_por = NULL,
        fecha_modificacion = now(),
        valor_original = v_valor_original,
        notificado_trabajador = true
    WHERE fichajes.id = p_fichaje_id
      AND fichajes.hora_salida IS NULL
    RETURNING * INTO v_fichaje;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Fichaje no encontrado o ya tiene hora de salida registrada';
    END IF;

    RETURN QUERY SELECT
        v_fichaje.id,
        v_fichaje.empleado_id,
        v_fichaje.fecha,
        v_fichaje.hora_entrada,
        v_fichaje.hora_salida,
        v_fichaje.horas_trabajadas,
        v_fichaje.horas_totales;
END;
$$;

COMMENT ON FUNCTION cerrar_fichaje_automaticamente(UUID, TEXT, TIMESTAMPTZ, TEXT) IS
  'Cierra fichaje olvidado. p_hora_salida_local en Europe/Madrid (YYYY-MM-DD HH24:MI:SS) o p_hora_salida timestamptz; si ambos null usa now(). Deja valor_original.aviso_visto=false para avisar al trabajador.';

-- Compat: llamadas antiguas con 2 argumentos siguen funcionando (defaults).
