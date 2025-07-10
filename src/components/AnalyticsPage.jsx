import React, { useState, useMemo, useRef, Fragment, useEffect } from 'react';
import { useDataContext } from './DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

const AnalyticsPage = () => {
  const { 
    solucionsHeaders, solucionsData, 
    menjarHeaders, menjarData 
  } = useDataContext();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Estados para datos desde Supabase
  const [supabaseData, setSupabaseData] = useState({
    solucions: { headers: [], data: [], loading: false },
    menjar: { headers: [], data: [], loading: false }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [selectedDataset, setSelectedDataset] = useState('solucions');
  const [selectedView, setSelectedView] = useState('general');
  const [selectedColumns, setSelectedColumns] = useState([]);
  const [selectedProvider, setSelectedProvider] = useState('');
  const [selectedChannel, setSelectedChannel] = useState('');
  const [expandedProvider, setExpandedProvider] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [sergiSortConfig, setSergiSortConfig] = useState({ key: null, direction: 'asc' });
  const [channelSortConfig, setChannelSortConfig] = useState({ key: null, direction: 'asc' });
  const [isChangingDataset, setIsChangingDataset] = useState(false);
  const tableRef = useRef(null);

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
        console.error('Error loading uploads:', uploadsError);
        setError('Error al cargar los datos de Excel');
        return;
      }

      // Separar uploads por tipo
      const solucionsUploads = uploads.filter(upload => upload.upload_type === 'solucions');
      const menjarUploads = uploads.filter(upload => upload.upload_type === 'menjar');

      // Obtener datos de facturas para cada tipo
      const [solucionsData, menjarData] = await Promise.all([
        getInvoicesData(solucionsUploads.map(u => u.id)),
        getInvoicesData(menjarUploads.map(u => u.id))
      ]);

      // Procesar datos de Solucions
      const processedSolucions = processInvoicesData(solucionsData, solucionsUploads);
      
      // Procesar datos de Menjar
      const processedMenjar = processInvoicesData(menjarData, menjarUploads);

      setSupabaseData({
        solucions: {
          headers: processedSolucions.headers,
          data: processedSolucions.data,
          loading: false
        },
        menjar: {
          headers: processedMenjar.headers,
          data: processedMenjar.data,
          loading: false
        }
      });

    } catch (error) {
      console.error('Error loading data from Supabase:', error);
      setError('Error al cargar los datos desde la base de datos');
    } finally {
      setLoading(false);
    }
  };

  // Función para obtener datos de facturas por upload IDs
  const getInvoicesData = async (uploadIds) => {
    if (uploadIds.length === 0) return [];

    const { data, error } = await supabase
      .from('invoices')
      .select('*')
      .in('upload_id', uploadIds)
      .order('processed_at', { ascending: false });

    if (error) {
      console.error('Error loading invoices:', error);
      return [];
    }

    return data || [];
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

  // Función para manejar el cambio de dataset con animación
  const handleDatasetChange = (newDataset) => {
    if (newDataset !== selectedDataset) {
      setIsChangingDataset(true);
      setTimeout(() => {
        setSelectedDataset(newDataset);
        // Limpiar filtros al cambiar de dataset
        setSelectedProvider('');
        setSelectedChannel('');
        setExpandedProvider('');
        setIsChangingDataset(false);
      }, 100); // Pausa más corta para una transición más rápida
    }
  };

  // Obtener los datos y headers del dataset seleccionado (desde Supabase)
  const currentHeaders = selectedDataset === 'solucions' 
    ? supabaseData.solucions.headers 
    : supabaseData.menjar.headers;
  const currentData = selectedDataset === 'solucions' 
    ? supabaseData.solucions.data 
    : supabaseData.menjar.data;

  // Función para manejar el ordenamiento
  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  // Función para manejar el ordenamiento de la vista Sergi
  const handleSergiSort = (key) => {
    let direction = 'asc';
    if (sergiSortConfig.key === key && sergiSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSergiSortConfig({ key, direction });
  };

  // Función para manejar el ordenamiento de las tablas de facturas por canal
  const handleChannelSort = (key) => {
    let direction = 'asc';
    if (channelSortConfig.key === key && channelSortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setChannelSortConfig({ key, direction });
  };

  // Encontrar índices de columnas importantes
  const columnIndices = useMemo(() => {
    const indices = {};
    currentHeaders.forEach((header, index) => {
      const headerLower = header.toLowerCase();
      if (headerLower.includes('proveïdor') || headerLower.includes('proveedor') || headerLower.includes('provider')) {
        indices.provider = index;
      }
      if (headerLower.includes('data') && headerLower.includes('emissió')) {
        indices.date = index;
      }
      if ((headerLower.includes('núm') || headerLower.includes('num')) && !headerLower.includes('intern')) {
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
  }, [currentHeaders]);

  // Función para ordenar datos de la vista General
  const sortData = (data, key, direction) => {
    if (!key) return data;
    
    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      // Obtener valores según la clave de ordenamiento
      switch (key) {
        case 'date':
          aValue = a[columnIndices.date];
          bValue = b[columnIndices.date];
          // Convertir fechas de Excel
          if (aValue && bValue) {
            aValue = new Date(excelDateToString(aValue));
            bValue = new Date(excelDateToString(bValue));
          }
          break;
        case 'invoiceNumber':
          aValue = a[columnIndices.invoiceNumber];
          bValue = b[columnIndices.invoiceNumber];
          break;
        case 'provider':
          aValue = a[columnIndices.provider];
          bValue = b[columnIndices.provider];
          break;
        case 'account':
          aValue = a[columnIndices.account];
          bValue = b[columnIndices.account];
          break;
        case 'description':
          aValue = a[columnIndices.description];
          bValue = b[columnIndices.description];
          break;
        case 'subtotal':
          aValue = parseFloat(a[columnIndices.subtotal]) || 0;
          bValue = parseFloat(b[columnIndices.subtotal]) || 0;
          break;
        case 'total':
          aValue = parseFloat(a[columnIndices.total]) || 0;
          bValue = parseFloat(b[columnIndices.total]) || 0;
          break;
        case 'pending':
          aValue = parseFloat(a[columnIndices.pending]) || 0;
          bValue = parseFloat(b[columnIndices.pending]) || 0;
          break;
        default:
          aValue = a[key];
          bValue = b[key];
      }
      
      // Manejar valores nulos o undefined
      if (!aValue && aValue !== 0) aValue = '';
      if (!bValue && bValue !== 0) bValue = '';
      
      // Comparación
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Función para ordenar datos de la vista Sergi (tabla de descripción)
  const sortSergiData = (data, key, direction) => {
    if (!key) return data;
    
    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      // Obtener valores según la clave de ordenamiento
      switch (key) {
        case 'description':
          aValue = a[0]; // La clave es la descripción
          bValue = b[0];
          break;
        case 'channel':
          aValue = a[1].channel;
          bValue = b[1].channel;
          break;
        case 'total':
          aValue = a[1].total;
          bValue = b[1].total;
          break;
        case 'count':
          aValue = a[1].count;
          bValue = b[1].count;
          break;
        default:
          aValue = a[key];
          bValue = b[key];
      }
      
      // Manejar valores nulos o undefined
      if (!aValue && aValue !== 0) aValue = '';
      if (!bValue && bValue !== 0) bValue = '';
      
      // Comparación
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Función para ordenar datos de las tablas de facturas por canal
  const sortChannelData = (data, key, direction) => {
    if (!key) return data;
    
    return [...data].sort((a, b) => {
      let aValue, bValue;
      
      // Obtener valores según la clave de ordenamiento
      switch (key) {
        case 'date':
          aValue = a[columnIndices.date];
          bValue = b[columnIndices.date];
          // Convertir fechas de Excel
          if (aValue && bValue) {
            aValue = new Date(excelDateToString(aValue));
            bValue = new Date(excelDateToString(bValue));
          }
          break;
        case 'invoiceNumber':
          aValue = a[columnIndices.invoiceNumber];
          bValue = b[columnIndices.invoiceNumber];
          break;
        case 'provider':
          aValue = a[columnIndices.provider];
          bValue = b[columnIndices.provider];
          break;
        case 'account':
          aValue = a[columnIndices.account];
          bValue = b[columnIndices.account];
          break;
        case 'description':
          aValue = a[columnIndices.description];
          bValue = b[columnIndices.description];
          break;
        case 'subtotal':
          aValue = parseFloat(a[columnIndices.subtotal]) || 0;
          bValue = parseFloat(b[columnIndices.subtotal]) || 0;
          break;
        case 'total':
          aValue = parseFloat(a[columnIndices.total]) || 0;
          bValue = parseFloat(b[columnIndices.total]) || 0;
          break;
        case 'pending':
          aValue = parseFloat(a[columnIndices.pending]) || 0;
          bValue = parseFloat(b[columnIndices.pending]) || 0;
          break;
        default:
          aValue = a[key];
          bValue = b[key];
      }
      
      // Manejar valores nulos o undefined
      if (!aValue && aValue !== 0) aValue = '';
      if (!bValue && bValue !== 0) bValue = '';
      
      // Comparación
      if (aValue < bValue) return direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return direction === 'asc' ? 1 : -1;
      return 0;
    });
  };

  // Extraer proveedores únicos
  const uniqueProviders = useMemo(() => {
    if (!columnIndices.provider || currentData.length === 0) return [];
    const providers = new Set();
    currentData.forEach(row => {
      if (row[columnIndices.provider]) providers.add(row[columnIndices.provider]);
    });
    return Array.from(providers).sort();
  }, [currentData, columnIndices.provider]);

  // Calcular estadísticas por proveedor
  const providerStats = useMemo(() => {
    if (!columnIndices.provider || !columnIndices.total) return [];
    
    const stats = {};
    currentData.forEach(row => {
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
  }, [currentData, columnIndices]);

  // Calcular totales por canal según el dataset
  const channelStats = useMemo(() => {
    if (!columnIndices.description && !columnIndices.account) return {};
    
    let channels;
    if (selectedDataset === 'solucions') {
      channels = {
        'Estructura': { total: 0, count: 0 },
        'Catering': { total: 0, count: 0 },
        'IDONI': { total: 0, count: 0 },
        'Otros': { total: 0, count: 0 }
      };
    } else if (selectedDataset === 'menjar') {
      channels = {
        'OBRADOR': { total: 0, count: 0 },
        'ESTRUCTURA': { total: 0, count: 0 },
        'CATERING': { total: 0, count: 0 },
        'Otros': { total: 0, count: 0 }
      };
    } else {
      return {};
    }
    
    currentData.forEach(row => {
      const description = (row[columnIndices.description] || '').toLowerCase();
      const account = (row[columnIndices.account] || '').toLowerCase();
      const total = columnIndices.total ? (parseFloat(row[columnIndices.total]) || 0) : 0;
      
      // Buscar en descripción primero, si no encuentra nada, buscar en cuenta
      let channel = 'Otros';
      
      if (selectedDataset === 'solucions') {
        if (description.includes('estructura') || account.includes('estructura')) {
          channel = 'Estructura';
        } else if (description.includes('catering') || account.includes('catering')) {
          channel = 'Catering';
        } else if (description.includes('idoni') || account.includes('idoni')) {
          channel = 'IDONI';
        }
      } else if (selectedDataset === 'menjar') {
        if (description.includes('obrador') || account.includes('obrador')) {
          channel = 'OBRADOR';
        } else if (description.includes('estructura') || account.includes('estructura')) {
          channel = 'ESTRUCTURA';
        } else if (description.includes('catering') || account.includes('catering')) {
          channel = 'CATERING';
        }
      }
      
      channels[channel].total += total;
      channels[channel].count += 1;
    });
    
    return channels;
  }, [currentData, columnIndices, selectedDataset]);

  // Filtrar y ordenar datos según vista seleccionada
  const filteredData = useMemo(() => {
    let data = currentData;
    if (selectedProvider && columnIndices.provider) {
      data = currentData.filter(row => row[columnIndices.provider] === selectedProvider);
    }
    
    // Aplicar ordenamiento si hay configuración
    if (sortConfig.key) {
      data = sortData(data, sortConfig.key, sortConfig.direction);
    }
    
    return data;
  }, [currentData, selectedProvider, columnIndices.provider, sortConfig]);

  // Filtrar datos por canal seleccionado
  const channelFilteredData = useMemo(() => {
    if (!selectedChannel || !columnIndices.description || !columnIndices.account) return [];
    
    return currentData.filter(row => {
      const description = (row[columnIndices.description] || '').toLowerCase();
      const account = (row[columnIndices.account] || '').toLowerCase();
      
      if (selectedDataset === 'solucions') {
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
      } else if (selectedDataset === 'menjar') {
        switch (selectedChannel) {
          case 'OBRADOR':
            return description.includes('obrador') || account.includes('obrador');
          case 'ESTRUCTURA':
            return description.includes('estructura') || account.includes('estructura');
          case 'CATERING':
            return description.includes('catering') || account.includes('catering');
          case 'Otros':
            return !description.includes('obrador') && !description.includes('estructura') && 
                   !description.includes('catering') && !account.includes('obrador') &&
                   !account.includes('estructura') && !account.includes('catering');
          default:
            return false;
        }
      }
      return false;
    });
  }, [currentData, selectedChannel, columnIndices, selectedDataset]);

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

  const sergiChannelsText = selectedDataset === 'solucions'
    ? '(Estructura, Catering, IDONI)'
    : '(Obrador, Estructura, Catering)';

  const views = [
    { id: 'general', name: 'Vista General', description: 'Todas las facturas con columnas personalizables' },
    { id: 'sergi', name: 'Vista Sergi', description: `Análisis por canales ${sergiChannelsText}` },
    { id: 'bruno', name: 'Vista Bruno', description: 'Análisis de deudas por proveedor' }
  ];

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

  // --- Unificar lógica de filtrado de facturas por canal ---
  function getChannelRows(channel, data, columnIndices) {
    return data.filter(row => {
      const account = row[columnIndices.account];
      if (!account) return false;
      
      const accountLower = account.toString().toLowerCase();
      return accountLower.includes(channel.toLowerCase());
    });
  }

  // Función para manejar el click en una tarjeta de canal
  const handleChannelClick = (channel) => {
    setSelectedChannel(selectedChannel === channel ? '' : channel);
  };

  // Función para manejar la expansión de proveedores
  const handleProviderExpand = (provider) => {
    setExpandedProvider(expandedProvider === provider ? '' : provider);
  };

  // Función para saber si una fila está pendiente de pago
  function isPending(row, columnIndices) {
    const pending = row[columnIndices.pending];
    return pending && parseFloat(pending) > 0;
  }

  // Función para obtener el color del canal
  function getChannelColor(channel) {
    const colors = {
      'solucions': '#4CAF50',
      'menjar': '#FF6B35',
      'default': '#2196F3'
    };
    return colors[channel.toLowerCase()] || colors.default;
  }

  // Función para obtener colores de filas intercaladas
  function getRowBackgroundColor(index) {
    return index % 2 === 0 ? colors.surface : colors.card;
  }

  // Componente para header ordenable
  const SortableHeader = ({ label, sortKey, currentSortKey, currentDirection, onSort }) => {
    const isActive = currentSortKey === sortKey;
    return (
      <th 
        style={{ 
          borderBottom: `1px solid ${colors.border}`, 
          padding: '12px 8px', 
          textAlign: 'left', 
          color: colors.primary, 
          fontWeight: 600, 
          background: colors.surface,
          cursor: 'pointer',
          userSelect: 'none',
          transition: 'all 0.2s ease'
        }}
        onClick={() => onSort(sortKey)}
        onMouseEnter={(e) => {
          e.target.style.background = colors.hover;
        }}
        onMouseLeave={(e) => {
          e.target.style.background = colors.surface;
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {label}
          <span style={{ 
            fontSize: '12px', 
            fontWeight: 'bold',
            opacity: isActive ? 1 : 0.6,
            color: isActive ? colors.primary : colors.textSecondary,
            transition: 'all 0.2s ease',
            display: 'inline-block',
            minWidth: '12px',
            textAlign: 'center'
          }}>
            {isActive ? (currentDirection === 'asc' ? '↑' : '↓') : '↕'}
          </span>
        </div>
      </th>
    );
  };

  // Calcular total facturado y total a pagar (solo pendientes o vencidas)
  const totalFacturado = useMemo(() => {
    if (!columnIndices.total) return 0;
    return currentData.reduce((sum, row) => {
      const total = parseFloat(row[columnIndices.total]) || 0;
      return sum + total;
    }, 0);
  }, [currentData, columnIndices]);

  const totalAPagar = useMemo(() => {
    if (!columnIndices.total || columnIndices.estat === undefined) return 0;
    return currentData.reduce((sum, row) => {
      if (isPending(row, columnIndices)) {
        const total = parseFloat(row[columnIndices.total]) || 0;
        return sum + total;
      }
      return sum;
    }, 0);
  }, [currentData, columnIndices]);

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

      {/* Selector de Dataset */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        style={{
          marginBottom: '28px',
        }}
      >
        <h3 style={{ 
          margin: '0 0 20px 0', 
          color: colors.text, 
          fontSize: '20px', 
          fontWeight: '600' 
        }}>
          Seleccionar Dataset
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
            {/* Indicador de carga para Solucions */}
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
              {supabaseData.solucions.data.length > 0 ? `${supabaseData.solucions.data.length} facturas cargadas` : 'No hay datos cargados'}
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
              cursor: isChangingDataset ? 'not-allowed' : 'pointer',
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
              opacity: isChangingDataset ? 0.6 : 1
            }}
          >
            {/* Indicador de carga para Menjar */}
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
              Menjar d'Hort
            </span>
            <span style={{ 
              fontSize: 13, 
              color: selectedDataset === 'menjar' ? colors.primary : colors.textSecondary, 
              marginTop: 2 
            }}>
              {supabaseData.menjar.data.length > 0 ? `${supabaseData.menjar.data.length} facturas cargadas` : 'No hay datos cargados'}
            </span>
          </motion.div>
        </div>
      </motion.div>

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

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
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
        ) : error ? (
          <motion.div
            key="error"
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
        ) : currentHeaders.length === 0 ? (
          <motion.div
            key="no-data"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={{ color: colors.textSecondary, fontSize: 18, marginTop: 40 }}
          >
            No hay datos importados para {selectedDataset === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort'}. Por favor, importa un archivo Excel en la sección correspondiente.
          </motion.div>
        ) : (
          <motion.div
            key={`content-${selectedDataset}`}
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
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
                
                <div style={{
                  fontSize: '16px',
                  color: colors.textSecondary,
                  margin: '32px 0 12px 0',
                  fontWeight: 500
                }}>
                  Análisis por canales <span style={{ color: colors.primary }}>{sergiChannelsText}</span>
                </div>

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
                    const channelRows = getChannelRows(channel, currentData, columnIndices);
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
                              <SortableHeader
                                label={currentHeaders[columnIndices.date] || 'Fecha'}
                                sortKey="date"
                                currentSortKey={channelSortConfig.key}
                                currentDirection={channelSortConfig.direction}
                                onSort={handleChannelSort}
                              />
                              <SortableHeader
                                label={currentHeaders[columnIndices.invoiceNumber] || 'Número'}
                                sortKey="invoiceNumber"
                                currentSortKey={channelSortConfig.key}
                                currentDirection={channelSortConfig.direction}
                                onSort={handleChannelSort}
                              />
                              <SortableHeader
                                label={currentHeaders[columnIndices.provider] || 'Proveedor'}
                                sortKey="provider"
                                currentSortKey={channelSortConfig.key}
                                currentDirection={channelSortConfig.direction}
                                onSort={handleChannelSort}
                              />
                              <SortableHeader
                                label={currentHeaders[columnIndices.description] || 'Descripción'}
                                sortKey="description"
                                currentSortKey={channelSortConfig.key}
                                currentDirection={channelSortConfig.direction}
                                onSort={handleChannelSort}
                              />
                              <SortableHeader
                                label={currentHeaders[columnIndices.account] || 'Cuenta'}
                                sortKey="account"
                                currentSortKey={channelSortConfig.key}
                                currentDirection={channelSortConfig.direction}
                                onSort={handleChannelSort}
                              />
                              <SortableHeader
                                label={currentHeaders[columnIndices.total] || 'Total'}
                                sortKey="total"
                                currentSortKey={channelSortConfig.key}
                                currentDirection={channelSortConfig.direction}
                                onSort={handleChannelSort}
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              // Aplicar ordenamiento si hay configuración
                              const sortedData = channelSortConfig.key ? 
                                sortChannelData(channelFilteredData, channelSortConfig.key, channelSortConfig.direction) : 
                                channelFilteredData;
                              
                              return sortedData.map((row, i) => (
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
                            ));
                          })()}
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
                          {currentData.length} facturas encontradas
                        </span>
                      </div>
                      <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                          <thead>
                            <tr>
                              <SortableHeader
                                label="Descripción"
                                sortKey="description"
                                currentSortKey={sergiSortConfig.key}
                                currentDirection={sergiSortConfig.direction}
                                onSort={handleSergiSort}
                              />
                              <SortableHeader
                                label="Canal"
                                sortKey="channel"
                                currentSortKey={sergiSortConfig.key}
                                currentDirection={sergiSortConfig.direction}
                                onSort={handleSergiSort}
                              />
                              <SortableHeader
                                label="Total"
                                sortKey="total"
                                currentSortKey={sergiSortConfig.key}
                                currentDirection={sergiSortConfig.direction}
                                onSort={handleSergiSort}
                              />
                              <SortableHeader
                                label="Facturas"
                                sortKey="count"
                                currentSortKey={sergiSortConfig.key}
                                currentDirection={sergiSortConfig.direction}
                                onSort={handleSergiSort}
                              />
                            </tr>
                          </thead>
                          <tbody>
                            {(() => {
                              const groupedData = currentData.reduce((acc, row) => {
                                const description = row[columnIndices.description] || 'Sin descripción';
                                const account = row[columnIndices.account] || 'Sin cuenta';
                                const total = columnIndices.total ? (parseFloat(row[columnIndices.total]) || 0) : 0;
                                const descLower = description.toLowerCase();
                                const accountLower = account.toLowerCase();
                                
                                let channel = 'Otros';
                                if (selectedDataset === 'solucions') {
                                  if (descLower.includes('estructura') || accountLower.includes('estructura')) channel = 'Estructura';
                                  else if (descLower.includes('catering') || accountLower.includes('catering')) channel = 'Catering';
                                  else if (descLower.includes('idoni') || accountLower.includes('idoni')) channel = 'IDONI';
                                } else if (selectedDataset === 'menjar') {
                                  if (descLower.includes('obrador') || accountLower.includes('obrador')) channel = 'OBRADOR';
                                  else if (descLower.includes('estructura') || accountLower.includes('estructura')) channel = 'ESTRUCTURA';
                                  else if (descLower.includes('catering') || accountLower.includes('catering')) channel = 'CATERING';
                                }
                                
                                // Usar descripción como clave, pero mostrar cuenta si la descripción está vacía
                                const displayKey = description === 'Sin descripción' ? account : description;
                                
                                if (!acc[displayKey]) acc[displayKey] = { total: 0, count: 0, channel, description, account };
                                acc[displayKey].total += total;
                                acc[displayKey].count += 1;
                                return acc;
                              }, {});
                              
                              const entries = Object.entries(groupedData);
                              // Aplicar ordenamiento si hay configuración
                              const sortedEntries = sergiSortConfig.key ? 
                                sortSergiData(entries, sergiSortConfig.key, sergiSortConfig.direction) : 
                                entries.sort((a, b) => b[1].total - a[1].total);
                              
                              return sortedEntries.map(([displayKey, stats], i) => {
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
                              });
                            })()}
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
                        {providerStats.map((stat, i) => {
                          const isExpanded = expandedProvider === stat.provider;
                          return (
                            <Fragment key={stat.provider}>
                              <tr 
                                style={{ 
                                  background: getRowBackgroundColor(i),
                                  transition: 'background-color 0.2s ease',
                                  cursor: 'pointer'
                                }}
                                onClick={() => handleProviderExpand(stat.provider)}
                              >
                                <td style={{ 
                                  borderBottom: `1px solid ${colors.border}`, 
                                  padding: '12px 8px', 
                                  color: colors.text, 
                                  fontWeight: '500',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <span style={{ 
                                    fontSize: '12px', 
                                    transition: 'transform 0.2s ease',
                                    transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
                                  }}>
                                    ▶
                                  </span>
                                  {stat.provider}
                                </td>
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
                              
                              {/* Filas expandidas con facturas individuales */}
                              <AnimatePresence>
                                {isExpanded && (
                                  <tr>
                                    <td colSpan="4" style={{ padding: 0, border: 'none' }}>
                                      <motion.div
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        transition={{ duration: 0.3, ease: 'easeOut' }}
                                        style={{
                                          background: colors.surface,
                                          borderBottom: `1px solid ${colors.border}`,
                                          overflow: 'hidden'
                                        }}
                                      >
                                      <div style={{ padding: '16px 20px' }}>
                                        <h5 style={{ 
                                          margin: '0 0 12px 0', 
                                          color: colors.text, 
                                          fontSize: '14px', 
                                          fontWeight: 600 
                                        }}>
                                          Facturas de {stat.provider}
                                        </h5>
                                        <div style={{ overflowX: 'auto' }}>
                                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                                            <thead>
                                              <tr>
                                                <th style={{ 
                                                  borderBottom: `1px solid ${colors.border}`, 
                                                  padding: '8px 12px', 
                                                  textAlign: 'left', 
                                                  color: colors.primary, 
                                                  fontWeight: 600, 
                                                  background: colors.card,
                                                  fontSize: '12px'
                                                }}>
                                                  Número Factura
                                                </th>
                                                <th style={{ 
                                                  borderBottom: `1px solid ${colors.border}`, 
                                                  padding: '8px 12px', 
                                                  textAlign: 'left', 
                                                  color: colors.primary, 
                                                  fontWeight: 600, 
                                                  background: colors.card,
                                                  fontSize: '12px'
                                                }}>
                                                  Fecha
                                                </th>
                                                <th style={{ 
                                                  borderBottom: `1px solid ${colors.border}`, 
                                                  padding: '8px 12px', 
                                                  textAlign: 'left', 
                                                  color: colors.primary, 
                                                  fontWeight: 600, 
                                                  background: colors.card,
                                                  fontSize: '12px'
                                                }}>
                                                  Descripción
                                                </th>
                                                <th style={{ 
                                                  borderBottom: `1px solid ${colors.border}`, 
                                                  padding: '8px 12px', 
                                                  textAlign: 'left', 
                                                  color: colors.primary, 
                                                  fontWeight: 600, 
                                                  background: colors.card,
                                                  fontSize: '12px'
                                                }}>
                                                  Total
                                                </th>
                                                <th style={{ 
                                                  borderBottom: `1px solid ${colors.border}`, 
                                                  padding: '8px 12px', 
                                                  textAlign: 'left', 
                                                  color: colors.primary, 
                                                  fontWeight: 600, 
                                                  background: colors.card,
                                                  fontSize: '12px'
                                                }}>
                                                  Estado
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {stat.invoices.map((invoice, j) => (
                                                <tr key={j} style={{ 
                                                  background: j % 2 === 0 ? colors.card : colors.surface,
                                                  transition: 'background-color 0.2s ease'
                                                }}>
                                                  <td style={{ 
                                                    borderBottom: `1px solid ${colors.border}`, 
                                                    padding: '8px 12px', 
                                                    color: colors.text,
                                                    fontSize: '12px',
                                                    fontWeight: '500'
                                                  }}>
                                                    {invoice[columnIndices.invoiceNumber] || '-'}
                                                  </td>
                                                  <td style={{ 
                                                    borderBottom: `1px solid ${colors.border}`, 
                                                    padding: '8px 12px', 
                                                    color: colors.text,
                                                    fontSize: '12px'
                                                  }}>
                                                    {invoice[columnIndices.date] ? excelDateToString(invoice[columnIndices.date]) : '-'}
                                                  </td>
                                                  <td style={{ 
                                                    borderBottom: `1px solid ${colors.border}`, 
                                                    padding: '8px 12px', 
                                                    color: colors.text,
                                                    fontSize: '12px'
                                                  }}>
                                                    {invoice[columnIndices.description] || '-'}
                                                  </td>
                                                  <td style={{ 
                                                    borderBottom: `1px solid ${colors.border}`, 
                                                    padding: '8px 12px', 
                                                    color: colors.text,
                                                    fontSize: '12px',
                                                    fontWeight: '600'
                                                  }}>
                                                    {invoice[columnIndices.total] ? formatCurrency(invoice[columnIndices.total]) : '-'}
                                                  </td>
                                                  <td style={{ 
                                                    borderBottom: `1px solid ${colors.border}`, 
                                                    padding: '8px 12px', 
                                                    color: colors.text,
                                                    fontSize: '12px'
                                                  }}>
                                                    <span style={{
                                                      padding: '2px 6px',
                                                      borderRadius: '3px',
                                                      fontSize: '11px',
                                                      background: isPending(invoice, columnIndices) ? 
                                                        colors.error + '22' : colors.success + '22',
                                                      color: isPending(invoice, columnIndices) ? 
                                                        colors.error : colors.success,
                                                      fontWeight: '500'
                                                    }}>
                                                      {isPending(invoice, columnIndices) ? 'Pendiente' : 'Pagada'}
                                                    </span>
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </motion.div>
                                  </td>
                                </tr>
                              )}
                              </AnimatePresence>
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.div>
      )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnalyticsPage; 