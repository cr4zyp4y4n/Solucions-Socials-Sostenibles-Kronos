import React from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  AlertTriangle,
  Trash2,
  CheckCircle
} from 'lucide-react';
import { useTheme } from './ThemeContext';

const ConfirmModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  title = "Confirmar acción",
  message = "¿Estás seguro de que quieres realizar esta acción?",
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  type = "warning" // warning, danger, info
}) => {
  const { colors } = useTheme();

  if (!isOpen) return null;

  const getIconAndColors = () => {
    switch (type) {
      case 'danger':
        return {
          icon: <Trash2 size={24} color={colors.error} />,
          confirmBg: colors.error,
          confirmColor: 'white',
          borderColor: colors.error + '30',
          bgColor: colors.error + '10'
        };
      case 'info':
        return {
          icon: <CheckCircle size={24} color={colors.primary} />,
          confirmBg: colors.primary,
          confirmColor: 'white',
          borderColor: colors.primary + '30',
          bgColor: colors.primary + '10'
        };
      default: // warning
        return {
          icon: <AlertTriangle size={24} color={colors.warning} />,
          confirmBg: colors.warning,
          confirmColor: 'white',
          borderColor: colors.warning + '30',
          bgColor: colors.warning + '10'
        };
    }
  };

  const { icon, confirmBg, confirmColor, borderColor, bgColor } = getIconAndColors();

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
      zIndex: 1002
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          border: `1px solid ${colors.border}`,
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h2 style={{
            fontSize: '18px',
            fontWeight: 'bold',
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            {icon}
            {title}
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

        {/* Message */}
        <div style={{
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          borderRadius: '12px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <p style={{
            fontSize: '14px',
            color: colors.text,
            margin: 0,
            lineHeight: '1.5'
          }}>
            {message}
          </p>
        </div>

        {/* Actions */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
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
              padding: '12px 20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {cancelText}
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              onConfirm();
              onClose();
            }}
            style={{
              backgroundColor: confirmBg,
              color: confirmColor,
              border: 'none',
              borderRadius: '8px',
              padding: '12px 20px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            {type === 'danger' && <Trash2 size={16} />}
            {confirmText}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ConfirmModal;
