import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertCircle, CheckCircle, XCircle, Clock, User, Calendar } from 'lucide-react';
import fichajeService from '../services/fichajeService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { formatTimeMadrid, formatDateFullMadrid } from '../utils/timeUtils';

const FichajeNotificacionModal = ({ fichaje, empleadoNombre, onClose, onValidar }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const formatDate = formatDateFullMadrid;
  const formatTime = formatTimeMadrid;

  const handleAceptar = async () => {
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeService.validarCambioTrabajador(fichaje.id, user?.id, true);
      if (!resultado.success) {
        setError(resultado.error || 'Error al aceptar el cambio');
        return;
      }
      if (onValidar) {
        onValidar(true);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  const handleRechazar = async () => {
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeService.validarCambioTrabajador(fichaje.id, user?.id, false);
      if (!resultado.success) {
        setError(resultado.error || 'Error al rechazar el cambio');
        return;
      }
      if (onValidar) {
        onValidar(false);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Error inesperado');
    } finally {
      setLoading(false);
    }
  };

  if (!fichaje) return null;

  const valorOriginal = fichaje.valor_original || {};

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
            maxWidth: '600px',
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
            alignItems: 'center',
            backgroundColor: colors.warning + '15'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertCircle size={24} color={colors.warning} />
              <div>
                <h2 style={{
                  fontSize: '20px',
                  fontWeight: '700',
                  color: colors.text,
                  margin: 0,
                  marginBottom: '4px'
                }}>
                  Cambio en tu Fichaje
                </h2>
                <p style={{
                  fontSize: '14px',
                  color: colors.textSecondary,
                  margin: 0
                }}>
                  {formatDate(fichaje.fecha)} - {empleadoNombre}
                </p>
              </div>
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
            {/* Error */}
            {error && (
              <div style={{
                backgroundColor: colors.error + '15',
                border: `1px solid ${colors.error}`,
                padding: '12px',
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={18} color={colors.error} />
                <span style={{ color: colors.error, fontSize: '14px' }}>{error}</span>
              </div>
            )}

            <p style={{
              fontSize: '14px',
              color: colors.text,
              marginBottom: '24px',
              lineHeight: '1.6'
            }}>
              Se ha modificado tu fichaje. Por favor, revisa los cambios y confirma si son correctos.
            </p>

            {/* Comparación de valores */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '16px',
              marginBottom: '24px'
            }}>
              {/* Valores originales */}
              <div style={{
                backgroundColor: colors.background,
                padding: '16px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <Clock size={16} color={colors.textSecondary} />
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text,
                    margin: 0
                  }}>
                    Valores Originales
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Entrada
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                      {valorOriginal.hora_entrada ? formatTime(valorOriginal.hora_entrada) : 'N/A'}
                    </div>
                  </div>
                  {valorOriginal.hora_salida && (
                    <div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                        Salida
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                        {formatTime(valorOriginal.hora_salida)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Valores nuevos */}
              <div style={{
                backgroundColor: colors.warning + '15',
                padding: '16px',
                borderRadius: '12px',
                border: `2px solid ${colors.warning}`
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <AlertCircle size={16} color={colors.warning} />
                  <h3 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.warning,
                    margin: 0
                  }}>
                    Valores Modificados
                  </h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div>
                    <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                      Entrada
                    </div>
                    <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                      {formatTime(fichaje.hora_entrada)}
                    </div>
                  </div>
                  {fichaje.hora_salida && (
                    <div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                        Salida
                      </div>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                        {formatTime(fichaje.hora_salida)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Información adicional */}
            {fichaje.fecha_modificacion && (
              <div style={{
                backgroundColor: colors.background,
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                color: colors.textSecondary,
                marginBottom: '24px'
              }}>
                <strong>Modificado el:</strong> {new Date(fichaje.fecha_modificacion).toLocaleString('es-ES')}
              </div>
            )}
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <button
              onClick={handleRechazar}
              disabled={loading}
              style={{
                padding: '10px 24px',
                backgroundColor: 'transparent',
                color: colors.error,
                border: `2px solid ${colors.error}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <XCircle size={16} />
              Rechazar
            </button>
            <button
              onClick={handleAceptar}
              disabled={loading}
              style={{
                padding: '10px 24px',
                backgroundColor: colors.success,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {loading ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid rgba(255,255,255,0.3)`,
                    borderTop: `2px solid white`,
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Procesando...
                </>
              ) : (
                <>
                  <CheckCircle size={16} />
                  Aceptar
                </>
              )}
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

export default FichajeNotificacionModal;

