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
} from 'lucide-react';
import ExcelJS from 'exceljs';
import { startOfMonth, endOfMonth, format } from 'date-fns';
import { es } from 'date-fns/locale';
import * as fichajePortalService from '../services/fichajePortalService';
import { formatTimeMadrid, formatDateShortMadrid } from '../utils/timeUtils';
import { colors } from '../theme';
import FichajeEmpleadoPerfilView from './FichajeEmpleadoPerfilView';

export default function PanelFichajesPage() {
  const [empleados, setEmpleados] = useState([]);
  const [fichajesMes, setFichajesMes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);

  const mesActual = useMemo(() => new Date(), []);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const start = startOfMonth(mesActual);
        const end = endOfMonth(mesActual);
        const res = await fichajePortalService.obtenerTodosFichajes({
          fechaInicio: start,
          fechaFin: end,
        });
        const data = res.success ? res.data || [] : [];
        setFichajesMes(data);
        const emps = await fichajePortalService.obtenerEmpleadosConFichajes(data);
        setEmpleados(emps);
      } catch (err) {
        console.error(err);
        setFichajesMes([]);
        setEmpleados([]);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [mesActual]);

  const resumenPorEmpleado = useMemo(() => {
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
      map[emp.id] = {
        horasTotales: horasTotales.toFixed(2),
        diasTrabajados: completos.length,
        trabajandoAhora,
        ultimoFichaje,
        totalFichajes: fichajesEmp.length,
      };
    });
    return map;
  }, [empleados, fichajesMes]);

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
    const mesLabel = format(mesActual, 'MMMM-yyyy', { locale: es });
    const wb = new ExcelJS.Workbook();

    // Hoja Empleados: títulos en mayúsculas y negrita
    const wsEmpleados = wb.addWorksheet('Empleados');
    const headersEmpleados = ['EMPLEADO', 'HORAS MES', 'DÍAS TRABAJADOS'];
    wsEmpleados.addRow(headersEmpleados);
    wsEmpleados.getRow(1).eachCell((c) => {
      c.font = { bold: true };
    });
    empleadosOrdenados.forEach((emp) => {
      const resumen = resumenPorEmpleado[emp.id] || {};
      const nombre = emp.nombreCompleto || emp.name || 'Sin nombre';
      wsEmpleados.addRow([nombre, resumen.horasTotales ?? '0', resumen.diasTrabajados ?? 0]);
    });

    // Hoja Detalle: títulos en mayúsculas y negrita
    const wsDetalle = wb.addWorksheet('Detalle');
    const headersDetalle = ['EMPLEADO', 'FECHA', 'HORA ENTRADA', 'HORA SALIDA', 'HORAS TRABAJADAS'];
    wsDetalle.addRow(headersDetalle);
    wsDetalle.getRow(1).eachCell((c) => {
      c.font = { bold: true };
    });
    fichajesMes
      .filter((f) => f.hora_salida)
      .forEach((f) => {
        const emp = empleados.find((e) => e.id === f.empleado_id);
        const nombre = emp?.nombreCompleto || emp?.name || f.empleado_id || '';
        wsDetalle.addRow([
          nombre,
          f.fecha,
          f.hora_entrada ? formatTimeMadrid(f.hora_entrada) : '',
          f.hora_salida ? formatTimeMadrid(f.hora_salida) : '',
          f.horas_trabajadas != null ? Number(f.horas_trabajadas).toFixed(2) : '',
        ]);
      });

    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Informe-Fichajes-${mesLabel}.xlsx`;
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
                        {resumen.horasTotales}h
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
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}
