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
