import holdedApiV2Service from './holdedApiV2Service';
import { previsionesToExcelBlocks } from './pigTesoreriaPrevisionesService';
import { cajaCortoToExcelBlock } from './pigTesoreriaCajaCortoService';
import {
  IMPUESTOS_COL,
  IMPUESTOS_MOD_303_ACCOUNTS,
  impuestosQuarterFromMonth,
  loadPigImpuestosBalances
} from './pigTesoreriaImpuestosService';

export { loadPigImpuestosBalances };

const TYPE_ORDER = ['bank', 'card', 'gateway', 'cash'];

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
  const totalSinInvesCached =
    meta.totalSinInvesRow >= 0
      ? Number(aoa[meta.totalSinInvesRow]?.[2]) || 0
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
function appendImpuestosRight(aoa, meta, impuestos = null, { monthIndex } = {}) {
  const col = IMPUESTOS_COL;
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
  const aPagar303 = mod303Sum < 0 ? Math.abs(mod303Sum) : '';
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
 * Layout Lizeth: Caixa + Fiare + TOTAL + TOTAL - INVES - BCREDIT
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
  monthIndex = null
} = {}) {
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
    minCols: 3
  };

  aoa.push([title, '', '']);
  aoa.push(['', '', '']);

  if (errorMessage) {
    aoa.push([`Error API Holded: ${errorMessage}`, '', '']);
    appendImpuestosRight(aoa, meta, impuestos, { monthIndex });
    if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);
    else appendCajaCortoBelow(aoa, meta, cajaCorto);
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
