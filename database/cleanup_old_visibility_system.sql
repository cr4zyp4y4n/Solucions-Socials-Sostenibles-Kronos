-- Script para limpiar el sistema anterior de visibilidad
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar funciones del sistema anterior
DROP FUNCTION IF EXISTS is_invoice_hidden_for_role(TEXT, TEXT);
DROP FUNCTION IF EXISTS get_visible_invoices_for_role(TEXT);

-- 2. Eliminar tabla del sistema anterior
DROP TABLE IF EXISTS public.invoice_visibility CASCADE;

-- 3. Verificar que se eliminó correctamente
SELECT 
    'SISTEMA ANTERIOR ELIMINADO' as tipo,
    'Las funciones y tabla del sistema anterior han sido eliminadas' as mensaje;

-- 4. Verificar que la nueva tabla existe
SELECT 
    'NUEVA TABLA VERIFICADA' as tipo,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'bruno_invoices' 
AND table_schema = 'public'; 