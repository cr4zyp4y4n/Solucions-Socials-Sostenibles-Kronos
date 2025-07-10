-- Políticas RLS finales para gestión de usuarios por administradores
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar todas las políticas existentes
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can delete own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "All authenticated users can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile, admins can insert any" ON public.user_profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON public.user_profiles;

-- 2. Crear políticas simples y efectivas
-- Política para SELECT: todos los usuarios autenticados pueden ver todos los perfiles
CREATE POLICY "All authenticated users can view profiles" ON public.user_profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Política para UPDATE: usuarios pueden actualizar su propio perfil
CREATE POLICY "Users can update own profile" ON public.user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- Política para INSERT: usuarios pueden insertar su propio perfil
CREATE POLICY "Users can insert own profile" ON public.user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Política para DELETE: usuarios pueden eliminar su propio perfil
CREATE POLICY "Users can delete own profile" ON public.user_profiles
  FOR DELETE USING (auth.uid() = id);

-- 3. Crear función para verificar si un usuario es administrador
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = user_id AND role = 'admin'
  );
END;
$$;

-- 4. Crear políticas especiales para administradores usando la función
-- Política para UPDATE: administradores pueden actualizar cualquier perfil
CREATE POLICY "Admins can update any profile" ON public.user_profiles
  FOR UPDATE USING (is_admin(auth.uid()));

-- Política para DELETE: solo administradores pueden eliminar perfiles
CREATE POLICY "Only admins can delete profiles" ON public.user_profiles
  FOR DELETE USING (is_admin(auth.uid()));

-- 5. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles'
ORDER BY policyname;

-- 6. Probar la función (opcional)
-- SELECT is_admin('tu-user-id-aqui'); 