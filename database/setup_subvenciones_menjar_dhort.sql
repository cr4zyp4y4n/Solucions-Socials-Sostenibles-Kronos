-- ============================================================================
-- TABLA DE SUBVENCIONES PARA MENJAR D'HORT SCCL
-- ============================================================================

-- Eliminar tabla si existe
DROP TABLE IF EXISTS subvenciones_menjar_dhort CASCADE;

-- Crear tabla
CREATE TABLE subvenciones_menjar_dhort (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Información básica
  nombre TEXT NOT NULL,
  proyecto TEXT,
  imputacion TEXT,
  expediente TEXT,
  codigo_subvencion TEXT,
  modalidad TEXT,
  
  -- Fechas e importes
  fecha_adjudicacion TEXT,
  importe_solicitado NUMERIC(12, 2),
  importe_otorgado NUMERIC(12, 2),
  periodo_ejecucion TEXT,
  
  -- Líneas SOC y ArrelsESS
  soc_l1_acompanamiento TEXT,
  soc_l2_contratacion TEXT,
  arrels_ess_l3 TEXT,
  
  -- Abonos
  primer_abono NUMERIC(12, 2),
  fecha_primer_abono TEXT,
  segundo_abono NUMERIC(12, 2),
  fecha_segundo_abono TEXT,
  
  -- Saldos
  saldo_pendiente NUMERIC(12, 2),
  saldo_pendiente_texto TEXT,
  prevision_pago_total TEXT,
  
  -- Justificación y gestión
  fecha_justificacion TEXT,
  holded_asentamiento TEXT,
  importes_por_cobrar TEXT,
  
  -- Administración
  adm_diferencias TEXT,
  
  -- Fase del proyecto
  fase_proyecto TEXT,
  
  -- Estado y revisión
  estado TEXT DEFAULT 'ACTIVO',
  revisado_gestoria BOOLEAN DEFAULT FALSE,
  
  -- Notas adicionales (para comentarios de múltiples líneas)
  notas TEXT,
  
  -- Metadatos
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id)
);

-- ============================================================================
-- ÍNDICES
-- ============================================================================

CREATE INDEX idx_mh_nombre ON subvenciones_menjar_dhort(nombre);
CREATE INDEX idx_mh_proyecto ON subvenciones_menjar_dhort(proyecto);
CREATE INDEX idx_mh_expediente ON subvenciones_menjar_dhort(expediente);
CREATE INDEX idx_mh_estado ON subvenciones_menjar_dhort(estado);
CREATE INDEX idx_mh_fase ON subvenciones_menjar_dhort(fase_proyecto);
CREATE INDEX idx_mh_created_at ON subvenciones_menjar_dhort(created_at);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE subvenciones_menjar_dhort ENABLE ROW LEVEL SECURITY;

-- Política de lectura: usuarios autenticados pueden leer
CREATE POLICY "Authenticated users can read Menjar d'Hort subvenciones"
  ON subvenciones_menjar_dhort
  FOR SELECT
  TO authenticated
  USING (true);

-- Política de inserción: solo admins
CREATE POLICY "Only admins can insert Menjar d'Hort subvenciones"
  ON subvenciones_menjar_dhort
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política de actualización: solo admins
CREATE POLICY "Only admins can update Menjar d'Hort subvenciones"
  ON subvenciones_menjar_dhort
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- Política de eliminación: solo admins
CREATE POLICY "Only admins can delete Menjar d'Hort subvenciones"
  ON subvenciones_menjar_dhort
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'admin'
    )
  );

-- ============================================================================
-- TRIGGER PARA UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_menjar_dhort_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_menjar_dhort_updated_at
  BEFORE UPDATE ON subvenciones_menjar_dhort
  FOR EACH ROW
  EXECUTE FUNCTION update_menjar_dhort_updated_at();

-- ============================================================================
-- COMENTARIOS
-- ============================================================================

COMMENT ON TABLE subvenciones_menjar_dhort IS 'Subvenciones de Menjar d''Hort SCCL';
COMMENT ON COLUMN subvenciones_menjar_dhort.nombre IS 'Nombre de la subvención';
COMMENT ON COLUMN subvenciones_menjar_dhort.proyecto IS 'Proyecto asociado';
COMMENT ON COLUMN subvenciones_menjar_dhort.imputacion IS 'Tipo de imputación';
COMMENT ON COLUMN subvenciones_menjar_dhort.expediente IS 'Número de expediente';
COMMENT ON COLUMN subvenciones_menjar_dhort.soc_l1_acompanamiento IS 'SOC Línea 1: Acompañamiento';
COMMENT ON COLUMN subvenciones_menjar_dhort.soc_l2_contratacion IS 'SOC Línea 2: Contratación de trabajadores';
COMMENT ON COLUMN subvenciones_menjar_dhort.arrels_ess_l3 IS 'ArrelsESS Línea 3';
COMMENT ON COLUMN subvenciones_menjar_dhort.fase_proyecto IS 'Fase actual del proyecto (FASE 1 a FASE 8)';


