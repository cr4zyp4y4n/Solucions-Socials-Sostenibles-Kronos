import holdedApi from './holdedApi';
import holdedApiV2Service from './holdedApiV2Service';

export const PIG_CATERING_ACCOUNT_NUMBER = '70010000';
const LOG_PREFIX = '[PIG Catering Holded]';

const MONTH_LABELS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function log(...args) {
  console.log(LOG_PREFIX, ...args);
}

function logWarn(...args) {
  console.warn(LOG_PREFIX, ...args);
}

function parseAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object') {
    const nested = value.total ?? value.amount ?? value.gross ?? value.value;
    if (nested != null && nested !== value) return parseAmount(nested);
    return 0;
  }
  const text = String(value).trim();
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeAccountNumber(value) {
  return String(value ?? '').replace(/\D/g, '');
}

function buildAccountMap(accounts = []) {
  const map = new Map();
  for (const account of accounts || []) {
    if (!account?.id) continue;
    map.set(String(account.id), {
      id: String(account.id),
      name: String(account.name || '').trim(),
      number: account.number ?? account.num ?? null
    });
  }
  return map;
}

function isCateringAccountRef(value, cateringAccountId, accountMap = null) {
  if (value == null || value === '') return false;
  if (cateringAccountId && String(value) === String(cateringAccountId)) return true;
  const normalized = normalizeAccountNumber(value);
  if (normalized && normalized.startsWith(PIG_CATERING_ACCOUNT_NUMBER)) return true;
  if (accountMap) {
    const acct = accountMap.get(String(value));
    if (acct) {
      const num = normalizeAccountNumber(acct.number);
      if (num && num.startsWith(PIG_CATERING_ACCOUNT_NUMBER)) return true;
    }
  }
  return false;
}

function getDocumentLines(doc) {
  const collections = [doc?.lines, doc?.products, doc?.items].filter(Array.isArray);
  return collections.flat();
}

function sumLineAmounts(doc) {
  const lines = getDocumentLines(doc);
  if (!lines.length) return 0;

  let sum = 0;
  for (const line of lines) {
    const direct = parseAmount(line.total ?? line.gross ?? line.amount);
    if (Math.abs(direct) > 0.005) {
      sum += direct;
      continue;
    }

    const price = parseAmount(line.price ?? line.unitPrice ?? line.subtotal);
    const units = parseAmount(line.units ?? line.quantity ?? 1) || 1;
    const tax = parseAmount(line.tax ?? line.taxRate);
    const base = price * units;
    if (Math.abs(base) <= 0.005) continue;
    sum += tax > 0 && tax <= 100 ? base * (1 + tax / 100) : base;
  }
  return sum;
}

function getEstimateTotal(doc) {
  const candidates = [
    doc?.total,
    doc?.gross,
    doc?.amount,
    doc?.grandTotal,
    doc?.totals?.total,
    doc?.totals?.gross,
    doc?.totals?.amount
  ];
  for (const candidate of candidates) {
    const parsed = parseAmount(candidate);
    if (Math.abs(parsed) > 0.005) return parsed;
  }

  const subtotal = parseAmount(doc?.subtotal ?? doc?.net ?? doc?.base);
  const tax = parseAmount(doc?.tax ?? doc?.vat);
  if (Math.abs(subtotal) > 0.005) {
    return tax > 0 ? subtotal + tax : subtotal;
  }

  return sumLineAmounts(doc);
}

function parseDueDateMonthIndex(raw, year) {
  if (raw == null || raw === '') return null;
  let date;
  if (typeof raw === 'number') {
    date = new Date(raw > 1e12 ? raw : raw * 1000);
  } else if (raw instanceof Date) {
    date = raw;
  } else {
    const text = String(raw).trim();
    if (/^\d+$/.test(text)) {
      const ts = Number(text);
      date = new Date(ts > 1e12 ? ts : ts * 1000);
    } else {
      date = new Date(text.slice(0, 10));
    }
  }
  if (!Number.isFinite(date.getTime())) return null;
  if (date.getFullYear() !== Number(year)) return null;
  return date.getMonth();
}

function getExclusionReason(doc) {
  const status = String(doc?.status ?? '').toLowerCase();
  if (['failed', 'cancelled', 'canceled', 'rejected', 'refused'].includes(status)) {
    return `status:${status}`;
  }
  if (doc?.billed === 1 || doc?.billed === true) return 'billed';
  return null;
}

function estimateUsesCateringAccount(doc, cateringAccountId, accountMap = null) {
  for (const line of getDocumentLines(doc)) {
    const refs = [
      line?.account,
      line?.accountingAccount,
      line?.taxAccount,
      line?.expenseAccount
    ];
    if (refs.some((ref) => isCateringAccountRef(ref, cateringAccountId, accountMap))) return true;
  }
  return isCateringAccountRef(doc?.accountingAccount, cateringAccountId, accountMap)
    || isCateringAccountRef(doc?.account, cateringAccountId, accountMap);
}

function createStats() {
  return {
    source: null,
    fetched: 0,
    excluded: { billed: 0, status: 0 },
    noCateringAccount: 0,
    noDueDateInYear: 0,
    matched: 0,
    matchedZeroAmount: 0,
    samples: [],
    months: new Array(12).fill(0)
  };
}

function pushSample(stats, doc, reason, extra = {}) {
  if (stats.samples.length >= 8) return;
  stats.samples.push({
    reason,
    docNumber: doc?.document_number || doc?.docNumber || doc?.id,
    total: doc?.total,
    parsedTotal: getEstimateTotal(doc),
    dueDate: doc?.due_date || doc?.dueDate,
    status: doc?.status,
    billed: doc?.billed,
    account: doc?.accountingAccount || doc?.account,
    lineAccounts: getDocumentLines(doc).slice(0, 3).map((line) => line?.account || line?.accountingAccount),
    ...extra
  });
}

function addEstimateToMonths(months, doc, year, cateringAccountId, accountMap, stats) {
  if (!doc) return;
  const exclusion = getExclusionReason(doc);
  if (exclusion) {
    if (exclusion === 'billed') stats.excluded.billed += 1;
    else stats.excluded.status += 1;
    pushSample(stats, doc, exclusion);
    return;
  }
  if (!estimateUsesCateringAccount(doc, cateringAccountId, accountMap)) {
    stats.noCateringAccount += 1;
    pushSample(stats, doc, 'no-catering-account');
    return;
  }
  const dueRaw = doc.due_date || doc.dueDate;
  const monthIdx = parseDueDateMonthIndex(dueRaw, year);
  if (monthIdx == null) {
    stats.noDueDateInYear += 1;
    pushSample(stats, doc, 'no-due-in-year', { dueRaw });
    return;
  }
  const amount = getEstimateTotal(doc);
  if (Math.abs(amount) <= 0.005) {
    stats.matchedZeroAmount += 1;
    pushSample(stats, doc, 'matched-zero-amount', { monthIdx, month: MONTH_LABELS[monthIdx], dueRaw });
    return;
  }
  months[monthIdx] += amount;
  stats.matched += 1;
  stats.months[monthIdx] += amount;
  pushSample(stats, doc, 'matched', { monthIdx, month: MONTH_LABELS[monthIdx], amount });
}

function findCateringAccountId(accounts = []) {
  const match = accounts.find((account) => {
    const number = normalizeAccountNumber(account?.number ?? account?.num);
    return number === PIG_CATERING_ACCOUNT_NUMBER || number.startsWith(PIG_CATERING_ACCOUNT_NUMBER);
  });
  return match?.id ? String(match.id) : null;
}

function logStats(stats, year) {
  log(`Resumen ${stats.source} (${year}):`, {
    fetched: stats.fetched,
    matched: stats.matched,
    matchedZeroAmount: stats.matchedZeroAmount,
    excludedBilled: stats.excluded.billed,
    excludedStatus: stats.excluded.status,
    noCateringAccount: stats.noCateringAccount,
    noDueDateInYear: stats.noDueDateInYear,
    months: stats.months.map((v, i) => `${MONTH_LABELS[i]}:${v}`).join(', ')
  });
  if (stats.samples.length) log('Muestras:', stats.samples);
}

async function loadAccountingContext(company) {
  const accounts = await holdedApiV2Service.getAccountingAccounts(company);
  return {
    cateringAccountId: findCateringAccountId(accounts),
    accountMap: buildAccountMap(accounts)
  };
}

async function loadFromHoldedV2(year, company, accountingCtx) {
  const stats = createStats();
  stats.source = 'v2';
  const estimates = await holdedApiV2Service.getEstimates({ sort: '-date' }, company);
  const { cateringAccountId, accountMap } = accountingCtx;
  stats.fetched = (estimates || []).length;
  log(`V2: ${stats.fetched} presupuestos, cuenta 70010000 id=${cateringAccountId || 'NO ENCONTRADA'}`);
  const months = new Array(12).fill(0);
  for (const estimate of estimates || []) {
    addEstimateToMonths(months, estimate, year, cateringAccountId, accountMap, stats);
  }
  logStats(stats, year);
  return { months, stats };
}

async function loadFromHoldedV1(year, company, billedFilter, accountingCtx) {
  const stats = createStats();
  stats.source = billedFilter === undefined ? 'v1-all' : 'v1-unbilled';
  const estimates = await holdedApi.getAllEstimatesPages(company, year, billedFilter);
  const { cateringAccountId, accountMap } = accountingCtx;
  stats.fetched = (estimates || []).length;
  log(`V1 (${stats.source}): ${stats.fetched} presupuestos`);
  const months = new Array(12).fill(0);
  for (const estimate of estimates || []) {
    addEstimateToMonths(months, estimate, year, cateringAccountId, accountMap, stats);
  }
  logStats(stats, year);
  return { months, stats };
}

export function mergeCateringBaseWithHoldedBudgets(billingMonths, budgetMonths) {
  const months = new Array(12).fill(0);
  const fromBudget = new Array(12).fill(false);
  for (let i = 0; i < 12; i++) {
    const billing = Number(billingMonths?.[i]) || 0;
    if (Math.abs(billing) > 0.005) {
      months[i] = billing;
      continue;
    }
    const budget = Number(budgetMonths?.[i]) || 0;
    months[i] = budget;
    fromBudget[i] = Math.abs(budget) > 0.005;
  }
  return { months, fromBudget };
}

export async function loadPigCateringBudgetMonthsByDueDate({ year, company = 'solucions' }) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    const error = new Error('Año inválido');
    logWarn('Año inválido:', year);
    return { months: new Array(12).fill(0), error, debug: null };
  }

  log(`Inicio carga presupuestos catering para ${y} (${company})`);

  try {
    let months = new Array(12).fill(0);
    let debug = null;
    let accountingCtx = { cateringAccountId: null, accountMap: null };

    try {
      accountingCtx = await loadAccountingContext(company);
    } catch (accountError) {
      logWarn('No se pudieron cargar cuentas contables V2:', accountError?.message || accountError);
      debug = { accountError: String(accountError?.message || accountError) };
    }

    try {
      const v2 = await loadFromHoldedV2(y, company, accountingCtx);
      months = v2.months;
      debug = { ...debug, v2: v2.stats };
    } catch (v2Error) {
      logWarn('V2 falló, se probará V1:', v2Error?.message || v2Error);
      debug = { ...debug, v2Error: String(v2Error?.message || v2Error) };
    }

    if (!months.some((value) => Math.abs(value) > 0.005)) {
      log('Sin importes en V2, probando V1 (solo no facturados)...');
      const v1Unbilled = await loadFromHoldedV1(y, company, 0, accountingCtx);
      months = v1Unbilled.months;
      debug = { ...debug, v1Unbilled: v1Unbilled.stats };

      if (!months.some((value) => Math.abs(value) > 0.005)) {
        log('Sin importes en V1 unbilled, probando V1 (todos)...');
        const v1All = await loadFromHoldedV1(y, company, undefined, accountingCtx);
        months = v1All.months;
        debug = { ...debug, v1All: v1All.stats };
      }
    }

    const total = months.reduce((a, b) => a + (Number(b) || 0), 0);
    log(`Total presupuestos por mes (suma anual): ${total}`, months);

    return { months, error: null, debug };
  } catch (error) {
    logWarn('Error general:', error);
    return { months: new Array(12).fill(0), error, debug: null };
  }
}
