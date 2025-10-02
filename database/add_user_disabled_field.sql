-- Agregar campo 'disabled' a la tabla user_profiles para permitir activar/desactivar usuarios

-- Agregar la columna si no existe
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS disabled BOOLEAN DEFAULT FALSE;

-- Agregar comentario a la columna
COMMENT ON COLUMN user_profiles.disabled IS 'Indica si el usuario está desactivado/bloqueado';

-- Crear índice para búsquedas rápidas de usuarios activos
CREATE INDEX IF NOT EXISTS idx_user_profiles_disabled ON user_profiles(disabled);

-- Política de seguridad: Los usuarios no pueden ver usuarios desactivados (excepto admins)
-- Primero eliminamos la política antigua si existe
DROP POLICY IF EXISTS "Users can view their own profile and admins can view all" ON user_profiles;

-- Creamos nueva política que permite:
-- 1. A los usuarios ver su propio perfil (aunque esté desactivado)
-- 2. A los admins ver todos los perfiles
CREATE POLICY "Users can view profiles based on role and status" ON user_profiles
  FOR SELECT
  USING (
    auth.uid() = id 
    OR 
    (
      EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = auth.uid() 
        AND role = 'admin'
      )
    )
  );

-- Política para actualizar: solo admins pueden cambiar el estado disabled
DROP POLICY IF EXISTS "Only admins can update user profiles" ON user_profiles;

CREATE POLICY "Admins can update all profiles, users can update own (except disabled)" ON user_profiles
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR
    (auth.uid() = id AND NOT disabled)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
    OR
    (auth.uid() = id AND NOT disabled)
  );

