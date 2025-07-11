-- Eliminar función antigua si existe
DROP FUNCTION IF EXISTS complete_delete_user_cascade(uuid);

-- Crear función completa y corregida para eliminación en cascada
CREATE OR REPLACE FUNCTION complete_delete_user_cascade(target_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_email TEXT;
    audit_logs_deleted INTEGER;
    notifications_sender_deleted INTEGER;
    notifications_recipient_deleted INTEGER;
    excel_uploads_deleted INTEGER;
    invoices_deleted INTEGER;
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
    GET DIAGNOSTICS notifications_sender_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminadas % notificaciones como sender', notifications_sender_deleted;

    -- 3. Eliminar notificaciones donde es recipient
    DELETE FROM notifications WHERE recipient_id = target_user_id;
    GET DIAGNOSTICS notifications_recipient_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminadas % notificaciones como recipient', notifications_recipient_deleted;
    
    -- 4. Eliminar archivos Excel del usuario
    DELETE FROM excel_uploads WHERE uploaded_by = target_user_id;
    GET DIAGNOSTICS excel_uploads_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminados % archivos Excel', excel_uploads_deleted;

    -- 5. Eliminar facturas creadas por el usuario
    DELETE FROM invoices WHERE created_by = target_user_id;
    GET DIAGNOSTICS invoices_deleted = ROW_COUNT;
    RAISE NOTICE 'Eliminadas % facturas creadas por el usuario', invoices_deleted;
    
    -- 6. Eliminar de user_profiles (si existe)
    DELETE FROM user_profiles WHERE id = target_user_id;
    RAISE NOTICE 'Usuario eliminado de user_profiles';
    
    -- 7. Finalmente eliminar de auth.users
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