# 🔒 Sistema de Control de Visibilidad de Facturas

## 📋 Descripción General

El sistema de control de visibilidad de facturas permite a los usuarios de **gestión** (`management`) y **administradores** (`admin`) ocultar facturas específicas para ciertos roles, controlando así qué información pueden ver los diferentes usuarios en la aplicación.

### **Objetivo Principal**
- **Bruno (Manager)**: Solo ve las facturas que los usuarios de gestión consideran necesarias
- **Management**: Pueden controlar la visibilidad de facturas para todos los roles
- **Admin**: Acceso completo a todas las funcionalidades
- **User**: Ve solo las facturas no ocultadas para su rol

## 🗄️ Estructura de Base de Datos

### **Tabla `invoice_visibility`**

```sql
CREATE TABLE public.invoice_visibility (
    id SERIAL PRIMARY KEY,
    invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE,
    hidden_for_role TEXT NOT NULL CHECK (hidden_for_role IN ('manager', 'admin', 'management', 'user')),
    hidden_by UUID REFERENCES auth.users(id),
    hidden_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reason TEXT,
    UNIQUE(invoice_id, hidden_for_role)
);
```

#### **Campos:**
- `id`: Identificador único
- `invoice_id`: ID de la factura a ocultar
- `hidden_for_role`: Rol para el cual se oculta la factura
- `hidden_by`: Usuario que realizó la ocultación
- `hidden_at`: Fecha y hora de la ocultación
- `reason`: Razón de la ocultación (opcional)

### **Funciones de Base de Datos**

#### **`is_invoice_hidden_for_role(invoice_uuid, user_role)`**
Verifica si una factura está oculta para un rol específico.

#### **`get_visible_invoices_for_role(user_role)`**
Obtiene todas las facturas visibles para un rol específico.

## 🔐 Políticas de Seguridad (RLS)

### **Políticas para `invoice_visibility`:**

1. **SELECT**: Usuarios pueden ver sus propias ocultaciones + management/admin ven todas
2. **INSERT**: Solo management y admin pueden crear ocultaciones
3. **UPDATE**: Solo management y admin pueden actualizar ocultaciones
4. **DELETE**: Solo management y admin pueden eliminar ocultaciones

## 🎯 Flujo de Funcionamiento

### **1. Vista de Management/Admin**
- **Acceso**: Menú "Visibilidad" en el sidebar
- **Funcionalidades**:
  - Ver todas las facturas disponibles
  - Ocultar facturas para roles específicos
  - Ver facturas ocultas por rol
  - Restaurar visibilidad de facturas
  - Estadísticas de ocultaciones

### **2. Vista de Bruno (Manager)**
- **Acceso**: Página de Análisis → Vista Bruno
- **Comportamiento**: Solo ve facturas no ocultadas para su rol (`manager`)

### **3. Vista de Usuarios Normales**
- **Comportamiento**: Solo ven facturas no ocultadas para su rol (`user`)

## 🛠️ Implementación Técnica

### **Servicios (`invoiceVisibilityService.js`)**

```javascript
// Funciones principales:
- getVisibleInvoicesForRole(role)
- hideInvoiceForRole(invoiceId, role, reason)
- showInvoiceForRole(invoiceId, role)
- isInvoiceHiddenForRole(invoiceId, role)
- getVisibilityControls()
- getVisibilityStats()
- getHiddenInvoicesForRole(role)
```

### **Componente de Gestión (`InvoiceVisibilityManager.jsx`)**

#### **Características:**
- **3 Tabs principales**:
  - **Todas las Facturas**: Lista completa con opción de ocultar
  - **Facturas Ocultas**: Ver y restaurar ocultaciones
  - **Estadísticas**: Resumen por rol

- **Filtros disponibles**:
  - Búsqueda por texto
  - Filtro por proveedor
  - Selección de rol objetivo

- **Modal de ocultación**:
  - Información de la factura
  - Selección de rol afectado
  - Campo obligatorio de razón

### **Integración en AnalyticsPage**

#### **Modificaciones realizadas:**
1. **Importación del servicio** de visibilidad
2. **Nueva función `filterDataByVisibility`** para filtrar datos
3. **Modificación de `loadDataFromHolded`** para aplicar filtros
4. **Lógica de permisos** según rol del usuario

## 📊 Casos de Uso

### **Escenario 1: Ocultar Factura Sensible**
1. **Usuario de gestión** accede a "Visibilidad"
2. **Selecciona** una factura de la lista
3. **Especifica** rol objetivo (ej: `manager`)
4. **Proporciona** razón (ej: "Información confidencial")
5. **Confirma** la ocultación
6. **Bruno** ya no ve esa factura en su vista

### **Escenario 2: Restaurar Visibilidad**
1. **Usuario de gestión** va a tab "Facturas Ocultas"
2. **Selecciona** la factura oculta
3. **Hace clic** en "Mostrar"
4. **Bruno** vuelve a ver la factura

### **Escenario 3: Estadísticas**
1. **Usuario de gestión** va a tab "Estadísticas"
2. **Ve resumen** de facturas ocultas por rol
3. **Monitorea** el uso del sistema

## 🔧 Instalación y Configuración

### **1. Ejecutar Script SQL**
```bash
# En Supabase SQL Editor
# Copiar y ejecutar el contenido de:
database/invoice_visibility_control.sql
```

### **2. Verificar Tabla**
```sql
-- Verificar que la tabla se creó correctamente
SELECT COUNT(*) FROM public.invoice_visibility;
```

### **3. Verificar Políticas RLS**
```sql
-- Verificar políticas creadas
SELECT policyname FROM pg_policies WHERE tablename = 'invoice_visibility';
```

### **4. Probar Funciones**
```sql
-- Probar función de visibilidad
SELECT get_visible_invoices_for_role('manager');
```

## 🎨 Características de UX/UI

### **Diseño Consistente**
- **Paleta de colores**: Solucions Socials
- **Iconografía**: Feather Icons
- **Animaciones**: Framer Motion
- **Responsive**: Adaptado para desktop y tablet

### **Interfaz Intuitiva**
- **Tabs organizados** por funcionalidad
- **Filtros avanzados** para búsqueda eficiente
- **Modal informativo** para confirmaciones
- **Alertas visuales** para feedback

### **Accesibilidad**
- **Contraste adecuado** en todos los elementos
- **Navegación por teclado** completa
- **Etiquetas descriptivas** para screen readers
- **Tamaños de fuente** legibles

## 🔍 Monitoreo y Auditoría

### **Logs de Actividad**
- **Todas las ocultaciones** quedan registradas
- **Usuario responsable** identificado
- **Fecha y hora** de cada acción
- **Razón documentada** para cada ocultación

### **Estadísticas Disponibles**
- **Facturas ocultas por rol**
- **Usuarios más activos** en gestión
- **Tendencias temporales** de uso
- **Proveedores más afectados**

## 🚨 Consideraciones de Seguridad

### **Principios de Seguridad**
1. **Principio de menor privilegio**: Solo roles necesarios pueden gestionar
2. **Auditoría completa**: Todas las acciones quedan registradas
3. **Validación de entrada**: Razones obligatorias para ocultaciones
4. **Políticas RLS**: Control a nivel de base de datos

### **Prevención de Abusos**
- **Razones obligatorias** para cada ocultación
- **Límites de visibilidad** por rol
- **Revisión periódica** de ocultaciones
- **Restauración fácil** de visibilidad

## 📈 Beneficios del Sistema

### **Para Management**
- **Control granular** sobre la información
- **Flexibilidad** para adaptar visibilidad según necesidades
- **Transparencia** en las decisiones de ocultación
- **Eficiencia** en la gestión de información sensible

### **Para Bruno (Manager)**
- **Vista limpia** con solo información relevante
- **Enfoque** en facturas importantes
- **Reducción de ruido** informativo
- **Mejor toma de decisiones**

### **Para la Organización**
- **Cumplimiento** de políticas de información
- **Trazabilidad** completa de decisiones
- **Escalabilidad** del sistema de permisos
- **Flexibilidad** para futuras necesidades

## 🔮 Futuras Mejoras

### **Funcionalidades Planificadas**
- **Ocultaciones temporales** con fecha de expiración
- **Ocultaciones masivas** por proveedor o rango de fechas
- **Notificaciones automáticas** cuando se ocultan facturas
- **Reportes avanzados** de uso del sistema

### **Integraciones Futuras**
- **Sistema de alertas** para management
- **Dashboard de métricas** de visibilidad
- **API para integraciones** externas
- **Sincronización** con otros sistemas

## 📞 Soporte y Mantenimiento

### **Troubleshooting Común**
1. **Facturas no se ocultan**: Verificar políticas RLS
2. **Error de permisos**: Verificar rol del usuario
3. **Datos no se cargan**: Verificar funciones de base de datos
4. **Interfaz no responde**: Verificar conexión a Supabase

### **Mantenimiento Regular**
- **Revisión mensual** de ocultaciones antiguas
- **Limpieza** de registros obsoletos
- **Actualización** de políticas según necesidades
- **Backup** de configuraciones importantes 