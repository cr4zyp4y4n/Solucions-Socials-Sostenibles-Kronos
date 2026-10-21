# Obrador Ac3 — dues tasques pendents

> Context verificat sobre el commit `c67a35e` (21/10/2026).
> Llegeix `OBRADOR_AC3_COMPORTAMENT_ESPERAT.md` abans de tocar res: les regles que hi ha
> són controls sanitaris i de traçabilitat, no preferències.
>
> Les dues tasques són independents. La primera és curta i urgent. La segona és més
> llarga i bloqueja documentació ja escrita.

---

## Tasca 1 — Treure el fallback destructiu d'`anularExpedicio()`

**Fitxer:** `src/services/obradorSupabaseService.js`
**Prioritat:** alta. Fes-la abans que la tasca 2.

### El problema

La migració `database/alter_obrador_expedicions_anular_rastre.sql` va corregir l'anul·lació
d'expedicions: abans esborrava la fila, ara marca `estat = 'anulada'` i desa `anulada_at`,
`anulada_per` i `anulada_motiu`. La migració fa `DROP FUNCTION` de la versió antiga d'un sol
argument.

Però el client encara té un fallback a la versió antiga:

```js
const senseMotiu = resultat.error?.code === 'PGRST202'
  || /could not find the function|p_motiu/i.test(msg);
if (senseMotiu) {
  resultat = await supabase.rpc('obrador_anular_expedicio', { p_id: id });
}
```

Contra una base on la migració nova **no** s'hagi aplicat — un segon entorn, una
restauració, un desplegament on s'oblidi el SQL — la funció d'un argument existeix i
**esborra l'expedició**. Des de la pantalla sembla que l'anul·lació ha anat bé.

Això trenca la regla 20 (*«Una expedició es pot anul·lar, i l'anul·lació deixa rastre. Mai
s'esborra»*) i la regla general: tot registre ha de poder dir què va passar, qui ho va fer i
quan. És exactament el defecte que la prova funcional del 19/10 va detectar com a KO (cas
T21), reintroduït per la porta del darrere.

### Què has de fer

Elimina el fallback. Si la RPC de dos arguments no existeix, **falla de manera visible** amb
un missatge que digui què falta aplicar. No facis cap altra crida.

```js
export async function anularExpedicio(id, motiu) {
  const net = String(motiu || '').trim();
  const { data, error } = await supabase.rpc('obrador_anular_expedicio', {
    p_id: id,
    p_motiu: net || null
  });
  if (error) {
    const msg = error.message || '';
    if (error.code === 'PGRST202' || /could not find the function|p_motiu/i.test(msg)) {
      throw new Error(
        "Aquesta base de dades no té la versió d'anul·lació amb rastre. " +
        "Cal aplicar database/alter_obrador_expedicions_anular_rastre.sql abans " +
        "de poder anul·lar expedicions."
      );
    }
    throw error;
  }
  return data;
}
```

### Criteris d'acceptació

- No queda cap crida a `obrador_anular_expedicio` amb un sol argument al codi.
- Contra una base migrada, anul·lar segueix funcionant igual que ara: estat `anulada`, motiu,
  autor i hora, i el lot torna a `envasat`.
- Contra una base sense migrar, l'anul·lació falla amb el missatge d'error i **no esborra
  res**.
- Busca si hi ha fallbacks del mateix patró en altres funcions del servei (`getClients` en
  té un de benigne, que només llegeix). Qualsevol fallback que **escrigui o esborri** contra
  un esquema antic s'ha de tractar igual: fallar, no degradar.

---

## Tasca 2 — Construir el CRUD de la fitxa de producte

**Fitxers:** `src/services/obradorSupabaseService.js`, `src/components/obrador/ObradorProductesPage.jsx`
**Prioritat:** mitjana, però bloqueja documentació ja entregada.

### El problema

La taula `obrador_productes` té la fitxa completa:

| Columna | Tipus | Per a què serveix |
|---|---|---|
| `nom` | TEXT NOT NULL | Nom comercial |
| `caducitat_dies` | INTEGER | Calcula la caducitat de l'etiqueta (regla 14) |
| `allergens` | TEXT[] | Van a l'etiqueta. **Requisit legal** (regla 15) |
| `temp_coccio` | DECIMAL(4,1) | Mínim de cocció. Bloqueja el lot si no s'arriba (regla 9) |
| `temp_conservacio` | DECIMAL(4,1) | Temperatura de conservació |
| `fitxa_tecnica` | TEXT | Text lliure |
| `actiu` | BOOLEAN | Un producte inactiu no apareix en crear lots nous |

El sistema **llegeix** aquests camps i hi recolza tres controls. Però no hi ha cap manera
d'escriure'ls des de l'aplicació: `ObradorProductesPage` només associa productes amb
proveïdors i ingredients, i el servei només té `getProductes()` i `setProducteProveidors()`.
Avui la fitxa només es toca per SQL.

Dues conseqüències:

1. Quan l'obrador operi, producció haurà de donar d'alta productes i no ho farà per SQL.
2. El manual d'ús entregat (apartat 4, «Productes») descriu aquesta pantalla amb tots els
   seus camps. Descriu una cosa que no existeix.

### Què has de fer

**Al servei:**

- Amplia `getProductes()` perquè retorni també `fitxa_tecnica` i `actiu`, i accepta un
  paràmetre per incloure els inactius (per defecte, només actius — no canviïs el
  comportament de qui ja la fa servir).
- Afegeix `crearProducte(dades)` i `actualitzarProducte(id, dades)`.
- Afegeix `arxivarProducte(id)` que posa `actiu = false`. **No esborris mai un producte**:
  els lots històrics hi apunten i esborrar-lo trencaria la traçabilitat.
- Mantén el fallback de `getProductes()` per a l'esquema antic tal com està: només llegeix.

**A la pantalla:**

- Formulari d'alta i d'edició amb els set camps. Els al·lèrgens com a llista editable, no
  com a text lliure separat per comes: han d'acabar al `TEXT[]` nets.
- Validació abans de desar:
  - `nom` obligatori i únic entre els actius.
  - `caducitat_dies` obligatori i més gran que zero. Sense això l'etiqueta no pot calcular
    la caducitat.
  - `temp_coccio` i `temp_conservacio` opcionals, però si `temp_coccio` és buida avisa que
    aquest producte **no tindrà control de temperatura de cocció**. No ho bloquegis; que la
    persona ho sàpiga.
- L'associació de proveïdors que ja hi ha es queda a la mateixa pantalla, tal com diu el
  manual.
- Escriure està restringit a management: la política `obrador_productes_write_management`
  ja ho imposa a la base de dades. A la pantalla, amaga o desactiva els controls d'escriptura
  per a qui no ho sigui, i no deixis que l'únic avís sigui un error de RLS.

### El que no has de fer

- No presentis els llindars de temperatura com a criteris APPCC validats (regla 31). Els
  valors que hi hagi al codi o a les dades sembrades són referència tècnica. Qui fixa els
  criteris sanitaris és la responsable de qualitat. El text de la pantalla ho ha de reflectir.
- No afegeixis cap camp nou a la taula. Si creus que en falta un, atura't i digues-ho.
- No toquis el càlcul de caducitat ni el bloqueig per temperatura. Aquesta tasca només
  afegeix la manera d'editar les dades que aquests controls ja llegeixen.

### Criteris d'acceptació

- Es pot crear un producte des de la pantalla, amb al·lèrgens, i aquests al·lèrgens surten a
  l'etiqueta del primer lot que se'n faci.
- Es pot editar la `temp_coccio` d'un producte i el bloqueig del lot per temperatura
  insuficient passa a fer servir el valor nou.
- S'hi pot arxivar un producte, deixa d'aparèixer en crear lots nous i els lots antics
  segueixen mostrant-lo.
- Un usuari que no és management no pot desar canvis, i la pantalla l'hi diu abans
  d'intentar-ho.
- L'apartat 4 del manual d'ús descriu la pantalla que queda. Si has hagut de desviar-te'n,
  digues en què i per què.
