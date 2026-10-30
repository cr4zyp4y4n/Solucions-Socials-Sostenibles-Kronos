import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import {
  LICITACIONS_CONFIG_FALLBACK,
  loadLicitacionsConfig
} from '../../services/licitacionsConfig';
import licitacionsService from '../../services/licitacionsService';
import { supabase } from '../../config/supabase';
import { isValidCpvCode } from './licitacionsHelpers';

function listToText(arr) {
  return (arr || []).join('\n');
}

function textToList(text) {
  return String(text || '')
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function keywordsToText(obj) {
  const lines = [];
  for (const [area, list] of Object.entries(obj || {})) {
    for (const kw of list || []) lines.push(`${area}|${kw}`);
  }
  return lines.join('\n');
}

function textToKeywords(text) {
  const map = { Catering: [], Tech: [], Altres: [] };
  for (const line of textToList(text)) {
    const pipe = line.indexOf('|');
    if (pipe > 0) {
      const area = line.slice(0, pipe).trim();
      const kw = line.slice(pipe + 1).trim();
      if (!map[area]) map[area] = [];
      if (kw) map[area].push(kw);
    } else if (line) {
      map.Catering.push(line);
    }
  }
  return map;
}

export default function LicitacionsConfigModal({ open, onClose, onSaved }) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(LICITACIONS_CONFIG_FALLBACK);
  const [cpvCatering, setCpvCatering] = useState('');
  const [cpvTech, setCpvTech] = useState('');
  const [cpvExclusio, setCpvExclusio] = useState('');
  const [cpvAltres, setCpvAltres] = useState('');
  const [kwExclusio, setKwExclusio] = useState('');
  const [kwReserva, setKwReserva] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const { config } = await loadLicitacionsConfig(supabase);
        if (cancelled) return;
        setDraft(config);
        setCpvCatering(listToText(config.cpv_catering));
        setCpvTech(listToText(config.cpv_tech));
        setCpvExclusio(listToText(config.cpv_exclusio));
        setCpvAltres(listToText(config.cpv_altres));
        setKwExclusio(keywordsToText(config.keywords_exclusio));
        setKwReserva(listToText(config.keywords_reserva));
      } catch (e) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const inputStyle = {
    width: '100%',
    background: colors.background,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    boxSizing: 'border-box',
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
  };

  const labelStyle = {
    fontSize: 11,
    fontWeight: 700,
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    marginBottom: 6
  };

  const handleSave = async () => {
    setError('');
    const lists = {
      cpv_catering: textToList(cpvCatering),
      cpv_tech: textToList(cpvTech),
      cpv_exclusio: textToList(cpvExclusio),
      cpv_altres: textToList(cpvAltres)
    };
    for (const [key, codes] of Object.entries(lists)) {
      const bad = codes.find((c) => !isValidCpvCode(c));
      if (bad) {
        setError(`CPV invàlid a ${key}: "${bad}" (calen 8 dígits)`);
        return;
      }
    }
    const payload = {
      cpv_catering: lists.cpv_catering,
      cpv_tech: lists.cpv_tech,
      cpv_exclusio: lists.cpv_exclusio,
      cpv_altres: lists.cpv_altres,
      keywords_exclusio: textToKeywords(kwExclusio),
      keywords_reserva: textToList(kwReserva),
      import_max: draft.import_max || LICITACIONS_CONFIG_FALLBACK.import_max,
      fonts_actives: draft.fonts_actives || LICITACIONS_CONFIG_FALLBACK.fonts_actives,
      placsp_max_pages: Number(draft.placsp_max_pages) || 60
    };
    setSaving(true);
    try {
      await licitacionsService.saveLicitacionsConfigMap(payload);
      onSaved?.(payload);
      onClose?.();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSaving(false);
    }
  };

  const fonts = draft.fonts_actives || {};

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1003,
            padding: 24
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(720px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              background: colors.surface,
              borderRadius: 16,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{
              padding: '18px 22px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
                  Configuració de filtres
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  CPV (8 dígits), keywords i fonts actives. Canvis sense release.
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
                aria-label="Tancar"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: 22, display: 'grid', gap: 16 }}>
              {loading ? (
                <div style={{ color: colors.textSecondary }}>Carregant…</div>
              ) : (
                <>
                  <div>
                    <div style={labelStyle}>CPV Càtering (un per línia)</div>
                    <textarea rows={4} value={cpvCatering} onChange={(e) => setCpvCatering(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>CPV Tech</div>
                    <textarea rows={4} value={cpvTech} onChange={(e) => setCpvTech(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>CPV exclusió</div>
                    <textarea rows={3} value={cpvExclusio} onChange={(e) => setCpvExclusio(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>CPV Altres</div>
                    <textarea rows={2} value={cpvAltres} onChange={(e) => setCpvAltres(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Keywords exclusió (`Àrea|paraula`)</div>
                    <textarea rows={4} value={kwExclusio} onChange={(e) => setKwExclusio(e.target.value)} style={inputStyle} />
                  </div>
                  <div>
                    <div style={labelStyle}>Keywords reserva (DA 4ª)</div>
                    <textarea rows={3} value={kwReserva} onChange={(e) => setKwReserva(e.target.value)} style={inputStyle} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    {['Catering', 'Tech', 'Altres'].map((area) => (
                      <div key={area}>
                        <div style={labelStyle}>Import màx. {area} (€)</div>
                        <input
                          type="number"
                          value={draft.import_max?.[area] ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? null : Number(e.target.value);
                            setDraft((d) => ({
                              ...d,
                              import_max: { ...(d.import_max || {}), [area]: v }
                            }));
                          }}
                          style={{ ...inputStyle, fontFamily: 'inherit' }}
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <div style={labelStyle}>Fonts actives</div>
                    <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {['TED', 'PSCP', 'PLACSP', 'PLACSP_MENORS'].map((font) => (
                        <label key={font} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontSize: 13, color: colors.text }}>
                          <input
                            type="checkbox"
                            checked={Boolean(fonts[font])}
                            onChange={(e) => setDraft((d) => ({
                              ...d,
                              fonts_actives: { ...(d.fonts_actives || {}), [font]: e.target.checked }
                            }))}
                          />
                          {font}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div style={labelStyle}>PLACSP max pàgines</div>
                    <input
                      type="number"
                      min={1}
                      max={200}
                      value={draft.placsp_max_pages ?? 60}
                      onChange={(e) => setDraft((d) => ({ ...d, placsp_max_pages: Number(e.target.value) || 60 }))}
                      style={{ ...inputStyle, fontFamily: 'inherit', maxWidth: 140 }}
                    />
                  </div>
                </>
              )}

              {error ? (
                <div style={{ color: colors.error, fontSize: 13 }}>{error}</div>
              ) : null}
            </div>

            <div style={{
              padding: '14px 22px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10
            }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.textSecondary,
                  cursor: 'pointer'
                }}
              >
                Cancel·lar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1px solid ${colors.primary}55`,
                  background: colors.primary,
                  color: '#fff',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  fontWeight: 600
                }}
              >
                <Save size={15} />
                {saving ? 'Desant…' : 'Desar'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
