import holdedApi from './holdedApi';
import holdedApiV2Service from './holdedApiV2Service';

/** Columnas 0-based de la tabla IMPUESTOS (E–H), con D como hueco. */
export const IMPUESTOS_COL = {
  code: 4,
  desc: 5,
  saldo: 6,
  aPagar: 7
};

/** Cuentas Holded del bloque MOD 303 (saldos en columna G). */
export const IMPUESTOS_MOD_303_ACCOUNTS = [
  {
    code: '47200000',
    description: 'Impuesto sobre el Iva - Soportado / Deducible (compras)'
  },
  {
    code: '47700000',
    description: 'Impuesto sobre el Iva - Repercutido / devengado (ventas)'
  },
  {
    code: '47000000',
    description: 'HACIENDA PUBLICA DEUDORA'
  },
  {
    code: '47500000',
    description: 'HACIENDA PÚB.ACREEDORA POR IVA'
  }
];

/** Cuentas que van directo a A PAGAR (MOD 111 / 115). */
export const IMPUESTOS_A_PAGAR_ACCOUNTS = [
  { code: '47510000', description: 'IRPF TRABAJADORES', model: '111' },
  { code: '47510001', description: 'IRPF PROFESIONALES', model: '111' },
  { code: '47510020', description: 'IRPF ALQUILER', model: '115' }
];

function parseBalance(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const n = Number.parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

/** Normaliza número de cuenta contable a dígitos (p. ej. 47200000). */
export function normalizeAccountCode(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s/g, '')
    .replace(/\.0+$/, '')
    .replace(/\D/g, '');
}

/**
 * Número de cuenta contable tal como lo devuelve Holded (campo `number`).
 * No usa `prefix` ni `id`: un prefijo "472" no es la cuenta 47200000.
 */
export function extractHoldedAccountNumber(account) {
  const candidates = [
    account?.number,
    account?.accountNumber,
    account?.account_number,
    account?.num,
    account?.accNum,
    account?.acc_num
  ];
  for (const c of candidates) {
    const code = normalizeAccountCode(c);
    if (code.length >= 6) return code;
  }
  return '';
}

/** @deprecated Usar extractHoldedAccountNumber */
export function extractHoldedAccountCode(account) {
  return extractHoldedAccountNumber(account);
}

/**
 * Saldo como en el plan contable de Holded: Debe − Haber.
 * Si no hay debe/haber, usa `balance` / `saldo`.
 */
export function extractHoldedAccountBalance(account) {
  if (!account || typeof account !== 'object') return 0;

  const hasDebit =
    account.debit != null
    || account.debe != null
    || account.balances?.debit != null;
  const hasCredit =
    account.credit != null
    || account.haber != null
    || account.balances?.credit != null;

  if (hasDebit || hasCredit) {
    const debit = parseBalance(
      account.debit ?? account.debe ?? account.balances?.debit ?? 0
    );
    const credit = parseBalance(
      account.credit ?? account.haber ?? account.balances?.credit ?? 0
    );
    return debit - credit;
  }

  if (account.balance != null && account.balance !== '') return parseBalance(account.balance);
  if (account.saldo != null && account.saldo !== '') return parseBalance(account.saldo);
  if (account.balances?.balance != null) return parseBalance(account.balances.balance);
  if (account.amount != null) return parseBalance(account.amount);
  return 0;
}

function buildBalanceMap(accounts = []) {
  const map = new Map();
  for (const account of accounts) {
    const code = extractHoldedAccountNumber(account);
    if (!code) continue;
    const balance = extractHoldedAccountBalance(account);
    // Exact match only: si Holded repite la misma cuenta, nos quedamos con el último saldo
    // (no sumar padre+hijos: cada código es independiente).
    map.set(code, balance);
  }
  return map;
}

/** Solo coincidencia exacta de número de cuenta (sin rellenar prefijos tipo 472 → 47200000). */
function balanceForCode(map, code) {
  const want = normalizeAccountCode(code);
  if (!want) return 0;
  if (map.has(want)) return map.get(want);
  return 0;
}

/**
 * Trimestre 1–4 a partir de mes 0-based (0=ene).
 * @param {number} [monthIndex]
 */
export function impuestosQuarterFromMonth(monthIndex) {
  const m = Number.isFinite(monthIndex) ? monthIndex : new Date().getMonth();
  return Math.floor(Math.min(Math.max(m, 0), 11) / 3) + 1;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * Rango ISO para el plan contable Holded (ambos obligatorios y distintos).
 * Por defecto: 01/01/{year} → último día del mes del PIG.
 */
export function buildImpuestosDateRange({ year, monthIndex } = {}) {
  const y = Number(year);
  const m = Number.isFinite(monthIndex) ? Math.min(11, Math.max(0, monthIndex)) : 11;
  const yearSafe = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const endDay = new Date(yearSafe, m + 1, 0).getDate();
  const start_date = `${yearSafe}-01-01`;
  const end_date = `${yearSafe}-${pad2(m + 1)}-${pad2(endDay)}`;
  if (start_date === end_date) {
    // Holded exige fechas distintas: usar al menos 2 días
    return { start_date, end_date: `${yearSafe}-01-02` };
  }
  return { start_date, end_date };
}

/**
 * Carga saldos de cuentas fiscales desde Holded (accounting-accounts)
 * para el periodo del PIG (ene → último mes con datos).
 */
export async function loadPigImpuestosBalances({
  company = 'solucions',
  year,
  monthIndex
} = {}) {
  try {
    const { start_date, end_date } = buildImpuestosDateRange({ year, monthIndex });
    const raw = await holdedApiV2Service.getAccountingAccounts(company, {
      start_date,
      end_date,
      include_empty: true
    });
    const map = buildBalanceMap(raw || []);
    const mod303 = IMPUESTOS_MOD_303_ACCOUNTS.map((row) => ({
      ...row,
      balance: balanceForCode(map, row.code)
    }));
    const aPagar = IMPUESTOS_A_PAGAR_ACCOUNTS.map((row) => {
      const balance = balanceForCode(map, row.code);
      // Columna A PAGAR: solo lo que se debe a Hacienda (saldo acreedor = negativo en Debe−Haber).
      const aPagarAmount = balance < 0 ? Math.abs(balance) : 0;
      return {
        ...row,
        balance,
        aPagar: aPagarAmount
      };
    });
    const mod303Sum = mod303.reduce((acc, r) => acc + (Number(r.balance) || 0), 0);

    console.log('[PIG TESORERÍA IMPUESTOS] Saldos Holded', {
      start_date,
      end_date,
      mod303: mod303.map((r) => ({ code: r.code, balance: r.balance })),
      aPagar: aPagar.map((r) => ({ code: r.code, balance: r.balance, aPagar: r.aPagar })),
      mod303Sum,
      accountsLoaded: (raw || []).length
    });

    return {
      impuestos: {
        mod303,
        mod303Sum,
        aPagar,
        aPagarByCode: Object.fromEntries(aPagar.map((r) => [r.code, r.aPagar])),
        start_date,
        end_date
      },
      error: null
    };
  } catch (error) {
    return {
      impuestos: {
        mod303: IMPUESTOS_MOD_303_ACCOUNTS.map((r) => ({ ...r, balance: 0 })),
        mod303Sum: 0,
        aPagar: IMPUESTOS_A_PAGAR_ACCOUNTS.map((r) => ({ ...r, balance: 0 })),
        aPagarByCode: {}
      },
      error
    };
  }
}

/** Mesos en català (índex 0 = gener). */
export const PIG_IMPUESTOS_MONTHS_CA = [
  'gener', 'febrer', 'març', 'abril', 'maig', 'juny',
  'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'
];

const QUARTER_LABELS_CA = ['1r', '2n', '3r', '4t'];

/**
 * Files de la previsió fiscal del PIG Normal.
 * El saldo és només del període triat. El 470/475 arrosseguen el saldo anterior
 * (IVA a compensar). El 111 i el 115 no inclouen el pagament del model del període anterior.
 * El 202 no té compte fins que es confirmi.
 */
const PAGO_MODELO_RE = /MOD\.?\s*11[15]|MOD\.?\s*303|MOD\.?\s*202/i;
const LLOGUER_RE = /capital inmobiliario|alquiler|arrendament/i;

export const IMPUESTOS_PREVISION_ROWS = [
  {
    key: '303',
    label: 'IVA',
    sign: 'net',
    criteri: 'Model 303 · 472 compres + 477 vendes + 470 a compensar + 475 acreedora. Només el període, més el saldo anterior del 470/475',
    parts: [
      { accounts: ['47200000'] },
      { accounts: ['47700000'] },
      { accounts: ['47000000'], opening: true },
      { accounts: ['47500000'], opening: true }
    ]
  },
  {
    key: '111',
    label: 'Retencions IRPF professionals / nòmines',
    sign: 'topay',
    criteri: 'Model 111 · 47510000 i 47510001. Meritació del període, sense el pagament del model anterior',
    parts: [
      { accounts: ['47510000', '47510001'], skip: [PAGO_MODELO_RE, LLOGUER_RE] }
    ]
  },
  {
    key: '115',
    label: 'Lloguers',
    sign: 'topay',
    criteri: 'Model 115 · 47510020 i retencions d\'arrendament del període, sense el pagament del model anterior',
    parts: [
      { accounts: ['47510020'], skip: PAGO_MODELO_RE },
      { accounts: ['47510000', '47510001'], only: LLOGUER_RE }
    ]
  },
  {
    key: '202',
    label: 'Pagaments a compte / altres impostos',
    sign: 'net',
    criteri: 'Model 202 · Compte pendent de confirmar. Només els que corresponguin a EISSS',
    parts: []
  }
];

function previsionAccountCodes() {
  const codes = new Set();
  for (const row of IMPUESTOS_PREVISION_ROWS) {
    for (const part of row.parts || []) {
      for (const code of part.accounts || []) codes.add(code);
    }
  }
  return [...codes];
}

const IMPUESTOS_MESOS_STORAGE_PREFIX = 'kronos.pig.impuestosMesos.';

function round2(value) {
  const n = Number(value) || 0;
  return Math.round(n * 100) / 100;
}

function monthEndIso(year, monthIndex) {
  const endDay = new Date(year, monthIndex + 1, 0).getDate();
  const mm = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${mm}-${String(endDay).padStart(2, '0')}`;
}

function monthStartIso(year, monthIndex) {
  const mm = String(monthIndex + 1).padStart(2, '0');
  return `${year}-${mm}-01`;
}

export function impuestosQuarterMonths(trimestre) {
  const q = Math.min(4, Math.max(1, Number(trimestre) || 1));
  const start = (q - 1) * 3;
  return [start, start + 1, start + 2];
}

export function defaultImpuestosMesos(year) {
  const y = Number(year);
  const now = new Date();
  const month = now.getFullYear() === y ? now.getMonth() : 0;
  const trimestre = Math.floor(month / 3) + 1;
  return {
    mode: 'trimestre',
    trimestre,
    months: impuestosQuarterMonths(trimestre)
  };
}

function sanitizeImpuestosMesos(raw, year) {
  const fallback = defaultImpuestosMesos(year);
  if (!raw || typeof raw !== 'object') return fallback;
  const mode = raw.mode === 'suelto' ? 'suelto' : 'trimestre';
  const trimestre = Math.min(4, Math.max(1, Number(raw.trimestre) || fallback.trimestre));
  const picked = Array.isArray(raw.months)
    ? [...new Set(raw.months.map((m) => Number(m)).filter((m) => m >= 0 && m <= 11))].sort((a, b) => a - b).slice(0, 3)
    : [];
  if (mode === 'trimestre') {
    return { mode, trimestre, months: impuestosQuarterMonths(trimestre) };
  }
  return { mode, trimestre, months: picked };
}

export function loadStoredImpuestosMesos(year) {
  const y = Number(year);
  const fallback = defaultImpuestosMesos(Number.isFinite(y) ? y : new Date().getFullYear());
  if (typeof localStorage === 'undefined' || !Number.isFinite(y)) return fallback;
  try {
    const raw = localStorage.getItem(`${IMPUESTOS_MESOS_STORAGE_PREFIX}${y}`);
    if (!raw) return fallback;
    return sanitizeImpuestosMesos(JSON.parse(raw), y);
  } catch {
    return fallback;
  }
}

export function saveStoredImpuestosMesos(year, selection) {
  const y = Number(year);
  if (typeof localStorage === 'undefined' || !Number.isFinite(y)) return;
  const clean = sanitizeImpuestosMesos(selection, y);
  localStorage.setItem(`${IMPUESTOS_MESOS_STORAGE_PREFIX}${y}`, JSON.stringify(clean));
}

export function impuestosPeriodeLabel(year, months = [], mode = 'trimestre') {
  const sorted = [...months].filter((m) => m >= 0 && m <= 11).sort((a, b) => a - b);
  const y = Number(year) || '';
  if (!sorted.length) return String(y);
  const contiguousQuarter = mode === 'trimestre'
    && sorted.length === 3
    && sorted[0] % 3 === 0
    && sorted[1] === sorted[0] + 1
    && sorted[2] === sorted[0] + 2;
  if (contiguousQuarter) {
    return `${QUARTER_LABELS_CA[sorted[0] / 3]} trimestre ${y}`;
  }
  const names = sorted.map((m) => PIG_IMPUESTOS_MONTHS_CA[m]);
  if (names.length === 1) return `${names[0]} ${y}`;
  if (names.length === 2) return `${names[0]} i ${names[1]} ${y}`;
  return `${names[0]}, ${names[1]} i ${names[2]} ${y}`;
}

export function impuestosMonthHeaders(months = []) {
  const sorted = [...months].filter((m) => m >= 0 && m <= 11).sort((a, b) => a - b);
  const cap = (m) => {
    const name = PIG_IMPUESTOS_MONTHS_CA[m] || '';
    return name ? name.charAt(0).toUpperCase() + name.slice(1) : '';
  };
  return [0, 1, 2].map((i) => {
    const m = sorted[i];
    if (m == null) return i === 2 ? 'Mes 3 / tancament' : `Mes ${i + 1} acumulat`;
    if (i === 2) return `${cap(m)} / tancament`;
    return `${cap(m)} acumulat`;
  });
}

function madridMonthIndex(ms, year) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit'
  }).formatToParts(new Date(ms));
  const y = Number(parts.find((part) => part.type === 'year')?.value);
  const m = Number(parts.find((part) => part.type === 'month')?.value);
  if (y !== year || !m) return -1;
  return m - 1;
}

function madridUnix(year, monthIndex, day, hour, minute, second) {
  const utcGuess = Date.UTC(year, monthIndex, day, hour, minute, second);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date(utcGuess));
  const pick = (type) => Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'));
  return Math.floor((utcGuess - (asUtc - utcGuess)) / 1000);
}

function ledgerUnixRange(year, monthsSorted) {
  const first = monthsSorted[0];
  const last = monthsSorted[monthsSorted.length - 1];
  const lastDay = new Date(year, last + 1, 0).getDate();
  return {
    starttmp: madridUnix(year, first, 1, 0, 0, 0),
    endtmp: madridUnix(year, last, lastDay, 23, 59, 59)
  };
}

function entryMonthIndex(entry, year) {
  const raw = entry?.date ?? entry?.accounting_date ?? entry?.entry_date ?? entry?.timestamp;
  if (raw == null || raw === '') return -1;
  if (typeof raw === 'number') {
    const ms = raw > 1e12 ? raw : raw * 1000;
    if (Number.isNaN(new Date(ms).getTime())) return -1;
    return madridMonthIndex(ms, year);
  }
  const match = String(raw).match(/^(\d{4})-(\d{2})/);
  if (!match || Number(match[1]) !== year) return -1;
  return Number(match[2]) - 1;
}

function entryNet(entry) {
  return parseBalance(entry?.debit ?? entry?.debe) - parseBalance(entry?.credit ?? entry?.haber);
}

function entryText(entry) {
  return `${entry?.description || ''} ${entry?.docDescription || entry?.doc_description || ''}`;
}

function matchesAny(text, pattern) {
  const list = Array.isArray(pattern) ? pattern : [pattern];
  return list.some((item) => item && item.test(text));
}

function entryMatchesPart(entry, part) {
  const code = normalizeAccountCode(entry?.account ?? entry?.accountNumber ?? entry?.account_number);
  if (!(part.accounts || []).includes(code)) return false;
  const text = entryText(entry);
  if (part.only && !matchesAny(text, part.only)) return false;
  if (part.skip && matchesAny(text, part.skip)) return false;
  return true;
}

/**
 * Saldo al tancament de cada mes del període triat.
 * opening: suma el saldo anterior al període (470 / 475, IVA a compensar).
 * sign topay: haver − deu, import a ingressar (111 i 115).
 */
function balanceForRow(entries, row, year, monthsSorted) {
  const from = monthsSorted[0];
  const byMonth = new Map();
  for (let month = 0; month < 12; month += 1) byMonth.set(month, 0);
  let lines = 0;
  let opening = 0;
  for (const entry of entries) {
    if (!(row.parts || []).some((part) => entryMatchesPart(entry, part))) continue;
    const month = entryMonthIndex(entry, year);
    if (!byMonth.has(month)) continue;
    const carriesOpening = (row.parts || []).some((part) => part.opening && entryMatchesPart(entry, part));
    const net = entryNet(entry);
    if (month < from) {
      if (carriesOpening) opening += net;
      continue;
    }
    byMonth.set(month, byMonth.get(month) + net);
    lines += 1;
  }
  const sign = row.sign === 'topay' ? -1 : 1;
  const amounts = [null, null, null];
  monthsSorted.forEach((month, index) => {
    let acc = opening;
    for (let m = from; m <= month; m += 1) acc += byMonth.get(m) || 0;
    amounts[index] = round2(acc * sign);
  });
  const total = [...amounts].reverse().find((value) => value != null);
  return { amounts, total: total == null ? null : total, lines };
}

function emptyPrevisionRows(periode) {
  return IMPUESTOS_PREVISION_ROWS.map((row) => ({
    key: row.key,
    label: row.label,
    criteri: row.criteri,
    periode: row.key === '202' ? periode : periode,
    months: [null, null, null],
    total: null,
    blank: true
  }));
}

/**
 * Previsió fiscal del PIG Normal des del llibre diari (mateixes comptes, no el pla comptable).
 * months: índexs 0–11, màxim 3. El 202 queda sense import.
 */
export async function loadPigImpuestosPrevisionFromLedger({
  company = 'solucions',
  year,
  months,
  mode = 'trimestre'
} = {}) {
  const y = Number(year);
  const yearSafe = Number.isFinite(y) && y >= 2000 && y <= 2100 ? y : new Date().getFullYear();
  const selection = sanitizeImpuestosMesos({ mode, months, trimestre: months?.[0] != null ? Math.floor(Number(months[0]) / 3) + 1 : 1 }, yearSafe);
  const selected = selection.months.length ? selection.months : impuestosQuarterMonths(selection.trimestre);
  const periode = impuestosPeriodeLabel(yearSafe, selected, selection.mode);
  const monthHeaders = impuestosMonthHeaders(selected);
  const accounts = previsionAccountCodes();

  if (!selected.length || !accounts.length) {
    return {
      impuestosPrevision: {
        periode,
        monthHeaders,
        months: selected,
        rows: emptyPrevisionRows(periode),
        total: null
      },
      error: null
    };
  }

  const start_date = monthStartIso(yearSafe, 0);
  const end_date = monthEndIso(yearSafe, selected[selected.length - 1]);
  const { starttmp, endtmp } = ledgerUnixRange(yearSafe, [0, selected[selected.length - 1]]);

  try {
    const ledger = await holdedApi.getAccountingDailyLedger({ starttmp, endtmp }, company);
    const wanted = new Set(accounts.map((code) => normalizeAccountCode(code)));
    const entries = (ledger || []).filter((entry) => wanted.has(normalizeAccountCode(entry?.account)));

    const rows = IMPUESTOS_PREVISION_ROWS.map((spec) => {
      const criteri = spec.criteri;
      if (!(spec.parts || []).length) {
        return {
          key: spec.key,
          label: spec.label,
          criteri,
          periode,
          months: [null, null, null],
          total: null,
          blank: true
        };
      }
      const calc = balanceForRow(entries, spec, yearSafe, selected);
      return {
        key: spec.key,
        label: spec.label,
        criteri,
        periode,
        months: calc.amounts,
        total: calc.total,
        blank: false,
        lines: calc.lines,
        byMonth: calc.byMonth
      };
    });

    const total = round2(rows.reduce((acc, row) => acc + (row.blank ? 0 : Number(row.total) || 0), 0));
    console.log('[PIG IMPUESTOS LLIBRE DIARI]', {
      start_date,
      end_date,
      ledgerLines: (ledger || []).length,
      matchedLines: entries.length,
      months: selected.map((m) => PIG_IMPUESTOS_MONTHS_CA[m]),
      rows: rows.map((row) => ({
        key: row.key,
        months: row.months,
        total: row.total,
        lines: row.lines
      }))
    });

    return {
      impuestosPrevision: {
        periode,
        monthHeaders,
        months: selected,
        rows,
        total,
        start_date,
        end_date
      },
      error: null
    };
  } catch (error) {
    console.warn('[PIG IMPUESTOS LLIBRE DIARI] Error', error);
    const rows = emptyPrevisionRows(periode);
    const message = error?.message || 'Error de llibre diari';
    if (rows[0]) rows[0] = { ...rows[0], criteri: `${rows[0].criteri} · ${message}` };
    return {
      impuestosPrevision: {
        periode,
        monthHeaders,
        months: selected,
        rows,
        total: null,
        start_date,
        end_date,
        loadError: message
      },
      error
    };
  }
}
