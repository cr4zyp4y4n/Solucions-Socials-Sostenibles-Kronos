-- Script para corregir el problema del email en user_profiles
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Agregar campo email a la tabla user_profiles
ALTER TABLE public.user_profiles 
ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. Actualizar la función del trigger para incluir el email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, role, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'user'),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Recrear el trigger (por si acaso)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4. Rellenar emails faltantes en registros existentes
UPDATE public.user_profiles 
SET email = auth.users.email 
FROM auth.users 
WHERE user_profiles.id = auth.users.id 
AND user_profiles.email IS NULL;

-- 5. Verificar que se aplicaron los cambios
SELECT 
  'user_profiles' as table_name,
  column_name,
  data_type
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
AND table_schema = 'public'
ORDER BY ordinal_position; 