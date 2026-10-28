import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useTheme } from '../ThemeContext';
import { getProveidors, getRecepcions, getResumProveidor, crearRecepcio, updateRecepcio, filterProveidorsForSelector, PROVEIDORS_SCHEMA_SQL } from '../../services/obradorSupabaseService';
import { syncProveidorsFromHolded, HOLDED_COMPANIES } from '../../services/obradorHoldedSyncService';
import {
  parseAlbaranText,
  buildRecepcioDraftFromParsed
} from '../../services/obradorAlbaranParser';
import { ocrTextFromAlbaranFile } from '../../utils/obradorOcrFromFile';
import OcrDebugPanel, { buildOcrDebugReport } from './OcrDebugPanel';
import ObradorProveidorSelect from './ObradorProveidorSelect';
import { useAuth } from '../AuthContext';

const LABEL_ESTAT_PROVEIDOR = {
  habitual: 'Habitual',
  ocasional: 'Ocasional',
  revisar: 'Revisar',
  inactiu: 'Inactiu'
};

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

const formInicial = () => ({
  id_proveidor: '',
  lot_proveidor: '',
  temperatura_arribada: '',
  estat: 'bo',
  caducitat: '',
  congelat: false,
  observacions: '',
  operari: ''
});

export default function ObradorRecepcionsPage() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const role = String(user?.user_metadata?.role || user?.role || '').toLowerCase();
  const canEditEstatProveidor = ['admin', 'management', 'manager'].includes(role);
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
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [ocrDraft, setOcrDraft] = useState(null);
  const [ocrDebug, setOcrDebug] = useState(null);
  const [importingHolded, setImportingHolded] = useState(false);
  const [holdedCompany, setHoldedCompany] = useState('solucions');
  const [schemaIncomplete, setSchemaIncomplete] = useState(false);
  const fileInputRef = useRef(null);
  const [filtreCerca, setFiltreCerca] = useState('');
  const [filtreEstat, setFiltreEstat] = useState('');
  const [hasMore, setHasMore] = useState(false);
  const [carregantMes, setCarregantMes] = useState(false);
  const [editantId, setEditantId] = useState(null);
  const [cercaProveidor, setCercaProveidor] = useState('');
  const [mostrarInactiusProveidor, setMostrarInactiusProveidor] = useState(false);
  const [proveidorFitxa, setProveidorFitxa] = useState(null);

  const PAGE_SIZE = 50;

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
      const [rec, provResult] = await Promise.all([
        getRecepcions({
          limit: PAGE_SIZE,
          offset,
          cerca: filtreCerca,
          estat: filtreEstat || undefined
        }),
        getProveidors()
      ]);
      setRecepcions((prev) => (append ? [...prev, ...rec] : rec));
      setHasMore((rec || []).length >= PAGE_SIZE);
      setProveidors(provResult.proveidors);
      setSchemaIncomplete(provResult.schemaIncomplete);
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

  function obrirSelectorFoto() {
    fileInputRef.current?.click();
  }

  async function handleImportarHolded() {
    setError('');
    setSuccessMsg('');
    setImportingHolded(true);
    try {
      const result = await syncProveidorsFromHolded(holdedCompany);
      const provResult = await getProveidors();
      setProveidors(provResult.proveidors);
      setSchemaIncomplete(provResult.schemaIncomplete);
      setSuccessMsg(
        `Proveïdors importats des de Holded (${result.companyLabel}): ` +
        `${result.inserted} nous, ${result.updated} actualitzats ` +
        `(${result.suppliersFound} proveïdors de ${result.holdedContactsTotal} contactes).`
      );
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error important proveïdors des de Holded');
    } finally {
      setImportingHolded(false);
    }
  }

  async function handleFotoAlbara(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ok =
      file.type.startsWith('image/') ||
      file.type === 'application/pdf' ||
      /\.pdf$/i.test(file.name || '');
    if (!ok) {
      setError('Selecciona una imatge (JPG, PNG) o un PDF de l\'albarà.');
      return;
    }

    setMode('formulari');
    setEditantId(null);
    setError('');
    setSuccessMsg('');
    setOcrProcessing(true);
    setOcrProgress(0);
    setOcrDraft(null);
    setOcrDebug(null);

    try {
      const ocrResult = await ocrTextFromAlbaranFile(file, {
        onProgress: setOcrProgress
      });
      const text = ocrResult?.text ?? '';
      const ocrMeta = ocrResult?.meta ?? {};

      const parsed = parseAlbaranText(text);
      const draft = buildRecepcioDraftFromParsed(parsed, proveidors);
      const report = buildOcrDebugReport({
        fileName: file.name,
        ocrMeta,
        ocrText: text,
        parsed
      });
      setOcrDraft(draft);
      setOcrDebug({ report, text, meta: ocrMeta });

      setForm((prev) => ({
        ...formInicial(),
        id_proveidor: draft.id_proveidor || '',
        lot_proveidor: draft.lot_proveidor || '',
        caducitat: draft.caducitat || '',
        observacions: draft.observacions || '',
        operari: prev.operari
      }));

      if (!draft.id_proveidor && parsed.proveidorNom) {
        setError(`Selecciona el proveïdor manualment (detectat: "${parsed.proveidorNom}").`);
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error processant el document amb OCR.');
    } finally {
      setOcrProcessing(false);
      setOcrProgress(0);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!form.id_proveidor) {
      setError('Selecciona un proveïdor.');
      return;
    }
    if (form.estat === 'rebutjat' && !form.observacions.trim()) {
      setError('Les observacions són obligatòries si l\'estat és Rebutjat.');
      return;
    }

    setEnviant(true);
    try {
      const payload = {
        id_proveidor: form.id_proveidor,
        lot_proveidor: form.lot_proveidor || null,
        temperatura_arribada: tempNum,
        estat: form.estat,
        caducitat: form.caducitat || null,
        congelat: form.congelat,
        observacions: form.observacions || null,
        operari: form.operari || null
      };
      if (editantId) {
        await updateRecepcio(editantId, payload);
        setSuccessMsg('Recepció actualitzada');
      } else {
        await crearRecepcio(payload);
        setSuccessMsg('Recepció registrada correctament');
      }
      setTimeout(() => setSuccessMsg(''), 4000);
      setForm(formInicial());
      setEditantId(null);
      setMode('llistat');
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en desar la recepció');
    } finally {
      setEnviant(false);
    }
  }

  function obrirEdicio(r) {
    setEditantId(r.id);
    setForm({
      id_proveidor: r.id_proveidor || '',
      lot_proveidor: r.lot_proveidor || '',
      temperatura_arribada: r.temperatura_arribada != null ? String(r.temperatura_arribada) : '',
      estat: r.estat || 'bo',
      caducitat: r.caducitat || '',
      congelat: Boolean(r.congelat),
      observacions: r.observacions || '',
      operari: r.operari || ''
    });
    setError('');
    setSuccessMsg('');
    setMode('formulari');
  }

  async function anularRecepcio(r) {
    const ok = window.confirm('Marcar aquesta recepció com a Rebutjada?');
    if (!ok) return;
    setError('');
    try {
      await updateRecepcio(r.id, {
        estat: 'rebutjat',
        observacions: r.observacions
          ? `${r.observacions}\n[Anul·lada des de Kronos]`
          : 'Anul·lada des de Kronos'
      });
      setSuccessMsg('Recepció marcada com a rebutjada');
      setTimeout(() => setSuccessMsg(''), 4000);
      await carregar();
    } catch (err) {
      setError(err.message || 'Error en anul·lar');
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
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {mode === 'llistat' ? (
          <>
            <select
              value={holdedCompany}
              onChange={(e) => setHoldedCompany(e.target.value)}
              disabled={importingHolded}
              title="Empresa Holded per importar proveïdors"
              style={{
                padding: '9px 12px',
                fontSize: 13,
                borderRadius: 8,
                border: `0.5px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text
              }}
            >
              {Object.entries(HOLDED_COMPANIES).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleImportarHolded}
              disabled={importingHolded || schemaIncomplete}
              title={schemaIncomplete ? `Executa ${PROVEIDORS_SCHEMA_SQL} a Supabase` : undefined}
              style={{
                padding: '10px 16px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                cursor: importingHolded ? 'wait' : 'pointer',
                background: colors.surface,
                color: colors.text,
                border: `0.5px solid ${colors.border}`,
                opacity: importingHolded || schemaIncomplete ? 0.5 : 1
              }}
            >
              {importingHolded ? 'Important…' : 'Importar proveïdors (Holded)'}
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('proveidors');
                setError('');
                setSuccessMsg('');
              }}
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
              Proveïdors
            </button>
            <button
              type="button"
              onClick={() => {
                setEditantId(null);
                setForm(formInicial());
                setMode('formulari');
                setError('');
                setSuccessMsg('');
                setOcrDraft(null);
              }}
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
            <button
              type="button"
              onClick={obrirSelectorFoto}
              disabled={ocrProcessing}
              style={{
                padding: '10px 20px',
                fontSize: 14,
                fontWeight: 600,
                borderRadius: 8,
                cursor: ocrProcessing ? 'not-allowed' : 'pointer',
                background: colors.surface,
                color: colors.text,
                border: `0.5px solid ${colors.border}`,
                opacity: ocrProcessing ? 0.7 : 1
              }}
            >
              {ocrProcessing ? `OCR ${ocrProgress}%...` : 'Foto / PDF albarà (OCR)'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError('');
              if (mode === 'fitxa-proveidor') {
                setMode('proveidors');
                return;
              }
              setMode('llistat');
              setForm(formInicial());
              setEditantId(null);
              setOcrDraft(null);
            }}
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
            {mode === 'fitxa-proveidor' ? 'Tornar als proveïdors' : 'Tornar al llistat'}
          </button>
        )}
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={handleFotoAlbara}
      />

      {ocrProcessing && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: `${colors.primary}15`,
          color: colors.text,
          fontSize: 14
        }}>
          Llegint albarà amb OCR… {ocrProgress}%
        </div>
      )}

      {ocrDraft?._parsed && mode === 'formulari' && (
        <div style={{
          padding: '14px 16px',
          marginBottom: 16,
          borderRadius: 10,
          background: `${warning}18`,
          border: `1px solid ${warning}55`,
          fontSize: 13,
          lineHeight: 1.5
        }}>
          <strong>Borrador OCR</strong> — revisa abans de confirmar.
          {ocrDraft._parsed.proveidorNom && (
            <div>Proveïdor detectat: {ocrDraft._parsed.proveidorNom}</div>
          )}
          {ocrDraft._parsed.lotProveidor ? (
            <div>Lot / albarà: {ocrDraft._parsed.lotProveidor}</div>
          ) : (
            <div style={{ color: danger }}>Lot / albarà: no detectat — obre el log OCR</div>
          )}
          <div style={{ marginTop: 6, color: colors.textSecondary }}>
            Parser: {ocrDraft._parsed.parserId} · confiança {ocrDraft._parsed.confiança}
            {ocrDraft._parsed.linies?.length ? ` · ${ocrDraft._parsed.linies.length} línies` : ''}
          </div>
        </div>
      )}

      <OcrDebugPanel ocrDebug={ocrDebug} colors={colors} />

      {schemaIncomplete && (
        <div style={{
          padding: '12px 16px',
          marginBottom: 16,
          borderRadius: 8,
          background: `${warning}22`,
          border: `1px solid ${warning}`,
          color: colors.text,
          fontSize: 14,
          lineHeight: 1.5
        }}>
          Executa <strong>{PROVEIDORS_SCHEMA_SQL}</strong> al SQL Editor de Supabase per activar CIF,
          importació Holded i matching OCR per proveïdor.
        </div>
      )}

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
          <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
            <input
              type="search"
              value={filtreCerca}
              onChange={(e) => setFiltreCerca(e.target.value)}
              placeholder="Cercar lot / observacions / operari…"
              style={{ ...inputStyle, maxWidth: 300 }}
            />
            <select
              value={filtreEstat}
              onChange={(e) => setFiltreEstat(e.target.value)}
              style={{ ...inputStyle, maxWidth: 160 }}
            >
              <option value="">Tots els estats</option>
              {ESTATS.map((e) => (
                <option key={e.value} value={e.value}>{e.label}</option>
              ))}
            </select>
          </div>
        {recepcions.length === 0 ? (
          <p style={{ color: colors.textSecondary }}>Encara no hi ha recepcions registrades.</p>
        ) : (
          <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Data', 'Proveïdor', 'Lot proveïdor', 'Temp.', 'Estat', 'Congelat', 'Acció'].map((col) => (
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
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => obrirEdicio(r)}
                          style={{
                            padding: '6px 12px',
                            fontSize: 12,
                            fontWeight: 600,
                            borderRadius: 6,
                            border: 'none',
                            cursor: 'pointer',
                            background: colors.primary,
                            color: '#fff'
                          }}
                        >
                          Editar
                        </button>
                        {r.estat !== 'rebutjat' ? (
                          <button
                            type="button"
                            onClick={() => anularRecepcio(r)}
                            style={{
                              padding: '6px 12px',
                              fontSize: 12,
                              fontWeight: 600,
                              borderRadius: 6,
                              border: `0.5px solid ${danger}`,
                              cursor: 'pointer',
                              background: 'transparent',
                              color: danger
                            }}
                          >
                            Anul·lar
                          </button>
                        ) : null}
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
            onClick={() => carregar({ append: true, offset: recepcions.length })}
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
      ) : mode === 'proveidors' ? (
        <LlistatProveidors
          proveidors={proveidors}
          cerca={cercaProveidor}
          onCerca={setCercaProveidor}
          mostrarInactius={mostrarInactiusProveidor}
          onMostrarInactius={setMostrarInactiusProveidor}
          colors={colors}
          onObrir={(p) => {
            setProveidorFitxa(p);
            setMode('fitxa-proveidor');
            setError('');
            setSuccessMsg('');
          }}
        />
      ) : mode === 'fitxa-proveidor' && proveidorFitxa ? (
        <FitxaProveidor
          proveidor={proveidorFitxa}
          colors={colors}
          onTornar={() => {
            setMode('proveidors');
            setError('');
          }}
        />
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
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 4 }}>
            <button
              type="button"
              onClick={obrirSelectorFoto}
              disabled={ocrProcessing}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 600,
                borderRadius: 8,
                cursor: ocrProcessing ? 'not-allowed' : 'pointer',
                background: colors.surface,
                color: colors.text,
                border: `0.5px solid ${colors.border}`
              }}
            >
              Canviar foto / tornar a escanejar
            </button>
          </div>

          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }} htmlFor="id_proveidor">Proveïdor *</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <select
                  value={holdedCompany}
                  onChange={(e) => setHoldedCompany(e.target.value)}
                  disabled={importingHolded || schemaIncomplete}
                  aria-label="Empresa Holded"
                  style={{
                    padding: '6px 8px',
                    fontSize: 12,
                    borderRadius: 6,
                    border: `0.5px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text
                  }}
                >
                  {Object.entries(HOLDED_COMPANIES).map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleImportarHolded}
                  disabled={importingHolded || schemaIncomplete}
                  title={schemaIncomplete ? `Executa ${PROVEIDORS_SCHEMA_SQL} a Supabase` : undefined}
                  style={{
                    padding: '6px 10px',
                    fontSize: 12,
                    fontWeight: 600,
                    borderRadius: 6,
                    cursor: importingHolded || schemaIncomplete ? 'not-allowed' : 'pointer',
                    background: colors.surface,
                    color: colors.textSecondary,
                    border: `0.5px solid ${colors.border}`,
                    opacity: schemaIncomplete ? 0.5 : 1
                  }}
                >
                  {importingHolded ? 'Important Holded…' : 'Actualitzar des de Holded'}
                </button>
              </div>
            </div>
            <ObradorProveidorSelect
              proveidors={proveidors}
              value={form.id_proveidor}
              onChange={(id) => actualitzar('id_proveidor', id)}
              colors={colors}
              inputStyle={inputStyle}
              labelStyle={labelStyle}
              required
              id="id_proveidor"
              canEditEstat={canEditEstatProveidor}
              onEstatUpdated={(updated) => {
                setProveidors((prev) =>
                  prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
                );
              }}
            />
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
            <label style={labelStyle} htmlFor="caducitat">Caducitat (si aplica)</label>
            <input
              id="caducitat"
              type="date"
              value={form.caducitat}
              onChange={(e) => actualitzar('caducitat', e.target.value)}
              style={inputStyle}
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
            {enviant ? 'Desant...' : (editantId ? 'Desar canvis' : 'Registrar recepció')}
          </button>
        </form>
      )}
    </div>
  );
}

function LlistatProveidors({
  proveidors,
  cerca,
  onCerca,
  mostrarInactius,
  onMostrarInactius,
  colors,
  onObrir
}) {
  const visibles = filterProveidorsForSelector(proveidors, {
    incloureInactius: mostrarInactius,
    cerca
  });
  const th = {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 600,
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${colors.border}`
  };
  const td = { padding: '12px 16px' };

  return (
    <div>
      <h2 style={{ margin: '0 0 8px', fontSize: 18, fontWeight: 700 }}>Proveïdors disponibles</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: colors.textSecondary }}>
        Els habituals i els ocasionals. Els inactius no surten fins que es demanin.
      </p>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <input
          type="search"
          value={cerca}
          onChange={(e) => onCerca(e.target.value)}
          placeholder="Cercar per nom, NIF o codi…"
          style={{
            padding: '10px 12px',
            fontSize: 14,
            borderRadius: 8,
            border: `0.5px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            minWidth: 240
          }}
        />
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: colors.textSecondary, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={mostrarInactius}
            onChange={(e) => onMostrarInactius(e.target.checked)}
          />
          Mostrar inactius
        </label>
        <span style={{ fontSize: 13, color: colors.textSecondary }}>{visibles.length} proveïdors</span>
      </div>
      {visibles.length === 0 ? (
        <p style={{ color: colors.textSecondary }}>No hi ha proveïdors amb aquest filtre.</p>
      ) : (
        <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {['Nom', 'NIF', 'Codi', 'Estat', 'Contacte'].map((col) => (
                  <th key={col} style={th}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibles.map((p) => (
                <tr
                  key={p.id}
                  tabIndex={0}
                  role="button"
                  aria-label={`Obrir la fitxa de ${p.nom || 'proveïdor'}`}
                  title="Obrir la fitxa"
                  onClick={() => onObrir?.(p)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onObrir?.(p);
                    }
                  }}
                  style={{
                    borderBottom: `1px solid ${colors.border}`,
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = colors.surface; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  onFocus={(e) => { e.currentTarget.style.outline = `2px solid ${colors.primary}`; }}
                  onBlur={(e) => { e.currentTarget.style.outline = 'none'; }}
                >
                  <td style={{ ...td, fontWeight: 600 }}>
                    {p.nom || '—'}
                    <span style={{ marginLeft: 8, color: colors.primary, fontWeight: 600 }}>›</span>
                  </td>
                  <td style={td}>{p.cif || '—'}</td>
                  <td style={td}>{p.codi_intern || '—'}</td>
                  <td style={td}>{LABEL_ESTAT_PROVEIDOR[p.estat_us] || 'Habitual'}</td>
                  <td style={td}>{p.contacte || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const HISTORIAL_PAGE = 50;

function origenProveidor(p) {
  if (p?.holded_contact_id) {
    return p.holded_empresa ? `Holded · ${p.holded_empresa}` : 'Holded';
  }
  return 'Alta manual';
}

function FitxaProveidor({ proveidor, colors, onTornar }) {
  const success = colors.success || '#1D9E75';
  const warning = colors.warning || '#e67e22';
  const danger = colors.error || '#c0392b';
  const [resum, setResum] = useState(null);
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [carregantMes, setCarregantMes] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');

  const carregar = useCallback(async ({ append = false, offset = 0 } = {}) => {
    if (!proveidor?.id) return;
    if (append) setCarregantMes(true);
    else setLoading(true);
    setError('');
    try {
      const peticions = [
        getRecepcions({ idProveidor: proveidor.id, limit: HISTORIAL_PAGE, offset })
      ];
      if (!append) peticions.push(getResumProveidor(proveidor.id));
      const [files, resumNou] = await Promise.all(peticions);
      setHistorial((prev) => (append ? [...prev, ...(files || [])] : (files || [])));
      setHasMore((files || []).length >= HISTORIAL_PAGE);
      if (!append) setResum(resumNou);
    } catch (err) {
      setError(err.message || 'No s\'ha pogut carregar la fitxa.');
    } finally {
      setLoading(false);
      setCarregantMes(false);
    }
  }, [proveidor?.id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function colorEstat(estat) {
    if (estat === 'bo') return success;
    if (estat === 'regular') return warning;
    return danger;
  }

  const th = {
    padding: '12px 16px',
    textAlign: 'left',
    fontWeight: 600,
    color: colors.textSecondary,
    fontSize: 12,
    textTransform: 'uppercase',
    borderBottom: `1px solid ${colors.border}`
  };
  const td = { padding: '12px 16px' };
  const buit = !loading && !error && resum && resum.total === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <button
          type="button"
          onClick={onTornar}
          style={{
            padding: 0,
            border: 'none',
            background: 'none',
            color: colors.primary,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          ← Tornar als proveïdors
        </button>
        <h2 style={{ margin: '10px 0 0', fontSize: 22, fontWeight: 700 }}>{proveidor.nom || '—'}</h2>
      </div>

      <div style={{
        background: colors.card,
        border: `0.5px solid ${colors.border}`,
        borderRadius: 12,
        padding: 20,
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
        gap: 14,
        fontSize: 14
      }}>
        <div><strong>NIF</strong><div>{proveidor.cif || '—'}</div></div>
        <div><strong>Codi</strong><div>{proveidor.codi_intern || '—'}</div></div>
        <div><strong>Estat</strong><div>{LABEL_ESTAT_PROVEIDOR[proveidor.estat_us] || 'Habitual'}</div></div>
        <div><strong>Contacte</strong><div>{proveidor.contacte || '—'}</div></div>
        <div><strong>Origen</strong><div>{origenProveidor(proveidor)}</div></div>
      </div>

      {loading ? (
        <p style={{ color: colors.textSecondary }}>Carregant la fitxa…</p>
      ) : null}
      {error ? <p style={{ color: danger, margin: 0 }}>{error}</p> : null}

      {resum && !error ? (
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ResumPill label="Recepcions" valor={resum.total} colors={colors} />
          <ResumPill label="Última" valor={resum.ultimaRecepcio ? formatData(resum.ultimaRecepcio) : '—'} colors={colors} />
          <ResumPill label="Bo" valor={resum.perEstat.bo} colors={colors} />
          <ResumPill label="Regular" valor={resum.perEstat.regular} colors={colors} />
          <ResumPill label="Rebutjat" valor={resum.perEstat.rebutjat} colors={colors} />
        </div>
      ) : null}

      {buit ? (
        <p style={{ margin: 0, color: colors.textSecondary }}>
          Aquest proveïdor encara no té cap recepció registrada.
        </p>
      ) : null}

      {!buit && historial.length > 0 ? (
        <>
          <div style={{ overflowX: 'auto', background: colors.card, border: `0.5px solid ${colors.border}`, borderRadius: 12 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Data', 'Lot proveïdor', 'Temp.', 'Estat', 'Congelat', 'Operari'].map((col) => (
                    <th key={col} style={th}>{col}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {historial.map((r) => (
                  <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={td}>{formatData(r.data_recepcio)}</td>
                    <td style={td}>{r.lot_proveidor || '—'}</td>
                    <td style={td}>{r.temperatura_arribada != null ? `${r.temperatura_arribada} °C` : '—'}</td>
                    <td style={td}>
                      <span style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 600,
                        background: `${colorEstat(r.estat)}22`,
                        color: colorEstat(r.estat)
                      }}>
                        {ESTATS.find((e) => e.value === r.estat)?.label || r.estat || '—'}
                      </span>
                    </td>
                    <td style={td}>{r.congelat ? 'Sí' : 'No'}</td>
                    <td style={td}>{r.operari || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {hasMore ? (
            <button
              type="button"
              disabled={carregantMes}
              onClick={() => carregar({ append: true, offset: historial.length })}
              style={{
                alignSelf: 'flex-start',
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
      ) : null}
    </div>
  );
}

function ResumPill({ label, valor, colors }) {
  return (
    <div style={{
      padding: '10px 14px',
      borderRadius: 10,
      background: colors.card,
      border: `0.5px solid ${colors.border}`,
      minWidth: 110
    }}>
      <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 600 }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 700, marginTop: 2 }}>{valor}</div>
    </div>
  );
}
