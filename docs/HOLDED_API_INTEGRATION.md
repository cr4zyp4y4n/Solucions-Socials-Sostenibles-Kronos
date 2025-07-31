# Integración con API de Holded

## Descripción

Esta funcionalidad permite sincronizar automáticamente las facturas pendientes y vencidas desde la API de Holded, eliminando la necesidad de descargar archivos Excel manualmente.

## Configuración

### 1. API Key de Holded

La API key ya está configurada en el servicio:
```
cfe50911f41fe8de885b167988773e09
```

### 2. Base de Datos

Ejecutar el script SQL para agregar los campos necesarios:
```sql
-- Ejecutar en el SQL Editor de Supabase
-- Ver archivo: database/add_holded_sync_fields.sql
```

## Funcionalidades

### Sincronización Automática

- **Facturas Pendientes**: Obtiene todas las facturas no pagadas
- **Facturas Vencidas**: Obtiene facturas con fecha de vencimiento pasada
- **Deduplicación**: Evita duplicados basándose en el ID de Holded
- **Historial**: Mantiene registro de todas las sincronizaciones

### Campos Mapeados

| Campo Holded | Campo Local | Descripción |
|--------------|-------------|-------------|
| `num` | `invoice_number` | Número de factura |
| `internalNum` | `internal_number` | Número interno |
| `date` | `issue_date` | Fecha de emisión |
| `accountingDate` | `accounting_date` | Fecha contable |
| `dueDate` | `due_date` | Fecha de vencimiento |
| `contact.name` | `provider` | Nombre del proveedor |
| `notes` | `description` | Descripción |
| `tags` | `tags` | Etiquetas |
| `account` | `account` | Cuenta |
| `project` | `project` | Proyecto |
| `subtotal` | `subtotal` | Subtotal |
| `tax` | `vat` | IVA |
| `retention` | `retention` | Retención |
| `employees` | `employees` | Empleados |
| `equipmentRecovery` | `equipment_recovery` | Recuperación de equipos |
| `total` | `total` | Total |
| `paid` | `paid` | Pagado |
| `pending` | `pending` | Pendiente |
| `status` | `status` | Estado |
| `paymentDate` | `payment_date` | Fecha de pago |

## Uso

### Desde la Interfaz

1. Ir a la página principal
2. Buscar la sección "Sincronización con Holded"
3. Verificar que el estado sea "Conectado"
4. Hacer clic en "Listo para sincronizar"
5. Esperar a que se complete la sincronización

### Estados de Conexión

- **Conectado**: La API key es válida y se puede sincronizar
- **Desconectado**: Error en la API key o problemas de conexión

### Estados de Sincronización

- **Listo para sincronizar**: Estado inicial
- **Sincronizando...**: Proceso en curso
- **Sincronización completada**: Proceso exitoso
- **Error en sincronización**: Problema durante el proceso

## Ventajas

### Para el Usuario

1. **Automatización**: No necesita descargar Excel manualmente
2. **Tiempo Real**: Datos siempre actualizados
3. **Simplicidad**: Un solo clic para sincronizar
4. **Confiabilidad**: Evita errores de carga manual

### Para la Empresa

1. **Eficiencia**: Reduce tiempo de procesamiento
2. **Precisión**: Elimina errores de transcripción
3. **Trazabilidad**: Historial completo de sincronizaciones
4. **Escalabilidad**: Fácil de mantener y actualizar

## Seguridad

### API Key

- La API key está configurada en el código del cliente
- Para producción, considerar mover a variables de entorno
- La key tiene permisos de solo lectura

### Datos

- Solo se sincronizan facturas pendientes y vencidas
- No se modifican datos en Holded
- Se mantiene referencia al ID original de Holded

## Mantenimiento

### Limpieza Automática

El sistema incluye funciones para:
- Eliminar sincronizaciones antiguas (30 días)
- Limpiar facturas huérfanas
- Evitar duplicados

### Monitoreo

- Verificar estado de conexión regularmente
- Revisar logs de sincronización
- Monitorear rendimiento de la API

## Troubleshooting

### Problemas Comunes

1. **Error de conexión**
   - Verificar API key
   - Comprobar conectividad a internet
   - Revisar límites de la API

2. **Datos duplicados**
   - El sistema evita duplicados automáticamente
   - Verificar trigger `check_holded_duplicate`

3. **Sincronización lenta**
   - La API de Holded puede tener limitaciones
   - Considerar sincronización por lotes

### Logs

Los errores se registran en:
- Console del navegador
- Logs de Supabase
- Estado del componente

## Futuras Mejoras

1. **Sincronización Programada**: Automatizar sincronizaciones
2. **Filtros Avanzados**: Sincronizar por fechas específicas
3. **Notificaciones**: Alertas de nuevas facturas
4. **Dashboard**: Estadísticas de sincronización
5. **API Key Dinámica**: Permitir cambiar la key desde la interfaz 