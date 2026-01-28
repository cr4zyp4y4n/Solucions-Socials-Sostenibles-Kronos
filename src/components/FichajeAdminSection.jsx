import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Search, 
  Filter, 
  Download, 
  Calendar,
  Edit2,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  User,
  Calendar as CalendarIcon,
  FileDown
} from 'lucide-react';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import fichajeService from '../services/fichajeService';
import { formatTimeMadrid, formatDateShortMadrid } from '../utils/timeUtils';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import FichajeDetailsModal from './FichajeDetailsModal';
import FichajeEditModal from './FichajeEditModal';

const FichajeAdminSection = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  // Estados
  const [fichajes, setFichajes] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [pausasActivas, setPausasActivas] = useState({}); // { fichajeId: pausaActiva }
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Ref para almacenar fichajes actuales sin causar re-renders
  const fichajesRef = useRef([]);
  
  // Filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterEmpleado, setFilterEmpleado] = useState('all');
  const [fechaInicio, setFechaInicio] = useState(() => {
    const date = new Date();
    date.setDate(1); // Primer día del mes
    return date.toISOString().split('T')[0];
  });
  const [fechaFin, setFechaFin] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // Estados para modales
  const [selectedFichaje, setSelectedFichaje] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Cargar empleados
  useEffect(() => {
    const loadEmpleados = async () => {
      try {
        // Cargar empleados de ambas empresas
        const [empleadosSolucions, empleadosMenjar] = await Promise.all([
          holdedEmployeesService.getEmployeesTransformed('solucions').catch(() => []),
          holdedEmployeesService.getEmployeesTransformed('menjar').catch(() => [])
        ]);
        
        // Combinar ambas listas
        const todosEmpleados = [
          ...(empleadosSolucions || []),
          ...(empleadosMenjar || [])
        ];
        
        setEmpleados(todosEmpleados);
      } catch (err) {
        console.error('Error cargando empleados:', err);
      }
    };
    loadEmpleados();
  }, []);

  // Cargar fichajes
  const loadFichajes = async () => {
    setLoading(true);
    setError('');
    try {
      // PRIMERO: Verificar y cerrar fichajes olvidados de todos los empleados
      // Esto asegura que cuando el admin vea los fichajes, los olvidados ya estén cerrados
      try {
        await fichajeService.verificarYcerrarFichajesOlvidadosTodos();
      } catch (err) {
        console.warn('Error verificando fichajes olvidados (no crítico):', err);
        // No fallar si hay error, solo continuar
      }

      const filtros = {
        fechaInicio: new Date(fechaInicio),
        fechaFin: new Date(fechaFin)
      };
      
      if (filterEmpleado !== 'all') {
        filtros.empleadoId = filterEmpleado;
      }

      const resultado = await fichajeSupabaseService.obtenerTodosFichajes(filtros);
      
      if (!resultado.success) {
        throw new Error(resultado.error);
      }

      const fichajesData = resultado.data || [];
      setFichajes(fichajesData);
      fichajesRef.current = fichajesData; // Actualizar ref

      // Cargar pausas activas para cada fichaje
      const pausasActivasMap = {};
      for (const fichaje of fichajesData) {
        // Solo verificar pausas activas para fichajes sin salida (en curso)
        if (!fichaje.hora_salida) {
          try {
            const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
            if (pausaActiva) {
              pausasActivasMap[fichaje.id] = pausaActiva;
            }
          } catch (err) {
            console.error(`Error obteniendo pausa activa para fichaje ${fichaje.id}:`, err);
          }
        }
      }
      setPausasActivas(pausasActivasMap);
    } catch (err) {
      setError(err.message || 'Error al cargar los fichajes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFichajes();
  }, [fechaInicio, fechaFin, filterEmpleado]);

  // Actualizar pausas activas cada 30 segundos para fichajes en curso (separado para evitar bucles)
  useEffect(() => {
    // Función para actualizar pausas activas usando la ref
    const actualizarPausas = async () => {
      const fichajesActuales = fichajesRef.current;
      if (!fichajesActuales || fichajesActuales.length === 0) return;
      
      const fichajesEnCurso = fichajesActuales.filter(f => !f.hora_salida);
      if (fichajesEnCurso.length === 0) {
        setPausasActivas({});
        return;
      }
      
      const pausasActivasMap = {};
      for (const fichaje of fichajesEnCurso) {
        try {
          const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
          if (pausaActiva) {
            pausasActivasMap[fichaje.id] = pausaActiva;
          }
        } catch (err) {
          console.error(`Error obteniendo pausa activa para fichaje ${fichaje.id}:`, err);
        }
      }
      
      // Solo actualizar si hay cambios
      setPausasActivas(prev => {
        const prevKeys = Object.keys(prev).sort();
        const newKeys = Object.keys(pausasActivasMap).sort();
        if (prevKeys.length !== newKeys.length) return pausasActivasMap;
        
        const hasChanges = prevKeys.some(id => prev[id]?.id !== pausasActivasMap[id]?.id);
        return hasChanges ? pausasActivasMap : prev;
      });
    };
    
    // Actualizar inmediatamente al montar
    actualizarPausas();
    
    // Luego actualizar cada 30 segundos
    const interval = setInterval(actualizarPausas, 30000);
    
    return () => clearInterval(interval);
  }, []); // Sin dependencias para evitar bucles

  // Filtrar fichajes por búsqueda
  const filteredFichajes = useMemo(() => {
    return fichajes.filter(fichaje => {
      const empleado = empleados.find(e => e.id === fichaje.empleado_id);
      const nombreEmpleado = empleado?.nombreCompleto || fichaje.empleado_id;
      
      return nombreEmpleado.toLowerCase().includes(searchTerm.toLowerCase());
    });
  }, [fichajes, searchTerm, empleados]);

  // Formatear fecha
  const formatDate = formatDateShortMadrid;
  const formatTime = formatTimeMadrid;

  // Obtener nombre del empleado
  const getEmpleadoNombre = (empleadoId) => {
    const empleado = empleados.find(e => e.id === empleadoId);
    return empleado?.nombreCompleto || empleadoId;
  };

  // Exportar a PDF
  const exportarPDF = () => {
    try {
      // Crear ventana de impresión
      const printWindow = window.open('', '_blank');
      
      const fechaInicioFormateada = new Date(fechaInicio).toLocaleDateString('es-ES');
      const fechaFinFormateada = new Date(fechaFin).toLocaleDateString('es-ES');
      const fechaExportacion = new Date().toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Generar contenido HTML para el PDF
      const contenidoHTML = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Registro de Fichajes - ${fechaInicioFormateada} a ${fechaFinFormateada}</title>
            <style>
              @page {
                size: A4;
                margin: 1cm;
              }
              body {
                font-family: Arial, sans-serif;
                font-size: 11px;
                margin: 0;
                padding: 20px;
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 15px;
              }
              .header h1 {
                margin: 0;
                font-size: 20px;
                color: #333;
              }
              .header p {
                margin: 5px 0;
                color: #666;
              }
              table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
              }
              th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
              }
              th {
                background-color: #f5f5f5;
                font-weight: bold;
                text-align: center;
              }
              tr:nth-child(even) {
                background-color: #f9f9f9;
              }
              .footer {
                margin-top: 30px;
                padding-top: 15px;
                border-top: 1px solid #ddd;
                font-size: 10px;
                color: #666;
                text-align: center;
              }
              .summary {
                margin-top: 20px;
                padding: 15px;
                background-color: #f5f5f5;
                border-radius: 5px;
              }
              .summary h3 {
                margin-top: 0;
                font-size: 14px;
              }
              .summary-item {
                display: inline-block;
                margin-right: 20px;
                font-size: 12px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Registro de Fichajes</h1>
              <p><strong>Período:</strong> ${fechaInicioFormateada} a ${fechaFinFormateada}</p>
              <p><strong>Fecha de exportación:</strong> ${fechaExportacion}</p>
              ${filterEmpleado !== 'all' ? `<p><strong>Empleado:</strong> ${getEmpleadoNombre(filterEmpleado)}</p>` : ''}
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Empleado</th>
                  <th>Entrada</th>
                  <th>Salida</th>
                  <th>Horas Trabajadas</th>
                  <th>Horas Totales</th>
                  <th>Modificado</th>
                  <th>Validado</th>
                </tr>
              </thead>
              <tbody>
                ${filteredFichajes.map(fichaje => `
                  <tr>
                    <td>${formatDate(fichaje.fecha)}</td>
                    <td>${getEmpleadoNombre(fichaje.empleado_id)}</td>
                    <td>${formatTime(fichaje.hora_entrada)}</td>
                    <td>${fichaje.hora_salida ? formatTime(fichaje.hora_salida) : '-'}</td>
                    <td style="text-align: center;">${fichaje.horas_trabajadas || 0}h</td>
                    <td style="text-align: center;">${fichaje.horas_totales || 0}h</td>
                    <td style="text-align: center;">${fichaje.es_modificado ? 'Sí' : 'No'}</td>
                    <td style="text-align: center;">${fichaje.validado_por_trabajador ? 'Sí' : 'No'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <div class="summary">
              <h3>Resumen</h3>
              <div class="summary-item"><strong>Total fichajes:</strong> ${filteredFichajes.length}</div>
              <div class="summary-item"><strong>Fichajes completos:</strong> ${filteredFichajes.filter(f => f.hora_salida).length}</div>
              <div class="summary-item"><strong>Fichajes modificados:</strong> ${filteredFichajes.filter(f => f.es_modificado).length}</div>
              <div class="summary-item"><strong>Total horas trabajadas:</strong> ${filteredFichajes.reduce((sum, f) => sum + (f.horas_trabajadas || 0), 0).toFixed(2)}h</div>
            </div>
            
            <div class="footer">
              <p>Documento generado el ${fechaExportacion} - Sistema de Fichaje SSS Kronos</p>
              <p>Este documento cumple con la normativa laboral española sobre registro de jornada</p>
            </div>
          </body>
        </html>
      `;

      printWindow.document.write(contenidoHTML);
      printWindow.document.close();
      
      // Esperar a que cargue y luego imprimir
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.print();
        }, 250);
      };

      setSuccess('PDF generado correctamente. Usa la opción "Guardar como PDF" en el diálogo de impresión.');
      setTimeout(() => setSuccess(''), 5000);
    } catch (err) {
      setError('Error al exportar PDF: ' + err.message);
    }
  };

  // Exportar a CSV
  const exportarCSV = () => {
    try {
      const headers = [
        'Fecha',
        'Empleado',
        'Hora Entrada',
        'Hora Salida',
        'Horas Trabajadas',
        'Horas Totales',
        'Pausas',
        'Modificado',
        'Validado'
      ];

      const rows = filteredFichajes.map(fichaje => [
        formatDate(fichaje.fecha),
        getEmpleadoNombre(fichaje.empleado_id),
        formatTime(fichaje.hora_entrada),
        formatTime(fichaje.hora_salida),
        fichaje.horas_trabajadas || 0,
        fichaje.horas_totales || 0,
        fichaje.num_pausas || 0,
        fichaje.es_modificado ? 'Sí' : 'No',
        fichaje.validado_por_trabajador ? 'Sí' : 'No'
      ]);

      const csvContent = [
        headers.join(';'),
        ...rows.map(row => row.join(';'))
      ].join('\n');

      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `fichajes_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccess('CSV exportado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError('Error al exportar CSV: ' + err.message);
    }
  };

  return (
    <div>
      {/* Header con acciones */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: '700', 
            color: colors.text,
            margin: 0,
            marginBottom: '8px'
          }}>
            Gestión de Fichajes
          </h2>
          <p style={{ 
            fontSize: '14px', 
            color: colors.textSecondary,
            margin: 0
          }}>
            Administra y exporta los registros de fichaje de todos los empleados
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={exportarCSV}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Download size={18} />
            Exportar CSV
          </button>
          <button
            onClick={exportarPDF}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.warning,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <FileDown size={18} />
            Exportar PDF
          </button>
        </div>
      </div>

      {/* Mensajes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.error + '15',
              border: `2px solid ${colors.error}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertCircle size={20} color={colors.error} />
            <span style={{ color: colors.error, fontSize: '14px', fontWeight: '500' }}>{error}</span>
            <button 
              onClick={() => setError('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.error
              }}
            >
              <XCircle size={18} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.success + '15',
              border: `2px solid ${colors.success}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle size={20} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '14px', fontWeight: '500' }}>{success}</span>
            <button 
              onClick={() => setSuccess('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.success
              }}
            >
              <XCircle size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros */}
      <div style={{
        backgroundColor: colors.surface,
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '24px',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {/* Búsqueda */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Buscar
            </label>
            <div style={{ position: 'relative' }}>
              <Search 
                size={18} 
                color={colors.textSecondary} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)' 
                }} 
              />
              <input
                type="text"
                placeholder="Buscar por empleado..."
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

          {/* Filtro por empleado */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Empleado
            </label>
            <select
              value={filterEmpleado}
              onChange={(e) => setFilterEmpleado(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                color: colors.text,
                backgroundColor: colors.background,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">Todos los empleados</option>
              {empleados.map(emp => (
                <option key={emp.id} value={emp.id}>{emp.nombreCompleto}</option>
              ))}
            </select>
          </div>

          {/* Fecha inicio */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Fecha Inicio
            </label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
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

          {/* Fecha fin */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Fecha Fin
            </label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
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

        <div style={{ 
          marginTop: '12px', 
          fontSize: '13px', 
          color: colors.textSecondary 
        }}>
          Mostrando {filteredFichajes.length} de {fichajes.length} fichajes
        </div>
      </div>

      {/* Tabla de fichajes */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: `4px solid ${colors.border}`,
              borderTop: `4px solid ${colors.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: colors.textSecondary }}>Cargando fichajes...</p>
          </div>
        ) : filteredFichajes.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Clock size={48} color={colors.border} style={{ marginBottom: '16px' }} />
            <p style={{ color: colors.textSecondary }}>No se encontraron fichajes</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: colors.background, borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    FECHA
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    EMPLEADO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ENTRADA
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    SALIDA
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    HORAS
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ESTADO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredFichajes.map((fichaje, index) => (
                  <motion.tr
                    key={fichaje.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      borderBottom: `1px solid ${colors.border}`
                    }}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <CalendarIcon size={14} color={colors.textSecondary} />
                        <span style={{ color: colors.text, fontSize: '14px' }}>
                          {formatDate(fichaje.fecha)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <User size={14} color={colors.textSecondary} />
                        <span style={{ color: colors.text, fontSize: '14px' }}>
                          {getEmpleadoNombre(fichaje.empleado_id)}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ color: colors.text, fontSize: '14px' }}>
                        {formatTime(fichaje.hora_entrada)}
                      </span>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <span style={{ color: colors.text, fontSize: '14px' }}>
                        {fichaje.hora_salida ? formatTime(fichaje.hora_salida) : '-'}
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <span style={{ color: colors.text, fontSize: '14px', fontWeight: '600' }}>
                        {fichaje.horas_trabajadas || 0}h
                      </span>
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center' }}>
                        {fichaje.hora_salida ? (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            backgroundColor: colors.success + '15',
                            borderRadius: '6px'
                          }}>
                            <CheckCircle size={14} color={colors.success} />
                            <span style={{ color: colors.success, fontSize: '12px', fontWeight: '600' }}>
                              Completado
                            </span>
                          </div>
                        ) : (
                          <>
                            <div style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 12px',
                              backgroundColor: colors.info + '15',
                              borderRadius: '6px'
                            }}>
                              <Clock size={14} color={colors.info} />
                              <span style={{ color: colors.info, fontSize: '12px', fontWeight: '600' }}>
                                En curso
                              </span>
                            </div>
                            {pausasActivas[fichaje.id] ? (() => {
                              const pausa = pausasActivas[fichaje.id];
                              const inicioPausa = pausa.inicio ? new Date(pausa.inicio) : null;
                              const ahora = new Date();
                              let tiempoDescanso = '';
                              
                              if (inicioPausa) {
                                const minutosTranscurridos = Math.floor((ahora - inicioPausa) / (1000 * 60));
                                const horasTranscurridas = Math.floor(minutosTranscurridos / 60);
                                
                                if (horasTranscurridas > 0) {
                                  const minutosRestantes = minutosTranscurridos % 60;
                                  tiempoDescanso = horasTranscurridas === 1 
                                    ? `1 hora${minutosRestantes > 0 ? ` y ${minutosRestantes} min` : ''}`
                                    : `${horasTranscurridas} horas${minutosRestantes > 0 ? ` y ${minutosRestantes} min` : ''}`;
                                } else {
                                  tiempoDescanso = minutosTranscurridos === 1 
                                    ? '1 minuto' 
                                    : `${minutosTranscurridos} minutos`;
                                }
                                
                                const horaInicio = inicioPausa.toLocaleTimeString('es-ES', { 
                                  hour: '2-digit', 
                                  minute: '2-digit' 
                                });
                                tiempoDescanso = `Desde las ${horaInicio} (hace ${tiempoDescanso})`;
                              }
                              
                              return (
                                <div 
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    padding: '4px 10px',
                                    backgroundColor: colors.warning + '15',
                                    borderRadius: '6px',
                                    fontSize: '11px',
                                    cursor: 'help'
                                  }}
                                  title={tiempoDescanso || 'En descanso'}
                                >
                                  <Clock size={12} color={colors.warning} />
                                  <span style={{ color: colors.warning, fontWeight: '600' }}>
                                    En Descanso
                                  </span>
                                </div>
                              );
                            })() : (
                              <div style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                backgroundColor: colors.success + '15',
                                borderRadius: '6px',
                                fontSize: '11px'
                              }}>
                                <CheckCircle size={12} color={colors.success} />
                                <span style={{ color: colors.success, fontWeight: '600' }}>
                                  Trabajando
                                </span>
                              </div>
                            )}
                          </>
                        )}
                        {fichaje.es_modificado && (
                          <div style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            backgroundColor: colors.warning + '15',
                            borderRadius: '6px',
                            fontSize: '11px',
                            marginTop: '4px'
                          }}>
                            <AlertCircle size={12} color={colors.warning} />
                            <span style={{ color: colors.warning, fontWeight: '600' }}>
                              Modificado
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => {
                            setSelectedFichaje(fichaje);
                            setShowDetailsModal(true);
                          }}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: colors.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Ver detalles"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedFichaje(fichaje);
                            setShowEditModal(true);
                          }}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: colors.warning,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          title="Editar fichaje"
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CSS para animación de carga */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>

      {/* Modales */}
      {showDetailsModal && selectedFichaje && (
        <FichajeDetailsModal
          fichaje={selectedFichaje}
          empleadoNombre={getEmpleadoNombre(selectedFichaje.empleado_id)}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedFichaje(null);
          }}
        />
      )}

      {showEditModal && selectedFichaje && (
        <FichajeEditModal
          fichaje={selectedFichaje}
          empleadoNombre={getEmpleadoNombre(selectedFichaje.empleado_id)}
          onClose={() => {
            setShowEditModal(false);
            setSelectedFichaje(null);
          }}
          onSave={() => {
            loadFichajes();
            setShowEditModal(false);
            setSelectedFichaje(null);
            setSuccess('Fichaje modificado correctamente. El trabajador será notificado.');
            setTimeout(() => setSuccess(''), 5000);
          }}
        />
      )}
    </div>
  );
};

export default FichajeAdminSection;

