import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FileText, RefreshCw, ExternalLink, Save, Search, HelpCircle } from 'feather-icons-react';
import { motion } from 'framer-motion';
import { useTheme } from './ThemeContext';
import SectionHeader from './SectionHeader';
import LicitacioDetailModal from './LicitacioDetailModal';
import LicitacionsStats from './licitacions/LicitacionsStats';
import LicitacionsLeyendaModal from './licitacions/LicitacionsLeyendaModal';
import licitacionsService from '../services/licitacionsService';
import { getEstatContractacioMeta } from '../constants/licitacionsEstat';
import { KronosButton } from './kronos';
import {
  computeLicitacionsStats,
  countNewSince,
  daysUntil,
  formatLastSyncLabel,
  getLastSync,
  getLastVisit,
  isLicitacioVigent,
  setLastSync,
  setLastVisit
} from './licitacions/licitacionsHelpers';

const ESTATS = ['Pendent', 'Interessant', 'Descartada', 'Contactat'];
const SOURCES = ['', 'TED', 'PSCP', 'PLACSP'];

const SOURCE_COLORS = {
  TED: '#3B82F6',
  PSCP: '#F59E0B',
  PLACSP: '#8B5CF6'
};

function formatMoney(value) {
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

function LicitacioRow({ row, colors, onUpdate, onSave, onOpen, onSelect, isNew }) {
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

  return (
    <div style={{
      borderBottom: `1px solid ${colors.border}`,
      padding: '16px 18px',
      minWidth: 1020
    }}>
      {/* Fila 1: datos de la licitación (click → modal detalle) */}
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
          gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1.3fr) 82px 96px 130px 100px 110px',
          gap: 16,
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
          <div style={{ color: colors.text, fontWeight: 700, fontSize: 14, lineHeight: 1.35, marginBottom: 4, display: 'flex', alignItems: 'flex-start', gap: 8 }}>
            <span style={{ flex: 1 }}>{row.title}</span>
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
          {row.sector || 'Altres'}
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

      {/* Fila 2: seguimiento comercial */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'grid',
          gridTemplateColumns: '140px 150px minmax(140px, 1fr) minmax(180px, 1.6fr) auto',
          gap: 12,
          alignItems: 'end',
          padding: '12px 14px',
          borderRadius: 12,
          background: colors.background,
          border: `1px solid ${colors.border}`
        }}
      >
        <div>
          <FieldLabel colors={colors}>Estado JC</FieldLabel>
          <select
            value={row.estat_jc || 'Pendent'}
            onChange={(e) => onUpdate(row.id, { estat_jc: e.target.value })}
            style={inputStyle}
          >
            {ESTATS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <div>
          <FieldLabel colors={colors}>Fecha contacto</FieldLabel>
          <input
            type="date"
            value={formatDateInput(row.data_contacte)}
            onChange={(e) => onUpdate(row.id, { data_contacte: e.target.value || null })}
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel colors={colors}>Resultado</FieldLabel>
          <input
            value={row.resultat_jc || ''}
            onChange={(e) => onUpdate(row.id, { resultat_jc: e.target.value })}
            placeholder="Resultado del contacto…"
            style={inputStyle}
          />
        </div>

        <div>
          <FieldLabel colors={colors}>Notas Paula</FieldLabel>
          <textarea
            value={row.notes_paula || ''}
            onChange={(e) => onUpdate(row.id, { notes_paula: e.target.value })}
            placeholder="Notas internas…"
            rows={2}
            style={{
              ...inputStyle,
              resize: 'vertical',
              minHeight: 38,
              fontFamily: 'inherit'
            }}
          />
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
            onClick={() => onSave(row.id)}
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
    </div>
  );
}

export default function LicitacionsPage() {
  const { colors } = useTheme();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [leyendaOpen, setLeyendaOpen] = useState(false);
  const [error, setError] = useState('');
  const [syncInfo, setSyncInfo] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [savingId, setSavingId] = useState(null);
  const [lastVisit] = useState(() => getLastVisit());
  const [lastSyncAt, setLastSyncAt] = useState(() => getLastSync());

  const [filters, setFilters] = useState({
    source: '',
    sector: '',
    estat_jc: '',
    q: '',
    vencenSetmana: false,
    soloActivas: false,
    incluirCaducadas: false
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await licitacionsService.loadLicitacions({
        source: filters.source || undefined,
        sector: filters.sector || undefined,
        estat_jc: filters.estat_jc || undefined
      });
      setRows(data);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [filters.source, filters.sector, filters.estat_jc]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    return () => setLastVisit();
  }, []);

  const syncNow = useCallback(async () => {
    setSyncing(true);
    setError('');
    setSyncInfo('');
    try {
      const result = await licitacionsService.fetchAll({ limit: 100, tedMaxPages: 3, purgeCaducadas: true });
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
      const purged = result.purge?.deleted ?? 0;
      const purgePart = purged > 0 ? `, ${purged} caducadas eliminadas` : '';
      setSyncInfo(`Sincronizado: ${parts.join(' · ')} (${result.inserted ?? 0} nuevas, ${result.updated ?? 0} actualizadas${purgePart})`);
      if (result.errors) {
        setError(Object.entries(result.errors).map(([k, v]) => `${k.toUpperCase()}: ${v}`).join(' · '));
      }
      await load();
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setSyncing(false);
    }
  }, [load]);

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
      const purged = result?.purge?.deleted ?? 0;
      setSyncInfo(
        `Sync automática (lunes): TED ${result?.fetched?.ted ?? 0} · PSCP ${result?.fetched?.pscp ?? 0} · PLACSP ${result?.fetched?.placsp ?? 0}${purged ? ` · ${purged} caducadas eliminadas` : ''}`
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

  const sectors = useMemo(() => {
    const set = new Set();
    for (const r of rows) {
      if (r?.sector) set.add(r.sector);
    }
    return [''].concat([...set].sort((a, b) => String(a).localeCompare(String(b), 'es')));
  }, [rows]);

  const filteredRows = useMemo(() => {
    let list = rows;
    if (!filters.incluirCaducadas) {
      list = list.filter(isLicitacioVigent);
    }
    if (filters.vencenSetmana) {
      list = list.filter((r) => {
        const d = daysUntil(r.termini_oferta);
        return d != null && d >= 0 && d <= 7;
      });
    }
    if (filters.soloActivas) {
      list = list.filter((r) => r.estat_jc !== 'Descartada');
    }
    const q = String(filters.q || '').trim().toLowerCase();
    if (!q) return list;
    return list.filter((r) => {
      const hay = `${r?.title || ''} ${r?.organismo || ''} ${r?.sector || ''} ${r?.external_id || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [rows, filters.q, filters.vencenSetmana, filters.soloActivas, filters.incluirCaducadas]);

  const stats = useMemo(() => computeLicitacionsStats(rows), [rows]);
  const nuevasCount = useMemo(
    () => countNewSince(rows.filter(isLicitacioVigent), lastVisit),
    [rows, lastVisit]
  );
  const lastSyncLabel = formatLastSyncLabel(lastSyncAt);

  const isRowNew = useCallback((row) => {
    if (!lastVisit || !row?.detected_at) return false;
    return new Date(row.detected_at).getTime() > lastVisit.getTime();
  }, [lastVisit]);

  const applyKpiFilter = (patch) => {
    if (patch.estat_jc) {
      setFilters((f) => ({
        ...f,
        estat_jc: patch.estat_jc,
        vencenSetmana: false,
        soloActivas: false
      }));
      return;
    }
    if (patch.vencenSetmana) {
      setFilters((f) => ({
        ...f,
        estat_jc: '',
        vencenSetmana: true,
        soloActivas: false
      }));
      return;
    }
    if (patch.actives) {
      setFilters((f) => ({
        ...f,
        estat_jc: '',
        vencenSetmana: false,
        soloActivas: true
      }));
    }
  };

  const updateRowLocal = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const saveRow = async (id) => {
    setError('');
    const row = rows.find((r) => r.id === id);
    if (!row) return;
    setSavingId(id);
    try {
      const saved = await licitacionsService.updateLicitacio(id, {
        notes_paula: row.notes_paula ?? '',
        estat_jc: row.estat_jc,
        data_contacte: row.data_contacte || null,
        resultat_jc: row.resultat_jc ?? ''
      });
      updateRowLocal(id, saved);
    } catch (e) {
      setError(e?.message || String(e));
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
            TED · PSCP · PLACSP · Anuncios previos y licitaciones en plazo
            {lastSyncLabel ? ` · Última sync: ${lastSyncLabel}` : ' · Aún no has sincronizado'}
          </span>
        )}
        actions={(
          <>
            <KronosButton variant="ghost" onClick={() => setLeyendaOpen(true)} title="Leyenda de estados">
              <HelpCircle size={15} />
              Leyenda
            </KronosButton>
            <KronosButton onClick={syncNow} disabled={syncing}>
              <RefreshCw size={15} />
              {syncing ? 'Sincronizando…' : 'Sincronizar'}
            </KronosButton>
            <KronosButton variant="ghost" onClick={load} disabled={loading}>
              <RefreshCw size={15} />
              Recargar
            </KronosButton>
          </>
        )}
      />

      <LicitacionsStats stats={stats} onFilter={applyKpiFilter} />

      {!filters.incluirCaducadas && stats.ocultes > 0 ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: colors.textSecondary }}>
          Mostrando {stats.vigents} oportunidades vigentes
          {' '}
          ({stats.previos} anuncio{stats.previos === 1 ? '' : 's'} previo{stats.previos === 1 ? '' : 's'}
          {stats.vigents - stats.previos > 0 ? ` + ${stats.vigents - stats.previos} en plazo` : ''}).
          {' '}
          {stats.ocultes} caducada{stats.ocultes === 1 ? '' : 's'} u otras ocultas.
        </div>
      ) : null}

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
          checked={filters.incluirCaducadas}
          onChange={(e) => setFilters((f) => ({ ...f, incluirCaducadas: e.target.checked }))}
        />
        Incluir caducadas y cerradas
      </label>

      {(filters.vencenSetmana || filters.soloActivas) ? (
        <div style={{ marginBottom: 12, fontSize: 13, color: colors.textSecondary }}>
          Filtro KPI activo
          {' · '}
          <button
            type="button"
            onClick={() => setFilters((f) => ({ ...f, vencenSetmana: false, soloActivas: false }))}
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
        gridTemplateColumns: '1.2fr 1fr 1fr 1.2fr',
        gap: 12,
        marginBottom: 16
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: '10px 12px' }}>
          <Search size={16} color={colors.textSecondary} />
          <input
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
            placeholder="Buscar por título, organismo, sector o ID…"
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
          value={filters.sector}
          onChange={(e) => setFilters((f) => ({ ...f, sector: e.target.value }))}
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
          {sectors.map((s) => (
            <option key={s || 'all'} value={s}>
              {s ? `Sector: ${s}` : 'Sector: todos'}
            </option>
          ))}
        </select>

        <select
          value={filters.estat_jc}
          onChange={(e) => setFilters((f) => ({ ...f, estat_jc: e.target.value }))}
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
          <option value="">Estado: todos</option>
          {ESTATS.map((s) => (
            <option key={s} value={s}>{`Estado: ${s}`}</option>
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
        {/* Cabecera alineada con la fila de datos */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(220px, 2fr) minmax(140px, 1.3fr) 82px 96px 130px 100px 110px',
          gap: 16,
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
          minWidth: 1020
        }}>
          <div>Licitación</div>
          <div>Organismo</div>
          <div>Origen</div>
          <div>Sector</div>
          <div>Estado expediente</div>
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
      />

      <LicitacionsLeyendaModal
        open={leyendaOpen}
        onClose={() => setLeyendaOpen(false)}
      />
    </div>
  );
}
