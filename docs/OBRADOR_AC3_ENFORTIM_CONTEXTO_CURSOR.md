# CONTEXTO CURSOR — Obrador Ac3 (InnvESS) + Enfortim / ESCALBRADOR

> Documento de contexto para agentes Cursor.  
> Última actualización: **30/09/2026**.  
> Idioma UI del módulo: **catalán**. Zona horaria: **Europe/Madrid**.  
> Stack: Electron + React + Supabase (+ `portal-obrador` Vite/Netlify).

Complementarios:
- `docs/CONTEXTO_ESCALBRADOR_Kronos.md` — subvención Enfortim y reglas PRE-REUNIÓN
- `docs/ENFORTIM_DOSSIER_REUNION.md` — agenda/decisiones Sergi–Bruno
- `docs/ENFORTIM_BRIEFING_CURSOR_SERGI_BRUNO.txt` — briefing para generar doc externo
- `docs/sops/` — borradores SOP (R1 Brian)

---

## 0. Regla de oro (subvenciones)

| Subvención | Quién | Qué financia | Estado en Kronos |
|------------|-------|--------------|------------------|
| **InnvESS** (Generalitat) | — | Obrador + digitalización | **Ac3 en producción** |
| **Enfortim** (Ajuntament BCN) | Exp. 2026_OVT_583379 ESCALBRADOR | Capa de gestión: SOPs, escandalls, KPI mensual, B2B | **PRE-REUNIÓN** (esqueleto UI; sin esquema SQL cerrado) |

**Ningún gasto puede imputarse a las dos a la vez.**  
No “refundir” Ac3 como si fuera Enfortim. No cerrar entregables formales Enfortim antes del periodo **14/12/2026 → 13/12/2027** (sí se puede preparar infraestructura).

**NO empezar desarrollo pesado** de escandalls reales, dashboard KPI con datos ni SOPs PDF firmados hasta cerrar reunión con Sergi y Bruno.

---

## 1. Mapa mental: qué es cada cosa

```
PROVEEDORES ──► RECEPCIONES (MP que ENTRA)
                      │
                      ▼
              PRODUCTO (plato/elaborado del catálogo)
                 │              │
                 │              └── ESCANDALL (plantilla coste 1 unidad)  ← Enfortim R2
                 │                     (aún no en producción real)
                 ▼
              LOTE del día (N kg / N raciones + QR + traça)  ← Ac3
                 │
                 ▼
              EXPEDICIÓ → ENTREGA
```

| Concepto | Qué es | Ejemplo |
|----------|--------|---------|
| **Recepción** | MP que entra (carne, verdura, arroz…) | Arroz proveedor X, lot AB-12, temp. 3 °C |
| **Producto** | Plato/elaborado del catálogo | “Arroz con verduras” |
| **Escandall** | Ficha de **coste de 1 unidad** del producto (receta económica). **No es el lote.** | Por 1 kg: 400 g arroz + 500 g verdura → coste 2,50 €, PVP 6 € |
| **Lote** | Producción **de un día** de ese producto (trazabilidad) | Hoy 7,5 kg → LOT-… + etiqueta QR |
| **Expedición** | Salida del lote envasado a un client | Check sortida obligatorio |
| **KPI diario** | Dashboard operativo (lots hoy, IoT, incidencias) | Ac3 |
| **KPI mensual** | Cuadro de gestión + PDF justificable | Enfortim R3 (esqueleto) |

**Relación lote ↔ escandall (acuerdo de producto):**  
El lote **no es** el escandall. El escandall es la plantilla de 1 unidad; el lote es “hoy hacemos N unidades”. Coste teórico del lote ≈ coste_escandall × N.  
Hoy Kronos: el lote **no** lee el escandall (solo producto + recepciones). Enlazarlos es trabajo Enfortim post-reunión.

---

## 2. Obrador Ac3 — cómo funciona (producción)

### 2.1 Apps

| Pieza | Ruta | Rol |
|-------|------|-----|
| Kronos (Electron) | `src/components/obrador/` | Management: todo el módulo |
| Portal móvil | `portal-obrador/` | Recepción OCR + ficha QR pública + expedir/entregar staff |
| Datos | `src/services/obradorSupabaseService.js` | CRUD/RPC; TZ Madrid |
| Holded sync | `src/services/obradorHoldedSyncService.js` | Proveedores |
| OCR/parser **compartido** | `shared/obrador/` | Fuente única Kronos + portal (wrappers reexportan) |
| QR URL | `OBRADOR_TRACE_BASE_URL` (ej. `https://portalobrador.netlify.app`) | Contenido del QR |

### 2.2 Pestañas Kronos (`ObradorApp.jsx`)

| Vista | Archivo | Función |
|-------|---------|---------|
| Dashboard | `ObradorDashboardPage.jsx` | KPIs **día**: lots, alertas temp, incidencias, expediciones, etiquetas, APPCC (recepciones incompletas), IoT Realtime, prod. semanal |
| Recepcions | `ObradorRecepcionsPage.jsx` | Alta manual + OCR; filtros; editar; anul·lar→rebutjat; import Holded |
| Productes | `ObradorProductesPage.jsx` | Vincular proveïdors/ingredients al producte (no CRUD productos completo) |
| Lots | `ObradorLotsPage.jsx` | Crear lot multi-recepción + etiqueta; reimprimir etiqueta; filtros |
| Expedicions | `ObradorExpedicionsPage.jsx` | QR (pegar o **cámara**), client autocomplete, check sortida **obligatorio**, entregar, anul·lar (en trànsit) |
| Incidències | `ObradorIncidenciesPage.jsx` | Lot/sensor; en_curs; tancament checklist |
| Escandalls | `ObradorEscandallsPage.jsx` | **Esqueleto Enfortim** (placeholders, sin SQL) |
| KPIs mensuals | `ObradorKpisMensualPage.jsx` | **Esqueleto Enfortim** (6 KPIs vacíos, export PDF disabled) |

Roles sidebar: admin / management / manager. Portal staff: cuenta con `obrador_portal_staff`.

### 2.3 Flujo operativo Ac3

1. **Recepción** (Kronos o portal): foto/PDF → OCR (`shared/obrador`) → borrador → `obrador_recepcions`.
2. **Productes** (opcional): vínculos en `obrador_producte_proveidors`.
3. **Lot**: producto + N recepciones `bo|regular` + temp cocción ≥ mín + muestra → RPC `obrador_crear_lot_i_etiqueta` → lot `envasat` + etiqueta `QR-…`.
4. **Expedición**: solo si lot `envasat`; exige `check_sortida`; RPC `obrador_crear_expedicio_i_marcar_lot` (UNIQUE 1 expedición/lot + `FOR UPDATE`); upsert client.
5. **Entrega**: RPC `obrador_marcar_expedicio_entregada` (staff/management).
6. **Anular expedición** (solo en trànsit, management): RPC `obrador_anular_expedicio` → lot vuelve a `envasat`.
7. **QR público**: `get_obrador_lot_public` (anon).

### 2.4 Tablas principales

`obrador_proveidors`, `obrador_recepcions`, `obrador_productes`, `obrador_producte_proveidors`,  
`obrador_operaris`, `obrador_lots`, `obrador_lot_recepcions`, `obrador_etiquetes`,  
`obrador_expedicions`, `obrador_incidencies`, `obrador_temperatures`, `obrador_sensors`,  
`obrador_clients` (mestre lleuger post-migración).

### 2.5 SQL relevante (orden típico + recientes)

Base Ac3 + alters en `database/create_obrador_*.sql` / `alter_obrador_*.sql`.  
Recientes (2026):

- `alter_obrador_expedicions_unique_lot.sql` — anti-doble expedición
- `alter_obrador_check_sortida_required.sql` — check_sortida obligatorio en RPC
- `alter_obrador_anular_expedicio_i_clients.sql` — anular + `obrador_clients`

IoT: `create_obrador_sensors_iot.sql`, webhook TTN, watchdog cron.

### 2.6 Mejoras ya hechas (no rehacer)

- Errores visibles en listados / modal entrega
- KPI APPCC: cuenta recepciones del día incompletas (sin temp o sin lot proveedor)
- Reimpresión etiqueta desde listado lots
- OCR/parser unificado en `shared/obrador/`
- Cámara QR en Expedicions (`ObradorQrScanner.jsx`, BarcodeDetector)
- Filtros + “Carregar més” en Recepcions/Lots/Expedicions
- Editar/anul·lar recepciones; anul·lar expediciones en trànsit
- Autocompletado clientes + upsert

### 2.7 Convenciones al tocar Ac3

- UI catalán; no romper dashboard **diario** al añadir cosas Enfortim.
- RLS en tablas nuevas; TZ Madrid en conteos/días.
- Commits: gitmoji del repo.
- Parser/OCR: editar **solo** `shared/obrador/`, no duplicar en portal.
- Portal: `obradorOcrFromFile.js` configura worker PDF.js Vite y reexporta shared.

---

## 3. Enfortim / ESCALBRADOR — capa de gestión

### 3.1 Resultados y quién

| R | Qué | Brian / Kronos | Otros |
|---|-----|----------------|-------|
| R1 | SOPs + registros | SOPs digitales `docs/sops/` + PDF (pendiente formal) | Registros = Ac3 ya; APPCC = externa |
| R2 | ≥15 escandalls | Herramienta CRUD + Holded + export | Contenido recetas: Bruno/Cristina |
| R3 | Dashboard mensual 6 KPIs + 12 informes PDF | Vista **nueva** + export | Validar KPIs con Sergi |
| R4 | B2B | Soporte puntual | Comercial |
| R5 | Protocolo | Evidencias del sistema | Bruno + externa |

### 3.2 Escandalls (R2) — modelo conceptual (NO SQL cerrado)

Capçalera provisional: producte, línia (fred|rebosteria|frescos), PVP, unitat, versió, data revisió.  
Línies: ingredient, quantitat, unitat, cost_unitari (Holded), merma %, cost_línia.  
Cálculo: ingredients × (1+merma) + envàs + costes assignats → margen.  
UI esqueleto: pestaña Escandalls. Botones reales / tablas: **post-reunión**.

### 3.3 KPIs mensuales (R3) — propuesta

1. Margen bruto por línea (depende R2)  
2. Coste por lote producido (depende R2)  
3. Lots/mes y % incidencias (Ac3)  
4. Cumplimiento APPCC % (Ac3)  
5. Personas en inserción (fuente a acordar)  
6. Formación / contractaciones vulnerables (fuente a acordar)  

Export PDF ≈ entregable. Patrón posible: `AnalyticsSergiReportView`.  
**No mezclar** con dashboard diario IoT.

### 3.4 SOPs (R1 Brian)

Índice en `docs/sops/README.md` (SOP-OBR-01 … 10). Borradores cortos; firmas/PDF en periodo ejecución.

### 3.5 Estado PRE-REUNIÓN

Checklist y preguntas: `docs/ENFORTIM_DOSSIER_REUNION.md`.  
Hasta cerrar: no crear migraciones definitivas `obrador_escandalls*`, no datos simulados como “producción”, no vender el esqueleto como entregable justificado.

---

## 4. Ejemplo didáctico (para humanos y para el agente)

Escandall **1 kg** “Arroz con verduras” (números inventados):  
arroz 0,80 € + verdura 1,50 € + otros 0,20 € = **coste 2,50 €/kg**; PVP 6 €/kg.

Lote **7,5 kg** ese día:  
coste teórico 18,75 €; venta teórica 45 €; margen teórico 26,25 €.  
Las recepciones son la MP real; el escandall es la proporción/precio de referencia.

---

## 5. Instrucciones para el agente Cursor

1. Si el usuario pide mejoras del **día a día** (recepción, lot, QR, expedición, IoT): trabajar sobre Ac3; no atribuir a Enfortim.
2. Si pide **escandalls / KPI mensual / SOP PDF formales**: comprobar estado reunión; si PRE-REUNIÓN, solo esqueleto/docs, no esquema cerrado.
3. No romper dashboard operativo al añadir vistas Enfortim.
4. No duplicar OCR/parser fuera de `shared/obrador/`.
5. Responder al usuario en **español** (regla de proyecto); UI obrador en catalán.
6. SQL nuevo → archivo en `database/` + indicar ejecución en Supabase.
7. Para docs dirigidos a Sergi/Bruno: partir de `docs/ENFORTIM_BRIEFING_CURSOR_SERGI_BRUNO.txt` y/o el dossier.

---

## 6. Deuda / pendiente conocido (no bloqueante)

- Confirmar en cada entorno que se aplicaron SQL check_sortida + anular/clients.
- Redeploy Netlify `portal-obrador` tras cambios shared.
- Debounce en filtros de listados (opcional).
- Comprobar rol dentro de RPCs crear lot/expedición (hardening).
- Portal: selector proveedores sin toda la UX de `estat_us` de Kronos.
- Documento externo “bonito” para Sergi/Bruno: generar desde el briefing TXT si hace falta.

---

*Fin del contexto Obrador Ac3 + Enfortim para Cursor.*
