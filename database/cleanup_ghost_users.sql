-- Script para limpiar usuarios fantasma en auth.users
-- Este script identifica y lista usuarios que están en auth.users pero no en user_profiles

-- IMPORTANTE: Este script solo LISTA los usuarios fantasma
-- Para eliminarlos, necesitas usar el dashboard de Supabase o funciones RPC

-- 1. Verificar usuarios fantasma (usuarios en auth.users que no están en user_profiles)
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    'FANTASMA' as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ORDER BY au.created_at DESC;

-- 2. Contar usuarios fantasma
SELECT 
    COUNT(*) as usuarios_fantasma
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

-- 3. Verificar usuarios válidos (que existen en ambas tablas)
SELECT 
    au.id,
    au.email,
    au.created_at,
    up.role,
    'VÁLIDO' as status
FROM auth.users au
INNER JOIN user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC;

-- 4. Contar usuarios válidos
SELECT 
    COUNT(*) as usuarios_validos
FROM auth.users au
INNER JOIN user_profiles up ON au.id = up.id;

-- NOTA: Para eliminar usuarios fantasma, puedes:
-- 1. Usar el dashboard de Supabase (Authentication > Users)
-- 2. Crear una función RPC con permisos de admin
-- 3. Usar la API de Supabase con service_role key

-- Ejemplo de función RPC para eliminar usuario (requiere configuración adicional):
/*
CREATE OR REPLACE FUNCTION delete_ghost_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM auth.users WHERE id = user_id;
END;
$$;
*/ 