-- Diagnóstico de usuarios fantasma restantes
-- Este script ayuda a identificar por qué algunos usuarios no se eliminaron

-- 1. Ver todos los usuarios fantasma restantes con detalles
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.last_sign_in_at,
    au.confirmed_at,
    au.email_confirmed_at,
    au.phone_confirmed_at,
    au.banned_until,
    au.recovery_sent_at,
    au.email_change_confirm_status,
    au.aud,
    au.role,
    au.updated_at,
    'FANTASMA' as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ORDER BY au.created_at DESC;

-- 2. Verificar si hay algún patrón en los usuarios fantasma
SELECT 
    COUNT(*) as total_fantasma,
    COUNT(CASE WHEN confirmed_at IS NULL THEN 1 END) as no_confirmados,
    COUNT(CASE WHEN confirmed_at IS NOT NULL THEN 1 END) as confirmados,
    COUNT(CASE WHEN email_confirmed_at IS NULL THEN 1 END) as email_no_confirmado,
    COUNT(CASE WHEN email_confirmed_at IS NOT NULL THEN 1 END) as email_confirmado,
    COUNT(CASE WHEN banned_until IS NOT NULL THEN 1 END) as baneados,
    COUNT(CASE WHEN role != 'authenticated' THEN 1 END) as roles_especiales
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;

-- 3. Verificar si hay usuarios con roles especiales
SELECT 
    au.id,
    au.email,
    au.role,
    au.aud,
    au.created_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL
ORDER BY au.role, au.created_at DESC;

-- 4. Verificar usuarios que nunca se confirmaron
SELECT 
    au.id,
    au.email,
    au.created_at,
    au.confirmed_at,
    au.email_confirmed_at,
    'NO_CONFIRMADO' as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL 
    AND (au.confirmed_at IS NULL OR au.email_confirmed_at IS NULL)
ORDER BY au.created_at DESC;

-- 5. Verificar usuarios baneados o con estados especiales
SELECT 
    au.id,
    au.email,
    au.banned_until,
    au.recovery_sent_at,
    au.email_change_confirm_status,
    'ESTADO_ESPECIAL' as status
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL 
    AND (au.banned_until IS NOT NULL 
         OR au.recovery_sent_at IS NOT NULL 
         OR au.email_change_confirm_status IS NOT NULL)
ORDER BY au.created_at DESC;

-- 6. Función para eliminar usuarios fantasma específicos
CREATE OR REPLACE FUNCTION force_delete_ghost_user(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Eliminar directamente de auth.users sin verificar referencias
    DELETE FROM auth.users WHERE id = user_id;
    
    IF FOUND THEN
        RAISE NOTICE 'Usuario fantasma eliminado forzadamente: %', user_id;
        RETURN TRUE;
    ELSE
        RAISE NOTICE 'Usuario no encontrado: %', user_id;
        RETURN FALSE;
    END IF;
END;
$$;

-- 7. Función para eliminar todos los usuarios fantasma restantes
CREATE OR REPLACE FUNCTION force_delete_all_ghost_users()
RETURNS TABLE(deleted_count INTEGER, deleted_users JSON)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ghost_user RECORD;
    deleted_ids UUID[] := '{}';
    deleted_count INTEGER := 0;
BEGIN
    -- Eliminar todos los usuarios fantasma restantes
    FOR ghost_user IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        -- Eliminar directamente sin verificar referencias
        DELETE FROM auth.users WHERE id = ghost_user.id;
        
        IF FOUND THEN
            deleted_ids := array_append(deleted_ids, ghost_user.id);
            deleted_count := deleted_count + 1;
            RAISE NOTICE 'Usuario fantasma eliminado forzadamente: % (email: %)', ghost_user.id, ghost_user.email;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT deleted_count, to_json(deleted_ids);
END;
$$;

-- Comandos para usar:

-- Ver todos los usuarios fantasma:
-- SELECT * FROM (SELECT 1) as dummy;

-- Eliminar un usuario fantasma específico:
-- SELECT force_delete_ghost_user('user-id-aqui');

-- Eliminar todos los usuarios fantasma restantes:
-- SELECT * FROM force_delete_all_ghost_users();

-- Verificar que se eliminaron:
-- SELECT COUNT(*) as usuarios_fantasma_restantes
-- FROM auth.users au
-- LEFT JOIN user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL; 