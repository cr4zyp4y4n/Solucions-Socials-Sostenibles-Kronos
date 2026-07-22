import * as XLSX from 'xlsx-js-style';

/** Columna Excel 0-based → letra (0=A, 1=B, …). */
export function colLetter(c) {
  return XLSX.utils.encode_col(c);
}

/** Referencia A1 (fila/col 0-based). */
export function cellRef(r, c) {
  return `${colLetter(c)}${r + 1}`;
}

/** Rango A1 inclusive (0-based). */
export function rangeRef(r0, c0, r1, c1) {
  return `${cellRef(r0, c0)}:${cellRef(r1, c1)}`;
}

/**
 * Escribe fórmula numérica con valor cacheado (para ver cifra al abrir).
 * @param {object} ws hoja xlsx
 * @param {number} r fila 0-based
 * @param {number} c col 0-based
 * @param {string} formula sin '=' inicial o con él
 * @param {number} [cachedValue]
 * @param {object} [extraStyle] se fusiona con s existente
 */
export function setFormulaCell(ws, r, c, formula, cachedValue = 0, extraStyle = null) {
  const ref = XLSX.utils.encode_cell({ r, c });
  const f = String(formula || '').trim().replace(/^=/, '');
  const prev = ws[ref] || {};
  const cell = {
    ...prev,
    t: 'n',
    f,
    v: Number.isFinite(Number(cachedValue)) ? Number(cachedValue) : 0
  };
  if (extraStyle) {
    cell.s = { ...(prev.s || {}), ...extraStyle };
  }
  ws[ref] = cell;
}

/** =SUMA(B4:M4) */
export function sumFormula(r0, c0, r1, c1) {
  return `SUM(${rangeRef(r0, c0, r1, c1)})`;
}

/**
 * =SUMA(B4;B7;B9) — lista de celdas misma columna.
 * Excel ES usa ; como separador de argumentos; xlsx suele guardar con , (inglés).
 * Usamos coma (API Excel inglés / compatible SheetJS).
 */
export function sumCellsFormula(rows, col) {
  const parts = (rows || []).map((r) => cellRef(r, col));
  if (!parts.length) return '0';
  if (parts.length === 1) return parts[0];
  return `SUM(${parts.join(',')})`;
}

/** =A1+B2+… o A1-B2 */
export function addCellsFormula(refs) {
  const parts = (refs || []).filter(Boolean);
  if (!parts.length) return '0';
  if (parts.length === 1) return parts[0];
  return parts.join('+');
}

/**
 * Asegura !ref de la hoja cubre las celdas tocadas.
 */
export function ensureSheetRef(ws, r, c) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws['!ref']) {
    ws['!ref'] = addr;
    return;
  }
  const range = XLSX.utils.decode_range(ws['!ref']);
  range.s.r = Math.min(range.s.r, r);
  range.s.c = Math.min(range.s.c, c);
  range.e.r = Math.max(range.e.r, r);
  range.e.c = Math.max(range.e.c, c);
  ws['!ref'] = XLSX.utils.encode_range(range);
}

/**
 * Aplica fórmulas de columna TOTAL (meses en cols 1..monthsLen) a filas dadas.
 */
export function applyRowTotalSumFormulas(ws, rowIndices, monthsLen, totalCol, getCachedTotal) {
  const lastMonthCol = monthsLen;
  for (const r of rowIndices || []) {
    const cached = typeof getCachedTotal === 'function' ? getCachedTotal(r) : (ws[XLSX.utils.encode_cell({ r, c: totalCol })]?.v ?? 0);
    setFormulaCell(ws, r, totalCol, sumFormula(r, 1, r, lastMonthCol), cached);
  }
}

/**
 * Meta típica de hoja LINEA Cuenta Resultados.
 * @typedef {object} PigLineaFormulaMeta
 * @property {boolean} enabled
 * @property {number} monthsLen
 * @property {number} totalCol
 * @property {number[]} subvRows
 * @property {number[]} accountRows
 * @property {number[]} incomeRows
 * @property {number[]} expenseRows
 * @property {number} [beneficioPorMesRow]
 * @property {number} [ingresosSinSubvRow]
 * @property {number} [despesesRow]
 * @property {number} [beneficioSinSubvRow]
 * @property {number} [bottomConSubvRow]
 * @property {number} [bottomSinSubvRow]
 * @property {Array<{row:number, novLimit:number, decLimit:number}>} [bottomAccountRows]
 * @property {string} [sheetName]
 * @property {Array<{label:string, row:number, bucket:string}>} [subvDetail]
 */

/**
 * Aplica fórmulas interiores de una hoja LINEA (CR).
 */
export function applyPigLineaCuentaResultadosFormulas(ws, meta = {}) {
  if (!meta?.enabled) return;
  const monthsLen = Math.max(1, Math.min(12, Number(meta.monthsLen) || 12));
  const totalCol = Number.isFinite(meta.totalCol) ? meta.totalCol : monthsLen + 1;
  const dataRows = [...(meta.subvRows || []), ...(meta.accountRows || [])];

  applyRowTotalSumFormulas(ws, dataRows, monthsLen, totalCol, (r) => {
    const cell = ws[XLSX.utils.encode_cell({ r, c: totalCol })];
    return cell?.v ?? 0;
  });

  const beneficioRow = meta.beneficioPorMesRow;
  if (beneficioRow != null && dataRows.length) {
    for (let m = 0; m < monthsLen; m++) {
      const col = m + 1;
      const cached = ws[XLSX.utils.encode_cell({ r: beneficioRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, beneficioRow, col, sumCellsFormula(dataRows, col), cached);
    }
    const cachedTot = ws[XLSX.utils.encode_cell({ r: beneficioRow, c: totalCol })]?.v ?? 0;
    setFormulaCell(ws, beneficioRow, totalCol, sumFormula(beneficioRow, 1, beneficioRow, monthsLen), cachedTot);
  }

  const ingresosRow = meta.ingresosSinSubvRow;
  if (ingresosRow != null && (meta.incomeRows || []).length) {
    for (let m = 0; m < monthsLen; m++) {
      const col = m + 1;
      const cached = ws[XLSX.utils.encode_cell({ r: ingresosRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, ingresosRow, col, sumCellsFormula(meta.incomeRows, col), cached);
    }
    const cachedTot = ws[XLSX.utils.encode_cell({ r: ingresosRow, c: totalCol })]?.v ?? 0;
    setFormulaCell(ws, ingresosRow, totalCol, sumFormula(ingresosRow, 1, ingresosRow, monthsLen), cachedTot);
  }

  const despesesRow = meta.despesesRow;
  if (despesesRow != null && (meta.expenseRows || []).length) {
    for (let m = 0; m < monthsLen; m++) {
      const col = m + 1;
      const cached = ws[XLSX.utils.encode_cell({ r: despesesRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, despesesRow, col, sumCellsFormula(meta.expenseRows, col), cached);
    }
    const cachedTot = ws[XLSX.utils.encode_cell({ r: despesesRow, c: totalCol })]?.v ?? 0;
    setFormulaCell(ws, despesesRow, totalCol, sumFormula(despesesRow, 1, despesesRow, monthsLen), cachedTot);
  }

  const benSinRow = meta.beneficioSinSubvRow;
  if (benSinRow != null && ingresosRow != null && despesesRow != null) {
    for (let m = 0; m < monthsLen; m++) {
      const col = m + 1;
      const cached = ws[XLSX.utils.encode_cell({ r: benSinRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, benSinRow, col, `${cellRef(ingresosRow, col)}+${cellRef(despesesRow, col)}`, cached);
    }
    const cachedTot = ws[XLSX.utils.encode_cell({ r: benSinRow, c: totalCol })]?.v ?? 0;
    setFormulaCell(ws, benSinRow, totalCol, sumFormula(benSinRow, 1, benSinRow, monthsLen), cachedTot);
  }

  // Inferiores CON/SIN SUBV → TOTAL de la tabla grande
  if (meta.bottomConSubvRow != null && beneficioRow != null) {
    const cached = ws[XLSX.utils.encode_cell({ r: meta.bottomConSubvRow, c: 1 })]?.v ?? 0;
    const f = cellRef(beneficioRow, totalCol);
    setFormulaCell(ws, meta.bottomConSubvRow, 1, f, cached);
    setFormulaCell(ws, meta.bottomConSubvRow, 8, f, cached);
  }
  if (meta.bottomSinSubvRow != null && benSinRow != null) {
    const cached = ws[XLSX.utils.encode_cell({ r: meta.bottomSinSubvRow, c: 1 })]?.v ?? 0;
    const f = cellRef(benSinRow, totalCol);
    setFormulaCell(ws, meta.bottomSinSubvRow, 1, f, cached);
    setFormulaCell(ws, meta.bottomSinSubvRow, 8, f, cached);
  }

  // YTD tablas pequeñas: col B = suma ene→novLimit, col I = suma ene→decLimit
  for (const item of meta.bottomAccountRows || []) {
    const r = item.row;
    const novLimit = Math.max(1, Math.min(12, item.novLimit || 1));
    const decLimit = Math.max(1, Math.min(12, item.decLimit || 1));
    // En tablas inferiores el valor izquierdo está en col 1 y el derecho en col 8;
    // las filas de detalle de la tabla grande están en accountRows/subvRows — necesitamos
    // mapear por etiqueta. Si bottomAccountRows trae sourceRow, usamos esa.
    if (item.sourceRow != null) {
      const cachedL = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v ?? 0;
      const cachedR = ws[XLSX.utils.encode_cell({ r, c: 8 })]?.v ?? 0;
      setFormulaCell(ws, r, 1, sumFormula(item.sourceRow, 1, item.sourceRow, novLimit), cachedL);
      setFormulaCell(ws, r, 8, sumFormula(item.sourceRow, 1, item.sourceRow, decLimit), cachedR);
    }
  }
}

export function sheetCellRef(sheetName, r, c) {
  const safe = `'${String(sheetName || '').replace(/'/g, "''")}'`;
  return `${safe}!${cellRef(r, c)}`;
}

/**
 * Fórmulas CR GENERAL: TOTAL horizontal, subv cross-sheet, padres enlazados, mini-tabla.
 */
export function applyPigGeneralCuentaResultadosFormulas(ws, meta = {}, lineaMetas = {}) {
  if (!meta?.enabled) return;
  const lim = Math.max(1, Math.min(12, Number(meta.lim) || 12));
  const totalCol = Number.isFinite(meta.totalCol) ? meta.totalCol : lim + 1;
  const mensualStart = meta.mensualDataStartRow;
  const labels = meta.summaryLabels || [];

  if (mensualStart != null) {
    for (let i = 0; i < labels.length; i++) {
      const r = mensualStart + i;
      const cached = ws[XLSX.utils.encode_cell({ r, c: totalCol })]?.v ?? 0;
      setFormulaCell(ws, r, totalCol, sumFormula(r, 1, r, lim), cached);
    }
  }

  const subvLabelRows = meta.subvMensualRows || {};
  const lineaList = [
    { key: 'CATERING', sheet: 'PIG LINEA CATERING' },
    { key: 'IDONI', sheet: 'PIG LINEA IDONI' },
    { key: 'KOIKI', sheet: 'PIG LINEA KOIKI' },
    { key: 'ESTRUCTURA', sheet: 'PIG ESTRUCTURA SUBV 740' }
  ];

  const bucketLabels = ['SUBV EISSS L1 2026', 'SUBV EISSS L2 2026', 'IMPULSEM'];
  for (const bucket of bucketLabels) {
    const r = subvLabelRows[bucket];
    if (r == null) continue;
    for (let m = 0; m < lim; m++) {
      const col = m + 1;
      const refs = [];
      for (const { key, sheet } of lineaList) {
        const lm = lineaMetas[key];
        if (!lm?.subvDetail?.length) continue;
        for (const d of lm.subvDetail) {
          if (d.bucket === bucket) refs.push(sheetCellRef(sheet, d.row, col));
        }
      }
      const cached = ws[XLSX.utils.encode_cell({ r, c: col })]?.v ?? 0;
      const formula = refs.length ? (refs.length === 1 ? refs[0] : `SUM(${refs.join(',')})`) : '0';
      setFormulaCell(ws, r, col, formula, cached);
    }
  }

  const parentRows = meta.parentMensualRows || [];
  const l1 = subvLabelRows['SUBV EISSS L1 2026'];
  const l2 = subvLabelRows['SUBV EISSS L2 2026'];
  const imp = subvLabelRows.IMPULSEM;
  if (l1 != null && l2 != null && imp != null) {
    for (const r of parentRows) {
      for (let m = 0; m < lim; m++) {
        const col = m + 1;
        const cached = Number(ws[XLSX.utils.encode_cell({ r, c: col })]?.v) || 0;
        const v1 = Number(ws[XLSX.utils.encode_cell({ r: l1, c: col })]?.v) || 0;
        const v2 = Number(ws[XLSX.utils.encode_cell({ r: l2, c: col })]?.v) || 0;
        const v3 = Number(ws[XLSX.utils.encode_cell({ r: imp, c: col })]?.v) || 0;
        const base = cached - v1 - v2 - v3;
        const formula = `${base}+${cellRef(l1, col)}+${cellRef(l2, col)}+${cellRef(imp, col)}`;
        setFormulaCell(ws, r, col, formula, cached);
      }
    }
  }

  if (meta.summaryValueRows && mensualStart != null) {
    for (let i = 0; i < labels.length; i++) {
      const valueRow = meta.summaryValueRows[i];
      if (valueRow == null) continue;
      const monthlyRow = mensualStart + i;
      const cached = ws[XLSX.utils.encode_cell({ r: valueRow, c: 1 })]?.v ?? 0;
      setFormulaCell(ws, valueRow, 1, cellRef(monthlyRow, totalCol), cached);
    }
  }

  const mini = meta.miniTabla;
  if (mini && mini.totalRow != null && mini.valueCol != null && mini.conceptRows?.length) {
    const cached = ws[XLSX.utils.encode_cell({ r: mini.totalRow, c: mini.valueCol })]?.v ?? 0;
    setFormulaCell(ws, mini.totalRow, mini.valueCol, sumCellsFormula(mini.conceptRows, mini.valueCol), cached);
  }
}

/** Totales de hojas de gastos (grupo / sección = SUMA de importes de cuentas). */
export function applyPigGastosCuentaResultadosFormulas(ws, meta = {}) {
  if (!meta) return;
  const valueCol = 1;
  for (const sec of meta.sectionMetas || []) {
    if (sec.totalRow == null || !(sec.accountValueRows || []).length) continue;
    const cached = ws[XLSX.utils.encode_cell({ r: sec.totalRow, c: valueCol })]?.v ?? 0;
    setFormulaCell(ws, sec.totalRow, valueCol, sumCellsFormula(sec.accountValueRows, valueCol), cached);
  }
  if (meta.groupTotalRow != null) {
    const sourceRows = (meta.sectionMetas || []).map((s) => s.totalRow).filter((r) => r != null);
    const fallback = meta.allAccountValueRows || [];
    const rows = sourceRows.length ? sourceRows : fallback;
    if (rows.length) {
      const cached = ws[XLSX.utils.encode_cell({ r: meta.groupTotalRow, c: valueCol })]?.v ?? 0;
      setFormulaCell(ws, meta.groupTotalRow, valueCol, sumCellsFormula(rows, valueCol), cached);
    }
  }
}

/** G6: total en totalRow = suma de filas de importe numérico. */
export function applyPigDespesesMpFormulas(ws, { totalRow = 5, scanFromRow = 7 } = {}) {
  const valueCol = 1;
  const rows = [];
  const range = ws['!ref'] ? XLSX.utils.decode_range(ws['!ref']) : null;
  const maxR = range ? range.e.r : scanFromRow + 200;
  for (let r = scanFromRow; r <= maxR; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: valueCol })];
    if (cell && cell.t === 'n') rows.push(r);
  }
  if (!rows.length) return;
  const cached = ws[XLSX.utils.encode_cell({ r: totalRow, c: valueCol })]?.v ?? 0;
  setFormulaCell(ws, totalRow, valueCol, sumCellsFormula(rows, valueCol), cached);
}

/**
 * COMPARATIVA: TOTAL ACUMULADO = SUMA de 12 meses; diferencias mensuales = colA - colB.
 * meta.sections: [{ dataStartRow, totalRow, months: 12, sumCols: number[], diffSpecs: [{ col, leftCol, rightCol }] }]
 */
export function applyPigComparativaCuentaResultadosFormulas(ws, meta = {}) {
  for (const sec of meta.sections || []) {
    const start = sec.dataStartRow;
    const months = sec.months || 12;
    const totalRow = sec.totalRow;
    if (start == null || totalRow == null) continue;

    for (const spec of sec.diffSpecs || []) {
      for (let i = 0; i < months; i++) {
        const r = start + i;
        const cached = ws[XLSX.utils.encode_cell({ r, c: spec.col })]?.v ?? 0;
        setFormulaCell(ws, r, spec.col, `${cellRef(r, spec.leftCol)}-${cellRef(r, spec.rightCol)}`, cached);
      }
    }

    for (const col of sec.sumCols || []) {
      const cached = ws[XLSX.utils.encode_cell({ r: totalRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, totalRow, col, sumFormula(start, col, start + months - 1, col), cached);
    }
  }
}

/** TESORERÍA: TOTAL = SUMA saldos detalle; tablas derecha = SUMA importes. */
export function applyPigTesoreriaCuentaResultadosFormulas(ws, meta = {}) {
  if (!meta?.cuentaResultados && !(meta?.totalRows || []).length) return;
  const balanceCol = 4;
  if (
    meta.detailDataStartRow != null &&
    meta.detailDataEndRow != null &&
    meta.detailDataEndRow >= meta.detailDataStartRow
  ) {
    for (const totalRow of meta.totalRows || []) {
      const cached = ws[XLSX.utils.encode_cell({ r: totalRow, c: balanceCol })]?.v ?? 0;
      setFormulaCell(
        ws,
        totalRow,
        balanceCol,
        sumFormula(meta.detailDataStartRow, balanceCol, meta.detailDataEndRow, balanceCol),
        cached
      );
    }
  }

  const amountCol = 8; // TESORERIA_RIGHT_COL.amount
  for (const t of meta.rightTables?.tables || []) {
    if (t.totalRow == null || t.dataStartRow == null || t.dataEndRow == null) continue;
    if (t.dataEndRow < t.dataStartRow) continue;
    const col = Number.isFinite(t.amountCol) ? t.amountCol : amountCol;
    const cached = ws[XLSX.utils.encode_cell({ r: t.totalRow, c: col })]?.v ?? 0;
    setFormulaCell(ws, t.totalRow, col, sumFormula(t.dataStartRow, col, t.dataEndRow, col), cached);
  }
}

/** PRESUPUESTOS: totales de mes / bloque / grand = SUMA de filas de datos. */
export function applyPigPresupuestosCuentaResultadosFormulas(ws, meta = {}) {
  const totalCol = 7;
  const pendCol = 8;
  const dataRows = meta.dataRows || [];
  const monthTotals = meta.monthTotalRows || [];
  let prev = -1;
  for (const totalRow of monthTotals) {
    const rows = dataRows.filter((r) => r > prev && r < totalRow);
    if (rows.length) {
      for (const col of [totalCol, pendCol]) {
        const cached = ws[XLSX.utils.encode_cell({ r: totalRow, c: col })]?.v ?? 0;
        setFormulaCell(ws, totalRow, col, sumCellsFormula(rows, col), cached);
      }
    }
    prev = totalRow;
  }

  for (const totalRow of [...(meta.blockTotalFacturadoRows || []), ...(meta.blockTotalPendingRows || [])]) {
    // Bloques del mes actual: sumar dataRows facturado/pending cercanos
    const nearby = dataRows.filter((r) => r < totalRow && r > totalRow - 80);
    // Preferir filas del mismo bloque: entre el header previo y el total
    const headerBefore = [...(meta.headerRows || [])].filter((h) => h < totalRow).pop();
    const rows = dataRows.filter((r) => r < totalRow && (headerBefore == null || r > headerBefore));
    const use = rows.length ? rows : nearby;
    if (!use.length) continue;
    for (const col of [totalCol, pendCol]) {
      const cached = ws[XLSX.utils.encode_cell({ r: totalRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, totalRow, col, sumCellsFormula(use, col), cached);
    }
  }

  if (meta.grandTotalRow >= 0) {
    const source = monthTotals.length ? monthTotals : dataRows;
    if (source.length) {
      for (const col of [totalCol, pendCol]) {
        const cached = ws[XLSX.utils.encode_cell({ r: meta.grandTotalRow, c: col })]?.v ?? 0;
        setFormulaCell(ws, meta.grandTotalRow, col, sumCellsFormula(source, col), cached);
      }
    }
  }
}

/** FACTURACIÓN PENDIENTE: totales de sección y grand. */
export function applyPigFacturacionCuentaResultadosFormulas(ws, meta = {}) {
  const cols = [8, 9, 10];
  const dataRows = meta.dataRows || [];
  const sectionTotals = meta.sectionTotalRows || [];
  const sectionHeaders = meta.sectionHeaderRows || [];

  for (let i = 0; i < sectionTotals.length; i++) {
    const totalRow = sectionTotals[i];
    const header = sectionHeaders[i];
    const rows = dataRows.filter((r) => r < totalRow && (header == null || r > header));
    if (!rows.length) continue;
    for (const col of cols) {
      const cached = ws[XLSX.utils.encode_cell({ r: totalRow, c: col })]?.v ?? 0;
      setFormulaCell(ws, totalRow, col, sumCellsFormula(rows, col), cached);
    }
  }

  if (meta.grandTotalRow >= 0) {
    const source = sectionTotals.length ? sectionTotals : dataRows;
    if (source.length) {
      for (const col of [8, 10]) {
        const cached = ws[XLSX.utils.encode_cell({ r: meta.grandTotalRow, c: col })]?.v ?? 0;
        setFormulaCell(ws, meta.grandTotalRow, col, sumCellsFormula(source, col), cached);
      }
    }
  }
}


