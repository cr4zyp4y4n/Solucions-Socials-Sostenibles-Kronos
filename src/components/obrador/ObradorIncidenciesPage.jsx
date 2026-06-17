import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import {
  getIncidencies,
  getLotsPerIncidencia,
  crearIncidencia,
  tancarIncidencia
} from '../../services/obradorSupabaseService';

const TIPUS_OPCIONS = [
  { value: 'temperatura', label: 'Temperatura' },
  { value: 'qualitat', label: 'Qualitat' },
  { value: 'contaminacio', label: 'Contaminació' },
  { value: 'etiquetatge', label: 'Etiquetatge' },
  { value: 'altres', label: 'Altres' }
];

const TABS = [
  { id: 'obertes', label: 'Obertes', estat: 'oberta' },
  { id: 'tancades', label: 'Tancades', estat: 'tancada' },
  { id: 'totes', label: 'Totes', estat: null }
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

function labelTipus(tipus) {
  return TIPUS_OPCIONS.find((t) => t.value === tipus)?.label || tipus || '—';
}

const formInicial = () => ({
  id_lot: '',
  tipus: 'temperatura',
  descripcio: ''
});

export default function ObradorIncidenciesPage() {
  const { colors } = useTheme();
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
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

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
      const filtre = tabActiu?.estat ? { estat: tabActiu.estat } : {};
      const data = await getIncidencies(100, filtre);
      setIncidencies(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tabActiu?.estat]);

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
        descripcio: form.descripcio.trim()
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

  async function handleTancar(id, codiLot) {
    // eslint-disable-next-line no-alert
    const ok = window.confirm(
      `Vols tancar la incidència del lot ${codiLot || ''}?`
    );
    if (!ok) return;

    setTancantId(id);
    setError('');
    try {
      await tancarIncidencia(id);
      setSuccessMsg('Incidència tancada');
      setTimeout(() => setSuccessMsg(''), 4000);
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en tancar la incidència');
    } finally {
      setTancantId(null);
    }
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
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
            Nova incidència
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
                    {['Lot', 'Tipus', 'Descripció', 'Data', 'Estat', 'Acció'].map((col) => (
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
                  {incidenciesFiltrades.map((inc) => (
                    <tr key={inc.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {inc.obrador_lots?.codi_lot || '—'}
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
                          background: inc.estat === 'oberta' ? `${warning}22` : `${success}22`,
                          color: inc.estat === 'oberta' ? warning : success
                        }}>
                          {inc.estat === 'oberta' ? 'Oberta' : 'Tancada'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {inc.estat === 'oberta' ? (
                          <button
                            type="button"
                            disabled={tancantId === inc.id}
                            onClick={() => handleTancar(inc.id, inc.obrador_lots?.codi_lot)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 13,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: `0.5px solid ${colors.border}`,
                              cursor: tancantId === inc.id ? 'not-allowed' : 'pointer',
                              background: colors.surface,
                              color: colors.text
                            }}
                          >
                            {tancantId === inc.id ? 'Tancant...' : 'Tancar'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  ))}
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
