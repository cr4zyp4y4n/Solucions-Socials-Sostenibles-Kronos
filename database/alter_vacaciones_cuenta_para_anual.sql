-- =====================================================
-- Añadir columna cuenta_para_anual a vacaciones
-- Si false, ese día NO descuenta de los 22 días anuales
-- (ej. vacaciones por recuperación de baja)
-- =====================================================

ALTER TABLE vacaciones
ADD COLUMN IF NOT EXISTS cuenta_para_anual BOOLEAN DEFAULT true;

COMMENT ON COLUMN vacaciones.cuenta_para_anual IS 'Si true, este día descuenta de los 22 días anuales. Si false, no descuenta (ej. recuperación por baja).';

-- Permitir a admin/manager/management actualizar vacaciones (ej. marcar cuenta_para_anual)
CREATE POLICY "Admin y jefes pueden actualizar vacaciones"
    ON vacaciones FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('admin', 'management', 'manager')
        )
    );

-- Para Paula (o quien corresponda): marcar los días de recuperación por baja
-- como que no cuentan para el cómputo anual. Ejemplo (ajusta empleado_id y fechas):
-- UPDATE vacaciones SET cuenta_para_anual = false
-- WHERE empleado_id = 'ID_DE_PAULA' AND fecha >= '2026-02-01' AND fecha <= '2026-04-10';
