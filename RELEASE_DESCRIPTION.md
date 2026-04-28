## v2.4.2

### PIG (Menjar d’Hort)

- **Selector de empresa (EISSS vs MH):** el generador de PIG permite escoger empresa y evita mezclar hojas entre reportes.
- **Workbook MH con hojas exactas:**
  - `PIG GENERAL MH`
  - `PIG GENERAL MH A <MES ANTERIOR>` (dinámico según último mes con datos)
  - `DESPESES MP-APROV-PRFIRPF` (Grupo 6)
  - `SUELDOS Y SALARIOS GENERAL` (Grupo 8)
  - `OTROS GASTOS` (Grupo 9)
  - `PIG LINEA OBRADOR` (sin subvenciones/estimados)
  - `PIG LINEA OBRADOR 2` (subset de cuentas definidas)
- **`PIG LINEA OBRADOR`:** incluye `TOTAL BENEFICIO POR MES OBRADOR` y las 2 tablas de `TOTAL COMPUTADO` (último mes con datos y mes anterior).
- **Estilos tablas inferiores (Obrador):** se arreglan merges/estilos de las tablas de `TOTAL COMPUTADO` para que no hereden el formato de la tabla principal (misma solución que en EISSS).

### Import Holded (CSV/XLSX)

- **Soporte “trimestre actual”:** el mensual detecta cabeceras que empiezan por cualquier mes (Abril/Julio/Octubre…) y mapea correctamente las columnas al mes real (ej. Abril–Junio → 04–06), evitando que se desplacen a Enero–Marzo.
- **Títulos/rangos reales:** los títulos de PIG GENERAL usan el inicio real del rango cuando el export es trimestral (ej. `01/04/26 A 30/06/26`).

### Subvenciones

- **Eliminado “Importes por cobrar”:** se retira de la tabla y del modal (ya no se muestra ni se envía al guardar).
- **Fases más claras en el modal:** el selector muestra `FASE X (descripción)` e incorpora la **FASE 4.1 (anticipo)**.
- **SOC L1 / SOC L2:** se indica en el modal que estos campos aplican **solo** a SOC / Empresa de Inserción.
