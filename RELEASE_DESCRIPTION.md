## v2.4.4

### Firma (Kronos + portal de firma)

- **Seguimiento por fases en la lista de envíos:** el badge ya no muestra solo el estado crudo de base de datos; refleja el flujo **Enlace enviado → Enlace abierto → SMS OTP enviado → Firmado** (y **Cancelado** cuando aplique), con iconos distintos.
- **Marcas de tiempo en base de datos** (requieren SQL en Supabase; ver `database/alter_firma_documentos_tracking.sql` y `database/alter_firma_documentos_otp.sql`):
  - **`link_compartido_at`:** primera vez que se comparte el enlace desde Kronos (WhatsApp, email, copiar enlace o copiar mensaje); el SMS de enlace desde Kronos también lo rellena.
  - **`portal_abierto_at`:** primera carga válida de la página del portal con el token (servidor + `POST` desde el cliente para evitar cachés).
  - **`otp_primera_solicitud_at`:** primera solicitud de código OTP en el portal (tras envío SMS o modo debug).
- **Modal de cronología:** al pulsar el badge se abre un resumen con fecha/hora de cada paso (creación, compartir, portal, OTP, firma y cancelación con nota sobre `updated_at`).
- **Kronos — fiabilidad del paso OTP:** si la columna `otp_primera_solicitud_at` no llega a actualizarse desde el portal, la lista infiere la primera solicitud OTP mediante la RPC segura **`firma_otp_primera_solicitud`**, sin exponer hashes OTP.
- **Portal de firma:** ruta `POST /firmar/[token]/open` para registrar apertura; ruta OTP devuelve **`otpSeguimiento`** y el cliente puede mostrar aviso si el registro en documento falla; `export const dynamic = 'force-dynamic'` en la página del token; aviso en consola si falta `SUPABASE_SERVICE_ROLE_KEY`.
- **Limpieza de UX:** eliminado del modal el paso independiente «SMS del enlace (desde Kronos)»; el compartir por canales queda unificado en el paso de enlace compartido (WhatsApp, etc.).

### Supabase (opcional)

- **`database/optional_firma_otp_primera_solicitud_rpc.sql`:** solo si `firma_otp_challenges` tiene RLS y Kronos necesita el fallback del OTP; crea la RPC segura `firma_otp_primera_solicitud` y elimina cualquier política previa de `SELECT` directo a `authenticated`.

---

## v2.4.2

### PIG (Menjar d’Hort)

- **Selector de empresa (EISSS vs MH):** el generador de PIG permite escoger empresa y evita mezclar hojas entre reportes.
- **Workbook MH con hojas exactas:**
  - `PIG GENERAL MH`
  - `PIG GENERAL MH A <MES ANTERIOR>` (dinámico según último mes con datos)
  - `DESPESES MP-APROV-PRFIRPF` (Grupo 6)
  - `SUELDOS Y SALARIOS GENERAL` (Grupo 8)
  - `OTROS GASTOS` (Grupo 9)
  - `PIG LINEA OBRADOR` (sin subvenciones/estimados)
  - `PIG LINEA OBRADOR 2` (subset de cuentas definidas)
- **`PIG LINEA OBRADOR`:** incluye `TOTAL BENEFICIO POR MES OBRADOR` y las 2 tablas de `TOTAL COMPUTADO` (último mes con datos y mes anterior).
- **Estilos tablas inferiores (Obrador):** se arreglan merges/estilos de las tablas de `TOTAL COMPUTADO` para que no hereden el formato de la tabla principal (misma solución que en EISSS).

### Import Holded (CSV/XLSX)

- **Soporte “trimestre actual”:** el mensual detecta cabeceras que empiezan por cualquier mes (Abril/Julio/Octubre…) y mapea correctamente las columnas al mes real (ej. Abril–Junio → 04–06), evitando que se desplacen a Enero–Marzo.
- **Títulos/rangos reales:** los títulos de PIG GENERAL usan el inicio real del rango cuando el export es trimestral (ej. `01/04/26 A 30/06/26`).

### Subvenciones

- **Eliminado “Importes por cobrar”:** se retira de la tabla y del modal (ya no se muestra ni se envía al guardar).
- **Fases más claras en el modal:** el selector muestra `FASE X (descripción)` e incorpora la **FASE 4.1 (anticipo)**.
- **SOC L1 / SOC L2:** se indica en el modal que estos campos aplican **solo** a SOC / Empresa de Inserción.
