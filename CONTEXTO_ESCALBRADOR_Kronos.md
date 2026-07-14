# CONTEXTO ESCALBRADOR — Módulos Kronos vinculados a la subvención Enfortim l'ESS 2026

> Documento de contexto para Cursor. Última actualización: 10/07/2026.
> Estado: PRE-REUNIÓN. Pendiente de validar reparto interno/externo con Sergi y Bruno.
> NO empezar desarrollo pesado de estos módulos hasta cerrar la reunión de coordinación.

## 1. Situación

SSS ha obtenido (resolución provisional 9/07/2026, BOPB) la subvención **Enfortim l'ESS 2026**
para el proyecto **ESCALBRADOR** (exp. 2026_OVT_583379, modalidad Ab):

- Solicitado: 9.000 € · Otorgado: **6.300 €** · Coste total presentado: 11.500 €
- Ejecución del proyecto: **14/12/2026 → 13/12/2027**
- Justificación: máximo 2 meses tras finalizar
- Requiere reformulación técnico-económica (lidera Bruno). Topes: personal propio máx. 1.575 €,
  indirectos máx. 630 €, coste total reformulado mínimo ~8.050 €. Inversión NO elegible.

**Relación con InnvESS:** InnvESS (Generalitat) financia el obrador y su digitalización
(módulo Ac3 ya en producción). Enfortim (Ajuntament BCN) financia la capa de gestión:
SOPs, escandalls, dashboard de KPIs mensual y comercialización B2B.
Ningún gasto puede imputarse a las dos subvenciones a la vez.

## 2. Resultados comprometidos (NO reformulables) y reparto previsto

| Resultado | Indicador comprometido | Quién |
|---|---|---|
| R1. SOPs, calidad y trazabilidad | 8–10 SOPs; sistema de registros; checklist por servicio | Sistema de registros: **ya hecho (Ac3)**. SOPs digitales: Brian. SOPs APPCC/manipulación: externa (salud pública) |
| R2. Control económico | ≥15 escandalls (fred, rebosteria, frescos); márgenes por servicio/cliente | Herramienta: **Brian (módulo Kronos)**. Contenido (recetas, cantidades, mermas): Bruno/Cristina |
| R3. Dashboard y rutinas | 1 dashboard mensual con 6 KPIs; 12 actas de seguimiento | **Brian (módulo Kronos)** |
| R4. Comercialización B2B BonCor | Propuesta de valor + tarifario + dossier; ≥20 oportunidades pipeline; ≥10 reuniones | Comercial / externa (no Kronos, salvo soporte) |
| R5. Protocolo puesta en marcha | 1 protocolo + checklists; dossier de evidencias | Bruno + externa; Brian aporta evidencias del sistema |
| Prácticas | 1 perfil CFGS (Admin. i Finances o DAM/DAW – La Salle), 200–300 h, tutoría interna | Tutor probable: Brian |

**Importante:** los entregables formales (SOPs firmados, los 15 escandalls, informes mensuales)
deben GENERARSE durante la ejecución (dic 2026 – dic 2027). Construir herramienta interna antes
es legítimo (infraestructura propia), pero los entregables se producen dentro del periodo.

## 3. Estado actual de Kronos relevante (verificado en repo, 09/07/2026)

- **Módulo Obrador Ac3 en producción**: `src/components/obrador/` (ObradorApp, ObradorContext,
  Dashboard, Recepcions, Lots, Expedicions, Incidències, QrCode, OcrDebugPanel).
- Todas las pantallas consumen `src/services/obradorSupabaseService.js` (datos reales, RLS activo).
  Cero datos simulados.
- `obradorHoldedSyncService.js`: sincronización con Holded ya existente → base para escandalls.
- `obradorAlbaranParser.js`: OCR de albaranes (Jotri, Multiembalajes probados).
- Dashboard operativo diario: lotes, expediciones, etiquetas, registros APPCC, temperaturas
  en tiempo real con rangos por tipo de cámara (`TEMP_RANGS`), incidencias, producción semanal.
- Tablas Supabase: obrador_proveidors, obrador_recepcions, obrador_productes, obrador_operaris,
  obrador_lots, obrador_etiquetes, obrador_expedicions, obrador_incidencies, obrador_temperatures.

## 4. Módulos NUEVOS a desarrollar (pendiente validación en reunión)

### 4.1 Módulo Escandalls (R2)
Objetivo: fichas de coste por producto/receta con márgenes por línea de negocio.

- Entidades propuestas: `obrador_escandalls` (producto, línea: fred/rebosteria/frescos, PVP,
  coste_total, margen), `obrador_escandall_ingredients` (escandall_id, producte/ingredient,
  quantitat, unitat, cost_unitari, merma_pct, cost_linia).
- Costes unitarios: desde precios de compra de Holded vía `obradorHoldedSyncService`
  (documento de referencia: Holded API v2 ya en contexto del proyecto).
- Cálculo: coste ingredientes × (1 + merma) + envase + costes asignados → margen bruto por unidad
  y por línea. Revisión mensual (protocolo de revisión = entregable del proyecto).
- UI: nueva pestaña "Escandalls" dentro del módulo Obrador. CRUD + duplicar escandall +
  export PDF/Excel de ficha (para el dossier de justificación).
- Restricción: el modelo de escandall (estructura de la ficha) puede venir validado por
  empresa externa → NO cerrar el esquema hasta después de la reunión.

### 4.2 Dashboard mensual de KPIs (R3)
Objetivo: cuadro de mando MENSUAL de gestión (distinto del dashboard operativo diario existente).

- 6 KPIs comprometidos: económicos + operativos + 2–3 de impacto. Propuesta inicial:
  1. Margen bruto por línea (fred / rebosteria / frescos) — sale de R2
  2. Coste por lote producido
  3. Lotes producidos / mes y % incidencias
  4. Cumplimiento registros APPCC (%)
  5. Personas en inserción vinculadas al obrador (impacto)
  6. Horas de formación / nuevas contrataciones vulnerables (impacto)
- Vista mensual con comparativa mes anterior + export "informe mensual" (PDF) → ese export
  ES el entregable justificable (12 informes/actas durante la ejecución).
- Reutilizar patrones del "Informe Sergi" (AnalyticsSergiReportView) para el export.

### 4.3 SOPs digitales (parte Brian de R1)
- Documentos de procedimiento de los flujos ya construidos: alta recepción, creación de lote,
  etiquetado QR, expedición con QR, gestión de incidencia, registro de temperaturas.
- Formato: markdown en `docs/sops/` + export a PDF con plantilla. Los SOPs de manipulación
  y APPCC NO son de Brian (profesional externa de salud pública).

## 5. Convenciones del proyecto (recordatorio para Cursor)

- Stack: Electron + React + Supabase. Servicios en `src/services/`, pantallas obrador en
  `src/components/obrador/`, SQL versionado en `database/`.
- RLS obligatorio en tablas nuevas (patrón: usuarios authenticated, seguir
  `create_obrador_ac3_tables.sql`).
- Zona horaria: Europe/Madrid vía date-fns-tz (patrón de obradorSupabaseService).
- Idioma UI: catalán en módulo obrador. Commits: convención gitmoji actual.
- No romper el dashboard operativo existente: el dashboard mensual es página/vista NUEVA.

## 6. Decisiones pendientes de la reunión (rellenar después)

- [ ] ¿Modelo de escandall lo define externa o lo definimos internamente?
- [ ] ¿Qué parte de D3 (servicios externos) queda tras reformulación y para qué?
- [ ] ¿Perfil de prácticas: DAM/DAW (con Brian) o Admin i Finances?
- [ ] ¿Fecha de inicio real de desarrollo de módulos escandalls/KPIs?
- [ ] ¿Los 6 KPIs definitivos? (validar propuesta del punto 4.2 con Sergi)
