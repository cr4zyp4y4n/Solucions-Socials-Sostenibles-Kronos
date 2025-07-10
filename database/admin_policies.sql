-- Script para agregar políticas RLS para administradores
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar políticas existentes de user_profiles (si existen)
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- 2. Crear nuevas políticas que permitan a administradores ver todos los usuarios
-- Política para ver perfiles (usuarios ven su propio perfil, admins ven todos)
CREATE POLICY "Users can view own profile, admins can view all" ON public.user_profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para actualizar perfiles (usuarios actualizan su propio perfil, admins actualizan cualquier perfil)
CREATE POLICY "Users can update own profile, admins can update all" ON public.user_profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para insertar perfiles (usuarios insertan su propio perfil, admins pueden insertar cualquier perfil)
CREATE POLICY "Users can insert own profile, admins can insert any" ON public.user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para eliminar perfiles (solo admins pueden eliminar)
CREATE POLICY "Only admins can delete profiles" ON public.user_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Verificar que las políticas se crearon correctamente
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual 
FROM pg_policies 
WHERE schemaname = 'public' AND tablename = 'user_profiles'
ORDER BY policyname;

-- 4. Crear función para que los administradores puedan obtener todos los usuarios
CREATE OR REPLACE FUNCTION get_all_users_for_admin(admin_user_id UUID)
RETURNS TABLE (
  id UUID,
  name TEXT,
  role TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verificar que el usuario que llama es administrador
  IF NOT EXISTS (
    SELECT 1 FROM public.user_profiles 
    WHERE id = admin_user_id AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Access denied: Only administrators can view all users';
  END IF;
  
  -- Retornar todos los usuarios
  RETURN QUERY
  SELECT 
    up.id,
    up.name,
    up.role,
    up.created_at,
    up.updated_at
  FROM public.user_profiles up
  ORDER BY up.created_at DESC;
END;
$$;

-- 5. Probar las políticas (opcional - para verificar)
-- SELECT * FROM public.user_profiles LIMIT 5; 