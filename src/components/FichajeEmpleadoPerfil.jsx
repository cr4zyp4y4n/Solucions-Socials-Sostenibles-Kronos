import React, { useState, useEffect, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  Coffee,
  AlertCircle,
  Umbrella,
  Pencil,
  User
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
import { formatTimeMadrid, formatDateShortMadrid, formatearHorasDecimal } from '../utils/timeUtils';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import { KronosButton, KronosCard, KronosFieldLabel, KronosInput, KronosSelect } from './kronos';
import { empleadoEstadoFlow, estadoPanelColor } from './panelFichajes/panelFichajesHelpers';
import FichajeDetailsModal from './FichajeDetailsModal';
import FichajeEditModal from './FichajeEditModal';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

const LEGEND_ITEMS = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'fichaje', label: 'Fichaje' },
  { key: 'curso', label: 'En curso' },
  { key: 'vacaciones', label: 'Vacaciones' },
  { key: 'baja', label: 'Baja' }
];

const FichajeEmpleadoPerfil = ({ empleado, onBack, resumen, mesInicial }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [calendarMonth, setCalendarMonth] = useState(() => mesInicial || new Date());
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
  const [bajas, setBajas] = useState([]);
  const [showBajaForm, setShowBajaForm] = useState(false);
  const [bajaForm, setBajaForm] = useState({ fecha_inicio: '', fecha_fin: '', tipo: '', notas: '' });
  const [savingBaja, setSavingBaja] = useState(false);

  const empleadoId = empleado?.id;

  useEffect(() => {
    if (mesInicial) setCalendarMonth(mesInicial);
  }, [empleadoId, mesInicial]);

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

  // Cargar bajas del empleado (mes visible ± 1 mes para poder ver y eliminar cualquiera)
  useEffect(() => {
    if (!empleadoId) return;
    const start = startOfMonth(subMonths(calendarMonth, 1));
    const end = endOfMonth(addMonths(calendarMonth, 1));
    fichajeSupabaseService.obtenerBajasEmpleado(empleadoId, start, end).then((res) => {
      setBajas(res.success ? res.data || [] : []);
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

  // Conjunto de fechas que caen dentro de alguna baja (YYYY-MM-DD)
  const bajasPorFecha = useMemo(() => {
    const set = new Set();
    (bajas || []).forEach((b) => {
      let d = parseISO(b.fecha_inicio);
      const fin = parseISO(b.fecha_fin);
      while (d <= fin) {
        set.add(format(d, 'yyyy-MM-dd'));
        d = addDays(d, 1);
      }
    });
    return set;
  }, [bajas]);

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
  const esMesActual = isSameMonth(calendarMonth, new Date());
  const mesLabel = format(calendarMonth, 'MMMM yyyy', { locale: es });

  const resumenVivo = useMemo(() => ({
    ...(resumen || {}),
    trabajandoAhora: resumenMes.trabajandoAhora || resumen?.trabajandoAhora,
    diasTrabajados: resumenMes.diasTrabajados,
    horasTotales: resumenMes.horasTotales
  }), [resumen, resumenMes]);

  const estadoFlow = useMemo(() => empleadoEstadoFlow(resumenVivo), [resumenVivo]);
  const estadoTone = estadoPanelColor(estadoFlow.key, colors);

  const legendTone = (key) => {
    switch (key) {
      case 'hoy': return colors.primary;
      case 'fichaje': return colors.success;
      case 'curso': return colors.warning;
      case 'vacaciones': return colors.info || '#2196F3';
      case 'baja': return colors.error || colors.warning;
      default: return colors.textSecondary;
    }
  };

  return (
    <div>
      <KronosButton variant="ghost" size="sm" onClick={onBack} style={{ marginBottom: 14, paddingLeft: 0 }}>
        <ArrowLeft size={15} />
        Volver al listado
      </KronosButton>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 14,
          marginBottom: 18,
          flexWrap: 'wrap'
        }}
      >
        <div
          style={{
            width: 44,
            height: 44,
            borderRadius: 10,
            background: `${colors.primary}14`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <User size={22} color={colors.primary} />
        </div>
        <div style={{ minWidth: 0 }}>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: colors.text }}>
            {nombreEmpleado}
          </h2>
          <div style={{ marginTop: 5, fontSize: 13, color: colors.textSecondary }}>
            {empleado?.email || 'Sin email'}
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: '3px 8px',
                borderRadius: 6,
                background: `${estadoTone}14`,
                color: estadoTone
              }}
            >
              {estadoFlow.label}
            </span>
            {resumenMes.trabajandoAhora ? (
              <span style={{ fontSize: 12, color: colors.warning, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Coffee size={13} />
                Fichaje en curso
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
          gap: 10,
          marginBottom: 18
        }}
      >
        {[
          { label: 'Horas mes', value: `${resumenMes.horasTotales}h`, tone: colors.primary },
          { label: 'Días trabajados', value: resumenMes.diasTrabajados, tone: colors.success },
          { label: 'Vac. restantes', value: resumen?.diasVacacionesRestantes ?? '—', tone: colors.text }
        ].map((kpi) => (
          <KronosCard key={kpi.label} style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{kpi.label}</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: kpi.tone }}>{kpi.value}</div>
          </KronosCard>
        ))}
      </div>

      <KronosCard style={{ marginBottom: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <KronosButton size="sm" onClick={() => setCalendarMonth((m) => subMonths(m, 1))}>
              <ChevronLeft size={16} />
            </KronosButton>
            <span style={{ fontWeight: 600, fontSize: 15, textTransform: 'capitalize', minWidth: 140, textAlign: 'center' }}>
              {mesLabel}
            </span>
            <KronosButton size="sm" onClick={() => setCalendarMonth((m) => addMonths(m, 1))}>
              <ChevronRight size={16} />
            </KronosButton>
            {!esMesActual ? (
              <KronosButton size="sm" variant="ghost" onClick={() => setCalendarMonth(new Date())}>
                Hoy
              </KronosButton>
            ) : null}
          </div>
          {userCanEditVacaciones ? (
            <KronosButton
              size="sm"
              variant={modoPeriodoVacaciones ? 'ghost' : 'secondary'}
              onClick={() => {
                setModoPeriodoVacaciones((v) => !v);
                setPeriodoPrimerDia(null);
              }}
            >
              {modoPeriodoVacaciones ? 'Cancelar periodo' : 'Marcar periodo vacaciones'}
            </KronosButton>
          ) : null}
        </div>

        {modoPeriodoVacaciones && userCanEditVacaciones ? (
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: colors.textSecondary }}>
            {periodoPrimerDia ? 'Clic en el último día del periodo.' : 'Clic en el primer y último día del periodo.'}
          </p>
        ) : null}

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginBottom: 14, fontSize: 12, color: colors.textSecondary }}>
          {LEGEND_ITEMS.map((item) => (
            <span key={item.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: item.key === 'hoy' ? 'transparent' : `${legendTone(item.key)}66`,
                  border: item.key === 'hoy' ? `2px solid ${legendTone(item.key)}` : 'none',
                  boxSizing: 'border-box'
                }}
              />
              {item.label}
            </span>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: colors.textSecondary }}>
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
                const isBaja = bajasPorFecha.has(dateKey);
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
                        : isBaja
                        ? (colors.warning || '#ed6c02') + '18'
                        : isTodayDate
                        ? colors.primary + '15'
                        : 'transparent',
                      border: esPrimerDiaPeriodo
                        ? `2px solid ${colors.warning}`
                        : isTodayDate
                        ? `2px solid ${colors.primary}`
                        : isVacacion
                        ? `1px solid ${colors.info || '#2196F3'}`
                        : isBaja
                        ? `1px solid ${colors.warning || '#ed6c02'}`
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
                    {isBaja && !isVacacion && (
                      <div
                        style={{
                          fontSize: '10px',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          backgroundColor: (colors.warning || '#ed6c02') + '30',
                          color: colors.text,
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <AlertCircle size={10} />
                        Baja
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
                              textOverflow: 'ellipsis',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                            title={`${formatTimeMadrid(f.hora_entrada)} - ${f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'} (${formatearHorasDecimal(f.horas_trabajadas)})${f.es_modificado ? ' · Modificado' : ''}`}
                          >
                            {f.es_modificado && <Pencil size={10} style={{ color: colors.warning || '#ed6c02', flexShrink: 0 }} />}
                            {formatTimeMadrid(f.hora_entrada)}–{f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'}
                            {f.horas_trabajadas != null && ` (${formatearHorasDecimal(f.horas_trabajadas)})`}
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
      </KronosCard>

      <KronosCard style={{ marginBottom: 16 }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 14, fontWeight: 600, color: colors.text }}>
          Registros del mes
        </h3>
        {fichajes.length === 0 ? (
          <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0 }}>
            No hay fichajes en este mes.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {[...fichajes]
              .sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || String(b.hora_entrada).localeCompare(String(a.hora_entrada)))
              .map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => openFichaje(f)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  background: colors.background,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  color: colors.text,
                  textAlign: 'left',
                  width: '100%'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, fontSize: 13 }}>
                  <span style={{ fontWeight: 600, minWidth: 72 }}>{formatDateShortMadrid(f.fecha)}</span>
                  <span style={{ color: colors.textSecondary }}>
                    {formatTimeMadrid(f.hora_entrada)} – {f.hora_salida ? formatTimeMadrid(f.hora_salida) : 'En curso'}
                  </span>
                  {f.es_modificado ? <Pencil size={12} color={colors.warning || '#ed6c02'} title="Modificado" /> : null}
                </div>
                <span style={{ fontWeight: 600, flexShrink: 0, fontSize: 13 }}>
                  {f.horas_trabajadas != null ? formatearHorasDecimal(f.horas_trabajadas) : '—'}
                </span>
              </button>
            ))}
          </div>
        )}
      </KronosCard>

      {userCanEditVacaciones ? (
        <KronosCard>
          <h3 style={{ margin: '0 0 8px', fontSize: 14, fontWeight: 600, color: colors.text }}>
            Bajas
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 12px' }}>
            Periodos de baja médica u otros. Los días de vacaciones se marcan en el calendario.
          </p>
          {bajas.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '16px' }}>
              {bajas.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.warning || '#ed6c02'}40`,
                    borderRadius: '8px'
                  }}
                >
                  <span style={{ fontWeight: '500', color: colors.text }}>
                    {formatDateShortMadrid(b.fecha_inicio)} – {formatDateShortMadrid(b.fecha_fin)}
                    {b.tipo && <span style={{ color: colors.textSecondary, marginLeft: 8 }}>({b.tipo})</span>}
                    {b.notas && <span style={{ color: colors.textSecondary, marginLeft: 8, fontSize: '12px' }}> — {b.notas}</span>}
                  </span>
                  <KronosButton
                    size="sm"
                    variant="ghost"
                    onClick={async () => {
                      if (!window.confirm('¿Quitar esta baja? Se borrará el periodo de baja.')) return;
                      const res = await fichajeSupabaseService.eliminarBaja(b.id);
                      if (res.success) setBajas((prev) => prev.filter((x) => x.id !== b.id));
                    }}
                    style={{ borderColor: `${colors.warning || '#ed6c02'}66`, color: colors.warning || '#ed6c02' }}
                  >
                    Quitar baja
                  </KronosButton>
                </div>
              ))}
            </div>
          )}
          {!showBajaForm ? (
            <KronosButton size="sm" onClick={() => setShowBajaForm(true)}>
              Añadir baja
            </KronosButton>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                padding: 14,
                background: colors.background,
                borderRadius: 12,
                border: `1px solid ${colors.border}`
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
                <div>
                  <KronosFieldLabel>Desde</KronosFieldLabel>
                  <KronosInput
                    type="date"
                    value={bajaForm.fecha_inicio}
                    onChange={(e) => setBajaForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  />
                </div>
                <div>
                  <KronosFieldLabel>Hasta</KronosFieldLabel>
                  <KronosInput
                    type="date"
                    value={bajaForm.fecha_fin}
                    onChange={(e) => setBajaForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                  />
                </div>
                <div>
                  <KronosFieldLabel>Tipo</KronosFieldLabel>
                  <KronosSelect
                    value={bajaForm.tipo}
                    onChange={(e) => setBajaForm((f) => ({ ...f, tipo: e.target.value }))}
                  >
                    <option value="">—</option>
                    <option value="enfermedad">Enfermedad</option>
                    <option value="accidente">Accidente</option>
                    <option value="maternidad">Maternidad</option>
                    <option value="otro">Otro</option>
                  </KronosSelect>
                </div>
              </div>
              <div>
                <KronosFieldLabel>Notas</KronosFieldLabel>
                <KronosInput
                  type="text"
                  placeholder="Opcional"
                  value={bajaForm.notas}
                  onChange={(e) => setBajaForm((f) => ({ ...f, notas: e.target.value }))}
                />
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <KronosButton
                  variant="primary"
                  disabled={savingBaja || !bajaForm.fecha_inicio || !bajaForm.fecha_fin}
                  onClick={async () => {
                    setSavingBaja(true);
                    try {
                      const res = await fichajeSupabaseService.crearBaja(
                        empleadoId,
                        bajaForm.fecha_inicio,
                        bajaForm.fecha_fin,
                        bajaForm.tipo || null,
                        bajaForm.notas || null,
                        user?.id
                      );
                      if (res.success && res.data) {
                        const startStr = format(startOfMonth(calendarMonth), 'yyyy-MM-dd');
                        const endStr = format(endOfMonth(calendarMonth), 'yyyy-MM-dd');
                        const overlap = res.data.fecha_inicio <= endStr && res.data.fecha_fin >= startStr;
                        if (overlap) {
                          setBajas((prev) => [...prev, res.data].sort((a, b) => a.fecha_inicio.localeCompare(b.fecha_inicio)));
                        }
                        setBajaForm({ fecha_inicio: '', fecha_fin: '', tipo: '', notas: '' });
                        setShowBajaForm(false);
                      }
                    } finally {
                      setSavingBaja(false);
                    }
                  }}
                >
                  {savingBaja ? 'Guardando…' : 'Guardar'}
                </KronosButton>
                <KronosButton
                  variant="ghost"
                  onClick={() => { setShowBajaForm(false); setBajaForm({ fecha_inicio: '', fecha_fin: '', tipo: '', notas: '' }); }}
                >
                  Cancelar
                </KronosButton>
              </div>
            </div>
          )}
        </KronosCard>
      ) : null}

      {showDetailsModal && selectedFichaje && (
        <FichajeDetailsModal
          fichaje={selectedFichaje}
          empleadoNombre={nombreEmpleado}
          onClose={handleCloseModals}
          onEdit={() => {
            setShowDetailsModal(false);
            setShowEditModal(true);
          }}
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
    </div>
  );
};

export default FichajeEmpleadoPerfil;
