/**
 * Presupuestos Holded pendientes/parciales por fecha de vencimiento.
 * Misma lógica que Análisis → Facturas de venta → Informe Sergi (PRESUPUESTOS).
 */
import holdedApi from './holdedApi';
import holdedApiV2Service from './holdedApiV2Service';
import { buildHoldedV2AccountMap } from '../utils/analyticsSergiReport';

function parseAmount(value) {
  if (value == null || value === '') return 0;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const text = String(value).trim().replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(text);
  return Number.isFinite(n) ? n : 0;
}

/** Subtotal sin IVA. */
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
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function resolveEstimateBillingStatus(totalEstimate, totalInvoiced) {
  const estimateTotal = Number(totalEstimate) || 0;
  const invoicedTotal = Number(totalInvoiced) || 0;
  const epsilon = 0.01;
  if (invoicedTotal <= epsilon) return 'Pendent';
  if (invoicedTotal + epsilon < estimateTotal) return 'Parcial';
  return 'Facturat';
}

function buildEstimateInvoiceLinks(invoices = []) {
  const links = new Map();
  for (const invoice of invoices || []) {
    const fields = invoice?.customFields || invoice?.custom_fields || [];
    const list = Array.isArray(fields)
      ? fields
      : Object.entries(fields || {}).map(([field, value]) => ({ field, value }));
    for (const item of list) {
      const fieldName = String(item?.field || '').trim().toLowerCase();
      const fieldValue = String(item?.value || '').trim();
      if (!fieldValue) continue;
      if (!fieldName.includes('pressupost') && !fieldName.includes('presupuesto')) continue;
      const bucket = links.get(fieldValue) || [];
      bucket.push(invoice);
      links.set(fieldValue, bucket);
    }
  }
  return links;
}

function getMonthGroupKey(formattedDate) {
  const text = String(formattedDate || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return { key: 'sin-fecha', label: 'Sin fecha de vencimiento', sortValue: Number.MAX_SAFE_INTEGER };
  }
  const [, , month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    sortValue: date.getTime()
  };
}

function parseEsDate(formattedDate) {
  const text = String(formattedDate || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) return null;
  const [, day, month, year] = match;
  const d = new Date(Number(year), Number(month) - 1, Number(day));
  d.setHours(0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDayMonthYear(date) {
  const d = date instanceof Date ? date : new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
}

function currentMonthKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * En el mes actual (día de generación del PIG):
 * - vencimiento < hoy → se trata como FACTURADO (corte)
 * - vencimiento >= hoy → sigue por facturar
 */
function splitCurrentMonthRows(rows = [], asOfDate = new Date()) {
  const today = new Date(asOfDate);
  today.setHours(0, 0, 0, 0);
  const facturado = [];
  const porFacturar = [];

  for (const row of rows || []) {
    const due = parseEsDate(row.vencimiento);
    if (due && due < today) {
      facturado.push({
        ...row,
        estado: 'FACTURADO',
        pendienteOriginal: Number(row.pendiente) || 0,
        pendiente: 0,
        corteFacturado: true
      });
    } else {
      porFacturar.push({
        ...row,
        corteFacturado: false
      });
    }
  }

  facturado.sort((a, b) => String(a.vencimiento || '').localeCompare(String(b.vencimiento || '')));
  porFacturar.sort((a, b) => String(a.vencimiento || '').localeCompare(String(b.vencimiento || '')));

  return { facturado, porFacturar, corteLabel: formatDayMonthYear(today) };
}

/**
 * Carga presupuestos pendientes/parciales (V2 + V1 unbilled), como Informe Sergi.
 */
export async function loadPigPresupuestosPendientes({ year, company = 'solucions' } = {}) {
  const y = Number(year) || new Date().getFullYear();
  const yearPrefix = `${y}-`;

  try {
    const [accounts, invoices, allEstimates, unbilledEstimates] = await Promise.all([
      holdedApiV2Service.getAccountingAccounts(company),
      holdedApiV2Service.getInvoices(company),
      holdedApiV2Service.getEstimates({ sort: '-date' }, company),
      holdedApi.getAllEstimatesPages(company, y, 0)
    ]);

    const accountMap = buildHoldedV2AccountMap(accounts);
    const invoicesForYear = (invoices || []).filter((invoice) => String(invoice?.date || '').startsWith(yearPrefix));
    const invoiceLinks = buildEstimateInvoiceLinks(invoicesForYear);
    const estimatesForYear = (allEstimates || []).filter((estimate) =>
      String(estimate?.date || '').startsWith(yearPrefix)
    );

    const unbilledEstimateNumbers = new Set(
      (unbilledEstimates || [])
        .filter((estimate) => {
          const rawDate = estimate?.date;
          if (typeof rawDate === 'number') {
            return new Date(rawDate * 1000).getFullYear() === y;
          }
          return String(rawDate || '').startsWith(yearPrefix);
        })
        .map((estimate) => String(estimate?.docNumber || estimate?.document_number || '').trim())
        .filter(Boolean)
    );

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const rows = estimatesForYear
      .map((estimate) => {
        const estimateNumber = String(estimate.document_number || '').trim();
        const linkedInvoices = invoiceLinks.get(estimateNumber) || [];
        const total = parseAmount(estimate.total);
        const subtotal = getDocSubtotal(estimate);
        const invoicedAmount = linkedInvoices.reduce((sum, invoice) => sum + parseAmount(invoice.total), 0);
        const invoicedSubtotal = linkedInvoices.reduce((sum, invoice) => sum + getDocSubtotal(invoice), 0);
        const facturat = resolveEstimateBillingStatus(total, invoicedAmount);
        const isUnbilledByApi = unbilledEstimateNumbers.has(estimateNumber);
        return { estimate, total, subtotal, invoicedAmount, invoicedSubtotal, facturat, isUnbilledByApi };
      })
      .filter(({ estimate, facturat, isUnbilledByApi }) => {
        const status = String(estimate?.status || '').toLowerCase();
        if (status === 'failed') return false;
        if (facturat === 'Parcial') return true;
        return isUnbilledByApi;
      })
      .map(({ estimate, subtotal, invoicedSubtotal, facturat }) => {
        const accountNames = Array.from(
          new Set(
            (estimate.lines || [])
              .map((line) => accountMap.get(String(line?.account || ''))?.name || '')
              .map((name) => String(name || '').trim())
              .filter(Boolean)
          )
        );
        const vencimiento = estimate.due_date ? formatDateEs(estimate.due_date) : '';
        const amount = Math.abs(subtotal) > 0.005 ? subtotal : 0;
        const pendiente = Math.max(amount - invoicedSubtotal, 0);
        let overdue = false;
        if (vencimiento) {
          const due = new Date(`${vencimiento.slice(6, 10)}-${vencimiento.slice(3, 5)}-${vencimiento.slice(0, 2)}T00:00:00`);
          overdue = !Number.isNaN(due.getTime()) && due < today && pendiente > 0.005;
        }
        return {
          fecha: estimate.date ? formatDateEs(estimate.date) : '',
          numero: estimate.document_number || `EST-${estimate.id}`,
          cliente: estimate.contact_name || 'Sin cliente',
          descripcion: estimate.description || '',
          cuenta: accountNames.join(' | ') || '',
          tags: Array.isArray(estimate.tags) && estimate.tags.length ? estimate.tags.join(', ') : '',
          vencimiento: vencimiento || '',
          total: amount,
          pendiente,
          estado: facturat === 'Facturat' ? 'Pendiente' : facturat === 'Pendent' ? 'Pendiente' : facturat,
          overdue
        };
      })
      .sort((a, b) => String(a.vencimiento || 'zzz').localeCompare(String(b.vencimiento || 'zzz')));

    return { rows, year: y, error: null };
  } catch (error) {
    console.error('[PIG PRESUPUESTOS] Error cargando presupuestos Holded:', error);
    return { rows: [], year: y, error };
  }
}

/**
 * AOA agrupado por mes de vencimiento (como la vista del Informe Sergi).
 * En el mes actual (fecha de generación): anteriores a hoy = FACTURADO (verde);
 * desde hoy = por facturar.
 */
export function buildPigPresupuestosSheetAoa({ title, rows = [], year, asOfDate = null } = {}) {
  const aoa = [];
  const meta = {
    titleRow: 0,
    headerRows: [],
    monthHeaderRows: [],
    monthTotalRows: [],
    dataRows: [],
    facturadoRows: [],
    subHeaderRows: [],
    blockTotalFacturadoRows: [],
    blockTotalPendingRows: [],
    grandTotalRow: -1
  };

  const asOf = asOfDate ? new Date(asOfDate) : new Date();
  asOf.setHours(0, 0, 0, 0);
  const mesActualKey = currentMonthKey(asOf);
  const corteStr = formatDayMonthYear(asOf);

  aoa.push([title || 'PRESUPUESTOS', '', '', '', '', '', '', '', '', '']);
  aoa.push([
    `Presupuestos pendientes / parciales por facturar · Holded EI.SSS · ${year || ''} · Corte mes actual: ${corteStr}`.trim(),
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
  aoa.push(['', '', '', '', '', '', '', '', '', '']);

  const groupsMap = new Map();
  for (const row of rows || []) {
    const monthKey = getMonthGroupKey(row.vencimiento);
    const bucket = groupsMap.get(monthKey.key) || { ...monthKey, rows: [] };
    bucket.rows.push(row);
    groupsMap.set(monthKey.key, bucket);
  }
  const groups = Array.from(groupsMap.values()).sort((a, b) => a.sortValue - b.sortValue);

  const columns = [
    'Fecha',
    'Nº presupuesto',
    'Cliente',
    'Descripción',
    'Cuenta',
    'Tags',
    'Vencimiento',
    'Subtotal',
    'Pendiente por facturar',
    'Estado'
  ];

  const pushRow = (row, { facturado = false } = {}) => {
    const rIdx = aoa.length;
    meta.dataRows.push(rIdx);
    if (facturado) meta.facturadoRows.push(rIdx);
    aoa.push([
      row.fecha,
      row.numero,
      row.cliente,
      row.descripcion,
      row.cuenta,
      row.tags,
      row.vencimiento,
      row.total,
      facturado ? 0 : row.pendiente,
      row.estado
    ]);
  };

  let grandPending = 0;
  let grandTotal = 0;

  if (!groups.length) {
    aoa.push(['(No hay presupuestos pendientes ni parciales en Holded para este año)', '', '', '', '', '', '', '', '', '']);
    return { aoa, meta };
  }

  for (const group of groups) {
    const isCurrentMonth = group.key === mesActualKey;

    if (isCurrentMonth) {
      const { facturado, porFacturar } = splitCurrentMonthRows(group.rows, asOf);
      const facturadoTotal = facturado.reduce((s, r) => s + (Number(r.total) || 0), 0);
      const pendingTotal = porFacturar.reduce((s, r) => s + (Number(r.total) || 0), 0);
      const pendingPendiente = porFacturar.reduce((s, r) => s + (Number(r.pendiente) || 0), 0);
      const monthTotal = facturadoTotal + pendingTotal;

      grandPending += pendingPendiente;
      grandTotal += monthTotal;

      meta.monthHeaderRows.push(aoa.length);
      aoa.push([
        `${group.label} (mes actual · corte ${corteStr})`,
        `${group.rows.length} presupuestos`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        ''
      ]);

      // Bloque A: anteriores a hoy → FACTURADO (totales debajo)
      meta.subHeaderRows.push(aoa.length);
      aoa.push([
        `Anteriores a ${corteStr} → tratados como FACTURADO`,
        `${facturado.length} presupuestos`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'FACTURADO'
      ]);
      meta.headerRows.push(aoa.length);
      aoa.push(columns);
      if (!facturado.length) {
        aoa.push(['(Ninguno con vencimiento anterior a hoy)', '', '', '', '', '', '', '', '', '']);
        meta.dataRows.push(aoa.length - 1);
      } else {
        for (const row of facturado) pushRow(row, { facturado: true });
      }
      meta.blockTotalFacturadoRows.push(aoa.length);
      aoa.push([
        'TOTAL FACTURADO (corte)',
        '',
        '',
        '',
        '',
        '',
        '',
        facturadoTotal,
        0,
        'FACTURADO'
      ]);

      // Bloque B: desde hoy → por facturar (totales debajo)
      meta.subHeaderRows.push(aoa.length);
      aoa.push([
        `Desde ${corteStr} (incluido) → por facturar`,
        `${porFacturar.length} presupuestos`,
        '',
        '',
        '',
        '',
        '',
        '',
        '',
        'POR FACTURAR'
      ]);
      meta.headerRows.push(aoa.length);
      aoa.push(columns);
      if (!porFacturar.length) {
        aoa.push(['(Ninguno con vencimiento desde hoy)', '', '', '', '', '', '', '', '', '']);
        meta.dataRows.push(aoa.length - 1);
      } else {
        for (const row of porFacturar) pushRow(row, { facturado: false });
      }
      meta.blockTotalPendingRows.push(aoa.length);
      aoa.push([
        'TOTAL POR FACTURAR (desde corte)',
        '',
        '',
        '',
        '',
        '',
        '',
        pendingTotal,
        pendingPendiente,
        'POR FACTURAR'
      ]);

      meta.monthTotalRows.push(aoa.length);
      aoa.push([
        'TOTAL MES (solo por facturar desde corte)',
        '',
        '',
        '',
        '',
        '',
        '',
        pendingTotal,
        pendingPendiente,
        ''
      ]);
      aoa.push(['', '', '', '', '', '', '', '', '', '']);
      continue;
    }

    const monthPending = group.rows.reduce((s, r) => s + (Number(r.pendiente) || 0), 0);
    const monthTotal = group.rows.reduce((s, r) => s + (Number(r.total) || 0), 0);
    grandPending += monthPending;
    grandTotal += monthTotal;

    meta.monthHeaderRows.push(aoa.length);
    aoa.push([
      group.label,
      `${group.rows.length} presupuestos`,
      '',
      '',
      '',
      '',
      '',
      monthTotal,
      monthPending,
      ''
    ]);

    meta.headerRows.push(aoa.length);
    aoa.push(columns);

    for (const row of group.rows) pushRow(row, { facturado: false });

    meta.monthTotalRows.push(aoa.length);
    aoa.push(['TOTAL MES', '', '', '', '', '', '', monthTotal, monthPending, '']);
    aoa.push(['', '', '', '', '', '', '', '', '', '']);
  }

  meta.grandTotalRow = aoa.length;
  aoa.push([
    'TOTAL PRESUPUESTOS PENDIENTES / PARCIALES',
    '',
    '',
    '',
    '',
    '',
    '',
    grandTotal,
    grandPending,
    ''
  ]);

  return { aoa, meta };
}
