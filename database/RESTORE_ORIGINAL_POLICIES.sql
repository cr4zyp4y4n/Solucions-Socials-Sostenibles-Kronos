-- ⚠️ RESTAURAR POLÍTICAS ORIGINALES QUE FUNCIONABAN
-- Este script elimina las políticas rotas y restaura las originales

-- 1. ELIMINAR TODAS las políticas que puedan estar causando problemas
DROP POLICY IF EXISTS "Users can view profiles based on role and status" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update all profiles, users can update own (except disabled)" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON user_profiles;
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can update user profiles" ON user_profiles;

-- 2. RECREAR las políticas originales (solo si no existen)

-- Eliminar políticas originales por si acaso
DROP POLICY IF EXISTS "Users can view own profile, admins can view all" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile, admins can update all" ON user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile, admins can insert any" ON user_profiles;
DROP POLICY IF EXISTS "Only admins can delete profiles" ON user_profiles;

-- Ahora sí, crear las políticas frescas
-- Política para SELECT: usuarios ven su perfil, admins ven todos
CREATE POLICY "Users can view own profile, admins can view all" ON user_profiles
  FOR SELECT USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para UPDATE: usuarios actualizan su perfil, admins actualizan cualquier perfil
CREATE POLICY "Users can update own profile, admins can update all" ON user_profiles
  FOR UPDATE USING (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para INSERT: usuarios insertan su perfil, admins pueden insertar cualquier perfil
CREATE POLICY "Users can insert own profile, admins can insert any" ON user_profiles
  FOR INSERT WITH CHECK (
    auth.uid() = id OR 
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Política para DELETE: solo admins pueden eliminar
CREATE POLICY "Only admins can delete profiles" ON user_profiles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 3. Agregar el campo disabled (sin afectar las políticas)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

-- 4. Crear índice para el campo disabled
CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled ON user_profiles(disabled);

-- ✅ LISTO: Políticas restauradas a como estaban antes
