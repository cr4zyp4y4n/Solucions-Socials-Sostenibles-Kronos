-- Script de migración para pasar de la tabla antigua a la nueva v2
-- EJECUTAR DESPUÉS de crear la nueva tabla con create_subvenciones_table_v2.sql

-- 1. Renombrar tabla antigua para backup
ALTER TABLE IF EXISTS public.subvenciones RENAME TO subvenciones_backup;

-- 2. Renombrar nueva tabla a subvenciones
ALTER TABLE public.subvenciones RENAME TO subvenciones_v2;
ALTER TABLE public.subvenciones_v2 RENAME TO subvenciones;

-- 3. Comentario de confirmación
COMMENT ON TABLE public.subvenciones IS 'Tabla de subvenciones v2 - Estructura limpia con todos los campos del CSV';

-- 4. Verificar que la tabla está lista
SELECT 
    table_name,
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'subvenciones' 
ORDER BY ordinal_position;
