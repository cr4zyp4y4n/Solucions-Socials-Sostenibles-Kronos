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
  Zap,
  Database,
  Cloud
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useDataContext } from './DataContext';
import { useCurrency } from './CurrencyContext';
import ConnectionTest from './ConnectionTest';
import holdedApi from '../services/holdedApi';
import HoldedTest from './HoldedTest';
import { useAuth } from './AuthContext';
import { dbService, supabase } from '../config/supabase';
import { HOLDED_OFFICIAL_USAGE_DEFAULT } from '../constants/holdedOfficialUsageDefaults';

console.log('SettingsPage');

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

// Hook para estado Holded Solucions — NO auto-llama a la API (ahorra cupo).
// status: idle | testing | success | error
function useHoldedSolucionsConnectionStatus() {
  const [status, setStatus] = useReactState('idle');
  const [error, setError] = useReactState(null);

  const testNow = React.useCallback(async () => {
    setStatus('testing');
    setError(null);
    try {
      await holdedApi.testConnection('solucions');
      setStatus('success');
      setError(null);
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }, []);

  return { status, error, testNow };
}

// Hook para estado Holded Menjar — NO auto-llama a la API (ahorra cupo).
function useHoldedMenjarConnectionStatus() {
  const [status, setStatus] = useReactState('idle');
  const [error, setError] = useReactState(null);

  const testNow = React.useCallback(async () => {
    setStatus('testing');
    setError(null);
    try {
      await holdedApi.testConnection('menjar');
      setStatus('success');
      setError(null);
    } catch (err) {
      setStatus('error');
      setError(err.message);
    }
  }, []);

  return { status, error, testNow };
}

// Hook para obtener el uso de la base de datos
function useDatabaseUsage(isAdmin) {
  const [sizeBytes, setSizeBytes] = useReactState(0);
  const [loading, setLoading] = useReactState(false);
  const [error, setError] = useReactState(null);

  React.useEffect(() => {
    if (!isAdmin) return;

    let isMounted = true;
    async function fetchSize() {
      setLoading(true);
      try {
        const { data, error } = await dbService.getDatabaseSize();
        if (!isMounted) return;
        
        if (error) throw error;
        setSizeBytes(data || 0);
        setError(null);
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching DB size:', err);
        setError(err.message);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchSize();
    return () => { isMounted = false; };
  }, [isAdmin]);

  return { sizeBytes, loading, error };
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
          addDebugLog(`📦 Versión de la aplicación obtenida: ${version}`, 'success');
        }
      } catch (error) {
        addDebugLog(`⚠️ No se pudo obtener la versión de la aplicación: ${error.message}`, 'warning');
        // Mantener la versión por defecto
      }
    };

    getAppVersion();
    addDebugLog('🚀 Componente SettingsPage cargado', 'info');
    addDebugLog(`🔧 API de Electron disponible: ${!!window.electronAPI}`, 'info');
  }, []);

  // Estados para actualizaciones
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [updateDownloaded, setUpdateDownloaded] = useState(false);
  const [checking, setChecking] = useState(false);
  const [debugLogs, setDebugLogs] = useState([]);
  const [showDebugLogs, setShowDebugLogs] = useState(false);
  const [shouldAutoDownload, setShouldAutoDownload] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null); // Almacenar info de la actualización de electron-updater
  const [downloadingExecutable, setDownloadingExecutable] = useState(false); // Estado para descarga manual del ejecutable
  const [latestVersion, setLatestVersion] = useState(null); // Versión más reciente de GitHub

  // Obtener la última versión de GitHub al cargar
  useEffect(() => {
    const fetchLatestVersion = async () => {
      try {
        const response = await fetch('https://api.github.com/repos/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases/latest', {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SSS-Kronos-App'
          }
        });
        
        if (response.ok) {
          const githubData = await response.json();
          const currentVersion = appVersion.replace('v', '');
          const latestVersionTag = githubData.tag_name.replace('v', '');
          
          setLatestVersion(latestVersionTag);
          
          // Comparar versiones
          if (latestVersionTag > currentVersion) {
            setUpdateAvailable(true);
            setUpdateInfo({
              version: latestVersionTag,
              currentVersion: currentVersion,
              releaseNotes: githubData.body,
              htmlUrl: githubData.html_url
            });
          }
        }
      } catch (error) {
        console.error('Error obteniendo última versión:', error);
      }
    };

    if (appVersion) {
      fetchLatestVersion();
    }
  }, [appVersion]);

  // Verificar si el usuario es admin (async check robusto)
  const [isAdmin, setIsAdmin] = useState(false);
  
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!user?.id) {
        setIsAdmin(false);
        return;
      }
      
      // 1. Check metadata (fast)
      if (user?.user_metadata?.role === 'admin') {
        setIsAdmin(true);
        // We can still verify with DB in background if needed, but usually metadata is enough if consistent.
        // However, sticking to the robust pattern from UserManagement:
      }

      try {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (!error && (data?.role === 'admin' || user?.user_metadata?.role === 'admin')) {
          setIsAdmin(true);
        } else {
          // If metadata said yes but DB said no? Usually DB wins or we keep metadata.
          // Let's stick to: if EITHER says admin, you are admin, as per UserManagement logic.
          if (user?.user_metadata?.role === 'admin') {
             setIsAdmin(true);
          } else {
             setIsAdmin(false);
          }
        }
      } catch (e) {
        // Fallback to metadata
        setIsAdmin(user?.user_metadata?.role === 'admin');
      }
    };
    
    checkAdminStatus();
  }, [user]);
  // Verificar si el usuario puede instalar actualizaciones (admin, management, manager, user)
  const canInstallUpdates = user?.role === 'authenticated' && 
    ['admin', 'management', 'manager', 'user'].includes(user?.user_metadata?.role);

  // Helpers de rol
  const isManagementOrManager = user?.role === 'management' || user?.role === 'manager' || user?.user_metadata?.role === 'management' || user?.user_metadata?.role === 'manager';
  const isUser = user?.role === 'authenticated' && user?.user_metadata?.role === 'user';
  const isManagementOrUser = isManagementOrManager || isUser;

  // Estado de conexión Supabase (badge)
  const { status: supabaseStatus, error: supabaseError } = useSupabaseConnectionStatus();

  // Estado de conexión Holded Solucions (badge) — sin auto-call
  const { status: holdedSolucionsStatus, error: holdedSolucionsError, testNow: testHoldedSolucions } = useHoldedSolucionsConnectionStatus();

  // Estado de conexión Holded Menjar (badge) — sin auto-call
  const { status: holdedMenjarStatus, error: holdedMenjarError, testNow: testHoldedMenjar } = useHoldedMenjarConnectionStatus();

  // Contador local Holded (0 coste API) + snapshot panel oficial
  const [holdedUsage, setHoldedUsage] = useState(null);
  const [holdedUsageLoading, setHoldedUsageLoading] = useState(false);
  const [holdedOfficialEdit, setHoldedOfficialEdit] = useState(false);
  const [holdedOfficialForm, setHoldedOfficialForm] = useState({ used: '6370', limit: '7500', remaining: '1130' });
  const [holdedOfficialSaving, setHoldedOfficialSaving] = useState(false);

  const refreshHoldedUsage = React.useCallback(async () => {
    if (!window.electronAPI?.getHoldedApiUsage) {
      setHoldedUsage(null);
      return;
    }
    setHoldedUsageLoading(true);
    try {
      const snap = await window.electronAPI.getHoldedApiUsage();
      setHoldedUsage(snap);
      if (snap?.official) {
        setHoldedOfficialForm({
          used: String(snap.official.used ?? ''),
          limit: String(snap.official.planLimit ?? 7500),
          remaining: String(snap.official.remaining ?? '')
        });
      }
    } catch (e) {
      console.warn('No se pudo leer uso Holded local:', e);
    } finally {
      setHoldedUsageLoading(false);
    }
  }, []);

  const saveHoldedOfficial = React.useCallback(async () => {
    if (!window.electronAPI?.setHoldedOfficialUsage) {
      showAlertMessage(
        'Reinicia Kronos por completo (cerrar ventana y volver a abrir) para activar el guardado del panel Holded.',
        'error'
      );
      return;
    }
    setHoldedOfficialSaving(true);
    try {
      const used = parseInt(holdedOfficialForm.used, 10) || 0;
      const planLimit = parseInt(holdedOfficialForm.limit, 10) || 7500;
      const remaining = holdedOfficialForm.remaining !== ''
        ? parseInt(holdedOfficialForm.remaining, 10)
        : Math.max(0, planLimit - used);
      const base = holdedUsage?.official || HOLDED_OFFICIAL_USAGE_DEFAULT;
      const snap = await window.electronAPI.setHoldedOfficialUsage({
        used,
        planLimit,
        remaining,
        percentUsed: planLimit > 0 ? Math.round((used / planLimit) * 1000) / 10 : 0,
        period: holdedUsage?.period || base.period,
        zones: base.zones,
        endpoints: base.endpoints,
        warningMessage: base.warningMessage,
        note: 'Actualizado manualmente desde Configuración Kronos'
      });
      setHoldedUsage(snap);
      setHoldedOfficialEdit(false);
      showAlertMessage('Snapshot del panel Holded guardado.', 'success');
    } catch (e) {
      console.warn('No se pudo guardar snapshot oficial Holded:', e);
      showAlertMessage(
        'No se pudo guardar. Cierra Kronos del todo (no solo recargar) y ábrelo de nuevo: el proceso main tiene que cargar el handler nuevo.',
        'error'
      );
    } finally {
      setHoldedOfficialSaving(false);
    }
  }, [holdedOfficialForm, holdedUsage]);

  useEffect(() => {
    refreshHoldedUsage();
    const id = setInterval(refreshHoldedUsage, 15000);
    return () => clearInterval(id);
  }, [refreshHoldedUsage]);

  // Estado de uso de base de datos
  const { sizeBytes: dbSizeBytes, loading: dbLoading } = useDatabaseUsage(isAdmin);
  
  // Format bytes to legible string
  const formatBytes = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  // Calculate percentage based on 500MB free tier limit (adjust as needed)
  const TIER_LIMIT_MB = 500;
  const TIER_LIMIT_BYTES = TIER_LIMIT_MB * 1024 * 1024;
  const usagePercentage = Math.min((dbSizeBytes / TIER_LIMIT_BYTES) * 100, 100);

  const showAlertMessage = (message, type = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  // Función para añadir logs de debug
  const addDebugLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString('es-ES');
    const logEntry = {
      id: Date.now(),
      timestamp,
      message,
      type
    };
    setDebugLogs(prev => [logEntry, ...prev.slice(0, 19)]); // Mantener solo los últimos 20 logs
    console.log(`[${timestamp}] ${message}`);
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
      addDebugLog('🔧 Configurando listeners de actualizaciones...', 'info');
      
      // Listener para actualización disponible
      window.electronAPI.onUpdateAvailable((event, info) => {
        addDebugLog('✅ Evento: update-available recibido', 'success');
        addDebugLog(`📦 Información: ${JSON.stringify(info)}`, 'info');
        setUpdateAvailable(true);
        setUpdateInfo(info); // Guardar info de la actualización
        setChecking(false);
      });

      // Listener para no hay actualización disponible
      window.electronAPI.onUpdateNotAvailable((event, info) => {
        addDebugLog('ℹ️ Evento: update-not-available recibido', 'info');
        addDebugLog(`📦 Información: ${JSON.stringify(info)}`, 'info');
        setChecking(false);
      });

      // Listener para progreso de descarga
      window.electronAPI.onDownloadProgress((event, progressObj) => {
        addDebugLog(`📊 Progreso de descarga: ${progressObj.percent}%`, 'info');
        addDebugLog(`🚀 Velocidad: ${progressObj.bytesPerSecond} bytes/s`, 'info');
        addDebugLog(`📦 Tamaño total: ${progressObj.total} bytes`, 'info');
        addDebugLog(`📥 Descargado: ${progressObj.transferred} bytes`, 'info');
        setDownloadProgress(progressObj.percent);
      });

      // Listener para actualización descargada
      window.electronAPI.onUpdateDownloaded((event, info) => {
        addDebugLog('✅ Evento: update-downloaded recibido', 'success');
        addDebugLog(`📦 Información: ${JSON.stringify(info)}`, 'info');
        setUpdateDownloaded(true);
        setDownloading(false);
      });

      // Listener para errores de actualización
      window.electronAPI.onUpdateError((event, error) => {
        addDebugLog(`❌ Evento: update-error recibido`, 'error');
        addDebugLog(`🔍 Error: ${error.message}`, 'error');
        addDebugLog(`🔧 Código: ${error.code}`, 'error');
        setChecking(false);
        setDownloading(false);
      });
      
      addDebugLog('✅ Listeners configurados correctamente', 'success');
    } else {
      addDebugLog('❌ No se pudieron configurar listeners: API no disponible', 'error');
    }

    return () => {
      if (window.electronAPI) {
        addDebugLog('🧹 Limpiando listeners de actualizaciones...', 'info');
        window.electronAPI.removeAllListeners('update-available');
        window.electronAPI.removeAllListeners('download-progress');
        window.electronAPI.removeAllListeners('update-downloaded');
      }
    };
  }, []);

  // useEffect para manejar descarga automática (deshabilitado - esperar a que electron-updater lo haga)
  // useEffect(() => {
  //   if (updateAvailable && shouldAutoDownload && !downloading) {
  //     addDebugLog('🔄 Descarga automática iniciada por useEffect', 'info');
  //     setShouldAutoDownload(false); // Resetear la bandera
  //     downloadUpdate();
  //   }
  // }, [updateAvailable, shouldAutoDownload, downloading]);

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
      addDebugLog('❌ Electron API no disponible', 'error');
      return;
    }
    
    setChecking(true);
    setUpdateAvailable(false);
    setDownloading(false);
    setUpdateDownloaded(false);
    addDebugLog('🔍 Iniciando verificación de actualizaciones...', 'info');
    addDebugLog(`📦 Versión actual: ${appVersion}`, 'info');
    addDebugLog('🔗 Repositorio: cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos', 'info');
    
    try {
      // Verificar conectividad con GitHub primero
      addDebugLog('🌐 Conectando con GitHub API...', 'info');
      const githubData = await testGitHubConnection();
      if (githubData) {
        addDebugLog('✅ GitHub conectado exitosamente', 'success');
        addDebugLog(`📦 Última versión en GitHub: ${githubData.tag_name}`, 'info');
        
        // Comparar versiones
        const currentVersion = appVersion.replace('v', '');
        const latestVersion = githubData.tag_name.replace('v', '');
        
        if (latestVersion > currentVersion) {
          addDebugLog(`✅ Nueva versión disponible en GitHub: ${latestVersion}`, 'success');
          showAlertMessage(`Nueva versión disponible: ${latestVersion}`, 'success');
          addDebugLog('⏳ Esperando verificación de electron-updater...', 'info');
          // NO establecer updateAvailable aquí, esperar a que electron-updater lo confirme
        } else {
          addDebugLog('✅ Ya tienes la última versión', 'info');
          addDebugLog(`📦 Versión actual: ${currentVersion}`, 'info');
          addDebugLog(`📦 Última versión en GitHub: ${latestVersion}`, 'info');
          addDebugLog('ℹ️ No hay actualización disponible porque ya tienes la versión más reciente', 'info');
          showAlertMessage('Ya tienes la última versión disponible', 'info');
        }
      } else {
        addDebugLog('⚠️ No se pudo conectar con GitHub', 'warning');
        showAlertMessage('No se pudo verificar actualizaciones. Revisa tu conexión a internet.', 'warning');
      }
      
      // También intentar verificar con electron-updater (solo en producción)
      if (process.env.NODE_ENV !== 'development') {
        try {
          addDebugLog('📡 Enviando solicitud a electron-updater...', 'info');
          await window.electronAPI.checkForUpdates();
          addDebugLog('✅ Solicitud de verificación enviada correctamente', 'success');
        } catch (electronError) {
          addDebugLog(`⚠️ Error con electron-updater: ${electronError.message}`, 'warning');
          // No mostrar error al usuario si ya tenemos respuesta de GitHub
        }
      } else {
        addDebugLog('🛠️ Modo desarrollo: saltando electron-updater', 'info');
      }
      
    } catch (error) {
      addDebugLog(`❌ Error verificando actualizaciones: ${error.message}`, 'error');
      showAlertMessage('Error al verificar actualizaciones', 'error');
    } finally {
      setChecking(false);
      addDebugLog('🔍 Verificación completada', 'info');
    }
  };

  // Función para descargar actualización
  const downloadUpdate = async () => {
    if (!window.electronAPI) {
      addDebugLog('❌ Electron API no disponible para descarga', 'error');
      showAlertMessage('Error: API de Electron no disponible', 'error');
      return;
    }
    
    // Verificar que se haya detectado una actualización disponible POR electron-updater
    if (!updateAvailable || !updateInfo) {
      addDebugLog('⚠️ No se puede descargar: electron-updater aún no ha verificado la actualización', 'warning');
      addDebugLog('💡 Espera a que aparezca "✅ Actualización disponible" después de verificar', 'info');
      showAlertMessage('Espera a que se complete la verificación de actualizaciones', 'warning');
      return;
    }
    
    setDownloading(true);
    setDownloadProgress(0);
    
    addDebugLog('⬇️ Iniciando descarga de actualización...', 'info');
    addDebugLog('🔧 Detalles de la descarga:', 'info');
    addDebugLog(`   • API disponible: ${!!window.electronAPI}`, 'info');
    addDebugLog(`   • Función downloadUpdate disponible: ${typeof window.electronAPI.downloadUpdate}`, 'info');
    addDebugLog('   • Estado actual: descargando', 'info');
    addDebugLog('   • Actualización verificada: sí', 'info');
    
    try {
      if (process.env.NODE_ENV === 'development') {
        addDebugLog('🛠️ Modo desarrollo: simulando descarga...', 'info');
        // Simular descarga en desarrollo
        let progress = 0;
        const interval = setInterval(() => {
          progress += Math.random() * 15;
          if (progress >= 100) {
            progress = 100;
            clearInterval(interval);
            addDebugLog('✅ Descarga simulada completada', 'success');
            setDownloading(false);
            setUpdateDownloaded(true);
          } else {
            setDownloadProgress(progress);
            addDebugLog(`📊 Progreso simulado: ${Math.round(progress)}%`, 'info');
          }
        }, 500);
      } else {
        addDebugLog('📡 Enviando solicitud de descarga al proceso principal...', 'info');
        await window.electronAPI.downloadUpdate();
        addDebugLog('✅ Solicitud de descarga enviada correctamente al proceso principal', 'success');
        addDebugLog('⏳ Esperando eventos de progreso y finalización...', 'info');
      }
      
      // Añadir timeout para detectar si no hay respuesta
      setTimeout(() => {
        if (downloading && downloadProgress === 0) {
          addDebugLog('⚠️ Timeout: No se recibió progreso de descarga después de 10 segundos', 'warning');
          addDebugLog('🔍 Posibles causas:', 'warning');
          addDebugLog('   • El proceso principal no está respondiendo', 'warning');
          addDebugLog('   • Error en la configuración del auto-updater', 'warning');
          addDebugLog('   • Problema de conectividad con GitHub', 'warning');
          showAlertMessage('Timeout: No se recibió respuesta del proceso de descarga', 'warning');
        }
      }, 10000);
      
    } catch (error) {
      addDebugLog(`❌ Error descargando actualización: ${error.message}`, 'error');
      addDebugLog('🔍 Detalles del error:', 'error');
      addDebugLog(`   • Mensaje: ${error.message}`, 'error');
      addDebugLog(`   • Stack: ${error.stack}`, 'error');
      addDebugLog(`   • Tipo de error: ${error.constructor.name}`, 'error');
      setDownloading(false);
      showAlertMessage(`Error en descarga: ${error.message}`, 'error');
    }
  };

  // Función para descargar el ejecutable del último release manualmente
  const downloadLatestExecutable = async () => {
    if (!window.electronAPI) {
      showAlertMessage('Error: API de Electron no disponible', 'error');
      return;
    }

    setDownloadingExecutable(true);
    addDebugLog('⬇️ Iniciando descarga manual del ejecutable...', 'info');

    try {
      const result = await window.electronAPI.downloadLatestExecutable();
      
      if (result.success) {
        addDebugLog(`✅ Archivo descargado exitosamente: ${result.filePath}`, 'success');
        addDebugLog(`📦 Versión: ${result.version}`, 'info');
        showAlertMessage(
          `Archivo descargado exitosamente en: ${result.filePath}\n\nVersión: ${result.version}\n\nPuedes ejecutarlo para instalar la nueva versión.`,
          'success'
        );
      } else {
        addDebugLog(`❌ Error: ${result.message}`, 'error');
        showAlertMessage(`Error al descargar: ${result.message}`, 'error');
      }
    } catch (error) {
      addDebugLog(`❌ Error descargando ejecutable: ${error.message}`, 'error');
      showAlertMessage(`Error al descargar: ${error.message}`, 'error');
    } finally {
      setDownloadingExecutable(false);
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
          description: holdedSolucionsStatus === 'idle' ? 'Sin comprobar (ahorra cupo). Pulsa para verificar.' :
                      holdedSolucionsStatus === 'success' ? 'Conectado correctamente' : 
                      holdedSolucionsStatus === 'error' ? `Error: ${holdedSolucionsError}` : 
                      'Comprobando conexión...',
          action: holdedSolucionsStatus === 'testing' ? null : testHoldedSolucions,
          actionLabel: 'Comprobar',
          color: holdedSolucionsStatus === 'success' ? colors.success : 
                 holdedSolucionsStatus === 'error' ? colors.error : 
                 holdedSolucionsStatus === 'testing' ? colors.warning :
                 colors.textSecondary,
          disabled: false
        },
        {
          icon: CheckCircle,
          title: 'Conexión Holded Menjar',
          description: holdedMenjarStatus === 'idle' ? 'Sin comprobar (ahorra cupo). Pulsa para verificar.' :
                      holdedMenjarStatus === 'success' ? 'Conectado correctamente' : 
                      holdedMenjarStatus === 'error' ? `Error: ${holdedMenjarError}` : 
                      'Comprobando conexión...',
          action: holdedMenjarStatus === 'testing' ? null : testHoldedMenjar,
          actionLabel: 'Comprobar',
          color: holdedMenjarStatus === 'success' ? colors.success : 
                 holdedMenjarStatus === 'error' ? colors.error : 
                 holdedMenjarStatus === 'testing' ? colors.warning :
                 colors.textSecondary,
          disabled: false
        }
      ]
    }
  ];

  // Sección de configuración de divisa
  const renderDivisaSection = () => {
    if (isAdmin || isManagementOrUser) {
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
    }
    return null;
  };

  // Sección de estado de conexiones
  const renderEstadoConexiones = () => {
    if (isAdmin || isManagementOrUser) {
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
                {item.action && (
                  <button
                    type="button"
                    onClick={item.action}
                    style={{
                      padding: '8px 12px',
                      borderRadius: 6,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 500,
                      flexShrink: 0
                    }}
                  >
                    {item.actionLabel || 'Acción'}
                  </button>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>
      );
    }
    return null;
  };

  const renderHoldedUsageSection = () => {
    if (!(isAdmin || isManagementOrUser)) return null;

    const official = holdedUsage?.official || HOLDED_OFFICIAL_USAGE_DEFAULT;
    const estimated = holdedUsage?.estimated || {
      used: (official.used || 0) + (holdedUsage?.monthTotal || 0),
      remaining: Math.max(0, (official.planLimit || 7500) - ((official.used || 0) + (holdedUsage?.monthTotal || 0))),
      percentUsed: 0,
      deltaSinceOfficial: holdedUsage?.monthTotal || 0,
      planLimit: official.planLimit || 7500
    };
    if (!holdedUsage?.estimated && estimated.planLimit > 0) {
      estimated.percentUsed = Math.round((estimated.used / estimated.planLimit) * 1000) / 10;
    }
    const monthTotal = holdedUsage?.monthTotal ?? 0;
    const top = holdedUsage?.topEndpoints || [];
    const zonesLocal = holdedUsage?.byZoneMonth || {};

    const displayUsed = estimated?.used ?? official?.used ?? 0;
    const displayLimit = estimated?.planLimit ?? official?.planLimit ?? 7500;
    const displayRemaining = estimated?.remaining ?? official?.remaining ?? Math.max(0, displayLimit - displayUsed);
    const displayPct = estimated?.percentUsed ?? official?.percentUsed ?? 0;
    const barColor = displayPct >= 90 ? colors.error : displayPct >= 75 ? colors.warning : colors.primary;

    const inputStyle = {
      width: '100%',
      padding: '8px 10px',
      borderRadius: 6,
      border: `1px solid ${colors.border}`,
      background: colors.surface,
      color: colors.text,
      fontSize: 14,
      boxSizing: 'border-box'
    };

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.32 }}
        style={{
          background: colors.card,
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          padding: '24px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Zap size={20} color={colors.text} style={{ marginRight: 10 }} />
            <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Uso API Holded</h3>
          </div>
          <button
            type="button"
            onClick={refreshHoldedUsage}
            disabled={holdedUsageLoading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '8px 12px',
              borderRadius: 6,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              cursor: holdedUsageLoading ? 'wait' : 'pointer',
              fontSize: 13
            }}
          >
            <RefreshCw size={14} />
            Actualizar
          </button>
        </div>

        <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 18 }}>
          Holded no tiene endpoint de uso: los datos del panel se guardan aquí a mano.
          El total aprox. = panel + llamadas de Kronos desde la última captura.
        </div>

        {/* —— Panel oficial (como en Holded) —— */}
        <div style={{
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: colors.surface,
          marginBottom: 16
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: colors.text }}>
              Panel Holded (oficial · manual)
            </div>
            <button
              type="button"
              onClick={() => setHoldedOfficialEdit((v) => !v)}
              style={{
                padding: '6px 10px',
                borderRadius: 6,
                border: `1px solid ${colors.border}`,
                background: colors.card,
                color: colors.text,
                cursor: 'pointer',
                fontSize: 12
              }}
            >
              {holdedOfficialEdit ? 'Cancelar' : 'Editar números'}
            </button>
          </div>

          {displayPct >= 75 && (
            <div style={{
              fontSize: 12,
              color: colors.warning,
              marginBottom: 12,
              padding: '8px 10px',
              borderRadius: 6,
              background: colors.warning + '18',
              border: `1px solid ${colors.warning}44`
            }}>
              {official?.warningMessage ||
                'El uso se acerca al límite del plan. Valora ampliar capacidad en Holded.'}
            </div>
          )}

          {holdedOfficialEdit ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: colors.textSecondary }}>
                Usadas
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={holdedOfficialForm.used}
                  onChange={(e) => setHoldedOfficialForm((f) => ({ ...f, used: e.target.value }))}
                />
              </label>
              <label style={{ fontSize: 12, color: colors.textSecondary }}>
                Límite
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={holdedOfficialForm.limit}
                  onChange={(e) => setHoldedOfficialForm((f) => ({ ...f, limit: e.target.value }))}
                />
              </label>
              <label style={{ fontSize: 12, color: colors.textSecondary }}>
                Restantes
                <input
                  style={{ ...inputStyle, marginTop: 4 }}
                  value={holdedOfficialForm.remaining}
                  onChange={(e) => setHoldedOfficialForm((f) => ({ ...f, remaining: e.target.value }))}
                  placeholder="auto"
                />
              </label>
              <div style={{ gridColumn: '1 / -1' }}>
                <button
                  type="button"
                  onClick={saveHoldedOfficial}
                  disabled={holdedOfficialSaving}
                  style={{
                    padding: '8px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: colors.primary,
                    color: '#fff',
                    cursor: holdedOfficialSaving ? 'wait' : 'pointer',
                    fontSize: 13,
                    fontWeight: 600
                  }}
                >
                  Guardar snapshot del panel
                </button>
              </div>
            </div>
          ) : (
            <>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{ fontSize: 14, color: colors.text, fontWeight: 500 }}>
                  Uso del testimonio (aprox. actual)
                </span>
                <span style={{ fontSize: 13, color: colors.textSecondary }}>
                  {displayUsed.toLocaleString('es-ES')} / {displayLimit.toLocaleString('es-ES')} · {displayRemaining.toLocaleString('es-ES')} rest.
                </span>
              </div>
              <div style={{
                height: 10,
                width: '100%',
                backgroundColor: colors.border,
                borderRadius: 4,
                overflow: 'hidden',
                marginBottom: 8
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.min(100, displayPct)}%` }}
                  transition={{ duration: 0.6, ease: 'easeOut' }}
                  style={{ height: '100%', backgroundColor: barColor, borderRadius: 4 }}
                />
              </div>
              <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
                {displayPct}% del límit mensual
                {estimated?.deltaSinceOfficial > 0
                  ? ` · +${estimated.deltaSinceOfficial} desde captura Kronos`
                  : ''}
                {official?.capturedAt
                  ? ` · captura: ${new Date(official.capturedAt).toLocaleString('es-ES')}`
                  : ''}
              </div>
            </>
          )}

          {Array.isArray(official?.zones) && official.zones.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 6 }}>Distribución por zona</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {official.zones.map((z) => (
                  <span
                    key={z.name}
                    style={{
                      fontSize: 12,
                      padding: '4px 10px',
                      borderRadius: 6,
                      background: colors.card,
                      border: `1px solid ${colors.border}`,
                      color: colors.text
                    }}
                  >
                    {z.name}: {Number(z.count).toLocaleString('es-ES')}
                    {z.percent != null ? ` (${z.percent}%)` : ''}
                  </span>
                ))}
              </div>
            </div>
          )}

          {Array.isArray(official?.endpoints) && official.endpoints.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 6 }}>
                Top endpoints (panel Holded)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 160, overflowY: 'auto' }}>
                {official.endpoints.map((row) => (
                  <div
                    key={`${row.method}-${row.path}`}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                      color: colors.textSecondary,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.method || 'GET'} {row.path}
                    </span>
                    <span style={{ flexShrink: 0, color: colors.text, fontWeight: 600 }}>
                      {Number(row.count).toLocaleString('es-ES')}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* —— Contador local Kronos —— */}
        <div style={{
          padding: 16,
          borderRadius: 8,
          border: `1px solid ${colors.border}`,
          background: colors.surface
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
            Contador Kronos (este PC)
          </div>
          <div style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 8 }}>
            Periodo {holdedUsage?.period || '—'} · solo lo que mide esta app desde que existe el contador
          </div>
          <div style={{ fontSize: 13, color: colors.text, marginBottom: 8 }}>
            Mes: <strong>{monthTotal.toLocaleString('es-ES')}</strong>
            {' · '}
            Sesión: <strong>{(holdedUsage?.sessionTotal ?? 0).toLocaleString('es-ES')}</strong>
            {holdedUsage?.lastCallAt
              ? ` · última: ${new Date(holdedUsage.lastCallAt).toLocaleString('es-ES')}`
              : ''}
          </div>

          {Object.keys(zonesLocal).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {Object.entries(zonesLocal).map(([zone, count]) => (
                <span
                  key={zone}
                  style={{
                    fontSize: 12,
                    padding: '4px 10px',
                    borderRadius: 6,
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    color: colors.text
                  }}
                >
                  {zone}: {count}
                </span>
              ))}
            </div>
          )}

          {top.length > 0 && (
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: colors.text, marginBottom: 6 }}>Top endpoints (Kronos)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 140, overflowY: 'auto' }}>
                {top.map((row) => (
                  <div
                    key={row.endpoint}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      fontSize: 12,
                      color: colors.textSecondary,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.endpoint}</span>
                    <span style={{ flexShrink: 0, color: colors.text, fontWeight: 600 }}>{row.count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!holdedUsage && (
            <div style={{ fontSize: 13, color: colors.textSecondary }}>
              Aún no hay datos locales. Tras usar Home/Analytics aparecerán aquí.
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  // Sección de Almacenamiento (Database Usage)
  const renderStorageSection = () => {
    if (isAdmin) {
      return (
         <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.5 }}
          style={{ 
            background: colors.card, 
            borderRadius: 8, 
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)', 
            padding: '24px',
            marginBottom: '32px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
            <Database size={20} color={colors.text} style={{ marginRight: '10px' }} />
            <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, margin: 0 }}>Almacenamiento</h3>
          </div>
          
          <div style={{ marginBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '14px', color: colors.text, fontWeight: '500' }}>
              Uso de Base de Datos
            </span>
            <span style={{ fontSize: '13px', color: colors.textSecondary }}>
              {formatBytes(dbSizeBytes)} utilizados
            </span>
          </div>

          {/* Progress Bar Container */}
          <div style={{ 
            height: '8px', 
            width: '100%', 
            backgroundColor: colors.border, 
            borderRadius: '4px',
            overflow: 'hidden',
            marginBottom: '8px'
          }}>
            <motion.div 
              initial={{ width: 0 }}
              animate={{ width: `${usagePercentage}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              style={{
                height: '100%',
                backgroundColor: usagePercentage > 90 ? colors.error : usagePercentage > 75 ? colors.warning : colors.primary,
                borderRadius: '4px'
              }}
            />
          </div>

          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
             {usagePercentage.toFixed(1)}% de {TIER_LIMIT_MB}MB (Plan Básico estimado)
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
          
          {/* Botón de prueba para facturas parcialmente pagadas */}
          <div style={{ marginTop: 16, padding: '16px', background: colors.surface, borderRadius: 8, border: `1px solid ${colors.border}` }}>
            <h4 style={{ color: colors.text, fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Prueba Facturas Parcialmente Pagadas</h4>
            <button
              onClick={async () => {
                try {
                  showAlertMessage('Iniciando prueba de facturas parcialmente pagadas...', 'info');
                  const holdedApi = (await import('../services/holdedApi')).default;
                  await holdedApi.testPartiallyPaidPurchases('solucions');
                  showAlertMessage('Prueba completada. Revisa la consola para ver los resultados.', 'success');
                } catch (error) {
                  console.error('Error en prueba:', error);
                  showAlertMessage('Error en la prueba: ' + error.message, 'error');
                }
              }}
              style={{
                background: colors.primary,
                color: 'white',
                border: 'none',
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.background = colors.primary + 'dd'}
              onMouseLeave={(e) => e.target.style.background = colors.primary}
            >
              Probar Facturas Parcialmente Pagadas
            </button>
          </div>
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
        
        {/* Información visual de versiones */}
        <div style={{ 
          marginBottom: 24, 
          padding: '20px', 
          background: updateAvailable ? colors.success + '15' : colors.surface, 
          borderRadius: 12,
          border: `2px solid ${updateAvailable ? colors.success : colors.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 40,
                height: 40,
                borderRadius: '50%',
                background: updateAvailable ? colors.success + '30' : colors.primary + '30',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {updateAvailable ? (
                  <Download size={20} color={colors.success} />
                ) : (
                  <CheckCircle size={20} color={colors.primary} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 4 }}>
                  {updateAvailable ? 'Actualización disponible' : 'Estás actualizado'}
                </div>
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  {updateAvailable ? 'Hay una nueva versión lista para descargar' : 'Tienes la última versión instalada'}
                </div>
              </div>
            </div>
            {updateAvailable && (
              <div style={{
                padding: '6px 12px',
                borderRadius: '20px',
                fontSize: 11,
                fontWeight: 600,
                background: colors.success,
                color: 'white'
              }}>
                Nueva versión
              </div>
            )}
          </div>

          {/* Comparación visual de versiones */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            padding: '16px',
            background: colors.card,
            borderRadius: 8,
            border: `1px solid ${colors.border}`
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>
                Versión actual
              </div>
              <div style={{
                fontSize: 18,
                fontWeight: 700,
                color: updateAvailable ? colors.textSecondary : colors.text,
                textDecoration: updateAvailable ? 'line-through' : 'none',
                opacity: updateAvailable ? 0.6 : 1
              }}>
                v{appVersion}
              </div>
            </div>
            
            {updateAvailable && latestVersion && (
              <>
                <div style={{
                  fontSize: 20,
                  color: colors.textSecondary,
                  opacity: 0.4
                }}>
                  →
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: colors.success, marginBottom: 6, fontWeight: 500 }}>
                    Nueva versión disponible
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: colors.success
                  }}>
                    v{latestVersion}
                  </div>
                </div>
              </>
            )}
            
            {!updateAvailable && latestVersion && (
              <>
                <div style={{
                  fontSize: 20,
                  color: colors.textSecondary,
                  opacity: 0.4
                }}>
                  =
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 11, color: colors.textSecondary, marginBottom: 6, fontWeight: 500 }}>
                    Última versión en GitHub
                  </div>
                  <div style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: colors.text
                  }}>
                    v{latestVersion}
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Información técnica colapsable */}
          <details style={{ fontSize: 11, color: colors.textSecondary }}>
            <summary style={{ cursor: 'pointer', fontWeight: 500, marginBottom: 8 }}>
              🔧 Información técnica
            </summary>
            <div style={{ marginTop: 8, padding: '12px', background: colors.surface, borderRadius: 6 }}>
              <div style={{ marginBottom: 4 }}>• Repositorio: cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos</div>
              <div style={{ marginBottom: 4 }}>• Estado: {checking ? 'Verificando...' : downloading ? 'Descargando...' : updateDownloaded ? 'Listo para instalar' : 'Listo'}</div>
              <div style={{ marginBottom: 4 }}>• API disponible: {window.electronAPI ? '✅ Sí' : '❌ No'}</div>
              <div>• Modo: {process.env.NODE_ENV === 'development' ? '🛠️ Desarrollo' : '🚀 Producción'}</div>
              
              {/* Logs de debug expandibles */}
              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  onClick={() => setShowDebugLogs(!showDebugLogs)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.primary,
                    cursor: 'pointer',
                    fontSize: 11,
                    textDecoration: 'underline',
                    padding: 0
                  }}
                >
                  {showDebugLogs ? 'Ocultar logs' : 'Mostrar logs'}
                </button>
                {debugLogs.length > 0 && (
                  <button
                    onClick={() => setDebugLogs([])}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: colors.error,
                      cursor: 'pointer',
                      fontSize: 10,
                      textDecoration: 'underline',
                      padding: 0
                    }}
                  >
                    Limpiar logs
                  </button>
                )}
              </div>
              
              {showDebugLogs && (
                <div style={{ 
                  marginTop: 8, 
                  padding: '8px', 
                  background: colors.card, 
                  borderRadius: 4,
                  border: `1px solid ${colors.border}`,
                  maxHeight: '200px',
                  overflowY: 'auto',
                  fontSize: 9
                }}>
                  <div style={{ marginBottom: 8, fontWeight: 600, color: colors.text }}>
                    📋 Logs de Debug ({debugLogs.length} entradas):
                  </div>
                  {debugLogs.length === 0 ? (
                    <div style={{ color: colors.textSecondary, fontStyle: 'italic' }}>
                      No hay logs disponibles. Ejecuta una verificación para ver los logs.
                    </div>
                  ) : (
                    debugLogs.map((log) => (
                      <div key={log.id} style={{ 
                        marginBottom: 4, 
                        padding: '2px 4px',
                        borderRadius: 2,
                        fontSize: 9,
                        fontFamily: 'monospace',
                        color: log.type === 'error' ? colors.error : 
                               log.type === 'warning' ? colors.warning : 
                               log.type === 'success' ? colors.success : 
                               colors.textSecondary
                      }}>
                        [{log.timestamp}] {log.message}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </details>
        </div>
        
        {/* Botón único inteligente - Descarga ejecutable directamente */}
        <div style={{ marginBottom: 16 }}>
          {updateAvailable && !downloadingExecutable ? (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={downloadLatestExecutable}
              disabled={downloadingExecutable || checking}
              style={{
                width: '100%',
                background: colors.success,
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: (downloadingExecutable || checking) ? 'not-allowed' : 'pointer',
                opacity: (downloadingExecutable || checking) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                boxShadow: (downloadingExecutable || checking) ? 'none' : `0 4px 12px ${colors.success}40`
              }}
            >
              <Download size={20} />
              Descargar Actualización (v{latestVersion})
            </motion.button>
          ) : downloadingExecutable ? (
            <motion.button
              disabled
              style={{
                width: '100%',
                background: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: 'not-allowed',
                opacity: 0.6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12
              }}
            >
              <Download size={20} />
              Descargando ejecutable...
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={async () => {
                // Verificar actualizaciones primero
                setChecking(true);
                addDebugLog('🔍 Verificando actualizaciones...', 'info');
                
                try {
                  const response = await fetch('https://api.github.com/repos/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases/latest', {
                    method: 'GET',
                    headers: {
                      'Accept': 'application/vnd.github.v3+json',
                      'User-Agent': 'SSS-Kronos-App'
                    }
                  });
                  
                  if (response.ok) {
                    const githubData = await response.json();
                    const currentVersion = appVersion.replace('v', '');
                    const latestVersionTag = githubData.tag_name.replace('v', '');
                    
                    setLatestVersion(latestVersionTag);
                    
                    if (latestVersionTag > currentVersion) {
                      addDebugLog(`✅ Nueva versión disponible: ${latestVersionTag}`, 'success');
                      setUpdateAvailable(true);
                      setUpdateInfo({
                        version: latestVersionTag,
                        currentVersion: currentVersion,
                        releaseNotes: githubData.body,
                        htmlUrl: githubData.html_url
                      });
                      // Descargar automáticamente si hay actualización
                      downloadLatestExecutable();
                    } else {
                      addDebugLog('✅ Ya tienes la última versión', 'info');
                      showAlertMessage('Ya tienes la última versión disponible', 'info');
                    }
                  }
                } catch (error) {
                  addDebugLog(`❌ Error verificando: ${error.message}`, 'error');
                  showAlertMessage('Error al verificar actualizaciones', 'error');
                } finally {
                  setChecking(false);
                }
              }}
              disabled={checking || downloadingExecutable}
              style={{
                width: '100%',
                background: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: 12,
                padding: '16px 24px',
                fontSize: 16,
                fontWeight: 600,
                cursor: (checking || downloadingExecutable) ? 'not-allowed' : 'pointer',
                opacity: (checking || downloadingExecutable) ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 12,
                boxShadow: (checking || downloadingExecutable) ? 'none' : `0 4px 12px ${colors.primary}40`
              }}
            >
              {checking ? (
                <>
                  <RefreshCw size={20} style={{ animation: 'spin 1s linear infinite' }} />
                  Verificando actualizaciones...
                </>
              ) : (
                <>
                  <RefreshCw size={20} />
                  Verificar y Descargar Actualización
                </>
              )}
            </motion.button>
          )}
          
          {downloadingExecutable && (
            <div style={{ 
              marginTop: 12,
              padding: '12px', 
              background: colors.primary + '22', 
              borderRadius: 8,
              color: colors.primary,
              fontSize: 13,
              textAlign: 'center'
            }}>
              El ejecutable se descargará en tu carpeta de descargas. Ejecútalo para instalar la nueva versión.
            </div>
          )}
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
            Configuración - v{appVersion}
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
                           holdedSolucionsStatus === 'testing' ? colors.warning + '22' :
                           colors.textSecondary + '18',
            color: holdedSolucionsStatus === 'success' ? colors.success : 
                   holdedSolucionsStatus === 'error' ? colors.error : 
                   holdedSolucionsStatus === 'testing' ? colors.warning :
                   colors.textSecondary,
            border: `1px solid ${holdedSolucionsStatus === 'success' ? colors.success : 
                                holdedSolucionsStatus === 'error' ? colors.error : 
                                holdedSolucionsStatus === 'testing' ? colors.warning :
                                colors.textSecondary}33`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: holdedSolucionsStatus === 'success' ? colors.success : 
                             holdedSolucionsStatus === 'error' ? colors.error : 
                             holdedSolucionsStatus === 'testing' ? colors.warning :
                             colors.textSecondary
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
                           holdedMenjarStatus === 'testing' ? colors.warning + '22' :
                           colors.textSecondary + '18',
            color: holdedMenjarStatus === 'success' ? colors.success : 
                   holdedMenjarStatus === 'error' ? colors.error : 
                   holdedMenjarStatus === 'testing' ? colors.warning :
                   colors.textSecondary,
            border: `1px solid ${holdedMenjarStatus === 'success' ? colors.success : 
                                holdedMenjarStatus === 'error' ? colors.error : 
                                holdedMenjarStatus === 'testing' ? colors.warning :
                                colors.textSecondary}33`
          }}>
            <div style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              backgroundColor: holdedMenjarStatus === 'success' ? colors.success : 
                             holdedMenjarStatus === 'error' ? colors.error : 
                             holdedMenjarStatus === 'testing' ? colors.warning :
                             colors.textSecondary
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
        {renderHoldedUsageSection()}
        {renderPruebasTecnicas()}
        {renderUpdateSection()}
        {renderStorageSection()}
      </motion.div>
    </motion.div>
  );
};

export default SettingsPage;