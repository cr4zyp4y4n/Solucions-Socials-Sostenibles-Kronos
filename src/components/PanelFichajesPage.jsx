import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AnimatePresence } from 'framer-motion';
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search
} from 'lucide-react';
import {
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
  addMonths,
  parseISO,
  differenceInCalendarDays,
  addDays
} from 'date-fns';
import { es } from 'date-fns/locale';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { useTheme } from './ThemeContext';
import SectionHeader from './SectionHeader';
import FichajeEmpleadoPerfil from './FichajeEmpleadoPerfil';
import PanelEmpleadoCard from './panelFichajes/PanelEmpleadoCard';
import {
  computePanelStats,
  filterEmpleadosPanel,
  sortEmpleadosPanel
} from './panelFichajes/panelFichajesHelpers';
import { KronosButton, KronosCard, KronosChip, KronosInput } from './kronos';

const FILTERS = [
  { id: 'todos', label: 'Todos' },
  { id: 'trabajando', label: 'Trabajando' },
  { id: 'vacaciones', label: 'Vacaciones' },
  { id: 'baja', label: 'De baja' },
  { id: 'activos', label: 'Activos' }
];

function buildResumenPorEmpleado(empleados, fichajesMes, vacacionesMes, bajasMes, mesReferencia) {
  const todayStr = format(mesReferencia, 'yyyy-MM-dd');
  const yearStr = format(mesReferencia, 'yyyy');
  const map = {};
  empleados.forEach((emp) => {
    const fichajesEmp = fichajesMes.filter((f) => f.empleado_id === emp.id);
    const completos = fichajesEmp.filter((f) => f.hora_salida);
    const horasTotales = completos.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0);
    const trabajandoAhora = fichajesEmp.some((f) => !f.hora_salida);
    const ultimoFichaje = fichajesEmp.length > 0
      ? [...fichajesEmp].sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0]
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
    const fechasDelMesActual = fechasVacaciones.filter(
      (d) => d.startsWith(format(mesReferencia, 'yyyy-MM'))
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
      bajaHasta
    };
  });
  return map;
}

const PanelFichajesPage = () => {
  const { colors } = useTheme();
  const [mesReferencia, setMesReferencia] = useState(() => new Date());
  const [empleados, setEmpleados] = useState([]);
  const [fichajesMes, setFichajesMes] = useState([]);
  const [vacacionesMes, setVacacionesMes] = useState([]);
  const [bajasMes, setBajasMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('todos');
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);

  const loadEmpleados = useCallback(async () => {
    try {
      const [solucions, menjar] = await Promise.all([
        holdedEmployeesService.getEmployeesTransformed('solucions').catch(() => []),
        holdedEmployeesService.getEmployeesTransformed('menjar').catch(() => [])
      ]);
      setEmpleados([...(solucions || []), ...(menjar || [])]);
    } catch (err) {
      console.error('Error cargando empleados:', err);
      setEmpleados([]);
    }
  }, []);

  const loadDatosMes = useCallback(async () => {
    setLoading(true);
    try {
      const start = startOfMonth(mesReferencia);
      const end = endOfMonth(mesReferencia);
      const endVacaciones = endOfMonth(addMonths(mesReferencia, 2));
      const startVacaciones = startOfYear(mesReferencia);

      const [fichRes, vacRes, bajasRes] = await Promise.all([
        fichajeSupabaseService.obtenerTodosFichajes({ fechaInicio: start, fechaFin: end }),
        fichajeSupabaseService.obtenerVacacionesEnRango(startVacaciones, endVacaciones),
        fichajeSupabaseService.obtenerBajasEnRango(start, endVacaciones)
      ]);

      setFichajesMes(fichRes.success ? fichRes.data || [] : []);
      setVacacionesMes(vacRes.success ? vacRes.data || [] : []);
      setBajasMes(bajasRes.success ? bajasRes.data || [] : []);
    } catch (err) {
      console.error('Error cargando datos del panel:', err);
      setFichajesMes([]);
      setVacacionesMes([]);
      setBajasMes([]);
    } finally {
      setLoading(false);
    }
  }, [mesReferencia]);

  useEffect(() => {
    loadEmpleados();
  }, [loadEmpleados]);

  useEffect(() => {
    loadDatosMes();
  }, [loadDatosMes]);

  const resumenPorEmpleado = useMemo(
    () => buildResumenPorEmpleado(empleados, fichajesMes, vacacionesMes, bajasMes, mesReferencia),
    [empleados, fichajesMes, vacacionesMes, bajasMes, mesReferencia]
  );

  const stats = useMemo(
    () => computePanelStats(empleados, resumenPorEmpleado),
    [empleados, resumenPorEmpleado]
  );

  const empleadosVisibles = useMemo(() => {
    const filtered = filterEmpleadosPanel(empleados, resumenPorEmpleado, {
      search: searchTerm,
      estadoFilter
    });
    return sortEmpleadosPanel(filtered, resumenPorEmpleado);
  }, [empleados, resumenPorEmpleado, searchTerm, estadoFilter]);

  const mesLabel = format(mesReferencia, 'MMMM yyyy', { locale: es });
  const esMesActual = format(mesReferencia, 'yyyy-MM') === format(new Date(), 'yyyy-MM');

  if (selectedEmpleado) {
    return (
      <div style={{ padding: '20px 24px 32px', maxWidth: 1200, margin: '0 auto', color: colors.text }}>
        <FichajeEmpleadoPerfil
          empleado={selectedEmpleado}
          resumen={resumenPorEmpleado[selectedEmpleado.id]}
          mesInicial={mesReferencia}
          onBack={() => {
            setSelectedEmpleado(null);
            loadDatosMes();
          }}
        />
      </div>
    );
  }

  return (
    <div style={{ padding: '20px 24px 32px', maxWidth: 1100, margin: '0 auto', color: colors.text }}>
      <SectionHeader
        icon={Activity}
        title="Panel fichajes"
        subtitle={mesLabel}
        actions={(
          <KronosButton size="sm" variant="ghost" onClick={loadDatosMes} disabled={loading}>
            <RefreshCw size={15} />
            Actualizar
          </KronosButton>
        )}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: 8,
          marginBottom: 16
        }}
      >
        <KronosButton size="sm" onClick={() => setMesReferencia((m) => addMonths(m, -1))}>
          <ChevronLeft size={16} />
        </KronosButton>
        <span style={{ fontWeight: 700, fontSize: 14, textTransform: 'capitalize', minWidth: 130, textAlign: 'center' }}>
          {mesLabel}
        </span>
        <KronosButton size="sm" onClick={() => setMesReferencia((m) => addMonths(m, 1))}>
          <ChevronRight size={16} />
        </KronosButton>
        {!esMesActual ? (
          <KronosButton size="sm" variant="ghost" onClick={() => setMesReferencia(new Date())}>
            Hoy
          </KronosButton>
        ) : null}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 10,
          marginBottom: 18
        }}
      >
        {[
          { label: 'Empleados', value: stats.total, tone: colors.text },
          { label: 'Trabajando', value: stats.trabajando, tone: colors.warning },
          { label: 'De baja', value: stats.deBaja, tone: colors.error },
          { label: 'Horas mes', value: `${stats.horasMes}h`, tone: colors.primary }
        ].map((s) => (
          <KronosCard key={s.label} style={{ padding: '12px 14px' }}>
            <div style={{ fontSize: 12, color: colors.textSecondary }}>{s.label}</div>
            <div style={{ marginTop: 4, fontSize: 20, fontWeight: 700, color: s.tone }}>{s.value}</div>
          </KronosCard>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 12, marginBottom: 18 }}>
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
          <KronosInput
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nombre o email…"
            style={{ paddingLeft: 38 }}
          />
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {FILTERS.map((f) => (
            <KronosChip
              key={f.id}
              active={estadoFilter === f.id}
              onClick={() => setEstadoFilter(f.id)}
            >
              {f.label}
            </KronosChip>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center', color: colors.textSecondary, fontSize: 14 }}>
          Cargando…
        </div>
      ) : empleadosVisibles.length === 0 ? (
        <KronosCard style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Ningún empleado</div>
          <div style={{ fontSize: 13, color: colors.textSecondary }}>
            {searchTerm || estadoFilter !== 'todos'
              ? 'Prueba otro filtro o búsqueda.'
              : 'No hay empleados cargados desde Holded.'}
          </div>
        </KronosCard>
      ) : (
        <ul
          style={{
            margin: 0,
            padding: 0,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))',
            alignItems: 'stretch',
            gap: 11,
            overflow: 'visible'
          }}
        >
          <AnimatePresence mode="popLayout">
            {empleadosVisibles.map((empleado, index) => (
              <PanelEmpleadoCard
                key={empleado.id}
                empleado={empleado}
                resumen={resumenPorEmpleado[empleado.id] || {}}
                index={index}
                onOpen={setSelectedEmpleado}
              />
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
};

export default PanelFichajesPage;
