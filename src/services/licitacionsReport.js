import { isLicitacioVigent } from './licitacionsVigent';
import { LICITACIONS_CONFIG_FALLBACK, loadLicitacionsConfig } from './licitacionsConfig';

const AREAS_REPORT = ['Catering', 'Tech'];

/** Dilluns (ISO) de la setmana de `date` com a YYYY-MM-DD (local). */
export function weekStartDateString(date = new Date()) {
  const d = new Date(date);
  d.setHours(12, 0, 0, 0);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function weekEndExclusive(weekStartYmd) {
  const d = new Date(`${weekStartYmd}T12:00:00`);
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function formatWeekLabel(weekStartYmd) {
  const start = new Date(`${weekStartYmd}T12:00:00`);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const fmt = (x) => {
    const dd = String(x.getDate()).padStart(2, '0');
    const mm = String(x.getMonth() + 1).padStart(2, '0');
    return `${dd}/${mm}/${x.getFullYear()}`;
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function emptyAreaCounters() {
  return { detectades: 0, traslladades: 0, valorades: 0, descartades: 0, activades: 0 };
}

function addCounters(target, row) {
  target.detectades += Number(row.detectades) || 0;
  target.traslladades += Number(row.traslladades) || 0;
  target.valorades += Number(row.valorades) || 0;
  target.descartades += Number(row.descartades) || 0;
  target.activades += Number(row.activades) || 0;
}

function sumTotals(map) {
  const t = emptyAreaCounters();
  for (const area of AREAS_REPORT) addCounters(t, map[area] || emptyAreaCounters());
  return t;
}

function hasAnyActivity(counters) {
  return Object.values(counters).some((n) => Number(n) > 0);
}

/**
 * Carrega dades per al report setmanal.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function loadLicitacionsReportData(supabase, { weekStart } = {}) {
  const setmana = weekStart || weekStartDateString();
  const setmanaEnd = weekEndExclusive(setmana);
  const weekStartIso = new Date(`${setmana}T00:00:00`).toISOString();
  const weekEndIso = new Date(`${setmanaEnd}T00:00:00`).toISOString();

  const [{ config }, viewRes, syncRes, reservadesRes] = await Promise.all([
    loadLicitacionsConfig(supabase),
    supabase
      .from('licitacions_report_setmanal')
      .select('setmana, area, detectades, traslladades, valorades, descartades, activades'),
    supabase
      .from('licitacions_sync_log')
      .select('*')
      .gte('started_at', weekStartIso)
      .lt('started_at', weekEndIso)
      .order('started_at', { ascending: true }),
    supabase
      .from('licitacions')
      .select('id, title, area, termini_oferta, estat_circuit, organismo, url, arxivada, reservada, estat_contractacio')
      .eq('reservada', true)
      .eq('arxivada', false)
  ]);

  if (viewRes.error) throw viewRes.error;
  if (syncRes.error) throw syncRes.error;
  if (reservadesRes.error) throw reservadesRes.error;

  const weekByArea = {
    Catering: emptyAreaCounters(),
    Tech: emptyAreaCounters()
  };
  const acumByArea = {
    Catering: emptyAreaCounters(),
    Tech: emptyAreaCounters()
  };

  for (const row of viewRes.data || []) {
    const area = row.area === 'Catering' || row.area === 'Tech' ? row.area : null;
    if (!area) continue;
    addCounters(acumByArea[area], row);
    const rowWeek = String(row.setmana || '').slice(0, 10);
    if (rowWeek === setmana) addCounters(weekByArea[area], row);
  }

  const syncs = syncRes.data || [];
  const llegits = { ted: 0, pscp: 0, placsp: 0, placsp_menors: 0 };
  const exclosos = { cpv: 0, keyword: 0, import: 0 };
  const incidencies = [];
  let okCount = 0;
  let errCount = 0;

  for (const s of syncs) {
    if (s.ok === false) errCount += 1;
    else if (s.ok === true) okCount += 1;
    const l = s.llegits || {};
    for (const k of Object.keys(llegits)) llegits[k] += Number(l[k]) || 0;
    const e = s.exclosos || {};
    for (const k of Object.keys(exclosos)) exclosos[k] += Number(e[k]) || 0;
    if (s.errors) {
      const blob = typeof s.errors === 'string' ? s.errors : JSON.stringify(s.errors);
      if (blob && blob !== '{}' && blob !== 'null') {
        incidencies.push({
          when: s.finished_at || s.started_at,
          text: blob.slice(0, 500)
        });
      }
    }
  }

  // Dies sense sync dins la setmana (fins avui si és la setmana actual)
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const start = new Date(`${setmana}T12:00:00`);
  const endCap = new Date(`${setmanaEnd}T12:00:00`);
  endCap.setDate(endCap.getDate() - 1);
  const lastDay = today < endCap ? today : endCap;
  const daysWithSync = new Set(
    syncs.map((s) => String(s.started_at || '').slice(0, 10)).filter(Boolean)
  );
  const diesSenseSync = [];
  for (let d = new Date(start); d <= lastDay; d.setDate(d.getDate() + 1)) {
    const ymd = d.toISOString().slice(0, 10);
    if (!daysWithSync.has(ymd)) diesSenseSync.push(ymd);
  }

  const lastSync = [...syncs].reverse().find((s) => s.finished_at) || syncs[syncs.length - 1] || null;

  const reservadesVigents = (reservadesRes.data || [])
    .filter(isLicitacioVigent)
    .sort((a, b) => String(a.termini_oferta || '').localeCompare(String(b.termini_oferta || '')));

  return {
    setmana,
    setmanaLabel: formatWeekLabel(setmana),
    config: config || LICITACIONS_CONFIG_FALLBACK,
    weekByArea,
    acumByArea,
    weekTotals: sumTotals(weekByArea),
    acumTotals: sumTotals(acumByArea),
    syncs,
    okCount,
    errCount,
    llegits,
    exclosos,
    incidencies,
    diesSenseSync,
    lastSync,
    reservadesVigents
  };
}

function areaLabel(area) {
  return area === 'Catering' ? 'Càtering' : area;
}

function fmtDate(value) {
  if (!value) return '—';
  const iso = String(value).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!iso) return String(value);
  const [y, m, d] = iso[1].split('-');
  return `${d}/${m}/${y}`;
}

function fmtDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('ca-ES', {
      dateStyle: 'short',
      timeStyle: 'short'
    });
  } catch {
    return String(value);
  }
}

function countersLine(c) {
  return `detectades ${c.detectades}, traslladades ${c.traslladades}, valorades ${c.valorades}, descartades ${c.descartades}, activades ${c.activades}`;
}

/**
 * Genera el markdown del report en català.
 */
export function buildLicitacionsReportMarkdown(data, { properesAccions = '' } = {}) {
  const fonts = data.config?.fonts_actives || {};
  const fontsActives = Object.entries(fonts)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ') || 'cap';

  const lines = [];
  lines.push(`# Report setmanal de licitacions`);
  lines.push('');
  lines.push(`**Setmana:** ${data.setmanaLabel}`);
  lines.push(`**Generat:** ${fmtDateTime(new Date().toISOString())}`);
  lines.push('');

  lines.push(`## 1. Estat de l'eina`);
  lines.push('');
  lines.push(`- Sincronitzacions aquesta setmana: **${data.syncs.length}** (OK: ${data.okCount}, amb errors: ${data.errCount})`);
  lines.push(`- Fonts actives: ${fontsActives}`);
  lines.push(
    `- Última sincronització: ${
      data.lastSync
        ? `${fmtDateTime(data.lastSync.finished_at || data.lastSync.started_at)} (${data.lastSync.ok === false ? 'amb errors' : 'OK'}, origen ${data.lastSync.origen || '—'})`
        : 'cap registrada aquesta setmana'
    }`
  );
  lines.push('');

  lines.push(`## 2. Resultats`);
  lines.push('');
  if (!hasAnyActivity(data.weekTotals)) {
    lines.push(`Sense noves oportunitats aquesta setmana.`);
    lines.push('');
  }

  lines.push(`| Àrea | Període | Detectades | Traslladades | Valorades | Descartades | Activades |`);
  lines.push(`| --- | --- | ---: | ---: | ---: | ---: | ---: |`);
  for (const area of AREAS_REPORT) {
    const w = data.weekByArea[area];
    const a = data.acumByArea[area];
    lines.push(
      `| ${areaLabel(area)} | Setmana | ${w.detectades} | ${w.traslladades} | ${w.valorades} | ${w.descartades} | ${w.activades} |`
    );
    lines.push(
      `| ${areaLabel(area)} | Acumulat | ${a.detectades} | ${a.traslladades} | ${a.valorades} | ${a.descartades} | ${a.activades} |`
    );
  }
  lines.push('');
  lines.push(`**Resum setmana:** ${countersLine(data.weekTotals)}`);
  lines.push(`**Resum acumulat:** ${countersLine(data.acumTotals)}`);
  lines.push('');

  lines.push(`## 3. Filtratge (eficàcia del filtre)`);
  lines.push('');
  lines.push(`Registres llegits (suma dels syncs de la setmana):`);
  lines.push(`- TED: ${data.llegits.ted}`);
  lines.push(`- PSCP: ${data.llegits.pscp}`);
  lines.push(`- PLACSP: ${data.llegits.placsp}`);
  lines.push(`- PLACSP menors: ${data.llegits.placsp_menors}`);
  lines.push('');
  lines.push(`Exclosos pel filtre automàtic (no desats):`);
  lines.push(`- CPV: ${data.exclosos.cpv}`);
  lines.push(`- Keyword: ${data.exclosos.keyword}`);
  lines.push(`- Import: ${data.exclosos.import}`);
  lines.push('');

  lines.push(`## 4. Incidències`);
  lines.push('');
  if (!data.incidencies.length && !data.diesSenseSync.length) {
    lines.push(`Cap incidència registrada aquesta setmana.`);
  } else {
    if (data.diesSenseSync.length) {
      lines.push(`- Dies sense sincronització: ${data.diesSenseSync.map(fmtDate).join(', ')}`);
    }
    for (const inc of data.incidencies) {
      lines.push(`- ${fmtDateTime(inc.when)}: ${inc.text}`);
    }
  }
  lines.push('');

  lines.push(`## 5. Reservades vigents (DA 4ª LCSP)`);
  lines.push('');
  if (!data.reservadesVigents.length) {
    lines.push(`Cap contracte reservat vigent ara mateix.`);
  } else {
    for (const r of data.reservadesVigents) {
      lines.push(
        `- **${r.title}** (${areaLabel(r.area || 'Altres')}) — termini ${fmtDate(r.termini_oferta)} — circuit ${r.estat_circuit || '—'}${r.organismo ? ` — ${r.organismo}` : ''}`
      );
    }
  }
  lines.push('');

  lines.push(`## 6. Properes accions`);
  lines.push('');
  const accions = String(properesAccions || '').trim();
  lines.push(accions || '_(Sense properes accions indicades)_');
  lines.push('');

  return lines.join('\n');
}

export function downloadMarkdownFile(content, filename) {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function copyTextToClipboard(text) {
  if (typeof window !== 'undefined' && window.electronAPI?.writeClipboardText) {
    await window.electronAPI.writeClipboardText(text);
    return;
  }
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  throw new Error('No s\'ha pogut copiar al porta-retalls');
}
