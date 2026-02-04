# Módulo Gestión Tienda

Documentación del módulo **Gestión Tienda** de SSS Kronos: Hojas Técnicas, Confirmación de Productos y cambios recientes (incl. dependencias PDF).

---

## Resumen

El módulo **Gestión Tienda** agrupa la gestión de **Hojas Técnicas** (fichas de platos con ingredientes, costes y alérgenos) y la **Confirmación de Productos Tienda** (productos IDONI/BONCOR por hoja de ruta). Está disponible en la ruta `/gestion-tienda` del menú lateral.

**Roles con acceso:** `admin`, `manager`, `tienda`.

---

## Secciones del módulo

### 1. Hojas Técnicas

- **Propósito:** Crear y mantener fichas técnicas de platos (nombre, imagen, ingredientes con peso/coste/gastos, alérgenos).
- **Funcionalidades:**
  - Listado de hojas técnicas con búsqueda por nombre y ordenación por fecha o alfabética.
  - Crear, editar y eliminar hojas técnicas.
  - Subida de imagen del plato (Supabase Storage, bucket `dish-images`).
  - Gestión de ingredientes (nombre, peso en gramos, coste y gastos en euros, orden).
  - Gestión de alérgenos por hoja técnica.
  - **Exportar a PDF:** generación de PDF con logo IDONI, datos del plato, imagen, tabla de ingredientes y alérgenos.

**Componentes:**

| Archivo | Descripción |
|---------|-------------|
| `GestionTiendaPage.jsx` | Página principal con pestañas (Hojas Técnicas / Confirmación Productos). |
| `HojasTecnicasSection.jsx` | Listado, filtros, ordenación y modal de creación/edición. |
| `HojaTecnicaCard.jsx` | Tarjeta de cada hoja (imagen, nombre, resumen de costes, botón descargar PDF). |
| `HojaTecnicaModal.jsx` | Modal para crear/editar hoja técnica e ingredientes/alérgenos. |

**Servicio:** `src/services/hojasTecnicasService.js` (Supabase: `hojas_tecnicas`, `hoja_tecnica_ingredientes`, `hoja_tecnica_alergenos`, Storage).

**Generación de PDF:** `src/utils/pdfGenerator.js` — usa **jspdf** y **jspdf-autotable** para generar el PDF de la hoja técnica.

---

### 2. Confirmación Productos Tienda

- **Propósito:** Revisar y confirmar productos IDONI/BONCOR asociados a hojas de ruta (estado: pendiente, disponible, no disponible).
- **Funcionalidades:**
  - Listado de productos agrupados por hoja de ruta.
  - Búsqueda por producto, proveedor o cliente.
  - Filtro por estado (todos, pendientes, disponibles, no disponibles).
  - Estadísticas (total, pendientes, disponibles, no disponibles).
  - Acción “Recargar” para refrescar datos desde Supabase.

**Componentes:**

| Archivo | Descripción |
|---------|-------------|
| `ConfirmacionProductosSection.jsx` | Sección completa: listado, filtros, estadísticas y recarga. |
| `HojaRutaProductosCard.jsx` | Tarjeta de productos por hoja de ruta. |

**Servicio:** `src/services/productosIdoniSupabaseService.js` (productos por hoja de ruta y estadísticas).

---

## Dependencias y corrección de errores de compilación

### Dependencias necesarias

La generación de PDF en **Hojas Técnicas** depende de:

- **jspdf** – generación del documento PDF.
- **jspdf-autotable** – tablas en el PDF (ingredientes, etc.).

Ambas están declaradas en `package.json`:

```json
"jspdf": "^4.0.0",
"jspdf-autotable": "^5.0.7"
```

### Error: "Module not found: jspdf" / "jspdf-autotable"

Si al ejecutar `npm start` aparece:

- `Can't resolve 'jspdf' in ... src/utils`
- `Can't resolve 'jspdf-autotable' in ... src/utils`

**Causa:** Los paquetes no están instalados en `node_modules` (por ejemplo, tras clonar el repo o borrar `node_modules` sin reinstalar).

**Solución:**

```bash
npm install jspdf jspdf-autotable
```

O reinstalar todas las dependencias:

```bash
npm install
```

Después de esto, la compilación de Webpack (incl. `pdfGenerator.js`) debería completarse sin ese error.

---

## Base de datos (Hojas Técnicas)

Esquema relevante en `database/create_hojas_tecnicas_tables.sql`:

- **`hojas_tecnicas`:** id, nombre_plato, imagen_url, created_at, updated_at, created_by.
- **`hoja_tecnica_ingredientes`:** id, hoja_tecnica_id, nombre_ingrediente, peso_gramos, coste_euros, gastos_euros, orden.
- **`hoja_tecnica_alergenos`:** id, hoja_tecnica_id, tipo_alergeno.
- **Storage:** bucket `dish-images` para imágenes de platos (lectura pública; subida/actualización/borrado con `authenticated`).

RLS y políticas de Storage están definidas en ese script.

---

## Rutas y permisos

- **Ruta:** `/gestion-tienda`.
- **Menú:** “Gestión Tienda” (icono ShoppingBag).
- **Roles:** `admin`, `manager`, `tienda`. Si el usuario no tiene uno de estos roles, se muestra mensaje de acceso denegado.

La comprobación de roles se hace en `Layout.jsx` para la ruta correspondiente.

---

## Resumen de cambios documentados

| Fecha / contexto | Cambio |
|------------------|--------|
| Módulo Gestión Tienda | Página con dos pestañas: Hojas Técnicas y Confirmación Productos Tienda. |
| Hojas Técnicas | CRUD en Supabase, imágenes en Storage, PDF con jspdf/jspdf-autotable. |
| Confirmación Productos | Listado por hoja de ruta, filtros y estadísticas desde productosIdoniSupabaseService. |
| Corrección de compilación | Instalación de `jspdf` y `jspdf-autotable` para resolver “Module not found” en `pdfGenerator.js`. |

---

**Documentación relacionada:** `README.md` (proyecto), `docs/` (resto de módulos y soluciones).
