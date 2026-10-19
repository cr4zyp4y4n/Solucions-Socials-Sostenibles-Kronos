import React, { useCallback, useEffect, useState } from 'react';
import { formatInTimeZone } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { useTheme } from '../ThemeContext';
import { useObrador } from './ObradorContext';
import { CHECKLISTS_TORN, MOMENTS_TORN } from '../../../shared/obrador/checklistsTorn';
import {
  getRegistresTorn,
  getRegistreTornDelDia,
  crearRegistreTorn,
  crearIncidencia,
  getOperaris
} from '../../services/obradorSupabaseService';

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

function respostesBuides(moment) {
  return Object.fromEntries(
    (CHECKLISTS_TORN[moment] || []).map((item) => [item.clau, { ok: null, valor: '', nota: '' }])
  );
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
  const [operaris, setOperaris] = useState([]);
  const [respostes, setRespostes] = useState(() => respostesBuides('inici'));
  const [operariId, setOperariId] = useState('');
  const [observacions, setObservacions] = useState('');
  const [pas, setPas] = useState('formulari');
  const [loading, setLoading] = useState(true);
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');
  const [errorCarrega, setErrorCarrega] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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

  useEffect(() => {
    getOperaris()
      .then(setOperaris)
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    setRespostes(respostesBuides(momentActiu));
    setPas('formulari');
    setObservacions('');
  }, [momentActiu, dataRegistre]);

  function registreDe(data, moment) {
    return registres.find((row) => String(row.data).slice(0, 10) === data && row.moment === moment) || null;
  }

  const dAvui = MOMENTS_TORN.map((moment) => ({
    ...moment,
    registre: registreDe(avui, moment.id)
  }));
  const pendentsAvui = dAvui.filter((moment) => !moment.registre).map((moment) => moment.label);
  const jaFet = registreDe(dataRegistre, momentActiu);
  const checklist = CHECKLISTS_TORN[momentActiu] || [];

  function construirItems() {
    for (const def of checklist) {
      const resposta = respostes[def.clau];
      if (resposta?.ok !== true && resposta?.ok !== false) {
        setError('Cal respondre tots els ítems (Sí / No).');
        return null;
      }
      if (resposta.ok && def.demanaValor && !String(resposta.valor || '').trim()) {
        setError(`Cal indicar el valor de: ${def.etiqueta}.`);
        return null;
      }
    }
    setError('');
    return checklist.map((def) => ({
      clau: def.clau,
      etiqueta: def.etiqueta,
      ok: respostes[def.clau].ok,
      valor: respostes[def.clau].valor,
      nota: respostes[def.clau].nota
    }));
  }

  async function desar(items, obrirIncidencia) {
    setEnviant(true);
    setError('');
    try {
      const existent = await getRegistreTornDelDia(dataRegistre, momentActiu);
      if (existent) {
        throw new Error('Ja hi ha un registre d\'aquest moment per aquest dia.');
      }

      let idIncidencia = null;
      if (obrirIncidencia) {
        const linies = items
          .filter((item) => item.ok === false)
          .map((item) => {
            const extra = [item.valor, item.nota].filter(Boolean).join('. ');
            return extra ? `${item.etiqueta}: ${extra}` : item.etiqueta;
          });
        const descripcio = `No conformitat al registre de ${labelMoment(momentActiu).toLowerCase()} del ${formatDia(dataRegistre)}. ${linies.join('. ')}.`;
        const incidencia = await crearIncidencia({
          origen: 'torn',
          tipus: 'qualitat',
          descripcio
        });
        idIncidencia = incidencia.id;
      }

      await crearRegistreTorn({
        data: dataRegistre,
        moment: momentActiu,
        id_operari: operariId || null,
        items,
        id_incidencia: idIncidencia,
        observacions
      });

      setSuccessMsg(obrirIncidencia
        ? 'Registre desat i incidència oberta'
        : 'Registre de torn desat');
      setTimeout(() => setSuccessMsg(''), 4000);
      setPas('formulari');
      setOperariId('');
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en desar el registre');
    } finally {
      setEnviant(false);
    }
  }

  async function handleRegistrar() {
    const items = construirItems();
    if (!items) return;
    const noConformes = items.filter((item) => item.ok === false);
    if (noConformes.length) {
      setPas('confirmar');
      return;
    }
    await desar(items, false);
  }

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
          Esborrany tècnic. El contingut definitiu l&apos;ha de validar la responsable de qualitat.
          On es demana una temperatura, s&apos;anota el valor llegit: no hi ha cap llindar automàtic.
        </p>
      </header>

      {successMsg && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: `${success}22`,
          color: success,
          fontSize: 14,
          fontWeight: 600
        }}>
          {successMsg}
        </div>
      )}
      {(errorCarrega || error) && (
        <p style={{ color: danger, marginTop: 0, marginBottom: 16 }}>{errorCarrega || error}</p>
      )}

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
              return (
                <button
                  key={moment.id}
                  type="button"
                  onClick={() => setMomentActiu(moment.id)}
                  style={boto(momentActiu === moment.id, fet ? success : colors.primary)}
                >
                  {moment.label} · {fet ? 'fet' : 'pendent'}
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
          <>
            <div style={{ marginBottom: 16, maxWidth: 420 }}>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.textSecondary }}>
                Operari del torn (opcional)
              </label>
              <select value={operariId} onChange={(e) => setOperariId(e.target.value)} style={inputStyle}>
                <option value="">Sense indicar</option>
                {operaris.map((operari) => (
                  <option key={operari.id} value={operari.id}>{operari.nom}</option>
                ))}
              </select>
            </div>

            <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {checklist.map((item) => {
                const resposta = respostes[item.clau] || { ok: null, valor: '', nota: '' };
                return (
                  <li key={item.clau}>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{item.etiqueta}</div>
                    <div style={{ display: 'flex', gap: 8, maxWidth: 280 }}>
                      {[{ v: true, label: 'Sí', color: success }, { v: false, label: 'No', color: danger }].map((opt) => {
                        const actiu = resposta.ok === opt.v;
                        return (
                          <button
                            key={String(opt.v)}
                            type="button"
                            onClick={() => {
                              setPas('formulari');
                            setRespostes((prev) => ({
                              ...prev,
                              [item.clau]: { ...(prev[item.clau] || resposta), ok: opt.v }
                            }));
                            }}
                            style={boto(actiu, opt.color)}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    {item.demanaValor && (
                      <input
                        value={resposta.valor}
                        onChange={(e) => setRespostes((prev) => ({
                          ...prev,
                          [item.clau]: { ...(prev[item.clau] || resposta), valor: e.target.value }
                        }))}
                        placeholder="Valor llegit, sense límit"
                        style={{ ...inputStyle, marginTop: 8, maxWidth: 420 }}
                      />
                    )}
                    <input
                      value={resposta.nota}
                      onChange={(e) => setRespostes((prev) => ({
                        ...prev,
                        [item.clau]: { ...(prev[item.clau] || resposta), nota: e.target.value }
                      }))}
                      placeholder="Nota (opcional)"
                      style={{ ...inputStyle, marginTop: 8, maxWidth: 420 }}
                    />
                  </li>
                );
              })}
            </ul>

            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.textSecondary }}>
              Observacions
            </label>
            <textarea
              rows={3}
              value={observacions}
              onChange={(e) => setObservacions(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical', marginBottom: 16, maxWidth: 560 }}
            />

            {pas === 'confirmar' && (
              <div style={{
                marginBottom: 16,
                padding: 14,
                borderRadius: 8,
                background: `${warning}18`,
                border: `0.5px solid ${warning}`,
                maxWidth: 560
              }}>
                <p style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600 }}>
                  Hi ha ítems no conformes. Vols obrir una incidència enllaçada?
                </p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    disabled={enviant}
                    onClick={() => {
                      const items = construirItems();
                      if (items) desar(items, true);
                    }}
                    style={{ ...boto(true, colors.primary), border: 'none', color: '#fff', background: colors.primary }}
                  >
                    {enviant ? 'Desant...' : 'Registrar i obrir incidència'}
                  </button>
                  <button
                    type="button"
                    disabled={enviant}
                    onClick={() => {
                      const items = construirItems();
                      if (items) desar(items, false);
                    }}
                    style={boto(false, colors.text)}
                  >
                    Registrar sense incidència
                  </button>
                </div>
              </div>
            )}

            {pas === 'formulari' && (
              <button
                type="button"
                disabled={enviant}
                onClick={handleRegistrar}
                style={{
                  padding: '10px 18px',
                  fontSize: 14,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: 'none',
                  cursor: enviant ? 'not-allowed' : 'pointer',
                  background: colors.primary,
                  color: '#fff',
                  opacity: enviant ? 0.7 : 1
                }}
              >
                {enviant ? 'Desant...' : `Registrar ${labelMoment(momentActiu).toLowerCase()}`}
              </button>
            )}
          </>
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
                {registres.map((registre) => (
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
      {registre.observacions && (
        <p style={{ margin: '12px 0 0', fontSize: 14 }}>{registre.observacions}</p>
      )}
      {registre.id_incidencia && (
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
      )}
    </div>
  );
}
