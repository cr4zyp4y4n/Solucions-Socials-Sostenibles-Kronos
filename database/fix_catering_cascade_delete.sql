-- Actualización de la función de eliminación en cascada para incluir catering_events
-- Ejecutar este archivo para corregir el error de eliminación de usuarios

CREATE OR REPLACE FUNCTION complete_delete_user_cascade(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    audit_logs_deleted INTEGER;
    notifications_deleted INTEGER;
    excel_uploads_deleted INTEGER;
    catering_events_deleted INTEGER;
BEGIN
    -- Obtener email del usuario antes de eliminar
    SELECT email INTO user_email 
    FROM user_profiles 
    WHERE id = target_user_id;
    
    IF user_email IS NULL THEN
        RAISE NOTICE 'Usuario no encontrado en user_profiles, intentando eliminación directa';
    END IF;
    
    RAISE NOTICE 'Iniciando eliminación completa en cascada para usuario: % (email: %)', target_user_id, user_email;
    
    -- 1. Eliminar registros de audit_logs
    DELETE FROM audit_logs WHERE user_id = target_user_id;
    GET DIAGNOSTICS audit_logs_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % registros de audit_logs', audit_logs_deleted;
    
    -- 2. Eliminar notificaciones donde es sender
    DELETE FROM notifications WHERE sender_id = target_user_id;
    GET DIAGNOSTICS notifications_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminadas % notificaciones como sender', notifications_deleted;
    
    -- 3. Eliminar archivos Excel del usuario
    DELETE FROM excel_uploads WHERE uploaded_by = target_user_id;
    GET DIAGNOSTICS excel_uploads_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % archivos Excel', excel_uploads_deleted;
    
    -- 4. Eliminar registros de catering relacionados con el usuario
    -- Eliminar eventos de catering creados por el usuario
    DELETE FROM catering_events WHERE created_by = target_user_id OR updated_by = target_user_id;
    GET DIAGNOSTICS catering_events_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % eventos de catering', catering_events_deleted;
    
    -- Eliminar presupuestos de catering creados por el usuario
    DELETE FROM catering_budgets WHERE created_by = target_user_id OR updated_by = target_user_id;
    RAISE NOTICE 'Eliminados presupuestos de catering del usuario';
    
    -- Eliminar personal de catering asignado por el usuario
    DELETE FROM catering_staff WHERE created_by = target_user_id;
    RAISE NOTICE 'Eliminado personal de catering asignado por el usuario';
    
    -- Eliminar pedidos de catering creados por el usuario
    DELETE FROM catering_orders WHERE created_by = target_user_id OR updated_by = target_user_id;
    RAISE NOTICE 'Eliminados pedidos de catering del usuario';
    
    -- Eliminar rutas de catering creadas por el usuario
    DELETE FROM catering_routes WHERE created_by = target_user_id OR updated_by = target_user_id;
    RAISE NOTICE 'Eliminadas rutas de catering del usuario';
    
    -- 5. Eliminar de user_profiles (si existe)
    DELETE FROM user_profiles WHERE id = target_user_id;
    RAISE NOTICE 'Usuario eliminado de user_profiles';
    
    -- 6. Finalmente eliminar de auth.users
    DELETE FROM auth.users WHERE id = target_user_id;
    RAISE NOTICE 'Usuario eliminado de auth.users';
    
    RAISE NOTICE 'Eliminación completa en cascada completada exitosamente para usuario: %', target_user_id;
    RETURN TRUE;
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE EXCEPTION 'Error durante eliminación en cascada: %', SQLERRM;
        RETURN FALSE;
END;
$$;

-- Verificar que la función se creó correctamente
SELECT 'Función complete_delete_user_cascade actualizada correctamente' as status; 