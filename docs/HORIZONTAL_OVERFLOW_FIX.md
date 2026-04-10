## Fix: pantalla “se va a la derecha” (overflow horizontal)

### Síntoma
- Al cargar datos o tablas anchas, **toda la app se estira hacia la derecha** y aparece scroll horizontal “global”.
- Suele ocurrir tras subir un Excel/CSV y renderizar previews (tablas) dentro de layouts con `display: flex`.

### Causa típica
- En layouts `flex`, los hijos tienen por defecto `min-width: auto`, lo que hace que **no puedan encoger** si su contenido (tabla, texto largo) es más ancho que el contenedor.
- Resultado: el flex item empuja el layout y aumenta el `scrollWidth` del root.

### Solución aplicada en KRONOS

#### 1) Asegurar que los flex-items puedan encoger
- Añadir `minWidth: 0` en contenedores/flex-items que envuelven previews y grids.
- En `InnuvaConverterPage.jsx` se aplicó en wrappers clave y en contenedores de tablas con `overflowX: 'auto'`.

#### 2) Cortar overflow a nivel layout (capa superior)
- En `Layout.jsx`:
  - wrapper principal: `width: '100%'`, `maxWidth: '100%'`, `overflowX: 'hidden'`
  - `motion.main`: `overflowX: 'clip'`, `minWidth: 0`
  - sidebar rígida: evitar que el main se “empuje” por contenido

#### 3) Herramienta de diagnóstico (debugOverflow)
- Se añadió una utilidad que compara `clientWidth` vs `scrollWidth` y lista el “top offender” con su `path`.
- Esto ayudó a detectar el div que no encogía por falta de `minWidth: 0`.

### Checklist rápido para futuras páginas
- Si hay `display: flex`, pon **`minWidth: 0`** a los hijos que contienen tablas/strings largos.
- Para tablas: wrapper con **`overflowX: 'auto'`** y `maxWidth: '100%'`.
- Si el overflow es global: aplica **`overflowX: 'hidden'/'clip'`** en el layout superior.

