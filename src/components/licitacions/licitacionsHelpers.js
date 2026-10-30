import {
  LICITACIONES_CERRADAS,
  daysUntil,
  isLicitacioVigent,
  shouldArchiveLicitacio,
  shouldPurgeLicitacioFromDb
} from '../../services/licitacionsVigent';

export const LICITACIONS_LAST_VISIT_KEY = 'kronos_licitacions_last_visit';
export const LICITACIONS_LAST_SYNC_KEY = 'kronos_licitacions_last_sync';

export {
  LICITACIONES_CERRADAS,
  daysUntil,
  isLicitacioVigent,
  shouldArchiveLicitacio,
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

/** Inici de setmana ISO (dilluns 00:00 local) com a ISO string. */
export function startOfIsoWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // dilluns=0
  x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - day);
  return x.toISOString();
}

/** Stats del circuit (filtrables per àrea a la UI). */
export function computeLicitacionsStats(rows, { area = '' } = {}) {
  let list = (rows || []).filter((r) => !r.arxivada);
  if (area) list = list.filter((r) => (r.area || 'Altres') === area);

  const vigents = list.filter(isLicitacioVigent);
  const weekStart = startOfIsoWeek();
  let detectadesSetmana = 0;
  let pendentsTraslladar = 0;
  let valorades = 0;
  let activades = 0;
  let reservadesVigents = 0;
  let vencenSetmana = 0;
  let previos = 0;

  for (const r of list) {
    if (r.estat_circuit === 'Detectada' && r.detected_at && r.detected_at >= weekStart) {
      detectadesSetmana += 1;
    }
    if (r.estat_circuit === 'Detectada' && isLicitacioVigent(r)) pendentsTraslladar += 1;
    if (r.estat_circuit === 'Valorada') valorades += 1;
    if (r.estat_circuit === 'Activada') activades += 1;
  }

  for (const r of vigents) {
    if (r.reservada) reservadesVigents += 1;
    if (String(r.estat_contractacio || '').toUpperCase() === 'PRE') previos += 1;
    const d = daysUntil(r.termini_oferta);
    if (d != null && d >= 0 && d <= 7) vencenSetmana += 1;
  }

  return {
    detectadesSetmana,
    pendentsTraslladar,
    valorades,
    activades,
    reservadesVigents,
    vencenSetmana,
    previos,
    vigents: vigents.length,
    ocultes: (rows?.length || 0) - list.length,
    total: rows?.length || 0,
    // aliases legacy per no trencar crides antigues
    pendents: pendentsTraslladar,
    interessants: valorades,
    actives: vigents.filter((r) => r.estat_circuit !== 'Descartada').length
  };
}

/** Orden: reservades primer, després més noves. */
export function sortLicitacionsCircuit(list) {
  return [...(list || [])].sort((a, b) => {
    const ra = a?.reservada ? 1 : 0;
    const rb = b?.reservada ? 1 : 0;
    if (rb !== ra) return rb - ra;
    const da = a?.detected_at ? new Date(a.detected_at).getTime() : 0;
    const db = b?.detected_at ? new Date(b.detected_at).getTime() : 0;
    if (db !== da) return db - da;
    return String(a?.termini_oferta || '').localeCompare(String(b?.termini_oferta || ''));
  });
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

export function formatRelativeAgo(date) {
  if (!date || Number.isNaN(date.getTime())) return null;
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'fa uns segons';
  if (mins < 60) return `fa ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `fa ${hours} h`;
  const days = Math.round(hours / 24);
  return `fa ${days} dies`;
}

/** Banner d'última sync des de licitacions_sync_log. */
export function describeSyncBanner(logRow) {
  if (!logRow?.started_at && !logRow?.finished_at) {
    return {
      text: 'Encara no hi ha cap sincronització registrada',
      tone: 'warn',
      stale: true
    };
  }
  const when = new Date(logRow.finished_at || logRow.started_at);
  const ago = formatRelativeAgo(when) || formatLastSyncLabel(when);
  const stale = Number.isNaN(when.getTime())
    ? true
    : Date.now() - when.getTime() > 2 * 24 * 60 * 60 * 1000;
  const failed = logRow.ok === false;
  const status = failed ? 'amb errors' : 'OK';
  return {
    text: `Última sincronització: ${ago} (${status})`,
    tone: failed || stale ? 'error' : 'ok',
    stale,
    failed,
    log: logRow
  };
}

export function isValidCpvCode(code) {
  return /^\d{8}$/.test(String(code || '').trim());
}
