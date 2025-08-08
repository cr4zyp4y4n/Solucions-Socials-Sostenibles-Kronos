-- Script para verificar la tabla invoice_visibility
-- Ejecutar en el SQL Editor de Supabase

-- 1. Verificar si la tabla existe
SELECT 
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoice_visibility' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar las políticas RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'invoice_visibility'
ORDER BY policyname;

-- 3. Verificar las funciones
SELECT 
    routine_name,
    routine_type,
    data_type
FROM information_schema.routines 
WHERE routine_name IN ('is_invoice_hidden_for_role', 'get_visible_invoices_for_role')
AND routine_schema = 'public';

-- 4. Verificar si hay datos en la tabla
SELECT COUNT(*) as total_records FROM public.invoice_visibility;

-- 5. Verificar la estructura de la tabla invoices para comparar
SELECT 
    column_name,
    data_type
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position; 