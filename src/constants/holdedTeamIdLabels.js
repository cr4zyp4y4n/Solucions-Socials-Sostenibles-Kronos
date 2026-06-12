/**
 * Holded team/v1 no expone GET /teams (404). El campo «Equipo» en la UI guarda teamIds.
 * Mapeo id → etiqueta (CATERING, DIRECCIÓN, TECNIC, ADMINISTRACIÓ).
 * Revisa en Holded el nombre de cada equipo si algún bloque sale mal.
 */
export const HOLDED_TEAM_ID_LABELS_DEFAULT = {
  solucions: {
    '679765a2947786e5b2002a48': 'CATERING',
    '686291bc438adf44be04a273': 'DIRECCIÓN',
    '6a2014407e23d87df70a4f35': 'TECNIC',
    '6a20156f52561253e907c7dd': 'ADMINISTRACIÓ'
  },
  menjar: {
    '68624b43e3a455cd860380b7': 'CATERING',
    '6862513eff77ef3dc507752c': 'DIRECCIÓN',
    '686268f9ac6b07a1a4045ea7': 'ADMINISTRACIÓ'
  }
};
