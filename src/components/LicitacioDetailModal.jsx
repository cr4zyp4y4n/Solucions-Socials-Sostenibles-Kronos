import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Save, Tag } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { usePrivacy } from './PrivacyContext';
import { applyPrivacyMoney } from '../utils/privacyFormat';
import { getEstatContractacioMeta } from '../constants/licitacionsEstat';

const ESTATS = ['Pendent', 'Interessant', 'Descartada', 'Contactat'];

const SOURCE_COLORS = {
  TED: '#3B82F6',
  PSCP: '#F59E0B',
  PLACSP: '#8B5CF6'
};

function formatMoneyBase(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
  } catch {
    return `${n.toFixed(2)} €`;
  }
}

function formatDate(value) {
  if (!value) return '—';
  const s = String(value);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!iso) return s;
  const [y, m, d] = iso[1].split('-');
  return `${d}/${m}/${y}`;
}

function formatDateInput(value) {
  if (!value) return '';
  const s = String(value);
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  return iso ? iso[1] : '';
}

function formatDateTime(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch {
    return String(value);
  }
}

function InfoBlock({ label, value, colors, fullWidth, children }) {
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{
        fontSize: 11,
        fontWeight: 700,
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.04em',
        marginBottom: 6
      }}>
        {label}
      </div>
      {children || (
        <div style={{
          color: colors.text,
          fontSize: 14,
          lineHeight: 1.45,
          wordBreak: 'break-word'
        }}>
          {value ?? '—'}
        </div>
      )}
    </div>
  );
}

function SectionTitle({ children, colors }) {
  return (
    <div style={{
      fontSize: 13,
      fontWeight: 700,
      color: colors.primary,
      marginBottom: 14,
      paddingBottom: 8,
      borderBottom: `1px solid ${colors.border}`
    }}>
      {children}
    </div>
  );
}

export default function LicitacioDetailModal({
  isOpen,
  row,
  onClose,
  onUpdate,
  onSave,
  onOpenUrl,
  saving = false
}) {
  const { colors } = useTheme();
  const { hideSensitiveData } = usePrivacy();
  const formatMoney = useCallback(
    (value) => applyPrivacyMoney(formatMoneyBase(value), hideSensitiveData),
    [hideSensitiveData]
  );
  const [draft, setDraft] = useState(row);
  const [commentView, setCommentView] = useState(
    () => (String(row?.notes_paula || '').trim() ? 'card' : 'compose')
  );
  const [composeText, setComposeText] = useState('');
  const [cardText, setCardText] = useState(() => String(row?.notes_paula || ''));

  useEffect(() => {
    setDraft(row);
    const saved = String(row?.notes_paula || '');
    if (saved.trim()) {
      setCommentView('card');
      setCardText(saved);
      setComposeText('');
    } else {
      setCommentView('compose');
      setCardText('');
    }
  }, [row]);

  if (!isOpen || !draft) return null;

  const sourceColor = SOURCE_COLORS[draft.source] || colors.textSecondary;
  const cpvList = Array.isArray(draft.cpv_codes) ? draft.cpv_codes.filter(Boolean) : [];
  const estatMeta = getEstatContractacioMeta(draft.estat_contractacio, draft.estat_contractacio_label);

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

  const patchDraft = (patch) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    onUpdate(draft.id, patch);
  };

  const handleSave = async () => {
    const notes = commentView === 'card' ? cardText : composeText;
    await onSave(draft.id, { notes_paula: notes });
  };

  const danger = colors.error || '#DC2626';

  return (
    <AnimatePresence>
      {isOpen ? (
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
            zIndex: 1002,
            padding: 24
          }}
        >
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.98 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(760px, 100%)',
              maxHeight: '90vh',
              overflow: 'auto',
              background: colors.surface,
              borderRadius: 16,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)'
            }}
          >
            {/* Cabecera */}
            <div style={{
              padding: '22px 24px 18px',
              borderBottom: `1px solid ${colors.border}`,
              display: 'flex',
              gap: 16,
              alignItems: 'flex-start'
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: sourceColor,
                    background: `${sourceColor}18`,
                    border: `1px solid ${sourceColor}33`
                  }}>
                    {draft.source}
                  </span>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 600,
                    color: colors.textSecondary,
                    background: colors.background,
                    border: `1px solid ${colors.border}`
                  }}>
                    {draft.sector || 'Altres'}
                  </span>
                </div>
                <h2 style={{
                  margin: 0,
                  fontSize: 20,
                  fontWeight: 700,
                  color: colors.text,
                  lineHeight: 1.35
                }}>
                  {draft.title}
                </h2>
                <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
                  {draft.external_id}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: colors.textSecondary,
                  padding: 6,
                  borderRadius: 8,
                  flexShrink: 0
                }}
                aria-label="Cerrar"
              >
                <X size={20} />
              </button>
            </div>

            <div style={{ padding: '22px 24px' }}>
              <SectionTitle colors={colors}>Datos de la licitación</SectionTitle>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '18px 24px',
                marginBottom: 28
              }}>
                <InfoBlock label="Organismo" value={draft.organismo || '—'} colors={colors} fullWidth />
                <InfoBlock label="Estado del expediente" colors={colors}>
                  <span style={{
                    display: 'inline-flex',
                    padding: '6px 12px',
                    borderRadius: 999,
                    fontSize: 13,
                    fontWeight: 700,
                    color: estatMeta.color,
                    background: `${estatMeta.color}18`,
                    border: `1px solid ${estatMeta.color}33`
                  }}>
                    {estatMeta.label}
                  </span>
                </InfoBlock>
                {draft.fase_publicacio ? (
                  <InfoBlock label="Fase de publicación (fuente)" value={draft.fase_publicacio} colors={colors} />
                ) : null}
                {draft.ofertes_rebudes != null ? (
                  <InfoBlock label="Ofertas recibidas" value={String(draft.ofertes_rebudes)} colors={colors} />
                ) : null}
                <InfoBlock label="Importe estimado" value={formatMoney(draft.import_estimat)} colors={colors} />
                <InfoBlock label="Fin de oferta" value={formatDate(draft.termini_oferta)} colors={colors} />
                <InfoBlock label="Duración" value={draft.duracio || 'No disponible en la fuente'} colors={colors} />
                <InfoBlock label="Detectada" value={formatDateTime(draft.detected_at)} colors={colors} />
                <InfoBlock label="Última actualización" value={formatDateTime(draft.updated_at)} colors={colors} />
              </div>

              <SectionTitle colors={colors}>Códigos CPV</SectionTitle>
              <div style={{ marginBottom: 28 }}>
                {cpvList.length ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {cpvList.map((cpv) => (
                      <span
                        key={cpv}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          padding: '6px 12px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 600,
                          color: colors.text,
                          background: colors.background,
                          border: `1px solid ${colors.border}`
                        }}
                      >
                        <Tag size={13} color={colors.primary} />
                        {cpv}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: colors.textSecondary, fontSize: 14 }}>
                    No disponible en la fuente
                  </div>
                )}
              </div>

              {(draft.requisits || draft.criteris) ? (
                <>
                  <SectionTitle colors={colors}>Requisitos y criterios</SectionTitle>
                  <div style={{
                    display: 'grid',
                    gap: 18,
                    marginBottom: 28
                  }}>
                    {draft.requisits ? (
                      <InfoBlock label="Requisitos" colors={colors} fullWidth>
                        <div style={{
                          color: colors.text,
                          fontSize: 14,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: colors.background,
                          border: `1px solid ${colors.border}`
                        }}>
                          {draft.requisits}
                        </div>
                      </InfoBlock>
                    ) : null}
                    {draft.criteris ? (
                      <InfoBlock label="Criterios de valoración" colors={colors} fullWidth>
                        <div style={{
                          color: colors.text,
                          fontSize: 14,
                          lineHeight: 1.55,
                          whiteSpace: 'pre-wrap',
                          padding: '12px 14px',
                          borderRadius: 10,
                          background: colors.background,
                          border: `1px solid ${colors.border}`
                        }}>
                          {draft.criteris}
                        </div>
                      </InfoBlock>
                    ) : null}
                  </div>
                </>
              ) : null}

              <SectionTitle colors={colors}>Seguimiento comercial</SectionTitle>
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 18,
                marginBottom: 18
              }}>
                <div>
                  <InfoBlock label="Estado JC" colors={colors}>
                    <select
                      value={draft.estat_jc || 'Pendent'}
                      onChange={(e) => patchDraft({ estat_jc: e.target.value })}
                      style={inputStyle}
                    >
                      {ESTATS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </InfoBlock>
                </div>
                <div>
                  <InfoBlock label="Fecha de contacto" colors={colors}>
                    <input
                      type="date"
                      value={formatDateInput(draft.data_contacte)}
                      onChange={(e) => patchDraft({ data_contacte: e.target.value || null })}
                      style={inputStyle}
                    />
                  </InfoBlock>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <InfoBlock label="Resultado del contacto" colors={colors}>
                    <input
                      value={draft.resultat_jc || ''}
                      onChange={(e) => patchDraft({ resultat_jc: e.target.value })}
                      placeholder="Resultado del seguimiento comercial…"
                      style={inputStyle}
                    />
                  </InfoBlock>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <InfoBlock label="Comentarios Paula" colors={colors}>
                    {commentView === 'card' ? (
                      <textarea
                        value={cardText}
                        onChange={(e) => setCardText(e.target.value)}
                        placeholder="Editar comentario…"
                        rows={4}
                        style={{
                          ...inputStyle,
                          background: `${danger}14`,
                          border: `1px solid ${danger}44`,
                          borderLeft: `4px solid ${danger}`,
                          color: danger,
                          fontWeight: 650,
                          resize: 'vertical',
                          minHeight: 100
                        }}
                      />
                    ) : (
                      <textarea
                        value={composeText}
                        onChange={(e) => setComposeText(e.target.value)}
                        placeholder="Ej: Revisado, espera respuesta Sergi…"
                        rows={4}
                        style={{
                          ...inputStyle,
                          resize: 'vertical',
                          minHeight: 100
                        }}
                      />
                    )}
                  </InfoBlock>
                </div>
              </div>

              {draft.url ? (
                <div style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  marginBottom: 8
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: colors.textSecondary, marginBottom: 6 }}>
                    ENLACE ORIGINAL
                  </div>
                  <button
                    type="button"
                    onClick={() => onOpenUrl(draft.url)}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: colors.primary,
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                      wordBreak: 'break-all',
                      textDecoration: 'underline'
                    }}
                  >
                    {draft.url}
                  </button>
                </div>
              ) : null}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 24px 22px',
              borderTop: `1px solid ${colors.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              flexWrap: 'wrap'
            }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={onClose}
                style={{
                  padding: '10px 16px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.textSecondary,
                  cursor: 'pointer',
                  fontSize: 14
                }}
              >
                Cerrar
              </motion.button>
              {draft.url ? (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => onOpenUrl(draft.url)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '10px 16px',
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text,
                    cursor: 'pointer',
                    fontSize: 14
                  }}
                >
                  <ExternalLink size={15} />
                  Abrir original
                </motion.button>
              ) : null}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleSave}
                disabled={saving}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 18px',
                  borderRadius: 10,
                  border: `1px solid ${colors.primary}55`,
                  background: colors.primary,
                  color: 'white',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  fontSize: 14,
                  fontWeight: 600
                }}
              >
                <Save size={15} />
                {saving ? 'Guardando…' : 'Guardar'}
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
