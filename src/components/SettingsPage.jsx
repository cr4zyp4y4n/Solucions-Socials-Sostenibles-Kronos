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
  RefreshCw
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useDataContext } from './DataContext';
import { useCurrency } from './CurrencyContext';
import ConnectionTest from './ConnectionTest';
import holdedApi from '../services/holdedApi';

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
    async function testConnection() {
      try {
        await holdedApi.testConnection('solucions');
        if (!isMounted) return;
        setStatus('success');
        setError(null);
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

// Hook para obtener el estado de conexión de Holded Menjar
function useHoldedMenjarConnectionStatus() {
  const [status, setStatus] = useReactState('testing');
  const [error, setError] = useReactState(null);
  const { colors } = useTheme();

  React.useEffect(() => {
    let isMounted = true;
    async function testConnection() {
      try {
        await holdedApi.testConnection('menjar');
        if (!isMounted) return;
        setStatus('success');
        setError(null);
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

const SettingsPage = () => {
  const { colors } = useTheme();
  const { 
    solucionsData, solucionsHeaders, clearSolucionsData,
    menjarData, menjarHeaders, clearMenjarData,
    clearAllData
  } = useDataContext();
  const { currency, setCurrency, currencies, loading, lastUpdate, refreshRates } = useCurrency();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

  // Estado de conexión Supabase (badge)
  const { status: supabaseStatus, error: supabaseError } = useSupabaseConnectionStatus();

  // Estado de conexión Holded Solucions (badge)
  const { status: holdedSolucionsStatus, error: holdedSolucionsError } = useHoldedSolucionsConnectionStatus();

  // Estado de conexión Holded Menjar (badge)
  const { status: holdedMenjarStatus, error: holdedMenjarError } = useHoldedMenjarConnectionStatus();

  // Badge de estado de Supabase
  const supabaseBadge = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      fontWeight: 500,
      marginLeft: 16,
      padding: '2px 10px',
      borderRadius: 12,
      background:
        supabaseStatus === 'success' ? colors.success + '22' :
        supabaseStatus === 'error' ? colors.error + '22' :
        colors.warning + '22',
      color:
        supabaseStatus === 'success' ? colors.success :
        supabaseStatus === 'error' ? colors.error :
        colors.warning,
      border: `1px solid ${
        supabaseStatus === 'success' ? colors.success :
        supabaseStatus === 'error' ? colors.error :
        colors.warning
      }`,
      userSelect: 'none',
      minWidth: 0,
      minHeight: 0,
      lineHeight: 1.2
    }}>
      {supabaseStatus === 'success' && <span style={{fontSize: 15}}>●</span>}
      {supabaseStatus === 'error' && <span style={{fontSize: 15}}>●</span>}
      {supabaseStatus === 'testing' && <span style={{fontSize: 15}}>●</span>}
      <span style={{fontWeight: 500}}>
        {supabaseStatus === 'success' && 'Supabase'}
        {supabaseStatus === 'error' && 'Supabase'}
        {supabaseStatus === 'testing' && 'Supabase'}
      </span>
    </span>
  );

  // Badge de estado de Holded Solucions
  const holdedSolucionsBadge = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      fontWeight: 500,
      marginLeft: 16,
      padding: '2px 10px',
      borderRadius: 12,
      background:
        holdedSolucionsStatus === 'success' ? colors.success + '22' :
        holdedSolucionsStatus === 'error' ? colors.error + '22' :
        colors.warning + '22',
      color:
        holdedSolucionsStatus === 'success' ? colors.success :
        holdedSolucionsStatus === 'error' ? colors.error :
        colors.warning,
      border: `1px solid ${
        holdedSolucionsStatus === 'success' ? colors.success :
        holdedSolucionsStatus === 'error' ? colors.error :
        colors.warning
      }`,
      userSelect: 'none',
      minWidth: 0,
      minHeight: 0,
      lineHeight: 1.2
    }}>
      {holdedSolucionsStatus === 'success' && <span style={{fontSize: 15}}>●</span>}
      {holdedSolucionsStatus === 'error' && <span style={{fontSize: 15}}>●</span>}
      {holdedSolucionsStatus === 'testing' && <span style={{fontSize: 15}}>●</span>}
      <span style={{fontWeight: 500}}>
        {holdedSolucionsStatus === 'success' && 'Holded Solucions'}
        {holdedSolucionsStatus === 'error' && 'Holded Solucions'}
        {holdedSolucionsStatus === 'testing' && 'Holded Solucions'}
      </span>
    </span>
  );

  // Badge de estado de Holded Menjar
  const holdedMenjarBadge = (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      fontSize: 13,
      fontWeight: 500,
      marginLeft: 16,
      padding: '2px 10px',
      borderRadius: 12,
      background:
        holdedMenjarStatus === 'success' ? colors.success + '22' :
        holdedMenjarStatus === 'error' ? colors.error + '22' :
        colors.warning + '22',
      color:
        holdedMenjarStatus === 'success' ? colors.success :
        holdedMenjarStatus === 'error' ? colors.error :
        colors.warning,
      border: `1px solid ${
        holdedMenjarStatus === 'success' ? colors.success :
        holdedMenjarStatus === 'error' ? colors.error :
        colors.warning
      }`,
      userSelect: 'none',
      minWidth: 0,
      minHeight: 0,
      lineHeight: 1.2
    }}>
      {holdedMenjarStatus === 'success' && <span style={{fontSize: 15}}>●</span>}
      {holdedMenjarStatus === 'error' && <span style={{fontSize: 15}}>●</span>}
      {holdedMenjarStatus === 'testing' && <span style={{fontSize: 15}}>●</span>}
      <span style={{fontWeight: 500}}>
        {holdedMenjarStatus === 'success' && 'Holded Menjar'}
        {holdedMenjarStatus === 'error' && 'Holded Menjar'}
        {holdedMenjarStatus === 'testing' && 'Holded Menjar'}
      </span>
    </span>
  );

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

  const handleClearSolucionsData = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar todos los datos de Solucions Socials? Esta acción no se puede deshacer.')) {
      clearSolucionsData();
      showAlertMessage('Datos de Solucions Socials borrados correctamente', 'success');
    }
  };

  const handleClearMenjarData = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar todos los datos de Menjar d\'Hort? Esta acción no se puede deshacer.')) {
      clearMenjarData();
      showAlertMessage('Datos de Menjar d\'Hort borrados correctamente', 'success');
    }
  };

  const handleClearAllData = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar TODOS los datos (Solucions Socials y Menjar d\'Hort)? Esta acción no se puede deshacer.')) {
      clearAllData();
      showAlertMessage('Todos los datos borrados correctamente', 'success');
    }
  };

  const handleExportSolucionsData = () => {
    if (solucionsData.length === 0) {
      showAlertMessage('No hay datos de Solucions Socials para exportar', 'error');
      return;
    }

    try {
      // Crear CSV
      const headers = solucionsHeaders.join(',');
      const csvContent = [headers, ...solucionsData.map(row => row.join(','))].join('\n');
      
      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `solucions_socials_exportados_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showAlertMessage('Datos de Solucions Socials exportados correctamente', 'success');
    } catch (error) {
      showAlertMessage('Error al exportar datos de Solucions Socials', 'error');
    }
  };

  const handleExportMenjarData = () => {
    if (menjarData.length === 0) {
      showAlertMessage('No hay datos de Menjar d\'Hort para exportar', 'error');
      return;
    }

    try {
      // Crear CSV
      const headers = menjarHeaders.join(',');
      const csvContent = [headers, ...menjarData.map(row => row.join(','))].join('\n');
      
      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `menjar_dhort_exportados_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showAlertMessage('Datos de Menjar d\'Hort exportados correctamente', 'success');
    } catch (error) {
      showAlertMessage('Error al exportar datos de Menjar d\'Hort', 'error');
    }
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
      title: 'Gestión de Datos - Solucions Socials',
      items: [
        {
          icon: Trash2,
          title: 'Borrar datos de Solucions Socials',
          description: 'Elimina todos los datos de Solucions Socials',
          action: handleClearSolucionsData,
          color: colors.error,
          disabled: solucionsData.length === 0
        },
        {
          icon: Download,
          title: 'Exportar datos de Solucions Socials',
          description: 'Descarga los datos de Solucions Socials en formato CSV',
          action: handleExportSolucionsData,
          color: colors.primary,
          disabled: solucionsData.length === 0
        }
      ]
    },
    {
      title: 'Gestión de Datos - Menjar d\'Hort',
      items: [
        {
          icon: Trash2,
          title: 'Borrar datos de Menjar d\'Hort',
          description: 'Elimina todos los datos de Menjar d\'Hort',
          action: handleClearMenjarData,
          color: colors.error,
          disabled: menjarData.length === 0
        },
        {
          icon: Download,
          title: 'Exportar datos de Menjar d\'Hort',
          description: 'Descarga los datos de Menjar d\'Hort en formato CSV',
          action: handleExportMenjarData,
          color: colors.primary,
          disabled: menjarData.length === 0
        }
      ]
    },
    {
      title: 'Gestión de Datos - General',
      items: [
        {
          icon: Trash2,
          title: 'Borrar TODOS los datos',
          description: 'Elimina todos los datos de Solucions Socials y Menjar d\'Hort',
          action: handleClearAllData,
          color: colors.error,
          disabled: solucionsData.length === 0 && menjarData.length === 0
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
          {supabaseBadge}
          {holdedSolucionsBadge}
          {holdedMenjarBadge}
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

      {/* Resto del contenido de configuración */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 32, flex: 1 }}
      >
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 + (sectionIndex * 0.1) }}
            style={{
              background: colors.card,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              padding: '20px'
            }}
          >
            <h3 style={{ 
              margin: '0 0 16px 0', 
              color: colors.text, 
              fontSize: 18, 
              fontWeight: 600, 
              lineHeight: 1.2 
            }}>
              {section.title}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {section.items.map((item, itemIndex) => {
                const Icon = item.icon;
                return (
                  <motion.div
                    key={item.title}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: (sectionIndex * 0.1) + (itemIndex * 0.05) }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '16px',
                      padding: '16px',
                      borderRadius: '8px',
                      background: item.disabled ? colors.hover : 'transparent',
                      opacity: item.disabled ? 0.6 : 1,
                      cursor: item.action && !item.disabled ? 'pointer' : 'default',
                      transition: 'all 0.2s ease'
                    }}
                    onClick={item.action && !item.disabled ? item.action : undefined}
                    whileHover={item.action && !item.disabled ? { 
                      backgroundColor: colors.hover,
                      scale: 1.02 
                    } : {}}
                    whileTap={item.action && !item.disabled ? { scale: 0.98 } : {}}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width: '40px',
                      height: '40px',
                      borderRadius: '8px',
                      background: item.disabled ? colors.border : `${item.color}20`,
                      color: item.disabled ? colors.textSecondary : item.color
                    }}>
                      <Icon size={20} />
                    </div>
                    
                    <div style={{ flex: 1 }}>
                      <div style={{
                        fontSize: '16px',
                        fontWeight: '500',
                        color: item.disabled ? colors.textSecondary : colors.text,
                        marginBottom: '4px'
                      }}>
                        {item.title}
                      </div>
                      <div style={{
                        fontSize: '14px',
                        color: colors.textSecondary
                      }}>
                        {item.description}
                      </div>
                      {item.customComponent && item.customComponent}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        ))}
      </motion.div>
    </motion.div>
  );
};

export default SettingsPage; 