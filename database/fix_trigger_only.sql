-- Script para corregir solo el trigger del email
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Actualizar la función del trigger para incluir el email
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

-- 2. Recrear el trigger para asegurar que se actualiza
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Rellenar emails faltantes en registros existentes (solo si es necesario)
UPDATE public.user_profiles 
SET email = auth.users.email 
FROM auth.users 
WHERE user_profiles.id = auth.users.id 
AND user_profiles.email IS NULL;

-- 4. Verificar que el trigger está funcionando
SELECT 
  trigger_name,
  event_manipulation,
  action_statement
FROM information_schema.triggers 
WHERE trigger_name = 'on_auth_user_created'; 