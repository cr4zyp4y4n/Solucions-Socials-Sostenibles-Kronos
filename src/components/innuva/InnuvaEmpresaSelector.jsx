import React from 'react';
import { Home } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { KronosCard } from '../kronos';
import { INNUVA_EMPRESA_OPTIONS } from './innuvaConverterCore';

export default function InnuvaEmpresaSelector({ empresa, onChange, disabled }) {
  const { colors } = useTheme();

  return (
    <KronosCard style={{ padding: 16 }}>
      <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 800, marginBottom: 10, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        Empresa
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {INNUVA_EMPRESA_OPTIONS.map((opt) => {
          const active = empresa === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              disabled={disabled}
              onClick={() => onChange(opt.key)}
              style={{
                flex: '1 1 200px',
                minWidth: 200,
                padding: '12px 14px',
                borderRadius: 12,
                border: active ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                background: active ? `${colors.primary}10` : colors.background,
                cursor: disabled ? 'not-allowed' : 'pointer',
                opacity: disabled ? 0.65 : 1,
                textAlign: 'left',
                fontFamily: 'inherit'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <Home size={16} color={active ? colors.primary : colors.textSecondary} />
                <span style={{ fontWeight: 800, fontSize: 14, color: active ? colors.primary : colors.text }}>
                  {opt.title}
                </span>
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary }}>{opt.subtitle}</div>
            </button>
          );
        })}
      </div>
    </KronosCard>
  );
}
