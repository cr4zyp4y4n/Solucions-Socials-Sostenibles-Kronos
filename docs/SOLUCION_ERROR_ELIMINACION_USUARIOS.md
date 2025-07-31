# Solución: Error al eliminar usuarios con eventos de catering

## Problema
Al intentar eliminar un usuario que tiene eventos de catering o notificaciones asociadas, se producen los siguientes errores:

```
Error al eliminar usuario: Error durante eliminación en cascada: update or delete on table "users" violates foreign key constraint "catering_events_created_by_fkey" on table "catering_events"
```

```
Error al eliminar usuario: Error durante eliminación en cascada: update or delete on table "users" violates foreign key constraint "notifications_recipient_id_fkey" on table "notifications"
```

## Causa
La función `complete_delete_user_cascade` no incluía la eliminación completa de registros en las tablas que referencian usuarios:
- `catering_events`: Restricción de clave foránea que impide eliminar usuarios que han creado eventos de catering
- `notifications`: Restricción de clave foránea que impide eliminar usuarios que son destinatarios de notificaciones

## Solución

### 1. Ejecutar el archivo SQL de actualización
Ejecutar el archivo `database/fix_notifications_cascade_delete.sql` en el SQL Editor de Supabase.

### 2. Verificar la actualización
La función actualizada ahora incluye:
- Eliminación de registros en `audit_logs`
- **MEJORADO**: Eliminación completa de notificaciones:
  - Notificaciones donde el usuario es sender
  - Notificaciones donde el usuario es recipient
- Eliminación de archivos Excel del usuario
- **NUEVO**: Eliminación completa de registros de catering:
  - Eventos de catering (creados o actualizados por el usuario)
  - Presupuestos de catering (creados o actualizados por el usuario)
  - Personal de catering asignado por el usuario
  - Pedidos de catering (creados o actualizados por el usuario)
  - Rutas de catering (creadas o actualizadas por el usuario)
- Eliminación de `user_profiles`
- Eliminación de `auth.users`

### 3. Probar la eliminación
Después de ejecutar el archivo SQL, intentar eliminar el usuario nuevamente desde la interfaz de gestión de usuarios.

## Archivos modificados
- `database/fix_notifications_cascade_delete.sql` - Nueva función de eliminación en cascada (incluye todas las notificaciones)
- `docs/SOLUCION_ERROR_ELIMINACION_USUARIOS.md` - Esta documentación

## Notas importantes
- La función elimina todos los eventos de catering creados por el usuario antes de eliminar el usuario
- La función elimina todas las notificaciones donde el usuario es sender o recipient
- Se mantienen los logs de auditoría para rastrear la eliminación
- La función es segura y maneja errores apropiadamente
- **Versión robusta**: Verifica la existencia de cada tabla antes de intentar eliminar registros
- **Compatibilidad**: Funciona independientemente de qué tablas de catering estén creadas en la base de datos

## Pasos para aplicar la solución

1. Abrir el SQL Editor en Supabase
2. Copiar y pegar el contenido del archivo `database/fix_notifications_cascade_delete.sql`
3. Ejecutar el script
4. Verificar que aparece el mensaje "Función complete_delete_user_cascade actualizada correctamente (incluye todas las notificaciones)"
5. Probar la eliminación de usuarios desde la aplicación 