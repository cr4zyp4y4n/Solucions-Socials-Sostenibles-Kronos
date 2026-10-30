/** Fonts de sincronització (UI / allowlist). Els CPV viuen a licitacions_config. */
export const LICITACIONS_SOURCES = ['TED', 'PSCP', 'PLACSP'];

/** Circuit comercial (substitueix estat_jc). */
export const LICITACIONS_ESTAT_CIRCUIT = [
  'Detectada',
  'Traslladada',
  'Valorada',
  'Descartada',
  'Activada'
];

export const LICITACIONS_AREAS = ['Catering', 'Tech', 'Altres'];

export const LICITACIONS_ESTAT_CIRCUIT_META = {
  Detectada: { label: 'Detectada', color: '#6B7280' },
  Traslladada: { label: 'Traslladada', color: '#F59E0B' },
  Valorada: { label: 'Valorada', color: '#8B5CF6' },
  Descartada: { label: 'Descartada', color: '#EF4444' },
  Activada: { label: 'Activada', color: '#10B981' }
};

/** @deprecated Preferir LICITACIONS_ESTAT_CIRCUIT. */
export const LICITACIONS_ESTAT_JC = ['Pendent', 'Interessant', 'Descartada', 'Contactat'];
