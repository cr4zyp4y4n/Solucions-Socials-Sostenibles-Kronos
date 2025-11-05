import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  User, 
  AlertTriangle,
  CheckCircle,
  Play,
  Pause,
  Square,
  BarChart3,
  Bell,
  Utensils,
  Coffee,
  Wine,
  ShieldCheck
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';

const ChecklistSection = ({ 
  hojaRuta, 
  onUpdateChecklist, 
  onCambiarEstado,
  estadisticas 
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('general');
  const [activeSubTab, setActiveSubTab] = useState('preEvento');

  if (!hojaRuta) return null;

  const estadosLabels = {
    'preparacion': 'Preparación',
    'en_camino': 'En Camino',
    'montaje': 'Montaje',
    'servicio': 'Servicio',
    'recogida': 'Recogida',
    'completado': 'Completado'
  };

  const iconosEstados = {
    'preparacion': '📋',
    'en_camino': '🚚',
    'montaje': '🔧',
    'servicio': '🍽️',
    'recogida': '📦',
    'completado': '✅'
  };

  const coloresPrioridad = {
    'alta': colors.error || '#EF4444',
    'media': colors.warning || '#F59E0B',
    'baja': colors.success || '#10B981'
  };

  const tabs = [
    { id: 'general', label: 'General', icon: BarChart3, subTabs: [
      { id: 'preEvento', label: 'Pre-Evento', icon: Clock },
      { id: 'duranteEvento', label: 'Durante Evento', icon: Play },
      { id: 'postEvento', label: 'Post-Evento', icon: Square }
    ]},
    { id: 'equipamiento', label: 'Equipamiento', icon: Utensils },
    { id: 'menus', label: 'Menús', icon: Coffee },
    { id: 'bebidas', label: 'Bebidas', icon: Wine }
  ];

  const handleToggleTarea = (tipo, fase, tareaId, completed) => {
    console.log('🔄 Toggle tarea:', { tipo, fase, tareaId, completed });
    onUpdateChecklist(hojaRuta.id, tipo, fase, tareaId, completed, user?.name || user?.email || 'Usuario');
  };

  const handleCambiarEstado = (nuevoEstado) => {
    onCambiarEstado(hojaRuta.id, nuevoEstado);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleString('es-ES');
  };

  // Obtener tareas actuales basándose en la tab activa
  const tareasActuales = useMemo(() => {
    // Asegurar que la estructura existe
    if (!hojaRuta.checklist) {
      return [];
    }
    
    // Migrar estructura antigua si es necesario
    if (hojaRuta.checklist.preEvento && !hojaRuta.checklist.general) {
      hojaRuta.checklist = {
        general: {
          preEvento: hojaRuta.checklist.preEvento || [],
          duranteEvento: hojaRuta.checklist.duranteEvento || [],
          postEvento: hojaRuta.checklist.postEvento || []
        },
        equipamiento: hojaRuta.checklist.equipamiento || [],
        menus: hojaRuta.checklist.menus || [],
        bebidas: hojaRuta.checklist.bebidas || []
      };
    }
    
    if (activeTab === 'general') {
      return hojaRuta.checklist.general?.[activeSubTab] || [];
    } else {
      return hojaRuta.checklist[activeTab] || [];
    }
  }, [hojaRuta.checklist, activeTab, activeSubTab]);

  return (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${colors.border}`,
      marginBottom: '24px'
    }}>
      {/* Header con estadísticas */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '24px'
      }}>
        <div>
          <h3 style={{ 
            fontSize: '20px', 
            fontWeight: 'bold', 
            color: colors.text,
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <BarChart3 size={24} color={colors.primary} />
            Checklist de Servicio
          </h3>
          
          {/* Estadísticas generales */}
          <div style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: colors.textSecondary
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: colors.success
              }} />
              <span>{estadisticas?.completadas || 0} completadas</span>
            </div>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '14px',
              color: colors.textSecondary
            }}>
              <div style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: colors.border
              }} />
              <span>{estadisticas?.pendientes || 0} pendientes</span>
            </div>
            <div style={{
              fontSize: '16px',
              fontWeight: 'bold',
              color: colors.primary
            }}>
              {estadisticas?.porcentaje || 0}%
            </div>
          </div>
        </div>
      </div>

      {/* Tabs principales */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '20px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          let tabStats;
          
          if (tab.id === 'general') {
            tabStats = estadisticas?.porFase?.[activeSubTab];
          } else {
            tabStats = estadisticas?.porElemento?.[tab.id];
          }
          
          const isActive = activeTab === tab.id;
          
          return (
            <motion.button
              key={tab.id}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                setActiveTab(tab.id);
                if (tab.id === 'general') {
                  setActiveSubTab('preEvento');
                }
              }}
              style={{
                padding: '12px 16px',
                backgroundColor: isActive ? colors.primary : 'transparent',
                color: isActive ? 'white' : colors.text,
                border: 'none',
                borderRadius: '8px 8px 0 0',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '14px',
                fontWeight: '500',
                position: 'relative'
              }}
            >
              <Icon size={16} />
              <span>{tab.label}</span>
              {tabStats && (
                <div style={{
                  backgroundColor: isActive ? 'rgba(255,255,255,0.2)' : colors.background,
                  color: isActive ? 'white' : colors.textSecondary,
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '12px',
                  fontWeight: 'bold'
                }}>
                  {tabStats.completadas}/{tabStats.total}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Sub-tabs para General */}
      {activeTab === 'general' && (
        <div style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          paddingLeft: '16px'
        }}>
          {tabs.find(t => t.id === 'general').subTabs.map(subTab => {
            const Icon = subTab.icon;
            const tabStats = estadisticas?.porFase?.[subTab.id];
            const isActive = activeSubTab === subTab.id;
            
            return (
              <motion.button
                key={subTab.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveSubTab(subTab.id)}
                style={{
                  padding: '8px 12px',
                  backgroundColor: isActive ? colors.background : 'transparent',
                  color: isActive ? colors.primary : colors.textSecondary,
                  border: `1px solid ${isActive ? colors.primary : colors.border}`,
                  borderRadius: '6px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: '500'
                }}
              >
                <Icon size={14} />
                <span>{subTab.label}</span>
                {tabStats && (
                  <div style={{
                    backgroundColor: isActive ? colors.primary + '20' : colors.background,
                    color: isActive ? colors.primary : colors.textSecondary,
                    borderRadius: '10px',
                    padding: '1px 6px',
                    fontSize: '10px',
                    fontWeight: 'bold'
                  }}>
                    {tabStats.completadas}/{tabStats.total}
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* Lista de tareas */}
      <div style={{
        display: 'grid',
        gap: '12px'
      }}>
        {tareasActuales.map((tarea, index) => (
          <motion.div
            key={tarea.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            style={{
              padding: '16px',
              backgroundColor: colors.background,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              opacity: tarea.completed ? 0.7 : 1
            }}
          >
            {/* Checkbox */}
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => {
                const tipo = activeTab === 'general' ? 'general' : activeTab;
                const fase = activeTab === 'general' ? activeSubTab : '';
                handleToggleTarea(tipo, fase, tarea.id, !tarea.completed);
              }}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              {tarea.completed ? (
                <CheckCircle2 size={24} color={colors.success} />
              ) : (
                <Circle size={24} color={colors.textSecondary} />
              )}
            </motion.button>

            {/* Contenido de la tarea */}
            <div style={{ flex: 1 }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '4px'
              }}>
                <span style={{
                  fontSize: '16px',
                  fontWeight: '500',
                  color: tarea.completed ? colors.textSecondary : colors.text,
                  textDecoration: tarea.completed ? 'line-through' : 'none'
                }}>
                  {tarea.task}
                </span>
                
                {/* Indicador de prioridad */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: coloresPrioridad[tarea.priority]
                }} />
                
                <span style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  fontWeight: '600'
                }}>
                  {tarea.priority}
                </span>
              </div>

              {/* Información adicional */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                fontSize: '12px',
                color: colors.textSecondary
              }}>
                {tarea.assignedTo && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <User size={12} />
                    <span>{tarea.assignedTo}</span>
                  </div>
                )}
                
                {tarea.completedAt && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}>
                    <CheckCircle size={12} />
                    <span>{formatFecha(tarea.completedAt)}</span>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Indicador de verificación */}
      {hojaRuta?.firmaInfo?.firmado && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          style={{
            marginTop: '24px',
            padding: '16px',
            backgroundColor: colors.success + '15',
            border: `2px solid ${colors.success}`,
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <ShieldCheck size={24} color={colors.success} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text,
              marginBottom: '4px'
            }}>
              ✓ Listas verificadas
            </div>
            <div style={{
              fontSize: '12px',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>Verificado por: <strong>{hojaRuta.firmaInfo.firmadoPor || hojaRuta.firmaInfo.firmado_por || 'N/A'}</strong></span>
              {(hojaRuta.firmaInfo.fechaFirma || hojaRuta.firmaInfo.fecha_firma) && (
                <>
                  <span>•</span>
                  <span>{formatFecha(hojaRuta.firmaInfo.fechaFirma || hojaRuta.firmaInfo.fecha_firma)}</span>
                </>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default ChecklistSection;
