import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  User, 
  Mail, 
  UserPlus,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { useTheme } from './ThemeContext';

const SocioFormModal = ({ 
  isOpen, 
  onClose, 
  onCrearSocio 
}) => {
  const { colors } = useTheme();
  
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    correo: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  // Resetear formulario al abrir/cerrar
  React.useEffect(() => {
    if (isOpen) {
      setFormData({ nombre: '', apellido: '', correo: '' });
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.nombre.trim()) {
      setError('El nombre es obligatorio');
      return false;
    }
    
    if (!formData.apellido.trim()) {
      setError('El apellido es obligatorio');
      return false;
    }
    
    if (!formData.correo.trim()) {
      setError('El correo electrónico es obligatorio');
      return false;
    }
    
    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.correo.trim())) {
      setError('El formato del correo electrónico no es válido');
      return false;
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    setError(null);
    
    try {
      await onCrearSocio(formData);
      setSuccess(true);
      
      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        onClose();
      }, 1500);
      
    } catch (err) {
      console.error('Error creando socio:', err);
      setError(err.message || 'Error al crear el socio');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

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
          maxWidth: '500px',
          width: '90%',
          maxWidth: '480px',
          border: `1px solid ${colors.border}`,
          boxSizing: 'border-box'
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
            <UserPlus size={24} color={colors.primary} />
            Nuevo Socio de IDONI
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

        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: colors.success + '20',
              border: `1px solid ${colors.success}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle size={20} color={colors.success} />
            <p style={{ color: colors.success, margin: 0, fontSize: '14px', fontWeight: '500' }}>
              ¡Socio creado exitosamente!
            </p>
          </motion.div>
        )}

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: colors.error + '20',
              border: `1px solid ${colors.error}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertCircle size={20} color={colors.error} />
            <p style={{ color: colors.error, margin: 0, fontSize: '14px' }}>
              {error}
            </p>
          </motion.div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* Nombre */}
            <div>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '8px',
                display: 'block'
              }}>
                Nombre *
              </label>
              <div style={{ position: 'relative' }}>
                <User 
                  size={18} 
                  color={colors.textSecondary} 
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
                <input
                  type="text"
                  name="nombre"
                  value={formData.nombre}
                  onChange={handleChange}
                  placeholder="Introduce el nombre"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.background,
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    opacity: loading ? 0.6 : 1,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Apellido */}
            <div>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '8px',
                display: 'block'
              }}>
                Apellido *
              </label>
              <div style={{ position: 'relative' }}>
                <User 
                  size={18} 
                  color={colors.textSecondary} 
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
                <input
                  type="text"
                  name="apellido"
                  value={formData.apellido}
                  onChange={handleChange}
                  placeholder="Introduce el apellido"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.background,
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    opacity: loading ? 0.6 : 1,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Correo */}
            <div>
              <label style={{
                fontSize: '14px',
                fontWeight: '600',
                color: colors.text,
                marginBottom: '8px',
                display: 'block'
              }}>
                Correo Electrónico *
              </label>
              <div style={{ position: 'relative' }}>
                <Mail 
                  size={18} 
                  color={colors.textSecondary} 
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)'
                  }}
                />
                <input
                  type="email"
                  name="correo"
                  value={formData.correo}
                  onChange={handleChange}
                  placeholder="ejemplo@correo.com"
                  disabled={loading}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.background,
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    opacity: loading ? 0.6 : 1,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Info adicional */}
            <div style={{
              backgroundColor: colors.primary + '10',
              border: `1px solid ${colors.primary + '30'}`,
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              color: colors.textSecondary
            }}>
              <p style={{ margin: 0 }}>
                <strong>Información automática:</strong><br/>
                • ID único: Se generará automáticamente<br/>
                • Socio desde: Fecha actual
              </p>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            marginTop: '24px',
            paddingTop: '16px',
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px'
          }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="button"
              onClick={onClose}
              disabled={loading}
              style={{
                backgroundColor: colors.surface,
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                opacity: loading ? 0.6 : 1
              }}
            >
              Cancelar
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                padding: '12px 24px',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: `2px solid transparent`,
                      borderTop: `2px solid white`,
                      borderRadius: '50%'
                    }}
                  />
                  Creando...
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  Crear Socio
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default SocioFormModal;
