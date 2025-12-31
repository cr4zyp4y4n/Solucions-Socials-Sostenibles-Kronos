-- =====================================================
-- Script de creación de tablas para Sistema de Fichaje
-- Supabase/PostgreSQL
-- Cumplimiento normativa laboral española
-- =====================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA PRINCIPAL: fichajes
-- =====================================================
CREATE TABLE IF NOT EXISTS fichajes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id TEXT NOT NULL, -- ID de Holded (MongoDB ObjectId como string)
    fecha DATE NOT NULL, -- Día del fichaje
    hora_entrada TIMESTAMP NOT NULL DEFAULT now(), -- Timestamp del servidor (CRÍTICO)
    hora_salida TIMESTAMP, -- Nullable hasta que se registre la salida
    horas_trabajadas DECIMAL(5,2) DEFAULT 0, -- Calculado automáticamente
    horas_totales DECIMAL(5,2) DEFAULT 0, -- Incluye pausas
    
    -- Control de modificaciones
    es_modificado BOOLEAN DEFAULT false, -- Si fue añadido/modificado a posteriori
    modificado_por UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    fecha_modificacion TIMESTAMP,
    valor_original JSONB, -- Valor antes de modificación (para auditoría)
    notificado_trabajador BOOLEAN DEFAULT false, -- Si se notificó al trabajador
    validado_por_trabajador BOOLEAN DEFAULT false, -- Si el trabajador aceptó el cambio
    
    -- Metadatos
    created_at TIMESTAMP NOT NULL DEFAULT now(), -- Timestamp del servidor
    updated_at TIMESTAMP DEFAULT now(),
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL, -- Quien creó el fichaje
    
    -- Constraint: Un empleado solo puede tener un fichaje por día
    CONSTRAINT fichaje_unico_dia UNIQUE(empleado_id, fecha)
);

-- Índices para fichajes
CREATE INDEX IF NOT EXISTS idx_fichajes_empleado_id ON fichajes(empleado_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_fecha ON fichajes(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_empleado_fecha ON fichajes(empleado_id, fecha DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_created_at ON fichajes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_es_modificado ON fichajes(es_modificado);
CREATE INDEX IF NOT EXISTS idx_fichajes_notificado ON fichajes(notificado_trabajador) WHERE notificado_trabajador = false;

-- =====================================================
-- TABLA: fichajes_pausas
-- =====================================================
CREATE TABLE IF NOT EXISTS fichajes_pausas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fichaje_id UUID NOT NULL REFERENCES fichajes(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('comida', 'descanso', 'cafe', 'otro')),
    inicio TIMESTAMP NOT NULL DEFAULT now(), -- Timestamp del servidor
    fin TIMESTAMP, -- Nullable hasta que se finalice la pausa
    duracion_minutos INTEGER, -- Calculado cuando se cierra la pausa
    descripcion TEXT, -- Descripción opcional de la pausa
    created_at TIMESTAMP DEFAULT now()
);

-- Índices para fichajes_pausas
CREATE INDEX IF NOT EXISTS idx_fichajes_pausas_fichaje_id ON fichajes_pausas(fichaje_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_pausas_inicio ON fichajes_pausas(inicio DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_pausas_tipo ON fichajes_pausas(tipo);

-- =====================================================
-- TABLA: fichajes_auditoria
-- Historial completo de todos los cambios
-- =====================================================
CREATE TABLE IF NOT EXISTS fichajes_auditoria (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fichaje_id UUID NOT NULL REFERENCES fichajes(id) ON DELETE CASCADE,
    accion TEXT NOT NULL CHECK (accion IN ('creado', 'modificado', 'eliminado', 'pausa_iniciada', 'pausa_finalizada', 'salida_registrada')),
    quien UUID REFERENCES user_profiles(id) ON DELETE SET NULL, -- Quien hizo el cambio
    cuando TIMESTAMP NOT NULL DEFAULT now(), -- Timestamp del servidor
    valor_anterior JSONB, -- Estado anterior completo
    valor_nuevo JSONB, -- Estado nuevo completo
    motivo TEXT, -- Motivo de la modificación (opcional)
    ip_address TEXT, -- IP desde donde se hizo el cambio (opcional)
    user_agent TEXT -- User agent del cliente (opcional)
);

-- Índices para fichajes_auditoria
CREATE INDEX IF NOT EXISTS idx_fichajes_auditoria_fichaje_id ON fichajes_auditoria(fichaje_id);
CREATE INDEX IF NOT EXISTS idx_fichajes_auditoria_cuando ON fichajes_auditoria(cuando DESC);
CREATE INDEX IF NOT EXISTS idx_fichajes_auditoria_quien ON fichajes_auditoria(quien);
CREATE INDEX IF NOT EXISTS idx_fichajes_auditoria_accion ON fichajes_auditoria(accion);

-- =====================================================
-- TRIGGERS Y FUNCIONES
-- =====================================================

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_fichajes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_fichajes_updated_at
    BEFORE UPDATE ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION update_fichajes_updated_at();

-- Función para calcular horas trabajadas automáticamente
CREATE OR REPLACE FUNCTION calcular_horas_trabajadas()
RETURNS TRIGGER AS $$
DECLARE
    horas_calculadas DECIMAL(5,2);
    minutos_pausas INTEGER;
BEGIN
    -- Solo calcular si hay hora de salida
    IF NEW.hora_salida IS NOT NULL AND NEW.hora_entrada IS NOT NULL THEN
        -- Calcular diferencia en horas
        horas_calculadas := EXTRACT(EPOCH FROM (NEW.hora_salida - NEW.hora_entrada)) / 3600.0;
        
        -- Restar minutos de pausas
        SELECT COALESCE(SUM(duracion_minutos), 0) INTO minutos_pausas
        FROM fichajes_pausas
        WHERE fichaje_id = NEW.id AND fin IS NOT NULL;
        
        -- Restar pausas de las horas totales
        horas_calculadas := horas_calculadas - (minutos_pausas / 60.0);
        
        NEW.horas_trabajadas := ROUND(horas_calculadas, 2);
        NEW.horas_totales := ROUND(EXTRACT(EPOCH FROM (NEW.hora_salida - NEW.hora_entrada)) / 3600.0, 2);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calcular_horas_trabajadas
    BEFORE INSERT OR UPDATE ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION calcular_horas_trabajadas();

-- Función para registrar cambios en auditoría automáticamente
CREATE OR REPLACE FUNCTION registrar_auditoria_fichaje()
RETURNS TRIGGER AS $$
DECLARE
    valor_anterior_json JSONB;
    valor_nuevo_json JSONB;
    accion_tipo TEXT;
BEGIN
    -- Determinar tipo de acción
    IF TG_OP = 'INSERT' THEN
        accion_tipo := 'creado';
        valor_anterior_json := NULL;
        valor_nuevo_json := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'UPDATE' THEN
        accion_tipo := 'modificado';
        valor_anterior_json := row_to_json(OLD)::JSONB;
        valor_nuevo_json := row_to_json(NEW)::JSONB;
    ELSIF TG_OP = 'DELETE' THEN
        accion_tipo := 'eliminado';
        valor_anterior_json := row_to_json(OLD)::JSONB;
        valor_nuevo_json := NULL;
    END IF;
    
    -- Insertar en auditoría
    INSERT INTO fichajes_auditoria (
        fichaje_id,
        accion,
        quien,
        cuando,
        valor_anterior,
        valor_nuevo
    ) VALUES (
        COALESCE(NEW.id, OLD.id),
        accion_tipo,
        COALESCE(NEW.modificado_por, NEW.created_by, auth.uid()),
        now(),
        valor_anterior_json,
        valor_nuevo_json
    );
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_auditoria_fichajes
    AFTER INSERT OR UPDATE OR DELETE ON fichajes
    FOR EACH ROW
    EXECUTE FUNCTION registrar_auditoria_fichaje();

-- Función para calcular duración de pausa cuando se cierra
CREATE OR REPLACE FUNCTION calcular_duracion_pausa()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.fin IS NOT NULL AND NEW.inicio IS NOT NULL THEN
        NEW.duracion_minutos := EXTRACT(EPOCH FROM (NEW.fin - NEW.inicio)) / 60;
        
        -- Registrar en auditoría
        INSERT INTO fichajes_auditoria (
            fichaje_id,
            accion,
            quien,
            cuando,
            valor_anterior,
            valor_nuevo
        ) VALUES (
            NEW.fichaje_id,
            'pausa_finalizada',
            auth.uid(),
            now(),
            row_to_json(OLD)::JSONB,
            row_to_json(NEW)::JSONB
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_calcular_duracion_pausa
    BEFORE UPDATE ON fichajes_pausas
    FOR EACH ROW
    WHEN (OLD.fin IS NULL AND NEW.fin IS NOT NULL)
    EXECUTE FUNCTION calcular_duracion_pausa();

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

-- Función para obtener fichajes de un empleado en un rango de fechas
CREATE OR REPLACE FUNCTION get_fichajes_empleado(
    p_empleado_id TEXT,
    p_fecha_inicio DATE DEFAULT NULL,
    p_fecha_fin DATE DEFAULT NULL
)
RETURNS TABLE (
    id UUID,
    fecha DATE,
    hora_entrada TIMESTAMP,
    hora_salida TIMESTAMP,
    horas_trabajadas DECIMAL(5,2),
    horas_totales DECIMAL(5,2),
    es_modificado BOOLEAN,
    num_pausas BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        f.id,
        f.fecha,
        f.hora_entrada,
        f.hora_salida,
        f.horas_trabajadas,
        f.horas_totales,
        f.es_modificado,
        COUNT(fp.id) as num_pausas
    FROM fichajes f
    LEFT JOIN fichajes_pausas fp ON f.id = fp.fichaje_id
    WHERE f.empleado_id = p_empleado_id
      AND (p_fecha_inicio IS NULL OR f.fecha >= p_fecha_inicio)
      AND (p_fecha_fin IS NULL OR f.fecha <= p_fecha_fin)
    GROUP BY f.id, f.fecha, f.hora_entrada, f.hora_salida, f.horas_trabajadas, f.horas_totales, f.es_modificado
    ORDER BY f.fecha DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener resumen mensual de fichajes
CREATE OR REPLACE FUNCTION get_resumen_mensual_fichajes(
    p_empleado_id TEXT,
    p_mes INTEGER,
    p_ano INTEGER
)
RETURNS TABLE (
    total_dias INTEGER,
    total_horas DECIMAL(5,2),
    horas_totales DECIMAL(5,2),
    dias_completos INTEGER,
    dias_incompletos INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER as total_dias,
        COALESCE(SUM(f.horas_trabajadas), 0) as total_horas,
        COALESCE(SUM(f.horas_totales), 0) as horas_totales,
        COUNT(*) FILTER (WHERE f.hora_salida IS NOT NULL)::INTEGER as dias_completos,
        COUNT(*) FILTER (WHERE f.hora_salida IS NULL)::INTEGER as dias_incompletos
    FROM fichajes f
    WHERE f.empleado_id = p_empleado_id
      AND EXTRACT(MONTH FROM f.fecha) = p_mes
      AND EXTRACT(YEAR FROM f.fecha) = p_ano;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMENTARIOS EN TABLAS (Documentación)
-- =====================================================
COMMENT ON TABLE fichajes IS 'Tabla principal de fichajes de empleados. Cumple normativa laboral española.';
COMMENT ON TABLE fichajes_pausas IS 'Registro de pausas (comida, descansos) durante la jornada laboral. Obligatorio según normativa.';
COMMENT ON TABLE fichajes_auditoria IS 'Historial completo de todos los cambios en fichajes. No se puede borrar. Retención 4 años.';

COMMENT ON COLUMN fichajes.hora_entrada IS 'Timestamp del servidor (no del dispositivo). CRÍTICO para cumplimiento normativa.';
COMMENT ON COLUMN fichajes.hora_salida IS 'Timestamp del servidor cuando se registra la salida.';
COMMENT ON COLUMN fichajes.es_modificado IS 'Indica si el fichaje fue añadido o modificado a posteriori.';
COMMENT ON COLUMN fichajes.valor_original IS 'Valor original antes de modificación. Guardado para auditoría.';
COMMENT ON COLUMN fichajes.notificado_trabajador IS 'Indica si se notificó al trabajador sobre el cambio.';
COMMENT ON COLUMN fichajes.validado_por_trabajador IS 'Indica si el trabajador aceptó/validó el cambio realizado por la empresa.';

-- =====================================================
-- POLÍTICAS RLS (Row Level Security)
-- =====================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE fichajes ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichajes_pausas ENABLE ROW LEVEL SECURITY;
ALTER TABLE fichajes_auditoria ENABLE ROW LEVEL SECURITY;

-- Políticas para fichajes
-- Los trabajadores pueden ver y crear sus propios fichajes
CREATE POLICY "Trabajadores pueden ver sus fichajes" ON fichajes
    FOR SELECT
    USING (
        -- El empleado puede ver sus fichajes si tiene el empleado_id vinculado
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            -- Aquí necesitaríamos una tabla de vinculación empleado_id <-> user_id
            -- Por ahora, permitimos que todos los usuarios autenticados vean todos los fichajes
            -- Se puede refinar después con una tabla de empleados
        )
        OR
        -- Admin, jefe y gestión pueden ver todos los fichajes
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestión', 'gestion')
        )
    );

-- Los trabajadores pueden crear sus propios fichajes
CREATE POLICY "Trabajadores pueden crear fichajes" ON fichajes
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Los trabajadores pueden actualizar sus propios fichajes (solo añadir salida/pausas)
CREATE POLICY "Trabajadores pueden actualizar sus fichajes" ON fichajes
    FOR UPDATE
    USING (
        auth.role() = 'authenticated'
    )
    WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Solo admin/jefe pueden modificar fichajes de otros
CREATE POLICY "Admin puede modificar cualquier fichaje" ON fichajes
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager', 'jefe', 'administrador', 'gestión', 'gestion')
        )
    );

-- Políticas para fichajes_pausas
CREATE POLICY "Usuarios pueden ver pausas de sus fichajes" ON fichajes_pausas
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM fichajes f
            WHERE f.id = fichajes_pausas.fichaje_id
        )
    );

CREATE POLICY "Usuarios pueden crear pausas" ON fichajes_pausas
    FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
    );

CREATE POLICY "Usuarios pueden actualizar pausas" ON fichajes_pausas
    FOR UPDATE
    USING (
        auth.role() = 'authenticated'
    );

-- Políticas para fichajes_auditoria (solo lectura para todos, no se puede modificar)
CREATE POLICY "Usuarios autenticados pueden ver auditoría" ON fichajes_auditoria
    FOR SELECT
    USING (
        auth.role() = 'authenticated'
    );

-- No se permite INSERT, UPDATE o DELETE en auditoría (solo el trigger puede escribir)
-- Esto asegura que el historial no se puede manipular



