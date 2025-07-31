# Sistema de Eliminación en Cascada para Usuarios

## 🎯 Objetivo

Implementar un sistema automático que elimine todas las referencias de un usuario cuando se elimina, manteniendo la consistencia de la base de datos y evitando usuarios fantasma.

## 🏗️ Arquitectura del Sistema

### **1. Función Principal: `delete_user_cascade()`**
- Elimina todas las referencias del usuario en orden correcto
- Maneja errores y proporciona logs detallados
- Retorna TRUE/FALSE para indicar éxito/fallo

### **2. Trigger Automático: `trigger_delete_user_cascade()`**
- Se ejecuta automáticamente cuando se elimina de `user_profiles`
- Elimina automáticamente de `auth.users`
- Garantiza consistencia automática

### **3. Función de Limpieza: `cleanup_ghost_users()`**
- Elimina usuarios fantasma existentes
- Usa la función de cascada para cada usuario
- Retorna estadísticas de eliminación

### **4. Funciones de Diagnóstico**
- `check_user_references()`: Verifica referencias de un usuario
- `list_all_ghost_references()`: Lista usuarios fantasma con detalles

## 📋 Tablas que se Eliminan en Cascada

### **Orden de Eliminación:**
1. **audit_logs** (user_id)
2. **notifications** (sender_id)
3. **user_profiles** (id)
4. **auth.users** (id)

### **Tablas Futuras (Comentadas):**
- **invoices** (user_id) - Para facturas
- **excel_files** (user_id) - Para archivos Excel
- **notifications** (recipient_id) - Para notificaciones recibidas

## 🛠️ Instalación

### **1. Ejecutar el Script SQL:**
```sql
-- Ejecutar cascade_delete_user.sql en el SQL Editor de Supabase
```

### **2. Verificar Instalación:**
```sql
-- Verificar que las funciones se crearon
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_name LIKE '%cascade%' OR routine_name LIKE '%ghost%';
```

## 📊 Uso del Sistema

### **Eliminar Usuario Específico:**
```sql
SELECT delete_user_cascade('user-id-aqui');
```

### **Limpiar Usuarios Fantasma:**
```sql
SELECT * FROM cleanup_ghost_users();
```

### **Verificar Referencias:**
```sql
SELECT * FROM check_user_references('user-id-aqui');
```

### **Listar Usuarios Fantasma:**
```sql
SELECT * FROM list_all_ghost_references();
```

## 🔄 Integración con la Aplicación

### **Componente UserManagement.jsx:**
- Usa `supabase.rpc('delete_user_cascade')` como método principal
- Tiene fallback a eliminación manual si falla la RPC
- Incluye logs detallados para debugging

### **Flujo de Eliminación:**
1. Usuario confirma eliminación
2. Se obtiene email del usuario
3. Se elimina de `user_profiles`
4. Se ejecuta función de cascada
5. Se maneja cualquier error
6. Se actualiza la interfaz

## ⚠️ Consideraciones de Seguridad

### **Permisos Requeridos:**
- **SECURITY DEFINER**: Las funciones se ejecutan con permisos de creador
- **RLS**: Las políticas RLS se aplican normalmente
- **Triggers**: Se ejecutan automáticamente sin intervención manual

### **Validaciones:**
- Verifica que el usuario existe antes de eliminar
- Maneja errores de forma segura
- No permite eliminación de usuarios inexistentes

## 📈 Monitoreo y Mantenimiento

### **Logs Automáticos:**
```sql
-- Los logs aparecen en la consola de Supabase
-- Ejemplo: "Eliminados 5 registros de audit_logs"
```

### **Verificación Periódica:**
```sql
-- Verificar usuarios fantasma restantes
SELECT COUNT(*) as usuarios_fantasma
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
WHERE up.id IS NULL;
```

### **Estadísticas de Eliminación:**
```sql
-- Ver estadísticas de eliminación en cascada
SELECT 
    COUNT(*) as total_eliminaciones,
    COUNT(CASE WHEN result = true THEN 1 END) as exitosas,
    COUNT(CASE WHEN result = false THEN 1 END) as fallidas
FROM (
    SELECT delete_user_cascade(user_id) as result
    FROM user_profiles
    WHERE id = 'user-id-aqui'
) as eliminations;
```

## 🔧 Personalización

### **Agregar Nuevas Tablas:**
1. Agregar eliminación en `delete_user_cascade()`
2. Agregar conteo en `check_user_references()`
3. Agregar en `list_all_ghost_references()`

### **Ejemplo para Nueva Tabla:**
```sql
-- En delete_user_cascade()
DELETE FROM nueva_tabla WHERE user_id = user_id;
GET DIAGNOSTICS nueva_tabla_deleted = ROW_COUNT;
RAISE NOTICE 'Eliminados % registros de nueva_tabla', nueva_tabla_deleted;
```

## 🚨 Troubleshooting

### **Error: "function does not exist"**
- Verificar que se ejecutó el script SQL
- Verificar permisos de la función

### **Error: "permission denied"**
- Verificar políticas RLS
- Verificar permisos del usuario

### **Usuarios Fantasma Persisten**
- Ejecutar `cleanup_ghost_users()`
- Verificar logs para errores específicos

## 📝 Notas Importantes

- **Backup**: Siempre hacer backup antes de eliminar usuarios
- **Testing**: Probar en entorno de desarrollo primero
- **Logs**: Revisar logs para debugging
- **Consistencia**: El trigger garantiza consistencia automática
- **Performance**: Las eliminaciones son atómicas y eficientes 