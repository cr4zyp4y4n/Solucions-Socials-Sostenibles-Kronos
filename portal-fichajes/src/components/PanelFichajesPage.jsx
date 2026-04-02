import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Clock,
  User,
  Calendar,
  Search,
  Coffee,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Download,
  Umbrella,
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { startOfMonth, endOfMonth, startOfYear, format, addMonths, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import * as fichajePortalService from '../services/fichajePortalService';
import { formatTimeMadrid, formatDateShortMadrid, formatearHorasDecimal } from '../utils/timeUtils';
import { colors } from '../theme';
import FichajeEmpleadoPerfilView from './FichajeEmpleadoPerfilView';

export default function PanelFichajesPage() {
  const [empleados, setEmpleados] = useState([]);
  const [fichajesMes, setFichajesMes] = useState([]);
  const [vacacionesMes, setVacacionesMes] = useState([]);
  const [bajasMes, setBajasMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);

  const mesActual = useMemo(() => startOfMonth(new Date()), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(mesActual);
        const end = endOfMonth(mesActual);
        const endExt = endOfMonth(addMonths(mesActual, 2));
        const startYear = startOfYear(mesActual);
        const [resFichajes, resVacaciones, resBajas] = await Promise.all([
          fichajePortalService.obtenerTodosFichajes({ fechaInicio: start, fechaFin: end }),
          fichajePortalService.obtenerVacacionesEnRango(startYear, endExt),
          fichajePortalService.obtenerBajasEnRango(start, endExt),
        ]);
        const data = resFichajes.success ? resFichajes.data || [] : [];
        setFichajesMes(data);
        setVacacionesMes(resVacaciones.success ? resVacaciones.data || [] : []);
        setBajasMes(resBajas.success ? resBajas.data || [] : []);
        const emps = await fichajePortalService.obtenerEmpleadosConFichajes(data);
        setEmpleados(emps);
      } catch (err) {
        console.error(err);
        setFichajesMes([]);
        setVacacionesMes([]);
        setBajasMes([]);
        setEmpleados([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mesActual]);

  const resumenPorEmpleado = useMemo(() => {
    const todayStr = format(mesActual, 'yyyy-MM-dd');
    const yearStr = format(mesActual, 'yyyy');
    const map = {};
    empleados.forEach((emp) => {
      const fichajesEmp = fichajesMes.filter((f) => f.empleado_id === emp.id);
      const completos = fichajesEmp.filter((f) => f.hora_salida);
      const horasTotales = completos.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0);
      const trabajandoAhora = fichajesEmp.some((f) => !f.hora_salida);
      const ultimoFichaje =
        fichajesEmp.length > 0
          ? fichajesEmp.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
          : null;
      const vacacionesEmp = vacacionesMes.filter((v) => v.empleado_id === emp.id);
      const fechasVacaciones = vacacionesEmp.map((v) => v.fecha).sort();
      const vacacionesQueCuentanAnio = vacacionesEmp.filter(
        (v) => v.fecha.startsWith(yearStr) && v.cuenta_para_anual !== false
      ).length;
      const diasVacacionesRestantes = Math.max(0, 22 - vacacionesQueCuentanAnio);
      const futuras = fechasVacaciones.filter((d) => d >= todayStr);
      let vacacionesHasta = null;
      let diasHastaVacaciones = null;
      let estaEnVacaciones = false;
      if (futuras.length > 0) {
        let blockEnd = futuras[0];
        for (let i = 1; i < futuras.length; i++) {
          const esperado = format(addDays(parseISO(blockEnd), 1), 'yyyy-MM-dd');
          if (futuras[i] === esperado) blockEnd = futuras[i];
          else break;
        }
        vacacionesHasta = blockEnd;
        estaEnVacaciones = futuras.includes(todayStr);
        if (!estaEnVacaciones) {
          diasHastaVacaciones = differenceInCalendarDays(parseISO(futuras[0]), parseISO(todayStr));
        }
      }
      const fechasDelMesActual = fechasVacaciones.filter((d) =>
        d.startsWith(format(mesActual, 'yyyy-MM'))
      );
      const bajasEmp = (bajasMes || []).filter((b) => b.empleado_id === emp.id);
      let estaDeBaja = false;
      let bajaHasta = null;
      for (const b of bajasEmp) {
        const ini = b.fecha_inicio;
        const fin = b.fecha_fin;
        if (todayStr >= ini && todayStr <= fin) {
          estaDeBaja = true;
          if (!bajaHasta || fin > bajaHasta) bajaHasta = fin;
        }
      }
      map[emp.id] = {
        horasTotales: horasTotales.toFixed(2),
        diasTrabajados: completos.length,
        trabajandoAhora,
        ultimoFichaje,
        totalFichajes: fichajesEmp.length,
        vacacionesDelMes: fechasDelMesActual,
        diasVacaciones: fechasDelMesActual.length,
        vacacionesHasta,
        diasHastaVacaciones,
        estaEnVacaciones,
        diasVacacionesRestantes,
        estaDeBaja,
        bajaHasta,
      };
    });
    return map;
  }, [empleados, fichajesMes, vacacionesMes, bajasMes, mesActual]);

  const empleadosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return empleados;
    const term = searchTerm.toLowerCase();
    return empleados.filter(
      (e) =>
        (e.nombreCompleto || e.name || '').toLowerCase().includes(term)
    );
  }, [empleados, searchTerm]);

  const empleadosOrdenados = useMemo(() => {
    return [...empleadosFiltrados].sort((a, b) => {
      const aTrabajando = resumenPorEmpleado[a.id]?.trabajandoAhora ?? false;
      const bTrabajando = resumenPorEmpleado[b.id]?.trabajandoAhora ?? false;
      if (aTrabajando && !bTrabajando) return -1;
      if (!aTrabajando && bTrabajando) return 1;
      return 0;
    });
  }, [empleadosFiltrados, resumenPorEmpleado]);

  const descargarInforme = async () => {
    const fechaHasta = endOfMonth(new Date());
    const fechaDesde = startOfMonth(addMonths(new Date(), -24));
    const resAll = await fichajePortalService.obtenerTodosFichajes({
      fechaInicio: fechaDesde,
      fechaFin: fechaHasta,
    });
    const todosFichajes = resAll.success ? resAll.data || [] : [];
    const empsExport = await fichajePortalService.obtenerEmpleadosConFichajes(todosFichajes);
    const completos = todosFichajes
      .filter((f) => f.hora_salida)
      .slice()
      .sort((a, b) => {
        const porFecha = (a.fecha || '').localeCompare(b.fecha || '');
        if (porFecha !== 0) return porFecha;
        return (a.hora_entrada || '').localeCompare(b.hora_entrada || '');
      });
    // Resumen por empleado y mes (horas y días trabajados)
    const monthKey = (fechaIso) => (fechaIso ? format(parseISO(fechaIso), 'yyyy-MM') : '');
    const monthLabel = (yyyyMm) => {
      if (!yyyyMm) return '';
      const [y, m] = yyyyMm.split('-').map(Number);
      const d = new Date(y, (m || 1) - 1, 1);
      const label = format(d, 'MMMM yyyy', { locale: es });
      return label ? label.charAt(0).toUpperCase() + label.slice(1) : yyyyMm;
    };
    const months = [...new Set(completos.map((f) => monthKey(f.fecha)).filter(Boolean))].sort();
    const resumenPorEmpleadoMes = {}; // { empId: { [yyyy-MM]: { horas: number, diasSet: Set<string> } } }
    empsExport.forEach((emp) => {
      resumenPorEmpleadoMes[emp.id] = {};
      months.forEach((mm) => { resumenPorEmpleadoMes[emp.id][mm] = { horas: 0, diasSet: new Set() }; });
    });
    completos.forEach((f) => {
      const mm = monthKey(f.fecha);
      if (!mm) return;
      if (!resumenPorEmpleadoMes[f.empleado_id]) resumenPorEmpleadoMes[f.empleado_id] = {};
      if (resumenPorEmpleadoMes[f.empleado_id][mm] == null) resumenPorEmpleadoMes[f.empleado_id][mm] = { horas: 0, diasSet: new Set() };
      resumenPorEmpleadoMes[f.empleado_id][mm].horas += Number(f.horas_trabajadas || 0);
      if (f.fecha) resumenPorEmpleadoMes[f.empleado_id][mm].diasSet.add(f.fecha);
    });

    const getMinMaxFecha = (rows) => {
      const fechas = (rows || []).map((r) => r?.fecha).filter(Boolean).sort();
      if (fechas.length === 0) return null;
      return { min: fechas[0], max: fechas[fechas.length - 1] };
    };
    const rango = getMinMaxFecha(completos);
    const rangoLabel = rango
      ? `Rango de datos: ${format(parseISO(rango.min), 'dd-MM-yyyy')} a ${format(parseISO(rango.max), 'dd-MM-yyyy')}`
      : 'Sin registros para exportar';

    const wb = new ExcelJS.Workbook();

    const wsAsistencia = wb.addWorksheet('Asistencia', { views: [{ showGridLines: true }] });
    wsAsistencia.addRow([`Informe de asistencia (todos los datos)`]);
    wsAsistencia.addRow([rangoLabel]);
    wsAsistencia.getRow(1).font = { bold: true, size: 12 };
    wsAsistencia.getRow(2).font = { size: 11 };
    wsAsistencia.addRow([]);
    const headersAsistencia = ['Mes', 'Empleado', 'Fecha', 'Entrada', 'Salida', 'Horas trabajadas', 'Horas extraordinarias', 'Horas extras'];
    wsAsistencia.addRow(headersAsistencia);
    const rowHeaders = wsAsistencia.getRow(4);
    rowHeaders.eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    });
    completos.forEach((f) => {
      const emp = empsExport.find((e) => e.id === f.empleado_id);
      const nombre = emp?.nombreCompleto || emp?.name || f.empleado_id || '';
      const horas = f.horas_trabajadas != null ? Number(f.horas_trabajadas) : 0;
      const mes = f.fecha
        ? (() => {
          const label = format(parseISO(f.fecha), 'MMMM', { locale: es });
          return label ? label.charAt(0).toUpperCase() + label.slice(1) : '';
        })()
        : '';
      wsAsistencia.addRow([
        mes,
        nombre,
        f.fecha,
        f.hora_entrada ? formatTimeMadrid(f.hora_entrada) : '',
        f.hora_salida ? formatTimeMadrid(f.hora_salida) : '',
        horas.toFixed(2),
        '',
        '',
      ]);
    });
    wsAsistencia.columns = [
      { width: 8 },
      { width: 28 },
      { width: 12 },
      { width: 10 },
      { width: 10 },
      { width: 18 },
      { width: 22 },
      { width: 14 },
    ];

    const wsResumen = wb.addWorksheet('Resumen');
    wsResumen.addRow([`Resumen por empleado (todos los datos)`]);
    wsResumen.addRow([rangoLabel]);
    wsResumen.getRow(1).font = { bold: true, size: 12 };
    wsResumen.getRow(2).font = { size: 11 };
    wsResumen.addRow([]);
    const headersResumen = [
      'Empleado',
      ...months.flatMap((mm) => {
        const label = monthLabel(mm);
        return [`${label} (h)`, `${label} (días)`];
      }),
      'Total horas',
      'Total días',
    ];
    wsResumen.addRow(headersResumen);
    wsResumen.getRow(4).eachCell((c) => {
      c.font = { bold: true };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8E8E8' } };
    });
    [...empsExport]
      .sort((a, b) => (a.nombreCompleto || a.name || '').localeCompare(b.nombreCompleto || b.name || ''))
      .forEach((emp) => {
        const nombre = emp.nombreCompleto || emp.name || 'Sin nombre';
        const perMes = resumenPorEmpleadoMes[emp.id] || {};
        const valoresMes = months.flatMap((mm) => {
          const v = perMes[mm] || { horas: 0, diasSet: new Set() };
          const horas = Number(v.horas || 0).toFixed(2);
          const dias = v.diasSet ? v.diasSet.size : 0;
          return [horas, dias];
        });
        const totalHoras = months.reduce((sum, mm) => sum + Number((perMes[mm]?.horas) || 0), 0);
        const totalDias = months.reduce((sum, mm) => sum + Number(perMes[mm]?.diasSet?.size || 0), 0);
        wsResumen.addRow([nombre, ...valoresMes, totalHoras.toFixed(2), totalDias]);
      });
    wsResumen.columns = [
      { width: 28 },
      ...months.flatMap(() => ([{ width: 12 }, { width: 10 }])),
      { width: 14 },
      { width: 12 },
    ];

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Asistencia_completo_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (selectedEmpleado) {
    return (
      <div className="portal-page" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
        <FichajeEmpleadoPerfilView
          empleado={selectedEmpleado}
          onBack={() => setSelectedEmpleado(null)}
        />
      </div>
    );
  }

  return (
    <div className="portal-page" style={{ padding: '24px', maxWidth: 1200, margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: '28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
          <Clock size={32} color={colors.primary} />
          <h1 style={{ fontSize: '28px', fontWeight: 700, color: colors.text, margin: 0 }}>
            Panel de Fichajes
          </h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <p style={{ fontSize: 15, color: colors.textSecondary, margin: 0 }}>
            Resumen por empleado del mes de {format(mesActual, 'MMMM yyyy', { locale: es })}. Haz clic en un empleado para ver su perfil con calendario y registros.
          </p>
          {!loading && (
            <button
              type="button"
              onClick={descargarInforme}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                backgroundColor: colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Download size={18} />
              Descargar informe (.xlsx)
            </button>
          )}
        </div>
      </motion.div>

      <div style={{ marginBottom: 24 }}>
        <div style={{ position: 'relative', maxWidth: 400 }}>
          <Search
            size={18}
            color={colors.textSecondary}
            style={{
              position: 'absolute',
              left: 12,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              color: colors.text,
              backgroundColor: colors.background,
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: colors.textSecondary }}>
          Cargando empleados y fichajes...
        </div>
      ) : empleadosOrdenados.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 48,
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            color: colors.textSecondary,
          }}
        >
          {searchTerm ? 'Ningún empleado coincide con la búsqueda.' : 'No hay fichajes en este mes.'}
        </div>
      ) : (
        <div
          className="portal-grid-empleados"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          <AnimatePresence mode="popLayout">
            {empleadosOrdenados.map((empleado, index) => {
              const resumen = resumenPorEmpleado[empleado.id] || {
                horasTotales: '0',
                diasTrabajados: 0,
                trabajandoAhora: false,
                ultimoFichaje: null,
                vacacionesHasta: null,
                diasHastaVacaciones: null,
                diasVacaciones: 0,
              };
              const nombre = empleado.nombreCompleto || empleado.name || 'Empleado';

              return (
                <motion.div
                  key={empleado.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2, delay: index * 0.02 }}
                  onClick={() => setSelectedEmpleado(empleado)}
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                    transition: 'border-color 0.2s, box-shadow 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = colors.primary;
                    e.currentTarget.style.boxShadow = `0 4px 12px ${colors.primary}22`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = colors.border;
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                        <div style={{ fontWeight: 600, fontSize: 16, color: colors.text }}>
                          {nombre}
                        </div>
                      </div>
                    </div>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
                    <div
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                        padding: 10,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>
                        Horas mes
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
                        {formatearHorasDecimal(Number(resumen.horasTotales))}
                      </div>
                    </div>
                    <div
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: 8,
                        padding: 10,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontSize: 11, color: colors.textSecondary, fontWeight: 500 }}>
                        Días
                      </div>
                      <div style={{ fontSize: 18, fontWeight: 700, color: colors.text }}>
                        {resumen.diasTrabajados}
                      </div>
                    </div>
                  </div>

                  {resumen.trabajandoAhora && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '8px 12px',
                        backgroundColor: colors.warning + '18',
                        borderRadius: 8,
                        fontSize: 13,
                        fontWeight: 600,
                        color: colors.warning,
                      }}
                    >
                      <Coffee size={16} />
                      Trabajando ahora
                    </div>
                  )}

                  {resumen.ultimoFichaje && !resumen.trabajandoAhora && (
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Calendar size={14} />
                      Último: {formatDateShortMadrid(resumen.ultimoFichaje.fecha)}
                      {resumen.ultimoFichaje.hora_salida &&
                        ` · ${formatTimeMadrid(resumen.ultimoFichaje.hora_salida)}`}
                    </div>
                  )}
                  {resumen.diasVacacionesRestantes != null && (
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <Umbrella size={14} />
                      {resumen.diasVacacionesRestantes} día
                      {resumen.diasVacacionesRestantes !== 1 ? 's' : ''} de vacaciones restantes (de 22)
                    </div>
                  )}
                  {(resumen.vacacionesHasta != null ||
                    resumen.diasHastaVacaciones != null ||
                    resumen.diasVacaciones > 0) && (
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.info || '#2196F3',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <Umbrella size={14} />
                      {resumen.estaEnVacaciones && resumen.vacacionesHasta ? (
                        <>Vacaciones hasta {formatDateShortMadrid(resumen.vacacionesHasta)}</>
                      ) : resumen.diasHastaVacaciones != null ? (
                        <>
                          Quedan {resumen.diasHastaVacaciones} día
                          {resumen.diasHastaVacaciones !== 1 ? 's' : ''} para vacaciones
                        </>
                      ) : resumen.diasVacaciones > 0 ? (
                        <>
                          Vacaciones: {resumen.diasVacaciones} día
                          {resumen.diasVacaciones !== 1 ? 's' : ''} este mes
                          {resumen.vacacionesDelMes?.length <= 5 &&
                            resumen.vacacionesDelMes?.length > 0 && (
                              <span style={{ color: colors.textSecondary }}>
                                ({resumen.vacacionesDelMes.map((d) => formatDateShortMadrid(d)).join(', ')})
                              </span>
                            )}
                        </>
                      ) : null}
                    </div>
                  )}
                  {resumen.estaDeBaja && resumen.bajaHasta && (
                    <div
                      style={{
                        fontSize: 12,
                        color: colors.warning || '#ed6c02',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        marginTop: 4,
                      }}
                    >
                      <AlertCircle size={14} />
                      De baja hasta {formatDateShortMadrid(resumen.bajaHasta)}
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
