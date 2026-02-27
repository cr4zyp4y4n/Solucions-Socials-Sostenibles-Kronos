-- =====================================================
-- Cierre automático de fichaje en UN solo UPDATE
-- Evita dos registros en auditoría (uno por RPC salida, otro por UPDATE valor_original)
-- =====================================================
-- Ejecutar en Supabase SQL Editor después de migrar_timestamp_a_timestamptz.sql

DROP FUNCTION IF EXISTS cerrar_fichaje_automaticamente(UUID, TEXT);

CREATE FUNCTION cerrar_fichaje_automaticamente(p_fichaje_id UUID, p_motivo TEXT DEFAULT NULL)
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
BEGIN
    v_motivo := COALESCE(NULLIF(TRIM(p_motivo), ''), 'Cerrado automáticamente por el servidor al fichar entrada en otro día');

    v_valor_original := jsonb_build_object(
        'hora_salida', NULL,
        'cerrado_automaticamente', true,
        'motivo', v_motivo,
        'aviso', '⚠️ Este fichaje fue cerrado automáticamente porque se detectó que el empleado olvidó fichar la salida.'
    );

    UPDATE fichajes
    SET
        hora_salida = now(),
        es_modificado = true,
        modificado_por = NULL,
        fecha_modificacion = now(),
        valor_original = v_valor_original
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

COMMENT ON FUNCTION cerrar_fichaje_automaticamente(UUID, TEXT) IS 'Cierra un fichaje olvidado (sin salida) en un solo UPDATE: pone hora_salida=now() y valor_original con motivo. Solo se genera un registro en auditoría.';
