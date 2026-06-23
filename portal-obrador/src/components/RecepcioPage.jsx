import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera } from 'lucide-react';
import { colors } from '../theme';
import { getProveidors, crearRecepcio } from '../services/obradorPortalService';
import {
  parseAlbaranText,
  buildRecepcioDraftFromParsed
} from '../services/obradorAlbaranParser';
import {
  ocrTextFromAlbaranFile,
  pdfFirstPagePreviewUrl,
  isPdfFile
} from '../utils/obradorOcrFromFile';

const ESTATS = [
  { value: 'bo', label: 'Bo' },
  { value: 'regular', label: 'Regular' },
  { value: 'rebutjat', label: 'Rebutjat' }
];

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

export default function RecepcioPage({ userEmail }) {
  const [proveidors, setProveidors] = useState([]);
  const [form, setForm] = useState(formInicial);
  const [ocrDraft, setOcrDraft] = useState(null);
  const [ocrProcessing, setOcrProcessing] = useState(false);
  const [ocrProgress, setOcrProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState('');
  const [enviant, setEnviant] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const fileInputRef = useRef(null);

  const inputStyle = {
    width: '100%',
    padding: '12px',
    fontSize: 16,
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    boxSizing: 'border-box'
  };

  const carregar = useCallback(async () => {
    try {
      const provResult = await getProveidors();
      setProveidors(provResult.proveidors);
    } catch (err) {
      setError(err.message || 'Error carregant proveïdors');
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function actualitzar(camp, valor) {
    setForm((prev) => ({ ...prev, [camp]: valor }));
    setError('');
  }

  async function handleFoto(e) {
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

    if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
    setError('');
    setSuccessMsg('');
    setOcrProcessing(true);
    setOcrProgress(0);
    setOcrDraft(null);

    try {
      if (isPdfFile(file)) {
        const thumb = await pdfFirstPagePreviewUrl(file);
        setPreviewUrl(thumb || '');
      } else {
        setPreviewUrl(URL.createObjectURL(file));
      }

      const text = await ocrTextFromAlbaranFile(file, {
        onProgress: setOcrProgress
      });

      const parsed = parseAlbaranText(text);
      const draft = buildRecepcioDraftFromParsed(parsed, proveidors);
      setOcrDraft(draft);
      setForm({
        ...formInicial(),
        id_proveidor: draft.id_proveidor || '',
        lot_proveidor: draft.lot_proveidor || '',
        caducitat: draft.caducitat || '',
        observacions: draft.observacions || '',
        operari: userEmail?.split('@')[0] || ''
      });

      if (!draft.id_proveidor && parsed.proveidorNom) {
        setError(`Selecciona el proveïdor manualment (detectat: ${parsed.proveidorNom})`);
      }
    } catch (err) {
      setError(err.message || 'Error OCR');
    } finally {
      setOcrProcessing(false);
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
      setError('Observacions obligatòries si és rebutjat.');
      return;
    }

    const tempNum = form.temperatura_arribada === '' ? null : Number(form.temperatura_arribada);

    setEnviant(true);
    try {
      await crearRecepcio({
        id_proveidor: form.id_proveidor,
        lot_proveidor: form.lot_proveidor || null,
        temperatura_arribada: tempNum,
        estat: form.estat,
        caducitat: form.caducitat || null,
        congelat: form.congelat,
        observacions: form.observacions || null,
        operari: form.operari || null
      });
      setSuccessMsg('Recepció registrada correctament');
      setForm(formInicial());
      setOcrDraft(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl('');
      }
    } catch (err) {
      setError(err.message || 'Error en registrar');
    } finally {
      setEnviant(false);
    }
  }

  return (
    <div style={{ maxWidth: 520, margin: '0 auto', padding: '16px 16px 48px' }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 22 }}>Nova recepció</h2>
      <p style={{ margin: '0 0 16px', fontSize: 14, color: colors.textSecondary }}>
        Fotografia l&apos;albarà en paper; revisa les dades abans de confirmar.
      </p>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf,.pdf"
        style={{ display: 'none' }}
        onChange={handleFoto}
      />

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        disabled={ocrProcessing}
        style={{
          width: '100%',
          padding: '16px',
          marginBottom: 16,
          borderRadius: 12,
          border: `2px dashed ${colors.primary}`,
          background: `${colors.primary}10`,
          color: colors.primary,
          fontWeight: 700,
          fontSize: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          cursor: ocrProcessing ? 'wait' : 'pointer'
        }}
      >
        <Camera size={22} />
        {ocrProcessing ? `Llegint OCR… ${ocrProgress}%` : 'Foto, imatge o PDF de l\'albarà'}
      </button>

      {previewUrl && (
        <img
          src={previewUrl}
          alt="Vista prèvia albarà"
          style={{ width: '100%', borderRadius: 10, marginBottom: 16, border: `1px solid ${colors.border}` }}
        />
      )}

      {ocrDraft?._parsed && (
        <div style={{
          padding: 12,
          marginBottom: 16,
          borderRadius: 10,
          background: `${colors.warning}18`,
          border: `1px solid ${colors.warning}`,
          fontSize: 13
        }}>
          <strong>Borrador OCR</strong> — confirma o corregeix.
          <div>Parser: {ocrDraft._parsed.parserId} · {ocrDraft._parsed.confiança}</div>
        </div>
      )}

      {successMsg && (
        <div style={{ padding: 12, marginBottom: 16, borderRadius: 8, background: `${colors.success}20`, color: colors.success }}>
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Proveïdor *
          <select
            value={form.id_proveidor}
            onChange={(e) => actualitzar('id_proveidor', e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
            required
          >
            <option value="">Selecciona...</option>
            {proveidors.map((p) => (
              <option key={p.id} value={p.id}>{p.nom}</option>
            ))}
          </select>
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Lot proveïdor / nº albarà
          <input
            type="text"
            value={form.lot_proveidor}
            onChange={(e) => actualitzar('lot_proveidor', e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Temperatura arribada (°C)
          <input
            type="number"
            step="0.1"
            value={form.temperatura_arribada}
            onChange={(e) => actualitzar('temperatura_arribada', e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
          <legend style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>Estat</legend>
          {ESTATS.map((opt) => (
            <label key={opt.value} style={{ display: 'block', marginBottom: 6, fontSize: 15 }}>
              <input
                type="radio"
                name="estat"
                value={opt.value}
                checked={form.estat === opt.value}
                onChange={(e) => actualitzar('estat', e.target.value)}
              />
              {' '}{opt.label}
            </label>
          ))}
        </fieldset>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Caducitat (si aplica)
          <input
            type="date"
            value={form.caducitat}
            onChange={(e) => actualitzar('caducitat', e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        <label style={{ fontSize: 15 }}>
          <input
            type="checkbox"
            checked={form.congelat}
            onChange={(e) => actualitzar('congelat', e.target.checked)}
          />
          {' '}Producte congelat
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Observacions
          <textarea
            rows={4}
            value={form.observacions}
            onChange={(e) => actualitzar('observacions', e.target.value)}
            style={{ ...inputStyle, marginTop: 6, resize: 'vertical' }}
          />
        </label>

        <label style={{ fontSize: 13, fontWeight: 600 }}>
          Operari
          <input
            type="text"
            value={form.operari}
            onChange={(e) => actualitzar('operari', e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </label>

        {error && <p style={{ margin: 0, color: colors.error, fontSize: 14 }}>{error}</p>}

        <button
          type="submit"
          disabled={enviant || ocrProcessing}
          style={{
            padding: '14px',
            borderRadius: 10,
            border: 'none',
            background: colors.primary,
            color: '#fff',
            fontWeight: 700,
            fontSize: 16,
            cursor: enviant ? 'not-allowed' : 'pointer'
          }}
        >
          {enviant ? 'Guardant...' : 'Confirmar recepció'}
        </button>
      </form>
    </div>
  );
}
