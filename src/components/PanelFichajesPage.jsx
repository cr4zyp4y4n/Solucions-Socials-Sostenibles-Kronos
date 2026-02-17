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
  Users,
  ChevronRight,
  ArrowLeft,
  Umbrella
} from 'lucide-react';
import { startOfMonth, endOfMonth, format, addMonths, parseISO, differenceInCalendarDays, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { formatTimeMadrid, formatDateShortMadrid } from '../utils/timeUtils';
import { useTheme } from './ThemeContext';
import FichajeEmpleadoPerfil from './FichajeEmpleadoPerfil';

const PanelFichajesPage = () => {
  const { colors } = useTheme();
  const [empleados, setEmpleados] = useState([]);
  const [fichajesMes, setFichajesMes] = useState([]);
  const [vacacionesMes, setVacacionesMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);

  // Mes para el que calculamos resúmenes (mes actual)
  const mesActual = useMemo(() => new Date(), []);

  // Cargar empleados
  useEffect(() => {
    const loadEmpleados = async () => {
      try {
        const [solucions, menjar] = await Promise.all([
          holdedEmployeesService.getEmployeesTransformed('solucions').catch(() => []),
          holdedEmployeesService.getEmployeesTransformed('menjar').catch(() => [])
        ]);
        const todos = [...(solucions || []), ...(menjar || [])];
        setEmpleados(todos);
      } catch (err) {
        console.error('Error cargando empleados:', err);
        setEmpleados([]);
      }
    };
    loadEmpleados();
  }, []);

  // Cargar todos los fichajes del mes actual
  useEffect(() => {
    const loadFichajes = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(mesActual);
        const end = endOfMonth(mesActual);
        const res = await fichajeSupabaseService.obtenerTodosFichajes({
          fechaInicio: start,
          fechaFin: end
        });
        setFichajesMes(res.success ? res.data || [] : []);
      } catch (err) {
        console.error('Error cargando fichajes:', err);
        setFichajesMes([]);
      } finally {
        setLoading(false);
      }
    };
    loadFichajes();
  }, [mesActual]);

  // Cargar vacaciones: mes actual + 2 meses para "hasta cuándo" y "días hasta vacaciones"
  useEffect(() => {
    const start = startOfMonth(mesActual);
    const end = endOfMonth(addMonths(mesActual, 2));
    fichajeSupabaseService.obtenerVacacionesEnRango(start, end).then((res) => {
      setVacacionesMes(res.success ? res.data || [] : []);
    });
  }, [mesActual]);

  // Resumen por empleado: horas mes, días trabajados, trabajando ahora, último fichaje, vacaciones (hasta cuándo / días hasta)
  const resumenPorEmpleado = useMemo(() => {
    const todayStr = format(mesActual, 'yyyy-MM-dd');
    const map = {};
    empleados.forEach((emp) => {
      const fichajesEmp = fichajesMes.filter((f) => f.empleado_id === emp.id);
      const completos = fichajesEmp.filter((f) => f.hora_salida);
      const horasTotales = completos.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0);
      const trabajandoAhora = fichajesEmp.some((f) => !f.hora_salida);
      const ultimoFichaje = fichajesEmp.length > 0
        ? fichajesEmp.sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
        : null;
      const vacacionesEmp = vacacionesMes.filter((v) => v.empleado_id === emp.id);
      const fechasVacaciones = vacacionesEmp.map((v) => v.fecha).sort();
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
      const fechasDelMesActual = fechasVacaciones.filter(
        (d) => d.startsWith(format(mesActual, 'yyyy-MM'))
      );
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
        estaEnVacaciones
      };
    });
    return map;
  }, [empleados, fichajesMes, vacacionesMes, mesActual]);

  // Empleados filtrados por búsqueda
  const empleadosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return empleados;
    const term = searchTerm.toLowerCase();
    return empleados.filter(
      (e) =>
        (e.nombreCompleto || e.name || '').toLowerCase().includes(term) ||
        (e.email || '').toLowerCase().includes(term)
    );
  }, [empleados, searchTerm]);

  // Ordenar: primero quienes están trabajando ahora
  const empleadosOrdenados = useMemo(() => {
    return [...empleadosFiltrados].sort((a, b) => {
      const aTrabajando = resumenPorEmpleado[a.id]?.trabajandoAhora ?? false;
      const bTrabajando = resumenPorEmpleado[b.id]?.trabajandoAhora ?? false;
      if (aTrabajando && !bTrabajando) return -1;
      if (!aTrabajando && bTrabajando) return 1;
      return 0;
    });
  }, [empleadosFiltrados, resumenPorEmpleado]);

  const handleVerPerfil = (empleado) => {
    setSelectedEmpleado(empleado);
  };

  const handleVolver = () => {
    setSelectedEmpleado(null);
    const start = startOfMonth(mesActual);
    const end = endOfMonth(mesActual);
    const endVacaciones = endOfMonth(addMonths(mesActual, 2));
    fichajeSupabaseService.obtenerTodosFichajes({ fechaInicio: start, fechaFin: end }).then((res) => {
      if (res.success && res.data) setFichajesMes(res.data);
    });
    fichajeSupabaseService.obtenerVacacionesEnRango(start, endVacaciones).then((res) => {
      if (res.success && res.data) setVacacionesMes(res.data);
    });
  };

  // Vista: perfil de un empleado
  if (selectedEmpleado) {
    return (
      <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
        <FichajeEmpleadoPerfil empleado={selectedEmpleado} onBack={handleVolver} />
      </div>
    );
  }

  // Vista: listado de empleados con resumen
  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{ marginBottom: '28px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Clock size={32} color={colors.primary} />
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: colors.text, margin: 0 }}>
            Panel de Fichajes
          </h1>
        </div>
        <p style={{ fontSize: '15px', color: colors.textSecondary, margin: 0 }}>
          Resumen por empleado del mes de {format(mesActual, 'MMMM yyyy', { locale: es })}. Haz clic en un empleado para ver su perfil con calendario y registros.
        </p>
      </motion.div>

      {/* Búsqueda */}
      <div style={{ marginBottom: '24px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <Search
            size={18}
            color={colors.textSecondary}
            style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none'
            }}
          />
          <input
            type="text"
            placeholder="Buscar por nombre o email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 40px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: colors.text,
              backgroundColor: colors.background,
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: colors.textSecondary }}>
          Cargando empleados y fichajes...
        </div>
      ) : empleadosOrdenados.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            backgroundColor: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            color: colors.textSecondary
          }}
        >
          {searchTerm ? 'Ningún empleado coincide con la búsqueda.' : 'No hay empleados cargados.'}
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '16px'
          }}
        >
          <AnimatePresence mode="popLayout">
            {empleadosOrdenados.map((empleado, index) => {
              const resumen = resumenPorEmpleado[empleado.id] || {
                horasTotales: '0',
                diasTrabajados: 0,
                trabajandoAhora: false,
                ultimoFichaje: null
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
                  onClick={() => handleVerPerfil(empleado)}
                  style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    transition: 'border-color 0.2s, box-shadow 0.2s'
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
                        <div style={{ fontWeight: '600', fontSize: '16px', color: colors.text }}>
                          {nombre}
                        </div>
                        {empleado.email && (
                          <div style={{ fontSize: '13px', color: colors.textSecondary }}>
                            {empleado.email}
                          </div>
                        )}
                      </div>
                    </div>
                    <ChevronRight size={20} color={colors.textSecondary} />
                  </div>

                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '8px',
                      marginTop: '4px'
                    }}
                  >
                    <div
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>
                        Horas mes
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: colors.text }}>
                        {resumen.horasTotales}h
                      </div>
                    </div>
                    <div
                      style={{
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        padding: '10px',
                        textAlign: 'center'
                      }}
                    >
                      <div style={{ fontSize: '11px', color: colors.textSecondary, fontWeight: '500' }}>
                        Días
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '700', color: colors.text }}>
                        {resumen.diasTrabajados}
                      </div>
                    </div>
                  </div>

                  {resumen.trabajandoAhora && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: colors.warning + '18',
                        borderRadius: '8px',
                        fontSize: '13px',
                        fontWeight: '600',
                        color: colors.warning
                      }}
                    >
                      <Coffee size={16} />
                      Trabajando ahora
                    </div>
                  )}

                  {resumen.ultimoFichaje && !resumen.trabajandoAhora && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Calendar size={14} />
                      Último: {formatDateShortMadrid(resumen.ultimoFichaje.fecha)}
                      {resumen.ultimoFichaje.hora_salida && ` · ${formatTimeMadrid(resumen.ultimoFichaje.hora_salida)}`}
                    </div>
                  )}
                  {(resumen.vacacionesHasta != null || resumen.diasHastaVacaciones != null || resumen.diasVacaciones > 0) && (
                    <div
                      style={{
                        fontSize: '12px',
                        color: colors.info || '#2196F3',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        marginTop: '4px'
                      }}
                    >
                      <Umbrella size={14} />
                      {resumen.estaEnVacaciones && resumen.vacacionesHasta ? (
                        <>Vacaciones hasta {formatDateShortMadrid(resumen.vacacionesHasta)}</>
                      ) : resumen.diasHastaVacaciones != null ? (
                        <>Quedan {resumen.diasHastaVacaciones} día{resumen.diasHastaVacaciones !== 1 ? 's' : ''} para vacaciones</>
                      ) : resumen.diasVacaciones > 0 ? (
                        <>
                          Vacaciones: {resumen.diasVacaciones} día{resumen.diasVacaciones !== 1 ? 's' : ''} este mes
                          {resumen.vacacionesDelMes?.length <= 5 && resumen.vacacionesDelMes?.length > 0 && (
                            <span style={{ color: colors.textSecondary }}>
                              ({resumen.vacacionesDelMes.map((d) => formatDateShortMadrid(d)).join(', ')})
                            </span>
                          )}
                        </>
                      ) : null}
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
};

export default PanelFichajesPage;
