-- Agregar campo onboarding_completed a la tabla user_profiles
-- Este campo se usa para determinar si un usuario nuevo debe ver el onboarding

-- Agregar la columna onboarding_completed
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;

-- Actualizar registros existentes para que no vean el onboarding
UPDATE user_profiles 
SET onboarding_completed = TRUE 
WHERE onboarding_completed IS NULL;

-- Crear índice para mejorar el rendimiento de consultas
CREATE INDEX IF NOT EXISTS idx_user_profiles_onboarding 
ON user_profiles(onboarding_completed);

-- Comentario sobre el uso del campo
COMMENT ON COLUMN user_profiles.onboarding_completed IS 
'Indica si el usuario ha completado el onboarding. FALSE = usuario nuevo que debe ver onboarding, TRUE = usuario que ya vio el onboarding'; 