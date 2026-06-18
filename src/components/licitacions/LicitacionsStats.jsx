import React from 'react';
import { useTheme } from '../ThemeContext';
import { KronosCard } from '../kronos';

export default function LicitacionsStats({ stats, onFilter }) {
  const { colors } = useTheme();

  const items = [
    {
      key: 'pendent',
      label: 'Pendientes de revisar',
      value: stats.pendents,
      tone: colors.warning,
      filter: { estat_jc: 'Pendent' }
    },
    {
      key: 'interessant',
      label: 'Interesantes',
      value: stats.interessants,
      tone: colors.success,
      filter: { estat_jc: 'Interessant' }
    },
    {
      key: 'vencen',
      label: 'Vencen esta semana',
      value: stats.vencenSetmana,
      tone: colors.error,
      filter: { vencenSetmana: true }
    },
    {
      key: 'actives',
      label: 'Activas',
      value: stats.actives,
      tone: colors.primary,
      filter: { actives: true }
    }
  ];

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        marginBottom: 16
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
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: item.tone }}>{item.value}</div>
          </button>
        </KronosCard>
      ))}
    </div>
  );
}
