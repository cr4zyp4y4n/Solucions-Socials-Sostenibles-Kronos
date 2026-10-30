import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ExternalLink, Save, Tag } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { usePrivacy } from './PrivacyContext';
import { applyPrivacyMoney } from '../utils/privacyFormat';
import { getEstatContractacioMeta } from '../constants/licitacionsEstat';
import {
  LICITACIONS_ESTAT_CIRCUIT,
  LICITACIONS_ESTAT_CIRCUIT_META
} from '../constants/licitacionsCpv';
import licitacionsService from '../services/licitacionsService';

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
  saving = false,
  responsables = []
}) {
  const { colors } = useTheme();
  const { hideSensitiveData } = usePrivacy();
  const formatMoney = useCallback(
    (value) => applyPrivacyMoney(formatMoneyBase(value), hideSensitiveData),
    [hideSensitiveData]
  );
  const [draft, setDraft] = useState(row);
  const [tab, setTab] = useState('dades');
  const [events, setEvents] = useState([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [profileNames, setProfileNames] = useState({});
  const [localError, setLocalError] = useState('');
  const [commentView, setCommentView] = useState(
    () => (String(row?.notes_paula || '').trim() ? 'card' : 'compose')
  );
  const [composeText, setComposeText] = useState('');
  const [cardText, setCardText] = useState(() => String(row?.notes_paula || ''));

  useEffect(() => {
    setDraft(row);
    setTab('dades');
    setLocalError('');
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

  useEffect(() => {
    if (!isOpen || !row?.id || tab !== 'historial') return undefined;
    let cancelled = false;
    (async () => {
      setEventsLoading(true);
      try {
        const data = await licitacionsService.loadLicitacioEvents(row.id);
        if (cancelled) return;
        setEvents(data);
        const ids = [...new Set(data.map((e) => e.user_id).filter(Boolean))];
        if (ids.length) {
          const map = {};
          for (const p of responsables) {
            if (ids.includes(p.id)) map[p.id] = p.name || p.id;
          }
          setProfileNames(map);
        }
      } catch (_) {
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, row?.id, tab, responsables]);

  if (!isOpen || !draft) return null;

  const sourceColor = SOURCE_COLORS[draft.source] || colors.textSecondary;
  const cpvList = Array.isArray(draft.cpv_codes) ? draft.cpv_codes.filter(Boolean) : [];
  const estatMeta = getEstatContractacioMeta(draft.estat_contractacio, draft.estat_contractacio_label);
  const circuitMeta = LICITACIONS_ESTAT_CIRCUIT_META[draft.estat_circuit] || LICITACIONS_ESTAT_CIRCUIT_META.Detectada;
  const danger = colors.error || '#DC2626';

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

  const handleCircuitChange = (next) => {
    setLocalError('');
    if (next === 'Descartada' && !String(draft.motiu_descart || '').trim()) {
      setLocalError('Indica el motiu de descart abans de passar a Descartada');
      patchDraft({ estat_circuit: next });
      return;
    }
    if (next === 'Valorada' && !String(draft.valoracio || '').trim()) {
      setLocalError('Afegeix una valoració curta abans de desar com a Valorada');
      patchDraft({ estat_circuit: next });
      return;
    }
    patchDraft({ estat_circuit: next });
  };

  const handleSave = async () => {
    setLocalError('');
    const notes = commentView === 'card' ? cardText : composeText;
    const patch = {
      notes_paula: notes,
      estat_circuit: draft.estat_circuit || 'Detectada',
      motiu_descart: draft.motiu_descart || null,
      valoracio: draft.valoracio || null,
      responsable_area_id: draft.responsable_area_id || null
    };
    if (patch.estat_circuit === 'Descartada' && !String(patch.motiu_descart || '').trim()) {
      setLocalError('Cal motiu per descartar');
      setTab('circuit');
      return;
    }
    try {
      await onSave(draft.id, patch);
    } catch (e) {
      setLocalError(e?.message || String(e));
    }
  };

  const tabs = [
    { id: 'dades', label: 'Dades' },
    { id: 'circuit', label: 'Circuit' },
    { id: 'historial', label: 'Historial' }
  ];

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
            <div style={{
              padding: '22px 24px 12px',
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
                    {draft.area || draft.sector || 'Altres'}
                  </span>
                  <span style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    fontSize: 12,
                    fontWeight: 700,
                    color: circuitMeta.color,
                    background: `${circuitMeta.color}18`,
                    border: `1px solid ${circuitMeta.color}33`
                  }}>
                    {circuitMeta.label}
                  </span>
                  {draft.reservada ? (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 800,
                      color: '#fff',
                      background: '#DC2626',
                      letterSpacing: '0.02em'
                    }}>
                      Reservada DA 4ª
                    </span>
                  ) : null}
                  {draft.contracte_menor ? (
                    <span style={{
                      padding: '4px 10px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      color: colors.textSecondary,
                      border: `1px solid ${colors.border}`
                    }}>
                      Contracte menor
                    </span>
                  ) : null}
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

            <div style={{
              display: 'flex',
              gap: 4,
              padding: '10px 24px 0',
              borderBottom: `1px solid ${colors.border}`
            }}>
              {tabs.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setTab(t.id)}
                    style={{
                      padding: '10px 14px',
                      border: 'none',
                      borderBottom: active ? `2px solid ${colors.primary}` : '2px solid transparent',
                      background: 'transparent',
                      color: active ? colors.primary : colors.textSecondary,
                      fontWeight: 700,
                      fontSize: 13,
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            <div style={{ padding: '22px 24px' }}>
              {localError ? (
                <div style={{
                  marginBottom: 14,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: `${danger}12`,
                  border: `1px solid ${danger}33`,
                  color: danger,
                  fontSize: 13
                }}>
                  {localError}
                </div>
              ) : null}

              {tab === 'dades' ? (
                <>
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
                    <InfoBlock label="Importe estimado" value={formatMoney(draft.import_estimat)} colors={colors} />
                    <InfoBlock label="Fin de oferta" value={formatDate(draft.termini_oferta)} colors={colors} />
                    <InfoBlock label="Duración" value={draft.duracio || 'No disponible en la fuente'} colors={colors} />
                    <InfoBlock label="Detectada" value={formatDateTime(draft.detected_at)} colors={colors} />
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

                  {draft.url ? (
                    <div style={{
                      padding: '12px 14px',
                      borderRadius: 10,
                      background: colors.background,
                      border: `1px solid ${colors.border}`
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
                </>
              ) : null}

              {tab === 'circuit' ? (
                <>
                  <SectionTitle colors={colors}>Circuit comercial</SectionTitle>
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 18,
                    marginBottom: 18
                  }}>
                    <div>
                      <InfoBlock label="Estat del circuit" colors={colors}>
                        <select
                          value={draft.estat_circuit || 'Detectada'}
                          onChange={(e) => handleCircuitChange(e.target.value)}
                          style={inputStyle}
                        >
                          {LICITACIONS_ESTAT_CIRCUIT.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </InfoBlock>
                    </div>
                    <div>
                      <InfoBlock label="Responsable d'àrea" colors={colors}>
                        <select
                          value={draft.responsable_area_id || ''}
                          onChange={(e) => patchDraft({ responsable_area_id: e.target.value || null })}
                          style={inputStyle}
                        >
                          <option value="">Sense assignar</option>
                          {responsables.map((p) => (
                            <option key={p.id} value={p.id}>{p.name || p.id}</option>
                          ))}
                        </select>
                      </InfoBlock>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <InfoBlock label="Valoració (obligatòria si Valorada)" colors={colors}>
                        <input
                          value={draft.valoracio || ''}
                          onChange={(e) => patchDraft({ valoracio: e.target.value })}
                          placeholder="Valoració curta de l'oportunitat…"
                          style={inputStyle}
                        />
                      </InfoBlock>
                    </div>
                    <div style={{ gridColumn: '1 / -1' }}>
                      <InfoBlock label="Motiu de descart (obligatori si Descartada)" colors={colors}>
                        <textarea
                          value={draft.motiu_descart || ''}
                          onChange={(e) => patchDraft({ motiu_descart: e.target.value })}
                          placeholder="Per què es descarta…"
                          rows={3}
                          style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }}
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
                </>
              ) : null}

              {tab === 'historial' ? (
                <>
                  <SectionTitle colors={colors}>Historial d'estats</SectionTitle>
                  {eventsLoading ? (
                    <div style={{ color: colors.textSecondary, fontSize: 14 }}>Carregant…</div>
                  ) : events.length === 0 ? (
                    <div style={{ color: colors.textSecondary, fontSize: 14 }}>Sense esdeveniments encara.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: 10 }}>
                      {events.map((ev) => (
                        <div
                          key={ev.id}
                          style={{
                            padding: '12px 14px',
                            borderRadius: 10,
                            background: colors.background,
                            border: `1px solid ${colors.border}`
                          }}
                        >
                          <div style={{ fontSize: 13, color: colors.text, fontWeight: 650 }}>
                            {ev.estat_anterior || '—'} → {ev.estat_nou}
                          </div>
                          <div style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary }}>
                            {formatDateTime(ev.created_at)}
                            {ev.user_id ? ` · ${profileNames[ev.user_id] || 'Usuari'}` : ''}
                          </div>
                          {ev.nota ? (
                            <div style={{ marginTop: 6, fontSize: 13, color: colors.text }}>{ev.nota}</div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : null}
            </div>

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
