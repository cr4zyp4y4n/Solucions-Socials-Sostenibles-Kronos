import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  LogIn, 
  LogOut, 
  Coffee,
  Play,
  Pause,
  Calendar as CalendarIcon,
  Plus,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  Delete,
  Eraser,
  MapPin
} from 'lucide-react';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, format, isSameMonth, isToday, isFuture } from 'date-fns';
import { es } from 'date-fns/locale';
import fichajeService from '../services/fichajeService';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import fichajeCodigosService from '../services/fichajeCodigosService';
import FichajeModal from './FichajeModal';
import FichajeNotificacionModal from './FichajeNotificacionModal';
import FichajeDetailsModal from './FichajeDetailsModal';
import FichajeEditModal from './FichajeEditModal';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { formatTimeMadrid, formatDateMadrid } from '../utils/timeUtils';

const WEEKDAYS_SHORT = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

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
  const [showFullCalendarModal, setShowFullCalendarModal] = useState(false);
  const [selectedFichaje, setSelectedFichaje] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const ubicacionCachedRef = useRef(null);

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
        // Usar solo datos de KRONOS (tabla fichajes_codigos): no llamar a Holded
        // El nombre se muestra desde descripcion (lo rellena el admin al asignar el código)
        const nombreCompleto = resultado.data.descripcion?.trim() || `Empleado (código ${resultado.data.codigo})`;
        setEmpleadoId(resultado.data.empleadoId);
        setEmpleadoInfo({
          id: resultado.data.empleadoId,
          nombreCompleto,
          email: null,
          codigo: resultado.data.codigo
        });
        setSuccess('Código válido');
        setTimeout(() => setSuccess(''), 2000);
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
    // Usar ubicación ya obtenida en segundo plano al entrar al perfil (sin preguntar al hacer clic)
    const ubicacion = ubicacionCachedRef.current || null;
    try {
      const resultado = await fichajeService.ficharEntrada(empleadoId, user?.id, ubicacion);
      
      if (resultado.success) {
        setSuccess(ubicacion ? 'Entrada registrada (con ubicación)' : 'Entrada registrada correctamente');
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

  // Abrir modal detalle/edición de un fichaje (igual que panel fichajes)
  const openFichaje = (fichaje, edit = false) => {
    setSelectedFichaje(fichaje);
    setShowDetailsModal(!edit);
    setShowEditModal(edit);
  };

  const handleCloseFichajeModals = () => {
    setShowDetailsModal(false);
    setShowEditModal(false);
    setSelectedFichaje(null);
    loadHistorial();
  };

  // Pre-fetch ubicación en segundo plano al entrar al perfil (para guardar "sin preguntar" al fichar)
  useEffect(() => {
    if (!empleadoId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ubicacionCachedRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [empleadoId]);

  // Para perfil: agrupar historial por fecha (mini calendario)
  const fichajesPorFecha = useMemo(() => {
    const map = {};
    (historial || []).forEach((f) => {
      const key = f.fecha;
      if (!map[key]) map[key] = [];
      map[key].push(f);
    });
    return map;
  }, [historial]);

  const mesActual = new Date();
  // Semana actual (Lun–Dom) para vista compacta del perfil (se recalcula cada render para reflejar "hoy")
  const weekDays = useMemo(() => {
    const start = startOfWeek(mesActual, { weekStartsOn: 1 });
    const end = endOfWeek(mesActual, { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [mesActual.getTime()]);

  // Días del mes completo (para modal calendario)
  const calendarDays = useMemo(() => {
    const start = startOfMonth(mesActual);
    const end = endOfMonth(mesActual);
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
  }, []);

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
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !validandoCodigo && codigoFichaje.trim()) {
                      e.preventDefault();
                      validarCodigo(codigoFichaje);
                    }
                  }}
                  placeholder="Ej: 1234"
                  disabled={validandoCodigo}
                  autoComplete="off"
                  aria-label="Código de fichaje"
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
                Introduce el código único asignado para fichar. Pulsa <strong>Enter</strong> o el botón Validar. El jefe puede fichar por cualquier empleado.
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

          {/* Resumen visual: Total trabajado + Media diaria */}
          {resumenMensual && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.2 }}
              style={{ marginBottom: '20px' }}
            >
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '16px'
              }}>
                {/* Tarjeta Total trabajado */}
                <div style={{
                  backgroundColor: colors.surface,
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '500' }}>
                    Total trabajado
                  </div>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke={colors.border} strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r="34"
                        fill="none"
                        stroke={colors.primary}
                        strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={2 * Math.PI * 34 * (1 - Math.min(1, (resumenMensual.totalHoras || 0) / 160))}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                      />
                    </svg>
                    <div style={{
                      position: 'absolute',
                      fontSize: (fichajeService.formatearHoras(resumenMensual.totalHoras).length > 6) ? '14px' : '20px',
                      fontWeight: '700',
                      color: colors.text,
                      lineHeight: 1.2,
                      textAlign: 'center',
                      maxWidth: '70px'
                    }}>
                      {fichajeService.formatearHoras(resumenMensual.totalHoras)}
                    </div>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: colors.textSecondary }}>horas este mes</div>
                </div>
                {/* Tarjeta Media diaria */}
                <div style={{
                  backgroundColor: colors.surface,
                  padding: '20px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  textAlign: 'center'
                }}>
                  <div style={{ fontSize: '13px', color: colors.textSecondary, marginBottom: '8px', fontWeight: '500' }}>
                    Media diaria
                  </div>
                  <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="80" height="80" viewBox="0 0 80 80" style={{ transform: 'rotate(-90deg)' }}>
                      <circle cx="40" cy="40" r="34" fill="none" stroke={colors.border} strokeWidth="6" />
                      <circle
                        cx="40" cy="40" r="34"
                        fill="none"
                        stroke={colors.primary}
                        strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 34}`}
                        strokeDashoffset={2 * Math.PI * 34 * (1 - Math.min(1, ((resumenMensual.totalHoras || 0) / Math.max(1, resumenMensual.totalDias)) / 8))}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
                      />
                    </svg>
                    <div style={{ position: 'absolute', fontSize: '20px', fontWeight: '700', color: colors.text }}>
                      {(resumenMensual.totalHoras / Math.max(1, resumenMensual.totalDias)).toFixed(1)}
                    </div>
                  </div>
                  <div style={{ marginTop: '6px', fontSize: '11px', color: colors.textSecondary }}>h/día (ref. 8h)</div>
                </div>
              </div>
            </motion.div>
          )}

          {/* Vista semana actual (mismo diseño que panel fichajes) + botón calendario completo */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut', delay: 0.22 }}
            style={{
              backgroundColor: colors.surface,
              padding: '14px',
              borderRadius: '12px',
              marginBottom: '20px',
              border: `1px solid ${colors.border}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <CalendarIcon size={16} color={colors.primary} />
                <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text, textTransform: 'capitalize' }}>
                  Semana {format(weekDays[0], 'd')}–{format(weekDays[6], 'd')} {format(mesActual, 'MMM yyyy', { locale: es })}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowFullCalendarModal(true)}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.primary,
                  backgroundColor: colors.primary + '18',
                  border: `1px solid ${colors.primary}`,
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
              >
                Ver calendario completo
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {weekDays.map((day, idx) => {
                const dateKey = format(day, 'yyyy-MM-dd');
                const dayFichajes = fichajesPorFecha[dateKey] || [];
                const isCurrentMonth = isSameMonth(day, mesActual);
                const isTodayDate = isToday(day);
                const isFutureDate = isFuture(day) && !isTodayDate;
                return (
                  <div
                    key={idx}
                    style={{
                      minHeight: '64px',
                      padding: '6px',
                      borderRadius: '8px',
                      backgroundColor: !isCurrentMonth ? colors.surface : isTodayDate ? colors.primary + '15' : 'transparent',
                      border: isTodayDate ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                      opacity: isFutureDate ? 0.6 : 1
                    }}
                  >
                    <div style={{
                      fontSize: '13px',
                      fontWeight: isTodayDate ? '700' : '500',
                      color: isTodayDate ? colors.primary : colors.text,
                      marginBottom: '4px'
                    }}>
                      {format(day, 'd')}
                    </div>
                    {dayFichajes.length > 0 && !isFutureDate && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        {dayFichajes.slice(0, 2).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => openFichaje(f)}
                            style={{
                              fontSize: '10px',
                              padding: '4px 6px',
                              borderRadius: '4px',
                              border: 'none',
                              backgroundColor: f.hora_salida ? colors.success + '25' : colors.warning + '25',
                              color: colors.text,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              textAlign: 'left',
                              cursor: 'pointer'
                            }}
                            title={`${formatTime(f.hora_entrada)} - ${f.hora_salida ? formatTime(f.hora_salida) : '...'} (clic para ver)`}
                          >
                            {formatTime(f.hora_entrada)}–{f.hora_salida ? formatTime(f.hora_salida) : '...'}
                          </button>
                        ))}
                        {dayFichajes.length > 2 && (
                          <span style={{ fontSize: '10px', color: colors.textSecondary }}>+{dayFichajes.length - 2}</span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Modal calendario completo del mes */}
          {showFullCalendarModal && (
            <div
              style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.5)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                padding: '20px'
              }}
              onClick={() => setShowFullCalendarModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                style={{
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  padding: '20px',
                  maxWidth: '560px',
                  width: '100%',
                  maxHeight: '90vh',
                  overflow: 'auto',
                  border: `1px solid ${colors.border}`
                }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <span style={{ fontSize: '18px', fontWeight: '700', color: colors.text, textTransform: 'capitalize' }}>
                    {format(mesActual, 'MMMM yyyy', { locale: es })}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowFullCalendarModal(false)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      color: colors.text,
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      cursor: 'pointer'
                    }}
                  >
                    Cerrar
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px', marginBottom: '8px' }}>
                  {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((d) => (
                    <div key={d} style={{ textAlign: 'center', fontSize: '12px', fontWeight: '600', color: colors.textSecondary }}>
                      {d}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
                  {calendarDays.map((day, idx) => {
                    const dateKey = format(day, 'yyyy-MM-dd');
                    const dayFichajes = fichajesPorFecha[dateKey] || [];
                    const isCurrentMonth = isSameMonth(day, mesActual);
                    const isTodayDate = isToday(day);
                    const isFutureDate = isFuture(day) && !isTodayDate;
                    return (
                      <div
                        key={idx}
                        style={{
                          minHeight: '72px',
                          padding: '6px',
                          borderRadius: '8px',
                          backgroundColor: !isCurrentMonth ? colors.surface : isTodayDate ? colors.primary + '15' : 'transparent',
                          border: isTodayDate ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
                          opacity: !isCurrentMonth ? 0.5 : 1
                        }}
                      >
                        <div style={{
                          fontSize: '13px',
                          fontWeight: isTodayDate ? '700' : '500',
                          color: isTodayDate ? colors.primary : colors.text,
                          marginBottom: '4px'
                        }}>
                          {format(day, 'd')}
                        </div>
                        {dayFichajes.length > 0 && !isFutureDate && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            {dayFichajes.slice(0, 2).map((f) => (
                              <button
                                key={f.id}
                                type="button"
                                onClick={() => { openFichaje(f); setShowFullCalendarModal(false); }}
                                style={{
                                  fontSize: '10px',
                                  padding: '4px 6px',
                                  borderRadius: '4px',
                                  border: 'none',
                                  backgroundColor: f.hora_salida ? colors.success + '25' : colors.warning + '25',
                                  color: colors.text,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  textAlign: 'left',
                                  cursor: 'pointer'
                                }}
                              >
                                {formatTime(f.hora_entrada)}–{f.hora_salida ? formatTime(f.hora_salida) : '...'}
                              </button>
                            ))}
                            {dayFichajes.length > 2 && (
                              <span style={{ fontSize: '10px', color: colors.textSecondary }}>+{dayFichajes.length - 2}</span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </div>
          )}

          {/* Modales detalle/edición de fichaje (igual que panel fichajes) */}
          {showDetailsModal && selectedFichaje && (
            <FichajeDetailsModal
              fichaje={selectedFichaje}
              empleadoNombre={empleadoInfo?.nombreCompleto || empleadoInfo?.descripcion || 'Empleado'}
              onClose={handleCloseFichajeModals}
            />
          )}
          {showEditModal && selectedFichaje && (
            <FichajeEditModal
              fichaje={selectedFichaje}
              empleadoNombre={empleadoInfo?.nombreCompleto || empleadoInfo?.descripcion || 'Empleado'}
              onClose={handleCloseFichajeModals}
              onSave={handleCloseFichajeModals}
            />
          )}

          {/* Historial del mes: tarjetas compactas */}
          {historial.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: 'easeOut', delay: 0.3 }}
              style={{ marginBottom: '24px' }}
            >
              <h2 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, marginBottom: '12px' }}>
                Historial del mes
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {historial.map((fichaje) => (
                  <div
                    key={fichaje.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openFichaje(fichaje)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFichaje(fichaje); } }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      flexWrap: 'wrap',
                      gap: '8px',
                      padding: '12px 14px',
                      backgroundColor: colors.surface,
                      borderRadius: '10px',
                      border: `1px solid ${colors.border}`,
                      fontSize: '13px',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: '1 1 140px' }}>
                      <div style={{
                        width: '36px',
                        height: '36px',
                        borderRadius: '8px',
                        backgroundColor: colors.primary + '18',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '700',
                        color: colors.primary,
                        fontSize: '12px'
                      }}>
                        {formatDate(fichaje.fecha).split('/')[0]}
                      </div>
                      <div>
                        <div style={{ fontWeight: '600', color: colors.text }}>{formatDate(fichaje.fecha)}</div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                          {formatTime(fichaje.hora_entrada)}
                          {fichaje.hora_salida ? ` – ${formatTime(fichaje.hora_salida)}` : ' – En curso'}
                        </div>
                        {(fichaje.ubicacion_lat != null && fichaje.ubicacion_lng != null) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: colors.textSecondary, marginTop: '2px' }}>
                            <MapPin size={12} />
                            {fichaje.ubicacion_texto ? fichaje.ubicacion_texto : 'Ubicación guardada'}
                          </div>
                        )}
                      </div>
                    </div>
                    <div style={{
                      fontWeight: '700',
                      color: colors.primary,
                      fontSize: '14px',
                      minWidth: '56px',
                      textAlign: 'right'
                    }}>
                      {fichaje.horas_trabajadas ? fichajeService.formatearHoras(fichaje.horas_trabajadas) : '–'}
                    </div>
                  </div>
                ))}
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

