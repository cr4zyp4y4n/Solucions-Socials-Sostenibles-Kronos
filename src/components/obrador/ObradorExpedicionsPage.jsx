import React, { useState, useEffect, useCallback } from 'react';
import { useTheme } from '../ThemeContext';
import {
  getExpedicions,
  getLotPerQR,
  getLotPerCodi,
  crearExpedicio,
  marcarExpedicioEntregada,
  anularExpedicio,
  getClients,
  normalitzarCodiQR,
  lotEsExpedible,
  getLotNoExpedibleMessage
} from '../../services/obradorSupabaseService';
import ObradorQrScanner from './ObradorQrScanner';

const PAGE_SIZE = 50;

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

function normalitzarLotDesDeQR(dadesQR) {
  const lot = dadesQR?.obrador_lots;
  if (!lot) return null;
  return {
    id: lot.id,
    codi_lot: lot.codi_lot,
    estat: lot.estat,
    quantitat_kg: lot.quantitat_kg,
    data_produccio: lot.data_produccio,
    producte: lot.obrador_productes?.nom || '—',
    data_caducitat: dadesQR.data_caducitat
  };
}

function normalitzarLotDesDeCodi(lot) {
  if (!lot) return null;
  const etiqueta = Array.isArray(lot.obrador_etiquetes)
    ? lot.obrador_etiquetes[0]
    : lot.obrador_etiquetes;
  return {
    id: lot.id,
    codi_lot: lot.codi_lot,
    estat: lot.estat,
    quantitat_kg: lot.quantitat_kg,
    data_produccio: lot.data_produccio,
    producte: lot.obrador_productes?.nom || '—',
    data_caducitat: etiqueta?.data_caducitat
  };
}

const formInicial = () => ({
  id_client: '',
  comanda_holded: '',
  check_sortida: false,
  observacions: ''
});

export default function ObradorExpedicionsPage() {
  const { colors } = useTheme();
  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';

  const [mode, setMode] = useState('llistat');
  const [expedicions, setExpedicions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cercaMode, setCercaMode] = useState('qr');
  const [cercaInput, setCercaInput] = useState('');
  const [cercant, setCercant] = useState(false);
  const [lotTrobat, setLotTrobat] = useState(null);
  const [cercaError, setCercaError] = useState('');
  const [form, setForm] = useState(formInicial);
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [entregantId, setEntregantId] = useState(null);
  const [entregaModal, setEntregaModal] = useState(null);
  const [anulantId, setAnulantId] = useState(null);
  const [clients, setClients] = useState([]);
  const [filtreCerca, setFiltreCerca] = useState('');
  const [filtreEstat, setFiltreEstat] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [carregantMes, setCarregantMes] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);

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

  const carregar = useCallback(async ({ append = false, offset = 0 } = {}) => {
    if (!append) setLoading(true);
    else setCarregantMes(true);
    try {
      const data = await getExpedicions({
        limit: PAGE_SIZE,
        offset,
        cerca: filtreCerca,
        estat: filtreEstat || undefined
      });
      setExpedicions((prev) => (append ? [...prev, ...data] : data));
      setHasMore((data || []).length >= PAGE_SIZE);
      const clientsList = await getClients(100).catch(() => []);
      setClients(clientsList);
    } catch (err) {
      console.error(err);
      setError(err.message);
    } finally {
      setLoading(false);
      setCarregantMes(false);
    }
  }, [filtreCerca, filtreEstat]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function reiniciarFormulari() {
    setCercaInput('');
    setLotTrobat(null);
    setCercaError('');
    setForm(formInicial());
    setError('');
    setCercaMode('qr');
    setScannerOpen(false);
  }

  async function handleCercar(e) {
    e?.preventDefault();
    setCercaError('');
    setLotTrobat(null);
    setError('');

    const valorBrut = cercaInput.trim();
    const valor = cercaMode === 'qr' ? normalitzarCodiQR(valorBrut) : valorBrut;
    if (!valor) {
      setCercaError(cercaMode === 'qr' ? 'Introdueix el codi QR.' : 'Introdueix el codi de lot.');
      return;
    }
    if (cercaMode === 'qr' && valor !== valorBrut) {
      setCercaInput(valor);
    }

    setCercant(true);
    try {
      if (cercaMode === 'qr') {
        const dades = await getLotPerQR(valor);
        const lot = normalitzarLotDesDeQR(dades);
        if (!lot) throw new Error('Codi QR no trobat');
        setLotTrobat(lot);
      } else {
        const dades = await getLotPerCodi(valor);
        const lot = normalitzarLotDesDeCodi(dades);
        if (!lot) throw new Error('Codi de lot no trobat');
        setLotTrobat(lot);
      }
    } catch (err) {
      const msg = err?.code === 'PGRST116' || err?.message?.includes('0 rows')
        ? (cercaMode === 'qr' ? 'Codi QR no trobat' : 'Codi de lot no trobat')
        : (err.message || 'Error en la cerca');
      setCercaError(msg);
    } finally {
      setCercant(false);
    }
  }

  function handleScanDetect(raw) {
    setScannerOpen(false);
    setCercaMode('qr');
    const valor = normalitzarCodiQR(raw);
    setCercaInput(valor);
    setTimeout(() => {
      // cerca automàtica amb el valor escanejat
      (async () => {
        setCercaError('');
        setLotTrobat(null);
        if (!valor) return;
        setCercant(true);
        try {
          const dades = await getLotPerQR(valor);
          const lot = normalitzarLotDesDeQR(dades);
          if (!lot) throw new Error('Codi QR no trobat');
          setLotTrobat(lot);
        } catch (err) {
          setCercaError(err?.message || 'Codi QR no trobat');
        } finally {
          setCercant(false);
        }
      })();
    }, 0);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!lotTrobat) {
      setError('Primer has d\'identificar el lot.');
      return;
    }
    if (!lotEsExpedible(lotTrobat.estat)) {
      setError(getLotNoExpedibleMessage(lotTrobat.estat));
      return;
    }
    if (!form.id_client.trim()) {
      setError('El client és obligatori.');
      return;
    }
    if (!form.check_sortida) {
      setError('Cal marcar la verificació del producte abans de sortir (check sortida).');
      return;
    }

    setEnviant(true);
    try {
      await crearExpedicio({
        id_lot: lotTrobat.id,
        id_client: form.id_client.trim(),
        comanda_holded: form.comanda_holded.trim() || null,
        check_sortida: true,
        check_client: false,
        observacions: form.observacions.trim() || null
      });
      setSuccessMsg(`Expedició registrada. Lot ${lotTrobat.codi_lot} marcat com a expedit.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      reiniciarFormulari();
      setMode('llistat');
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en registrar l\'expedició');
    } finally {
      setEnviant(false);
    }
  }

  const lotExpedible = lotEsExpedible(lotTrobat?.estat);
  const lotBloquejat = Boolean(lotTrobat) && !lotExpedible;

  async function confirmarEntrega(checkClient) {
    if (!entregaModal?.id) return;
    setEntregantId(entregaModal.id);
    setError('');
    try {
      await marcarExpedicioEntregada(entregaModal.id, { check_client: checkClient });
      setSuccessMsg(`Expedició entregada${checkClient ? ' (client ha acceptat)' : ''}.`);
      setTimeout(() => setSuccessMsg(''), 5000);
      setEntregaModal(null);
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en marcar com a entregat');
    } finally {
      setEntregantId(null);
    }
  }

  async function handleAnular(exp) {
    if (!exp?.id) return;
    const ok = window.confirm(
      `Anul·lar l'expedició del lot ${exp.obrador_lots?.codi_lot || ''}?\nEl lot tornarà a estat envasat.`
    );
    if (!ok) return;
    setAnulantId(exp.id);
    setError('');
    try {
      await anularExpedicio(exp.id);
      setSuccessMsg('Expedició anul·lada. Lot tornat a envasat.');
      setTimeout(() => setSuccessMsg(''), 5000);
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en anul·lar l\'expedició');
    } finally {
      setAnulantId(null);
    }
  }

  if (loading && mode === 'llistat' && expedicions.length === 0) {
    return (
      <div style={{ padding: 32, color: colors.textSecondary }}>
        Carregant expedicions...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700 }}>Expedicions</h1>
        {mode === 'llistat' ? (
          <button
            type="button"
            onClick={() => { setMode('formulari'); reiniciarFormulari(); setSuccessMsg(''); }}
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
            Nova expedició
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { setMode('llistat'); reiniciarFormulari(); }}
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

      {error && mode === 'llistat' && !entregaModal && (
        <p style={{ color: danger, marginBottom: 16 }}>{error}</p>
      )}

      {mode === 'llistat' ? (
        <>
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <input
              type="search"
              value={filtreCerca}
              onChange={(e) => setFiltreCerca(e.target.value)}
              placeholder="Cercar client o comanda Holded…"
              style={{ ...inputStyle, maxWidth: 280 }}
            />
            <select
              value={filtreEstat}
              onChange={(e) => setFiltreEstat(e.target.value)}
              style={{ ...inputStyle, maxWidth: 180 }}
            >
              <option value="">Tots els estats</option>
              <option value="en trànsit">En trànsit</option>
              <option value="entregat">Entregat</option>
            </select>
          </div>
        {expedicions.length === 0 ? (
          <p style={{ color: colors.textSecondary }}>Encara no hi ha expedicions registrades.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['ID', 'Lot', 'Producte', 'Client', 'Data sortida', 'Estat', 'Holded', 'Acció'].map((col) => (
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
                {expedicions.map((exp) => (
                  <tr key={exp.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px 16px' }}>#{String(exp.id).slice(0, 8)}</td>
                    <td style={{ padding: '12px 16px' }}>{exp.obrador_lots?.codi_lot || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{exp.obrador_lots?.obrador_productes?.nom || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{exp.id_client || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>{formatData(exp.data_sortida)}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: exp.estat === 'entregat' ? `${success}22` : `${warning}22`,
                        color: exp.estat === 'entregat' ? success : warning
                      }}>
                        {exp.estat === 'entregat' ? 'Entregat' : 'En trànsit'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>{exp.comanda_holded || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {exp.estat === 'entregat' ? (
                        <span style={{ fontSize: 12, color: colors.textSecondary }}>
                          {exp.check_client ? 'Client OK' : '—'}
                        </span>
                      ) : (
                        <>
                        <button
                          type="button"
                          disabled={entregantId === exp.id}
                          onClick={() => {
                            setError('');
                            setEntregaModal({
                              id: exp.id,
                              lot: exp.obrador_lots?.codi_lot,
                              client: exp.id_client
                            });
                          }}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            cursor: entregantId === exp.id ? 'wait' : 'pointer',
                            background: colors.primary,
                            color: '#fff',
                            opacity: entregantId === exp.id ? 0.7 : 1
                          }}
                        >
                          Marcar entregat
                        </button>
                        <button
                          type="button"
                          disabled={anulantId === exp.id}
                          onClick={() => handleAnular(exp)}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: `0.5px solid ${danger}`,
                            cursor: anulantId === exp.id ? 'wait' : 'pointer',
                            background: 'transparent',
                            color: danger,
                            opacity: anulantId === exp.id ? 0.7 : 1
                          }}
                        >
                          Anul·lar
                        </button>
                        </>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {hasMore ? (
          <button
            type="button"
            disabled={carregantMes}
            onClick={() => carregar({ append: true, offset: expedicions.length })}
            style={{
              marginTop: 16,
              padding: '10px 16px',
              borderRadius: 8,
              border: `0.5px solid ${colors.border}`,
              background: colors.surface,
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            {carregantMes ? 'Carregant…' : 'Carregar més'}
          </button>
        ) : null}
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Pas 1: identificar lot */}
          <section style={{
            background: colors.card,
            border: `0.5px solid ${colors.border}`,
            borderRadius: 12,
            padding: 24
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>1. Identificar lot</h2>
            <form onSubmit={handleCercar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <label style={labelStyle} htmlFor="cerca_input">
                {cercaMode === 'qr' ? 'Codi QR del lot' : 'Codi de lot (LOT-YYYYMMDD-NNN)'}
              </label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  id="cerca_input"
                  type="text"
                  value={cercaInput}
                  onChange={(e) => { setCercaInput(e.target.value); setCercaError(''); }}
                  placeholder={cercaMode === 'qr' ? 'QR-... (majúscules o minúscules)' : 'LOT-20260612-001'}
                  style={{ ...inputStyle, flex: 1, minWidth: 200 }}
                />
                {cercaMode === 'qr' ? (
                  <button
                    type="button"
                    onClick={() => setScannerOpen(true)}
                    style={{
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      borderRadius: 8,
                      border: `0.5px solid ${colors.border}`,
                      cursor: 'pointer',
                      background: colors.surface,
                      color: colors.text
                    }}
                  >
                    Càmera
                  </button>
                ) : null}
                <button
                  type="submit"
                  disabled={cercant}
                  style={{
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 600,
                    borderRadius: 8,
                    border: 'none',
                    cursor: cercant ? 'not-allowed' : 'pointer',
                    opacity: cercant ? 0.7 : 1,
                    background: colors.primary,
                    color: '#fff'
                  }}
                >
                  {cercant ? 'Cercant...' : 'Cercar'}
                </button>
              </div>
              {cercaMode === 'qr' && (
                <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary }}>
                  Pots enganxar el codi de l&apos;escàner, la URL completa del QR
                  {' '}
                  (<code style={{ fontSize: 11 }}>?trace=…</code>)
                  {' '}
                  o el codi <code style={{ fontSize: 11 }}>QR-…</code> / <code style={{ fontSize: 11 }}>LOT-…</code>.
                </p>
              )}
              {cercaError && (
                <p style={{ margin: 0, color: danger, fontSize: 14 }}>{cercaError}</p>
              )}
            </form>
            <button
              type="button"
              onClick={() => {
                setCercaMode(cercaMode === 'qr' ? 'codi' : 'qr');
                setCercaInput('');
                setCercaError('');
                setLotTrobat(null);
              }}
              style={{
                marginTop: 12,
                padding: 0,
                border: 'none',
                background: 'none',
                color: colors.primary,
                fontSize: 13,
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
            >
              {cercaMode === 'qr' ? 'Cercar per codi de lot' : 'Cercar per codi QR'}
            </button>

            {lotTrobat && (
              <div style={{
                marginTop: 20,
                padding: 16,
                borderRadius: 8,
                background: colors.surface,
                border: `0.5px solid ${colors.border}`
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, fontSize: 14 }}>
                  <div><strong>Codi lot:</strong> {lotTrobat.codi_lot}</div>
                  <div><strong>Producte:</strong> {lotTrobat.producte}</div>
                  <div><strong>Quantitat:</strong> {lotTrobat.quantitat_kg != null ? `${lotTrobat.quantitat_kg} kg` : '—'}</div>
                  <div><strong>Producció:</strong> {formatDataCurta(lotTrobat.data_produccio)}</div>
                  <div><strong>Caducitat:</strong> {formatDataCurta(lotTrobat.data_caducitat)}</div>
                  <div><strong>Estat:</strong> {lotTrobat.estat}</div>
                </div>
                {lotBloquejat && (
                  <p style={{ margin: '12px 0 0', color: warning, fontWeight: 600, fontSize: 14 }}>
                    {getLotNoExpedibleMessage(lotTrobat.estat)}
                  </p>
                )}
              </div>
            )}
          </section>

          {/* Pas 2: dades expedició */}
          {lotTrobat && lotExpedible && (
            <section style={{
              background: colors.card,
              border: `0.5px solid ${colors.border}`,
              borderRadius: 12,
              padding: 24
            }}>
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 600 }}>2. Dades de l&apos;expedició</h2>
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                <div>
                  <label style={labelStyle} htmlFor="id_client">Client *</label>
                  <input
                    id="id_client"
                    type="text"
                    list="obrador-clients-list"
                    value={form.id_client}
                    onChange={(e) => setForm((f) => ({ ...f, id_client: e.target.value }))}
                    placeholder="Nom o codi client"
                    style={inputStyle}
                    required
                  />
                  <datalist id="obrador-clients-list">
                    {clients.map((c) => (
                      <option key={c.id || c.nom} value={c.nom} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="comanda_holded">Comanda Holded</label>
                  <input
                    id="comanda_holded"
                    type="text"
                    value={form.comanda_holded}
                    onChange={(e) => setForm((f) => ({ ...f, comanda_holded: e.target.value }))}
                    placeholder="Opcional"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                    <input
                      type="checkbox"
                      checked={form.check_sortida}
                      onChange={(e) => setForm((f) => ({ ...f, check_sortida: e.target.checked }))}
                      required
                    />
                    Producte verificat abans de sortir (obligatori)
                  </label>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: colors.textSecondary }}>
                    Estat, etiquetatge i temperatura correctes en el moment de l&apos;expedició.
                  </p>
                </div>
                <div>
                  <label style={labelStyle} htmlFor="observacions">Observacions</label>
                  <textarea
                    id="observacions"
                    rows={3}
                    value={form.observacions}
                    onChange={(e) => setForm((f) => ({ ...f, observacions: e.target.value }))}
                    style={{ ...inputStyle, resize: 'vertical' }}
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
                  {enviant ? 'Registrant...' : 'Registrar expedició'}
                </button>
              </form>
            </section>
          )}
        </div>
      )}

      {scannerOpen ? (
        <ObradorQrScanner
          colors={colors}
          onClose={() => setScannerOpen(false)}
          onDetect={handleScanDetect}
        />
      ) : null}

      {entregaModal ? (
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
          onClick={() => {
            if (!entregantId) {
              setError('');
              setEntregaModal(null);
            }
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
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: '0 0 12px', fontSize: 18, fontWeight: 600 }}>Confirmar entrega</h2>
            <p style={{ margin: '0 0 16px', fontSize: 14, color: colors.textSecondary, lineHeight: 1.5 }}>
              Lot <strong>{entregaModal.lot}</strong> → client <strong>{entregaModal.client}</strong>.
              {' '}
              Marca com a entregat quan arribi al servei / catering.
            </p>
            {error ? (
              <p style={{ margin: '0 0 12px', color: danger, fontSize: 14 }}>{error}</p>
            ) : null}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                type="button"
                disabled={Boolean(entregantId)}
                onClick={() => confirmarEntrega(true)}
                style={{
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
                Entregat — client ha acceptat el producte
              </button>
              <button
                type="button"
                disabled={Boolean(entregantId)}
                onClick={() => confirmarEntrega(false)}
                style={{
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
                Entregat (sense confirmació del client)
              </button>
              <button
                type="button"
                disabled={Boolean(entregantId)}
                onClick={() => { setError(''); setEntregaModal(null); }}
                style={{
                  padding: '8px',
                  fontSize: 13,
                  border: 'none',
                  background: 'none',
                  color: colors.textSecondary,
                  cursor: 'pointer'
                }}
              >
                Cancel·lar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
