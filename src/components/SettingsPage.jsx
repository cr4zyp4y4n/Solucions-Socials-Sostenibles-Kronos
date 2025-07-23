import React, { useState, useEffect } from 'react';
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
  Slash,
  Zap
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

  // Versión de la aplicación - obtener dinámicamente
  const [appVersion, setAppVersion] = useState('2.0.3'); // Versión por defecto
  const contactEmail = 'comunicacio@solucionssocials.org';

  // Obtener la versión de la aplicación al cargar el componente
  useEffect(() => {
    const getAppVersion = async () => {
      try {
        if (window.electronAPI) {
          const version = await window.electronAPI.getAppVersion();
          setAppVersion(version);
          console.log('📦 Versión de la aplicación obtenida:', version);
        }
      } catch (error) {
        console.log('⚠️ No se pudo obtener la versión de la aplicación:', error.message);
        // Mantener la versión por defecto
      }
    };

    getAppVersion();
  }, []);

  // Estados para actualizaciones
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [checking, setChecking] = useState(false);

  // Verificar si el usuario es admin
  const isAdmin = user?.role === 'authenticated' && user?.user_metadata?.role === 'admin';
  // Verificar si el usuario puede instalar actualizaciones (admin, management, manager)
  const canInstallUpdates = user?.role === 'authenticated' && 
    ['admin', 'management', 'manager'].includes(user?.user_metadata?.role);

  // Helpers de rol
  const isManagementOrManager = user?.role === 'management' || user?.role === 'manager' || user?.user_metadata?.role === 'management' || user?.user_metadata?.role === 'manager';
  const isUser = !isAdmin && !isManagementOrManager;

  // Estado de conexión Supabase (badge)
  const { status: supabaseStatus, error: supabaseError } = useSupabaseConnectionStatus();

  // Estado de conexión Holded Solucions (badge)
  const { status: holdedSolucionsStatus, error: holdedSolucionsError } = useHoldedSolucionsConnectionStatus();

  // Estado de conexión Holded Menjar (badge)
  const { status: holdedMenjarStatus, error: holdedMenjarError } = useHoldedMenjarConnectionStatus();

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

  // Configurar listeners de actualizaciones
  useEffect(() => {
    if (window.electronAPI) {
      // Listener para actualización disponible
      window.electronAPI.onUpdateAvailable((event, info) => {
        setUpdateAvailable(true);
        setChecking(false);
      });

      // Listener para progreso de descarga
      window.electronAPI.onDownloadProgress((event, progressObj) => {
        setDownloadProgress(progressObj.percent);
      });

      // Listener para actualización descargada
      window.electronAPI.onUpdateDownloaded((event, info) => {
        setUpdateDownloaded(true);
        setDownloading(false);
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('update-available');
        window.electronAPI.removeAllListeners('download-progress');
        window.electronAPI.removeAllListeners('update-downloaded');
      }
    };
  }, []);

  // Función para verificar conectividad con GitHub
  const testGitHubConnection = async () => {
    try {
      console.log('🌐 Intentando conectar con GitHub API...');
      const response = await fetch('https://api.github.com/repos/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases/latest', {
        method: 'GET',
        headers: {
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SSS-Kronos-App'
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Conexión con GitHub exitosa');
        console.log('📦 Última versión en GitHub:', data.tag_name);
        console.log('📋 Release notes:', data.body?.substring(0, 100) + '...');
        console.log('🔗 URL del release:', data.html_url);
        return data;
      } else {
        console.log('❌ Error conectando con GitHub:', response.status);
        console.log('📋 Respuesta del servidor:', response.statusText);
        return null;
      }
    } catch (error) {
      console.log('❌ Error de red:', error.message);
      if (error.message.includes('Content Security Policy')) {
        console.log('🔒 Error de CSP: La política de seguridad está bloqueando la conexión');
        console.log('💡 Solución: Verificar que api.github.com esté en la CSP');
      } else if (error.message.includes('Failed to fetch')) {
        console.log('🌐 Error de conectividad: No se pudo conectar con GitHub');
      }
      return null;
    }
  };

  // Función para verificar actualizaciones
  const checkForUpdates = async () => {
    if (!window.electronAPI) {
      console.log('❌ Electron API no disponible');
      return;
    }
    
    setChecking(true);
    setUpdateAvailable(false);
    setDownloading(false);
    setUpdateDownloaded(false);
    
    console.log('🔍 Verificando actualizaciones...');
    console.log('📦 Versión actual:', appVersion);
    console.log('🔗 Repositorio configurado: cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos');
    
    try {
      // Verificar conectividad con GitHub primero
      const githubData = await testGitHubConnection();
      if (githubData) {
        console.log('🌐 GitHub conectado, verificando actualizaciones...');
        console.log('📦 Última versión en GitHub:', githubData.tag_name);
        
        // Comparar versiones
        const currentVersion = appVersion.replace('v', '');
        const latestVersion = githubData.tag_name.replace('v', '');
        
        if (latestVersion > currentVersion) {
          console.log('✅ Nueva versión disponible:', latestVersion);
          setUpdateAvailable(true);
          showAlertMessage(`Nueva versión disponible: ${latestVersion}`, 'success');
        } else {
          console.log('✅ Ya tienes la última versión');
          showAlertMessage('Ya tienes la última versión disponible', 'info');
        }
      } else {
        console.log('⚠️ No se pudo conectar con GitHub');
        showAlertMessage('No se pudo verificar actualizaciones. Revisa tu conexión a internet.', 'warning');
      }
      
      // También intentar verificar con electron-updater
      try {
        await window.electronAPI.checkForUpdates();
        console.log('✅ Solicitud de verificación enviada correctamente');
      } catch (electronError) {
        console.log('⚠️ Error con electron-updater:', electronError.message);
        // No mostrar error al usuario si ya tenemos respuesta de GitHub
      }
      
    } catch (error) {
      console.error('Error verificando actualizaciones:', error);
      console.log('❌ Error en verificación:', error.message);
      showAlertMessage('Error al verificar actualizaciones', 'error');
    } finally {
      setChecking(false);
    }
  };

  // Función para descargar actualización
  const downloadUpdate = async () => {
    if (!window.electronAPI) return;
    
    setDownloading(true);
    setDownloadProgress(0);
    
    console.log('⬇️ Iniciando descarga de actualización...');
    
    try {
      await window.electronAPI.downloadUpdate();
      console.log('✅ Solicitud de descarga enviada correctamente');
    } catch (error) {
      console.error('Error descargando actualización:', error);
      console.log('❌ Error en descarga:', error.message);
      setDownloading(false);
    }
  };

  // Función para instalar actualización
  const installUpdate = async () => {
    if (!window.electronAPI) return;
    
    console.log('🔄 Iniciando instalación de actualización...');
    
    try {
      await window.electronAPI.installUpdate();
      console.log('✅ Solicitud de instalación enviada correctamente');
    } catch (error) {
      console.error('Error instalando actualización:', error);
      console.log('❌ Error en instalación:', error.message);
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

  // Renderizar sección de actualizaciones (solo para admin)
  function renderUpdateSection() {
    // Visible para todos los usuarios, pero con funcionalidades diferentes según el rol
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          background: colors.card,
          borderRadius: 12,
          padding: '24px',
          marginBottom: '24px',
          border: `1.5px solid ${colors.border}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <Zap size={20} color={colors.primary} />
          <h3 style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 600 }}>
            Actualizaciones de la Aplicación
          </h3>
          {!canInstallUpdates && (
            <span style={{
              padding: '4px 8px',
              borderRadius: '12px',
              fontSize: '11px',
              background: colors.warning + '22',
              color: colors.warning,
              fontWeight: '500'
            }}>
              Solo lectura
            </span>
          )}
        </div>
        
        {/* Información de debug para todos los usuarios */}
        <div style={{ 
          marginBottom: 16, 
          padding: '12px', 
          background: colors.surface, 
          borderRadius: 8,
          fontSize: 12,
          color: colors.textSecondary,
          border: `1px solid ${colors.border}`
        }}>
          <strong>🔧 Información de Debug:</strong><br/>
          • Repositorio: cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos<br/>
          • Versión actual: {appVersion}<br/>
          • Estado: {checking ? 'Verificando...' : 'Listo'}<br/>
          • API disponible: {window.electronAPI ? '✅ Sí' : '❌ No'}
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <button
            onClick={checkForUpdates}
            disabled={checking || downloading}
            style={{
              background: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 16px',
              fontSize: 14,
              fontWeight: 600,
              cursor: checking || downloading ? 'not-allowed' : 'pointer',
              opacity: checking || downloading ? 0.6 : 1
            }}
          >
            {checking ? 'Verificando...' : 'Verificar Actualizaciones'}
          </button>
        </div>
        
        {updateAvailable && !downloading && !updateDownloaded && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: colors.success, marginBottom: 8, fontWeight: 500 }}>
              ✅ Nueva actualización disponible
            </div>
            {canInstallUpdates ? (
              <button
                onClick={downloadUpdate}
                style={{
                  background: colors.success,
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Descargar Actualización
              </button>
            ) : (
              <div style={{ 
                padding: '12px', 
                background: colors.warning + '22', 
                borderRadius: 8,
                color: colors.warning,
                fontSize: 13
              }}>
                Contacta con un administrador para instalar la actualización
              </div>
            )}
          </div>
        )}
        
        {downloading && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: colors.warning, marginBottom: 8, fontWeight: 500 }}>
              ⬇️ Descargando actualización...
            </div>
            <div style={{ 
              width: '100%', 
              height: 8, 
              background: colors.border, 
              borderRadius: 4,
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${downloadProgress}%`,
                height: '100%',
                background: colors.primary,
                transition: 'width 0.3s ease'
              }} />
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 4 }}>
              {Math.round(downloadProgress)}% completado
            </div>
          </div>
        )}
        
        {updateDownloaded && (
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: colors.success, marginBottom: 8, fontWeight: 500 }}>
              ✅ Actualización descargada y lista para instalar
            </div>
            {canInstallUpdates ? (
              <button
                onClick={installUpdate}
                style={{
                  background: colors.error,
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 16px',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Reiniciar e Instalar
              </button>
            ) : (
              <div style={{ 
                padding: '12px', 
                background: colors.warning + '22', 
                borderRadius: 8,
                color: colors.warning,
                fontSize: 13
              }}>
                Contacta con un administrador para completar la instalación
              </div>
            )}
            <div style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>
              La aplicación se cerrará automáticamente para instalar la actualización
            </div>
          </div>
        )}
        
        <div style={{ fontSize: 12, color: colors.textSecondary }}>
          Versión actual: {appVersion}
        </div>
        
        {isAdmin && (
          <div style={{ 
            marginTop: 12, 
            padding: '12px', 
            background: colors.surface, 
            borderRadius: 8,
            fontSize: 12,
            color: colors.textSecondary
          }}>
            <strong>Información técnica:</strong> Las actualizaciones se descargan automáticamente en segundo plano. 
            Los usuarios recibirán notificaciones cuando haya nuevas versiones disponibles.
          </div>
        )}
      </motion.div>
    );
  }

  // Render principal
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        padding: '24px',
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
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
        {renderUpdateSection()}
      </motion.div>
    </motion.div>
  );
};

export default SettingsPage; 