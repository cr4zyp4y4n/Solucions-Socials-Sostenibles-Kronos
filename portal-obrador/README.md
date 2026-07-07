# Portal Obrador — Recepcions (mòbil)

Portal web per registrar **recepcions** fotografiant l'albarà en paper:

1. Fer foto de l'albarà
2. OCR (Tesseract) + parser (genèric + Begudes + JOTRI)
3. Revisar i confirmar (temperatura, estat, operari…)

## Requisits

- Node.js 18+
- Mateix projecte Supabase que Kronos (`obrador_*`)
- Usuari Supabase Auth amb permisos RLS d'escriptura a recepcions

## Configuració

1. `cd portal-obrador`
2. Copia `.env.example` → `.env`
3. Omple `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`

SQL necessari a Supabase:

1. `database/create_obrador_ac3_tables.sql`
2. `database/alter_obrador_ac3_v2.sql`
3. `database/alter_obrador_expedicions_sortida.sql`
4. `database/alter_obrador_atomic_flows.sql`

Opcional: executar `database/alter_obrador_proveidors_holded.sql` (CIF + vincle Holded per import/sync).

## Proveïdors (Holded)

La llista de proveïdors es llegeix de Supabase (`obrador_proveidors`). Per omplir-la, a **Kronos → Obrador → Recepcions** fes clic a **Importar proveïdors (Holded)**. El portal mòbil veu els mateixos proveïdors automàticament.

## Traçabilitat QR (escaneig des del mòbil)

Les etiquetes poden obrir una **fitxa pública** amb producte, dates i al·lèrgens.

1. Executar `database/alter_obrador_trace_public.sql` a Supabase.
2. Desplegar aquest portal (Netlify/Vercel) i copiar la URL pública.
3. Al `.env` de **Kronos** (arrel del projecte):  
   `OBRADOR_TRACE_BASE_URL=https://la-teva-url-del-portal`  
   Reinicia Kronos i genera una **etiqueta nova** (les ja impreses amb QR antic cal reimprimir-les).

En escanejar, s'obre: `https://portal…/?trace=QR-…` (sense login).

Després d'actualitzar la funció SQL a Supabase, cal **redeploy** del portal a Netlify per veure nous camps (proveïdor, recepció).

## Desenvolupament

```bash
cd portal-obrador
npm install
npm run dev
```

Obre la URL local des del mòbil (mateixa xarxa) o desplega a Netlify/Vercel.

## Desplegament (Netlify)

Un sol portal, dues entrades:

| URL | Qui | Què |
|-----|-----|-----|
| `https://obrador.tudominio.org/` | Operaris (login) | Recepcions amb OCR |
| `https://obrador.tudominio.org/?trace=LOT-…` | Qualsevol (sense login) | Fitxa de traçabilitat del QR |

### Passos Netlify

1. **Site** → Add new site → Import del repo (o subcarpeta `portal-obrador`).
2. **Build settings:**
   - Base directory: `portal-obrador`
   - Build command: `npm run build`
   - Publish directory: `portal-obrador/dist`
3. **Environment variables** (Site settings → Environment):
   - `VITE_SUPABASE_URL` = mateix que Kronos
   - `VITE_SUPABASE_ANON_KEY` = mateix que Kronos
4. Deploy. Copia la URL (ex. `https://obrador-sss.netlify.app`).
5. Al `.env` de **Kronos**:
   ```env
   OBRADOR_TRACE_BASE_URL=https://obrador-sss.netlify.app
   ```
   (sense barra final; sense `/?trace=`)
6. Reinicia Kronos i genera etiquetes noves.

Opcional: domini propi (`obrador.solucionssocials.org`) a Netlify → Domain settings.

`netlify.toml` ja inclou redirect SPA (`/*` → `index.html`); `?trace=` funciona sense configuració extra.

## Parser

- **Genèric**: qualsevol albarà (CIF, data, nº document si es detecten).
- **Begudes**: format tipus BGRUP (es activa si el text conté "Begudes del Vallès" o CIF A59801696).
- **JOTRI**: albarà Cuinats JOTRI S.L.U. (text "Cuinats JOTRI", "ALBARÀ DE VENDA" o CIF B17209693).
- Més proveïdors: afegir parsers a `src/services/obradorAlbaranParser.js` (sincronitzar amb Kronos).

## Kronos

A la pantalla **Recepcions** de l'Obrador hi ha el botó **Foto albarà (OCR)** amb el mateix flux.
