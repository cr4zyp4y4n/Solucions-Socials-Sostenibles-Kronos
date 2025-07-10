-- Script para arreglar la recursión infinita en las políticas RLS
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar todas las políticas problemáticas
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile, admins can insert any" ON public.user_profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.user_profiles;

-- 2. Crear políticas simples sin recursión
-- Política para SELECT: todos los usuarios autenticados pueden ver todos los perfiles
CREATE POLICY "All authenticated users can view profiles" ON public.user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política para UPDATE: usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Política para INSERT: usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para DELETE: solo el propio usuario puede eliminar su perfil
CREATE POLICY "Users can delete own profile" ON public.user_profiles
  FOR DELETE USING (auth.uid() = id);

-- 3. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles'
ORDER BY policyname; 