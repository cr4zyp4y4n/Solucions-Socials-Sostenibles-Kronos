# Solución: Jefes y Administradores no pueden ver datos de Análisis

## Problema Identificado
Los jefes y administradores no pueden ver los datos en la página de Análisis, aunque sí ven los datos en la página de Inicio. Esto se debe a que las políticas RLS (Row Level Security) están configuradas para que cada usuario solo pueda ver sus propios datos.

## Solución

### 1. Ejecutar el Script SQL
Ve a **Supabase Dashboard** → **SQL Editor** y ejecuta el script `fix_rls_for_managers.sql`:

```sql
-- Copia y pega todo el contenido del archivo fix_rls_for_managers.sql
```

### 2. Verificar que el Script se Ejecutó Correctamente
Después de ejecutar el script, deberías ver en los resultados:
- Una lista de las políticas RLS actuales
- Mensajes de confirmación de eliminación de políticas
- Mensajes de confirmación de creación de nuevas políticas
- Una lista final de las políticas creadas
- Estadísticas de prueba de las tablas

### 3. Reiniciar la Aplicación
1. Cierra completamente la aplicación
2. Ejecuta `npm run dev` para reiniciar
3. Inicia sesión con un usuario jefe o administrador

### 4. Probar la Solución
1. **Inicia sesión con un usuario jefe** (`role: 'manager'`)
2. Ve a la página **Análisis**
3. Deberías ver todos los datos de todos los usuarios
4. **Inicia sesión con un usuario normal** (`role: 'user'`)
5. Ve a la página **Análisis**
6. Solo deberías ver tus propios datos

## Explicación de los Cambios

### Políticas RLS Anteriores (Problemáticas)
- Cada usuario solo podía ver sus propios uploads y facturas
- Los jefes no tenían acceso a datos de otros usuarios

### Políticas RLS Nuevas (Solucionadas)
- **Usuarios normales**: Solo ven sus propios datos
- **Jefes y Administradores**: Pueden ver todos los datos de todos los usuarios
- **Gestión**: Mantiene acceso limitado a sus propios datos

### Tablas Afectadas
1. **`excel_uploads`**: Políticas para ver, crear, actualizar y eliminar uploads
2. **`invoices`**: Políticas para ver, crear, actualizar y eliminar facturas

## Verificación

### Para Jefes y Administradores
- ✅ Pueden ver todos los uploads en la página de Inicio
- ✅ Pueden ver todos los datos en la página de Análisis
- ✅ Pueden ver estadísticas completas

### Para Usuarios Normales
- ✅ Solo ven sus propios datos
- ✅ Mantienen privacidad de sus datos

## Si el Problema Persiste

### 1. Verificar Roles de Usuario
Ejecuta esta consulta en SQL Editor para verificar los roles:

```sql
SELECT 
  id,
  email,
  raw_user_meta_data->>'role' as auth_role,
  up.role as profile_role
FROM auth.users au
LEFT JOIN public.user_profiles up ON au.id = up.id
ORDER BY au.created_at DESC;
```

### 2. Verificar Políticas RLS
Ejecuta esta consulta para ver las políticas actuales:

```sql
SELECT 
  tablename, 
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('excel_uploads', 'invoices')
ORDER BY tablename, cmd;
```

### 3. Probar Acceso Directo
Ejecuta esta consulta para probar el acceso:

```sql
-- Probar como usuario actual
SELECT COUNT(*) as total_uploads FROM public.excel_uploads;
SELECT COUNT(*) as total_invoices FROM public.invoices;
```

## Notas Importantes

1. **Reinicio Necesario**: Después de cambiar las políticas RLS, es necesario reiniciar la aplicación
2. **Cache del Navegador**: Si persisten problemas, limpia el cache del navegador
3. **Sesiones Activas**: Los usuarios con sesiones activas pueden necesitar cerrar sesión y volver a iniciar

## Resultado Esperado
Después de aplicar estos cambios, los jefes y administradores deberían poder ver todos los datos en la página de Análisis, mientras que los usuarios normales solo verán sus propios datos. 