-- Script para verificar y corregir las políticas RLS de bruno_invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar que la tabla existe
SELECT
    'VERIFICACIÓN TABLA' as tipo,
    table_name,
    table_type
FROM information_schema.tables
WHERE table_name = 'bruno_invoices'
AND table_schema = 'public';

-- 2. Verificar las políticas RLS actuales
SELECT
    'POLÍTICAS RLS ACTUALES' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 3. Eliminar políticas restrictivas si existen
DROP POLICY IF EXISTS "Management can insert invoices" ON public.bruno_invoices;
DROP POLICY IF EXISTS "Management can update invoices" ON public.bruno_invoices;

-- 4. Crear políticas más permisivas para sincronización
CREATE POLICY "Authenticated users can insert invoices" ON public.bruno_invoices
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

CREATE POLICY "Authenticated users can update invoices" ON public.bruno_invoices
    FOR UPDATE USING (
        auth.role() = 'authenticated'
    );

-- 5. Verificar las políticas después de la corrección
SELECT
    'POLÍTICAS RLS CORREGIDAS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 6. Insertar una factura de prueba para verificar que funciona
INSERT INTO public.bruno_invoices (
    invoice_number,
    provider,
    issue_date,
    total,
    status,
    description,
    is_hidden
) VALUES (
    'TEST_RLS_001',
    'Proveedor de Prueba RLS',
    '2025-01-01',
    1000.00,
    'paid',
    'Factura de prueba para verificar RLS',
    false
) ON CONFLICT (invoice_number) DO NOTHING;

-- 7. Verificar que se insertó correctamente
SELECT
    'FACTURA DE PRUEBA INSERTADA' as tipo,
    invoice_number,
    provider,
    total,
    status,
    is_hidden
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_RLS_001';

-- 8. Limpiar datos de prueba
DELETE FROM public.bruno_invoices WHERE invoice_number = 'TEST_RLS_001';

-- 9. Verificar limpieza
SELECT
    'LIMPIEZA COMPLETADA' as tipo,
    COUNT(*) as total_facturas
FROM public.bruno_invoices
WHERE invoice_number = 'TEST_RLS_001'; 