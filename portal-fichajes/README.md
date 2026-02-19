# Portal de Fichajes (solo lectura)

Portal web para que la inspección pueda consultar el Panel de Fichajes en la nube. Misma línea de diseño que el Panel Fichajes de la app SSS Kronos.

## Requisitos

- Node.js 18+
- Proyecto Supabase con las tablas `fichajes` y `fichajes_codigos` (mismo que la app)

## Configuración

1. Copia `.env.example` a `.env`
2. Rellena en `.env`:
   - `VITE_SUPABASE_URL`: URL de tu proyecto Supabase
   - `VITE_SUPABASE_ANON_KEY`: clave anónima (anon public) de Supabase

## Usuario para inspección

Crea en Supabase (Authentication > Users) un usuario para el funcionario (ej. `inspeccion@tuempresa.com`) y asígnale contraseña. Con las políticas RLS actuales, cualquier usuario autenticado puede leer fichajes.

## Desarrollo

```bash
cd portal-fichajes
npm install
npm run dev
```

Abre http://localhost:5173

## Despliegue en Netlify

1. **Sube el código**  
   - Opción A: el repositorio es solo la carpeta `portal-fichajes` → conéctalo en Netlify como siempre.  
   - Opción B: el repo es el proyecto entero (por ejemplo `seleccion-proveedores`) → en Netlify indica:
     - **Base directory:** `portal-fichajes`
     - **Build command:** `npm run build` (o déjalo vacío; usará el `netlify.toml` del proyecto).
     - **Publish directory:** `portal-fichajes/dist` (o `dist` si Netlify ya está usando `portal-fichajes` como base).

2. **Variables de entorno** (Site settings → Environment variables → Add variable):
   - `VITE_SUPABASE_URL` = URL de tu proyecto Supabase  
   - `VITE_SUPABASE_ANON_KEY` = clave anónima (anon public) de Supabase  

   Sin estas variables el build no tendrá la conexión a Supabase.

3. **Deploy**  
   Guarda, haz “Deploy site” (o un nuevo deploy desde la pestaña Deploys). Netlify usará el `netlify.toml` de `portal-fichajes` si el base directory es esa carpeta.

4. **URL**  
   Verás una URL tipo `https://nombre-del-sitio.netlify.app`. Puedes cambiarla en Domain management o conectar un dominio propio.

## Despliegue en Vercel (alternativa)

1. Sube el proyecto a un repositorio o conecta la carpeta `portal-fichajes` en Vercel.
2. Configura las variables de entorno: `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
3. Deploy. Obtendrás una URL tipo `https://portal-fichajes.vercel.app`.
