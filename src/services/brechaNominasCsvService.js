/**
 * Importació CSV de bruts anuals (export Holded / Innuva / Excel RRHH).
 * Columnes flexibles: DNI/NIF, nombre, bruto anual, bruto mensual×12, etc.
 */

function parseEuro(value) {
  if (value == null) return 0;
  const s = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/[€$]/g, '')
    .trim();
  if (!s || s === '-' || /^n\/?a$/i.test(s)) return 0;
  const normalized = s.includes(',')
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(/,/g, '');
  const n = Number.parseFloat(normalized.replace(/[^\d.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
}

function detectDelimiter(line) {
  if ((line.match(/;/g) || []).length >= (line.match(/,/g) || []).length) return ';';
  return ',';
}

function parseCsvLine(line, delim) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === delim && !inQ) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function normHeader(h) {
  return String(h || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();
}

function findColIndex(headers, patterns) {
  for (let i = 0; i < headers.length; i++) {
    const h = normHeader(headers[i]);
    if (patterns.some((p) => h.includes(p))) return i;
  }
  return -1;
}

/**
 * @returns {Map<string, { salarioAnual: number, dni?: string, nombre?: string }>} clau = dni normalitzat o nom
 */
export function parseNominasCsvText(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n').filter((l) => l.trim());
  if (!lines.length) return new Map();

  const delim = detectDelimiter(lines[0]);
  const headerLineIdx = lines.findIndex((l) => {
    const low = l.toLowerCase();
    return low.includes('dni') || low.includes('nif') || low.includes('brut') || low.includes('nombre');
  });
  const start = headerLineIdx >= 0 ? headerLineIdx : 0;
  const headers = parseCsvLine(lines[start], delim);

  const iDni = findColIndex(headers, ['dni', 'nif', 'nie', 'document']);
  const iNom = findColIndex(headers, ['nombre', 'empleado', 'trabajador', 'name']);
  const iAnual = findColIndex(headers, ['bruto anual', 'anual', 'year', 'total anual', 'salario anual']);
  const iMensual = findColIndex(headers, ['bruto mensual', 'mensual', 'mes', 'month', 'salario mensual']);
  const iBruto = findColIndex(headers, ['bruto', 'gross', 'devengo', 'total']);

  const map = new Map();
  for (let li = start + 1; li < lines.length; li++) {
    const cols = parseCsvLine(lines[li], delim);
    if (!cols.some((c) => c)) continue;

    const dni = iDni >= 0 ? String(cols[iDni] || '').replace(/\s/g, '').toUpperCase() : '';
    const nombre = iNom >= 0 ? String(cols[iNom] || '').trim().toUpperCase() : '';
    let salarioAnual = iAnual >= 0 ? parseEuro(cols[iAnual]) : 0;
    if (!salarioAnual && iMensual >= 0) salarioAnual = parseEuro(cols[iMensual]) * 12;
    if (!salarioAnual && iBruto >= 0) {
      const b = parseEuro(cols[iBruto]);
      salarioAnual = b > 0 && b < 20000 ? b * 12 : b;
    }
    if (salarioAnual <= 0) continue;

    const entry = { salarioAnual, dni, nombre };
    if (dni) map.set(`dni:${dni}`, entry);
    if (nombre) map.set(`nom:${nombre}`, entry);
  }
  return map;
}

/** Fusiona imports CSV sobre files brecha (per DNI o nom). */
export function mergeNominasCsvIntoRows(rows, csvMap) {
  if (!csvMap?.size || !rows?.length) return { rows, merged: 0 };

  let merged = 0;
  const updated = rows.map((row) => {
    const dniKey = row.dni ? `dni:${String(row.dni).replace(/\s/g, '').toUpperCase()}` : '';
    const nomKey = row.nombreCompleto
      ? `nom:${String(row.nombreCompleto).trim().toUpperCase()}`
      : '';
    const hit = (dniKey && csvMap.get(dniKey)) || (nomKey && csvMap.get(nomKey));
    if (!hit?.salarioAnual) return row;
    merged += 1;
    const salarioAnual = hit.salarioAnual;
    const salarioBrutoMensual = Math.round((salarioAnual / 12) * 100) / 100;
    const devengoHora =
      row.horasTrabajadas > 0
        ? Math.round((salarioAnual / row.horasTrabajadas) * 100) / 100
        : 0;
    return {
      ...row,
      salarioAnual,
      origenDato: 'CSV nóminas',
      salarioBrutoMensual,
      devengoHora
    };
  });

  return {
    rows: updated.map((r, i) => ({ ...r, numero: i + 1 })),
    merged
  };
}
