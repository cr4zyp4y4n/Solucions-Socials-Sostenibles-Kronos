## v2.3.6

### PIG

- **Suite PIG completada:** Se añaden y estabilizan las hojas `PIG LINEA CATERING`, `PIG LINEA IDONI`, `PIG LINEA KOIKI` y `COMPARATIVA ANUAL`.
- **Soporte anual dinámico:** El generador detecta el año del CSV de Holded y adapta cabeceras, títulos, rangos y nombres de pestaña.
- **Meses parciales compatibles:** Los CSV con solo algunos meses (por ejemplo enero-marzo) ya se procesan bien, rellenando el resto con `0` sin romper el layout.
- **Totales computados dinámicos:** Las tablas inferiores de las hojas PIG LINEA ahora cortan en el último mes con datos y en el mes anterior.
- **Comparativa anual correcta para 2026+:** La hoja `COMPARATIVA ANUAL` ya usa las bases del año anterior desde Supabase (`pig_bases_historicas`) y mantiene fallback a históricos hardcodeados para 2022-2024.
- **Scripts SQL incluidos:** Se añaden `create_pig_bases_historicas.sql` y `seed_pig_bases_historicas_2025.sql` para persistir las bases históricas.

---

## v2.3.5

### Conversor Innuva → Holded

- **Import del pagament incluido:** Se añade la columna `Import del pagament` en preview y export.
- **Signos compatibles con Holded:** `Total S.S.` e `IRPF` se exportan en **positivo** (Holded los transforma al importar).
- **Multi-empresa estable:** Conversión idéntica para **Solucions Socials** y **Menjar d’Hort** (mapeo de cuentas separado por `empresa + CODIGO`).
- **Overflow horizontal:** Retirado el botón de debug en UI y documentado el fix en `docs/HORIZONTAL_OVERFLOW_FIX.md`.

### PIG

- **Nueva hoja `PIG LINEA CATERING`:** Genera la hoja con meses, `TOTAL 25` y bloque de subvención estimada, filtrando cuentas “CATERING”.

---

## v2.3.4

### Conversor Innuva → Holded (multi-empresa + UI)

- **Soporte 2 empresas:** Selector en tarjetas para **Solucions Socials** y **Menjar d’Hort** dentro del mismo conversor.
- **Cuentas por empleado por empresa:** El mapeo de cuentas se guarda en Supabase por `empresa + CODIGO` (sin pisar Solucions/Menjar).
- **Diseño alineado con la app:** Header y selector visual actualizados para encajar con el estilo de Empleados/Socios/Análisis.

---

## v2.3.3

### Conversor Innuva → Holded

- **Agrupación por trabajador (NIF):** Si un empleado tiene varias nóminas, se combinan en **una sola fila** sumando importes.
- **Decimales robustos:** Detección correcta de formatos ES/EN y casos raros de Innuva para evitar importes 1.33/1.99 cuando deberían ser 1331.91/1993.05.
- **Fecha de pago vacía:** La columna **`Data de pagament`** se exporta en blanco para rellenarla directamente en Holded.

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
