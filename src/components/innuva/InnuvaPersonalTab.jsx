import React from 'react';
import { AlertCircle, DownloadCloud, RefreshCw, UploadCloud } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { KronosButton, KronosCard } from '../kronos';
import { useInnuvaPersonalConverter } from './useInnuvaPersonalConverter';

function DataTable({ headers, rows, rowKey = 'id' }) {
  const { colors } = useTheme();
  if (!rows.length) return null;
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th
                key={h}
                style={{
                  textAlign: 'left',
                  padding: '8px 10px',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  color: colors.textSecondary,
                  borderBottom: `1px solid ${colors.border}`,
                  whiteSpace: 'nowrap'
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={row[rowKey] || idx}>
              {headers.map((h) => (
                <td
                  key={h}
                  style={{
                    padding: '8px 10px',
                    fontSize: 12,
                    borderBottom: `1px solid ${colors.border}`,
                    color: colors.text,
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                  title={String(row[h] ?? '')}
                >
                  {row[h] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function InnuvaPersonalTab() {
  const { colors } = useTheme();
  const c = useInnuvaPersonalConverter();
  const r = c.result;

  const incidenciasPreview = (r?.incidencias || []).map((row) => ({
    id: row.nombre,
    Código: row.codigo || '—',
    Nombre: row.nombre,
    Días: row.numDias,
    'Bruto mes': `${row.brutoTotalMes?.toFixed(2).replace('.', ',')} €`,
    'SB (imp.)': row.salarioBaseImporte?.toFixed(2).replace('.', ','),
    'Mejora (imp.)': row.mejoraImporte?.toFixed(2).replace('.', ','),
    'PP extra (imp.)': row.ppExtraImporte?.toFixed(2).replace('.', ','),
    'Liq. vac. (imp.)': row.liquidacionImporte?.toFixed(2).replace('.', ',')
  }));

  const diasPreview = (r?.previewDays || []).slice(0, 25).map((d, i) => ({
    id: i,
    Trabajador: d.workerName,
    Fecha: d.fecha,
    Bruto: `${d.brutoDia?.toFixed(2).replace('.', ',')} €`,
    Tramo: d.tramoUsado,
    Lugar: d.lugares
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <input
        ref={c.fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={c.handleFileChange}
      />

      <KronosCard>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>Plantilla FD → Incidencias Innuva</h3>
        <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
          Sube el Excel/CSV de Lizeth (camareros FD). Se agrupa por trabajador y día, se aplica la tabla HORAS FD
          y se genera el desglose para importar en Innuva. Los códigos de trabajador se pueden añadir después.
        </p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <KronosButton variant="primary" onClick={c.handleSelectFile} disabled={c.isProcessing}>
            <UploadCloud size={16} />
            {c.isProcessing ? 'Procesando…' : 'Seleccionar plantilla'}
          </KronosButton>
          {c.hasResult ? (
            <>
              <KronosButton onClick={c.handleDownload}>
                <DownloadCloud size={16} />
                Descargar Incidencias
              </KronosButton>
              <KronosButton onClick={c.handleReset}>
                <RefreshCw size={15} />
                Reiniciar
              </KronosButton>
            </>
          ) : null}
        </div>
        {c.sourceFile ? (
          <div style={{ marginTop: 10, fontSize: 12, color: colors.textSecondary }}>
            Archivo: <strong style={{ color: colors.text }}>{c.sourceFile.name}</strong>
            {r ? (
              <>
                {' '}
                · {r.blocksFound} trabajadores FD · {r.dayDetails?.length} jornadas · {r.incidencias?.length} filas
                Innuva
              </>
            ) : null}
          </div>
        ) : null}
      </KronosCard>

      {c.error ? (
        <KronosCard style={{ border: `1px solid ${colors.error}55`, background: `${colors.error}10` }}>
          <div style={{ display: 'flex', gap: 10, color: colors.error, fontSize: 13 }}>
            <AlertCircle size={18} style={{ flexShrink: 0 }} />
            {c.error}
          </div>
        </KronosCard>
      ) : null}

      {r?.warnings?.length ? (
        <KronosCard style={{ border: `1px solid ${colors.warning}55`, background: `${colors.warning}10` }}>
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8, color: colors.warning }}>Avisos</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
            {r.warnings.slice(0, 12).map((w) => (
              <li key={w}>{w}</li>
            ))}
            {r.warnings.length > 12 ? <li>…y {r.warnings.length - 12} más</li> : null}
          </ul>
        </KronosCard>
      ) : null}

      {c.hasResult ? (
        <>
          <KronosCard noPadding style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 8px' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Resumen Innuva (por trabajador y mes)</h4>
            </div>
            <div style={{ padding: '0 16px 14px' }}>
              <DataTable
                headers={['Código', 'Nombre', 'Días', 'Bruto mes', 'SB (imp.)', 'Mejora (imp.)', 'PP extra (imp.)', 'Liq. vac. (imp.)']}
                rows={incidenciasPreview}
              />
            </div>
          </KronosCard>

          <KronosCard noPadding style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 8px' }}>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>Detalle por día (primeras 25 jornadas)</h4>
            </div>
            <div style={{ padding: '0 16px 14px' }}>
              <DataTable
                headers={['Trabajador', 'Fecha', 'Bruto', 'Tramo', 'Lugar']}
                rows={diasPreview}
              />
            </div>
          </KronosCard>
        </>
      ) : null}
    </div>
  );
}
