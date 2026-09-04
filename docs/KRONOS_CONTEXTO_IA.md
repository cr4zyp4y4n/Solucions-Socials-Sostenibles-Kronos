# SSS Kronos — Contexto técnico y funcional (para IA)

> Documento de referencia sobre el estado actual del proyecto **SSS Kronos** (v2.5.2).  
> Organización: **Solucions Socials Sostenibles** (EI.SSS, IDONI, Catering, Koiki, Obrador, etc.).  
> **No incluye secretos** (API keys, tokens): están en `.env` local.

---

## 1. Qué es Kronos

Aplicación de **escritorio Windows** (Electron) para gestión interna: finanzas, RRHH, operaciones (catering, obrador, tienda), subvenciones, licitaciones, firma documental, fichaje, etc.

- **Producto:** SSS Kronos  
- **Paquete npm:** `sss-kronos`  
- **Repositorio releases:** GitHub `cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos`  
- **Código principal:** carpeta `seleccion-proveedores/`  
- **Idioma UI:** catalán / español mezclado según módulo  
- **Usuarios:** empleados internos con roles; no es una app pública

---

## 2. Stack tecnológico global

| Capa | Tecnología |
|------|------------|
| Desktop | **Electron 37** + **Electron Forge** (webpack plugin) |
| UI | **React 19**, CSS inline + `index.css`, **Framer Motion** |
| Iconos | **Lucide React**, **Feather Icons React** |
| Gráficos | **Chart.js** + **react-chartjs-2** |
| Excel | **xlsx**, **xlsx-js-style** (estilos + fórmulas `cell.f`) |
| PDF | **jspdf**, **jspdf-autotable**, **pdfjs-dist** |
| OCR | **Tesseract.js** (albaranes) |
| Fechas | **date-fns**, **date-fns-tz** |
| Backend datos | **Supabase** (PostgreSQL + Auth + Storage + Realtime + RLS) |
| ERP / facturación | **Holded API v1** y **v2** |
| Actualizaciones | **electron-updater** (feed GitHub) |
| Cron (main) | **node-cron** (sync licitaciones en background) |
| QR | **qrcode.react** (trazabilidad obrador) |

**Arquitectura Electron:**

- `src/main.js` — proceso principal (IPC, Holded, auto-update, licitaciones HTTP, .env)
- `src/preload.js` — `contextBridge` → `window.electronAPI`
- `src/renderer.js` — entry React
- `src/components/` — pantallas y UI
- `src/services/` — lógica de negocio y APIs
- `database/` — migraciones SQL Supabase (146+ scripts)

---

## 3. Autenticación, roles y permisos

### Auth
- **Supabase Auth** (email/password)
- Perfil en tabla `user_profiles` (nombre, rol, onboarding)
- Sesión persistida; Realtime para notificaciones

### Roles (`sidebarNav.js` + comprobaciones en `Layout.jsx`)

| Rol | Descripción | Acceso típico |
|-----|-------------|---------------|
| `admin` | Administrador total | Todo, incl. Catering, Usuarios, Auditoría |
| `management` | Gestión / dirección | Casi todo excepto Catering y admin puro |
| `manager` | Jefe de equipo / tienda | Operaciones, inventario, fichajes panel, etc. |
| `tienda` | Personal tienda IDONI | Inicio, inventario, gestión tienda, fichaje, socios |
| `user` | Empleado básico | Solo **Inicio**, **Fichaje**, **Configuración** |

La navegación lateral se agrupa en: Resumen, Operaciones, RRHH, Finanzas, Comercial, Administración.

### Privacidad
- **PrivacyContext** + componente `Sensitive`: ocultar importes/datos sensibles en pantalla
- Modo oscuro/claro (**ThemeContext**)

---

## 4. Mapa de secciones (menú → componente → datos)

### 4.1 Inicio (`HomePage`)
- Dashboard según rol (tienda vs gestión)
- Importación **Excel Holded** (compras) → procesado local + Supabase
- KPIs con datos Holded y Supabase
- **Tech:** XLSX, holdedApi, Supabase, Chart.js

### 4.2 Análisis (`AnalyticsPage`)
- Análisis de facturas / proveedores
- Servicios: `holdedApi`, `brunoInvoicesService`, `solucionsInvoicesService` (tablas Supabase cache)
- Visibilidad facturas: `invoiceVisibilityService`

### 4.3 Catering (`CateringApp`) — solo admin
- Eventos, presupuestos, calendario
- **Supabase** (eventos catering; context `CateringContext`)
- Notificaciones pueden abrir evento concreto

### 4.4 Resum Caterings (`SalesInvoicesPage`)
- Resumen facturación catering desde Holded

### 4.5 Hoja de Ruta (`HojaRutaPage`, modales, equipamiento)
- Planificación rutas IDONI / personal
- **Supabase:** `hoja_ruta_*`, vacaciones, bajas
- Integración Holded (cuentas/proyectos)
- Upload Excel/PDF, hojas técnicas vinculadas

### 4.6 Inventario (`InventoryPage`)
- Stock Holded (`holdedApi`, empresa `solucions`)

### 4.7 Obrador (`ObradorApp`)
- Trazabilidad AC3: recepciones, lotes, expediciones, incidencias, productos
- **Supabase:** tablas `obrador_*` (SQL en `database/create_obrador_ac3_tables.sql` y alters)
- Sync proveedores Holded (`obradorHoldedSyncService`)
- OCR albaranes (`obradorAlbaranParser`, `obradorOcrFromFile` — Tesseract/pdf)
- Portal público trazabilidad: **`OBRADOR_TRACE_BASE_URL`** (app Netlify separada, ej. `portalobrador.netlify.app`)
- QR codes con URL de trazabilidad

### 4.8 Gestión Tienda (`GestionTiendaPage`)
- Hojas técnicas (`hojasTecnicasService` → Supabase)
- Confirmación productos tienda (`productosIdoniSupabaseService`)

### 4.9 Empleados (`EmpleadosPage`)
- Listado empleados Holded HR + datos Supabase (hoja ruta, subvenciones)
- `holdedEmployeesService`, `hojaRutaSupabaseService`, `subvencionesService`

### 4.10 Firma (`FirmaPage`)
- Envío documentos a firmar (LOPD, contratos, onboarding)
- **Supabase:** `firma_trabajadores`, `firma_envios`, `firma_documentos`, `firma_tokens`, `firma_auditorias`, `firma_otp_challenges`
- **Storage bucket:** `firma-documentos`
- **API SMS externa:** `FIRMA_SMS_API_BASE` + secret (main process IPC)
- **Portal firma web:** `FIRMA_PORTAL_BASE_URL` (app separada en `firma.solucionssocials.org`)
- OTP, auditoría, notificaciones email (mailto vía Electron)

### 4.11 Fichaje (`FichajePage`) + Panel Fichajes (`PanelFichajesPage`)
- Fichaje entrada/salida, descansos, códigos, ubicación IP
- **Supabase:** `fichajes`, `fichaje_codigos`, políticas RLS por rol
- Geolocalización aproximada: IPC `get-location-by-ip` (main)
- Admin: edición, códigos, descansos (`FichajeAdminSection`, etc.)
- **SMS recordatorios (piloto):** horarios en `fichajes_sms_horarios` + log `fichajes_sms_envios`; Edge Function `fichaje-sms-recordatorios` + `pg_cron` (Kronos no hace falta 24/7). Guía: `docs/FICHAJE_SMS_RECORDATORIOS.md`

### 4.12 Brecha salarial (`BrechaSalarialPage`)
- Análisis brecha retributiva
- CSV nóminas + categorías Supabase (`brecha_empleados_categoria`)
- Holded equipos/nóminas (`brechaHoldedEquipo`, `holdedPayrollV1Service`)
- Export Excel (`brechaSalarialExcel.js`)

### 4.13 PIG (`PIGPage`) — Plan de Igualdad / Cuenta Resultados
Módulo financiero grande. Genera Excel multi-hoja desde CSV Holded (anual + mensual).

**Modos:**
- **PIG normal** (`generateExcel()`)
- **EISSS Cuenta Resultados** (`generateExcel({ cuentaResultados: true })`) → archivo `PIG_EISSS_Cuenta_Resultados_*.xlsx`

**Empresas:** EISSS (Solucions) y MH (Menjar d'Hort) — selector `pigEmpresa`

**Hojas típicas (EISSS):**
- CR GENERAL EISSS (+ hoja corte mes anterior)
- LINEA CATERING / IDONI / KOIKI
- ESTRUCTURA SUBV 740
- DESPESES MP, SUELDOS, OTROS GASTOS
- COMPARATIVA ANUAL
- TESORERÍA, PRESUPUESTOS, FACTURACIÓN PENDIENTE

**Datos:**
- CSV Holded parseados en cliente
- **Supabase config PIG:** estimados subvención, objetivos comparativa, bases históricas, tesorería previsiones, itinerario EI
- **Holded API v2:** tesorería, presupuestos, facturación pendiente, presupuestos catering
- **Fórmulas Excel** (solo Cuenta Resultados): `src/utils/pigExcelFormulas.js` — totales recalculables, cross-sheet subv L1/L2/IMPULSEM

**Servicios PIG:** `pig*Service.js` (15+ archivos)

### 4.14 Subvenciones (`SubvencionesPage`)
- Gestión subvenciones empleados/proyectos
- Supabase + Holded empleados + Menjar d'Hort (`menjarDhortService`)

### 4.15 Conversor Innuva (`InnuvaConverterPage`)
- Convierte export Innuva (RRHH) a formatos internos
- Catálogo trabajadores, horas FD (`innuva/`)

### 4.16 Licitaciones (`LicitacionsPage`)
- Agregador licitaciones públicas CPV filtrados
- **Fuentes HTTP (main process, no CSP renderer):**
  - **TED** `api.ted.europa.eu/v3/notices/search`
  - **PSCP Catalunya** Socrata `analisi.transparenciacatalunya.cat`
  - **PLACSP** Atom feeds `contrataciondelestado.es`
- **Supabase:** tabla `licitacions`
- **Cron background** en main: sync periódico + notificación renderer

### 4.17 Contactos (`ProvidersContacts`)
- Proveedores Holded

### 4.18 Socios IDONI (`SociosPage`)
- Socios cooperativa → Supabase `socios`

### 4.19 Usuarios (`UserManagement`) — admin
- CRUD usuarios Supabase Auth + perfiles

### 4.20 Auditoría (`AuditLog`) — admin
- Logs de acciones (`AdminPanel` también con herramientas admin)

### 4.21 Configuración (`SettingsPage`)
- Tema, conexiones Holded, preferencias
- Test Holded (`HoldedTest`)

### 4.22 Otras pantallas (sin entrada directa en menú principal)
- `AlbaranOCRPage` — OCR genérico albaranes (Tesseract)
- `HojaRutaEquipamientoLinkPage` — enlace equipamiento
- `OnboardingPage`, `UserProfile`
- `AdminPanel` — panel administración avanzada

---

## 5. APIs y conexiones externas

### 5.1 Supabase
- **URL:** variable `SUPABASE_URL` (.env)
- **Cliente:** `@supabase/supabase-js` en `src/config/supabase.js`
- **Uso:** Auth, Postgres (RLS), Storage, Realtime (notificaciones), RPC
- **Scripts SQL:** `database/*.sql` (crear tablas, RLS, seeds)

**Tablas principales (no exhaustivo):**

| Dominio | Tablas |
|---------|--------|
| Core | `user_profiles`, `notifications`, `audit_logs` |
| Facturas cache | `invoices`, `bruno_invoices`, `solucions_invoices`, `excel_uploads` |
| Fichaje | `fichajes`, fichaje_codigos, descansos |
| Hoja ruta | `hojas_ruta`, vacaciones, bajas |
| Subvenciones | `subvenciones_*`, empleados |
| Firma | `firma_*` + bucket storage |
| Obrador | `obrador_*` |
| Licitaciones | `licitacions` |
| PIG | `pig_estimados_subvencion`, `pig_objetivos_comparativa`, `pig_bases_historicas`, `pig_tesoreria_previsiones`, `pig_itinerario_ei` |
| Brecha | `brecha_empleados_categoria` |
| Socios | `socios` |
| Productos tienda | `productos_idoni`, hojas técnicas |

### 5.2 Holded

**v1 — Facturación / contabilidad / inventario**  
- Base: `https://api.holded.com/api/invoicing/v1`  
- Auth: header `key`  
- Proxy: IPC `make-holded-request` (main process)  
- Empresas en código: `solucions`, `menjar` (claves en `holdedHttpClient.js`; también configurables en UI)

**v2 — RRHH / nóminas / tesorería extendida**  
- Base: `https://api.holded.com/api/v2`  
- Auth: `Authorization: Bearer`  
- Claves: `.env` → `HOLDED_V2_API_KEY_SOLUCIONS`, `HOLDED_V2_API_KEY_MENJAR_DHORT`  
- Servicio: `holdedApiV2Service.js`

**Endpoints usados (ejemplos):**
- Compras, ventas, contactos, productos, proyectos, empleados, nóminas, cuentas tesorería, presupuestos, documentos

### 5.3 Firma (SMS + portal)
- `FIRMA_SMS_API_BASE`, `FIRMA_SMS_API_SECRET` — API envío SMS
- `FIRMA_PORTAL_BASE_URL` — portal web donde el trabajador firma
- Config leída en **main process**, expuesta al renderer vía `getFirmaSmsConfig`

### 5.4 Licitaciones (APIs públicas)
- TED, Transparencia Catalunya, PLACSP (ver §4.16)
- HTTP solo desde main: `licitacions-http-request`

### 5.5 Tipo de cambio
- IPC `get-exchange-rates` (main) — para `CurrencyContext`

### 5.6 Auto-update
- GitHub Releases → `electron-updater`
- IPC: check, download, install

### 5.7 Apps web hermanas (fuera del repo Electron)
- **Portal Firma:** firma.solucionssocials.org  
- **Portal Obrador trazabilidad:** Netlify (`OBRADOR_TRACE_BASE_URL`)

---

## 6. IPC Electron (`window.electronAPI`)

Expuesto en `preload.js`:

| Método | Uso |
|--------|-----|
| `makeHoldedRequest` | Todas las llamadas Holded v1/v2 |
| `licitacionsHttpRequest` | TED, PSCP, PLACSP |
| `getExchangeRates` | Divisas |
| `getLocationByIP` | Fichaje ubicación |
| `getFirmaSmsConfig` | Config firma desde .env |
| `openExternal` / `openMailto` / `openEmailDraft` | Enlaces y correo sistema |
| `writeClipboardText` | Portapapeles |
| `checkForUpdates` / `downloadUpdate` / `installUpdate` | Actualizaciones |
| `getAppVersion` | Versión app |
| `syncLicitacionsSession` | Sesión Supabase en main para cron |
| `onLicitacionsCronSync` | Eventos sync background |

---

## 7. Estructura de carpetas clave

```
seleccion-proveedores/
├── src/
│   ├── main.js                 # Electron main
│   ├── preload.js
│   ├── renderer.js
│   ├── config/supabase.js
│   ├── components/             # UI por módulo
│   │   ├── PIGPage.jsx         # ~5000 líneas, Excel generator
│   │   ├── Layout.jsx          # Shell + routing secciones
│   │   ├── catering/
│   │   ├── obrador/
│   │   ├── firma/
│   │   ├── innuva/
│   │   ├── licitacions/
│   │   └── analytics/
│   ├── services/               # 48 servicios JS
│   ├── utils/                  # Excel, OCR, privacidad, PIG fórmulas
│   ├── constants/              # sidebarNav, CPV licitaciones, firma docs
│   └── main/                   # licitaciones sync, email sistema
├── database/                   # SQL Supabase
├── docs/                       # Documentación (este archivo)
├── scripts/                    # Utilidades build/repair
├── .env                        # Secretos (NO commitear)
└── package.json                # v2.5.2
```

---

## 8. Flujos de datos importantes

### Excel Holded → Kronos → Supabase
1. Usuario exporta CSV/Excel desde Holded  
2. Sube en Inicio o módulo específico  
3. Parser XLSX en cliente  
4. Persistencia Supabase + visualización

### PIG / Cuenta Resultados
1. Dos CSV (anual + mensual Holded)  
2. `PIGPage.generateExcel()` construye AOA por hoja  
3. Estilos `xlsx-js-style`  
4. Si `cuentaResultados: true` → aplica fórmulas (`pigExcelFormulas.js`)  
5. Descarga `.xlsx` local (no sube a Supabase)

### Firma documental
1. Admin crea envío en Kronos  
2. PDFs → Supabase Storage  
3. SMS con enlace portal  
4. Trabajador firma en web externa  
5. Estado/auditoría en Supabase

### Fichaje
1. Empleado ficha en app  
2. Registro Supabase + timestamp + opcional ubicación IP  
3. Managers ven panel, editan, exportan

---

## 9. Comandos desarrollo

```bash
cd seleccion-proveedores
npm start          # Electron Forge dev
npm run make       # Build instalador
npm run package    # Empaquetar sin installer
```

Variables `.env` mínimas: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, claves Holded v2, config Firma, `OBRADOR_TRACE_BASE_URL`.

---

## 10. Convenciones y notas para IAs que modifiquen código

1. **React funcional** + hooks; estilos mayormente inline con `useTheme().colors`
2. **Servicios** separados de componentes; Supabase en `*SupabaseService.js` o `*Service.js`
3. **Holded siempre vía IPC** — no fetch directo desde renderer (CORS/seguridad)
4. **Roles:** comprobar en `Layout.jsx` y `sidebarNav.js` antes de añadir menús
5. **SQL:** nuevas tablas → script en `database/` + RLS
6. **Excel PIG:** preferir `xlsx-js-style`; fórmulas con `cell.f` + `cell.v` cacheado
7. **Idioma:** mensajes UI en español/catalán según pantalla existente
8. **No commitear** `.env` ni claves hardcodeadas nuevas
9. **PIGPage.jsx** es monolítico — cambios PIG requieren leer contexto amplio
10. **Empresas Holded:** `solucions` = EI.SSS; `menjar` / `menjar_dhort` = Menjar d'Hort

---

## 11. Estado reciente relevante (Cuenta Resultados)

El botón **「EISSS Cuenta Resultados」** en PIG genera un Excel extendido con:
- Subvenciones hardcodeadas por línea (CATERING, IDONI, KOIKI, ESTRUCTURA) en `PIG_CTA_RESULTADOS_SUBV`
- Hojas tesorería, presupuestos, facturación pendiente (datos Holded v2)
- **Fórmulas Excel** activas solo en este modo (totales y cross-sheet subvenciones GENERAL ↔ LINEA)
- PIG normal sin fórmulas (valores fijos como antes)

---

## 12. Contacto / autor

- Autor package.json: Brian Bautista  
- Organización: Solucions Socials Sostenibles  

---

*Generado como snapshot de contexto. Revisar `package.json` y `git log` para versión exacta desplegada.*
