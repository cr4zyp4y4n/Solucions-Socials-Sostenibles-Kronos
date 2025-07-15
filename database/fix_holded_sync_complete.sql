-- Script completo para corregir las políticas RLS para sincronización de Holded
-- Ejecutar este script en el SQL Editor de Supabase

-- ========================================
-- 1. CORREGIR POLÍTICAS DE EXCEL_UPLOADS
-- ========================================

-- Verificar políticas actuales de excel_uploads
SELECT 'Verificando políticas actuales de excel_uploads...' as status;
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

-- Eliminar políticas existentes para excel_uploads
SELECT 'Eliminando políticas existentes de excel_uploads...' as status;
DROP POLICY IF EXISTS "Users can view own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can update own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can delete own uploads" ON public.excel_uploads;

-- Crear nuevas políticas que permitan sincronización de Holded
SELECT 'Creando nuevas políticas para excel_uploads...' as status;

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

-- Política adicional para permitir eliminación de registros de holded_api por cualquier usuario autenticado
CREATE POLICY "Users can delete holded sync records" ON public.excel_uploads
  FOR DELETE USING (
    type = 'holded_api'
  );

-- ========================================
-- 2. CORREGIR POLÍTICAS DE INVOICES
-- ========================================

-- Verificar políticas actuales de invoices
SELECT 'Verificando políticas actuales de invoices...' as status;
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
WHERE tablename = 'invoices'
ORDER BY policyname;

-- Asegurar que la tabla invoices tiene RLS habilitado
SELECT 'Habilitando RLS en invoices...' as status;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes para invoices (si las hay)
SELECT 'Eliminando políticas existentes de invoices...' as status;
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;

-- Crear nuevas políticas para invoices
SELECT 'Creando nuevas políticas para invoices...' as status;

-- Política para SELECT: usuarios pueden ver todas las facturas (para administración)
CREATE POLICY "Users can view all invoices" ON public.invoices
  FOR SELECT USING (true);

-- Política para INSERT: usuarios pueden insertar facturas
CREATE POLICY "Users can insert invoices" ON public.invoices
  FOR INSERT WITH CHECK (true);

-- Política para UPDATE: usuarios pueden actualizar facturas
CREATE POLICY "Users can update invoices" ON public.invoices
  FOR UPDATE USING (true);

-- Política para DELETE: usuarios pueden eliminar facturas
CREATE POLICY "Users can delete invoices" ON public.invoices
  FOR DELETE USING (true);

-- ========================================
-- 3. AGREGAR CAMPOS NECESARIOS PARA HOLDED
-- ========================================

-- Verificar que la tabla invoices tiene los campos necesarios para Holded
SELECT 'Agregando campos necesarios para Holded...' as status;
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS holded_id TEXT,
ADD COLUMN IF NOT EXISTS holded_contact_id TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'invoice';

-- Crear índices para mejorar rendimiento
SELECT 'Creando índices para mejor rendimiento...' as status;
CREATE INDEX IF NOT EXISTS idx_invoices_holded_id ON public.invoices(holded_id);
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON public.invoices(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_upload_id ON public.invoices(upload_id);

-- ========================================
-- 4. VERIFICACIÓN FINAL
-- ========================================

-- Verificar políticas finales de excel_uploads
SELECT 'Verificando políticas finales de excel_uploads...' as status;
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

-- Verificar políticas finales de invoices
SELECT 'Verificando políticas finales de invoices...' as status;
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
WHERE tablename = 'invoices'
ORDER BY policyname;

-- Verificar estructura de invoices
SELECT 'Verificando estructura final de invoices...' as status;
SELECT 
  'invoices' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

SELECT '¡Script completado exitosamente!' as status; 