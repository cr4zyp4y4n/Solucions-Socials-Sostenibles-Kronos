import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FileText, RefreshCw, ExternalLink, Save, Search, HelpCircle, Settings, Clipboard } from 'feather-icons-react';
import { motion } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { usePrivacy } from './PrivacyContext';
import { useAuth } from './AuthContext';
import { applyPrivacyMoney } from '../utils/privacyFormat';
import SectionHeader from './SectionHeader';
import LicitacioDetailModal from './LicitacioDetailModal';
import LicitacionsStats from './licitacions/LicitacionsStats';
import LicitacionsLeyendaModal from './licitacions/LicitacionsLeyendaModal';
import LicitacionsConfigModal from './licitacions/LicitacionsConfigModal';
import LicitacionsReportModal from './licitacions/LicitacionsReportModal';
import licitacionsService from '../services/licitacionsService';
import { getEstatContractacioMeta } from '../constants/licitacionsEstat';
import {
  LICITACIONS_AREAS,
  LICITACIONS_ESTAT_CIRCUIT,
  LICITACIONS_ESTAT_CIRCUIT_META
} from '../constants/licitacionsCpv';
import { KronosButton } from './kronos';
import { supabase } from '../config/supabase';
import {
  computeLicitacionsStats,
  countNewSince,
  daysUntil,
  describeSyncBanner,
  formatLastSyncLabel,
  getLastSync,
  getLastVisit,
  isLicitacioVigent,
  setLastSync,
  setLastVisit,
  sortLicitacionsCircuit,
  startOfIsoWeek
} from './licitacions/licitacionsHelpers';

const SOURCES = ['', 'TED', 'PSCP', 'PLACSP'];

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

function yearFromLicitacio(row) {
  const fromTermini = String(row?.termini_oferta || '').match(/^(\d{4})/);
  if (fromTermini) return Number(fromTermini[1]);
  if (row?.detected_at) {
    const y = new Date(row.detected_at).getFullYear();
    if (Number.isFinite(y)) return y;
  }
  return null;
}

function PaulaCommentCard({ text, colors, onChange, placeholder }) {
  const danger = colors.error || '#DC2626';
  return (
    <textarea
      value={text || ''}
      onChange={(e) => onChange?.(e.target.value)}
      placeholder={placeholder || ''}
      rows={3}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        background: `${danger}14`,
        border: `1px solid ${danger}44`,
        borderLeft: `4px solid ${danger}`,
        borderRadius: 10,
        padding: '10px 12px',
        color: danger,
        fontSize: 13,
        fontWeight: 650,
        lineHeight: 1.4,
        resize: 'vertical',
        minHeight: 56,
        fontFamily: 'inherit',
        outline: 'none',
        boxShadow: `0 1px 2px ${danger}22`
      }}
    />
  );
}

function FieldLabel({ children, colors }) {
  return (
    <div style={{
      fontSize: 11,
      fontWeight: 700,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
      marginBottom: 6
    }}>
      {children}
    </div>
  );
}

function EstatContractacioBadge({ row }) {
  const meta = getEstatContractacioMeta(row?.estat_contractacio, row?.estat_contractacio_label);
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      color: meta.color,
      background: `${meta.color}18`,
      border: `1px solid ${meta.color}33`,
      lineHeight: 1.2,
      maxWidth: '100%'
    }}>
      {meta.label}
    </span>
  );
}

function CircuitBadge({ estat }) {
  const meta = LICITACIONS_ESTAT_CIRCUIT_META[estat] || LICITACIONS_ESTAT_CIRCUIT_META.Detectada;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      color: meta.color,
      background: `${meta.color}18`,
      border: `1px solid ${meta.color}33`
    }}>
      {meta.label}
    </span>
  );
}

function SourceBadge({ source, colors }) {
  const bg = SOURCE_COLORS[source] || colors.textSecondary;
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 12,
      fontWeight: 700,
      color: bg,
      background: `${bg}18`,
      border: `1px solid ${bg}33`
    }}>
      {source}
    </span>
  );
}

function LicitacioRow({ row, colors, formatMoney, onUpdate, onSave, onOpen, onSelect, isNew }) {
  const inputStyle = {
    width: '100%',
    background: colors.background,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 10,
    padding: '8px 10px',
    fontSize: 13,
    boxSizing: 'border-box'
  };

  const daysLeft = daysUntil(row.termini_oferta);
  const urgent = daysLeft != null && daysLeft >= 0 && daysLeft <= 7;

  const [commentView, setCommentView] = useState(
    () => (String(row.notes_paula || '').trim() ? 'card' : 'compose')
  );
  const [composeText, setComposeText] = useState('');
  const [cardText, setCardText] = useState(() => String(row.notes_paula || ''));
  const [rowError, setRowError] = useState('');
  // Electron no soporta window.prompt(): modal local para Valorada / Descartada
  const [circuitPrompt, setCircuitPrompt] = useState(null); // { next, field, label, value }

  useEffect(() => {
    const saved = String(row.notes_paula || '');
    if (saved.trim()) {
      setCommentView('card');
      setCardText(saved);
      setComposeText('');
    } else {
      setCommentView('compose');
      setCardText('');
    }
  }, [row.id, row.notes_paula]);

  function handleCircuitChange(next) {
    setRowError('');
    if (next === 'Descartada' && !String(row.motiu_descart || '').trim()) {
      setCircuitPrompt({
        next,
        field: 'motiu_descart',
        label: 'Motiu de descart (obligatori)',
        value: ''
      });
      return;
    }
    if (next === 'Valorada' && !String(row.valoracio || '').trim()) {
      setCircuitPrompt({
        next,
        field: 'valoracio',
        label: 'Valoració curta (obligatòria)',
        value: ''
      });
      return;
    }
    onUpdate(row.id, { estat_circuit: next });
  }

  function confirmCircuitPrompt() {
    if (!circuitPrompt) return;
    const text = String(circuitPrompt.value || '').trim();
    if (!text) {
      setRowError(circuitPrompt.field === 'motiu_descart' ? 'Cal motiu per descartar' : 'Cal valoració');
      return;
    }
    onUpdate(row.id, {
      estat_circuit: circuitPrompt.next,
      [circuitPrompt.field]: text
    });
    setCircuitPrompt(null);
    setRowError('');
  }

  function handleSaveClick() {
    const notes = commentView === 'card' ? cardText : composeText;
    onSave(row.id, {
      notes_paula: notes,
      estat_circuit: row.estat_circuit,
      motiu_descart: row.motiu_descart,
      valoracio: row.valoracio,
      responsable_area_id: row.responsable_area_id
    });
  }

  return (
    <div style={{
      borderBottom: `1px solid ${colors.border}`,
      padding: '16px 18px',
      minWidth: 1080,
      background: row.reservada ? `${colors.error || '#DC2626'}08` : 'transparent'
    }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(row)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(row);
          }
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1.3fr) 82px 90px 120px 100px 100px 110px',
          gap: 14,
          alignItems: 'start',
          marginBottom: 14,
          cursor: 'pointer',
          borderRadius: 10,
          padding: '6px 4px',
          margin: '-6px -4px 8px',
          transition: 'background 0.15s ease'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = colors.background; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        title="Ver detalle"
      >
        <div>
          <div style={{ color: colors.text, fontWeight: 700, fontSize: 14, lineHeight: 1.35, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ flex: 1 }}>{row.title}</span>
            {row.reservada ? (
              <span style={{
                fontSize: 10,
                fontWeight: 800,
                padding: '3px 8px',
                borderRadius: 6,
                background: '#DC2626',
                color: '#fff',
                flexShrink: 0
              }}>
                Reservada DA 4ª
              </span>
            ) : null}
            {isNew ? (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 6,
                background: `${colors.primary}18`,
                color: colors.primary,
                flexShrink: 0
              }}>
                Nueva
              </span>
            ) : null}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: 12 }}>{row.external_id}</div>
        </div>

        <div style={{ color: colors.text, fontSize: 13, lineHeight: 1.4 }}>
          {row.organismo || '—'}
        </div>

        <div>
          <SourceBadge source={row.source} colors={colors} />
        </div>

        <div style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
          {row.area || row.sector || 'Altres'}
        </div>

        <div>
          <CircuitBadge estat={row.estat_circuit} />
        </div>

        <div>
          <EstatContractacioBadge row={row} />
        </div>

        <div style={{ color: colors.text, fontSize: 13, fontWeight: 600 }}>
          {formatMoney(row.import_estimat)}
        </div>

        <div>
          <div style={{
            color: urgent ? colors.error : colors.text,
            fontSize: 13,
            fontWeight: urgent ? 700 : 600,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap'
          }}>
            {formatDate(row.termini_oferta)}
            {urgent ? (
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                padding: '2px 6px',
                borderRadius: 6,
                background: `${colors.error}18`,
                border: `1px solid ${colors.error}33`,
                color: colors.error
              }}>
                {daysLeft === 0 ? 'Hoy' : `${daysLeft}d`}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'grid',
          gridTemplateColumns: '150px minmax(160px, 1fr) auto',
          gap: 12,
          alignItems: 'end',
          padding: '12px 14px',
          borderRadius: 12,
          background: colors.background,
          border: `1px solid ${colors.border}`
        }}
      >
        <div>
          <FieldLabel colors={colors}>Circuit</FieldLabel>
          <select
            value={row.estat_circuit || 'Detectada'}
            onChange={(e) => handleCircuitChange(e.target.value)}
            style={inputStyle}
          >
            {LICITACIONS_ESTAT_CIRCUIT.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel colors={colors}>Comentarios Paula</FieldLabel>
          {commentView === 'card' ? (
            <PaulaCommentCard
              text={cardText}
              colors={colors}
              onChange={setCardText}
              placeholder="Editar comentario…"
            />
          ) : (
            <textarea
              value={composeText}
              onChange={(e) => setComposeText(e.target.value)}
              placeholder="Ej: Revisado, espera respuesta Sergi…"
              rows={2}
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 38,
                fontFamily: 'inherit'
              }}
            />
          )}
          {rowError ? (
            <div style={{ marginTop: 6, fontSize: 12, color: colors.error }}>{rowError}</div>
          ) : null}
        </div>

        <div style={{ display: 'flex', gap: 8, paddingBottom: 1 }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpen(row.url)}
            disabled={!row.url}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.textSecondary,
              cursor: row.url ? 'pointer' : 'not-allowed',
              opacity: row.url ? 1 : 0.55,
              fontSize: 13,
              whiteSpace: 'nowrap'
            }}
            title={row.url ? 'Abrir licitación original' : 'Sin enlace'}
          >
            <ExternalLink size={14} />
            Abrir
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSaveClick}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.primary}55`,
              background: colors.primary,
              color: 'white',
              cursor: 'pointer',
              fontSize: 13,
              whiteSpace: 'nowrap'
            }}
          >
            <Save size={14} />
            Guardar
          </motion.button>
        </div>
      </div>

      {circuitPrompt ? (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: 20
          }}
        >
          <div
            style={{
              width: 'min(440px, 100%)',
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 14,
              padding: 18,
              boxShadow: '0 16px 40px rgba(0,0,0,0.25)'
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 700, color: colors.text, marginBottom: 6 }}>
              Passar a {circuitPrompt.next}
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
              {circuitPrompt.label}
            </div>
            <textarea
              autoFocus
              value={circuitPrompt.value}
              onChange={(e) => setCircuitPrompt((p) => (p ? { ...p, value: e.target.value } : p))}
              rows={4}
              placeholder={
                circuitPrompt.field === 'motiu_descart'
                  ? 'Ex.: Fora d’abast / import massa alt / sense encaix…'
                  : 'Ex.: Bon encaix Tech, demanar plec…'
              }
              style={{
                ...inputStyle,
                resize: 'vertical',
                minHeight: 90,
                fontFamily: 'inherit',
                marginBottom: 12
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault();
                  confirmCircuitPrompt();
                }
              }}
            />
            {rowError ? (
              <div style={{ fontSize: 12, color: colors.error, marginBottom: 10 }}>{rowError}</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  setCircuitPrompt(null);
                  setRowError('');
                }}
                style={{
                  padding: '8px 12px',
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
                onClick={confirmCircuitPrompt}
                style={{
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.primary}55`,
                  background: colors.primary,
                  color: '#fff',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function LicitacionsPage() {
  const { colors } = useTheme();
  const { hideSensitiveData } = usePrivacy();
  const { user } = useAuth();
  const formatMoney = useCallback(
    (value) => applyPrivacyMoney(formatMoneyBase(value), hideSensitiveData),
    [hideSensitiveData]
  );
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(null); // { pct, label }
  const [syncElapsedSec, setSyncElapsedSec] = useState(0);
  const [leyendaOpen, setLeyendaOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [error, setError] = useState('');
  const [syncInfo, setSyncInfo] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [lastVisit] = useState(() => getLastVisit());
  const [lastSyncAt, setLastSyncAt] = useState(() => getLastSync());
  const [syncBanner, setSyncBanner] = useState(null);
  const [responsables, setResponsables] = useState([]);
  const [userRole, setUserRole] = useState('');

  const [filters, setFilters] = useState({
    source: '',
    area: '',
    estat_circuit: '',
    year: String(new Date().getFullYear()),
    q: '',
    vencenSetmana: false,
    detectadesSetmana: false,
    soloActivas: false,
    reservades: false,
    mostrarArxivades: false
  });

  const canEditConfig = ['admin', 'management'].includes(String(userRole || '').toLowerCase());

  useEffect(() => {
    if (!user?.id) return undefined;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle();
      if (!cancelled) setUserRole(data?.role || user?.user_metadata?.role || '');
    })();
    return () => { cancelled = true; };
  }, [user]);

  const refreshSyncBanner = useCallback(async () => {
    try {
      const log = await licitacionsService.loadLastSyncLog();
      setSyncBanner(describeSyncBanner(log));
      if (log?.finished_at) {
        const d = new Date(log.finished_at);
        setLastSyncAt(d);
        setLastSync(d);
      }
    } catch (_) {
      setSyncBanner(describeSyncBanner(null));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, profiles] = await Promise.all([
        // estat_circuit / KPI es filtren en client perquè les targetes superiors
        // sempre es calculin sobre el conjunt sencer (no sobre la vista filtrada).
        licitacionsService.loadLicitacions({
          source: filters.source || undefined,
          area: filters.area || undefined,
          mostrarArxivades: filters.mostrarArxivades
        }),
        licitacionsService.loadLicitacionsResponsables().catch(() => [])
      ]);
      setRows(data);
      setResponsables(profiles);
      await refreshSyncBanner();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [filters.source, filters.area, filters.mostrarArxivades, refreshSyncBanner]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => setLastVisit();
  }, []);

  useEffect(() => {
    if (!syncing) {
      setSyncElapsedSec(0);
      return undefined;
    }
    const started = Date.now();
    setSyncElapsedSec(0);
    const id = setInterval(() => {
      setSyncElapsedSec(Math.floor((Date.now() - started) / 1000));
    }, 500);
    return () => clearInterval(id);
  }, [syncing]);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setSyncProgress({ pct: 1, label: 'Iniciant sincronització…' });
    setError('');
    setSyncInfo('');
    try {
      const result = await licitacionsService.fetchAll({
        limit: 100,
        tedMaxPages: 3,
        archiveCaducadas: true,
        origen: 'manual',
        onProgress: ({ pct, label }) => {
          setSyncProgress({
            pct: Math.max(0, Math.min(100, Number(pct) || 0)),
            label: label || 'Sincronitzant…'
          });
        }
      });
      const now = new Date();
      setLastSync(now);
      setLastSyncAt(now);
      const tedLabel = result.fetched?.tedPages > 1
        ? `TED ${result.fetched?.ted ?? 0} (${result.fetched.tedPages} pág.)`
        : `TED ${result.fetched?.ted ?? 0}`;
      const parts = [
        tedLabel,
        `PSCP ${result.fetched?.pscp ?? 0}`,
        `PLACSP ${result.fetched?.placsp ?? 0}`
      ];
      if (result.fetched?.placsp_menors) {
        parts.push(`Menors ${result.fetched.placsp_menors}`);
      }
      const arxivades = result.arxivades ?? result.purge?.arxivades ?? 0;
      const archivePart = arxivades > 0 ? `, ${arxivades} arxivades` : '';
      const excl = result.exclosos || {};
      const exclTotal = (excl.cpv || 0) + (excl.keyword || 0) + (excl.import || 0);
      const exclPart = exclTotal > 0 ? `, ${exclTotal} excloses` : '';
      setSyncInfo(
        `Sincronizado: ${parts.join(' · ')} (${result.inserted ?? 0} nuevas, ${result.updated ?? 0} actualizadas${archivePart}${exclPart})`
      );
      if (result.errors) {
        setError(Object.entries(result.errors).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(' · '));
      }
      setSyncProgress({ pct: 100, label: 'Recarregant llista…' });
      await load();
    } catch (e) {
      setError(e?.message || String(e));
      await refreshSyncBanner();
    } finally {
      setSyncing(false);
      setSyncProgress(null);
    }
  }, [load, refreshSyncBanner]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onLicitacionsCronSync) return undefined;
    const handler = () => {
      syncNow();
    };
    const unsub = api.onLicitacionsCronSync(handler);
    const unsubDone = api.onLicitacionsCronSyncDone?.((result) => {
      const now = new Date();
      setLastSync(now);
      setLastSyncAt(now);
      const arxivades = result?.arxivades ?? result?.purge?.arxivades ?? 0;
      setSyncInfo(
        `Sync automática: TED ${result?.fetched?.ted ?? 0} · PSCP ${result?.fetched?.pscp ?? 0} · PLACSP ${result?.fetched?.placsp ?? 0}${arxivades ? ` · ${arxivades} arxivades` : ''}`
      );
      load();
    });
    return () => {
      if (typeof unsub === 'function') unsub();
      else api.removeAllListeners?.('licitacions-cron-sync');
      if (typeof unsubDone === 'function') unsubDone();
      else api.removeAllListeners?.('licitacions-cron-sync-done');
    };
  }, [syncNow, load]);

  const yearOptions = useMemo(() => {
    const set = new Set();
    const current = new Date().getFullYear();
    for (let y = current - 1; y <= current + 2; y += 1) set.add(y);
    for (const r of rows) {
      const y = yearFromLicitacio(r);
      if (y) set.add(y);
    }
    return [...set].sort((a, b) => b - a);
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (!filters.mostrarArxivades) {
      list = list.filter((r) => !r.arxivada);
    }
    if (filters.year) {
      const y = Number(filters.year);
      list = list.filter((r) => yearFromLicitacio(r) === y);
    }
    if (filters.estat_circuit) {
      list = list.filter((r) => r.estat_circuit === filters.estat_circuit);
    }
    if (filters.detectadesSetmana) {
      const weekStart = startOfIsoWeek();
      list = list.filter((r) => (
        r.estat_circuit === 'Detectada'
        && r.detected_at
        && r.detected_at >= weekStart
      ));
    }
    if (filters.vencenSetmana) {
      list = list.filter((r) => {
        const d = daysUntil(r.termini_oferta);
        return d != null && d >= 0 && d <= 7;
      });
    }
    if (filters.soloActivas) {
      list = list.filter((r) => r.estat_circuit !== 'Descartada' && isLicitacioVigent(r));
    }
    if (filters.reservades) {
      list = list.filter((r) => r.reservada && isLicitacioVigent(r));
    }
    const q = String(filters.q || '').trim().toLowerCase();
    if (q) {
      list = list.filter((r) => {
        const hay = `${r?.title || ''} ${r?.organismo || ''} ${r?.area || ''} ${r?.sector || ''} ${r?.external_id || ''} ${r?.notes_paula || ''}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return sortLicitacionsCircuit(list);
  }, [
    rows,
    filters.q,
    filters.year,
    filters.estat_circuit,
    filters.detectadesSetmana,
    filters.vencenSetmana,
    filters.soloActivas,
    filters.reservades,
    filters.mostrarArxivades
  ]);

  // Stats sempre sobre totes les files carregades (àmbit àrea); mai sobre filteredRows.
  const stats = useMemo(
    () => computeLicitacionsStats(rows, { area: filters.area }),
    [rows, filters.area]
  );
  const nuevasCount = useMemo(
    () => countNewSince(rows.filter((r) => !r.arxivada && isLicitacioVigent(r)), lastVisit),
    [rows, lastVisit]
  );
  const lastSyncLabel = formatLastSyncLabel(lastSyncAt);

  const isRowNew = useCallback((row) => {
    if (!lastVisit || !row?.detected_at) return false;
    return new Date(row.detected_at).getTime() > lastVisit.getTime();
  }, [lastVisit]);

  const applyKpiFilter = (patch) => {
    setFilters((f) => ({
      ...f,
      estat_circuit: patch.estat_circuit || '',
      detectadesSetmana: Boolean(patch.setmana),
      vencenSetmana: Boolean(patch.vencenSetmana),
      soloActivas: Boolean(patch.actives),
      reservades: Boolean(patch.reservades)
    }));
  };

  const clearKpiFilters = () => {
    setFilters((f) => ({
      ...f,
      estat_circuit: '',
      detectadesSetmana: false,
      vencenSetmana: false,
      soloActivas: false,
      reservades: false
    }));
  };

  const kpiFilterActive = Boolean(
    filters.estat_circuit
    || filters.detectadesSetmana
    || filters.vencenSetmana
    || filters.soloActivas
    || filters.reservades
  );

  const updateRowLocal = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (id, extraPatch = {}) => {
    setError('');
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSavingId(id);
    const patch = {
      notes_paula: extraPatch.notes_paula !== undefined ? extraPatch.notes_paula : (row.notes_paula ?? ''),
      estat_circuit: extraPatch.estat_circuit !== undefined ? extraPatch.estat_circuit : (row.estat_circuit || 'Detectada'),
      motiu_descart: extraPatch.motiu_descart !== undefined ? extraPatch.motiu_descart : (row.motiu_descart || null),
      valoracio: extraPatch.valoracio !== undefined ? extraPatch.valoracio : (row.valoracio || null),
      responsable_area_id: extraPatch.responsable_area_id !== undefined
        ? extraPatch.responsable_area_id
        : (row.responsable_area_id || null)
    };
    try {
      if (extraPatch && Object.keys(extraPatch).length) {
        updateRowLocal(id, patch);
      }
      const saved = await licitacionsService.updateLicitacio(id, patch);
      updateRowLocal(id, saved);
    } catch (e) {
      setError(e?.message || String(e));
      throw e;
    } finally {
      setSavingId(null);
    }
  };

  const selectedRow = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId]
  );

  const openUrl = async (url) => {
    if (!url) return;
    try {
      if (window.electronAPI?.openExternal) {
        await window.electronAPI.openExternal(url);
        return;
      }
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (_) {
      // ignore
    }
  };

  const bannerTone = syncBanner?.tone === 'error' ? colors.error : syncBanner?.tone === 'ok' ? colors.success : colors.warning;

  return (
    <div style={{ padding: 28, maxWidth: 1500, margin: '0 auto' }}>
      <SectionHeader
        icon={FileText}
        title={(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            Licitaciones
            {nuevasCount > 0 ? (
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: `${colors.primary}18`,
                color: colors.primary
              }}>
                {nuevasCount} nueva{nuevasCount === 1 ? '' : 's'}
              </span>
            ) : null}
          </span>
        )}
        subtitle={(
          <span>
            Circuit Detectada → Activada · TED · PSCP · PLACSP
            {lastSyncLabel ? ` · Última sync: ${lastSyncLabel}` : ''}
          </span>
        )}
        actions={(
          <>
            <KronosButton variant="ghost" onClick={() => setReportOpen(true)} title="Report setmanal per a Sergi">
              <Clipboard size={15} />
              Report setmanal
            </KronosButton>
            {canEditConfig ? (
              <KronosButton variant="ghost" onClick={() => setConfigOpen(true)} title="Configuració de filtres">
                <Settings size={15} />
                Filtres
              </KronosButton>
            ) : null}
            <KronosButton variant="ghost" onClick={() => setLeyendaOpen(true)} title="Leyenda de estados">
              <HelpCircle size={15} />
              Leyenda
            </KronosButton>
            <KronosButton onClick={syncNow} disabled={syncing}>
              <RefreshCw
                size={15}
                style={syncing ? { animation: 'licitacions-spin 0.9s linear infinite' } : undefined}
              />
              {syncing
                ? `Sincronizando${syncProgress?.pct != null ? ` ${Math.round(syncProgress.pct)}%` : '…'}`
                : 'Sincronizar'}
            </KronosButton>
            <KronosButton variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Recargar
            </KronosButton>
          </>
        )}
      />

      <style>{`
        @keyframes licitacions-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes licitacions-bar-pulse {
          0% { background-position: 0% 0; }
          100% { background-position: 200% 0; }
        }
      `}</style>

      {syncing && syncProgress ? (
        <div style={{
          marginBottom: 14,
          padding: '14px 16px',
          borderRadius: 12,
          background: `${colors.primary}10`,
          border: `1px solid ${colors.primary}33`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 10,
            flexWrap: 'wrap'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
              <RefreshCw
                size={16}
                color={colors.primary}
                style={{ animation: 'licitacions-spin 0.9s linear infinite', flexShrink: 0 }}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>
                  Sincronitzant licitacions…
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>
                  {syncProgress.label}
                </div>
              </div>
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 700,
              color: colors.primary,
              whiteSpace: 'nowrap'
            }}>
              {Math.round(syncProgress.pct)}%
              <span style={{ fontWeight: 500, color: colors.textSecondary }}>
                {` · ${syncElapsedSec}s`}
              </span>
            </div>
          </div>
          <div style={{
            height: 8,
            borderRadius: 999,
            background: colors.background,
            overflow: 'hidden',
            border: `1px solid ${colors.border}`
          }}>
            <div
              style={{
                height: '100%',
                width: `${Math.max(4, syncProgress.pct)}%`,
                borderRadius: 999,
                transition: 'width 0.35s ease',
                background: `linear-gradient(90deg, ${colors.primary}, ${colors.primary}88, ${colors.primary})`,
                backgroundSize: '200% 100%',
                animation: 'licitacions-bar-pulse 1.4s linear infinite'
              }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 11, color: colors.textSecondary }}>
            PLACSP pot trigar ~1 min a la primera pàgina (feed gran). No cal tornar a clicar.
          </div>
        </div>
      ) : null}

      {syncBanner && !syncing ? (
        <div style={{
          marginBottom: 14,
          fontSize: 13,
          color: bannerTone,
          padding: '10px 14px',
          borderRadius: 12,
          background: `${bannerTone}12`,
          border: `1px solid ${bannerTone}33`,
          fontWeight: syncBanner.tone === 'error' ? 700 : 500
        }}>
          {syncBanner.text}
        </div>
      ) : null}

      <LicitacionsStats
        stats={stats}
        onFilter={applyKpiFilter}
        areaFilter={filters.area}
        onAreaFilter={(area) => setFilters((f) => ({ ...f, area }))}
      />

      <label style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        fontSize: 13,
        color: colors.textSecondary,
        cursor: 'pointer'
      }}>
        <input
          type="checkbox"
          checked={filters.mostrarArxivades}
          onChange={(e) => setFilters((f) => ({ ...f, mostrarArxivades: e.target.checked }))}
        />
        Mostrar arxivades
      </label>

      {kpiFilterActive ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: colors.textSecondary }}>
          Filtro KPI activo
          {' · '}
          <button
            type="button"
            onClick={clearKpiFilters}
            style={{
              border: 'none',
              background: 'none',
              color: colors.primary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              fontSize: 13,
              padding: 0,
              textDecoration: 'underline'
            }}
          >
            Quitar filtro
          </button>
        </div>
      ) : null}

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1.4fr 0.8fr 0.8fr 0.9fr 1fr',
        gap: 12,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '10px 12px' }}>
          <Search size={16} color={colors.textSecondary} />
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por título, organismo, área, ID o comentario…"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: colors.text,
              fontSize: 14
            }}
          />
        </div>

        <select
          value={filters.year}
          onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
          style={{
            width: '100%',
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 14
          }}
        >
          <option value="">Año: todos</option>
          {yearOptions.map((y) => (
            <option key={y} value={String(y)}>{`Año: ${y}`}</option>
          ))}
        </select>

        <select
          value={filters.source}
          onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
          style={{
            width: '100%',
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 14
          }}
        >
          {SOURCES.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? `Origen: ${s}` : 'Origen: todos'}
            </option>
          ))}
        </select>

        <select
          value={filters.area}
          onChange={(e) => setFilters((f) => ({ ...f, area: e.target.value }))}
          style={{
            width: '100%',
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 14
          }}
        >
          <option value="">Àrea: totes</option>
          {LICITACIONS_AREAS.map((a) => (
            <option key={a} value={a}>{`Àrea: ${a === 'Catering' ? 'Càtering' : a}`}</option>
          ))}
        </select>

        <select
          value={filters.estat_circuit}
          onChange={(e) => setFilters((f) => ({ ...f, estat_circuit: e.target.value }))}
          style={{
            width: '100%',
            background: colors.surface,
            color: colors.text,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: '10px 12px',
            fontSize: 14
          }}
        >
          <option value="">Circuit: tots</option>
          {LICITACIONS_ESTAT_CIRCUIT.map((s) => (
            <option key={s} value={s}>{`Circuit: ${s}`}</option>
          ))}
        </select>
      </div>

      {syncInfo && !error ? (
        <div style={{
          marginBottom: 12,
          fontSize: 13,
          color: colors.success,
          padding: '10px 14px',
          borderRadius: 12,
          background: `${colors.success}12`,
          border: `1px solid ${colors.success}33`
        }}>
          {syncInfo}
        </div>
      ) : null}

      {error ? (
        <div style={{
          background: colors.error + '12',
          border: `1px solid ${colors.error}33`,
          color: colors.error,
          padding: '12px 14px',
          borderRadius: 12,
          marginBottom: 16
        }}>
          {error}
        </div>
      ) : null}

      <div style={{
        border: `1px solid ${colors.border}`,
        borderRadius: 14,
        overflow: 'auto',
        background: colors.surface
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1.3fr) 82px 90px 120px 100px 100px 110px',
          gap: 14,
          padding: '12px 18px',
          background: colors.background,
          borderBottom: `1px solid ${colors.border}`,
          color: colors.textSecondary,
          fontSize: 11,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.04em',
          position: 'sticky',
          top: 0,
          zIndex: 2,
          minWidth: 1080
        }}>
          <div>Licitación</div>
          <div>Organismo</div>
          <div>Origen</div>
          <div>Àrea</div>
          <div>Circuit</div>
          <div>Expedient</div>
          <div>Importe</div>
          <div>Fin oferta</div>
        </div>

        {loading ? (
          <div style={{ padding: 18, color: colors.textSecondary }}>Cargando…</div>
        ) : filteredRows.length === 0 ? (
          <div style={{ padding: 18, color: colors.textSecondary }}>No hay licitaciones con estos filtros.</div>
        ) : (
          filteredRows.map((r) => (
            <LicitacioRow
              key={r.id}
              row={r}
              colors={colors}
              formatMoney={formatMoney}
              onUpdate={updateRowLocal}
              onSave={saveRow}
              onOpen={openUrl}
              onSelect={(row) => setSelectedId(row.id)}
              isNew={isRowNew(r)}
            />
          ))
        )}
      </div>

      <LicitacioDetailModal
        isOpen={Boolean(selectedRow)}
        row={selectedRow}
        onClose={() => setSelectedId(null)}
        onUpdate={updateRowLocal}
        onSave={saveRow}
        onOpenUrl={openUrl}
        saving={savingId === selectedId}
        responsables={responsables}
      />

      <LicitacionsLeyendaModal
        open={leyendaOpen}
        onClose={() => setLeyendaOpen(false)}
      />

      <LicitacionsConfigModal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
      />

      <LicitacionsReportModal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
      />
    </div>
  );
}
