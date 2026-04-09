## v2.3.2

### Subvenciones – Estado (pendiente/aprobada/rechazada) + motivo

- **Nuevo estado estructurado:** El estado de cada subvención pasa a ser **Pendiente / Aprobada / Rechazada** (campo `aprobada`: `null/true/false`).
- **Motivo opcional:** Campo `estado_motivo` para explicar por qué está aprobada o rechazada.
- **UI actualizada:** En el modal de crear/editar se elige el estado con selector y se puede añadir el motivo; en el modal de detalle se muestra como pill compacto (con tooltip si hay motivo).

### Subvenciones – Observaciones (texto largo)

- **Nuevo campo `observaciones`:** Texto libre “largo” para notas internas por subvención.
- **UI:** Se edita desde el modal de crear/editar (textarea) y se visualiza en el modal de detalle en una tarjeta dedicada.

### Subvenciones – Fase (`fase_actual`) y compatibilidad

- **Persistencia de fase:** Soporte completo para `fase_actual` en Supabase.
- **Compatibilidad automática:** Si la columna no existe, create/update reintenta sin `fase_actual` evitando bloqueos por schema cache.
- **Relación con empleados:** La consulta de subvenciones por empleado vuelve a incluir `fase_actual` en el join cuando la columna existe.

### Subvenciones – UX y estabilidad

- **Errores en el modal:** Los errores de crear/editar se muestran **dentro del modal** (ya no en la página principal).
- **Placeholders confusos eliminados:** Se retiraron placeholders “de ejemplo” en el modal de crear/editar para evitar que parezca que el campo ya está rellenado.
- **Limpieza de logs:** Eliminados logs de consola innecesarios en la sección de Subvenciones (se mantienen los mensajes al usuario).

### Innuva Converter – Cuentas por empleado en Supabase

- **Mapeo persistente:** Las cuentas contables de nóminas por empleado se guardan en Supabase (`nominas_cuentas_empleados`) y se aplican automáticamente al generar el Excel para Holded.
- **Importación única:** Botón para importar/actualizar el CSV de cuentas y guardarlo en BBDD (sin subirlo cada vez).
- **Debug overflow:** Se mantiene el “Debug overflow” para detectar estiramientos horizontales.

### Layout – Fix de “pantalla estirada hacia la derecha”

- **Overflow horizontal corregido:** Ajustes en el layout para evitar que páginas con contenido ancho (tablas/previews) empujen el viewport hacia la derecha.

### Base de datos (Supabase)

- **`nominas_cuentas_empleados`:** Nueva tabla para cuentas por empleado (nóminas).
- **`subvenciones`:** Scripts para añadir `fase_actual`, `aprobada`, `estado_motivo` y `observaciones`.

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
