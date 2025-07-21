import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trash2, 
  Download, 
  Info, 
  Mail, 
  AlertTriangle,
  CheckCircle,
  X,
  DollarSign,
  RefreshCw,
  Shield,
  Slash
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useDataContext } from './DataContext';
import { useCurrency } from './CurrencyContext';
import ConnectionTest from './ConnectionTest';
import holdedApi from '../services/holdedApi';
import HoldedTest from './HoldedTest';
import { useAuth } from './AuthContext';

// Hook para obtener el estado de conexión de Supabase de forma compacta
import { useState as useReactState, useEffect as useReactEffect } from 'react';
function useSupabaseConnectionStatus() {
  const [status, setStatus] = useReactState('testing');
  const [error, setError] = useReactState(null);
  const { colors } = useTheme();

  React.useEffect(() => {
    let isMounted = true;
    async function testConnection() {
      try {
        const { data, error } = await require('../config/supabase').supabase
          .from('user_profiles')
          .select('id')
          .limit(1);
        if (!isMounted) return;
        if (error) {
          setStatus('error');
          setError(error.message);
        } else {
          setStatus('success');
          setError(null);
        }
      } catch (err) {
        if (!isMounted) return;
        setStatus('error');
        setError(err.message);
      }
    }
    testConnection();
    return () => { isMounted = false; };
  }, []);
  return { status, error };
}

// Hook para obtener el estado de conexión de Holded Solucions
function useHoldedSolucionsConnectionStatus() {
  const [status, setStatus] = useReactState('testing');
  const [error, setError] = useReactState(null);
  const { colors } = useTheme();

  React.useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    async function testConnection() {
      try {
        // Esperar un poco antes de intentar la conexión
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await holdedApi.testConnection('solucions');
        if (!isMounted) return;
        setStatus('success');
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        
        // Si es un error de API no disponible, reintentar
        if (err.message.includes('API de Electron no disponible') && retryCount < maxRetries) {
          retryCount++;
          console.log(`Reintentando conexión Holded Solucions (${retryCount}/${maxRetries})...`);
          setTimeout(testConnection, 2000); // Esperar 2 segundos antes de reintentar
          return;
        }
        
        setStatus('error');
        setError(err.message);
      }
    }
    testConnection();
    return () => { isMounted = false; };
  }, []);
  return { status, error };
}

// Hook para obtener el estado de conexión de Holded Menjar
function useHoldedMenjarConnectionStatus() {
  const [status, setStatus] = useReactState('testing');
  const [error, setError] = useReactState(null);
  const { colors } = useTheme();

  React.useEffect(() => {
    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 3;
    
    async function testConnection() {
      try {
        // Esperar un poco antes de intentar la conexión
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        await holdedApi.testConnection('menjar');
        if (!isMounted) return;
        setStatus('success');
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        
        // Si es un error de API no disponible, reintentar
        if (err.message.includes('API de Electron no disponible') && retryCount < maxRetries) {
          retryCount++;
          console.log(`Reintentando conexión Holded Menjar (${retryCount}/${maxRetries})...`);
          setTimeout(testConnection, 2000); // Esperar 2 segundos antes de reintentar
          return;
        }
        
        setStatus('error');
        setError(err.message);
      }
    }
    testConnection();
    return () => { isMounted = false; };
  }, []);
  return { status, error };
}

const SettingsPage = () => {
  const { colors } = useTheme();
  const { currency, setCurrency, currencies, loading, lastUpdate, refreshRates } = useCurrency();
  const { user } = useAuth();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

  // Helpers de rol
  const isAdmin = user?.role === 'admin' || user?.user_metadata?.role === 'admin';
  const isManagementOrManager = user?.role === 'management' || user?.role === 'manager' || user?.user_metadata?.role === 'management' || user?.user_metadata?.role === 'manager';
  const isUser = !isAdmin && !isManagementOrManager;

  // Estado de conexión Supabase (badge)
  const { status: supabaseStatus, error: supabaseError } = useSupabaseConnectionStatus();

  // Estado de conexión Holded Solucions (badge)
  const { status: holdedSolucionsStatus, error: holdedSolucionsError } = useHoldedSolucionsConnectionStatus();

  // Estado de conexión Holded Menjar (badge)
  const { status: holdedMenjarStatus, error: holdedMenjarError } = useHoldedMenjarConnectionStatus();

  const appVersion = '1.0.0';
  const contactEmail = 'comunicacio@solucionssocials.org';

  const showAlertMessage = (message, type = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const handleCurrencyChange = (newCurrency) => {
    setCurrency(newCurrency);
    showAlertMessage(`Divisa cambiada a ${currencies.find(c => c.code === newCurrency)?.name}`, 'success');
  };

  const handleRefreshRates = async () => {
    await refreshRates();
    showAlertMessage('Tasas de cambio actualizadas', 'success');
  };

  const settingsSections = [
    {
      title: 'Configuración de Divisa',
      items: [
        {
          icon: DollarSign,
          title: 'Divisa',
          description: `Divisa actual: ${currencies.find(c => c.code === currency)?.name} (${currencies.find(c => c.code === currency)?.symbol})`,
          action: null,
          color: colors.primary,
          disabled: false,
          customComponent: (
            <div style={{ marginTop: '12px' }}>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px', 
                color: colors.textSecondary 
              }}>
                Seleccionar divisa:
              </label>
              <select
                value={currency}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: `1px solid ${colors.border}`,
                  fontSize: '14px',
                  minWidth: '200px',
                  background: colors.surface,
                  color: colors.text
                }}
              >
                {currencies.map(curr => (
                  <option key={curr.code} value={curr.code}>
                    {curr.name} ({curr.symbol})
                  </option>
                ))}
              </select>
              <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                  {lastUpdate ? 
                    `Última actualización: ${lastUpdate.toLocaleString('es-ES')}` : 
                    'Tasas no disponibles'
                  }
                </div>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={handleRefreshRates}
                  disabled={loading}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    borderRadius: '4px',
                    color: loading ? colors.textSecondary : colors.primary,
                    opacity: loading ? 0.5 : 1
                  }}
                  title="Actualizar tasas de cambio"
                >
                  <RefreshCw size={14} style={{ 
                    animation: loading ? 'spin 1s linear infinite' : 'none' 
                  }} />
                </motion.button>
              </div>
            </div>
          )
        }
      ]
    },
    {
      title: 'Información de la Aplicación',
      items: [
        {
          icon: Info,
          title: 'Versión',
          description: `Versión actual: ${appVersion}`,
          action: null,
          color: colors.secondary,
          disabled: false
        },
        {
          icon: Mail,
          title: 'Contacto',
          description: `Email: ${contactEmail}`,
          action: () => window.open(`mailto:${contactEmail}`, '_blank'),
          color: colors.primary,
          disabled: false
        }
      ]
    },
    {
      title: 'Estado de Conexiones',
      items: [
        {
          icon: CheckCircle,
          title: 'Conexión Supabase',
          description: supabaseStatus === 'success' ? 'Conectado correctamente' : 
                      supabaseStatus === 'error' ? `Error: ${supabaseError}` : 
                      'Comprobando conexión...',
          action: null,
          color: supabaseStatus === 'success' ? colors.success : 
                 supabaseStatus === 'error' ? colors.error : 
                 colors.warning,
          disabled: false
        },
        {
          icon: CheckCircle,
          title: 'Conexión Holded Solucions',
          description: holdedSolucionsStatus === 'success' ? 'Conectado correctamente' : 
                      holdedSolucionsStatus === 'error' ? `Error: ${holdedSolucionsError}` : 
                      'Comprobando conexión...',
          action: null,
          color: holdedSolucionsStatus === 'success' ? colors.success : 
                 holdedSolucionsStatus === 'error' ? colors.error : 
                 colors.warning,
          disabled: false
        },
        {
          icon: CheckCircle,
          title: 'Conexión Holded Menjar',
          description: holdedMenjarStatus === 'success' ? 'Conectado correctamente' : 
                      holdedMenjarStatus === 'error' ? `Error: ${holdedMenjarError}` : 
                      'Comprobando conexión...',
          action: null,
          color: holdedMenjarStatus === 'success' ? colors.success : 
                 holdedMenjarStatus === 'error' ? colors.error : 
                 colors.warning,
          disabled: false
        }
      ]
    }
  ];

  // Sección de configuración de divisa
  const renderDivisaSection = () => {
    if (isAdmin || isManagementOrManager) {
      return settingsSections[0] && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}
        >
          <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{settingsSections[0].title}</h3>
          {settingsSections[0].items.map((item, idx) => (
            <div key={item.title + idx} style={{ marginBottom: 18 }}>{item.customComponent || item.description}</div>
          ))}
        </motion.div>
      );
    } else if (isUser) {
      // Solo lectura para user
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}
        >
          <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{settingsSections[0].title}</h3>
          <div style={{ fontSize: 15, color: colors.textSecondary }}>
            {settingsSections[0].items[0].description}
          </div>
        </motion.div>
      );
    }
    return null;
  };

  // Sección de estado de conexiones
  const renderEstadoConexiones = () => {
    if (isAdmin || isManagementOrManager) {
      return settingsSections[2] && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ background: 'none', boxShadow: 'none', padding: 0 }}
        >
          <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{settingsSections[2].title}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {settingsSections[2].items.map((item, idx) => (
              <motion.div
                key={item.title + idx}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: idx * 0.05 }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  padding: '16px',
                  borderRadius: '8px',
                  background: colors.card,
                  border: `1.5px solid ${item.color}33`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                }}
              >
                <div style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  background: item.color + '22',
                  color: item.color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  flexShrink: 0
                }}>
                  {<item.icon size={22} />}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: colors.text }}>{item.title}</div>
                  <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{item.description}</div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>
      );
    } else if (isUser) {
      // Solo mensaje simple para user
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}
        >
          <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Estado de Conexión</h3>
          <div style={{ fontSize: 15, color: colors.textSecondary }}>
            La aplicación está conectada correctamente.
          </div>
        </motion.div>
      );
    }
    return null;
  };

  // Sección de pruebas técnicas
  const renderPruebasTecnicas = () => {
    if (isAdmin) {
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px', marginBottom: 32 }}
        >
          <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, marginBottom: 18 }}>Pruebas técnicas</h3>
          <HoldedTest />
        </motion.div>
      );
    } else {
      // Acceso denegado visual
      return (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.4 }}
          style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px', marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}
        >
          <Shield size={28} color={colors.error} style={{ flexShrink: 0 }} />
          <div>
            <div style={{ color: colors.error, fontWeight: 600, fontSize: 16, marginBottom: 4 }}>Acceso denegado</div>
            <div style={{ color: colors.textSecondary, fontSize: 14 }}>No tienes permisos para acceder a las pruebas técnicas.</div>
          </div>
        </motion.div>
      );
    }
  };

  // Sección de información de la app (siempre visible)
  const renderInfoApp = () => (
    settingsSections[1] && (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.25 }}
        style={{ background: 'none', boxShadow: 'none', padding: 0 }}
      >
        <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, marginBottom: 18 }}>{settingsSections[1].title}</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {settingsSections[1].items.map((item, idx) => (
            <motion.div
              key={item.title + idx}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: idx * 0.05 }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px',
                borderRadius: '8px',
                background: colors.card,
                border: `1.5px solid ${item.color}33`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
              }}
            >
              <div style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: item.color + '22',
                color: item.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 20,
                flexShrink: 0
              }}>
                {<item.icon size={22} />}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 15, color: colors.text }}>{item.title}</div>
                <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{item.description}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    )
  );

  // Render principal
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {/* Título y badges de estado */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 32,
        }}
      >
        <h1 style={{
          color: colors.text,
          fontSize: 28,
          fontWeight: 700,
          margin: 0,
          lineHeight: 1.2,
          userSelect: 'none'
        }}>
          Configuración
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* Badge de estado de Supabase */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: supabaseStatus === 'success' ? colors.success + '22' : 
                           supabaseStatus === 'error' ? colors.error + '22' : 
                           colors.warning + '22',
            color: supabaseStatus === 'success' ? colors.success : 
                   supabaseStatus === 'error' ? colors.error : 
                   colors.warning,
            border: `1px solid ${supabaseStatus === 'success' ? colors.success : 
                                supabaseStatus === 'error' ? colors.error : 
                                colors.warning}33`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: supabaseStatus === 'success' ? colors.success : 
                             supabaseStatus === 'error' ? colors.error : 
                             colors.warning
            }} />
            Supabase
          </div>

          {/* Badge de estado de Holded Solucions */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: holdedSolucionsStatus === 'success' ? colors.success + '22' : 
                           holdedSolucionsStatus === 'error' ? colors.error + '22' : 
                           colors.warning + '22',
            color: holdedSolucionsStatus === 'success' ? colors.success : 
                   holdedSolucionsStatus === 'error' ? colors.error : 
                   colors.warning,
            border: `1px solid ${holdedSolucionsStatus === 'success' ? colors.success : 
                                holdedSolucionsStatus === 'error' ? colors.error : 
                                colors.warning}33`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: holdedSolucionsStatus === 'success' ? colors.success : 
                             holdedSolucionsStatus === 'error' ? colors.error : 
                             colors.warning
            }} />
            Holded Solucions
          </div>

          {/* Badge de estado de Holded Menjar */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '20px',
            fontSize: '12px',
            fontWeight: '500',
            backgroundColor: holdedMenjarStatus === 'success' ? colors.success + '22' : 
                           holdedMenjarStatus === 'error' ? colors.error + '22' : 
                           colors.warning + '22',
            color: holdedMenjarStatus === 'success' ? colors.success : 
                   holdedMenjarStatus === 'error' ? colors.error : 
                   colors.warning,
            border: `1px solid ${holdedMenjarStatus === 'success' ? colors.success : 
                                holdedMenjarStatus === 'error' ? colors.error : 
                                colors.warning}33`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: holdedMenjarStatus === 'success' ? colors.success : 
                             holdedMenjarStatus === 'error' ? colors.error : 
                             colors.warning
            }} />
            Holded Menjar
          </div>
        </div>
      </motion.div>

      {/* Alertas */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position: 'fixed',
              top: '20px',
              right: '20px',
              zIndex: 1000,
              backgroundColor: alertType === 'success' ? colors.success + '22' : colors.error + '22',
              border: `1px solid ${alertType === 'success' ? colors.success : colors.error}`,
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              maxWidth: '300px'
            }}
          >
            {alertType === 'success' ? (
              <CheckCircle size={16} color={colors.success} />
            ) : (
              <AlertTriangle size={16} color={colors.error} />
            )}
            <span style={{
              color: colors.text,
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {alertMessage}
            </span>
            <button
              onClick={() => setShowAlert(false)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '4px',
                marginLeft: 'auto'
              }}
            >
              <X size={14} color={colors.textSecondary} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secciones según rol */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 32, flex: 1 }}
      >
        {renderDivisaSection()}
        {renderInfoApp()}
        {renderEstadoConexiones()}
        {renderPruebasTecnicas()}
      </motion.div>
    </motion.div>
  );
};

export default SettingsPage; 