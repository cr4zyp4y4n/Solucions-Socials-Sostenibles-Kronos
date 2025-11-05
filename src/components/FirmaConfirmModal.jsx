import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  AlertTriangle, 
  X, 
  CheckCircle, 
  Pen,
  User,
  Calendar,
  Clock
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import SignaturePad from './SignaturePad';

const FirmaConfirmModal = ({ 
  isOpen, 
  onClose, 
  hojaRuta, 
  onFirmar 
}) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [showSignaturePad, setShowSignaturePad] = useState(false);
  const [firmaData, setFirmaData] = useState(null);
  
  // Verificar si ya está firmada
  const yaEstaFirmada = hojaRuta?.firmaInfo?.firmado || false;
  // Para firma como texto, usamos firmadoPor (nombre) o firma_data si es texto
  const firmaExistente = hojaRuta?.firmaInfo?.firmado_por || hojaRuta?.firmaInfo?.firmadoPor || null;

  // Cargar firma existente si ya está firmada
  useEffect(() => {
    if (yaEstaFirmada && firmaExistente) {
      // Solo cargar si es texto (no imagen base64)
      if (typeof firmaExistente === 'string' && !firmaExistente.startsWith('data:')) {
        setFirmaData(firmaExistente);
      } else if (yaEstaFirmada && firmaExistente) {
        // Si ya está firmada pero el nombre está en firmadoPor
        setFirmaData(hojaRuta?.firmaInfo?.firmado_por || hojaRuta?.firmaInfo?.firmadoPor || 'Firmado');
      }
    }
  }, [yaEstaFirmada, firmaExistente, hojaRuta]);

  if (!isOpen || !hojaRuta) return null;

  const handleConfirmarFirma = () => {
    if (firmaData) {
      // firmaData ahora es el nombre (texto), y lo usamos tanto para firmaData como para firmadoPor
      onFirmar(firmaData, firmaData); // El nombre es tanto la "firma" como el "firmadoPor"
      onClose();
    }
  };

  const handleSignatureSave = (signature) => {
    // signature ahora es el nombre (texto)
    setFirmaData(signature);
    setShowSignaturePad(false);
  };

  const handleSignatureCancel = () => {
    setShowSignaturePad(false);
  };

  const formatFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
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
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '600px',
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
            <AlertTriangle size={28} color={colors.warning || '#f59e0b'} />
            Confirmar Verificación de Listas y Material
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
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

        {/* Información de la hoja de ruta */}
        <div style={{
          backgroundColor: colors.background,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: `1px solid ${colors.border}`
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: colors.text,
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={20} color={colors.primary} />
            Detalles del Servicio
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
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
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: 0
              }}>
                {hojaRuta.cliente || 'No especificado'}
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
                Fecha del Servicio
              </label>
              <p style={{
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: 0
              }}>
                {hojaRuta.fechaServicio || 'No especificada'}
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
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: 0
              }}>
                {hojaRuta.responsable || 'No especificado'}
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
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: 0
              }}>
                {hojaRuta.numPersonas || 0}
              </p>
            </div>
          </div>
        </div>

        {/* Información del firmante */}
        <div style={{
          backgroundColor: colors.background,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: `1px solid ${colors.border}`
        }}>
          <h3 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: colors.text,
            margin: '0 0 16px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <User size={20} color={colors.primary} />
            Información de Verificación
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
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
                Verificado por
              </label>
              <p style={{
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: 0
              }}>
                {user?.name || user?.email || 'Usuario actual'}
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
                Fecha de firma
              </label>
              <p style={{
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: 0
              }}>
                {formatFecha(new Date())}
              </p>
            </div>
          </div>
        </div>

        {/* Advertencia */}
        <div style={{
          backgroundColor: (colors.warning || '#f59e0b') + '20',
          border: `1px solid ${colors.warning || '#f59e0b'}`,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px'
          }}>
            <AlertTriangle size={20} color={colors.warning || '#f59e0b'} />
            <div>
              <h4 style={{
                fontSize: '16px',
                fontWeight: 'bold',
                color: colors.warning || '#f59e0b',
                margin: '0 0 8px 0'
              }}>
                Información importante
              </h4>
              <p style={{
                fontSize: '14px',
                color: colors.text,
                margin: 0,
                lineHeight: '1.5'
              }}>
                Al firmar esta hoja de ruta, confirmas que has verificado las listas, material y equipamiento del servicio. 
                Esta firma quedará registrada en el sistema para fines de control y seguimiento.
              </p>
            </div>
          </div>
        </div>

        {/* Sección de firma */}
        {!showSignaturePad ? (
          <div style={{
            backgroundColor: colors.background,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            border: `1px solid ${colors.border}`,
            textAlign: 'center'
          }}>
            <Pen size={48} color={colors.primary} style={{ marginBottom: '16px' }} />
            <h3 style={{
              fontSize: '18px',
              fontWeight: 'bold',
              color: colors.text,
              margin: '0 0 8px 0'
            }}>
              {firmaData ? 'Verificación Capturada' : 'Listo para Verificar'}
            </h3>
            <p style={{
              fontSize: '14px',
              color: colors.textSecondary,
              margin: '0 0 20px 0'
            }}>
              {firmaData ? 'Tu nombre ha sido registrado correctamente' : 'Haz clic en el botón para escribir tu nombre y confirmar la verificación'}
            </p>
            
            {firmaData && (
              <div style={{
                marginBottom: '20px',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <div style={{
                  padding: '16px 24px',
                  border: `2px solid ${colors.success}`,
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  textAlign: 'center'
                }}>
                  <div style={{
                    fontSize: '20px',
                    fontWeight: 'bold',
                    color: '#000000',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}>
                    {firmaData}
                  </div>
                </div>
              </div>
            )}
            
            {!yaEstaFirmada && (
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowSignaturePad(true)}
                style={{
                  padding: '12px 24px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: '0 auto'
                }}
              >
                <Pen size={16} />
                {firmaData ? 'Cambiar Verificación' : 'Escribir Nombre'}
              </motion.button>
            )}
            {yaEstaFirmada && (
              <div style={{
                padding: '12px 24px',
                backgroundColor: colors.success + '20',
                color: colors.success,
                border: `1px solid ${colors.success}`,
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                textAlign: 'center',
                margin: '0 auto'
              }}>
                ✓ Esta hoja ya está firmada y no se puede modificar
              </div>
            )}
          </div>
        ) : (
          <div style={{ marginBottom: '24px' }}>
            <SignaturePad
              onSave={handleSignatureSave}
              onCancel={handleSignatureCancel}
              initialSignature={firmaData}
              isReadOnly={yaEstaFirmada}
            />
          </div>
        )}

        {/* Botones */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cancelar
          </motion.button>
          
          {!yaEstaFirmada && (
            <motion.button
              whileHover={{ scale: firmaData ? 1.05 : 1 }}
              whileTap={{ scale: firmaData ? 0.95 : 1 }}
              onClick={handleConfirmarFirma}
              disabled={!firmaData}
              style={{
                padding: '12px 24px',
                backgroundColor: firmaData ? colors.success : colors.textSecondary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: firmaData ? 'pointer' : 'not-allowed',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: firmaData ? 1 : 0.6
              }}
            >
              <CheckCircle size={16} />
              Confirmar Verificación
            </motion.button>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default FirmaConfirmModal;
