import React, { useState, useMemo, useEffect } from 'react';
import { useDataContext } from './DataContext';
import { useTheme } from './ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

const ProvidersPage = () => {
  const { excelHeaders, excelData } = useDataContext();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Estados para datos desde Supabase
  const [supabaseData, setSupabaseData] = useState({
    headers: [],
    data: [],
    loading: false
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedProvider, setSelectedProvider] = useState('');

  // Cargar datos desde Supabase al montar el componente
  useEffect(() => {
    loadDataFromSupabase();
  }, []);

  // Función para cargar datos desde Supabase
  const loadDataFromSupabase = async () => {
    setLoading(true);
    setError('');

    try {
      // Obtener todos los uploads de Excel
      const { data: uploads, error: uploadsError } = await supabase
        .from('excel_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (uploadsError) {
        setError('Error al cargar los datos de Excel');
        return;
      }

      if (uploads.length === 0) {
        setSupabaseData({ headers: [], data: [], loading: false });
        return;
      }

      // Obtener datos de facturas para todos los uploads
      const uploadIds = uploads.map(u => u.id);
      const { data: invoicesData, error: invoicesError } = await supabase
        .from('invoices')
        .select('*')
        .in('upload_id', uploadIds)
        .order('processed_at', { ascending: false });

      if (invoicesError) {
        setError('Error al cargar los datos de facturas');
        return;
      }

      // Procesar datos de facturas
      const processedData = processInvoicesData(invoicesData, uploads);
      
      setSupabaseData({
        headers: processedData.headers,
        data: processedData.data,
        loading: false
      });

    } catch (error) {
      setError('Error al cargar los datos desde la base de datos');
    } finally {
      setLoading(false);
    }
  };

  // Función para procesar datos de facturas
  const processInvoicesData = (invoicesData, uploads) => {
    if (invoicesData.length === 0) {
      return { headers: [], data: [] };
    }

    // Definir las columnas esperadas en el orden correcto
    const expectedHeaders = [
      "Data d'emissió",
      'Núm',
      'Núm. Intern',
      'Data comptable',
      'Venciment',
      'Proveïdor',
      'Descripció',
      'Tags',
      'Compte',
      'Projecte',
      'Subtotal',
      'IVA',
      'Retención',
      'Empleados',
      'Rec. de eq.',
      'Total',
      'Pagat',
      'Pendents',
      'Estat',
      'Data de pagament'
    ];

    // Mapeo inverso de columnas de la base de datos a las columnas del Excel
    const dbToExcelMapping = {
      'issue_date': "Data d'emissió",
      'invoice_number': 'Núm',
      'internal_number': 'Núm. Intern',
      'accounting_date': 'Data comptable',
      'due_date': 'Venciment',
      'provider': 'Proveïdor',
      'description': 'Descripció',
      'tags': 'Tags',
      'account': 'Compte',
      'project': 'Projecte',
      'subtotal': 'Subtotal',
      'vat': 'IVA',
      'retention': 'Retención',
      'employees': 'Empleados',
      'equipment_recovery': 'Rec. de eq.',
      'total': 'Total',
      'paid': 'Pagat',
      'pending': 'Pendents',
      'status': 'Estat',
      'payment_date': 'Data de pagament'
    };

    // Convertir datos de facturas a formato de array
    const processedData = invoicesData.map(invoice => {
      const row = [];
      expectedHeaders.forEach(header => {
        // Encontrar la columna correspondiente en la base de datos
        const dbColumn = Object.keys(dbToExcelMapping).find(key => dbToExcelMapping[key] === header);
        if (dbColumn && invoice[dbColumn] !== undefined && invoice[dbColumn] !== null) {
          row.push(invoice[dbColumn]);
        } else {
          row.push(null);
        }
      });
      return row;
    });

    return { headers: expectedHeaders, data: processedData };
  };

  // Función para convertir número de serie Excel a fecha dd/MM/yyyy
  function excelDateToString(excelDate) {
    if (typeof excelDate === 'number' && !isNaN(excelDate)) {
      const utc_days = Math.floor(excelDate - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      
      if (excelDate % 1 !== 0) {
        const totalSeconds = Math.round(86400 * (excelDate % 1));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        date_info.setHours(hours, minutes, seconds);
      }
      
      return date_info.toLocaleDateString('es-ES');
    }
    
    if (typeof excelDate === 'string' && /^\d+(\.\d+)?$/.test(excelDate)) {
      return excelDateToString(Number(excelDate));
    }
    
    return excelDate;
  }

  // Función para verificar si una columna es de fecha
  function isDateColumn(header) {
    const headerLower = header.toLowerCase();
    return headerLower.includes('data') || headerLower.includes('date') || headerLower.includes('emissió') || headerLower.includes('comptable') || headerLower.includes('venciment');
  }

  // Encontrar el índice de la columna "Proveïdor"
  const providerColumnIndex = useMemo(() => {
    return supabaseData.headers.findIndex(header => 
      header.toLowerCase().includes('proveïdor') || 
      header.toLowerCase().includes('proveedor') ||
      header.toLowerCase().includes('provider')
    );
  }, [supabaseData.headers]);

  // Extraer proveedores únicos de la columna correcta
  const uniqueProviders = useMemo(() => {
    if (providerColumnIndex === -1 || supabaseData.data.length === 0) return [];
    
    const providers = new Set();
    supabaseData.data.forEach(row => {
      if (row[providerColumnIndex]) providers.add(row[providerColumnIndex]);
    });
    
    return Array.from(providers).sort();
  }, [providerColumnIndex, supabaseData.data]);

  // Filtrar datos del proveedor seleccionado
  const selectedProviderData = useMemo(() => {
    if (!selectedProvider || providerColumnIndex === -1) return [];
    return supabaseData.data.filter(row => row[providerColumnIndex] === selectedProvider);
  }, [selectedProvider, supabaseData.data, providerColumnIndex]);

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
    for (let i = 0; i < supabaseData.headers.length; i++) {
      const header = supabaseData.headers[i].toLowerCase();
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
  }, [selectedProvider, selectedProviderData, supabaseData.headers]);

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

      {/* Indicador de carga */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '60px 20px',
            color: colors.textSecondary 
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${colors.border}`,
              borderTop: `3px solid ${colors.primary}`,
              borderRadius: '50%',
              marginBottom: '20px'
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            Cargando datos desde la base de datos...
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            Esto puede tomar unos segundos
          </div>
        </motion.div>
      )}

      {/* Manejo de errores */}
      {error && !loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '60px 20px',
            color: colors.error 
          }}
        >
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            Error al cargar los datos
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>
            {error}
          </div>
          <button
            onClick={loadDataFromSupabase}
            style={{
              background: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Reintentar
          </button>
        </motion.div>
      )}

      {/* Contenido principal */}
      {!loading && !error && (
        <>
          {supabaseData.headers.length === 0 ? (
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
              Columnas disponibles: {supabaseData.headers.join(', ')}
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
                    <h3 style={{ color: colors.text, fontSize: 18, fontWeight: 600, margin: '0 0 20px 0', lineHeight: 1.2 }}>
                      Resumen de {selectedProvider}
                    </h3>
                    
                    {providerStats && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                          <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Total Facturas</div>
                          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>{providerStats.totalInvoices}</div>
                        </div>
                        <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                          <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Total Importe</div>
                          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>{formatCurrency(providerStats.totalAmount)}</div>
                        </div>
                        <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                          <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Importe Promedio</div>
                          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>{formatCurrency(providerStats.averageAmount)}</div>
                        </div>
                        <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px', border: `1px solid ${colors.border}` }}>
                          <div style={{ fontSize: '14px', color: colors.textSecondary, marginBottom: '4px' }}>Rango</div>
                          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.text }}>
                            {formatCurrency(providerStats.minAmount)} - {formatCurrency(providerStats.maxAmount)}
                          </div>
                        </div>
                      </div>
                    )}

                    <h4 style={{ color: colors.text, fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', lineHeight: 1.2 }}>
                      Facturas de {selectedProvider}
                    </h4>
                    
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                        <thead>
                          <tr>
                            {supabaseData.headers.map((header, i) => (
                              <th key={i} style={{
                                padding: '12px 8px',
                                textAlign: 'left',
                                fontWeight: 600,
                                fontSize: 14,
                                color: colors.text,
                                borderBottom: `2px solid ${colors.border}`,
                                backgroundColor: colors.surface,
                                position: 'sticky',
                                top: 0,
                                zIndex: 10
                              }}>
                                {header}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {selectedProviderData.map((row, i) => (
                            <tr key={i} style={{ 
                              background: i % 2 === 0 ? colors.surface : colors.card,
                              transition: 'background-color 0.2s ease'
                            }}>
                              {supabaseData.headers.map((header, j) => (
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
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    justifyContent: 'center', 
                    height: '200px',
                    color: colors.textSecondary 
                  }}>
                    <div style={{ fontSize: 16, marginBottom: 8 }}>
                      Selecciona un proveedor para ver sus datos
                    </div>
                    <div style={{ fontSize: 14 }}>
                      Se mostrarán todas las facturas y estadísticas del proveedor seleccionado
                    </div>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </>
      )}
    </motion.div>
  );
};

export default ProvidersPage; 