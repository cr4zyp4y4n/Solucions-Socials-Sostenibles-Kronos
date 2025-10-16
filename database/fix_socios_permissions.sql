-- Script para corregir los permisos de la tabla socios_idoni
-- Ejecutar este script en el SQL Editor de Supabase

-- Primero, verificar las políticas existentes
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'socios_idoni';

-- Eliminar todas las políticas existentes para recrearlas
DROP POLICY IF EXISTS "Permitir lectura a usuarios autenticados" ON socios_idoni;
DROP POLICY IF EXISTS "Permitir inserción a administradores y tienda" ON socios_idoni;
DROP POLICY IF EXISTS "Permitir actualización a administradores y tienda" ON socios_idoni;
DROP POLICY IF EXISTS "Permitir eliminación a administradores" ON socios_idoni;

-- Crear políticas más simples y permisivas para testing
-- Política para permitir lectura a todos los usuarios autenticados
CREATE POLICY "socios_select_policy" ON socios_idoni
    FOR SELECT USING (auth.role() = 'authenticated');

-- Política para permitir inserción a todos los usuarios autenticados (temporal para testing)
CREATE POLICY "socios_insert_policy" ON socios_idoni
    FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Política para permitir actualización a todos los usuarios autenticados (temporal para testing)
CREATE POLICY "socios_update_policy" ON socios_idoni
    FOR UPDATE USING (auth.role() = 'authenticated');

-- Política para permitir eliminación a todos los usuarios autenticados (temporal para testing)
CREATE POLICY "socios_delete_policy" ON socios_idoni
    FOR DELETE USING (auth.role() = 'authenticated');

-- Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE tablename = 'socios_idoni';

-- También verificar que RLS está habilitado
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename = 'socios_idoni';
