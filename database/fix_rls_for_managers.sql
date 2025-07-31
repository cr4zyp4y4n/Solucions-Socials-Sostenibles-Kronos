-- Script para corregir las políticas RLS para que los jefes y administradores puedan ver todos los datos
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
DROP POLICY IF EXISTS "Users can view own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can update own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can delete own uploads" ON public.excel_uploads;

-- 3. Crear nuevas políticas RLS para excel_uploads
-- Política para SELECT (ver uploads)
CREATE POLICY "Users can view uploads" ON public.excel_uploads
  FOR SELECT USING (
    -- Usuarios pueden ver sus propios uploads
    uploaded_by = auth.uid()
    OR
    -- Jefes y administradores pueden ver todos los uploads
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- Política para INSERT (crear uploads)
CREATE POLICY "Users can insert uploads" ON public.excel_uploads
  FOR INSERT WITH CHECK (
    uploaded_by = auth.uid()
  );

-- Política para UPDATE (actualizar uploads)
CREATE POLICY "Users can update uploads" ON public.excel_uploads
  FOR UPDATE USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- Política para DELETE (eliminar uploads)
CREATE POLICY "Users can delete uploads" ON public.excel_uploads
  FOR DELETE USING (
    uploaded_by = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- 4. Eliminar políticas existentes para invoices
DROP POLICY IF EXISTS "Users can view invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices from own uploads" ON public.invoices;

-- 5. Crear nuevas políticas RLS para invoices
-- Política para SELECT (ver facturas)
CREATE POLICY "Users can view invoices" ON public.invoices
  FOR SELECT USING (
    -- Usuarios pueden ver facturas de sus propios uploads
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
    OR
    -- Jefes y administradores pueden ver todas las facturas
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- Política para INSERT (insertar facturas)
CREATE POLICY "Users can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (
    -- Usuarios pueden insertar facturas para sus propios uploads
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
    OR
    -- Jefes y administradores pueden insertar facturas
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- Política para UPDATE (actualizar facturas)
CREATE POLICY "Users can update invoices" ON public.invoices
  FOR UPDATE USING (
    -- Usuarios pueden actualizar facturas de sus propios uploads
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
    OR
    -- Jefes y administradores pueden actualizar todas las facturas
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
    )
  );

-- Política para DELETE (eliminar facturas)
CREATE POLICY "Users can delete invoices" ON public.invoices
  FOR DELETE USING (
    -- Usuarios pueden eliminar facturas de sus propios uploads
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
    OR
    -- Jefes y administradores pueden eliminar todas las facturas
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() 
      AND role IN ('manager', 'admin')
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
  'Testing RLS policies' as test,
  COUNT(*) as total_uploads,
  COUNT(DISTINCT uploaded_by) as unique_users
FROM public.excel_uploads;

SELECT 
  'Testing invoices RLS' as test,
  COUNT(*) as total_invoices,
  COUNT(DISTINCT upload_id) as unique_uploads
FROM public.invoices; 