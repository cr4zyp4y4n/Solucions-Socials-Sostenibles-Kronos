import holdedApiV2Service from './holdedApiV2Service';
import { previsionesToExcelBlocks } from './pigTesoreriaPrevisionesService';

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
 * Layout Lizeth: Caixa + Fiare + TOTAL + TOTAL - INVES (+ previsiones editables si CR).
 */
export function buildPigTesoreriaSheetAoa({
  title,
  accounts = [],
  errorMessage = '',
  cuentaResultados = false,
  previsiones = null
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
    grandTotalRow: -1,
    totalSinInvesRow: -1,
    saldoCol: 2,
    cuentaResultados: Boolean(cuentaResultados),
    previsionesTables: null,
    rightTables: null
  };

  aoa.push([title, '', '']);
  aoa.push(['', '', '']);

  if (errorMessage) {
    aoa.push([`Error API Holded: ${errorMessage}`, '', '']);
    if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);
    return { aoa, meta };
  }

  if (!accounts.length) {
    aoa.push(['(Cap compte bancari amb IBAN trobat a Holded)', '', '']);
    if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);
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

  const grandTotal = totalCaixa + totalFiare + totalOtros;
  const totalSinInves = grandTotal - innvessSum;

  meta.grandTotalRow = aoa.length;
  meta.totalRows.push(meta.grandTotalRow);
  aoa.push(['TOTAL TESORERÍA', '', grandTotal]);

  meta.totalSinInvesRow = aoa.length;
  meta.totalRows.push(meta.totalSinInvesRow);
  aoa.push(['TOTAL TESORERÍA - INVES', '', totalSinInves]);

  meta.summaryEndRow = aoa.length - 1;

  if (cuentaResultados) appendPrevisionesBelow(aoa, meta, previsiones);

  return { aoa, meta };
}

/** Compat: ja no s'usa (les taules van a sota). */
export function appendTesoreriaCuentaResultadosRightTables(aoa, meta = {}, previsiones = null) {
  appendPrevisionesBelow(aoa, meta, previsiones);
  return meta;
}
