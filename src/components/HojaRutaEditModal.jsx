import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Edit3, 
  X, 
  Save, 
  Calendar, 
  Users, 
  Clock, 
  MapPin, 
  Phone, 
  Truck,
  AlertCircle,
  CheckCircle,
  Pen
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import hojaRutaService from '../services/hojaRutaService';
import SignaturePad from './SignaturePad';

const HojaRutaEditModal = ({ isOpen, onClose, hojaRuta, onEditSuccess }) => {
  const { colors } = useTheme();
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  
  // Verificar si ya está firmada
  const yaEstaFirmada = hojaRuta?.firmaInfo?.firmado || false;

  // Inicializar datos del formulario
  useEffect(() => {
    if (hojaRuta && isOpen) {
      setFormData({
        fechaServicio: hojaRuta.fechaServicio || '',
        cliente: hojaRuta.cliente || '',
        contacto: hojaRuta.contacto || '',
        direccion: hojaRuta.direccion || '',
        transportista: hojaRuta.transportista || '',
        personal: hojaRuta.personal || '',
        responsable: hojaRuta.responsable || '',
        firmaResponsable: hojaRuta.firmaResponsable || hojaRuta.firmaInfo?.firma_data || hojaRuta.firmaInfo?.firmado_por || hojaRuta.firmaInfo?.firmadoPor || '',
        numPersonas: hojaRuta.numPersonas || 0,
        horarios: {
          montaje: hojaRuta.horarios?.montaje || '',
          welcome: hojaRuta.horarios?.welcome || '',
          desayuno: hojaRuta.horarios?.desayuno || '',
          comida: hojaRuta.horarios?.comida || '',
          recogida: hojaRuta.horarios?.recogida || ''
        }
      });
      setError(null);
      setSuccess(false);
    }
  }, [hojaRuta, isOpen]);

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleHorarioChange = (horario, value) => {
    setFormData(prev => ({
      ...prev,
      horarios: {
        ...prev.horarios,
        [horario]: value
      }
    }));
  };

  const handleSignatureSave = (signatureData) => {
    // No permitir cambiar la firma si ya está firmada
    if (yaEstaFirmada) {
      setShowSignaturePad(false);
      return;
    }
    setFormData(prev => ({
      ...prev,
      firmaResponsable: signatureData
    }));
    setShowSignaturePad(false);
  };

  const handleSignatureCancel = () => {
    setShowSignaturePad(false);
  };

  const handleSave = async () => {
    if (!hojaRuta?.id) return;

    setSaving(true);
    setError(null);

    try {
      const updated = hojaRutaService.updateHojaRuta(hojaRuta.id, formData);
      if (updated) {
        setSuccess(true);
        setTimeout(() => {
          onEditSuccess(updated);
          onClose();
        }, 1500);
      } else {
        setError('Error al actualizar la hoja de ruta');
      }
    } catch (err) {
      console.error('Error editando hoja:', err);
      setError('Error al guardar los cambios');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    setFormData({});
    setError(null);
    setSuccess(false);
    setSaving(false);
    onClose();
  };

  const formatHora = (hora) => {
    if (!hora) return '';
    return hora.replace('H', 'h');
  };

  if (!isOpen || !hojaRuta) return null;

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
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: `1px solid ${colors.border}`
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Edit3 size={28} color={colors.primary} />
            Editar Hoja de Ruta
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={24} color={colors.textSecondary} />
          </motion.button>
        </div>

        {/* Success message */}
        {success && (
          <div style={{
            backgroundColor: colors.success + '20',
            border: `1px solid ${colors.success}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <CheckCircle size={20} color={colors.success} />
            <span style={{ color: colors.success, fontWeight: '500' }}>
              Hoja de ruta actualizada correctamente
            </span>
          </div>
        )}

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
            <AlertCircle size={20} color={colors.error} />
            <span style={{ color: colors.error, fontWeight: '500' }}>{error}</span>
          </div>
        )}

        {/* Formulario */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Información General */}
          <div style={{
            backgroundColor: colors.background,
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
              <Calendar size={20} color={colors.primary} />
              Información General
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Fecha del Servicio
                </label>
                <input
                  type="text"
                  value={formData.fechaServicio || ''}
                  onChange={(e) => handleInputChange('fechaServicio', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px'
                  }}
                  placeholder="Ej: MARTES 20.05.2025"
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Cliente
                </label>
                <input
                  type="text"
                  value={formData.cliente || ''}
                  onChange={(e) => handleInputChange('cliente', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px'
                  }}
                  placeholder="Nombre del cliente"
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Nº Personas
                </label>
                <input
                  type="number"
                  value={formData.numPersonas || ''}
                  onChange={(e) => handleInputChange('numPersonas', parseInt(e.target.value) || 0)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px'
                  }}
                  placeholder="Número de personas"
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Responsable
                </label>
                <input
                  type="text"
                  value={formData.responsable || ''}
                  onChange={(e) => handleInputChange('responsable', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px'
                  }}
                  placeholder="Responsable del servicio"
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Verificación de Listas y Material
                </label>
                <div style={{
                  display: 'flex',
                  gap: '12px',
                  alignItems: 'center'
                }}>
                  {formData.firmaResponsable ? (
                    <div style={{
                      flex: 1,
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      backgroundColor: colors.surface,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: colors.text,
                        textTransform: 'uppercase',
                        letterSpacing: '1px'
                      }}>
                        {typeof formData.firmaResponsable === 'string' && !formData.firmaResponsable.startsWith('data:') 
                          ? formData.firmaResponsable 
                          : 'Firmado'}
                      </div>
                      <span style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        fontStyle: 'italic'
                      }}>
                        Firma guardada
                      </span>
                    </div>
                  ) : (
                    <div style={{
                      flex: 1,
                      padding: '12px',
                      border: `1px dashed ${colors.border}`,
                      borderRadius: '8px',
                      backgroundColor: colors.background,
                      textAlign: 'center',
                      color: colors.textSecondary,
                      fontSize: '14px'
                    }}>
                      No hay firma guardada
                    </div>
                  )}
                  
                  {!yaEstaFirmada ? (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowSignaturePad(true)}
                      style={{
                        padding: '12px',
                        backgroundColor: colors.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      <Pen size={16} />
                      {formData.firmaResponsable ? 'Cambiar' : 'Firmar'}
                    </motion.button>
                  ) : (
                    <div style={{
                      padding: '12px',
                      backgroundColor: colors.success + '20',
                      color: colors.success,
                      border: `1px solid ${colors.success}`,
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontWeight: '500',
                      textAlign: 'center'
                    }}>
                      ✓ Ya firmada
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Transportista
                </label>
                <input
                  type="text"
                  value={formData.transportista || ''}
                  onChange={(e) => handleInputChange('transportista', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px'
                  }}
                  placeholder="Nombre del transportista"
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Personal
                </label>
                <input
                  type="text"
                  value={formData.personal || ''}
                  onChange={(e) => handleInputChange('personal', e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px'
                  }}
                  placeholder="Personal asignado"
                />
              </div>
            </div>

            {/* Contacto y Dirección */}
            <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Contacto
                </label>
                <textarea
                  value={formData.contacto || ''}
                  onChange={(e) => handleInputChange('contacto', e.target.value)}
                  rows={2}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="Información de contacto"
                />
              </div>

              <div>
                <label style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: colors.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  marginBottom: '8px',
                  display: 'block'
                }}>
                  Dirección
                </label>
                <textarea
                  value={formData.direccion || ''}
                  onChange={(e) => handleInputChange('direccion', e.target.value)}
                  rows={3}
                  style={{
                    width: '100%',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    fontSize: '14px',
                    resize: 'vertical'
                  }}
                  placeholder="Dirección completa del servicio"
                />
              </div>
            </div>
          </div>

          {/* Horarios */}
          <div style={{
            backgroundColor: colors.background,
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
              <Clock size={20} color={colors.primary} />
              Horarios
            </h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
              {Object.entries(formData.horarios || {}).map(([key, value]) => (
                <div key={key}>
                  <label style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: colors.textSecondary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: '8px',
                    display: 'block'
                  }}>
                    {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                  </label>
                  <input
                    type="text"
                    value={value || ''}
                    onChange={(e) => handleHorarioChange(key, e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      backgroundColor: colors.surface,
                      color: colors.text,
                      fontSize: '14px'
                    }}
                    placeholder="Ej: 7:30H"
                  />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Botones */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end',
          marginTop: '32px',
          paddingTop: '24px',
          borderTop: `1px solid ${colors.border}`
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClose}
            disabled={saving}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: saving ? 0.6 : 1
            }}
          >
            Cancelar
          </motion.button>
          
          <motion.button
            whileHover={{ scale: saving ? 1 : 1.05 }}
            whileTap={{ scale: saving ? 1 : 0.95 }}
            onClick={handleSave}
            disabled={saving}
            style={{
              padding: '12px 24px',
              backgroundColor: saving ? colors.textSecondary : colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: saving ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: saving ? 0.6 : 1
            }}
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar Cambios'}
          </motion.button>
        </div>
      </motion.div>

      {/* Modal de firma */}
      {showSignaturePad && (
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
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            style={{
              maxWidth: '500px',
              width: '100%'
            }}
          >
            <SignaturePad
              onSave={handleSignatureSave}
              onCancel={handleSignatureCancel}
              initialSignature={formData.firmaResponsable}
              isReadOnly={yaEstaFirmada}
            />
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default HojaRutaEditModal;
