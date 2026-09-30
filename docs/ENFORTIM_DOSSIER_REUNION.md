# Dossier reunió Enfortim / ESCALBRADOR

> Exp. **2026_OVT_583379** · Ajuntament BCN · Otorgat **6.300 €**  
> Execució formal: **14/12/2026 → 13/12/2027**  
> Estat Kronos: **PRE-REUNIÓ** (no tancar esquema ni lliurables fins després d’aquesta reunió)  
> Data dossier: 30/09/2026 · Preparat per Brian

---

## 1. Objectiu de la reunió

Validar amb **Sergi** i **Bruno** el repartiment intern/extern i el model de treball abans d’obrir desenvolupament pesat a Kronos (escandalls, dashboard KPI mensual, SOPs digitals).

**Línia vermella:** InnvESS = obrador + digitalització Ac3 (ja en producció).  
Enfortim = capa de gestió. **Cap despesa imputable a les dues subvencions.**

---

## 2. Què ja està fet (InnvESS / Ac3) — no tornar a finançar

- Mòdul Obrador a Kronos + portal mòbil OCR/QR
- Recepció → lot multi-MP → etiqueta QR → expedició → entrega
- Incidències lot/sensor, IoT temperatures, sync proveïdors Holded
- Millores 2026: anti-doble expedició, check sortida obligatori, OCR compartit, reimpressió etiquetes

→ El **sistema de registres** de R1 ja cobreix Ac3. Enfortim no ha de “refaire” el traçabilitat diària.

---

## 3. Què aportaria Kronos sota Enfortim (proposta Brian)

| Resultat | Lliurable | Kronos | Contingut / altres |
|----------|-----------|--------|--------------------|
| **R1** | 8–10 SOPs digitals + PDF | Índex + MD a `docs/sops/` + export PDF | APPCC/manipulació = externa salut pública |
| **R2** | ≥15 escandalls (fred, rebosteria, frescos) | Eina CRUD + costos Holded + export ficha | Receptes/mermes = Bruno/Cristina |
| **R3** | 1 dashboard mensual + 12 informes PDF | Vista **nova** (no el dashboard diari) | Validar els 6 KPIs amb Sergi |
| R4 B2B | Pipeline comercial | Només suport puntual | Comercial / externa |
| R5 Protocol | Dossier evidències | Exports/captures del sistema | Bruno + externa |

---

## 4. Preguntes per tancar a la reunió

### Model i abast
- [ ] El **model de fitxa d’escandall** el defineix una externa o l’acordem internament?
- [ ] Quines **línies de negoci** exactes? (`fred` / `rebosteria` / `frescos` o altres noms SSS)?
- [ ] Quins **15 productes** prioritaris per als primers escandalls?
- [ ] Costos: només ingredients Holded, o també envàs, energia, mà d’obra?

### KPIs (R3)
- [ ] Acceptem la proposta dels **6 KPIs** (secció 5) o cal canviar-ne algun d’impacte?
- [ ] Dades d’inserció / formació: d’on surten? (manual mensual vs full / Holded / RRHH)
- [ ] Qui signa / arxiva els **12 informes mensuals** PDF?

### SOPs (R1)
- [ ] Confirmem que Brian fa només SOPs dels **fluxos Kronos** (llista secció 6)?
- [ ] Qui fa APPCC/manipulació i en quin termini?

### Calendari i equip
- [ ] Data d’**inici real** de desenvolupament (infra pròpia abans de des 2026 és OK)?
- [ ] Pràctiques: **DAM/DAW** (amb Brian) o Admin. i Finances?
- [ ] Què queda de part externa (D3) després de la reformulació de Bruno?

### Justificació / pressupost
- [ ] Tope personal propi 1.575 € / indirectes 630 € — com es reparteix el temps Brian?
- [ ] Com evitem doble imputació InnvESS ↔ Enfortim en factures Kronos/portal?

---

## 5. Proposta de 6 KPIs mensuals (a validar)

| # | KPI | Font prevista | Dependència |
|---|-----|---------------|-------------|
| 1 | Margen brut per línia (fred / rebosteria / frescos) | Escandalls + vendes/consum | **R2** |
| 2 | Cost per lot produït | Escandalls × lots del mes | **R2** |
| 3 | Lots produïts / mes i % incidències | `obrador_lots` + `obrador_incidencies` | Ac3 ja |
| 4 | Compliment registres APPCC (%) | Recepcions completes + checks sortida + IoT | Ac3 (+ millores) |
| 5 | Persones en inserció vinculades a l’obrador | Manual / RRHH (camp mensual) | Acord Sergi |
| 6 | Hores formació / noves contractacions vulnerables | Manual / formació | Acord Sergi |

**UI:** vista mensual amb comparativa mes anterior + botó **Exportar informe PDF** (= lliurable justificable).  
**No barrejar** amb el dashboard operatiu diari (temperatures / lots avui).

---

## 6. Índex SOP digitals (borrador Brian)

Veure `docs/sops/README.md`. Proposta inicial (8–10):

1. Recepció de mercaderia (manual + OCR)
2. Associació producte–proveïdor
3. Creació de lot i etiqueta QR
4. Reimpressió d’etiqueta
5. Expedició (check sortida + client)
6. Confirmació d’entrega
7. Gestió d’incidències (lot / sensor)
8. Lectura i resposta a alertes de temperatura IoT
9. *(opcional)* Importació proveïdors Holded
10. *(opcional)* Anul·lació d’expedició / correcció de recepció

Fora d’abast Brian: SOP APPCC cuina, higiene, manipulació aliments.

---

## 7. Escandall — camps provisionals (NO esquema tancat)

Només per discutir; el SQL definitiu espera la reunió.

**Capçalera:** producte, línia (fred|rebosteria|frescos), PVP, unitat venda, versió, data revisió, actiu.  
**Línies:** ingredient/producte, quantitat, unitat, cost unitari (Holded), merma %, cost línia.  
**Totals:** cost ingredients, envàs, costos assignats, cost total, margen brut € i %.  
**Accions UI:** CRUD, duplicar, export PDF/Excel.

Esquelet a Kronos: pestanyes **Escandalls** i **KPIs mensuals** (banner “provisional / post-reunió”).

---

## 8. Calendari orientatiu (si es valida a la reunió)

| Fase | Quan | Què |
|------|------|-----|
| A | Post-reunió | Tancar model escandall + KPIs definitius |
| B | Abans 14/12/2026 | Infra Kronos (CRUD escandalls, vista KPI, plantilla SOP→PDF) |
| C | 14/12/2026 – 13/12/2027 | Generar els 15 escandalls, 12 informes, SOPs firmats |
| D | +2 mesos | Justificació |

---

## 9. Decisions (omplir a la reunió)

| # | Decisió | Acord | Qui |
|---|---------|-------|-----|
| 1 | Model escandall | | |
| 2 | 6 KPIs definitius | | |
| 3 | Font dades impacte (5–6) | | |
| 4 | Data inici desenvolupament | | |
| 5 | Perfil pràctiques | | |
| 6 | Abast externa vs Brian | | |

**Assistents:**  
**Data reunió:**  
**Acta / proper pas:**  
