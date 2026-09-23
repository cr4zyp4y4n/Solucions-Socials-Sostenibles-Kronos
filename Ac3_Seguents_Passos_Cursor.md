# Ac3 Obrador — Següents passos (setembre 2026)

**Projecte:** SSS Kronos — Electron + React + Supabase
**Mòdul:** Obrador Ac3 (traçabilitat) — ja en producció amb dades reals
**Regla general:** abans de tocar res, llegeix l'esquema real de Supabase i els serveis existents (`obradorSupabaseService.js`, `obradorHoldedSyncService.js`). No inventis columnes: si alguna cosa d'aquest document no quadra amb el que hi ha, digues-ho abans de canviar-ho. Fem cada tasca per separat i la provem abans de passar a la següent.

---

## TASCA 1 — Llistat de proveïdors seleccionables a l'app

### Context
Compres ens ha passat el llistat oficial de proveïdors. El fitxer net és `proveidors_obrador_2026.csv` (71 files). Cada proveïdor té un `estat_us`:

| estat_us | Significat | Quants |
|---|---|---|
| `habitual` | Els que més fem servir | 20 |
| `ocasional` | De tant en tant | 9 |
| `inactiu` | Ja no hi treballem | 42 |
| `revisar` | Pendent de confirmar (CHIAPANENCA) | 1 |

Columnes del CSV: `codi, nom, estat_us, nif, nif_normalitzat, contacte, telefon, mobil, email, web, adreca, poblacio, cp`.
`nif_normalitzat` ja no té espais, punts, guions ni prefix `ES`.

### Què cal fer
1. **Esquema:** afegir a `obrador_proveidors` una columna `estat_us` (text amb check `habitual | ocasional | inactiu | revisar`, default `habitual`), i `codi_intern` si no hi ha cap camp equivalent. Fes-ho amb un script SQL nou a `database/`, no editant el de creació.
2. **Importació (script d'un sol ús):**
   - Creuar amb els proveïdors que ja existeixen (importats de Holded) per **NIF normalitzat**. Normalitza també el NIF de la BD de la mateixa manera abans de comparar.
   - Si hi ha coincidència → actualitzar només `estat_us`, `codi_intern` i els camps de contacte que estiguin buits. **No sobreescriure** dades que ja vinguin de Holded.
   - Si no hi ha coincidència → inserir-lo nou.
   - 3 actius no tenen NIF (Tartas del norte, ECOPLAZA, CHIAPANENCA): creuar per nom (sense majúscules ni accents) i, si no hi ha coincidència clara, inserir-los i llistar-los al log per revisar a mà.
   - Treure un informe al final: actualitzats / inserits / sense coincidència.
3. **No esborrar mai proveïdors inactius:** hi ha lots i recepcions històriques que hi apunten. "Inactiu" vol dir que no surt al selector, no que desaparegui.
4. **Sync Holded:** assegurar que `obradorHoldedSyncService` **no trepitgi** `estat_us` ni `codi_intern` quan torni a sincronitzar. Un proveïdor nou que arribi de Holded entra amb `habitual` per defecte.
5. **Selector a l'app** (recepció i on es triï proveïdor):
   - Ordre: `habitual` primer (alfabètic), després `ocasional`, amb un separador o etiqueta visual.
   - `inactiu` i `revisar` ocults per defecte, amb un toggle "Mostrar inactius".
   - Cercador per nom i NIF.
6. **Gestió:** a la fitxa del proveïdor, poder canviar `estat_us` des de Kronos (rols admin/management).

### Proves
- El selector mostra 29 proveïdors actius (20 + 9) en l'ordre correcte.
- Una recepció antiga d'un proveïdor ara inactiu segueix mostrant el nom bé.
- Executar el sync de Holded després de la importació no canvia cap `estat_us`.

### Incidències del llistat (no les arreglis soles, només tingues-les en compte)
- Codi 5 BIOCOP (ocasional) i codi 6 Juan Irigoyen (inactiu) comparteixen NIF A58398819. Al creuar per NIF, **guanya el registre actiu**; que no s'apliqui `inactiu` a Biocop.
- Duplicats inactius: BioArtesa (25/54), Mentabio (28/51).
- IDONI (codi 27) és la botiga pròpia i les files "-" (71–74) s'han descartat.

---

## TASCA 2 — Sensors de temperatura IoT (preparar-ho tot abans que arribi el hardware)

### Context
Hardware decidit i pendent de comanda: **5× Milesight EM320-TH-868M-Magnet + 1× gateway Milesight UG56 Industrial 868M** (Ethernet/WiFi, sense 4G), amb **The Things Network (TTN, pla Discovery gratuït)** com a servidor LoRaWAN. Ubicacions previstes: Cambra fred 1, Cambra fred 2, Congelador, Producció, Magatzem sec.

**Flux complet d'una lectura:**

```
Sensor EM320-TH → Gateway UG56 (obrador, amb internet) → TTN → Webhook HTTP
  → Supabase Edge Function → obrador_temperatures → Dashboard Kronos (Realtime)
                                                   → Alertes (Telegram/email)
```

**Tot funciona amb Supabase, no cal cap servidor més.** Volum: 5 sensors cada 10 min = ~720 lectures/dia, ~260.000/any, i ~22.000 invocacions/mes de l'Edge Function. És molt poc per a Postgres i queda lluny dels límits de Supabase i TTN.

**Important:** Kronos és una app d'escriptori (Electron). Tota la lògica de recepció i d'alertes ha de viure al **servidor** (Edge Functions + base de dades), mai a l'app, perquè ha de funcionar encara que ningú tingui Kronos obert.

Tot el que és codi es pot construir i provar **ara** amb dades simulades. Quan arribin els sensors, només caldrà registrar-los.

### 2.0 — Configuració manual (la fa en Brian, no Cursor; és aquí com a context)
- Donar d'alta el gateway UG56 a TTN (Gateway EUI, pla de freqüències EU868).
- Crear l'aplicació a TTN i registrar els 5 sensors per OTAA (DevEUI/AppKey de l'etiqueta de cada sensor).
- Configurar el decoder oficial de Milesight per a l'EM320-TH a TTN, perquè `decoded_payload` arribi amb temperatura i humitat llegibles.
- Crear la integració **Webhook** de TTN apuntant a l'Edge Function, amb un secret a la capçalera.
- Requisit físic: el gateway necessita internet a l'obrador (cable Ethernet o WiFi).

### 2.1 — Taula de configuració de sensors
Crear `obrador_sensors` (script SQL nou a `database/`):
`id`, `dev_eui` (únic), `nom`, `ubicacio`, `tipus` (`camara_fred | congelador | ambient`), `llindar_min`, `llindar_max`, `minuts_tolerancia`, `minuts_sense_senyal` (per defecte 30), `actiu`, `ultima_lectura_at`.

Els llindars **no els inventis**: deixa'ls configurables i buits o amb valors de prova marcats clarament. Els valors definitius els dona Cristina segons l'APPCC.

Revisa l'esquema actual de `obrador_temperatures` (`ubicacio`, `tipus`, `valor`, `mesura_at`) i proposa si cal afegir `sensor_id` (FK) i `humitat`. Proposa-ho abans de canviar-ho.

### 2.2 — Edge Function de recepció (`ttn-webhook`)
Unes 50–100 línies:
1. Validar el secret compartit a la capçalera. Si no hi és o no coincideix → 401.
2. Llegir `end_device_ids.dev_eui`, `uplink_message.decoded_payload` (temperatura i humitat) i `received_at`.
3. Buscar el sensor a `obrador_sensors`. Si no existeix o no està actiu → registrar-ho en un log i respondre 200 (que TTN no reintenti).
4. Inserir la lectura a `obrador_temperatures` i actualitzar `ultima_lectura_at` del sensor.
5. Comprovar el rang (veure 2.3).
6. Tenir en compte que l'EM320-TH pot **retransmetre lectures antigues** quan recupera la connexió (guarda fins a 3.000 registres). Fes servir el timestamp de la lectura, no el de recepció, i evita duplicats (per exemple, un índex únic per sensor + `mesura_at`).

### 2.3 — Alertes
Dos tipus, les dues al servidor:

**a) Fora de rang.** Si un sensor està fora de `llindar_min`/`llindar_max` durant més de `minuts_tolerancia` seguits:
- Crear **una** incidència a `obrador_incidencies` per episodi (no una per lectura).
- Tancar-la automàticament quan torni a rang, i guardar-ne la durada i el valor màxim o mínim assolit.

**b) Sensor sense senyal.** Ningú avisa que les dades no arriben, per tant cal una tasca programada:
- Programar amb `pg_cron` (inclòs a Supabase) una comprovació cada 15 minuts.
- Si `now() - ultima_lectura_at > minuts_sense_senyal` → incidència "Sensor sense senyal".
- Aquesta és la part més important de cara a una auditoria APPCC: un forat de dades sense justificar és un problema.

**Notificacions:** quan s'obri una incidència, s'ha d'enviar un avís fora de Kronos.
- Opció recomanada: **bot de Telegram** (gratuït, una crida HTTP des de l'Edge Function).
- Alternativa: email amb un servei tipus Resend.
- Fes el codi amb un mòdul `notify()` desacoblat, perquè es pugui canviar de canal sense tocar la resta.
- **Pendent de decidir (no ho assumeixis):** qui rep els avisos (Cristina, Brian, Bruno) i per quin canal. Deixa els destinataris configurables.

### 2.4 — Dashboard Kronos
- El KPI "alertes de temperatura" i el bloc de temperatures en temps real han de llegir de `obrador_temperatures`, `obrador_sensors` i `obrador_incidencies`.
- Fer servir **Supabase Realtime** perquè s'actualitzi sol.
- Per sensor: última lectura, hora, estat (OK / fora de rang / sense senyal) i un gràfic de les últimes 24 h.

### 2.5 — Simulador
Script que enviï a l'Edge Function uplinks falsos amb el **format real de TTN v3**, amb aquests escenaris:
- Lectura normal.
- Sèrie fora de rang que dura més que la tolerància.
- Tornada a rang.
- Retransmissió de lectures antigues (duplicats inclosos).
- Petició sense secret.

### Proves
- Un uplink simulat apareix a `obrador_temperatures` amb la ubicació correcta i es veu al dashboard sense recarregar.
- 3 lectures seguides fora de rang (més enllà de la tolerància) → 1 incidència + 1 notificació. Torna a rang → incidència tancada.
- Aturar el simulador d'un sensor més de 30 min → incidència "sense senyal".
- Enviar dues vegades la mateixa lectura → només es guarda una.
- Una petició sense el secret és rebutjada.
