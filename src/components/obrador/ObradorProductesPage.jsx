import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import {
  getProductes,
  getProveidors,
  setProducteProveidors,
  crearProducte,
  actualitzarProducte,
  arxivarProducte,
  LOT_MULTI_RECEPCIO_SCHEMA_SQL
} from '../../services/obradorSupabaseService';
import ObradorProveidorSelect from './ObradorProveidorSelect';
import { useAuth } from '../AuthContext';

const fitxaBuida = () => ({
  nom: '',
  caducitat_dies: '',
  allergens: [],
  temp_coccio: '',
  temp_conservacio: '',
  fitxa_tecnica: ''
});

function fitxaDesDeProducte(producte) {
  if (!producte) return fitxaBuida();
  return {
    nom: producte.nom || '',
    caducitat_dies: producte.caducitat_dies ?? '',
    allergens: Array.isArray(producte.allergens) ? [...producte.allergens] : [],
    temp_coccio: producte.temp_coccio ?? '',
    temp_conservacio: producte.temp_conservacio ?? '',
    fitxa_tecnica: producte.fitxa_tecnica || ''
  };
}

export default function ObradorProductesPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const role = String(user?.user_metadata?.role || user?.role || '').toLowerCase();
  const canEscriure = ['admin', 'management', 'manager'].includes(role);
  const danger = colors.error || '#c0392b';
  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';

  const [productes, setProductes] = useState([]);
  const [proveidors, setProveidors] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [modeNou, setModeNou] = useState(false);
  const [mostrarInactius, setMostrarInactius] = useState(false);
  const [fitxa, setFitxa] = useState(fitxaBuida);
  const [allergenNou, setAllergenNou] = useState('');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingFitxa, setSavingFitxa] = useState(false);
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
      const [prod, provResult] = await Promise.all([
        getProductes({ incloureInactius: mostrarInactius }),
        getProveidors()
      ]);
      setProductes(prod);
      setProveidors(provResult.proveidors || []);
      setSchemaMissing(false);
      setSelectedId((prev) => {
        if (prev && prod.some((p) => p.id === prev)) return prev;
        return prod[0]?.id || '';
      });
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
  }, [mostrarInactius]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const producte = useMemo(
    () => productes.find((p) => p.id === selectedId) || null,
    [productes, selectedId]
  );

  useEffect(() => {
    if (modeNou) return;
    setFitxa(fitxaDesDeProducte(producte));
    setAllergenNou('');
  }, [producte, modeNou]);

  useEffect(() => {
    if (modeNou || !producte) {
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
  }, [producte, modeNou]);

  function exigirEscriure() {
    if (canEscriure) return;
    throw new Error('Només el rol de gestió pot modificar la fitxa de producte.');
  }

  function afegirFila() {
    if (!canEscriure) return;
    setFiles((prev) => [...prev, { id_proveidor: '', ingredient_nom: '' }]);
    setOkMsg('');
  }

  function actualitzarFila(idx, patch) {
    if (!canEscriure) return;
    setFiles((prev) => prev.map((f, i) => (i === idx ? { ...f, ...patch } : f)));
    setOkMsg('');
  }

  function eliminarFila(idx) {
    if (!canEscriure) return;
    setFiles((prev) => prev.filter((_, i) => i !== idx));
    setOkMsg('');
  }

  function afegirAllergen() {
    if (!canEscriure) return;
    const text = allergenNou.trim();
    if (!text) return;
    if (text.includes(',')) {
      setError('Afegeix cada al·lergen per separat, sense comes.');
      return;
    }
    setError('');
    setFitxa((prev) => {
      const jaHiEs = prev.allergens.some((a) => a.toLowerCase() === text.toLowerCase());
      if (jaHiEs) return prev;
      return { ...prev, allergens: [...prev.allergens, text] };
    });
    setAllergenNou('');
  }

  function treureAllergen(idx) {
    if (!canEscriure) return;
    setFitxa((prev) => ({
      ...prev,
      allergens: prev.allergens.filter((_, i) => i !== idx)
    }));
  }

  function validarFitxaLocal() {
    const nom = fitxa.nom.trim();
    if (!nom) return 'El nom és obligatori.';
    const actiu = modeNou || producte?.actiu !== false;
    if (actiu) {
      const duplicat = productes.some(
        (p) => p.actiu !== false
          && p.id !== producte?.id
          && String(p.nom || '').trim().toLowerCase() === nom.toLowerCase()
      );
      if (duplicat) return 'Ja hi ha un producte actiu amb aquest nom.';
    }
    const dies = Number(fitxa.caducitat_dies);
    if (!Number.isInteger(dies) || dies <= 0) {
      return 'La caducitat en dies és obligatòria i ha de ser més gran que zero.';
    }
    return '';
  }

  async function desarFitxa() {
    setError('');
    setOkMsg('');
    try {
      exigirEscriure();
    } catch (err) {
      setError(err.message);
      return;
    }
    const validacio = validarFitxaLocal();
    if (validacio) {
      setError(validacio);
      return;
    }
    setSavingFitxa(true);
    try {
      if (modeNou) {
        const creat = await crearProducte(fitxa);
        setModeNou(false);
        setSelectedId(creat.id);
        setOkMsg('Producte creat.');
      } else if (producte?.id) {
        await actualitzarProducte(producte.id, fitxa);
        setOkMsg('Fitxa desada.');
      }
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en desar la fitxa');
    } finally {
      setSavingFitxa(false);
    }
  }

  async function arxivar() {
    if (!producte?.id || producte.actiu === false) return;
    try {
      exigirEscriure();
    } catch (err) {
      setError(err.message);
      return;
    }
    const ok = window.confirm(
      `Arxivar «${producte.nom}»? Deixarà de sortir en crear lots nous. Els lots ja fets el continuen mostrant.`
    );
    if (!ok) return;
    setSavingFitxa(true);
    setError('');
    setOkMsg('');
    try {
      await arxivarProducte(producte.id);
      setMostrarInactius(true);
      setOkMsg('Producte arxivat. Els lots antics el conserven.');
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en arxivar el producte');
    } finally {
      setSavingFitxa(false);
    }
  }

  async function guardar() {
    if (!selectedId || modeNou) return;
    setError('');
    setOkMsg('');
    try {
      exigirEscriure();
    } catch (err) {
      setError(err.message);
      return;
    }
    setSaving(true);
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

  const senseControlCoccio = String(fitxa.temp_coccio).trim() === '';
  const bloquejat = !canEscriure;

  if (loading && productes.length === 0 && !modeNou) {
    return (
      <div style={{ padding: 32, color: colors.textSecondary }}>
        Carregant productes...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 900, margin: '0 auto', color: colors.text }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Productes</h1>
          <p style={{ margin: '8px 0 0', fontSize: 14, color: colors.textSecondary, maxWidth: 560 }}>
            Fitxa del producte elaborat i proveïdors de matèria primera.
            En crear un lot només es mostren les recepcions d&apos;aquests proveïdors.
          </p>
        </div>
        {canEscriure ? (
          <button
            type="button"
            onClick={() => {
              setModeNou(true);
              setFitxa(fitxaBuida());
              setAllergenNou('');
              setError('');
              setOkMsg('');
            }}
            style={{
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              cursor: 'pointer'
            }}
          >
            Nou producte
          </button>
        ) : null}
      </header>

      {!canEscriure ? (
        <p style={{ margin: '0 0 16px', fontSize: 14, color: warning, fontWeight: 600 }}>
          Només el rol de gestió pot modificar la fitxa. Pots consultar-la, no desar-la.
        </p>
      ) : null}

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

      <div style={{
        background: colors.card,
        border: `0.5px solid ${colors.border}`,
        borderRadius: 12,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ flex: 1, minWidth: 220 }}>
            <label style={labelStyle} htmlFor="producte">Producte</label>
            <select
              id="producte"
              value={modeNou ? '' : selectedId}
              onChange={(e) => {
                setModeNou(false);
                setSelectedId(e.target.value);
                setOkMsg('');
                setError('');
              }}
              style={inputStyle}
            >
              {modeNou ? <option value="">— Producte nou —</option> : null}
              {productes.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nom}{p.actiu === false ? ' (inactiu)' : ''}
                </option>
              ))}
            </select>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, paddingBottom: 10 }}>
            <input
              type="checkbox"
              checked={mostrarInactius}
              onChange={(e) => setMostrarInactius(e.target.checked)}
            />
            Mostrar inactius
          </label>
        </div>

        {productes.length === 0 && !modeNou ? (
          <p style={{ margin: 0, color: colors.textSecondary }}>Encara no hi ha productes actius.</p>
        ) : (
          <>
            <div>
              <label style={labelStyle} htmlFor="nom_producte">Nom *</label>
              <input
                id="nom_producte"
                type="text"
                value={fitxa.nom}
                disabled={bloquejat}
                onChange={(e) => setFitxa((f) => ({ ...f, nom: e.target.value }))}
                style={inputStyle}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
              <div>
                <label style={labelStyle} htmlFor="caducitat_dies">Caducitat (dies) *</label>
                <input
                  id="caducitat_dies"
                  type="number"
                  min="1"
                  step="1"
                  value={fitxa.caducitat_dies}
                  disabled={bloquejat}
                  onChange={(e) => setFitxa((f) => ({ ...f, caducitat_dies: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="temp_coccio">Temperatura de cocció (°C)</label>
                <input
                  id="temp_coccio"
                  type="number"
                  step="0.1"
                  value={fitxa.temp_coccio}
                  disabled={bloquejat}
                  onChange={(e) => setFitxa((f) => ({ ...f, temp_coccio: e.target.value }))}
                  style={inputStyle}
                />
              </div>
              <div>
                <label style={labelStyle} htmlFor="temp_conservacio">Temperatura de conservació (°C)</label>
                <input
                  id="temp_conservacio"
                  type="number"
                  step="0.1"
                  value={fitxa.temp_conservacio}
                  disabled={bloquejat}
                  onChange={(e) => setFitxa((f) => ({ ...f, temp_conservacio: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            </div>

            <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
              Les temperatures són una referència tècnica, no un criteri APPCC validat.
              El criteri sanitari el fixa la responsable de qualitat.
            </p>
            {senseControlCoccio ? (
              <p style={{ margin: 0, fontSize: 13, color: warning, fontWeight: 600 }}>
                Sense temperatura de cocció, aquest producte no tindrà control de cocció en crear el lot.
              </p>
            ) : null}

            <div>
              <span style={labelStyle}>Al·lèrgens</span>
              {fitxa.allergens.length === 0 ? (
                <p style={{ margin: '0 0 8px', fontSize: 13, color: colors.textSecondary }}>Cap al·lergen declarat.</p>
              ) : (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {fitxa.allergens.map((nom, idx) => (
                    <span
                      key={`${nom}-${idx}`}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '4px 8px',
                        borderRadius: 999,
                        background: colors.surface,
                        border: `0.5px solid ${colors.border}`,
                        fontSize: 13
                      }}
                    >
                      {nom}
                      {canEscriure ? (
                        <button
                          type="button"
                          onClick={() => treureAllergen(idx)}
                          style={{ border: 'none', background: 'none', color: danger, cursor: 'pointer', fontWeight: 700 }}
                        >
                          ×
                        </button>
                      ) : null}
                    </span>
                  ))}
                </div>
              )}
              {canEscriure ? (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={allergenNou}
                    placeholder="Un al·lergen"
                    onChange={(e) => setAllergenNou(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        afegirAllergen();
                      }
                    }}
                    style={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={afegirAllergen}
                    style={{
                      padding: '10px 14px',
                      borderRadius: 8,
                      border: `0.5px solid ${colors.border}`,
                      background: colors.surface,
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Afegir
                  </button>
                </div>
              ) : null}
            </div>

            <div>
              <label style={labelStyle} htmlFor="fitxa_tecnica">Fitxa tècnica</label>
              <textarea
                id="fitxa_tecnica"
                rows={4}
                value={fitxa.fitxa_tecnica}
                disabled={bloquejat}
                onChange={(e) => setFitxa((f) => ({ ...f, fitxa_tecnica: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
            </div>

            <div>
              <span style={labelStyle}>Estat</span>
              <p style={{ margin: 0, fontSize: 14 }}>
                {modeNou || producte?.actiu !== false ? 'Actiu' : 'Inactiu'}
              </p>
            </div>

            {canEscriure ? (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={desarFitxa}
                  disabled={savingFitxa}
                  style={{
                    padding: '12px 20px',
                    fontSize: 15,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: 'none',
                    cursor: savingFitxa ? 'not-allowed' : 'pointer',
                    opacity: savingFitxa ? 0.7 : 1,
                    background: colors.primary,
                    color: '#fff'
                  }}
                >
                  {savingFitxa ? 'Desant…' : modeNou ? 'Crear producte' : 'Desar fitxa'}
                </button>
                {!modeNou && producte?.actiu !== false ? (
                  <button
                    type="button"
                    onClick={arxivar}
                    disabled={savingFitxa}
                    style={{
                      padding: '12px 20px',
                      fontSize: 15,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: `0.5px solid ${danger}`,
                      background: 'transparent',
                      color: danger,
                      cursor: 'pointer'
                    }}
                  >
                    Arxivar
                  </button>
                ) : null}
              </div>
            ) : null}

            {!modeNou && producte ? (
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
                  {canEscriure ? (
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
                  ) : null}
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
                          <ObradorProveidorSelect
                            proveidors={proveidors}
                            value={f.id_proveidor}
                            onChange={(id) => actualitzarFila(idx, { id_proveidor: id })}
                            colors={colors}
                            inputStyle={inputStyle}
                            labelStyle={labelStyle}
                            id={`producte-proveidor-${idx}`}
                            canEditEstat={canEscriure}
                            onEstatUpdated={(updated) => {
                              setProveidors((prev) =>
                                prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
                              );
                            }}
                          />
                        </div>
                        <div>
                          <label style={labelStyle}>Ingredient (opcional)</label>
                          <input
                            type="text"
                            placeholder="ex. pa, pernil…"
                            value={f.ingredient_nom}
                            disabled={bloquejat}
                            onChange={(e) => actualitzarFila(idx, { ingredient_nom: e.target.value })}
                            style={inputStyle}
                          />
                        </div>
                        {canEscriure ? (
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
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}

                {canEscriure ? (
                  <button
                    type="button"
                    onClick={guardar}
                    disabled={saving || !selectedId}
                    style={{
                      marginTop: 14,
                      padding: '12px 20px',
                      fontSize: 15,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: 'none',
                      cursor: saving ? 'not-allowed' : 'pointer',
                      opacity: saving ? 0.7 : 1,
                      background: colors.primary,
                      color: '#fff'
                    }}
                  >
                    {saving ? 'Guardant…' : 'Guardar associacions'}
                  </button>
                ) : null}
              </div>
            ) : null}

            {error ? <p style={{ margin: 0, color: danger, fontSize: 14 }}>{error}</p> : null}
            {okMsg ? <p style={{ margin: 0, color: success, fontSize: 14 }}>{okMsg}</p> : null}
          </>
        )}
      </div>
    </div>
  );
}
