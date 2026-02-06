# Panel de Fichajes

Documentación del **Panel de Fichajes** de SSS Kronos: resumen por empleado, estado en tiempo real y acceso desde Admin.

---

## Resumen

El **Panel de Fichajes** es una vista orientada a responsables (admin, management, manager) que muestra un resumen del mes actual por empleado: horas trabajadas, días trabajados, si está trabajando ahora y último fichaje. Desde aquí se puede abrir el perfil de cada empleado con calendario y listado de fichajes del mes.

**Ruta:** `/panel-fichajes` (menú lateral: "Panel Fichajes").

**Roles con acceso:** `admin`, `management`, `manager`.

---

## Funcionalidades

- **Resumen del mes actual:** Fichajes del mes en curso, calculados con `startOfMonth` / `endOfMonth` (date-fns).
- **Por empleado:** Horas totales trabajadas, días trabajados, total de fichajes, indicador "Trabajando ahora" y último fichaje (fecha/hora).
- **Búsqueda:** Filtro por nombre o email de empleado.
- **Perfil del empleado:** Al hacer clic en un empleado se abre `FichajeEmpleadoPerfil` con calendario del mes y listado de fichajes; botón "Volver" para regresar al panel.

---

## Acceso desde Admin

En **Admin** > pestaña **Fichajes** se muestra la sección de administración de fichajes (listado por fechas, filtros, edición, exportación PDF/CSV). Además, se ha añadido un enlace **"Abrir Panel Fichajes"** que navega directamente a `/panel-fichajes` para acceder al panel resumido por empleado sin salir de la app.

- **Ubicación:** Encima de la tabla de fichajes en Admin > Fichajes.
- **Comportamiento:** Al hacer clic se cambia la vista a Panel de Fichajes (`navigateTo('panel-fichajes')`).

---

## Componentes y servicios

| Archivo | Descripción |
|---------|-------------|
| `PanelFichajesPage.jsx` | Página principal: listado de empleados con resumen del mes y búsqueda. |
| `FichajeEmpleadoPerfil.jsx` | Perfil de un empleado: calendario mensual y listado de fichajes. |

**Servicios:**

- `fichajeSupabaseService.js`: `obtenerTodosFichajes({ fechaInicio, fechaFin })` para cargar los fichajes del mes.
- `holdedEmployeesService.js`: empleados de Solucions y Menjar para el listado.

---

## Relación con otras vistas de fichaje

- **Fichaje (empleado):** Vista donde el empleado ficha entrada/salida y pausas (`/fichaje`).
- **Admin > Fichajes:** Listado completo de fichajes con filtros por fecha y empleado, edición y exportación (`FichajeAdminSection`).
- **Panel Fichajes:** Vista resumida por empleado y mes, pensada para supervisión rápida y acceso al perfil de cada uno.
