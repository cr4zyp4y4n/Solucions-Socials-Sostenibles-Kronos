/**
 * Publicitat del finançament InnvESS — font única de veritat.
 *
 * Obligacions de l'ORDRE EMT/199/2023, base 15:
 *   j) logotip del Departament segons el Programa d'Identificació Visual (PIV).
 *   k) imatge d'economia social + el text literal de FINANCAMENT_TEXT.
 *   l) els suports digitals han d'incorporar un bàner que dirigeixi al web
 *      del Programa d'economia social.
 *
 * La base 25.4.2 exigeix aportar documentació demostrativa d'haver-ho complert,
 * així que cal capturar pantalla de cada suport un cop desplegat.
 *
 * PENDENT: la base 15.k diu que és la Direcció General qui ha de facilitar els
 * logotips i la imatge. Fins que no arribin el pack del PIV i la URL exacta,
 * el bàner es mostra en mode només text, que ja compleix l'apartat k) parcialment.
 * Quan arribin, només cal tocar PROGRAMA_ESS_URL i LOGOS d'aquest fitxer.
 */

/** Text literal exigit per la base 15.k. No reformular. */
export const FINANCAMENT_TEXT =
  'Promou i finança: la Generalitat de Catalunya – Departament d\'Empresa i Treball';

/**
 * Web del Programa d'economia social (base 15.l).
 * PENDENT DE CONFIRMAR amb el gestor de l'expedient: aquesta és l'àrea
 * d'economia social del Departament, però cal que ell validi la URL exacta.
 */
export const PROGRAMA_ESS_URL = 'https://treball.gencat.cat/ca/ambits/economia_social/';

/**
 * Rutes dels logotips dins de la carpeta pública de cada aplicació.
 * Deixar a null mentre no es tinguin: el bàner s'adapta i no mostra imatges trencades.
 */
export const LOGOS = {
  /** Logotip del Departament d'Empresa i Treball (PIV). */
  departament: null,
  /** Imatge d'economia social facilitada per la Direcció General. */
  economiaSocial: null,
  /** Només si l'actuació es finança amb fons estatals. Confirmar amb el gestor. */
  ministeri: null
};

/** Text alternatiu de cada logotip, per accessibilitat. */
export const LOGOS_ALT = {
  departament: 'Generalitat de Catalunya — Departament d\'Empresa i Treball',
  economiaSocial: 'Economia social',
  ministeri: 'Ministeri de Treball i Economia Social'
};

/** Llista de logotips realment disponibles, en ordre de presentació. */
export function logosDisponibles() {
  return ['departament', 'economiaSocial', 'ministeri']
    .filter((clau) => Boolean(LOGOS[clau]))
    .map((clau) => ({ clau, src: LOGOS[clau], alt: LOGOS_ALT[clau] }));
}

/** true mentre no hi hagi cap logotip: el bàner va en mode només text. */
export function nomesText() {
  return logosDisponibles().length === 0;
}
