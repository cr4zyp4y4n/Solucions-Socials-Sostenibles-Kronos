# Obrador Ac3 — trabajo pendiente (contexto para Cursor)

> Fichero de contexto. **Trabaja una tarea cada vez**: pásale a Cursor la sección
> "Contexto compartido" más **una sola** tarea. No le des el fichero entero de golpe.
>
> Actualizado: 19/10/2026 · Brian Bautista, Referent Tech

---

## Contexto compartido

### Qué es esto

Módulo Obrador de Kronos: trazabilidad por lote de un obrador de catering, financiado
por la subvención InnvESS 2026 (actuación Ac3). Lo que se construye aquí tiene que
aguantar una inspección sanitaria (APPCC) y una justificación de subvención, así que
**todo registro tiene que decir qué pasó, quién lo hizo y cuándo**.

En producción con datos reales desde el 06/07/2026.

### Dónde vive cada cosa

| Ruta | Qué hay |
| --- | --- |
| `src/components/obrador/` | Pantallas de Kronos (Electron + React) |
| `src/services/obradorSupabaseService.js` | **Toda** la capa de datos del obrador |
| `shared/obrador/` | Código compartido entre Kronos y el portal móvil |
| `portal-obrador/src/` | Portal móvil (Vite + React), alias `@shared-obrador` |
| `database/` | Migraciones SQL, aplicadas a mano sobre Supabase |
| `supabase/functions/` | Edge Functions (Deno) |

### Convenciones que hay que respetar

**SQL.** Un fichero por cambio en `database/`, nombrado
`alter_obrador_<que_hace>.sql` o `create_obrador_<que_crea>.sql`. Siempre
idempotente: `IF NOT EXISTS`, `DROP POLICY IF EXISTS` antes de `CREATE POLICY`.
Comentar las columnas no obvias con `COMMENT ON COLUMN`.

**RLS.** Toda tabla nueva lleva `ENABLE ROW LEVEL SECURITY` y dos políticas, usando
los helpers que ya existen:

```sql
ALTER TABLE public.<tabla> ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS <tabla>_select_staff ON public.<tabla>;
CREATE POLICY <tabla>_select_staff ON public.<tabla>
  FOR SELECT TO authenticated
  USING (
    public.obrador_is_portal_staff_user()
    OR public.obrador_is_management_user()
  );

DROP POLICY IF EXISTS <tabla>_write_management ON public.<tabla>;
CREATE POLICY <tabla>_write_management ON public.<tabla>
  FOR ALL TO authenticated
  USING (public.obrador_is_management_user())
  WITH CHECK (public.obrador_is_management_user());
```

**Capa de datos.** Nada de llamar a `supabase` desde un componente. Todo pasa por
`obradorSupabaseService.js`, con funciones que lanzan en error y devuelven datos:

```js
export async function crearXxx(dades) {
  const { data, error } = await supabase
    .from('obrador_xxx').insert(dades).select().single();
  if (error) throw error;
  return data;
}
```

**Degradación si falta una columna.** El servicio tiene `isMissingColumnError(error)`.
Cuando escribas en columnas nuevas, envuelve el intento y haz *fallback* a la versión
sin ellas, como ya hace `tancarIncidencia`. Así la app no se rompe si la migración
todavía no se ha aplicado en algún entorno.

**UI.** Estilos en línea con los colores de `useTheme()` en Kronos, y de `./theme` en
el portal. Nada de librerías de componentes nuevas. Textos de interfaz **en catalán**.

**Validaciones.** Se validan en los dos sitios: en la pantalla, para que el usuario lo
entienda, y en base de datos o RPC, para que no se pueda saltar por otra vía. El check
de salida de expediciones es el patrón a imitar: lo impone también el RPC.

### Lo que NO hay que tocar

`ObradorEscandallsPage.jsx`, `ObradorKpisMensualPage.jsx` y
`ObradorEnfortimBanner.jsx` son de otra subvención (ESCALBRADOR). Están dentro de la
carpeta del obrador por arquitectura, no por financiación. **No los modifiques ni los
tomes como referencia de estilo.**

---

## Tarea 1 — Acción correctiva y verificación en incidencias

**Tamaño:** pequeño. **Por qué:** requisito directo de inspección APPCC. Hoy una
incidencia se puede cerrar sin que conste quién la cerró ni quién verificó que la
corrección funcionó.

### Qué existe ya (no lo rehagas)

La tabla `obrador_incidencies` **ya tiene**:

- `estat` con valores `oberta` / `en_curs` / `tancada`
- `tancada_at` — cuándo se cerró
- `notes_tancament` (text) — qué se hizo
- `checklist_tancament` (jsonb) — comprobaciones al cerrar
- `origen` (`lot` / `sensor`), `id_sensor`, `valor_extrem`, `inici_episodi_at`

Y `tancarIncidencia(id, { checklist, notes })` ya guarda notas y checklist.

### Qué falta

El **quién**. Un registro de acción correctiva sin responsable no vale para una
inspección.

1. Migración `database/alter_obrador_incidencies_accio_correctiva.sql`:

   ```sql
   ALTER TABLE public.obrador_incidencies
     ADD COLUMN IF NOT EXISTS tancada_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
     ADD COLUMN IF NOT EXISTS verificada_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
     ADD COLUMN IF NOT EXISTS verificada_at TIMESTAMPTZ;
   ```

   Con `COMMENT ON COLUMN` explicando que `verificada_per` es quien comprueba que la
   acción correctiva ha sido efectiva, y que puede ser una persona distinta de quien
   la ejecutó.

2. `tancarIncidencia` pasa a exigir `notes_tancament` no vacío y rellena
   `tancada_per` con el usuario autenticado. Mantén el *fallback* de
   `isMissingColumnError`.

3. Nueva función `verificarIncidencia(id)` que rellena `verificada_per` y
   `verificada_at`. Solo para rol management.

4. En `ObradorIncidenciesPage.jsx`:
   - al cerrar, el campo de notas es obligatorio, mínimo 10 caracteres, con el mismo
     mensaje de estilo que el de la descripción
   - en el detalle de una incidencia cerrada se ve quién la cerró y cuándo
   - una incidencia cerrada y **no verificada** se marca visualmente, y management
     tiene un botón de verificar

### Criterios de aceptación

- No se puede cerrar una incidencia sin describir qué se hizo.
- De cualquier incidencia cerrada se puede decir quién la cerró y cuándo.
- Se distingue a simple vista una incidencia cerrada de una verificada.
- Quien verifica puede ser distinto de quien cierra.
- Si la migración no está aplicada, la app sigue funcionando como antes.

---

## Tarea 2 — Registros APPCC por turno

**Tamaño:** grande. Es el bloque pendiente más importante. **Por qué:** la memoria de
la subvención compromete «registres APPCC digitals per torn — checklist inici /
producció / tancament de torn». Estaba previsto para agosto.

### Qué construir

Una tabla y una pantalla para registrar tres checklists al día.

1. Migración `database/create_obrador_registres_torn.sql`:

   ```sql
   CREATE TABLE IF NOT EXISTS public.obrador_registres_torn (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     data DATE NOT NULL DEFAULT CURRENT_DATE,
     moment TEXT NOT NULL CHECK (moment IN ('inici', 'produccio', 'tancament')),
     id_operari UUID REFERENCES public.obrador_operaris(id) ON DELETE SET NULL,
     registrat_per UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
     items JSONB NOT NULL DEFAULT '[]'::jsonb,
     incidencia_detectada BOOLEAN DEFAULT false,
     id_incidencia UUID REFERENCES public.obrador_incidencies(id) ON DELETE SET NULL,
     observacions TEXT,
     created_at TIMESTAMPTZ DEFAULT now(),
     updated_at TIMESTAMPTZ DEFAULT now()
   );

   CREATE UNIQUE INDEX IF NOT EXISTS idx_obrador_registres_torn_unic
     ON public.obrador_registres_torn (data, moment);
   ```

   El índice único es deliberado: **un registro por momento y día**. Que no se puedan
   duplicar checklists del mismo turno.

   `items` es una lista de `{ clau, etiqueta, ok, valor, nota }`. Va en JSONB y no en
   tabla aparte porque el contenido de los checklists lo tiene que poder cambiar la
   responsable de calidad sin que haya que migrar nada.

2. Define los checklists por defecto en `shared/obrador/checklistsTorn.js`, como
   constantes exportadas, una lista por momento. **Deja un comentario bien visible
   diciendo que el contenido definitivo lo tiene que validar la responsable de calidad
   y que los valores actuales son un borrador técnico.** No inventes umbrales de
   temperatura: donde haga falta un número, deja el campo de valor y no un límite.

   Orientación de lo que cubre cada momento, sin cerrar los ítems:
   - **inici** — estado de cámaras y congeladores, limpieza de superficies, estado del
     utillaje, higiene personal
   - **produccio** — temperaturas de cocción registradas, separación de alérgenos,
     muestras guardadas
   - **tancament** — limpieza, residuos, cierre de cámaras, producto sobrante

3. Servicio: `getRegistresTorn({ desde, fins })`, `crearRegistreTorn(dades)`,
   `getRegistreTornDelDia(data, moment)`.

4. Pantalla nueva `ObradorRegistresTornPage.jsx`, con su pestaña en `ObradorApp.jsx`
   (etiqueta «Registres de torn», visible para todos los roles). Debe mostrar de un
   vistazo si los tres registros de hoy están hechos o no, porque esa es la pregunta
   que hace un inspector.

5. Si al rellenar un checklist se marca algún ítem como no conforme, se ofrece crear
   una incidencia enlazada y se guarda el id en `id_incidencia`.

### Criterios de aceptación

- Se ve inmediatamente si faltan registros de hoy.
- No se puede registrar dos veces el mismo momento del mismo día.
- Un ítem no conforme puede generar una incidencia enlazada.
- Los checklists se pueden cambiar tocando un solo fichero, sin migración.
- Consta quién registró cada checklist y cuándo.

---

## Tarea 3 — Exportación de registros para inspección

**Tamaño:** mediano. **Por qué:** poder entregar los registros de un período sin que
nadie los busque a mano. También sirve de copia de seguridad documental.

Pantalla o sección que, dado un rango de fechas, exporte en un solo fichero:
recepciones, lotes con sus recepciones de origen, expediciones, incidencias con su
acción correctiva, registros de turno y lecturas de temperatura.

Formato: PDF para entregar e imprimir, y CSV por tabla para quien quiera los datos.
Mira cómo generan PDF los módulos Firma y los rapports antes de elegir librería —
reutiliza lo que ya haya en el repo en vez de añadir una dependencia.

La cabecera del PDF tiene que llevar el nombre de la entidad, el rango exportado, la
fecha de generación y quién lo generó.

**Criterio de aceptación:** dado un mes cualquiera, se obtiene un PDF entregable a un
inspector sin tocar nada más.

---

## Tarea 4 — Integración con Holded al expedir

**Tamaño:** mediano. **Por qué:** es el único punto abierto que queda de la Fase 2.

Al confirmar una expedición, generar el albarán correspondiente en Holded vía su API
REST y guardar la referencia en `obrador_expedicions.comanda_holded`, que ya existe.

Ya hay precedentes de integración en `src/services/holdedApi.js`,
`holdedHttpClient.js` y `obradorHoldedSyncService.js` — úsalos, no abras un cliente
nuevo. Ojo con el cupo de la API: ya hubo un trabajo de optimización de cupo en la
v2.6.0, así que mira cómo se gestiona antes de añadir llamadas.

**Importante:** que un fallo de Holded **no** impida expedir. La expedición es el
registro sanitario y tiene que poder completarse aunque la facturación falle. Deja la
expedición hecha, marca la sincronización como pendiente y permite reintentar.

**Criterio de aceptación:** expedir genera albarán en Holded; si Holded no responde,
la expedición se completa igual y queda marcada para reintento.

---

## Tarea 5 — Portal de confirmación del servicio receptor

**Tamaño:** mediano. **Por qué:** forma parte del bloque funcional B5 de la memoria.

Hoy `ConfirmarEntregaSection` ya existe en el portal. Falta que el **servicio
receptor** —el catering o el centro al que se envía, que no es personal del obrador—
pueda confirmar la recepción sin tener cuenta.

Reutiliza el patrón de token público que ya usa la traza de lote (`?trace=`) y el
portal de firma (`/firmar/[token]`). El enlace llega al receptor, confirma, y eso pone
`obrador_expedicions.estat` en `entregat` y `check_client` en true.

Registra quién confirma: un nombre y, si se puede, la hora y una observación. Sin eso
la confirmación no acredita nada.

**Criterio de aceptación:** una persona sin cuenta puede confirmar una entrega desde
un enlace, y queda constancia de quién y cuándo.

---

## Tarea 6 — Parsers adicionales de albaranes

**Tamaño:** incremental, una por proveedor.

Operativos: Begudes del Vallès (BGRUP), Jotri, Multiembalajes. Pendientes: el resto de
proveedores habituales.

El parser vive en `shared/obrador/albaranParser.js` y lo consumen Kronos y el portal.
Hay muestras reales en `albaranes-ocr-samples/` para probar.

Añade un proveedor cada vez, con su muestra, y comprueba que no rompes los tres que ya
funcionan antes de dar por buena la nueva.

---

## Lo que NO es desarrollo

- **Lectura automática de temperaturas.** El software está hecho: tabla de sensores,
  lecturas en tiempo real, watchdog y Edge Function. Espera a que se compre e instale
  el hardware. No hay nada que programar.
- **Logotipos del báner de financiación.** Cuando llegue el pack del gestor del
  expediente, cambiar `PROGRAMA_ESS_URL` y las tres rutas de `LOGOS` en
  `shared/obrador/financamentInnvess.js`. Nada más.
- **Umbrales de temperatura por zona.** Los fija la responsable de calidad según el
  APPCC, no el área técnica. Hasta que no estén, las alertas de sensores no serán
  fiables.
