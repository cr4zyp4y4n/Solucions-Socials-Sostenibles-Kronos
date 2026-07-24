## v2.5.1

### PIG / Cuenta Resultados — cambios Sergi (3 de 4)

- **CR GENERAL EISSS — Itinerario E.I:** 2 tablas editables (1º y 2º semestre) justo debajo de la minitabla; persistencia en Supabase; valores iniciales de Lizeth; se editan en Kronos antes de generar el Excel CR.
- **TESORERÍA — layout Caixa / Fiare:** cuentas Holded con IBAN agrupadas por banco (Caixa / Fiare); columnas Compte · IBAN · Saldo; `TOTAL TESORERÍA CAIXA`, `TOTAL TESORERÍA FIARE`, `TOTAL TESORERÍA` y `TOTAL TESORERÍA - INVES` (total menos la cuenta cuyo nombre contiene **INNVESS**).
- **TESORERÍA — previsiones editables:** debajo de los bancos, 2 tablas (ingresos por subv / subv. por aprobar) editables y persistentes, con totales recalculados.
- **SQL en Supabase (requerido):**
  - `database/create_pig_itinerario_ei.sql` + `database/seed_pig_itinerario_ei_2026.sql`
  - `database/create_pig_tesoreria_previsiones.sql` + `database/seed_pig_tesoreria_previsiones_2026.sql`
- **Pendiente (1 cambio):** queda **1 cambio más** en la hoja `TESORERÍA` (aún no implementado; se hará en una siguiente entrega).

### Licitaciones — Paula + CPV

- **Comentarios Paula (tarjetita roja):** al escribir y pulsar **Guardar**, desaparece el campo de escritura y solo queda la **tarjetita roja editable**. Si se vacía y se guarda, vuelve el campo blanco para escribir de nuevo (no se convierte en tarjeta mientras se escribe).
- **Filtro por año:** selector Año (2025, 2026, 2027…) según plazo de oferta / detección; por defecto el año actual; opción «todos».
- **Nuevas primero:** tras sincronizar (y en el listado), las licitaciones más recientes (`detected_at`) salen arriba; badge «Nueva» si aún no se habían visto.
- **Nuevos códigos CPV de catering:** `55300000`, `55523000` (además de `55520000` / `55523100` ya existentes). Tras instalar: **Licitaciones → Sincronizar**.
- **Comportamiento esperado:** no se importan adjudicadas / formalización / publicación agregada (solo vigentes).
- **Corrección:** `formatMoney is not defined` al abrir Licitaciones (modo privacidad).

### Obrador — Producte ↔ proveïdors i lot multi-recepció

- **Pestanya Productes:** associar un o més proveïdors (i ingredient opcional) a cada producte elaborat.
- **Creació de lot:** al seleccionar producte es filtren les recepcions d’aquests proveïdors; es poden marcar **diverses recepcions**.
- **Traçabilitat:** el lot desa totes les recepcions; el QR públic pot mostrar la llista.
- **SQL en Supabase (requerido):** `database/alter_obrador_lot_multi_recepcio.sql`.

---

## v2.5.0

### Licitaciones (CPV) y base de la release

- Ampliación inicial de CPV catering y corrección `formatMoney` en Licitaciones.
- Ver detalle acumulado en **v2.5.1**.

---

## v2.4.9

### PIG (EISSS) — Tesorería

- **Nueva hoja `TESORERÍA`:** se genera automáticamente al exportar el PIG de EISSS con datos de Holded API v2 (`GET /api/v2/treasury/accounts`, scope `accounting:banks.read`).
- **Solo cuentas bancarias reales:** se filtran únicamente las cuentas con **IBAN** (sin tarjetas, PayPal, caja, etc.).
- **Contenido:** resumen por cuenta, detalle (IBAN, BIC, saldo, pendientes de conciliar) y **TOTAL TESORERÍA**.
- **Requisito:** variable `HOLDED_V2_API_KEY_SOLUCIONS` configurada en el entorno Electron.

### PIG (EISSS) — PIG GENERAL

- **Desglose dinámico grupo 1 (subvenciones 740):** debajo de `d) Subvenciones imputadas al excedente del ejercicio` aparecen las cuentas 740 del CSV mensual de Holded (sin hardcodear códigos); los totales del grupo no cambian.
- **Desglose dinámico grupo 2 (ventas 700):** debajo de `Venta y otros ingresos de la actividad mercantil` aparecen las cuentas 700 del CSV (CATERING, KOIKI, IDONI TPV, etc.); el total del grupo se mantiene.
- Aplica al **bloque resumen** (columnas A–B) y a la **tabla mensual** de `PIG GENERAL EISSS` y la hoja del mes anterior.

### PIG (EISSS) — Objetivos COMPARATIVA ANUAL

- **Persistencia en Supabase:** los 6 objetivos (CATERING / IDONI / KOIKI · Normal y Òptim) se guardan y cargan por año, igual que los estimados de subvención.
- **Botón «Guardar objetivos»** y guardado automático al generar el Excel del mismo año.
- **Valores por defecto 2026:** CATERING 650.000 / 600.000 · IDONI 140.000 / 150.000 · KOIKI 20.207 / 23.881.
- **SQL en Supabase (requerido):** `database/create_pig_objetivos_comparativa.sql`, `database/alter_pig_objetivos_comparativa_rls.sql` y opcionalmente `database/seed_pig_objetivos_comparativa_2026.sql`.

### PIG (EISSS) — ESTRUCTURA SUBV 740

- **Eliminada la hoja `PIG LINEA ESTRUCTURA`:** solo queda **`PIG ESTRUCTURA SUBV 740`**, colocada **justo después de `PIG LINEA KOIKI`**.
- **Hoja simplificada (layout compacto):** se eliminan las filas `TOTAL INGRESOS… SIN SUBVENCIONES`, `TOTAL DESPESES`, `BENEFICIO SIN SUBVENCIONES` y las dos tablas inferiores de `TOTAL COMPUTADO`.
- **Fila de estimado de subvención:** aparece `ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L1 {año}` con los importes mensuales configurados; la columna **TOTAL** es la suma de esos meses.
- **`TOTAL BENEFICIO POR MES ESTRUCTURA SUBV 740`:** suma solo las cuentas 740 del CSV (no incluye el estimado).
- **Nueva línea ESTRUCTURA en «Estimados de subvención (PIG LINEA)»:** editable y guardable en Supabase (por defecto 2.800,87 €/mes en 2026 = E.I L1 33K).
- **SQL en Supabase (requerido):** `database/alter_pig_estimados_subvencion_add_estructura.sql` y opcionalmente `database/seed_pig_estimados_subvencion_estructura_2026.sql`.

### Holded v2 (PIG)

- **`holdedApiV2Service.getTreasuryAccounts()`:** nuevo método con paginación por cursor para listar cuentas de tesorería activas.

---

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
