import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee,
  Play,
  Pause,
  Calendar,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import fichajeService from '../services/fichajeService';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import FichajeModal from './FichajeModal';
import FichajeNotificacionModal from './FichajeNotificacionModal';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { formatTimeMadrid, formatDateMadrid } from '../utils/timeUtils';

const FichajePage = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  // Estados
  const [empleadoId, setEmpleadoId] = useState(null);
  const [empleados, setEmpleados] = useState([]);
  const [loadingEmpleados, setLoadingEmpleados] = useState(true);
  const [estadoFichaje, setEstadoFichaje] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [fichajePendiente, setFichajePendiente] = useState(null);
  const [showNotificacionModal, setShowNotificacionModal] = useState(false);
  
  // Historial mensual
  const [historial, setHistorial] = useState([]);
  const [resumenMensual, setResumenMensual] = useState(null);

  // Cargar empleados y buscar el del usuario actual
  useEffect(() => {
    const loadEmpleados = async () => {
      setLoadingEmpleados(true);
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
        
        // Intentar encontrar el empleado por email del usuario en la lista combinada
        if (user?.email && todosEmpleados.length > 0) {
          const empleadoEncontrado = todosEmpleados.find(emp => 
            emp.email?.toLowerCase() === user.email?.toLowerCase()
          );
          if (empleadoEncontrado) {
            setEmpleadoId(empleadoEncontrado.id);
          }
        }
      } catch (err) {
        console.error('Error cargando empleados:', err);
      } finally {
        setLoadingEmpleados(false);
      }
    };
    loadEmpleados();
  }, [user]);

  // Cargar estado del fichaje
  const loadEstadoFichaje = async () => {
    if (!empleadoId) return;
    
    setLoading(true);
    try {
      const resultado = await fichajeService.obtenerEstadoFichaje(empleadoId);
      
      if (resultado.success) {
        setEstadoFichaje(resultado.data);
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error al cargar el estado del fichaje:', err);
      setError('Error al cargar el estado del fichaje');
    } finally {
      setLoading(false);
    }
  };

  // Cargar historial mensual
  const loadHistorial = async () => {
    if (!empleadoId) return;
    
    try {
      const hoy = new Date();
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      
      const resultado = await fichajeSupabaseService.obtenerFichajesEmpleado(
        empleadoId,
        primerDia,
        ultimoDia
      );
      
      if (resultado.success) {
        setHistorial(resultado.data || []);
        
        // Calcular resumen
        const resumen = resultado.data.reduce((acc, fichaje) => {
          acc.totalDias++;
          acc.totalHoras += fichaje.horas_trabajadas || 0;
          if (fichaje.hora_salida) acc.diasCompletos++;
          else acc.diasIncompletos++;
          return acc;
        }, { totalDias: 0, totalHoras: 0, diasCompletos: 0, diasIncompletos: 0 });
        
        setResumenMensual(resumen);
      }
    } catch (err) {
      console.error('Error cargando historial:', err);
    }
  };

  // Buscar fichajes pendientes de validar
  const buscarFichajesPendientes = async () => {
    if (!empleadoId) return;
    
    try {
      const hoy = new Date();
      const primerDia = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      const ultimoDia = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
      
      const { data: fichajes } = await fichajeSupabaseService.obtenerFichajesEmpleado(
        empleadoId,
        primerDia,
        ultimoDia
      );
      
      if (fichajes && fichajes.length > 0) {
        // Buscar fichajes modificados que no han sido validados
        const pendiente = fichajes.find(f => 
          f.es_modificado && 
          f.notificado_trabajador && 
          f.validado_por_trabajador === null
        );
        
        if (pendiente) {
          setFichajePendiente(pendiente);
          setShowNotificacionModal(true);
        }
      }
    } catch (err) {
      console.error('Error buscando fichajes pendientes:', err);
    }
  };

  useEffect(() => {
    if (empleadoId) {
      loadEstadoFichaje();
      loadHistorial();
      buscarFichajesPendientes();
      
      // Recargar cada minuto
      const interval = setInterval(() => {
        loadEstadoFichaje();
      }, 60000);
      
      return () => clearInterval(interval);
    }
  }, [empleadoId]);

  // Fichar entrada
  const handleFicharEntrada = async () => {
    if (!empleadoId) {
      setError('Por favor, selecciona tu empleado');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeService.ficharEntrada(empleadoId, user?.id);
      
      if (resultado.success) {
        setSuccess('Entrada registrada correctamente');
        setTimeout(() => setSuccess(''), 3000);
        await loadEstadoFichaje();
        await loadHistorial();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error al registrar la entrada:', err);
      setError('Error al registrar la entrada');
    } finally {
      setLoading(false);
    }
  };

  // Fichar salida
  const handleFicharSalida = async () => {
    if (!empleadoId) {
      setError('Por favor, selecciona tu empleado');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeService.ficharSalida(empleadoId, user?.id);
      if (resultado.success) {
        setSuccess('Salida registrada correctamente');
        setTimeout(() => setSuccess(''), 3000);
        await loadEstadoFichaje();
        await loadHistorial();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError('Error al registrar la salida');
    } finally {
      setLoading(false);
    }
  };

  // Iniciar pausa
  const handleIniciarPausa = async (tipo = 'descanso') => {
    if (!empleadoId) {
      setError('Por favor, selecciona tu empleado');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeService.iniciarPausa(empleadoId, tipo);
      if (resultado.success) {
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(''), 3000);
        await loadEstadoFichaje();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError('Error al iniciar la pausa');
    } finally {
      setLoading(false);
    }
  };

  // Finalizar pausa
  const handleFinalizarPausa = async () => {
    if (!empleadoId) {
      setError('Por favor, selecciona tu empleado');
      return;
    }
    
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeService.finalizarPausa(empleadoId);
      if (resultado.success) {
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(''), 3000);
        await loadEstadoFichaje();
        await loadHistorial();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      setError('Error al finalizar la pausa');
    } finally {
      setLoading(false);
    }
  };

  // Formatear hora (usando zona horaria de Madrid)
  const formatTime = formatTimeMadrid;

  // Formatear fecha (usando zona horaria de Madrid)
  const formatDate = formatDateMadrid;

  // Obtener nombre del empleado seleccionado
  const empleadoSeleccionado = empleados.find(e => e.id === empleadoId);

  return (
    <div style={{ 
      padding: '24px',
      maxWidth: '1200px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        style={{ marginBottom: '32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Clock size={32} color={colors.primary} />
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: colors.text,
            margin: 0
          }}>
            Fichaje
          </h1>
        </div>
        <p style={{ 
          fontSize: '15px', 
          color: colors.textSecondary,
          margin: 0
        }}>
          Registra tu entrada, salida y pausas de trabajo
        </p>
      </motion.div>

      {/* Loading splash mientras se cargan los empleados - Solo la sección de contenido */}
      {loadingEmpleados ? (
        <div style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          height: '400px',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${colors.border}`,
              borderTop: `3px solid ${colors.primary}`,
              borderRadius: '50%'
            }}
          />
          <p style={{ color: colors.textSecondary }}>Cargando empleados...</p>
        </div>
      ) : (
        <>
          {/* Selección de empleado */}
          {!loadingEmpleados && !empleadoId && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
              style={{
                backgroundColor: colors.surface,
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px',
                border: `1px solid ${colors.border}`
              }}
            >
              <label style={{ 
                display: 'block', 
                fontSize: '14px', 
                fontWeight: '600', 
                color: colors.text, 
                marginBottom: '12px' 
              }}>
                Selecciona tu empleado
              </label>
              <select
                value={empleadoId || ''}
                onChange={(e) => setEmpleadoId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background,
                  outline: 'none'
                }}
              >
                <option value="">-- Selecciona un empleado --</option>
                {empleados.map(emp => (
                  <option key={emp.id} value={emp.id}>{emp.nombreCompleto}</option>
                ))}
              </select>
            </motion.div>
          )}

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

          {!loadingEmpleados && empleadoId && (
        <>
          {/* Estado actual del día */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
            style={{
              backgroundColor: colors.surface,
              padding: '24px',
              borderRadius: '12px',
              marginBottom: '24px',
              border: `1px solid ${colors.border}`
            }}
          >
            <h2 style={{ 
              fontSize: '20px', 
              fontWeight: '600', 
              color: colors.text,
              marginBottom: '20px'
            }}>
              Hoy - {new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <RefreshCw size={24} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : estadoFichaje?.tieneFichaje ? (
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* Información del fichaje */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '20px'
                }}>
                  <div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Entrada
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                      {formatTime(estadoFichaje.fichaje.hora_entrada)}
                    </div>
                  </div>
                  {estadoFichaje.fichaje.hora_salida && (
                    <div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                        Salida
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                        {formatTime(estadoFichaje.fichaje.hora_salida)}
                      </div>
                    </div>
                  )}
                  {estadoFichaje.fichaje.horas_trabajadas > 0 && (
                    <div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                        Horas trabajadas
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: '600', color: colors.primary }}>
                        {fichajeService.formatearHoras(estadoFichaje.fichaje.horas_trabajadas)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pausa activa */}
                {estadoFichaje.pausaActiva && (
                  <div style={{
                    padding: '16px',
                    backgroundColor: colors.warning + '15',
                    border: `2px solid ${colors.warning}`,
                    borderRadius: '8px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                      <Pause size={20} color={colors.warning} />
                      <span style={{ fontWeight: '600', color: colors.warning }}>
                        Pausa activa desde {formatTime(estadoFichaje.pausaActiva.inicio)}
                      </span>
                    </div>
                    <button
                      onClick={handleFinalizarPausa}
                      disabled={loading}
                      style={{
                        padding: '10px 20px',
                        backgroundColor: colors.warning,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      Finalizar Pausa
                    </button>
                  </div>
                )}

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  {estadoFichaje.puedeFicharSalida && (
                    <button
                      onClick={handleFicharSalida}
                      disabled={loading}
                      style={{
                        flex: 1,
                        minWidth: '200px',
                        padding: '16px 24px',
                        backgroundColor: colors.error,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '16px',
                        fontWeight: '600',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        opacity: loading ? 0.6 : 1
                      }}
                    >
                      <LogOut size={20} />
                      Fichar Salida
                    </button>
                  )}

                  {estadoFichaje.puedeIniciarPausa && (
                    <>
                      <button
                        onClick={() => handleIniciarPausa('comida')}
                        disabled={loading}
                        style={{
                          padding: '16px 24px',
                          backgroundColor: colors.info,
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        <Coffee size={20} />
                        Pausa Comida
                      </button>
                      <button
                        onClick={() => handleIniciarPausa('descanso')}
                        disabled={loading}
                        style={{
                          padding: '16px 24px',
                          backgroundColor: colors.warning,
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '16px',
                          fontWeight: '600',
                          cursor: loading ? 'not-allowed' : 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          opacity: loading ? 0.6 : 1
                        }}
                      >
                        <Pause size={20} />
                        Pausa Descanso
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <button
                  onClick={handleFicharEntrada}
                  disabled={loading}
                  style={{
                    padding: '20px 40px',
                    backgroundColor: colors.success,
                    color: 'white',
                    border: 'none',
                    borderRadius: '12px',
                    fontSize: '18px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    margin: '0 auto',
                    opacity: loading ? 0.6 : 1
                  }}
                >
                  <LogIn size={24} />
                  Fichar Entrada
                </button>
              </div>
            )}
          </motion.div>

          {/* Resumen mensual */}
          {resumenMensual && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
              style={{
                backgroundColor: colors.surface,
                padding: '24px',
                borderRadius: '12px',
                marginBottom: '24px',
                border: `1px solid ${colors.border}`
              }}
            >
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: colors.text,
                marginBottom: '20px'
              }}>
                Resumen del Mes
              </h2>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                gap: '16px'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                    Días trabajados
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>
                    {resumenMensual.totalDias}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                    Horas totales
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: colors.primary }}>
                    {fichajeService.formatearHoras(resumenMensual.totalHoras)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                    Días completos
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: colors.success }}>
                    {resumenMensual.diasCompletos}
                  </div>
                </div>
                {resumenMensual.diasIncompletos > 0 && (
                  <div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Días incompletos
                    </div>
                    <div style={{ fontSize: '24px', fontWeight: '700', color: colors.warning }}>
                      {resumenMensual.diasIncompletos}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Historial */}
          {historial.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
              style={{
                backgroundColor: colors.surface,
                padding: '24px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`
              }}
            >
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '600', 
                color: colors.text,
                marginBottom: '20px'
              }}>
                Historial del Mes
              </h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `2px solid ${colors.border}` }}>
                      <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                        Fecha
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                        Entrada
                      </th>
                      <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                        Salida
                      </th>
                      <th style={{ padding: '12px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                        Horas
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {historial.map((fichaje) => (
                      <tr key={fichaje.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                        <td style={{ padding: '12px', color: colors.text }}>
                          {formatDate(fichaje.fecha)}
                        </td>
                        <td style={{ padding: '12px', color: colors.text }}>
                          {formatTime(fichaje.hora_entrada)}
                        </td>
                        <td style={{ padding: '12px', color: colors.text }}>
                          {fichaje.hora_salida ? formatTime(fichaje.hora_salida) : '-'}
                        </td>
                        <td style={{ padding: '12px', textAlign: 'center', color: colors.text, fontWeight: '600' }}>
                          {fichaje.horas_trabajadas ? fichajeService.formatearHoras(fichaje.horas_trabajadas) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          )}

          {/* Botón para añadir fichaje a posteriori */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.4 }}
            style={{ marginTop: '24px', textAlign: 'center' }}
          >
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '12px 24px',
                backgroundColor: 'transparent',
                color: colors.primary,
                border: `2px solid ${colors.primary}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} />
              Añadir Fichaje Olvidado
            </button>
          </motion.div>

          {/* Modal para añadir fichaje a posteriori */}
          <FichajeModal
            isOpen={showAddModal}
            onClose={() => setShowAddModal(false)}
            empleadoId={empleadoId}
            onSuccess={(fichaje) => {
              setSuccess('Fichaje añadido correctamente');
              setTimeout(() => setSuccess(''), 3000);
              loadEstadoFichaje();
              loadHistorial();
            }}
          />

          {/* Modal de notificación de cambios */}
          {showNotificacionModal && fichajePendiente && (
            <FichajeNotificacionModal
              fichaje={fichajePendiente}
              empleadoNombre={empleadoSeleccionado?.nombreCompleto || 'Empleado'}
              onClose={() => {
                setShowNotificacionModal(false);
                setFichajePendiente(null);
              }}
              onValidar={(aceptado) => {
                setSuccess(aceptado ? 'Cambio aceptado correctamente' : 'Cambio rechazado');
                setTimeout(() => setSuccess(''), 3000);
                loadEstadoFichaje();
                loadHistorial();
                buscarFichajesPendientes();
              }}
            />
          )}
        </>
          )}
        </>
      )}

      {/* CSS para animación */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default FichajePage;

