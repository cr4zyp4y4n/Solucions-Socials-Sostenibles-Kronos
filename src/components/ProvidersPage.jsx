import React, { useState, useMemo } from 'react';
import { useDataContext } from './DataContext';
import { useTheme } from './ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from './CurrencyContext';

const ProvidersPage = () => {
  const { excelHeaders, excelData } = useDataContext();
  const { formatCurrency } = useCurrency();
  const [selectedProvider, setSelectedProvider] = useState('');
  const { colors } = useTheme();

  // Función para convertir número de serie Excel a fecha dd/MM/yyyy
  function excelDateToString(excelDate) {
    if (typeof excelDate === 'number' && !isNaN(excelDate)) {
      const utc_days = Math.floor(excelDate - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      // Ajuste por decimales (hora)
      if (excelDate % 1 !== 0) {
        const totalSeconds = Math.round(86400 * (excelDate % 1));
        date_info.setSeconds(date_info.getSeconds() + totalSeconds);
      }
      const day = String(date_info.getDate()).padStart(2, '0');
      const month = String(date_info.getMonth() + 1).padStart(2, '0');
      const year = date_info.getFullYear();
      return `${day}/${month}/${year}`;
    }
    // Si es string numérico
    if (typeof excelDate === 'string' && /^\d+(\.\d+)?$/.test(excelDate)) {
      return excelDateToString(Number(excelDate));
    }
    // Si ya es string tipo fecha
    return excelDate;
  }

  // Función para verificar si una columna es de fecha
  function isDateColumn(header) {
    const headerLower = header.toLowerCase();
    return headerLower.includes('data') || headerLower.includes('date') || headerLower.includes('emissió') || headerLower.includes('comptable') || headerLower.includes('venciment');
  }

  // Encontrar el índice de la columna "Proveïdor"
  const providerColumnIndex = useMemo(() => {
    return excelHeaders.findIndex(header => 
      header.toLowerCase().includes('proveïdor') || 
      header.toLowerCase().includes('proveedor') ||
      header.toLowerCase().includes('provider')
    );
  }, [excelHeaders]);

  // Extraer proveedores únicos de la columna correcta
  const uniqueProviders = useMemo(() => {
    if (providerColumnIndex === -1 || excelData.length === 0) return [];
    
    const providers = new Set();
    excelData.forEach(row => {
      if (row[providerColumnIndex]) providers.add(row[providerColumnIndex]);
    });
    
    return Array.from(providers).sort();
  }, [providerColumnIndex, excelData]);

  // Filtrar datos del proveedor seleccionado
  const selectedProviderData = useMemo(() => {
    if (!selectedProvider || providerColumnIndex === -1) return [];
    return excelData.filter(row => row[providerColumnIndex] === selectedProvider);
  }, [selectedProvider, excelData, providerColumnIndex]);

  // Calcular estadísticas del proveedor seleccionado
  const providerStats = useMemo(() => {
    if (!selectedProvider || selectedProviderData.length === 0) return null;
    
    const stats = {
      totalInvoices: selectedProviderData.length,
      totalAmount: 0,
      averageAmount: 0,
      minAmount: Infinity,
      maxAmount: 0
    };

    // Intentar encontrar columna de importe (buscar columnas que contengan "importe", "total", "amount", etc.)
    let amountColumnIndex = -1;
    for (let i = 0; i < excelHeaders.length; i++) {
      const header = excelHeaders[i].toLowerCase();
      if (header.includes('importe') || header.includes('total') || header.includes('amount') || header.includes('precio') || header.includes('price')) {
        amountColumnIndex = i;
        break;
      }
    }

    if (amountColumnIndex !== -1) {
      selectedProviderData.forEach(row => {
        const amount = parseFloat(row[amountColumnIndex]) || 0;
        stats.totalAmount += amount;
        stats.minAmount = Math.min(stats.minAmount, amount);
        stats.maxAmount = Math.max(stats.maxAmount, amount);
      });
      stats.averageAmount = stats.totalAmount / stats.totalInvoices;
    }

    return stats;
  }, [selectedProvider, selectedProviderData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 30 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{ padding: '24px', height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{ margin: '0 0 24px 0', color: colors.text, fontWeight: 700, fontSize: 28, lineHeight: 1.2 }}
      >
        Proveedores
      </motion.h2>
      {excelHeaders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ color: colors.textSecondary, fontSize: 18, marginTop: 40 }}
        >
          No hay datos importados. Por favor, importa un archivo Excel en la sección correspondiente.
        </motion.div>
      ) : providerColumnIndex === -1 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ color: colors.textSecondary, fontSize: 18, marginTop: 40 }}
        >
          No se encontró la columna "Proveïdor" en los datos importados. <br />
          Columnas disponibles: {excelHeaders.join(', ')}
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 80px)', gap: '24px' }}
        >
          {/* Dropdown de proveedores */}
          <div
            style={{
              background: colors.card,
              borderRadius: 8,
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              padding: '20px',
              marginBottom: 0
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <h3 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: 0, lineHeight: 1.2 }}>
                Seleccionar proveedor:
              </h3>
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                style={{
                  padding: '8px 12px',
                  borderRadius: '4px',
                  border: `1px solid ${colors.border}`,
                  fontSize: '14px',
                  minWidth: '200px',
                  background: colors.surface,
                  color: colors.text,
                  marginLeft: 0
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = colors.primary;
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = colors.border;
                }}
              >
                <option value="">-- Selecciona un proveedor --</option>
                {uniqueProviders.map((provider, index) => (
                  <option key={index} value={provider} style={{ color: colors.text }}>
                    {provider}
                  </option>
                ))}
              </select>
              <div style={{ color: colors.textSecondary, fontSize: '14px' }}>
                ({uniqueProviders.length} proveedores disponibles)
              </div>
            </div>
          </div>

          {/* Resumen del proveedor seleccionado */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 30 }}
            transition={{ duration: 0.5, delay: 0.2, ease: 'easeOut' }}
            style={{ flex: 1, background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}
          >
            {selectedProvider ? (
              <div>
                <h3 style={{ marginBottom: 20, color: colors.text, fontSize: 18 }}>
                  Resumen: {selectedProvider}
                </h3>
                
                {/* Estadísticas */}
                {providerStats && (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.primary }}>
                        {providerStats.totalInvoices}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>Facturas</div>
                    </div>
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.primary }}>
                        {formatCurrency(providerStats.totalAmount)}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>Total</div>
                    </div>
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.primary }}>
                        {formatCurrency(providerStats.averageAmount)}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>Promedio</div>
                    </div>
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '6px', textAlign: 'center' }}>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.primary }}>
                        {formatCurrency(providerStats.maxAmount)}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>Máximo</div>
                    </div>
                  </div>
                )}

                {/* Tabla de datos del proveedor */}
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {excelHeaders.map((header, i) => (
                          <th key={i} style={{ 
                            borderBottom: `1px solid ${colors.border}`,
                            padding: '12px 8px', 
                            textAlign: 'left', 
                            color: colors.primary, 
                            fontWeight: 600,
                            background: colors.surface
                          }}>
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProviderData.map((row, i) => (
                        <tr key={i} style={{ background: i % 2 === 0 ? colors.card : colors.surface }}>
                          {excelHeaders.map((header, j) => (
                            <td key={j} style={{ 
                              borderBottom: `1px solid ${colors.border}`,
                              padding: '12px 8px', 
                              color: colors.text 
                            }}>
                              {isDateColumn(header) ? excelDateToString(row[j]) : row[j]}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center', 
                height: '100%',
                color: colors.textSecondary,
                fontSize: 16
              }}>
                Selecciona un proveedor del dropdown para ver su resumen
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default ProvidersPage; 