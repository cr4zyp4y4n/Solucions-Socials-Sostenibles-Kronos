## v2.4.7

### Portal de firma — Onboarding

- **Modal de bienvenida al entrar:** antes de empezar el flujo de firma, el portal pregunta si es la primera vez y ofrece una guía paso a paso o ir directamente a firmar.
- **Guía en 4 pasos:** explica revisión del documento (o pack), respuesta Sí/No, verificación SMS y firma electrónica; el texto se adapta a documento único o pack multi-PDF.
- **Bloqueo visual hasta cerrar el modal:** el contenido del portal queda atenuado hasta que el usuario elige una opción.
- **Auditoría detallada en Kronos:** cada acción queda registrada en `firma_auditorias`:
  - modal mostrado,
  - guía iniciada (primera vez),
  - **saltado al inicio** («No, ir a firmar»),
  - **saltado a la mitad** («Saltar explicación», con paso X/Y),
  - pasos vistos,
  - guía completada.
- **Textos claros en auditoría:** «saltado» deja explícito que el usuario **continuó al portal de firma**, no que abandonó la web; si cierra la pestaña sin elegir, solo consta *modal visto sin respuesta*.
- **Nuevo paso en el seguimiento del envío:** entre «Primera visita al portal» y «SMS OTP» aparece el resultado del onboarding (completado, saltado al inicio, saltado a la mitad o modal sin respuesta).
- **SQL en Supabase (requerido):** ejecutar `database/alter_firma_envios_onboarding.sql` para las columnas `onboarding_modal_at`, `onboarding_resuelto_at` y `onboarding_resultado` en `firma_envios` y `firma_documentos`.

### Anàlisis — Informe Sergi

- **Nuevo Informe Sergi consolidado en Anàlisis:** se añade una vista específica para trabajar y exportar el Excel periódico de Sergi directamente desde Kronos.
- **Hojas iniciales de facturación de venta (2026):** el informe agrupa y exporta las hojas de **IDONI**, **CATERING**, **KOIKI** y **M'H** a partir de facturas de venta de Holded.
- **Clasificación por `Compte` real de Holded v2:** las facturas ya no dependen solo del texto visible importado; se enriquecen con las cuentas reales de las líneas de factura desde Holded `v2`, mejorando el reparto por canal.
- **Ajustes de negocio en la clasificación:**
  - **IDONI** excluye **`IDONI TPV`**.
  - Una misma factura puede aparecer en varias hojas si tiene varias cuentas relevantes (por ejemplo, una factura compartida entre **IDONI** y **CATERING**).
- **Presupuestos integrados dentro del Informe Sergi:** la hoja **PRESUPUESTOS** ya no va separada; muestra únicamente los presupuestos pendientes o parciales de 2026, calculando el estado **Facturat** cruzando presupuestos con facturas vinculadas.
- **Agrupación mensual en PRESUPUESTOS:** los presupuestos se agrupan por mes de vencimiento para facilitar la revisión.
- **Proformas integradas dentro del Informe Sergi:** la hoja **PROFORMAS** se exporta desde la misma vista, utilizando detalle `v2` y la señal correcta de `v1` para reflejar mejor los elementos visibles en Holded.
- **Nueva hoja `M'H -> EISSS`:** se añade una hoja específica para la facturación de **Menjar d'Hort** hacia **Empresa d'Inserció Solucions Socials Sostenibles**, filtrando únicamente las facturas **vencidas**.
- **Hoja `TESORERIA` vacía en el Excel:** el workbook exportado incorpora una hoja adicional para que el equipo de administración la complete manualmente.

### Exportación Excel

- **Workbook multihoja ampliado:** el Excel del Informe Sergi incluye todas las hojas del informe y respeta sus totales recalculados.
- **Mejora visual del Excel:** se aplica estilo de cabeceras, títulos, bloques resumen y acentos de color por hoja.
- **Paleta simplificada por canal:** se reduce el exceso de color y cada hoja usa solo 1-2 acentos visuales:
  - **IDONI:** rosa.
  - **CATERING / EISS / M'H -> EISSS / PRESUPUESTOS / PROFORMAS:** verde lima.
  - **KOIKI:** gris.
- **Selección previa antes de exportar:** al pulsar **Exportar Excel** se abre un modal donde se puede elegir, hoja por hoja, qué facturas incluir.
- **Checks por factura y recálculo de totales:** si se desmarca una fila, desaparece del Excel y se recalculan automáticamente los importes y contadores de esa hoja antes de exportar.
- **Modal de exportación más usable:**
  - altura estable al cambiar de hoja,
  - botones para **Marcar todo** / **Desmarcar todo** por hoja,
  - filas compactas con textos largos en una sola línea y `...` para reducir scroll vertical.

### Holded v2 / configuración

- **Nueva variable `HOLDED_V2_API_KEY_SOLUCIONS`:** se documenta y utiliza para las llamadas `v2` del informe sobre **Solucions**.
- **Nueva variable `HOLDED_V2_API_KEY_MENJAR_DHORT`:** se añade soporte de configuración para consultas `v2` sobre **Menjar d'Hort**.
- **Inyección de variables al renderer:** `webpack.renderer.config.js` expone ambas keys `v2` al cliente Electron que construye el Informe Sergi.
- **`holdedApiV2Service` multiempresa:** el servicio `v2` ya puede resolver la key según empresa (`solucions` / `menjar_dhort`).

---

## v2.4.4

### Firma (Kronos + portal de firma)

- **Seguimiento por fases en la lista de envíos:** el badge ya no muestra solo el estado crudo de base de datos; refleja el flujo **Enlace enviado → Enlace abierto → SMS OTP enviado → Firmado** (y **Cancelado** cuando aplique), con iconos distintos.
- **Marcas de tiempo en base de datos** (requieren SQL en Supabase; ver `database/alter_firma_documentos_tracking.sql` y `database/alter_firma_documentos_otp.sql`):
  - **`link_compartido_at`:** primera vez que se comparte el enlace desde Kronos (WhatsApp, email, copiar enlace o copiar mensaje); el SMS de enlace desde Kronos también lo rellena.
  - **`portal_abierto_at`:** primera carga válida de la página del portal con el token (servidor + `POST` desde el cliente para evitar cachés).
  - **`otp_primera_solicitud_at`:** primera solicitud de código OTP en el portal (tras envío SMS o modo debug).
- **Modal de cronología:** al pulsar el badge se abre un resumen con fecha/hora de cada paso (creación, compartir, portal, OTP, firma y cancelación con nota sobre `updated_at`).
- **Kronos — fiabilidad del paso OTP:** si la columna `otp_primera_solicitud_at` no llega a actualizarse desde el portal, la lista infiere la primera solicitud OTP desde **`firma_otp_challenges.created_at`** al refrescar, para que el estado siga avanzando.
- **Portal de firma:** ruta `POST /firmar/[token]/open` para registrar apertura; ruta OTP devuelve **`otpSeguimiento`** y el cliente puede mostrar aviso si el registro en documento falla; `export const dynamic = 'force-dynamic'` en la página del token; aviso en consola si falta `SUPABASE_SERVICE_ROLE_KEY`.
- **Limpieza de UX:** eliminado del modal el paso independiente «SMS del enlace (desde Kronos)»; el compartir por canales queda unificado en el paso de enlace compartido (WhatsApp, etc.).

### Supabase (opcional)

- **`database/optional_firma_otp_challenges_select_authenticated.sql`:** solo si `firma_otp_challenges` tiene RLS y Kronos no puede leer filas para el merge del OTP; permite `SELECT` al rol `authenticated`.

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
