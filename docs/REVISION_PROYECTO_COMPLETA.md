# Revisión exhaustiva del proyecto SSS Kronos

Documento generado para entender **cómo funciona** el proyecto y **qué hace cada sección**. Incluye arquitectura, flujos, roles, páginas, servicios y datos.

---

## 1. Visión general

**SSS Kronos** es una **aplicación de escritorio** (Electron + React) para la gestión administrativa de **Solucions Socials** y **Menjar d'Hort**. Centraliza en una sola app:

- Análisis de facturas (compras y ventas) desde Holded
- Fichajes de empleados con cumplimiento normativo
- Subvenciones (EI SSS y Menjar d'Hort)
- Socios IDONI (carnets, importación CSV)
- Hojas de ruta de catering
- Gestión de tienda (hojas técnicas, confirmación de productos)
- Panel de administración (usuarios, roles, auditoría)

**Tecnologías:** Electron 37, React 19, Supabase (auth + DB + storage), API Holded. Build con Electron Forge (Squirrel Windows, zip darwin). Portal de fichajes aparte: Vite + React en Netlify.

---

## 2. Arquitectura de la aplicación

### 2.1 Punto de entrada y proceso principal

- **`src/main.js`** (proceso principal Electron):
  - Crea la ventana, configura `webSecurity: false` y CSP para Tesseract/workers.
  - **Auto-updater:** feed GitHub, descarga automática, IPC para notificar al renderer.
  - **IPC handlers:** `check-for-updates`, `download-update`, `install-update`, `get-app-version`, `check-release-files`, `download-latest-executable`, `get-exchange-rates`, **`make-holded-request`** (todas las peticiones a Holded pasan por aquí desde el main para evitar CORS).
  - **Problema de seguridad:** la API key de Exchange Rate API está hardcodeada en la URL (`91eff644eb7dc35f0dc510de`). Debería estar en variables de entorno.

- **`src/preload.js`**:
  - Expone de forma segura al renderer: `electronAPI` con `getExchangeRates`, `makeHoldedRequest`, `checkForUpdates`, `downloadUpdate`, `installUpdate`, `getAppVersion`, `checkReleaseFiles`, `downloadLatestExecutable`, y listeners de actualización.

- **`src/renderer.js`**:
  - Monta la app React con providers: `ThemeProvider` → `AuthProvider` → `DataProvider` → `CurrencyProvider` → `AppContent`.
  - **AppContent:** si no está autenticado → `LoginPage`; si está autenticado → splash de bienvenida (una vez) y luego `MainApp`.

### 2.2 MainApp y navegación

- **`MainApp.jsx`:** solo envuelve la app en `NavigationProvider` y renderiza `Layout`.
- **`NavigationContext.jsx`:** estado `activeSection` y función `navigateTo(section)`. No usa URL (SPA por estado).
- **`Layout.jsx`:**
  - Carga el perfil del usuario desde `user_profiles` (nombre, rol, `onboarding_completed`).
  - Si el rol es `user`, redirige a la sección Fichaje al entrar.
  - Menú lateral filtrado por rol (`allMenuItems` + filtro por `userProfile?.role`).
  - Admin tiene además: Catering, Usuarios, Auditoría.
  - Header con notificaciones en tiempo real (Supabase Realtime en tabla `notifications`), tema claro/oscuro, actualizaciones, y bloque de usuario que lleva al perfil.
  - Renderizado de la sección actual con `renderSection()` según `activeSection` y permisos (AccessDenied si no corresponde al rol).
  - Onboarding: si `onboarding_completed` es false, muestra `OnboardingPage` encima de todo.

### 2.3 Contextos globales

| Contexto | Ubicación | Qué hace |
|----------|-----------|----------|
| **ThemeContext** | `ThemeContext.jsx` | Tema claro/oscuro, persistido en `localStorage`; objeto `colors` para toda la UI. |
| **AuthContext** | `AuthContext.jsx` | Login/logout con `authService` (Supabase Auth), estado `user`, `loading`, `error`; escucha `onAuthStateChange`. |
| **DataContext** | `DataContext.jsx` | Datos de Holded por empresa: `solucionsHeaders/Data`, `menjarHeaders/Data`, `idoniHeaders/Data`; caché por empresa (5 min); `shouldReloadHolded`; helpers para limpiar datos y ver si una pestaña necesita actualización. |
| **CurrencyContext** | `CurrencyContext.jsx` | Moneda seleccionada (EUR, USD, etc.), tasas de cambio vía IPC `get-exchange-rates`; `formatCurrency` para mostrar importes. |
| **NavigationContext** | `NavigationContext.jsx` | `activeSection` y `navigateTo(section)`. |
| **CateringContext** | `catering/CateringContext.jsx` | Estado del módulo catering: eventos, vista actual (dashboard, new-event, event-details, budget, calendar); notificaciones al cambiar estado de evento o editar; navegación interna. |

---

## 3. Roles y permisos

Los roles se leen de **`user_profiles.role`** (y fallback a `user.user_metadata.role`). Valores: `admin`, `management`, `manager`, `user`, `tienda`.

- **admin:** acceso a todo, incluido Catering, Usuarios (AdminPanel), Auditoría.
- **management / manager:** Análisis, Resum Caterings, Inventario (manager + tienda), Subvenciones, Empleados, Hoja de Ruta, Panel Fichajes, Socios, Contactos, Configuración. No Catering ni Usuarios ni Auditoría.
- **tienda:** Inventario, Socios, Gestión Tienda, Fichaje, Configuración (según menú).
- **user:** solo Inicio (vista mínima), Fichaje y Configuración; al entrar se redirige a Fichaje.

Las comprobaciones de acceso se hacen en `Layout.jsx` (menú filtrado y `renderSection` con `AccessDenied`).

---

## 4. Secciones (páginas) y qué hace cada una

| Sección (key) | Componente | Descripción breve |
|---------------|------------|-------------------|
| **home** | `HomePage` | Dashboard de inicio: resumen por empresa (Solucions/Menjar/IDONI), subida de Excel con cabeceras esperadas, vista previa, guardado en Supabase (`excel_uploads`, `invoices`); enlace a Tienda Dashboard; datos desde Holded o desde caché/DataContext. |
| **analytics** | `AnalyticsPage` | Análisis de facturas: datos desde Holded (compras) y/o Supabase (solucions_invoices, bruno_invoices). Vistas: General, Sergi (canales por tags: Estructura, Catering, IDONI), Bruno (por proveedor/cliente). Filtros por año/mes, exportación Excel con verificación IBAN y modal de confirmación humana. IDONI: ventas por día/semana, productos, gráficos. Muy grande (~9000+ líneas). |
| **sales-invoices** | `SalesInvoicesPage` | “Resum Caterings”: facturas de **venta** desde Holded (Solucions y Menjar). Tabla con cliente, descripción, tags, totales; filtro por cliente, columnas seleccionables, ordenación. |
| **inventory** | `InventoryPage` | Productos de Holded (Solucions y Menjar): listado, búsqueda, ordenación, CRUD vía Holded API; modal `ProductFormModal` para crear/editar. Solo admin/manager/tienda. |
| **innuva-converter** | `InnuvaConverterPage` | Conversor de archivos Innuva a formato compatible con Holded: subida Excel, preview, mapeo de columnas, generación de “borrador” para importar en Holded; log de conversión. |
| **subvenciones** | `SubvencionesPage` | Gestión de subvenciones: fases, abonos, saldos (EI SSS y Menjar d'Hort). Importación CSV, filtros, comentarios. Usa `subvencionesService` y `menjarDhortService` / `eiSubvencionesService` y datos en Supabase. |
| **empleados** | `EmpleadosPage` | Lista de empleados desde Holded (Solucions / Menjar d'Hort). Detalle por empleado, historial de servicios (hojas de ruta), estadísticas de horas. Enlace a Panel Fichajes. Roles que pueden ver horas: jefe, admin, gestión. |
| **hoja-ruta** | `HojaRutaPage` | Hojas de ruta de catering: listado, creación, edición (personal, checklist, equipamiento, menús, notas). Subida Excel/CSV (`HojaRutaUploadModal`), histórico, firma de confirmación. Servicio: `hojaRutaSupabaseService`. |
| **fichaje** | `FichajePage` | Fichaje de entrada/salida por **código** (no login de usuario app). Flujo: introducir código → validar con `fichajeCodigosService` → fichar entrada/salida/pausas con `fichajeService` + `fichajeSupabaseService`. Calendario mensual, resumen de horas, detalle y edición de fichajes (con ubicación si existe). Notificaciones de descansos obligatorios. |
| **panel-fichajes** | `PanelFichajesPage` | Panel para jefes/admin: ver fichajes de todos los empleados, vacaciones, bajas, editar fichajes, historial con motivo y ubicación. Solo admin/management/manager. |
| **socios** | `SociosPage` | CRUD de socios IDONI: carnets, importación CSV, búsqueda, DNI y teléfono. Modal de carnet (`CarnetSocioModal`), `sociosService` contra Supabase. |
| **gestion-tienda** | `GestionTiendaPage` | Dos pestañas: **Hojas Técnicas** (`HojasTecnicasSection`) y **Confirmación Productos Tienda** (`ConfirmacionProductosSection`). Hojas técnicas de platos; confirmación de productos por hoja de ruta. Solo admin/manager/tienda. |
| **contacts** | `ProvidersContacts` | Contactos de Holded (proveedores/clientes): Solucions/Menjar, búsqueda, filtro por IBAN, búsqueda por IBAN, paginación. |
| **catering** | `CateringApp` | Solo admin. Subvistas: Dashboard, Nuevo evento, Detalle evento, Presupuesto, Calendario. Eventos en Supabase; notificaciones al cambiar estado o editar. `CateringContext` + `CateringDashboard`, `NewEventForm`, `EventDetails`, `BudgetPage`, `CalendarPage`. |
| **albaran-ocr** | `AlbaranOCRPage` | OCR de albaranes: subir imagen o PDF, extracción de texto con Tesseract.js, parsing y vista previa. |
| **settings** | `SettingsPage` | Configuración: tema, moneda, pruebas de conexión (Supabase, Holded Solucions/Menjar), sección Holded Test, actualizaciones (comprobar/instalar/descargar instalador), limpieza de caché, info de BD. |
| **users** | `AdminPanel` | Solo admin. Pestañas: Usuarios (CRUD en `user_profiles`, roles, deshabilitar, restablecer contraseña), Fichajes (FichajeAdminSection), Códigos de fichaje (FichajeCodigosAdmin), Descansos (FichajeDescansosAdmin). |
| **audit** | `AuditLog` | Solo admin. Registro de auditoría (tabla de logs en Supabase). |
| **profile** | `UserProfile` | Perfil del usuario actual y opción de volver a mostrar onboarding. |

---

## 5. Servicios (capa de datos y lógica)

| Servicio | Archivo | Función principal |
|----------|---------|--------------------|
| **holdedApi** | `holdedApi.js` | Clase que usa **IPC** `make-holded-request` para facturas compra/venta, contactos, productos, etc. Dos empresas: `solucions` y `menjar` (API keys en código; idealmente env). |
| **holdedEmployeesService** | `holdedEmployeesService.js` | Empleados de Holded (Solucions/Menjar) vía API. |
| **fichajeService** | `fichajeService.js` | Orquesta entrada/salida/pausas: valida estado, cierra fichajes “olvidados”, llama a `fichajeSupabaseService`. |
| **fichajeSupabaseService** | `fichajeSupabaseService.js` | CRUD de fichajes en Supabase (tablas tipo `fichajes`), obtener por día, crear entrada/salida, pausas, horas trabajadas. |
| **fichajeCodigosService** | `fichajeCodigosService.js` | Códigos de fichaje: buscar empleado por código (tabla `fichajes_codigos`), sin depender de Holded para el login de fichaje. |
| **fichajeDescansosService** | `fichajeDescansosService.js` | Configuración de descansos obligatorios (normativa). |
| **hojaRutaSupabaseService** | `hojaRutaSupabaseService.js` | Hojas de ruta en Supabase: CRUD, personal, checklist, equipamiento, menús, notas. |
| **hojaRutaService** | `hojaRutaService.js` | Procesamiento de Excel/CSV para hojas de ruta (parser). |
| **flexibleHojaRutaProcessor** | `flexibleHojaRutaProcessor.js` | Procesador flexible de hojas de ruta (columnas variables). |
| **subvencionesService** | `subvencionesService.js` | Lógica de subvenciones (EI SSS). |
| **subvencionesSupabaseService** | `subvencionesSupabaseService.js` | Persistencia de subvenciones en Supabase. |
| **menjarDhortService** | `menjarDhortService.js` | Subvenciones Menjar d'Hort: CSV horizontal, CRUD, filtros, estadísticas. |
| **eiSubvencionesService** | `eiSubvencionesService.js` | Procesamiento CSV EI (L1/L2) y servicio de subvenciones EI. |
| **sociosService** | `sociosService.js` | Socios IDONI: listado, crear, editar, eliminar, estadísticas, Supabase. |
| **brunoInvoicesService** | `brunoInvoicesService.js` | Facturas Bruno (por proveedor/cliente) en Supabase. |
| **solucionsInvoicesService** | `solucionsInvoicesService.js` | Facturas Solucions en Supabase. |
| **invoiceVisibilityService** | `invoiceVisibilityService.js` | Ocultar/mostrar facturas por rol (control de visibilidad). |
| **productosIdoniService** | `productosIdoniService.js` | Productos IDONI (ventas, análisis). |
| **productosIdoniSupabaseService** | `productosIdoniSupabaseService.js` | Persistencia productos IDONI en Supabase. |
| **hojasTecnicasService** | `hojasTecnicasService.js` | Hojas técnicas de platos (gestión tienda). |

---

## 6. Base de datos (Supabase)

- **Auth:** Supabase Auth (`auth.users`). Perfiles extendidos en `user_profiles` (nombre, rol, onboarding_completed, etc.).
- **Tablas principales (entre otras):** `user_profiles`, `excel_uploads`, `invoices`, `providers`, `analytics`; `fichajes`, `fichajes_codigos`, `notifications`; tablas de subvenciones, hojas de ruta, catering, socios, solucions_invoices, bruno_invoices, productos IDONI, hojas técnicas, etc.
- **RLS:** políticas por tabla y rol; muchos scripts en `database/*.sql` para fixes, migraciones y cascadas.
- **Config:** `src/config/supabase.js` crea el cliente con `SUPABASE_URL` y `SUPABASE_ANON_KEY` (fallback a valores por defecto si no hay env). Incluye `authService` y `dbService` básicos.

---

## 7. Portal de fichajes (subproyecto)

- **Carpeta:** `portal-fichajes/`.
- **Stack:** Vite + React, desplegado en Netlify (solo lectura).
- **Propósito:** que la inspección consulte el panel de fichajes en la nube (misma línea visual que el Panel Fichajes de Kronos).
- **Config:** `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`. Usuario de inspección creado en Supabase Auth; RLS permite lectura de fichajes a usuarios autenticados.

---

## 8. Build y despliegue

- **Scripts:** `npm run start` (dev), `npm run build` / `npm run make` (Electron Forge), `build-nsis` / `dist` con electron-builder.
- **Forge:** `forge.config.js` usa plugin Webpack (main + renderer), Squirrel y zip; publicador GitHub. En `package.json` los makers incluyen Squirrel (Windows con icono), zip (darwin), deb, rpm.
- **Auto-updater:** comprueba al iniciar (tras 3 s) y al usar “Verificar actualizaciones” en Configuración; descarga automática y notificación; instalación al cerrar o manual.

---

## 9. Observaciones y mejoras recomendadas

1. **Seguridad**
   - **API keys en código:** Holded en `holdedApi.js` (solucions/menjar) y Exchange Rate API en `main.js`. Mover a variables de entorno y usar solo en main/preload o build-time.
   - **Supabase:** `supabase.js` tiene fallback con anon key por defecto; en producción usar siempre `.env` y no commitear claves.

2. **Dependencias**
   - **dotenv:** se usa en `main.js` y `webpack.renderer.config.js` pero no está como dependencia directa en `package.json` (solo en lock como dependencia transitiva). Añadir `dotenv` como devDependency para evitar roturas.

3. **CurrencyContext**
   - Usa `window.require('electron')` para `ipcRenderer`; en renderer con `contextIsolation: true` esto no existe. Debería usar `window.electronAPI.getExchangeRates()` (ya expuesto en preload).

4. **Tests**
   - No hay tests automatizados (no hay `*.test.*`). Valorar añadir pruebas para servicios críticos (fichaje, subvenciones, sincronización Holded).

5. **Tamaño de componentes**
   - `AnalyticsPage.jsx` es muy grande (~9000+ líneas). Conviene dividir en subcomponentes o módulos (vistas General/Sergi/Bruno, IDONI, etc.) para mantener y testear.

6. **Documentación**
   - La carpeta `docs/` tiene guías (HOLDED_API_INTEGRATION, GESTION_TIENDA, PANEL_FICHAJES, CATERING_MODULE, TROUBLESHOOTING, etc.). Este documento complementa con la visión de conjunto y flujos.

---

## 10. Resumen de flujos clave

- **Login:** LoginPage → AuthContext (Supabase signIn) → carga de `user_profiles` en Layout → menú según rol → redirección a Fichaje si rol `user`.
- **Fichaje:** código en FichajePage → fichajeCodigosService → empleado identificado → fichajeService.ficharEntrada/Salida → fichajeSupabaseService → Supabase; notificaciones de descansos si aplica.
- **Análisis:** AnalyticsPage usa DataContext + Holded (vía IPC) y/o Supabase (solucions_invoices, bruno_invoices); vistas y filtros; export Excel con verificación IBAN.
- **Holded:** Cualquier petición a Holded desde el renderer pasa por preload → IPC `make-holded-request` → main.js hace la petición HTTPS y devuelve la respuesta (evita CORS y centraliza keys en main).
- **Actualizaciones:** main.js configura autoUpdater con feed GitHub; al haber nueva versión notifica al renderer; el usuario puede instalar desde Configuración o descargar el .exe manualmente.

Con esto se cubre el comportamiento global del proyecto y el papel de cada sección y servicio.
