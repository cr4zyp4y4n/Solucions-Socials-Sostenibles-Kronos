-- Script de prueba para verificar las correcciones del sistema de Bruno
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar las políticas RLS actualizadas
SELECT
    'POLÍTICAS RLS CORREGIDAS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 2. Insertar una factura de prueba (debería funcionar ahora)
INSERT INTO public.bruno_invoices (
    invoice_number,
    provider,
    issue_date,
    total,
    status,
    description,
    is_hidden
) VALUES (
    'TEST_FIX_001',
    'Proveedor de Prueba Fix',
    '2025-01-01',
    1500.00,
    'paid',
    'Factura de prueba para verificar correcciones',
    false
) ON CONFLICT (invoice_number) DO NOTHING;

-- 3. Verificar que se insertó correctamente
SELECT
    'FACTURA DE PRUEBA INSERTADA' as tipo,
    invoice_number,
    provider,
    total,
    status,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_FIX_001';

-- 4. Probar actualización (debería funcionar ahora)
UPDATE public.bruno_invoices
SET total = 2000.00,
    description = 'Factura actualizada para verificar correcciones'
WHERE invoice_number = 'TEST_FIX_001';

-- 5. Verificar que se actualizó correctamente
SELECT
    'FACTURA ACTUALIZADA' as tipo,
    invoice_number,
    provider,
    total,
    status,
    description,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_FIX_001';

-- 6. Probar ocultar la factura
UPDATE public.bruno_invoices
SET is_hidden = true,
    hidden_reason = 'Prueba de correcciones',
    hidden_at = NOW()
WHERE invoice_number = 'TEST_FIX_001';

-- 7. Verificar que se ocultó correctamente
SELECT
    'FACTURA OCULTA' as tipo,
    invoice_number,
    is_hidden,
    hidden_reason,
    hidden_at
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_FIX_001';

-- 8. Probar mostrar la factura
UPDATE public.bruno_invoices
SET is_hidden = false,
    hidden_reason = NULL,
    hidden_at = NULL
WHERE invoice_number = 'TEST_FIX_001';

-- 9. Verificar que se mostró correctamente
SELECT
    'FACTURA VISIBLE' as tipo,
    invoice_number,
    is_hidden,
    hidden_reason
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_FIX_001';

-- 10. Limpiar datos de prueba
DELETE FROM public.bruno_invoices WHERE invoice_number = 'TEST_FIX_001';

-- 11. Verificar limpieza
SELECT
    'LIMPIEZA COMPLETADA' as tipo,
    COUNT(*) as total_facturas
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_FIX_001';

-- 12. Verificar estructura de la tabla
SELECT
    'ESTRUCTURA TABLA' as tipo,
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'bruno_invoices'
AND table_schema = 'public'
ORDER BY ordinal_position; 