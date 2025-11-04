import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, User, Mail, Phone, MapPin, Calendar, Briefcase, CreditCard, FileText, ExternalLink } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import hojaRutaService from '../services/hojaRutaSupabaseService';

const EmpleadoDetailModal = ({ isOpen, onClose, empleado }) => {
  const { navigateTo } = useNavigation();
  const { colors } = useTheme();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  
  // Cargar perfil del usuario para obtener el rol
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (!error && data) {
          setUserProfile(data);
        }
      }
    };
    fetchUserProfile();
  }, [user]);
  
  // Verificar si el usuario puede ver horas (jefes, admins y gestión)
  const canManageHoras = useMemo(() => {
    const role = userProfile?.role || user?.user_metadata?.role || '';
    return ['jefe', 'admin', 'administrador', 'gestión', 'gestion', 'management'].includes(role.toLowerCase());
  }, [userProfile, user]);
  const [historialServicios, setHistorialServicios] = useState([]);
  const [estadisticasHoras, setEstadisticasHoras] = useState(null);
  
  // Cargar histórico cuando se abre el modal
  useEffect(() => {
    if (isOpen && empleado?.id) {
      const cargarHistorial = async () => {
        try {
          console.log('📋 EmpleadoDetailModal - Cargando histórico para:', empleado.id);
          const [historial, estadisticas] = await Promise.all([
            hojaRutaService.obtenerHistorialServicios(String(empleado.id)),
            hojaRutaService.obtenerEstadisticasHorasEmpleado(String(empleado.id))
          ]);
          
          console.log('📊 EmpleadoDetailModal - Historial cargado:', historial.length, 'servicios');
          setHistorialServicios(historial);
          setEstadisticasHoras(estadisticas);
        } catch (error) {
          console.error('❌ Error cargando histórico en modal:', error);
          setHistorialServicios([]);
          setEstadisticasHoras(null);
        }
      };
      cargarHistorial();
    } else {
      setHistorialServicios([]);
      setEstadisticasHoras(null);
    }
  }, [isOpen, empleado?.id]);
  
  if (!isOpen || !empleado) return null;

  const formatDate = (dateString) => {
    if (!dateString) return 'No especificado';
    try {
      return new Date(dateString).toLocaleDateString('es-ES');
    } catch {
      return dateString;
    }
  };

  const formatAddress = (address) => {
    if (!address) return 'No especificado';
    if (typeof address === 'object') {
      const parts = [address.address, address.city, address.postalCode, address.province, address.country].filter(Boolean);
      return parts.join(', ');
    }
    return address;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          backgroundColor: colors.card || colors.background,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '80vh',
          overflowY: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
          border: `1px solid ${colors.border}`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white'
            }}>
              <User size={24} />
            </div>
            <div>
              <h2 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: colors.text,
                margin: 0
              }}>
                {empleado.nombreCompleto}
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: 0
              }}>
                {empleado.puesto || 'Puesto no especificado'}
              </p>
            </div>
          </div>
          
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: colors.surface,
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: colors.textSecondary
            }}
          >
            <X size={16} />
          </motion.button>
        </div>

        {/* Información del empleado */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px'
        }}>
          {/* Información personal */}
          <div style={{
            backgroundColor: colors.surface,
            padding: '16px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <User size={14} />
              Información Personal
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>DNI/NIE:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.dni || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>NSS:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.nss || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Fecha nacimiento:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {formatDate(empleado.fechaNacimiento)}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Edad:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.edad || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Género:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.genero || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Nacionalidad:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.nacionalidad || 'No especificado'}
                </span>
              </div>
            </div>
          </div>

          {/* Información de contacto */}
          <div style={{
            backgroundColor: colors.surface,
            padding: '16px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Mail size={14} />
              Contacto
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Mail size={12} color={colors.primary} />
                <span style={{ fontSize: '14px', color: colors.text }}>
                  {empleado.email || 'No especificado'}
                </span>
              </div>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={12} color={colors.primary} />
                <span style={{ fontSize: '14px', color: colors.text }}>
                  {empleado.telefono || 'No especificado'}
                </span>
              </div>
              
              {empleado.telefonoEmpresa && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Phone size={12} color={colors.primary} />
                  <span style={{ fontSize: '14px', color: colors.text }}>
                    {empleado.telefonoEmpresa} (Empresa)
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Información laboral */}
          <div style={{
            backgroundColor: colors.surface,
            padding: '16px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Briefcase size={14} />
              Información Laboral
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Puesto:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.puesto || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Departamento:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.departamento || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Fecha alta:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {formatDate(empleado.fechaAlta)}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Estado:</span>
                <span style={{ 
                  fontSize: '14px', 
                  fontWeight: '500', 
                  color: empleado.activo ? colors.success : colors.error,
                  marginLeft: '8px'
                }}>
                  {empleado.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              {empleado.lugarTrabajo && (
                <div>
                  <span style={{ fontSize: '12px', color: colors.textSecondary }}>Lugar trabajo:</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                    {empleado.lugarTrabajo}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Dirección */}
          <div style={{
            backgroundColor: colors.surface,
            padding: '16px',
            borderRadius: '12px',
            border: `1px solid ${colors.border}`
          }}>
            <h3 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <MapPin size={14} />
              Dirección
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Dirección:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {formatAddress(empleado.direccion)}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Ciudad:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.ciudad || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Código postal:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.codigoPostal || 'No especificado'}
                </span>
              </div>
              
              <div>
                <span style={{ fontSize: '12px', color: colors.textSecondary }}>Provincia:</span>
                <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                  {empleado.provincia || 'No especificado'}
                </span>
              </div>
            </div>
          </div>

          {/* Información financiera */}
          {empleado.iban && (
            <div style={{
              backgroundColor: colors.surface,
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <CreditCard size={14} />
                Información Financiera
              </h3>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: colors.textSecondary }}>IBAN:</span>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginLeft: '8px' }}>
                    {empleado.iban}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Notas adicionales */}
          {empleado.notas && (
            <div style={{
              backgroundColor: colors.surface,
              padding: '16px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              gridColumn: '1 / -1'
            }}>
              <h3 style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <FileText size={14} />
                Notas
              </h3>
              
              <p style={{
                fontSize: '14px',
                color: colors.text,
                margin: 0,
                lineHeight: '1.5'
              }}>
                {empleado.notas}
              </p>
            </div>
          )}
        </div>

        {/* Sección de Historial de Servicios */}
        <div style={{ marginTop: '32px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '20px',
            paddingBottom: '12px',
            borderBottom: `2px solid ${colors.border}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <Calendar size={20} color={colors.primary} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                margin: 0,
                color: colors.text
              }}>
                Historial de Servicios
              </h3>
            </div>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                // Guardar el empleadoId en localStorage para que EmpleadosPage lo lea
                if (empleado?.id) {
                  localStorage.setItem('selectedEmpleadoId', String(empleado.id));
                }
                // Cerrar el modal
                onClose();
                // Navegar a la sección de empleados
                navigateTo('empleados');
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 16px',
                backgroundColor: colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              <ExternalLink size={16} />
              Ver en Empleados
            </motion.button>
          </div>

          {/* Estadísticas - Solo mostrar horas si tiene permisos */}
          {estadisticasHoras && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: canManageHoras ? 'repeat(auto-fit, minmax(150px, 1fr))' : 'repeat(auto-fit, minmax(150px, 1fr))',
              gap: '16px',
              marginBottom: '24px'
            }}>
              <div style={{
                backgroundColor: colors.surface,
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                textAlign: 'center'
              }}>
                <div style={{
                  fontSize: '24px',
                  fontWeight: '700',
                  color: colors.primary,
                  marginBottom: '4px'
                }}>
                  {estadisticasHoras.totalServicios}
                </div>
                <div style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  fontWeight: '500'
                }}>
                  Total Servicios
                </div>
              </div>

              {/* Total Horas - Solo visible para jefes/admins */}
              {canManageHoras && (
                <div style={{
                  backgroundColor: colors.surface,
                  padding: '16px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '24px',
                    fontWeight: '700',
                    color: colors.success,
                    marginBottom: '4px'
                  }}>
                    {estadisticasHoras.totalHoras}h
                  </div>
                  <div style={{
                    fontSize: '12px',
                    color: colors.textSecondary,
                    fontWeight: '500'
                  }}>
                    Total Horas
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Lista de servicios */}
          {historialServicios.length > 0 ? (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              maxHeight: '300px',
              overflowY: 'auto',
              overflowX: 'hidden',
              paddingRight: '4px'
            }}>
              {historialServicios.map((servicio, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  whileHover={{ 
                    borderColor: colors.primary,
                    backgroundColor: colors.hover || `${colors.primary}10`
                  }}
                  onClick={async () => {
                    // Guardar el hojaId en localStorage
                    if (servicio.hojaId) {
                      localStorage.setItem('selectedHojaRutaId', servicio.hojaId);
                    }
                    // Cerrar el modal
                    onClose();
                    // Navegar a la sección de hoja de ruta
                    // El HojaRutaPage detectará el cambio y cargará la hoja automáticamente
                    navigateTo('hoja-ruta');
                  }}
                  style={{
                    backgroundColor: colors.surface,
                    padding: '16px',
                    borderRadius: '12px',
                    border: `2px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div>
                    <div style={{
                      fontSize: '16px',
                      fontWeight: '600',
                      color: colors.text,
                      marginBottom: '4px'
                    }}>
                      {servicio.cliente}
                    </div>
                    <div style={{
                      fontSize: '14px',
                      color: colors.textSecondary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Calendar size={14} />
                      {new Date(servicio.fechaServicio).toLocaleDateString('es-ES')}
                    </div>
                  </div>

                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px'
                  }}>
                    {/* Horas - Solo visible para jefes/admins */}
                    {canManageHoras && (
                      <div style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: colors.primary
                      }}>
                        {servicio.horas}h
                      </div>
                    )}

                    <div style={{
                      padding: '4px 8px',
                      borderRadius: '12px',
                      fontSize: '12px',
                      fontWeight: '500',
                      backgroundColor: servicio.estado === 'completado' ? colors.success : colors.warning,
                      color: 'white'
                    }}>
                      {servicio.estado}
                    </div>
                    
                    <ExternalLink 
                      size={16} 
                      color={colors.primary}
                      style={{ marginLeft: '8px' }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '40px 20px',
              color: colors.textSecondary,
              fontSize: '14px'
            }}>
              <Calendar size={48} color={colors.textSecondary} style={{ marginBottom: '12px', opacity: 0.5 }} />
              <div>No hay servicios registrados</div>
              <div style={{ fontSize: '12px', marginTop: '4px' }}>
                Los servicios aparecerán aquí cuando se asignen horas en las hojas de ruta
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default EmpleadoDetailModal;


