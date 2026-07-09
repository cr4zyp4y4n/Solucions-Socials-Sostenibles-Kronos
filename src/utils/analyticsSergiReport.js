import * as XLSX from 'xlsx-js-style';

const SERGI_SHEETS = [
  { key: 'IDONI', label: 'IDONI', workbookLabel: 'FACTURAS_A_FECHA_IDONI', dataset: 'solucions' },
  { key: 'CATERING', label: 'CATERING', workbookLabel: 'FACTURAS_A_FECHA_CATERING', dataset: 'solucions' },
  { key: 'KOIKI', label: 'KOIKI', workbookLabel: 'FACTURAS_A_FECHA_KOIKI', dataset: 'solucions' },
  { key: 'MH', label: "M'H", workbookLabel: 'FACTURACION_MH', dataset: 'solucions' },
  { key: 'PRESUPUESTOS', label: 'PRESUPUESTOS', workbookLabel: 'PRESUPUESTOS_A_FECHA', dataset: 'solucions' },
  { key: 'PROFORMAS', label: 'PROFORMAS', workbookLabel: 'PROFORMAS', dataset: 'solucions' }
];

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function parsePossibleDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === 'number' && !Number.isNaN(value)) {
    const utcDays = Math.floor(value - 25569);
    return new Date(utcDays * 86400 * 1000);
  }
  const str = String(value).trim();
  if (!str) return null;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
    const [day, month, year] = str.split('/').map(Number);
    return new Date(year, month - 1, day);
  }
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(str)) {
    return new Date(`${str}T00:00:00`);
  }
  const parsed = new Date(str);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function getSergiReportSheetDefs() {
  return SERGI_SHEETS.slice();
}

export function buildAnalyticsColumnIndices(headers = []) {
  const indices = {};
  headers.forEach((header, index) => {
    const headerLower = norm(header);
    if (headerLower.includes('proveidor') || headerLower.includes('proveedor') || headerLower.includes('provider') || headerLower.includes('client')) {
      indices.provider = index;
    }
    if (headerLower.includes('data') && headerLower.includes('emissio')) {
      indices.date = index;
    }
    if ((headerLower.includes('num') || headerLower.includes('nucm')) && !headerLower.includes('intern')) {
      indices.invoiceNumber = index;
    }
    if (headerLower.includes('compte') || headerLower.includes('account')) {
      indices.account = index;
    }
    if (headerLower.includes('descripcio') || headerLower.includes('descripcion')) {
      indices.description = index;
    }
    if (headerLower.includes('total')) {
      indices.total = index;
    }
    if (headerLower.includes('pendents') || headerLower.includes('pending')) {
      indices.pending = index;
    }
    if (headerLower.includes('estat') || headerLower.includes('estado')) {
      indices.status = index;
    }
    if (headerLower.includes('venciment') || headerLower.includes('vencimiento') || headerLower.includes('due')) {
      indices.dueDate = index;
    }
    if (headerLower.includes('tags') || headerLower.includes('etiquetas')) {
      indices.tags = index;
    }
    if (headerLower.includes('projecte') || headerLower.includes('proyecto') || headerLower.includes('project')) {
      indices.project = index;
    }
  });
  return indices;
}

function getRowText(row, index) {
  return index != null ? String(row[index] || '') : '';
}

function parseAmount(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeInvoiceKeyPart(value) {
  return norm(value).replace(/[^a-z0-9]+/g, '');
}

function splitAccountTerms(value) {
  return String(value || '')
    .split('|')
    .map((part) => norm(part).trim())
    .filter(Boolean);
}

function buildInvoiceLookup(v2Invoices = []) {
  const byNumber = new Map();
  const byComposite = new Map();

  v2Invoices.forEach((invoice) => {
    const numberKey = normalizeInvoiceKeyPart(invoice.document_number);
    if (numberKey && !byNumber.has(numberKey)) {
      byNumber.set(numberKey, invoice);
    }

    const compositeKey = [
      String(invoice.date || '').slice(0, 10),
      normalizeInvoiceKeyPart(invoice.contact_name),
      parseAmount(invoice.total).toFixed(2)
    ].join('|');

    if (!byComposite.has(compositeKey)) {
      byComposite.set(compositeKey, invoice);
    }
  });

  return { byNumber, byComposite };
}

function resolveInvoiceForRow(row, columnIndices, lookup) {
  const invoiceNumber = normalizeInvoiceKeyPart(getRowText(row, columnIndices.invoiceNumber));
  if (invoiceNumber && lookup.byNumber.has(invoiceNumber)) {
    return lookup.byNumber.get(invoiceNumber);
  }

  const compositeKey = [
    String(getRowText(row, columnIndices.date) || '').slice(0, 10),
    normalizeInvoiceKeyPart(getRowText(row, columnIndices.provider)),
    parseAmount(columnIndices.total != null ? row[columnIndices.total] : 0).toFixed(2)
  ].join('|');

  return lookup.byComposite.get(compositeKey) || null;
}

export function buildHoldedV2AccountMap(accounts = []) {
  const map = new Map();
  accounts.forEach((account) => {
    if (!account?.id) return;
    map.set(String(account.id), {
      id: String(account.id),
      name: String(account.name || '').trim(),
      number: account.number ?? null,
      group: String(account.group || '').trim()
    });
  });
  return map;
}

export function enrichSergiRowsWithHoldedV2({
  rows = [],
  headers = [],
  v2Invoices = [],
  accountMap = new Map()
}) {
  const columnIndices = buildAnalyticsColumnIndices(headers);
  const lookup = buildInvoiceLookup(v2Invoices);
  const accountIdx = columnIndices.account;
  const debug = { matchedByNumber: 0, matchedByComposite: 0, unmatched: 0 };

  const enrichedRows = rows.map((row) => {
    if (!Array.isArray(row)) return row;

    const invoiceNumber = normalizeInvoiceKeyPart(getRowText(row, columnIndices.invoiceNumber));
    const matchedByNumber = invoiceNumber && lookup.byNumber.has(invoiceNumber);
    const invoice = resolveInvoiceForRow(row, columnIndices, lookup);
    if (!invoice) {
      debug.unmatched += 1;
      return row;
    }

    if (matchedByNumber) debug.matchedByNumber += 1;
    else debug.matchedByComposite += 1;

    const lineAccountNames = Array.from(
      new Set(
        (invoice.lines || [])
          .map((line) => accountMap.get(String(line?.account || ''))?.name || '')
          .map((name) => String(name || '').trim())
          .filter(Boolean)
      )
    );

    if (!lineAccountNames.length || accountIdx == null) {
      return row;
    }

    const nextRow = [...row];
    nextRow[accountIdx] = lineAccountNames.join(' | ');
    return nextRow;
  });

  return { rows: enrichedRows, debug };
}

export function classifySergiReportRowMulti(row, columnIndices, dataset, options = {}) {
  if (!Array.isArray(row) || !columnIndices) return [];
  if (dataset !== 'solucions') return [];

  const tagsText = norm(getRowText(row, columnIndices.tags));
  const accountTerms = splitAccountTerms(getRowText(row, columnIndices.account));
  const accountText = accountTerms.join(' | ');
  const searchText = [
    getRowText(row, columnIndices.description),
    getRowText(row, columnIndices.project),
    getRowText(row, columnIndices.provider)
  ].map(norm).join(' | ');

  const accountFilters = options.accountFilters || {};
  const excludedFilters = options.excludedFilters || {};
  const matches = [];

  const hasAccountMatch = (terms = []) =>
    terms.some((term) => {
      const normalizedTerm = norm(term);
      return accountTerms.some((accountTerm) => accountTerm.includes(normalizedTerm));
    });

  const hasExcluded = (terms = []) =>
    terms.some((term) => {
      const normalizedTerm = norm(term);
      return accountTerms.some((accountTerm) => accountTerm.includes(normalizedTerm));
    });

  const hasFallbackMatch = (terms = []) => {
    if (accountTerms.length > 0) return false;
    return terms.some((term) => {
      const normalizedTerm = norm(term);
      return tagsText.includes(normalizedTerm) || searchText.includes(normalizedTerm);
    });
  };

  SERGI_SHEETS.forEach((sheet) => {
    const key = sheet.key;
    const terms = accountFilters[key] || [];
    if (!hasAccountMatch(terms) && !hasFallbackMatch(terms)) return;
    if (hasExcluded(excludedFilters[key] || [])) return;
    matches.push(key);
  });

  return matches;
}

export function classifySergiReportRow(row, columnIndices, dataset, options = {}) {
  const matches = classifySergiReportRowMulti(row, columnIndices, dataset, options);
  return matches[0] || null;
}

export function buildSergiReportData({
  solucionsRows = [],
  solucionsHeaders = [],
  extraSheets = [],
  invoiceType = 'purchase',
  formatDate = (v) => v,
  accountFilters = {}
}) {
  const groups = Object.fromEntries(
    SERGI_SHEETS.map((sheet) => [sheet.key, { ...sheet, rows: [], totalPending: 0, totalOverdue: 0, totalAmount: 0 }])
  );

  const sources = [
    { dataset: 'solucions', rows: solucionsRows, headers: solucionsHeaders }
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const source of sources) {
    const columnIndices = buildAnalyticsColumnIndices(source.headers);
    for (const row of source.rows) {
      const total = columnIndices.total != null ? parseFloat(row[columnIndices.total]) || 0 : 0;
      const pending = columnIndices.pending != null ? parseFloat(row[columnIndices.pending]) || 0 : 0;
      const dueDate = parsePossibleDate(columnIndices.dueDate != null ? row[columnIndices.dueDate] : null);
      const isOverdue = pending > 0 && dueDate && dueDate < today;
      const sheetKeys = classifySergiReportRowMulti(row, columnIndices, source.dataset, optionsFromAccountFilters(accountFilters));
      if (!sheetKeys.length) continue;

      const normalized = {
        fecha: columnIndices.date != null ? formatDate(row[columnIndices.date]) : '-',
        numeroFactura: getRowText(row, columnIndices.invoiceNumber) || '-',
        proveedor: getRowText(row, columnIndices.provider) || (invoiceType === 'sale' ? 'Sin cliente' : 'Sin proveedor'),
        descripcion: getRowText(row, columnIndices.description) || '-',
        cuenta: getRowText(row, columnIndices.account) || '-',
        proyecto: getRowText(row, columnIndices.project) || '-',
        tags: getRowText(row, columnIndices.tags) || '-',
        vencimiento: columnIndices.dueDate != null ? formatDate(row[columnIndices.dueDate]) : '-',
        total,
        pendiente: pending,
        estado: getRowText(row, columnIndices.status) || (pending > 0 ? 'Pendiente' : 'Pagado'),
        overdue: Boolean(isOverdue),
        dataset: source.dataset
      };

      sheetKeys.forEach((sheetKey) => {
        if (!groups[sheetKey]) return;
        groups[sheetKey].rows.push({ ...normalized });
        groups[sheetKey].totalAmount += total;
        groups[sheetKey].totalPending += pending;
        if (isOverdue) groups[sheetKey].totalOverdue += pending;
      });
    }
  }

  extraSheets.forEach((sheet) => {
    if (!sheet?.key || !groups[sheet.key]) return;
    const rows = Array.isArray(sheet.rows) ? sheet.rows : [];
    groups[sheet.key].rows = rows;
    groups[sheet.key].totalAmount = sheet.totalAmount || 0;
    groups[sheet.key].totalPending = sheet.totalPending || 0;
    groups[sheet.key].totalOverdue = sheet.totalOverdue || 0;
  });

  return SERGI_SHEETS.map((sheet) => ({
    ...groups[sheet.key],
    invoiceCount: groups[sheet.key].rows.length
  }));
}

export function exportSergiReportWorkbook({
  sheets = [],
  invoiceType = 'purchase',
  fileDate = new Date()
}) {
  const wb = XLSX.utils.book_new();
  const pendingLabel = invoiceType === 'sale' ? 'Pendiente de cobro' : 'Pendiente';
  const providerLabel = invoiceType === 'sale' ? 'Cliente' : 'Proveedor';
  const dateStr = fileDate.toISOString().split('T')[0];

  sheets.forEach((sheet) => {
    const ws = buildStyledDetailSheet({
      sheet,
      providerLabel,
      pendingLabel,
      dateStr
    });
    XLSX.utils.book_append_sheet(wb, ws, (sheet.workbookLabel || sheet.label).substring(0, 31));
  });

  const summaryWs = buildStyledSummarySheet({ sheets, dateStr });
  XLSX.utils.book_append_sheet(wb, summaryWs, 'Resumen');

  const treasuryWs = buildStyledTreasurySheet({ dateStr });
  XLSX.utils.book_append_sheet(wb, treasuryWs, 'TESORERIA');

  XLSX.writeFile(wb, `Informe_Sergi_${invoiceType === 'sale' ? 'Ventas' : 'Compras'}_${dateStr}.xlsx`);
}

function buildStyledDetailSheet({
  sheet,
  providerLabel,
  pendingLabel,
  dateStr
}) {
  const theme = getSheetTheme(sheet.key);
  const columns = [
    'Fecha',
    'Número de factura',
    providerLabel,
    'Descripción',
    'Cuenta',
    'Proyecto',
    'Tags',
    'Vencimiento',
    'Total',
    pendingLabel,
    'Estado',
    'Vencida'
  ];

  const dataRows = sheet.rows.length
    ? sheet.rows.map((row) => ([
        row.fecha,
        row.numeroFactura,
        row.proveedor,
        row.descripcion,
        row.cuenta,
        row.proyecto,
        row.tags,
        row.vencimiento,
        row.total,
        row.pendiente,
        row.estado,
        row.overdue ? 'Sí' : 'No'
      ]))
    : [['', '', 'Sin datos', '', '', '', '', '', '', '', '', '']];

  const aoa = [
    [`Informe Sergi · ${sheet.label}`],
    [`Actualizado a fecha ${dateStr}`],
    ['Facturas / documentos', sheet.invoiceCount, 'Total', sheet.totalAmount, 'Pendiente', sheet.totalPending, 'Vencido', sheet.totalOverdue],
    [],
    columns,
    ...dataRows
  ];

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [
    { wch: 14 }, { wch: 18 }, { wch: 34 }, { wch: 42 }, { wch: 24 }, { wch: 18 },
    { wch: 18 }, { wch: 14 }, { wch: 14 }, { wch: 18 }, { wch: 16 }, { wch: 12 }
  ];
  ws['!rows'] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 22 }, { hpt: 8 }, { hpt: 24 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: columns.length - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: columns.length - 1 } }
  ];
  ws['!autofilter'] = { ref: `A5:${XLSX.utils.encode_col(columns.length - 1)}${5 + dataRows.length}` };
  ws['!sheetView'] = [{ showGridLines: false }];

  setRangeStyle(ws, 0, 0, 0, columns.length - 1, {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: makeFill(theme.accent),
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setRangeStyle(ws, 1, 0, 1, columns.length - 1, {
    font: { italic: true, sz: 10, color: { rgb: '6B7280' }, name: 'Calibri' },
    fill: makeFill('#F8FAFC'),
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  applyMetricPairStyle(ws, 2, 0, 1, 'integer', theme);
  applyMetricPairStyle(ws, 2, 2, 3, 'currency', theme);
  applyMetricPairStyle(ws, 2, 4, 5, 'currency', theme);
  applyMetricPairStyle(ws, 2, 6, 7, 'currency', theme);

  setRangeStyle(ws, 4, 0, 4, columns.length - 1, {
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: makeFill(theme.accent),
    border: borderThin(),
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });

  for (let r = 5; r < 5 + dataRows.length; r++) {
    const rowFill = (r - 5) % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    setRangeStyle(ws, r, 0, r, columns.length - 1, {
      fill: makeFill(rowFill),
      border: borderThin(),
      alignment: { vertical: 'top', wrapText: true },
      font: { name: 'Calibri', sz: 10, color: { rgb: '1F2937' } }
    });
    setCellStyle(ws, r, 8, currencyStyle());
    setCellStyle(ws, r, 9, currencyStyle());
    setCellStyle(ws, r, 0, dateCellStyle());
    setCellStyle(ws, r, 7, dateCellStyle());
    setCellStyle(ws, r, 10, {
      ...(ws[XLSX.utils.encode_cell({ r, c: 10 })]?.s || {}),
      fill: makeFill('#F8FAFC'),
      font: { bold: true, color: { rgb: theme.accentText }, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderThin()
    });
    setCellStyle(ws, r, 11, {
      ...(ws[XLSX.utils.encode_cell({ r, c: 11 })]?.s || {}),
      fill: makeFill('#F8FAFC'),
      font: { bold: true, color: { rgb: '4B5563' }, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' },
      border: borderThin()
    });
  }

  return ws;
}

function buildStyledSummarySheet({ sheets, dateStr }) {
  const aoa = [
    ['Informe Sergi · Resumen general'],
    [`Actualizado a fecha ${dateStr}`],
    [],
    ['Hoja', 'Facturas', 'Total facturado', 'Pendiente total', 'Pendiente vencido'],
    ...sheets.map((sheet) => [
      sheet.label,
      sheet.invoiceCount,
      sheet.totalAmount,
      sheet.totalPending,
      sheet.totalOverdue
    ])
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 24 }, { wch: 12 }, { wch: 18 }, { wch: 18 }, { wch: 18 }];
  ws['!rows'] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
  ];
  ws['!autofilter'] = { ref: `A4:E${4 + sheets.length}` };
  ws['!sheetView'] = [{ showGridLines: false }];

  setRangeStyle(ws, 0, 0, 0, 4, {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: makeFill('#6B7280'),
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setRangeStyle(ws, 1, 0, 1, 4, {
    font: { italic: true, sz: 10, color: { rgb: '6B7280' }, name: 'Calibri' },
    fill: makeFill('#F8FAFC'),
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setRangeStyle(ws, 3, 0, 3, 4, {
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: makeFill('#6B7280'),
    border: borderThin(),
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  for (let r = 4; r < 4 + sheets.length; r++) {
    const rowFill = (r - 4) % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
    setRangeStyle(ws, r, 0, r, 4, {
      fill: makeFill(rowFill),
      border: borderThin(),
      font: { name: 'Calibri', sz: 10, color: { rgb: '1F2937' } }
    });
    setCellStyle(ws, r, 1, integerStyle());
    setCellStyle(ws, r, 2, currencyStyle());
    setCellStyle(ws, r, 3, currencyStyle());
    setCellStyle(ws, r, 4, currencyStyle());
  }

  return ws;
}

function buildStyledTreasurySheet({ dateStr }) {
  const aoa = [
    ['TESORERIA'],
    [`Hoja de trabajo manual · ${dateStr}`],
    [],
    ['Fecha', 'Concepto', 'Canal', 'Importe', 'Observaciones']
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 14 }, { wch: 36 }, { wch: 18 }, { wch: 16 }, { wch: 38 }];
  ws['!rows'] = [{ hpt: 28 }, { hpt: 20 }, { hpt: 8 }, { hpt: 24 }];
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 4 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 4 } }
  ];
  ws['!sheetView'] = [{ showGridLines: false }];

  setRangeStyle(ws, 0, 0, 0, 4, {
    font: { bold: true, sz: 16, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: makeFill('#6B7280'),
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setRangeStyle(ws, 1, 0, 1, 4, {
    font: { italic: true, sz: 10, color: { rgb: '6B7280' }, name: 'Calibri' },
    fill: makeFill('#F8FAFC'),
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setRangeStyle(ws, 3, 0, 3, 4, {
    font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri' },
    fill: makeFill('#6B7280'),
    border: borderThin(),
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  return ws;
}

function applyMetricPairStyle(ws, row, labelCol, valueCol, valueType = 'currency', theme = getSheetTheme()) {
  setCellStyle(ws, row, labelCol, {
    font: { bold: true, color: { rgb: theme.accentText }, name: 'Calibri' },
    fill: makeFill(theme.soft),
    border: borderThin(),
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setCellStyle(ws, row, valueCol, {
    ...(valueType === 'integer' ? integerStyle() : currencyStyle()),
    fill: makeFill('#FFFFFF'),
    font: { bold: true, color: { rgb: '1F2937' }, name: 'Calibri' }
  });
}

function getSheetTheme(sheetKey = '') {
  const key = String(sheetKey || '').toUpperCase();
  if (key === 'IDONI') {
    return { accent: 'D96AA7', soft: 'F9E1EC', accentText: '8E3A68' };
  }
  if (key === 'CATERING' || key === 'PRESUPUESTOS' || key === 'PROFORMAS' || key === 'MH') {
    return { accent: 'B7D531', soft: 'EEF6C8', accentText: '556B0F' };
  }
  if (key === 'KOIKI') {
    return { accent: '7A7A7A', soft: 'ECECEC', accentText: '4B5563' };
  }
  return { accent: '6B7280', soft: 'E5E7EB', accentText: '4B5563' };
}

function borderThin() {
  return {
    top: { style: 'thin', color: { rgb: 'B7C8C2' } },
    bottom: { style: 'thin', color: { rgb: 'B7C8C2' } },
    left: { style: 'thin', color: { rgb: 'B7C8C2' } },
    right: { style: 'thin', color: { rgb: 'B7C8C2' } }
  };
}

function hexToRgb(hex) {
  const normalized = String(hex || '').replace('#', '').trim();
  const full = normalized.length === 3
    ? normalized.split('').map((char) => char + char).join('')
    : normalized;
  const int = Number.parseInt(full, 16);
  return {
    r: (int >> 16) & 255,
    g: (int >> 8) & 255,
    b: int & 255
  };
}

function makeFill(hex) {
  const { r, g, b } = hexToRgb(hex);
  const rgb = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  return { patternType: 'solid', fgColor: { rgb } };
}

function setCellStyle(ws, r, c, s) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) return;
  ws[addr].s = { ...(ws[addr].s || {}), ...(s || {}) };
}

function setRangeStyle(ws, r0, c0, r1, c1, s) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) setCellStyle(ws, r, c, s);
  }
}

function currencyStyle() {
  return {
    border: borderThin(),
    numFmt: '#,##0.00\\ [$€-1];[Red]-#,##0.00\\ [$€-1]',
    alignment: { horizontal: 'right', vertical: 'center' }
  };
}

function integerStyle() {
  return {
    border: borderThin(),
    numFmt: '0',
    alignment: { horizontal: 'center', vertical: 'center' }
  };
}

function dateCellStyle() {
  return {
    border: borderThin(),
    alignment: { horizontal: 'center', vertical: 'center' }
  };
}

function optionsFromAccountFilters(accountFilters = {}) {
  return {
    accountFilters,
    excludedFilters: {
      IDONI: ['IDONI TPV']
    }
  };
}
