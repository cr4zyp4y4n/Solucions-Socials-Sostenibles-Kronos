# Nuevo Formato de Ventas por Productos - IDONI

## Resumen de Cambios

Se ha actualizado la sección de Analytics de IDONI para manejar un nuevo formato de Excel para las ventas por productos. Los cambios incluyen:

### ✅ **Mantenido (Sin Cambios)**
- **Ventas Diarias**: Excel y funcionalidad existente se mantienen igual
- **Ventas por Horas**: Excel y funcionalidad existente se mantienen igual

### 🔄 **Reemplazado (Nuevo Formato)**
- **Ventas de Productos**: Se ha reemplazado el sistema antiguo con **dos nuevos botones**:
  - **Productos por Importe**: Nuevo Excel con formato mensual
  - **Productos por Cantidad**: Nuevo Excel con formato mensual

## Nuevo Formato de Excel

### Estructura de Columnas
Ambos excels (por importe y por cantidad) tienen la misma estructura:

| Columna | Descripción |
|---------|-------------|
| Codi | Código del producto |
| Descripció | Descripción del producto |
| Gener | Ventas de enero |
| Febrer | Ventas de febrero |
| Març | Ventas de marzo |
| Abril | Ventas de abril |
| Maig | Ventas de mayo |
| Juny | Ventas de junio |
| Juliol | Ventas de julio |
| Agost | Ventas de agosto |
| Setembre | Ventas de septiembre |
| Octubre | Ventas de octubre |
| Novembre | Ventas de noviembre |
| Desembre | Ventas de diciembre |
| TOTAL | Total anual |

### Diferencias entre los dos excels:
- **Excel por Importe**: Los valores en las columnas de meses representan **euros** (€)
- **Excel por Cantidad**: Los valores en las columnas de meses representan **unidades** vendidas

## Cambios Técnicos Implementados

### 1. Nuevas Funciones JavaScript
Se han agregado las siguientes funciones en `AnalyticsPage.jsx`:

#### Funciones de Procesamiento:
- `processIdoniProductosImporteExcel()` - Procesa Excel por importe
- `processIdoniProductosCantidadExcel()` - Procesa Excel por cantidad

#### Funciones de Validación:
- `findIdoniProductosImporteHeaderRow()` - Encuentra headers en Excel por importe
- `findIdoniProductosCantidadHeaderRow()` - Encuentra headers en Excel por cantidad
- `isValidIdoniProductosImporteRow()` - Valida filas por importe
- `isValidIdoniProductosCantidadRow()` - Valida filas por cantidad

#### Funciones de Base de Datos:
- `uploadIdoniProductosImporteToSupabase()` - Sube datos por importe
- `uploadIdoniProductosCantidadToSupabase()` - Sube datos por cantidad

#### Funciones de Interfaz:
- `handleIdoniProductosImporteFileSelect()` - Maneja selección de archivo por importe
- `handleIdoniProductosCantidadFileSelect()` - Maneja selección de archivo por cantidad
- `handleIdoniProductosImporteFileChange()` - Maneja cambio de archivo por importe
- `handleIdoniProductosCantidadFileChange()` - Maneja cambio de archivo por cantidad

### 2. Nuevas Referencias de Input Files
```javascript
const idoniProductosImporteFileInputRef = useRef(null);
const idoniProductosCantidadFileInputRef = useRef(null);
```

### 3. Nuevas Tablas de Base de Datos
Se han creado dos nuevas tablas en Supabase:

#### `idoni_ventas_productos_importe`
- Almacena ventas por importe (euros)
- Columnas: codi, descripcio, gener, febrer, marc, abril, maig, juny, juliol, agost, setembre, octubre, novembre, desembre, total

#### `idoni_ventas_productos_cantidad`
- Almacena ventas por cantidad (unidades)
- Columnas: codi, descripcio, gener, febrer, marc, abril, maig, juny, juliol, agost, setembre, octubre, novembre, desembre, total

### 4. Actualización de la Interfaz
- Se reemplazó el botón único "Ventas de Productos" con dos botones:
  - **"Productos por Importe"** - Para el Excel de ventas por euros
  - **"Productos por Cantidad"** - Para el Excel de ventas por unidades

## Instalación y Configuración

### 1. Ejecutar Script SQL
Antes de usar las nuevas funcionalidades, ejecutar el script SQL en Supabase:

```sql
-- Ejecutar el archivo: database/idoni_ventas_productos_nuevo_formato.sql
```

### 2. Verificar Funcionalidad
1. Ir a la sección Analytics
2. Seleccionar "IDONI" en el selector de dataset
3. Verificar que aparecen los dos nuevos botones:
   - "Productos por Importe"
   - "Productos por Cantidad"

## Uso de las Nuevas Funcionalidades

### Subir Excel por Importe:
1. Hacer clic en "Productos por Importe"
2. Seleccionar el archivo Excel con ventas por euros
3. El sistema procesará automáticamente el archivo
4. Los datos se almacenarán en la tabla `idoni_ventas_productos_importe`

### Subir Excel por Cantidad:
1. Hacer clic en "Productos por Cantidad"
2. Seleccionar el archivo Excel con ventas por unidades
3. El sistema procesará automáticamente el archivo
4. Los datos se almacenarán en la tabla `idoni_ventas_productos_cantidad`

## Validaciones Implementadas

### Validación de Headers
El sistema busca las siguientes columnas en el Excel:
- Codi
- Descripció
- Gener, Febrer, Març, Abril, Maig, Juny, Juliol, Agost, Setembre, Octubre, Novembre, Desembre
- TOTAL

### Validación de Datos
- Debe tener al menos un código de producto válido
- Al menos una columna de mes debe tener un valor numérico
- Los valores se convierten automáticamente a números decimales

## Compatibilidad

### ✅ Compatible
- Ventas Diarias (formato existente)
- Ventas por Horas (formato existente)
- Exportación para IA (mantiene funcionalidad existente)

### 🔄 Reemplazado
- Ventas de Productos (formato antiguo) → Nuevos botones por importe y cantidad

## Notas Importantes

1. **Formato de Excel**: Los nuevos excels deben tener exactamente las columnas especificadas
2. **Separación de Datos**: Los datos por importe y cantidad se almacenan en tablas separadas
3. **Procesamiento**: Cada tipo de Excel se procesa de forma independiente
4. **Validación**: El sistema valida automáticamente el formato del Excel antes de procesarlo

## Troubleshooting

### Error: "No se encontraron headers válidos"
- Verificar que el Excel tiene las columnas correctas
- Asegurar que los nombres de las columnas coinciden exactamente

### Error: "La tabla no existe"
- Ejecutar el script SQL en Supabase
- Verificar que las tablas se han creado correctamente

### Error: "No se encontraron filas válidas"
- Verificar que el Excel tiene datos en las filas
- Asegurar que al menos una columna de mes tiene valores numéricos

### Error: "new row violates row-level security policy"
Este es el error más común. Indica un problema con las políticas de seguridad de la base de datos.

**Solución:**
1. Ejecutar el script SQL actualizado: `database/idoni_ventas_productos_nuevo_formato.sql`
2. Si el error persiste, ejecutar el script de corrección: `database/fix_rls_idoni_productos.sql`
3. Verificar que las políticas RLS están configuradas correctamente

### Error: "Error de permisos"
- Ejecutar el script SQL actualizado en Supabase
- Verificar que el usuario tiene permisos de autenticación
- Comprobar que las políticas RLS están activas
