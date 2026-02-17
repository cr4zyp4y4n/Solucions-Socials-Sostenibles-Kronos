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
  Umbrella
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addDays,
  differenceInCalendarDays,
  format,
  parseISO,
  isSameMonth,
  isToday,
  isFuture
} from 'date-fns';
import { es } from 'date-fns/locale';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import { formatTimeMadrid, formatDateShortMadrid } from '../utils/timeUtils';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import FichajeDetailsModal from './FichajeDetailsModal';
import FichajeEditModal from './FichajeEditModal';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const FichajeEmpleadoPerfil = ({ empleado, onBack }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [fichajes, setFichajes] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [togglingVacacion, setTogglingVacacion] = useState(false);
  const [selectedFichaje, setSelectedFichaje] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [userCanEditVacaciones, setUserCanEditVacaciones] = useState(false);
  const [modoPeriodoVacaciones, setModoPeriodoVacaciones] = useState(false);
  const [periodoPrimerDia, setPeriodoPrimerDia] = useState(null);

  const empleadoId = empleado?.id;

  // Rol del usuario: admin, manager, management pueden marcar vacaciones
  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single()
      .then(({ data }) => {
        const role = (data?.role || '').toLowerCase();
        setUserCanEditVacaciones(['admin', 'manager', 'management'].includes(role));
      })
      .catch(() => setUserCanEditVacaciones(false));
  }, [user?.id]);

  // Cargar fichajes del mes visible
  useEffect(() => {
    if (!empleadoId) return;

    const loadFichajes = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(calendarMonth);
        const end = endOfMonth(calendarMonth);
        const res = await fichajeSupabaseService.obtenerFichajesEmpleado(empleadoId, start, end);
        setFichajes(res.success ? res.data || [] : []);
      } catch (err) {
        console.error('Error cargando fichajes del empleado:', err);
        setFichajes([]);
      } finally {
        setLoading(false);
      }
    };

    loadFichajes();
  }, [empleadoId, calendarMonth]);

  // Cargar vacaciones del mes visible
  useEffect(() => {
    if (!empleadoId) return;
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    fichajeSupabaseService.obtenerVacacionesEmpleado(empleadoId, start, end).then((res) => {
      setVacaciones(res.success ? res.data || [] : []);
    });
  }, [empleadoId, calendarMonth]);

  // Mapa fecha (YYYY-MM-DD) -> fichaje
  const fichajesPorFecha = useMemo(() => {
    const map = {};
    (fichajes || []).forEach((f) => {
      const key = f.fecha;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [fichajes]);

  // Conjunto de fechas con vacaciones (YYYY-MM-DD)
  const vacacionesPorFecha = useMemo(() => {
    const set = new Set();
    (vacaciones || []).forEach((v) => set.add(v.fecha));
    return set;
  }, [vacaciones]);

  const toggleVacacion = async (dateKey) => {
    if (!userCanEditVacaciones || !empleadoId || togglingVacacion) return;
    setTogglingVacacion(true);
    const esVacacion = vacacionesPorFecha.has(dateKey);
    try {
      if (esVacacion) {
        const res = await fichajeSupabaseService.quitarVacacion(empleadoId, dateKey);
        if (res.success) setVacaciones((prev) => prev.filter((v) => v.fecha !== dateKey));
      } else {
        const res = await fichajeSupabaseService.añadirVacacion(empleadoId, dateKey, user?.id);
        if (res.success && res.data) setVacaciones((prev) => [...prev, res.data].sort((a, b) => a.fecha.localeCompare(b.fecha)));
      }
    } finally {
      setTogglingVacacion(false);
    }
  };

  /** Modo periodo: primer clic guarda el día, segundo clic marca todos los días entre ambos como vacaciones */
  const handleClicDiaCalendario = (dateKey) => {
    if (!userCanEditVacaciones) return;
    if (modoPeriodoVacaciones) {
      if (periodoPrimerDia === null) {
        setPeriodoPrimerDia(dateKey);
        return;
      }
      const d1 = parseISO(periodoPrimerDia);
      const d2 = parseISO(dateKey);
      const [desde, hasta] = d1 <= d2 ? [d1, d2] : [d2, d1];
      const totalDias = differenceInCalendarDays(hasta, desde) + 1;
      if (totalDias > 365) {
        setPeriodoPrimerDia(null);
        setModoPeriodoVacaciones(false);
        return;
      }
      setTogglingVacacion(true);
      (async () => {
        const nuevas = [];
        let current = desde;
        while (current <= hasta) {
          const key = format(current, 'yyyy-MM-dd');
          if (!vacacionesPorFecha.has(key)) {
            const res = await fichajeSupabaseService.añadirVacacion(empleadoId, key, user?.id);
            if (res.success && res.data) nuevas.push(res.data);
          }
          current = addDays(current, 1);
        }
        if (nuevas.length > 0) {
          setVacaciones((prev) => [...prev, ...nuevas].sort((a, b) => a.fecha.localeCompare(b.fecha)));
        }
        setPeriodoPrimerDia(null);
        setModoPeriodoVacaciones(false);
        setTogglingVacacion(false);
      })();
      return;
    }
    toggleVacacion(dateKey);
  };

  // Resumen del mes
  const resumenMes = useMemo(() => {
    const completos = fichajes.filter((f) => f.hora_salida);
    const horasTotales = completos.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0);
    const trabajandoAhora = fichajes.some((f) => !f.hora_salida);
    return {
      diasTrabajados: completos.length,
      horasTotales: horasTotales.toFixed(2),
      trabajandoAhora
    };
  }, [fichajes]);

  // Días del calendario (mes actual + relleno para que la semana empiece en lunes)
  const days = useMemo(() => {
    const start = startOfMonth(calendarMonth);
    const end = endOfMonth(calendarMonth);
    const daysInMonth = eachDayOfInterval({ start, end });
    const startWeekday = (start.getDay() + 6) % 7; // 0 = lunes
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

  const openFichaje = (fichaje, edit = false) => {
    setSelectedFichaje(fichaje);
    setShowDetailsModal(!edit);
    setShowEditModal(edit);
  };

  const handleCloseModals = () => {
    setShowDetailsModal(false);
    setShowEditModal(false);
    setSelectedFichaje(null);
    // Recargar fichajes del mes
    if (empleadoId) {
      const start = startOfMonth(calendarMonth);
      const end = endOfMonth(calendarMonth);
      fichajeSupabaseService.obtenerFichajesEmpleado(empleadoId, start, end).then((res) => {
        if (res.success && res.data) setFichajes(res.data);
      });
    }
  };

  const nombreEmpleado = empleado?.nombreCompleto || empleado?.name || 'Empleado';

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.25 }}
      style={{ padding: '0 4px' }}
    >
      {/* Cabecera: volver + nombre */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap'
        }}
      >
        <button
          onClick={onBack}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 16px',
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            color: colors.text,
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer'
          }}
        >
          <ArrowLeft size={18} />
          Volver al listado
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '50%',
              backgroundColor: colors.primary + '22',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <User size={24} color={colors.primary} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '700', color: colors.text }}>
              {nombreEmpleado}
            </h2>
            {empleado?.email && (
              <p style={{ margin: '4px 0 0', fontSize: '14px', color: colors.textSecondary }}>
                {empleado.email}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Tarjetas de resumen */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}
      >
        <div
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ backgroundColor: colors.primary + '20', padding: '10px', borderRadius: '8px' }}>
            <Clock size={22} color={colors.primary} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '500' }}>
              Horas este mes
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>
              {resumenMes.horasTotales}h
            </div>
          </div>
        </div>
        <div
          style={{
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <div style={{ backgroundColor: colors.success + '20', padding: '10px', borderRadius: '8px' }}>
            <CalendarIcon size={22} color={colors.success} />
          </div>
          <div>
            <div style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '500' }}>
              Días trabajados
            </div>
            <div style={{ fontSize: '20px', fontWeight: '700', color: colors.text }}>
              {resumenMes.diasTrabajados}
            </div>
          </div>
        </div>
        {resumenMes.trabajandoAhora && (
          <div
            style={{
              backgroundColor: colors.warning + '15',
              border: `1px solid ${colors.warning}`,
              borderRadius: '12px',
              padding: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div style={{ backgroundColor: colors.warning + '30', padding: '10px', borderRadius: '8px' }}>
              <Coffee size={22} color={colors.warning} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: colors.textSecondary, fontWeight: '500' }}>
                Estado
              </div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: colors.warning }}>
                Trabajando ahora
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Navegación mes + calendario */}
      <div
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '8px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={() => setCalendarMonth((m) => subMonths(m, 1))}
              style={{
                padding: '8px 12px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <span style={{ fontSize: '18px', fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>
              {format(calendarMonth, 'MMMM yyyy', { locale: es })}
            </span>
            <button
              onClick={() => setCalendarMonth((m) => addMonths(m, 1))}
              style={{
                padding: '8px 12px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                color: colors.text,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <ChevronRight size={20} />
            </button>
          </div>
          {userCanEditVacaciones && (
            <button
              type="button"
              onClick={() => {
                setModoPeriodoVacaciones((v) => !v);
                setPeriodoPrimerDia(null);
              }}
              style={{
                padding: '8px 14px',
                backgroundColor: modoPeriodoVacaciones ? colors.warning : (colors.info || '#2196F3'),
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              {modoPeriodoVacaciones ? 'Cancelar' : 'Seleccionar periodo'}
            </button>
          )}
        </div>
        {modoPeriodoVacaciones && userCanEditVacaciones && (
          <p style={{ margin: '0 0 12px 0', fontSize: '13px', color: colors.textSecondary }}>
            {periodoPrimerDia ? 'Ahora clic en el último día del periodo.' : 'Clic en el primer día del periodo, luego en el último.'}
          </p>
        )}

        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px', color: colors.textSecondary }}>
            Cargando calendario...
          </div>
        ) : (
          <>
            {/* Días de la semana */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px',
                marginBottom: '8px'
              }}
            >
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    fontSize: '12px',
                    fontWeight: '600',
                    color: colors.textSecondary
                  }}
                >
                  {day}
                </div>
              ))}
            </div>
            {/* Celdas del mes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: '4px'
              }}
            >
              {days.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayFichajes = fichajesPorFecha[dateKey] || [];
                const isVacacion = vacacionesPorFecha.has(dateKey);
                const isCurrentMonth = isSameMonth(day, calendarMonth);
                const isTodayDate = isToday(day);
                const isFutureDate = isFuture(day) && !isTodayDate;
                const canToggleThisDay = userCanEditVacaciones;
                const esPrimerDiaPeriodo = modoPeriodoVacaciones && periodoPrimerDia === dateKey;

                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: '72px',
                      padding: '6px',
                      borderRadius: '8px',
                      backgroundColor: !isCurrentMonth
                        ? colors.surface
                        : isVacacion
                        ? (colors.info || '#2196F3') + '18'
                        : isTodayDate
                        ? colors.primary + '15'
                        : 'transparent',
                      border: esPrimerDiaPeriodo
                        ? `2px solid ${colors.warning}`
                        : isTodayDate
                        ? `2px solid ${colors.primary}`
                        : isVacacion
                        ? `1px solid ${colors.info || '#2196F3'}`
                        : `1px solid ${colors.border}`,
                      opacity: !isCurrentMonth ? 0.5 : 1,
                      boxShadow: esPrimerDiaPeriodo ? `0 0 0 2px ${colors.warning}40` : 'none'
                    }}
                  >
                    <div
                      style={{
                        fontSize: '13px',
                        fontWeight: isTodayDate ? '700' : '500',
                        color: isTodayDate ? colors.primary : colors.text,
                        marginBottom: '4px',
                        cursor: canToggleThisDay ? 'pointer' : 'default',
                        userSelect: canToggleThisDay ? 'none' : 'auto'
                      }}
                      onClick={canToggleThisDay ? () => handleClicDiaCalendario(dateKey) : undefined}
                      title={
                        canToggleThisDay
                          ? modoPeriodoVacaciones
                            ? periodoPrimerDia
                              ? 'Clic aquí como último día del periodo'
                              : 'Clic como primer día del periodo'
                            : isVacacion
                            ? 'Quitar vacaciones'
                            : 'Marcar como vacaciones'
                          : undefined
                      }
                    >
                      {format(day, 'd')}
                    </div>
                    {isVacacion && (
                      <div
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: (colors.info || '#2196F3') + '30',
                          color: colors.text,
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: canToggleThisDay ? 'pointer' : 'default'
                        }}
                        onClick={
                          canToggleThisDay
                            ? (e) => {
                                e.stopPropagation();
                                if (modoPeriodoVacaciones) handleClicDiaCalendario(dateKey);
                                else toggleVacacion(dateKey);
                              }
                            : undefined
                        }
                        title={
                          canToggleThisDay
                            ? modoPeriodoVacaciones
                              ? 'Usar como día del periodo'
                              : 'Quitar vacaciones'
                            : undefined
                        }
                      >
                        <Umbrella size={10} />
                        Vacaciones
                      </div>
                    )}
                    {dayFichajes.length > 0 && !isFutureDate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayFichajes.slice(0, 2).map((f) => (
                          <button
                            key={f.id}
                            onClick={() => openFichaje(f)}
                            style={{
                              textAlign: 'left',
                              fontSize: '10px',
                              padding: '4px 6px',
                              border: 'none',
                              borderRadius: '4px',
                              backgroundColor: f.hora_salida ? colors.success + '25' : colors.warning + '25',
                              color: colors.text,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={`${formatTimeMadrid(f.hora_entrada)} - ${f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'} (${f.horas_trabajadas || 0}h)`}
                          >
                            {formatTimeMadrid(f.hora_entrada)}–{f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'}
                            {f.horas_trabajadas != null && ` (${Number(f.horas_trabajadas).toFixed(1)}h)`}
                          </button>
                        ))}
                        {dayFichajes.length > 2 && (
                          <span style={{ fontSize: '10px', color: colors.textSecondary }}>
                            +{dayFichajes.length - 2} más
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Lista de fichajes del mes */}
      <div
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: '12px',
          padding: '20px'
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: '16px', fontWeight: '600', color: colors.text }}>
          Registros del mes
        </h3>
        {fichajes.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: '14px', margin: 0 }}>
            No hay fichajes en este mes.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {fichajes.map((f) => (
              <div
                key={f.id}
                onClick={() => openFichaje(f)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {f.hora_salida ? (
                    <CheckCircle size={18} color={colors.success} />
                  ) : (
                    <AlertCircle size={18} color={colors.warning} />
                  )}
                  <span style={{ fontWeight: '500', color: colors.text }}>{formatDateShortMadrid(f.fecha)}</span>
                  <span style={{ color: colors.textSecondary, fontSize: '14px' }}>
                    {formatTimeMadrid(f.hora_entrada)} – {f.hora_salida ? formatTimeMadrid(f.hora_salida) : 'En curso'}
                  </span>
                </div>
                <span style={{ fontWeight: '600', color: colors.text }}>
                  {f.horas_trabajadas != null ? `${Number(f.horas_trabajadas).toFixed(2)}h` : '-'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {showDetailsModal && selectedFichaje && (
        <FichajeDetailsModal
          fichaje={selectedFichaje}
          empleadoNombre={nombreEmpleado}
          onClose={handleCloseModals}
        />
      )}
      {showEditModal && selectedFichaje && (
        <FichajeEditModal
          fichaje={selectedFichaje}
          empleadoNombre={nombreEmpleado}
          onClose={handleCloseModals}
          onSave={handleCloseModals}
        />
      )}
    </motion.div>
  );
};

export default FichajeEmpleadoPerfil;
