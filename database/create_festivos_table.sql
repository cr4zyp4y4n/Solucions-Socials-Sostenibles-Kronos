-- =====================================================
-- Festivos laborales (calendario empresa: Barcelona)
-- Aplican a toda la plantilla; no descuentan de vacaciones anuales.
-- Fuente inicial: Ajuntament de Barcelona (oficial 2026 / 2027).
-- =====================================================

CREATE TABLE IF NOT EXISTS festivos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fecha DATE NOT NULL,
    nombre TEXT NOT NULL,
    ambito TEXT NOT NULL DEFAULT 'estatal'
        CHECK (ambito IN ('estatal', 'autonomico', 'local')),
    ciudad TEXT NOT NULL DEFAULT 'Barcelona',
    activo BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT festivos_unico_fecha_ciudad UNIQUE (fecha, ciudad)
);

CREATE INDEX IF NOT EXISTS idx_festivos_fecha ON festivos(fecha);
CREATE INDEX IF NOT EXISTS idx_festivos_activo_fecha ON festivos(fecha) WHERE activo = true;

COMMENT ON TABLE festivos IS
  'Calendario de fiestas laborales (por defecto Barcelona). Días no laborables para fichaje/SMS; no restan vacaciones.';
COMMENT ON COLUMN festivos.ambito IS 'estatal | autonomico | local';
COMMENT ON COLUMN festivos.ciudad IS 'Municipio del calendario local (Barcelona por defecto).';

ALTER TABLE festivos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuarios autenticados pueden ver festivos" ON festivos;
CREATE POLICY "Usuarios autenticados pueden ver festivos"
    ON festivos FOR SELECT
    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "Admin y jefes pueden insertar festivos" ON festivos;
CREATE POLICY "Admin y jefes pueden insertar festivos"
    ON festivos FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

DROP POLICY IF EXISTS "Admin y jefes pueden actualizar festivos" ON festivos;
CREATE POLICY "Admin y jefes pueden actualizar festivos"
    ON festivos FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

DROP POLICY IF EXISTS "Admin y jefes pueden eliminar festivos" ON festivos;
CREATE POLICY "Admin y jefes pueden eliminar festivos"
    ON festivos FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

-- Seed Barcelona 2026 (Ajuntament)
INSERT INTO festivos (fecha, nombre, ambito, ciudad) VALUES
    ('2026-01-01', 'Año Nuevo', 'estatal', 'Barcelona'),
    ('2026-01-06', 'Reyes', 'estatal', 'Barcelona'),
    ('2026-04-03', 'Viernes Santo', 'estatal', 'Barcelona'),
    ('2026-04-06', 'Lunes de Pascua Florida', 'autonomico', 'Barcelona'),
    ('2026-05-01', 'Fiesta del Trabajo', 'estatal', 'Barcelona'),
    ('2026-05-25', 'Lunes de Pascua Granada', 'local', 'Barcelona'),
    ('2026-06-24', 'San Juan', 'autonomico', 'Barcelona'),
    ('2026-08-15', 'La Asunción', 'estatal', 'Barcelona'),
    ('2026-09-11', 'Diada Nacional de Cataluña', 'autonomico', 'Barcelona'),
    ('2026-09-24', 'Mare de Déu de la Mercè', 'local', 'Barcelona'),
    ('2026-10-12', 'Día Nacional de España', 'estatal', 'Barcelona'),
    ('2026-12-08', 'La Inmaculada', 'estatal', 'Barcelona'),
    ('2026-12-25', 'Navidad', 'estatal', 'Barcelona'),
    ('2026-12-26', 'San Esteban', 'autonomico', 'Barcelona')
ON CONFLICT (fecha, ciudad) DO NOTHING;

-- Seed Barcelona 2027 (Ajuntament)
INSERT INTO festivos (fecha, nombre, ambito, ciudad) VALUES
    ('2027-01-01', 'Año Nuevo', 'estatal', 'Barcelona'),
    ('2027-01-06', 'Reyes', 'estatal', 'Barcelona'),
    ('2027-03-26', 'Viernes Santo', 'estatal', 'Barcelona'),
    ('2027-03-29', 'Lunes de Pascua Florida', 'autonomico', 'Barcelona'),
    ('2027-05-01', 'Fiesta del Trabajo', 'estatal', 'Barcelona'),
    ('2027-05-17', 'Lunes de Pascua Granada', 'local', 'Barcelona'),
    ('2027-06-24', 'San Juan', 'autonomico', 'Barcelona'),
    ('2027-09-11', 'Diada Nacional de Cataluña', 'autonomico', 'Barcelona'),
    ('2027-09-24', 'Virgen de la Merced', 'local', 'Barcelona'),
    ('2027-10-12', 'Día Nacional de España', 'estatal', 'Barcelona'),
    ('2027-11-01', 'Todos los Santos', 'estatal', 'Barcelona'),
    ('2027-12-06', 'Día de la Constitución', 'estatal', 'Barcelona'),
    ('2027-12-08', 'La Inmaculada', 'estatal', 'Barcelona'),
    ('2027-12-25', 'Navidad', 'estatal', 'Barcelona')
ON CONFLICT (fecha, ciudad) DO NOTHING;

NOTIFY pgrst, 'reload schema';
