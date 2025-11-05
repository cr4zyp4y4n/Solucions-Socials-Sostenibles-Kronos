import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Pen, RotateCcw, Check, X } from 'lucide-react';
import { useTheme } from './ThemeContext';

const SignaturePad = ({ onSave, onCancel, initialSignature = null, isReadOnly = false }) => {
  const { colors } = useTheme();
  const [signatureText, setSignatureText] = useState('');
  const [hasSignature, setHasSignature] = useState(false);

  // Si hay una firma inicial (nombre), cargarla
  useEffect(() => {
    if (initialSignature && typeof initialSignature === 'string' && !initialSignature.startsWith('data:')) {
      // Si es texto (nombre), cargarlo directamente
      setSignatureText(initialSignature);
      setHasSignature(true);
    }
  }, [initialSignature]);

  const clearSignature = () => {
    if (isReadOnly) return;
    setSignatureText('');
    setHasSignature(false);
  };

  const saveSignature = () => {
    if (!hasSignature || isReadOnly) return;
    
    // Guardar solo el texto (nombre)
    onSave(signatureText.trim());
  };

  const handleTextChange = (e) => {
    if (isReadOnly) return;
    const value = e.target.value;
    setSignatureText(value);
    setHasSignature(value.trim().length > 0);
  };

  return (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '12px',
      padding: '24px',
      border: `1px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '16px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h3 style={{
          fontSize: '16px',
          fontWeight: 'bold',
          color: colors.text,
          margin: 0,
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Pen size={18} color={colors.primary} />
          {isReadOnly ? 'Firma (solo lectura)' : 'Confirmación de Listas y Material'}
        </h3>
        
        {!isReadOnly && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={clearSignature}
              disabled={!hasSignature}
              style={{
                padding: '8px',
                backgroundColor: colors.error + '20',
                color: colors.error,
                border: `1px solid ${colors.error}`,
                borderRadius: '6px',
                cursor: hasSignature ? 'pointer' : 'not-allowed',
                opacity: hasSignature ? 1 : 0.5,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <RotateCcw size={16} />
            </motion.button>
          </div>
        )}
      </div>

      {/* Campo de texto para escribir el nombre */}
      <div style={{
        border: `2px solid ${colors.primary}`,
        borderRadius: '12px',
        padding: '20px',
        backgroundColor: 'white',
        position: 'relative',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
      }}>
        <input
          type="text"
          value={signatureText}
          onChange={handleTextChange}
          placeholder="Escribe tu nombre completo"
          disabled={isReadOnly}
          style={{
            width: '100%',
            padding: '16px',
            border: 'none',
            backgroundColor: 'transparent',
            color: '#000000',
            fontSize: '18px',
            fontWeight: 'bold',
            textAlign: 'center',
            outline: 'none',
            letterSpacing: '1px',
            cursor: isReadOnly ? 'default' : 'text'
          }}
        />
        
        {!hasSignature && !isReadOnly && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            color: colors.textSecondary,
            fontSize: '14px',
            pointerEvents: 'none',
            textAlign: 'center',
            opacity: 0.7
          }}>
            <Pen size={24} style={{ marginBottom: '8px', opacity: 0.5 }} />
            <div>Escribe tu nombre aquí</div>
          </div>
        )}
      </div>

      {/* Vista previa (solo si hay firma) */}
      {hasSignature && (
        <div style={{
          padding: '12px',
          border: `2px solid ${colors.success}`,
          borderRadius: '12px',
          backgroundColor: 'white',
          textAlign: 'center',
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)'
        }}>
          <div style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: '#000000',
            textTransform: 'uppercase',
            letterSpacing: '2px',
            marginBottom: '8px'
          }}>
            {signatureText}
          </div>
          <div style={{
            fontSize: '12px',
            color: colors.success,
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            <Check size={14} />
            Firma lista para guardar
          </div>
        </div>
      )}

      {/* Instrucciones */}
      {!isReadOnly && (
        <div style={{
          fontSize: '14px',
          color: colors.textSecondary,
          textAlign: 'center',
          fontStyle: 'italic',
          padding: '12px',
          backgroundColor: colors.background,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`
        }}>
          ✍️ Escribe tu nombre completo para confirmar que has verificado las listas, material y equipamiento
        </div>
      )}

      {/* Botones */}
      {!isReadOnly && (
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel}
            style={{
              padding: '10px 20px',
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <X size={16} />
            Cancelar
          </motion.button>
          
          <motion.button
            whileHover={{ scale: hasSignature ? 1.05 : 1 }}
            whileTap={{ scale: hasSignature ? 0.95 : 1 }}
            onClick={saveSignature}
            disabled={!hasSignature}
            style={{
              padding: '10px 20px',
              backgroundColor: hasSignature ? colors.primary : colors.textSecondary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: hasSignature ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: hasSignature ? 1 : 0.6
            }}
          >
            <Check size={16} />
            Guardar Firma
          </motion.button>
        </div>
      )}
    </div>
  );
};

export default SignaturePad;
