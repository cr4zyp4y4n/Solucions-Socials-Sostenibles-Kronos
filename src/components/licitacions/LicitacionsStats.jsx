import React from 'react';
import { useTheme } from '../ThemeContext';
import { KronosCard } from '../kronos';

export default function LicitacionsStats({ stats, onFilter, areaFilter = '', onAreaFilter }) {
  const { colors } = useTheme();

  const areas = [
    { value: '', label: 'Totes' },
    { value: 'Catering', label: 'Càtering' },
    { value: 'Tech', label: 'Tech' },
    { value: 'Altres', label: 'Altres' }
  ];

  const items = [
    {
      key: 'detectades',
      label: 'Detectades aquesta setmana',
      value: stats.detectadesSetmana ?? 0,
      tone: colors.primary,
      filter: { estat_circuit: 'Detectada', setmana: true }
    },
    {
      key: 'pendents',
      label: 'Pendents de traslladar',
      value: stats.pendentsTraslladar ?? stats.pendents ?? 0,
      tone: colors.warning,
      filter: { estat_circuit: 'Detectada' }
    },
    {
      key: 'valorades',
      label: 'Valorades',
      value: stats.valorades ?? 0,
      tone: '#8B5CF6',
      filter: { estat_circuit: 'Valorada' }
    },
    {
      key: 'activades',
      label: 'Activades',
      value: stats.activades ?? 0,
      tone: colors.success,
      filter: { estat_circuit: 'Activada' }
    },
    {
      key: 'reservades',
      label: 'Reservades vigents',
      value: stats.reservadesVigents ?? 0,
      tone: '#DC2626',
      filter: { reservades: true }
    },
    {
      key: 'vencen',
      label: 'Vencen aquesta setmana',
      value: stats.vencenSetmana ?? 0,
      tone: colors.error,
      filter: { vencenSetmana: true }
    }
  ];

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        {areas.map((a) => {
          const active = areaFilter === a.value;
          return (
            <button
              key={a.value || 'all'}
              type="button"
              onClick={() => onAreaFilter?.(a.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: `1px solid ${active ? colors.primary : colors.border}`,
                background: active ? `${colors.primary}18` : colors.surface,
                color: active ? colors.primary : colors.textSecondary,
                fontWeight: 700,
                fontSize: 12,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
          gap: 10
        }}
      >
        {items.map((item) => (
          <KronosCard
            key={item.key}
            style={{
              padding: '12px 14px',
              cursor: onFilter ? 'pointer' : 'default',
              transition: 'border-color 0.15s'
            }}
          >
            <button
              type="button"
              onClick={() => onFilter?.(item.filter)}
              disabled={!onFilter}
              style={{
                width: '100%',
                padding: 0,
                border: 'none',
                background: 'transparent',
                textAlign: 'left',
                cursor: onFilter ? 'pointer' : 'default',
                fontFamily: 'inherit',
                color: 'inherit'
              }}
            >
              <div style={{ fontSize: 12, color: colors.textSecondary }}>{item.label}</div>
              <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: item.tone }}>
                {item.value}
              </div>
            </button>
          </KronosCard>
        ))}
      </div>
    </div>
  );
}
