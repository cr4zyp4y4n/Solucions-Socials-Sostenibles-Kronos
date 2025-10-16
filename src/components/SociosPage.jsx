import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Mail, 
  Calendar,
  User,
  UserPlus,
  Filter,
  RefreshCw,
  Upload
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import sociosService from '../services/sociosService';
import SocioFormModal from './SocioFormModal';
import SocioEditModal from './SocioEditModal';
import ConfirmModal from './ConfirmModal';
import ImportSociosModal from './ImportSociosModal';
import CarnetSocioModal from './CarnetSocioModal';

const SociosPage = () => {
  const { colors, isDark } = useTheme();
  const { user } = useAuth();
  
  // Estados principales
  const [socios, setSocios] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [estadisticas, setEstadisticas] = useState(null);
  
  // Estados de modales
  const [showFormModal, setShowFormModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCarnetModal, setShowCarnetModal] = useState(false);
  const [selectedSocio, setSelectedSocio] = useState(null);
  const [socioToDelete, setSocioToDelete] = useState(null);

  // Verificar si el usuario puede gestionar socios
  const canManageSocios = useMemo(() => {
    // Si no hay usuario pero estamos autenticados, permitir gestión temporalmente
    const isAuthenticated = user || (typeof window !== 'undefined' && localStorage.getItem('supabase.auth.token'));
    const userRole = user?.role?.toLowerCase();
    const canManage = isAuthenticated && (
      !userRole || // Si no hay rol definido, permitir (temporal)
      ['admin', 'administrador', 'jefe', 'tienda'].includes(userRole)
    );
    
    console.log('🔐 Verificando permisos socios:', {
      user: user?.name || 'Usuario no detectado',
      role: userRole || 'Sin rol definido',
      isAuthenticated,
      canManage
    });
    return canManage;
  }, [user]);

  // Cargar datos
  const loadDatos = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [sociosData, statsData] = await Promise.all([
        sociosService.getSocios(),
        sociosService.getEstadisticas()
      ]);
      
      setSocios(sociosData);
      setEstadisticas(statsData);
    } catch (err) {
      console.error('Error cargando datos:', err);
      setError('Error al cargar los datos de socios');
    } finally {
      setLoading(false);
    }
  };

  // Efecto para cargar datos al montar el componente
  useEffect(() => {
    loadDatos();
  }, []);

  // Filtrar socios por término de búsqueda
  const sociosFiltrados = useMemo(() => {
    if (!searchTerm.trim()) return socios;
    
    const termino = searchTerm.toLowerCase();
    return socios.filter(socio => 
      socio.nombre.toLowerCase().includes(termino) ||
      socio.apellido.toLowerCase().includes(termino) ||
      socio.correo.toLowerCase().includes(termino) ||
      socio.id_unico.toString().includes(termino)
    );
  }, [socios, searchTerm]);

  // Manejar creación de socio
  const handleCrearSocio = async (socioData) => {
    try {
      const nuevoSocio = await sociosService.crearSocio(socioData);
      setSocios(prev => [nuevoSocio, ...prev]);
      setError(null);
      
      // Recargar estadísticas
      const statsData = await sociosService.getEstadisticas();
      setEstadisticas(statsData);
      
      return nuevoSocio;
    } catch (err) {
      console.error('Error creando socio:', err);
      throw err;
    }
  };

  // Manejar edición de socio
  const handleEditarSocio = async (socioData) => {
    try {
      const socioActualizado = await sociosService.actualizarSocio(selectedSocio.id, socioData);
      setSocios(prev => prev.map(socio => 
        socio.id === selectedSocio.id ? socioActualizado : socio
      ));
      setError(null);
      return socioActualizado;
    } catch (err) {
      console.error('Error editando socio:', err);
      throw err;
    }
  };

  // Manejar visualización del carnet
  const handleVerCarnet = (socio) => {
    setSelectedSocio(socio);
    setShowCarnetModal(true);
  };

  // Manejar eliminación de socio
  const handleEliminarSocio = (socio) => {
    setSocioToDelete(socio);
    setShowConfirmModal(true);
  };

  const confirmEliminarSocio = async () => {
    if (!socioToDelete) return;
    
    try {
      await sociosService.eliminarSocio(socioToDelete.id);
      setSocios(prev => prev.filter(socio => socio.id !== socioToDelete.id));
      setError(null);
      
      // Recargar estadísticas
      const statsData = await sociosService.getEstadisticas();
      setEstadisticas(statsData);
    } catch (err) {
      console.error('Error eliminando socio:', err);
      setError('Error al eliminar el socio');
    } finally {
      setSocioToDelete(null);
    }
  };

  // Manejar importación de socios
  const handleImportarSocios = async (sociosData) => {
    try {
      const sociosImportados = await sociosService.importarSocios(sociosData);
      
      // Añadir los nuevos socios al estado
      setSocios(prev => [...sociosImportados, ...prev]);
      setError(null);
      
      // Recargar estadísticas
      const statsData = await sociosService.getEstadisticas();
      setEstadisticas(statsData);
      
      return sociosImportados;
    } catch (err) {
      console.error('Error importando socios:', err);
      throw err;
    }
  };

  // Formatear fecha
  const formatFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '400px',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          style={{
            width: '40px',
            height: '40px',
            border: `4px solid ${colors.border}`,
            borderTop: `4px solid ${colors.primary}`,
            borderRadius: '50%'
          }}
        />
        <p style={{ color: colors.textSecondary, fontSize: '14px' }}>
          Cargando socios de IDONI...
        </p>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: 'bold',
            color: colors.text,
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Users size={32} color={colors.primary} />
            Socios de IDONI
          </h1>
          <p style={{
            fontSize: '16px',
            color: colors.textSecondary,
            margin: 0
          }}>
            Gestión de socios de la agrobotiga
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowFormModal(true)}
            style={{
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <UserPlus size={18} />
            Nuevo Socio
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowImportModal(true)}
            style={{
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Upload size={18} />
            Importar CSV
          </motion.button>
        </div>
      </div>

      {/* Estadísticas */}
      {estadisticas && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${colors.border}`,
            textAlign: 'center'
          }}>
            <Users size={24} color={colors.primary} style={{ marginBottom: '8px' }} />
            <h3 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: colors.text,
              margin: '0 0 4px 0'
            }}>
              {estadisticas.totalSocios}
            </h3>
            <p style={{
              fontSize: '14px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Total Socios
            </p>
          </div>

          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${colors.border}`,
            textAlign: 'center'
          }}>
            <Calendar size={24} color={colors.primary} style={{ marginBottom: '8px' }} />
            <h3 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: colors.text,
              margin: '0 0 4px 0'
            }}>
              {estadisticas.anoConMasSocios}
            </h3>
            <p style={{
              fontSize: '14px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Año con más socios
            </p>
          </div>

          <div style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            padding: '20px',
            border: `1px solid ${colors.border}`,
            textAlign: 'center'
          }}>
            <UserPlus size={24} color={colors.primary} style={{ marginBottom: '8px' }} />
            <h3 style={{
              fontSize: '24px',
              fontWeight: 'bold',
              color: colors.text,
              margin: '0 0 4px 0'
            }}>
              {estadisticas.sociosRecientes?.length || 0}
            </h3>
            <p style={{
              fontSize: '14px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Socios recientes
            </p>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        padding: '20px',
        border: `1px solid ${colors.border}`,
        marginBottom: '24px'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto',
          gap: '20px',
          alignItems: 'end'
        }}>
          {/* Barra de búsqueda */}
          <div>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textSecondary,
              marginBottom: '8px',
              display: 'block'
            }}>
              Buscar Socios
            </label>
            <div style={{ position: 'relative' }}>
              <Search 
                size={18} 
                color={colors.textSecondary} 
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  zIndex: 1
                }}
              />
              <input
                type="text"
                placeholder="Buscar por nombre, apellido, correo o ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: colors.background,
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Contador de resultados */}
          <div style={{ minWidth: '120px' }}>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textSecondary,
              marginBottom: '8px',
              display: 'block'
            }}>
              Resultados
            </label>
            <div style={{
              padding: '12px 16px',
              backgroundColor: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: colors.textSecondary,
              textAlign: 'center',
              whiteSpace: 'nowrap'
            }}>
              {sociosFiltrados.length} de {socios.length}
            </div>
          </div>

          {/* Botón actualizar */}
          <div>
            <label style={{
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textSecondary,
              marginBottom: '8px',
              display: 'block'
            }}>
              Acciones
            </label>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={loadDatos}
              style={{
                backgroundColor: colors.background,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: '12px 16px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                whiteSpace: 'nowrap'
              }}
            >
              <RefreshCw size={16} />
              Actualizar
            </motion.button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: colors.error + '20',
          border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            backgroundColor: colors.error,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontSize: '12px',
            fontWeight: 'bold'
          }}>
            !
          </div>
          <p style={{ color: colors.error, margin: 0, fontSize: '14px' }}>
            {error}
          </p>
        </div>
      )}

      {/* Lista de socios */}
      {sociosFiltrados.length > 0 ? (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden'
        }}>
          <div style={{
            padding: '20px',
            borderBottom: `1px solid ${colors.border}`,
            backgroundColor: colors.background
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: colors.text,
              margin: 0
            }}>
              Lista de Socios
            </h3>
          </div>

          {sociosFiltrados.map((socio, index) => (
            <motion.div
              key={socio.id}
              initial={false}
              animate={{ opacity: 1 }}
              whileHover={{ backgroundColor: colors.hover }}
              whileTap={{ scale: 0.99 }}
              style={{
                padding: '20px',
                borderBottom: index < sociosFiltrados.length - 1 ? `1px solid ${colors.border}` : 'none',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                userSelect: 'none'
              }}
            >
                <div style={{ flex: 1 }}>
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '50%',
                      backgroundColor: colors.primary + '20',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: colors.primary,
                      fontSize: '14px',
                      fontWeight: 'bold'
                    }}>
                      {socio.nombre.charAt(0)}{socio.apellido.charAt(0)}
                    </div>
                    
                    <div>
                      <h4 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: '0 0 4px 0'
                      }}>
                        {socio.nombre} {socio.apellido}
                      </h4>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px',
                        fontSize: '12px',
                        color: colors.textSecondary
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Mail size={12} />
                          <span>{socio.correo}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <User size={12} />
                          <span>ID: {socio.id_unico}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Calendar size={12} />
                          <span>Socio desde {formatFecha(socio.socio_desde)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  gap: '8px',
                  alignItems: 'center'
                }}>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleVerCarnet(socio)}
                    style={{
                      backgroundColor: colors.primary + '20',
                      color: colors.primary,
                      border: `1px solid ${colors.primary + '30'}`,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Users size={14} />
                    Carnet
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setSelectedSocio(socio);
                      setShowEditModal(true);
                    }}
                    style={{
                      backgroundColor: colors.surface,
                      color: colors.text,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Edit3 size={14} />
                    Editar
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleEliminarSocio(socio)}
                    style={{
                      backgroundColor: colors.error + '20',
                      color: colors.error,
                      border: `1px solid ${colors.error + '30'}`,
                      borderRadius: '6px',
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '500',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Trash2 size={14} />
                    Eliminar
                  </motion.button>
                </div>
              </motion.div>
            ))}
        </div>
      ) : (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '48px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <Users size={64} color={colors.textSecondary} style={{ marginBottom: '24px' }} />
          <h3 style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px 0'
          }}>
            {searchTerm ? 'No se encontraron socios' : 'No hay socios registrados'}
          </h3>
          <p style={{
            fontSize: '14px',
            color: colors.textSecondary,
            margin: '0 0 24px 0'
          }}>
            {searchTerm 
              ? 'Intenta con otros términos de búsqueda' 
              : 'Comienza añadiendo el primer socio de IDONI'
            }
          </p>
          {!searchTerm && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowFormModal(true)}
              style={{
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: '0 auto'
              }}
            >
              <UserPlus size={16} />
              Añadir Primer Socio
            </motion.button>
          )}
        </div>
      )}

      {/* Modales */}
      <SocioFormModal
        isOpen={showFormModal}
        onClose={() => setShowFormModal(false)}
        onCrearSocio={handleCrearSocio}
      />

      <SocioEditModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        socio={selectedSocio}
        onEditarSocio={handleEditarSocio}
      />

      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => {
          setShowConfirmModal(false);
          setSocioToDelete(null);
        }}
        onConfirm={confirmEliminarSocio}
        title="Eliminar Socio"
        message={`¿Estás seguro de que quieres eliminar a ${socioToDelete?.nombre} ${socioToDelete?.apellido}? Esta acción no se puede deshacer.`}
        confirmText="Eliminar"
        cancelText="Cancelar"
        type="danger"
      />

      <ImportSociosModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSocios={handleImportarSocios}
      />

      <CarnetSocioModal
        isOpen={showCarnetModal}
        onClose={() => setShowCarnetModal(false)}
        socio={selectedSocio}
      />
    </div>
  );
};

export default SociosPage;
