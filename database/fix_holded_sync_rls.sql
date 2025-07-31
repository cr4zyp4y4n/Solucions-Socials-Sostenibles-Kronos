-- Script para corregir las políticas RLS para permitir sincronización de Holded
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar las políticas actuales
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
WHERE tablename = 'excel_uploads';

-- 2. Eliminar políticas existentes para excel_uploads
DROP POLICY IF EXISTS "Users can view own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can update own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can delete own uploads" ON public.excel_uploads;

-- 3. Crear nuevas políticas que permitan sincronización de Holded
-- Política para SELECT: usuarios pueden ver sus propios uploads y todos los de tipo holded_api
CREATE POLICY "Users can view own uploads and holded sync" ON public.excel_uploads
  FOR SELECT USING (
    auth.uid() = uploaded_by OR 
    type = 'holded_api'
  );

-- Política para INSERT: usuarios pueden insertar sus propios uploads y registros de holded_api
CREATE POLICY "Users can insert own uploads and holded sync" ON public.excel_uploads
  FOR INSERT WITH CHECK (
    auth.uid() = uploaded_by OR 
    type = 'holded_api'
  );

-- Política para UPDATE: usuarios pueden actualizar sus propios uploads y registros de holded_api
CREATE POLICY "Users can update own uploads and holded sync" ON public.excel_uploads
  FOR UPDATE USING (
    auth.uid() = uploaded_by OR 
    type = 'holded_api'
  );

-- Política para DELETE: usuarios pueden eliminar sus propios uploads y registros de holded_api
CREATE POLICY "Users can delete own uploads and holded sync" ON public.excel_uploads
  FOR DELETE USING (
    auth.uid() = uploaded_by OR 
    type = 'holded_api'
  );

-- 4. Verificar que las políticas se crearon correctamente
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
WHERE tablename = 'excel_uploads'
ORDER BY policyname;

-- 5. Probar la inserción de un registro de sincronización de Holded
-- (Este paso es solo para verificación, no se ejecutará automáticamente)
/*
INSERT INTO public.excel_uploads (
  filename,
  size,
  type,
  metadata,
  processed,
  processed_at
) VALUES (
  'holded_sync_test',
  0,
  'holded_api',
  '{"source": "holded_api", "test": true}',
  true,
  NOW()
);
*/ 