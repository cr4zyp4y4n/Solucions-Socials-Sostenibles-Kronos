# 📚 Documentación de Soluciones

Esta carpeta contiene toda la documentación de soluciones y troubleshooting desarrolladas durante el proyecto.

## 📌 Cambios v2.1.21

- **Panel de Fichajes:** Los empleados que están trabajando en ese momento aparecen primero en la lista (orden por `trabajandoAhora`). Documentación: [PANEL_FICHAJES.md](./PANEL_FICHAJES.md).
- **Eliminación de usuarios desde Admin:** La eliminación de usuarios usa la RPC `complete_delete_user_cascade` en lugar de `auth.admin.deleteUser`, evitando el error 403 (User not allowed) con la clave anon. Para que el borrado desde Supabase también funcione sin error de FK, ejecutar la migración [../database/fix_audit_logs_notifications_cascade_delete.sql](../database/fix_audit_logs_notifications_cascade_delete.sql) en el SQL Editor de Supabase (añade ON DELETE CASCADE en `audit_logs` y `notifications` hacia `auth.users`).

## 📋 Índice de Documentación

### 🔧 **Configuración Inicial**
- **[SETUP_SUPABASE.md](./SETUP_SUPABASE.md)** - Configuración completa de Supabase
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Guía general de solución de problemas

### 🚨 **Soluciones de Errores**

#### **Errores de Base de Datos**
- **[SOLUCION_ERROR_SIZE.md](./SOLUCION_ERROR_SIZE.md)** - Error de columna `size` en `excel_uploads`
- **[SOLUCION_ERROR_RLS_INVOICES.md](./SOLUCION_ERROR_RLS_INVOICES.md)** - Políticas RLS para tabla `invoices`

#### **Errores de Notificaciones**
- **[SOLUCION_ERROR_NOTIFICATIONS.md](./SOLUCION_ERROR_NOTIFICATIONS.md)** - Configuración inicial de notificaciones
- **[SOLUCION_ERROR_NOTIFICATIONS_EXISTING.md](./SOLUCION_ERROR_NOTIFICATIONS_EXISTING.md)** - Corrección para tabla existente

#### **Errores de Permisos**
- **[SOLUCION_RLS_JEFES_ADMINISTRADORES.md](./SOLUCION_RLS_JEFES_ADMINISTRADORES.md)** - Políticas RLS para jefes y administradores

### 🔄 **Soluciones de Funcionalidad**

#### **Gestión de Datos**
- **[SOLUCION_SOBREESCRITURA_DATOS.md](./SOLUCION_SOBREESCRITURA_DATOS.md)** - Sobreescritura inteligente de datos Excel
- **[SOLUCION_DATOS_INICIO.md](./SOLUCION_DATOS_INICIO.md)** - Carga de datos en página de Inicio

#### **Módulos y funcionalidades**
- **[PANEL_FICHAJES.md](./PANEL_FICHAJES.md)** - Panel de Fichajes (resumen por empleado, acceso desde Admin)
- **[GESTION_TIENDA.md](./GESTION_TIENDA.md)** - Módulo Gestión Tienda (Hojas Técnicas, Confirmación Productos)

## 🎯 **Orden de Aplicación Recomendado**

1. **Configuración inicial**: `SETUP_SUPABASE.md`
2. **Errores de base de datos**: `SOLUCION_ERROR_SIZE.md`
3. **Políticas RLS**: `SOLUCION_ERROR_RLS_INVOICES.md`
4. **Notificaciones**: `SOLUCION_ERROR_NOTIFICATIONS.md` o `SOLUCION_ERROR_NOTIFICATIONS_EXISTING.md`
5. **Permisos de jefes**: `SOLUCION_RLS_JEFES_ADMINISTRADORES.md`
6. **Funcionalidades**: `SOLUCION_SOBREESCRITURA_DATOS.md` y `SOLUCION_DATOS_INICIO.md`

## 📁 **Estructura de Archivos**

```
docs/
├── README.md                                    # Este archivo índice
├── SETUP_SUPABASE.md                           # Configuración inicial
├── TROUBLESHOOTING.md                          # Guía general
├── PANEL_FICHAJES.md                           # Panel de Fichajes (v2.1.21)
├── GESTION_TIENDA.md                           # Módulo Gestión Tienda
├── SOLUCION_ERROR_SIZE.md                      # Error de columna size
├── SOLUCION_ERROR_RLS_INVOICES.md             # Políticas RLS invoices
├── SOLUCION_ERROR_NOTIFICATIONS.md            # Notificaciones inicial
├── SOLUCION_ERROR_NOTIFICATIONS_EXISTING.md   # Notificaciones existente
├── SOLUCION_RLS_JEFES_ADMINISTRADORES.md     # Permisos jefes
├── SOLUCION_SOBREESCRITURA_DATOS.md          # Sobreescritura datos
└── SOLUCION_DATOS_INICIO.md                  # Datos en página inicio
```

## 🔍 **Búsqueda Rápida**

### **Por Tipo de Error**
- **Errores de base de datos**: `SOLUCION_ERROR_*.md`
- **Errores de notificaciones**: `SOLUCION_ERROR_NOTIFICATIONS*.md`
- **Errores de permisos**: `SOLUCION_RLS_*.md`

### **Por Funcionalidad**
- **Configuración**: `SETUP_*.md`, `TROUBLESHOOTING.md`
- **Módulos**: `PANEL_FICHAJES.md`, `GESTION_TIENDA.md`
- **Gestión de datos**: `SOLUCION_SOBREESCRITURA_*.md`, `SOLUCION_DATOS_*.md`

## 📝 **Notas Importantes**

- Todos los archivos contienen instrucciones paso a paso
- Cada solución incluye scripts SQL cuando es necesario
- Las soluciones están ordenadas cronológicamente
- Se incluyen verificaciones y troubleshooting

## 🚀 **Próximos Pasos**

Después de aplicar todas las soluciones, el sistema estará listo para:
- ✅ Gestión completa de proveedores
- ✅ Análisis avanzado de datos
- ✅ Notificaciones en tiempo real
- ✅ Sistema de roles y permisos
- ✅ Dashboard ejecutivo

---

*Última actualización: v2.1.21 (febrero 2025)* 