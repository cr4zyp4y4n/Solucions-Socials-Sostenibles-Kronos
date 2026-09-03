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
  const raw = String(value).replace(/\s/g, '');
  const lastComma = raw.lastIndexOf(',');
  const lastDot = raw.lastIndexOf('.');
  let normalized = raw;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized = lastComma > lastDot
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(/,/g, '');
  } else if (lastComma >= 0) {
    normalized = raw.replace(/\./g, '').replace(',', '.');
  }
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function hasExplicitBalance(account) {
  return Boolean(
    account
    && typeof account === 'object'
    && (
      account.debit != null
      || account.debe != null
      || account.credit != null
      || account.haber != null
      || account.balances?.debit != null
      || account.balances?.credit != null
      || account.balance != null
      || account.saldo != null
      || account.balances?.balance != null
      || account.amount != null
    )
  );
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
    if (!hasExplicitBalance(account)) continue;
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
    if (!Array.isArray(raw)) {
      throw new Error('Holded no devolvió el plan contable en formato válido.');
    }
    const map = buildBalanceMap(raw || []);
    const fiscalCodes = [
      ...IMPUESTOS_MOD_303_ACCOUNTS.map((row) => normalizeAccountCode(row.code)),
      ...IMPUESTOS_A_PAGAR_ACCOUNTS.map((row) => normalizeAccountCode(row.code))
    ];
    const hasAnyFiscalBalance = fiscalCodes.some((code) => map.has(code));
    if (!hasAnyFiscalBalance) {
      throw new Error('Holded no devolvió saldos verificables para las cuentas fiscales del PIG.');
    }
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
      impuestos: null,
      error
    };
  }
}
