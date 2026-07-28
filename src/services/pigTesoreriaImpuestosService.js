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

const REQUIRED_TAX_ACCOUNT_CODES = [
  ...IMPUESTOS_MOD_303_ACCOUNTS.map((row) => row.code),
  ...IMPUESTOS_A_PAGAR_ACCOUNTS.map((row) => row.code)
].map(normalizeAccountCode);

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

export function extractHoldedAccountBalance(account) {
  if (!account || typeof account !== 'object') return 0;
  // Priorizar el saldo que muestra Holded en el plan contable
  if (account.balance != null && account.balance !== '') return parseBalance(account.balance);
  if (account.saldo != null && account.saldo !== '') return parseBalance(account.saldo);
  if (account.balances?.balance != null) return parseBalance(account.balances.balance);
  if (account.debit != null || account.credit != null) {
    return parseBalance(account.debit) - parseBalance(account.credit);
  }
  if (account.debe != null || account.haber != null) {
    return parseBalance(account.debe) - parseBalance(account.haber);
  }
  if (account.amount != null) return parseBalance(account.amount);
  return 0;
}

export function accountHasExplicitBalance(account) {
  if (!account || typeof account !== 'object') return false;
  if (account.balance != null && account.balance !== '') return true;
  if (account.saldo != null && account.saldo !== '') return true;
  if (account.balances?.balance != null && account.balances.balance !== '') return true;
  if (account.debit != null || account.credit != null) return true;
  if (account.debe != null || account.haber != null) return true;
  if (account.amount != null && account.amount !== '') return true;
  return false;
}

function buildBalanceMap(accounts = []) {
  const map = new Map();
  const matchedRequestedCodes = new Set();
  const matchedCodesWithBalance = new Set();
  const required = new Set(REQUIRED_TAX_ACCOUNT_CODES);

  for (const account of accounts) {
    const code = extractHoldedAccountNumber(account);
    if (!code) continue;
    const isRequested = required.has(code);
    if (isRequested) matchedRequestedCodes.add(code);
    if (isRequested && accountHasExplicitBalance(account)) matchedCodesWithBalance.add(code);

    const balance = extractHoldedAccountBalance(account);
    if (map.has(code)) map.set(code, map.get(code) + balance);
    else map.set(code, balance);
  }
  return { map, matchedRequestedCodes, matchedCodesWithBalance };
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

function unavailableImpuestos(error) {
  return {
    unavailable: true,
    errorMessage: error?.message || String(error || 'No se pudieron cargar saldos de impuestos.'),
    mod303: [],
    mod303Sum: null,
    aPagar: [],
    aPagarByCode: {}
  };
}

/**
 * Carga saldos de cuentas fiscales desde Holded (accounting-accounts).
 */
export async function loadPigImpuestosBalances({ company = 'solucions' } = {}) {
  try {
    const raw = await holdedApiV2Service.getAccountingAccounts(company);
    const { map, matchedRequestedCodes, matchedCodesWithBalance } = buildBalanceMap(raw || []);
    if (!matchedRequestedCodes.size) {
      throw new Error('Holded no devolvió ninguna cuenta fiscal esperada (472/477/470/475/4751).');
    }
    if (!matchedCodesWithBalance.size) {
      throw new Error('Holded devolvió cuentas fiscales sin campos de saldo; no se puede calcular IMPUESTOS con importes verificables.');
    }
    const mod303 = IMPUESTOS_MOD_303_ACCOUNTS.map((row) => ({
      ...row,
      balance: balanceForCode(map, row.code)
    }));
    const aPagar = IMPUESTOS_A_PAGAR_ACCOUNTS.map((row) => ({
      ...row,
      balance: balanceForCode(map, row.code)
    }));
    const mod303Sum = mod303.reduce((acc, r) => acc + (Number(r.balance) || 0), 0);
    return {
      impuestos: {
        mod303,
        mod303Sum,
        aPagar,
        aPagarByCode: Object.fromEntries(aPagar.map((r) => [r.code, r.balance]))
      },
      error: null
    };
  } catch (error) {
    return {
      impuestos: unavailableImpuestos(error),
      error
    };
  }
}
