import {
  LICITACIONES_CERRADAS,
  daysUntil,
  isLicitacioVigent,
  shouldPurgeLicitacioFromDb
} from '../../services/licitacionsVigent';

export const LICITACIONS_LAST_VISIT_KEY = 'kronos_licitacions_last_visit';
export const LICITACIONS_LAST_SYNC_KEY = 'kronos_licitacions_last_sync';

export {
  LICITACIONES_CERRADAS,
  daysUntil,
  isLicitacioVigent,
  shouldPurgeLicitacioFromDb
};

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
  const vigents = (rows || []).filter(isLicitacioVigent);
  let pendents = 0;
  let interessants = 0;
  let vencenSetmana = 0;
  let actives = 0;
  let previos = 0;

  for (const r of vigents) {
    if (r.estat_jc === 'Pendent') pendents += 1;
    if (r.estat_jc === 'Interessant') interessants += 1;
    if (r.estat_jc !== 'Descartada') actives += 1;
    if (String(r.estat_contractacio || '').toUpperCase() === 'PRE') previos += 1;

    const d = daysUntil(r.termini_oferta);
    if (d != null && d >= 0 && d <= 7) vencenSetmana += 1;
  }

  return {
    pendents,
    interessants,
    vencenSetmana,
    actives,
    previos,
    vigents: vigents.length,
    ocultes: (rows?.length || 0) - vigents.length,
    total: rows?.length || 0
  };
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
