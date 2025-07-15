import React, { useState } from 'react';
import { useTheme } from './ThemeContext';
import holdedApi from '../services/holdedApi';
import { motion } from 'framer-motion';
import { 
  TestTube, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  FileText,
  Users,
  Package
} from 'lucide-react';

const HoldedTest = () => {
  const { colors } = useTheme();
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState(false);

  const runTests = async () => {
    setTesting(true);
    setTestResults({});

    const tests = [
      {
        name: 'Conexión básica',
        test: () => holdedApi.testConnection(),
        description: 'Verificar que la API responde'
      },
      {
        name: 'Compras pendientes',
        test: () => holdedApi.getPendingPurchases(1, 5),
        description: 'Obtener compras no pagadas'
      },
      {
        name: 'Compras vencidas',
        test: () => holdedApi.getOverduePurchases(1, 5),
        description: 'Obtener compras con vencimiento pasado'
      },
      {
        name: 'Contactos',
        test: () => holdedApi.getContacts(1, 5),
        description: 'Obtener lista de proveedores'
      },
      {
        name: 'Productos',
        test: () => holdedApi.getProducts(1, 5),
        description: 'Obtener lista de productos'
      },
      {
        name: 'Métodos de pago',
        test: () => holdedApi.getPaymentMethods(),
        description: 'Obtener métodos de pago disponibles'
      }
    ];

    const results = {};

    for (const test of tests) {
      try {
        const startTime = Date.now();
        const data = await test.test();
        const endTime = Date.now();
        
        results[test.name] = {
          success: true,
          data: data,
          responseTime: endTime - startTime,
          count: Array.isArray(data) ? data.length : 'N/A'
        };
      } catch (error) {
        let errorMessage = error.message;
        
        // Mensajes de error más específicos
        if (error.message.includes('Unexpected token') || error.message.includes('<div')) {
          errorMessage = 'API key inválida o no autorizada';
        } else if (error.message.includes('Failed to fetch')) {
          errorMessage = 'Error de conexión';
        }
        
        results[test.name] = {
          success: false,
          error: errorMessage,
          description: test.description
        };
      }
    }

    setTestResults(results);
    setTesting(false);
  };

  const getTestIcon = (testName) => {
    const result = testResults[testName];
    if (!result) return <TestTube size={16} />;
    
    if (result.success) {
      return <CheckCircle size={16} color={colors.success} />;
    } else {
      return <AlertCircle size={16} color={colors.error} />;
    }
  };

  const getTestStatus = (testName) => {
    const result = testResults[testName];
    if (!result) return 'Pendiente';
    
    if (result.success) {
      return `Exitoso (${result.responseTime}ms)`;
    } else {
      return 'Falló';
    }
  };

  const testList = [
    { name: 'Conexión básica', icon: TestTube },
    { name: 'Compras pendientes', icon: FileText },
    { name: 'Compras vencidas', icon: FileText },
    { name: 'Contactos', icon: Users },
    { name: 'Productos', icon: Package },
    { name: 'Métodos de pago', icon: FileText }
  ];

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
            <TestTube size={24} color={colors.primary} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Pruebas de API Holded
            </h3>
            <p className="text-sm text-gray-600">
              Verificar conectividad y funcionalidad de la API
            </p>
          </div>
        </div>
        
        <button
          onClick={runTests}
          disabled={testing}
          className={`
            flex items-center space-x-2 px-4 py-2 rounded-lg font-medium transition-all
            ${testing
              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800'
            }
          `}
        >
          {testing ? (
            <Loader className="animate-spin" size={16} />
          ) : (
            <TestTube size={16} />
          )}
          <span>{testing ? 'Probando...' : 'Ejecutar Pruebas'}</span>
        </button>
      </div>

      {/* Lista de pruebas */}
      <div className="space-y-3">
        {testList.map((test, index) => (
          <motion.div
            key={test.name}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
            <div className="flex items-center space-x-3">
              {getTestIcon(test.name)}
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {test.name}
                </p>
                <p className="text-xs text-gray-600">
                  {testResults[test.name]?.description || 'Verificando...'}
                </p>
              </div>
            </div>
            
            <div className="text-right">
              <p className="text-sm font-medium text-gray-900">
                {getTestStatus(test.name)}
              </p>
              {testResults[test.name]?.success && testResults[test.name]?.count !== 'N/A' && (
                <p className="text-xs text-gray-600">
                  {testResults[test.name].count} resultados
                </p>
              )}
            </div>
          </motion.div>
        ))}
      </div>

      {/* Información adicional */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <div className="flex items-start space-x-3">
          <TestTube size={16} color={colors.primary} className="mt-0.5" />
          <div>
            <h4 className="text-sm font-medium text-gray-900 mb-1">
              ¿Qué se prueba?
            </h4>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Conexión básica con la API de Holded</li>
              <li>• Obtención de compras pendientes y vencidas</li>
              <li>• Acceso a contactos (proveedores)</li>
              <li>• Información de productos y métodos de pago</li>
            </ul>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default HoldedTest; 