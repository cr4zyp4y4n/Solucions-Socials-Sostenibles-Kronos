# Fichaje — cumplimiento RDL 8/2019 (y preparación borrador RD)

Estado de las medidas priorizadas en Kronos / portal-fichajes.

## Hecho

### 1. Inalterabilidad (soft-delete)
- Los fichajes **no se borran** desde la app: política RLS `DELETE` = denegado.
- Anulación lógica: columnas `anulado_at`, `anulado_por`, `anulado_motivo`.
- RPC `anular_fichaje(uuid, motivo)` + auditoría accion `anulado`.
- UI Kronos: botón **Anular fichaje (no borrar)** en `FichajeEditModal` (motivo obligatorio).
- Listados / resumen mensual excluyen `anulado_at IS NOT NULL` (salvo export inspección).

### 2. RLS por trabajador (progresiva)
- Tabla `fichajes_empleado_usuarios` (user ↔ `empleado_id` Holded).
- Tras validar código de fichaje se llama `vincular_empleado_fichaje`.
- SELECT acotado vía `fichaje_puede_ver_empleado`.

### 3. Pausas en portal-fichajes
- En jornada abierta: Descanso / Comida, finalizar pausa, salida bloqueada si hay pausa activa.

### 4. Retención ≥ 4 años
- Comentarios de tabla + RLS DELETE denegado en `fichajes`, `fichajes_pausas`, `fichajes_auditoria`.
- Vista `fichajes_retencion_activa` (`retenido_hasta` = fecha + 4 años).
- **No hay cron de purge.** Al vencer el plazo tampoco se borra automáticamente.

### 5. Tipología de horas
- Columnas: `horas_ordinarias`, `horas_extraordinarias`, `horas_complementarias`.
- Snapshot: `horas_jornada_ref`, `contrato_parcial`, `tipificacion_manual`.
- Sin jornada ref → todo ordinario. Exceso → extraordinarias (completo) o complementarias (parcial).
- Edición en modal: fijar jornada ref y/o tipificación manual.

### 6. Export inspección
- Admin → Fichajes: CSV/PDF con tipología, estado anulado y motivo.
- Checkbox **Incluir anulados (inspección)**.

## SQL a ejecutar

1. `database/alter_fichajes_inalterabilidad_rls.sql` (si no está)
2. **`database/alter_fichajes_retencion_tipologia.sql`** ← este paquete

## Pendiente / mejora continua

| Tema | Notas |
|------|--------|
| Auto jornada desde Holded | Al fichar salida se toma `scheduleHours` / parcial y se tipifica |
| Cerrar transición RLS | Retirar bypass “sin mapeo” cuando todos los códigos estén vinculados |
| Export auditoría | Admin → Fichajes → «Exportar auditoría CSV» (eventos del periodo) |

## Dos vistas de fichajes (no son lo mismo)

| Vista | Dónde | Qué muestra |
|-------|--------|-------------|
| **Panel Fichajes** | RRHH / menú Panel Fichajes | Lista de **empleados** Holded + resumen del mes, estado hoy, filtros (activos = no baja/vacaciones) |
| **Admin → Fichajes** | Usuarios (admin) | Lista de **registros** de fichaje del periodo (entrada/salida), edición, anulación, export |

Ambas pueden ver los mismos datos; difiere el enfoque (personas vs filas de registro).

## Separación subvenciones

El módulo de fichaje es RRHH operativo (Kronos). No imputar este trabajo a Enfortim/InnvESS salvo criterio explícito de proyecto.
