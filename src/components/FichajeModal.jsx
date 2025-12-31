import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Calendar, Clock, Save, AlertCircle, RefreshCw } from 'lucide-react';
import fichajeService from '../services/fichajeService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';

const FichajeModal = ({ isOpen, onClose, empleadoId, onSuccess }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  // Estados del formulario
  const [fecha, setFecha] = useState(() => {
    const hoy = new Date();
    hoy.setDate(hoy.getDate() - 1); // Por defecto ayer
    return hoy.toISOString().split('T')[0];
  });
  const [horaEntrada, setHoraEntrada] = useState('09:00');
  const [horaSalida, setHoraSalida] = useState('18:00');
  const [incluirSalida, setIncluirSalida] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Validar que la fecha no sea futura
  const fechaMaxima = new Date().toISOString().split('T')[0];

  // Validar que la hora de entrada sea anterior a la de salida
  const validarHoras = () => {
    if (!incluirSalida) return true;
    
    const entrada = new Date(`${fecha}T${horaEntrada}`);
    const salida = new Date(`${fecha}T${horaSalida}`);
    
    return entrada < salida;
  };

  // Manejar envío
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validaciones
    if (!fecha) {
      setError('Por favor, selecciona una fecha');
      return;
    }

    if (!horaEntrada) {
      setError('Por favor, indica la hora de entrada');
      return;
    }

    if (incluirSalida && !horaSalida) {
      setError('Por favor, indica la hora de salida');
      return;
    }

    if (!validarHoras()) {
      setError('La hora de entrada debe ser anterior a la hora de salida');
      return;
    }

    // Validar que la fecha no sea futura
    const fechaSeleccionada = new Date(fecha);
    const hoy = new Date();
    hoy.setHours(23, 59, 59, 999);
    
    if (fechaSeleccionada > hoy) {
      setError('No puedes añadir fichajes para fechas futuras');
      return;
    }

    setLoading(true);
    try {
      // Crear objetos Date para las horas
      const entrada = new Date(`${fecha}T${horaEntrada}`);
      const salida = incluirSalida ? new Date(`${fecha}T${horaSalida}`) : null;

      const resultado = await fichajeService.añadirFichajePosteriori(
        empleadoId,
        new Date(fecha),
        entrada,
        salida,
        user?.id
      );

      if (resultado.success) {
        if (onSuccess) {
          onSuccess(resultado.data);
        }
        onClose();
        // Resetear formulario
        setFecha(() => {
          const hoy = new Date();
          hoy.setDate(hoy.getDate() - 1);
          return hoy.toISOString().split('T')[0];
        });
        setHoraEntrada('09:00');
        setHoraSalida('18:00');
        setIncluirSalida(true);
      } else {
        setError(resultado.error || 'Error al añadir el fichaje');
      }
    } catch (err) {
      setError('Error inesperado al añadir el fichaje');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
          backgroundColor: 'rgba(0,0,0,0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000,
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
            backgroundColor: colors.background,
            borderRadius: '16px',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
          }}
        >
          {/* Header */}
          <div style={{
            padding: '24px',
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <div>
              <h2 style={{ 
                fontSize: '20px', 
                fontWeight: '700', 
                color: colors.text, 
                margin: 0,
                marginBottom: '4px'
              }}>
                Añadir Fichaje Olvidado
              </h2>
              <p style={{ 
                fontSize: '13px', 
                color: colors.textSecondary, 
                margin: 0 
              }}>
                Registra un fichaje que olvidaste hacer
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: colors.textSecondary,
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px'
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Formulario */}
          <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
            {error && (
              <div style={{
                padding: '12px 16px',
                backgroundColor: colors.error + '15',
                border: `1px solid ${colors.error}`,
                borderRadius: '8px',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <AlertCircle size={16} color={colors.error} />
                <span style={{ color: colors.error, fontSize: '14px' }}>{error}</span>
              </div>
            )}

            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Fecha */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: colors.text, 
                  marginBottom: '8px' 
                }}>
                  <Calendar size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Fecha del fichaje
                </label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  max={fechaMaxima}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.text,
                    backgroundColor: colors.surface,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{ 
                  fontSize: '12px', 
                  color: colors.textSecondary, 
                  marginTop: '4px',
                  margin: '4px 0 0 0'
                }}>
                  No puedes añadir fichajes para fechas futuras
                </p>
              </div>

              {/* Hora de entrada */}
              <div>
                <label style={{ 
                  display: 'block', 
                  fontSize: '14px', 
                  fontWeight: '600', 
                  color: colors.text, 
                  marginBottom: '8px' 
                }}>
                  <Clock size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                  Hora de entrada
                </label>
                <input
                  type="time"
                  value={horaEntrada}
                  onChange={(e) => setHoraEntrada(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.text,
                    backgroundColor: colors.surface,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Checkbox para incluir salida */}
              <div style={{
                padding: '12px',
                backgroundColor: colors.surface,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`
              }}>
                <label style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: colors.text
                }}>
                  <input
                    type="checkbox"
                    checked={incluirSalida}
                    onChange={(e) => setIncluirSalida(e.target.checked)}
                    style={{
                      width: '18px',
                      height: '18px',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Incluir hora de salida</span>
                </label>
              </div>

              {/* Hora de salida */}
              {incluirSalida && (
                <div>
                  <label style={{ 
                    display: 'block', 
                    fontSize: '14px', 
                    fontWeight: '600', 
                    color: colors.text, 
                    marginBottom: '8px' 
                  }}>
                    <Clock size={16} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                    Hora de salida
                  </label>
                  <input
                    type="time"
                    value={horaSalida}
                    onChange={(e) => setHoraSalida(e.target.value)}
                    required={incluirSalida}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      fontSize: '14px',
                      color: colors.text,
                      backgroundColor: colors.surface,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>
              )}

              {/* Información importante */}
              <div style={{
                padding: '12px 16px',
                backgroundColor: colors.info + '15',
                border: `1px solid ${colors.info}`,
                borderRadius: '8px',
                fontSize: '13px',
                color: colors.text
              }}>
                <strong>Importante:</strong> Este fichaje se marcará como modificado y quedará registrado en el historial de auditoría.
              </div>
            </div>

            {/* Botones */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              justifyContent: 'flex-end'
            }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  opacity: loading ? 0.6 : 1
                }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Fichaje
                  </>
                )}
              </button>
            </div>
          </form>

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

export default FichajeModal;

