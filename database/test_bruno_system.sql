-- Script de prueba para el nuevo sistema de Bruno
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar que la tabla bruno_invoices existe
SELECT 
    'VERIFICACIÓN TABLA' as tipo,
    table_name,
    table_type
FROM information_schema.tables 
WHERE table_name = 'bruno_invoices' 
AND table_schema = 'public';

-- 2. Verificar la estructura de la tabla
SELECT 
    'ESTRUCTURA TABLA' as tipo,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'bruno_invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Verificar las políticas RLS
SELECT 
    'POLÍTICAS RLS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies 
WHERE tablename = 'bruno_invoices';

-- 4. Insertar una factura de prueba
INSERT INTO public.bruno_invoices (
    invoice_number,
    provider,
    issue_date,
    total,
    status,
    description,
    is_hidden
) VALUES (
    'TEST_001',
    'Proveedor de Prueba',
    '2025-01-01',
    1000.00,
    'paid',
    'Factura de prueba para Bruno',
    false
) ON CONFLICT (invoice_number) DO NOTHING;

-- 5. Verificar que se insertó correctamente
SELECT 
    'FACTURA DE PRUEBA' as tipo,
    invoice_number,
    provider,
    total,
    status,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_001';

-- 6. Probar ocultar la factura
UPDATE public.bruno_invoices 
SET is_hidden = true, 
    hidden_reason = 'Prueba del sistema',
    hidden_at = NOW()
WHERE invoice_number = 'TEST_001';

-- 7. Verificar que se ocultó correctamente
SELECT 
    'FACTURA OCULTA' as tipo,
    invoice_number,
    is_hidden,
    hidden_reason,
    hidden_at
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_001';

-- 8. Probar mostrar la factura
UPDATE public.bruno_invoices 
SET is_hidden = false, 
    hidden_reason = NULL,
    hidden_at = NULL
WHERE invoice_number = 'TEST_001';

-- 9. Verificar que se mostró correctamente
SELECT 
    'FACTURA VISIBLE' as tipo,
    invoice_number,
    is_hidden,
    hidden_reason
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_001';

-- 10. Limpiar datos de prueba
DELETE FROM public.bruno_invoices WHERE invoice_number = 'TEST_001';

-- 11. Verificar limpieza
SELECT 
    'LIMPIEZA COMPLETADA' as tipo,
    COUNT(*) as total_facturas
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_001'; 