# Licitaciones v2 — tareas para Cursor

> Contexto verificado sobre el commit `d0acdd6` (28/10/2026).
> El módulo no se toca desde `aa7eab8` (24/07/2026, "Licitaciones Paula").
> Migración SQL que acompaña este documento: `database/alter_licitacions_circuit_v2.sql`
> (probada en Postgres local: idempotente, triggers y vista OK).
>
> Lee la sección 1 y 3 antes de tocar código. Las tareas de la sección 4 van en orden;
> T1–T3 son las que cambian los resultados y son prioritarias.

---

## 0. Por qué se hace esto

Sergi (CEO) ha reclamado por escrito, por segunda vez, el circuito de detección de oportunidades.
Lo que pide, y por tanto lo que el sistema tiene que poder responder:

1. Estado actual de la herramienta y del circuito.
2. **Resultados acumulados desde la puesta en marcha**: oportunidades detectadas, trasladadas,
   valoradas, descartadas y activadas, **separando Càtering y Tech**.
3. Incidencias o limitaciones que hayan impedido el funcionamiento regular.
4. Report **cada viernes**, también cuando no hay novedades ("l'absència de resultats també és
   informació de gestió"), con incidencias, mejoras aplicadas y próximas acciones.

Queja concreta de Paula: salen sobre todo **concesiones de bares y cantinas**, y "no ve muchos cambios"
entre consultas. Sergi pide ajustar filtros con el contraste de los responsables de cada área.

---

## 1. Estado actual (verificado en el código)

| Pieza | Fichero |
|---|---|
| Tabla `licitacions` | `database/create_licitacions.sql`, `alter_licitacions_estat_contractacio.sql` |
| Lógica de fuentes, filtros, upsert, purga | `src/services/licitacionsService.js` (987 líneas) |
| Vigencia / purga | `src/services/licitacionsVigent.js` |
| Lista CPV | `src/constants/licitacionsCpv.js` |
| HTTP desde main (allowlist de hosts) | `src/main/licitacionsHttp.js` |
| Sync en background + sesión en main | `src/main/licitacionsBackgroundSync.js`, `licitacionsSupabaseMain.js` |
| Cron (lunes 08:00) | `src/main.js` ~l. 740 |
| UI | `src/components/LicitacionsPage.jsx`, `LicitacioDetailModal.jsx`, `src/components/licitacions/*` |

## 2. Defectos encontrados

| # | Defecto | Dónde | Efecto |
|---|---|---|---|
| D1 | `cpvMatchesFilter` compara con `code.startsWith(f.slice(0, 2))` | `licitacionsService.js:253` | Entra **cualquier** CPV que empiece por 55, 72, 79 o 90 (toda la hostelería, todos los servicios a empresas, residuos…). |
| D2 | `55500000` y `55510000` (cantina) están en la lista a propósito | `licitacionsCpv.js` | Bares y cantinas por diseño. |
| D3 | Tech solo tiene `72000000`, `72200000`, `72600000` | `licitacionsCpv.js` | Sin software (48), mantenimiento TI (5031/5032), redes, equipos, formación TI. |
| D4 | PSCP filtra con `codi_cpv like '72000000%'` | `licitacionsService.js:578` | En la práctica es coincidencia exacta: se pierden todos los subcódigos en Catalunya. |
| D5 | PLACSP: `blob.includes(cpv)` con códigos de 8 dígitos | `licitacionsService.js:548` | Solo detecta los códigos exactos de la lista. |
| D6 | PLACSP solo lee **la primera página** del ATOM (máx. 600 entradas), sin seguir `rel="next"` | `fetchPlacspAtomFromUrl` | Con sync semanal se pierde casi todo lo publicado en la semana. Encaja con "no veo cambios". |
| D7 | Sin filtro de importe | — | El criterio de < 60.000 € no existe en código. |
| D8 | TED activo | `fetchAll` | TED solo publica por encima del umbral UE: ruido, ninguna oportunidad a nuestra escala. |
| D9 | Si `cpv_codes` viene vacío, `normalizeBase` deja pasar el registro | `licitacionsService.js:312` | Entra sin clasificar (sector "Altres"). |
| D10 | `purgeCaducadasLicitacions` **borra** las caducadas en `Pendent` y `Descartada` | `licitacionsVigent.js` `shouldPurgeLicitacioFromDb` | **No se pueden calcular acumulados.** El histórico de descartadas ya purgadas no es recuperable. |
| D11 | Cron dentro de Electron, sesión guardada solo en memoria | `main.js`, `licitacionsSupabaseMain.js` | Solo corre si alguien tiene Kronos abierto el lunes a las 08:00 con sesión. Sin registro de ejecuciones. |
| D12 | Estados `Pendent/Interessant/Descartada/Contactat`, sin fechas ni responsable | `estat_jc` | No cuadra con el circuito detectada → trasladada → valorada → descartada/activada. |
| D13 | No se detectan contratos reservados (DA 4ª LCSP) | — | SSS es empresa de inserción: son las oportunidades con más encaje. |

---

## 3. Reglas de negocio (no son preferencias)

1. **Nunca se borra una licitación.** Las caducadas se archivan (`arxivada = true`). Los acumulados dependen de ello.
2. **Todo cambio de estado deja rastro** (quién, cuándo, de qué a qué). Lo hace el trigger de la migración; el cliente no escribe en `licitacions_events`.
3. **Descartar exige motivo.** Hay un CHECK en BBDD; la UI tiene que pedirlo antes de guardar.
4. **Cada sincronización queda registrada** en `licitacions_sync_log`, también si no trae nada o si falla. Una semana sin resultados tiene que verse como "sync OK, 0 nuevas", no como silencio.
5. **Càtering y Tech van separados** en datos (`area`), filtros, UI y report.
6. **Los filtros se cambian sin release**: viven en `licitacions_config` (solo admin/management escriben).
7. Lo que el filtro automático excluye no se guarda, pero **se cuenta** por motivo (cpv, keyword, import) en el log, para poder justificar que el filtrado es efectivo.

---

## 4. Tareas

### T1 — Ejecutar la migración (manual, Brian)

- Copiar `alter_licitacions_circuit_v2.sql` a `database/` y ejecutarla en el SQL Editor de Supabase.
- **Antes de ejecutar**, confirmar el mapeo `Contactat → Activada` (ver sección 6).
- Comprobar con las queries del final del script.

Qué crea: columnas `area`, `estat_circuit`, `responsable_area_id`, `data_traslladada`, `data_valorada`,
`data_resolucio`, `motiu_descart`, `valoracio`, `reservada`, `contracte_menor`, `arxivada`, `arxivada_at`,
`last_seen_at`; tablas `licitacions_events`, `licitacions_sync_log`, `licitacions_config` (con valores
iniciales); vista `licitacions_report_setmanal`. `estat_jc` se mantiene pero queda deprecado.

### T2 — Módulo de filtros puro y compartido

**Crear** `supabase/functions/_shared/licitacions/filtres.mjs`: JavaScript ESM **puro** (sin imports de
Node, Deno, Supabase ni React). Se usará desde Electron (webpack lo importa) y desde la Edge Function (T7).
Una sola copia del código.

Funciones:

```js
// Prefijo jerárquico: quita los ceros finales. 55520000 → '5552', 72000000 → '72', 15894200 → '158942'
export function cpvPrefix(code) {
  const c = String(code || '').replace(/\D/g, '').slice(0, 8);
  const p = c.replace(/0+$/, '');
  return p.length < 2 ? c.slice(0, 2) : p;
}

export function normalizeText(s) // minúsculas, sin acentos (NFD), espacios colapsados

// Devuelve { area: 'Catering'|'Tech'|'Altres'|null, cpvMatch: string|null }
// Prioridad: CPV principal (el primero) y, si no casa, cualquiera de la lista.
export function classifyCpv(cpvCodes, config)

// Coincidencia por palabra/frase completa sobre texto normalizado ("bar" NO casa con "Barcelona")
export function matchKeyword(text, keywords)

// Pipeline completo. Devuelve { keep: true, area, reservada } o { keep: false, motiu: 'cpv'|'keyword'|'import' }
export function evaluateLicitacio({ cpvCodes, title, summary, importEstimat }, config)
```

Reglas de `evaluateLicitacio`:
1. Sin CPV, o CPV principal dentro de `cpv_exclusio` (cafetería 5533, bares 554, cantina 555), o sin coincidencia en `cpv_catering` / `cpv_tech` / `cpv_altres` → `motiu: 'cpv'` (arregla D1, D2, D9). `cpv_exclusio` se evalúa **antes** que las listas de inclusión: `55300000` incluye `5533` (cafetería) y hay que sacarlo.
2. Título u objeto con `keywords_exclusio[area]` → `motiu: 'keyword'`.
3. `importEstimat > import_max[area]` (si no es `null`) → `motiu: 'import'`. **Sin importe, pasa.**
4. `reservada = matchKeyword(title + summary, keywords_reserva)`. Una reservada **nunca** se excluye por keyword ni por importe.

**Crear** `src/services/licitacionsConfig.js`: `loadLicitacionsConfig(supabase)` lee `licitacions_config`
y devuelve un objeto con todas las claves. Si la tabla falla, usar un fallback con los mismos valores del
seed de la migración y registrar el error en el log.

**Eliminar** `src/constants/licitacionsCpv.js` como fuente de verdad (dejar solo `LICITACIONS_SOURCES` si se usa).

**Tests** — `scripts/test-licitacions-filtres.mjs` con `node:test` (`node --test scripts/test-licitacions-filtres.mjs`). Mínimo:
- `cpvPrefix('55520000-1') === '5552'`; `cpvPrefix('72000000') === '72'`.
- `55523100` → Catering; `72413000` → Tech; `48000000` → Tech; `55410000` → excluido por cpv; `55510000` → excluido por cpv; `55330000` → excluido por cpv (aunque `55300000` esté incluido); `90511000` → excluido por cpv.
- "Explotación del bar del polideportivo" con CPV 55300000 → excluido por keyword.
- "Servicio de catering para Barcelona Activa" → **no** excluido (palabra "bar" ≠ "Barcelona").
- Importe 80.000 en Tech → excluido por import; importe `null` → pasa.
- "Contrato reservado a empresas de inserción", 90.000 € → pasa con `reservada: true`.

**Aceptación:** tests en verde; ningún `startsWith(f.slice(0, 2))` en el repo.

### T3 — Fuentes

En `licitacionsService.js`:

**Todas:** sustituir el filtrado actual por `evaluateLicitacio(...)`. Acumular contadores de excluidos por motivo y de leídos por fuente para el log (T4). Guardar `area` y `reservada` en el payload.

**PSCP (Catalunya, Socrata `ybgg-dgi6`):**
- Construir el `$where` con los **prefijos** de la config: `starts_with(codi_cpv, '5552') OR …` (o `codi_cpv like '5552%'`; verificar cuál acepta el dataset).
- Paginar con `$offset` mientras el lote sea igual a `$limit` (tope configurable, p. ej. 10 páginas).
- **Verificar antes de codificar** con una llamada real (`$limit=3`): formato de `codi_cpv` (¿con dígito de control? ¿varios códigos en un campo?), nombre real del campo de importe sin IVA y si el dataset incluye contratos menores (campo de procedimiento). Ajustar `normalizePSCPRecord` a lo que devuelva.

**PLACSP (ATOM):**
- Extraer los CPV del CODICE de cada `<entry>`: regex sobre `ItemClassificationCode[^>]*>(\d{8})<` (todos, no solo los de la lista). Usar `evaluateLicitacio` con ellos (arregla D5).
- Importe: preferir `cbc:EstimatedOverallContractAmount`; si no, `cbc:TaxExclusiveAmount`; si no, el `Importe:` del summary.
- **Paginar** siguiendo `<link rel="next" href="…">` hasta que el `<updated>` de la entrada sea anterior al corte o se llegue a `placsp_max_pages` (default 60). Corte = `finished_at` del último sync OK − 1 día (primer arranque: 14 días). Si se llega al tope sin alcanzar el corte, **registrarlo como incidencia** en `errors` del log (arregla D6).
- Añadir el feed de **contratos menores** como fuente `PLACSP` con `contracte_menor = true`. URL a verificar en la página de datos abiertos de Hacienda ("Licitaciones de perfiles de contratante" → contratos menores; previsiblemente `sindicacion_1143`). Añadir su host al allowlist si cambia.

**TED:** respetar `fonts_actives.TED` (desactivado por defecto). No borrar el código.

**Aceptación:** un sync manual devuelve leídos por fuente, excluidos por motivo y nuevas por área; ninguna licitación nueva con CPV de bar/cantina; en PLACSP el log muestra más de una página leída.

### T4 — Archivar en vez de borrar + log de sync

- `licitacionsVigent.js`: renombrar `shouldPurgeLicitacioFromDb` → `shouldArchiveLicitacio` (misma lógica de vigencia; ya **no** depende de `estat_jc`).
- `purgeCaducadasLicitacions` → `archiveCaducadasLicitacions`: `UPDATE … SET arxivada = true, arxivada_at = now()` en lugar de `DELETE`. **Ningún `.delete()` sobre `licitacions` en todo el repo.**
- En el upsert: poner `last_seen_at = now()` a todo lo leído; en inserts nuevos, `estat_circuit = 'Detectada'` (no tocar `estat_jc`). Las actualizaciones **no** pisan `estat_circuit`, `motiu_descart`, `valoracio`, `responsable_area_id`, notas ni fechas del circuito.
- Si una licitación archivada vuelve a aparecer vigente (p. ej. plazo ampliado), desarchivar.
- `fetchAll(options)` recibe `origen` (`'manual' | 'cron_app' | 'edge'`): inserta la fila en `licitacions_sync_log` al empezar y la cierra al acabar (`finished_at`, `ok`, `llegits`, `exclosos`, `noves_per_area`, `inserides`, `actualitzades`, `arxivades`, `errors`). Si algo lanza, cerrar igualmente con `ok = false`.

**Aceptación:** tras un sync, `SELECT * FROM licitacions_sync_log ORDER BY started_at DESC LIMIT 1` tiene todos los campos; el número total de filas de `licitacions` nunca baja.

### T5 — UI

`LicitacionsPage.jsx`, `LicitacioDetailModal.jsx`, `LicitacionsStats.jsx`:

- Sustituir `estat_jc` por `estat_circuit` en filtros, tarjetas, modal y stats. Estados y orden: Detectada → Traslladada → Valorada → Descartada | Activada.
- Filtro y pestañas por **área** (Càtering / Tech / Altres).
- Al pasar a **Descartada**: modal que obliga a escribir el motivo (el CHECK de BBDD rechaza si no).
- Al pasar a **Valorada**: campo `valoracio` (texto corto).
- Selector de responsable de área (usuarios de `user_profiles`).
- Badge **"Reservada DA 4ª"** muy visible; ordenarlas primero.
- Toggle "Mostrar archivadas" (ocultas por defecto).
- En el modal: pestaña "Historial" que lee `licitacions_events` (fecha, usuario, de → a, nota).
- **Banner de última sincronización** (de `licitacions_sync_log`): "Última sincronización: hace X (OK / con errores)". En rojo si hace más de 2 días o el último sync falló.
- Stats: Detectadas esta semana, Pendientes de trasladar, Valoradas, Activadas, Reservadas vigentes; todas filtrables por área.
- **Configuración de filtros** (solo `admin` / `management`): pantalla o modal que edita `licitacions_config` (listas CPV por área, keywords de exclusión y de reserva, importe máximo por área, fuentes activas). Validar que los CPV sean 8 dígitos.

**Aceptación:** Paula puede llevar una licitación de Detectada a Activada desde la UI y el historial muestra cada paso con su nombre y fecha.

### T6 — Report del viernes desde Kronos

Botón "Report setmanal" en la página. Genera un texto (copiar al portapapeles y descargar `.md`)
con la estructura que pide Sergi, para la semana seleccionada (por defecto, la actual):

1. **Estat de l'eina**: syncs de la semana (nº, OK/errores), fuentes activas, fecha del último sync.
2. **Resultats** — tabla por área (Càtering / Tech): detectades, traslladades, valorades, descartades, activades — **de la semana y acumulado** (vista `licitacions_report_setmanal`). Si todo es 0, texto explícito: "Sense noves oportunitats aquesta setmana".
3. **Filtratge**: leídas por fuente y excluidas por motivo (suma de `licitacions_sync_log`), para justificar la eficacia del filtro.
4. **Incidències**: errores de los syncs de la semana; días sin sync.
5. **Reservades vigents** (DA 4ª), con plazo.
6. **Properes accions**: campo de texto libre que se rellena antes de copiar.

Idioma del report: **catalán** (es lo que usa Sergi).

**Aceptación:** con la BBDD vacía de novedades, el report sale igual, con ceros y con la información de syncs.

### T7 — Sincronización en servidor (Edge Function + pg_cron)

Seguir el patrón de `supabase/functions/obrador-sensors-watchdog` y `database/cron_obrador_sensors_watchdog.sql`.

- `supabase/functions/licitacions-sync/index.ts`: cliente con service role, importa `../_shared/licitacions/filtres.mjs` y la lógica de fuentes. Para que esa lógica sea compartida, extraer de `licitacionsService.js` las funciones de fetch/normalización a `supabase/functions/_shared/licitacions/fonts.mjs` (ESM puro, recibe `httpRequest` y `supabase` por parámetro; **sin DOMParser**, usar el parser regex que ya existe). `licitacionsService.js` pasa a ser una capa fina que inyecta el cliente HTTP de Electron.
- Registrar con `origen = 'edge'`.
- `database/cron_licitacions_sync.sql`: diario a las 07:15 Europe/Madrid (pg_cron va en UTC: `15 6 * * *` en invierno; documentar el cambio de hora o usar `15 5,6 * * *` con guard de "ya se ejecutó hoy").
- Notificar con `_shared/notify.ts` si el sync falla o si aparece una licitación **reservada**.
- Cuando la Edge Function esté en producción y lleve una semana estable: quitar el `cron.schedule` de `src/main.js` (dejar el botón manual con `origen = 'manual'`).

**Aceptación:** `cron.job_run_details` muestra ejecuciones diarias y cada una tiene su fila en `licitacions_sync_log` sin que nadie abra Kronos.

### T8 — Cierre

- Actualizar `docs/KRONOS_CONTEXTO_IA.md` §4.16 (fuentes, tablas nuevas, Edge Function, reglas de la sección 3).
- `CHANGELOG.md` y `RELEASE_DESCRIPTION.md` siguiendo `docs/PLANTILLA_RELEASE_NOTES.md`. Versión propuesta: 2.8.0.

---

## 5. Cómo trabajarlo en Cursor

- Una tarea por conversación/commit, en orden. Pega en cada una: "Lee `docs/LICITACIONS_TASQUES_CURSOR_2026-10-30.md`, secciones 2, 3 y la tarea Tn. Implementa solo Tn."
- No mezclar refactor con cambios de comportamiento: T2 y T3 primero con tests; la extracción a `_shared` de T7 al final.
- Antes de T3, que Cursor haga las llamadas reales de verificación (PSCP `$limit=3`, primera página de PLACSP) y pegue los campos reales en el chat antes de escribir parsers.

## 6. Decisiones pendientes (no las decide Cursor)

| Decisión | Propuesta | Quién |
|---|---|---|
| Mapeo de `Contactat` | → `Activada` | Brian / Sergi |
| Importe máximo por área | 60.000 € ambas (editable) | Responsables de área |
| ¿Cantinas de empresa/escuela fuera? | Fuera (55500000, 55510000) | Responsable Càtering |
| CPV de eventos (79951000, 79952000) en Càtering | Dentro | Responsable Càtering |
| CPV de equipos (30200000) en Tech | Dentro, prioridad baja | Brian |
| Medi Ambient (907) y Congressos | Fuera del circuito (Sergi solo pide Càtering y Tech) | Sergi |
| Responsable de cada área | — | Sergi / Lizeth |
| Frecuencia del sync | Diaria | Brian |

## 7. Plazos propuestos

| Bloque | Tareas | Fecha |
|---|---|---|
| Filtros y fuentes | T1, T2, T3 | 06/11/2026 |
| Circuito, UI y report | T4, T5, T6 | 13/11/2026 |
| Sync en servidor y cierre | T7, T8 | 20/11/2026 |

---

## Anexo — Texto para la parte Tech del report de hoy (30/10)

> **Eina de detecció de licitacions (Kronos) — revisió tècnica**
>
> **Estat:** l'eina funciona i consulta PSCP, PLACSP i TED, però la revisió del codi ha identificat
> limitacions que expliquen els resultats:
> - El filtre per CPV és massa ampli (un error de codi fa entrar tota l'hostaleria) i inclou codis de
>   cantina: d'aquí les concessions de bars i cantines.
> - La cobertura de Tech és molt limitada (no inclou software, manteniment informàtic ni xarxes).
> - De PLACSP només es llegeix la primera pàgina de novetats, de manera que es perd bona part del que
>   es publica durant la setmana.
> - No hi ha filtre d'import ni detecció de contractes reservats a empreses d'inserció (DA 4a LCSP).
> - La sincronització depèn que algú tingui Kronos obert el dilluns i no en queda registre.
> - Les licitacions descartades i caducades s'esborraven, per la qual cosa **els acumulats anteriors
>   d'oportunitats descartades no es poden recuperar**. Les xifres disponibles són les que encara
>   consten a la base de dades.
>
> **Millores i terminis:**
> - Fins al 06/11: filtres separats Càtering / Tech, configurables sense actualitzar l'aplicació i
>   validats amb els responsables d'àrea; exclusió de bars i cantines; límit d'import; detecció de
>   contractes reservats; lectura completa de PLACSP i de contractes menors.
> - Fins al 13/11: circuit complet (detectada, traslladada, valorada, descartada, activada) amb
>   històric i motiu obligatori de descart; registre de cada sincronització; report setmanal generat
>   des de Kronos amb dades per àrea, també quan no hi ha novetats.
> - Fins al 20/11: sincronització diària automàtica al servidor, independent de tenir l'aplicació
>   oberta, amb avís si falla o si apareix un contracte reservat.
>
> **Pendent de decidir:** import màxim per àrea, codis a incloure/excloure (amb el responsable de
> Càtering) i responsable de cada àrea en el circuit.
