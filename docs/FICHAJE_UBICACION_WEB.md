# Fichaje y ubicación: app de escritorio vs aplicación web

## Hipótesis confirmada

**Si todo el mundo ficha desde la aplicación web** y esa aplicación **no envía la ubicación** al crear el fichaje de entrada, **la ubicación no se guardará** en Supabase. La base de datos y la app de escritorio ya están preparadas para guardarla; el fallo está en que el cliente que crea el registro (la web) no la envía.

### Cómo lo hace la app de escritorio (SSS Kronos)

1. **Captura de ubicación:** En `FichajePage.jsx`, al tener un empleado seleccionado se pide la posición en segundo plano con `navigator.geolocation.getCurrentPosition` y se guarda en un ref (`ubicacionCachedRef`).
2. **Al pulsar "Entrada":** Se llama a `fichajeService.ficharEntrada(empleadoId, user?.id, ubicacion)`.
3. **En el servicio:** `fichajeSupabaseService.crearFichajeEntrada(empleadoId, fecha, userId, ubicacion)` arma el payload e incluye `ubicacion_lat`, `ubicacion_lng` y opcionalmente `ubicacion_texto` si se pasan.
4. **En Supabase:** Se hace un `insert` en la tabla `fichajes` con esas columnas (definidas en `database/add_fichaje_ubicacion.sql`).

### Qué debe hacer la aplicación web (la que usa la gente para fichar)

Para que la ubicación se guarde también cuando se ficha desde la web, esa aplicación debe:

1. **Pedir la ubicación** antes o al registrar la entrada (por ejemplo con `navigator.geolocation.getCurrentPosition`).
2. **Incluir en el insert** del fichaje de entrada los campos:
   - `ubicacion_lat` (number, latitud)
   - `ubicacion_lng` (number, longitud)
   - `ubicacion_texto` (string, opcional; ej. "Oficina", "Casa")

El resto del payload es el mismo que ya use (por ejemplo `empleado_id`, `fecha`, `created_by`; `hora_entrada` puede ir a `null` si un trigger la rellena en el servidor).

#### Ejemplo de payload de entrada (con ubicación)

```js
const hoy = new Date();
const fechaStr = hoy.toISOString().split('T')[0]; // YYYY-MM-DD

const payload = {
  empleado_id: empleadoId,        // ID del empleado (Holded)
  fecha: fechaStr,
  hora_entrada: null,            // El trigger de Supabase puede poner now()
  created_by: userId,            // auth.uid() del usuario que ficha
  es_modificado: false,
  ubicacion_lat: pos.coords.latitude,
  ubicacion_lng: pos.coords.longitude,
  ubicacion_texto: 'Oficina'     // opcional
};

const { data, error } = await supabase.from('fichajes').insert(payload).select().single();
```

#### Ejemplo de captura de ubicación en la web

```js
function getUbicacion() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        texto: '' // o pedir al usuario
      }),
      () => resolve(null),
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  });
}

// Al fichar entrada:
const ubicacion = await getUbicacion();
const payload = { ... };
if (ubicacion) {
  payload.ubicacion_lat = ubicacion.lat;
  payload.ubicacion_lng = ubicacion.lng;
  if (ubicacion.texto) payload.ubicacion_texto = ubicacion.texto;
}
await supabase.from('fichajes').insert(payload).select().single();
```

### Comprobaciones en Supabase

- La tabla `fichajes` debe tener las columnas `ubicacion_lat`, `ubicacion_lng`, `ubicacion_texto` (script `database/add_fichaje_ubicacion.sql`).
- Las políticas RLS deben permitir el `INSERT` que hace la aplicación web (por ejemplo con `created_by = auth.uid()`).

### Resumen

| Origen del fichaje | ¿Envía ubicación? | ¿Se guarda la ubicación? |
|--------------------|-------------------|---------------------------|
| App de escritorio (SSS Kronos) | Sí (geolocation en segundo plano) | Sí |
| Portal de este repo (pestaña "Fichar") | Sí (desde 2025) | Sí |
| Aplicación web (externa)      | Solo si la implementáis           | Solo si la web la envía   |

Mientras la aplicación web donde ficha la gente no incluya `ubicacion_lat` y `ubicacion_lng` (y opcionalmente `ubicacion_texto`) en el insert de la entrada, la ubicación no se guardará. No es un fallo de la base de datos ni de la app de escritorio.

---

### Portal de este repositorio (`portal-fichajes`)

En este mismo proyecto, el portal tiene ya una pestaña **"Fichar"** que permite fichar entrada y salida **con ubicación**: se captura la posición con `navigator.geolocation` y se envía en el insert. Si desplegáis este portal y la gente ficha desde aquí, la ubicación se guardará. Si la gente ficha desde otra aplicación web (fuera de este repo), hay que implementar allí el envío de ubicación según la especificación de arriba.
