-- Script de prueba para verificar que el sistema funciona con docNumber
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar que la tabla bruno_invoices existe y tiene la estructura correcta
SELECT
    'VERIFICACIÓN TABLA' as tipo,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'bruno_invoices'
AND table_schema = 'public';

-- 2. Verificar que el campo invoice_number existe
SELECT
    'CAMPO INVOICE_NUMBER' as tipo,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'bruno_invoices'
AND column_name = 'invoice_number'
AND table_schema = 'public';

-- 3. Insertar una factura de prueba con un docNumber simulado
INSERT INTO public.bruno_invoices (
    invoice_number,
    provider,
    issue_date,
    total,
    status,
    description,
    is_hidden
) VALUES (
    'DOC_001',
    'Proveedor de Prueba DocNumber',
    '2025-01-01',
    2500.00,
    'paid',
    'Factura de prueba para verificar docNumber',
    false
) ON CONFLICT (invoice_number) DO NOTHING;

-- 4. Verificar que se insertó correctamente
SELECT
    'FACTURA INSERTADA' as tipo,
    invoice_number,
    provider,
    total,
    status,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'DOC_001';

-- 5. Probar ocultar la factura
UPDATE public.bruno_invoices
SET is_hidden = true,
    hidden_reason = 'Prueba con docNumber',
    hidden_at = NOW()
WHERE invoice_number = 'DOC_001';

-- 6. Verificar que se ocultó correctamente
SELECT
    'FACTURA OCULTA' as tipo,
    invoice_number,
    is_hidden,
    hidden_reason,
    hidden_at
FROM public.bruno_invoices
WHERE invoice_number = 'DOC_001';

-- 7. Probar mostrar la factura
UPDATE public.bruno_invoices
SET is_hidden = false,
    hidden_reason = NULL,
    hidden_at = NULL
WHERE invoice_number = 'DOC_001';

-- 8. Verificar que se mostró correctamente
SELECT
    'FACTURA VISIBLE' as tipo,
    invoice_number,
    is_hidden,
    hidden_reason
FROM public.bruno_invoices
WHERE invoice_number = 'DOC_001';

-- 9. Limpiar datos de prueba
DELETE FROM public.bruno_invoices WHERE invoice_number = 'DOC_001';

-- 10. Verificar limpieza
SELECT
    'LIMPIEZA COMPLETADA' as tipo,
    COUNT(*) as total_facturas
FROM public.bruno_invoices
WHERE invoice_number = 'DOC_001';

-- 11. Verificar las políticas RLS
SELECT
    'POLÍTICAS RLS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname; 