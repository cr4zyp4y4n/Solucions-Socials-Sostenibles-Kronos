-- Script para permitir que TODOS los roles vean todos los datos en INICIO
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar las políticas RLS actuales
SELECT 
  'Current RLS Policies' as info,
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('excel_uploads', 'invoices') 
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 2. Eliminar políticas existentes para excel_uploads
DROP POLICY IF EXISTS "Users can view uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can update uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can delete uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can view own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.excel_uploads;

-- 3. Crear nuevas políticas RLS para excel_uploads que permitan a TODOS ver todos los datos
-- Política para SELECT (ver uploads) - TODOS pueden ver todos
CREATE POLICY "All users can view all uploads" ON public.excel_uploads
  FOR SELECT USING (
    -- TODOS los usuarios autenticados pueden ver todos los uploads
    auth.role() = 'authenticated'
  );

-- Política para INSERT (crear uploads) - Solo el propietario puede crear
CREATE POLICY "Users can insert own uploads" ON public.excel_uploads
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
  );

-- Política para UPDATE (actualizar uploads) - Solo el propietario puede actualizar
CREATE POLICY "Users can update own uploads" ON public.excel_uploads
  FOR UPDATE USING (
    uploaded_by = auth.uid()
  );

-- Política para DELETE (eliminar uploads) - Solo el propietario puede eliminar
CREATE POLICY "Users can delete own uploads" ON public.excel_uploads
  FOR DELETE USING (
    uploaded_by = auth.uid()
  );

-- 4. Eliminar políticas existentes para invoices
DROP POLICY IF EXISTS "Users can view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can view invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own uploads" ON public.invoices;

-- 5. Crear nuevas políticas RLS para invoices que permitan a TODOS ver todos los datos
-- Política para SELECT (ver facturas) - TODOS pueden ver todas
CREATE POLICY "All users can view all invoices" ON public.invoices
  FOR SELECT USING (
    -- TODOS los usuarios autenticados pueden ver todas las facturas
    auth.role() = 'authenticated'
  );

-- Política para INSERT (insertar facturas) - Solo el propietario del upload puede insertar
CREATE POLICY "Users can insert invoices for own uploads" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

-- Política para UPDATE (actualizar facturas) - Solo el propietario del upload puede actualizar
CREATE POLICY "Users can update invoices from own uploads" ON public.invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

-- Política para DELETE (eliminar facturas) - Solo el propietario del upload puede eliminar
CREATE POLICY "Users can delete invoices from own uploads" ON public.invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

-- 6. Verificar que RLS está habilitado
ALTER TABLE public.excel_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 7. Verificar las políticas creadas
SELECT 
  'Final RLS Policies' as info,
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('excel_uploads', 'invoices') 
AND schemaname = 'public'
ORDER BY tablename, policyname;

-- 8. Probar las políticas con una consulta de ejemplo
SELECT 
  'Testing RLS policies - All users can see all data' as test,
  COUNT(*) as total_uploads,
  COUNT(DISTINCT uploaded_by) as unique_users
FROM public.excel_uploads;

SELECT 
  'Testing invoices RLS - All users can see all invoices' as test,
  COUNT(*) as total_invoices,
  COUNT(DISTINCT upload_id) as unique_uploads
FROM public.invoices;

-- 9. Verificar que todos los roles pueden acceder
SELECT 
  'Role verification' as info,
  role,
  COUNT(*) as user_count
FROM public.user_profiles 
GROUP BY role 
ORDER BY role; 