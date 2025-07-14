import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Check, X, AlertCircle } from 'feather-icons-react';
import { supabase } from '../config/supabase';
import { useTheme } from './ThemeContext';

const ConnectionTest = ({ compact = false }) => {
  const [connectionStatus, setConnectionStatus] = useState('testing');
  const [error, setError] = useState(null);
  const { colors } = useTheme();

  useEffect(() => {
    testConnection();
  }, []);

  const testConnection = async () => {
    try {
      // Probar conexión básica con una consulta simple
      const { data, error } = await supabase
        .from('user_profiles')
        .select('id')
        .limit(1);
      
      if (error) {
        setConnectionStatus('error');
        setError(error.message);
      } else {
        setConnectionStatus('success');
      }
    } catch (err) {
      setConnectionStatus('error');
      setError(err.message);
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'success':
        return <Check size={compact ? 12 : 16} color="white" />;
      case 'error':
        return <X size={compact ? 12 : 16} color="white" />;
      default:
        return <AlertCircle size={compact ? 12 : 16} color="white" />;
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'success':
        return colors.success;
      case 'error':
        return colors.error;
      default:
        return colors.warning || '#f59e0b';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'success':
        return 'Conectado';
      case 'error':
        return 'Error';
      default:
        return 'Conectando...';
    }
  };

  // Versión compacta para la página de login
  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '6px 10px',
          backgroundColor: colors.surface,
          borderRadius: '20px',
          border: `1px solid ${colors.border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          fontSize: '11px',
          color: colors.textSecondary,
          userSelect: 'none'
        }}
      >
        <div style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          flexShrink: 0
        }} />
        <span style={{ fontSize: '10px', fontWeight: '500' }}>
          {getStatusText()}
        </span>
      </motion.div>
    );
  }

  // Versión completa para la página de configuración
  return (
    <div style={{
      padding: '20px',
      backgroundColor: colors.surface,
      borderRadius: '12px',
      border: `1px solid ${colors.border}`,
      margin: '20px'
    }}>
      <h3 style={{
        color: colors.text,
        margin: '0 0 16px 0',
        fontSize: '18px',
        fontWeight: '600',
        userSelect: 'none'
      }}>
        Prueba de Conexión - Supabase
      </h3>
      
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '16px'
      }}>
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          backgroundColor: getStatusColor(),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {getStatusIcon()}
        </div>
        <div>
          <div style={{
            color: colors.text,
            fontSize: '14px',
            fontWeight: '500',
            userSelect: 'none'
          }}>
            {getStatusText()}
          </div>
          {error && (
            <div style={{
              color: colors.error,
              fontSize: '12px',
              marginTop: '4px',
              userSelect: 'none'
            }}>
              {error}
            </div>
          )}
        </div>
      </div>

      <div style={{
        fontSize: '12px',
        color: colors.textSecondary,
        userSelect: 'none'
      }}>
        <strong>URL:</strong> {supabase.supabaseUrl}<br />
        <strong>Estado:</strong> {connectionStatus === 'success' ? 'Conectado' : 'Desconectado'}
      </div>

      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={testConnection}
        style={{
          marginTop: '16px',
          padding: '8px 16px',
          backgroundColor: colors.primary,
          color: 'white',
          border: 'none',
          borderRadius: '6px',
          fontSize: '12px',
          fontWeight: '500',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        Probar de nuevo
      </motion.button>
    </div>
  );
};

export default ConnectionTest; 