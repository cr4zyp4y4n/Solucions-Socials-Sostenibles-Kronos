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

  const runTests = async () => {
    setTesting(true);
    setTestResults({});

    const companies = ['solucions', 'menjar'];
    const results = {};

    // Probar cada empresa
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
          test: () => holdedApi.getPendingPurchases(1, 10, company),
          description: `Obtener compras no pagadas de ${companyName}`,
          icon: FileText,
          company
        },
        {
          name: `Compras vencidas - ${companyName}`,
          test: () => holdedApi.getOverduePurchases(1, 10, company),
          description: `Obtener compras vencidas de ${companyName}`,
          icon: Clock,
          company
        },
        {
          name: `Contactos - ${companyName}`,
          test: () => holdedApi.getContacts(1, 5, company),
          description: `Obtener lista de proveedores de ${companyName}`,
          icon: Users,
          company
        },
        {
          name: `Productos - ${companyName}`,
          test: () => holdedApi.getProducts(1, 5, company),
          description: `Obtener lista de productos de ${companyName}`,
          icon: Package,
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
      try {
        const startTime = Date.now();
        const data = await test.test();
        const endTime = Date.now();
        
        results[test.name] = {
          success: true,
          data: data,
          responseTime: endTime - startTime,
            count: Array.isArray(data) ? data.length : 'N/A',
            description: test.description,
            company: test.company
        };
      } catch (error) {
        let errorMessage = error.message;
        
        // Mensajes de error más específicos
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
        }
      }
    }

    setTestResults(results);
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

  const testList = [
    { name: 'Conexión básica - Solucions Socials', icon: Wifi },
    { name: 'Compras pendientes - Solucions Socials', icon: FileText },
    { name: 'Compras vencidas - Solucions Socials', icon: Clock },
    { name: 'Contactos - Solucions Socials', icon: Users },
    { name: 'Productos - Solucions Socials', icon: Package },
    { name: 'Métodos de pago - Solucions Socials', icon: Database },
    { name: 'Conexión básica - Menjar d\'Hort', icon: Wifi },
    { name: 'Compras pendientes - Menjar d\'Hort', icon: FileText },
    { name: 'Compras vencidas - Menjar d\'Hort', icon: Clock },
    { name: 'Contactos - Menjar d\'Hort', icon: Users },
    { name: 'Productos - Menjar d\'Hort', icon: Package },
    { name: 'Métodos de pago - Menjar d\'Hort', icon: Database }
  ];

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
      >
        <h3 style={{
          fontSize: '20px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 24px 0',
        }}>
          Resultados de Pruebas
        </h3>

        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '32px',
        }}>
          {/* Sección Solucions Socials */}
          <div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 20px 0',
              paddingBottom: '8px',
              borderBottom: `2px solid ${colors.primary}`,
            }}>
              Solucions Socials
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
            }}>
              {testList.slice(0, 6).map((test, index) => {
                const result = testResults[test.name];
                const Icon = test.icon;
                
                return (
          <motion.div
            key={test.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    style={{
                      backgroundColor: colors.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `1px solid ${colors.border}`,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: colors.primary + '15',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Icon size={20} color={colors.primary} />
                        </div>
              <div>
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: colors.text,
                            margin: '0 0 4px 0',
                          }}>
                            {test.name.replace(' - Solucions Socials', '')}
                          </h4>
                          <p style={{
                            fontSize: '14px',
                            color: colors.textSecondary,
                            margin: 0,
                          }}>
                            {result?.description || 'Prueba de conectividad'}
                </p>
              </div>
            </div>
            
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {getTestIcon(test.name)}
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: result?.success ? colors.success : result ? colors.error : colors.textSecondary,
                        }}>
                {getTestStatus(test.name)}
                        </span>
                      </div>
                    </div>

                    {result && (
                      <div style={{
                        padding: '16px',
                        backgroundColor: colors.card,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                      }}>
                        {result.success ? (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}>
                              <CheckCircle size={14} color={colors.success} />
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: colors.success,
                              }}>
                                Prueba exitosa
                              </span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: colors.textSecondary,
                            }}>
                              <div>Tiempo de respuesta: <strong>{result.responseTime}ms</strong></div>
                              {result.count !== 'N/A' && (
                                <div>Elementos obtenidos: <strong>{result.count}</strong></div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}>
                              <AlertCircle size={14} color={colors.error} />
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: colors.error,
                              }}>
                                Prueba fallida
                              </span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: colors.error,
                              backgroundColor: colors.error + '10',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: `1px solid ${colors.error}20`,
                            }}>
                              {result.error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
      </div>

          {/* Sección Menjar d'Hort */}
          <div>
            <h4 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 20px 0',
              paddingBottom: '8px',
              borderBottom: `2px solid ${colors.success}`,
            }}>
              Menjar d'Hort
            </h4>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
              gap: '20px',
            }}>
              {testList.slice(6, 12).map((test, index) => {
                const result = testResults[test.name];
                const Icon = test.icon;
                
                return (
                  <motion.div
                    key={test.name}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    style={{
                      backgroundColor: colors.surface,
                      padding: '24px',
                      borderRadius: '16px',
                      border: `1px solid ${colors.border}`,
                      boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                    }}
                  >
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '16px'
                    }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px'
                      }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '10px',
                          backgroundColor: colors.success + '15',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}>
                          <Icon size={20} color={colors.success} />
                        </div>
                        <div>
                          <h4 style={{
                            fontSize: '16px',
                            fontWeight: '600',
                            color: colors.text,
                            margin: '0 0 4px 0',
                          }}>
                            {test.name.replace(' - Menjar d\'Hort', '')}
                          </h4>
                          <p style={{
                            fontSize: '14px',
                            color: colors.textSecondary,
                            margin: 0,
                          }}>
                            {result?.description || 'Prueba de conectividad'}
                          </p>
                        </div>
                      </div>
                      
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                      }}>
                        {getTestIcon(test.name)}
                        <span style={{
                          fontSize: '12px',
                          fontWeight: '500',
                          color: result?.success ? colors.success : result ? colors.error : colors.textSecondary,
                        }}>
                          {getTestStatus(test.name)}
                        </span>
                      </div>
                    </div>

                    {result && (
                      <div style={{
                        padding: '16px',
                        backgroundColor: colors.card,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`,
                      }}>
                        {result.success ? (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}>
                              <CheckCircle size={14} color={colors.success} />
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: colors.success,
                              }}>
                                Prueba exitosa
                              </span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: colors.textSecondary,
                            }}>
                              <div>Tiempo de respuesta: <strong>{result.responseTime}ms</strong></div>
                              {result.count !== 'N/A' && (
                                <div>Elementos obtenidos: <strong>{result.count}</strong></div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              marginBottom: '8px'
                            }}>
                              <AlertCircle size={14} color={colors.error} />
                              <span style={{
                                fontSize: '14px',
                                fontWeight: '500',
                                color: colors.error,
                              }}>
                                Prueba fallida
                              </span>
                            </div>
                            <div style={{
                              fontSize: '13px',
                              color: colors.error,
                              backgroundColor: colors.error + '10',
                              padding: '8px 12px',
                              borderRadius: '6px',
                              border: `1px solid ${colors.error}20`,
                            }}>
                              {result.error}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </div>
      </motion.div>
      </div>
  );
};

export default HoldedTest; 