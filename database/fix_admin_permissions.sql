-- ARREGLO URGENTE: Restaurar permisos de administrador
-- Este script arregla el problema de las políticas RLS

-- 1. Agregar el campo disabled si no existe (sin tocar políticas)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

-- 2. Crear índice
CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled ON user_profiles(disabled);

-- 3. ELIMINAR TODAS las políticas conflictivas
DROP POLICY IF EXISTS "Users can view profiles based on role and status" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles, users can update own (except disabled)" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update user profiles" ON user_profiles;

-- 4. RECREAR las políticas correctas que permiten a admins hacer TODO

-- Política SELECT: Admins ven TODO, usuarios solo su perfil
CREATE POLICY "user_profiles_select_policy" ON user_profiles
  FOR SELECT
  USING (
    -- Eres tú mismo
    auth.uid() = id 
    OR 
    -- O eres admin (verificar en la propia tabla)
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política UPDATE: Admins actualizan TODO, usuarios solo lo suyo (si no están disabled)
CREATE POLICY "user_profiles_update_policy" ON user_profiles
  FOR UPDATE
  USING (
    -- Eres admin
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR
    -- O eres tú mismo y no estás desactivado
    (auth.uid() = id AND (disabled IS NULL OR disabled = FALSE))
  )
  WITH CHECK (
    -- Eres admin
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR
    -- O eres tú mismo y no estás desactivado
    (auth.uid() = id AND (disabled IS NULL OR disabled = FALSE))
  );

-- Política INSERT: Solo para nuevos registros (signup)
CREATE POLICY "user_profiles_insert_policy" ON user_profiles
  FOR INSERT
  WITH CHECK (
    -- Puedes insertar tu propio perfil
    auth.uid() = id
    OR
    -- O eres admin
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Política DELETE: Solo admins
CREATE POLICY "user_profiles_delete_policy" ON user_profiles
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );



