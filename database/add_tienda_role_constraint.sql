-- Script para agregar el rol 'tienda' al constraint de la tabla user_profiles
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Eliminar el constraint antiguo
ALTER TABLE public.user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

-- 2. Agregar el nuevo constraint con todos los roles incluyendo 'tienda'
ALTER TABLE public.user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('user', 'tienda', 'manager', 'management', 'admin'));

-- Verificar que el constraint se aplicó correctamente
SELECT conname, pg_get_constraintdef(oid) 
FROM pg_constraint 
WHERE conrelid = 'public.user_profiles'::regclass 
AND conname = 'user_profiles_role_check';
