export const LICITACIONS_LAST_VISIT_KEY = 'kronos_licitacions_last_visit';
export const LICITACIONS_LAST_SYNC_KEY = 'kronos_licitacions_last_sync';

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const iso = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!iso) return null;
  const target = new Date(`${iso[1]}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function getLastVisit() {
  try {
    const s = localStorage.getItem(LICITACIONS_LAST_VISIT_KEY);
    return s ? new Date(s) : null;
  } catch {
    return null;
  }
}

export function setLastVisit(date = new Date()) {
  try {
    localStorage.setItem(LICITACIONS_LAST_VISIT_KEY, date.toISOString());
  } catch {
    // ignore
  }
}

export function getLastSync() {
  try {
    const s = localStorage.getItem(LICITACIONS_LAST_SYNC_KEY);
    return s ? new Date(s) : null;
  } catch {
    return null;
  }
}

export function setLastSync(date = new Date()) {
  try {
    localStorage.setItem(LICITACIONS_LAST_SYNC_KEY, date.toISOString());
  } catch {
    // ignore
  }
}

export function countNewSince(rows, since) {
  if (!since) return 0;
  const t = since.getTime();
  return (rows || []).filter((r) => {
    if (!r?.detected_at) return false;
    return new Date(r.detected_at).getTime() > t;
  }).length;
}

export function computeLicitacionsStats(rows) {
  let pendents = 0;
  let interessants = 0;
  let vencenSetmana = 0;
  let actives = 0;

  for (const r of rows || []) {
    if (r.estat_jc === 'Pendent') pendents += 1;
    if (r.estat_jc === 'Interessant') interessants += 1;
    if (r.estat_jc !== 'Descartada') actives += 1;

    const d = daysUntil(r.termini_oferta);
    if (d != null && d >= 0 && d <= 7) vencenSetmana += 1;
  }

  return { pendents, interessants, vencenSetmana, actives, total: rows?.length || 0 };
}

export function formatLastSyncLabel(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  try {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    }).format(date);
  } catch {
    return date.toLocaleString('es-ES');
  }
}
