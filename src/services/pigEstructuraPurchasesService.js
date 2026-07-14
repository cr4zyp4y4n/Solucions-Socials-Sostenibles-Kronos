import holdedApi from './holdedApi';

export const PIG_ESTRUCTURA_TAG = '#estructura';
const LOG_PREFIX = '[PIG Estructura]';
const DEFAULT_MONTHS = ['Gen', 'Feb', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Oct', 'Nov', 'Des'];

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function logWarn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

function parseAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim();
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeTagsText(tags) {
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => {
        if (typeof tag === 'string') return tag.trim();
        if (tag && typeof tag === 'object') {
          return String(tag.name || tag.label || tag.tag || tag.value || '').trim();
        }
        return '';
      })
      .filter(Boolean)
      .join(', ');
  }
  return String(tags ?? '').trim();
}

function extractEstructuraTagTokens(tags) {
  const text = normalizeTagsText(tags).toLowerCase();
  if (!text) return [];
  return text
    .split(/[,;|]+/)
    .flatMap((part) => part.split(/\s+/))
    .map((token) => token.trim().replace(/^#+/, ''))
    .filter(Boolean);
}

export function invoiceHasEstructuraTag(invoice) {
  return extractEstructuraTagTokens(invoice?.tags).includes('estructura');
}

async function enrichPurchasesWithDetails(invoices, company) {
  const chunkSize = 10;
  const enriched = [];
  for (let i = 0; i < invoices.length; i += chunkSize) {
    const chunk = invoices.slice(i, i + chunkSize);
    const batch = await Promise.all(
      chunk.map(async (invoice) => {
        if (!invoice?.holded_id) return invoice;
        try {
          return await holdedApi.getPurchaseDetails(invoice.holded_id, company);
        } catch {
          return invoice;
        }
      })
    );
    enriched.push(...batch);
  }
  return enriched;
}

function dedupePurchasesByHoldedId(invoices = []) {
  const seen = new Set();
  const out = [];
  for (const invoice of invoices) {
    const id = invoice?.holded_id || invoice?.invoice_number;
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(invoice);
  }
  return out;
}

async function resolveEstructuraPurchases(allPurchases, company) {
  const list = allPurchases || [];
  const emptyTags = list.filter((invoice) => !normalizeTagsText(invoice?.tags)).length;
  log(`Listado Holded: ${list.length} facturas, ${emptyTags} sin tags en resumen`);

  if (list.length) {
    log('Muestras tags (listado):', list.slice(0, 5).map((invoice) => ({
      num: invoice.invoice_number,
      tags: invoice.tags || '(vacío)'
    })));
  }

  let matched = list.filter(invoiceHasEstructuraTag);
  let enrichedCount = 0;

  const withoutTags = list.filter((invoice) => !normalizeTagsText(invoice?.tags));
  if (withoutTags.length) {
    log(`Leyendo detalle de ${withoutTags.length} facturas sin tags en listado...`);
    const enriched = await enrichPurchasesWithDetails(withoutTags, company);
    enrichedCount = enriched.length;
    matched = dedupePurchasesByHoldedId([
      ...matched,
      ...enriched.filter(invoiceHasEstructuraTag)
    ]);
  }

  if (!matched.length && list.length && !withoutTags.length) {
    log(`Sin coincidencias con tags visibles; leyendo detalle de ${list.length} facturas...`);
    const enriched = await enrichPurchasesWithDetails(list, company);
    enrichedCount = enriched.length;
    matched = enriched.filter(invoiceHasEstructuraTag);
  }

  if (matched.length) {
    log('Muestras tags (coincidencias):', matched.slice(0, 5).map((invoice) => ({
      num: invoice.invoice_number,
      tags: invoice.tags
    })));
  }

  return {
    invoices: dedupePurchasesByHoldedId(matched),
    enrichedCount
  };
}

/** Cuentas de gasto ESTRUCTURA (ampliar cuando administración indique más códigos). */
export const PIG_ESTRUCTURA_GASTO_ACCOUNT_CODES = [];

/** Solo las 2 subvenciones 740 de ESTRUCTURA (hoja dedicada). */
export const PIG_ESTRUCTURA_SUBV_740_ACCOUNT_CODES = ['74011003', '74080004'];

export function isPigEstructuraSubv740Cuenta(c) {
  const code = String(c?.code || '').trim();
  return PIG_ESTRUCTURA_SUBV_740_ACCOUNT_CODES.includes(code);
}

export function isPigEstructuraLineaCuenta(c) {
  const code = String(c?.code || '').trim();
  const hay = `${code} ${c?.name || ''}`.toUpperCase();
  if (PIG_ESTRUCTURA_GASTO_ACCOUNT_CODES.includes(code)) return true;
  if (!hay.includes('ESTRUCTURA')) return false;
  if (hay.includes('CATERING') || hay.includes('IDONI') || hay.includes('KOIKI')) return false;
  return true;
}

export function extractSubvenciones740Cuentas(cuentas = []) {
  return (cuentas || [])
    .filter((c) => {
      const code = String(c?.code || '').trim();
      return code.startsWith('740') && isPigEstructuraLineaCuenta(c);
    })
    .slice()
    .sort((a, b) => String(a.code).localeCompare(String(b.code)));
}

function parseSheetDate(value) {
  if (!value) return null;
  const text = String(value).trim();
  if (!text) return null;
  const parts = text.split(/[/-]/);
  if (parts.length === 3) {
    const [d, m, y] = parts.map((p) => Number(p));
    if (Number.isFinite(d) && Number.isFinite(m) && Number.isFinite(y)) {
      const date = new Date(y, m - 1, d);
      return Number.isFinite(date.getTime()) ? date : null;
    }
  }
  const date = new Date(text);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function getEstructuraPurchaseStatusLabel(invoice) {
  const pending = parseAmount(invoice?.pending);
  if (pending <= 0.005) return 'Pagada';

  const due = parseSheetDate(invoice?.due_date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (due) {
    due.setHours(0, 0, 0, 0);
    if (due < today) return 'Vencida';
  }

  const status = invoice?.status;
  if (status === 2 || String(status).toLowerCase().includes('parcial')) return 'Parcial';
  return 'Pendiente';
}

export function normalizeEstructuraPurchaseRow(invoice) {
  const pending = parseAmount(invoice?.pending);
  const statusLabel = getEstructuraPurchaseStatusLabel(invoice);
  return {
    invoice_number: invoice?.invoice_number || '',
    provider: invoice?.provider || '',
    issue_date: invoice?.issue_date || '',
    due_date: invoice?.due_date || '',
    description: invoice?.description || '',
    tags: normalizeTagsText(invoice?.tags),
    total: parseAmount(invoice?.total),
    pending,
    statusLabel,
    overdue: statusLabel === 'Vencida',
    holded_id: invoice?.holded_id || null
  };
}

function sortEstructuraRows(rows) {
  return [...rows].sort((a, b) => {
    if (a.overdue !== b.overdue) return a.overdue ? -1 : 1;
    const dueA = parseSheetDate(a.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const dueB = parseSheetDate(b.due_date)?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (dueA !== dueB) return dueA - dueB;
    return String(a.invoice_number).localeCompare(String(b.invoice_number));
  });
}

function resolveMonthHeaders(mensualParsed, monthsFallback = []) {
  const byIndex = mensualParsed?.monthNamesByIndex;
  if (Array.isArray(byIndex) && byIndex.some(Boolean)) {
    return byIndex.map((name, i) => name || DEFAULT_MONTHS[i]);
  }
  const fromParsed = (mensualParsed?.monthNames || []).filter(Boolean);
  if (fromParsed.length) {
    return fromParsed.length >= 12
      ? fromParsed.slice(0, 12)
      : [...fromParsed, ...DEFAULT_MONTHS.slice(fromParsed.length)];
  }
  if (monthsFallback.length) {
    const headers = [...DEFAULT_MONTHS];
    monthsFallback.forEach((name, i) => {
      if (i < 12 && name) headers[i] = name;
    });
    return headers;
  }
  return [...DEFAULT_MONTHS];
}

function sumMonthsArray(values = []) {
  return (values || []).slice(0, 12).reduce((sum, value) => sum + (Number(value) || 0), 0);
}

function sumMonthlyColumns(rows = []) {
  const totals = new Array(12).fill(0);
  for (const row of rows) {
    const months = row?.months || [];
    for (let i = 0; i < 12; i++) totals[i] += Number(months[i]) || 0;
  }
  return totals;
}

export function buildPigEstructuraSheetAoa({
  mensualParsed = null,
  purchaseRows = [],
  monthsFallback = [],
  periodLabel = ''
} = {}) {
  const aoa = [];
  const layout = {};
  const SUBV_TOTAL_COL = 13;
  const PURCHASE_MAX_COL = 8;
  let row = 0;

  const monthHeaders = resolveMonthHeaders(mensualParsed, monthsFallback);
  const subvCuentas = extractSubvenciones740Cuentas(mensualParsed?.cuentas || []);
  const subvMonthTotals = sumMonthlyColumns(subvCuentas);
  const subvGrandTotal = subvMonthTotals.reduce((sum, value) => sum + value, 0);

  const purchaseTotal = purchaseRows.reduce((sum, rowItem) => sum + (Number(rowItem.total) || 0), 0);
  const purchasePendingTotal = purchaseRows.reduce((sum, rowItem) => sum + (Number(rowItem.pending) || 0), 0);

  const title = periodLabel
    ? `PIG ESTRUCTURA — ${periodLabel}`
    : 'PIG ESTRUCTURA — Subvencions 740 vs Compres #estructura';

  layout.titleRow = row;
  aoa.push([title]);
  row += 1;
  aoa.push([]);
  row += 1;

  layout.subvSectionRow = row;
  aoa.push(['SUBVENCIONS (COMPTES 740) — dades CSV mensual']);
  row += 1;
  layout.subvHeaderRow = row;
  aoa.push(['Compte', ...monthHeaders, 'TOTAL']);
  row += 1;

  layout.subvDataStartRow = row;
  for (const cuenta of subvCuentas) {
    const months = (cuenta.months || new Array(12).fill(0)).slice(0, 12);
    while (months.length < 12) months.push(0);
    aoa.push([`${cuenta.code} - ${cuenta.name}`.trim(), ...months, sumMonthsArray(months)]);
    row += 1;
  }
  if (!subvCuentas.length) {
    aoa.push(['(Cap compte 740 trobada al CSV mensual)', ...new Array(12).fill(''), 0]);
    row += 1;
  }
  layout.subvDataEndRow = row - 1;

  layout.subvTotalRow = row;
  aoa.push(['TOTAL SUBVENCIONS 740', ...subvMonthTotals, subvGrandTotal]);
  row += 1;
  aoa.push([]);
  row += 1;

  layout.purchaseSectionRow = row;
  aoa.push(['COMPRAS ESTRUCTURA (#estructura) — pendents i vençudes (Holded)']);
  row += 1;
  layout.purchaseHeaderRow = row;
  aoa.push([
    'Núm',
    'Proveïdor',
    "Data d'emissió",
    'Venciment',
    'Descripció',
    'Tags',
    'Total',
    'Pendents',
    'Estat'
  ]);
  row += 1;

  layout.purchaseDataStartRow = row;
  for (const purchaseRow of purchaseRows) {
    aoa.push([
      purchaseRow.invoice_number,
      purchaseRow.provider,
      purchaseRow.issue_date,
      purchaseRow.due_date,
      purchaseRow.description,
      purchaseRow.tags,
      purchaseRow.total,
      purchaseRow.pending,
      purchaseRow.statusLabel
    ]);
    row += 1;
  }
  if (!purchaseRows.length) {
    aoa.push(['(Cap compra amb tag #estructura)', '', '', '', '', '', 0, 0, '']);
    row += 1;
  }
  layout.purchaseDataEndRow = row - 1;

  layout.purchaseTotalRow = row;
  aoa.push(['TOTAL COMPRAS ESTRUCTURA', '', '', '', '', '', purchaseTotal, purchasePendingTotal, '']);
  row += 1;
  aoa.push([]);
  row += 1;

  layout.comparativaSectionRow = row;
  aoa.push(['COMPARATIVA']);
  row += 1;
  layout.comparativaHeaderRow = row;
  aoa.push(['Concepte', 'Import']);
  row += 1;
  layout.comparativaDataStartRow = row;
  aoa.push(['Subvencions imputades (740)', subvGrandTotal]);
  row += 1;
  aoa.push(['Compres estructura pendents (#estructura)', purchasePendingTotal]);
  row += 1;
  layout.comparativaDiffRow = row;
  aoa.push(['Diferència (subvencions - compres pendents)', subvGrandTotal - purchasePendingTotal]);
  layout.comparativaDataEndRow = row;
  row += 1;

  return {
    aoa,
    meta: {
      subvCuentasCount: subvCuentas.length,
      subvGrandTotal,
      purchaseCount: purchaseRows.length,
      purchasePendingTotal,
      difference: subvGrandTotal - purchasePendingTotal,
      layout,
      subvTotalCol: SUBV_TOTAL_COL,
      purchaseMaxCol: PURCHASE_MAX_COL
    }
  };
}

export async function loadPigEstructuraPendingPurchases({ company = 'solucions' } = {}) {
  log(`Cargando compras pendientes y vencidas (${company})...`);

  try {
    const allPurchases = await holdedApi.getAllPendingAndOverduePurchases(company);
    const { invoices: matchedInvoices, enrichedCount } = await resolveEstructuraPurchases(allPurchases, company);
    const rows = sortEstructuraRows(matchedInvoices.map(normalizeEstructuraPurchaseRow));

    const stats = {
      company,
      fetched: (allPurchases || []).length,
      enriched: enrichedCount,
      matched: rows.length,
      overdue: rows.filter((row) => row.overdue).length,
      pending: rows.filter((row) => row.statusLabel === 'Pendiente' || row.statusLabel === 'Parcial').length,
      totalPending: rows.reduce((sum, row) => sum + (Number(row.pending) || 0), 0),
      totalAmount: rows.reduce((sum, row) => sum + (Number(row.total) || 0), 0)
    };

    log('Resumen compras:', stats);
    if (rows.length) {
      log('Muestras compras:', rows.slice(0, 5));
    } else {
      logWarn('No se encontraron compras con tag estructura (#estructura).');
    }

    return { rows, stats, error: null };
  } catch (error) {
    logWarn('Error cargando compras estructura:', error);
    return {
      rows: [],
      stats: {
        company,
        fetched: 0,
        matched: 0,
        overdue: 0,
        pending: 0,
        totalPending: 0,
        totalAmount: 0
      },
      error
    };
  }
}
