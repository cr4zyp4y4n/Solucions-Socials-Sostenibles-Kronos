/** Fallback de licitacions_config (mateix seed que la migració SQL). */

export const LICITACIONS_CONFIG_FALLBACK = {
  cpv_catering: [
    '55300000', '55320000', '55321000', '55322000',
    '55520000',
    '15894200',
    '79952000', '79951000'
  ],
  cpv_tech: [
    '72000000',
    '48000000',
    '50312000', '50320000',
    '32420000',
    '30200000',
    '80533000'
  ],
  cpv_exclusio: ['55330000', '55400000', '55500000', '55510000'],
  cpv_altres: [],
  keywords_exclusio: {
    Catering: [
      'bar', 'bares', 'cafeteria', 'cafetería', 'quiosc', 'quiosco', 'kiosco',
      'vending', 'màquines expenedores', 'máquinas expendedoras', 'chiringuito',
      'explotació del bar', 'explotación del bar', 'explotación de la cafetería'
    ],
    Tech: []
  },
  keywords_reserva: [
    'contrato reservado', 'contracte reservat', 'reservado a', 'reservat a',
    'disposición adicional cuarta', 'disposició addicional quarta',
    'empresas de inserción', "empreses d'inserció",
    'centros especiales de empleo', 'centres especials de treball'
  ],
  import_max: { Catering: 60000, Tech: 60000, Altres: 60000 },
  // Menors (1143) sol penjar-se / demanar certificat: off per defecte.
  fonts_actives: { TED: false, PSCP: true, PLACSP: true, PLACSP_MENORS: false },
  // Cap baix perquè un sync manual no s'eternitzi (es pot pujar a licitacions_config).
  placsp_max_pages: 12
};

function asArray(value, fallback) {
  if (Array.isArray(value)) return value;
  return Array.isArray(fallback) ? [...fallback] : [];
}

function asObject(value, fallback) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  return fallback && typeof fallback === 'object' ? { ...fallback } : {};
}

export function parseLicitacionsConfigRows(rows = []) {
  const map = {};
  for (const row of rows || []) {
    if (row?.key) map[row.key] = row.value;
  }
  return {
    cpv_catering: asArray(map.cpv_catering, LICITACIONS_CONFIG_FALLBACK.cpv_catering),
    cpv_tech: asArray(map.cpv_tech, LICITACIONS_CONFIG_FALLBACK.cpv_tech),
    cpv_exclusio: asArray(map.cpv_exclusio, LICITACIONS_CONFIG_FALLBACK.cpv_exclusio),
    cpv_altres: asArray(map.cpv_altres, LICITACIONS_CONFIG_FALLBACK.cpv_altres),
    keywords_exclusio: asObject(map.keywords_exclusio, LICITACIONS_CONFIG_FALLBACK.keywords_exclusio),
    keywords_reserva: asArray(map.keywords_reserva, LICITACIONS_CONFIG_FALLBACK.keywords_reserva),
    import_max: asObject(map.import_max, LICITACIONS_CONFIG_FALLBACK.import_max),
    fonts_actives: asObject(map.fonts_actives, LICITACIONS_CONFIG_FALLBACK.fonts_actives),
    placsp_max_pages: Number(map.placsp_max_pages) || LICITACIONS_CONFIG_FALLBACK.placsp_max_pages
  };
}

export async function loadLicitacionsConfig(supabase) {
  if (!supabase) {
    return {
      config: { ...LICITACIONS_CONFIG_FALLBACK },
      error: new Error('Sense client Supabase'),
      fromFallback: true
    };
  }
  try {
    const { data, error } = await supabase.from('licitacions_config').select('key, value');
    if (error) {
      return { config: { ...LICITACIONS_CONFIG_FALLBACK }, error, fromFallback: true };
    }
    if (!data?.length) {
      return { config: { ...LICITACIONS_CONFIG_FALLBACK }, error: null, fromFallback: true };
    }
    return { config: parseLicitacionsConfigRows(data), error: null, fromFallback: false };
  } catch (error) {
    return { config: { ...LICITACIONS_CONFIG_FALLBACK }, error, fromFallback: true };
  }
}
