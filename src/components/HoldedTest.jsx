import React from 'react';
import { useTheme } from './ThemeContext';
import { useDataContext } from './DataContext';
import holdedApi from '../services/holdedApi';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Tool, 
  CheckCircle, 
  AlertCircle, 
  Loader,
  FileText,
  Users,
  Package,
  Zap,
  Database,
  Wifi,
  Clock,
  TrendingUp
} from 'feather-icons-react';

const HoldedTest = () => {
  const { colors } = useTheme();
  const { testResults, setTestResults, testing, setTesting } = useDataContext();
  const [currentTestIndex, setCurrentTestIndex] = React.useState(-1);

  const runTests = async () => {
    setTesting(true);
    setTestResults({});
    setCurrentTestIndex(0);

    const companies = ['solucions', 'menjar'];
    const results = {};
    let testIndex = 0;

    for (const company of companies) {
      const companyName = company === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort';
      const tests = [
        {
          name: `Conexión básica - ${companyName}`,
          test: () => holdedApi.testConnection(company),
          description: `Verificar que la API responde para ${companyName}`,
          icon: Wifi,
          company
        },
        {
          name: `Compras pendientes - ${companyName}`,
          test: () => holdedApi.getAllPendingPurchasesPages(company),
          description: `Obtener TODAS las compras no pagadas de ${companyName}`,
          icon: FileText,
          company
        },
        {
          name: `Compras vencidas - ${companyName}`,
          test: () => holdedApi.getAllOverduePurchasesPages(company),
          description: `Obtener TODAS las compras vencidas de ${companyName}`,
          icon: Clock,
          company
        },
        {
          name: `Todas las compras pendientes y vencidas - ${companyName}`,
          test: () => holdedApi.getAllPendingAndOverduePurchases(company),
          description: `Obtener TODAS las compras pendientes y vencidas de ${companyName} (como en Analytics)`,
          icon: TrendingUp,
          company
        },
        {
          name: `Contactos - ${companyName}`,
          test: () => holdedApi.getAllContacts(company),
          description: `Obtener TODOS los contactos de ${companyName}`,
          icon: Users,
          company
        },
        {
          name: `Productos - ${companyName}`,
          test: () => holdedApi.getProducts(1, 100, company),
          description: `Obtener productos de ${companyName} (primeros 100)`,
          icon: Package,
          company
        },
        {
          name: `Diagnóstico completo - ${companyName}`,
          test: () => holdedApi.getAllPurchasesForDiagnosis(company),
          description: `Análisis completo de todas las compras de ${companyName} (para diagnóstico)`,
          icon: Database,
          company
        },
        {
          name: `Métodos de pago - ${companyName}`,
          test: () => holdedApi.getPaymentMethods(company),
          description: `Obtener métodos de pago de ${companyName}`,
          icon: Database,
          company
        }
      ];
      for (const test of tests) {
        setCurrentTestIndex(testIndex);
        try {
          const startTime = Date.now();
          const data = await test.test();
          const endTime = Date.now();
          let additionalInfo = '';
          if (test.name.includes('Todas las compras') || test.name.includes('TODAS') || test.name.includes('TODOS')) {
            additionalInfo = ' (Todas las páginas)';
          } else if (test.name.includes('Diagnóstico completo')) {
            additionalInfo = ' (Análisis completo)';
          }
          results[test.name] = {
            success: true,
            data: data,
            responseTime: endTime - startTime,
            count: Array.isArray(data) ? data.length : 'N/A',
            description: test.description + additionalInfo,
            company: test.company
          };
          setTestResults(prev => ({ ...prev, [test.name]: results[test.name] }));
        } catch (error) {
          let errorMessage = error.message;
          if (error.message.includes('Unexpected token') || error.message.includes('<div')) {
            errorMessage = `API key inválida o no autorizada para ${companyName}`;
          } else if (error.message.includes('Failed to fetch')) {
            errorMessage = `Error de conexión para ${companyName}`;
          }
          results[test.name] = {
            success: false,
            error: errorMessage,
            description: test.description,
            company: test.company
          };
          setTestResults(prev => ({ ...prev, [test.name]: results[test.name] }));
        }
        testIndex++;
      }
    }
    setCurrentTestIndex(-1);
    setTesting(false);
  };

  const getTestIcon = (testName) => {
    const result = testResults[testName];
    if (!result) return <Tool size={16} />;
    
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

  // Lista de tests en orden
  const testList = [
    { name: 'Conexión básica - Solucions Socials', icon: Wifi },
    { name: 'Compras pendientes - Solucions Socials', icon: FileText },
    { name: 'Compras vencidas - Solucions Socials', icon: Clock },
    { name: 'Todas las compras pendientes y vencidas - Solucions Socials', icon: TrendingUp },
    { name: 'Contactos - Solucions Socials', icon: Users },
    { name: 'Productos - Solucions Socials', icon: Package },
    { name: 'Diagnóstico completo - Solucions Socials', icon: Database },
    { name: 'Métodos de pago - Solucions Socials', icon: Database },
    { name: 'Conexión básica - Menjar d\'Hort', icon: Wifi },
    { name: 'Compras pendientes - Menjar d\'Hort', icon: FileText },
    { name: 'Compras vencidas - Menjar d\'Hort', icon: Clock },
    { name: 'Todas las compras pendientes y vencidas - Menjar d\'Hort', icon: TrendingUp },
    { name: 'Contactos - Menjar d\'Hort', icon: Users },
    { name: 'Productos - Menjar d\'Hort', icon: Package },
    { name: 'Diagnóstico completo - Menjar d\'Hort', icon: Database },
    { name: 'Métodos de pago - Menjar d\'Hort', icon: Database }
  ];

  // Renderizado de cada test con animación y feedback visual
  return (
    <div style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '32px' }}
      >
        <h2 style={{
          fontSize: '28px',
          fontWeight: '700',
          color: colors.text,
          margin: '0 0 8px 0',
        }}>
              Pruebas de API Holded
        </h2>
        <p style={{
          fontSize: '16px',
          color: colors.textSecondary,
          margin: 0,
        }}>
              Verificar conectividad y funcionalidad de la API
            </p>
      </motion.div>

      {/* Botones de acción */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{ marginBottom: '32px' }}
      >
        <div style={{
          display: 'flex',
          justifyContent: 'flex-start',
        }}>
          {/* Botón principal */}
          <motion.button
            whileHover={{ y: -2, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          onClick={runTests}
          disabled={testing}
            style={{
              padding: '16px 24px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              cursor: testing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '12px',
              fontSize: '16px',
              fontWeight: '600',
              transition: 'all 0.2s ease',
              backgroundColor: testing ? colors.border : colors.surface,
              color: testing ? colors.textSecondary : colors.text,
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
        >
          {testing ? (
              <Loader size={20} className="animate-spin" />
          ) : (
              <Tool size={20} />
          )}
            <span>{testing ? 'Ejecutando pruebas...' : 'Ejecutar Pruebas Básicas'}</span>
          </motion.button>
      </div>
      </motion.div>

      {/* Resultados de pruebas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        <AnimatePresence>
          {testList.map((test, idx) => {
            const result = testResults[test.name];
            let bgColor = colors.card;
            let borderColor = colors.border;
            let icon = <Tool size={20} color={colors.textSecondary} />;
            let statusText = 'Pendiente';
            let statusColor = colors.textSecondary;
            let showSpinner = false;
            if (result) {
              if (result.success) {
                bgColor = colors.success + '18';
                borderColor = colors.success;
                icon = <CheckCircle size={20} color={colors.success} />;
                statusText = `Exitoso (${result.responseTime}ms)`;
                statusColor = colors.success;
              } else {
                bgColor = colors.error + '18';
                borderColor = colors.error;
                icon = <AlertCircle size={20} color={colors.error} />;
                statusText = 'Falló';
                statusColor = colors.error;
              }
            } else if (testing && idx === currentTestIndex) {
              bgColor = colors.warning + '18';
              borderColor = colors.warning;
              icon = <Loader size={20} color={colors.warning} style={{ animation: 'spin 1s linear infinite' }} />;
              statusText = 'En curso...';
              statusColor = colors.warning;
              showSpinner = true;
            } else if (testing && idx > currentTestIndex) {
              bgColor = colors.card;
              borderColor = colors.border;
              icon = <Clock size={20} color={colors.textSecondary} />;
              statusText = 'Pendiente';
              statusColor = colors.textSecondary;
            }
            return (
              <motion.div
                key={test.name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: idx * 0.04 }}
                style={{
                  background: bgColor,
                  border: `1.5px solid ${borderColor}`,
                  borderRadius: 12,
                  padding: '18px 20px',
                  marginBottom: 0,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 18,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                  minHeight: 60,
                  position: 'relative',
                  opacity: result || (testing && idx <= currentTestIndex) ? 1 : 0.7
                }}
              >
                <div style={{ minWidth: 32, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 15, color: colors.text }}>{test.name.replace(' - Solucions Socials', '').replace(' - Menjar d\'Hort', '')}</div>
                  <div style={{ fontSize: 13, color: colors.textSecondary, marginTop: 2 }}>{result?.description || 'Prueba de conectividad'}</div>
                </div>
                <div style={{ minWidth: 120, textAlign: 'right', fontWeight: 500, color: statusColor, fontSize: 14 }}>
                  {statusText}
                  {showSpinner && (
                    <span style={{ marginLeft: 8, display: 'inline-block', verticalAlign: 'middle' }}>
                      <Loader size={16} color={colors.warning} style={{ animation: 'spin 1s linear infinite' }} />
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default HoldedTest; 