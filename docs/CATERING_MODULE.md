# 🍽️ Módulo de Gestión de Catering

## 📋 Descripción General

El módulo de catering es una funcionalidad completa integrada en la aplicación SSS Kronos que permite gestionar de forma ordenada, colaborativa y eficiente todos los pasos desde que un cliente solicita un catering hasta que se finaliza el servicio.

## 🎯 Objetivos

- **Centralización**: Una sola herramienta para gestionar eventos, presupuestos, pedidos, checklists y hojas de ruta
- **Automatización**: Reducir errores y tiempos de respuesta con automatizaciones clave
- **Colaboración**: Trabajo en equipo eficiente con roles específicos
- **Trazabilidad**: Seguimiento completo del proceso de catering

## 🏗️ Arquitectura del Módulo

### Estructura de Carpetas

```
src/components/catering/
├── CateringDashboard.jsx      # Dashboard principal
├── NewEventForm.jsx          # Formulario de nuevo evento
├── EventDetails.jsx          # Detalles completos del evento
├── BudgetPage.jsx            # Gestión de presupuestos
├── CalendarPage.jsx          # Vista de calendario
├── CateringContext.jsx       # Contexto global de catering
└── [futuros componentes]     # Pedidos, Checklists, etc.
```

### Base de Datos

```
catering_events              # Eventos principales
catering_budgets             # Presupuestos
catering_budget_items        # Items de presupuesto
catering_menus               # Menús y alimentación
catering_logistics           # Logística
catering_staff               # Personal asignado
catering_orders              # Pedidos
catering_order_items         # Items de pedidos
catering_checklists          # Checklists
catering_routes              # Hojas de ruta
catering_notifications       # Notificaciones
```

## 🧩 Módulos y Funcionalidades

### 1. 🏠 Dashboard
- **Vista de próximos eventos** con filtros por estado
- **Estadísticas rápidas** (total eventos, aceptados, en preparación, pendientes)
- **Accesos rápidos** a nuevas tareas
- **Búsqueda y filtrado** avanzado

### 2. 📥 Nuevo Evento
- **Formulario completo** para registrar entrada
- **Validaciones** en tiempo real
- **Campos obligatorios**: nombre cliente, fecha, tipo evento, ubicación, invitados
- **Estado inicial**: "Recibido" automáticamente

### 3. 📄 Full de Comanda
- **Formulario detallado** para toda la información del evento
- **Checklists integrados** para no olvidar nada
- **Campos validados** y posibilidad de editar
- **Secciones organizadas**: información cliente, detalles evento, menú, logística, personal

### 4. 📊 Presupuesto
- **Generación automática** del presupuesto a partir del Full de Comanda
- **Exportación como PDF** (pendiente de implementar)
- **Estados del presupuesto**: enviado, aceptado, rechazado
- **Motivo de rechazo** cuando aplique

### 5. ✅ Hoja de Ruta
- **Creación automática** basada en presupuesto aceptado
- **Contiene**: logística, comida, personal asignado
- **Envío por WhatsApp/Email** con botón de "confirmar asistencia"

### 6. 🛒 Pedidos
- **Crear y registrar pedidos** a tienda interna (Cristina) o proveedores (Ingrid)
- **Ficha técnica adjunta** y checklist de productos entregados
- **Seguimiento de entregas**

### 7. 📦 Checklists de Oscar
- **Dos checklists clave**: preparación y retorno
- **Marcar entregado/no entregado** con observaciones
- **Asignación de tareas** por persona

### 8. 🗓 Agenda
- **Integración con Google Calendar** (pendiente)
- **Eventos con colores** según estado
- **Vista mensual/semanal/diaria**

### 9. 🔔 Notificaciones
- **Recordatorios automáticos** si falta completar tareas
- **Notificaciones en tiempo real**
- **Alertas de deadlines**

### 10. 👥 Usuarios y Roles
- **Joan Carles** (admin total)
- **Oscar** (sólo checklists)
- **Cristina** (solo pedidos)
- **Administración** (sólo presupuestos aceptados)

## 🚀 Instalación y Configuración

### 1. Ejecutar Scripts SQL

```bash
# Ejecutar el esquema de catering
psql -d your_database -f database/catering_schema.sql
```

### 2. Verificar Componentes

Los componentes ya están integrados en el Layout principal. El módulo aparecerá en el menú lateral como "Catering".

### 3. Configurar Permisos

Los permisos RLS están configurados para usuarios autenticados. Ajustar según necesidades específicas.

## 📱 Uso del Módulo

### Navegación Principal

1. **Dashboard**: Vista general de todos los eventos
2. **Nuevo Evento**: Crear un nuevo evento de catering
3. **Presupuestos**: Gestionar presupuestos
4. **Calendario**: Vista de calendario con eventos
5. **Detalles**: Ver/editar detalles completos de eventos

### Flujo de Trabajo Típico

1. **Recibir solicitud** → Crear nuevo evento
2. **Completar Full de Comanda** → Detalles completos
3. **Generar presupuesto** → Cálculo automático
4. **Enviar presupuesto** → Cliente
5. **Aceptación/Rechazo** → Actualizar estado
6. **Crear hoja de ruta** → Si aceptado
7. **Gestionar pedidos** → Cristina/Ingrid
8. **Checklists de Oscar** → Preparación y retorno
9. **Finalizar evento** → Completar checklists

## 🎨 Características de UX/UI

### Diseño Consistente
- **Paleta de colores**: Solucions Socials (verdes, grises, blancos)
- **Iconografía**: Feather Icons
- **Tipografía**: Consistente con el resto de la app
- **Animaciones**: Framer Motion para transiciones suaves

### Responsive Design
- **Desktop**: Vista completa con sidebar
- **Tablet**: Adaptación para pantallas medianas
- **Mobile**: Optimización para pantallas pequeñas

### Accesibilidad
- **Contraste adecuado** en todos los elementos
- **Navegación por teclado** completa
- **Etiquetas ARIA** para lectores de pantalla
- **Tamaños de fuente** legibles

## 🔧 Configuración Avanzada

### Variables de Entorno

```env
# Configuración de Google Calendar (futuro)
GOOGLE_CALENDAR_API_KEY=your_api_key
GOOGLE_CALENDAR_ID=your_calendar_id

# Configuración de WhatsApp API (futuro)
WHATSAPP_API_KEY=your_api_key
WHATSAPP_PHONE_NUMBER=your_phone_number
```

### Personalización de Estados

Los estados de eventos y presupuestos se pueden personalizar en:
- `CateringContext.jsx` - Estados principales
- `catering_schema.sql` - Estados en base de datos

### Integración con APIs Externas

#### Google Calendar (Pendiente)
```javascript
// Ejemplo de integración futura
const exportToGoogleCalendar = async (event) => {
  // Implementar exportación a Google Calendar
};
```

#### WhatsApp API (Pendiente)
```javascript
// Ejemplo de integración futura
const sendWhatsAppMessage = async (phone, message) => {
  // Implementar envío por WhatsApp
};
```

## 📊 Reportes y Analytics

### Métricas Disponibles
- **Total de eventos** por período
- **Tasa de aceptación** de presupuestos
- **Ingresos totales** por mes/año
- **Eventos por tipo** y estado
- **Performance del equipo** (checklists completados)

### Exportación de Datos
- **PDF**: Presupuestos y hojas de ruta
- **Excel**: Reportes de eventos y presupuestos
- **CSV**: Datos para análisis externo

## 🐛 Troubleshooting

### Problemas Comunes

#### 1. Eventos no se cargan
```bash
# Verificar conexión a Supabase
# Revisar permisos RLS
# Comprobar estructura de tablas
```

#### 2. Presupuestos no se calculan
```bash
# Verificar triggers de base de datos
# Comprobar items del presupuesto
# Revisar función calculate_budget_item_total()
```

#### 3. Contexto no funciona
```bash
# Verificar CateringProvider en Layout.jsx
# Comprobar imports de componentes
# Revisar estructura de carpetas
```

### Logs de Debug

```javascript
// Activar logs detallados
console.log('Catering Context:', cateringContext);
console.log('Events:', events);
console.log('Budgets:', budgets);
```

## 🔮 Roadmap y Futuras Funcionalidades

### Fase 2 (Próximas implementaciones)
- [ ] **Integración con Google Calendar**
- [ ] **Envío automático por WhatsApp**
- [ ] **Generación de PDFs**
- [ ] **Sistema de notificaciones push**
- [ ] **App móvil para Oscar**

### Fase 3 (Funcionalidades avanzadas)
- [ ] **IA para sugerencias de menú**
- [ ] **Análisis predictivo de costos**
- [ ] **Integración con proveedores**
- [ ] **Sistema de reviews de clientes**
- [ ] **Dashboard de analytics avanzado**

## 👥 Contribución

### Guías de Desarrollo
1. **Seguir el estilo** de código existente
2. **Usar TypeScript** para nuevos componentes
3. **Documentar funciones** importantes
4. **Probar en diferentes dispositivos**
5. **Mantener consistencia** con el diseño

### Estructura de Commits
```
feat(catering): añadir funcionalidad de presupuestos
fix(catering): corregir cálculo de totales
docs(catering): actualizar documentación
style(catering): mejorar diseño del dashboard
```

## 📞 Soporte

Para dudas o problemas con el módulo de catering:

1. **Revisar esta documentación**
2. **Consultar logs de la aplicación**
3. **Verificar configuración de Supabase**
4. **Contactar al equipo de desarrollo**

---

**Versión**: 1.0.0  
**Última actualización**: Febrero 2024  
**Mantenido por**: Equipo SSS Kronos 