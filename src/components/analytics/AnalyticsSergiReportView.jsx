import React, { useEffect, useMemo, useState } from 'react';
import { Download } from 'lucide-react';
import {
  buildAnalyticsColumnIndices,
  buildSergiReportData,
  classifySergiReportRowMulti,
  buildHoldedV2AccountMap,
  enrichSergiRowsWithHoldedV2,
  exportSergiReportWorkbook,
  getSergiReportSheetDefs
} from '../../utils/analyticsSergiReport';
import holdedApiV2Service from '../../services/holdedApiV2Service';
import holdedApi from '../../services/holdedApi';

export default function AnalyticsSergiReportView({
  solucionsRows,
  solucionsHeaders,
  invoiceType,
  formatDate,
  formatCurrency,
  colors,
  accountFilters,
  targetYear = 2026
}) {
  const [activeSheet, setActiveSheet] = useState('IDONI');
  const [v2Rows, setV2Rows] = useState(solucionsRows || []);
  const [v2Loading, setV2Loading] = useState(false);
  const [v2Error, setV2Error] = useState('');
  const [estimateRows, setEstimateRows] = useState([]);
  const [proformRows, setProformRows] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function loadV2Enrichment() {
      if (!Array.isArray(solucionsRows) || !solucionsRows.length) {
        setV2Rows([]);
        return;
      }

      setV2Loading(true);
      setV2Error('');

      try {
        const [accounts, invoices, allEstimates, unbilledEstimates, v2AllProformas, v1PendingProforms] = await Promise.all([
          holdedApiV2Service.getAccountingAccounts('solucions'),
          holdedApiV2Service.getInvoices('solucions'),
          holdedApiV2Service.getEstimates({ sort: '-date' }, 'solucions'),
          holdedApi.getAllEstimatesPages('solucions', targetYear, 0),
          holdedApiV2Service.getProformas({ sort: '-date' }, 'solucions'),
          holdedApi.getAllProformsPages('solucions', targetYear, 0)
        ]);

        if (cancelled) return;

        const yearPrefix = `${targetYear}-`;
        const invoicesForYear = (invoices || []).filter((invoice) => String(invoice?.date || '').startsWith(yearPrefix));
        const accountMap = buildHoldedV2AccountMap(accounts);
        const enriched = enrichSergiRowsWithHoldedV2({
          rows: solucionsRows,
          headers: solucionsHeaders,
          v2Invoices: invoicesForYear,
          accountMap
        });
        const invoiceLinks = buildEstimateInvoiceLinks(invoicesForYear);
        const estimatesForYear = (allEstimates || []).filter((estimate) =>
          String(estimate?.date || '').startsWith(yearPrefix)
        );
        const unbilledEstimateNumbers = new Set(
          (unbilledEstimates || [])
            .filter((estimate) => {
              const rawDate = estimate?.date;
              if (typeof rawDate === 'number') {
                return new Date(rawDate * 1000).getFullYear() === targetYear;
              }
              return String(rawDate || '').startsWith(yearPrefix);
            })
            .map((estimate) => String(estimate?.docNumber || estimate?.document_number || '').trim())
            .filter(Boolean)
        );
        const normalizedEstimates = estimatesForYear
          .map((estimate) => {
            const estimateNumber = String(estimate.document_number || '').trim();
            const linkedInvoices = invoiceLinks.get(estimateNumber) || [];
            const total = parseAmount(estimate.total);
            const invoicedAmount = linkedInvoices.reduce((sum, invoice) => sum + parseAmount(invoice.total), 0);
            const facturat = resolveEstimateBillingStatus(total, invoicedAmount);
            const isUnbilledByApi = unbilledEstimateNumbers.has(estimateNumber);
            return { estimate, linkedInvoices, total, invoicedAmount, facturat, isUnbilledByApi };
          })
          .filter(({ estimate, facturat, isUnbilledByApi }) => {
            const status = String(estimate?.status || '').toLowerCase();
            if (status === 'failed') return false;
            if (facturat === 'Parcial') return true;
            return isUnbilledByApi;
          })
          .map((estimate) => {
            const accountNames = Array.from(
              new Set(
                (estimate.estimate.lines || [])
                  .map((line) => accountMap.get(String(line?.account || ''))?.name || '')
                  .map((name) => String(name || '').trim())
                  .filter(Boolean)
              )
            );

            return {
              fecha: estimate.estimate.date ? formatDate(estimate.estimate.date) : '-',
              numeroFactura: estimate.estimate.document_number || `EST-${estimate.estimate.id}`,
              proveedor: estimate.estimate.contact_name || 'Sin cliente',
              descripcion: estimate.estimate.description || '-',
              cuenta: accountNames.join(' | ') || '-',
              proyecto: '-',
              tags: Array.isArray(estimate.estimate.tags) && estimate.estimate.tags.length ? estimate.estimate.tags.join(', ') : '-',
              vencimiento: estimate.estimate.due_date ? formatDate(estimate.estimate.due_date) : '-',
              total: estimate.total,
              pendiente: Math.max(estimate.total - estimate.invoicedAmount, 0),
              estado: estimate.facturat === 'Facturat' ? 'Pendent' : estimate.facturat,
              overdue: false,
              dataset: 'solucions'
            };
          })
          .sort((a, b) => String(b.fecha || '').localeCompare(String(a.fecha || '')));
        const allowedProformNumbers = new Set(
          (v1PendingProforms || [])
            .map((proform) => String(proform?.docNumber || proform?.document_number || '').trim())
            .filter(Boolean)
        );
        const proformasForYear = (v2AllProformas || [])
          .filter((proform) => String(proform?.date || '').startsWith(yearPrefix));
        const normalizedProforms = proformasForYear
          .map((proform) => {
            const linkedEstimateNumber = getLinkedEstimateNumber(proform.customFields || proform.custom_fields || []);
            return { proform, linkedEstimateNumber };
          })
          .filter(({ proform }) => {
            const number = String(proform?.document_number || proform?.docNumber || '').trim();
            return allowedProformNumbers.has(number);
          })
          .map(({ proform, linkedEstimateNumber }) => {
            const accountNames = Array.from(
              new Set(
                (proform.lines || proform.products || [])
                  .map((line) => accountMap.get(String(line?.account || ''))?.name || '')
                  .map((name) => String(name || '').trim())
                  .filter(Boolean)
              )
            );
            const total = parseAmount(proform.total);
            const estimateRow = normalizedEstimates.find((row) => String(row.numeroFactura || '').trim() === linkedEstimateNumber);
            const pending = estimateRow ? estimateRow.pendiente : total;
            return {
              fecha: proform.date ? formatDate(convertPossibleTimestamp(proform.date)) : '-',
              numeroFactura: proform.docNumber || proform.document_number || `PRO-${proform.id}`,
              proveedor: proform.contactName || proform.contact_name || 'Sin cliente',
              descripcion: proform.desc || proform.description || '-',
              cuenta: accountNames.join(' | ') || '-',
              proyecto: linkedEstimateNumber || '-',
              tags: '-',
              vencimiento: (proform.dueDate || proform.due_date) ? formatDate(convertPossibleTimestamp(proform.dueDate || proform.due_date)) : '-',
              total,
              pendiente: pending,
              estado: estimateRow?.estado === 'Parcial' ? 'Parcial' : 'Pendiente',
              overdue: false,
              dataset: 'solucions'
            };
          })
          .sort((a, b) => String(b.vencimiento || '').localeCompare(String(a.vencimiento || '')));

        setV2Rows(enriched.rows);
        setEstimateRows(normalizedEstimates);
        setProformRows(normalizedProforms);

        console.log('[Informe Sergi][v2] cuentas cargadas:', accounts.length);
        console.log('[Informe Sergi][v2] facturas 2026:', invoicesForYear.length);
        console.log('[Informe Sergi][v2] match filas:', enriched.debug);
        console.log('[Informe Sergi][presupuestos][debug] total estimates API:', allEstimates.length);
        console.log('[Informe Sergi][presupuestos][debug] estimates 2026:', estimatesForYear.length);
        console.log('[Informe Sergi][presupuestos][debug] unbilled v1 API:', unbilledEstimateNumbers.size);
        console.log(
          '[Informe Sergi][presupuestos][debug] estados detectados:',
          estimatesForYear.reduce((acc, estimate) => {
            const key = String(estimate?.status || 'sin_estado');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {})
        );
        console.log(
          '[Informe Sergi][presupuestos][debug] facturat calculado:',
          normalizedEstimates.reduce((acc, estimate) => {
            const key = String(estimate.estado || 'Sin estado');
            acc[key] = (acc[key] || 0) + 1;
            return acc;
          }, {})
        );
        const estimateDebugRows = estimatesForYear.slice(0, 12).map((estimate) => {
          const estimateNumber = String(estimate.document_number || '').trim();
          const linkedInvoices = invoiceLinks.get(estimateNumber) || [];
          const total = parseAmount(estimate.total);
          const invoicedAmount = linkedInvoices.reduce((sum, invoice) => sum + parseAmount(invoice.total), 0);
          return {
            numero: estimate.document_number || estimate.id,
            cliente: estimate.contact_name || '',
            fecha: estimate.date || '',
            estado_api: estimate.status || '',
            total_presupuesto: total,
            total_facturado: invoicedAmount,
            facturat: resolveEstimateBillingStatus(total, invoicedAmount),
            unbilled_v1: unbilledEstimateNumbers.has(estimateNumber),
            facturas_vinculadas: linkedInvoices.map((invoice) => invoice.document_number).join(', ')
          };
        });
        console.table(estimateDebugRows);
        console.log('[Informe Sergi][presupuestos][debug] normalizados hoja:', normalizedEstimates.length);
        console.log('[Informe Sergi][proformas][debug] proformas v2 API total:', (v2AllProformas || []).length);
        console.log('[Informe Sergi][proformas][debug] proformas pending v1 API:', (v1PendingProforms || []).length);
        console.log('[Informe Sergi][proformas][debug] proformas 2026 v2:', proformasForYear.length);
        console.log('[Informe Sergi][proformas][debug] proformas ligadas visibles:', normalizedProforms.length);
      } catch (error) {
        if (cancelled) return;
        console.error('[Informe Sergi][v2] error enriqueciendo cuentas:', error);
        setV2Rows(solucionsRows);
        setV2Error(error?.message || 'No se pudieron cargar las cuentas de Holded v2.');
      } finally {
        if (!cancelled) setV2Loading(false);
      }
    }

    loadV2Enrichment();

    return () => {
      cancelled = true;
    };
  }, [solucionsRows, solucionsHeaders, targetYear]);

  const sheets = useMemo(
    () =>
      buildSergiReportData({
        solucionsRows: v2Rows,
        solucionsHeaders,
        extraSheets: [
          {
            key: 'PRESUPUESTOS',
            rows: estimateRows,
            totalAmount: estimateRows.reduce((sum, row) => sum + row.total, 0),
            totalPending: estimateRows.reduce((sum, row) => sum + row.pendiente, 0),
            totalOverdue: estimateRows.reduce((sum, row) => sum + (row.overdue ? row.pendiente : 0), 0)
          },
          {
            key: 'PROFORMAS',
            rows: proformRows,
            totalAmount: proformRows.reduce((sum, row) => sum + row.total, 0),
            totalPending: proformRows.reduce((sum, row) => sum + row.pendiente, 0),
            totalOverdue: proformRows.reduce((sum, row) => sum + (row.overdue ? row.pendiente : 0), 0)
          }
        ],
        invoiceType,
        formatDate,
        accountFilters
      }),
    [v2Rows, solucionsHeaders, estimateRows, proformRows, invoiceType, formatDate, accountFilters]
  );

  const active = sheets.find((sheet) => sheet.key === activeSheet) || sheets[0];
  const sheetDefs = getSergiReportSheetDefs();
  const totalRows = sheets.reduce((sum, sheet) => sum + sheet.invoiceCount, 0);
  const groupedActiveRows = useMemo(() => {
    const rows = active?.rows || [];
    if (activeSheet !== 'PRESUPUESTOS' && activeSheet !== 'PROFORMAS') return [];

    const groups = new Map();
    rows.forEach((row) => {
      const monthKey = getMonthGroupKey(row.vencimiento);
      const bucket = groups.get(monthKey.key) || { ...monthKey, rows: [] };
      bucket.rows.push(row);
      groups.set(monthKey.key, bucket);
    });

    return Array.from(groups.values()).sort((a, b) => a.sortValue - b.sortValue);
  }, [active, activeSheet]);

  useEffect(() => {
    const colIdx = buildAnalyticsColumnIndices(solucionsHeaders || []);
    const matched = { IDONI: 0, CATERING: 0, KOIKI: 0, MH: 0, NO_MATCH: 0 };

    (v2Rows || []).forEach((row) => {
      const keys = classifySergiReportRowMulti(row, colIdx, 'solucions', {
        accountFilters,
        excludedFilters: {
          IDONI: ['IDONI TPV']
        }
      });
      if (keys.length) {
        keys.forEach((key) => {
          matched[key] += 1;
        });
      } else {
        matched.NO_MATCH += 1;
      }
    });

    console.log('[Informe Sergi][debug] filas enriquecidas:', Array.isArray(v2Rows) ? v2Rows.length : 0);
    console.log('[Informe Sergi][debug] matches por compte:', matched);
  }, [v2Rows, solucionsHeaders, accountFilters]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <div
        style={{
          background: colors.card,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          padding: 20
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0, color: colors.text, fontSize: 22, fontWeight: 700 }}>
              Informe Sergi
            </h3>
            <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 14, lineHeight: 1.5 }}>
              Vista consolidada desde el Holded de EISSS, filtrando por el campo Compte para IDONI, CATERING, KOIKI, M&apos;H y presupuestos.
            </p>
            <p style={{ margin: '6px 0 0', color: colors.textSecondary, fontSize: 13 }}>
              Año fijo del informe: <strong>{targetYear}</strong> · tipo fijo: <strong>facturas de venta</strong>
            </p>
            {v2Loading ? (
              <p style={{ margin: '6px 0 0', color: colors.textSecondary, fontSize: 13 }}>
                Enriqueciendo cuentas reales desde Holded v2...
              </p>
            ) : null}
            {v2Error ? (
              <p style={{ margin: '6px 0 0', color: colors.error || '#c0392b', fontSize: 13 }}>
                {v2Error}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => exportSergiReportWorkbook({ sheets, invoiceType })}
            style={{
              alignSelf: 'flex-start',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer'
            }}
          >
            <Download size={16} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {sheets.map((sheet) => (
          <button
            key={sheet.key}
            type="button"
            onClick={() => setActiveSheet(sheet.key)}
            style={{
              textAlign: 'left',
              padding: 18,
              borderRadius: 12,
              border: activeSheet === sheet.key ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
              background: activeSheet === sheet.key ? `${colors.primary}10` : colors.card,
              cursor: 'pointer'
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: activeSheet === sheet.key ? colors.primary : colors.text }}>
              {sheet.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: colors.text, marginTop: 8 }}>
              {sheet.invoiceCount}
            </div>
            <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>facturas</div>
            <div style={{ marginTop: 14, fontSize: 13, color: colors.textSecondary }}>
              Pendiente: <strong style={{ color: colors.text }}>{formatCurrency(sheet.totalPending)}</strong>
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary }}>
              Vencido: <strong style={{ color: colors.error || '#c0392b' }}>{formatCurrency(sheet.totalOverdue)}</strong>
            </div>
          </button>
        ))}
      </div>

      <div
        style={{
          background: colors.card,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          padding: 20
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
          <div>
            <h4 style={{ margin: 0, color: colors.text, fontSize: 20, fontWeight: 700 }}>
              {active?.label || 'Detalle'}
            </h4>
            <div style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>
              {active?.invoiceCount || 0} registros de {totalRows} totales
            </div>
          </div>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            <Metric label="Total facturado" value={formatCurrency(active?.totalAmount || 0)} colors={colors} />
            <Metric label="Pendiente" value={formatCurrency(active?.totalPending || 0)} colors={colors} />
            <Metric label="Vencido" value={formatCurrency(active?.totalOverdue || 0)} colors={colors} danger />
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          {sheetDefs.map((sheet) => (
            <button
              key={sheet.key}
              type="button"
              onClick={() => setActiveSheet(sheet.key)}
              style={{
                padding: '8px 12px',
                borderRadius: 999,
                border: activeSheet === sheet.key ? `1px solid ${colors.primary}` : `1px solid ${colors.border}`,
                background: activeSheet === sheet.key ? `${colors.primary}10` : colors.surface,
                color: activeSheet === sheet.key ? colors.primary : colors.text,
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {sheet.label}
            </button>
          ))}
        </div>

        <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
          <table style={{ width: '100%', minWidth: 980, borderCollapse: 'collapse', fontSize: 14, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                {['Fecha', 'Número', invoiceType === 'sale' ? 'Cliente' : 'Proveedor', 'Descripción', 'Cuenta', 'Proyecto', 'Vencimiento', 'Pendiente', 'Estado'].map((label) => (
                  <th
                    key={label}
                    style={{
                      textAlign: 'left',
                      padding: '12px 10px',
                      borderBottom: `1px solid ${colors.border}`,
                      color: colors.primary,
                      fontWeight: 700,
                      background: colors.card
                    }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeSheet === 'PRESUPUESTOS'
                ? groupedActiveRows.map((group) => (
                  <React.Fragment key={group.key}>
                    <tr>
                      <td
                        colSpan={9}
                        style={{
                          padding: '10px 10px',
                          borderBottom: `1px solid ${colors.border}`,
                          background: `${colors.primary}12`,
                          color: colors.primary,
                          fontWeight: 800,
                          letterSpacing: 0.2
                        }}
                      >
                        {group.label} · {group.rows.length} presupuestos
                      </td>
                    </tr>
                    {group.rows.map((row, index) => (
                      <tr key={`${group.key}-${row.numeroFactura}-${index}`} style={{ background: index % 2 === 0 ? colors.surface : colors.card }}>
                        <td style={cellStyle(colors, 'date')}>{row.fecha}</td>
                        <td style={cellStyle(colors, 'number')}>{row.numeroFactura}</td>
                        <td style={cellStyle(colors, 'provider')}>{row.proveedor}</td>
                        <td style={cellStyle(colors, 'description')}>{row.descripcion}</td>
                        <td style={cellStyle(colors, 'account')}>{row.cuenta}</td>
                        <td style={cellStyle(colors, 'project')}>{row.proyecto}</td>
                        <td style={cellStyle(colors, 'date')}>{row.vencimiento}</td>
                        <td style={{ ...cellStyle(colors, 'money'), fontWeight: 700, color: row.overdue ? (colors.error || '#c0392b') : colors.text }}>
                          {formatCurrency(row.pendiente)}
                        </td>
                        <td style={cellStyle(colors, 'status')}>
                          <span
                            style={{
                              display: 'inline-flex',
                              padding: '4px 10px',
                              borderRadius: 999,
                              fontSize: 12,
                              fontWeight: 700,
                              background: row.overdue ? `${colors.error || '#c0392b'}18` : `${colors.primary}14`,
                              color: row.overdue ? (colors.error || '#c0392b') : colors.primary
                            }}
                          >
                            {row.overdue ? 'Vencida' : row.estado}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))
                : (active?.rows || []).map((row, index) => (
                <tr key={`${row.numeroFactura}-${index}`} style={{ background: index % 2 === 0 ? colors.surface : colors.card }}>
                  <td style={cellStyle(colors, 'date')}>{row.fecha}</td>
                  <td style={cellStyle(colors, 'number')}>{row.numeroFactura}</td>
                  <td style={cellStyle(colors, 'provider')}>{row.proveedor}</td>
                  <td style={cellStyle(colors, 'description')}>{row.descripcion}</td>
                  <td style={cellStyle(colors, 'account')}>{row.cuenta}</td>
                  <td style={cellStyle(colors, 'project')}>{row.proyecto}</td>
                  <td style={cellStyle(colors, 'date')}>{row.vencimiento}</td>
                  <td style={{ ...cellStyle(colors, 'money'), fontWeight: 700, color: row.overdue ? (colors.error || '#c0392b') : colors.text }}>
                    {formatCurrency(row.pendiente)}
                  </td>
                  <td style={cellStyle(colors, 'status')}>
                    <span
                      style={{
                        display: 'inline-flex',
                        padding: '4px 10px',
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 700,
                        background: row.overdue ? `${colors.error || '#c0392b'}18` : `${colors.primary}14`,
                        color: row.overdue ? (colors.error || '#c0392b') : colors.primary
                      }}
                    >
                      {row.overdue ? 'Vencida' : row.estado}
                    </span>
                  </td>
                </tr>
              ))}
              {!active?.rows?.length ? (
                <tr>
                  <td colSpan={9} style={{ ...cellStyle(colors), textAlign: 'center', color: colors.textSecondary, padding: '18px 10px' }}>
                    No hay registros para esta hoja con los filtros actuales.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function parseAmount(value) {
  const text = String(value ?? '').trim();
  if (!text) return 0;
  const normalized = text.replace(/\./g, '').replace(',', '.');
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildEstimateInvoiceLinks(invoices = []) {
  const links = new Map();

  (invoices || []).forEach((invoice) => {
    const customFields = Array.isArray(invoice.custom_fields) ? invoice.custom_fields : [];
    customFields.forEach((field) => {
      const fieldName = String(field?.field || '').trim().toLowerCase();
      const fieldValue = String(field?.value || '').trim();
      if (!fieldValue) return;
      if (!fieldName.includes('pressupost') && !fieldName.includes('presupuesto')) return;
      const bucket = links.get(fieldValue) || [];
      bucket.push(invoice);
      links.set(fieldValue, bucket);
    });
  });

  return links;
}

function getLinkedEstimateNumber(customFields = []) {
  const fields = Array.isArray(customFields) ? customFields : Object.entries(customFields || {}).map(([field, value]) => ({ field, value }));
  for (const field of fields) {
    const fieldName = String(field?.field || '').trim().toLowerCase();
    const fieldValue = String(field?.value || '').trim();
    if (!fieldValue) continue;
    if (fieldName.includes('pressupost') || fieldName.includes('presupuesto')) {
      return fieldValue;
    }
  }
  return '';
}

function convertPossibleTimestamp(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value * 1000).toISOString();
  }
  return value;
}

function resolveEstimateBillingStatus(totalEstimate, totalInvoiced) {
  const estimateTotal = Number(totalEstimate) || 0;
  const invoicedTotal = Number(totalInvoiced) || 0;
  const epsilon = 0.01;

  if (invoicedTotal <= epsilon) return 'Pendent';
  if (invoicedTotal + epsilon < estimateTotal) return 'Parcial';
  return 'Facturat';
}

function getMonthGroupKey(formattedDate) {
  const text = String(formattedDate || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!match) {
    return { key: 'sin-fecha', label: 'Sin fecha', sortValue: Number.MAX_SAFE_INTEGER };
  }

  const [, , month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, 1);
  const label = date.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return {
    key: `${year}-${month.padStart(2, '0')}`,
    label: label.charAt(0).toUpperCase() + label.slice(1),
    sortValue: date.getTime()
  };
}

function Metric({ label, value, colors, danger = false }) {
  return (
    <div>
      <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>{label}</div>
      <div style={{ marginTop: 4, fontSize: 18, fontWeight: 800, color: danger ? (colors.error || '#c0392b') : colors.text }}>
        {value}
      </div>
    </div>
  );
}

function cellStyle(colors, column = 'default') {
  const base = {
    padding: '12px 10px',
    borderBottom: `1px solid ${colors.border}`,
    color: colors.text,
    verticalAlign: 'top',
    overflowWrap: 'anywhere',
    wordBreak: 'break-word'
  };

  if (column === 'date') return { ...base, width: 92, minWidth: 92 };
  if (column === 'number') return { ...base, width: 110, minWidth: 110 };
  if (column === 'provider') return { ...base, width: 180, minWidth: 180 };
  if (column === 'description') return { ...base, width: 360, minWidth: 360 };
  if (column === 'account') return { ...base, width: 140, minWidth: 140 };
  if (column === 'project') return { ...base, width: 80, minWidth: 80 };
  if (column === 'money') return { ...base, width: 120, minWidth: 120 };
  if (column === 'status') return { ...base, width: 110, minWidth: 110 };
  return base;
}
