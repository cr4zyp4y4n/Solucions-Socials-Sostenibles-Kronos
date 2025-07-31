# Solución: Error RLS para Sincronización de Holded

## Problema
Al intentar sincronizar datos de Holded, aparecen errores relacionados con:

### 1. Políticas RLS (Row Level Security)
```
Error: Error creando registro de sincronización: new row violates row-level security policy for table "excel_uploads"
```

### 2. Formato de Fechas
```
Error: Error insertando documentos: date/time field value out of range: "1752184800"
```

## Causa

### 1. Políticas RLS
Las políticas de Row Level Security (RLS) de Supabase están bloqueando la inserción de registros de sincronización de Holded porque:
1. Las políticas actuales solo permiten que usuarios inserten registros donde `auth.uid() = uploaded_by`
2. Los registros de sincronización de Holded no tienen un `uploaded_by` válido o no coinciden con el usuario autenticado

### 2. Formato de Fechas
Las fechas que vienen de la API de Holded están en formato Unix timestamp (como "1752184800"), pero PostgreSQL espera fechas en formato ISO. Esto causa errores de conversión de tipos de datos.

## Solución

### Paso 1: Ejecutar Script de Corrección de RLS
1. Ve al **SQL Editor** de Supabase
2. Abre el archivo: `database/fix_holded_sync_complete.sql`
3. Copia todo el contenido del archivo
4. Pega en el SQL Editor de Supabase
5. Ejecuta el script completo

### Paso 2: Ejecutar Script de Corrección de Estructura
1. Abre el archivo: `database/fix_invoices_structure_final.sql`
2. Copia todo el contenido del archivo
3. Pega en el SQL Editor de Supabase
4. Ejecuta el script completo

### Paso 3: Ejecutar Script de Corrección de Clave Foránea
1. Abre el archivo: `database/fix_foreign_key_constraint.sql`
2. Copia todo el contenido del archivo
3. Pega en el SQL Editor de Supabase
4. Ejecuta el script completo

### Paso 4: Verificar Cambios
El script realizará las siguientes acciones:

#### Para la tabla `excel_uploads`:
- Elimina las políticas RLS restrictivas existentes
- Crea nuevas políticas que permiten:
  - Ver registros propios O registros de tipo `holded_api`
  - Insertar registros propios O registros de tipo `holded_api`
  - Actualizar registros propios O registros de tipo `holded_api`
  - Eliminar registros propios O registros de tipo `holded_api`

#### Para la tabla `invoices`:
- Habilita RLS si no está habilitado
- Crea políticas que permiten todas las operaciones (para administración)
- Agrega campos necesarios para Holded:
  - `holded_id`: ID original de Holded
  - `holded_contact_id`: ID del contacto en Holded
  - `document_type`: Tipo de documento (invoice, salesreceipt, etc.)
- Corrige tipos de datos para compatibilidad:
  - Convierte fechas de Unix timestamp a TIMESTAMP WITH TIME ZONE
  - Asegura que campos numéricos sean NUMERIC(15,2)
  - Asegura que campos de texto sean TEXT
  - Asegura que campos booleanos sean BOOLEAN
- Crea índices para mejorar rendimiento

### Paso 5: Probar Sincronización
1. Regresa a la aplicación
2. Ve a la pestaña de configuración
3. Ejecuta las pruebas de API de Holded
4. Intenta sincronizar datos de Holded

## Verificación

### Verificar Políticas Creadas:
```sql
-- Verificar políticas de excel_uploads
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'excel_uploads'
ORDER BY policyname;

-- Verificar políticas de invoices
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'invoices'
ORDER BY policyname;
```

### Verificar Campos Agregados:
```sql
-- Verificar estructura de invoices
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'invoices' 
AND table_schema = 'public'
AND column_name IN ('holded_id', 'holded_contact_id', 'document_type')
ORDER BY ordinal_position;
```

## Campos Nuevos en Invoices

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `holded_id` | TEXT | ID original del documento en Holded |
| `holded_contact_id` | TEXT | ID del contacto/proveedor en Holded |
| `document_type` | TEXT | Tipo de documento (invoice, salesreceipt, creditnote, etc.) |

## Notas Importantes

1. **Seguridad**: Las nuevas políticas mantienen la seguridad permitiendo que usuarios vean sus propios uploads y todos los registros de sincronización de Holded.

2. **Compatibilidad**: Los cambios son compatibles con la funcionalidad existente de carga de archivos Excel.

3. **Trazabilidad**: Los registros de sincronización de Holded se guardan en `excel_uploads` con `type = 'holded_api'` para mantener trazabilidad.

4. **Rendimiento**: Se crean índices en los nuevos campos para optimizar consultas.

## Si el Problema Persiste

Si después de ejecutar el script el error persiste:

1. **Verificar autenticación**: Asegúrate de que el usuario esté autenticado en la aplicación
2. **Verificar permisos**: Confirma que el usuario tiene permisos de administrador
3. **Revisar logs**: Consulta los logs de Supabase para más detalles del error
4. **Contactar soporte**: Si el problema persiste, contacta al equipo de desarrollo

## Archivos Modificados

- `database/fix_holded_sync_complete.sql`: Script principal de corrección de RLS
- `database/fix_invoices_structure_final.sql`: Script final de corrección de estructura y tipos de datos
- `database/fix_foreign_key_constraint.sql`: Script de corrección de restricción de clave foránea
- `src/services/holdedApi.js`: Actualizado para incluir `uploaded_by`, conversión de fechas y manejo de errores mejorado
- `src/components/HoldedTest.jsx`: Actualizado para usar nuevos métodos de API
- `src/components/HoldedSync.jsx`: Ya compatible con los cambios 