import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Copy, Download } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { supabase } from '../../config/supabase';
import {
  buildLicitacionsReportMarkdown,
  copyTextToClipboard,
  downloadMarkdownFile,
  formatWeekLabel,
  loadLicitacionsReportData,
  weekStartDateString
} from '../../services/licitacionsReport';

function recentWeekStarts(count = 8) {
  const list = [];
  const base = new Date();
  base.setHours(12, 0, 0, 0);
  const day = (base.getDay() + 6) % 7;
  base.setDate(base.getDate() - day);
  for (let i = 0; i < count; i += 1) {
    const d = new Date(base);
    d.setDate(d.getDate() - i * 7);
    list.push(d.toISOString().slice(0, 10));
  }
  return list;
}

export default function LicitacionsReportModal({ open, onClose }) {
  const { colors } = useTheme();
  const [weekStart, setWeekStart] = useState(() => weekStartDateString());
  const [properesAccions, setProperesAccions] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const weekOptions = useMemo(() => recentWeekStarts(10), []);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      setStatus('');
      try {
        const reportData = await loadLicitacionsReportData(supabase, { weekStart });
        if (!cancelled) setData(reportData);
      } catch (e) {
        if (!cancelled) {
          setData(null);
          setError(e?.message || String(e));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, weekStart]);

  const markdown = useMemo(() => {
    if (!data) return '';
    return buildLicitacionsReportMarkdown(data, { properesAccions });
  }, [data, properesAccions]);

  const handleCopy = async () => {
    setStatus('');
    try {
      await copyTextToClipboard(markdown);
      setStatus('Copiat al porta-retalls');
    } catch (e) {
      setError(e?.message || String(e));
    }
  };

  const handleDownload = () => {
    const name = `report-licitacions-${weekStart}.md`;
    downloadMarkdownFile(markdown, name);
    setStatus(`Descarregat: ${name}`);
  };

  const inputStyle = {
    width: '100%',
    background: colors.background,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 14,
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

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
              width: 'min(820px, 100%)',
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
              alignItems: 'flex-start',
              gap: 12
            }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
                  Report setmanal
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
                  Text en català per a Sergi · copiar o descarregar .md
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

            <div style={{ padding: 22, display: 'grid', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 8 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>
                  Setmana
                </label>
                <select
                  value={weekStart}
                  onChange={(e) => setWeekStart(e.target.value)}
                  style={inputStyle}
                >
                  {weekOptions.map((w) => (
                    <option key={w} value={w}>
                      {formatWeekLabel(w)}{w === weekStartDateString() ? ' (actual)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: colors.textSecondary }}>
                  Properes accions (opcional, s'inclou al report)
                </label>
                <textarea
                  value={properesAccions}
                  onChange={(e) => setProperesAccions(e.target.value)}
                  rows={3}
                  placeholder="Ex.: Contrastar amb responsables Càtering/Tech els CPV 7995…"
                  style={{ ...inputStyle, marginTop: 6, resize: 'vertical', minHeight: 72 }}
                />
              </div>

              {loading ? (
                <div style={{ color: colors.textSecondary }}>Generant report…</div>
              ) : error ? (
                <div style={{ color: colors.error, fontSize: 13 }}>{error}</div>
              ) : (
                <pre style={{
                  margin: 0,
                  padding: 14,
                  borderRadius: 12,
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  color: colors.text,
                  fontSize: 12,
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: '42vh',
                  overflow: 'auto',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
                }}>
                  {markdown}
                </pre>
              )}

              {status ? (
                <div style={{ fontSize: 13, color: colors.success }}>{status}</div>
              ) : null}
            </div>

            <div style={{
              padding: '14px 22px 20px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              flexWrap: 'wrap'
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
                Tancar
              </button>
              <button
                type="button"
                onClick={handleCopy}
                disabled={loading || !markdown}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.surface,
                  color: colors.text,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                <Copy size={15} />
                Copiar
              </button>
              <button
                type="button"
                onClick={handleDownload}
                disabled={loading || !markdown}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1px solid ${colors.primary}55`,
                  background: colors.primary,
                  color: '#fff',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                  fontWeight: 600
                }}
              >
                <Download size={15} />
                Descarregar .md
              </button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
