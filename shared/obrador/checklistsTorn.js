/**
 * BORRADOR TÈCNIC.
 * El contingut definitiu d'aquests checklists l'ha de validar la responsable
 * de qualitat. Els ítems d'aquí són un esborrany tècnic, no el APPCC tancat.
 *
 * No hi ha llindars de temperatura. On cal un número, l'ítem només demana
 * el valor llegit (demanaValor: true). No es compara amb cap límit.
 *
 * Per canviar el checklist n'hi ha prou d'editar aquest fitxer. No cal migració:
 * cada registre guarda la llista tal com estava el dia que es va fer.
 */

export const MOMENTS_TORN = [
  { id: 'inici', label: 'Inici de torn' },
  { id: 'produccio', label: 'Producció' },
  { id: 'tancament', label: 'Tancament de torn' }
];

export const CHECKLISTS_TORN = {
  inici: [
    { clau: 'cambres', etiqueta: 'Càmares de fred en marxa i amb la porta tancada' },
    { clau: 'congeladors', etiqueta: 'Congeladors en marxa i amb la porta tancada' },
    { clau: 'temperatura_cambres', etiqueta: 'Temperatura llegida a les càmares', demanaValor: true },
    { clau: 'temperatura_congeladors', etiqueta: 'Temperatura llegida als congeladors', demanaValor: true },
    { clau: 'neteja_superficies', etiqueta: 'Superfícies de treball netes abans de començar' },
    { clau: 'utillatge', etiqueta: 'Utillatge net i en bon estat' },
    { clau: 'higiene_personal', etiqueta: 'Higiene personal correcta (mans, roba, cabell recollit)' }
  ],
  produccio: [
    { clau: 'temperatures_coccio', etiqueta: 'Temperatures de cocció anotades', demanaValor: true },
    { clau: 'separacio_allergens', etiqueta: 'Al·lèrgens separats durant l\'elaboració' },
    { clau: 'mostres', etiqueta: 'Mostres de conservació guardades i identificades' }
  ],
  tancament: [
    { clau: 'neteja', etiqueta: 'Neteja de superfícies i equips feta' },
    { clau: 'residus', etiqueta: 'Residus retirats i contenidors tancats' },
    { clau: 'tancament_cambres', etiqueta: 'Càmares i congeladors tancats' },
    { clau: 'producte_sobrant', etiqueta: 'Producte sobrant identificat, etiquetat i guardat' }
  ]
};
