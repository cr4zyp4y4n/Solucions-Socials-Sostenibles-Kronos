-- =====================================================
-- Tabla de vacaciones por empleado (días marcados por admin/manager/management)
-- Se usa en Panel Fichajes para marcar días de vacaciones en el calendario
-- =====================================================

CREATE TABLE IF NOT EXISTS vacaciones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id TEXT NOT NULL,
    fecha DATE NOT NULL,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT vacaciones_unico_dia UNIQUE(empleado_id, fecha)
);

CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado_id ON vacaciones(empleado_id);
CREATE INDEX IF NOT EXISTS idx_vacaciones_fecha ON vacaciones(fecha);
CREATE INDEX IF NOT EXISTS idx_vacaciones_empleado_fecha ON vacaciones(empleado_id, fecha);

COMMENT ON TABLE vacaciones IS 'Días de vacaciones por empleado. Marcados desde Panel Fichajes por admin/manager/management.';

-- RLS
ALTER TABLE vacaciones ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver vacaciones (para mostrarlas en calendario y tarjetas)
CREATE POLICY "Usuarios autenticados pueden ver vacaciones"
    ON vacaciones FOR SELECT
    USING (auth.role() = 'authenticated');

-- Solo admin, management y manager pueden insertar/eliminar vacaciones
CREATE POLICY "Admin y jefes pueden insertar vacaciones"
    ON vacaciones FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

CREATE POLICY "Admin y jefes pueden eliminar vacaciones"
    ON vacaciones FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );
