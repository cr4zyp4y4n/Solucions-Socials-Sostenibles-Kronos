-- Script para corregir las políticas RLS de bruno_invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar las políticas RLS existentes para INSERT y UPDATE
DROP POLICY IF EXISTS "Management can insert invoices" ON public.bruno_invoices;
DROP POLICY IF EXISTS "Management can update invoices" ON public.bruno_invoices;

-- 2. Crear nuevas políticas más permisivas para sincronización
-- Permitir que cualquier usuario autenticado pueda insertar facturas
CREATE POLICY "Authenticated users can insert invoices" ON public.bruno_invoices
    FOR INSERT WITH CHECK (
        auth.role() = 'authenticated'
    );

-- Permitir que cualquier usuario autenticado pueda actualizar facturas
CREATE POLICY "Authenticated users can update invoices" ON public.bruno_invoices
    FOR UPDATE USING (
        auth.role() = 'authenticated'
    );

-- 3. Mantener las políticas de SELECT existentes
-- (No es necesario recrearlas, ya están correctas)

-- 4. Verificar las políticas actuales
SELECT
    'POLÍTICAS RLS ACTUALIZADAS' as tipo,
    policyname,
    permissive,
    roles,
    cmd
FROM pg_policies
WHERE tablename = 'bruno_invoices'
ORDER BY policyname;

-- 5. Verificar que la tabla sigue habilitada para RLS
SELECT
    'RLS HABILITADO' as tipo,
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE tablename = 'bruno_invoices'
AND schemaname = 'public'; 