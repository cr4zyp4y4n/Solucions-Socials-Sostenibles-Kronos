-- Sistema de Eliminación en Cascada para Usuarios
-- Este sistema elimina automáticamente todas las referencias cuando se elimina un usuario

-- 1. Función principal para eliminar usuario y todas sus referencias
CREATE OR REPLACE FUNCTION delete_user_cascade(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    audit_logs_deleted INTEGER;
    notifications_deleted INTEGER;
    invoices_deleted INTEGER;
    excel_files_deleted INTEGER;
BEGIN
    -- Obtener email del usuario antes de eliminar
    SELECT email INTO user_email 
    FROM user_profiles 
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        RAISE EXCEPTION 'Usuario no encontrado en user_profiles';
        RETURN FALSE;
    END IF;
    
    RAISE NOTICE 'Iniciando eliminación en cascada para usuario: % (email: %)', user_id, user_email;
    
    -- 1. Eliminar registros de audit_logs
    DELETE FROM audit_logs WHERE user_id = user_id;
    GET DIAGNOSTICS audit_logs_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % registros de audit_logs', audit_logs_deleted;
    
    -- 2. Eliminar notificaciones donde es sender
    DELETE FROM notifications WHERE sender_id = user_id;
    GET DIAGNOSTICS notifications_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminadas % notificaciones como sender', notifications_deleted;
    
    -- 3. Eliminar notificaciones donde es recipient (si existe campo recipient_id)
    -- DELETE FROM notifications WHERE recipient_id = user_id;
    
    -- 4. Eliminar facturas del usuario (si existe tabla invoices)
    -- DELETE FROM invoices WHERE user_id = user_id;
    -- GET DIAGNOSTICS invoices_deleted = ROW_COUNT;
    -- RAISE NOTICE 'Eliminadas % facturas', invoices_deleted;
    
    -- 5. Eliminar archivos Excel del usuario (si existe tabla excel_files)
    -- DELETE FROM excel_files WHERE user_id = user_id;
    -- GET DIAGNOSTICS excel_files_deleted = ROW_COUNT;
    -- RAISE NOTICE 'Eliminados % archivos Excel', excel_files_deleted;
    
    -- 6. Eliminar de user_profiles
    DELETE FROM user_profiles WHERE id = user_id;
    RAISE NOTICE 'Usuario eliminado de user_profiles';
    
    -- 7. Finalmente eliminar de auth.users
    DELETE FROM auth.users WHERE id = user_id;
    RAISE NOTICE 'Usuario eliminado de auth.users';
    
    RAISE NOTICE 'Eliminación en cascada completada exitosamente para usuario: %', user_id;
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error durante eliminación en cascada: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- 2. Trigger para eliminar automáticamente cuando se elimina de user_profiles
CREATE OR REPLACE FUNCTION trigger_delete_user_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Si se está eliminando un usuario de user_profiles, eliminar también de auth.users
    IF TG_OP = 'DELETE' THEN
        DELETE FROM auth.users WHERE id = OLD.id;
        RAISE NOTICE 'Usuario eliminado automáticamente de auth.users: %', OLD.id;
    END IF;
    
    RETURN OLD;
END;
$$;

-- Crear el trigger
DROP TRIGGER IF EXISTS trigger_delete_user_cascade ON user_profiles;
CREATE TRIGGER trigger_delete_user_cascade
    AFTER DELETE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION trigger_delete_user_cascade();

-- 3. Función para eliminar usuarios fantasma existentes
CREATE OR REPLACE FUNCTION cleanup_ghost_users()
RETURNS TABLE(deleted_count INTEGER, deleted_users JSON)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ghost_user RECORD;
    deleted_ids UUID[] := '{}';
    deleted_count INTEGER := 0;
BEGIN
    -- Eliminar usuarios fantasma existentes
    FOR ghost_user IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        -- Usar la función de eliminación en cascada
        IF delete_user_cascade(ghost_user.id) THEN
            deleted_ids := array_append(deleted_ids, ghost_user.id);
            deleted_count := deleted_count + 1;
            RAISE NOTICE 'Usuario fantasma eliminado: % (email: %)', ghost_user.id, ghost_user.email;
        ELSE
            RAISE NOTICE 'Error eliminando usuario fantasma: %', ghost_user.id;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT deleted_count, to_json(deleted_ids);
END;
$$;

-- 4. Función para verificar referencias de un usuario
CREATE OR REPLACE FUNCTION check_user_references(user_id UUID)
RETURNS TABLE(
    table_name TEXT,
    reference_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 'audit_logs'::TEXT, COUNT(*)::BIGINT
    FROM audit_logs WHERE user_id = check_user_references.user_id
    UNION ALL
    SELECT 'notifications_sender'::TEXT, COUNT(*)::BIGINT
    FROM notifications WHERE sender_id = check_user_references.user_id
    UNION ALL
    SELECT 'user_profiles'::TEXT, COUNT(*)::BIGINT
    FROM user_profiles WHERE id = check_user_references.user_id
    UNION ALL
    SELECT 'auth_users'::TEXT, COUNT(*)::BIGINT
    FROM auth.users WHERE id = check_user_references.user_id;
END;
$$;

-- 5. Función para listar todas las referencias de usuarios fantasma
CREATE OR REPLACE FUNCTION list_all_ghost_references()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    created_at TIMESTAMPTZ,
    audit_logs_count BIGINT,
    notifications_sender_count BIGINT,
    total_references BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        au.id,
        au.email,
        au.created_at,
        COUNT(DISTINCT al.id) as audit_logs_count,
        COUNT(DISTINCT n.id) as notifications_sender_count,
        COUNT(DISTINCT al.id) + COUNT(DISTINCT n.id) as total_references
    FROM auth.users au
    LEFT JOIN user_profiles up ON au.id = up.id
    LEFT JOIN audit_logs al ON au.id = al.user_id
    LEFT JOIN notifications n ON au.id = n.sender_id
    WHERE up.id IS NULL
    GROUP BY au.id, au.email, au.created_at
    ORDER BY au.created_at DESC;
END;
$$;

-- Comandos de uso:

-- 1. Verificar referencias de un usuario específico:
-- SELECT * FROM check_user_references('user-id-aqui');

-- 2. Listar todos los usuarios fantasma con sus referencias:
-- SELECT * FROM list_all_ghost_references();

-- 3. Limpiar usuarios fantasma existentes:
-- SELECT * FROM cleanup_ghost_users();

-- 4. Eliminar un usuario específico con cascada:
-- SELECT delete_user_cascade('user-id-aqui');

-- 5. Verificar que no quedan usuarios fantasma:
-- SELECT COUNT(*) as usuarios_fantasma_restantes
-- FROM auth.users au
-- LEFT JOIN user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL; 