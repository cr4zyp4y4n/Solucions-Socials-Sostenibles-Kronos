import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { useObrador } from './ObradorContext';
import {
  getIncidencies,
  getLotsPerIncidencia,
  crearIncidencia,
  tancarIncidencia,
  marcarIncidenciaEnCurs
} from '../../services/obradorSupabaseService';

const TIPUS_OPCIONS = [
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'qualitat', label: 'Qualitat' },
  { value: 'contaminacio', label: 'Contaminació' },
  { value: 'etiquetatge', label: 'Etiquetatge' },
  { value: 'altres', label: 'Altres' }
];

const TIPUS_SENSOR = {
  sensor_fora_rang: 'Sensor fora de rang',
  sensor_sense_senyal: 'Sensor sense senyal'
};

const CHECKLIST_LOT = [
  { key: 'lot_revisat', label: 'S\'ha revisat el lot afectat?' },
  { key: 'accio_correctiva', label: 'S\'ha aplicat l\'acció correctiva?' },
  { key: 'registre_appcc', label: 'Queda registrat a APPCC / traçabilitat?' }
];

const CHECKLIST_SENSOR = [
  { key: 'sensor_revisat', label: 'S\'ha revisat el sensor / equip de fred?' },
  { key: 'temp_comprovada', label: 'S\'ha comprovat que la temperatura torna a rang?' },
  { key: 'accio_correctiva', label: 'S\'ha aplicat l\'acció correctiva?' },
  { key: 'registre_appcc', label: 'Queda registrat a APPCC?' }
];

const TABS = [
  { id: 'obertes', label: 'Actives', estats: ['oberta', 'en_curs'] },
  { id: 'tancades', label: 'Tancades', estat: 'tancada' },
  { id: 'totes', label: 'Totes' }
];

function formatData(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('ca', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function esSensor(inc) {
  return inc?.origen === 'sensor' || String(inc?.tipus || '').startsWith('sensor_');
}

function labelTipus(tipus) {
  if (TIPUS_SENSOR[tipus]) return TIPUS_SENSOR[tipus];
  return TIPUS_OPCIONS.find((t) => t.value === tipus)?.label || tipus || '—';
}

function labelEstat(estat) {
  if (estat === 'en_curs') return 'En revisió';
  if (estat === 'oberta') return 'Oberta';
  if (estat === 'tancada') return 'Tancada';
  return estat || '—';
}

function esActiva(inc) {
  return inc?.estat === 'oberta' || inc?.estat === 'en_curs';
}

function titolIncidencia(inc) {
  if (esSensor(inc)) {
    return inc.obrador_sensors?.nom || inc.obrador_sensors?.ubicacio || 'Sensor';
  }
  return inc.obrador_lots?.codi_lot || 'Lot —';
}

const formInicial = () => ({
  id_lot: '',
  tipus: 'temperatura',
  descripcio: ''
});

function TancarModal({ inc, colors, onCancel, onConfirm, enviant }) {
  const sensor = esSensor(inc);
  const items = sensor ? CHECKLIST_SENSOR : CHECKLIST_LOT;
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(items.map((i) => [i.key, null]))
  );
  const [notes, setNotes] = useState('');
  const [localError, setLocalError] = useState('');

  const success = colors.success || '#1D9E75';
  const danger = colors.error || '#c0392b';

  function setAnswer(key, value) {
    setAnswers((a) => ({ ...a, [key]: value }));
    setLocalError('');
  }

  function handleConfirm() {
    const missing = items.filter((i) => answers[i.key] !== true && answers[i.key] !== false);
    if (missing.length) {
      setLocalError('Cal respondre totes les preguntes (Sí / No).');
      return;
    }
    const algunaNo = items.some((i) => answers[i.key] === false);
    if (algunaNo && notes.trim().length < 5) {
      setLocalError('Si marques No en alguna pregunta, indica el motiu a observacions (mín. 5 caràcters).');
      return;
    }
    onConfirm({ checklist: { ...answers, origen: sensor ? 'sensor' : 'lot' }, notes: notes.trim() });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
      onClick={onCancel}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: colors.card || colors.surface,
          borderRadius: 12,
          border: `0.5px solid ${colors.border}`,
          padding: 24,
          color: colors.text,
          boxShadow: '0 12px 40px rgba(0,0,0,0.25)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>
          Tancar incidència {sensor ? 'de sensor' : 'de lot'}
        </h2>
        <p style={{ margin: '0 0 16px', fontSize: 14, color: colors.textSecondary }}>
          <strong>{titolIncidencia(inc)}</strong>
          {' · '}
          {labelTipus(inc.tipus)}
        </p>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary }}>
          {inc.estat === 'en_curs'
            ? 'Episodi en revisió: tanca només quan la situació estigui resolta (idealment ja a rang).'
            : 'Confirma les comprovacions abans de tancar (APPCC). Si encara està fora de rang, millor «En revisió».'}
        </p>

        <ul style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {items.map((item) => (
            <li key={item.key}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>{item.label}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { v: true, label: 'Sí' },
                  { v: false, label: 'No' }
                ].map((opt) => {
                  const actiu = answers[item.key] === opt.v;
                  return (
                    <button
                      key={String(opt.v)}
                      type="button"
                      onClick={() => setAnswer(item.key, opt.v)}
                      style={{
                        flex: 1,
                        padding: '10px 12px',
                        fontSize: 14,
                        fontWeight: 600,
                        borderRadius: 8,
                        cursor: 'pointer',
                        border: `0.5px solid ${actiu ? (opt.v ? success : danger) : colors.border}`,
                        background: actiu ? `${opt.v ? success : danger}22` : colors.surface,
                        color: actiu ? (opt.v ? success : danger) : colors.text
                      }}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>

        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, marginBottom: 6, color: colors.textSecondary }}>
          Observacions {items.some((i) => answers[i.key] === false) ? '*' : '(opcional)'}
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Acció feta, causa, etc."
          style={{
            width: '100%',
            padding: '10px 12px',
            fontSize: 14,
            borderRadius: 8,
            border: `0.5px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            boxSizing: 'border-box',
            resize: 'vertical',
            marginBottom: 12
          }}
        />

        {localError && (
          <p style={{ margin: '0 0 12px', color: danger, fontSize: 13 }}>{localError}</p>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            type="button"
            onClick={onCancel}
            disabled={enviant}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              background: colors.surface,
              color: colors.text,
              border: `0.5px solid ${colors.border}`
            }}
          >
            Cancel·lar
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={enviant}
            style={{
              padding: '10px 16px',
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
            {enviant ? 'Tancant...' : 'Confirmar tancament'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ObradorIncidenciesPage() {
  const { colors } = useTheme();
  const { navPayload, clearNavPayload } = useObrador();
  const success = colors.success || '#1D9E75';
  const danger = colors.error || '#c0392b';
  const warning = colors.warning || '#e67e22';

  const [tab, setTab] = useState('obertes');
  const [mode, setMode] = useState('llistat');
  const [incidencies, setIncidencies] = useState([]);
  const [lots, setLots] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [loading, setLoading] = useState(true);
  const [enviant, setEnviant] = useState(false);
  const [tancantId, setTancantId] = useState(null);
  const [marcantId, setMarcantId] = useState(null);
  const [modalInc, setModalInc] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const rowRefs = useRef({});

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

  const labelStyle = {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: colors.textSecondary
  };

  const tabActiu = TABS.find((t) => t.id === tab);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const filtre = {};
      if (tabActiu?.estats) filtre.estats = tabActiu.estats;
      else if (tabActiu?.estat) filtre.estat = tabActiu.estat;
      const data = await getIncidencies(100, filtre);
      setIncidencies(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tabActiu?.estat, tabActiu?.estats]);

  const carregarLots = useCallback(async () => {
    try {
      const data = await getLotsPerIncidencia();
      setLots(data);
    } catch (err) {
      console.error(err);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    if (mode === 'formulari') carregarLots();
  }, [mode, carregarLots]);

  // Des del dashboard: anar a obertes + destacar fila
  useEffect(() => {
    const id = navPayload?.incidenciaId;
    if (!id) return;
    setMode('llistat');
    setTab('obertes');
    setHighlightId(id);
    clearNavPayload?.();
  }, [navPayload, clearNavPayload]);

  useEffect(() => {
    if (!highlightId || loading) return;
    const el = rowRefs.current[highlightId];
    if (el?.scrollIntoView) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    const t = setTimeout(() => setHighlightId(null), 4000);
    return () => clearTimeout(t);
  }, [highlightId, loading, incidencies]);

  const incidenciesFiltrades = useMemo(() => incidencies, [incidencies]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.id_lot) {
      setError('Selecciona un lot.');
      return;
    }
    if (form.descripcio.trim().length < 10) {
      setError('La descripció ha de tenir almenys 10 caràcters.');
      return;
    }

    setEnviant(true);
    try {
      await crearIncidencia({
        id_lot: form.id_lot,
        tipus: form.tipus,
        descripcio: form.descripcio.trim(),
        origen: 'lot'
      });
      setSuccessMsg('Incidència registrada');
      setTimeout(() => setSuccessMsg(''), 4000);
      setForm(formInicial());
      setMode('llistat');
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en registrar la incidència');
    } finally {
      setEnviant(false);
    }
  }

  async function handleEnRevisio(inc) {
    setMarcantId(inc.id);
    setError('');
    try {
      await marcarIncidenciaEnCurs(inc.id);
      setSuccessMsg('Incidència marcada en revisió (no es reobrirà mentre duri l\'episodi)');
      setTimeout(() => setSuccessMsg(''), 4500);
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en marcar en revisió');
    } finally {
      setMarcantId(null);
    }
  }

  async function confirmarTancament({ checklist, notes }) {
    if (!modalInc) return;
    setTancantId(modalInc.id);
    setError('');
    try {
      await tancarIncidencia(modalInc.id, { checklist, notes });
      setSuccessMsg(
        esSensor(modalInc)
          ? 'Incidència de sensor tancada'
          : 'Incidència de lot tancada'
      );
      setTimeout(() => setSuccessMsg(''), 4000);
      setModalInc(null);
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en tancar la incidència');
    } finally {
      setTancantId(null);
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      {modalInc && (
        <TancarModal
          inc={modalInc}
          colors={colors}
          enviant={tancantId === modalInc.id}
          onCancel={() => setModalInc(null)}
          onConfirm={confirmarTancament}
        />
      )}

      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Incidències</h1>
        {mode === 'llistat' ? (
          <button
            type="button"
            onClick={() => { setMode('formulari'); setError(''); }}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: colors.primary,
              color: '#fff'
            }}
          >
            Nova incidència (lot)
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('llistat'); setForm(formInicial()); setError(''); }}
            style={{
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              background: colors.surface,
              color: colors.text,
              border: `0.5px solid ${colors.border}`
            }}
          >
            Tornar al llistat
          </button>
        )}
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

      {error && mode === 'llistat' && (
        <p style={{ color: danger, marginBottom: 16 }}>{error}</p>
      )}

      {mode === 'llistat' ? (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                style={{
                  padding: '8px 16px',
                  fontSize: 14,
                  fontWeight: tab === t.id ? 600 : 400,
                  borderRadius: 8,
                  border: `0.5px solid ${colors.border}`,
                  cursor: 'pointer',
                  background: tab === t.id ? `${colors.primary}22` : colors.surface,
                  color: tab === t.id ? colors.primary : colors.textSecondary
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {loading ? (
            <p style={{ color: colors.textSecondary }}>Carregant incidències...</p>
          ) : incidenciesFiltrades.length === 0 ? (
            <p style={{ color: colors.textSecondary }}>No hi ha incidències en aquesta pestanya.</p>
          ) : (
            <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                <thead>
                  <tr>
                    {['Origen', 'Referència', 'Tipus', 'Descripció', 'Data', 'Estat', 'Acció'].map((col) => (
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
                  {incidenciesFiltrades.map((inc) => {
                    const sensor = esSensor(inc);
                    const highlighted = highlightId === inc.id;
                    return (
                      <tr
                        key={inc.id}
                        ref={(el) => { if (el) rowRefs.current[inc.id] = el; }}
                        style={{
                          borderBottom: `1px solid ${colors.border}`,
                          background: highlighted ? `${colors.primary}18` : 'transparent',
                          transition: 'background 0.3s'
                        }}
                      >
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: sensor ? `${colors.primary}22` : `${warning}22`,
                            color: sensor ? colors.primary : warning
                          }}>
                            {sensor ? 'Sensor / temp.' : 'Lot'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          {titolIncidencia(inc)}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{labelTipus(inc.tipus)}</td>
                        <td style={{ padding: '12px 16px', maxWidth: 280 }}>{inc.descripcio}</td>
                        <td style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}>{formatData(inc.data_incidencia)}</td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: inc.estat === 'en_curs'
                              ? `${colors.primary}22`
                              : inc.estat === 'oberta'
                                ? `${warning}22`
                                : `${success}22`,
                            color: inc.estat === 'en_curs'
                              ? colors.primary
                              : inc.estat === 'oberta'
                                ? warning
                                : success
                          }}>
                            {labelEstat(inc.estat)}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {esActiva(inc) ? (
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {inc.estat === 'oberta' && (
                                <button
                                  type="button"
                                  disabled={marcantId === inc.id}
                                  onClick={() => handleEnRevisio(inc)}
                                  title="Reconèixer l'alerta sense tancar. Ideal si encara està fora de rang."
                                  style={{
                                    padding: '6px 10px',
                                    fontSize: 12,
                                    fontWeight: 600,
                                    borderRadius: 6,
                                    border: `0.5px solid ${colors.border}`,
                                    cursor: marcantId === inc.id ? 'not-allowed' : 'pointer',
                                    background: colors.surface,
                                    color: colors.primary
                                  }}
                                >
                                  {marcantId === inc.id ? '…' : 'En revisió'}
                                </button>
                              )}
                              <button
                                type="button"
                                disabled={tancantId === inc.id}
                                onClick={() => setModalInc(inc)}
                                style={{
                                  padding: '6px 10px',
                                  fontSize: 12,
                                  fontWeight: 600,
                                  borderRadius: 6,
                                  border: `0.5px solid ${colors.border}`,
                                  cursor: tancantId === inc.id ? 'not-allowed' : 'pointer',
                                  background: colors.surface,
                                  color: colors.text
                                }}
                              >
                                Tancar…
                              </button>
                            </div>
                          ) : (
                            '—'
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <form
          onSubmit={handleSubmit}
          style={{
            background: colors.card,
            border: `0.5px solid ${colors.border}`,
            borderRadius: 12,
            padding: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            maxWidth: 560
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
            Aquest formulari crea incidències de <strong>lot</strong>. Les d&apos;IoT (temperatura / sense senyal) s&apos;obren soles des dels sensors.
          </p>
          <div>
            <label style={labelStyle} htmlFor="id_lot">Lot *</label>
            <select
              id="id_lot"
              value={form.id_lot}
              onChange={(e) => setForm((f) => ({ ...f, id_lot: e.target.value }))}
              style={inputStyle}
              required
            >
              <option value="">Selecciona lot...</option>
              {lots.map((lot) => (
                <option key={lot.id} value={lot.id}>
                  {lot.codi_lot} — {lot.obrador_productes?.nom || 'Producte'}
                </option>
              ))}
            </select>
            {lots.length === 0 && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.textSecondary }}>
                No hi ha lots disponibles. Crea un lot primer.
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="tipus">Tipus *</label>
            <select
              id="tipus"
              value={form.tipus}
              onChange={(e) => setForm((f) => ({ ...f, tipus: e.target.value }))}
              style={inputStyle}
              required
            >
              {TIPUS_OPCIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="descripcio">Descripció * (mín. 10 caràcters)</label>
            <textarea
              id="descripcio"
              rows={4}
              value={form.descripcio}
              onChange={(e) => setForm((f) => ({ ...f, descripcio: e.target.value }))}
              style={{ ...inputStyle, resize: 'vertical' }}
              required
              minLength={10}
            />
          </div>

          {error && (
            <p style={{ margin: 0, color: danger, fontSize: 14 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={enviant || lots.length === 0}
            style={{
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: enviant || lots.length === 0 ? 'not-allowed' : 'pointer',
              opacity: enviant || lots.length === 0 ? 0.7 : 1,
              background: colors.primary,
              color: '#fff',
              alignSelf: 'flex-start'
            }}
          >
            {enviant ? 'Registrant...' : 'Registrar incidència'}
          </button>
        </form>
      )}
    </div>
  );
}
