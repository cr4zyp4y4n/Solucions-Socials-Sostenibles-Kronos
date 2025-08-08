-- Script para verificar y limpiar políticas RLS de bruno_invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar todas las políticas existentes
SELECT
    'POLÍTICAS EXISTENTES' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 2. Eliminar TODAS las políticas existentes para INSERT y UPDATE
DROP POLICY IF EXISTS "Management can insert invoices" ON public.bruno_invoices;
DROP POLICY IF EXISTS "Management can update invoices" ON public.bruno_invoices;
DROP POLICY IF EXISTS "Authenticated users can insert invoices" ON public.bruno_invoices;
DROP POLICY IF EXISTS "Authenticated users can update invoices" ON public.bruno_invoices;

-- 3. Verificar que se eliminaron
SELECT
    'POLÍTICAS DESPUÉS DE ELIMINAR' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 4. Crear las políticas correctas
CREATE POLICY "Authenticated users can insert invoices" ON public.bruno_invoices
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update invoices" ON public.bruno_invoices
    FOR UPDATE USING (
        auth.role() = 'authenticated'
    );

-- 5. Verificar las políticas finales
SELECT
    'POLÍTICAS FINALES' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 6. Probar inserción
INSERT INTO public.bruno_invoices (
    invoice_number,
    provider,
    issue_date,
    total,
    status,
    description,
    is_hidden
) VALUES (
    'TEST_CLEAN_001',
    'Proveedor de Prueba Clean',
    '2025-01-01',
    1500.00,
    'paid',
    'Factura de prueba después de limpiar RLS',
    false
) ON CONFLICT (invoice_number) DO NOTHING;

-- 7. Verificar inserción
SELECT
    'PRUEBA DE INSERCIÓN' as tipo,
    invoice_number,
    provider,
    total,
    status,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_CLEAN_001';

-- 8. Probar actualización
UPDATE public.bruno_invoices
SET total = 2000.00,
    description = 'Factura actualizada después de limpiar RLS'
WHERE invoice_number = 'TEST_CLEAN_001';

-- 9. Verificar actualización
SELECT
    'PRUEBA DE ACTUALIZACIÓN' as tipo,
    invoice_number,
    provider,
    total,
    status,
    description,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_CLEAN_001';

-- 10. Limpiar datos de prueba
DELETE FROM public.bruno_invoices WHERE invoice_number = 'TEST_CLEAN_001';

-- 11. Verificar limpieza
SELECT
    'LIMPIEZA COMPLETADA' as tipo,
    COUNT(*) as total_facturas
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_CLEAN_001'; 