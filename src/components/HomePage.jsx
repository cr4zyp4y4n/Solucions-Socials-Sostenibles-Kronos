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
  Loader
} from 'feather-icons-react';
import { useDataContext } from './DataContext';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

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
    menjarHeaders, setMenjarHeaders, menjarData, setMenjarData
  } = useDataContext();
  const { colors } = useTheme();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();

  // Estado para datos cargados desde Supabase
  const [supabaseData, setSupabaseData] = useState({
    solucions: { headers: [], data: [] },
    menjar: { headers: [], data: [] }
  });
  const [loadingData, setLoadingData] = useState(true);

  // Cargar datos desde Supabase al montar el componente
  useEffect(() => {
    loadDataFromSupabase();
  }, []);

  // Función para cargar datos desde Supabase
  const loadDataFromSupabase = async () => {
    setLoadingData(true);
    try {
      // Obtener todos los uploads de Excel
      const { data: uploads, error: uploadsError } = await supabase
        .from('excel_uploads')
        .select('*')
        .order('uploaded_at', { ascending: false });

      if (uploadsError) {
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
          data: processedSolucions.data
        },
        menjar: {
          headers: processedMenjar.headers,
          data: processedMenjar.data
        }
      });

    } catch (error) {
      // Error loading data from Supabase
    } finally {
      setLoadingData(false);
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

  // Función para mostrar alerta
  const showAlert = (message, type = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setAlertVisible(true);
    setTimeout(() => setAlertVisible(false), 4000);
  };

  // Función para sanitizar nombres de archivo
  const sanitizeFileName = (fileName) => {
    // Remover extensión temporalmente
    const lastDotIndex = fileName.lastIndexOf('.');
    const name = lastDotIndex !== -1 ? fileName.substring(0, lastDotIndex) : fileName;
    const extension = lastDotIndex !== -1 ? fileName.substring(lastDotIndex) : '';
    
    // Sanitizar el nombre del archivo
    let sanitizedName = name
      // Reemplazar caracteres especiales problemáticos
      .replace(/[''""]/g, '') // Remover comillas simples y dobles
      .replace(/[àáâãäå]/g, 'a') // Normalizar vocales con acentos
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      // Reemplazar espacios y caracteres especiales con guiones bajos
      .replace(/[\s\-_\/\\|]/g, '_')
      // Remover caracteres no alfanuméricos excepto guiones bajos
      .replace(/[^a-zA-Z0-9_]/g, '')
      // Remover múltiples guiones bajos consecutivos
      .replace(/_+/g, '_')
      // Remover guiones bajos al inicio y final
      .replace(/^_+|_+$/g, '')
      // Limitar longitud a 50 caracteres
      .substring(0, 50);
    
    // Si el nombre quedó vacío, usar un nombre por defecto
    if (!sanitizedName) {
      sanitizedName = 'archivo_excel';
    }
    
    // Reconstruir el nombre con la extensión
    return sanitizedName + extension;
  };

  // Función para subir archivo a Supabase Storage
  const uploadFileToStorage = async (file, type) => {
    try {
      const timestamp = new Date().getTime();
      const sanitizedFileName = sanitizeFileName(file.name);
      const fileName = `${type}_${timestamp}_${sanitizedFileName}`;
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

  // Función para guardar metadatos del upload en la base de datos
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

  // Función para guardar datos procesados en la tabla invoices
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
                // Usar las funciones mejoradas para convertir fechas
                if (typeof value === 'number') {
                  const convertedDate = convertExcelDate(value);
                  if (convertedDate) {
                    invoiceData[dbColumn] = convertedDate;
                  }
                } else if (typeof value === 'string' && value.trim()) {
                  const parsedDate = parseDateString(value);
                  if (parsedDate) {
                    invoiceData[dbColumn] = parsedDate;
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

  // Función para crear notificación para los Jefes
  const createNotificationForManagers = async (uploadInfo, type) => {
    try {
      // Obtener usuarios con roles de manager, admin y management
      const { data: managers, error: managersError } = await supabase
        .from('user_profiles')
        .select('id')
        .in('role', ['manager', 'admin', 'management'])
        .neq('id', user.id); // No notificar al creador

      if (managersError) {
        return;
      }

      if (managers && managers.length > 0) {
        // Crear notificaciones para cada manager/admin/management
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

  // Función completa para procesar y subir archivo Excel
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

  // Función mejorada para convertir fechas de Excel
  const convertExcelDate = (excelDate) => {
    if (typeof excelDate === 'number' && !isNaN(excelDate)) {
      // Validar que el valor sea razonable
      if (excelDate < 1 || excelDate > 999999) {
        return null;
      }
      
      // Convertir fecha de Excel (días desde 1900-01-01)
      // Excel usa 1900 como año base, pero tiene un bug: considera 1900 como año bisiesto
      // Por eso restamos 2 días en lugar de 1
      const utcDays = Math.floor(excelDate - 2);
      const utcValue = utcDays * 86400;
      const dateInfo = new Date(utcValue * 1000);
      
      // Validar que la fecha resultante sea razonable
      if (dateInfo.getFullYear() < 1900 || dateInfo.getFullYear() > 2100) {
        return null;
      }
      
      return dateInfo.toISOString().split('T')[0];
    }
    
    if (typeof excelDate === 'string' && /^\d+(\.\d+)?$/.test(excelDate)) {
      return convertExcelDate(Number(excelDate));
    }
    
    return null;
  };

  // Función mejorada para parsear fechas en formato string
  const parseDateString = (dateString) => {
    if (!dateString || typeof dateString !== 'string') {
      return null;
    }
    
    const trimmedDate = dateString.trim();
    if (!trimmedDate) {
      return null;
    }
    
    try {
      // Intentar diferentes formatos de fecha
      let parsedDate = null;
      
      // Formato ISO (YYYY-MM-DD)
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate)) {
        parsedDate = new Date(trimmedDate);
      }
      // Formato español (DD/MM/YYYY)
      else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(trimmedDate)) {
        const [day, month, year] = trimmedDate.split('/');
        parsedDate = new Date(year, month - 1, day);
      }
      // Formato catalán (DD-MM-YYYY)
      else if (/^\d{1,2}-\d{1,2}-\d{4}$/.test(trimmedDate)) {
        const [day, month, year] = trimmedDate.split('-');
        parsedDate = new Date(year, month - 1, day);
      }
      // Otros formatos comunes
      else {
        parsedDate = new Date(trimmedDate);
      }
      
      // Validar que la fecha sea válida y razonable
      if (isNaN(parsedDate.getTime()) || 
          parsedDate.getFullYear() < 1900 || 
          parsedDate.getFullYear() > 2100) {
        return null;
      }
      
      return parsedDate.toISOString().split('T')[0];
    } catch (error) {
      return null;
    }
  };

  // Función para manejar la importación de archivos de Solucions Socials (actualizada)
  const handleSolucionsFileImport = (file) => {
    processAndUploadExcel(file, 'solucions');
  };

  // Función para manejar la importación de archivos de Menjar d'Hort (actualizada)
  const handleMenjarFileImport = (file) => {
    processAndUploadExcel(file, 'menjar');
  };

  // Función para manejar la selección de archivo de Solucions Socials
  const handleSolucionsFileSelect = () => {
    if (uploading) {
      showAlert('Espera a que termine la subida actual.', 'error');
      return;
    }
    fileInputRef.current.click();
  };

  // Función para manejar la selección de archivo de Menjar d'Hort
  const handleMenjarFileSelect = () => {
    if (uploading) {
      showAlert('Espera a que termine la subida actual.', 'error');
      return;
    }
    menjarFileInputRef.current.click();
  };

  // Función para manejar el cambio de archivo de Solucions Socials
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

  // Función para manejar el cambio de archivo de Menjar d'Hort
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

  // Funciones para los otros botones
  const handleViewAnalytics = () => {
    if (solucionsData.length === 0 && menjarData.length === 0) {
      showAlert('Primero debes importar al menos un archivo Excel para ver los análisis.', 'error');
      return;
    }
    // Aquí podrías navegar a la página de análisis o mostrar un modal
    showAlert('Redirigiendo a la sección de análisis...', 'success');
  };

  // Calcular estadísticas reales desde Supabase
  const calculateStats = () => {
    // Usar datos de Supabase en lugar de datos del contexto local
    const totalData = [...supabaseData.solucions.data, ...supabaseData.menjar.data];
    
    if (totalData.length === 0) {
      return [
        { icon: Users, label: 'Total Proveedores', value: '0', color: colors.primary },
        { icon: FileText, label: 'Facturas Procesadas', value: '0', color: '#2196F3' },
        { icon: DollarSign, label: 'Total a Pagar', value: '€0', color: colors.warning },
        { icon: TrendingUp, label: 'Promedio por Factura', value: '€0', color: '#9C27B0' },
      ];
    }

    // Combinar headers de ambos datasets
    const allHeaders = [...supabaseData.solucions.headers, ...supabaseData.menjar.headers];
    const providerIndex = allHeaders.findIndex(h => h === 'Proveïdor');
    const totalIndex = allHeaders.findIndex(h => h === 'Total');
    
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
        label: 'Facturas Procesadas', 
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

  return (
    <div style={{ width: '100%' }}>
      {/* Input oculto para archivos de Solucions Socials */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleSolucionsFileChange}
      />

      {/* Input oculto para archivos de Menjar d'Hort */}
      <input
        ref={menjarFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        style={{ display: 'none' }}
        onChange={handleMenjarFileChange}
      />

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
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '24px',
          marginBottom: '50px',
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
                  padding: '24px',
                  borderRadius: '16px',
                  border: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
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
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  opacity: uploading ? 0.6 : 1,
                  transition: 'all 0.2s ease',
                  boxShadow: isDarkMode => isDarkMode ? '0 2px 8px rgba(0,0,0,0.25)' : '0 2px 8px rgba(0,0,0,0.05)',
                }}
                onClick={uploading ? undefined : action.onClick}
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