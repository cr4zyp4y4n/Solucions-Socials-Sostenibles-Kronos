import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { supabase } from '../config/supabase';
import holdedApi from '../services/holdedApi';
import { motion } from 'framer-motion';
import { 
  ShoppingCart, 
  CheckCircle, 
  AlertCircle, 
  Clock, 
  Download,
  Database,
  Activity,
  DollarSign,
  Calendar
} from 'lucide-react';

const HoldedPurchases = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [purchases, setPurchases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [stats, setStats] = useState({
    pending: 0,
    overdue: 0,
    total: 0
  });

  useEffect(() => {
    loadPurchases();
  }, []);

  const loadPurchases = async () => {
    setLoading(true);
    setError('');

    try {
      const [pendingPurchases, overduePurchases] = await Promise.all([
        holdedApi.getPendingPurchases(1, 100),
        holdedApi.getOverduePurchases(1, 100)
      ]);

      // Combinar y eliminar duplicados
      const allPurchases = [...pendingPurchases, ...overduePurchases];
      const uniquePurchases = allPurchases.filter((purchase, index, self) => 
        index === self.findIndex(p => p.id === purchase.id)
      );

      setPurchases(uniquePurchases);
      
      // Calcular estadísticas
      const pending = pendingPurchases.length;
      const overdue = overduePurchases.length;
      const total = uniquePurchases.length;

      setStats({ pending, overdue, total });

    } catch (error) {
      console.error('Error cargando compras:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  const formatCurrency = (amount) => {
    if (!amount) return '€0.00';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const getStatusColor = (purchase) => {
    if (purchase.paid) return 'text-green-600';
    if (purchase.dueDate && new Date(purchase.dueDate) < new Date()) {
      return 'text-red-600';
    }
    return 'text-yellow-600';
  };

  const getStatusText = (purchase) => {
    if (purchase.paid) return 'Pagada';
    if (purchase.dueDate && new Date(purchase.dueDate) < new Date()) {
      return 'Vencida';
    }
    return 'Pendiente';
  };

  const getStatusIcon = (purchase) => {
    if (purchase.paid) return <CheckCircle size={16} />;
    if (purchase.dueDate && new Date(purchase.dueDate) < new Date()) {
      return <AlertCircle size={16} />;
    }
    return <Clock size={16} />;
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
            <ShoppingCart size={24} color={colors.primary} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Compras de Holded
            </h3>
            <p className="text-sm text-gray-600">
              Facturas de compra pendientes y vencidas
            </p>
          </div>
        </div>
        
        <button
          onClick={loadPurchases}
          disabled={loading}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all
            ${loading
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {loading ? (
            <Activity className="animate-spin" size={16} />
          ) : (
            <Download size={16} />
          )}
          <span>{loading ? 'Cargando...' : 'Actualizar'}</span>
        </button>
      </div>

      {/* Estadísticas */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <Clock size={20} color={colors.primary} />
            <div>
              <p className="text-sm text-gray-600">Pendientes</p>
              <p className="text-lg font-semibold text-gray-900">{stats.pending}</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-red-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <AlertCircle size={20} color={colors.error} />
            <div>
              <p className="text-sm text-gray-600">Vencidas</p>
              <p className="text-lg font-semibold text-gray-900">{stats.overdue}</p>
            </div>
          </div>
        </div>
        
        <div className="p-4 bg-green-50 rounded-lg">
          <div className="flex items-center space-x-2">
            <DollarSign size={20} color={colors.success} />
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-lg font-semibold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Mensaje de error */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg"
        >
          <div className="flex items-center space-x-2">
            <AlertCircle size={16} color={colors.error} />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        </motion.div>
      )}

      {/* Lista de compras */}
      <div className="space-y-3">
        {purchases.length === 0 && !loading ? (
          <div className="text-center py-8">
            <ShoppingCart size={48} className="mx-auto text-gray-400 mb-4" />
            <p className="text-gray-500">No se encontraron compras pendientes o vencidas</p>
          </div>
        ) : (
          purchases.map((purchase, index) => (
            <motion.div
              key={purchase.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    {getStatusIcon(purchase)}
                    <div>
                      <p className="font-medium text-gray-900">
                        {purchase.num || purchase.number || 'Sin número'}
                      </p>
                      <p className="text-sm text-gray-600">
                        {purchase.contact?.name || purchase.contactName || 'Sin proveedor'}
                      </p>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-gray-600">Fecha emisión</p>
                      <p className="font-medium">{formatDate(purchase.date)}</p>
                    </div>
                    <div>
                      <p className="text-gray-600">Fecha vencimiento</p>
                      <p className="font-medium">{formatDate(purchase.dueDate)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className={`text-lg font-semibold ${getStatusColor(purchase)}`}>
                    {formatCurrency(purchase.total)}
                  </p>
                  <p className={`text-sm font-medium ${getStatusColor(purchase)}`}>
                    {getStatusText(purchase)}
                  </p>
                </div>
              </div>
            </motion.div>
          ))
        )}
      </div>

      {/* Información adicional */}
      <div className="mt-6 pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <p className="mb-2">
            <strong>Nota:</strong> Se muestran las compras pendientes y vencidas de Holded.
          </p>
          <p>
            Las compras se actualizan automáticamente desde la API de Holded.
          </p>
        </div>
      </div>
    </motion.div>
  );
};

export default HoldedPurchases; 