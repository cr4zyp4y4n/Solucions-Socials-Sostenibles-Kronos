# Changelog

Resumen de cambios por versión.

**Para publicar una release:** abre [RELEASE_DESCRIPTION.md](RELEASE_DESCRIPTION.md), Ctrl+A, Ctrl+C, pega en la descripción del release en GitHub. Después de publicar, actualiza `RELEASE_DESCRIPTION.md` con el contenido de la próxima versión.

---

## [Unreleased]

*(Próximos cambios.)*

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

---

## v2.2.26

### Nuevo
- **Análisis – Canales por tags:** Vista Sergi (Solucions/Menjar) asigna facturas a canales (Estructura, Catering, IDONI) usando primero los **tags** de la factura en Holded. Si la factura tiene tag `catering`, `estructura` o `idoni`, se asigna a ese canal; si no, se usa el fallback por descripción/cuenta.
- **Fichajes – Ubicación en detalle:** En el modal de detalles del fichaje (panel de fichajes y portal de inspección) se muestra la ubicación al fichar: texto opcional, coordenadas y enlace "Ver en Google Maps". Requiere haber ejecutado `database/add_fichaje_ubicacion.sql` en Supabase.
- **Horas trabajadas – Formato legible:** Las horas se muestran como **"1h 38m"** en lugar de "1.63h" en toda la app y en el portal (listas, totales, modal detalle, export PDF). En base de datos siguen guardadas en decimal.

### Correcciones
- **Build Windows:** Eliminados maker-dmg, maker-deb y maker-rpm de `forge.config.js` para que `npm run build` no falle en Windows con "Could not find module @electron-forge/maker-dmg". Solo se generan instalador Squirrel (Windows) y zip para darwin.

### Documentación
- **README** rediseñado: presentación del proyecto, módulos, instalación y enlace al CHANGELOG.
- **CHANGELOG.md** como archivo único para el historial por versión y para copiar la descripción en cada release de GitHub.

---

## v2.2.25

- **Sesión de login persistente:** Corrección del error 500 en refresh de token (oauth_client_id). Script SQL en `database/fix_auth_sessions_oauth_client_id.sql`: crear cliente por defecto en `auth.oauth_clients` y actualizar `auth.sessions` donde `oauth_client_id` era NULL.

---

## v2.1.24

- **Verificación IBAN:** Asignación solo cuando el nombre del contacto Holded coincide con proveedor/cliente; columna Verif. IBAN (✓/⚠/-) en tablas y Excel; avisos al exportar.
- **Modal de verificación humana** antes de descargar Excel (vista Sergi y Bruno): lista de contactos e IBAN, confirmar o cancelar.

---

## v2.1.23

- Vacaciones en Supabase, Panel Fichajes con vacaciones y bajas.
- Edición de fichajes desde Panel, historial con motivo, ubicación al fichar.
- Portal web de inspección (Netlify), roles y acceso.
- Fix "Error al actualizar la hoja de ruta".

---

*Para el historial completo de versiones anteriores, ver el README.md.*
