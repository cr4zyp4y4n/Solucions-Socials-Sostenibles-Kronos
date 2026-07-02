import { parseEuroEs } from './fdHorasLookup';

const MONTHS_ES = {
  ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
  jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12
};

export function parseCsvText(text) {
  const raw = String(text || '').replace(/^\uFEFF/, '');
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.map(parseCsvLine);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normHeader(cell) {
  return String(cell || '').trim().toLowerCase();
}

function isFdBlockAt(headers, i) {
  return (
    normHeader(headers[i]) === 'parcialidad' &&
    normHeader(headers[i + 1]) === 'horario' &&
    normHeader(headers[i + 2]) === 'parcialidad' &&
    normHeader(headers[i + 3]) === 'horas' &&
    normHeader(headers[i + 4]) === 'bruto'
  );
}

function extractWorkerName(nameRow, typeRow, colStart) {
  let fallback = null;
  for (let c = colStart; c >= Math.max(0, colStart - 14); c--) {
    const raw = String(nameRow[c] || '').trim();
    if (!raw) continue;
    const coded = raw.match(/^\d+\s*-\s*(.+)$/);
    if (coded) return coded[1].trim();
    if (/^\d{2}-\d{10}/.test(raw.replace(/\s/g, ''))) continue;
    if (/^[\d\s\-\/\.]+$/.test(raw)) continue;
    if (/[a-záéíóúñ]/i.test(raw) && raw.length > 2) {
      fallback = raw;
    }
  }
  if (fallback) return fallback;
  const tipo = String(typeRow[colStart] || '').trim();
  if (/fijo\s*discontinuo/i.test(tipo)) {
    return `Trabajador col. ${colStart}`;
  }
  return `FD col. ${colStart}`;
}

function extractInnuvaCode(nameRow, colStart) {
  for (let c = colStart; c <= colStart + 8 && c < nameRow.length; c++) {
    const raw = String(nameRow[c] || '').trim();
    const m = raw.match(/^(\d{6,})$/);
    if (m) return m[1];
  }
  return '';
}

function inferYearMonth(fileName, rows) {
  const yearFromName = String(fileName || '').match(/\b(20\d{2})\b/);
  const year = yearFromName ? Number(yearFromName[1]) : new Date().getFullYear();

  const monthFromName = String(fileName || '').toLowerCase();
  const monthNames = Object.keys(MONTHS_ES);
  let month = null;
  for (const m of monthNames) {
    if (monthFromName.includes(m)) {
      month = MONTHS_ES[m];
      break;
    }
  }

  if (!month) {
    for (const row of rows.slice(4, 30)) {
      const d = parsePlantillaDate(row[0], year);
      if (d) {
        month = d.getMonth() + 1;
        break;
      }
    }
  }

  return { year, month: month || new Date().getMonth() + 1 };
}

export function parsePlantillaDate(raw, year) {
  const s = String(raw || '').trim().toLowerCase();
  const m = s.match(/^(\d{1,2})-([a-záéíóúñ]{3})/i);
  if (!m) return null;
  const day = Number(m[1]);
  const monKey = m[2].slice(0, 3);
  const month = MONTHS_ES[monKey];
  if (!month || !day) return null;
  return new Date(year, month - 1, day);
}

function dateKey(date) {
  if (!date) return '';
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function normalizeWorkerKey(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export { normalizeWorkerKey };

export function parsePlantillaFdRows(rows, fileName = '') {
  const headerRowIdx = rows.findIndex((r, idx) => idx >= 1 && r.some((_, i) => isFdBlockAt(r, i)));
  const headers = rows[headerRowIdx >= 0 ? headerRowIdx : 2] || rows[2] || [];
  const nameRow = rows[0] || [];
  const typeRow = rows[1] || [];

  const blocks = [];
  for (let i = 0; i < headers.length - 4; i++) {
    if (!isFdBlockAt(headers, i)) continue;
    const name = extractWorkerName(nameRow, typeRow, i);
    blocks.push({
      colStart: i,
      colHorario: i + 1,
      colBruto: i + 4,
      name,
      innuvaCode: extractInnuvaCode(nameRow, i)
    });
    i += 4;
  }
  const { year, month } = inferYearMonth(fileName, rows);
  const warnings = [];

  if (!blocks.length) {
    return {
      year,
      month,
      workers: [],
      dayDetails: [],
      warnings: ['No se detectaron bloques de fijos discontinuos (Parcialidad·Horario·Parcialidad·Horas·Bruto).'],
      blocksFound: 0
    };
  }

  const effectiveHeaderIdx = headerRowIdx >= 0 ? headerRowIdx : 2;
  const dayMap = new Map();
  let lastDate = null;

  for (let r = effectiveHeaderIdx + 1; r < rows.length; r++) {
    const row = rows[r] || [];
    const firstCell = String(row[0] || '').trim().toLowerCase();
    if (firstCell.startsWith('total') || firstCell === 'nóminas' || firstCell === 'nomina br.' || firstCell === 'dif bruto') break;

    const parsedDate = parsePlantillaDate(row[0], year);
    if (parsedDate) lastDate = parsedDate;
    if (!lastDate) continue;

    const lugar = String(row[2] || '').trim();
    const facturado = String(row[1] || '').trim().toLowerCase();
    if (facturado.includes('no es seerv')) continue;

    for (const block of blocks) {
      // Filas sin Horario son subtotales del bloque superior (no servicios reales).
      const horario = String(row[block.colHorario] || '').trim();
      if (!horario) continue;

      const bruto = parseEuroEs(row[block.colBruto]);
      if (bruto === null || bruto <= 0) continue;

      const dk = `${normalizeWorkerKey(block.name)}|${dateKey(lastDate)}`;
      const prev = dayMap.get(dk) || {
        workerName: block.name,
        workerKey: normalizeWorkerKey(block.name),
        innuvaCode: block.innuvaCode || '',
        date: lastDate,
        brutoTotal: 0,
        servicios: 0,
        lugares: []
      };
      prev.brutoTotal = Math.round((prev.brutoTotal + bruto) * 100) / 100;
      prev.servicios += 1;
      if (lugar) prev.lugares.push(lugar);
      dayMap.set(dk, prev);
    }
  }

  const dayDetails = Array.from(dayMap.values()).sort(
    (a, b) => a.workerKey.localeCompare(b.workerKey) || a.date - b.date
  );

  const byWorker = new Map();
  for (const day of dayDetails) {
    const w = byWorker.get(day.workerKey) || {
      workerName: day.workerName,
      workerKey: day.workerKey,
      innuvaCode: day.innuvaCode,
      days: []
    };
    if (!w.innuvaCode && day.innuvaCode) w.innuvaCode = day.innuvaCode;
    w.days.push(day);
    byWorker.set(day.workerKey, w);
  }

  const workers = Array.from(byWorker.values()).map((w) => ({
    ...w,
    totalBruto: Math.round(w.days.reduce((s, d) => s + d.brutoTotal, 0) * 100) / 100,
    numDias: w.days.length
  }));

  if (!dayDetails.length) {
    warnings.push('No se encontraron importes Bruto en bloques de fijos discontinuos.');
  }

  return { year, month, workers, dayDetails, warnings, blocksFound: blocks.length };
}
