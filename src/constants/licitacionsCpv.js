/** Codis CPV per filtrar licitacions rellevants per a SSS (spec juny 2025). */
export const LICITACIONS_CPV_FILTER = [
  // Catering / restauració
  '55000000',
  '55300000', // Restaurant, preparació i subministrament de menjars (general)
  '55500000',
  '55510000',
  '55520000', // Suministro de comidas desde el exterior
  '55523000', // Catering empreses / institucions
  '55523100', // Catering escolar (fill de 55523000)
  '79952000',
  '79951000',
  '90700000',
  '90710000',
  '90720000',
  '72000000',
  '72200000',
  '72600000'
];

export const LICITACIONS_ESTAT_JC = ['Pendent', 'Interessant', 'Descartada', 'Contactat'];

export const LICITACIONS_SOURCES = ['TED', 'PSCP', 'PLACSP'];
