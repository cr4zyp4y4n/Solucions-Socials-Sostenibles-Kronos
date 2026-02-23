-- =====================================================
-- Tabla de bajas por empleado (baja laboral, enfermedad, etc.)
-- Permite marcar periodos en los que el empleado no ficha
-- =====================================================

CREATE TABLE IF NOT EXISTS bajas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    empleado_id TEXT NOT NULL,
    fecha_inicio DATE NOT NULL,
    fecha_fin DATE NOT NULL,
    tipo TEXT, -- opcional: 'enfermedad', 'accidente', 'maternidad', 'otro', etc.
    notas TEXT,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT bajas_fechas_orden CHECK (fecha_fin >= fecha_inicio)
);

CREATE INDEX IF NOT EXISTS idx_bajas_empleado_id ON bajas(empleado_id);
CREATE INDEX IF NOT EXISTS idx_bajas_fecha_inicio ON bajas(fecha_inicio);
CREATE INDEX IF NOT EXISTS idx_bajas_fecha_fin ON bajas(fecha_fin);

COMMENT ON TABLE bajas IS 'Periodos de baja (enfermedad, accidente, etc.) por empleado. No se espera que fichen durante estos días.';

-- RLS
ALTER TABLE bajas ENABLE ROW LEVEL SECURITY;

-- Todos los autenticados pueden ver bajas
CREATE POLICY "Usuarios autenticados pueden ver bajas"
    ON bajas FOR SELECT
    USING (auth.role() = 'authenticated');

-- Solo admin, management y manager pueden insertar/actualizar/eliminar
CREATE POLICY "Admin y jefes pueden insertar bajas"
    ON bajas FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

CREATE POLICY "Admin y jefes pueden actualizar bajas"
    ON bajas FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

CREATE POLICY "Admin y jefes pueden eliminar bajas"
    ON bajas FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );
