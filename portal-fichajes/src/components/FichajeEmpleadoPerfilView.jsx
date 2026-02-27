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
  Umbrella,
  Pencil,
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  addMonths,
  subMonths,
  addDays,
  format,
  parseISO,
  isSameMonth,
  isToday,
  isFuture,
} from 'date-fns';
import { es } from 'date-fns/locale';
import * as fichajePortalService from '../services/fichajePortalService';
import { formatTimeMadrid, formatDateShortMadrid, formatDateTimeMadrid } from '../utils/timeUtils';
import { colors } from '../theme';

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export default function FichajeEmpleadoPerfilView({ empleado, onBack }) {
  const [calendarMonth, setCalendarMonth] = useState(new Date());
  const [fichajes, setFichajes] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [bajas, setBajas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedFichaje, setSelectedFichaje] = useState(null);
  const [auditoria, setAuditoria] = useState([]);
  const [loadingAuditoria, setLoadingAuditoria] = useState(false);

  const empleadoId = empleado?.id;

  useEffect(() => {
    if (!empleadoId) return;
    const load = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(calendarMonth);
        const end = endOfMonth(calendarMonth);
        const startBajas = subMonths(start, 1);
        const endBajas = addMonths(end, 1);
        const [resFichajes, resVacaciones, resBajas] = await Promise.all([
          fichajePortalService.obtenerFichajesEmpleado(empleadoId, start, end),
          fichajePortalService.obtenerVacacionesEmpleado(empleadoId, start, end),
          fichajePortalService.obtenerBajasEmpleado(empleadoId, startBajas, endBajas),
        ]);
        setFichajes(resFichajes.success ? resFichajes.data || [] : []);
        setVacaciones(resVacaciones.success ? resVacaciones.data || [] : []);
        setBajas(resBajas.success ? resBajas.data || [] : []);
      } catch (err) {
        setFichajes([]);
        setVacaciones([]);
        setBajas([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [empleadoId, calendarMonth]);

  useEffect(() => {
    if (!selectedFichaje?.id) {
      setAuditoria([]);
      return;
    }
    setLoadingAuditoria(true);
    fichajePortalService.obtenerAuditoria(selectedFichaje.id).then((res) => {
      setAuditoria(res.success ? res.data || [] : []);
      setLoadingAuditoria(false);
    });
  }, [selectedFichaje?.id]);

  const fichajesPorFecha = useMemo(() => {
    const map = {};
    (fichajes || []).forEach((f) => {
      const key = f.fecha;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [fichajes]);

  const vacacionesPorFecha = useMemo(() => {
    const set = new Set();
    (vacaciones || []).forEach((v) => set.add(v.fecha));
    return set;
  }, [vacaciones]);

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
                const isVacacion = vacacionesPorFecha.has(dateKey);
                const isBaja = bajasPorFecha.has(dateKey);
                const isCurrentMonth = isSameMonth(day, calendarMonth);
                const isTodayDate = isToday(day);
                const isFutureDate = isFuture(day) && !isTodayDate;

                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: 72,
                      minWidth: 0,
                      overflow: 'hidden',
                      padding: 6,
                      borderRadius: 8,
                      backgroundColor: !isCurrentMonth
                        ? colors.surface
                        : isVacacion
                        ? (colors.info || '#2196F3') + '18'
                        : isBaja
                        ? (colors.warning || '#ed6c02') + '18'
                        : isTodayDate
                        ? colors.primary + '15'
                        : 'transparent',
                      border: isTodayDate
                        ? `2px solid ${colors.primary}`
                        : isVacacion
                        ? `1px solid ${colors.info || '#2196F3'}`
                        : isBaja
                        ? `1px solid ${colors.warning || '#ed6c02'}`
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
                    {isVacacion && (
                      <div
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: (colors.info || '#2196F3') + '30',
                          color: colors.text,
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <Umbrella size={10} />
                        Vacaciones
                      </div>
                    )}
                    {isBaja && !isVacacion && (
                      <div
                        style={{
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          backgroundColor: (colors.warning || '#ed6c02') + '30',
                          color: colors.text,
                          marginBottom: 4,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <AlertCircle size={10} />
                        Baja
                      </div>
                    )}
                    {dayFichajes.length > 0 && !isFutureDate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
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
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                            title={`${formatTimeMadrid(f.hora_entrada)} - ${f.hora_salida ? formatTimeMadrid(f.hora_salida) : '...'}${f.es_modificado ? ' · Modificado' : ''}`}
                          >
                            {f.es_modificado && <Pencil size={10} style={{ color: colors.warning || '#ed6c02', flexShrink: 0 }} />}
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

      {/* Bajas: sección solo lectura para el inspector */}
      <div
        style={{
          backgroundColor: colors.card,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          padding: 20,
          marginTop: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600, color: colors.text }}>
          Bajas
        </h3>
        <p style={{ color: colors.textSecondary, fontSize: 13, margin: '0 0 12px' }}>
          Periodos en los que el empleado no ficha (enfermedad, accidente, etc.). Solo consulta.
        </p>
        {bajas.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {bajas.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${(colors.warning || '#ed6c02')}40`,
                  borderRadius: 8,
                }}
              >
                <span style={{ fontWeight: 500, color: colors.text }}>
                  {formatDateShortMadrid(b.fecha_inicio)} – {formatDateShortMadrid(b.fecha_fin)}
                  {b.tipo && (
                    <span style={{ color: colors.textSecondary, marginLeft: 8 }}>({b.tipo})</span>
                  )}
                  {b.notas && (
                    <span style={{ color: colors.textSecondary, marginLeft: 8, fontSize: 12 }}>
                      — {b.notas}
                    </span>
                  )}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: colors.textSecondary, fontSize: 14, margin: 0 }}>
            No hay bajas registradas en el rango mostrado.
          </p>
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
              maxWidth: 480,
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
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

            {/* Historial de Cambios (igual que en la app) */}
            {loadingAuditoria && (
              <div style={{ marginTop: 16, fontSize: 13, color: colors.textSecondary }}>
                Cargando historial…
              </div>
            )}
            {!loadingAuditoria && auditoria.length > 0 && (
              <div
                style={{
                  marginTop: 20,
                  padding: 16,
                  backgroundColor: colors.background || '#f5f5f5',
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                }}
              >
                <h4
                  style={{
                    margin: '0 0 12px',
                    fontSize: 16,
                    fontWeight: 600,
                    color: colors.text,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <AlertCircle size={18} />
                  Historial de Cambios
                </h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {auditoria.map((registro) => {
                    const esModificacionPorUsuario = registro.accion === 'modificado' && registro.quien != null;
                    const cuandoMs = registro.cuando ? new Date(registro.cuando).getTime() : 0;
                    const motivoGuardado = registro.motivo
                      || (esModificacionPorUsuario && auditoria.find(
                        (r) => r.accion === 'modificado' && r.motivo && r.cuando
                          && Math.abs(new Date(r.cuando).getTime() - cuandoMs) < 15000
                      )?.motivo)
                      || null;
                    const motivo = motivoGuardado
                      || registro.valor_nuevo?.valor_original?.motivo_cierre_auto
                      || registro.valor_anterior?.valor_original?.motivo_cierre_auto
                      || (esModificacionPorUsuario ? 'Modificación registrada por el responsable' : null);
                    const quienNombre = registro.quien?.name || registro.quien?.email || (registro.quien ? 'Usuario' : null);
                    return (
                      <div
                        key={registro.id}
                        style={{
                          padding: 12,
                          backgroundColor: colors.surface || '#fff',
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                            marginBottom: 8,
                          }}
                        >
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight: 600,
                              color: colors.text,
                              textTransform: 'uppercase',
                            }}
                          >
                            {registro.accion}
                          </span>
                          <span style={{ fontSize: 12, color: colors.textSecondary }}>
                            {formatDateTimeMadrid(registro.cuando)}
                          </span>
                        </div>
                        {quienNombre && (
                          <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: motivo ? 8 : 0 }}>
                            Por: {quienNombre}
                          </div>
                        )}
                        {motivo && (
                          <div
                            style={{
                              marginTop: 4,
                              padding: '10px 12px',
                              backgroundColor: (colors.primary || '#1976d2') + '18',
                              borderRadius: 6,
                              borderLeft: `4px solid ${colors.primary || '#1976d2'}`,
                              fontSize: 14,
                              color: colors.text,
                              fontWeight: 500,
                            }}
                          >
                            {motivo}
                          </div>
                        )}
                        {registro.valor_anterior && registro.valor_nuevo && (
                          <details style={{ marginTop: 10 }}>
                            <summary
                              style={{
                                fontSize: 12,
                                color: colors.textSecondary,
                                cursor: 'pointer',
                              }}
                            >
                              Ver detalles técnicos (anterior / nuevo)
                            </summary>
                            <div
                              style={{
                                marginTop: 8,
                                padding: 8,
                                backgroundColor: colors.background || '#eee',
                                borderRadius: 6,
                                fontSize: 11,
                                color: colors.textSecondary,
                                overflow: 'auto',
                                maxHeight: 200,
                              }}
                            >
                              <div style={{ marginBottom: 4 }}>
                                <strong>Anterior:</strong>
                                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {JSON.stringify(registro.valor_anterior, null, 2)}
                                </pre>
                              </div>
                              <div>
                                <strong>Nuevo:</strong>
                                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                                  {JSON.stringify(registro.valor_nuevo, null, 2)}
                                </pre>
                              </div>
                            </div>
                          </details>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </motion.div>
  );
}
