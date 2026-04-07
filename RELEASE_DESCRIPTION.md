## v2.3.1

### Subvenciones – Vista matriz y navegación

- **Nueva vista tipo Excel:** Las subvenciones de EI SSS se muestran en una **matriz** (etiquetas en la primera columna y cada subvención como columna), replicando el orden del CSV original.
- **Tabla estable (sin estirar la pantalla):** Se rehizo la sección para evitar que la tabla se “salga” del layout; ahora se navega por columnas con paginación (ver 2–6 a la vez) manteniendo el ancho de la pantalla.
- **Sin scroll vertical interno:** La tabla ya no fuerza scroll interno; el scroll vertical lo gestiona la página completa.

### Subvenciones – Detalle y edición    

- **Modal de detalles mejorado:** Al clicar una subvención, se muestra un modal con secciones estilo tarjeta (más legible que el JSON).
- **CRUD completo:** Añadido **crear**, **editar** y **eliminar** subvenciones (formulario dedicado desde el modal y botón “+ Nueva subvención”).
- **Edición completa de campos:** El formulario permite modificar todos los campos relevantes de la subvención.

### Subvenciones – Fases y estado

- **Fase visible consistente:** La etiqueta de fase en cabecera prioriza:
  - `fase_actual` si existe en la BBDD
  - si no, deriva la fase desde las marcas `fase_proyecto_1`…`fase_proyecto_8` (usando la **fase marcada más alta**)
  - y como respaldo, extrae `FASE N` desde `estado` si aplica
- **Mejor compatibilidad con datos históricos:** Normalización de valores tipo “X/si/1” y trims para que las fases se reflejen correctamente.

### Subvenciones – Empleados por subvención

- **Relación Subvención↔Empleado:** Nueva gestión de empleados por subvención con estados (`presentado`/`aceptado`/`rechazado`).
- **Fila “EMPLEADOS” en la matriz:** Resumen por subvención y popover con nombres agrupados por estado.
- **Navegación cruzada Subvenciones ↔ Empleados:** Desde el modal de Subvenciones puedes clicar un empleado presentado para abrir su ficha en **Empleados**; y desde el modal del Empleado puedes clicar una subvención para abrir su modal en **Subvenciones**.

### Empleados – Subvenciones del empleado

- **Bloque de subvenciones en el modal del empleado:** El modal de Empleados muestra en qué subvenciones está incluido el empleado, con su estado (`presentado`/`aceptado`/`rechazado`) y enlace directo a la subvención.

### Base de datos (Supabase)

- **Nueva tabla `subvenciones_empleados`:** Script SQL para crear la tabla relacional con RLS y trigger `updated_at`.
- **Soporte `fase_actual`:** Script SQL para añadir el campo `fase_actual` a `public.subvenciones` (para persistir la fase “real” cuando se edita).

---

## v2.3.0

### Fichajes – Ubicación al guardar

- **Guardado de ubicación en entrada:** Al fichar la entrada, la ubicación se guarda en la tabla `fichajes` (`ubicacion_lat`, `ubicacion_lng`, `ubicacion_texto`). Se solicita al pulsar "Fichar entrada" (mensaje "Obteniendo ubicación..." mientras se obtiene).
- **Fallback por IP en Electron:** La geolocalización del navegador en Electron devuelve 403 (Google). Se añadió ubicación aproximada por IP desde el proceso main (sin depender de la CSP): primero ip-api.com, respaldo ipapi.co. La precisión es a nivel zona/barrio, suficiente para saber desde qué área se ha fichado.
- **Permiso de geolocalización:** En el proceso main se acepta el permiso `geolocation` para que, si en el futuro funcionara, se use la posición del dispositivo.

### Correcciones

- **Error 406 al consultar fichaje del día:** La consulta usaba `.single()` y Supabase devolvía 406 cuando no había fichaje ese día. Sustituido por `.maybeSingle()` para devolver 200 con `data: null`.

### Portal de fichajes

- **Pestaña "Fichar":** El portal tiene ahora la pestaña **Fichar** además de "Panel (solo lectura)". Permite registrar entrada y salida por código, con guardado de ubicación (geolocalización o fetch por IP en el navegador). Misma base de datos y tabla `fichajes`.

### Documentación y base de datos

- **docs/FICHAJE_UBICACION_WEB.md:** Guía para que aplicaciones web externas que usen otra URL de fichaje envíen también la ubicación (payload y ejemplo de código).
- **database/verificar_ubicacion_fichajes.sql:** Script para comprobar y, si falta, crear las columnas `ubicacion_lat`, `ubicacion_lng`, `ubicacion_texto` en `fichajes`.
