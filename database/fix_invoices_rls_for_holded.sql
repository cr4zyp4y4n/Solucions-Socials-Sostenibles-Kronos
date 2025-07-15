-- Script para corregir las políticas RLS de invoices para permitir sincronización de Holded
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar las políticas actuales de invoices
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

-- 2. Verificar la estructura de la tabla invoices
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 3. Asegurar que la tabla invoices tiene RLS habilitado
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 4. Eliminar políticas existentes para invoices (si las hay)
DROP POLICY IF EXISTS "Users can view own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can update own invoices" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete own invoices" ON public.invoices;

-- 5. Crear nuevas políticas para invoices
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

-- 6. Verificar que las políticas se crearon correctamente
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

-- 7. Verificar que la tabla invoices tiene los campos necesarios para Holded
-- Si no existe el campo holded_id, agregarlo
ALTER TABLE public.invoices 
ADD COLUMN IF NOT EXISTS holded_id TEXT,
ADD COLUMN IF NOT EXISTS holded_contact_id TEXT,
ADD COLUMN IF NOT EXISTS document_type TEXT DEFAULT 'invoice';

-- 8. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_invoices_holded_id ON public.invoices(holded_id);
CREATE INDEX IF NOT EXISTS idx_invoices_document_type ON public.invoices(document_type);
CREATE INDEX IF NOT EXISTS idx_invoices_upload_id ON public.invoices(upload_id);

-- 9. Verificar la estructura final
SELECT 
  'invoices' as table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position; 