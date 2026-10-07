import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, Save, AlertCircle } from 'lucide-react';
import fichajeService from '../services/fichajeService';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import { useTheme } from './ThemeContext';
import { formatTimeMadrid, formatDateFullMadrid, toDatetimeLocalMadrid } from '../utils/timeUtils';
import { useAuth } from './AuthContext';

const FichajeEditModal = ({ fichaje, empleadoNombre, onClose, onSave }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [anulando, setAnulando] = useState(false);
  
  // Estados del formulario
  const [horaEntrada, setHoraEntrada] = useState('');
  const [horaSalida, setHoraSalida] = useState('');
  const [motivo, setMotivo] = useState('');
  const [horasJornadaRef, setHorasJornadaRef] = useState('');
  const [contratoParcial, setContratoParcial] = useState(false);
  const [tipificacionManual, setTipificacionManual] = useState(false);
  const [horasOrdinarias, setHorasOrdinarias] = useState('');
  const [horasExtraordinarias, setHorasExtraordinarias] = useState('');
  const [horasComplementarias, setHorasComplementarias] = useState('');
  
  useEffect(() => {
    if (fichaje) {
      // Mostrar horas en Madrid (no UTC) para que coincidan con lo que ve el usuario
      const entrada = toDatetimeLocalMadrid(fichaje.hora_entrada);
      const salida = toDatetimeLocalMadrid(fichaje.hora_salida);
      setHoraEntrada(entrada);
      setHoraSalida(salida);
      setHorasJornadaRef(
        fichaje.horas_jornada_ref != null && fichaje.horas_jornada_ref !== ''
          ? String(fichaje.horas_jornada_ref)
          : ''
      );
      setContratoParcial(!!fichaje.contrato_parcial);
      setTipificacionManual(!!fichaje.tipificacion_manual);
      setHorasOrdinarias(
        fichaje.horas_ordinarias != null ? String(fichaje.horas_ordinarias) : ''
      );
      setHorasExtraordinarias(
        fichaje.horas_extraordinarias != null ? String(fichaje.horas_extraordinarias) : '0'
      );
      setHorasComplementarias(
        fichaje.horas_complementarias != null ? String(fichaje.horas_complementarias) : '0'
      );
    }
  }, [fichaje]);

  const handleAnular = async () => {
    if (!motivo.trim() || motivo.trim().length < 3) {
      setError('Para anular hace falta un motivo (mín. 3 caracteres). El registro no se borra.');
      return;
    }
    if (!window.confirm(
      '¿Anular este fichaje? No se elimina: queda marcado como anulado con auditoría (cumplimiento registro horario).'
    )) {
      return;
    }
    setAnulando(true);
    setError('');
    try {
      const res = await fichajeSupabaseService.anularFichaje(fichaje.id, motivo.trim());
      if (!res.success) throw new Error(res.error || 'No se pudo anular');
      if (onSave) onSave();
      onClose();
    } catch (err) {
      setError(err.message || 'Error al anular');
    } finally {
      setAnulando(false);
    }
  };

  const handleSave = async () => {
    if (!motivo.trim()) {
      setError('El motivo de la modificación es obligatorio');
      return;
    }

    if (!horaEntrada) {
      setError('La hora de entrada es obligatoria');
      return;
    }

    if (horaSalida && new Date(horaEntrada) >= new Date(horaSalida)) {
      setError('La hora de entrada debe ser anterior a la hora de salida');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const cambios = {
        hora_entrada: new Date(horaEntrada).toISOString()
      };

      if (horaSalida) {
        cambios.hora_salida = new Date(horaSalida).toISOString();
      } else {
        cambios.hora_salida = null;
      }

      if (horasJornadaRef !== '') {
        const n = parseFloat(String(horasJornadaRef).replace(',', '.'));
        if (!Number.isNaN(n)) cambios.horas_jornada_ref = n;
      } else {
        cambios.horas_jornada_ref = null;
      }
      cambios.contrato_parcial = !!contratoParcial;
      cambios.tipificacion_manual = !!tipificacionManual;
      if (tipificacionManual) {
        const parseH = (v) => {
          const n = parseFloat(String(v).replace(',', '.'));
          return Number.isNaN(n) ? 0 : n;
        };
        cambios.horas_ordinarias = parseH(horasOrdinarias);
        cambios.horas_extraordinarias = parseH(horasExtraordinarias);
        cambios.horas_complementarias = parseH(horasComplementarias);
      }

      const resultado = await fichajeService.modificarFichaje(
        fichaje.id,
        cambios,
        user?.id,
        motivo
      );

      if (!resultado.success) {
        setError(resultado.error || 'Error al modificar el fichaje');
        return;
      }

      // Llamar callback para actualizar la lista
      if (onSave) {
        onSave();
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Error inesperado al modificar el fichaje');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = formatDateFullMadrid;
  const formatTime = formatTimeMadrid;

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
                Editar Fichaje
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
            {/* Valores originales */}
            {fichaje.es_modificado && fichaje.valor_original && (
              <div style={{
                backgroundColor: colors.warning + '15',
                border: `1px solid ${colors.warning}`,
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '24px'
              }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '12px'
                }}>
                  <AlertCircle size={18} color={colors.warning} />
                  <h4 style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.warning,
                    margin: 0
                  }}>
                    Valores Originales
                  </h4>
                </div>
                <div style={{
                  fontSize: '13px',
                  color: colors.text,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '8px'
                }}>
                  <div>
                    <strong>Entrada:</strong> {formatTime(fichaje.valor_original.hora_entrada)}
                  </div>
                  {fichaje.valor_original.hora_salida && (
                    <div>
                      <strong>Salida:</strong> {formatTime(fichaje.valor_original.hora_salida)}
                    </div>
                  )}
                </div>
              </div>
            )}

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

            {/* Formulario */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Hora de entrada */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Hora de Entrada *
                </label>
                <input
                  type="datetime-local"
                  value={horaEntrada}
                  onChange={(e) => setHoraEntrada(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.text,
                    backgroundColor: colors.background,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                  required
                />
              </div>

              {/* Hora de salida */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Hora de Salida
                </label>
                <input
                  type="datetime-local"
                  value={horaSalida}
                  onChange={(e) => setHoraSalida(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.text,
                    backgroundColor: colors.background,
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                <p style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  margin: '6px 0 0 0'
                }}>
                  Deja vacío si el trabajador aún no ha fichado la salida
                </p>
              </div>

              {/* Tipología de horas */}
              <div style={{
                padding: '14px',
                borderRadius: '10px',
                border: `1px solid ${colors.border}`,
                backgroundColor: colors.background
              }}>
                <p style={{
                  margin: '0 0 12px 0',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text
                }}>
                  Tipología de horas
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: colors.textSecondary, marginBottom: 6 }}>
                      Jornada ref. (h/día)
                    </label>
                    <input
                      type="number"
                      step="0.25"
                      min="0"
                      value={horasJornadaRef}
                      onChange={(e) => setHorasJornadaRef(e.target.value)}
                      placeholder="ej. 8"
                      style={{
                        width: '100%',
                        padding: '10px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        fontSize: '14px',
                        color: colors.text,
                        backgroundColor: colors.surface,
                        boxSizing: 'border-box'
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.text }}>
                      <input
                        type="checkbox"
                        checked={contratoParcial}
                        onChange={(e) => setContratoParcial(e.target.checked)}
                      />
                      Contrato parcial (exceso → complementarias)
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: colors.text }}>
                      <input
                        type="checkbox"
                        checked={tipificacionManual}
                        onChange={(e) => setTipificacionManual(e.target.checked)}
                      />
                      Tipificación manual
                    </label>
                  </div>
                </div>
                {tipificacionManual && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 12 }}>
                    {[
                      ['Ordinarias', horasOrdinarias, setHorasOrdinarias],
                      ['Extraordinarias', horasExtraordinarias, setHorasExtraordinarias],
                      ['Complementarias', horasComplementarias, setHorasComplementarias]
                    ].map(([label, val, setter]) => (
                      <div key={label}>
                        <label style={{ display: 'block', fontSize: '12px', color: colors.textSecondary, marginBottom: 6 }}>
                          {label}
                        </label>
                        <input
                          type="number"
                          step="0.25"
                          min="0"
                          value={val}
                          onChange={(e) => setter(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '10px',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: colors.text,
                            backgroundColor: colors.surface,
                            boxSizing: 'border-box'
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p style={{ margin: '10px 0 0 0', fontSize: 12, color: colors.textSecondary }}>
                  Sin jornada de referencia, todas las horas se contabilizan como ordinarias.
                </p>
              </div>

              {/* Motivo */}
              <div>
                <label style={{
                  display: 'block',
                  fontSize: '14px',
                  fontWeight: '600',
                  color: colors.text,
                  marginBottom: '8px'
                }}>
                  Motivo de la Modificación *
                </label>
                <textarea
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                  placeholder="Explica el motivo de la modificación (obligatorio según normativa)"
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    color: colors.text,
                    backgroundColor: colors.background,
                    outline: 'none',
                    boxSizing: 'border-box',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  required
                />
                <p style={{
                  fontSize: '12px',
                  color: colors.textSecondary,
                  margin: '6px 0 0 0'
                }}>
                  El trabajador será notificado de este cambio y deberá validarlo
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            gap: '12px',
            flexWrap: 'wrap',
            alignItems: 'center'
          }}>
            <button
              type="button"
              onClick={handleAnular}
              disabled={loading || anulando || !!fichaje?.anulado_at}
              style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                color: colors.error || '#b91c1c',
                border: `1px solid ${colors.error || '#b91c1c'}`,
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: loading || anulando || fichaje?.anulado_at ? 'not-allowed' : 'pointer',
                opacity: fichaje?.anulado_at ? 0.45 : 1
              }}
              title="No borra el registro: lo marca como anulado con motivo y auditoría"
            >
              {anulando ? 'Anulando…' : 'Anular fichaje (no borrar)'}
            </button>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={onClose}
                disabled={loading || anulando}
                style={{
                  padding: '10px 24px',
                  backgroundColor: 'transparent',
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading || anulando ? 'not-allowed' : 'pointer',
                  opacity: loading || anulando ? 0.5 : 1
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={loading || anulando || !!fichaje?.anulado_at}
                style={{
                  padding: '10px 24px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: loading || anulando ? 'not-allowed' : 'pointer',
                  opacity: loading || anulando || fichaje?.anulado_at ? 0.5 : 1,
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
                    Guardando...
                  </>
                ) : (
                  <>
                    <Save size={16} />
                    Guardar Cambios
                  </>
                )}
              </button>
            </div>
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

export default FichajeEditModal;


