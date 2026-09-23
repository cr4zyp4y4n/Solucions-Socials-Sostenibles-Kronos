/**
 * Dashboard operatiu Obrador Ac3 — InnvESS 2026
 * Bloc IoT: sensors + Realtime + gràfic 24 h
 */
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';
import {
  getKpisDashboard,
  getProduccioSetmanal,
  getIncidenciesObertes,
  getExpedicions,
  getSensorsDashboard,
  subscribeObradorIoT,
  etiquetaEstatSensor
} from '../../services/obradorSupabaseService';
import { useObrador } from './ObradorContext';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Filler,
  Title,
  Tooltip,
  Legend
);

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

function formatHora(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('ca', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return '—';
  }
}

function SensorMiniChart({ serie, color, textSecondary }) {
  const data = useMemo(() => {
    const pts = serie || [];
    return {
      labels: pts.map((p) => {
        try {
          return new Date(p.mesura_at).toLocaleTimeString('ca', {
            hour: '2-digit',
            minute: '2-digit'
          });
        } catch {
          return '';
        }
      }),
      datasets: [
        {
          data: pts.map((p) => p.valor),
          borderColor: color,
          backgroundColor: `${color}33`,
          fill: true,
          tension: 0.3,
          pointRadius: pts.length > 40 ? 0 : 2,
          borderWidth: 1.5
        }
      ]
    };
  }, [serie, color]);

  const options = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: {
          display: true,
          ticks: {
            maxTicksLimit: 6,
            color: textSecondary,
            font: { size: 9 }
          },
          grid: { display: false }
        },
        y: {
          ticks: { color: textSecondary, font: { size: 9 } },
          grid: { color: `${textSecondary}22` }
        }
      }
    }),
    [textSecondary]
  );

  if (!serie?.length) {
    return (
      <div style={{ height: 72, display: 'flex', alignItems: 'center', color: textSecondary, fontSize: 12 }}>
        Sense lectures (24 h)
      </div>
    );
  }

  return (
    <div style={{ height: 72 }}>
      <Line data={data} options={options} />
    </div>
  );
}

export default function ObradorDashboardPage() {
  const { colors } = useTheme();
  const { navigateTo } = useObrador();

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
  const [sensors, setSensors] = useState([]);
  const [incidencies, setIncidencies] = useState([]);
  const [expedicions, setExpedicions] = useState([]);
  const [produccio, setProduccio] = useState({ labels: [], data: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [iotTick, setIotTick] = useState(0);
  const reloadTimer = useRef(null);

  const carregarTot = useCallback(async ({ soft = false } = {}) => {
    try {
      if (!soft) setError(null);
      const [k, prod, inc, exp, sens] = await Promise.all([
        getKpisDashboard(),
        getProduccioSetmanal(),
        getIncidenciesObertes(5),
        getExpedicions(5),
        getSensorsDashboard()
      ]);
      setKpis(k);
      setProduccio(prod);
      setIncidencies(inc);
      setExpedicions(exp);
      setSensors(sens);
    } catch (err) {
      console.error('Error obrador dashboard:', err);
      if (!soft) setError(err.message);
    } finally {
      if (!soft) setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregarTot();
  }, [carregarTot]);

  // Realtime: debounce per no saturar amb bursts d'uplinks
  useEffect(() => {
    const unsub = subscribeObradorIoT(() => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      reloadTimer.current = setTimeout(() => {
        setIotTick((n) => n + 1);
        carregarTot({ soft: true });
      }, 400);
    });
    return () => {
      if (reloadTimer.current) clearTimeout(reloadTimer.current);
      unsub?.();
    };
  }, [carregarTot]);

  const diffLots = kpis.lotsAvui - kpis.lotsAhir;

  const dataActual = useMemo(() => {
    const d = new Date();
    return d.toLocaleDateString('ca', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  }, []);

  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';

  const colorEstat = (estat) => {
    if (estat === 'ok') return success;
    if (estat === 'en_revisio') return colors.primary || '#3B82F6';
    if (estat === 'fora_rang' || estat === 'sense_senyal') return danger;
    if (estat === 'sense_dades') return warning;
    return colors.textSecondary;
  };

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
        {iotTick > 0 && (
          <span style={{ fontSize: 12, color: colors.textSecondary }}>
            Sensors actualitzats en viu
          </span>
        )}
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
            trendClass: kpis.incidenciesObertes > 0 ? warning : success,
            onClick: () => navigateTo('incidencies')
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
            role={item.onClick ? 'button' : undefined}
            tabIndex={item.onClick ? 0 : undefined}
            onClick={item.onClick}
            onKeyDown={item.onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') item.onClick(); } : undefined}
            style={{
              background: colors.surface,
              borderRadius: 12,
              padding: 20,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              cursor: item.onClick ? 'pointer' : 'default'
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
          <h2 style={{ margin: '0 0 4px 0', fontSize: 18, fontWeight: 600 }}>Temperatures en temps real</h2>
          <p style={{ margin: '0 0 16px 0', fontSize: 12, color: colors.textSecondary }}>
            Sensors IoT (Realtime). Llindars APPCC pendents de Cristina si encara són buits.
          </p>
          {sensors.length === 0 ? (
            <p style={{ color: colors.textSecondary, margin: '0 0 16px 0', fontSize: 14 }}>
              Sense sensors configurats.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', margin: '0 0 16px 0', padding: 0 }}>
              {sensors.map((s) => {
                const fg = colorEstat(s.estat);
                const val = s.lectura?.valor;
                return (
                  <li
                    key={s.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: `1px solid ${colors.border}`
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6 }}>
                      <div>
                        <div style={{ fontWeight: 600 }}>{s.nom}</div>
                        <div style={{ fontSize: 12, color: colors.textSecondary }}>
                          {formatHora(s.lectura?.mesura_at || s.ultima_lectura_at)}
                          {s.lectura?.humitat != null ? ` · ${s.lectura.humitat}% HR` : ''}
                          {!s.actiu ? ' · inactiu' : ''}
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 18, fontWeight: 700 }}>
                          {val != null && !Number.isNaN(val) ? `${val} °C` : '—'}
                        </div>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: `${fg}22`,
                            color: fg
                          }}
                        >
                          {etiquetaEstatSensor(s.estat)}
                        </span>
                      </div>
                    </div>
                    <SensorMiniChart
                      serie={s.serie24h}
                      color={fg}
                      textSecondary={colors.textSecondary}
                    />
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
              {incidencies.map((inc) => {
                const esSensor = inc.origen === 'sensor' || String(inc.tipus || '').startsWith('sensor_');
                const titol = esSensor
                  ? (inc.obrador_sensors?.nom || 'Sensor')
                  : `Lot ${inc.obrador_lots?.codi_lot || '—'}`;
                return (
                  <li key={inc.id} style={{ padding: '12px 0', borderBottom: `1px solid ${colors.border}` }}>
                    <button
                      type="button"
                      onClick={() => navigateTo('incidencies', { incidenciaId: inc.id })}
                      style={{
                        display: 'block',
                        width: '100%',
                        textAlign: 'left',
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        cursor: 'pointer',
                        color: 'inherit'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <span style={{ fontWeight: 600 }}>{titol}</span>
                        <span style={{
                          padding: '2px 8px',
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          background: esSensor ? `${colors.primary}22` : `${warning}22`,
                          color: esSensor ? colors.primary : warning
                        }}>
                          {esSensor ? 'Sensor' : 'Lot'}
                        </span>
                      </div>
                      <div style={{ color: colors.textSecondary, marginBottom: 6, fontSize: 14 }}>{inc.descripcio}</div>
                      <span style={{ padding: '4px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: inc.estat === 'en_curs' ? `${colors.primary}22` : inc.estat === 'oberta' ? `${danger}22` : `${success}22`, color: inc.estat === 'en_curs' ? colors.primary : inc.estat === 'oberta' ? danger : success }}>
                        {inc.estat === 'en_curs' ? 'En revisió' : inc.estat === 'oberta' ? 'Oberta' : 'Tancada'}
                        {inc.tipus ? ` · ${inc.tipus}` : ''}
                        {' · Obrir'}
                      </span>
                    </button>
                  </li>
                );
              })}
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
