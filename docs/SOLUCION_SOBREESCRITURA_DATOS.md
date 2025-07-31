# Solución: Sobreescritura de Datos Excel

## Problema Identificado
Los datos se están acumulando en lugar de reemplazarse cuando se sube un nuevo archivo Excel, causando valores duplicados y totales incorrectos (200 mil euros o más).

## Solución Implementada

### Cambios en el Código
Se modificó la función `saveProcessedData` en `HomePage.jsx` para:

1. **Eliminar datos anteriores** del mismo tipo antes de insertar nuevos
2. **Mantener solo el upload más reciente** de cada tipo
3. **Evitar duplicación** de datos

### Lógica de Reemplazo
- **Al subir un nuevo Excel de Solucions**: Se eliminan todos los datos anteriores de tipo 'solucions'
- **Al subir un nuevo Excel de Menjar**: Se eliminan todos los datos anteriores de tipo 'menjar'
- **Se mantiene solo el archivo más reciente** de cada tipo

## Pasos para Aplicar la Solución

### 1. Verificar Permisos de Eliminación
Ejecuta el script `verify_delete_permissions.sql` en Supabase SQL Editor para verificar que las políticas RLS permiten eliminar datos.

### 2. Reiniciar la Aplicación
```bash
npm run dev
```

### 3. Probar la Funcionalidad
1. **Sube un archivo Excel de Solucions**
2. **Verifica que los datos se cargan correctamente**
3. **Sube otro archivo Excel de Solucions** (diferente)
4. **Verifica que los datos anteriores se reemplazan** (no se acumulan)

## Comportamiento Esperado

### Antes de la Solución
- ❌ Los datos se acumulaban
- ❌ Los totales eran incorrectos
- ❌ Valores duplicados

### Después de la Solución
- ✅ Solo se mantiene el archivo más reciente de cada tipo
- ✅ Los totales son correctos
- ✅ No hay duplicación de datos

## Verificación

### En la Consola del Navegador
Al subir un nuevo archivo, deberías ver estos mensajes:
```
Eliminando datos anteriores de tipo: solucions
Eliminando 2 uploads anteriores del tipo solucions
Datos anteriores eliminados correctamente para tipo: solucions
Insertando 150 nuevos registros para tipo: solucions
Nuevos datos insertados correctamente: 150 registros
```

### En la Base de Datos
- Solo debe haber **1 registro** en `excel_uploads` por tipo
- Las facturas en `invoices` deben corresponder solo al upload más reciente

## Si el Problema Persiste

### 1. Verificar Políticas RLS
Ejecuta esta consulta para verificar las políticas DELETE:
```sql
SELECT 
  tablename, 
  policyname, 
  cmd, 
  qual 
FROM pg_policies 
WHERE tablename IN ('excel_uploads', 'invoices') 
AND cmd = 'DELETE'
ORDER BY tablename;
```

### 2. Limpiar Datos Manualmente
Si hay datos duplicados, ejecuta estas consultas:
```sql
-- Ver datos actuales
SELECT upload_type, COUNT(*) as count 
FROM excel_uploads 
GROUP BY upload_type;

-- Eliminar datos duplicados (ejecutar con cuidado)
DELETE FROM invoices 
WHERE upload_id IN (
  SELECT id FROM excel_uploads 
  WHERE id NOT IN (
    SELECT MAX(id) FROM excel_uploads 
    GROUP BY upload_type
  )
);

DELETE FROM excel_uploads 
WHERE id NOT IN (
  SELECT MAX(id) FROM excel_uploads 
  GROUP BY upload_type
);
```

### 3. Verificar Logs
Revisa la consola del navegador para ver si hay errores durante la eliminación o inserción de datos.

## Notas Importantes

1. **Backup Recomendado**: Antes de probar, haz un backup de tus datos actuales
2. **Solo el Más Reciente**: Solo se mantiene el archivo más reciente de cada tipo
3. **Datos Perdidos**: Los datos anteriores se eliminan permanentemente
4. **Tipos Separados**: Solucions y Menjar son independientes (no se afectan entre sí)

## Resultado Final
Después de aplicar esta solución, cada vez que subas un nuevo archivo Excel:
- Los datos anteriores del mismo tipo se eliminarán
- Solo se mantendrán los datos del archivo más reciente
- Los totales y estadísticas serán correctos
- No habrá duplicación de datos 