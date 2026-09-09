/**
 * Sugerencias Holded para caja a corto (PIG Normal):
 * - NÓMINAS (neto): salary-records `total_payable` del mes si existen;
 *   si no (histórico 2025), suma del **haber** de cuentas **465*** (remuneraciones pendientes).
 * - SEGUROS SOCIALES: haber cuenta **47600000** del mismo mes.
 * - AUTÓNOMOS: debe de cuentas **642*** cuyo nombre contiene AUTONOMO (no SS empresa).
 * - FINANCIACIONES Y TARJETAS:
 *   · 170* con IDONI / furgoneta / BCREDIT / PRESTEC
 *   · 520* Visas/tarjetas
 *   · 520* préstamos cortos furgoneta/IDONI (si no son Visa)
 *
 * Siempre el **mismo mes del año anterior** al calendario (sin mezclar temporada).
 */
import holdedApiV2Service from './holdedApiV2Service';
import {
  extractHoldedAccountNumber,
  normalizeAccountCode
} from './pigTesoreriaImpuestosService';

const SS_ACCOUNT = '47600000';
const NOMINAS_ACCOUNT_PREFIX = '465';
const AUTONOMOS_ACCOUNT_PREFIX = '642';
const FINANCIACION_ACCOUNT_PREFIX = '170';
const TARJETAS_ACCOUNT_PREFIX = '520';
/** Concepto UI / Excel para la fila agregada financiaciones + tarjetas. */
export const CAJA_CORTO_FINANCIACIONES_CONCEPTO = 'FINANCIACIONES Y TARJETAS (170+520)';

/** 170: solo préstamo IDONI, furgoneta, BCREDIT (por nombre). */
function isFinanciacion170Account(code, name) {
  if (!String(code || '').startsWith(FINANCIACION_ACCOUNT_PREFIX)) return false;
  return /IDONI|FURGON|BCREDIT|PRESTEC/i.test(String(name || ''));
}

/** 520 préstamos a corto (furgoneta/IDONI…), excluye Visas. */
function isFinanciacion520PrestamoAccount(code, name) {
  const c = String(code || '');
  const n = String(name || '');
  if (!c.startsWith(TARJETAS_ACCOUNT_PREFIX)) return false;
  if (/VISA|TARJETA/i.test(n)) return false;
  if (/NO\s*USAR/i.test(n)) return false;
  return /IDONI|FURGON|BCREDIT|PRESTEC|PR[EÉ]STAM|FIARE/i.test(n);
}

/** 520: solo tarjetas Visa / tarjeta. */
function isTarjeta520Account(code, name) {
  const c = String(code || '');
  const n = String(name || '');
  if (!c.startsWith(TARJETAS_ACCOUNT_PREFIX)) return false;
  return /VISA|TARJETA/i.test(n);
}
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function parseHoldedMoney(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value ?? '').trim();
  if (!s) return 0;
  if (s.includes(',') && s.includes('.')) {
    const n = Number.parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  if (s.includes(',')) {
    const n = Number.parseFloat(s.replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  }
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function formatEuroAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n % 1) < 0.0005) return String(Math.round(n));
  return String(Math.round(n * 100) / 100).replace('.', ',');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function monthKey(year, month1to12) {
  return `${year}-${pad2(month1to12)}`;
}

function parseRecordDate(record) {
  const raw = record?.date ?? record?.payDate ?? record?.createdAt;
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() };
}

function isDraft(record) {
  return record?.is_draft === true || record?.isDraft === true || String(record?.status || '').toLowerCase() === 'draft';
}

function isNominasConcept(concepto) {
  const c = String(concepto || '').trim().toUpperCase();
  return c === 'NOMINAS' || c === 'NÓMINAS' || c === 'NOMINA' || c === 'NÓMINA' || /^N[OÓ]MINAS?$/.test(c);
}

function isSsConcept(concepto) {
  const c = String(concepto || '').trim().toUpperCase();
  return /SEGUROS?\s*SOCIALES?/.test(c) || c === 'SS' || c === 'S.S.' || c === 'S.S';
}

function isAutonomosConcept(concepto) {
  const c = String(concepto || '').trim().toUpperCase();
  return /AUT[OÓ]NOM/.test(c);
}

function isFinanciacionesConcept(concepto) {
  const c = String(concepto || '').trim().toUpperCase();
  return (
    c.includes('170')
    || c.includes('520')
    || /FINANCI/.test(c)
    || /TARJETA/.test(c)
    || /PRESTEC|PR[EÉ]STAM/.test(c)
    || /BCREDIT/.test(c)
    || /FURGON/.test(c)
  );
}

function isAutonomoAccountName(name) {
  return /AUT[OÓ]NOM/i.test(String(name || ''));
}

/**
 * Importe del mes en 170/520: el lado con más movimiento.
 * Préstamos suelen ir en debe (pago); Visas a menudo en haber (cargo ≈ cuota a pagar).
 */
function monthMovementAmount(debit, credit) {
  const d = Number(debit) || 0;
  const c = Number(credit) || 0;
  return Math.max(d, c);
}

function monthEndDay(year, month1to12) {
  return new Date(year, month1to12, 0).getDate();
}

function accountCredit(account) {
  return parseHoldedMoney(account?.credit ?? account?.haber ?? account?.balances?.credit ?? 0);
}

function accountDebit(account) {
  return parseHoldedMoney(account?.debit ?? account?.debe ?? account?.balances?.debit ?? 0);
}

export function monthLabelEs(year, month1to12) {
  const name = MONTHS_ES[month1to12 - 1] || String(month1to12);
  return `${name} ${year}`;
}

/** Mes de referencia histórico: mismo mes del año anterior al PIG. */
export function resolveCajaCortoPriorYearMonth(pigYear, pigMonthIndex) {
  const y = Number(pigYear);
  const mIdx = Number.isFinite(pigMonthIndex)
    ? Math.min(11, Math.max(0, pigMonthIndex))
    : new Date().getMonth();
  const month = mIdx + 1;
  const year = y - 1;
  return {
    year,
    month,
    monthIndex: mIdx,
    key: monthKey(year, month),
    label: monthLabelEs(year, month),
    pigYear: y,
    pigMonthLabel: monthLabelEs(y, month)
  };
}

function groupSalaryPayableByMonth(records = []) {
  const map = new Map();
  for (const rec of records || []) {
    if (isDraft(rec)) continue;
    const dt = parseRecordDate(rec);
    if (!dt) continue;
    const key = monthKey(dt.year, dt.month);
    const payable = parseHoldedMoney(rec.total_payable ?? rec.totalPayable ?? rec.payment_pending);
    const prev = map.get(key) || { year: dt.year, month: dt.month, key, count: 0, nominasNeto: 0 };
    prev.count += 1;
    prev.nominasNeto += payable;
    map.set(key, prev);
  }
  return map;
}

/**
 * Una sola llamada al plan contable del mes:
 * - NÓMINAS: suma haber 465*
 * - SS: haber 476
 * - AUTÓNOMOS: suma debe 642* cuyo nombre contiene AUTONOMO
 * - FINANCIACIONES Y TARJETAS:
 *   · 170* IDONI / furgoneta / BCREDIT (préstamos LP)
 *   · 520* préstamos cortos IDONI/furgoneta (si no son Visa)
 *   · 520* Visas / tarjetas
 */
async function loadAccountingCajaCortoForMonth({ company, year, month }) {
  const start_date = `${year}-${pad2(month)}-01`;
  const end_date = `${year}-${pad2(month)}-${pad2(monthEndDay(year, month))}`;
  const accounts = await holdedApiV2Service.getAccountingAccounts(company, {
    start_date,
    end_date,
    include_empty: true
  });

  const wantSs = normalizeAccountCode(SS_ACCOUNT);
  let ssCredit = 0;
  let ssBalance = 0;
  let ssFound = false;
  let nominasCredit = 0;
  let nominasAccounts = 0;
  let autonomosDebit = 0;
  let autonomosAccounts = 0;
  const autonomosCodes = [];
  let financiaciones = 0;
  let financiacionesAccounts = 0;
  const financiacionesCodes = [];

  for (const account of accounts || []) {
    const code = extractHoldedAccountNumber(account);
    if (!code) continue;
    const credit = accountCredit(account);
    const debit = accountDebit(account);
    const name = String(account.name || account.description || '');

    if (code === wantSs) {
      ssFound = true;
      ssCredit = credit;
      ssBalance = debit - credit;
    }
    if (code.startsWith(NOMINAS_ACCOUNT_PREFIX) && credit > 0.005) {
      nominasCredit += credit;
      nominasAccounts += 1;
    }
    if (
      code.startsWith(AUTONOMOS_ACCOUNT_PREFIX)
      && isAutonomoAccountName(name)
      && debit > 0.005
    ) {
      autonomosDebit += debit;
      autonomosAccounts += 1;
      autonomosCodes.push(code);
    }
    if (
      isFinanciacion170Account(code, name)
      || isFinanciacion520PrestamoAccount(code, name)
      || isTarjeta520Account(code, name)
    ) {
      const mov = monthMovementAmount(debit, credit);
      if (mov > 0.005) {
        financiaciones += mov;
        financiacionesAccounts += 1;
        financiacionesCodes.push(code);
      }
    }
  }

  const ss = ssCredit > 0.005 ? ssCredit : Math.max(0, -ssBalance);
  return {
    start_date,
    end_date,
    ss,
    ssFound,
    nominasNeto: Math.round(nominasCredit * 100) / 100,
    nominasAccounts,
    nominasFound: nominasAccounts > 0 && nominasCredit > 0.005,
    autonomos: Math.round(autonomosDebit * 100) / 100,
    autonomosAccounts,
    autonomosCodes,
    autonomosFound: autonomosAccounts > 0 && autonomosDebit > 0.005,
    financiaciones: Math.round(financiaciones * 100) / 100,
    financiacionesAccounts,
    financiacionesCodes,
    financiacionesFound: financiacionesAccounts > 0 && financiaciones > 0.005
  };
}

/**
 * Aplica sugerencias sobre el estado UI de caja a corto (no persiste).
 * Si un importe es null, no toca esa fila.
 */
export function applyCajaCortoNominasSsSuggestion(cajaCorto, suggestion) {
  const next = {
    ...(cajaCorto || {}),
    pagos: Array.isArray(cajaCorto?.pagos)
      ? cajaCorto.pagos.map((r) => ({ ...r }))
      : [],
    ingresos: Array.isArray(cajaCorto?.ingresos)
      ? cajaCorto.ingresos.map((r) => ({ ...r }))
      : []
  };

  const touchNominas = suggestion?.nominasNeto != null && Number.isFinite(Number(suggestion.nominasNeto));
  const touchSs = suggestion?.segurosSociales != null && Number.isFinite(Number(suggestion.segurosSociales));
  const touchAutonomos = suggestion?.autonomos != null && Number.isFinite(Number(suggestion.autonomos));
  const touchFinanc = suggestion?.financiaciones != null && Number.isFinite(Number(suggestion.financiaciones));

  if (touchNominas) {
    const nominasImp = formatEuroAmount(suggestion.nominasNeto);
    let nominasIdx = next.pagos.findIndex((r) => isNominasConcept(r.concepto));
    if (nominasIdx < 0) {
      next.pagos.unshift({ concepto: 'NOMINAS', importe: '' });
      nominasIdx = 0;
    }
    next.pagos[nominasIdx] = {
      ...next.pagos[nominasIdx],
      concepto: next.pagos[nominasIdx].concepto || 'NOMINAS',
      importe: nominasImp
    };
  }

  if (touchSs) {
    const ssImp = formatEuroAmount(suggestion.segurosSociales);
    let ssIdx = next.pagos.findIndex((r) => isSsConcept(r.concepto));
    if (ssIdx < 0) {
      next.pagos.push({ concepto: 'SEGUROS SOCIALES', importe: '' });
      ssIdx = next.pagos.length - 1;
    }
    next.pagos[ssIdx] = {
      ...next.pagos[ssIdx],
      concepto: next.pagos[ssIdx].concepto || 'SEGUROS SOCIALES',
      importe: ssImp
    };
  }

  if (touchAutonomos) {
    const autoImp = formatEuroAmount(suggestion.autonomos);
    let autoIdx = next.pagos.findIndex((r) => isAutonomosConcept(r.concepto));
    if (autoIdx < 0) {
      next.pagos.push({ concepto: 'AUTONOMOS', importe: '' });
      autoIdx = next.pagos.length - 1;
    }
    next.pagos[autoIdx] = {
      ...next.pagos[autoIdx],
      concepto: next.pagos[autoIdx].concepto || 'AUTONOMOS',
      importe: autoImp
    };
  }

  if (touchFinanc) {
    const finImp = formatEuroAmount(suggestion.financiaciones);
    let finIdx = next.pagos.findIndex((r) => isFinanciacionesConcept(r.concepto));
    if (finIdx < 0) {
      next.pagos.push({ concepto: CAJA_CORTO_FINANCIACIONES_CONCEPTO, importe: '' });
      finIdx = next.pagos.length - 1;
    }
    next.pagos[finIdx] = {
      ...next.pagos[finIdx],
      concepto: next.pagos[finIdx].concepto || CAJA_CORTO_FINANCIACIONES_CONCEPTO,
      importe: finImp
    };
  }

  return next;
}

/**
 * @param {{ year: number, monthIndex?: number, company?: string }} opts
 * year = año del PIG (ej. 2026). Se consulta siempre year-1, mismo mes.
 * monthIndex = mes calendario 0-based (0=ene … 11=dic).
 */
export async function suggestCajaCortoNominasSsFromHolded({
  year,
  monthIndex = null,
  company = 'solucions'
} = {}) {
  const pigYear = Number(year);
  if (!Number.isFinite(pigYear)) {
    return { suggestion: null, error: new Error('Año inválido') };
  }
  if (!Number.isFinite(Number(monthIndex))) {
    return {
      suggestion: null,
      error: new Error('No se pudo determinar el mes de referencia.')
    };
  }

  const ref = resolveCajaCortoPriorYearMonth(pigYear, Number(monthIndex));

  // 1) Contabilidad del mes (465* + 476 + 642 AUTONOMO)
  let acc = null;
  try {
    acc = await loadAccountingCajaCortoForMonth({
      company,
      year: ref.year,
      month: ref.month
    });
  } catch (e) {
    return { suggestion: null, error: e instanceof Error ? e : new Error(String(e)) };
  }

  // 2) Opcional: salary-records (suele existir solo desde 2026)
  let nominasFromRecords = null;
  let availableMonths = [];
  try {
    const records = await holdedApiV2Service.getSalaryRecords({}, company);
    const byMonth = groupSalaryPayableByMonth(records);
    availableMonths = [...byMonth.keys()].sort();
    const bucket = byMonth.get(ref.key);
    if (bucket && bucket.count > 0 && bucket.nominasNeto > 0.005) {
      nominasFromRecords = {
        nominasNeto: Math.round(bucket.nominasNeto * 100) / 100,
        count: bucket.count
      };
    }
  } catch (_) {
    /* contabilidad basta */
  }

  const nominasSource = nominasFromRecords
    ? 'salary_records'
    : acc.nominasFound
      ? 'accounting_465'
      : null;
  const nominasNeto = nominasFromRecords
    ? nominasFromRecords.nominasNeto
    : acc.nominasFound
      ? acc.nominasNeto
      : null;
  const recordsCount = nominasFromRecords
    ? nominasFromRecords.count
    : acc.nominasAccounts || 0;

  const hasSs = Boolean(acc.ssFound && acc.ss > 0.005);
  const hasNominas = nominasNeto != null && nominasNeto > 0.005;
  const hasAutonomos = Boolean(acc.autonomosFound && acc.autonomos > 0.005);
  const hasFinanc = Boolean(acc.financiacionesFound && acc.financiaciones > 0.005);

  if (!hasNominas && !hasSs && !hasAutonomos && !hasFinanc) {
    return {
      suggestion: null,
      error: new Error(
        `No hay datos Holded para ${ref.label}: ni salary-records, ni 465*/476/642 autónomos/170+520. ` +
          (availableMonths.length ? `Salary-records disponibles: ${availableMonths.join(', ')}.` : '')
      )
    };
  }

  const warnings = [];
  if (!hasNominas) {
    warnings.push(`Sin neto (salary-records ni 465*) en ${ref.label}; NÓMINAS no rellenada.`);
  }
  if (!hasSs) {
    warnings.push(`Sin haber en cuenta 476 para ${ref.label}; SEGUROS SOCIALES no rellenado.`);
  }
  if (!hasAutonomos) {
    warnings.push(`Sin gasto 642 «AUTONOMO…» en ${ref.label}; AUTÓNOMOS no rellenado.`);
  }
  if (!hasFinanc) {
    warnings.push(`Sin movimiento en 170*/520* en ${ref.label}; FINANCIACIONES Y TARJETAS no rellenado.`);
  }

  const suggestion = {
    year: ref.year,
    month: ref.month,
    monthKey: ref.key,
    label: ref.label,
    pigYear: ref.pigYear,
    pigMonthLabel: ref.pigMonthLabel,
    matchMode: 'mismo_mes_anyo_anterior',
    nominasSource,
    recordsCount,
    nominasNeto: hasNominas ? nominasNeto : null,
    segurosSociales: hasSs ? Math.round(acc.ss * 100) / 100 : null,
    autonomos: hasAutonomos ? acc.autonomos : null,
    autonomosAccounts: acc.autonomosAccounts || 0,
    autonomosCodes: acc.autonomosCodes || [],
    financiaciones: hasFinanc ? acc.financiaciones : null,
    financiacionesAccounts: acc.financiacionesAccounts || 0,
    financiacionesCodes: acc.financiacionesCodes || [],
    ssAccount: SS_ACCOUNT,
    ssFound: Boolean(acc.ssFound),
    ssRange: `${acc.start_date} → ${acc.end_date}`,
    availableMonths,
    warnings
  };

  return { suggestion, error: null };
}
