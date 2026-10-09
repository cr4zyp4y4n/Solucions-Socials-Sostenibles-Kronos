import holdedApiV2Service from './holdedApiV2Service';
import { previsionesToExcelBlocks } from './pigTesoreriaPrevisionesService';
import { cajaCortoToExcelBlock } from './pigTesoreriaCajaCortoService';
import {
  IMPUESTOS_COL,
  IMPUESTOS_MOD_303_ACCOUNTS,
  IMPUESTOS_PREVISION_ROWS,
  impuestosQuarterFromMonth,
  loadPigImpuestosBalances,
  loadPigImpuestosPrevisionFromLedger
} from './pigTesoreriaImpuestosService';
import { creditRowsForPigMonth } from './pigTesoreriaCreditsService';

export { loadPigImpuestosBalances, loadPigImpuestosPrevisionFromLedger };

const TYPE_ORDER = ['bank', 'card', 'gateway', 'cash'];

/**
 * Póliza Fiare: 50.000 € fijos que no están en el saldo de Holded.
 * La fila «Compte general Fiare» muestra el saldo Holded tal cual.
 * La póliza va en su propia fila y no entra en la tesorería disponible.
 */
export const PIG_FIARE_POLIZA_EUR = 50000;

const CRITERI_LLIURE = 'Lliure disponibilitat';
const CRITERI_NO_COMPUTA = 'No computar com a tresoreria real';

/**
 * Tabla 1 PIG Normal — Tresoreria bancària i disponibilitat.
 * Saldos por IBAN (Holded), sin alterar el saldo de la cuenta general Fiare.
 */
const TESORERIA_DISPONIBILITAT_ROWS = [
  {
    id: 'caixa_generals',
    label: '572.0 / 1 / 2 Comptes generals Caixa',
    ibans: [
      'ES3121000601220200501162',
      'ES0821003452172200052489',
      'ES7521003452192200059818'
    ],
    criteri: CRITERI_LLIURE,
    disponible: true
  },
  {
    id: 'bcredit',
    label: '572.3 B-Crèdit (CAIXA)',
    ibans: ['ES2721003452152200066892'],
    criteri: CRITERI_NO_COMPUTA,
    disponible: false
  },
  {
    id: 'fiare',
    label: '572.4 Compte general Fiare',
    ibans: ['ES1615500001230014191720'],
    criteri: CRITERI_LLIURE,
    disponible: true
  },
  {
    id: 'fiare_poliza',
    label: '572.4 Fiare pòlissa',
    fixed: PIG_FIARE_POLIZA_EUR,
    criteri: CRITERI_NO_COMPUTA,
    disponible: false
  },
  {
    id: 'innvess',
    label: '572.5 INNVESS',
    ibans: ['ES6215500001290018321828'],
    criteri: CRITERI_NO_COMPUTA,
    disponible: false
  },
  {
    id: 'singular',
    label: '572.6 Singular / ACOL',
    ibans: ['ES5815500001210018382820'],
    criteri: CRITERI_LLIURE,
    disponible: true
  }
];

function normalizeIban(value) {
  return String(value || '').replace(/\s/g, '').toUpperCase();
}

function treasuryBalanceByIban(accounts = []) {
  const map = new Map();
  for (const account of accounts) {
    const iban = normalizeIban(account?.iban);
    if (!iban) continue;
    map.set(iban, (map.get(iban) || 0) + parseBalance(account.balance));
  }
  return map;
}

/** @deprecated Mantener export por compatibilidad; las tablas van debajo (cols A–C). */
export const TESORERIA_RIGHT_COL = {
  gap: 6,
  label: 0,
  amount: 1,
  obs: 2
};

/** @deprecated Usar previsiones editables (pigTesoreriaPrevisionesService). */
export const TESORERIA_CTA_RESULTADOS_RIGHT = null;

function parseBalance(value) {
  const n = Number.parseFloat(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
}

function ensureAoaWidth(aoa, rowIdx, minCols) {
  while (aoa.length <= rowIdx) aoa.push([]);
  const row = aoa[rowIdx];
  while (row.length < minCols) row.push('');
  return row;
}

function setAoaCell(aoa, rowIdx, colIdx, value) {
  const row = ensureAoaWidth(aoa, rowIdx, colIdx + 1);
  row[colIdx] = value;
}

function spanishIbanEntity(iban) {
  const clean = String(iban || '').replace(/\s/g, '').toUpperCase();
  if (clean.length >= 8 && clean.startsWith('ES')) return clean.slice(4, 8);
  return '';
}

/** Agrupa comptes Holded: Caixa (2100) / Fiare (1550) / altres. */
export function classifyTreasuryBankGroup(account) {
  const name = String(account?.name || '').toUpperCase();
  const entity = spanishIbanEntity(account?.iban);
  if (entity === '1550' || /\bFIARE\b/.test(name)) return 'fiare';
  if (entity === '2100' || /CAIXA|CAIXABANK/.test(name)) return 'caixa';
  return 'otros';
}

export function isInnvessTreasuryAccount(account) {
  const name = String(account?.name || '').toUpperCase();
  return /INNVESS|INVESS/.test(name);
}

/** Cuenta Caixa BCREDIT (línea / no disponible operativamente). */
export function isBcreditTreasuryAccount(account) {
  const name = String(account?.name || '').toUpperCase();
  return /\bBCREDIT\b/.test(name);
}

function sortTreasuryAccounts(accounts = []) {
  return [...accounts].sort((a, b) => {
    const ta = TYPE_ORDER.indexOf(String(a?.type || ''));
    const tb = TYPE_ORDER.indexOf(String(b?.type || ''));
    const oa = ta >= 0 ? ta : TYPE_ORDER.length;
    const ob = tb >= 0 ? tb : TYPE_ORDER.length;
    if (oa !== ob) return oa - ob;
    return String(a?.name || '').localeCompare(String(b?.name || ''), 'ca');
  });
}

/** Només comptes amb IBAN (comptes bancaris reals). */
export function isTreasuryAccountWithIban(account) {
  return Boolean(String(account?.iban || '').trim());
}

export async function loadPigTreasuryAccounts({ company = 'solucions' } = {}) {
  try {
    const raw = await holdedApiV2Service.getTreasuryAccounts({ archived: false }, company);
    const accounts = sortTreasuryAccounts(
      (raw || []).filter((item) => item && item.archived !== true && isTreasuryAccountWithIban(item))
    );
    return { accounts, error: null };
  } catch (error) {
    return { accounts: [], error };
  }
}

function appendBankTable(aoa, meta, { accounts, totalLabel, groupKey }) {
  const headerRow = aoa.length;
  aoa.push(['Compte', 'IBAN', 'Saldo']);
  const dataStart = aoa.length;
  let total = 0;
  for (const account of accounts) {
    const balance = parseBalance(account.balance);
    total += balance;
    const rowIdx = aoa.length;
    aoa.push([
      account.name || '(Sense nom)',
      String(account.iban || '').replace(/\s/g, ''),
      balance
    ]);
    if (isInnvessTreasuryAccount(account)) {
      meta.innvessDataRows.push(rowIdx);
    }
    if (isBcreditTreasuryAccount(account)) {
      meta.bcreditDataRows.push(rowIdx);
    }
  }
  const dataEnd = aoa.length - 1;
  const totalRow = aoa.length;
  aoa.push([totalLabel, '', total]);

  meta.bankGroups.push({
    key: groupKey,
    headerRow,
    dataStartRow: dataStart,
    dataEndRow: dataEnd >= dataStart ? dataEnd : dataStart - 1,
    totalRow,
    totalLabel
  });
  meta.totalRows.push(totalRow);
  return total;
}

function appendPrevisionesBelow(aoa, meta, previsiones) {
  const blocks = previsionesToExcelBlocks(previsiones);
  const tables = [];

  aoa.push(['', '', '']);
  let r = aoa.length;

  const writeBlock = (block, kind) => {
    const titleRow = r;
    setAoaCell(aoa, r, 0, block.title);
    setAoaCell(aoa, r, 1, block.amountHeader);
    setAoaCell(aoa, r, 2, block.obsHeader);
    r += 1;

    const dataStartRow = r;
    for (const row of block.rows) {
      setAoaCell(aoa, r, 0, row.concepto);
      setAoaCell(aoa, r, 1, row.amount == null ? '' : row.amount);
      setAoaCell(aoa, r, 2, row.observacion || '');
      r += 1;
    }
    const dataEndRow = r - 1;
    const totalRow = r;
    setAoaCell(aoa, r, 0, block.totalLabel);
    setAoaCell(aoa, r, 1, block.total);
    setAoaCell(aoa, r, 2, block.totalObs || '');
    r += 1;

    tables.push({
      kind,
      titleRow,
      dataStartRow,
      dataEndRow: dataEndRow >= dataStartRow ? dataEndRow : dataStartRow - 1,
      totalRow,
      amountCol: 1,
      obsCol: 2,
      obsStartRow: titleRow,
      obsEndRow: totalRow,
      obsHeaderRows: [titleRow]
    });
  };

  writeBlock(blocks.ingresosPorSubv, 'ingresos');
  r += 2;
  while (aoa.length < r) aoa.push(['', '', '']);
  writeBlock(blocks.porAprobar, 'porAprobar');

  meta.previsionesTables = {
    startRow: tables[0]?.titleRow ?? 0,
    endRow: tables[tables.length - 1]?.totalRow ?? 0,
    tables,
    minCols: 3
  };
  // Compat amb estils/fórmules antics
  meta.rightTables = meta.previsionesTables;
}

/**
 * Bloque editable PIG Normal (no CR): previsión pagos + ingresos + total caja a corto.
 * Importes en col B (como en el Excel de Lizeth).
 */
function appendCajaCortoBelow(aoa, meta, cajaCorto) {
  const block = cajaCortoToExcelBlock(cajaCorto);
  const amountCol = 1;

  aoa.push(['', '', '']);
  aoa.push(['', '', '']);
  let r = aoa.length;

  const titlePagosRow = r;
  setAoaCell(aoa, r, 0, block.tituloPagos);
  setAoaCell(aoa, r, 1, '');
  setAoaCell(aoa, r, 2, '');
  r += 1;

  const pagosDataStart = r;
  for (const row of block.pagosRows) {
    setAoaCell(aoa, r, 0, row.concepto);
    setAoaCell(aoa, r, amountCol, row.amount == null ? '' : row.amount);
    setAoaCell(aoa, r, 2, '');
    r += 1;
  }
  const pagosDataEnd = r - 1;
  const pagosTotalRow = r;
  setAoaCell(aoa, r, 0, 'TOTAL');
  setAoaCell(aoa, r, amountCol, block.totalPagos);
  setAoaCell(aoa, r, 2, '');
  r += 1;

  r += 1;
  while (aoa.length < r) aoa.push(['', '', '']);

  const titleIngresosRow = r;
  setAoaCell(aoa, r, 0, block.tituloIngresos);
  setAoaCell(aoa, r, 1, '');
  setAoaCell(aoa, r, 2, '');
  r += 1;

  const ingresosDataStart = r;
  for (const row of block.ingresosRows) {
    setAoaCell(aoa, r, 0, row.concepto);
    setAoaCell(aoa, r, amountCol, row.amount == null ? '' : row.amount);
    setAoaCell(aoa, r, 2, '');
    r += 1;
  }
  const ingresosDataEnd = r - 1;

  r += 1;
  while (aoa.length < r) aoa.push(['', '', '']);

  const totalFinalRow = r;
  const saldoCol = Number.isFinite(meta.saldoCol) ? meta.saldoCol : 2;
  const totalSinInvesCached =
    meta.totalSinInvesRow >= 0
      ? Number(aoa[meta.totalSinInvesRow]?.[saldoCol]) || 0
      : 0;
  const totalFinalCached = totalSinInvesCached - block.totalPagos + block.totalIngresos;
  setAoaCell(aoa, r, 0, block.totalLabel);
  setAoaCell(aoa, r, amountCol, totalFinalCached);
  setAoaCell(aoa, r, 2, '');

  meta.cajaCorto = {
    titlePagosRow,
    pagosDataStartRow: pagosDataStart,
    pagosDataEndRow: pagosDataEnd >= pagosDataStart ? pagosDataEnd : pagosDataStart - 1,
    pagosTotalRow,
    titleIngresosRow,
    ingresosDataStartRow: ingresosDataStart,
    ingresosDataEndRow: ingresosDataEnd >= ingresosDataStart ? ingresosDataEnd : ingresosDataStart - 1,
    totalFinalRow,
    amountCol,
    merges: [
      { s: { r: titlePagosRow, c: 0 }, e: { r: titlePagosRow, c: 1 } },
      { s: { r: titleIngresosRow, c: 0 }, e: { r: titleIngresosRow, c: 1 } },
      { s: { r: totalFinalRow, c: 0 }, e: { r: totalFinalRow, c: 0 } }
    ]
  };
}

/**
 * Tabla IMPUESTOS a la derecha (cols E–H), alineada arriba como en el Excel de Lizeth.
 * MOD 303: suma en G; si el resultado es negativo → A PAGAR (H) y entra en el total.
 */
function appendImpuestosRight(aoa, meta, impuestos = null, { monthIndex, startCode } = {}) {
  const origin = Number.isFinite(startCode) ? startCode : IMPUESTOS_COL.code;
  const delta = origin - IMPUESTOS_COL.code;
  const col = {
    code: IMPUESTOS_COL.code + delta,
    desc: IMPUESTOS_COL.desc + delta,
    saldo: IMPUESTOS_COL.saldo + delta,
    aPagar: IMPUESTOS_COL.aPagar + delta
  };
  const quarter = impuestosQuarterFromMonth(monthIndex);
  const mod303Rows = impuestos?.mod303?.length
    ? impuestos.mod303
    : IMPUESTOS_MOD_303_ACCOUNTS.map((r) => ({ ...r, balance: 0 }));
  const aPagarByCode = impuestos?.aPagarByCode || {};

  const titleRow = 0;
  const headerRow = 1;
  setAoaCell(aoa, titleRow, col.code, 'IMPUESTOS');
  setAoaCell(aoa, headerRow, col.aPagar, 'A PAGAR');

  let r = 2;
  const mod303SaldoRows = [];
  for (const row of mod303Rows) {
    setAoaCell(aoa, r, col.code, row.code);
    setAoaCell(aoa, r, col.desc, row.description);
    setAoaCell(aoa, r, col.saldo, Number(row.balance) || 0);
    mod303SaldoRows.push(r);
    r += 1;
  }

  const mod303ResultRow = r;
  const mod303Sum =
    impuestos?.mod303Sum != null
      ? Number(impuestos.mod303Sum) || 0
      : mod303Rows.reduce((acc, row) => acc + (Number(row.balance) || 0), 0);
  setAoaCell(aoa, mod303ResultRow, col.code, 'MOD 303');
  setAoaCell(aoa, mod303ResultRow, col.saldo, mod303Sum);
  // Si G (resultado 303) es negativo → reflejar en H (A PAGAR) para el total
  const aPagar303 = mod303Sum < 0 ? mod303Sum : '';
  setAoaCell(aoa, mod303ResultRow, col.aPagar, aPagar303);
  r += 2;

  const mod111HeaderRow = r;
  setAoaCell(aoa, r, col.code, 'MOD 111');
  setAoaCell(aoa, r, col.desc, 'Impuesto de Renta Personas Físicas Trabajadores y profesionales');
  r += 1;

  const aPagarDataRows = [];
  const irpfTrabRow = r;
  setAoaCell(aoa, r, col.code, '47510000');
  setAoaCell(aoa, r, col.desc, 'IRPF TRABAJADORES');
  setAoaCell(aoa, r, col.aPagar, Number(aPagarByCode['47510000']) || 0);
  aPagarDataRows.push(r);
  r += 1;

  const irpfProfRow = r;
  setAoaCell(aoa, r, col.code, '47510001');
  setAoaCell(aoa, r, col.desc, 'IRPF PROFESIONALES');
  setAoaCell(aoa, r, col.aPagar, Number(aPagarByCode['47510001']) || 0);
  aPagarDataRows.push(r);
  r += 2;

  const mod115HeaderRow = r;
  setAoaCell(aoa, r, col.code, 'MOD 115');
  setAoaCell(aoa, r, col.desc, 'Impuesto arrendamientos');
  r += 1;

  const irpfAlqRow = r;
  setAoaCell(aoa, r, col.code, '47510020');
  setAoaCell(aoa, r, col.desc, 'IRPF ALQUILER');
  setAoaCell(aoa, r, col.aPagar, Number(aPagarByCode['47510020']) || 0);
  aPagarDataRows.push(r);
  r += 2;

  const mod202HeaderRow = r;
  setAoaCell(aoa, r, col.code, 'MOD 202');
  setAoaCell(aoa, r, col.desc, 'Impuesto sobre sociedades - Fraccionado');
  r += 1;

  const totalRow = r;
  const aPagarValues = [
    aPagar303 === '' ? 0 : Number(aPagar303) || 0,
    Number(aPagarByCode['47510000']) || 0,
    Number(aPagarByCode['47510001']) || 0,
    Number(aPagarByCode['47510020']) || 0
  ];
  const totalAPagar = aPagarValues.reduce((acc, n) => acc + n, 0);
  setAoaCell(aoa, totalRow, col.code, `TOTAL PAGO IMPUESTOS ${quarter}T TRIMESTRE`);
  setAoaCell(aoa, totalRow, col.aPagar, totalAPagar);

  meta.impuestos = {
    titleRow,
    headerRow,
    startCol: col.code,
    endCol: col.aPagar,
    codeCol: col.code,
    descCol: col.desc,
    saldoCol: col.saldo,
    aPagarCol: col.aPagar,
    mod303SaldoStartRow: mod303SaldoRows[0] ?? 2,
    mod303SaldoEndRow: mod303SaldoRows[mod303SaldoRows.length - 1] ?? 5,
    mod303ResultRow,
    mod111HeaderRow,
    mod115HeaderRow,
    mod202HeaderRow,
    irpfTrabRow,
    irpfProfRow,
    irpfAlqRow,
    aPagarDataRows,
    totalRow,
    endRow: totalRow,
    quarter
  };
  meta.minCols = Math.max(meta.minCols || 3, col.aPagar + 1);
}

/**
 * PIG Normal: tabla «Tresoreria bancària i disponibilitat».
 * Col B = saldo, col C = criteri. El total solo suma filas de lliure disponibilitat.
 * Compte general Fiare = saldo Holded. La pòlissa (50.000 €) es una fila aparte y no suma.
 */
function appendDisponibilitatTable(aoa, meta, accounts = []) {
  const byIban = treasuryBalanceByIban(accounts);
  const saldoCol = 1;
  const titleRow = aoa.length;
  aoa.push(['Tresoreria bancària i disponibilitat', '', '']);
  const headerRow = aoa.length;
  aoa.push(['CTA BANCARI', 'SALDO', 'CRITERI']);

  const lliureRows = [];
  const noComputaRows = [];
  const missing = [];
  let disponible = 0;

  for (const spec of TESORERIA_DISPONIBILITAT_ROWS) {
    let amount = 0;
    let criteri = spec.criteri;
    if (spec.fixed != null) {
      amount = spec.fixed;
    } else {
      const ibans = (spec.ibans || []).map(normalizeIban);
      const found = ibans.filter((iban) => byIban.has(iban));
      amount = found.reduce((acc, iban) => acc + byIban.get(iban), 0);
      if (found.length < ibans.length) {
        missing.push(spec.label);
        criteri = found.length ? `${spec.criteri} (falta algun IBAN a Holded)` : 'No trobada a Holded';
      }
    }
    const rowIdx = aoa.length;
    aoa.push([spec.label, amount, criteri]);
    if (spec.disponible) {
      lliureRows.push(rowIdx);
      disponible += amount;
    } else {
      noComputaRows.push(rowIdx);
    }
  }

  const totalRow = aoa.length;
  aoa.push(["Tresoreria disponible abans d'obligacions", disponible, '']);

  meta.saldoCol = saldoCol;
  meta.disponibilitat = {
    titleRow,
    headerRow,
    lliureRows,
    noComputaRows,
    totalRow,
    saldoCol,
    missing
  };
  meta.totalSinInvesRow = totalRow;
  meta.totalRows.push(totalRow);
  meta.summaryStartRow = titleRow;
  meta.summaryEndRow = totalRow;
  meta.minCols = Math.max(meta.minCols || 3, 3);
}

/** PIG Normal: Crèdits i Finançament. Cada mes surt de la llista de quotes guardada. */
function appendCreditsTable(aoa, meta, creditRows = []) {
  const startCol = 4;
  const titleRow = meta.disponibilitat?.titleRow ?? 2;
  const headerRow = titleRow + 1;
  const headers = ['Finançament', 'Capital pendent / límit', 'Quota pròxima', 'Venciment', 'Observacions'];
  const rows = creditRows.length
    ? creditRows
    : [
      { label: 'ICO Idoni / Fiare' },
      { label: 'Furgoneta BBVA' },
      { label: 'B-Crèdit' },
      { label: 'Pòlissa Fiare' }
    ];

  setAoaCell(aoa, titleRow, startCol, 'Crèdits i Finançament');
  headers.forEach((header, i) => setAoaCell(aoa, headerRow, startCol + i, header));
  rows.forEach((row, i) => {
    const r = headerRow + 1 + i;
    setAoaCell(aoa, r, startCol, row.label || '');
    setAoaCell(aoa, r, startCol + 1, row.capital == null || row.capital === '' ? '' : row.capital);
    setAoaCell(aoa, r, startCol + 2, row.quota == null || row.quota === '' ? '' : row.quota);
    setAoaCell(aoa, r, startCol + 3, row.venciment || '');
    setAoaCell(aoa, r, startCol + 4, row.obs || '');
  });

  meta.credits = {
    titleRow,
    headerRow,
    dataStartRow: headerRow + 1,
    dataEndRow: headerRow + rows.length,
    startCol,
    endCol: startCol + headers.length - 1,
    quotaCol: startCol + 2
  };
  meta.minCols = Math.max(meta.minCols || 3, startCol + headers.length);
}

/**
 * PIG Normal: previsió fiscal, a la derecha de les obligacions i sota els crèdits.
 * El 202 es deixa en blanc. Els imports són deu − haver acumulat del llibre diari.
 */
function appendImpuestosPrevisionTable(aoa, meta, prevision = null) {
  const startCol = 4;
  const creditsEnd = meta.credits?.dataEndRow;
  const anchor = creditsEnd != null ? creditsEnd : (meta.disponibilitat?.totalRow ?? 2);
  const titleRow = anchor + 2;
  const headerRow = titleRow + 1;
  const headers = [
    'Impost / concepte',
    'Període',
    prevision?.monthHeaders?.[0] || 'Mes 1 acumulat',
    prevision?.monthHeaders?.[1] || 'Mes 2 acumulat',
    prevision?.monthHeaders?.[2] || 'Mes 3 / tancament',
    'Total estimat',
    'Data pagament',
    'Criteri'
  ];
  const sourceRows = prevision?.rows?.length
    ? prevision.rows
    : IMPUESTOS_PREVISION_ROWS.map((row) => ({
      key: row.key,
      label: row.label,
      criteri: row.criteri,
      periode: '',
      months: [null, null, null],
      total: null,
      blank: true
    }));

  setAoaCell(aoa, titleRow, startCol, 'Previsió fiscal');
  headers.forEach((header, index) => setAoaCell(aoa, headerRow, startCol + index, header));

  const monthCols = [startCol + 2, startCol + 3, startCol + 4];
  const totalCol = startCol + 5;
  const modelRows = [];
  sourceRows.forEach((row, index) => {
    const r = headerRow + 1 + index;
    const filledMonths = (row.months || []).map((value, monthIndex) => (
      value == null || value === '' ? null : Number(value) || 0
    ));
    let lastAmountCol = null;
    filledMonths.forEach((value, monthIndex) => {
      if (value == null) return;
      lastAmountCol = monthCols[monthIndex];
    });
    setAoaCell(aoa, r, startCol, row.label || '');
    setAoaCell(aoa, r, startCol + 1, row.periode || '');
    filledMonths.forEach((value, monthIndex) => {
      setAoaCell(aoa, r, monthCols[monthIndex], value == null ? '' : value);
    });
    setAoaCell(aoa, r, totalCol, row.blank ? '' : (row.total ?? ''));
    setAoaCell(aoa, r, startCol + 6, '');
    setAoaCell(aoa, r, startCol + 7, row.criteri || '');
    modelRows.push({
      row: r,
      key: row.key,
      blank: Boolean(row.blank),
      lastAmountCol,
      totalCached: row.blank ? null : (Number(row.total) || 0)
    });
  });

  const totalRow = headerRow + 1 + sourceRows.length;
  const totalCached = sourceRows.reduce((acc, row) => acc + (row.blank ? 0 : Number(row.total) || 0), 0);
  setAoaCell(aoa, totalRow, startCol, 'Suma dels models');
  setAoaCell(aoa, totalRow, totalCol, sourceRows.some((row) => !row.blank) ? totalCached : '');
  setAoaCell(aoa, totalRow, startCol + 7, "Suma dels totals. No és l'import de la tresoreria neta: l'IVA a favor no es resta.");

  meta.impuestosPrevision = {
    titleRow,
    headerRow,
    startCol,
    endCol: startCol + headers.length - 1,
    totalCol,
    monthCols,
    modelRows,
    totalRow,
    totalCached: sourceRows.some((row) => !row.blank) ? totalCached : null
  };
  meta.minCols = Math.max(meta.minCols || 3, startCol + headers.length);
}

/**
 * PIG Normal: Obligacions del mes i pagaments imminents (4 columnes).
 * Les dues últimes files queden buides.
 */
function appendObligacionsTable(aoa, meta, obligacions = null) {
  aoa.push(['', '', '', '']);
  const titleRow = aoa.length;
  aoa.push(['Obligacions del mes i pagaments imminents', '', '', '']);
  const headerRow = aoa.length;
  aoa.push(['Concepte', 'Import', 'Data prevista', 'Observacions / detall']);

  const rows = [
    {
      concepte: obligacions?.nominasLabel || 'Nòmines del mes',
      import: obligacions?.nominas ?? '',
      data: '',
      obs: obligacions?.nominasObs || ''
    },
    {
      concepte: obligacions?.ssLabel || 'TGSS meritada del mes',
      import: obligacions?.ss ?? '',
      data: '',
      obs: obligacions?.ssObs || ''
    },
    {
      concepte: 'Proveïdors pendents',
      import: obligacions?.proveidors ?? '',
      data: '',
      obs: obligacions?.proveidorsObs || ''
    },
    {
      concepte: "Menjar d'Hort",
      import: obligacions?.menjar ?? '',
      data: '',
      obs: obligacions?.menjarObs || ''
    },
    {
      concepte: 'Previsió altres pagaments propers',
      import: '',
      data: '',
      obs: ''
    },
    {
      concepte: 'Altres obligacions immediates',
      import: '',
      data: '',
      obs: ''
    }
  ];

  const dataStartRow = aoa.length;
  for (const row of rows) {
    aoa.push([row.concepte, row.import, row.data, row.obs]);
  }
  const dataEndRow = aoa.length - 1;

  meta.obligacions = {
    titleRow,
    headerRow,
    dataStartRow,
    dataEndRow,
    amountCol: 1,
    nominasRow: dataStartRow,
    ssRow: dataStartRow + 1,
    proveidorsRow: dataStartRow + 2,
    altresPagamentsRow: dataStartRow + 4,
    altresObligacionsRow: dataStartRow + 5
  };
  meta.minCols = Math.max(meta.minCols || 3, 4);
}

/**
 * PIG Normal: tresoreria neta = disponible menys les obligacions ja calculades.
 * Menjar d'Hort no es resta: ja és dins de proveïdors.
 * L'IVA a favor (positiu) no es resta; només la part exigible.
 */
function appendNetaTable(aoa, meta) {
  const disp = meta.disponibilitat;
  const obl = meta.obligacions;
  if (!disp || !obl) return;

  aoa.push(['', '']);
  aoa.push(['', '']);
  const titleRow = aoa.length;
  aoa.push(['Tresoreria neta real', '']);
  const headerRow = aoa.length;
  aoa.push(['Càlcul', 'Import']);

  const labels = [
    "Tresoreria disponible abans d'obligacions",
    '(-) Nòmines pendents / no carregades',
    '(-) TGSS meritada del mes analitzat',
    '(-) Proveïdors i pagaments imminents',
    '(-) Quotes de crèdit exigibles a curt termini',
    '(-) Previsió fiscal acumulada / exigible',
    '(-) Altres obligacions immediates'
  ];
  const dataStartRow = aoa.length;
  for (const label of labels) aoa.push([label, '']);
  const totalRow = aoa.length;
  aoa.push(['TRESORERIA NETA REAL', '']);

  meta.neta = {
    titleRow,
    headerRow,
    disponibleRow: dataStartRow,
    nominasRow: dataStartRow + 1,
    ssRow: dataStartRow + 2,
    proveidorsRow: dataStartRow + 3,
    quotesRow: dataStartRow + 4,
    fiscalRow: dataStartRow + 5,
    altresRow: dataStartRow + 6,
    totalRow,
    labelCol: 0,
    amountCol: 1
  };
}

/**
 * Layout Lizeth (CR): Caixa + Fiare + TOTAL + TOTAL - INVES - BCREDIT.
 * PIG Normal: tabla de disponibilitat. Fiare general = saldo Holded; póliza = 50.000 € aparte.
 * + previsiones subv (solo CR) | caja a corto editable (solo PIG Normal)
 * + IMPUESTOS a la derecha (cols E–H).
 */
export function buildPigTesoreriaSheetAoa({
  title,
  accounts = [],
  errorMessage = '',
  cuentaResultados = false,
  previsiones = null,
  cajaCorto = null,
  impuestos = null,
  impuestosPrevision = null,
  monthIndex = null,
  obligacions = null,
  creditsYear = null,
  creditsMonthIndex = null
} = {}) {
  const creditRows = creditRowsForPigMonth(
    creditsYear ?? new Date().getFullYear(),
    creditsMonthIndex ?? new Date().getMonth()
  );
  const aoa = [];
  const meta = {
    titleRow: 0,
    summaryStartRow: 2,
    summaryEndRow: -1,
    detailHeaderRow: -1,
    detailDataStartRow: -1,
    detailDataEndRow: -1,
    bankGroups: [],
    totalRows: [],
    innvessDataRows: [],
    bcreditDataRows: [],
    grandTotalRow: -1,
    totalSinInvesRow: -1,
    saldoCol: 2,
    cuentaResultados: Boolean(cuentaResultados),
    previsionesTables: null,
    rightTables: null,
    cajaCorto: null,
    impuestos: null,
    impuestosPrevision: null,
    minCols: 3
  };

  aoa.push([title, '', '']);
  aoa.push(['', '', '']);

  if (errorMessage) {
    aoa.push([`Error API Holded: ${errorMessage}`, '', '']);
    if (!cuentaResultados) {
      appendDisponibilitatTable(aoa, meta, []);
      appendCreditsTable(aoa, meta, creditRows);
      appendObligacionsTable(aoa, meta, obligacions);
      aoa.push(['', '', '']);
      appendImpuestosPrevisionTable(aoa, meta, impuestosPrevision);
    }
    if (cuentaResultados) {
      appendImpuestosRight(aoa, meta, impuestos, { monthIndex });
    }
    if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);
    else appendNetaTable(aoa, meta);
    return { aoa, meta };
  }

  if (!accounts.length && cuentaResultados) {
    aoa.push(['(Cap compte bancari amb IBAN trobat a Holded)', '', '']);
    appendImpuestosRight(aoa, meta, impuestos, { monthIndex });
    appendPrevisionesBelow(aoa, meta, previsiones);
    return { aoa, meta };
  }

  if (!cuentaResultados) {
    appendDisponibilitatTable(aoa, meta, accounts);
    appendCreditsTable(aoa, meta, creditRows);
    appendObligacionsTable(aoa, meta, obligacions);
    aoa.push(['', '', '']);
    appendImpuestosPrevisionTable(aoa, meta, impuestosPrevision);
    appendNetaTable(aoa, meta);
    return { aoa, meta };
  }

  if (!accounts.length) {
    aoa.push(['(Cap compte bancari amb IBAN trobat a Holded)', '', '']);
    appendImpuestosRight(aoa, meta, impuestos, { monthIndex });
    if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);
    else appendCajaCortoBelow(aoa, meta, cajaCorto);
    return { aoa, meta };
  }

  const caixa = [];
  const fiare = [];
  const otros = [];
  for (const account of accounts) {
    const g = classifyTreasuryBankGroup(account);
    if (g === 'fiare') fiare.push(account);
    else if (g === 'caixa') caixa.push(account);
    else otros.push(account);
  }

  meta.summaryStartRow = aoa.length;
  let totalCaixa = 0;
  let totalFiare = 0;
  let totalOtros = 0;

  if (caixa.length) {
    totalCaixa = appendBankTable(aoa, meta, {
      accounts: caixa,
      totalLabel: 'TOTAL TESORERÍA CAIXA',
      groupKey: 'caixa'
    });
    aoa.push(['', '', '']);
  }

  if (fiare.length) {
    totalFiare = appendBankTable(aoa, meta, {
      accounts: fiare,
      totalLabel: 'TOTAL TESORERÍA FIARE',
      groupKey: 'fiare'
    });
    aoa.push(['', '', '']);
  }

  if (otros.length) {
    totalOtros = appendBankTable(aoa, meta, {
      accounts: otros,
      totalLabel: 'TOTAL TESORERÍA ALTRES',
      groupKey: 'otros'
    });
    aoa.push(['', '', '']);
  }

  // Rangs de detall per fórmules (totes les files de comptes)
  const allDataStarts = meta.bankGroups.map((g) => g.dataStartRow).filter((n) => n >= 0);
  const allDataEnds = meta.bankGroups.map((g) => g.dataEndRow).filter((n) => n >= 0);
  if (allDataStarts.length) {
    meta.detailDataStartRow = Math.min(...allDataStarts);
    meta.detailDataEndRow = Math.max(...allDataEnds);
    meta.detailHeaderRow = meta.bankGroups[0]?.headerRow ?? -1;
  }

  const innvessSum = accounts
    .filter(isInnvessTreasuryAccount)
    .reduce((acc, a) => acc + parseBalance(a.balance), 0);
  const bcreditSum = accounts
    .filter(isBcreditTreasuryAccount)
    .reduce((acc, a) => acc + parseBalance(a.balance), 0);

  const grandTotal = totalCaixa + totalFiare + totalOtros;
  const totalSinInvesBcredit = grandTotal - innvessSum - bcreditSum;

  meta.grandTotalRow = aoa.length;
  meta.totalRows.push(meta.grandTotalRow);
  aoa.push(['TOTAL TESORERÍA', '', grandTotal]);

  meta.totalSinInvesRow = aoa.length;
  meta.totalRows.push(meta.totalSinInvesRow);
  aoa.push(['TOTAL TESORERÍA - INVES - BCREDIT', '', totalSinInvesBcredit]);

  meta.summaryEndRow = aoa.length - 1;

  appendImpuestosRight(aoa, meta, impuestos, { monthIndex });
  if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);
  else appendCajaCortoBelow(aoa, meta, cajaCorto);

  return { aoa, meta };
}

/** Compat: ja no s'usa (les taules van a sota). */
export function appendTesoreriaCuentaResultadosRightTables(aoa, meta = {}, previsiones = null) {
  appendPrevisionesBelow(aoa, meta, previsiones);
  return meta;
}
