-- Script para corregir las políticas RLS de la tabla invoices
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de la tabla invoices
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar las políticas RLS actuales
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'invoices' 
AND schemaname = 'public'
ORDER BY policyname;

-- 3. Eliminar políticas problemáticas
DROP POLICY IF EXISTS "Users can view invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can delete invoices from own uploads" ON public.invoices;

-- 4. Crear políticas RLS corregidas para invoices
-- Política para SELECT (ver facturas)
CREATE POLICY "Users can view invoices from own uploads" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- Política para INSERT (insertar facturas)
CREATE POLICY "Users can insert invoices for own uploads" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- Política para UPDATE (actualizar facturas)
CREATE POLICY "Users can update invoices from own uploads" ON public.invoices
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- Política para DELETE (eliminar facturas)
CREATE POLICY "Users can delete invoices from own uploads" ON public.invoices
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = invoices.upload_id 
      AND uploaded_by = auth.uid()
    )
  );

-- 5. Verificar que RLS está habilitado
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- 6. Verificar las políticas creadas
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'invoices' 
AND schemaname = 'public'
ORDER BY policyname;

-- 7. Probar la política con una consulta de ejemplo
-- (Esto ayudará a verificar que las políticas funcionan correctamente)
SELECT 
  'Testing RLS policies' as test,
  COUNT(*) as total_invoices,
  COUNT(DISTINCT upload_id) as unique_uploads
FROM public.invoices 
WHERE EXISTS (
  SELECT 1 FROM public.excel_uploads 
  WHERE id = invoices.upload_id 
  AND uploaded_by = auth.uid()
); 