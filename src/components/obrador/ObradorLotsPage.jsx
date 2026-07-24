import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTheme } from '../ThemeContext';
import { buildObradorQrPayload, getObradorTraceBaseUrl } from '../../utils/obradorQrUrl';
import ObradorQrCode from './ObradorQrCode';
import {
  getLots,
  getProductes,
  getRecepcions,
  getOperaris,
  crearLot,
  recepcioEsValidaPerProduccio
} from '../../services/obradorSupabaseService';

const ESTATS_LOT = {
  produit: { label: 'Produït', key: 'primary' },
  envasat: { label: 'Envasat', key: 'warning' },
  expedit: { label: 'Expedit', key: 'success' },
  retirat: { label: 'Retirat', key: 'error' }
};

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

function formatDataCurta(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('ca');
}

function labelRecepcio(r) {
  const data = formatData(r.data_recepcio);
  const prov = r.obrador_proveidors?.nom || 'Proveïdor';
  const lot = r.lot_proveidor || 'sense lot';
  return `${data} — ${prov} — ${lot}`;
}

const formInicial = () => ({
  id_producte: '',
  id_recepcions: [],
  id_operari: '',
  quantitat_kg: '',
  temp_final_coccio: '',
  mostra_guardada: false,
  observacions: ''
});

function EtiquetaModal({ dades, onTancar, colors }) {
  const { lot, producte, etiqueta } = dades;
  const allergens = (etiqueta.allergens?.length ? etiqueta.allergens : producte.allergens) || [];
  const qrValue = buildObradorQrPayload(etiqueta.codi_qr);
  const traceUrlConfigured = Boolean(getObradorTraceBaseUrl());

  useEffect(() => {
    const style = document.createElement('style');
    style.id = 'obrador-etiqueta-print';
    style.textContent = `
      @media print {
        body * { visibility: hidden !important; }
        .etiqueta-print, .etiqueta-print * { visibility: visible !important; }
        .etiqueta-print {
          position: fixed !important;
          left: 0 !important;
          top: 0 !important;
          display: block !important;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      const el = document.getElementById('obrador-etiqueta-print');
      if (el) el.remove();
    };
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 24
      }}
    >
      <div
        style={{
          background: colors.card,
          borderRadius: 12,
          padding: 24,
          maxWidth: 400,
          width: '100%',
          border: `0.5px solid ${colors.border}`
        }}
      >
        <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600, color: colors.text }}>
          Etiqueta generada
        </h2>

        <div
          className="etiqueta-print"
          style={{
            border: `2px solid ${colors.border}`,
            borderRadius: 8,
            padding: 20,
            textAlign: 'center',
            background: '#fff',
            color: '#000',
            marginBottom: 20
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
            <ObradorQrCode value={qrValue} size={160} />
          </div>
          {!traceUrlConfigured ? (
            <div style={{
              fontSize: 11,
              color: '#b45309',
              marginBottom: 10,
              lineHeight: 1.4
            }}>
              Configura OBRADOR_TRACE_BASE_URL al .env perquè l&apos;escaneig obri la fitxa del lot.
            </div>
          ) : null}
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>{lot.codi_lot}</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>Producte: {producte.nom}</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>Elaborat: {formatDataCurta(lot.data_produccio)}</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>Caduca: {formatDataCurta(etiqueta.data_caducitat)}</div>
          <div style={{ fontSize: 14, marginBottom: 4 }}>
            Al·lèrgens: {allergens.length ? allergens.join(', ') : 'cap declarat'}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, marginTop: 8 }}>SSS Obrador</div>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            type="button"
            onClick={() => window.print()}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              border: 'none',
              cursor: 'pointer',
              background: colors.primary,
              color: '#fff'
            }}
          >
            Imprimir etiqueta
          </button>
          <button
            type="button"
            onClick={onTancar}
            style={{
              flex: 1,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              borderRadius: 8,
              cursor: 'pointer',
              background: colors.surface,
              color: colors.text,
              border: `0.5px solid ${colors.border}`
            }}
          >
            Tancar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ObradorLotsPage() {
  const { colors } = useTheme();
  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';
  const info = colors.primary || '#3B82F6';

  const [mode, setMode] = useState('llistat');
  const [lots, setLots] = useState([]);
  const [productes, setProductes] = useState([]);
  const [recepcions, setRecepcions] = useState([]);
  const [operaris, setOperaris] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [loading, setLoading] = useState(true);
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');
  const [etiquetaModal, setEtiquetaModal] = useState(null);

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

  const producteSeleccionat = useMemo(
    () => productes.find((p) => p.id === form.id_producte),
    [productes, form.id_producte]
  );

  const proveidorsProducte = useMemo(() => {
    const links = producteSeleccionat?.obrador_producte_proveidors || [];
    return links
      .map((l) => ({
        id: l.id_proveidor || l.obrador_proveidors?.id,
        nom: l.obrador_proveidors?.nom || 'Proveïdor',
        ingredient: l.ingredient_nom || null
      }))
      .filter((p) => p.id);
  }, [producteSeleccionat]);

  const idsProveidorProducte = useMemo(
    () => new Set(proveidorsProducte.map((p) => p.id)),
    [proveidorsProducte]
  );

  const recepcionsValides = useMemo(() => {
    const base = recepcions.filter((r) => recepcioEsValidaPerProduccio(r.estat));
    if (!form.id_producte || idsProveidorProducte.size === 0) return base;
    return base.filter((r) => idsProveidorProducte.has(r.id_proveidor));
  }, [recepcions, form.id_producte, idsProveidorProducte]);

  const tempNum = form.temp_final_coccio === '' ? null : Number(form.temp_final_coccio);
  const tempMin = producteSeleccionat?.temp_coccio != null ? Number(producteSeleccionat.temp_coccio) : null;
  const tempInsuficient = tempMin != null && tempNum != null && !Number.isNaN(tempNum) && tempNum < tempMin;

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      const [l, prod, rec, op] = await Promise.all([
        getLots(),
        getProductes(),
        getRecepcions(80),
        getOperaris()
      ]);
      setLots(l);
      setProductes(prod);
      setRecepcions(rec);
      setOperaris(op);
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

  function estatColor(estat) {
    const map = { produit: info, envasat: warning, expedit: success, retirat: danger };
    return map[estat] || colors.textSecondary;
  }

  function actualitzar(camp, valor) {
    setForm((prev) => ({ ...prev, [camp]: valor }));
    setError('');
  }

  function onCanviProducte(idProducte) {
    setForm((prev) => ({
      ...prev,
      id_producte: idProducte,
      id_recepcions: []
    }));
    setError('');
  }

  function toggleRecepcio(idRecepcio) {
    setForm((prev) => {
      const has = prev.id_recepcions.includes(idRecepcio);
      const next = has
        ? prev.id_recepcions.filter((id) => id !== idRecepcio)
        : [...prev.id_recepcions, idRecepcio];
      return { ...prev, id_recepcions: next };
    });
    setError('');
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!form.id_producte || !form.id_recepcions.length) {
      setError('Producte i almenys una recepció són obligatoris.');
      return;
    }
    const invalid = form.id_recepcions.some((id) => {
      const r = recepcions.find((x) => x.id === id);
      return !recepcioEsValidaPerProduccio(r?.estat);
    });
    if (invalid) {
      setError('Hi ha alguna recepció seleccionada que no és apta per producció.');
      return;
    }
    if (!form.mostra_guardada) {
      setError('Has de confirmar la mostra guardada.');
      return;
    }
    if (tempInsuficient) {
      setError(`Temperatura insuficient. Mínim requerit: ${tempMin}°C.`);
      return;
    }

    setEnviant(true);
    try {
      const resultat = await crearLot({
        id_producte: form.id_producte,
        id_recepcions: form.id_recepcions,
        id_operari: form.id_operari || null,
        quantitat_kg: form.quantitat_kg === '' ? null : Number(form.quantitat_kg),
        temp_final_coccio: tempNum,
        mostra_guardada: true,
        observacions: form.observacions || null,
        caducitat_dies: producteSeleccionat.caducitat_dies,
        allergens: producteSeleccionat.allergens
      });
      const lot = resultat?.lot;
      const etiqueta = resultat?.etiqueta;
      if (!lot || !etiqueta) {
        throw new Error('La resposta de Supabase no inclou el lot i l\'etiqueta generats.');
      }

      setEtiquetaModal({
        lot,
        producte: producteSeleccionat,
        etiqueta
      });
      setForm(formInicial());
    } catch (err) {
      setError(err.message || 'Error en crear el lot');
    } finally {
      setEnviant(false);
    }
  }

  function tancarModal() {
    setEtiquetaModal(null);
    setMode('llistat');
    carregar();
  }

  if (loading && mode === 'llistat' && lots.length === 0 && !etiquetaModal) {
    return (
      <div style={{ padding: 32, color: colors.textSecondary }}>
        Carregant lots...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      {etiquetaModal && (
        <EtiquetaModal dades={etiquetaModal} onTancar={tancarModal} colors={colors} />
      )}

      {!etiquetaModal && (
        <>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Lots de producció</h1>
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
                Nou lot
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

          {mode === 'llistat' ? (
            lots.length === 0 ? (
              <p style={{ color: colors.textSecondary }}>Encara no hi ha lots registrats.</p>
            ) : (
              <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                  <thead>
                    <tr>
                      {['Codi lot', 'Data', 'Producte', 'Recepcions', 'Operari', 'Temp. cocció', 'Estat', 'Mostra'].map((col) => (
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
                    {lots.map((lot) => (
                      <tr key={lot.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>{lot.codi_lot || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>{formatData(lot.data_produccio)}</td>
                        <td style={{ padding: '12px 16px' }}>{lot.obrador_productes?.nom || '—'}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: colors.textSecondary }}>
                          {(() => {
                            const rows = [...(lot.obrador_lot_recepcions || [])]
                              .sort((a, b) => (a.ordre || 0) - (b.ordre || 0));
                            if (!rows.length) return '1';
                            const noms = rows
                              .map((lr) => lr.obrador_recepcions?.obrador_proveidors?.nom)
                              .filter(Boolean);
                            if (!noms.length) return String(rows.length);
                            return `${rows.length}: ${noms.join(', ')}`;
                          })()}
                        </td>
                        <td style={{ padding: '12px 16px' }}>{lot.obrador_operaris?.nom || '—'}</td>
                        <td style={{ padding: '12px 16px' }}>
                          {lot.temp_final_coccio != null ? `${lot.temp_final_coccio} °C` : '—'}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                            background: `${estatColor(lot.estat)}22`,
                            color: estatColor(lot.estat)
                          }}>
                            {ESTATS_LOT[lot.estat]?.label || lot.estat}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>{lot.mostra_guardada ? 'Sí' : 'No'}</td>
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
                <label style={labelStyle} htmlFor="id_producte">Producte *</label>
                <select
                  id="id_producte"
                  value={form.id_producte}
                  onChange={(e) => onCanviProducte(e.target.value)}
                  style={inputStyle}
                  required
                >
                  <option value="">Selecciona producte...</option>
                  {productes.map((p) => (
                    <option key={p.id} value={p.id}>{p.nom}</option>
                  ))}
                </select>
                {producteSeleccionat?.temp_coccio != null && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.textSecondary }}>
                    Temp. mínima cocció: {producteSeleccionat.temp_coccio}°C
                  </p>
                )}
                {form.id_producte && proveidorsProducte.length > 0 ? (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.textSecondary }}>
                    Proveïdors del producte:{' '}
                    {proveidorsProducte.map((p) => (
                      p.ingredient ? `${p.nom} (${p.ingredient})` : p.nom
                    )).join(' · ')}
                  </p>
                ) : null}
                {form.id_producte && proveidorsProducte.length === 0 ? (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.textSecondary }}>
                    Aquest producte encara no té proveïdors associats (pestanya Productes).
                    Es mostren totes les recepcions vàlides.
                  </p>
                ) : null}
              </div>

              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>
                  Recepcions * ({form.id_recepcions.length} seleccionada{form.id_recepcions.length === 1 ? '' : 's'})
                </div>
                {!form.id_producte ? (
                  <p style={{ margin: 0, fontSize: 14, color: colors.textSecondary }}>
                    Primer selecciona un producte.
                  </p>
                ) : recepcionsValides.length === 0 ? (
                  <p style={{ margin: 0, fontSize: 14, color: colors.textSecondary }}>
                    No hi ha recepcions aptes
                    {proveidorsProducte.length > 0 ? ' dels proveïdors d\'aquest producte' : ''}.
                  </p>
                ) : (
                  <div style={{
                    maxHeight: 240,
                    overflowY: 'auto',
                    border: `0.5px solid ${colors.border}`,
                    borderRadius: 8,
                    background: colors.surface
                  }}>
                    {recepcionsValides.map((r) => {
                      const checked = form.id_recepcions.includes(r.id);
                      return (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '10px 12px',
                            borderBottom: `1px solid ${colors.border}`,
                            cursor: 'pointer',
                            fontSize: 13,
                            background: checked ? `${colors.primary}14` : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleRecepcio(r.id)}
                            style={{ marginTop: 2 }}
                          />
                          <span>{labelRecepcio(r)}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {recepcions.length > recepcions.filter((r) => recepcioEsValidaPerProduccio(r.estat)).length && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: colors.textSecondary }}>
                    Les recepcions rebutjades no es poden utilitzar per crear lots.
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle} htmlFor="id_operari">Operari</label>
                <select
                  id="id_operari"
                  value={form.id_operari}
                  onChange={(e) => actualitzar('id_operari', e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Sense assignar</option>
                  {operaris.map((o) => (
                    <option key={o.id} value={o.id}>{o.nom}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={labelStyle} htmlFor="quantitat_kg">Quantitat (kg)</label>
                <input
                  id="quantitat_kg"
                  type="number"
                  step="0.1"
                  min="0"
                  value={form.quantitat_kg}
                  onChange={(e) => actualitzar('quantitat_kg', e.target.value)}
                  style={inputStyle}
                />
              </div>

              <div>
                <label style={labelStyle} htmlFor="temp_final_coccio">Temperatura final de cocció (°C)</label>
                <input
                  id="temp_final_coccio"
                  type="number"
                  step="0.1"
                  value={form.temp_final_coccio}
                  onChange={(e) => actualitzar('temp_final_coccio', e.target.value)}
                  style={inputStyle}
                />
                {tempInsuficient && (
                  <p style={{ margin: '8px 0 0', fontSize: 13, color: danger, fontWeight: 600 }}>
                    Temperatura insuficient. Mínim requerit: {tempMin}°C. No es pot guardar.
                  </p>
                )}
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.mostra_guardada}
                    onChange={(e) => actualitzar('mostra_guardada', e.target.checked)}
                  />
                  He guardat mostra (obligatori per normativa)
                </label>
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

              {error && (
                <p style={{ margin: 0, color: danger, fontSize: 14 }}>{error}</p>
              )}

              <button
                type="submit"
                disabled={enviant || tempInsuficient}
                style={{
                  padding: '12px 20px',
                  fontSize: 15,
                  fontWeight: 600,
                  borderRadius: 8,
                  border: 'none',
                  cursor: enviant || tempInsuficient ? 'not-allowed' : 'pointer',
                  opacity: enviant || tempInsuficient ? 0.7 : 1,
                  background: colors.primary,
                  color: '#fff',
                  alignSelf: 'flex-start'
                }}
              >
                {enviant ? 'Creant lot...' : 'Crear lot i generar etiqueta'}
              </button>
            </form>
          )}
        </>
      )}
    </div>
  );
}
