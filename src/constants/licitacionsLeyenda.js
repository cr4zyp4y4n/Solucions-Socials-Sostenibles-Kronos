import { LICITACIONS_ESTAT_CONTRACTACIO } from './licitacionsEstat';

/** Estado del expediente en la fuente pública (TED / PSCP / PLACSP). */
export const LICITACIONS_LEYENDA_CONTRACTACIO = [
  {
    code: 'PRE',
    ...LICITACIONS_ESTAT_CONTRACTACIO.PRE,
    description:
      'Aviso previo a la licitación formal. Informa de la intención de contratar; aún no es (o no era) el plazo para presentar ofertas.',
    examples: ['Anuncio previo (TED)', 'Anunci previ (PSCP)'],
    vigent: true
  },
  {
    code: 'PUB',
    ...LICITACIONS_ESTAT_CONTRACTACIO.PUB,
    description:
      'Licitación publicada y abierta a ofertas. El plazo de presentación sigue vigente (fecha límite ≥ hoy).',
    examples: ['En plazo', 'En plazo (TED)', 'Anunci de licitació (PSCP)'],
    vigent: true
  },
  {
    code: 'EV',
    ...LICITACIONS_ESTAT_CONTRACTACIO.EV,
    description:
      'Plazo de ofertas cerrado. El expediente está en evaluación o pendiente de adjudicación.',
    examples: ['Plazo cerrado', 'Plazo cerrado (TED)', 'Pendiente de adjudicación'],
    vigent: false
  },
  {
    code: 'ADJ',
    ...LICITACIONS_ESTAT_CONTRACTACIO.ADJ,
    description: 'Ya hay adjudicatario. La licitación ha salido de la fase de ofertas.',
    examples: ['Adjudicada', 'Adjudicada (TED)'],
    vigent: false
  },
  {
    code: 'RES',
    ...LICITACIONS_ESTAT_CONTRACTACIO.RES,
    description: 'Contrato formalizado o en ejecución. Expediente resuelto.',
    examples: ['Resuelta'],
    vigent: false
  },
  {
    code: 'ANUL',
    ...LICITACIONS_ESTAT_CONTRACTACIO.ANUL,
    description: 'Expediente anulado por el órgano de contratación.',
    examples: ['Anulada'],
    vigent: false
  },
  {
    code: 'DES',
    ...LICITACIONS_ESTAT_CONTRACTACIO.DES,
    description: 'Ninguna oferta válida o no se presentaron ofertas.',
    examples: ['Desierta'],
    vigent: false
  }
];

/** Seguimiento comercial interno de SSS (columna Estado JC). */
export const LICITACIONS_LEYENDA_JC = [
  {
    value: 'Pendent',
    label: 'Pendent',
    color: '#6B7280',
    description: 'Aún no revisada por el equipo. Es el estado por defecto al detectar una licitación nueva.'
  },
  {
    value: 'Interessant',
    label: 'Interessant',
    color: '#10B981',
    description: 'Oportunidad de interés. Se conserva en base de datos aunque caduque el plazo público.'
  },
  {
    value: 'Descartada',
    label: 'Descartada',
    color: '#EF4444',
    description: 'No nos interesa. Suele ocultarse al filtrar solo activas.'
  },
  {
    value: 'Contactat',
    label: 'Contactat',
    color: '#3B82F6',
    description: 'Ya se ha contactado con el órgano o se está gestionando. También se conserva si caduca.'
  }
];

export const LICITACIONS_LEYENDA_FUENTES = [
  {
    source: 'TED',
    color: '#3B82F6',
    description: 'Portal europeo de contratación pública (España). Puede mostrar “(TED)” en el estado.'
  },
  {
    source: 'PSCP',
    color: '#F59E0B',
    description: 'Plataforma de serveis de contractació pública de Catalunya. A menudo conserva el texto en catalán (p. ej. “Anunci previ”).'
  },
  {
    source: 'PLACSP',
    color: '#8B5CF6',
    description: 'Plataforma de contratación del sector público estatal. Usa códigos estándar PRE, PUB, EV…'
  }
];
