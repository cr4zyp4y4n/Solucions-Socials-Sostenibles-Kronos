import React, { useState } from 'react';
import { useTheme } from '../ThemeContext';
import ObradorEnfortimBanner from './ObradorEnfortimBanner';

const LINIES = [
  { id: 'fred', label: 'Fred' },
  { id: 'rebosteria', label: 'Rebosteria' },
  { id: 'frescos', label: 'Frescos' }
];

/** Camps provisionals (NO esquema tancat) — només UI de discussió. */
const CAMPS_CAPCALERA = [
  'Producte / recepta',
  'Línia (fred | rebosteria | frescos)',
  'PVP',
  'Unitat de venda',
  'Versió + data revisió',
  'Actiu'
];

const CAMPS_LINIA = [
  'Ingredient / producte compra',
  'Quantitat',
  'Unitat',
  'Cost unitari (Holded)',
  'Merma %',
  'Cost línia'
];

const MOCK_ESCANDALLS = [
  { nom: 'Exemple — Quiche verdura', linia: 'frescos', margen: '—', estat: 'Placeholder' },
  { nom: 'Exemple — Pastís de formatge', linia: 'rebosteria', margen: '—', estat: 'Placeholder' },
  { nom: 'Exemple — Amanida freda', linia: 'fred', margen: '—', estat: 'Placeholder' }
];

/**
 * Esquelet Escandalls (Enfortim R2).
 * Sense CRUD real ni taules SQL definitives fins post-reunió.
 */
export default function ObradorEscandallsPage() {
  const { colors } = useTheme();
  const [liniaFiltre, setLiniaFiltre] = useState('');

  const filtrats = MOCK_ESCANDALLS.filter(
    (e) => !liniaFiltre || e.linia === liniaFiltre
  );

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 8 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Escandalls</h1>
        <p style={{ margin: '8px 0 0', color: colors.textSecondary, fontSize: 14 }}>
          Control econòmic (R2) — ≥15 fitxes · costos Holded · export PDF/Excel (pendent)
        </p>
      </header>

      <ObradorEnfortimBanner colors={colors} />

      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <select
          value={liniaFiltre}
          onChange={(e) => setLiniaFiltre(e.target.value)}
          style={{
            padding: '10px 12px',
            borderRadius: 8,
            border: `0.5px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text
          }}
        >
          <option value="">Totes les línies</option>
          {LINIES.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <button
          type="button"
          disabled
          title="Disponible després de tancar el model a la reunió"
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
          Nou escandall (aviat)
        </button>
      </div>

      <div style={{
        overflowX: 'auto',
        background: colors.card,
        border: `0.5px solid ${colors.border}`,
        borderRadius: 12,
        marginBottom: 24
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr>
              {['Fitxa', 'Línia', 'Marge', 'Estat'].map((col) => (
                <th
                  key={col}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontSize: 12,
                    textTransform: 'uppercase',
                    color: colors.textSecondary,
                    borderBottom: `1px solid ${colors.border}`
                  }}
                >
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtrats.map((row) => (
              <tr key={row.nom} style={{ borderBottom: `1px solid ${colors.border}` }}>
                <td style={{ padding: '12px 16px', fontWeight: 600 }}>{row.nom}</td>
                <td style={{ padding: '12px 16px' }}>{row.linia}</td>
                <td style={{ padding: '12px 16px' }}>{row.margen}</td>
                <td style={{ padding: '12px 16px', color: colors.textSecondary }}>{row.estat}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <section style={{
          background: colors.card,
          border: `0.5px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Capçalera (provisional)</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: colors.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
            {CAMPS_CAPCALERA.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>
        <section style={{
          background: colors.card,
          border: `0.5px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Línies d&apos;ingredient (provisional)</h2>
          <ul style={{ margin: 0, paddingLeft: 18, color: colors.textSecondary, fontSize: 13, lineHeight: 1.7 }}>
            {CAMPS_LINIA.map((c) => <li key={c}>{c}</li>)}
          </ul>
        </section>
        <section style={{
          background: colors.card,
          border: `0.5px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20
        }}>
          <h2 style={{ margin: '0 0 12px', fontSize: 16 }}>Càlcul previst</h2>
          <p style={{ margin: 0, color: colors.textSecondary, fontSize: 13, lineHeight: 1.6 }}>
            Cost ingredients × (1 + merma) + envàs + costos assignats → cost total i margen brut (€ / %).
            Contingut receptes: Bruno/Cristina. Eina: Kronos post-reunió.
          </p>
        </section>
      </div>
    </div>
  );
}
