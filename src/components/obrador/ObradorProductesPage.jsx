import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import {
  getProductes,
  getProveidors,
  setProducteProveidors,
  LOT_MULTI_RECEPCIO_SCHEMA_SQL
} from '../../services/obradorSupabaseService';

export default function ObradorProductesPage() {
  const { colors } = useTheme();
  const danger = colors.error || '#c0392b';
  const success = colors.success || '#1D9E75';

  const [productes, setProductes] = useState([]);
  const [proveidors, setProveidors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [files, setFiles] = useState([]); // { id_proveidor, ingredient_nom }
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');
  const [schemaMissing, setSchemaMissing] = useState(false);

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
    setError('');
    try {
      const [prod, provResult] = await Promise.all([getProductes(), getProveidors()]);
      setProductes(prod);
      setProveidors(provResult.proveidors || []);
      setSchemaMissing(false);
      setSelectedId((prev) => prev || prod[0]?.id || '');
    } catch (err) {
      console.error(err);
      const msg = err?.message || String(err);
      if (/obrador_producte_proveidors|does not exist|PGRST/i.test(msg)) {
        setSchemaMissing(true);
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const producte = useMemo(
    () => productes.find((p) => p.id === selectedId) || null,
    [productes, selectedId]
  );

  useEffect(() => {
    if (!producte) {
      setFiles([]);
      return;
    }
    const links = producte.obrador_producte_proveidors || [];
    setFiles(
      links.map((l) => ({
        id_proveidor: l.id_proveidor || l.obrador_proveidors?.id || '',
        ingredient_nom: l.ingredient_nom || ''
      }))
    );
  }, [producte]);

  function afegirFila() {
    setFiles((prev) => [...prev, { id_proveidor: '', ingredient_nom: '' }]);
    setOkMsg('');
  }

  function actualitzarFila(idx, patch) {
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    setOkMsg('');
  }

  function eliminarFila(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setOkMsg('');
  }

  async function guardar() {
    if (!selectedId) return;
    setSaving(true);
    setError('');
    setOkMsg('');
    try {
      const netes = files.filter((f) => f.id_proveidor);
      const claus = netes.map(
        (f) => `${f.id_proveidor}::${String(f.ingredient_nom || '').trim().toLowerCase()}`
      );
      if (new Set(claus).size !== claus.length) {
        throw new Error('Hi ha una fila duplicada (mateix proveïdor + ingredient).');
      }
      await setProducteProveidors(selectedId, netes);
      setOkMsg('Proveïdors guardats.');
      await carregar();
    } catch (err) {
      console.error(err);
      const msg = err?.message || String(err);
      if (/obrador_producte_proveidors|does not exist/i.test(msg)) {
        setSchemaMissing(true);
      }
      setError(msg);
    } finally {
      setSaving(false);
    }
  }

  if (loading && productes.length === 0) {
    return (
      <div style={{ padding: 32, color: colors.textSecondary }}>
        Carregant productes...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto', color: colors.text }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Productes</h1>
        <p style={{ margin: '8px 0 0', fontSize: 14, color: colors.textSecondary }}>
          Associa els proveïdors de matèria primera a cada producte elaborat.
          Així, en crear un lot, només es mostren les recepcions d&apos;aquests proveïdors.
        </p>
      </header>

      {schemaMissing ? (
        <div style={{
          marginBottom: 16,
          padding: 14,
          borderRadius: 10,
          background: `${danger}15`,
          border: `1px solid ${danger}55`,
          fontSize: 14,
          color: colors.text
        }}>
          Falta executar el SQL a Supabase:{' '}
          <code style={{ fontSize: 13 }}>{LOT_MULTI_RECEPCIO_SCHEMA_SQL}</code>
        </div>
      ) : null}

      {productes.length === 0 ? (
        <p style={{ color: colors.textSecondary }}>Encara no hi ha productes actius.</p>
      ) : (
        <div style={{
          background: colors.card,
          border: `0.5px solid ${colors.border}`,
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 18
        }}>
          <div>
            <label style={labelStyle} htmlFor="producte">Producte</label>
            <select
              id="producte"
              value={selectedId}
              onChange={(e) => {
                setSelectedId(e.target.value);
                setOkMsg('');
                setError('');
              }}
              style={inputStyle}
            >
              {productes.map((p) => (
                <option key={p.id} value={p.id}>{p.nom}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 10,
              gap: 12,
              flexWrap: 'wrap'
            }}>
              <span style={{ ...labelStyle, marginBottom: 0 }}>Proveïdors / ingredients</span>
              <button
                type="button"
                onClick={afegirFila}
                style={{
                  padding: '8px 14px',
                  fontSize: 13,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: `0.5px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  cursor: 'pointer'
                }}
              >
                + Afegir proveïdor
              </button>
            </div>

            {files.length === 0 ? (
              <p style={{ margin: 0, fontSize: 14, color: colors.textSecondary }}>
                Sense proveïdors. En crear el lot es mostraran totes les recepcions vàlides.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {files.map((f, idx) => (
                  <div
                    key={`fila-${idx}`}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1.4fr 1fr auto',
                      gap: 10,
                      alignItems: 'end'
                    }}
                  >
                    <div>
                      <label style={labelStyle}>Proveïdor</label>
                      <select
                        value={f.id_proveidor}
                        onChange={(e) => actualitzarFila(idx, { id_proveidor: e.target.value })}
                        style={inputStyle}
                      >
                        <option value="">Selecciona...</option>
                        {proveidors.map((p) => (
                          <option key={p.id} value={p.id}>{p.nom}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Ingredient (opcional)</label>
                      <input
                        type="text"
                        placeholder="ex. pa, pernil…"
                        value={f.ingredient_nom}
                        onChange={(e) => actualitzarFila(idx, { ingredient_nom: e.target.value })}
                        style={inputStyle}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => eliminarFila(idx)}
                      style={{
                        padding: '10px 12px',
                        fontSize: 13,
                        borderRadius: 8,
                        border: `0.5px solid ${colors.border}`,
                        background: colors.surface,
                        color: danger,
                        cursor: 'pointer',
                        marginBottom: 1
                      }}
                    >
                      Treure
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error ? <p style={{ margin: 0, color: danger, fontSize: 14 }}>{error}</p> : null}
          {okMsg ? <p style={{ margin: 0, color: success, fontSize: 14 }}>{okMsg}</p> : null}

          <button
            type="button"
            onClick={guardar}
            disabled={saving || !selectedId}
            style={{
              padding: '12px 20px',
              fontSize: 15,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.7 : 1,
              background: colors.primary,
              color: '#fff',
              alignSelf: 'flex-start'
            }}
          >
            {saving ? 'Guardant…' : 'Guardar associacions'}
          </button>
        </div>
      )}
    </div>
  );
}
