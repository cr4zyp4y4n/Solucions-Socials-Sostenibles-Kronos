/** Vigència / arxivat (ESM pur). */

export const LICITACIONES_CERRADAS = new Set(['EV', 'ADJ', 'RES', 'ANUL', 'DES']);

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const iso = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!iso) return null;
  const target = new Date(`${iso[1]}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function isLicitacioVigent(row) {
  if (!row) return false;
  const code = String(row.estat_contractacio || '').toUpperCase();
  if (LICITACIONES_CERRADAS.has(code)) return false;
  if (code === 'PRE') return true;

  const d = daysUntil(row.termini_oferta);
  if (d != null) return d >= 0;

  if (code === 'PUB' && row.source === 'PLACSP') return true;
  if (code === 'PUB') return false;
  return false;
}

export function shouldArchiveLicitacio(row) {
  if (!row) return false;
  if (row.arxivada) return false;
  return !isLicitacioVigent(row);
}
