## v2.4.0

### PIG

- **Orden de cuentas en PIG LINEA:** Ingresos/subvenciones arriba, compras primero dentro de gastos y resto de gastos al final, aplicando el mismo orden también en las tablas de `TOTAL COMPUTADO`.
- **Cabeceras de totales dinámicas:** En `PIG LINEA CATERING/IDONI/KOIKI` las columnas `TOTAL XX` y `TOTAL XX ESTIMADO...` detectan el año automáticamente.
- **Import Excel Holded estable:** Se arregla el parseo de XLSX (formato US tipo `$10,000.00` y negativos con paréntesis) para que los importes no se “acorten” (`10.000` → `10`).

### Base de datos (Supabase)

- **Nueva tabla `pig_bases_historicas`:** Scripts incluidos para crear y cargar bases 2025:
  - `database/create_pig_bases_historicas.sql`
  - `database/seed_pig_bases_historicas_2025.sql`

### Windows / Icono de la app

- **Icono del acceso directo y ejecutable:** Se genera automáticamente `src/assets/icons/app.ico` desde el PNG del logo durante el empaquetado y se usa para `.exe` e instalador.
