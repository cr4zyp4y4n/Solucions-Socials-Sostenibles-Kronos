import React from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Calendar,
  ChevronRight,
  Clock,
  Coffee,
  Umbrella,
  User
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { formatDateShortMadrid, formatTimeMadrid } from '../../utils/timeUtils';
import { empleadoEstadoFlow, estadoPanelColor } from './panelFichajesHelpers';

export default function PanelEmpleadoCard({ empleado, resumen, index = 0, onOpen }) {
  const { colors } = useTheme();
  const nombre = empleado.nombreCompleto || empleado.name || 'Empleado';
  const flow = empleadoEstadoFlow(resumen);
  const tone = estadoPanelColor(flow.key, colors);

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: Math.min(index * 0.02, 0.12) }}
      style={{ listStyle: 'none', height: '100%', display: 'flex' }}
    >
      <button
        type="button"
        onClick={() => onOpen(empleado)}
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          textAlign: 'left',
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          padding: '15px 16px',
          cursor: 'pointer',
          fontFamily: 'inherit',
          color: colors.text,
          transition: 'border-color 0.15s, box-shadow 0.15s',
          boxSizing: 'border-box'
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = `${colors.primary}55`;
          e.currentTarget.style.boxShadow = `0 4px 16px ${colors.primary}10`;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = colors.border;
          e.currentTarget.style.boxShadow = 'none';
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, minHeight: 68 }}>
          <div style={{ display: 'flex', gap: 11, minWidth: 0, flex: 1 }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 10,
                background: `${colors.primary}14`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}
            >
              <User size={20} color={colors.primary} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: 14,
                  lineHeight: 1.35,
                  minHeight: 38,
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  wordBreak: 'break-word'
                }}
                title={nombre}
              >
                {nombre}
              </div>
              <div style={{ marginTop: 5, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6 }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    padding: '3px 8px',
                    borderRadius: 6,
                    background: `${tone}14`,
                    color: tone
                  }}
                >
                  {flow.label}
                </span>
              </div>
              <div
                style={{
                  marginTop: 5,
                  fontSize: 12,
                  color: colors.textSecondary,
                  minHeight: 16,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {empleado.email || '\u00a0'}
              </div>
            </div>
          </div>
          <ChevronRight size={17} color={colors.textSecondary} style={{ flexShrink: 0, marginTop: 2 }} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 7,
            marginTop: 12
          }}
        >
          {[
            { label: 'Horas mes', value: `${resumen.horasTotales || '0'}h`, icon: Clock },
            { label: 'Días', value: resumen.diasTrabajados ?? 0, icon: Calendar },
            { label: 'Vac. rest.', value: resumen.diasVacacionesRestantes ?? '—', icon: Umbrella }
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                padding: '8px 6px',
                borderRadius: 8,
                background: colors.background,
                border: `1px solid ${colors.border}`,
                textAlign: 'center'
              }}
            >
              <div style={{ fontSize: 11, color: colors.textSecondary }}>{stat.label}</div>
              <div style={{ marginTop: 3, fontSize: 15, fontWeight: 700 }}>{stat.value}</div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 'auto', paddingTop: 11, minHeight: 20, fontSize: 12, color: colors.textSecondary }}>
          {resumen.trabajandoAhora ? (
            <span style={{ color: colors.warning, display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600 }}>
              <Coffee size={13} />
              Fichaje en curso
            </span>
          ) : resumen.estaDeBaja && resumen.bajaHasta ? (
            <span style={{ color: colors.error, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <AlertCircle size={13} />
              Baja hasta {formatDateShortMadrid(resumen.bajaHasta)}
            </span>
          ) : !resumen.estaDeBaja && resumen.estaEnVacaciones && resumen.vacacionesHasta ? (
            <span style={{ color: colors.info, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Umbrella size={13} />
              Vacaciones hasta {formatDateShortMadrid(resumen.vacacionesHasta)}
            </span>
          ) : !resumen.trabajandoAhora && resumen.ultimoFichaje ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Calendar size={13} />
              Último: {formatDateShortMadrid(resumen.ultimoFichaje.fecha)}
              {resumen.ultimoFichaje.hora_salida ? ` · ${formatTimeMadrid(resumen.ultimoFichaje.hora_salida)}` : ''}
            </span>
          ) : (
            <span style={{ color: 'transparent', userSelect: 'none' }} aria-hidden>—</span>
          )}
        </div>
      </button>
    </motion.li>
  );
}
