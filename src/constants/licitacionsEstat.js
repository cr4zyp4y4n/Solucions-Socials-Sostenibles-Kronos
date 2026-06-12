/** Códigos oficiales PLACSP (SyndicationContractFolderStatusCode-2.04). */
export const LICITACIONS_ESTAT_CONTRACTACIO = {
  PRE: { label: 'Anuncio previo', color: '#6B7280' },
  PUB: { label: 'En plazo', color: '#10B981' },
  EV: { label: 'Pendiente de adjudicación', color: '#F59E0B' },
  ADJ: { label: 'Adjudicada', color: '#3B82F6' },
  RES: { label: 'Resuelta', color: '#64748B' },
  ANUL: { label: 'Anulada', color: '#EF4444' },
  DES: { label: 'Desierta', color: '#A855F7' }
};

export function getEstatContractacioMeta(code, label) {
  const key = String(code || '').toUpperCase();
  const meta = LICITACIONS_ESTAT_CONTRACTACIO[key];
  if (meta) return { code: key, label: label || meta.label, color: meta.color };
  if (label) return { code: key || null, label, color: '#6B7280' };
  return { code: null, label: 'Sin estado', color: '#6B7280' };
}
