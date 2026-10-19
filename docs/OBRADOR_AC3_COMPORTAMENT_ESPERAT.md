# Obrador Ac3 — comportament esperat del sistema

> Especificació de les regles que el circuit de traçabilitat ha de complir.
> Derivada del protocol de prova funcional v1.0 i verificada contra el codi.
>
> **Per a Cursor:** fes servir aquest fitxer com a referència del comportament
> correcte. Si una tasca nova trenca alguna d'aquestes regles, atura't i digues-ho
> abans de continuar. Són controls sanitaris i de traçabilitat, no preferències.

---

## Regla general

Tot registre ha de poder dir **què va passar, qui ho va fer i quan**. Qualsevol canvi
que permeti desar alguna cosa sense una d'aquestes tres coses és una regressió.

---

## Recepcions

1. Una recepció **sense proveïdor** no es pot desar.
2. Una recepció marcada com a **rebutjada** exigeix observacions. Sense explicació no
   es desa.
3. Una recepció **rebutjada no és apta per a producció**: no ha d'aparèixer com a
   seleccionable en crear un lot.
4. L'OCR **proposa, no decideix**. L'esborrany sempre passa per revisió humana abans de
   desar-se, i els canvis manuals han de prevaler sobre el que ha llegit l'OCR.
5. Si l'OCR llegeix un proveïdor que no es pot associar a cap fitxa, el sistema demana
   selecció manual i **mostra el nom llegit** per poder comparar.

## Lots

6. Un lot necessita **producte i almenys una recepció**.
7. Un lot pot consumir **diverses recepcions**. És la peça que tanca la traçabilitat
   d'elaboració: no es pot simplificar a una relació 1:1.
8. Només s'ofereixen les recepcions **dels proveïdors associats** al producte del lot.
9. Si la temperatura final de cocció és **inferior a la de la fitxa del producte**, el
   lot no es desa. És un control sanitari: no es converteix en avís.
10. La **mostra guardada** és obligatòria per tancar el lot.
11. El **codi de lot és únic** a tot el sistema.

## Etiquetes

12. **Una etiqueta per lot.** No se'n poden generar dues.
13. Cada **codi QR és únic**.
14. La data de caducitat es calcula a partir dels dies de caducitat de la fitxa del
    producte, no s'introdueix a mà.
15. Els al·lèrgens de l'etiqueta vénen de la fitxa del producte. És requisit legal.
16. Un lot **sense etiqueta generada no es pot expedir**.

## Expedicions

17. El **check de sortida és obligatori**, i està imposat també a la base de dades, no
    només a la pantalla. Qualsevol via alternativa d'expedició ha de respectar-ho.
18. Una expedició **sense client** no es desa.
19. **Un lot no es pot expedir dues vegades.** Ho garanteix un índex únic. No s'ha de
    substituir per una comprovació a l'aplicació.
20. Una expedició es pot **anul·lar**, i l'anul·lació **deixa rastre**. Mai s'esborra.

## Incidències

21. La descripció és obligatòria i ha de tenir **almenys 10 caràcters**. És deliberat:
    evita incidències registrades amb una paraula.
22. Els estats són **oberta → en curs → tancada**.
23. En tancar-la cal deixar constància de què s'ha fet.

## Quadre de comandament

24. Els indicadors diaris compten el **dia natural d'Europa/Madrid**, de 00:00 a 23:59,
    no les últimes 24 hores.
25. Cada indicador filtra per la **data pròpia del fet** (producció, sortida, envasat,
    recepció), no per la data d'introducció al sistema.
26. **Incidències obertes** és acumulat històric, no un indicador del dia. No s'ha
    d'unificar amb els altres.
27. Els indicadors es calculen en viu; **no hi ha sèrie històrica**. Si s'afegeix,
    documenta-ho.

## Sensors (quan hi hagi maquinari)

28. Un sensor està en alerta si està **fora de rang**, **sense senyal** o **en revisió**.
29. Els llindars són **per sensor**, no globals.
30. Els **minuts de tolerància** eviten que una obertura de porta generi una alerta.
31. Els llindars sanitaris els fixa la responsable de qualitat. Els valors que hi ha al
    codi són referència tècnica: **no els presentis com a criteris APPCC**.

---

## Si has de tocar alguna d'aquestes regles

No les relaxis per fer passar una funcionalitat nova. Si una tasca sembla exigir-ho,
és que la tasca està mal plantejada o que falta informació. Digues-ho.
