-- Script simple para permitir que administradores vean todos los usuarios
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar políticas existentes que limitan el acceso
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- 2. Crear políticas más permisivas para administradores
-- Política para SELECT: usuarios ven su perfil, admins ven todos
CREATE POLICY "Users can view own profile, admins can view all" ON public.user_profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para UPDATE: usuarios actualizan su perfil, admins actualizan cualquier perfil
CREATE POLICY "Users can update own profile, admins can update all" ON public.user_profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para INSERT: usuarios insertan su perfil, admins pueden insertar cualquier perfil
CREATE POLICY "Users can insert own profile, admins can insert any" ON public.user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para DELETE: solo admins pueden eliminar
CREATE POLICY "Only admins can delete profiles" ON public.user_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Verificar que las políticas se crearon
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles'
ORDER BY policyname;

-- 4. Probar que funciona (ejecutar como admin)
-- SELECT * FROM public.user_profiles; 