import holdedApiV2Service from './holdedApiV2Service';

const TYPE_ORDER = ['bank', 'card', 'gateway', 'cash'];

/** Columnas a la derecha del bloque Holded (A–F): G vacío, H–J tablas hardcodeadas. */
export const TESORERIA_RIGHT_COL = {
  gap: 6,
  label: 7,
  amount: 8,
  obs: 9
};

/** Previsiones hardcodeadas (EISSS Cuenta Resultados) — valores Lizeth. */
export const TESORERIA_CTA_RESULTADOS_RIGHT = {
  ingresosPorSubv: {
    title: 'PREVISIÓN DE TESORERIA - INGRESOS POR SUBV',
    amountHeader: 'INGRESO PREVISTO',
    totalLabel: 'TOTAL SUBVENCIONES POR COBRAR',
    total: 69647.1,
    rows: [
      { label: 'E.I L2 01/09/25 - 31/12/25', amount: 15613.27 },
      { label: 'ACOL 11/2023 - 12/2024', amount: 25017.03 },
      { label: 'E.I L1 01/07/24 - 30/06/25', amount: 4200 },
      { label: 'E.I L2 01/09/23 - 30/09/24', amount: 1706.29 },
      { label: 'INVES (INVERSIÓN) 10/12/25 - 09/12/2026', amount: 19750 },
      { label: 'E.I L1 01/07/25 - 31/12/25', amount: 3360.51 }
    ],
    obsBlocks: [
      {
        kind: 'header',
        text: 'OBSERVACION DE SUBVENCIONES IMPUTADAS'
      },
      {
        kind: 'note',
        text: 'IMPULSEM 10.000 A IDONI 10 MESES, SE IMPUTA DE 01/01 AL 01/10 DE 2026'
      },
      {
        kind: 'note',
        text: 'E.I L2 KOIKI Y ESTRUCTURA PERIODO (01/04/25 A 31/08/25) EN 12 MESES DE 2.026'
      },
      {
        kind: 'header',
        text: 'OBSERVACION DE SUBVENCIONES QUE FALTA DINERO POR INGRESAR E IMPUTAR'
      },
      {
        kind: 'note',
        text: 'A espera de que acepten a David puede ser 1.300 aproximadamente adicional'
      },
      {
        kind: 'note',
        text: 'A LA ESPERA DE INGRESO YA SE ENVIO REQUERIMIENTO'
      },
      {
        kind: 'note',
        text: 'SOLICITARON REQUERIMIENTO (SE ENCUENTRA EN REVISIÓN)'
      },
      {
        kind: 'note',
        text: 'REQUERIMIENTO ENVIADO'
      }
    ]
  },
  porAprobar: {
    title: 'PREVISIÓN DE SUBV. POR APROBAR',
    amountHeader: 'INGRESO PREVISTO',
    totalLabel: 'TOTAL PREV. SUBVENCIONES POR APROBAR',
    total: 172703.88,
    rows: [
      {
        label: 'E.I L1 ESTRUCTURALES 01/01/26 - 31/12/26',
        amount: 33610.44,
        obs: 'RESOLUCIÓN PROVISIONAL POR ESTE IMPORTE, FALTA RESOLUCIÓN FINAL'
      },
      {
        label: 'ENFORTIM APROVADO ESPERA RESOLUCION FINAL 14/12/26 - 13/12/27',
        amount: 6300,
        obs: ''
      },
      {
        label: 'CAMBIO CLIMATICO 14/12/2026 AL 31/03/2028',
        amount: 80000,
        obs: 'RESOLUCIÓN PROVISIONAL POR ESTE IMPORTE, SE DEBE ENVIAR REFORMULACIÓN'
      },
      {
        label: 'IMPULSEM 2.026 - 2.027',
        amount: null,
        obs: 'POSTULACIÓN (NO TENEMOS AUN RESOLUCIÓN PROVISIONAL)'
      },
      {
        label: 'E.I L2 ESTRUCTURAL 01/01/26 al 31/12/26',
        amount: 52793.44,
        obs: 'BRUNO DEBE POSTULARSE'
      },
      {
        label: 'SINGULAR 26/27',
        amount: null,
        obs: ''
      }
    ],
    obsHeader: 'OBSERVACION DE SUBVENCIONES QUE FALTA DINERO POR INGRESAR E IMPUTAR'
  }
};

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

/**
 * Tablas hardcodeadas a la derecha (Cuenta Resultados).
 * Meta.rightTables: rangos para estilos.
 */
export function appendTesoreriaCuentaResultadosRightTables(aoa, meta = {}) {
  const { label: cLabel, amount: cAmount, obs: cObs } = TESORERIA_RIGHT_COL;
  const minCols = cObs + 1;
  const data = TESORERIA_CTA_RESULTADOS_RIGHT;
  const startRow = meta.summaryStartRow ?? 2;
  const rightMeta = {
    startRow,
    tables: []
  };

  // —— Tabla 1: ingresos por subv ——
  let r = startRow;
  const t1 = data.ingresosPorSubv;
  const t1Meta = {
    titleRow: r,
    dataStartRow: r + 1,
    dataEndRow: -1,
    totalRow: -1,
    obsStartRow: r,
    obsEndRow: -1,
    obsHeaderRows: [],
    kind: 'ingresos'
  };

  setAoaCell(aoa, r, cLabel, t1.title);
  setAoaCell(aoa, r, cAmount, t1.amountHeader);
  r += 1;

  t1Meta.dataStartRow = r;
  for (const row of t1.rows) {
    setAoaCell(aoa, r, cLabel, row.label);
    setAoaCell(aoa, r, cAmount, row.amount);
    r += 1;
  }
  t1Meta.dataEndRow = r - 1;

  t1Meta.totalRow = r;
  setAoaCell(aoa, r, cLabel, t1.totalLabel);
  setAoaCell(aoa, r, cAmount, t1.total);
  r += 1;

  // Observaciones tabla 1 (columna obs, desde la misma fila de título)
  let obsR = t1Meta.obsStartRow;
  for (const block of t1.obsBlocks) {
    setAoaCell(aoa, obsR, cObs, block.text);
    if (block.kind === 'header') t1Meta.obsHeaderRows.push(obsR);
    obsR += 1;
  }
  t1Meta.obsEndRow = obsR - 1;
  rightMeta.tables.push(t1Meta);

  // Hueco entre tablas
  r = Math.max(r, obsR) + 2;

  // —— Tabla 2: por aprobar ——
  const t2 = data.porAprobar;
  const t2Meta = {
    titleRow: r,
    dataStartRow: r + 1,
    dataEndRow: -1,
    totalRow: -1,
    obsStartRow: r,
    obsEndRow: -1,
    obsHeaderRows: [r],
    kind: 'porAprobar'
  };

  setAoaCell(aoa, r, cLabel, t2.title);
  setAoaCell(aoa, r, cAmount, t2.amountHeader);
  setAoaCell(aoa, r, cObs, t2.obsHeader);
  r += 1;

  t2Meta.dataStartRow = r;
  for (const row of t2.rows) {
    setAoaCell(aoa, r, cLabel, row.label);
    setAoaCell(aoa, r, cAmount, row.amount === null || row.amount === undefined ? '' : row.amount);
    setAoaCell(aoa, r, cObs, row.obs || '');
    r += 1;
  }
  t2Meta.dataEndRow = r - 1;
  t2Meta.obsEndRow = r - 1;

  t2Meta.totalRow = r;
  setAoaCell(aoa, r, cLabel, t2.totalLabel);
  setAoaCell(aoa, r, cAmount, t2.total);

  rightMeta.tables.push(t2Meta);
  rightMeta.endRow = r;
  rightMeta.minCols = minCols;

  meta.rightTables = rightMeta;
  return meta;
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

export function buildPigTesoreriaSheetAoa({ title, accounts = [], errorMessage = '', cuentaResultados = false } = {}) {
  const aoa = [];
  const meta = {
    titleRow: 0,
    summaryStartRow: 2,
    detailHeaderRow: -1,
    detailDataStartRow: -1,
    detailDataEndRow: -1,
    totalRows: [],
    cuentaResultados: Boolean(cuentaResultados)
  };

  aoa.push([title, '', '', '', '', '']);
  aoa.push(['', '', '', '', '', '']);

  if (errorMessage) {
    aoa.push([`Error API Holded: ${errorMessage}`, '', '', '', '', '']);
    if (cuentaResultados) appendTesoreriaCuentaResultadosRightTables(aoa, meta);
    return { aoa, meta };
  }

  if (!accounts.length) {
    aoa.push(['(Cap compte bancari amb IBAN trobat a Holded)', '', '', '', '', '']);
    if (cuentaResultados) appendTesoreriaCuentaResultadosRightTables(aoa, meta);
    return { aoa, meta };
  }

  const balancesByCurrency = new Map();

  for (const account of accounts) {
    const balance = parseBalance(account.balance);
    const currency = String(account.currency || 'EUR').trim() || 'EUR';
    balancesByCurrency.set(currency, (balancesByCurrency.get(currency) || 0) + balance);
  }

  // Bloc resum (estil PIG GENERAL: etiqueta a A, import a B)
  for (const account of accounts) {
    const label = account.name || '(Sense nom)';
    aoa.push([label, '', '', '', '', '']);
    aoa.push(['', parseBalance(account.balance), '', '', '', '']);
  }

  meta.summaryEndRow = aoa.length - 1;
  aoa.push(['', '', '', '', '', '']);
  aoa.push(['DETALL COMPTES BANCARIS (IBAN)', '', '', '', '', '']);
  meta.detailHeaderRow = aoa.length;
  aoa.push(['Compte', 'Divisa', 'IBAN', 'BIC', 'Saldo', 'Pend. conciliar']);

  meta.detailDataStartRow = aoa.length;
  for (const account of accounts) {
    aoa.push([
      account.name || '(Sense nom)',
      String(account.currency || 'EUR'),
      account.iban || '',
      account.bic || '',
      parseBalance(account.balance),
      Number(account.transactions_pending_to_reconcile) || 0
    ]);
  }
  meta.detailDataEndRow = aoa.length - 1;

  aoa.push(['', '', '', '', '', '']);

  const currencyKeys = [...balancesByCurrency.keys()].sort();
  for (const currency of currencyKeys) {
    const rowIdx = aoa.length;
    meta.totalRows.push(rowIdx);
    const suffix = currencyKeys.length > 1 ? ` (${currency})` : '';
    aoa.push([`TOTAL TESORERÍA${suffix}`, '', '', '', balancesByCurrency.get(currency), '']);
  }

  if (cuentaResultados) appendTesoreriaCuentaResultadosRightTables(aoa, meta);

  return { aoa, meta };
}
