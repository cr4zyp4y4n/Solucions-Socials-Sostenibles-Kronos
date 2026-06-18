# Portal Obrador — Recepcions (mòbil)

Portal web per registrar **recepcions** fotografiant l'albarà en paper:

1. Fer foto de l'albarà
2. OCR (Tesseract) + parser (genèric + Begudes)
3. Revisar i confirmar (temperatura, estat, operari…)

## Requisits

- Node.js 18+
- Mateix projecte Supabase que Kronos (`obrador_proveidors`, `obrador_recepcions`)
- Usuari Supabase Auth amb permisos RLS d'escriptura a recepcions

## Configuració

1. `cd portal-obrador`
2. Copia `.env.example` → `.env`
3. Omple `VITE_SUPABASE_URL` i `VITE_SUPABASE_ANON_KEY`

Opcional a Supabase: executar `database/alter_obrador_proveidors_cif.sql` per matching OCR per CIF.

## Desenvolupament

```bash
cd portal-obrador
npm install
npm run dev
```

Obre la URL local des del mòbil (mateixa xarxa) o desplega a Netlify/Vercel.

## Desplegament

Com `portal-fichajes`: base directory `portal-obrador`, variables `VITE_SUPABASE_*`.

## Parser

- **Genèric**: qualsevol albarà (CIF, data, nº document si es detecten).
- **Begudes**: format tipus BGRUP (es activa si el text conté "Begudes del Vallès" o CIF A59801696).
- Més proveïdors: afegir parsers a `src/services/obradorAlbaranParser.js` (sincronitzar amb Kronos).

## Kronos

A la pantalla **Recepcions** de l'Obrador hi ha el botó **Foto albarà (OCR)** amb el mateix flux.
