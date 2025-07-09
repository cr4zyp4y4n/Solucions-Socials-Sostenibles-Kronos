-- Script para corregir políticas RLS con recursión infinita
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar todas las políticas problemáticas
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.user_profiles;

DROP POLICY IF EXISTS "Users can view own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Users can insert own uploads" ON public.excel_uploads;
DROP POLICY IF EXISTS "Admins can view all uploads" ON public.excel_uploads;

DROP POLICY IF EXISTS "Users can view invoices from own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for own uploads" ON public.invoices;
DROP POLICY IF EXISTS "Admins can view all invoices" ON public.invoices;

DROP POLICY IF EXISTS "All authenticated users can view providers" ON public.providers;
DROP POLICY IF EXISTS "Admins can manage providers" ON public.providers;

DROP POLICY IF EXISTS "All authenticated users can view analytics" ON public.analytics;
DROP POLICY IF EXISTS "Admins can manage analytics" ON public.analytics;

-- 2. Crear políticas simples sin recursión
-- Políticas para user_profiles
CREATE POLICY "Users can view own profile" ON public.user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Políticas para excel_uploads
CREATE POLICY "Users can view own uploads" ON public.excel_uploads
  FOR SELECT USING (auth.uid() = uploaded_by);

CREATE POLICY "Users can insert own uploads" ON public.excel_uploads
  FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- Políticas para invoices
CREATE POLICY "Users can view invoices from own uploads" ON public.invoices
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

CREATE POLICY "Users can insert invoices for own uploads" ON public.invoices
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.excel_uploads 
      WHERE id = upload_id AND uploaded_by = auth.uid()
    )
  );

-- Políticas para providers
CREATE POLICY "All authenticated users can view providers" ON public.providers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Políticas para analytics
CREATE POLICY "All authenticated users can view analytics" ON public.analytics
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' 
ORDER BY tablename, policyname; 