import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  User,
  Clock,
  Calendar as CalendarIcon,
  ArrowLeft,
  Coffee,
  CheckCircle,
  AlertCircle,
  X,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
  isFuture,
} from 'date-fns';
import { es } from 'date-fns/locale';
import * as fichajePortalService from '../services/fichajePortalService';
import { formatTimeMadrid, formatDateShortMadrid } from '../utils/timeUtils';
import { colors } from '../theme';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function FichajeEmpleadoPerfilView({ empleado, onBack }) {
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [fichajes, setFichajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFichaje, setSelectedFichaje] = useState(null);

  const empleadoId = empleado?.id;

  useEffect(() => {
    if (!empleadoId) return;
    const load = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(calendarMonth);
        const end = endOfMonth(calendarMonth);
        const res = await fichajePortalService.obtenerFichajesEmpleado(
          empleadoId,
          start,
          end
        );
        setFichajes(res.success ? res.data || [] : []);
      } catch (err) {
        setFichajes([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [empleadoId, calendarMonth]);

  const fichajesPorFecha = useMemo(() => {
    const map = {};
    (fichajes || []).forEach((f) => {
      const key = f.fecha;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [fichajes]);

  const resumenMes = useMemo(() => {
    const completos = fichajes.filter((f) => f.hora_salida);
    const horasTotales = completos.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0);
    const trabajandoAhora = fichajes.some((f) => !f.hora_salida);
    return {
      diasTrabajados: completos.length,
      horasTotales: horasTotales.toFixed(2),
      trabajandoAhora,
    };
  }, [fichajes]);

  const days = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const daysInMonth = eachDayOfInterval({ start, end });
    const startWeekday = (start.getDay() + 6) % 7;
    const paddingStart = Array.from({ length: startWeekday }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() - (startWeekday - i));
      return d;
    });
    const allDays = [...paddingStart, ...daysInMonth];
    const rest = allDays.length % 7 === 0 ? 0 : 7 - (allDays.length % 7);
    if (rest > 0) {
      const lastDay = allDays[allDays.length - 1];
      for (let i = 1; i <= rest; i++) {
        const d = new Date(lastDay);
        d.setDate(d.getDate() + i);
        allDays.push(d);
      }
    }
    return allDays;
  }, [calendarMonth]);

  const nombreEmpleado = empleado?.nombreCompleto || empleado?.name || 'Empleado';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      style={{ padding: '0 4px' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 16px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            color: colors.text,
            fontSize: 14,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          <ArrowLeft size={18} />
          Volver al listado
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: '50%',
              backgroundColor: colors.primary + '22',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <User size={24} color={colors.primary} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: colors.text }}>
              {nombreEmpleado}
            </h2>
          </div>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ backgroundColor: colors.primary + '20', padding: 10, borderRadius: 8 }}>
            <Clock size={22} color={colors.primary} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>
              Horas este mes
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {resumenMes.horasTotales}h
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            padding: 16,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div style={{ backgroundColor: colors.success + '20', padding: 10, borderRadius: 8 }}>
            <CalendarIcon size={22} color={colors.success} />
          </div>
          <div>
            <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>
              Días trabajados
            </div>
            <div style={{ fontSize: 20, fontWeight: 700, color: colors.text }}>
              {resumenMes.diasTrabajados}
            </div>
          </div>
        </div>
        {resumenMes.trabajandoAhora && (
          <div
            style={{
              backgroundColor: colors.warning + '15',
              border: `1px solid ${colors.warning}`,
              borderRadius: 12,
              padding: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div style={{ backgroundColor: colors.warning + '30', padding: 10, borderRadius: 8 }}>
              <Coffee size={22} color={colors.warning} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 500 }}>
                Estado
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: colors.warning }}>
                Trabajando ahora
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calendario */}
      <div
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
          }}
        >
          <button
            type="button"
            onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
            style={{
              padding: '8px 12px',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronLeft size={20} />
          </button>
          <span
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: colors.text,
              textTransform: 'capitalize',
            }}
          >
            {format(calendarMonth, 'MMMM yyyy', { locale: es })}
          </span>
          <button
            type="button"
            onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
            style={{
              padding: '8px 12px',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              color: colors.text,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <ChevronRight size={20} />
          </button>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: colors.textSecondary }}>
            Cargando calendario...
          </div>
        ) : (
          <div className="portal-calendario-wrapper">
            <div className="portal-calendario-inner">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 4,
                  marginBottom: 8,
                }}
              >
                {WEEKDAYS.map((day) => (
                  <div
                    key={day}
                    style={{
                      textAlign: 'center',
                      fontSize: 12,
                      fontWeight: 600,
                      color: colors.textSecondary,
                    }}
                  >
                    {day}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 4,
                }}
              >
              {days.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayFichajes = fichajesPorFecha[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, calendarMonth);
                const isTodayDate = isToday(day);
                const isFutureDate = isFuture(day) && !isTodayDate;

                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: 72,
                      padding: 6,
                      borderRadius: 8,
                      backgroundColor: !isCurrentMonth
                        ? colors.surface
                        : isTodayDate
                        ? colors.primary + '15'
                        : 'transparent',
                      border: isTodayDate
                        ? `2px solid ${colors.primary}`
                        : `1px solid ${colors.border}`,
                      opacity: !isCurrentMonth ? 0.5 : 1,
                    }}
                  >
                    <div
                      style={{
                        fontSize: 13,
                        fontWeight: isTodayDate ? 700 : 500,
                        color: isTodayDate ? colors.primary : colors.text,
                        marginBottom: 4,
                      }}
                    >
                      {format(day, 'd')}
                    </div>
                    {dayFichajes.length > 0 && !isFutureDate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {dayFichajes.slice(0, 2).map((f) => (
                          <div
                            key={f.id}
                            role="button"
                            tabIndex={0}
                            onClick={() => setSelectedFichaje(f)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                setSelectedFichaje(f);
                              }
                            }}
                            style={{
                              textAlign: 'left',
                              fontSize: 10,
                              padding: '4px 6px',
                              borderRadius: 4,
                              backgroundColor: f.hora_salida
                                ? colors.success + '25'
                                : colors.warning + '25',
                              color: colors.text,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                            title={`${formatTimeMadrid(f.hora_entrada)} - ${f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'}`}
                          >
                            {formatTimeMadrid(f.hora_entrada)}–
                            {f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'}
                            {f.horas_trabajadas != null &&
                              ` (${Number(f.horas_trabajadas).toFixed(1)}h)`}
                          </div>
                        ))}
                        {dayFichajes.length > 2 && (
                          <span style={{ fontSize: 10, color: colors.textSecondary }}>
                            +{dayFichajes.length - 2} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista registros */}
      <div
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: colors.text }}>
          Registros del mes
        </h3>
        {fichajes.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0 }}>
            No hay fichajes en este mes.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {fichajes.map((f) => (
              <div
                key={f.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedFichaje(f)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedFichaje(f);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {f.hora_salida ? (
                    <CheckCircle size={18} color={colors.success} />
                  ) : (
                    <AlertCircle size={18} color={colors.warning} />
                  )}
                  <span style={{ fontWeight: 500, color: colors.text }}>
                    {formatDateShortMadrid(f.fecha)}
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {formatTimeMadrid(f.hora_entrada)} –{' '}
                    {f.hora_salida ? formatTimeMadrid(f.hora_salida) : 'En curso'}
                  </span>
                </div>
                <span style={{ fontWeight: 600, color: colors.text }}>
                  {f.horas_trabajadas != null
                    ? `${Number(f.horas_trabajadas).toFixed(2)}h`
                    : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal detalle (solo lectura) */}
      {selectedFichaje && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setSelectedFichaje(null)}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              backgroundColor: colors.card,
              borderRadius: 12,
              padding: 24,
              maxWidth: 400,
              width: '100%',
              border: `1px solid ${colors.border}`,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text }}>
                Detalle del fichaje
              </h3>
              <button
                type="button"
                onClick={() => setSelectedFichaje(null)}
                style={{
                  padding: 8,
                  border: 'none',
                  background: 'transparent',
                  color: colors.textSecondary,
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                  Fecha
                </div>
                <div style={{ fontWeight: 600, color: colors.text }}>
                  {formatDateShortMadrid(selectedFichaje.fecha)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                  Entrada
                </div>
                <div style={{ fontWeight: 600, color: colors.text }}>
                  {formatTimeMadrid(selectedFichaje.hora_entrada)}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                  Salida
                </div>
                <div style={{ fontWeight: 600, color: colors.text }}>
                  {selectedFichaje.hora_salida
                    ? formatTimeMadrid(selectedFichaje.hora_salida)
                    : 'En curso'}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>
                  Horas trabajadas
                </div>
                <div style={{ fontWeight: 700, color: colors.primary, fontSize: 18 }}>
                  {selectedFichaje.horas_trabajadas != null
                    ? `${Number(selectedFichaje.horas_trabajadas).toFixed(2)}h`
                    : '-'}
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
