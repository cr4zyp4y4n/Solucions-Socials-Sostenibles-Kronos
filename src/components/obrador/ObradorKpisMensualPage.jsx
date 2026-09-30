import React, { useMemo, useState } from 'react';
import { useTheme } from '../ThemeContext';
import ObradorEnfortimBanner from './ObradorEnfortimBanner';

const KPI_DEFS = [
  {
    id: 1,
    label: 'Marge brut per línia',
    detal: 'Fred / rebosteria / frescos',
    font: 'Escandalls + vendes (R2)',
    valor: '—'
  },
  {
    id: 2,
    label: 'Cost per lot produït',
    detal: 'Mitjana del mes',
    font: 'Escandalls × lots',
    valor: '—'
  },
  {
    id: 3,
    label: 'Lots / mes i % incidències',
    detal: 'Operatiu',
    font: 'obrador_lots + incidències',
    valor: '—'
  },
  {
    id: 4,
    label: 'Compliment registres APPCC',
    detal: '% completes',
    font: 'Recepcions + check sortida + IoT',
    valor: '—'
  },
  {
    id: 5,
    label: 'Persones en inserció',
    detal: 'Impacte social',
    font: 'Manual / RRHH (acord reunió)',
    valor: '—'
  },
  {
    id: 6,
    label: 'Formació / contractacions vulnerables',
    detal: 'Impacte social',
    font: 'Manual / formació (acord reunió)',
    valor: '—'
  }
];

function mesLabel(yyyyMm) {
  const [y, m] = yyyyMm.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('ca', { month: 'long', year: 'numeric' });
}

function mesActualMadrid() {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Madrid',
      year: 'numeric',
      month: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year')?.value;
    const m = parts.find((p) => p.type === 'month')?.value;
    return `${y}-${m}`;
  } catch {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
  }
}

/**
 * Esquelet Dashboard KPI mensual (Enfortim R3).
 * Vista NOVA — no substitueix el dashboard operatiu diari.
 */
export default function ObradorKpisMensualPage() {
  const { colors } = useTheme();
  const success = colors.success || '#1D9E75';
  const [mes, setMes] = useState(mesActualMadrid);

  const mesAnterior = useMemo(() => {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }, [mes]);

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>KPIs mensuals</h1>
          <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 14 }}>
            Quadre de gestió (R3) — diferent del dashboard operatiu diari · export PDF = lliurable
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <label style={{ fontSize: 13, color: colors.textSecondary }}>
            Mes{' '}
            <input
              type="month"
              value={mes}
              onChange={(e) => setMes(e.target.value)}
              style={{
                marginLeft: 8,
                padding: '8px 10px',
                borderRadius: 8,
                border: `0.5px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text
              }}
            />
          </label>
          <button
            type="button"
            disabled
            title="Plantilla PDF pendent (patró Informe Sergi)"
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 600,
              opacity: 0.45,
              cursor: 'not-allowed'
            }}
          >
            Exportar informe PDF (aviat)
          </button>
        </div>
      </header>

      <ObradorEnfortimBanner colors={colors} />

      <p style={{ margin: '0 0 20px', fontSize: 13, color: colors.textSecondary }}>
        Comparativa prevista: <strong style={{ color: colors.text }}>{mesLabel(mes)}</strong>
        {' '}vs{' '}
        <strong style={{ color: colors.text }}>{mesLabel(mesAnterior)}</strong>
        {' '}(dades reals post-reunió).
      </p>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: 14,
        marginBottom: 28
      }}>
        {KPI_DEFS.map((kpi) => (
          <div
            key={kpi.id}
            style={{
              background: colors.card,
              border: `0.5px solid ${colors.border}`,
              borderRadius: 12,
              padding: 18
            }}
          >
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
              KPI {kpi.id}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>{kpi.label}</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>{kpi.detal}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: colors.primary }}>{kpi.valor}</div>
            <div style={{ marginTop: 10, fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
              Font: {kpi.font}
            </div>
          </div>
        ))}
      </div>

      <section style={{
        background: colors.card,
        border: `0.5px solid ${colors.border}`,
        borderRadius: 12,
        padding: 20
      }}>
        <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>Notes d&apos;implementació</h2>
        <ul style={{ margin: 0, paddingLeft: 18, color: colors.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
          <li>KPIs 1–2 depenen del mòdul Escandalls (R2).</li>
          <li>KPIs 3–4 poden alimentar-se ja de dades Ac3 (lots, incidències, recepcions, checks).</li>
          <li>KPIs 5–6: cal acordar font amb Sergi (entrada manual mensual provisional).</li>
          <li>Export PDF: reutilitzar patrons d&apos;<code>AnalyticsSergiReportView</code>.</li>
          <li style={{ color: success }}>El dashboard diari (IoT / lots avui) no es modifica amb aquesta vista.</li>
        </ul>
      </section>
    </div>
  );
}
