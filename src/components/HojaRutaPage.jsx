import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Upload, 
  Edit3, 
  Calendar, 
  Users, 
  Clock, 
  MapPin, 
  Phone, 
  Truck,
  History,
  Eye,
  FileText,
  AlertCircle,
  CheckCircle,
  Coffee,
  Utensils,
  Wine,
  Trash2,
  Pen,
  CheckCircle2
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import hojaRutaService from '../services/hojaRutaSupabaseService';
import HojaRutaUploadModal from './HojaRutaUploadModal';
import HojaRutaEditModal from './HojaRutaEditModal';
import HojaRutaHistoricoModal from './HojaRutaHistoricoModal';
import HojaRutaViewModal from './HojaRutaViewModal';
import ChecklistSection from './ChecklistSection';
import FirmaConfirmModal from './FirmaConfirmModal';
import PersonalSection from './PersonalSection';
import EmpleadoDetailModal from './EmpleadoDetailModal';

const HojaRutaPage = () => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  const { activeSection } = useNavigation();
  const [hojaActual, setHojaActual] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showFirmaModal, setShowFirmaModal] = useState(false);
  const [showEmpleadoModal, setShowEmpleadoModal] = useState(false);
  const [empleadoSeleccionado, setEmpleadoSeleccionado] = useState(null);
  const [selectedHoja, setSelectedHoja] = useState(null);

  // Función para cargar datos - usando función directa para evitar problemas de inicialización
  const loadDatos = async () => {
    try {
      setLoading(true);
      
      // Verificar si hay una hoja seleccionada desde navegación
      const selectedHojaId = localStorage.getItem('selectedHojaRutaId');
      if (selectedHojaId) {
        // Limpiar el localStorage
        localStorage.removeItem('selectedHojaRutaId');
        
        // Cargar la hoja específica
        const hoja = await hojaRutaService.getHojaRuta(selectedHojaId);
        if (hoja) {
          console.log('✅ Hoja cargada desde navegación:', hoja.cliente);
          setHojaActual(hoja);
          const historicoData = await hojaRutaService.getHistorico();
          setHistorico(historicoData);
          setError(null);
          setLoading(false);
          return;
        }
      }
      
      // Si no hay hoja seleccionada, cargar la última
      const ultima = await hojaRutaService.getUltimaHojaRuta();
      const historicoData = await hojaRutaService.getHistorico();
      
      setHojaActual(ultima);
      setHistorico(historicoData);
      setError(null);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar las hojas de ruta');
    } finally {
      setLoading(false);
    }
  };

  // Verificar si el usuario es jefe
  const isJefe = useMemo(() => {
    return user && ['jefe', 'admin', 'administrador'].includes(user.role?.toLowerCase());
  }, [user]);

  // Cargar datos iniciales
  useEffect(() => {
    loadDatos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Verificar cuando se navega a esta sección si hay una hoja seleccionada
  useEffect(() => {
    if (activeSection === 'hoja-ruta') {
      const selectedHojaId = localStorage.getItem('selectedHojaRutaId');
      if (selectedHojaId) {
        // Recargar datos para que loadDatos detecte la hoja seleccionada
        loadDatos();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSection]);

  // Generar checklists automáticas cuando se carga una hoja de ruta
  useEffect(() => {
    if (hojaActual) {
      hojaRutaService.actualizarChecklistElementos(hojaActual.id).then(hojaActualizada => {
        if (hojaActualizada) {
          setHojaActual(hojaActualizada);
        }
      }).catch(err => {
        console.error('Error actualizando checklist:', err);
      });
    }
  }, [hojaActual?.id]);

  const handleUploadSuccess = async (nuevaHoja) => {
    setHojaActual(nuevaHoja);
    await loadDatos(); // Recargar datos
    setError(null);
  };

  const handleEditSuccess = (updatedHoja) => {
    setHojaActual(updatedHoja);
    setError(null);
  };

  const handleViewHistorico = (hoja) => {
    setSelectedHoja(hoja);
    setShowViewModal(true);
  };

  const handleFirmarHoja = async (firmaData, firmadoPor) => {
    if (!hojaActual || !user?.id) return;
    
    try {
      const updated = await hojaRutaService.firmarHojaRuta(hojaActual.id, firmaData, firmadoPor);
      if (updated) {
        setHojaActual(updated);
        setError(null);
      } else {
        setError('Error al firmar la hoja de ruta');
      }
    } catch (err) {
      console.error('Error firmando hoja:', err);
      setError('Error al firmar la hoja de ruta');
    }
  };

  const handleDeleteHoja = async (hojaId) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta hoja de ruta?')) {
      try {
        await hojaRutaService.deleteHojaRuta(hojaId);
        await loadDatos(); // Recargar datos
        setError(null);
      } catch (err) {
        console.error('Error eliminando hoja:', err);
        setError('Error al eliminar la hoja de ruta');
      }
    }
  };

  // Handlers para checklist
  const handleUpdateChecklist = async (hojaId, tipo, fase, tareaId, completed, assignedTo) => {
    console.log('🔄 HojaRutaPage - handleUpdateChecklist:', { hojaId, tipo, fase, tareaId, completed, assignedTo });
    const hojaActualizada = await hojaRutaService.actualizarTareaChecklist(hojaId, tipo, fase, tareaId, completed, assignedTo, user?.id || null);
    if (hojaActualizada) {
      console.log('✅ HojaRutaPage - Hoja actualizada, actualizando estado');
      setHojaActual(hojaActualizada);
    } else {
      console.log('❌ HojaRutaPage - No se pudo actualizar la hoja');
    }
  };

  const handleCambiarEstado = async (hojaId, nuevoEstado) => {
    try {
      const hojaActualizada = await hojaRutaService.cambiarEstadoServicio(hojaId, nuevoEstado);
      if (hojaActualizada) {
        setHojaActual(hojaActualizada);
      }
    } catch (err) {
      console.error('Error cambiando estado:', err);
      setError('Error al cambiar el estado del servicio');
    }
  };

  const handleNavigateToEmployee = (empleado) => {
    console.log('👤 Navegando a empleado:', empleado);
    setEmpleadoSeleccionado(empleado);
    setShowEmpleadoModal(true);
  };

  // Obtener estadísticas del checklist
  const [estadisticasChecklist, setEstadisticasChecklist] = useState(null);

  useEffect(() => {
    if (hojaActual) {
      hojaRutaService.obtenerEstadisticasChecklist(hojaActual.id).then(stats => {
        setEstadisticasChecklist(stats);
      }).catch(err => {
        console.error('Error obteniendo estadísticas:', err);
        setEstadisticasChecklist(null);
      });
    } else {
      setEstadisticasChecklist(null);
    }
  }, [hojaActual]);

  const handleDeleteCurrentHoja = async () => {
    if (hojaActual && window.confirm('¿Estás seguro de que quieres eliminar la hoja de ruta actual?')) {
      try {
        await hojaRutaService.deleteHojaRuta(hojaActual.id);
        await loadDatos(); // Recargar datos
        setError(null);
      } catch (err) {
        console.error('Error eliminando hoja actual:', err);
        setError('Error al eliminar la hoja de ruta actual');
      }
    }
  };

  const formatFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatHora = (hora) => {
    if (!hora) return '';
    return hora.replace('H', 'h');
  };

  if (loading) {
    return (
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
        <p style={{ color: colors.textSecondary }}>Procesando archivo...</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${colors.border}`
        }}
      >
        <div>
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: 'bold', 
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <FileText size={32} color={colors.primary} />
            Hoja de Ruta
          </h1>
          <p style={{ 
            color: colors.textSecondary, 
            margin: '8px 0 0 0',
            fontSize: '16px'
          }}>
            Gestión de hojas de ruta de servicios
          </p>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowUploadModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <Upload size={18} />
            Subir CSV
          </motion.button>

          {hojaActual && (
            <>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowEditModal(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <Edit3 size={18} />
                Editar
              </motion.button>

              {/* Botón de Firma */}
              {hojaActual && !hojaActual.firmaInfo?.firmado && (
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setShowFirmaModal(true)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 20px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  <Pen size={18} />
                  Firmar Hoja de Ruta
                </motion.button>
              )}

              {/* Indicador de firma */}
              {hojaActual && hojaActual.firmaInfo?.firmado && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: colors.success + '20',
                  color: colors.success,
                  border: `1px solid ${colors.success + '30'}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500'
                }}>
                  <CheckCircle2 size={18} />
                  Firmada por {hojaActual.firmaInfo.firmadoPor}
                </div>
              )}

              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={handleDeleteCurrentHoja}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 20px',
                  backgroundColor: colors.error + '20',
                  color: colors.error,
                  border: `1px solid ${colors.error + '30'}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                <Trash2 size={18} />
                Eliminar
              </motion.button>
            </>
          )}

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowHistoricoModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 20px',
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            <History size={18} />
            Histórico ({historico.length})
          </motion.button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          style={{
            backgroundColor: colors.error + '20',
            border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <AlertCircle size={20} color={colors.error} />
          <span style={{ color: colors.error, fontWeight: '500' }}>{error}</span>
        </motion.div>
      )}

      {/* Contenido principal */}
      {hojaActual ? (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ display: 'flex', gap: '24px' }}
        >
          {/* Información principal */}
          <div style={{ flex: 2 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{
                backgroundColor: colors.surface,
                borderRadius: '12px',
                padding: '24px',
                border: `1px solid ${colors.border}`,
                marginBottom: '24px'
              }}
            >
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: colors.text,
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Calendar size={24} color={colors.primary} />
                Información General
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Fecha del Servicio
                  </label>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: colors.text,
                    margin: 0
                  }}>
                    {formatFecha(hojaActual.fechaServicio)}
                  </p>
                </div>

                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Cliente
                  </label>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: colors.text,
                    margin: 0
                  }}>
                    {hojaActual.cliente}
                  </p>
                </div>

                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Nº Personas
                  </label>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: colors.text,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Users size={16} color={colors.primary} />
                    {hojaActual.numPersonas}
                  </p>
                </div>

                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Responsable
                  </label>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: colors.text,
                    margin: 0
                  }}>
                    {hojaActual.responsable}
                  </p>
                </div>

                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Transportista
                  </label>
                  <p style={{ 
                    fontSize: '16px', 
                    fontWeight: '500', 
                    color: colors.text,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Truck size={16} color={colors.primary} />
                    {hojaActual.transportista}
                  </p>
                </div>
              </div>

              {/* Contacto y Dirección */}
              <div style={{ marginTop: '24px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Contacto
                  </label>
                  <p style={{ 
                    fontSize: '14px', 
                    color: colors.text,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Phone size={16} color={colors.primary} />
                    {hojaActual.contacto}
                  </p>
                </div>

                <div>
                  <label style={{ 
                    fontSize: '12px', 
                    fontWeight: '600', 
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '4px',
                    display: 'block'
                  }}>
                    Dirección
                  </label>
                  <p style={{ 
                    fontSize: '14px', 
                    color: colors.text,
                    margin: 0,
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '8px'
                  }}>
                    <MapPin size={16} color={colors.primary} style={{ marginTop: '2px', flexShrink: 0 }} />
                    {hojaActual.direccion}
                  </p>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <PersonalSection 
                personal={hojaActual.personal}
                hojaId={hojaActual.id}
                onNavigateToEmployee={handleNavigateToEmployee}
                onUpdate={setHojaActual}
              />
            </motion.div>

            {/* Checklist Section */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <ChecklistSection 
                hojaRuta={hojaActual}
                onUpdateChecklist={handleUpdateChecklist}
                onCambiarEstado={handleCambiarEstado}
                estadisticas={estadisticasChecklist}
              />
            </motion.div>

            {/* Horarios */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              style={{
              backgroundColor: colors.surface,
              borderRadius: '12px',
              padding: '24px',
              border: `1px solid ${colors.border}`,
              marginBottom: '24px'
            }}>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: 'bold', 
                color: colors.text,
                margin: '0 0 20px 0',
                display: 'flex',
                alignItems: 'center',
                gap: '12px'
              }}>
                <Clock size={24} color={colors.primary} />
                Horarios
              </h2>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
                {Object.entries(hojaActual.horarios).map(([key, value]) => (
                  <div key={key} style={{
                    padding: '16px',
                    backgroundColor: colors.background,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <label style={{ 
                      fontSize: '12px', 
                      fontWeight: '600', 
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '4px',
                      display: 'block'
                    }}>
                      {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                    </label>
                    <p style={{ 
                      fontSize: '16px', 
                      fontWeight: '500', 
                      color: colors.text,
                      margin: 0
                    }}>
                      {formatHora(value)}
                    </p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Equipamiento */}
            {hojaActual.equipamiento && hojaActual.equipamiento.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.5 }}
                style={{
                backgroundColor: colors.surface,
                borderRadius: '12px',
                padding: '24px',
                border: `1px solid ${colors.border}`,
                marginBottom: '24px'
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: colors.text,
                  margin: '0 0 20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Utensils size={20} color={colors.primary} />
                  Equipamiento y Material
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '12px' }}>
                  {hojaActual.equipamiento.map((item, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
                      style={{
                      padding: '12px',
                      backgroundColor: colors.background,
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`
                    }}>
                      <p style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: colors.text,
                        margin: '0 0 4px 0'
                      }}>
                        {item.item}
                      </p>
                      {item.cantidad && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: colors.textSecondary,
                          margin: '0 0 4px 0'
                        }}>
                          Cantidad: {item.cantidad}
                        </p>
                      )}
                      {item.notas && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: colors.warning,
                          margin: 0,
                          fontStyle: 'italic'
                        }}>
                          {item.notas}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Menús */}
            {hojaActual.menus && hojaActual.menus.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                style={{
                backgroundColor: colors.surface,
                borderRadius: '12px',
                padding: '24px',
                border: `1px solid ${colors.border}`,
                marginBottom: '24px'
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: colors.text,
                  margin: '0 0 20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Coffee size={20} color={colors.primary} />
                  Menús
                </h3>

                {/* Agrupar menús por tipo */}
                {Object.entries(
                  hojaActual.menus.reduce((groups, menu) => {
                    const tipo = menu.tipo;
                    if (!groups[tipo]) groups[tipo] = [];
                    groups[tipo].push(menu);
                    return groups;
                  }, {})
                ).map(([tipo, menus]) => (
                  <div key={tipo} style={{ marginBottom: '24px' }}>
                    {/* Título del menú */}
                    <h4 style={{
                      fontSize: '16px',
                      fontWeight: 'bold',
                      color: colors.primary,
                      margin: '0 0 12px 0',
                      padding: '8px 12px',
                      backgroundColor: colors.primary + '10',
                      borderRadius: '6px',
                      border: `1px solid ${colors.primary + '30'}`
                    }}>
                      {hojaActual.menuTitles && hojaActual.menuTitles[tipo] 
                        ? hojaActual.menuTitles[tipo]
                        : tipo.replace('_', ' ').toUpperCase()
                      }
                    </h4>

                    {/* Items del menú */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginLeft: '16px' }}>
                      {menus.map((menu, index) => (
                        <div key={index} style={{
                          padding: '12px',
                          backgroundColor: colors.background,
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                            <p style={{ 
                              fontSize: '14px', 
                              fontWeight: '600',
                              color: colors.text,
                              margin: 0
                            }}>
                              {menu.item}
                            </p>
                            {menu.proveedor && (
                              <span style={{ 
                                fontSize: '12px', 
                                color: colors.primary,
                                fontWeight: '500'
                              }}>
                                {menu.proveedor}
                              </span>
                            )}
                          </div>
                          {menu.cantidad && (
                            <p style={{ 
                              fontSize: '12px', 
                              color: colors.textSecondary,
                              margin: 0
                            }}>
                              Cantidad: {menu.cantidad}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {/* Bebidas */}
            {hojaActual.bebidas && hojaActual.bebidas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                style={{
                backgroundColor: colors.surface,
                borderRadius: '12px',
                padding: '24px',
                border: `1px solid ${colors.border}`,
                marginBottom: '24px'
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: colors.text,
                  margin: '0 0 20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <Wine size={20} color={colors.primary} />
                  Bebidas
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
                  {hojaActual.bebidas.map((bebida, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, delay: 0.7 + index * 0.05 }}
                      style={{
                      padding: '12px',
                      backgroundColor: colors.background,
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`
                    }}>
                      <p style={{ 
                        fontSize: '14px', 
                        fontWeight: '600',
                        color: colors.text,
                        margin: '0 0 4px 0'
                      }}>
                        {bebida.item}
                      </p>
                      {bebida.cantidad && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: colors.textSecondary,
                          margin: '0 0 4px 0'
                        }}>
                          Cantidad: {bebida.cantidad}
                        </p>
                      )}
                      {bebida.unidad && (
                        <p style={{ 
                          fontSize: '12px', 
                          color: colors.textSecondary,
                          margin: 0
                        }}>
                          Unidad: {bebida.unidad}
                        </p>
                      )}
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* Sidebar con estadísticas y notas */}
          <div style={{ flex: 1 }}>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
              style={{
              backgroundColor: colors.surface,
              borderRadius: '12px',
              padding: '24px',
              border: `1px solid ${colors.border}`,
              marginBottom: '24px'
            }}>
              <h3 style={{ 
                fontSize: '18px', 
                fontWeight: 'bold', 
                color: colors.text,
                margin: '0 0 20px 0'
              }}>
                Estadísticas
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: colors.background,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: colors.primary + '20',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <FileText size={20} color={colors.primary} />
                  </div>
                  <div>
                    <p style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: colors.text,
                      margin: 0
                    }}>
                      Total Hojas
                    </p>
                    <p style={{ 
                      fontSize: '20px', 
                      fontWeight: 'bold', 
                      color: colors.primary,
                      margin: 0
                    }}>
                      {historico.length + 1}
                    </p>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '12px',
                  backgroundColor: colors.background,
                  borderRadius: '8px'
                }}>
                  <div style={{
                    width: '40px',
                    height: '40px',
                    backgroundColor: colors.success + '20',
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <CheckCircle size={20} color={colors.success} />
                  </div>
                  <div>
                    <p style={{ 
                      fontSize: '14px', 
                      fontWeight: '600', 
                      color: colors.text,
                      margin: 0
                    }}>
                      Última Actualización
                    </p>
                    <p style={{ 
                      fontSize: '12px', 
                      color: colors.textSecondary,
                      margin: 0
                    }}>
                      {formatFecha(hojaActual.fechaCreacion)}
                    </p>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* Notas importantes */}
            {hojaActual.notas && hojaActual.notas.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                style={{
                backgroundColor: colors.surface,
                borderRadius: '12px',
                padding: '24px',
                border: `1px solid ${colors.border}`
              }}>
                <h3 style={{ 
                  fontSize: '18px', 
                  fontWeight: 'bold', 
                  color: colors.text,
                  margin: '0 0 20px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px'
                }}>
                  <AlertCircle size={20} color={colors.warning} />
                  Notas Importantes
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {hojaActual.notas.map((nota, index) => (
                    <div key={index} style={{
                      padding: '12px',
                      backgroundColor: colors.warning + '10',
                      borderRadius: '8px',
                      border: `1px solid ${colors.warning + '30'}`
                    }}>
                      <p style={{ 
                        fontSize: '14px', 
                        color: colors.text,
                        margin: 0,
                        fontWeight: '500'
                      }}>
                        {nota}
                      </p>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '48px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <FileText size={64} color={colors.textSecondary} style={{ marginBottom: '24px' }} />
          <h2 style={{ 
            fontSize: '24px', 
            fontWeight: 'bold', 
            color: colors.text,
            margin: '0 0 12px 0'
          }}>
            No hay hoja de ruta disponible
          </h2>
          <p style={{ 
            fontSize: '16px', 
            color: colors.textSecondary,
            margin: '0 0 24px 0'
          }}>
            {isJefe ? 'Sube un archivo CSV para comenzar' : 'Esperando a que se suba una hoja de ruta'}
          </p>
          {isJefe && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploadModal(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 32px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                margin: '0 auto'
              }}
            >
              <Upload size={20} />
              Subir Primera Hoja de Ruta
            </motion.button>
          )}
        </motion.div>
      )}

      {/* Modales */}
      <HojaRutaUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadSuccess={handleUploadSuccess}
        userId={user?.id}
      />

      <HojaRutaEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        hojaRuta={hojaActual}
        onEditSuccess={handleEditSuccess}
      />

      <HojaRutaHistoricoModal
        isOpen={showHistoricoModal}
        onClose={() => setShowHistoricoModal(false)}
        historico={historico}
        onViewHoja={handleViewHistorico}
        onDeleteHoja={handleDeleteHoja}
      />

      <HojaRutaViewModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        hojaRuta={selectedHoja}
      />

      <FirmaConfirmModal
        isOpen={showFirmaModal}
        onClose={() => setShowFirmaModal(false)}
        hojaRuta={hojaActual}
        onFirmar={handleFirmarHoja}
      />

      <EmpleadoDetailModal
        isOpen={showEmpleadoModal}
        onClose={() => setShowEmpleadoModal(false)}
        empleado={empleadoSeleccionado}
      />
    </div>
  );
};

export default HojaRutaPage;
