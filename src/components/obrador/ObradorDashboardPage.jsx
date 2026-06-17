/**
 * Dashboard operatiu Obrador Ac3 — InnvESS 2026
 */
import React, { useMemo, useState, useEffect } from 'react';
import { useTheme } from '../ThemeContext';
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
import {
  getKpisDashboard,
  getProduccioSetmanal,
  getIncidenciesObertes,
  getExpedicions,
  getTemperatures,
  classificarTemperatura
} from '../../services/obradorSupabaseService';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

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

export default function ObradorDashboardPage() {
  const { colors } = useTheme();

  const [kpis, setKpis] = useState({
    lotsAvui: 0,
    lotsAhir: 0,
    alertesTemp: 0,
    incidenciesObertes: 0,
    expedicionsDia: 0,
    etiquetesGenerades: 0,
    registresAppcc: 0,
    registresAppccBuits: 0
  });
  const [temperatures, setTemperatures] = useState([]);
  const [incidencies, setIncidencies] = useState([]);
  const [expedicions, setExpedicions] = useState([]);
  const [produccio, setProduccio] = useState({ labels: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function carregar() {
      try {
        const [k, prod, inc, exp, temps] = await Promise.all([
          getKpisDashboard(),
          getProduccioSetmanal(),
          getIncidenciesObertes(5),
          getExpedicions(5),
          getTemperatures()
        ]);
        setKpis(k);
        setProduccio(prod);
        setIncidencies(inc);
        setExpedicions(exp);
        setTemperatures(temps);
      } catch (err) {
        console.error('Error obrador dashboard:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    carregar();
  }, []);

  const diffLots = kpis.lotsAvui - kpis.lotsAhir;

  const dataActual = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('ca', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';

  const chartData = useMemo(() => ({
    labels: produccio.labels,
    datasets: [{
      label: 'Lots produïts',
      data: produccio.data,
      backgroundColor: success,
      borderRadius: 6,
      borderSkipped: false
    }]
  }), [produccio.labels, produccio.data, success]);

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

  if (loading) {
    return (
      <div style={{ padding: 32, color: colors.textSecondary }}>
        Carregant dades de l&apos;obrador...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 32, color: colors.error }}>
        Error: {error}
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1200, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 28 }}>
        <time style={{ display: 'block', fontSize: 14, color: colors.textSecondary, marginBottom: 4 }}>{dataActual}</time>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Resum del dia</h1>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          {
            id: 'lots',
            label: 'Lots produïts avui',
            value: kpis.lotsAvui,
            trend: diffLots >= 0 ? `+${diffLots} respecte ahir` : `${diffLots} respecte ahir`,
            trendClass: diffLots > 0 ? success : diffLots < 0 ? warning : colors.textSecondary
          },
          {
            id: 'alertes',
            label: 'Alertes de temperatura',
            value: kpis.alertesTemp,
            trend: kpis.alertesTemp > 0 ? 'Revisar cambres' : 'Tot dins rang',
            trendClass: kpis.alertesTemp > 0 ? danger : success
          },
          {
            id: 'incidencies',
            label: 'Incidències obertes',
            value: kpis.incidenciesObertes,
            trend: kpis.incidenciesObertes > 0 ? 'Obertes' : 'Cap oberta',
            trendClass: kpis.incidenciesObertes > 0 ? warning : success
          },
          {
            id: 'expedicions',
            label: 'Expedicions del dia',
            value: kpis.expedicionsDia,
            trend: 'del dia',
            trendClass: colors.textSecondary
          },
          {
            id: 'etiquetes',
            label: 'Etiquetes generades',
            value: kpis.etiquetesGenerades,
            trend: 'generades avui',
            trendClass: colors.textSecondary
          },
          {
            id: 'appcc',
            label: 'Registres APPCC',
            value: kpis.registresAppcc,
            trend: kpis.registresAppccBuits > 0 ? `${kpis.registresAppccBuits} buits` : 'Recepcions avui',
            trendClass: kpis.registresAppccBuits > 0 ? warning : success
          }
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
          {temperatures.length === 0 ? (
            <p style={{ color: colors.textSecondary, margin: '0 0 16px 0', fontSize: 14 }}>
              Sense dades de sensors.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
              {temperatures.map((t) => {
                const classe = classificarTemperatura(t.valor, t.tipus);
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
          )}
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
          {incidencies.length === 0 ? (
            <p style={{ color: colors.textSecondary, margin: '0 0 16px 0', fontSize: 14 }}>Cap incidència oberta.</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
              {incidencies.map((inc) => (
                <li key={inc.id} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>
                    Lot {inc.obrador_lots?.codi_lot || '—'}
                  </div>
                  <div style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 14 }}>{inc.descripcio}</div>
                  <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: inc.estat === 'oberta' ? `${danger}22` : `${success}22`, color: inc.estat === 'oberta' ? danger : success }}>
                    {inc.estat === 'oberta' ? 'Oberta' : 'Tancada'}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
        <h2 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600 }}>Últimes expedicions</h2>
        {expedicions.length === 0 ? (
          <p style={{ color: colors.textSecondary, margin: 0, fontSize: 14 }}>Encara no hi ha expedicions registrades.</p>
        ) : (
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
                {expedicions.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px 16px' }}>#{String(exp.id).slice(0, 8)}</td>
                    <td style={{ padding: '12px 16px' }}>{exp.obrador_lots?.codi_lot || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{exp.id_client || '—'}</td>
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
        )}
      </section>
    </div>
  );
}
