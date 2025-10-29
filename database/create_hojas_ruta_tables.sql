-- =====================================================
-- Script de creación de tablas para Hojas de Ruta
-- Supabase/PostgreSQL
-- =====================================================

-- Extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- TABLA PRINCIPAL: hojas_ruta
-- =====================================================
CREATE TABLE IF NOT EXISTS hojas_ruta (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha_creacion TIMESTAMP NOT NULL DEFAULT now(),
    fecha_servicio DATE NOT NULL,
    cliente TEXT NOT NULL,
    contacto TEXT,
    direccion TEXT,
    transportista TEXT,
    responsable TEXT,
    num_personas INTEGER DEFAULT 0,
    personal_text TEXT, -- Texto original del personal (separado por +)
    firma_responsable TEXT,
    firma_info JSONB DEFAULT '{"firmado": false, "firmado_por": "", "fecha_firma": null, "firma_data": ""}',
    horarios JSONB DEFAULT '{"montaje": "", "welcome": "", "desayuno": "", "comida": "", "recogida": ""}',
    estado TEXT DEFAULT 'preparacion' CHECK (estado IN ('preparacion', 'en_camino', 'montaje', 'servicio', 'recogida', 'completado')),
    notas TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    updated_at TIMESTAMP DEFAULT now()
);

-- Índices para hojas_ruta
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_fecha_servicio ON hojas_ruta(fecha_servicio DESC);
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_cliente ON hojas_ruta(cliente);
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_estado ON hojas_ruta(estado);
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_created_by ON hojas_ruta(created_by);
CREATE INDEX IF NOT EXISTS idx_hojas_ruta_updated_at ON hojas_ruta(updated_at DESC);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_hojas_ruta_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_hojas_ruta_updated_at
    BEFORE UPDATE ON hojas_ruta
    FOR EACH ROW
    EXECUTE FUNCTION update_hojas_ruta_updated_at();

-- =====================================================
-- TABLA: hojas_ruta_personal ⭐ CRÍTICA
-- =====================================================
CREATE TABLE IF NOT EXISTS hojas_ruta_personal (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    horas DECIMAL(5,2) NOT NULL DEFAULT 0,
    empleado_id TEXT, -- ID de Holded (MongoDB ObjectId como string)
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    UNIQUE(hoja_ruta_id, nombre) -- Evita duplicados del mismo trabajador
);

-- Índices para hojas_ruta_personal
CREATE INDEX IF NOT EXISTS idx_hr_personal_hoja_ruta ON hojas_ruta_personal(hoja_ruta_id);
CREATE INDEX IF NOT EXISTS idx_hr_personal_empleado_id ON hojas_ruta_personal(empleado_id) WHERE empleado_id IS NOT NULL; -- ⭐ CRÍTICO
CREATE INDEX IF NOT EXISTS idx_hr_personal_nombre ON hojas_ruta_personal(nombre);

-- Trigger para updated_at
CREATE TRIGGER trigger_hr_personal_updated_at
    BEFORE UPDATE ON hojas_ruta_personal
    FOR EACH ROW
    EXECUTE FUNCTION update_hojas_ruta_updated_at();

-- =====================================================
-- TABLA: hojas_ruta_equipamiento
-- =====================================================
CREATE TABLE IF NOT EXISTS hojas_ruta_equipamiento (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    cantidad TEXT,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_equipamiento_hoja_ruta ON hojas_ruta_equipamiento(hoja_ruta_id);

-- =====================================================
-- TABLA: hojas_ruta_menus
-- =====================================================
CREATE TABLE IF NOT EXISTS hojas_ruta_menus (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL, -- welcome, comida, desayuno, etc.
    hora TEXT,
    item TEXT NOT NULL,
    cantidad TEXT,
    proveedor TEXT,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_menus_hoja_ruta ON hojas_ruta_menus(hoja_ruta_id);
CREATE INDEX IF NOT EXISTS idx_hr_menus_tipo ON hojas_ruta_menus(tipo);

-- =====================================================
-- TABLA: hojas_ruta_bebidas
-- =====================================================
CREATE TABLE IF NOT EXISTS hojas_ruta_bebidas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
    item TEXT NOT NULL,
    cantidad TEXT,
    unidad TEXT,
    orden INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hr_bebidas_hoja_ruta ON hojas_ruta_bebidas(hoja_ruta_id);

-- =====================================================
-- TABLA: hojas_ruta_checklist
-- =====================================================
CREATE TABLE IF NOT EXISTS hojas_ruta_checklist (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    hoja_ruta_id UUID NOT NULL REFERENCES hojas_ruta(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('general', 'equipamiento', 'menus', 'bebidas')),
    fase TEXT, -- Solo para tipo 'general': preEvento, duranteEvento, postEvento
    tarea_id TEXT NOT NULL,
    task TEXT NOT NULL,
    completed BOOLEAN DEFAULT false,
    assigned_to TEXT, -- Email o ID del usuario
    priority TEXT DEFAULT 'media' CHECK (priority IN ('alta', 'media', 'baja')),
    completed_at TIMESTAMP,
    completed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now()
);

-- Índice único para evitar duplicados (usando expresión para manejar fase NULL)
CREATE UNIQUE INDEX idx_hr_checklist_unique 
ON hojas_ruta_checklist(hoja_ruta_id, tipo, COALESCE(fase, ''), tarea_id);

-- Índices para checklist
CREATE INDEX IF NOT EXISTS idx_hr_checklist_hoja_ruta ON hojas_ruta_checklist(hoja_ruta_id);
CREATE INDEX IF NOT EXISTS idx_hr_checklist_tipo_fase ON hojas_ruta_checklist(tipo, fase);
CREATE INDEX IF NOT EXISTS idx_hr_checklist_completed ON hojas_ruta_checklist(completed);
CREATE INDEX IF NOT EXISTS idx_hr_checklist_assigned_to ON hojas_ruta_checklist(assigned_to);

-- Trigger para updated_at
CREATE TRIGGER trigger_hr_checklist_updated_at
    BEFORE UPDATE ON hojas_ruta_checklist
    FOR EACH ROW
    EXECUTE FUNCTION update_hojas_ruta_updated_at();

-- =====================================================
-- COMENTARIOS EN TABLAS (Documentación)
-- =====================================================
COMMENT ON TABLE hojas_ruta IS 'Tabla principal de hojas de ruta de servicios de catering';
COMMENT ON TABLE hojas_ruta_personal IS 'Asignación de horas por trabajador. empleado_id vincula con Holded API';
COMMENT ON TABLE hojas_ruta_equipamiento IS 'Items de equipamiento requeridos por hoja de ruta';
COMMENT ON TABLE hojas_ruta_menus IS 'Menús y sus items por hoja de ruta';
COMMENT ON TABLE hojas_ruta_bebidas IS 'Bebidas requeridas por hoja de ruta';
COMMENT ON TABLE hojas_ruta_checklist IS 'Tareas del checklist por hoja de ruta y tipo';

COMMENT ON COLUMN hojas_ruta_personal.empleado_id IS 'ID de Holded (string). NULL si el trabajador no está vinculado con un empleado';
COMMENT ON COLUMN hojas_ruta_personal.horas IS 'Horas asignadas al trabajador en este servicio';

-- =====================================================
-- FUNCIONES ÚTILES
-- =====================================================

-- Función para obtener histórico de servicios de un empleado
CREATE OR REPLACE FUNCTION get_empleado_servicios(p_empleado_id TEXT)
RETURNS TABLE (
    hoja_ruta_id UUID,
    fecha_servicio DATE,
    cliente TEXT,
    horas DECIMAL(5,2),
    nombre TEXT,
    estado TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hr.id,
        hr.fecha_servicio,
        hr.cliente,
        hrp.horas,
        hrp.nombre,
        hr.estado
    FROM hojas_ruta hr
    INNER JOIN hojas_ruta_personal hrp ON hr.id = hrp.hoja_ruta_id
    WHERE hrp.empleado_id = p_empleado_id
      AND hrp.horas > 0
    ORDER BY hr.fecha_servicio DESC;
END;
$$ LANGUAGE plpgsql;

-- Función para obtener estadísticas de horas por empleado
CREATE OR REPLACE FUNCTION get_empleado_estadisticas(p_empleado_id TEXT)
RETURNS TABLE (
    total_servicios BIGINT,
    total_horas NUMERIC,
    promedio_horas NUMERIC,
    servicios_completados BIGINT,
    ultimo_servicio DATE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT as total_servicios,
        COALESCE(SUM(hrp.horas), 0)::NUMERIC as total_horas,
        COALESCE(AVG(hrp.horas), 0)::NUMERIC as promedio_horas,
        COUNT(CASE WHEN hr.estado = 'completado' THEN 1 END)::BIGINT as servicios_completados,
        MAX(hr.fecha_servicio) as ultimo_servicio
    FROM hojas_ruta_personal hrp
    INNER JOIN hojas_ruta hr ON hr.id = hrp.hoja_ruta_id
    WHERE hrp.empleado_id = p_empleado_id;
END;
$$ LANGUAGE plpgsql;

