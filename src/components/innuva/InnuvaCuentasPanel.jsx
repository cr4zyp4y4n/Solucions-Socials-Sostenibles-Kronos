import React from 'react';
import { UploadCloud } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { KronosButton, KronosCard } from '../kronos';

export default function InnuvaCuentasPanel({
  cuentasCount,
  cuentasLoading,
  cuentasError,
  cuentasCsvFile,
  onCuentasCsvChange,
  onRefresh,
  onImport
}) {
  const { colors } = useTheme();

  return (
    <KronosCard>
      <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: colors.text }}>
        Cuentas contables por empleado
      </h3>
      <p style={{ margin: '0 0 14px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
        Las cuentas 640, 476, 642 y 4751 se aplican automáticamente por código Innuva desde Supabase.
        Si un empleado no tiene mapeo, se usan los valores por defecto del sistema.
      </p>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
        <span style={{ fontSize: 13, color: colors.textSecondary }}>
          Empleados con cuentas:{' '}
          <strong style={{ color: colors.text }}>
            {cuentasLoading ? 'Cargando…' : cuentasCount}
          </strong>
        </span>
        <KronosButton size="sm" onClick={onRefresh} disabled={cuentasLoading}>
          Recargar
        </KronosButton>
      </div>

      {cuentasError ? (
        <div
          style={{
            marginBottom: 12,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${colors.error}55`,
            background: `${colors.error}10`,
            color: colors.error,
            fontSize: 13
          }}
        >
          {cuentasError}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 10,
            border: `1px solid ${colors.border}`,
            background: colors.background,
            color: colors.text,
            fontWeight: 700,
            fontSize: 13,
            cursor: 'pointer'
          }}
        >
          <UploadCloud size={15} />
          {cuentasCsvFile ? cuentasCsvFile.name : 'Importar CSV de cuentas'}
          <input
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => onCuentasCsvChange(e.target.files?.[0] || null)}
          />
        </label>
        <KronosButton
          size="sm"
          variant="primary"
          onClick={onImport}
          disabled={!cuentasCsvFile || cuentasLoading}
        >
          Guardar en Supabase
        </KronosButton>
      </div>
    </KronosCard>
  );
}
