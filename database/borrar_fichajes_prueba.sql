-- =====================================================
-- Script para borrar fichajes de prueba
-- =====================================================

-- Deshabilitar temporalmente el trigger de auditoría para evitar errores
ALTER TABLE fichajes DISABLE TRIGGER trigger_auditoria_fichajes;

-- Borrar pausas primero (si no se borran automáticamente por CASCADE)
DELETE FROM fichajes_pausas;

-- Borrar auditoría
DELETE FROM fichajes_auditoria;

-- Borrar fichajes
DELETE FROM fichajes;

-- Volver a habilitar el trigger de auditoría
ALTER TABLE fichajes ENABLE TRIGGER trigger_auditoria_fichajes;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE 'Fichajes de prueba borrados correctamente';
END $$;


