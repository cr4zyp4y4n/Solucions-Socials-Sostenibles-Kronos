# Solución para Usuarios Fantasma en auth.users

## 🚨 Problema Identificado

Cuando se eliminan usuarios desde la gestión de usuarios de la aplicación, solo se eliminan de la tabla `user_profiles`, pero **NO se eliminan de la tabla `auth.users`** de Supabase.

### Consecuencias:
- **Conflictos de registro**: Emails "bloqueados" que impiden nuevos registros
- **Inconsistencia de datos**: Usuarios fantasma en logs de autenticación
- **Problemas de seguridad**: Cuentas de auth que no deberían existir

## 🔧 Soluciones Implementadas

### 1. Mejora en la Función de Eliminación

Se modificó `handleDeleteUser` en `UserManagement.jsx` para:

```javascript
// 1. Obtener email del usuario antes de eliminarlo
const { data: userData } = await supabase
  .from('user_profiles')
  .select('email')
  .eq('id', userId)
  .single();

// 2. Eliminar de user_profiles
await supabase.from('user_profiles').delete().eq('id', userId);

// 3. Intentar eliminar de auth.users
try {
  await supabase.auth.admin.deleteUser(userId);
} catch (authError) {
  console.warn('No se pudo eliminar de auth.users');
}
```

### 2. Script de Diagnóstico

Se creó `cleanup_ghost_users.sql` para identificar usuarios fantasma:

```sql
-- Verificar usuarios fantasma
SELECT au.id, au.email, au.created_at
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;
```

## 🛠️ Opciones para Limpiar Usuarios Fantasma

### Opción 1: Dashboard de Supabase (Recomendado)
1. Ir a **Authentication > Users** en el dashboard
2. Identificar usuarios sin perfil en `user_profiles`
3. Eliminar manualmente

### Opción 2: Función RPC (Requiere Configuración)
```sql
CREATE OR REPLACE FUNCTION delete_ghost_user(user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    DELETE FROM auth.users WHERE id = user_id;
END;
$$;
```

### Opción 3: API con Service Role Key
```javascript
// Requiere service_role key (no anon key)
const { data, error } = await supabase.auth.admin.deleteUser(userId);
```

## 📊 Monitoreo

### Logs de Debugging
La función de eliminación ahora incluye logs detallados:

```
🔍 [DEBUG] Iniciando eliminación de usuario: [userId]
🔍 [DEBUG] Email del usuario a eliminar: [email]
✅ [DEBUG] Usuario eliminado de user_profiles
✅ [DEBUG] Usuario eliminado de auth.users
```

### Verificación Periódica
Ejecutar el script `cleanup_ghost_users.sql` periódicamente para:
- Identificar usuarios fantasma
- Mantener consistencia de datos
- Prevenir conflictos de registro

## ⚠️ Consideraciones de Seguridad

### Permisos Requeridos
- **auth.admin.deleteUser**: Requiere service_role key
- **Función RPC**: Requiere SECURITY DEFINER
- **Dashboard**: Requiere permisos de admin en Supabase

### Validaciones
- No permitir eliminación del usuario actual
- Confirmación explícita del usuario
- Logs detallados para auditoría

## 🔄 Flujo Mejorado

1. **Usuario solicita eliminación**
2. **Confirmación con advertencia** sobre eliminación de auth
3. **Obtener datos** del usuario antes de eliminar
4. **Eliminar de user_profiles**
5. **Intentar eliminar de auth.users**
6. **Logs detallados** para debugging
7. **Actualizar interfaz** y mostrar resultado

## 📝 Notas Importantes

- La eliminación de `auth.users` puede fallar si no tienes los permisos correctos
- Los usuarios fantasma no afectan la funcionalidad de la app, pero pueden causar conflictos
- Es recomendable limpiar usuarios fantasma periódicamente
- Considerar implementar una función RPC para automatizar la limpieza 