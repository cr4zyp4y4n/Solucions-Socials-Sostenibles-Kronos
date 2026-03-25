/**
 * Dashboard operatiu Obrador Ac3 — InnvESS 2026
 * Integrat a Kronos. Dades simulades; més endavant connectar a l'API REST del model Ac3.
 */
import React, { useMemo } from 'react';
import { useTheme } from './ThemeContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const CONFIG = {
  tempRangs: {
    refrigeracio: { min: 0, max: 4, avis: 5 },
    congelacio: { min: -22, max: -18, avis: -17 },
    conservacio: { min: 2, max: 8, avis: 9 },
    zonaProduccio: { min: 18, max: 25, avis: 26 }
  }
};

const DADES_SIMULADES = {
  kpis: {
    lotsAvui: 12,
    lotsAhir: 10,
    alertesTemp: 1,
    incidenciesObertes: 2,
    expedicionsDia: 5,
    etiquetesGenerades: 12,
    registresAppcc: 8,
    registresAppccBuits: 0
  },
  temperatures: [
    { nom: 'Cambra 1 refrigeració', valor: 2.5, tipus: 'refrigeracio' },
    { nom: 'Cambra 2 refrigeració', valor: 5.5, tipus: 'refrigeracio' },
    { nom: 'Cambra 3 congelació', valor: -19, tipus: 'congelacio' },
    { nom: 'Cambra 4 conservació', valor: 5.0, tipus: 'conservacio' },
    { nom: 'Zona producció', valor: 21, tipus: 'zonaProduccio' }
  ],
  incidencies: [
    { id: 1, lot: 'LOT-2026-0042', descripcio: 'Temperatura límit superior a Cambra 2. Registrat i corregit.', estat: 'oberta' },
    { id: 2, lot: 'LOT-2026-0038', descripcio: 'Retard en envasat. Lot aïllat fins a validació.', estat: 'oberta' }
  ],
  produccioSetmanal: [8, 11, 9, 14, 12, 10, 12],
  expedicions: [
    { id: 1, lot: 'LOT-2026-0041', client: "Menjar d'Hort - Escola", estat: 'entregat' },
    { id: 2, lot: 'LOT-2026-0040', client: 'Catering Serveis', estat: 'en trànsit' },
    { id: 3, lot: 'LOT-2026-0039', client: 'Generalitat - InnvESS', estat: 'entregat' },
    { id: 4, lot: 'LOT-2026-0038', client: 'Cooperativa Maresme', estat: 'en trànsit' },
    { id: 5, lot: 'LOT-2026-0037', client: 'Restaurant Solucions', estat: 'entregat' }
  ]
};

function classificarTemp(valor, tipus) {
  const r = CONFIG.tempRangs[tipus] || CONFIG.tempRangs.refrigeracio;
  if (valor >= r.min && valor <= r.max) return 'ok';
  if (tipus === 'congelacio') {
    if (valor > r.max) return 'avís';
    if (valor > (r.avis || r.max + 2)) return 'crític';
    return 'avís';
  }
  if (r.avis != null) {
    if (valor < r.min || valor > r.avis) return 'crític';
    if (valor > r.max) return 'avís';
  } else {
    if (valor < r.min || valor > r.max) return 'avís';
  }
  return 'ok';
}

function sendPrompt(scope) {
  const missatges = {
    temperatures: "Protocol d'alerta de temperatures: revisar cambres en estat groc o vermell, registrar a APPCC i aplicar acció correctiva segons procediment.",
    incidencies: "Protocol d'incidències: registrar descripció, lot afectat i acció correctiva; tancar incidència quan es resolgui."
  };
  const msg = missatges[scope] || 'Acció correctiva';
  if (typeof window.sendPrompt === 'function') {
    window.sendPrompt(scope, msg);
  } else {
    // eslint-disable-next-line no-alert
    alert(msg);
  }
}

const DIES_SETMANA = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];

export default function ObradorDashboardPage() {
  const { colors } = useTheme();
  const k = DADES_SIMULADES.kpis;
  const diffLots = k.lotsAvui - k.lotsAhir;
  const dataActual = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('ca', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const chartData = useMemo(() => ({
    labels: DIES_SETMANA,
    datasets: [{
      label: 'Lots produïts',
      data: DADES_SIMULADES.produccioSetmanal,
      backgroundColor: '#1D9E75',
      borderRadius: 6,
      borderSkipped: false
    }]
  }), []);

  const chartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: colors.textSecondary, font: { size: 12 } }
      },
      y: {
        beginAtZero: true,
        ticks: { stepSize: 1, color: colors.textSecondary },
        grid: { color: colors.border }
      }
    }
  }), [colors.textSecondary, colors.border]);

  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 28 }}>
        <time style={{ display: 'block', fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>{dataActual}</time>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Resum del dia</h1>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { id: 'lots', label: 'Lots produïts avui', value: k.lotsAvui, trend: diffLots >= 0 ? `+${diffLots} respecte ahir` : `${diffLots} respecte ahir`, trendClass: diffLots > 0 ? success : diffLots < 0 ? warning : colors.textSecondary },
          { id: 'alertes', label: 'Alertes de temperatura', value: k.alertesTemp, trend: k.alertesTemp > 0 ? 'Revisar cambres' : 'Tot dins rang', trendClass: k.alertesTemp > 0 ? danger : success },
          { id: 'incidencies', label: 'Incidències obertes', value: k.incidenciesObertes, trend: k.incidenciesObertes > 0 ? 'Obertes' : 'Cap oberta', trendClass: k.incidenciesObertes > 0 ? warning : success },
          { id: 'expedicions', label: 'Expedicions del dia', value: k.expedicionsDia, trend: 'del dia', trendClass: colors.textSecondary },
          { id: 'etiquetes', label: 'Etiquetes generades', value: k.etiquetesGenerades, trend: 'generades avui', trendClass: colors.textSecondary },
          { id: 'appcc', label: 'Registres APPCC', value: k.registresAppcc, trend: k.registresAppccBuits > 0 ? `${k.registresAppccBuits} buits` : 'Completats', trendClass: k.registresAppccBuits > 0 ? warning : success }
        ].map((item) => (
          <div
            key={item.id}
            style={{
              background: colors.surface,
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start'
            }}
          >
            <span style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.04em', color: colors.textSecondary, marginBottom: 8 }}>{item.label}</span>
            <span style={{ fontSize: 32, fontWeight: 700 }}>{item.value}</span>
            <span style={{ fontSize: 13, marginTop: 4, color: item.trendClass }}>{item.trend}</span>
          </div>
        ))}
      </section>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: 20 }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Temperatures en temps real</h2>
          <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
            {DADES_SIMULADES.temperatures.map((t) => {
              const classe = classificarTemp(t.valor, t.tipus);
              const bg = classe === 'ok' ? `${success}22` : classe === 'avís' ? `${warning}22` : `${danger}22`;
              const fg = classe === 'ok' ? success : classe === 'avís' ? warning : danger;
              return (
                <li key={t.nom} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <span>{t.nom}</span>
                  <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: bg, color: fg }}>{t.valor} °C</span>
                </li>
              );
            })}
          </ul>
          <button
            type="button"
            onClick={() => sendPrompt('temperatures')}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: colors.text,
              background: colors.surface,
              border: `0.5px solid ${colors.border}`,
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Protocol temperatures
          </button>
        </div>
        <div style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: 20 }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Incidències actives</h2>
          <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
            {DADES_SIMULADES.incidencies.map((inc) => (
              <li key={inc.id} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Lot {inc.lot}</div>
                <div style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 14 }}>{inc.descripcio}</div>
                <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: inc.estat === 'oberta' ? `${danger}22` : `${success}22`, color: inc.estat === 'oberta' ? danger : success }}>
                  {inc.estat === 'oberta' ? 'Oberta' : 'Tancada'}
                </span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => sendPrompt('incidencies')}
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              color: colors.text,
              background: colors.surface,
              border: `0.5px solid ${colors.border}`,
              borderRadius: 8,
              cursor: 'pointer'
            }}
          >
            Protocol incidències
          </button>
        </div>
      </section>

      <section style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Producció setmanal (lots per dia)</h2>
        <div style={{ position: 'relative', height: 280 }}>
          <Bar data={chartData} options={chartOptions} />
        </div>
      </section>

      <section style={{ background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12, padding: 20 }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Últimes expedicions del dia</h2>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase' }}>Expedició</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase' }}>Lot</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase' }}>Client</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: colors.textSecondary, fontSize: 12, textTransform: 'uppercase' }}>Estat</th>
              </tr>
            </thead>
            <tbody>
              {DADES_SIMULADES.expedicions.map((exp) => (
                <tr key={exp.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '12px 16px' }}>#{String(exp.id).padStart(4, '0')}</td>
                  <td style={{ padding: '12px 16px' }}>{exp.lot}</td>
                  <td style={{ padding: '12px 16px' }}>{exp.client}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ padding: '4px 10px', borderRadius: 6, fontSize: 12, fontWeight: 600, background: exp.estat === 'entregat' ? `${success}22` : `${warning}22`, color: exp.estat === 'entregat' ? success : warning }}>
                      {exp.estat === 'entregat' ? 'Entregat' : 'En trànsit'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
