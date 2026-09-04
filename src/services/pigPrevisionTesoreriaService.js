/**
 * Previsión de tesorería 18 meses (jun 2026 → dic 2027).
 * Fuentes: PIG Excel 2026 + PIG Excel 2025 (+ Holded cobrada 2025).
 */
import * as XLSX from 'xlsx';
import holdedApi from './holdedApi';
import holdedApiV2Service from './holdedApiV2Service';

const MONTH_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre'
];

const MONTH_HEADER_RES = [
  { month: 1, re: /\bgener\b|\bene\b/i },
  { month: 2, re: /\bfebr|\bfeb\b/i },
  { month: 3, re: /\bmar[cç]\b|\bmarzo\b|\bmar\b/i },
  { month: 4, re: /\babril\b|\babr\b/i },
  { month: 5, re: /\bmaig\b|\bmayo\b/i },
  { month: 6, re: /\bjuny\b|\bjunio\b/i },
  { month: 7, re: /\bjuliol\b|\bjulio\b/i },
  { month: 8, re: /\bagost\b/i },
  { month: 9, re: /\bsetembre\b|\bsept/i },
  { month: 10, re: /\boctubre\b|\boct\b/i },
  { month: 11, re: /\bnovembre\b|\bnov\b/i },
  { month: 12, re: /\bdesembre\b|\bdic/i }
];

const CR_LABELS = {
  subv: /^Estimado Subvenciones Imputadas Al Excedente Del Ejercicio/i,
  ventas: /^2\. Venta y otros ingresos de la actividad mercantil$/i,
  mp: /^6\. Aprovisionamientos$/i,
  salario: /^8\. Gastos de personal$/i,
  otros: /^9\. Otros gastos de la actividad$/i,
  financieros: /^15\. Gastos financieros$/i
};

function parseAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const n = Number.parseFloat(String(value).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function absExpense(value) {
  const n = parseAmount(value);
  return n < 0 ? Math.abs(n) : n;
}

function normalizeLabel(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ');
}

function findSheet(workbook, candidates) {
  for (const name of candidates) {
    if (workbook.Sheets[name]) return workbook.Sheets[name];
  }
  const key = candidates[0]?.toLowerCase();
  if (!key) return null;
  const found = workbook.SheetNames.find((n) => String(n).toLowerCase().includes(key));
  return found ? workbook.Sheets[found] : null;
}

function sheetToAoa(sheet) {
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
}

/** @param {ArrayBuffer|Uint8Array} buffer */
export function readPigWorkbookFromBuffer(buffer) {
  return XLSX.read(buffer, { type: 'array', cellDates: true });
}

export async function readPigWorkbookFromFile(file) {
  const buffer = await file.arrayBuffer();
  return readPigWorkbookFromBuffer(buffer);
}

function parseMonthFromHeader(text) {
  const s = String(text || '').trim();
  if (!s) return null;
  for (const { month, re } of MONTH_HEADER_RES) {
    if (re.test(s)) {
      const yearMatch = s.match(/(\d{2,4})/);
      let year = null;
      if (yearMatch) {
        const y = Number(yearMatch[1]);
        year = y < 100 ? 2000 + y : y;
      }
      return { month, year };
    }
  }
  return null;
}

/**
 * Tabla mensual del CR GENERAL: mapa mes (1-12) → valores por concepto.
 */
export function parseCrGeneralMonthly(aoa = []) {
  let headerRow = -1;
  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    if (row.slice(1, 8).some((c) => parseMonthFromHeader(c))) {
      headerRow = r;
      break;
    }
  }
  if (headerRow < 0) {
    return { byMonth: new Map(), columns: new Map(), error: 'No se encontró la tabla mensual en CR GENERAL EISSS' };
  }

  const columns = new Map();
  const header = aoa[headerRow] || [];
  for (let c = 1; c < header.length; c++) {
    const parsed = parseMonthFromHeader(header[c]);
    if (parsed?.month) columns.set(parsed.month, c);
  }

  const rowByKey = {};
  for (let r = headerRow + 1; r < aoa.length; r++) {
    const label = normalizeLabel(aoa[r]?.[0]);
    if (!label) continue;
    for (const [key, re] of Object.entries(CR_LABELS)) {
      if (re.test(label) && rowByKey[key] == null) rowByKey[key] = r;
    }
  }

  const byMonth = new Map();
  for (const [month, col] of columns.entries()) {
    const subv = parseAmount(aoa[rowByKey.subv]?.[col]);
    const ventas = parseAmount(aoa[rowByKey.ventas]?.[col]);
    const entradas = subv + ventas;
    const materiaPrima = absExpense(aoa[rowByKey.mp]?.[col]);
    const salario = absExpense(aoa[rowByKey.salario]?.[col]);
    const otros =
      absExpense(aoa[rowByKey.otros]?.[col]) + absExpense(aoa[rowByKey.financieros]?.[col]);
    byMonth.set(month, {
      entradas,
      subv,
      ventas,
      salario,
      otrosGastos: otros,
      materiaPrima,
      salidasTotal: salario + otros + materiaPrima
    });
  }

  return { byMonth, columns, error: null };
}

/** Cierre de tesorería (TOTAL TESORERÍA − INVES − BCREDIT) en la hoja TESORERÍA del PIG. */
export function parseTesoreriaCajaFinal(aoa = []) {
  for (const row of aoa) {
    const label = String(row?.[0] || '').toUpperCase();
    // Preferir etiqueta nueva; también matchea la antigua "… - INVES" (substring).
    if (
      label.includes('TOTAL TESORERÍA - INVES') ||
      label.includes('TOTAL TESORERIA - INVES')
    ) {
      return parseAmount(row[2]);
    }
  }
  for (const row of aoa) {
    const label = String(row?.[0] || '').toUpperCase();
    if (label === 'TOTAL TESORERÍA' || label === 'TOTAL TESORERIA') {
      return parseAmount(row[2]);
    }
  }
  return 0;
}

/** @deprecated Usar parseTesoreriaCajaFinal — el PIG refleja el cierre, no la caja inicial. */
export function parseTesoreriaCajaInicial(aoa = []) {
  return parseTesoreriaCajaFinal(aoa);
}

/** Caja inicial = cierre del mes − entradas + salidas (p. ej. cierre mayo si anclamos cierre junio). */
export function deriveCajaInicialDesdeCierre({ cajaFinal, entradas = 0, salidas = 0 } = {}) {
  return (Number(cajaFinal) || 0) - (Number(entradas) || 0) + (Number(salidas) || 0);
}

const MONTH_TITLE_RES = [
  { month: 1, re: /\benero\b/i },
  { month: 2, re: /\bfebrero\b/i },
  { month: 3, re: /\bmarzo\b/i },
  { month: 4, re: /\babril\b/i },
  { month: 5, re: /\bmayo\b/i },
  { month: 6, re: /\bjunio\b/i },
  { month: 7, re: /\bjulio\b/i },
  { month: 8, re: /\bagosto\b/i },
  { month: 9, re: /\bseptiembre\b/i },
  { month: 10, re: /\boctubre\b/i },
  { month: 11, re: /\bnoviembre\b/i },
  { month: 12, re: /\bdiciembre\b/i }
];

function parseMonthYearFromPresupuestoTitle(text) {
  const s = String(text || '');
  let month = null;
  for (const { month: m, re } of MONTH_TITLE_RES) {
    if (re.test(s)) {
      month = m;
      break;
    }
  }
  const yearMatch = s.match(/\b(20\d{2})\b/);
  const year = yearMatch ? Number(yearMatch[1]) : null;
  return month && year ? { month, year } : null;
}

/** Pendiente por facturar por mes de vencimiento (año objetivo). */
export function parsePresupuestosPendientesByMonth(aoa = [], targetYear = 2026) {
  const map = new Map();
  let current = null;

  for (let r = 0; r < aoa.length; r++) {
    const row = aoa[r] || [];
    const label = String(row[0] || '').trim();

    const titleMatch = parseMonthYearFromPresupuestoTitle(label);
    if (titleMatch && !/^total/i.test(label)) {
      current = titleMatch.year === targetYear ? titleMatch.month : null;
    }

    if (/^TOTAL MES \(solo por facturar desde corte\)/i.test(label)) {
      if (current != null) map.set(current, parseAmount(row[8]));
      continue;
    }
    if (/^TOTAL POR FACTURAR \(desde corte\)/i.test(label)) {
      if (current != null && !map.has(current)) map.set(current, parseAmount(row[8]));
      continue;
    }
    if (/^TOTAL MES$/i.test(label) && current != null) {
      map.set(current, parseAmount(row[8]));
    }
  }

  return map;
}

function parseComparativaBase2025(aoa = []) {
  const totals = new Array(12).fill(0);
  const blocks = [
    { name: 'CATERING', baseCol: 5 },
    { name: 'IDONI', baseCol: 2 },
    { name: 'KOIKI', baseCol: 2 }
  ];

  for (const block of blocks) {
    const start = aoa.findIndex((row) => row?.[0] === block.name);
    if (start < 0) continue;
    for (let r = start + 3; r < aoa.length; r++) {
      const mes = String(aoa[r]?.[0] || '').trim();
      if (!mes || mes === block.name) continue;
      if (/^TOTAL/i.test(mes)) break;
      const mi = MONTH_NAMES.findIndex((m) => m.toLowerCase() === mes.toLowerCase());
      if (mi >= 0) totals[mi] += Math.max(0, parseAmount(aoa[r][block.baseCol]));
    }
  }
  return totals;
}

function parsePaymentDate(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date && !Number.isNaN(raw.getTime())) return raw;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const d = new Date(raw > 1e12 ? raw : raw * 1000);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const s = String(raw).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
    const d = new Date(`${s.slice(0, 10)}T12:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s.length <= 10 ? `${s.slice(0, 10)}T12:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function isSalePaid(doc) {
  const total = parseAmount(doc?.total);
  const pending = parseAmount(
    doc?.paymentsPending ?? doc?.pending ?? doc?.payments_pending ?? doc?.amountDue
  );
  if (total > 0 && pending <= 0.005) return true;
  if (doc?.paid === true || doc?.paid === 1 || doc?.paid === '1') return true;
  if (doc?.status === 1 || String(doc?.status || '').toLowerCase() === 'paid') return true;
  return false;
}

/** Eventos de cobro (fecha + importe) desde un documento de venta Holded. */
function collectPaymentEventsFromSaleDoc(doc) {
  const events = [];
  const total = parseAmount(doc?.total);
  const pending = parseAmount(
    doc?.paymentsPending ?? doc?.pending ?? doc?.payments_pending ?? doc?.amountDue
  );
  const collected = Math.max(0, total - pending);

  const paymentArrays = [doc?.payments, doc?.paymentList, doc?.paymentsList].filter(Array.isArray);
  for (const arr of paymentArrays) {
    for (const p of arr) {
      const d = parsePaymentDate(p?.date ?? p?.paymentDate ?? p?.payment_date);
      const amt = parseAmount(p?.amount ?? p?.total ?? p?.value);
      if (d && amt > 0.005) events.push({ date: d, amount: amt });
    }
  }
  if (events.length) return events;

  const paymentDate = parsePaymentDate(
    doc?.paymentDate ?? doc?.payment_date ?? doc?.paidDate ?? doc?.paid_at ?? doc?.lastPaymentDate
  );

  if (isSalePaid(doc) || collected > 0.005) {
    const amount = collected > 0.005 ? collected : total;
    if (amount <= 0.005) return events;
    if (paymentDate) {
      events.push({ date: paymentDate, amount });
      return events;
    }
    const issue = parsePaymentDate(doc?.date ?? doc?.issue_date);
    if (issue && isSalePaid(doc)) events.push({ date: issue, amount });
  }

  return events;
}

function collectPaymentEventsFromV2Invoice(inv) {
  const events = [];
  const total = parseAmount(inv?.total);
  const pending = parseAmount(inv?.pending ?? inv?.amount_due ?? inv?.payments_pending);
  const collected = Math.max(0, total - pending);

  const paymentDate = parsePaymentDate(
    inv?.payment_date ?? inv?.paymentDate ?? inv?.paid_at ?? inv?.paidDate
  );
  const status = String(inv?.status || '').toLowerCase();
  const paid = status === 'paid' || status === 'completed' || inv?.paid === true;

  if (paid || collected > 0.005) {
    const amount = collected > 0.005 ? collected : total;
    if (paymentDate && amount > 0.005) events.push({ date: paymentDate, amount });
    else if (paid && amount > 0.005) {
      const issue = parsePaymentDate(inv?.date);
      if (issue) events.push({ date: issue, amount });
    }
  }
  return events;
}

function aggregatePaymentEventsByMonth(events, targetYear) {
  const months = new Array(12).fill(0);
  let count = 0;
  for (const ev of events) {
    if (!ev?.date || ev.date.getFullYear() !== targetYear) continue;
    months[ev.date.getMonth()] += ev.amount;
    count += 1;
  }
  return { months, count };
}

/** Facturas de venta Holded v1 (documents/invoice) en un rango de años de emisión. */
async function fetchHoldedV1SalesDocuments(company, fromYear, toYear) {
  const all = [];
  let page = 1;
  const limit = 100;
  const starttmp = Math.floor(new Date(`${fromYear}-01-01T00:00:00+01:00`).getTime() / 1000);
  const endtmp = Math.floor(new Date(`${toYear}-12-31T23:59:59+01:00`).getTime() / 1000);

  while (page <= 300) {
    const batch = await holdedApi.getSales({ page, limit, starttmp, endtmp, sort: 'created-desc' }, company);
    if (!batch?.length) break;
    all.push(...batch);
    if (batch.length < limit) break;
    page += 1;
  }
  return all;
}

/** Pagos registrados en Holded (v1 /payments), filtrados por fecha de cobro en un año. */
async function fetchHoldedPaymentsCobradaByYear(company, targetYear) {
  const months = new Array(12).fill(0);
  let count = 0;
  let page = 1;
  const starttmp = Math.floor(new Date(`${targetYear}-01-01T00:00:00+01:00`).getTime() / 1000);
  const endtmp = Math.floor(new Date(`${targetYear}-12-31T23:59:59+01:00`).getTime() / 1000);

  while (page <= 150) {
    const batch = await holdedApi.getPayments({ page, limit: 100, starttmp, endtmp }, company);
    if (!batch?.length) break;

    for (const p of batch) {
      const d = parsePaymentDate(p?.date ?? p?.paymentDate ?? p?.payment_date ?? p?.created);
      if (!d || d.getFullYear() !== targetYear) continue;

      const desc = String(p?.desc ?? p?.description ?? '').toLowerCase();
      if (
        desc &&
        (desc.includes('purchase') ||
          desc.includes('compra') ||
          desc.includes('expense') ||
          desc.includes('gasto') ||
          desc.includes('proveedor'))
      ) {
        continue;
      }

      const amt = parseAmount(p?.amount ?? p?.total ?? p?.value ?? p?.payment);
      if (amt <= 0.005) continue;
      months[d.getMonth()] += amt;
      count += 1;
    }

    if (batch.length < 100) break;
    page += 1;
  }

  return { months, count };
}

/**
 * Facturación cobrada por mes (fecha de cobro). Solucions.
 * Prioridad: pagos Holded v1 → facturas venta v1 → v2 → COMPARATIVA PIG (solo si year=2025).
 */
export async function loadFacturacionCobradaByYear({
  year = 2025,
  company = 'solucions',
  comparativaAoa = null
} = {}) {
  const targetYear = Number(year) || 2025;
  let invoiceCount = 0;
  let paymentEventCount = 0;

  try {
    const pay = await fetchHoldedPaymentsCobradaByYear(company, targetYear);
    if (pay.count > 0) {
      return {
        months: pay.months,
        source: 'holded_payments',
        invoiceCount: 0,
        paymentEventCount: pay.count,
        error: null
      };
    }
  } catch (error) {
    console.warn(`[Previsión tesorería] Holded pagos v1 (${targetYear}):`, error);
  }

  try {
    const docs = await fetchHoldedV1SalesDocuments(company, targetYear - 2, targetYear + 1);
    const events = [];
    for (const doc of docs) events.push(...collectPaymentEventsFromSaleDoc(doc));
    const agg = aggregatePaymentEventsByMonth(events, targetYear);
    invoiceCount = docs.length;
    paymentEventCount = agg.count;
    if (agg.count > 0) {
      return {
        months: agg.months,
        source: 'holded_v1',
        invoiceCount,
        paymentEventCount,
        error: null
      };
    }
  } catch (error) {
    console.warn(`[Previsión tesorería] Holded v1 ventas (${targetYear}):`, error);
  }

  if (targetYear === 2025) {
    try {
      const v2 = await holdedApiV2Service.getInvoices(company);
      const events = [];
      for (const inv of v2 || []) events.push(...collectPaymentEventsFromV2Invoice(inv));
      const agg = aggregatePaymentEventsByMonth(events, targetYear);
      if (agg.count > 0) {
        return {
          months: agg.months,
          source: 'holded_v2',
          invoiceCount: (v2 || []).length,
          paymentEventCount: agg.count,
          error: null
        };
      }
    } catch (error) {
      console.warn('[Previsión tesorería] Holded v2 facturas:', error);
    }

    if (comparativaAoa) {
      const proxy = parseComparativaBase2025(comparativaAoa);
      if (proxy.some((v) => v > 0)) {
        return {
          months: proxy,
          source: 'comparativa',
          invoiceCount,
          paymentEventCount,
          warning:
            'No se detectaron cobros 2025 en Holded (pagos/facturas). Se usa BASE 2025 COMPARATIVA del PIG 2025 (facturación, no cobro).'
        };
      }
    }
  }

  return {
    months: new Array(12).fill(0),
    source: 'none',
    invoiceCount,
    paymentEventCount,
    warning: `No se pudieron obtener cobros ${targetYear} desde Holded.`
  };
}

/**
 * Facturación cobrada 2025 por mes (fecha de cobro). Solucions.
 * @deprecated Usar loadFacturacionCobradaByYear
 */
export async function loadFacturacionCobrada2025({ company = 'solucions', comparativaAoa = null } = {}) {
  return loadFacturacionCobradaByYear({ year: 2025, company, comparativaAoa });
}

function monthYearLabel(month, year) {
  return `${MONTH_NAMES[month - 1].toUpperCase()} ${year}`;
}

function buildMonthSequence() {
  const seq = [];
  for (let year = 2026; year <= 2027; year++) {
    const startM = year === 2026 ? 6 : 1;
    for (let m = startM; m <= 12; m++) seq.push({ month: m, year });
  }
  return seq;
}

const HARDCODED_2026_BY_MONTH = new Map(
  [
    [6, { cajaInicial: 30607.36, entradas: 121131.05, salario: 33576.68, otrosGastos: 19467.41, materiaPrima: 39660.69, salidasTotal: 92704.78, cajaFinal: 59033.63 }],
    [7, { cajaInicial: 59033.63, entradas: 66942.0, salario: 21458.25, otrosGastos: 20525.0, materiaPrima: 14796.54, salidasTotal: 56779.79, cajaFinal: 69195.84 }],
    [8, { cajaInicial: 69195.84, entradas: 6883.0, salario: 15506.76, otrosGastos: 17536.18, materiaPrima: 11997.01, salidasTotal: 45039.95, cajaFinal: 31038.89 }],
    [9, { cajaInicial: 31038.89, entradas: 31402.11, salario: 21021.22, otrosGastos: 15187.72, materiaPrima: 19799.6, salidasTotal: 56008.54, cajaFinal: 6432.46 }],
    [10, { cajaInicial: 6432.46, entradas: 66790.41, salario: 29071.53, otrosGastos: 17166.28, materiaPrima: 39805.46, salidasTotal: 86043.27, cajaFinal: -12820.4 }],
    [11, { cajaInicial: -12820.4, entradas: 126829.47, salario: 26813.08, otrosGastos: 17389.92, materiaPrima: 27760.54, salidasTotal: 71963.54, cajaFinal: 42045.53 }],
    [12, { cajaInicial: 42045.53, entradas: 93569.63, salario: 37656.21, otrosGastos: 20788.15, materiaPrima: 39725.06, salidasTotal: 98169.42, cajaFinal: 37445.74 }]
  ]
);

function fmtEuro(n) {
  return `${(Number(n) || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function getHardcodedOrCr2026Month(month, cr26) {
  const fixed = HARDCODED_2026_BY_MONTH.get(month);
  if (fixed) {
    return {
      entradas: fixed.entradas,
      salario: fixed.salario,
      otrosGastos: fixed.otrosGastos,
      materiaPrima: fixed.materiaPrima
    };
  }
  return cr26.byMonth.get(month) || {};
}

function averageMonthlyRef(ref25 = {}, ref26 = {}) {
  return {
    entradas: round2(((ref25.entradas ?? 0) + (ref26.entradas ?? 0)) / 2),
    salario: round2(((ref25.salario ?? 0) + (ref26.salario ?? 0)) / 2),
    otrosGastos: round2(((ref25.otrosGastos ?? 0) + (ref26.otrosGastos ?? 0)) / 2),
    materiaPrima: round2(((ref25.materiaPrima ?? 0) + (ref26.materiaPrima ?? 0)) / 2)
  };
}

function describe2027EntradasSource(month, cobradaSource = '') {
  if (month === 5 || month === 6) {
    return `Media cobrada ${MONTH_NAMES[month - 1]} 2025 y ${MONTH_NAMES[month - 1]} 2026 (Holded)`;
  }
  if (month === 8) {
    return 'Entradas fijadas a 0';
  }
  const src = cobradaSource ? ` · ${cobradaSource}` : '';
  return `Cobrada ${MONTH_NAMES[month - 1]} 2025 (Holded${src})`;
}

function describe2027SalidasSource(month) {
  if (month === 5 || month === 6) {
    return `Media gastos CR ${MONTH_NAMES[month - 1]} 2025 y ${MONTH_NAMES[month - 1]} 2026`;
  }
  return `Gastos CR ${MONTH_NAMES[month - 1]} 2025 (PIG 2025)`;
}

function resolve2027Entradas(month, cobrada2025 = [], cobrada2026 = []) {
  const cobrada25 = cobrada2025[month - 1] ?? 0;
  const cobrada26 = cobrada2026[month - 1] ?? 0;

  if (month === 8) return 0;
  if (month === 5 || month === 6) return round2((cobrada25 + cobrada26) / 2);
  return cobrada25;
}

function resolvePrevisionObservaciones(year, month) {
  if (year === 2026 && month >= 6 && month <= 12) {
    return 'Entrada incluye subvención 6.883 €';
  }
  if (year === 2027) {
    if (month === 8) return 'Entradas = 0';
    if (month === 5 || month === 6) {
      return 'Entrada: media cobrado 2025 y 2026 (sin subv.)';
    }
    return 'Entrada: cobrado 2025 (sin subv.)';
  }
  return '';
}

/**
 * @param {{ pig2026: object, pig2025: object, cobrada2025?: number[], cobradaSource?: string, cobradaMeta?: object }} params
 */
export function buildPrevisionTesoreria18Meses({
  pig2026,
  pig2025,
  cobrada2025 = [],
  cobrada2026 = [],
  cobradaSource = '',
  cobradaMeta = {}
} = {}) {
  const cr26 = parseCrGeneralMonthly(pig2026?.crGeneral || []);
  const cr25 = parseCrGeneralMonthly(pig2025?.crGeneral || []);
  const cajaFinalJun = parseTesoreriaCajaFinal(pig2026?.tesoreria || []);
  const junCr = cr26.byMonth.get(6);
  const cajaInicialJun = deriveCajaInicialDesdeCierre({
    cajaFinal: cajaFinalJun,
    entradas: junCr?.entradas ?? 0,
    salidas: junCr?.salidasTotal ?? 0
  });
  const presupuestos2026 = parsePresupuestosPendientesByMonth(pig2026?.presupuestos || [], 2026);

  const warnings = [];
  if (cr26.error) warnings.push(cr26.error);
  if (cr25.error) warnings.push(`PIG 2025: ${cr25.error}`);
  if (cobradaMeta?.warning) warnings.push(cobradaMeta.warning);

  const rows = [];
  let cajaAnterior = HARDCODED_2026_BY_MONTH.get(12)?.cajaFinal ?? cajaInicialJun;

  for (const { month, year } of buildMonthSequence()) {
    let cajaInicial = cajaAnterior;
    let entradas = 0;
    let salario = 0;
    let otrosGastos = 0;
    let materiaPrima = 0;
    const detail = [];

    if (year === 2026 && HARDCODED_2026_BY_MONTH.has(month)) {
      const fixed = HARDCODED_2026_BY_MONTH.get(month);
      cajaInicial = fixed.cajaInicial;
      entradas = fixed.entradas;
      salario = fixed.salario;
      otrosGastos = fixed.otrosGastos;
      materiaPrima = fixed.materiaPrima;

      detail.push(
        ['CAJA INICIAL', cajaInicial, 'Valor fijo validado por Sergi'],
        ['ENTRADAS', entradas, 'Valor fijo validado por Sergi'],
        ['TOTAL MES', cajaInicial + entradas, 'Fórmula: CAJA INICIAL + ENTRADAS'],
        ['SALIDAS — Salario', salario, 'Valor fijo validado por Sergi'],
        ['SALIDAS — Otros gastos', otrosGastos, 'Valor fijo validado por Sergi'],
        ['SALIDAS — Materia prima', materiaPrima, 'Valor fijo validado por Sergi'],
        ['SALIDAS TOTAL', fixed.salidasTotal, 'Fórmula/valor de referencia validado por Sergi'],
        ['CAJA FINAL', fixed.cajaFinal, 'Valor fijo validado por Sergi']
      );
    } else if (year === 2027) {
      const ref25 = cr25.byMonth.get(month) || {};
      let salRef = ref25;

      if (month === 5 || month === 6) {
        salRef = averageMonthlyRef(ref25, getHardcodedOrCr2026Month(month, cr26));
      }

      entradas = resolve2027Entradas(month, cobrada2025, cobrada2026);
      salario = salRef.salario ?? 0;
      otrosGastos = salRef.otrosGastos ?? 0;
      materiaPrima = salRef.materiaPrima ?? 0;

      const entradasLabel = describe2027EntradasSource(month, cobradaSource);
      const salidasLabel = describe2027SalidasSource(month);

      detail.push(
        ['CAJA INICIAL', cajaInicial, 'Caja final del mes anterior'],
        ['ENTRADAS', entradas, entradasLabel],
        ['SALIDAS — Salario', salario, salidasLabel],
        ['SALIDAS — Otros gastos', otrosGastos, salidasLabel],
        ['SALIDAS — Materia prima', materiaPrima, salidasLabel]
      );
    }

    const salidasTotal =
      year === 2026 && HARDCODED_2026_BY_MONTH.has(month)
        ? HARDCODED_2026_BY_MONTH.get(month).salidasTotal
        : salario + otrosGastos + materiaPrima;
    const cajaFinalCalculada = cajaInicial + entradas - salidasTotal;
    const cajaFinal =
      year === 2026 && HARDCODED_2026_BY_MONTH.has(month)
        ? HARDCODED_2026_BY_MONTH.get(month).cajaFinal
        : cajaFinalCalculada;

    detail.push([
      'CAJA FINAL',
      cajaFinal,
      year === 2026 && month === 6
        ? 'Anclada al cierre TESORERÍA junio PIG (TOTAL − INVES − BCREDIT)'
        : 'Caja inicial + Entradas − Salidas total'
    ]);

    rows.push({
      month,
      year,
      label: monthYearLabel(month, year),
      cajaInicial,
      entradas,
      salario,
      otrosGastos,
      materiaPrima,
      salidasTotal,
      cajaFinal,
      observaciones: resolvePrevisionObservaciones(year, month),
      detail
    });

    cajaAnterior = cajaFinal;
  }

  return {
    rows,
    meta: {
      cajaInicialJun,
      cajaFinalJun,
      cobradaSource,
      cobradaMeta,
      presupuestos2026: Object.fromEntries(presupuestos2026),
      warnings
    }
  };
}

export function buildPrevisionTesoreriaExcelAoa({ rows = [], meta = {} } = {}) {
  const aoa = [];
  aoa.push(['PREVISIÓN DE TESORERÍA EI.SSS · jun 2026 – dic 2027']);
  aoa.push([
    `Caja final junio (TESORERÍA − INVES − BCREDIT, PIG): ${fmtEuro(meta.cajaFinalJun ?? 0)}`
  ]);
  aoa.push([
    `Caja inicial junio (cierre mayo, calculada): ${fmtEuro(meta.cajaInicialJun ?? 0)}`
  ]);
  aoa.push([]);
  aoa.push([
    'MES',
    'CAJA INICIAL',
    'ENTRADAS',
    'TOTAL MES',
    'SALIDAS — SALARIO',
    'SALIDAS — OTROS GASTOS',
    'SALIDAS — MATERIA PRIMA',
    'SALIDAS TOTAL',
    'CAJA FINAL',
    'OBSERVACIONES'
  ]);

  for (const row of rows) {
    const excelRow = aoa.length + 1;
    aoa.push([
      row.label,
      excelRow === 6 ? row.cajaInicial : { t: 'n', f: `I${excelRow - 1}`, v: row.cajaInicial },
      row.entradas,
      { t: 'n', f: `B${excelRow}+C${excelRow}`, v: row.cajaInicial + row.entradas },
      row.salario,
      row.otrosGastos,
      row.materiaPrima,
      { t: 'n', f: `E${excelRow}+F${excelRow}+G${excelRow}`, v: row.salidasTotal },
      { t: 'n', f: `D${excelRow}-H${excelRow}`, v: row.cajaFinal },
      row.observaciones || ''
    ]);
  }

  return aoa;
}

export function buildPrevisionTesoreriaDetalleAoa({ rows = [], meta = {} } = {}) {
  const aoa = [];
  aoa.push(['DETALLE DE FUENTES · PREVISIÓN TESORERÍA EI.SSS']);
  aoa.push([`Caja final junio (PIG TESORERÍA): ${fmtEuro(meta.cajaFinalJun ?? 0)}`]);
  aoa.push([`Caja inicial junio (calculada): ${fmtEuro(meta.cajaInicialJun ?? 0)}`]);
  if (meta.cobradaSource) {
    aoa.push([
      `Cobrada 2025 (jul–dic): ${meta.cobradaSource}${
        meta.cobradaMeta?.paymentEventCount != null
          ? ` · ${meta.cobradaMeta.paymentEventCount} cobros detectados`
          : ''
      }`
    ]);
  }
  if (meta.warnings?.length) {
    aoa.push([meta.warnings.join(' ')]);
  }
  aoa.push([]);

  for (const row of rows) {
    aoa.push([row.label, '', '']);
    aoa.push(['Concepto', 'Importe', 'Fuente / cálculo']);
    for (const line of row.detail || []) {
      aoa.push(line);
    }
    aoa.push([]);
  }

  return aoa;
}

export function extractPigSheetsForPrevision(workbook) {
  const crSheet = findSheet(workbook, ['CR GENERAL EISSS']);
  const tesSheet = findSheet(workbook, ['TESORERÍA', 'TESORERIA']);
  const presSheet = findSheet(workbook, ['PRESUPUESTOS']);
  const compSheet = findSheet(workbook, ['COMPARATIVA ANUAL']);
  return {
    crGeneral: sheetToAoa(crSheet),
    tesoreria: sheetToAoa(tesSheet),
    presupuestos: sheetToAoa(presSheet),
    comparativa: sheetToAoa(compSheet)
  };
}

export async function buildPrevisionTesoreriaFromFiles({ file2026, file2025, company = 'solucions' } = {}) {
  const [wb2026, wb2025] = await Promise.all([
    readPigWorkbookFromFile(file2026),
    readPigWorkbookFromFile(file2025)
  ]);

  const pig2026 = extractPigSheetsForPrevision(wb2026);
  const pig2025 = extractPigSheetsForPrevision(wb2025);

  const [cobrada2025, cobrada2026] = await Promise.all([
    loadFacturacionCobradaByYear({
      year: 2025,
      company,
      comparativaAoa: pig2025.comparativa
    }),
    loadFacturacionCobradaByYear({ year: 2026, company })
  ]);

  const forecast = buildPrevisionTesoreria18Meses({
    pig2026,
    pig2025,
    cobrada2025: cobrada2025.months,
    cobrada2026: cobrada2026.months,
    cobradaSource: cobrada2025.source,
    cobradaMeta: cobrada2025
  });

  const aoa = buildPrevisionTesoreriaExcelAoa({
    rows: forecast.rows,
    meta: { ...forecast.meta, cobradaSource: cobrada2025.source }
  });

  return { ...forecast, aoa, cobrada: cobrada2025, cobrada2026 };
}
