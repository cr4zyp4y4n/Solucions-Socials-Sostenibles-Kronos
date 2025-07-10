# 🔧 Solución de Errores de Notificaciones (Esquema Existente)

## ❌ Problemas identificados:

1. **Error de columna faltante**: El código intentaba usar campos que no existen en el esquema actual de `notifications`
2. **Error de conexión Realtime**: Problemas con la suscripción a notificaciones en tiempo real

## ✅ Soluciones aplicadas:

### 1. **Script SQL para configurar políticas RLS:**

**Ejecuta este script en el SQL Editor de Supabase:**

```sql
-- Script para configurar las políticas RLS de la tabla notifications existente
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Verificar la estructura actual de notifications
SELECT 
  'Current notifications structure' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 2. Verificar las políticas RLS actuales
SELECT 
  'Current RLS Policies' as info,
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname;

-- 3. Eliminar políticas existentes si las hay
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own notifications" ON public.notifications;

-- 4. Habilitar RLS si no está habilitado
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Crear políticas RLS para notifications
-- Política para SELECT (ver notificaciones propias)
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    recipient_id = auth.uid() OR sender_id = auth.uid()
  );

-- Política para INSERT (crear notificaciones)
CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
  );

-- Política para UPDATE (marcar como leídas)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_id = auth.uid()
  );

-- Política para DELETE (eliminar notificaciones propias)
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (
    recipient_id = auth.uid() OR sender_id = auth.uid()
  );

-- 6. Verificar las políticas creadas
SELECT 
  'Final RLS Policies' as info,
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname;

-- 7. Verificar que RLS está habilitado
SELECT 
  'RLS Status' as info,
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'notifications' 
AND schemaname = 'public';
```

### 2. **Correcciones en el código:**

#### **HomePage.jsx - Función createNotificationForManagers actualizada:**
```javascript
// Función para crear notificación para los Jefes
const createNotificationForManagers = async (uploadInfo, type) => {
  try {
    // Obtener usuarios con roles de manager y admin
    const { data: managers, error: managersError } = await supabase
      .from('user_profiles')
      .select('id')
      .in('role', ['manager', 'admin'])
      .neq('id', user.id); // No notificar al creador

    if (managersError) {
      console.error('Error fetching managers:', managersError);
      return;
    }

    if (managers && managers.length > 0) {
      // Crear notificaciones para cada manager/admin
      const notifications = managers.map(manager => ({
        recipient_id: manager.id,
        sender_id: user.id,
        type: 'system', // Usar 'system' que está permitido en el check constraint
        title: `Nuevo archivo Excel subido`,
        message: `Se ha subido un archivo Excel de ${type === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort'} con ${uploadInfo.data_count} registros.`,
        data: {
          upload_type: type,
          upload_id: uploadInfo.id,
          data_count: uploadInfo.data_count
        }
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creating notifications:', error);
        // No lanzar error aquí, es opcional
      }
    }
  } catch (error) {
    console.error('Error in createNotificationForManagers:', error);
    // No lanzar error aquí, es opcional
  }
};
```

#### **Layout.jsx - Función setupRealtimeNotifications mejorada:**
```javascript
const setupRealtimeNotifications = () => {
  if (!user?.id) return;

  try {
    const channel = supabase
      .channel('notifications')
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'notifications',
          filter: `recipient_id=eq.${user.id}`
        }, 
        (payload) => {
          console.log('Nueva notificación recibida:', payload);
          setNotifications(prev => [payload.new, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .on('error', (error) => {
        console.error('Error en suscripción de notificaciones:', error);
      })
      .subscribe((status) => {
        console.log('Estado de suscripción de notificaciones:', status);
      });

    return () => {
      try {
        supabase.removeChannel(channel);
      } catch (error) {
        console.error('Error al remover canal de notificaciones:', error);
      }
    };
  } catch (error) {
    console.error('Error al configurar notificaciones en tiempo real:', error);
    return () => {};
  }
};
```

## 🚀 Pasos para probar:

### 1. **Ejecutar el script SQL:**
- Ve a tu proyecto Supabase
- Ve a SQL Editor
- Copia y pega el script completo
- Ejecuta el script

### 2. **Reiniciar la aplicación:**
- Detén la aplicación si está corriendo
- Reinicia la aplicación
- Verifica que no hay errores en la consola

### 3. **Probar las notificaciones:**
- Sube un archivo Excel como usuario de Gestión
- Verifica que se crean notificaciones para los Jefes
- Verifica que las notificaciones aparecen en tiempo real

## 🔍 Verificación:

### En Supabase Dashboard:
1. **Database > Tables > notifications**
2. **Verifica que la tabla tenga estas columnas:**
   - ✅ `id` (UUID, PRIMARY KEY)
   - ✅ `recipient_id` (UUID, NOT NULL, FOREIGN KEY)
   - ✅ `sender_id` (UUID, FOREIGN KEY)
   - ✅ `type` (TEXT, NOT NULL, CHECK CONSTRAINT)
   - ✅ `title` (TEXT, NOT NULL)
   - ✅ `message` (TEXT, NOT NULL)
   - ✅ `data` (JSONB)
   - ✅ `read_at` (TIMESTAMP)
   - ✅ `created_at` (TIMESTAMP)

3. **Database > Tables > notifications > Policies**
4. **Verifica que existan estas políticas:**
   - ✅ "Users can view own notifications"
   - ✅ "Users can create notifications"
   - ✅ "Users can update own notifications"
   - ✅ "Users can delete own notifications"

### En la aplicación:
1. **Sube un archivo Excel como usuario de Gestión**
2. **Verifica en la consola que no hay errores**
3. **Verifica que las notificaciones aparecen para los Jefes**

## 📝 Notas importantes:

- **El esquema existente usa `recipient_id` y `sender_id`** en lugar de `created_by`
- **El tipo debe ser uno de los permitidos**: `'user_updated'`, `'user_deleted'`, `'role_changed'`, `'system'`
- **Las políticas RLS verifican tanto `recipient_id` como `sender_id`** para acceso
- **El sistema de tiempo real está mejorado** con manejo de errores
- **Las notificaciones son opcionales** y no bloquean el flujo principal

## 🔧 Tipos de notificación permitidos:

Según el check constraint, solo estos tipos están permitidos:
- `'user_updated'` - Cuando se actualiza un usuario
- `'user_deleted'` - Cuando se elimina un usuario
- `'role_changed'` - Cuando cambia el rol de un usuario
- `'system'` - Para notificaciones del sistema (como subidas de Excel)

## 🆘 Si persiste el error:

1. **Verifica que ejecutaste el script SQL completo**
2. **Revisa la consola del navegador** para errores específicos
3. **Verifica que el usuario está autenticado** correctamente
4. **Asegúrate de que Realtime está habilitado** en Supabase Dashboard
5. **Verifica que las políticas RLS están activas**

## 🔧 Debugging adicional:

Si el error persiste, puedes ejecutar esta consulta para verificar el estado:

```sql
-- Verificar el estado de las políticas RLS
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive, 
  roles, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname;

-- Verificar que RLS está habilitado
SELECT 
  schemaname,
  tablename,
  rowsecurity
FROM pg_tables 
WHERE tablename = 'notifications' 
AND schemaname = 'public';

-- Verificar la estructura de la tabla
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;
```

---

**¡Con estos cambios, los errores de notificaciones deberían estar resueltos usando el esquema existente!** 🎉 