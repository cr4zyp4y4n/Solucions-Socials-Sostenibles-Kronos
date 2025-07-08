import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { 
  Upload, 
  Users, 
  BarChart2, 
  FileText,
  TrendingUp,
  DollarSign,
  Check,
  X
} from 'feather-icons-react';
import { useDataContext } from './DataContext';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';

const EXPECTED_HEADERS = [
  "Data d'emissió", 'Núm', 'Núm. Intern', 'Data comptable', 'Venciment', 'Proveïdor',
  'Descripció', 'Tags', 'Compte', 'Projecte', 'Subtotal', 'IVA', 'Retención', 'Empleados',
  'Rec. de eq.', 'Total', 'Pagat', 'Pendents', 'Estat', 'Data de pagament'
];

// Componente de alerta personalizado
const CustomAlert = ({ isVisible, message, type = 'success', onClose }) => {
  const { colors } = useTheme();
  if (!isVisible) return null;

  const alertStyles = {
    success: {
      backgroundColor: colors.success + '22',
      borderColor: colors.success,
      iconColor: colors.success,
      textColor: colors.text
    },
    error: {
      backgroundColor: colors.error + '22',
      borderColor: colors.error,
      iconColor: colors.error,
      textColor: colors.text
    }
  };

  const style = alertStyles[type];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -50, scale: 0.9 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          backgroundColor: style.backgroundColor,
          border: `1px solid ${style.borderColor}`,
          borderRadius: '12px',
          padding: '16px 20px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          maxWidth: '400px',
          minWidth: '300px'
        }}
      >
        <div style={{
          width: '24px',
          height: '24px',
          borderRadius: '50%',
          backgroundColor: style.iconColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0
        }}>
          {type === 'success' ? (
            <Check size={14} color="white" />
          ) : (
            <X size={14} color="white" />
          )}
        </div>
        <div style={{
          flex: 1,
          fontSize: '15px',
          fontWeight: '500',
          color: style.textColor,
          lineHeight: '1.4'
        }}>
          {message}
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            color: style.textColor,
            opacity: 0.7,
            transition: 'opacity 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '1'}
          onMouseLeave={(e) => e.target.style.opacity = '0.7'}
        >
          <X size={16} />
        </button>
      </motion.div>
    </AnimatePresence>
  );
};

const HomePage = () => {
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');
  const fileInputRef = useRef();
  const { excelHeaders, setExcelHeaders, excelData, setExcelData } = useDataContext();
  const { colors } = useTheme();
  const { formatCurrency } = useCurrency();

  // Función para mostrar alerta
  const showAlert = (message, type = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
    setTimeout(() => setAlertVisible(false), 4000);
  };

  // Encuentra la fila que más se parece a las cabeceras esperadas
  function findBestHeaderRow(rows) {
    let bestIdx = 0;
    let bestScore = 0;
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] || [];
      let score = 0;
      for (const expected of EXPECTED_HEADERS) {
        if (row.some(cell => typeof cell === 'string' && cell.trim().toLowerCase() === expected.trim().toLowerCase())) {
          score++;
        }
      }
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  // Función para filtrar filas vacías o irrelevantes
  function isValidRow(row, headers) {
    // Índices de campos clave
    const idxProveedor = headers.findIndex(h => h.toLowerCase().includes('proveïdor') || h.toLowerCase().includes('proveedor'));
    const idxNum = headers.findIndex(h => h.toLowerCase().includes('núm') || h.toLowerCase().includes('num'));
    const idxTotal = headers.findIndex(h => h.toLowerCase().includes('total'));
    const idxDesc = headers.findIndex(h => h.toLowerCase().includes('descripció') || h.toLowerCase().includes('descripcion'));
    // Si todos los campos clave están vacíos, guiones o espacios, es inválida
    const campos = [idxProveedor, idxNum, idxTotal, idxDesc].map(idx => idx >= 0 ? (row[idx] || '').toString().trim() : '');
    const vacios = campos.every(val => val === '' || val === '-' || val === '--');
    if (vacios) return false;
    // Si la descripción contiene mensaje automático, es inválida
    const desc = idxDesc >= 0 ? (row[idxDesc] || '').toLowerCase() : '';
    if (desc.includes('informe generat automàticament per holded') || desc.includes('informe generado automáticamente por holded')) return false;
    return true;
  }

  // Función para manejar la importación de archivos
  const handleFileImport = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        const bestHeaderIdx = findBestHeaderRow(json);
        const headers = json[bestHeaderIdx] || [];
        // Filtrar filas válidas
        const rawRows = json.slice(bestHeaderIdx + 1);
        const filteredRows = rawRows.filter(row => isValidRow(row, headers));
        setExcelHeaders(headers);
        setExcelData(filteredRows);
        const rowCount = filteredRows.length;
        showAlert(`Excel cargado correctamente. Se importaron ${rowCount} filas de datos.`, 'success');
      } catch (error) {
        showAlert('Error al procesar el archivo Excel. Asegúrate de que el formato sea correcto.', 'error');
      }
    };
    reader.onerror = () => {
      showAlert('Error al leer el archivo. Inténtalo de nuevo.', 'error');
    };
    reader.readAsArrayBuffer(file);
  };

  // Función para manejar la selección de archivo
  const handleFileSelect = () => {
    fileInputRef.current.click();
  };

  // Función para manejar el cambio de archivo
  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        handleFileImport(file);
      } else {
        showAlert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
      }
    }
  };

  // Funciones para los otros botones
  const handleViewProviders = () => {
    if (excelData.length === 0) {
      showAlert('Primero debes importar un archivo Excel para ver los proveedores.', 'error');
      return;
    }
    // Aquí podrías navegar a la página de proveedores o mostrar un modal
    showAlert('Redirigiendo a la sección de proveedores...', 'success');
  };

  const handleViewAnalytics = () => {
    if (excelData.length === 0) {
      showAlert('Primero debes importar un archivo Excel para ver los análisis.', 'error');
      return;
    }
    // Aquí podrías navegar a la página de análisis o mostrar un modal
    showAlert('Redirigiendo a la sección de análisis...', 'success');
  };

  // Calcular estadísticas reales
  const calculateStats = () => {
    if (excelData.length === 0) {
      return [
        { icon: Users, label: 'Total Proveedores', value: '0', color: colors.primary },
        { icon: FileText, label: 'Facturas Procesadas', value: '0', color: '#2196F3' },
        { icon: DollarSign, label: 'Total a Pagar', value: '€0', color: colors.warning },
        { icon: TrendingUp, label: 'Promedio por Factura', value: '€0', color: '#9C27B0' },
      ];
    }

    const providerIndex = excelHeaders.findIndex(h => h === 'Proveïdor');
    const totalIndex = excelHeaders.findIndex(h => h === 'Total');
    
    const providers = new Set();
    let totalAmount = 0;
    let validRows = 0;

    excelData.forEach(row => {
      if (row[providerIndex]) {
        providers.add(row[providerIndex]);
      }
      if (row[totalIndex] && !isNaN(parseFloat(row[totalIndex]))) {
        totalAmount += parseFloat(row[totalIndex]);
        validRows++;
      }
    });

    const averageAmount = validRows > 0 ? totalAmount / validRows : 0;

    return [
      { 
        icon: Users, 
        label: 'Total Proveedores', 
        value: providers.size.toString(), 
        color: colors.primary 
      },
      { 
        icon: FileText, 
        label: 'Facturas Procesadas', 
        value: excelData.length.toString(), 
        color: '#2196F3' 
      },
      { 
        icon: DollarSign, 
        label: 'Total a Pagar', 
        value: formatCurrency(totalAmount), 
        color: colors.warning 
      },
      { 
        icon: TrendingUp, 
        label: 'Promedio por Factura', 
        value: formatCurrency(averageAmount), 
        color: '#9C27B0' 
      },
    ];
  };

  const stats = calculateStats();

  const quickActions = [
    {
      icon: Upload,
      title: 'Importar Excel',
      description: 'Cargar archivo de proveedores desde Holded',
      color: '#4CAF50',
      onClick: handleFileSelect
    },
    {
      icon: Users,
      title: 'Ver Proveedores',
      description: 'Explorar y gestionar proveedores',
      color: '#2196F3',
      onClick: handleViewProviders
    },
    {
      icon: BarChart2,
      title: 'Análisis',
      description: 'Ver estadísticas y reportes',
      color: '#FF9800',
      onClick: handleViewAnalytics
    }
  ];

  return (
    <div style={{ width: '100%' }}>
      {/* Input oculto para archivos */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Alerta personalizada */}
      <CustomAlert
        isVisible={alertVisible}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />

      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          marginBottom: '50px',
        }}
      >
        <h2 style={{
          fontSize: '32px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 15px 0',
        }}>
          Bienvenido a Selección de Proveedores
        </h2>
        <p style={{
          fontSize: '18px',
          color: colors.textSecondary,
          margin: 0,
          lineHeight: '1.6',
        }}>
          Gestiona y analiza los datos de proveedores de manera eficiente
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '25px',
          marginBottom: '50px',
        }}
      >
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              whileHover={{ y: -3, scale: 1.02 }}
              style={{
                backgroundColor: colors.card,
                padding: '32px',
                borderRadius: '12px',
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                boxShadow: isDarkMode => isDarkMode ? '0 2px 8px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
              }}
            >
              <div style={{
                width: '60px',
                height: '60px',
                borderRadius: '12px',
                backgroundColor: stat.color + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Icon size={28} color={stat.color} />
              </div>
              <div>
                <div style={{
                  fontSize: '32px',
                  fontWeight: '700',
                  color: colors.text,
                  marginBottom: '6px',
                }}>
                  {stat.value}
                </div>
                <div style={{
                  fontSize: '16px',
                  color: colors.textSecondary,
                  fontWeight: '500',
                }}>
                  {stat.label}
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
      >
        <h3 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 30px 0',
        }}>
          Acciones Rápidas
        </h3>
        
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '25px',
        }}>
          {quickActions.map((action, index) => {
            const Icon = action.icon;
            return (
              <motion.div
                key={action.title}
                whileHover={{ y: -3, scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                style={{
                  backgroundColor: colors.card,
                  padding: '32px',
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  boxShadow: isDarkMode => isDarkMode ? '0 2px 8px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
                }}
                onClick={action.onClick}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '20px',
                  marginBottom: '16px',
                }}>
                  <div style={{
                    width: '50px',
                    height: '50px',
                    borderRadius: '10px',
                    backgroundColor: action.color + '15',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <Icon size={24} color={action.color} />
                  </div>
                  <h4 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: colors.text,
                    margin: 0,
                  }}>
                    {action.title}
                  </h4>
                </div>
                <p style={{
                  fontSize: '16px',
                  color: colors.textSecondary,
                  margin: 0,
                  lineHeight: '1.5',
                }}>
                  {action.description}
                </p>
              </motion.div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default HomePage; 