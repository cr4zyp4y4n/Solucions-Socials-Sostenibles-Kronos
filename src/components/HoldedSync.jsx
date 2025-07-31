import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from '../config/supabase';
import holdedApi from '../services/holdedApi';
import { motion } from 'framer-motion';
import { 
  RefreshCw, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Download,
  Database,
  Activity
} from 'lucide-react';

const HoldedSync = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [syncStatus, setSyncStatus] = useState('idle'); // idle, loading, success, error
  const [lastSync, setLastSync] = useState(null);
  const [syncStats, setSyncStats] = useState({
    documentsCount: 0,
    insertedCount: 0
  });
  const [error, setError] = useState('');
  const [isConnected, setIsConnected] = useState(false);

  // Verificar conexión con Holded al cargar
  useEffect(() => {
    checkHoldedConnection();
    loadLastSyncInfo();
  }, []);

  const checkHoldedConnection = async () => {
    try {
      // Intentar obtener una lista básica de documentos para verificar conexión
      await holdedApi.testConnection();
      setIsConnected(true);
      setError(''); // Limpiar errores previos
    } catch (error) {
      console.error('Error conectando con Holded:', error);
      setIsConnected(false);
      
      // Mensaje de error más específico
      if (error.message.includes('API key')) {
        setError('API key de Holded inválida. Verifica tu API key en la configuración.');
      } else {
        setError('No se pudo conectar con la API de Holded. Verifica tu conexión a internet.');
      }
    }
  };

  const loadLastSyncInfo = async () => {
    try {
      const { data: lastSyncRecord, error } = await supabase
        .from('excel_uploads')
        .select('*')
        .eq('type', 'holded_api')
        .order('uploaded_at', { ascending: false })
        .limit(1)
        .single();

      if (!error && lastSyncRecord) {
        setLastSync(lastSyncRecord);
        setSyncStats({
          documentsCount: lastSyncRecord.metadata?.documents_count || 0,
          insertedCount: lastSyncRecord.metadata?.documents_count || 0
        });
      }
    } catch (error) {
      console.error('Error cargando información de última sincronización:', error);
    }
  };

  const handleSync = async () => {
    setSyncStatus('loading');
    setError('');

    try {
      // Sincronizar solo compras
      const result = await holdedApi.syncDocumentsWithDatabase(supabase);
      
      setSyncStats({
        documentsCount: result.documentsCount,
        insertedCount: result.insertedCount
      });
      
      setLastSync(result.syncRecord);
      setSyncStatus('success');
      
      // Limpiar mensaje de éxito después de 3 segundos
      setTimeout(() => {
        setSyncStatus('idle');
      }, 3000);

    } catch (error) {
      console.error('Error en sincronización:', error);
      setError(error.message);
      setSyncStatus('error');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusIcon = () => {
    switch (syncStatus) {
      case 'loading':
        return <RefreshCw size={20} className="animate-spin" color={colors.primary} />;
      case 'success':
        return <CheckCircle size={20} color={colors.success} />;
      case 'error':
        return <AlertCircle size={20} color={colors.error} />;
      default:
        return <Database size={20} color={colors.text} />;
    }
  };

  const getStatusText = () => {
    switch (syncStatus) {
      case 'loading':
        return 'Sincronizando compras...';
      case 'success':
        return 'Sincronización completada';
      case 'error':
        return 'Error en sincronización';
      default:
        return 'Listo para sincronizar';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 bg-white rounded-lg shadow-sm border border-gray-200"
      style={{ borderColor: colors.border }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div 
            className="p-2 rounded-lg"
            style={{ backgroundColor: colors.primary + '10' }}
          >
            <RefreshCw size={24} color={colors.primary} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Sincronización de Compras
            </h3>
            <p className="text-sm text-gray-600">
              Sincronizar compras pendientes y vencidas desde Holded
            </p>
          </div>
        </div>
        
        <button
          onClick={handleSync}
          disabled={syncStatus === 'loading' || !isConnected}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all
            ${syncStatus === 'loading' || !isConnected
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {getStatusIcon()}
          <span>{getStatusText()}</span>
        </button>
      </div>

      {/* Estado de conexión */}
      <div className="mb-6">
        <div className="flex items-center space-x-2">
          <div 
            className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
          />
          <span className="text-sm text-gray-600">
            {isConnected ? 'Conectado a Holded' : 'Desconectado de Holded'}
          </span>
        </div>
        {error && (
          <p className="text-sm text-red-600 mt-2">{error}</p>
        )}
      </div>

      {/* Estadísticas de sincronización */}
      {lastSync && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Download size={16} color={colors.text} />
              <span className="text-sm font-medium text-gray-900">Última sincronización</span>
            </div>
            <p className="text-sm text-gray-600">
              {formatDate(lastSync.uploaded_at)}
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <Activity size={16} color={colors.text} />
              <span className="text-sm font-medium text-gray-900">Compras encontradas</span>
            </div>
            <p className="text-sm text-gray-600">
              {syncStats.documentsCount} documentos
            </p>
          </div>
          
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle size={16} color={colors.success} />
              <span className="text-sm font-medium text-gray-900">Compras insertadas</span>
            </div>
            <p className="text-sm text-gray-600">
              {syncStats.insertedCount} documentos
            </p>
          </div>
        </div>
      )}

      {/* Información adicional */}
      <div className="bg-blue-50 p-4 rounded-lg">
        <div className="flex items-start space-x-3">
          <Clock size={16} color={colors.primary} className="mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              ¿Qué se sincroniza?
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Compras pendientes de pago</li>
              <li>• Compras con fecha de vencimiento pasada</li>
              <li>• Información de proveedores y montos</li>
              <li>• Estados de pago y fechas importantes</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HoldedSync; 