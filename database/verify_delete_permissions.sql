-- Script para verificar que las políticas RLS permiten eliminar datos
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar políticas RLS actuales para DELETE
SELECT 
  'Current DELETE Policies' as info,
  tablename, 
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('excel_uploads', 'invoices') 
AND cmd = 'DELETE'
AND schemaname = 'public'
ORDER BY tablename;

-- 2. Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename IN ('excel_uploads', 'invoices')
AND schemaname = 'public';

-- 3. Probar eliminación de datos (ejecutar como usuario autenticado)
-- Esta consulta debería funcionar para jefes y administradores
SELECT 
  'Testing DELETE permissions' as test,
  COUNT(*) as total_uploads_before_delete
FROM public.excel_uploads;

SELECT 
  'Testing invoices DELETE' as test,
  COUNT(*) as total_invoices_before_delete
FROM public.invoices;

-- 4. Verificar estructura de las tablas
SELECT 
  'excel_uploads structure' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'excel_uploads' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT 
  'invoices structure' as table_info,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 5. Verificar datos de ejemplo
SELECT 
  'Sample excel_uploads data' as sample,
  id,
  upload_type,
  uploaded_by,
  uploaded_at,
  file_name
FROM public.excel_uploads 
ORDER BY uploaded_at DESC 
LIMIT 5;

SELECT 
  'Sample invoices data' as sample,
  id,
  upload_id,
  created_by,
  processed_at,
  provider
FROM public.invoices 
ORDER BY processed_at DESC 
LIMIT 5; 