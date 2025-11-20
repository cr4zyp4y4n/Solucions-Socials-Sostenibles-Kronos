import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import holdedApi from '../services/holdedApi';
import { FileText, RefreshCw, Loader2, ChevronDown, ChevronUp } from 'lucide-react';

const SalesInvoicesPage = () => {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Cargando datos...');
  const [error, setError] = useState('');
  
  // Estados para datos procesados
  const [processedData, setProcessedData] = useState({
    solucions: { headers: [], data: [] },
    menjar: { headers: [], data: [] }
  });
  
  const [selectedDataset, setSelectedDataset] = useState('solucions');
  const [selectedClient, setSelectedClient] = useState('');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isChangingDataset, setIsChangingDataset] = useState(false);
  const [expandedDescriptions, setExpandedDescriptions] = useState(new Set());

  // Función para procesar facturas de venta de Holded
  const processHoldedSales = (holdedSales) => {
    if (holdedSales.length === 0) {
      return { headers: [], data: [] };
    }

    // Definir las columnas esperadas en el orden correcto
    const expectedHeaders = [
      "Data d'emissió",
      'Núm',
      'Núm. Intern',
      'Data comptable',
      'Venciment',
      'Client',
      'Descripció',
      'Tags',
      'Compte',
      'Projecte',
      'Subtotal',
      'IVA',
      'Retención',
      'Total',
      'Pagat',
      'Pendents',
      'Estat',
      'Data de pagament'
    ];

    // Mapeo de campos de Holded a las columnas
    const holdedToExcelMapping = {
      'issue_date': "Data d'emissió",
      'invoice_number': 'Núm',
      'internal_number': 'Núm. Intern',
      'accounting_date': 'Data comptable',
      'due_date': 'Venciment',
      'client': 'Client',
      'description': 'Descripció',
      'tags': 'Tags',
      'account': 'Compte',
      'project': 'Projecte',
      'subtotal': 'Subtotal',
      'vat': 'IVA',
      'retention': 'Retención',
      'total': 'Total',
      'paid': 'Pagat',
      'pending': 'Pendents',
      'status': 'Estat',
      'payment_date': 'Data de pagament'
    };

    // Convertir datos de Holded a formato de array
    const processedData = holdedSales.map(sale => {
      const row = [];
      expectedHeaders.forEach(header => {
        const holdedField = Object.keys(holdedToExcelMapping).find(key => holdedToExcelMapping[key] === header);
        if (holdedField && sale[holdedField] !== undefined && sale[holdedField] !== null) {
          row.push(sale[holdedField]);
        } else {
          row.push(null);
        }
      });
      return row;
    });

    return { headers: expectedHeaders, data: processedData };
  };

  // Cargar datos de facturas de venta desde Holded
  const loadSalesData = async () => {
    setLoading(true);
    setError('');
    setLoadingMessage('Descargando facturas de venta de Holded...');

    try {
      console.log('📊 Iniciando carga de facturas de venta...');
      
      // Cargar datos para ambas empresas en paralelo
      const [solucionsSales, menjarSales] = await Promise.all([
        holdedApi.getAllPendingAndPartiallyPaidSales('solucions').catch(error => {
          console.error('Error cargando facturas de venta de Solucions:', error);
          return [];
        }),
        holdedApi.getAllPendingAndPartiallyPaidSales('menjar').catch(error => {
          console.error('Error cargando facturas de venta de Menjar:', error);
          return [];
        })
      ]);

      console.log('✅ Facturas de venta cargadas:');
      console.log('Solucions:', solucionsSales.length);
      console.log('Menjar:', menjarSales.length);

      // Procesar datos
      const processedSolucions = processHoldedSales(solucionsSales);
      const processedMenjar = processHoldedSales(menjarSales);

      setProcessedData({
        solucions: processedSolucions,
        menjar: processedMenjar
      });

      setLoadingMessage('Datos cargados correctamente');
      
    } catch (error) {
      console.error('Error cargando facturas de venta:', error);
      setError(`Error al cargar facturas de venta: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Cargar datos al montar el componente
  useEffect(() => {
    loadSalesData();
  }, []);

  // Índices de columnas
  const columnIndices = useMemo(() => {
    const headers = processedData[selectedDataset]?.headers || [];
    return {
      date: headers.indexOf("Data d'emissió"),
      invoiceNumber: headers.indexOf('Núm'),
      internalNumber: headers.indexOf('Núm. Intern'),
      accountingDate: headers.indexOf('Data comptable'),
      dueDate: headers.indexOf('Venciment'),
      client: headers.indexOf('Client'),
      description: headers.indexOf('Descripció'),
      tags: headers.indexOf('Tags'),
      account: headers.indexOf('Compte'),
      project: headers.indexOf('Projecte'),
      subtotal: headers.indexOf('Subtotal'),
      vat: headers.indexOf('IVA'),
      retention: headers.indexOf('Retención'),
      total: headers.indexOf('Total'),
      paid: headers.indexOf('Pagat'),
      pending: headers.indexOf('Pendents'),
      status: headers.indexOf('Estat'),
      paymentDate: headers.indexOf('Data de pagament')
    };
  }, [processedData, selectedDataset]);

  // Función para truncar descripción
  const truncateDescription = (text, maxLength = 120) => {
    if (!text || typeof text !== 'string') return '-';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  // Función para manejar clic en descripción
  const handleDescriptionClick = (rowIndex) => {
    setExpandedDescriptions(prev => {
      const newSet = new Set(prev);
      if (newSet.has(rowIndex)) {
        newSet.delete(rowIndex);
      } else {
        newSet.add(rowIndex);
      }
      return newSet;
    });
  };

  // Obtener clientes únicos
  const uniqueClients = useMemo(() => {
    const data = processedData[selectedDataset]?.data || [];
    const clients = new Set();
    data.forEach(row => {
      if (row[columnIndices.client]) {
        clients.add(row[columnIndices.client]);
      }
    });
    return Array.from(clients).sort();
  }, [processedData, selectedDataset, columnIndices.client]);

  // Columnas disponibles para selección
  const availableColumns = [
    { key: 'date', label: 'Fecha Factura', index: columnIndices.date },
    { key: 'invoiceNumber', label: 'Número Factura', index: columnIndices.invoiceNumber },
    { key: 'client', label: 'Cliente', index: columnIndices.client },
    { key: 'account', label: 'Cuenta', index: columnIndices.account },
    { key: 'description', label: 'Descripción', index: columnIndices.description },
    { key: 'subtotal', label: 'Subtotal', index: columnIndices.subtotal },
    { key: 'total', label: 'Total', index: columnIndices.total },
    { key: 'pending', label: 'Pendiente', index: columnIndices.pending }
  ].filter(col => col.index !== undefined && col.index !== -1);

  // Inicializar columnas seleccionadas
  useEffect(() => {
    if (selectedColumns.length === 0 && availableColumns.length > 0) {
      setSelectedColumns(availableColumns.map(col => col.key));
    }
  }, [availableColumns.length]);

  // Datos filtrados
  const filteredData = useMemo(() => {
    let data = processedData[selectedDataset]?.data || [];
    
    // Filtrar por cliente
    if (selectedClient) {
      data = data.filter(row => row[columnIndices.client] === selectedClient);
    }
    
    // Ordenar
    if (sortConfig.key) {
      const col = availableColumns.find(c => c.key === sortConfig.key);
      if (col && col.index !== undefined) {
        data = [...data].sort((a, b) => {
          const aVal = a[col.index];
          const bVal = b[col.index];
          
          if (aVal === null || aVal === undefined) return 1;
          if (bVal === null || bVal === undefined) return -1;
          
          // Si son números
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
          }
          
          // Si son strings
          const aStr = String(aVal).toLowerCase();
          const bStr = String(bVal).toLowerCase();
          return sortConfig.direction === 'asc' 
            ? aStr.localeCompare(bStr)
            : bStr.localeCompare(aStr);
        });
      }
    }
    
    return data;
  }, [processedData, selectedDataset, selectedClient, sortConfig, columnIndices, availableColumns]);

  // Función para formatear fechas
  function formatDate(dateValue) {
    if (!dateValue) return '-';
    
    if (typeof dateValue === 'string') {
      if (dateValue.includes('T') && dateValue.includes('Z')) {
        const date = new Date(dateValue);
        return date.toLocaleDateString('es-ES');
      }
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateValue)) {
        const [year, month, day] = dateValue.split('-');
        return `${day}/${month}/${year}`;
      }
      return dateValue;
    }
    
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('es-ES');
    }
    
    return dateValue;
  }

  // Función para cambiar de empresa
  const handleDatasetChange = (newDataset) => {
    if (newDataset !== selectedDataset) {
      setIsChangingDataset(true);
      setTimeout(() => {
        setSelectedDataset(newDataset);
        setSelectedClient('');
        setExpandedDescriptions(new Set()); // Limpiar descripciones expandidas al cambiar de dataset
        setIsChangingDataset(false);
      }, 150);
    }
  };

  // Función para ordenar
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Componente de header ordenable
  const SortableHeader = ({ label, sortKey, currentSortKey, currentDirection, onSort }) => {
    const isActive = currentSortKey === sortKey;
    return (
      <th
        onClick={() => onSort(sortKey)}
        style={{
          borderBottom: `1px solid ${colors.border}`,
          padding: '12px 8px',
          textAlign: 'left',
          color: colors.primary,
          fontWeight: 600,
          background: colors.surface,
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {label}
          {isActive && (
            currentDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
          )}
        </div>
      </th>
    );
  };

  // Función para color de fila
  const getRowBackgroundColor = (index) => {
    return index % 2 === 0 ? colors.card : colors.surface;
  };

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1600px',
      margin: '0 auto',
      color: colors.text
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        marginBottom: '32px',
      }}>
        <div style={{
          width: 44,
          height: 44,
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <FileText size={24} color={colors.primary} />
        </div>
        <div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: colors.text,
            margin: '0',
            lineHeight: '1.2',
          }}>
            Facturas de Venta
          </h1>
          <p style={{
            fontSize: '14px',
            color: colors.textSecondary,
            margin: '4px 0 0 0',
          }}>
            Facturas de venta pendientes de pago desde Holded
          </p>
        </div>
      </div>

      {/* Botón de recarga */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={loadSalesData}
          disabled={loading}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            backgroundColor: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '600',
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} />
              {loadingMessage}
            </>
          ) : (
            <>
              <RefreshCw size={16} />
              Recargar datos
            </>
          )}
        </motion.button>
      </div>

      {/* Tarjetas de selección de empresa */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          marginBottom: '32px'
        }}
      >
        <h3 style={{
          margin: '0 0 16px 0',
          color: colors.text,
          fontSize: '20px',
          fontWeight: '600'
        }}>
          Seleccionar Vista
        </h3>
        <div style={{
          display: 'flex',
          gap: '18px',
          flexWrap: 'wrap',
        }}>
          <motion.div
            whileHover={{ scale: 1.04, boxShadow: selectedDataset === 'solucions' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleDatasetChange('solucions')}
            style={{
              minWidth: 200,
              flex: '1 1 200px',
              background: colors.card,
              borderRadius: 12,
              boxShadow: selectedDataset === 'solucions' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
              border: selectedDataset === 'solucions' ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
              color: selectedDataset === 'solucions' ? colors.primary : colors.text,
              cursor: isChangingDataset ? 'not-allowed' : 'pointer',
              padding: '22px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              transition: 'all 0.18s',
              fontWeight: selectedDataset === 'solucions' ? 600 : 400,
              fontSize: 16,
              outline: selectedDataset === 'solucions' ? `2px solid ${colors.primary}` : 'none',
              position: 'relative',
              opacity: isChangingDataset ? 0.6 : 1
            }}
          >
            <AnimatePresence>
              {isChangingDataset && selectedDataset === 'solucions' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '18px',
                    transform: 'translateY(-50%)',
                    zIndex: 10
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: `2px solid ${colors.border}`,
                      borderTop: `2px solid ${colors.primary}`,
                      borderRadius: '50%'
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
              Solucions Socials
            </span>
            <span style={{ 
              fontSize: 13, 
              color: selectedDataset === 'solucions' ? colors.primary : colors.textSecondary, 
              marginTop: 2 
            }}>
              {processedData.solucions.data.length > 0 ? `${processedData.solucions.data.length} facturas de venta` : 'No hay facturas cargadas'}
            </span>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.04, boxShadow: selectedDataset === 'menjar' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleDatasetChange('menjar')}
            style={{
              minWidth: 200,
              flex: '1 1 200px',
              background: colors.card,
              borderRadius: 12,
              boxShadow: selectedDataset === 'menjar' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
              border: selectedDataset === 'menjar' ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
              color: selectedDataset === 'menjar' ? colors.primary : colors.text,
              cursor: (isChangingDataset || loading) ? 'not-allowed' : 'pointer',
              padding: '22px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              transition: 'all 0.18s',
              fontWeight: selectedDataset === 'menjar' ? 600 : 400,
              fontSize: 16,
              outline: selectedDataset === 'menjar' ? `2px solid ${colors.primary}` : 'none',
              position: 'relative',
              opacity: (isChangingDataset || loading) ? 0.6 : 1
            }}
          >
            <AnimatePresence>
              {isChangingDataset && selectedDataset === 'menjar' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  style={{
                    position: 'absolute',
                    top: '50%',
                    right: '18px',
                    transform: 'translateY(-50%)',
                    zIndex: 10
                  }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                    style={{
                      width: '16px',
                      height: '16px',
                      border: `2px solid ${colors.border}`,
                      borderTop: `2px solid ${colors.primary}`,
                      borderRadius: '50%'
                    }}
                  />
                </motion.div>
              )}
            </AnimatePresence>
            
            <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
              Menjar D'Hort
            </span>
            <span style={{ 
              fontSize: 13, 
              color: selectedDataset === 'menjar' ? colors.primary : colors.textSecondary, 
              marginTop: 2 
            }}>
              {processedData.menjar.data.length > 0 ? `${processedData.menjar.data.length} facturas de venta` : 'No hay facturas cargadas'}
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Mensaje de error */}
      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: colors.error + '15',
          border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          color: colors.error,
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* Filtros y Columnas */}
      <div style={{
        background: colors.card,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        padding: '20px',
        marginBottom: '24px'
      }}>
        <h3 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: 16, fontWeight: 600 }}>
          Filtros y Columnas
        </h3>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: colors.textSecondary }}>
              Filtrar por cliente:
            </label>
            <select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
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
              <option value="">Todos los clientes</option>
              {uniqueClients.map(client => (
                <option key={client} value={client} style={{ color: colors.text }}>{client}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: colors.textSecondary }}>
              Columnas visibles:
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {availableColumns.map(col => (
                <label key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '14px', color: colors.text }}>
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col.key)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedColumns([...selectedColumns, col.key]);
                      } else {
                        setSelectedColumns(selectedColumns.filter(c => c !== col.key));
                      }
                    }}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tabla de facturas */}
      <div style={{
        background: colors.card,
        borderRadius: '8px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
        padding: '20px'
      }}>
        <h3 style={{ margin: '0 0 20px 0', color: colors.text, fontSize: 18, fontWeight: 600 }}>
          {selectedClient ? `Facturas de ${selectedClient}` : 'Todas las facturas'} 
          <span style={{ fontSize: '14px', fontWeight: '400', color: colors.textSecondary, marginLeft: '8px' }}>
            ({filteredData.length} facturas)
          </span>
        </h3>
        
        <div style={{
          overflowX: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.border} transparent`
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr>
                {availableColumns
                  .filter(col => selectedColumns.includes(col.key))
                  .map(col => (
                    <SortableHeader
                      key={col.key}
                      label={col.label}
                      sortKey={col.key}
                      currentSortKey={sortConfig.key}
                      currentDirection={sortConfig.direction}
                      onSort={handleSort}
                    />
                  ))}
              </tr>
            </thead>
            <tbody>
              {filteredData.length === 0 ? (
                <tr>
                  <td
                    colSpan={availableColumns.filter(col => selectedColumns.includes(col.key)).length}
                    style={{
                      padding: '40px',
                      textAlign: 'center',
                      color: colors.textSecondary,
                      fontSize: '14px'
                    }}
                  >
                    {loading ? 'Cargando datos...' : 'No hay facturas de venta pendientes'}
                  </td>
                </tr>
              ) : (
                filteredData.map((row, i) => (
                  <tr key={i} style={{
                    background: getRowBackgroundColor(i),
                    transition: 'background-color 0.2s ease'
                  }}>
                    {availableColumns
                      .filter(col => selectedColumns.includes(col.key))
                      .map(col => {
                        const cellValue = col.index !== undefined ? row[col.index] : null;
                        const isDescription = col.key === 'description';
                        const isExpanded = expandedDescriptions.has(i);
                        const shouldTruncate = isDescription && cellValue && typeof cellValue === 'string' && cellValue.length > 120;
                        
                        return (
                          <td key={col.key} style={{
                            borderBottom: `1px solid ${colors.border}`,
                            padding: '12px 8px',
                            color: colors.text,
                            maxWidth: isDescription ? '400px' : 'auto',
                            wordWrap: isDescription ? 'break-word' : 'normal',
                            cursor: shouldTruncate ? 'pointer' : 'default'
                          }}
                          onClick={shouldTruncate ? () => handleDescriptionClick(i) : undefined}
                          title={shouldTruncate && !isExpanded ? cellValue : undefined}
                        >
                          {col.key === 'date'
                            ? (cellValue ? formatDate(cellValue) : '-')
                            : col.key === 'total' || col.key === 'pending' || col.key === 'subtotal'
                              ? (cellValue ? formatCurrency(cellValue) : '-')
                              : isDescription && shouldTruncate
                                ? (isExpanded ? cellValue : truncateDescription(cellValue, 120))
                                : (cellValue || '-')}
                        </td>
                      );
                      })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Resumen */}
        {filteredData.length > 0 && (
          <div style={{
            marginTop: '20px',
            padding: '16px',
            backgroundColor: colors.surface,
            borderRadius: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}>
            <div>
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Total Facturas
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {filteredData.length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Total Pendiente
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: colors.primary }}>
                {formatCurrency(
                  filteredData.reduce((sum, row) => {
                    const pending = row[columnIndices.pending];
                    return sum + (parseFloat(pending) || 0);
                  }, 0)
                )}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px' }}>
                Total Facturado
              </div>
              <div style={{ fontSize: '18px', fontWeight: '600', color: colors.text }}>
                {formatCurrency(
                  filteredData.reduce((sum, row) => {
                    const total = row[columnIndices.total];
                    return sum + (parseFloat(total) || 0);
                  }, 0)
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SalesInvoicesPage;
