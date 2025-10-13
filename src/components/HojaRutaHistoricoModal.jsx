import React from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Calendar, 
  User, 
  FileText, 
  Eye,
  Trash2,
  Download
} from 'lucide-react';
import { useTheme } from './ThemeContext';

const HojaRutaHistoricoModal = ({ 
  isOpen, 
  onClose, 
  historico, 
  onViewHoja, 
  onDeleteHoja 
}) => {
  const { colors } = useTheme();

  if (!isOpen) return null;

  const formatFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFechaServicio = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '800px',
          width: '90%',
          maxHeight: '80vh',
          overflow: 'hidden',
          border: `1px solid ${colors.border}`
        }}
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
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <FileText size={24} color={colors.primary} />
            Histórico de Hojas de Ruta
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
            <X size={20} color={colors.textSecondary} />
          </motion.button>
        </div>

        {/* Content */}
        <div style={{
          maxHeight: '60vh',
          overflowY: 'auto',
          paddingRight: '8px'
        }}>
          {historico && historico.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {historico.map((hoja, index) => (
                <motion.div
                  key={hoja.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  style={{
                    backgroundColor: colors.background,
                    borderRadius: '12px',
                    padding: '16px',
                    border: `1px solid ${colors.border}`,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <Calendar size={16} color={colors.primary} />
                      <h3 style={{
                        fontSize: '16px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: 0
                      }}>
                        {hoja.cliente || 'Sin cliente'}
                      </h3>
                      <span style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        backgroundColor: colors.primary + '20',
                        padding: '2px 8px',
                        borderRadius: '12px'
                      }}>
                        {formatFechaServicio(hoja.fechaServicio)}
                      </span>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      fontSize: '12px',
                      color: colors.textSecondary
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <User size={12} />
                        <span>{hoja.creadoPor || 'Usuario desconocido'}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={12} />
                        <span>{formatFecha(hoja.fechaCreacion)}</span>
                      </div>
                      {hoja.nombreArchivo && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <FileText size={12} />
                          <span>{hoja.nombreArchivo}</span>
                        </div>
                      )}
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
                      onClick={() => onViewHoja(hoja)}
                      style={{
                        backgroundColor: colors.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Eye size={14} />
                      Ver
                    </motion.button>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => onDeleteHoja(hoja.id)}
                      style={{
                        backgroundColor: colors.error + '20',
                        color: colors.error,
                        border: `1px solid ${colors.error + '30'}`,
                        borderRadius: '8px',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: '12px',
                        fontWeight: '500',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
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
              textAlign: 'center',
              padding: '48px 24px',
              color: colors.textSecondary
            }}>
              <FileText size={48} color={colors.textSecondary} style={{ marginBottom: '16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                margin: '0 0 8px 0'
              }}>
                No hay histórico disponible
              </h3>
              <p style={{
                fontSize: '14px',
                margin: 0
              }}>
                Las hojas de ruta subidas aparecerán aquí
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '24px',
          paddingTop: '16px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cerrar
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default HojaRutaHistoricoModal;
