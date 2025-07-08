import React, { useState, useMemo, useRef } from 'react';
import { useDataContext } from './DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';

const AnalyticsPage = () => {
  const { excelHeaders, excelData } = useDataContext();
  const { formatCurrency } = useCurrency();
  const [selectedView, setSelectedView] = useState('general');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const tableRef = useRef(null);
  const { colors } = useTheme();

  // Encontrar índices de columnas importantes
  const columnIndices = useMemo(() => {
    const indices = {};
    excelHeaders.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      if (headerLower.includes('proveïdor') || headerLower.includes('proveedor') || headerLower.includes('provider')) {
        indices.provider = index;
      }
      if (headerLower.includes('data') && headerLower.includes('emissió')) {
        indices.date = index;
      }
      if (headerLower.includes('núm') || headerLower.includes('num')) {
        indices.invoiceNumber = index;
      }
      if (headerLower.includes('compte') || headerLower.includes('account')) {
        indices.account = index;
      }
      if (headerLower.includes('descripció') || headerLower.includes('descripcion')) {
        indices.description = index;
      }
      if (headerLower.includes('subtotal')) {
        indices.subtotal = index;
      }
      if (headerLower.includes('total')) {
        indices.total = index;
      }
      if (headerLower.includes('iban')) {
        indices.iban = index;
      }
      if (headerLower.includes('pendents') || headerLower.includes('pending')) {
        indices.pending = index;
      }
      if (headerLower.includes('estat') || headerLower.includes('estado')) {
        indices.estat = index;
      }
    });
    return indices;
  }, [excelHeaders]);

  // Extraer proveedores únicos
  const uniqueProviders = useMemo(() => {
    if (!columnIndices.provider || excelData.length === 0) return [];
    const providers = new Set();
    excelData.forEach(row => {
      if (row[columnIndices.provider]) providers.add(row[columnIndices.provider]);
    });
    return Array.from(providers).sort();
  }, [excelData, columnIndices.provider]);

  // Calcular estadísticas por proveedor
  const providerStats = useMemo(() => {
    if (!columnIndices.provider || !columnIndices.total) return [];
    
    const stats = {};
    excelData.forEach(row => {
      const provider = row[columnIndices.provider];
      const total = parseFloat(row[columnIndices.total]) || 0;
      const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
      
      if (provider) {
        if (!stats[provider]) {
          stats[provider] = {
            totalAmount: 0,
            totalPending: 0,
            invoiceCount: 0,
            invoices: []
          };
        }
        stats[provider].totalAmount += total;
        stats[provider].totalPending += pending;
        stats[provider].invoiceCount += 1;
        stats[provider].invoices.push(row);
      }
    });
    
    return Object.entries(stats).map(([provider, data]) => ({
      provider,
      ...data
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [excelData, columnIndices]);

  // Calcular totales por canal (Estructura, Catering, IDONI)
  const channelStats = useMemo(() => {
    if (!columnIndices.description && !columnIndices.account) return {};
    
    const channels = {
      'Estructura': { total: 0, count: 0 },
      'Catering': { total: 0, count: 0 },
      'IDONI': { total: 0, count: 0 },
      'Otros': { total: 0, count: 0 }
    };
    
    excelData.forEach(row => {
      const description = (row[columnIndices.description] || '').toLowerCase();
      const account = (row[columnIndices.account] || '').toLowerCase();
      const total = columnIndices.total ? (parseFloat(row[columnIndices.total]) || 0) : 0;
      
      // Buscar en descripción primero, si no encuentra nada, buscar en cuenta
      let channel = 'Otros';
      
      if (description.includes('estructura') || account.includes('estructura')) {
        channel = 'Estructura';
      } else if (description.includes('catering') || account.includes('catering')) {
        channel = 'Catering';
      } else if (description.includes('idoni') || account.includes('idoni')) {
        channel = 'IDONI';
      }
      
      channels[channel].total += total;
      channels[channel].count += 1;
    });
    
    return channels;
  }, [excelData, columnIndices]);

  // Filtrar datos según vista seleccionada
  const filteredData = useMemo(() => {
    if (selectedProvider && columnIndices.provider) {
      return excelData.filter(row => row[columnIndices.provider] === selectedProvider);
    }
    return excelData;
  }, [excelData, selectedProvider, columnIndices.provider]);

  // Filtrar datos por canal seleccionado
  const channelFilteredData = useMemo(() => {
    if (!selectedChannel || !columnIndices.description || !columnIndices.account) return [];
    
    return excelData.filter(row => {
      const description = (row[columnIndices.description] || '').toLowerCase();
      const account = (row[columnIndices.account] || '').toLowerCase();
      
      switch (selectedChannel) {
        case 'Estructura':
          return description.includes('estructura') || account.includes('estructura');
        case 'Catering':
          return description.includes('catering') || account.includes('catering');
        case 'IDONI':
          return description.includes('idoni') || account.includes('idoni');
        case 'Otros':
          return !description.includes('estructura') && !description.includes('catering') && 
                 !description.includes('idoni') && !account.includes('estructura') && 
                 !account.includes('catering') && !account.includes('idoni');
        default:
          return false;
      }
    });
  }, [excelData, selectedChannel, columnIndices]);

  // Columnas disponibles para selección
  const availableColumns = [
    { key: 'date', label: 'Fecha Factura', index: columnIndices.date },
    { key: 'invoiceNumber', label: 'Número Factura', index: columnIndices.invoiceNumber },
    { key: 'provider', label: 'Proveedor', index: columnIndices.provider },
    { key: 'account', label: 'Cuenta', index: columnIndices.account },
    { key: 'description', label: 'Descripción', index: columnIndices.description },
    { key: 'subtotal', label: 'Subtotal', index: columnIndices.subtotal },
    { key: 'total', label: 'Total', index: columnIndices.total },
    { key: 'iban', label: 'Número IBAN', index: columnIndices.iban },
    { key: 'pending', label: 'Pendiente', index: columnIndices.pending }
  ].filter(col => col.index !== undefined);

  // Inicializar columnas seleccionadas
  React.useEffect(() => {
    if (selectedColumns.length === 0 && availableColumns.length > 0) {
      setSelectedColumns(availableColumns.map(col => col.key));
    }
  }, [availableColumns, selectedColumns.length]);

  const views = [
    { id: 'general', name: 'Vista General', description: 'Todas las facturas con columnas personalizables' },
    { id: 'sergi', name: 'Vista Sergi', description: 'Análisis por canales (Estructura, Catering, IDONI)' },
    { id: 'bruno', name: 'Vista Bruno', description: 'Análisis de deudas por proveedor' }
  ];

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

  // --- Unificar lógica de filtrado de facturas por canal ---
  function getChannelRows(channel, excelData, columnIndices) {
    if (!channel || !columnIndices.description || !columnIndices.account) return [];
    return excelData.filter(row => {
      const description = (row[columnIndices.description] || '').toLowerCase();
      const account = (row[columnIndices.account] || '').toLowerCase();
      switch (channel) {
        case 'Estructura':
          return description.includes('estructura') || account.includes('estructura');
        case 'Catering':
          return description.includes('catering') || account.includes('catering');
        case 'IDONI':
          return description.includes('idoni') || account.includes('idoni');
        case 'Otros':
          return !description.includes('estructura') && !description.includes('catering') &&
                 !description.includes('idoni') && !account.includes('estructura') &&
                 !account.includes('catering') && !account.includes('idoni');
        default:
          return false;
      }
    });
  }

  // Función para manejar el click en una tarjeta de canal
  const handleChannelClick = (channel) => {
    setSelectedChannel(prev => (prev === channel ? '' : channel));
  };

  // Función para saber si una fila está pendiente de pago
  function isPending(row, columnIndices) {
    const estatIdx = columnIndices.estat !== undefined ? columnIndices.estat : -1;
    if (estatIdx === -1) return false;
    const estat = (row[estatIdx] || '').toLowerCase();
    return estat === 'pendents' || estat === 'vençut';
  }

  // Función para obtener el color del canal
  function getChannelColor(channel) {
    switch (channel) {
      case 'Estructura':
        return { background: 'rgba(255, 152, 0, 0.15)', color: '#E65100' }; // Naranja apastelado (construcción)
      case 'Catering':
        return { background: 'rgba(76, 175, 80, 0.15)', color: '#2E7D32' }; // Verde apastelado (catering)
      case 'IDONI':
        return { background: 'rgba(233, 30, 99, 0.15)', color: '#C2185B' }; // Rosa IDONI apastelado
      case 'Otros':
        return { background: 'rgba(158, 158, 158, 0.15)', color: '#616161' }; // Gris apastelado
      default:
        return { background: 'rgba(158, 158, 158, 0.15)', color: '#616161' };
    }
  }

  // Función para obtener colores de filas intercaladas
  function getRowBackgroundColor(index) {
    if (colors.background === '#1a1a1a') {
      // Modo oscuro
      return index % 2 === 0 ? '#333333' : '#2d2d2d';
    } else {
      // Modo claro
      return index % 2 === 0 ? '#ffffff' : '#f8f9fa';
    }
  }

  // Calcular total facturado y total a pagar (solo pendientes o vencidas)
  const totalFacturado = useMemo(() => {
    if (!columnIndices.total) return 0;
    return excelData.reduce((sum, row) => {
      const total = parseFloat(row[columnIndices.total]) || 0;
      return sum + total;
    }, 0);
  }, [excelData, columnIndices]);

  const totalAPagar = useMemo(() => {
    if (!columnIndices.total || columnIndices.estat === undefined) return 0;
    return excelData.reduce((sum, row) => {
      if (isPending(row, columnIndices)) {
        const total = parseFloat(row[columnIndices.total]) || 0;
        return sum + total;
      }
      return sum;
    }, 0);
  }, [excelData, columnIndices]);

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
        Análisis
      </motion.h2>

      {/* Tarjetas de selección de vista */}
      <div style={{
        display: 'flex',
        gap: '18px',
        marginBottom: '28px',
        flexWrap: 'wrap',
      }}>
        {views.map(view => {
          const isActive = selectedView === view.id;
          return (
            <motion.div
              key={view.id}
              whileHover={{ scale: 1.04, boxShadow: isActive ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedView(view.id)}
              style={{
                minWidth: 180,
                flex: '1 1 180px',
                background: colors.card,
                borderRadius: 12,
                boxShadow: isActive ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
                border: isActive ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
                color: isActive ? colors.primary : colors.text,
                cursor: 'pointer',
                padding: '22px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                transition: 'all 0.18s',
                fontWeight: isActive ? 600 : 400,
                fontSize: 16,
                outline: isActive ? `2px solid ${colors.primary}` : 'none',
                position: 'relative',
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>{view.name}</span>
              <span style={{ fontSize: 13, color: isActive ? colors.primary : colors.textSecondary, marginTop: 2 }}>{view.description}</span>
            </motion.div>
          );
        })}
      </div>

      {excelHeaders.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ color: colors.textSecondary, fontSize: 18, marginTop: 40 }}
        >
          No hay datos importados. Por favor, importa un archivo Excel en la sección correspondiente.
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 80px)', gap: '24px' }}
        >
          {/* Descripción de la vista seleccionada */}
          <div style={{ marginBottom: 0, color: colors.textSecondary, fontSize: 15, minHeight: 22 }}>
            {views.find(v => v.id === selectedView)?.description}
          </div>

          {/* Controles específicos por vista */}
          {selectedView === 'general' && (
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 30 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            >
              <div style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
                <h3 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: 16, fontWeight: 600, lineHeight: 1.2 }}>Filtros y Columnas</h3>
                <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
                  <div>
                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', color: colors.textSecondary }}>
                      Filtrar por proveedor:
                    </label>
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
                        color: colors.text
                      }}
                    >
                      <option value="">Todos los proveedores</option>
                      {uniqueProviders.map(provider => (
                        <option key={provider} value={provider} style={{ color: colors.text }}>{provider}</option>
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
            </motion.div>
          )}

          {/* Contenido de la vista seleccionada */}
          <div style={{ flex: 1, background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
            {selectedView === 'general' && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <h3 style={{ margin: '0 0 20px 0', color: colors.text, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>
                  {selectedProvider ? `Facturas de ${selectedProvider}` : 'Todas las facturas'}
                </h3>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                    <thead>
                      <tr>
                        {availableColumns
                          .filter(col => selectedColumns.includes(col.key))
                          .map(col => (
                            <th key={col.key} style={{ 
                              borderBottom: `1px solid ${colors.border}`,
                              padding: '12px 8px', 
                              textAlign: 'left', 
                              color: colors.primary, 
                              fontWeight: 600,
                              background: colors.surface
                            }}>
                              {col.label}
                            </th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredData.map((row, i) => (
                        <tr key={i} style={{ 
                          background: getRowBackgroundColor(i),
                          transition: 'background-color 0.2s ease'
                        }}>
                          {availableColumns
                            .filter(col => selectedColumns.includes(col.key))
                            .map(col => (
                              <td key={col.key} style={{ 
                                borderBottom: `1px solid ${colors.border}`,
                                padding: '12px 8px', 
                                color: colors.text 
                              }}>
                                {col.key === 'date'
                                  ? (col.index !== undefined && row[col.index] ? excelDateToString(row[col.index]) : '')
                                  : (col.index !== undefined ? row[col.index] : '')}
                              </td>
                            ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>
            )}

            {selectedView === 'sergi' && (
              <div>
                <motion.h3
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 20 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ margin: '0 0 20px 0', color: colors.text, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}
                >
                  Análisis por Canales
                </motion.h3>
                
                {/* Animación de cajas de canales */}
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.08 } },
                    hidden: {}
                  }}
                  style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '32px' }}
                >
                  {Object.entries(channelStats).map(([channel, stats]) => {
                    const isSelected = selectedChannel === channel;
                    const channelRows = getChannelRows(channel, excelData, columnIndices);
                    // Fondo especial para modo claro
                    const isLight = colors.background === '#fafafa' || colors.background === '#fff' || colors.background === '#ffffff';
                    const cardBg = isLight ? '#F7F7F7' : '#2A2A2A';
                    return (
                      <motion.div
                        key={channel}
                        variants={{
                          hidden: { opacity: 0, y: 30 },
                          visible: { opacity: 1, y: 0 }
                        }}
                        whileTap={{ scale: 0.97 }}
                        whileHover={{ scale: 1.03 }}
                        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
                        onClick={() => handleChannelClick(channel)}
                        style={{
                          background: isSelected ? colors.hover : cardBg,
                          padding: '20px',
                          borderRadius: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          border: isSelected ? `2px solid ${colors.primary}` : `1px solid transparent`,
                          boxShadow: isSelected ? '0 4px 12px rgba(76,175,80,0.15)' : 'none',
                          userSelect: 'none',
                          minWidth: 0,
                          minHeight: 0,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'flex-start',
                        }}
                      >
                        <div style={{ marginBottom: '12px', userSelect: 'none', fontWeight: 500, fontSize: 17, color: isSelected ? colors.primary : colors.text }}>
                          {channel}
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: 700, color: isSelected ? colors.primary : colors.primary, marginBottom: '8px', userSelect: 'none' }}>
                          {formatCurrency(stats.total)}
                        </div>
                        <div style={{ fontSize: '15px', color: isSelected ? colors.primary : colors.textSecondary, marginBottom: 2, userSelect: 'none' }}>
                          {channelRows.length} facturas
                        </div>
                        <div style={{ fontSize: '13px', color: isSelected ? colors.primary : colors.textSecondary, marginTop: '8px', userSelect: 'none' }}>
                          {isSelected ? 'Canal seleccionado - Haz clic para deseleccionar' : 'Haz clic para ver todas las facturas'}
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>

                {/* Animación de tabla de facturas al seleccionar canal */}
                <AnimatePresence mode="wait">
                  {selectedChannel && (
                    <motion.div
                      key={selectedChannel}
                      ref={tableRef}
                      initial={{ opacity: 0, y: 30 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 30 }}
                      transition={{ duration: 0.2, ease: 'easeOut' }}
                      style={{ background: colors.card, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px', marginBottom: '32px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '18px', fontWeight: 600, lineHeight: 1.2 }}>
                          Facturas del canal: {selectedChannel}
                        </h4>
                        <span style={{ 
                          padding: '4px 12px', 
                          borderRadius: '12px', 
                          fontSize: '12px',
                          background: colors.success + '22',
                          color: colors.success,
                          fontWeight: '500'
                        }}>
                          {channelFilteredData.length} facturas encontradas
                        </span>
                      </div>
                      
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                          <thead>
                            <tr>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>
                                {excelHeaders[columnIndices.date] || 'Fecha'}
                              </th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>
                                {excelHeaders[columnIndices.invoiceNumber] || 'Número'}
                              </th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>
                                {excelHeaders[columnIndices.provider] || 'Proveedor'}
                              </th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>
                                {excelHeaders[columnIndices.description] || 'Descripción'}
                              </th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>
                                {excelHeaders[columnIndices.account] || 'Cuenta'}
                              </th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>
                                {excelHeaders[columnIndices.total] || 'Total'}
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {channelFilteredData.map((row, i) => (
                              <tr key={i} style={{ 
                                background: getRowBackgroundColor(i),
                                transition: 'background-color 0.2s ease'
                              }}>
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                  {row[columnIndices.date] ? excelDateToString(row[columnIndices.date]) : '-'}
                                </td>
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                  {row[columnIndices.invoiceNumber] || '-'}
                                </td>
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text, fontWeight: '500' }}>
                                  {row[columnIndices.provider] || '-'}
                                </td>
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                  {row[columnIndices.description] || '-'}
                                </td>
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                  {row[columnIndices.account] || '-'}
                                </td>
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text, fontWeight: '600' }}>
                                  {row[columnIndices.total] ? 
                                    formatCurrency(row[columnIndices.total]) : 
                                    '-'
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                    
                {/* Animación de entrada para la tabla de detalle por descripción */}
                <AnimatePresence mode="wait">
                  {!selectedChannel && (
                    <motion.div
                      key="detalle-descripcion"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      transition={{ duration: 0.3, delay: 0.1, ease: 'easeOut' }}
                      style={{ background: colors.card, borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px', marginBottom: '32px' }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px' }}>
                        <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '18px', fontWeight: 600, lineHeight: 1.2 }}>Detalle por Descripción</h4>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          background: colors.success + '22',
                          color: colors.success,
                          fontWeight: '500'
                        }}>
                          {excelData.length} facturas encontradas
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                          <thead>
                            <tr>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Descripción</th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Canal</th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Total</th>
                              <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Facturas</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.entries(
                              excelData.reduce((acc, row) => {
                                const description = row[columnIndices.description] || 'Sin descripción';
                                const account = row[columnIndices.account] || 'Sin cuenta';
                                const total = columnIndices.total ? (parseFloat(row[columnIndices.total]) || 0) : 0;
                                const descLower = description.toLowerCase();
                                const accountLower = account.toLowerCase();
                                
                                let channel = 'Otros';
                                if (descLower.includes('estructura') || accountLower.includes('estructura')) channel = 'Estructura';
                                else if (descLower.includes('catering') || accountLower.includes('catering')) channel = 'Catering';
                                else if (descLower.includes('idoni') || accountLower.includes('idoni')) channel = 'IDONI';
                                
                                // Usar descripción como clave, pero mostrar cuenta si la descripción está vacía
                                const displayKey = description === 'Sin descripción' ? account : description;
                                
                                if (!acc[displayKey]) acc[displayKey] = { total: 0, count: 0, channel, description, account };
                                acc[displayKey].total += total;
                                acc[displayKey].count += 1;
                                return acc;
                              }, {})
                            )
                              .sort((a, b) => b[1].total - a[1].total)
                              .map(([displayKey, stats], i) => {
                                const channelColor = getChannelColor(stats.channel);
                                return (
                                  <tr key={displayKey} style={{ 
                                    background: getRowBackgroundColor(i),
                                    transition: 'background-color 0.2s ease'
                                  }}>
                                    <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                      <div>
                                        <div>{displayKey}</div>
                                        {stats.description !== 'Sin descripción' && stats.account !== 'Sin cuenta' && (
                                          <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                                            Cuenta: {stats.account}
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                    <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                      <span style={{ 
                                        padding: '4px 8px', 
                                        borderRadius: '4px', 
                                        fontSize: '12px',
                                        background: channelColor.background,
                                        color: channelColor.color,
                                        fontWeight: '600'
                                      }}>
                                        {stats.channel}
                                      </span>
                                    </td>
                                    <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                                      {formatCurrency(stats.total)}
                                    </td>
                                    <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>{stats.count}</td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}

            {selectedView === 'bruno' && (
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 30 }}
                transition={{ duration: 0.5, ease: 'easeOut' }}
              >
                <div>
                  <h3 style={{ margin: '0 0 20px 0', color: colors.text, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>Análisis de Deudas por Proveedor</h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '32px' }}>
                    <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>Total Pendiente</h4>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.error, marginBottom: '8px' }}>
                        {formatCurrency(providerStats.reduce((sum, stat) => sum + stat.totalPending, 0))}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                        Total a pagar a todos los proveedores
                      </div>
                    </div>
                    <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>Proveedores con Deuda</h4>
                      <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.warning, marginBottom: '8px' }}>
                        {providerStats.filter(stat => stat.totalPending > 0).length}
                      </div>
                      <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                        Proveedores con facturas pendientes
                      </div>
                    </div>
                  </div>
                  
                  <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '18px', fontWeight: 600, lineHeight: 1.2 }}>Detalle por Proveedor</h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr>
                          <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Proveedor</th>
                          <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Total Facturas</th>
                          <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Total Pendiente</th>
                          <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Facturas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {providerStats.map((stat, i) => (
                          <tr key={stat.provider} style={{ 
                            background: getRowBackgroundColor(i),
                            transition: 'background-color 0.2s ease'
                          }}>
                            <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text, fontWeight: '500' }}>{stat.provider}</td>
                            <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>
                              {formatCurrency(stat.totalAmount)}
                            </td>
                            <td style={{ 
                              borderBottom: `1px solid ${colors.border}`, 
                              padding: '12px 8px', 
                              color: stat.totalPending > 0 ? colors.error : colors.text,
                              fontWeight: stat.totalPending > 0 ? '600' : '400'
                            }}>
                              {formatCurrency(stat.totalPending)}
                            </td>
                            <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.text }}>{stat.invoiceCount}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default AnalyticsPage; 