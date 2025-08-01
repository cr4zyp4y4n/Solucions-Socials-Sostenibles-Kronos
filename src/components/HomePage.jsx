import React, { useRef, useState, useEffect } from 'react';
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
  X,
  Loader,
  RefreshCw,
  Download
} from 'feather-icons-react';
import { useDataContext } from './DataContext';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { supabase } from '../config/supabase';
import holdedApi from '../services/holdedApi';

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
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef();
  const menjarFileInputRef = useRef();
  const { 
    solucionsHeaders, setSolucionsHeaders, solucionsData, setSolucionsData,
    menjarHeaders, setMenjarHeaders, menjarData, setMenjarData,
    setShouldReloadHolded,
    holdedCache,
    isCacheValid,
    getCachedData,
    updateCache,
    setLoading,
    clearCache,
    CACHE_DURATION,
    needsUpdate,
    markTabUpdated
  } = useDataContext();
  const { colors } = useTheme();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { navigateTo } = useNavigation();

  // Estado para datos cargados desde Supabase
  const [supabaseData, setSupabaseData] = useState({
    solucions: { headers: [], data: [] },
    menjar: { headers: [], data: [] }
  });
  const [loadingData, setLoadingData] = useState(true);

  // Cargar datos desde Holded al montar el componente
  useEffect(() => {
    loadDataFromHolded();
  }, []);

  // Verificar si necesita actualización cuando se monta el componente
  useEffect(() => {
    if (needsUpdate('home')) {
      loadDataFromHolded();
      markTabUpdated('home');
    }
  }, []);

  // Función para cargar datos desde Holded con caché
  const loadDataFromHolded = async () => {
    setLoadingData(true);
    
    try {
      // Verificar si tenemos datos en caché válidos
      const cachedSolucions = getCachedData('solucions');
      const cachedMenjar = getCachedData('menjar');
      
      let solucionsPurchases = cachedSolucions;
      let menjarPurchases = cachedMenjar;
      
      // Array de promesas para cargar datos que no están en caché
      const loadPromises = [];
      
      // Cargar datos de Solucions si no están en caché
      if (!cachedSolucions) {
        setLoading('solucions', true);
        loadPromises.push(
          holdedApi.getAllPendingAndOverduePurchases('solucions')
            .then(data => {
              updateCache('solucions', data);
              return data;
            })
            .catch(error => {
              console.error('Error cargando datos de Solucions:', error);
              setLoading('solucions', false);
              return [];
            })
        );
      }
      
      // Cargar datos de Menjar si no están en caché
      if (!cachedMenjar) {
        setLoading('menjar', true);
        loadPromises.push(
          holdedApi.getAllPendingAndOverduePurchases('menjar')
            .then(data => {
              updateCache('menjar', data);
              return data;
            })
            .catch(error => {
              console.error('Error cargando datos de Menjar:', error);
              setLoading('menjar', false);
              return [];
            })
        );
      }
      
      // Si hay datos para cargar, esperar a que se completen
      if (loadPromises.length > 0) {
        const [newSolucions, newMenjar] = await Promise.all(loadPromises);
        if (!cachedSolucions) solucionsPurchases = newSolucions;
        if (!cachedMenjar) menjarPurchases = newMenjar;
      }
      
      // Procesar datos de cada empresa
      const processedSolucions = processHoldedPurchases(solucionsPurchases || []);
      const processedMenjar = processHoldedPurchases(menjarPurchases || []);

      // Actualizar el estado con datos separados
      setSupabaseData({
        solucions: {
          headers: processedSolucions.headers,
          data: processedSolucions.data
        },
        menjar: {
          headers: processedMenjar.headers,
          data: processedMenjar.data
        }
      });

    } catch (error) {
      console.error('Error cargando datos de Holded:', error);
    } finally {
      setLoadingData(false);
    }
  };

  // Función para procesar compras de Holded
  const processHoldedPurchases = (holdedPurchases) => {
    if (holdedPurchases.length === 0) {
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

    // Mapeo de campos de Holded a las columnas del Excel
    const holdedToExcelMapping = {
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

    // Convertir datos de Holded a formato de array
    const processedData = holdedPurchases.map(purchase => {
      const row = [];
      expectedHeaders.forEach(header => {
        // Encontrar la columna correspondiente en los datos de Holded
        const holdedField = Object.keys(holdedToExcelMapping).find(key => holdedToExcelMapping[key] === header);
        if (holdedField && purchase[holdedField] !== undefined && purchase[holdedField] !== null) {
          row.push(purchase[holdedField]);
        } else {
          row.push(null);
        }
      });
      return row;
    });

    return { headers: expectedHeaders, data: processedData };
  };



  // Función para mostrar alerta
  const showAlert = (message, type = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
    setTimeout(() => setAlertVisible(false), 4000);
  };

  // FUNCIÓN DE SUBIDA DE ARCHIVOS COMENTADA - FUNCIONALIDAD DE EXCEL DESHABILITADA
  /*
  const uploadFileToStorage = async (file, type) => {
    try {
      const timestamp = new Date().getTime();
      const fileName = `${type}_${timestamp}_${file.name}`;
      const filePath = `excels/${fileName}`;

      const { data, error } = await supabase.storage
        .from('excels')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw new Error(`Error al subir archivo: ${error.message}`);
      }

      return { 
        filePath, 
        fileName,
        size: file.size // Incluir el tamaño del archivo
      };
    } catch (error) {
      throw error;
    }
  };
  */

  // FUNCIÓN DE METADATOS COMENTADA - FUNCIONALIDAD DE EXCEL DESHABILITADA
  /*
  const saveUploadMetadata = async (fileInfo, type, headers, dataCount) => {
    try {
      const { data, error } = await supabase
        .from('excel_uploads')
        .insert({
          filename: fileInfo.fileName,
          size: fileInfo.size || 0, // Tamaño del archivo en bytes
          type: type, // 'solucions' o 'menjar'
          file_path: fileInfo.filePath,
          upload_type: type, // Mantener compatibilidad
          data_count: dataCount,
          metadata: {
            headers: headers
          },
          uploaded_by: user.id,
          uploaded_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Error al guardar metadatos: ${error.message}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  };
  */

  // FUNCIÓN DE PROCESAMIENTO DE DATOS COMENTADA - FUNCIONALIDAD DE EXCEL DESHABILITADA
  /*
  const saveProcessedData = async (data, uploadId, uploadType) => {
    try {
      // PASO 1: Eliminar datos anteriores del mismo tipo
      
      // Obtener todos los uploads del mismo tipo
      const { data: existingUploads, error: uploadsError } = await supabase
        .from('excel_uploads')
        .select('id')
        .eq('upload_type', uploadType)
        .order('uploaded_at', { ascending: false });

      if (uploadsError) {
        throw new Error(`Error al obtener uploads existentes: ${uploadsError.message}`);
      }

      // Si hay uploads anteriores del mismo tipo, eliminar sus datos
      if (existingUploads && existingUploads.length > 0) {
        const uploadIds = existingUploads.map(upload => upload.id);
        
        // Eliminar facturas asociadas a uploads anteriores
        const { error: deleteInvoicesError } = await supabase
          .from('invoices')
          .delete()
          .in('upload_id', uploadIds);

        if (deleteInvoicesError) {
          throw new Error(`Error al eliminar facturas anteriores: ${deleteInvoicesError.message}`);
        }

        // Eliminar los uploads anteriores (excepto el actual)
        const uploadsToDelete = existingUploads.filter(upload => upload.id !== uploadId);
        if (uploadsToDelete.length > 0) {
          const { error: deleteUploadsError } = await supabase
            .from('excel_uploads')
            .delete()
            .in('id', uploadsToDelete.map(u => u.id));

          if (deleteUploadsError) {
            throw new Error(`Error al eliminar uploads anteriores: ${deleteUploadsError.message}`);
          }
        }
      }

      // PASO 2: Insertar los nuevos datos

      // Mapeo de columnas del Excel a las columnas de la tabla invoices
      const columnMapping = {
        "Data d'emissió": 'issue_date',
        'Núm': 'invoice_number',
        'Núm. Intern': 'internal_number',
        'Data comptable': 'accounting_date',
        'Venciment': 'due_date',
        'Proveïdor': 'provider',
        'Descripció': 'description',
        'Tags': 'tags',
        'Compte': 'account',
        'Projecte': 'project',
        'Subtotal': 'subtotal',
        'IVA': 'vat',
        'Retención': 'retention',
        'Empleados': 'employees',
        'Rec. de eq.': 'equipment_recovery',
        'Total': 'total',
        'Pagat': 'paid',
        'Pendents': 'pending',
        'Estat': 'status',
        'Data de pagament': 'payment_date'
      };

      // Headers fijos en el orden correcto
      const headers = [
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

      // Preparar los datos para insertar
      const processedData = data.map(row => {
        const invoiceData = {
          upload_id: uploadId,
          created_by: user.id,
          processed_at: new Date().toISOString()
        };

        // Mapear cada columna del Excel a la columna correspondiente en la base de datos
        headers.forEach((header, index) => {
          const dbColumn = columnMapping[header];
          if (dbColumn && row[index] !== undefined && row[index] !== null && row[index] !== '') {
            const value = row[index];
            
            // Convertir tipos de datos según la columna
            switch (dbColumn) {
              case 'issue_date':
              case 'accounting_date':
              case 'due_date':
              case 'payment_date':
                // Convertir fecha de Excel a formato ISO
                if (typeof value === 'number') {
                  const excelDate = new Date((value - 25569) * 86400 * 1000);
                  invoiceData[dbColumn] = excelDate.toISOString().split('T')[0];
                } else if (typeof value === 'string' && value.trim()) {
                  // Intentar parsear fecha en formato string
                  const parsedDate = new Date(value);
                  if (!isNaN(parsedDate.getTime())) {
                    invoiceData[dbColumn] = parsedDate.toISOString().split('T')[0];
                  }
                }
                break;
              
              case 'subtotal':
              case 'vat':
              case 'retention':
              case 'employees':
              case 'equipment_recovery':
              case 'total':
              case 'pending':
                // Convertir a número
                const numValue = parseFloat(value);
                if (!isNaN(numValue)) {
                  invoiceData[dbColumn] = numValue;
                }
                break;
              
              case 'paid':
                // Convertir a boolean
                if (typeof value === 'string') {
                  const lowerValue = value.toLowerCase();
                  invoiceData[dbColumn] = lowerValue === 'true' || lowerValue === 'sí' || lowerValue === 'si' || lowerValue === '1';
                } else if (typeof value === 'number') {
                  invoiceData[dbColumn] = value === 1;
                } else if (typeof value === 'boolean') {
                  invoiceData[dbColumn] = value;
                }
                break;
              
              default:
                // Para campos de texto, mantener el valor tal como está
                invoiceData[dbColumn] = value.toString().trim();
            }
          }
        });

        return invoiceData;
      });

      const { error } = await supabase
        .from('invoices')
        .insert(processedData);

      if (error) {
        throw new Error(`Error al guardar datos procesados: ${error.message}`);
      }

      return processedData.length;
    } catch (error) {
      throw error;
    }
  };
  */

  // Función para crear notificación para los Jefes
  // FUNCIÓN DE NOTIFICACIONES COMENTADA - FUNCIONALIDAD DE EXCEL DESHABILITADA
  /*
  const createNotificationForManagers = async (uploadInfo, type) => {
    try {
        // Obtener usuarios con roles de directiva y admin
  const { data: managers, error: managersError } = await supabase
    .from('user_profiles')
    .select('id')
    .in('role', ['directiva', 'admin'])
        .neq('id', user.id); // No notificar al creador

      if (managersError) {
        return;
      }

          if (managers && managers.length > 0) {
      // Crear notificaciones para cada directiva/admin
      const notifications = managers.map(manager => ({
        recipient_id: manager.id,
          sender_id: user.id,
          type: 'system', // Usar 'system' que está permitido en el check constraint
          title: `Nuevo archivo Excel subido`,
          message: `Se ha subido un archivo Excel de ${type === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort'} con ${uploadInfo.data_count} registros.`,
          data: {
            upload_type: type,
            upload_id: uploadInfo.id,
            data_count: uploadInfo.data_count
          }
        }));

        const { error } = await supabase
          .from('notifications')
          .insert(notifications);

        if (error) {
          // No lanzar error aquí, es opcional
        }
      }
    } catch (error) {
      // No lanzar error aquí, es opcional
    }
  };
  */

  // FUNCIÓN DE PROCESAMIENTO DE EXCEL COMENTADA - FUNCIONALIDAD DESHABILITADA
  /*
  const processAndUploadExcel = async (file, type) => {
    setUploading(true);
    setUploadProgress(0);

    try {
      // Paso 1: Procesar el archivo Excel
      setUploadProgress(20);
      const processedData = await new Promise((resolve, reject) => {
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
            const rawRows = json.slice(bestHeaderIdx + 1);
            const filteredRows = rawRows.filter(row => isValidRow(row, headers));
            resolve({ headers, data: filteredRows });
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
      });

      setUploadProgress(40);

      // Paso 2: Subir archivo a Storage
      const fileInfo = await uploadFileToStorage(file, type);
      setUploadProgress(60);

      // Paso 3: Guardar metadatos del upload
      const uploadMetadata = await saveUploadMetadata(
        fileInfo, 
        type, 
        processedData.headers,
        processedData.data.length
      );
      setUploadProgress(80);

      // Paso 4: Guardar datos procesados
      await saveProcessedData(processedData.data, uploadMetadata.id, type);
      setUploadProgress(90);

      // Paso 5: Crear notificación para Jefes (si el usuario es de Gestión)
      if (user?.user_metadata?.role === 'management') {
        await createNotificationForManagers(uploadMetadata, type);
      }

      setUploadProgress(100);

      // Recargar datos desde Supabase después de subir
      await loadDataFromSupabase();

      // Actualizar estado local para mantener compatibilidad
      if (type === 'solucions') {
        setSolucionsHeaders(processedData.headers);
        setSolucionsData(processedData.data);
      } else {
        setMenjarHeaders(processedData.headers);
        setMenjarData(processedData.data);
      }

      const typeName = type === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort';
      showAlert(`Excel de ${typeName} subido correctamente. Se importaron ${processedData.data.length} filas de datos.`, 'success');

    } catch (error) {
      showAlert(`Error al procesar y subir el archivo: ${error.message}`, 'error');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };
  */

  // FUNCIONES DE PROCESAMIENTO DE EXCEL COMENTADAS - FUNCIONALIDAD DESHABILITADA
  /*
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
  */

  // FUNCIONES DE MANEJO DE ARCHIVOS EXCEL COMENTADAS - FUNCIONALIDAD DESHABILITADA
  /*
  const handleSolucionsFileImport = (file) => {
    processAndUploadExcel(file, 'solucions');
  };

  const handleMenjarFileImport = (file) => {
    processAndUploadExcel(file, 'menjar');
  };

  const handleSolucionsFileSelect = () => {
    if (uploading) {
      showAlert('Espera a que termine la subida actual.', 'error');
      return;
    }
    fileInputRef.current.click();
  };

  const handleMenjarFileSelect = () => {
    if (uploading) {
      showAlert('Espera a que termine la subida actual.', 'error');
      return;
    }
    menjarFileInputRef.current.click();
  };

  const handleSolucionsFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        handleSolucionsFileImport(file);
      } else {
        showAlert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
      }
    }
  };

  const handleMenjarFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        handleMenjarFileImport(file);
      } else {
        showAlert('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
      }
    }
  };
  */

  // Función para ir a la página de análisis
  const handleViewAnalytics = () => {
    // Navegar a la pestaña de análisis usando el contexto
    navigateTo('analytics');
    showAlert('Redirigiendo a la sección de análisis...', 'success');
  };

  // Calcular estadísticas desde datos de Holded
  const calculateStats = () => {
    // Combinar datos de ambas empresas
    const solucionsData = supabaseData.solucions.data;
    const menjarData = supabaseData.menjar.data;
    const totalData = [...solucionsData, ...menjarData];
    
    if (totalData.length === 0) {
      return [
        { icon: Users, label: 'Total Proveedores', value: '0', color: colors.primary },
        { icon: FileText, label: 'Compras Procesadas', value: '0', color: '#2196F3' },
        { icon: DollarSign, label: 'Total a Pagar', value: '€0', color: colors.warning },
        { icon: TrendingUp, label: 'Promedio por Compra', value: '€0', color: '#9C27B0' },
      ];
    }

    // Usar headers de Holded (ambas empresas tienen la misma estructura)
    const headers = supabaseData.solucions.headers;
    const providerIndex = headers.findIndex(h => h === 'Proveïdor');
    const totalIndex = headers.findIndex(h => h === 'Total');
    
    const providers = new Set();
    let totalAmount = 0;
    let validRows = 0;

    totalData.forEach(row => {
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
        label: 'Compras Procesadas', 
        value: totalData.length.toString(), 
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
        label: 'Promedio por Compra', 
        value: formatCurrency(averageAmount), 
        color: '#9C27B0'
      },
    ];
  };

  const stats = calculateStats();

  // Función para obtener información del estado del caché
  const getCacheInfo = () => {
    const now = Date.now();
    const solucionsCache = holdedCache.solucions;
    const menjarCache = holdedCache.menjar;
    
    const getCacheStatus = (cache) => {
      // Priorizar mostrar estado de carga si está activo
      if (cache.loading) return 'Actualizando datos...';
      
      if (!cache.data) return 'Sin datos';
      if (!cache.timestamp) return 'Sin timestamp';
      
      const age = now - cache.timestamp;
      const ageMinutes = Math.floor(age / 60000);
      
      if (age < CACHE_DURATION) {
        return `Válido (${ageMinutes} min)`;
      } else {
        return `Expirado (${ageMinutes} min)`;
      }
    };

    return {
      solucions: {
        status: getCacheStatus(solucionsCache),
        count: solucionsCache.data ? solucionsCache.data.length : 0,
        loading: solucionsCache.loading
      },
      menjar: {
        status: getCacheStatus(menjarCache),
        count: menjarCache.data ? menjarCache.data.length : 0,
        loading: menjarCache.loading
      }
    };
  };

  const cacheInfo = getCacheInfo();

  // ACCIONES RÁPIDAS COMENTADAS - FUNCIONALIDAD DE EXCEL DESHABILITADA
  /*
  const quickActions = [
    {
      icon: Upload,
      title: 'Importar Excel Solucions',
      description: 'Cargar archivo de proveedores de Solucions Socials',
      color: '#4CAF50',
      onClick: handleSolucionsFileSelect
    },
    {
      icon: Upload,
      title: 'Importar Excel Menjar',
      description: 'Cargar archivo de proveedores de Menjar d\'Hort',
      color: '#FF6B35',
      onClick: handleMenjarFileSelect
    },
    {
      icon: BarChart2,
      title: 'Análisis',
      description: 'Ver estadísticas y reportes',
      color: '#FF9800',
      onClick: handleViewAnalytics
    }
  ];
  */

  return (
    <div style={{ 
      width: '100%',
      padding: '24px',
      backgroundColor: colors.background,
      minHeight: '100%',
      boxSizing: 'border-box'
    }}>
      {/* INPUTS DE ARCHIVOS COMENTADOS - FUNCIONALIDAD DE EXCEL DESHABILITADA */}
      {/*
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleSolucionsFileChange}
      />

      <input
        ref={menjarFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleMenjarFileChange}
      />
      */}

      {/* Alerta personalizada */}
      <CustomAlert
        isVisible={alertVisible}
        message={alertMessage}
        type={alertType}
        onClose={() => setAlertVisible(false)}
      />

      {/* Indicador de progreso de subida */}
      {uploading && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 1001,
            backgroundColor: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: '12px',
            padding: '16px 24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            minWidth: '300px'
          }}
        >
          <Loader size={20} className="animate-spin" color={colors.primary} />
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '15px',
              fontWeight: '600',
              color: colors.text,
              marginBottom: '4px'
            }}>
              Subiendo archivo Excel...
            </div>
            <div style={{
              width: '100%',
              height: '4px',
              backgroundColor: colors.border,
              borderRadius: '2px',
              overflow: 'hidden'
            }}>
              <div style={{
                width: `${uploadProgress}%`,
                height: '100%',
                backgroundColor: colors.primary,
                transition: 'width 0.3s ease'
              }} />
            </div>
          </div>
        </motion.div>
      )}

      {/* Welcome Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          marginBottom: '30px',
        }}
      >
        <h2 style={{
          fontSize: 28,
          fontWeight: 700,
          color: colors.text,
          margin: '0 0 15px 0',
          lineHeight: 1.2
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
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
          marginBottom: '30px',
        }}
      >
        {loadingData ? (
          // Mostrar skeleton loading mientras se cargan los datos
          Array.from({ length: 4 }).map((_, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              style={{
                background: colors.surface,
                borderRadius: '16px',
                padding: '24px',
                border: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                minHeight: '100px',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {/* Skeleton icon */}
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: colors.border,
                animation: 'pulse 1.5s ease-in-out infinite'
              }} />
              
              {/* Skeleton content */}
              <div style={{ flex: 1 }}>
                <div style={{
                  height: '16px',
                  background: colors.border,
                  borderRadius: '4px',
                  marginBottom: '8px',
                  width: '60%',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
                <div style={{
                  height: '24px',
                  background: colors.border,
                  borderRadius: '4px',
                  width: '40%',
                  animation: 'pulse 1.5s ease-in-out infinite'
                }} />
              </div>
            </motion.div>
          ))
        ) : (
          // Mostrar estadísticas reales
          stats.map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: index * 0.1 }}
                whileHover={{ y: -3, scale: 1.02 }}
                style={{
                  backgroundColor: colors.surface,
                  padding: '20px 18px',
                  borderRadius: '16px',
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
                  flex: '1 1 180px',
                  minWidth: '180px',
                  maxWidth: '250px',
                }}
              >
                <div style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: stat.color + '15',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Icon size={24} color={stat.color} />
                </div>
                <div>
                  <div style={{
                    fontSize: '28px',
                    fontWeight: '700',
                    color: colors.text,
                    marginBottom: '4px',
                  }}>
                    {stat.value}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    color: colors.textSecondary,
                    fontWeight: '500',
                  }}>
                    {stat.label}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </motion.div>

      {/* Estado del Caché Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.12 }}
        style={{ marginBottom: '30px' }}
      >
        <h3 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 20px 0',
        }}>
          Estado del Caché
        </h3>
        
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
        }}>
          {/* Estado de Solucions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
            style={{
              backgroundColor: colors.surface,
              padding: '20px 18px',
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              flex: '1 1 180px',
              minWidth: '180px',
              maxWidth: '250px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h4 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                margin: 0,
              }}>
                Solucions Socials
              </h4>
              <div style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: cacheInfo.solucions.loading ? '#FF9800' + '15' : 
                               cacheInfo.solucions.status.includes('Válido') ? '#4CAF50' + '15' : '#F44336' + '15',
                color: cacheInfo.solucions.loading ? '#FF9800' : 
                       cacheInfo.solucions.status.includes('Válido') ? '#4CAF50' : '#F44336',
              }}>
                {cacheInfo.solucions.loading ? 'Cargando...' : cacheInfo.solucions.status}
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: colors.textSecondary,
              lineHeight: '1.5',
            }}>
              <div>Compras en caché: <strong>{cacheInfo.solucions.count}</strong></div>
              <div>Estado: {cacheInfo.solucions.status}</div>
            </div>
          </motion.div>

          {/* Estado de Menjar */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            style={{
              backgroundColor: colors.surface,
              padding: '20px 18px',
              borderRadius: '16px',
              border: `1px solid ${colors.border}`,
              boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
              flex: '1 1 180px',
              minWidth: '180px',
              maxWidth: '250px',
            }}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '16px'
            }}>
              <h4 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                margin: 0,
              }}>
                Menjar d'Hort
              </h4>
              <div style={{
                padding: '4px 12px',
                borderRadius: '20px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: cacheInfo.menjar.loading ? '#FF9800' + '15' : 
                               cacheInfo.menjar.status.includes('Válido') ? '#4CAF50' + '15' : '#F44336' + '15',
                color: cacheInfo.menjar.loading ? '#FF9800' : 
                       cacheInfo.menjar.status.includes('Válido') ? '#4CAF50' : '#F44336',
              }}>
                {cacheInfo.menjar.loading ? 'Cargando...' : cacheInfo.menjar.status}
              </div>
            </div>
            <div style={{
              fontSize: '14px',
              color: colors.textSecondary,
              lineHeight: '1.5',
            }}>
              <div>Compras en caché: <strong>{cacheInfo.menjar.count}</strong></div>
              <div>Estado: {cacheInfo.menjar.status}</div>
            </div>
          </motion.div>
        </div>
      </motion.div>

      {/* Acciones Rápidas Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{ marginBottom: '30px' }}
      >
        <h3 style={{
          fontSize: '24px',
          fontWeight: '600',
          color: colors.text,
          margin: '0 0 20px 0',
        }}>
          Acciones Rápidas
        </h3>
        
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '18px',
        }}>
          {/* Botón de Actualizar */}
          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              backgroundColor: colors.card,
              padding: '24px 20px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              flex: '1 1 200px',
              minWidth: '200px',
              maxWidth: '280px',
            }}
            onClick={async () => {
              try {
                // Marcar ambas empresas como cargando
                setLoading('solucions', true);
                setLoading('menjar', true);
                
                // Actualizar datos de ambas empresas
                const [solucionsPurchases, menjarPurchases] = await Promise.all([
                  holdedApi.getAllPendingAndOverduePurchases('solucions').catch(error => {
                    console.error('Error actualizando Solucions:', error);
                    setLoading('solucions', false);
                    return [];
                  }),
                  holdedApi.getAllPendingAndOverduePurchases('menjar').catch(error => {
                    console.error('Error actualizando Menjar:', error);
                    setLoading('menjar', false);
                    return [];
                  })
                ]);

                // Actualizar caché con nuevos datos
                updateCache('solucions', solucionsPurchases);
                updateCache('menjar', menjarPurchases);

                const totalPurchases = solucionsPurchases.length + menjarPurchases.length;
                showAlert(`Actualizadas ${totalPurchases} compras (Solucions: ${solucionsPurchases.length}, Menjar: ${menjarPurchases.length})`, 'success');
                
                // Recargar datos en la página actual
                await loadDataFromHolded();
                
                // Activar recarga en AnalyticsPage
                setShouldReloadHolded(true);
              } catch (error) {
                // Asegurar que se desactiva el estado de carga en caso de error
                setLoading('solucions', false);
                setLoading('menjar', false);
                showAlert(`Error al actualizar: ${error.message}`, 'error');
              }
            }}
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
                backgroundColor: '#10B981' + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Download size={24} color="#10B981" />
              </div>
              <h4 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: colors.text,
                margin: 0,
              }}>
                Actualizar Datos
              </h4>
            </div>
            <p style={{
              fontSize: '16px',
              color: colors.textSecondary,
              margin: 0,
              lineHeight: '1.5',
            }}>
              Actualizar información de compras de ambas empresas desde Holded
            </p>
          </motion.div>

          {/* Botón de Análisis */}
          <motion.div
            whileHover={{ y: -3, scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              backgroundColor: colors.card,
              padding: '24px 20px',
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
              flex: '1 1 200px',
              minWidth: '200px',
              maxWidth: '280px',
            }}
            onClick={handleViewAnalytics}
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
                backgroundColor: '#FF9800' + '15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <BarChart2 size={24} color="#FF9800" />
              </div>
              <h4 style={{
                fontSize: '20px',
                fontWeight: '600',
                color: colors.text,
                margin: 0,
              }}>
                Ver Análisis
              </h4>
            </div>
            <p style={{
              fontSize: '16px',
              color: colors.textSecondary,
              margin: 0,
              lineHeight: '1.5',
            }}>
              Acceder a la pestaña de análisis para ver estadísticas y reportes detallados
            </p>
          </motion.div>
        </div>
      </motion.div>

      {/* SECCIÓN DE ACCIONES RÁPIDAS ELIMINADA - FUNCIONALIDAD DE EXCEL DESHABILITADA */}

      {/* CSS para animaciones */}
      <style>{`
        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default HomePage; 