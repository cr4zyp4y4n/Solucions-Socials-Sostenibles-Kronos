-- Script de diagnóstico para el sistema de visibilidad
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de invoice_visibility
SELECT 
    'ESTRUCTURA DE TABLA' as tipo,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar si hay datos en invoice_visibility
SELECT 
    'DATOS EN TABLA' as tipo,
    COUNT(*) as total_registros,
    COUNT(DISTINCT invoice_id) as facturas_unicas,
    COUNT(DISTINCT hidden_for_role) as roles_afectados
FROM public.invoice_visibility;

-- 3. Verificar datos específicos para manager
SELECT 
    'FACTURAS OCULTAS PARA MANAGER' as tipo,
    invoice_id,
    hidden_for_role,
    reason,
    hidden_at
FROM public.invoice_visibility 
WHERE hidden_for_role = 'manager'
ORDER BY hidden_at DESC;

-- 4. Verificar que las funciones funcionan
SELECT 
    'PRUEBA FUNCIÓN' as tipo,
    is_invoice_hidden_for_role('test_invoice_identifier', 'manager') as test_result;

-- 5. Verificar si hay datos en invoices (para comparar)
SELECT 
    'DATOS EN INVOICES' as tipo,
    COUNT(*) as total_invoices,
    COUNT(DISTINCT id) as invoices_unicas
FROM public.invoices;

-- 6. Verificar RLS policies
SELECT 
    'RLS POLICIES' as tipo,
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'invoice_visibility'; 