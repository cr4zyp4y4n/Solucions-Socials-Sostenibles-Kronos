import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Inbox, Search } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { filterEnvios } from './firmaPageHelpers';
import { FirmaChip, FirmaInput } from './FirmaUi';
import FirmaEnvioCard from './FirmaEnvioCard';

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'activo', label: 'En curso' },
  { id: 'firmado', label: 'Firmados' },
  { id: 'cancelado', label: 'Cancelados' }
];

const PACK_FILTERS = [
  { id: 'todos', label: 'Todos los packs' },
  { id: 'contratacion', label: 'Contratación' },
  { id: 'baja', label: 'Bajas' }
];

export default function FirmaEnviosPanel({
  envios,
  loading,
  onTimeline,
  onCopyLink,
  onCopyMessage,
  onOpenLink,
  onWhatsApp,
  onEmail,
  onNotificarBaja,
  onAuditoria,
  onVerFirmados,
  onCancelar
}) {
  const { colors } = useTheme();
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [packFilter, setPackFilter] = useState('todos');

  const filtered = useMemo(
    () => filterEnvios(envios, { search, estadoFilter, packFilter }),
    [envios, search, estadoFilter, packFilter]
  );

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 12
        }}
      >
        <div style={{ position: 'relative' }}>
          <Search
            size={16}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              color: colors.textSecondary,
              pointerEvents: 'none'
            }}
          />
          <FirmaInput
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre, DNI o teléfono…"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => (
            <FirmaChip
              key={f.id}
              active={estadoFilter === f.id}
              onClick={() => setEstadoFilter(f.id)}
            >
              {f.label}
            </FirmaChip>
          ))}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {PACK_FILTERS.map((f) => (
            <FirmaChip
              key={f.id}
              active={packFilter === f.id}
              onClick={() => setPackFilter(f.id)}
            >
              {f.label}
            </FirmaChip>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary }}>
          <motion.div
            animate={{ opacity: [0.4, 1, 0.4] }}
            transition={{ repeat: Infinity, duration: 1.2 }}
          >
            Cargando envíos…
          </motion.div>
        </div>
      ) : filtered.length ? (
        <ul style={{ margin: 0, padding: 0, display: 'grid', gap: 12, overflow: 'visible' }}>
          <AnimatePresence mode="popLayout">
            {filtered.map((envio, index) => (
              <FirmaEnvioCard
                key={envio.id}
                envio={envio}
                index={index}
                onTimeline={onTimeline}
                onCopyLink={onCopyLink}
                onCopyMessage={onCopyMessage}
                onOpenLink={onOpenLink}
                onWhatsApp={onWhatsApp}
                onEmail={onEmail}
                onNotificarBaja={onNotificarBaja}
                onAuditoria={onAuditoria}
                onVerFirmados={onVerFirmados}
                onCancelar={onCancelar}
              />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            padding: 40,
            textAlign: 'center',
            borderRadius: 16,
            border: `1px dashed ${colors.border}`,
            background: colors.background
          }}
        >
          <Inbox size={32} color={colors.textSecondary} style={{ marginBottom: 12 }} />
          <div style={{ fontWeight: 800, fontSize: 15 }}>No hay envíos</div>
          <div style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary }}>
            {search || estadoFilter !== 'todos'
              ? 'Prueba otro filtro o búsqueda.'
              : 'Crea un pack en la pestaña «Nuevo pack».'}
          </div>
        </motion.div>
      )}
    </div>
  );
}
