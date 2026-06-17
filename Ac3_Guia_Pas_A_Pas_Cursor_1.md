# Ac3 Obrador — Guia pas a pas per a Cursor
## Cronològica · Testable · Densa

---

## CONTEXT OBLIGATORI (llegir primer)

**Projecte:** SSS Kronos — Electron + React + Supabase
**Mòdul:** Obrador Ac3 (traçabilitat operativa)
**Patrons del projecte:**
- Supabase: `import { supabase } from '../config/supabase'`
- Holded: `window.electronAPI.makeHoldedRequest({ company, endpoint, method, body })`
- Navegació: `NavigationContext` — `navigateTo('seccio')` — NO React Router
- Colors: sempre `const { colors } = useTheme()` — mai colors hardcodejats
- Serveis: fitxers separats a `src/services/` seguint patró de `hojaRutaSupabaseService.js`
- Components: a `src/components/obrador/`

**Schema existent** (`database/create_obrador_ac3_tables.sql`):
- Taules: `obrador_proveidors`, `obrador_recepcions`, `obrador_productes`,
  `obrador_operaris`, `obrador_lots`, `obrador_etiquetes`,
  `obrador_expedicions`, `obrador_incidencies`, `obrador_temperatures`
- RLS actiu: usuaris autenticats tenen SELECT/INSERT/UPDATE/DELETE

**Dashboard existent:** `src/components/ObradorDashboardPage.jsx`
- Ja integrat a Layout.jsx i al menú
- Usa `useTheme()`, `Chart.js` (Bar)
- Té DADES_SIMULADES — cal substituir per dades reals

---

## PAS 0 — Preparació Supabase (fer ABANS de programar res)

### 0.1 Verificar que les taules existeixen
Ves a Supabase → Table Editor → comprova que existeixen:
`obrador_lots`, `obrador_recepcions`, `obrador_proveidors`, `obrador_productes`,
`obrador_operaris`, `obrador_etiquetes`, `obrador_expedicions`, `obrador_incidencies`, `obrador_temperatures`

Si NO existeixen → executar `database/create_obrador_ac3_tables.sql` al SQL Editor.

### 0.2 Afegir camps que falten (ALTER TABLE)
Executar al SQL Editor de Supabase:

```sql
ALTER TABLE obrador_lots
  ADD COLUMN IF NOT EXISTS codi_lot TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS estat TEXT DEFAULT 'produit'
    CHECK (estat IN ('produit','envasat','expedit','retirat')),
  ADD COLUMN IF NOT EXISTS mostra_guardada BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS quantitat_kg DECIMAL(6,2);

ALTER TABLE obrador_recepcions
  ADD COLUMN IF NOT EXISTS estat TEXT DEFAULT 'bo'
    CHECK (estat IN ('bo','regular','rebutjat')),
  ADD COLUMN IF NOT EXISTS caducitat DATE,
  ADD COLUMN IF NOT EXISTS congelat BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS observacions TEXT,
  ADD COLUMN IF NOT EXISTS operari TEXT;

ALTER TABLE obrador_productes
  ADD COLUMN IF NOT EXISTS allergens TEXT[],
  ADD COLUMN IF NOT EXISTS temp_coccio DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS temp_conservacio DECIMAL(4,1),
  ADD COLUMN IF NOT EXISTS fitxa_tecnica TEXT,
  ADD COLUMN IF NOT EXISTS actiu BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_obrador_lots_codi ON obrador_lots(codi_lot);
CREATE INDEX IF NOT EXISTS idx_obrador_lots_estat ON obrador_lots(estat);
```

### 0.3 Inserir dades de prova
Executar al SQL Editor:

```sql
INSERT INTO obrador_proveidors (nom, contacte) VALUES
  ('Fruites Montserrat', '93 123 45 67'),
  ('Carns Paco', '93 234 56 78'),
  ('Làctics del Vallès', '93 345 67 89');

INSERT INTO obrador_productes (nom, caducitat_dies, temp_coccio, actiu) VALUES
  ('Croquetes de pollastre', 3, 75.0, true),
  ('Arròs amb verdures', 2, 85.0, true),
  ('Crema de carbassa', 4, 90.0, true);

INSERT INTO obrador_operaris (nom, rol) VALUES
  ('Cristina López', 'cap_obrador'),
  ('Marc Fernández', 'operari'),
  ('Laura Puig', 'operari');
```

### ✅ PROVA PAS 0
Ves a Supabase → Table Editor → `obrador_proveidors` → ha de tenir 3 files.
Ves a `obrador_lots` → ha de tenir les columnes `codi_lot`, `estat`, `mostra_guardada`, `quantitat_kg`.

---

## PAS 1 — Servei Supabase base

### Comanda Cursor:
```
Crea el fitxer src/services/obradorSupabaseService.js per al projecte Kronos.
Usa: import { supabase } from '../config/supabase'
Implementa aquestes funcions exactes (amb els noms de columnes del schema real):
```

### Codi a implementar:

```js
import { supabase } from '../config/supabase';

// ── HELPERS ────────────────────────────────────────────────────
export async function generarCodiLot() {
  const avui = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const inicialDia = new Date(); inicialDia.setHours(0, 0, 0, 0);
  const { count } = await supabase
    .from('obrador_lots')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', inicialDia.toISOString());
  const num = String((count || 0) + 1).padStart(3, '0');
  return `LOT-${avui}-${num}`;
}

// ── SELECTS (per a formularis) ─────────────────────────────────
export async function getProveidors() {
  const { data, error } = await supabase
    .from('obrador_proveidors').select('id, nom').order('nom');
  if (error) throw error;
  return data || [];
}

export async function getProductes() {
  const { data, error } = await supabase
    .from('obrador_productes')
    .select('id, nom, caducitat_dies, temp_coccio, allergens')
    .eq('actiu', true).order('nom');
  if (error) throw error;
  return data || [];
}

export async function getOperaris() {
  const { data, error } = await supabase
    .from('obrador_operaris').select('id, nom, rol').order('nom');
  if (error) throw error;
  return data || [];
}

// ── RECEPCIONS ─────────────────────────────────────────────────
export async function getRecepcions(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .select(`id, data_recepcio, lot_proveidor, temperatura_arribada,
             estat, caducitat, congelat, observacions, operari,
             obrador_proveidors(nom)`)
    .order('data_recepcio', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function crearRecepcio(dades) {
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .insert(dades).select().single();
  if (error) throw error;
  return data;
}

// ── LOTS ───────────────────────────────────────────────────────
export async function getLots(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_lots')
    .select(`id, codi_lot, data_produccio, temp_final_coccio,
             estat, mostra_guardada, quantitat_kg,
             obrador_productes(nom),
             obrador_operaris(nom)`)
    .order('data_produccio', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function crearLot(dades) {
  const codi_lot = await generarCodiLot();
  const { data, error } = await supabase
    .from('obrador_lots')
    .insert({ ...dades, codi_lot, estat: 'produit' })
    .select().single();
  if (error) throw error;
  return data;
}

export async function getLotPerQR(codiQR) {
  const { data, error } = await supabase
    .from('obrador_etiquetes')
    .select(`codi_qr, data_caducitat,
             obrador_lots(id, codi_lot, estat, quantitat_kg,
               obrador_productes(nom, allergens))`)
    .eq('codi_qr', codiQR).single();
  if (error) throw error;
  return data;
}

// ── ETIQUETES ──────────────────────────────────────────────────
export async function crearEtiqueta(id_lot, caducitat_dies, allergens) {
  const data_caducitat = new Date();
  data_caducitat.setDate(data_caducitat.getDate() + (caducitat_dies || 3));
  const codi_qr = `QR-${id_lot}-${Date.now()}`;
  const { data, error } = await supabase
    .from('obrador_etiquetes')
    .insert({
      id_lot,
      codi_qr,
      allergens: allergens || [],
      data_caducitat: data_caducitat.toISOString().slice(0, 10)
    }).select().single();
  if (error) throw error;
  return data;
}

// ── EXPEDICIONS ────────────────────────────────────────────────
export async function getExpedicions(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_expedicions')
    .select(`id, id_client, data_sortida, comanda_holded, estat,
             obrador_lots(codi_lot, obrador_productes(nom))`)
    .order('data_sortida', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function crearExpedicio(dades) {
  const { data, error } = await supabase
    .from('obrador_expedicions')
    .insert(dades).select().single();
  if (error) throw error;
  await supabase.from('obrador_lots')
    .update({ estat: 'expedit' }).eq('id', dades.id_lot);
  return data;
}

// ── INCIDÈNCIES ────────────────────────────────────────────────
export async function getIncidencies(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .select(`id, tipus, descripcio, data_incidencia, estat,
             obrador_lots(codi_lot)`)
    .order('data_incidencia', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function crearIncidencia(dades) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .insert({ ...dades, estat: 'oberta' }).select().single();
  if (error) throw error;
  return data;
}

export async function tancarIncidencia(id) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .update({ estat: 'tancada', updated_at: new Date().toISOString() })
    .eq('id', id).select().single();
  if (error) throw error;
  return data;
}

// ── KPIs DASHBOARD ─────────────────────────────────────────────
export async function getKpisDashboard() {
  const avui = new Date(); avui.setHours(0, 0, 0, 0);
  const [lots, incidencies, expedicions, etiquetes] = await Promise.all([
    supabase.from('obrador_lots').select('*', { count: 'exact', head: true })
      .gte('data_produccio', avui.toISOString()),
    supabase.from('obrador_incidencies').select('*', { count: 'exact', head: true })
      .eq('estat', 'oberta'),
    supabase.from('obrador_expedicions').select('*', { count: 'exact', head: true })
      .gte('data_sortida', avui.toISOString()),
    supabase.from('obrador_etiquetes').select('*', { count: 'exact', head: true })
      .gte('data_envasat', avui.toISOString()),
  ]);
  return {
    lotsAvui: lots.count || 0,
    alertesTemp: 0,
    incidenciesObertes: incidencies.count || 0,
    expedicionsDia: expedicions.count || 0,
    etiquetesGenerades: etiquetes.count || 0,
    registresAppcc: 0,
    registresAppccBuits: 0,
  };
}

export async function getProduccioSetmanal() {
  const fa7dies = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  const { data } = await supabase
    .from('obrador_lots').select('data_produccio')
    .gte('data_produccio', fa7dies.toISOString());
  const dies = ['Dilluns','Dimarts','Dimecres','Dijous','Divendres','Dissabte','Diumenge'];
  const counts = Array(7).fill(0);
  for (const l of data || []) {
    const dia = (new Date(l.data_produccio).getDay() + 6) % 7;
    counts[dia]++;
  }
  return { labels: dies, data: counts };
}
```

### ✅ PROVA PAS 1
A Cursor, obre la consola del renderer d'Electron i executa:
```js
import { getProveidors } from './services/obradorSupabaseService'
getProveidors().then(console.log)
// Ha de retornar array amb els 3 proveïdors del Pas 0
```
Si retorna dades → continua. Si error → revisa l'import de supabase.

---

## PAS 2 — Connectar dashboard existent a dades reals

### Comanda Cursor:
```
Modifica src/components/ObradorDashboardPage.jsx:
1. Elimina completament la constant DADES_SIMULADES
2. Afegeix imports de useState, useEffect i les funcions del servei
3. Afegeix els states i el useEffect de càrrega
4. Substitueix totes les referències a DADES_SIMULADES pels nous states
5. Mantén exactament el mateix layout, estils i lògica de colors
```

### Canvis concrets:

```jsx
// AFEGIR al principi (després dels imports existents):
import { useState, useEffect } from 'react';
import {
  getKpisDashboard,
  getProduccioSetmanal,
  getIncidencies,
  getExpedicions
} from '../services/obradorSupabaseService';

// ELIMINAR: const DADES_SIMULADES = { ... }

// AFEGIR dins el component (abans del return):
const [kpis, setKpis] = useState({
  lotsAvui: 0, lotsAhir: 0, alertesTemp: 0,
  incidenciesObertes: 0, expedicionsDia: 0,
  etiquetesGenerades: 0, registresAppcc: 0, registresAppccBuits: 0
});
const [temperatures, setTemperatures] = useState([]);
const [incidencies, setIncidencies] = useState([]);
const [expedicions, setExpedicions] = useState([]);
const [produccio, setProduccio] = useState({ labels: [], data: [] });
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
  async function carregar() {
    try {
      const [k, prod, inc, exp] = await Promise.all([
        getKpisDashboard(),
        getProduccioSetmanal(),
        getIncidencies(5),
        getExpedicions(5),
      ]);
      setKpis(k);
      setProduccio(prod);
      setIncidencies(inc);
      setExpedicions(exp);
    } catch (err) {
      console.error('Error obrador dashboard:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  carregar();
}, []);

// AFEGIR just abans del return:
if (loading) return (
  <div style={{ padding: 32, color: colors.textSecondary }}>
    Carregant dades de l&apos;obrador...
  </div>
);
if (error) return (
  <div style={{ padding: 32, color: colors.error }}>
    Error: {error}
  </div>
);

// SUBSTITUIR en el JSX:
// k = DADES_SIMULADES.kpis → k = kpis (ja és el state)
// DADES_SIMULADES.temperatures → temperatures
//   (si temperatures buides, mostra missatge "Sense dades IoT")
// DADES_SIMULADES.incidencies → incidencies
//   adaptar: inc.lot → inc.obrador_lots?.codi_lot
//            inc.descripcio → inc.descripcio (igual)
// DADES_SIMULADES.expedicions → expedicions
//   adaptar: exp.lot → exp.obrador_lots?.codi_lot
//            exp.client → exp.id_client
//            exp.id → exp.id.slice(0,8)

// AL chartData, canviar:
// labels: DIES_SETMANA → labels: produccio.labels
// data: DADES_SIMULADES.produccioSetmanal → data: produccio.data
```

### ✅ PROVA PAS 2
1. Obre Kronos → menú → "Dashboard Obrador"
2. Ha de mostrar "Carregant..." uns instants i després el dashboard
3. KPIs han de mostrar 0 (no hi ha dades reals encara — és correcte)
4. Gràfica de producció ha de mostrar 0 per tots els dies (correcte)
5. Incidències i expedicions: llistes buides (correcte)
6. NO ha d'haver-hi cap error a la consola

---

## PAS 3 — Pantalla de Recepcions

### Comanda Cursor:
```
Crea src/components/obrador/ObradorRecepcionsPage.jsx per al projecte Kronos.
Segueix exactament el mateix estil que ObradorDashboardPage.jsx:
- useTheme() per colors
- Mateixos estils inline (no Tailwind, no CSS extern)
- Cap color hardcoded
Implementa: llistat de recepcions + formulari de nova recepció inline
```

### Especificació detallada:

```
ESTRUCTURA DE LA PANTALLA:
├── Header: "Recepcions" + botó "Nova recepció"
├── Si mode=llistat:
│   └── Taula de recepcions (getRecepcions)
│       Columnes: Data | Proveïdor | Lot proveïdor | Temp. | Estat | Congelat
│       Estat amb color: bo=verd, regular=taronja, rebutjat=vermell
└── Si mode=formulari:
    └── Formulari Nova Recepció

FORMULARI NOVA RECEPCIÓ:
  id_proveidor       Select (getProveidors()) — OBLIGATORI
                     Opció buida: "Selecciona proveïdor..."
  lot_proveidor      Input text — número lot del proveïdor
  temperatura_arribada  Input number, step=0.1
                     → Si valor > 5: mostrar warning groc
                       "⚠ Temperatura alta (>5°C). Considera registrar incidència."
  estat              Radio buttons: Bo | Regular | Rebutjat
  caducitat          Input type="date" — OBLIGATORI
  congelat           Toggle/Checkbox
                     → Si marcat: nota blava "Es registrarà flux de descongelat"
  observacions       Textarea, 3 files
  operari            Input text — nom de l'operari

VALIDACIONS ABANS D'ENVIAR:
  - id_proveidor obligatori
  - caducitat obligatori
  - Si estat='rebutjat': observacions obligatori

ACCIÓ EN ENVIAR:
  1. crearRecepcio(dades)
  2. Mostrar toast verd: "Recepció registrada correctament"
  3. Tornar al llistat
  4. Recarregar llistat

GESTIÓ D'ERRORS:
  - Si error Supabase: mostrar missatge vermell sota el botó
  - Botó desactivat mentre s'envia (loading state)
```

### ✅ PROVA PAS 3
1. Ves a la pantalla (afegir temporalment un botó al dashboard o navegar manualment)
2. Crea una recepció de prova:
   - Proveïdor: "Fruites Montserrat"
   - Temperatura: 3.5°C
   - Estat: Bo
   - Caducitat: demà
   - Operari: "Cristina"
3. Comprova a Supabase → `obrador_recepcions` → ha d'aparèixer la nova fila
4. El llistat ha de mostrar la recepció creada
5. Crea una altra amb temperatura 7°C → ha d'apareixer el warning groc
6. Crea una amb estat "Rebutjat" sense observacions → ha de bloquejar l'enviament

---

## PAS 4 — Pantalla de Lots

### Comanda Cursor:
```
Crea src/components/obrador/ObradorLotsPage.jsx per al projecte Kronos.
Mateix estil que ObradorRecepcionsPage.jsx.
Inclou: llistat de lots + formulari de nou lot + modal d'impressió d'etiqueta.
Instal·la qrcode.react si no està al projecte: npm install qrcode.react
```

### Especificació detallada:

```
ESTRUCTURA:
├── Header: "Lots de producció" + botó "Nou lot"
├── Si mode=llistat:
│   └── Taula de lots
│       Columnes: Codi lot | Data | Producte | Operari | Temp. cocció | Estat | Mostra
│       Estat amb color: produit=blau, envasat=taronja, expedit=verd, retirat=vermell
└── Si mode=formulari:
    └── Formulari Nou Lot

FORMULARI NOU LOT:
  id_producte        Select (getProductes()) — OBLIGATORI
                     Al seleccionar mostra: "Temp. mínima cocció: X°C"
  id_recepcio        Select (getRecepcions últimes 20) — OBLIGATORI
                     Mostra: "Data — Proveïdor — Lot proveïdor"
  id_operari         Select (getOperaris())
  quantitat_kg       Input number, step=0.1
  temp_final_coccio  Input number, step=0.1
                     → Si valor < producte.temp_coccio:
                       BLOQUEIG vermell: "❌ Temperatura insuficient.
                       Mínim requerit: X°C. No es pot guardar."
                       Botó d'enviar DESACTIVAT
  mostra_guardada    Checkbox — "He guardat mostra (obligatori per normativa)"
                     → OBLIGATORI per enviar
                     → Si no marcat i intenta enviar: error "Has de confirmar la mostra guardada"
  observacions       Textarea

VALIDACIONS:
  - id_producte obligatori
  - id_recepcio obligatori
  - temp_final_coccio >= producte.temp_coccio (bloqueja si no)
  - mostra_guardada = true (obligatori)

ACCIÓ EN ENVIAR:
  1. crearLot(dades) → retorna lot amb codi_lot
  2. crearEtiqueta(lot.id, producte.caducitat_dies, producte.allergens)
  3. Mostrar MODAL d'etiqueta (veure sota)
  4. NO tornar al llistat fins que l'usuari tanqui el modal

MODAL ETIQUETA:
  Mostrar preview de l'etiqueta:
  ┌─────────────────────────────┐
  │  [QR CODE 128x128px]        │
  │  LOT-20260613-001           │
  │  Producte: Croquetes        │
  │  Elaborat: 13/06/2026       │
  │  Caduca:   16/06/2026       │
  │  Al·lèrgens: gluten, ou     │
  │  SSS Obrador                │
  └─────────────────────────────┘
  Botó "Imprimir etiqueta" → window.print()
  Botó "Tancar" → torna al llistat + recarrega

CSS PRINT (dins el component):
  @media print {
    body > * { display: none; }
    .etiqueta-print { display: block !important; }
  }
```

### ✅ PROVA PAS 4
1. Crea un lot de prova:
   - Producte: "Croquetes de pollastre" (temp mínima 75°C)
   - Recepció: la que has creat al Pas 3
   - Temperatura cocció: 70°C → ha de BLOQUEJAR
   - Temperatura cocció: 78°C → ha de permetre
   - Mostra guardada: marcat
2. En enviar ha d'aparèixer el modal amb el QR i les dades de l'etiqueta
3. Comprova a Supabase:
   - `obrador_lots` → nova fila amb `codi_lot = LOT-YYYYMMDD-001`
   - `obrador_etiquetes` → nova fila amb `codi_qr` i `data_caducitat` correcta
4. Torna a crear un lot sense marcar "mostra guardada" → ha de bloquejar

---

## PAS 5 — Pantalla d'Expedicions

### Comanda Cursor:
```
Crea src/components/obrador/ObradorExpedicionsPage.jsx per al projecte Kronos.
Mateix estil que les pantalles anteriors.
Implementa: llistat d'expedicions + formulari amb cerca de lot per codi QR.
```

### Especificació detallada:

```
ESTRUCTURA:
├── Header: "Expedicions" + botó "Nova expedició"
├── Si mode=llistat:
│   └── Taula expedicions
│       Columnes: ID | Lot | Producte | Client | Data sortida | Estat | Holded
└── Si mode=formulari:
    └── Formulari dos passos

PAS 1 DEL FORMULARI — Identificar lot:
  Input: "Codi QR del lot"
  Botó: "Cercar"
  → getLotPerQR(codiQR)
  → Si troba: mostra card amb info del lot:
      Codi lot, Producte, Quantitat, Data producció, Caducitat, Estat
      Si estat='expedit': warning "Aquest lot ja ha estat expedit"
  → Si no troba: error "Codi QR no trobat"

  Alternativa manual (link sota): "Cercar per codi de lot"
  → Input text per codi_lot manual
  → getLots() filtrat per codi_lot

PAS 2 DEL FORMULARI — Dades expedició:
  (Només visible si lot trobat i estat != 'expedit')
  id_client          Input text — nom o codi client — OBLIGATORI
  comanda_holded     Input text — número comanda Holded (opcional)
  check_client       Toggle — "Client ha verificat i acceptat el producte"
  observacions       Textarea

ACCIÓ EN ENVIAR:
  1. crearExpedicio({ id_lot, id_client, comanda_holded, check_client, observacions })
  2. lot.estat → 'expedit' (ja ho fa el servei)
  3. Toast verd: "Expedició registrada. Lot [codi] marcat com a expedit."
  4. Tornar al llistat + recarregar
```

### ✅ PROVA PAS 5
1. Agafa el `codi_qr` del lot creat al Pas 4 (el trobes a Supabase → `obrador_etiquetes`)
2. Crea una expedició:
   - Entra el codi QR → ha de mostrar la info del lot
   - Client: "Escola Badalona"
   - Check client: marcat
3. Comprova:
   - `obrador_expedicions` → nova fila
   - `obrador_lots` → `estat` = 'expedit'
4. Intenta expedir el mateix lot → ha de mostrar warning "ja expedit"
5. Prova amb un codi QR inventat → ha de mostrar error "no trobat"

---

## PAS 6 — Pantalla d'Incidències

### Comanda Cursor:
```
Crea src/components/obrador/ObradorIncidenciesPage.jsx per al projecte Kronos.
Implementa: llistat d'incidències obertes i tancades + formulari nova incidència
+ botó de tancar incidència.
```

### Especificació:

```
ESTRUCTURA:
├── Header: "Incidències" + botó "Nova incidència"
├── Tabs: "Obertes" | "Tancades" | "Totes"
└── Llistat filtrat per tab

LLISTAT:
  Columnes: Lot | Tipus | Descripció | Data | Estat | Acció
  Botó "Tancar" per incidències obertes → tancarIncidencia(id) → confirmació

FORMULARI NOVA INCIDÈNCIA:
  id_lot       Select (getLots — lots actius, no expedits)
               Mostra: "LOT-YYYYMMDD-NNN — Producte"
  tipus        Select:
               temperatura | qualitat | contaminació | etiquetatge | altres
  descripcio   Textarea — OBLIGATORI, mínim 10 caràcters

ACCIÓ EN ENVIAR:
  1. crearIncidencia(dades)
  2. Toast: "Incidència registrada"
  3. Tornar al llistat
```

### ✅ PROVA PAS 6
1. Crea una incidència:
   - Lot: el que has creat
   - Tipus: temperatura
   - Descripció: "Temperatura a la cambra 2 ha superat els 6°C durant 20 minuts"
2. Comprova a Supabase → `obrador_incidencies` → nova fila amb `estat='oberta'`
3. Tanca la incidència → `estat` ha de passar a 'tancada'
4. El tab "Tancades" ha de mostrar la incidència tancada

---

## PAS 7 — Integrar al menú (Layout.jsx)

### Comanda Cursor:
```
Modifica src/components/Layout.jsx per afegir les noves seccions del mòdul obrador.
Busca l'entrada actual "Dashboard Obrador" al menú i afegeix les noves subseccions.
Afegeix els imports dels nous components i els cases a renderSection().
```

### Canvis a Layout.jsx:

```jsx
// IMPORTS A AFEGIR:
import ObradorRecepcionsPage from './obrador/ObradorRecepcionsPage';
import ObradorLotsPage from './obrador/ObradorLotsPage';
import ObradorExpedicionsPage from './obrador/ObradorExpedicionsPage';
import ObradorIncidenciesPage from './obrador/ObradorIncidenciesPage';

// AL MENÚ — substituir l'entrada obrador existent per:
{
  id: 'obrador',
  label: 'Obrador',
  icon: /* icona existent o UtensilsCrossed */,
  roles: ['admin', 'management', 'manager'],
  submenu: [
    { id: 'obrador-dashboard',   label: 'Dashboard',    roles: ['admin','management','manager'] },
    { id: 'obrador-recepcions',  label: 'Recepcions',   roles: ['admin','management','manager'] },
    { id: 'obrador-lots',        label: 'Lots',         roles: ['admin','management','manager'] },
    { id: 'obrador-expedicions', label: 'Expedicions',  roles: ['admin','management','manager'] },
    { id: 'obrador-incidencies', label: 'Incidències',  roles: ['admin','management'] },
  ]
}

// A renderSection() AFEGIR:
case 'obrador-recepcions':  return <ObradorRecepcionsPage />;
case 'obrador-lots':        return <ObradorLotsPage />;
case 'obrador-expedicions': return <ObradorExpedicionsPage />;
case 'obrador-incidencies': return <ObradorIncidenciesPage />;
```

### ✅ PROVA PAS 7
1. Obre Kronos → el menú obrador ha de tenir submenú desplegable
2. Navega per cada secció → han de carregar sense errors
3. Comprova que els rols funcionen: un usuari `manager` ha de veure totes les seccions

---

## PAS 8 — Dashboard amb dades reals (verificació final)

Ara que tens dades reals a totes les taules, el dashboard ha de mostrar números reals.

### ✅ PROVA PAS 8
Crea el flux complet:
1. Crea una recepció nova
2. Crea un lot des d'aquella recepció
3. Expedia el lot
4. Crea una incidència sobre el lot
5. Ves al Dashboard → ha de mostrar:
   - "Lots produïts avui": 1 (o més si has creat durant el dia)
   - "Expedicions del dia": 1
   - "Incidències obertes": 1
   - "Etiquetes generades": 1

---

## PAS 9 — Integració Holded (quan tot el flux funcioni)

### Comanda Cursor:
```
Crea src/services/obradorHoldedService.js per al projecte Kronos.
Usa window.electronAPI.makeHoldedRequest exactament com holdedApi.js.
Afegeix la crida a crearExpedicio() a ObradorExpedicionsPage.jsx.
```

```js
// src/services/obradorHoldedService.js
export async function crearAlbaraExpedicio({ id_client, producte, quantitat_kg, codi_lot }) {
  try {
    const result = await window.electronAPI.makeHoldedRequest({
      company: 'solucions',
      endpoint: '/invoicing/v1/documents/deliverynotes',
      method: 'POST',
      body: {
        contactCode: id_client,
        date: Math.floor(Date.now() / 1000),
        notes: `Lot obrador: ${codi_lot}`,
        products: [{
          name: producte,
          units: quantitat_kg || 1,
          price: 0
        }]
      }
    });
    return result;
  } catch (err) {
    // No bloquejar l'expedició si Holded falla
    console.error('Error creant albarà Holded:', err);
    return null;
  }
}
```

### Modificar ObradorExpedicionsPage.jsx — afegir a l'acció d'enviar:
```js
// Després de crearExpedicio():
try {
  const albara = await crearAlbaraExpedicio({
    id_client: dades.id_client,
    producte: lot.obrador_lots.obrador_productes.nom,
    quantitat_kg: lot.obrador_lots.quantitat_kg,
    codi_lot: lot.obrador_lots.codi_lot
  });
  if (albara) {
    // Guardar id albarà Holded a l'expedició
    await supabase.from('obrador_expedicions')
      .update({ comanda_holded: albara.id })
      .eq('id', expedicio.id);
    toast("Expedició registrada. Albarà Holded creat: " + albara.docNumber);
  }
} catch (e) {
  // Expedició guardada igualment, Holded és opcional
  toast("Expedició registrada. Albarà Holded pendent.");
}
```

### ✅ PROVA PAS 9
1. Crea una expedició amb un `id_client` que existeixi a Holded
2. Comprova a Holded → Albarans → ha d'aparèixer un nou albarà
3. Si Holded falla, l'expedició s'ha de guardar igualment a Supabase

---

## RESUM D'ORDRE

| Pas | Fitxer | Prova |
|-----|--------|-------|
| 0 | SQL Supabase | Taules + dades mock |
| 1 | obradorSupabaseService.js | getProveidors() a consola |
| 2 | ObradorDashboardPage.jsx | Dashboard sense DADES_SIMULADES |
| 3 | ObradorRecepcionsPage.jsx | Crear recepció + veure a Supabase |
| 4 | ObradorLotsPage.jsx | Crear lot + etiqueta QR |
| 5 | ObradorExpedicionsPage.jsx | Expedir lot per QR |
| 6 | ObradorIncidenciesPage.jsx | Crear + tancar incidència |
| 7 | Layout.jsx | Menú amb submenú |
| 8 | Verificació | Flux complet dashboard |
| 9 | obradorHoldedService.js | Albarà automàtic |

**Regla d'or: no passes al pas següent fins que les proves del pas actual passen.**
