import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, User, Calendar, AlertCircle, CheckCircle, XCircle, Coffee, UtensilsCrossed } from 'lucide-react';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import { useTheme } from './ThemeContext';
import { formatTimeMadridWithSeconds, formatDateFullMadrid, formatDateTimeMadrid } from '../utils/timeUtils';

const FichajeDetailsModal = ({ fichaje, empleadoNombre, onClose }) => {
  const { colors } = useTheme();
  const [pausas, setPausas] = useState([]);
  const [auditoria, setAuditoria] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetails = async () => {
      if (!fichaje) return;
      
      setLoading(true);
      try {
        // Cargar pausas
        const { data: pausasData } = await fichajeSupabaseService.obtenerPausas(fichaje.id);
        setPausas(pausasData || []);

        // Cargar auditoría
        const { data: auditoriaData } = await fichajeSupabaseService.obtenerAuditoria(fichaje.id);
        setAuditoria(auditoriaData || []);
      } catch (error) {
        console.error('Error cargando detalles:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDetails();
  }, [fichaje]);

  const formatDate = formatDateFullMadrid;
  const formatTime = formatTimeMadridWithSeconds;
  const formatDateTime = formatDateTimeMadrid;

  const formatDuracion = (minutos) => {
    if (!minutos && minutos !== 0) return '0m';
    if (minutos < 60) return `${minutos}m`;
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    return mins > 0 ? `${horas}h ${mins}m` : `${horas}h`;
  };

  const getTipoPausaIcon = (tipo) => {
    switch (tipo) {
      case 'comida':
        return <UtensilsCrossed size={16} />;
      case 'descanso':
        return <Coffee size={16} />;
      default:
        return <Clock size={16} />;
    }
  };

  const getTipoPausaLabel = (tipo) => {
    switch (tipo) {
      case 'comida':
        return 'Comida';
      case 'descanso':
        return 'Descanso';
      default:
        return 'Otro';
    }
  };

  if (!fichaje) return null;

  return (
    <AnimatePresence>
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
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          onClick={(e) => e.stopPropagation()}
          style={{
            backgroundColor: colors.surface,
            borderRadius: '16px',
            width: '100%',
            maxWidth: '800px',
            maxHeight: '90vh',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <h2 style={{
                fontSize: '24px',
                fontWeight: '700',
                color: colors.text,
                margin: 0,
                marginBottom: '4px'
              }}>
                Detalles del Fichaje
              </h2>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: 0
              }}>
                {formatDate(fichaje.fecha)} - {empleadoNombre}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: colors.textSecondary,
                padding: '8px',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={24} />
            </button>
          </div>

          {/* Content */}
          <div style={{
            padding: '24px',
            overflowY: 'auto',
            flex: 1
          }}>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  border: `4px solid ${colors.border}`,
                  borderTop: `4px solid ${colors.primary}`,
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 16px'
                }} />
                <p style={{ color: colors.textSecondary }}>Cargando detalles...</p>
              </div>
            ) : (
              <>
                {/* Información básica */}
                <div style={{
                  backgroundColor: colors.background,
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: colors.text,
                    margin: 0,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Clock size={20} />
                    Información del Fichaje
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                    <div>
                      <label style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                      }}>
                        Hora de Entrada
                      </label>
                      <p style={{
                        fontSize: '16px',
                        color: colors.text,
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {formatTime(fichaje.hora_entrada)}
                      </p>
                    </div>
                    
                    <div>
                      <label style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                      }}>
                        Hora de Salida
                      </label>
                      <p style={{
                        fontSize: '16px',
                        color: colors.text,
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {fichaje.hora_salida ? formatTime(fichaje.hora_salida) : 'No fichado'}
                      </p>
                    </div>
                    
                    <div>
                      <label style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                      }}>
                        Horas Trabajadas
                      </label>
                      <p style={{
                        fontSize: '16px',
                        color: colors.text,
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {fichaje.horas_trabajadas || 0}h
                      </p>
                    </div>
                    
                    <div>
                      <label style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        fontWeight: '600',
                        letterSpacing: '0.5px'
                      }}>
                        Horas Totales
                      </label>
                      <p style={{
                        fontSize: '16px',
                        color: colors.text,
                        margin: '4px 0 0 0',
                        fontWeight: '500'
                      }}>
                        {fichaje.horas_totales || 0}h
                      </p>
                    </div>
                  </div>

                  {/* Estado */}
                  <div style={{ marginTop: '16px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                    {fichaje.es_modificado && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: colors.warning + '15',
                        borderRadius: '6px'
                      }}>
                        <AlertCircle size={14} color={colors.warning} />
                        <span style={{ color: colors.warning, fontSize: '12px', fontWeight: '600' }}>
                          Modificado
                        </span>
                      </div>
                    )}
                    
                    {fichaje.validado_por_trabajador !== null && (
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: fichaje.validado_por_trabajador 
                          ? colors.success + '15' 
                          : colors.error + '15',
                        borderRadius: '6px'
                      }}>
                        {fichaje.validado_por_trabajador ? (
                          <>
                            <CheckCircle size={14} color={colors.success} />
                            <span style={{ color: colors.success, fontSize: '12px', fontWeight: '600' }}>
                              Validado
                            </span>
                          </>
                        ) : (
                          <>
                            <XCircle size={14} color={colors.error} />
                            <span style={{ color: colors.error, fontSize: '12px', fontWeight: '600' }}>
                              Rechazado
                            </span>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Pausas */}
                <div style={{
                  backgroundColor: colors.background,
                  padding: '20px',
                  borderRadius: '12px',
                  marginBottom: '24px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h3 style={{
                    fontSize: '18px',
                    fontWeight: '600',
                    color: colors.text,
                    margin: 0,
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Coffee size={20} />
                    Pausas ({pausas.length})
                  </h3>
                  
                  {pausas.length === 0 ? (
                    <p style={{ color: colors.textSecondary, fontSize: '14px', margin: 0 }}>
                      No hay pausas registradas
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {pausas.map((pausa, index) => (
                        <div
                          key={pausa.id}
                          style={{
                            padding: '12px',
                            backgroundColor: colors.surface,
                            borderRadius: '8px',
                            border: `1px solid ${colors.border}`,
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            {getTipoPausaIcon(pausa.tipo)}
                            <div>
                              <p style={{
                                margin: 0,
                                fontSize: '14px',
                                fontWeight: '600',
                                color: colors.text
                              }}>
                                {getTipoPausaLabel(pausa.tipo)}
                              </p>
                              <p style={{
                                margin: '4px 0 0 0',
                                fontSize: '12px',
                                color: colors.textSecondary
                              }}>
                                {formatTime(pausa.inicio)} {pausa.fin ? `- ${formatTime(pausa.fin)}` : '(En curso)'}
                              </p>
                            </div>
                          </div>
                          <div style={{
                            padding: '6px 12px',
                            backgroundColor: colors.primary + '15',
                            borderRadius: '6px'
                          }}>
                            <span style={{
                              fontSize: '14px',
                              fontWeight: '600',
                              color: colors.primary
                            }}>
                              {formatDuracion(pausa.duracion_minutos)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Auditoría */}
                {auditoria.length > 0 && (
                  <div style={{
                    backgroundColor: colors.background,
                    padding: '20px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h3 style={{
                      fontSize: '18px',
                      fontWeight: '600',
                      color: colors.text,
                      margin: 0,
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <AlertCircle size={20} />
                      Historial de Cambios
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {auditoria.map((registro) => (
                        <div
                          key={registro.id}
                          style={{
                            padding: '12px',
                            backgroundColor: colors.surface,
                            borderRadius: '8px',
                            border: `1px solid ${colors.border}`
                          }}
                        >
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'start',
                            marginBottom: '8px'
                          }}>
                            <span style={{
                              fontSize: '12px',
                              fontWeight: '600',
                              color: colors.text,
                              textTransform: 'uppercase'
                            }}>
                              {registro.accion}
                            </span>
                            <span style={{
                              fontSize: '12px',
                              color: colors.textSecondary
                            }}>
                              {formatDateTime(registro.cuando)}
                            </span>
                          </div>
                          
                          {registro.valor_anterior && registro.valor_nuevo && (
                            <div style={{
                              marginTop: '8px',
                              padding: '8px',
                              backgroundColor: colors.background,
                              borderRadius: '6px',
                              fontSize: '12px',
                              color: colors.textSecondary
                            }}>
                              <div style={{ marginBottom: '4px' }}>
                                <strong>Anterior:</strong> {JSON.stringify(registro.valor_anterior, null, 2)}
                              </div>
                              <div>
                                <strong>Nuevo:</strong> {JSON.stringify(registro.valor_nuevo, null, 2)}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              style={{
                padding: '10px 24px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Cerrar
            </button>
          </div>

          {/* CSS para animación */}
          <style>
            {`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
            `}
          </style>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FichajeDetailsModal;


