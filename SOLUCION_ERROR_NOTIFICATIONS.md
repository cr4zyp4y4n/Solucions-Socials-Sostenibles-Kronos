# 🔧 Solución de Errores de Notificaciones

## ❌ Problemas identificados:

1. **Error de columna faltante**: `"Could not find the 'created_by' column of 'notifications' in the schema cache"`
2. **Error de conexión Realtime**: Problemas con la suscripción a notificaciones en tiempo real

## ✅ Soluciones aplicadas:

### 1. **Script SQL para crear la tabla notifications:**

**Ejecuta este script en el SQL Editor de Supabase:**

```sql
-- Script para crear la tabla notifications
-- Ejecutar este script en el SQL Editor de Supabase

-- 1. Crear la tabla notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL,
  target_roles TEXT[] DEFAULT '{}',
  recipient_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  metadata JSONB DEFAULT '{}'
);

-- 2. Crear índices para mejorar rendimiento
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON public.notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON public.notifications(created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_read_at ON public.notifications(read_at);

-- 3. Habilitar RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Crear políticas RLS
-- Política para SELECT (ver notificaciones propias)
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (
    recipient_id = auth.uid() OR created_by = auth.uid()
  );

-- Política para INSERT (crear notificaciones)
CREATE POLICY "Users can create notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
  );

-- Política para UPDATE (marcar como leídas)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (
    recipient_id = auth.uid()
  );

-- Política para DELETE (eliminar notificaciones propias)
CREATE POLICY "Users can delete own notifications" ON public.notifications
  FOR DELETE USING (
    recipient_id = auth.uid() OR created_by = auth.uid()
  );

-- 5. Función para crear notificaciones automáticamente
CREATE OR REPLACE FUNCTION public.create_notification_for_roles(
  p_title TEXT,
  p_message TEXT,
  p_type TEXT,
  p_target_roles TEXT[],
  p_created_by UUID
)
RETURNS VOID AS $$
BEGIN
  INSERT INTO public.notifications (
    title,
    message,
    type,
    target_roles,
    recipient_id,
    created_by,
    created_at
  )
  SELECT 
    p_title,
    p_message,
    p_type,
    p_target_roles,
    up.id,
    p_created_by,
    NOW()
  FROM public.user_profiles up
  WHERE up.role = ANY(p_target_roles)
  AND up.id != p_created_by; -- No notificar al creador
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Verificar la estructura creada
SELECT 
  'notifications structure' as info,
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'notifications' 
AND table_schema = 'public'
ORDER BY ordinal_position;

-- 7. Verificar las políticas RLS
SELECT 
  'RLS Policies' as info,
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename = 'notifications' 
AND schemaname = 'public'
ORDER BY policyname;
```

### 2. **Correcciones en el código:**

#### **HomePage.jsx - Función createNotificationForManagers:**
```javascript
// Función para crear notificación para los Jefes
const createNotificationForManagers = async (uploadInfo, type) => {
  try {
    // Usar la función SQL para crear notificaciones automáticamente
    const { error } = await supabase.rpc('create_notification_for_roles', {
      p_title: `Nuevo archivo Excel subido`,
      p_message: `Se ha subido un archivo Excel de ${type === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort'} con ${uploadInfo.data_count} registros.`,
      p_type: 'excel_upload',
      p_target_roles: ['manager', 'admin'],
      p_created_by: user.id
    });

    if (error) {
      console.error('Error creating notification:', error);
      // No lanzar error aquí, es opcional
    }
  } catch (error) {
    console.error('Error in createNotificationForManagers:', error);
    // No lanzar error aquí, es opcional
  }
};
```

#### **Layout.jsx - Función setupRealtimeNotifications:**
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
   - ✅ `title` (TEXT, NOT NULL)
   - ✅ `message` (TEXT, NOT NULL)
   - ✅ `type` (TEXT, NOT NULL)
   - ✅ `target_roles` (TEXT[])
   - ✅ `recipient_id` (UUID, FOREIGN KEY)
   - ✅ `created_by` (UUID, FOREIGN KEY)
   - ✅ `created_at` (TIMESTAMP)
   - ✅ `read_at` (TIMESTAMP)
   - ✅ `metadata` (JSONB)

3. **Database > Functions**
4. **Verifica que existe la función:**
   - ✅ `create_notification_for_roles`

### En la aplicación:
1. **Sube un archivo Excel como usuario de Gestión**
2. **Verifica en la consola que no hay errores**
3. **Verifica que las notificaciones aparecen para los Jefes**

## 📝 Notas importantes:

- **La función SQL crea notificaciones automáticamente** para todos los usuarios con los roles especificados
- **Las políticas RLS aseguran que cada usuario solo vea sus notificaciones**
- **El sistema de tiempo real está mejorado** con manejo de errores
- **Las notificaciones son opcionales** y no bloquean el flujo principal

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

-- Verificar la función
SELECT 
  proname,
  prosrc
FROM pg_proc 
WHERE proname = 'create_notification_for_roles';
```

---

**¡Con estos cambios, los errores de notificaciones deberían estar resueltos!** 🎉 