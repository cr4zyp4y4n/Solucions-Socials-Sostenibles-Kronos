import React, { useCallback, useEffect, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { useTheme } from '../ThemeContext';
import { useObrador } from './ObradorContext';
import { MOMENTS_TORN } from '../../../shared/obrador/checklistsTorn';
import { getRegistresTorn } from '../../services/obradorSupabaseService';

const ZONA = 'Europe/Madrid';

function diaMadrid(date = new Date()) {
  return formatInTimeZone(date, ZONA, 'yyyy-MM-dd');
}

function formatDia(iso) {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-');
  if (!y || !m || !d) return String(iso);
  return `${d}/${m}/${y}`;
}

function formatHora(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ca', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function labelMoment(id) {
  return MOMENTS_TORN.find((m) => m.id === id)?.label || id;
}

function nomDe(nom, id) {
  if (nom) return nom;
  if (id) return 'Usuari registrat';
  return '—';
}

export default function ObradorRegistresTornPage() {
  const { colors } = useTheme();
  const { navigateTo } = useObrador();
  const success = colors.success || '#1D9E75';
  const danger = colors.error || '#c0392b';
  const warning = colors.warning || '#e67e22';
  const card = colors.card || colors.surface;
  const avui = diaMadrid();

  const [dataRegistre, setDataRegistre] = useState(avui);
  const [momentActiu, setMomentActiu] = useState('inici');
  const [registres, setRegistres] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorCarrega, setErrorCarrega] = useState('');

  const desde = dataRegistre < formatInTimeZone(subDays(new Date(), 14), ZONA, 'yyyy-MM-dd')
    ? dataRegistre
    : formatInTimeZone(subDays(new Date(), 14), ZONA, 'yyyy-MM-dd');
  const fins = dataRegistre > avui ? dataRegistre : avui;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getRegistresTorn({ desde, fins });
      setRegistres(data);
      setErrorCarrega('');
    } catch (err) {
      console.error(err);
      setErrorCarrega(err.message || 'Error en carregar els registres de torn');
    } finally {
      setLoading(false);
    }
  }, [desde, fins]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function registreDe(data, moment) {
    return registres.find((row) => String(row.data).slice(0, 10) === data && row.moment === moment) || null;
  }

  const dAvui = MOMENTS_TORN.map((moment) => ({
    ...moment,
    registre: registreDe(avui, moment.id)
  }));
  const pendentsAvui = dAvui.filter((moment) => !moment.registre).map((moment) => moment.label);
  const jaFet = registreDe(dataRegistre, momentActiu);

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    fontSize: 14,
    borderRadius: 8,
    border: `0.5px solid ${colors.border}`,
    background: colors.surface,
    color: colors.text,
    boxSizing: 'border-box'
  };

  const boto = (actiu, color) => ({
    padding: '8px 14px',
    fontSize: 14,
    fontWeight: actiu ? 600 : 500,
    borderRadius: 8,
    cursor: 'pointer',
    border: `0.5px solid ${actiu ? color : colors.border}`,
    background: actiu ? `${color}22` : colors.surface,
    color: actiu ? color : colors.textSecondary
  });

  return (
    <div style={{ padding: 32, maxWidth: 980, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 20 }}>
        <h1 style={{ margin: '0 0 8px', fontSize: 28, fontWeight: 700 }}>Registres de torn</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: colors.textSecondary }}>
          Es signen al portal del mòbil. Aquí es consulta què s&apos;ha fet i què falta.
          On es va anotar una temperatura, es veu el valor llegit: no hi ha cap llindar automàtic.
        </p>
      </header>

      {errorCarrega ? (
        <p style={{ color: danger, marginTop: 0, marginBottom: 16 }}>{errorCarrega}</p>
      ) : null}

      <section style={{
        marginBottom: 24,
        padding: 16,
        borderRadius: 12,
        border: `0.5px solid ${colors.border}`,
        background: card
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Avui, {formatDia(avui)}</h2>
          <span style={{ fontSize: 14, fontWeight: 700, color: pendentsAvui.length ? warning : success }}>
            {loading
              ? 'Carregant...'
              : errorCarrega
                ? ''
                : pendentsAvui.length
                  ? `Falten: ${pendentsAvui.join(', ')}`
                  : 'Els tres registres d\'avui estan fets'}
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
          {dAvui.map((moment) => {
            const fet = Boolean(moment.registre);
            return (
              <button
                key={moment.id}
                type="button"
                onClick={() => { setDataRegistre(avui); setMomentActiu(moment.id); }}
                style={{ ...boto(momentActiu === moment.id && dataRegistre === avui, fet ? success : warning), textAlign: 'left' }}
              >
                <div>{moment.label}</div>
                <div style={{ fontSize: 12, marginTop: 4 }}>{fet ? 'Fet' : 'Pendent'}</div>
              </button>
            );
          })}
        </div>
      </section>

      <section style={{
        marginBottom: 28,
        padding: 20,
        borderRadius: 12,
        border: `0.5px solid ${colors.border}`,
        background: card
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 16 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: colors.textSecondary }}>
            Dia
            <input
              type="date"
              value={dataRegistre}
              max={avui}
              onChange={(e) => setDataRegistre(e.target.value || avui)}
              style={{ ...inputStyle, marginTop: 6, width: 180 }}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {MOMENTS_TORN.map((moment) => {
              const fet = Boolean(registreDe(dataRegistre, moment.id));
              const passat = dataRegistre < avui;
              return (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => setMomentActiu(moment.id)}
                  style={boto(momentActiu === moment.id, fet ? success : passat ? danger : colors.primary)}
                >
                  {moment.label} · {fet ? 'fet' : passat ? 'no signat' : 'pendent'}
                </button>
              );
            })}
          </div>
        </div>

        {jaFet ? (
          <RegistreLlegit
            registre={jaFet}
            colors={colors}
            success={success}
            warning={warning}
            onVeureIncidencia={(id) => navigateTo('incidencies', { incidenciaId: id })}
          />
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: dataRegistre < avui ? danger : colors.textSecondary }}>
            {dataRegistre < avui
              ? 'No signat. El dia ja ha passat i el registre no es completa després.'
              : 'Pendent. Es signa al portal del mòbil.'}
          </p>
        )}
      </section>

      <section>
        <h2 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 700 }}>Darrers registres</h2>
        {loading ? (
          <p style={{ color: colors.textSecondary }}>Carregant registres...</p>
        ) : registres.length === 0 ? (
          <p style={{ color: colors.textSecondary }}>Encara no hi ha registres en aquest període.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Dia', 'Moment', 'Operari', 'Registrat per', 'Quan', 'No conformitat'].map((col) => (
                    <th
                      key={col}
                      style={{
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: colors.textSecondary,
                        fontSize: 12,
                        textTransform: 'uppercase',
                        borderBottom: `1px solid ${colors.border}`
                      }}
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {registres.filter((registre) => registre.moment).map((registre) => (
                  <tr key={registre.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px 16px' }}>{formatDia(registre.data)}</td>
                    <td style={{ padding: '12px 16px' }}>{labelMoment(registre.moment)}</td>
                    <td style={{ padding: '12px 16px' }}>{registre.operari_nom || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{nomDe(registre.registrat_per_nom, registre.registrat_per)}</td>
                    <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatHora(registre.created_at)}</td>
                    <td style={{ padding: '12px 16px', color: registre.incidencia_detectada ? warning : success, fontWeight: 600 }}>
                      {registre.incidencia_detectada ? 'Sí' : 'No'}
                      {registre.id_incidencia ? ' · incidència' : ''}
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

function RegistreLlegit({ registre, colors, success, warning, onVeureIncidencia }) {
  const items = Array.isArray(registre.items) ? registre.items : [];
  return (
    <div>
      <p style={{ margin: '0 0 12px', fontSize: 14, color: colors.textSecondary }}>
        Ja registrat per {nomDe(registre.registrat_per_nom, registre.registrat_per)}
        {' · '}
        {formatHora(registre.created_at)}
        {registre.operari_nom ? ` · Operari: ${registre.operari_nom}` : ''}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {items.map((item) => (
          <li key={item.clau} style={{ fontSize: 14 }}>
            <strong style={{ color: item.ok ? success : warning }}>{item.ok ? 'Sí' : 'No'}</strong>
            {' · '}
            {item.etiqueta}
            {item.valor ? ` · ${item.valor}` : ''}
            {item.nota ? ` · ${item.nota}` : ''}
          </li>
        ))}
      </ul>
      {registre.observacions ? (
        <p style={{ margin: '12px 0 0', fontSize: 14 }}>{registre.observacions}</p>
      ) : null}
      {registre.id_incidencia ? (
        <button
          type="button"
          onClick={() => onVeureIncidencia(registre.id_incidencia)}
          style={{
            marginTop: 12,
            padding: '8px 14px',
            fontSize: 13,
            fontWeight: 600,
            borderRadius: 8,
            border: `0.5px solid ${colors.border}`,
            background: colors.surface,
            color: colors.primary,
            cursor: 'pointer'
          }}
        >
          Veure incidència
        </button>
      ) : null}
    </div>
  );
}
