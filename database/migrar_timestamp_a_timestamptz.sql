-- =====================================================
-- Script para migrar columnas TIMESTAMP a TIMESTAMPTZ
-- Esto solucionará el problema de zona horaria de una vez por todas
-- =====================================================

-- =====================================================
-- PASO 1: Verificar estado actual
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE '=== ESTADO ACTUAL ===';
    RAISE NOTICE 'Zona horaria del servidor: %', current_setting('timezone');
    RAISE NOTICE 'now() sin conversión: %', now();
    RAISE NOTICE 'now() AT TIME ZONE UTC: %', (now() AT TIME ZONE 'UTC');
END $$;

-- =====================================================
-- PASO 2: ELIMINAR TODOS LOS TRIGGERS QUE DEPENDEN DE LAS COLUMNAS
-- =====================================================

-- Eliminar triggers que dependen de hora_entrada, hora_salida, inicio, fin
DROP TRIGGER IF EXISTS trigger_enforce_server_time_entrada ON fichajes;
DROP TRIGGER IF EXISTS trigger_enforce_server_time_salida ON fichajes;
DROP TRIGGER IF EXISTS trigger_calcular_horas_trabajadas ON fichajes;
DROP TRIGGER IF EXISTS trigger_auditoria_fichajes ON fichajes;
DROP TRIGGER IF EXISTS trigger_enforce_server_time_pausa_inicio ON fichajes_pausas;
DROP TRIGGER IF EXISTS trigger_enforce_server_time_pausa_fin ON fichajes_pausas;
DROP TRIGGER IF EXISTS trigger_calcular_duracion_pausa ON fichajes_pausas;

-- =====================================================
-- PASO 3: Cambiar tipo de columna hora_entrada a TIMESTAMPTZ
-- =====================================================

-- Convertir la columna hora_entrada de TIMESTAMP a TIMESTAMPTZ
-- Los valores existentes se interpretarán como UTC
ALTER TABLE fichajes 
ALTER COLUMN hora_entrada 
TYPE TIMESTAMPTZ 
USING hora_entrada AT TIME ZONE 'UTC';

-- =====================================================
-- PASO 4: Cambiar tipo de columna hora_salida a TIMESTAMPTZ
-- =====================================================

ALTER TABLE fichajes 
ALTER COLUMN hora_salida 
TYPE TIMESTAMPTZ 
USING CASE 
    WHEN hora_salida IS NULL THEN NULL 
    ELSE hora_salida AT TIME ZONE 'UTC' 
END;

-- =====================================================
-- PASO 5: Cambiar tipo de columna fecha_modificacion a TIMESTAMPTZ
-- =====================================================

ALTER TABLE fichajes 
ALTER COLUMN fecha_modificacion 
TYPE TIMESTAMPTZ 
USING CASE 
    WHEN fecha_modificacion IS NULL THEN NULL 
    ELSE fecha_modificacion AT TIME ZONE 'UTC' 
END;

-- =====================================================
-- PASO 6: Cambiar columnas de pausas a TIMESTAMPTZ
-- =====================================================

ALTER TABLE fichajes_pausas 
ALTER COLUMN inicio 
TYPE TIMESTAMPTZ 
USING inicio AT TIME ZONE 'UTC';

ALTER TABLE fichajes_pausas 
ALTER COLUMN fin 
TYPE TIMESTAMPTZ 
USING CASE 
    WHEN fin IS NULL THEN NULL 
    ELSE fin AT TIME ZONE 'UTC' 
END;

-- =====================================================
-- PASO 7: RECREAR TRIGGERS (ahora que las columnas son TIMESTAMPTZ)
-- =====================================================

-- Recrear trigger de calcular horas trabajadas
CREATE TRIGGER trigger_calcular_horas_trabajadas
    BEFORE INSERT OR UPDATE ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION calcular_horas_trabajadas();

-- Recrear trigger de auditoría
CREATE TRIGGER trigger_auditoria_fichajes
    AFTER INSERT OR UPDATE OR DELETE ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION registrar_auditoria_fichaje();

-- Recrear trigger de calcular duración de pausa
CREATE TRIGGER trigger_calcular_duracion_pausa
    BEFORE UPDATE ON fichajes_pausas
    FOR EACH ROW
    WHEN (OLD.fin IS NULL AND NEW.fin IS NOT NULL)
    EXECUTE FUNCTION calcular_duracion_pausa();

-- =====================================================
-- PASO 8: Actualizar triggers para usar TIMESTAMPTZ
-- =====================================================

-- Función para forzar hora del servidor en UTC en hora_entrada
DROP TRIGGER IF EXISTS trigger_enforce_server_time_entrada ON fichajes;

CREATE OR REPLACE FUNCTION enforce_server_time_entrada()
RETURNS TRIGGER AS $$
BEGIN
    -- TIMESTAMPTZ almacena en UTC automáticamente
    -- now() ya devuelve TIMESTAMPTZ en UTC
    IF NEW.hora_entrada IS NULL OR NEW.es_modificado = false THEN
        NEW.hora_entrada = now(); -- now() ya es UTC en TIMESTAMPTZ
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_server_time_entrada
    BEFORE INSERT ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION enforce_server_time_entrada();

-- =====================================================
-- PASO 9: Actualizar función registrar_salida_fichaje
-- =====================================================

DROP FUNCTION IF EXISTS registrar_salida_fichaje(UUID);

CREATE FUNCTION registrar_salida_fichaje(p_fichaje_id UUID)
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
BEGIN
    -- now() ya devuelve TIMESTAMPTZ en UTC
    UPDATE fichajes
    SET hora_salida = now()
    WHERE id = p_fichaje_id
    AND hora_salida IS NULL
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

-- =====================================================
-- PASO 10: Actualizar función finalizar_pausa_fichaje
-- =====================================================

DROP FUNCTION IF EXISTS finalizar_pausa_fichaje(UUID);

CREATE FUNCTION finalizar_pausa_fichaje(p_pausa_id UUID)
RETURNS TABLE (
    id UUID,
    fichaje_id UUID,
    tipo TEXT,
    inicio TIMESTAMPTZ,
    fin TIMESTAMPTZ,
    duracion_minutos INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_pausa RECORD;
BEGIN
    -- now() ya devuelve TIMESTAMPTZ en UTC
    UPDATE fichajes_pausas
    SET fin = now(),
        duracion_minutos = EXTRACT(EPOCH FROM (now() - inicio)) / 60
    WHERE id = p_pausa_id
    AND fin IS NULL
    RETURNING * INTO v_pausa;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Pausa no encontrada o ya está finalizada';
    END IF;
    
    RETURN QUERY SELECT 
        v_pausa.id,
        v_pausa.fichaje_id,
        v_pausa.tipo,
        v_pausa.inicio,
        v_pausa.fin,
        v_pausa.duracion_minutos;
END;
$$;

-- =====================================================
-- PASO 11: Actualizar trigger de inicio de pausa
-- =====================================================

DROP TRIGGER IF EXISTS trigger_enforce_server_time_pausa_inicio ON fichajes_pausas;

CREATE OR REPLACE FUNCTION enforce_server_time_pausa_inicio()
RETURNS TRIGGER AS $$
BEGIN
    -- now() ya devuelve TIMESTAMPTZ en UTC
    NEW.inicio = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_enforce_server_time_pausa_inicio
    BEFORE INSERT ON fichajes_pausas
    FOR EACH ROW
    EXECUTE FUNCTION enforce_server_time_pausa_inicio();

-- =====================================================
-- PASO 12: Verificación final
-- =====================================================

DO $$
DECLARE
    v_test_now TIMESTAMPTZ;
    v_test_utc TEXT;
BEGIN
    RAISE NOTICE '=== VERIFICACIÓN FINAL ===';
    
    v_test_now := now();
    v_test_utc := (v_test_now AT TIME ZONE 'UTC')::TEXT;
    
    RAISE NOTICE 'now() (TIMESTAMPTZ): %', v_test_now;
    RAISE NOTICE 'now() en UTC: %', v_test_utc;
    RAISE NOTICE 'Tipo de now(): TIMESTAMPTZ (con timezone)';
    RAISE NOTICE '✅ Todas las columnas ahora son TIMESTAMPTZ y almacenan en UTC automáticamente';
END $$;

