/**
 * Facturación pendiente / vencida por línea (CATERING, IDONI, KOIKI, MH).
 * Misma clasificación y filtros que Análisis → Informe Sergi.
 */
import holdedApiV2Service from './holdedApiV2Service';
import {
  buildHoldedV2AccountMap,
  buildSergiReportData
} from '../utils/analyticsSergiReport';

const SERGI_ACCOUNT_FILTERS = {
  IDONI: ['IDONI'],
  CATERING: ['CATERING'],
  KOIKI: ['Koiki'],
  MH: ["BOTIGA M'H", 'MENJAR D HORT', "MENJAR D'HORT", 'OBRADOR']
};

const LINEA_ORDER = [
  { key: 'IDONI', label: 'IDONI' },
  { key: 'CATERING', label: 'CATERING' },
  { key: 'KOIKI', label: 'KOIKI' },
  { key: 'MH', label: "M'H" }
];

const CSV_HEADERS = [
  'Data emissió',
  'Núm',
  'Client',
  'Descripció',
  'Compte',
  'Tags',
  'Venciment',
  'Total',
  'Pendents',
  'Estat',
  'Projecte'
];

function parseAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

function getDocSubtotal(doc) {
  if (!doc) return 0;
  const candidates = [
    doc.subtotal,
    doc.net,
    doc.base,
    doc.totals?.subtotal,
    doc.totals?.net,
    doc.totals?.base
  ];
  for (const candidate of candidates) {
    const parsed = parseAmount(candidate);
    if (Math.abs(parsed) > 0.005) return parsed;
  }
  const total = parseAmount(doc.total ?? doc.gross ?? doc.amount ?? doc.totals?.total);
  const tax = parseAmount(doc.tax ?? doc.vat ?? doc.totals?.tax ?? doc.totals?.vat);
  if (Math.abs(total) > 0.005 && Math.abs(tax) > 0.005 && total > tax) return total - tax;

  const lines = [doc.lines, doc.products, doc.items].filter(Array.isArray).flat();
  let sum = 0;
  for (const line of lines) {
    const direct = parseAmount(line?.subtotal ?? line?.net ?? line?.base);
    if (Math.abs(direct) > 0.005) {
      sum += direct;
      continue;
    }
    const price = parseAmount(line?.price ?? line?.unitPrice);
    const units = parseAmount(line?.units ?? line?.quantity ?? 1) || 1;
    const base = price * units;
    if (Math.abs(base) > 0.005) sum += base;
  }
  return sum;
}

function formatDateEs(raw) {
  if (raw == null || raw === '') return '';
  let d;
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    d = new Date(raw > 1e12 ? raw : raw * 1000);
  } else {
    const s = String(raw).trim();
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) return s;
    d = new Date(s.length <= 10 ? `${s.slice(0, 10)}T00:00:00` : s);
  }
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function norm(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function getInvoicePendingAmount(invoice) {
  const candidates = [
    invoice?.payments_pending,
    invoice?.paymentsPending,
    invoice?.pending,
    invoice?.pending_amount,
    invoice?.amount_due
  ];
  for (const c of candidates) {
    if (c != null && c !== '') {
      const n = parseAmount(c);
      if (Number.isFinite(n)) return n;
    }
  }
  const status = String(invoice?.status || '').toLowerCase();
  if (['pending', 'overdue', 'partial'].includes(status)) {
    return parseAmount(invoice?.total);
  }
  return 0;
}

function isPendingOrOverdueInvoice(invoice, today) {
  const status = String(invoice?.status || '').toLowerCase();
  if (['paid', 'cancelled', 'canceled', 'draft', 'failed'].includes(status)) return false;

  const pending = getInvoicePendingAmount(invoice);
  if (pending > 0.005) return true;

  if (['pending', 'overdue', 'partial'].includes(status)) return true;

  const dueRaw = invoice?.due_date || invoice?.dueDate;
  if (dueRaw && pending > 0.005) {
    const due = new Date(`${String(dueRaw).slice(0, 10)}T00:00:00`);
    if (!Number.isNaN(due.getTime()) && due < today) return true;
  }
  return false;
}

function invoiceToSergiRow(invoice, accountMap) {
  const accountNames = Array.from(
    new Set(
      (invoice.lines || [])
        .map((line) => accountMap.get(String(line?.account || ''))?.name || String(line?.name || '').trim())
        .map((name) => String(name || '').trim())
        .filter(Boolean)
    )
  );
  const pending = getInvoicePendingAmount(invoice);
  const status = String(invoice?.status || '').toLowerCase();
  let estado = 'Pendiente';
  if (status === 'overdue') estado = 'Vencida';
  else if (status === 'partial') estado = 'Parcial';
  else if (pending > 0.005 && status === 'pending') estado = 'Pendiente';

  return [
    formatDateEs(invoice.date),
    invoice.document_number || invoice.docNumber || `INV-${invoice.id}`,
    invoice.contact_name || invoice.contactName || 'Sin cliente',
    invoice.description || invoice.desc || '',
    accountNames.join(' | ') || '',
    Array.isArray(invoice.tags) && invoice.tags.length ? invoice.tags.join(', ') : '',
    formatDateEs(invoice.due_date || invoice.dueDate),
    parseAmount(invoice.total),
    pending,
    estado,
    ''
  ];
}

function loadMhEissOverdueRows(mhInvoices, yearPrefix, today) {
  return (mhInvoices || [])
    .filter((invoice) => String(invoice?.date || '').startsWith(yearPrefix))
    .map((invoice) => {
      const contactName = String(invoice?.contact_name || invoice?.contactName || '').trim();
      if (!norm(contactName).includes('solucions socials sostenibles')) return null;

      const status = String(invoice?.status || '').trim().toLowerCase();
      const total = parseAmount(invoice?.total);
      const dueValue = invoice?.due_date || invoice?.dueDate || '';
      const dueDate = dueValue ? new Date(`${String(dueValue).slice(0, 10)}T00:00:00`) : null;
      const overdue = Boolean(dueDate && dueDate < today && ['pending', 'overdue'].includes(status));
      if (!overdue) return null;

      const accountNames = Array.from(
        new Set(
          (invoice.lines || [])
            .map((line) => String(line?.name || '').trim())
            .filter(Boolean)
        )
      );

      return {
        fecha: formatDateEs(invoice.date),
        numeroFactura: invoice.document_number || invoice.docNumber || `INV-${invoice.id}`,
        proveedor: contactName || 'Sin cliente',
        descripcion: invoice.description || invoice.desc || '',
        cuenta: accountNames.join(' | ') || "M'H → EISSS",
        proyecto: "M'H → EISSS",
        tags: Array.isArray(invoice.tags) && invoice.tags.length ? invoice.tags.join(', ') : '',
        vencimiento: formatDateEs(dueValue),
        subtotal: getDocSubtotal(invoice),
        total,
        pendiente: total,
        estado: 'Vencida',
        overdue: true
      };
    })
    .filter(Boolean);
}

function isTooGoodToGoRow(row) {
  const hay = norm([
    row?.proveedor,
    row?.descripcion,
    row?.cuenta,
    row?.tags,
    row?.proyecto,
    row?.numeroFactura
  ].join(' | '));
  return hay.includes('too good to go') || hay.includes('toogoodtogo') || hay.includes('tgtg');
}

/**
 * Carga facturas pendientes/vencidas y las agrupa por línea (Informe Sergi).
 */
export async function loadPigFacturacionPendiente({ year, company = 'solucions' } = {}) {
  const y = Number(year) || new Date().getFullYear();
  const yearPrefix = `${y}-`;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const [accounts, invoices, mhInvoices] = await Promise.all([
      holdedApiV2Service.getAccountingAccounts(company),
      holdedApiV2Service.getInvoices(company),
      holdedApiV2Service.getInvoices('menjar_dhort')
    ]);

    const accountMap = buildHoldedV2AccountMap(accounts);
    const subtotalByNumber = new Map();
    for (const invoice of invoices || []) {
      const num = String(invoice?.document_number || invoice?.docNumber || '').trim();
      if (num) subtotalByNumber.set(num, getDocSubtotal(invoice));
    }

    const pendingRows = (invoices || [])
      .filter((invoice) => String(invoice?.date || '').startsWith(yearPrefix))
      .filter((invoice) => isPendingOrOverdueInvoice(invoice, today))
      .map((invoice) => invoiceToSergiRow(invoice, accountMap));

    const sergiSheets = buildSergiReportData({
      solucionsRows: pendingRows,
      solucionsHeaders: CSV_HEADERS,
      invoiceType: 'sale',
      formatDate: (v) => v,
      accountFilters: SERGI_ACCOUNT_FILTERS
    });

    const byKey = Object.fromEntries((sergiSheets || []).map((s) => [s.key, s]));
    const mhEissRows = loadMhEissOverdueRows(mhInvoices, yearPrefix, today);

    const lineas = LINEA_ORDER.map(({ key, label }) => {
      const sheet = byKey[key] || { rows: [], totalAmount: 0, totalPending: 0, totalOverdue: 0 };
      let rows = (sheet.rows || []).filter((r) => (Number(r.pendiente) || 0) > 0.005 || r.overdue);

      // IDONI: excluir Too Good To Go (como en el criterio de negocio acordado).
      if (key === 'IDONI') {
        rows = rows.filter((r) => !isTooGoodToGoRow(r));
      }

      if (key === 'MH' && mhEissRows.length) {
        rows = [...rows, ...mhEissRows];
      }

      rows = rows
        .map((r) => ({
          ...r,
          subtotal:
            Number(r.subtotal) ||
            subtotalByNumber.get(String(r.numeroFactura || '').trim()) ||
            0
        }))
        .slice()
        .sort((a, b) => {
          if (Boolean(a.overdue) !== Boolean(b.overdue)) return a.overdue ? -1 : 1;
          return String(a.vencimiento || '').localeCompare(String(b.vencimiento || ''));
        });

      const totalSubtotal = rows.reduce((s, r) => s + (Number(r.subtotal) || 0), 0);
      const totalAmount = rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
      const totalPending = rows.reduce((s, r) => s + (Number(r.pendiente) || 0), 0);
      const totalOverdue = rows.reduce((s, r) => s + (r.overdue ? Number(r.pendiente) || 0 : 0), 0);

      return {
        key,
        label,
        rows,
        totalSubtotal,
        totalAmount,
        totalPending,
        totalOverdue,
        invoiceCount: rows.length
      };
    });

    return { lineas, year: y, error: null };
  } catch (error) {
    console.error('[PIG FACTURACIÓN PENDIENTE] Error Holded:', error);
    return {
      lineas: LINEA_ORDER.map(({ key, label }) => ({
        key,
        label,
        rows: [],
        totalSubtotal: 0,
        totalAmount: 0,
        totalPending: 0,
        totalOverdue: 0,
        invoiceCount: 0
      })),
      year: y,
      error
    };
  }
}

/**
 * Una hoja con una tabla por línea (IDONI / CATERING / KOIKI / M'H).
 */
export function buildPigFacturacionPendienteSheetAoa({ title, lineas = [], year } = {}) {
  const aoa = [];
  const meta = {
    titleRow: 0,
    sectionHeaderRows: [],
    colHeaderRows: [],
    dataRows: [],
    sectionTotalRows: [],
    grandTotalRow: -1,
    overdueRows: []
  };

  aoa.push([title || 'FACTURACIÓN PENDIENTE', '', '', '', '', '', '', '', '', '', '', '']);
  aoa.push([
    `Facturas pendientes / vencidas por línea · Holded · ${year || ''} (misma lógica Informe Sergi)`.trim(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    ''
  ]);
  aoa.push(['', '', '', '', '', '', '', '', '', '', '', '']);

  const columns = [
    'Fecha',
    'Nº factura',
    'Cliente',
    'Descripción',
    'Cuenta',
    'Proyecto',
    'Tags',
    'Vencimiento',
    'Subtotal',
    'Total',
    'Pendiente de cobro',
    'Estado'
  ];

  let grandPending = 0;
  let grandOverdue = 0;
  let grandCount = 0;
  let grandSubtotal = 0;

  for (const linea of lineas || []) {
    meta.sectionHeaderRows.push(aoa.length);
    aoa.push([
      linea.label,
      `${linea.invoiceCount || 0} facturas`,
      '',
      '',
      '',
      '',
      '',
      '',
      Number(linea.totalSubtotal) || 0,
      Number(linea.totalAmount) || 0,
      Number(linea.totalPending) || 0,
      `Vencido: ${Number(linea.totalOverdue) || 0}`
    ]);

    meta.colHeaderRows.push(aoa.length);
    aoa.push(columns);

    if (!(linea.rows || []).length) {
      aoa.push(['(Sin facturas pendientes ni vencidas)', '', '', '', '', '', '', '', '', '', '', '']);
      meta.dataRows.push(aoa.length - 1);
    } else {
      for (const row of linea.rows) {
        const rIdx = aoa.length;
        meta.dataRows.push(rIdx);
        if (row.overdue) meta.overdueRows.push(rIdx);
        aoa.push([
          row.fecha || '',
          row.numeroFactura || '',
          row.proveedor || '',
          row.descripcion || '',
          row.cuenta || '',
          row.proyecto || '',
          row.tags || '',
          row.vencimiento || '',
          Number(row.subtotal) || 0,
          Number(row.total) || 0,
          Number(row.pendiente) || 0,
          row.overdue ? 'Vencida' : (row.estado || 'Pendiente')
        ]);
      }
    }

    meta.sectionTotalRows.push(aoa.length);
    aoa.push([
      `TOTAL ${linea.label}`,
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      Number(linea.totalSubtotal) || 0,
      Number(linea.totalAmount) || 0,
      Number(linea.totalPending) || 0,
      ''
    ]);
    aoa.push(['', '', '', '', '', '', '', '', '', '', '', '']);

    grandSubtotal += Number(linea.totalSubtotal) || 0;
    grandPending += Number(linea.totalPending) || 0;
    grandOverdue += Number(linea.totalOverdue) || 0;
    grandCount += Number(linea.invoiceCount) || 0;
  }

  meta.grandTotalRow = aoa.length;
  aoa.push([
    'TOTAL FACTURACIÓN PENDIENTE',
    `${grandCount} facturas`,
    '',
    '',
    '',
    '',
    '',
    '',
    grandSubtotal,
    '',
    grandPending,
    `Vencido: ${grandOverdue}`
  ]);

  return { aoa, meta };
}
