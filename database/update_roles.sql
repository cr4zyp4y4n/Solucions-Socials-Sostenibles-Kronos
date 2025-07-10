-- Script para actualizar roles y agregar el nuevo rol 'management'
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Actualizar la constraint de la tabla user_profiles para incluir 'management'
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles ADD CONSTRAINT user_profiles_role_check 
  CHECK (role IN ('user', 'manager', 'management', 'admin'));

-- 2. Verificar que la tabla se actualizó correctamente
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'user_profiles' AND column_name = 'role';

-- 3. Mostrar los roles actuales en la base de datos
SELECT DISTINCT role, COUNT(*) as count 
FROM public.user_profiles 
GROUP BY role 
ORDER BY role;

-- 4. Opcional: Actualizar usuarios existentes si es necesario
-- Por ejemplo, si quieres convertir algunos usuarios a 'management':
-- UPDATE public.user_profiles SET role = 'management' WHERE role = 'manager' AND name LIKE '%gestión%';

-- 5. Verificar que todo funciona correctamente
SELECT id, name, role, created_at 
FROM public.user_profiles 
ORDER BY created_at DESC 
LIMIT 10; 