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
  RefreshCw,
  Delete,
  Eraser
} from 'lucide-react';
import fichajeService from '../services/fichajeService';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import fichajeCodigosService from '../services/fichajeCodigosService';
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
  const [empleadoInfo, setEmpleadoInfo] = useState(null); // Información del empleado encontrado
  const [codigoFichaje, setCodigoFichaje] = useState('');
  const [validandoCodigo, setValidandoCodigo] = useState(false);
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

  // Validar código de fichaje
  const validarCodigo = async (codigo) => {
    if (!codigo || !codigo.trim()) {
      setError('Por favor, introduce un código');
      return;
    }

    setValidandoCodigo(true);
    setError('');
    
    try {
      const resultado = await fichajeCodigosService.buscarEmpleadoPorCodigo(codigo);
      
      if (resultado.success) {
        // Buscar información del empleado en Holded (intentar ambas empresas)
        let empleado = null;
        let empleadoEncontrado = false;
        
        // Intentar primero en solucions
        try {
          const empleadoSolucions = await holdedEmployeesService.getEmployee(resultado.data.empleadoId, 'solucions');
          if (empleadoSolucions) {
            empleado = empleadoSolucions;
            empleadoEncontrado = true;
          }
        } catch (err) {
          // Si falla, intentar en menjar
          console.log(`Empleado no encontrado en solucions, intentando en menjar...`);
        }
        
        // Si no se encontró en solucions, intentar en menjar
        if (!empleadoEncontrado) {
          try {
            const empleadoMenjar = await holdedEmployeesService.getEmployee(resultado.data.empleadoId, 'menjar');
            if (empleadoMenjar) {
              empleado = empleadoMenjar;
              empleadoEncontrado = true;
            }
          } catch (err) {
            console.log(`Empleado no encontrado en menjar tampoco`);
          }
        }
        
        if (empleado) {
          setEmpleadoId(resultado.data.empleadoId);
          setEmpleadoInfo({
            id: resultado.data.empleadoId,
            nombreCompleto: empleado.nombreCompleto || empleado.name || 'Empleado',
            email: empleado.email,
            codigo: resultado.data.codigo
          });
          setSuccess('Código válido');
          setTimeout(() => setSuccess(''), 2000);
        } else {
          // Si no se encuentra en Holded, usar el código igualmente (puede ser un empleado nuevo)
          console.warn('Empleado no encontrado en Holded, pero el código es válido. Usando información básica.');
          setEmpleadoId(resultado.data.empleadoId);
          setEmpleadoInfo({
            id: resultado.data.empleadoId,
            nombreCompleto: 'Empleado (ID: ' + resultado.data.empleadoId.substring(0, 8) + '...)',
            email: null,
            codigo: resultado.data.codigo
          });
          setSuccess('Código válido');
          setTimeout(() => setSuccess(''), 2000);
        }
      } else {
        setError(resultado.error || 'Código no válido');
        setEmpleadoId(null);
        setEmpleadoInfo(null);
      }
    } catch (err) {
      console.error('Error validando código:', err);
      setError('Error al validar el código');
      setEmpleadoId(null);
      setEmpleadoInfo(null);
    } finally {
      setValidandoCodigo(false);
    }
  };

  // Limpiar selección
  const limpiarSeleccion = () => {
    setCodigoFichaje('');
    setEmpleadoId(null);
    setEmpleadoInfo(null);
    setEstadoFichaje(null);
    setHistorial([]);
    setResumenMensual(null);
  };

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
      
      // Recargar cada 30 segundos para actualizar el estado del fichaje
      const interval = setInterval(() => {
        loadEstadoFichaje();
      }, 30000); // 30 segundos
      
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

        <>
          {/* Input de código de fichaje */}
          {!empleadoId && (
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
                Introduce tu código de fichaje
              </label>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <input
                  type="text"
                  value={codigoFichaje}
                  onChange={(e) => {
                    setCodigoFichaje(e.target.value.toUpperCase());
                    setError('');
                  }}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !validandoCodigo) {
                      validarCodigo(codigoFichaje);
                    }
                  }}
                  placeholder="Ej: 1234"
                  disabled={validandoCodigo}
                  style={{
                    flex: 1,
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '16px',
                    fontWeight: '600',
                    letterSpacing: '2px',
                    textAlign: 'center',
                    color: colors.text,
                    backgroundColor: colors.background,
                    outline: 'none',
                    textTransform: 'uppercase',
                    opacity: validandoCodigo ? 0.6 : 1
                  }}
                />
                <button
                  onClick={() => validarCodigo(codigoFichaje)}
                  disabled={validandoCodigo || !codigoFichaje.trim()}
                  style={{
                    padding: '12px 24px',
                    backgroundColor: validandoCodigo || !codigoFichaje.trim() ? colors.border : colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: validandoCodigo || !codigoFichaje.trim() ? 'not-allowed' : 'pointer',
                    opacity: validandoCodigo || !codigoFichaje.trim() ? 0.6 : 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  {validandoCodigo ? (
                    <>
                      <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                      Validando...
                    </>
                  ) : (
                    'Validar'
                  )}
                </button>
              </div>
              <p style={{ 
                fontSize: '12px', 
                color: colors.textSecondary, 
                marginTop: '8px',
                marginBottom: 0
              }}>
                Introduce el código único asignado para fichar. El jefe puede fichar por cualquier empleado.
              </p>
            </motion.div>
          )}

          {/* Numpad: fuera del div del input, centrado en la sección */}
          {!empleadoId && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, ease: 'easeOut', delay: 0.15 }}
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                marginTop: '24px',
                marginBottom: '24px'
              }}
            >
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                boxShadow: '0 2px 12px rgba(0,0,0,0.08)'
              }}>
                <span style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: '500',
                  color: colors.textSecondary,
                  marginBottom: '14px',
                  textAlign: 'center'
                }}>
                </span>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  width: '100%'
                }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                    <motion.button
                      key={n}
                      type="button"
                      disabled={validandoCodigo}
                      onClick={() => {
                        setCodigoFichaje((prev) => (prev + String(n)).toUpperCase());
                        setError('');
                      }}
                      whileTap={{ scale: validandoCodigo ? 1 : 0.92 }}
                      whileHover={validandoCodigo ? {} : { scale: 1.03 }}
                      transition={{ duration: 0.1 }}
                      style={{
                        padding: '16px',
                        fontSize: '22px',
                        fontWeight: '600',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '10px',
                        backgroundColor: colors.background,
                        color: colors.text,
                        cursor: validandoCodigo ? 'not-allowed' : 'pointer',
                        opacity: validandoCodigo ? 0.6 : 1,
                        minWidth: '56px'
                      }}
                    >
                      {n}
                    </motion.button>
                  ))}
                  <motion.button
                    type="button"
                    disabled={validandoCodigo}
                    onClick={() => {
                      setCodigoFichaje((prev) => (prev + '0').toUpperCase());
                      setError('');
                    }}
                    whileTap={{ scale: validandoCodigo ? 1 : 0.92 }}
                    whileHover={validandoCodigo ? {} : { scale: 1.03 }}
                    transition={{ duration: 0.1 }}
                    style={{
                      padding: '16px',
                      fontSize: '22px',
                      fontWeight: '600',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      backgroundColor: colors.background,
                      color: colors.text,
                      cursor: validandoCodigo ? 'not-allowed' : 'pointer',
                      opacity: validandoCodigo ? 0.6 : 1,
                      minWidth: '56px'
                    }}
                  >
                    0
                  </motion.button>
                  <motion.button
                    type="button"
                    title="Borrar último"
                    disabled={validandoCodigo || !codigoFichaje.length}
                    onClick={() => setCodigoFichaje((prev) => prev.slice(0, -1))}
                    whileTap={validandoCodigo || !codigoFichaje.length ? {} : { scale: 0.92 }}
                    whileHover={validandoCodigo || !codigoFichaje.length ? {} : { scale: 1.03 }}
                    transition={{ duration: 0.1 }}
                    style={{
                      padding: '16px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      backgroundColor: colors.surface,
                      color: colors.text,
                      cursor: validandoCodigo || !codigoFichaje.length ? 'not-allowed' : 'pointer',
                      opacity: validandoCodigo || !codigoFichaje.length ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '56px'
                    }}
                  >
                    <Delete size={22} />
                  </motion.button>
                  <motion.button
                    type="button"
                    title="Limpiar"
                    disabled={validandoCodigo || !codigoFichaje.length}
                    onClick={() => {
                      setCodigoFichaje('');
                      setError('');
                    }}
                    whileTap={validandoCodigo || !codigoFichaje.length ? {} : { scale: 0.92 }}
                    whileHover={validandoCodigo || !codigoFichaje.length ? {} : { scale: 1.03 }}
                    transition={{ duration: 0.1 }}
                    style={{
                      padding: '16px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '10px',
                      backgroundColor: colors.surface,
                      color: colors.text,
                      cursor: validandoCodigo || !codigoFichaje.length ? 'not-allowed' : 'pointer',
                      opacity: validandoCodigo || !codigoFichaje.length ? 0.6 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      minWidth: '56px'
                    }}
                  >
                    <Eraser size={22} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {/* Información del empleado seleccionado */}
          {empleadoInfo && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
              style={{
                backgroundColor: colors.surface,
                padding: '20px',
                borderRadius: '12px',
                marginBottom: '24px',
                border: `1px solid ${colors.primary}`,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '4px' }}>
                  {empleadoInfo.nombreCompleto}
                </div>
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                  Código: {empleadoInfo.codigo}
                </div>
              </div>
              <button
                onClick={limpiarSeleccion}
                style={{
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  color: colors.error,
                  border: `1px solid ${colors.error}`,
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cambiar código
              </button>
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

          {empleadoId && (
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
              empleadoNombre={empleadoInfo?.nombreCompleto || 'Empleado'}
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

