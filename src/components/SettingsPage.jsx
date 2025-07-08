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

const SettingsPage = () => {
  const { colors } = useTheme();
  const { excelData, excelHeaders, clearData } = useDataContext();
  const { currency, setCurrency, currencies, loading, lastUpdate, refreshRates } = useCurrency();
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');

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

  const handleClearData = () => {
    if (window.confirm('¿Estás seguro de que quieres borrar todos los datos? Esta acción no se puede deshacer.')) {
      clearData();
      showAlertMessage('Datos borrados correctamente', 'success');
    }
  };

  const handleExportData = () => {
    if (excelData.length === 0) {
      showAlertMessage('No hay datos para exportar', 'error');
      return;
    }

    try {
      // Crear CSV
      const headers = excelHeaders.join(',');
      const csvContent = [headers, ...excelData.map(row => row.join(','))].join('\n');
      
      // Crear y descargar archivo
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `datos_exportados_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      showAlertMessage('Datos exportados correctamente', 'success');
    } catch (error) {
      showAlertMessage('Error al exportar datos', 'error');
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
      title: 'Gestión de Datos',
      items: [
        {
          icon: Trash2,
          title: 'Borrar todos los datos',
          description: 'Elimina todos los datos importados de la aplicación',
          action: handleClearData,
          color: colors.error,
          disabled: excelData.length === 0
        },
        {
          icon: Download,
          title: 'Exportar datos',
          description: 'Descarga los datos actuales en formato CSV',
          action: handleExportData,
          color: colors.primary,
          disabled: excelData.length === 0
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
      <style>
        {`
          @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
          }
        `}
      </style>
      <h2 style={{ 
        margin: '0 0 24px 0', 
        color: colors.text, 
        fontWeight: 700, 
        fontSize: 28, 
        lineHeight: 1.2 
      }}>
        Configuración
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1 }}>
        {settingsSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: sectionIndex * 0.1 }}
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
      </div>

      {/* Alert */}
      <AnimatePresence>
        {showAlert && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              bottom: '24px',
              right: '24px',
              background: alertType === 'success' ? colors.success : colors.error,
              color: 'white',
              padding: '16px 20px',
              borderRadius: '8px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              zIndex: 1000,
              maxWidth: '400px'
            }}
          >
            {alertType === 'success' ? (
              <CheckCircle size={20} />
            ) : (
              <AlertTriangle size={20} />
            )}
            <span style={{ fontSize: '14px', fontWeight: '500' }}>
              {alertMessage}
            </span>
            <button
              onClick={() => setShowAlert(false)}
              style={{
                background: 'none',
                border: 'none',
                color: 'white',
                cursor: 'pointer',
                padding: '4px',
                marginLeft: 'auto'
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default SettingsPage; 