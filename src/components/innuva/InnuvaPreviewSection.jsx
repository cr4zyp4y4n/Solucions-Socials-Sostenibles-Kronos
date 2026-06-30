import React from 'react';
import { AlertCircle, CheckCircle, RefreshCw } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { KronosCard } from '../kronos';
import { MAX_PREVIEW_ROWS } from './innuvaConverterCore';

function DataTable({ headers, rows, rowKeyPrefix }) {
  const { colors } = useTheme();

  if (!headers.length) return null;

  return (
    <div style={{ overflowX: 'auto', maxWidth: '100%' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
        <thead>
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                style={{
                  textAlign: 'left',
                  padding: '10px 12px',
                  background: colors.background,
                  borderBottom: `1px solid ${colors.border}`,
                  color: colors.textSecondary,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  whiteSpace: 'nowrap'
                }}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${rowKeyPrefix}-${row.__rowIndex ?? index}`}>
              {headers.map((header) => (
                <td
                  key={`${rowKeyPrefix}-${index}-${header}`}
                  style={{
                    padding: '10px 12px',
                    borderBottom: `1px solid ${colors.border}`,
                    color: colors.text,
                    fontSize: 13,
                    maxWidth: 220,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  title={String(row[header] ?? '')}
                >
                  {row[header] ?? ''}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatCard({ label, value, hint, tone }) {
  const { colors } = useTheme();
  return (
    <KronosCard style={{ padding: '14px 16px' }}>
      <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800, color: tone || colors.text }}>{value}</div>
      {hint ? <div style={{ marginTop: 6, fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 }}>{hint}</div> : null}
    </KronosCard>
  );
}

export default function InnuvaPreviewSection({
  sourceCount,
  holdedCount,
  sourceHeaders,
  previewSourceRows,
  previewHoldedRows,
  conversionLog
}) {
  const { colors } = useTheme();
  const holdedHeaders = previewHoldedRows[0] ? Object.keys(previewHoldedRows[0]) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 10
        }}
      >
        <StatCard
          label="Empleados leídos"
          value={sourceCount.toLocaleString('es-ES')}
          hint="Filas detectadas en el export de Innuva."
        />
        <StatCard
          label="Filas Holded"
          value={holdedCount.toLocaleString('es-ES')}
          hint="Filas agrupadas por NIF listas para importar."
          tone={holdedCount > 0 ? colors.success : colors.text}
        />
        <StatCard
          label="Estado"
          value={holdedCount > 0 ? 'Listo' : '—'}
          hint={holdedCount > 0 ? 'Puedes descargar el Excel de Holded.' : 'Sube un archivo para convertir.'}
          tone={holdedCount > 0 ? colors.success : colors.textSecondary}
        />
      </div>

      <KronosCard noPadding style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 10px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Vista previa Innuva</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
            Primeras {Math.min(previewSourceRows.length, MAX_PREVIEW_ROWS)} filas del archivo original.
          </p>
        </div>
        <div style={{ padding: '0 18px 16px' }}>
          <DataTable headers={sourceHeaders} rows={previewSourceRows} rowKeyPrefix="src" />
        </div>
      </KronosCard>

      <KronosCard noPadding style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 18px 10px' }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800 }}>Vista previa Holded</h3>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
            Plantilla de nóminas para importar en Holded.
          </p>
        </div>
        <div style={{ padding: '0 18px 16px' }}>
          {holdedHeaders.length ? (
            <DataTable headers={holdedHeaders} rows={previewHoldedRows} rowKeyPrefix="hold" />
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: 14,
                borderRadius: 10,
                border: `1px dashed ${colors.warning}55`,
                background: `${colors.warning}10`,
                fontSize: 13,
                color: colors.textSecondary
              }}
            >
              <AlertCircle size={18} color={colors.warning} />
              Aún no hay filas de destino.
            </div>
          )}
        </div>
      </KronosCard>

      <KronosCard>
        <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800 }}>Registro de acciones</h3>
        <div
          style={{
            maxHeight: 200,
            overflowY: 'auto',
            border: `1px solid ${colors.border}`,
            borderRadius: 10
          }}
        >
          {conversionLog.length === 0 ? (
            <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: colors.textSecondary }}>
              Sin eventos todavía.
            </div>
          ) : (
            [...conversionLog].reverse().map((entry) => {
              const isSuccess = entry.type === 'success';
              const isError = entry.type === 'error';
              const iconColor = isError ? colors.error : isSuccess ? colors.success : colors.primary;
              const Icon = isError ? AlertCircle : isSuccess ? CheckCircle : RefreshCw;
              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '12px 14px',
                    display: 'flex',
                    gap: 10,
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  <Icon size={16} color={iconColor} style={{ marginTop: 2, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.message}</div>
                    <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                      {entry.timestamp.toLocaleString('es-ES')}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </KronosCard>
    </div>
  );
}
