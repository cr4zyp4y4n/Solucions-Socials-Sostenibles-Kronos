-- Función completa de eliminación en cascada
-- Incluye todas las tablas que referencian usuarios

CREATE OR REPLACE FUNCTION complete_delete_user_cascade(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    audit_logs_deleted INTEGER;
    notifications_deleted INTEGER;
    excel_uploads_deleted INTEGER;
BEGIN
    -- Obtener email del usuario antes de eliminar
    SELECT email INTO user_email 
    FROM user_profiles 
    WHERE id = user_id;
    
    IF user_email IS NULL THEN
        RAISE NOTICE 'Usuario no encontrado en user_profiles, intentando eliminación directa';
    END IF;
    
    RAISE NOTICE 'Iniciando eliminación completa en cascada para usuario: % (email: %)', user_id, user_email;
    
    -- 1. Eliminar registros de audit_logs
    DELETE FROM audit_logs WHERE user_id = user_id;
    GET DIAGNOSTICS audit_logs_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % registros de audit_logs', audit_logs_deleted;
    
    -- 2. Eliminar notificaciones donde es sender
    DELETE FROM notifications WHERE sender_id = user_id;
    GET DIAGNOSTICS notifications_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminadas % notificaciones como sender', notifications_deleted;
    
    -- 3. Eliminar archivos Excel del usuario
    DELETE FROM excel_uploads WHERE uploaded_by = user_id;
    GET DIAGNOSTICS excel_uploads_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % archivos Excel', excel_uploads_deleted;
    
    -- 4. Eliminar de user_profiles (si existe)
    DELETE FROM user_profiles WHERE id = user_id;
    RAISE NOTICE 'Usuario eliminado de user_profiles';
    
    -- 5. Finalmente eliminar de auth.users
    DELETE FROM auth.users WHERE id = user_id;
    RAISE NOTICE 'Usuario eliminado de auth.users';
    
    RAISE NOTICE 'Eliminación completa en cascada completada exitosamente para usuario: %', user_id;
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error durante eliminación en cascada: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Función para eliminar todos los usuarios fantasma con eliminación completa
CREATE OR REPLACE FUNCTION force_delete_all_ghost_users_complete()
RETURNS TABLE(deleted_count INTEGER, deleted_users JSON)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ghost_user RECORD;
    deleted_ids UUID[] := '{}';
    deleted_count INTEGER := 0;
    success BOOLEAN;
BEGIN
    -- Eliminar todos los usuarios fantasma restantes
    FOR ghost_user IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        -- Usar la función de eliminación completa en cascada
        success := complete_delete_user_cascade(ghost_user.id);
        
        IF success THEN
            deleted_ids := array_append(deleted_ids, ghost_user.id);
            deleted_count := deleted_count + 1;
            RAISE NOTICE 'Usuario fantasma eliminado exitosamente: % (email: %)', ghost_user.id, ghost_user.email;
        ELSE
            RAISE NOTICE 'Error eliminando usuario fantasma: % (email: %)', ghost_user.id, ghost_user.email;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT deleted_count, to_json(deleted_ids);
END;
$$;

-- Función para listar todas las referencias de usuarios fantasma (actualizada)
CREATE OR REPLACE FUNCTION list_all_ghost_references_complete()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    created_at TIMESTAMPTZ,
    audit_logs_count BIGINT,
    notifications_sender_count BIGINT,
    excel_uploads_count BIGINT,
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
        COUNT(DISTINCT eu.id) as excel_uploads_count,
        COUNT(DISTINCT al.id) + COUNT(DISTINCT n.id) + COUNT(DISTINCT eu.id) as total_references
    FROM auth.users au
    LEFT JOIN user_profiles up ON au.id = up.id
    LEFT JOIN audit_logs al ON au.id = al.user_id
    LEFT JOIN notifications n ON au.id = n.sender_id
    LEFT JOIN excel_uploads eu ON au.id = eu.uploaded_by
    WHERE up.id IS NULL
    GROUP BY au.id, au.email, au.created_at
    ORDER BY au.created_at DESC;
END;
$$;

-- Comandos de uso:

-- 1. Ver todas las referencias de usuarios fantasma:
-- SELECT * FROM list_all_ghost_references_complete();

-- 2. Eliminar todos los usuarios fantasma con eliminación completa:
-- SELECT * FROM force_delete_all_ghost_users_complete();

-- 3. Eliminar un usuario específico con eliminación completa:
-- SELECT complete_delete_user_cascade('user-id-aqui');

-- 4. Verificar que no quedan usuarios fantasma:
-- SELECT COUNT(*) as usuarios_fantasma_restantes
-- FROM auth.users au
-- LEFT JOIN user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL; 