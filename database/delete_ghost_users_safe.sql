-- Función para eliminar usuarios fantasma de forma segura
-- Corrige las referencias en audit_logs y notifications

CREATE OR REPLACE FUNCTION delete_ghost_users_safe()
RETURNS TABLE(deleted_count INTEGER, deleted_users JSON)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    ghost_user RECORD;
    deleted_ids UUID[] := '{}';
    deleted_count INTEGER := 0;
    audit_logs_deleted INTEGER;
    notifications_deleted INTEGER;
BEGIN
    -- Eliminar usuarios fantasma y sus registros relacionados
    FOR ghost_user IN 
        SELECT au.id, au.email
        FROM auth.users au
        LEFT JOIN user_profiles up ON au.id = up.id
        WHERE up.id IS NULL
    LOOP
        -- 1. Eliminar registros de audit_logs primero
        DELETE FROM audit_logs WHERE user_id = ghost_user.id;
        GET DIAGNOSTICS audit_logs_deleted = ROW_COUNT;
        
        -- 2. Eliminar registros de notifications (usando sender_id)
        DELETE FROM notifications WHERE sender_id = ghost_user.id;
        GET DIAGNOSTICS notifications_deleted = ROW_COUNT;
        
        -- 3. Eliminar cualquier otra referencia si existe
        -- (Agregar aquí otras tablas que puedan referenciar auth.users)
        
        -- 4. Finalmente eliminar el usuario
        DELETE FROM auth.users WHERE id = ghost_user.id;
        
        deleted_ids := array_append(deleted_ids, ghost_user.id);
        deleted_count := deleted_count + 1;
        
        RAISE NOTICE 'Eliminado usuario: % (email: %), audit_logs eliminados: %, notifications eliminados: %', 
            ghost_user.id, ghost_user.email, audit_logs_deleted, notifications_deleted;
    END LOOP;
    
    RETURN QUERY SELECT deleted_count, to_json(deleted_ids);
END;
$$;

-- Función para listar detalles de usuarios fantasma antes de eliminar
CREATE OR REPLACE FUNCTION list_ghost_users_details()
RETURNS TABLE(
    user_id UUID,
    email TEXT,
    created_at TIMESTAMPTZ,
    audit_logs_count BIGINT,
    notifications_count BIGINT
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
        COUNT(al.id) as audit_logs_count,
        COUNT(n.id) as notifications_count
    FROM auth.users au
    LEFT JOIN user_profiles up ON au.id = up.id
    LEFT JOIN audit_logs al ON au.id = al.user_id
    LEFT JOIN notifications n ON au.id = n.sender_id
    WHERE up.id IS NULL
    GROUP BY au.id, au.email, au.created_at
    ORDER BY au.created_at DESC;
END;
$$;

-- Comandos para ejecutar:

-- 1. Primero ver qué se va a eliminar:
-- SELECT * FROM list_ghost_users_details();

-- 2. Luego ejecutar la eliminación:
-- SELECT * FROM delete_ghost_users_safe();

-- 3. Verificar que se eliminaron:
-- SELECT COUNT(*) as usuarios_fantasma_restantes
-- FROM auth.users au
-- LEFT JOIN user_profiles up ON au.id = up.id
-- WHERE up.id IS NULL; 