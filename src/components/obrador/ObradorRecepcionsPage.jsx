import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import { getProveidors, getRecepcions, crearRecepcio } from '../../services/obradorSupabaseService';

const ESTATS = [
  { value: 'bo', label: 'Bo' },
  { value: 'regular', label: 'Regular' },
  { value: 'rebutjat', label: 'Rebutjat' }
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

function demaIso() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

const formInicial = () => ({
  id_proveidor: '',
  lot_proveidor: '',
  temperatura_arribada: '',
  estat: 'bo',
  caducitat: demaIso(),
  congelat: false,
  observacions: '',
  operari: ''
});

export default function ObradorRecepcionsPage() {
  const { colors } = useTheme();
  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';

  const [mode, setMode] = useState('llistat');
  const [recepcions, setRecepcions] = useState([]);
  const [proveidors, setProveidors] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [loading, setLoading] = useState(true);
  const [enviant, setEnviant] = useState(false);
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

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [rec, prov] = await Promise.all([getRecepcions(), getProveidors()]);
      setRecepcions(rec);
      setProveidors(prov);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const tempNum = form.temperatura_arribada === '' ? null : Number(form.temperatura_arribada);
  const tempAlta = tempNum != null && !Number.isNaN(tempNum) && tempNum > 5;

  function estatColor(estat) {
    if (estat === 'bo') return success;
    if (estat === 'regular') return warning;
    return danger;
  }

  function estatLabel(estat) {
    return ESTATS.find((e) => e.value === estat)?.label || estat || '—';
  }

  function actualitzar(camp, valor) {
    setForm((prev) => ({ ...prev, [camp]: valor }));
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.id_proveidor) {
      setError('Selecciona un proveïdor.');
      return;
    }
    if (!form.caducitat) {
      setError('La caducitat és obligatòria.');
      return;
    }
    if (form.estat === 'rebutjat' && !form.observacions.trim()) {
      setError('Les observacions són obligatòries si l\'estat és Rebutjat.');
      return;
    }

    setEnviant(true);
    try {
      await crearRecepcio({
        id_proveidor: form.id_proveidor,
        lot_proveidor: form.lot_proveidor || null,
        temperatura_arribada: tempNum,
        estat: form.estat,
        caducitat: form.caducitat,
        congelat: form.congelat,
        observacions: form.observacions || null,
        operari: form.operari || null
      });
      setSuccessMsg('Recepció registrada correctament');
      setTimeout(() => setSuccessMsg(''), 4000);
      setForm(formInicial());
      setMode('llistat');
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en registrar la recepció');
    } finally {
      setEnviant(false);
    }
  }

  if (loading && mode === 'llistat' && recepcions.length === 0) {
    return (
      <div style={{ padding: 32, color: colors.textSecondary }}>
        Carregant recepcions...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Recepcions</h1>
        {mode === 'llistat' ? (
          <button
            type="button"
            onClick={() => { setMode('formulari'); setError(''); setSuccessMsg(''); }}
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
            Nova recepció
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('llistat'); setError(''); setForm(formInicial()); }}
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

      {mode === 'llistat' ? (
        recepcions.length === 0 ? (
          <p style={{ color: colors.textSecondary }}>Encara no hi ha recepcions registrades.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Data', 'Proveïdor', 'Lot proveïdor', 'Temp.', 'Estat', 'Congelat'].map((col) => (
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
                {recepcions.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px 16px' }}>{formatData(r.data_recepcio)}</td>
                    <td style={{ padding: '12px 16px' }}>{r.obrador_proveidors?.nom || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{r.lot_proveidor || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      {r.temperatura_arribada != null ? `${r.temperatura_arribada} °C` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: `${estatColor(r.estat)}22`,
                        color: estatColor(r.estat)
                      }}>
                        {estatLabel(r.estat)}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{r.congelat ? 'Sí' : 'No'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
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
            gap: 18
          }}
        >
          <div>
            <label style={labelStyle} htmlFor="id_proveidor">Proveïdor *</label>
            <select
              id="id_proveidor"
              value={form.id_proveidor}
              onChange={(e) => actualitzar('id_proveidor', e.target.value)}
              style={inputStyle}
              required
            >
              <option value="">Selecciona proveïdor...</option>
              {proveidors.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={labelStyle} htmlFor="lot_proveidor">Lot del proveïdor</label>
            <input
              id="lot_proveidor"
              type="text"
              value={form.lot_proveidor}
              onChange={(e) => actualitzar('lot_proveidor', e.target.value)}
              style={inputStyle}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="temperatura_arribada">Temperatura d&apos;arribada (°C)</label>
            <input
              id="temperatura_arribada"
              type="number"
              step="0.1"
              value={form.temperatura_arribada}
              onChange={(e) => actualitzar('temperatura_arribada', e.target.value)}
              style={inputStyle}
            />
            {tempAlta && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: warning, fontWeight: 600 }}>
                Temperatura alta (&gt;5°C). Considera registrar incidència.
              </p>
            )}
          </div>

          <div>
            <span style={labelStyle}>Estat</span>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {ESTATS.map((opt) => (
                <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="radio"
                    name="estat"
                    value={opt.value}
                    checked={form.estat === opt.value}
                    onChange={(e) => actualitzar('estat', e.target.value)}
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label style={labelStyle} htmlFor="caducitat">Caducitat *</label>
            <input
              id="caducitat"
              type="date"
              value={form.caducitat}
              onChange={(e) => actualitzar('caducitat', e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
              <input
                type="checkbox"
                checked={form.congelat}
                onChange={(e) => actualitzar('congelat', e.target.checked)}
              />
              Producte congelat
            </label>
            {form.congelat && (
              <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.primary }}>
                Es registrarà flux de descongelat.
              </p>
            )}
          </div>

          <div>
            <label style={labelStyle} htmlFor="observacions">Observacions</label>
            <textarea
              id="observacions"
              rows={3}
              value={form.observacions}
              onChange={(e) => actualitzar('observacions', e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }}
            />
          </div>

          <div>
            <label style={labelStyle} htmlFor="operari">Operari</label>
            <input
              id="operari"
              type="text"
              value={form.operari}
              onChange={(e) => actualitzar('operari', e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <p style={{ margin: 0, color: danger, fontSize: 14 }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={enviant}
            style={{
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: enviant ? 'not-allowed' : 'pointer',
              opacity: enviant ? 0.7 : 1,
              background: colors.primary,
              color: '#fff',
              alignSelf: 'flex-start'
            }}
          >
            {enviant ? 'Registrant...' : 'Registrar recepció'}
          </button>
        </form>
      )}
    </div>
  );
}
