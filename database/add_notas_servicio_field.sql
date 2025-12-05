-- =====================================================
-- Script para añadir campo notas_servicio a hojas_ruta
-- =====================================================

-- Añadir columna notas_servicio a la tabla hojas_ruta
ALTER TABLE hojas_ruta 
ADD COLUMN IF NOT EXISTS notas_servicio TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Comentario para documentación
COMMENT ON COLUMN hojas_ruta.notas_servicio IS 'Notas de servicio añadidas manualmente por los usuarios (diferentes de las notas importantes del Excel)';

