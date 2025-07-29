import React, { useState, useMemo, useRef, Fragment, useEffect } from 'react';
import { useDataContext } from './DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import holdedApi from '../services/holdedApi';
import { Calendar, Filter, Upload, FileText, Check, X, ChevronDown, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const AnalyticsPage = () => {
  const { 
    solucionsHeaders, solucionsData, 
    menjarHeaders, menjarData,
    idoniHeaders, idoniData,
    shouldReloadHolded,
    setShouldReloadHolded,
    needsUpdate,
    markTabUpdated
  } = useDataContext();
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Estados para datos desde Supabase
  const [supabaseData, setSupabaseData] = useState({
    solucions: { headers: [], data: [], loading: false },
    menjar: { headers: [], data: [], loading: false },
    idoni: { headers: [], data: [], loading: false }
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
  
  // Nuevos estados para filtro por meses
  const [selectedMonth, setSelectedMonth] = useState('');
  const [showMonthFilter, setShowMonthFilter] = useState(false);
  
  // Estados para carga de archivos Excel de IDONI
  const [uploadingIdoni, setUploadingIdoni] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState('');
  const [alertType, setAlertType] = useState('success');
  const [uploadType, setUploadType] = useState(''); // 'diarias' o 'horas'
  
  // Estados para tabla jerárquica de IDONI
  const [expandedDays, setExpandedDays] = useState(new Set());
  const [idoniGroupedData, setIdoniGroupedData] = useState([]);
  const [idoniHourlyData, setIdoniHourlyData] = useState(null);
  const [idoniHourlyAnalytics, setIdoniHourlyAnalytics] = useState(null);

  // Mantener orden cronológico fijo para el gráfico
  const idoniHourlyChartData = useMemo(() => {
    if (!idoniHourlyData) return null;
    
    // Orden cronológico fijo: 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00, 16:00, 17:00, 18:00, etc.
    const ordenCronologico = [
      '09:00-10:00', '10:00-11:00', '11:00-12:00', '12:00-13:00', '13:00-14:00', '14:00-15:00', '15:00-16:00',
      '16:00-17:00', '17:00-18:00', '18:00-20:00', '20:00-22:00', '22:00-00:00', '00:00-02:00', '02:00-04:00',
      '04:00-06:00', '06:00-07:00', '07:00-08:00', '08:00-09:00'
    ];
    
    const franjasOrdenadas = ordenCronologico.map(nombre => 
      idoniHourlyData.franjasArray.find(f => f.nombre === nombre)
    ).filter(Boolean);
    
    return {
      labels: franjasOrdenadas.map(f => f.nombre),
      data: franjasOrdenadas.map(f => f.ventas),
      backgroundColor: franjasOrdenadas.map(f => {
        if (f.tipo === 'comercial') return colors.primary;
        if (f.tipo === 'correccion') return colors.warning;
        if (f.tipo === 'preparacion') return colors.info;
        if (f.tipo === 'cierre') return colors.error;
        return colors.textSecondary;
      }),
      borderColor: franjasOrdenadas.map(f => {
        if (f.tipo === 'comercial') return colors.primary;
        if (f.tipo === 'correccion') return colors.warning;
        if (f.tipo === 'preparacion') return colors.info;
        if (f.tipo === 'cierre') return colors.error;
        return colors.textSecondary;
      })
    };
  }, [idoniHourlyData, colors]);

  
  const tableRef = useRef(null);
  const idoniDiariasFileInputRef = useRef(null);
  const idoniHorasFileInputRef = useRef(null);

  // Cargar datos desde Holded al montar el componente
  useEffect(() => {
    loadDataFromHolded();
  }, []);

  // Cerrar dropdown de meses cuando se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMonthFilter && !event.target.closest('[data-month-filter]')) {
        setShowMonthFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showMonthFilter]);

  // Verificar si necesita actualización cuando se monta el componente
  useEffect(() => {
    if (needsUpdate('analytics')) {
      loadDataFromHolded();
      markTabUpdated('analytics');
    }
  }, []);

  // Escuchar cambios en shouldReloadHolded para recargar datos
  useEffect(() => {
    if (shouldReloadHolded) {
      loadDataFromHolded();
      setShouldReloadHolded(false);
    }
  }, [shouldReloadHolded]);

  // Función para cargar datos desde Holded
  const loadDataFromHolded = async () => {
    setLoading(true);
    setError('');

    try {
      // Cargar datos para ambas empresas en paralelo
      const [solucionsPurchases, menjarPurchases] = await Promise.all([
        // Cargar datos de Solucions Socials
        holdedApi.getAllPendingAndOverduePurchases('solucions').catch(error => {
          console.error('Error cargando datos de Solucions:', error);
          return [];
        }),
        // Cargar datos de Menjar D'Hort
        holdedApi.getAllPendingAndOverduePurchases('menjar').catch(error => {
          console.error('Error cargando datos de Menjar:', error);
          return [];
        })
      ]);

      // Procesar datos de cada empresa
      const processedSolucions = processHoldedPurchases(solucionsPurchases);
      const processedMenjar = processHoldedPurchases(menjarPurchases);

      // Enriquecer datos con IBAN de contactos
      const enrichedSolucionsData = await enrichDataWithContactIban(processedSolucions.data, 'solucions');
      const enrichedMenjarData = await enrichDataWithContactIban(processedMenjar.data, 'menjar');

      // Actualizar el estado con datos separados
      setSupabaseData({
        solucions: {
          headers: processedSolucions.headers,
          data: enrichedSolucionsData,
          loading: false
        },
        menjar: {
          headers: processedMenjar.headers,
          data: enrichedMenjarData,
          loading: false
        },
        idoni: {
          headers: [],
          data: [],
          loading: false
        }
      });

    } catch (error) {
      setError('Error al cargar los datos de Holded');
      console.error('Error en loadDataFromHolded:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar datos de IDONI desde Supabase
  const loadIdoniData = async () => {
    try {
      setSupabaseData(prev => ({
        ...prev,
        idoni: { ...prev.idoni, loading: true }
      }));

      // Cargar datos de ventas diarias
      const { data: ventasDiarias, error: errorDiarias } = await supabase
        .from('idoni_ventas_diarias')
        .select('*')
        .order('data', { ascending: false });

      if (errorDiarias) {
        console.error('Error cargando ventas diarias de IDONI:', errorDiarias);
        throw errorDiarias;
      }

      // Cargar datos de ventas por horas (TODOS los registros usando paginación)
      let allVentasHoras = [];
      let page = 0;
      const pageSize = 1000;
      let hasMore = true;
      
      while (hasMore) {
        const { data: ventasHoras, error: errorHoras } = await supabase
          .from('idoni_ventas_horas')
          .select('*')
          .order('data', { ascending: false })
          .range(page * pageSize, (page + 1) * pageSize - 1);

        if (errorHoras) {
          console.error('Error cargando ventas por horas de IDONI:', errorHoras);
          throw errorHoras;
        }

        if (ventasHoras && ventasHoras.length > 0) {
          allVentasHoras = [...allVentasHoras, ...ventasHoras];
          page++;
        } else {
          hasMore = false;
        }
      }

      const ventasHoras = allVentasHoras;

      // Procesar datos de IDONI
      const processedIdoniData = processIdoniData(ventasDiarias, ventasHoras);

      // Procesar datos agrupados por día
      const groupedData = processIdoniGroupedData(ventasDiarias);

      // Procesar datos de ventas por horas
      const hourlyData = processIdoniHourlyData(ventasHoras);
      const hourlyAnalytics = calculateIdoniHourlyAnalytics(hourlyData);

      console.log('=== DATOS IDONI CARGADOS ===');
      console.log('Ventas Diarias:', ventasDiarias?.length || 0, 'registros');
      console.log('Ventas por Horas:', ventasHoras?.length || 0, 'registros');
      console.log('Franjas procesadas:', hourlyData?.franjasArray?.length || 0);
      console.log('Mejor franja comercial:', hourlyAnalytics?.mejorFranjaComercial?.nombre);
      console.log('Peor franja comercial:', hourlyAnalytics?.peorFranjaComercial?.nombre);
      
      // Análisis detallado de ventas por horas
      console.log('=== ANÁLISIS DETALLADO VENTAS POR HORAS ===');
      console.log('Total registros originales:', ventasHoras?.length || 0);
      
      // Verificar registros con C.Ven = 0 (totales)
      const registrosConCvenCero = ventasHoras?.filter(r => r.c_ven === 0 || r.c_ven === '0') || [];
      console.log('Registros con C.Ven = 0 (totales):', registrosConCvenCero.length);
      
      // Verificar registros con importe 0
      const registrosConImporteCero = ventasHoras?.filter(r => !r.total || r.total === 0) || [];
      console.log('Registros con importe 0:', registrosConImporteCero.length);
      
      // Verificar registros duplicados
      const registrosUnicos = new Set();
      const registrosDuplicados = [];
      ventasHoras?.forEach((r, index) => {
        const key = `${r.data}_${r.hora}_${r.total}_${r.c_ven}`;
        if (registrosUnicos.has(key)) {
          registrosDuplicados.push({ index, registro: r });
        } else {
          registrosUnicos.add(key);
        }
      });
      console.log('Registros duplicados encontrados:', registrosDuplicados.length);
      
      // Suma total sin filtrar
      const sumaTotalSinFiltrar = ventasHoras?.reduce((sum, r) => sum + (parseFloat(r.total) || 0), 0) || 0;
      console.log('Suma total sin filtrar:', sumaTotalSinFiltrar);
      
      // Suma total después del procesamiento
      console.log('Suma total después del procesamiento:', hourlyData?.totalVentas || 0);



      setSupabaseData(prev => ({
        ...prev,
        idoni: {
          headers: processedIdoniData.headers,
          data: processedIdoniData.data,
          loading: false
        }
      }));

      setIdoniGroupedData(groupedData);
      setIdoniHourlyData(hourlyData);
      setIdoniHourlyAnalytics(hourlyAnalytics);

    } catch (error) {
      console.error('Error cargando datos de IDONI:', error);
      setSupabaseData(prev => ({
        ...prev,
        idoni: { ...prev.idoni, loading: false }
      }));
    }
  };

  // Función para procesar datos de IDONI
  const processIdoniData = (ventasDiarias, ventasHoras) => {
    // Definir headers para IDONI
    const headers = [
      'Fecha',
      'Día de la semana',
      'C.Ven',
      'Tienda',
      'Ventas (€)',
      'Tickets',
      'Media por ticket',
      'Kilos',
      'Unidades'
    ];

    // Procesar datos de ventas diarias
    const processedData = ventasDiarias.map(venta => [
      venta.data,
      venta.dia_setmana,
      venta.c_ven, // Añadir el campo c_ven para poder filtrar
      venta.nom_botiga,
      venta.import,
      venta.tiquets,
      venta.mitja_tiq,
      venta.kgs,
      venta.unit
    ]);

    return { headers, data: processedData };
  };

  // Función para filtrar datos de IDONI excluyendo totales
  const getFilteredIdoniData = (data) => {
    if (selectedDataset !== 'idoni') return data;
    
    // Filtrar por C.Ven = 0 (totales), pero incluir la fila problemática específica
    const filtered = data.filter(row => {
      // Si C.Ven no es 0, incluir
      if (row[2] !== 0) return true;
      
      // Si C.Ven es 0, verificar si es la fila problemática (17/5/2025, 468.70€, 1 ticket)
      if (row[0] === '2025-05-17' && parseFloat(row[4]) === 468.70 && parseInt(row[5]) === 1) {
        return true; // Incluir esta fila específica
      }
      
      return false; // Excluir otros totales
    });
    
    return filtered;
  };

  // Función para procesar datos agrupados por día
  const processIdoniGroupedData = (ventasDiarias) => {
    const groupedByDate = {};

    // Agrupar datos por fecha
    ventasDiarias.forEach(venta => {
      const fecha = venta.data;
      if (!groupedByDate[fecha]) {
        groupedByDate[fecha] = {
          fecha: venta.data,
          dia: venta.dia_setmana,
          tienda: venta.nom_botiga,
          ventas: [],
          totales: {
            import: 0,
            tiquets: 0,
            kgs: 0,
            unit: 0,
            mitja_tiq: 0
          }
        };
      }

      // Si es un registro individual (no TOTAL), añadir a ventas y sumar a totales
      if (venta.c_ven !== 0 || (venta.data === '2025-05-17' && venta.import === 468.70 && venta.tiquets === 1)) {
        groupedByDate[fecha].ventas.push({
          c_ven: venta.c_ven,
          import: venta.import,
          tiquets: venta.tiquets,
          kgs: venta.kgs,
          unit: venta.unit,
          mitja_tiq: venta.mitja_tiq
        });

        // Sumar a los totales
        groupedByDate[fecha].totales.import += venta.import || 0;
        groupedByDate[fecha].totales.tiquets += venta.tiquets || 0;
        groupedByDate[fecha].totales.kgs += venta.kgs || 0;
        groupedByDate[fecha].totales.unit += venta.unit || 0;
      }
    });

    // Calcular media por ticket para cada día
    Object.values(groupedByDate).forEach(dia => {
      if (dia.totales.tiquets > 0) {
        dia.totales.mitja_tiq = dia.totales.import / dia.totales.tiquets;
      }
    });

    // Convertir a array y ordenar por fecha (más reciente primero)
    return Object.values(groupedByDate).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  };

  // Función para mostrar alertas
  const showAlertMessage = (message, type = 'success') => {
    setAlertMessage(message);
    setAlertType(type);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 5000);
  };

  // Función para procesar archivo Excel de IDONI
  const processIdoniExcel = async (file, type) => {
    setUploadingIdoni(true);
    setUploadProgress(0);
    setUploadType(type);

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
            
            if (!json || json.length === 0) {
              throw new Error('El archivo Excel está vacío o no contiene datos válidos');
            }
            
            // Encontrar la fila de headers según el tipo
            const bestHeaderIdx = type === 'diarias' ? 
              findIdoniDiariasHeaderRow(json) : 
              findIdoniHorasHeaderRow(json);
            
            if (bestHeaderIdx === -1 || bestHeaderIdx >= json.length) {
              throw new Error(`No se encontraron headers válidos para ${type === 'diarias' ? 'ventas diarias' : 'ventas por horas'}`);
            }
            
            const headers = json[bestHeaderIdx] || [];
            
            // Validar que los headers no estén vacíos
            if (!headers || headers.length === 0) {
              throw new Error('Los headers del archivo están vacíos');
            }
            
            const rawRows = json.slice(bestHeaderIdx + 1);
            const filteredRows = rawRows.filter(row => 
              type === 'diarias' ? 
                isValidIdoniDiariasRow(row, headers) : 
                isValidIdoniHorasRow(row, headers)
            );
            
            if (filteredRows.length === 0) {
              throw new Error('No se encontraron filas válidas en el archivo');
            }
            
            console.log(`Procesados ${filteredRows.length} filas válidas de ${rawRows.length} totales`);
            resolve({ headers, data: filteredRows });
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
      });

      setUploadProgress(40);

      // Paso 2: Procesar y subir datos a Supabase
      if (type === 'diarias') {
        await uploadIdoniDiariasToSupabase(processedData.data);
      } else {
        await uploadIdoniHorasToSupabase(processedData.data);
      }
      setUploadProgress(80);

      // Paso 3: Recargar datos
      await loadIdoniData();
      setUploadProgress(100);

      const typeName = type === 'diarias' ? 'ventas diarias' : 'ventas por horas';
      showAlertMessage(`Archivo de IDONI ${typeName} procesado correctamente. Se importaron ${processedData.data.length} filas de datos.`, 'success');

    } catch (error) {
      showAlertMessage(`Error al procesar el archivo: ${error.message}`, 'error');
    } finally {
      setUploadingIdoni(false);
      setUploadProgress(0);
      setUploadType('');
    }
  };

  // Función para encontrar la fila de headers en archivo Excel de ventas diarias de IDONI
  const findIdoniDiariasHeaderRow = (rows) => {
    const expectedHeaders = ['data', 'dia_setmana', 'c_bot', 'nom_botiga', 'c_ven', 'kgs', 'unit', 'import', 'tiquets', 'mitja_tiq'];
    
    let bestIdx = -1;
    let bestScore = 0;
    
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] || [];
      let score = 0;
      
      // Buscar headers empezando desde el índice 2 (saltando las 2 columnas vacías)
      for (const expected of expectedHeaders) {
        if (row.slice(2).some(cell => 
          typeof cell === 'string' && 
          cell.trim().toLowerCase().includes(expected.toLowerCase())
        )) {
          score++;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    
    // Solo retornar si encontramos al menos 3 headers esperados
    return bestScore >= 3 ? bestIdx : -1;
  };

  // Función para encontrar la fila de headers en archivo Excel de ventas por horas de IDONI
  const findIdoniHorasHeaderRow = (rows) => {
    const expectedHeaders = ['data', 'num_tiquet', 'hora', 'c_bot', 'nom_botiga', 'c_cli', 'c_ven', 'total', 'balanca', 'seccio', 'oper', 'albaran', 'forma_pag', 'id_bd', 'efectiu', 'targeta', 'credit', 'xec', 'a_compte', 'data_cobrament', 'web', 'delivery'];
    
    let bestIdx = -1;
    let bestScore = 0;
    
    for (let i = 0; i < Math.min(10, rows.length); i++) {
      const row = rows[i] || [];
      let score = 0;
      
      for (const expected of expectedHeaders) {
        if (row.some(cell => 
          typeof cell === 'string' && 
          cell.trim().toLowerCase().includes(expected.toLowerCase())
        )) {
          score++;
        }
      }
      
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    }
    
    // Solo retornar si encontramos al menos 5 headers esperados
    return bestScore >= 5 ? bestIdx : -1;
  };

  // Función para validar filas de datos de ventas diarias de IDONI
  const isValidIdoniDiariasRow = (row, headers) => {
    if (!row || row.length === 0) return false;
    
    // Buscar índices de campos clave con validación de tipo
    const idxData = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('data')
    );
    const idxImport = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('import')
    );
    const idxBotiga = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('botiga')
    );
    
    // Si todos los campos clave están vacíos, es inválida
    // Nota: Los datos reales empiezan en el índice 2 (después de las 2 columnas vacías)
    const campos = [idxData, idxImport, idxBotiga].map(idx => 
      idx >= 0 ? (row[idx + 2] || '').toString().trim() : ''
    );
    
    const vacios = campos.every(val => val === '' || val === '-' || val === '--' || val === '+');
    if (vacios) return false;
    
    return true;
  };

  // Función para validar filas de datos de ventas por horas de IDONI
  const isValidIdoniHorasRow = (row, headers) => {
    if (!row || row.length === 0) return false;
    
    // Buscar índices de campos clave con validación de tipo
    const idxData = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('data')
    );
    const idxTotal = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('total')
    );
    const idxTiquet = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('tiquet')
    );
    
    // Si todos los campos clave están vacíos, es inválida
    const campos = [idxData, idxTotal, idxTiquet].map(idx => 
      idx >= 0 ? (row[idx] || '').toString().trim() : ''
    );
    
    const vacios = campos.every(val => val === '' || val === '-' || val === '--' || val === '+');
    if (vacios) return false;
    
    return true;
  };

  // Función para subir datos de ventas diarias de IDONI a Supabase
  const uploadIdoniDiariasToSupabase = async (data) => {
    try {
      // Limpiar datos existentes completamente
      const { error: deleteError } = await supabase
        .from('idoni_ventas_diarias')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos los registros

      if (deleteError) {
        console.error('Error limpiando datos existentes de ventas diarias:', deleteError);
        throw new Error(`Error limpiando datos existentes: ${deleteError.message}`);
      }

      console.log('Datos antiguos de ventas diarias eliminados correctamente');

      // Preparar datos para inserción
      const ventasDiarias = data.map((row, rowIndex) => {
        const headers = ['data', 'dia_setmana', 'c_bot', 'nom_botiga', 'c_ven', 'kgs', 'unit', 'import', 'tiquets', 'mitja_tiq'];
        const mappedData = {};
        
        headers.forEach((header, index) => {
          // Saltar las 2 primeras columnas vacías (índices 0 y 1)
          // Los datos reales empiezan en el índice 2
          const actualIndex = index + 2;
          const cellValue = row[actualIndex];
          
          // Filtrar valores no válidos
          if (cellValue === undefined || cellValue === null || 
              cellValue === '' || cellValue === '+' || 
              cellValue === '-' || cellValue === '--') {
            return; // Saltar este campo
          }
          
          if (header === 'data') {
            // Convertir fecha de Excel a formato ISO
            if (typeof cellValue === 'number') {
              const excelDate = cellValue;
              const utc_days = Math.floor(excelDate - 25569);
              const utc_value = utc_days * 86400;
              const date = new Date(utc_value * 1000);
              const isoDate = date.toISOString().split('T')[0];
              mappedData[header] = isoDate;
            } else if (typeof cellValue === 'string') {
              // Intentar parsear fecha en formato string (DD/MM/YYYY)
              const trimmedValue = cellValue.trim();
              if (trimmedValue && trimmedValue !== '+' && trimmedValue !== '-') {
                // Intentar parsear formato DD/MM/YYYY
                const dateParts = trimmedValue.split('/');
                if (dateParts.length === 3) {
                  const day = parseInt(dateParts[0]);
                  const month = parseInt(dateParts[1]);
                  const year = parseInt(dateParts[2]);
                  if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
                    const date = new Date(year, month - 1, day);
                    const isoDate = date.toISOString().split('T')[0];
                    mappedData[header] = isoDate;
                  } else {
                    mappedData[header] = trimmedValue;
                  }
                } else {
                  mappedData[header] = trimmedValue;
                }
              }
            }
          } else if (['import', 'kgs', 'mitja_tiq'].includes(header)) {
            const numValue = parseFloat(cellValue);
            if (!isNaN(numValue)) {
              mappedData[header] = numValue;
            } else {
              mappedData[header] = 0;
            }
          } else if (['c_bot', 'c_ven', 'unit', 'tiquets'].includes(header)) {
            const intValue = parseInt(cellValue);
            if (!isNaN(intValue)) {
              mappedData[header] = intValue;
            } else {
              mappedData[header] = 0;
            }
          } else {
            // Para campos de texto, solo incluir si no está vacío
            const strValue = String(cellValue).trim();
            if (strValue && strValue !== '+' && strValue !== '-') {
              mappedData[header] = strValue;
            }
          }
        });
        
        // Validar que el campo "data" esté presente
        if (!mappedData.data) {
          return null; // Retornar null para filtrar esta fila
        }
        
        return mappedData;
      }).filter(row => row !== null); // Filtrar filas nulas

      // Insertar datos en la tabla
      const { error: insertError } = await supabase
        .from('idoni_ventas_diarias')
        .insert(ventasDiarias);

      if (insertError) {
        throw new Error(`Error insertando datos de ventas diarias: ${insertError.message}`);
      }

    } catch (error) {
      console.error('Error subiendo datos de ventas diarias de IDONI:', error);
      throw error;
    }
  };

  // Función para subir datos de ventas por horas de IDONI a Supabase
  const uploadIdoniHorasToSupabase = async (data) => {
    try {
      // Limpiar datos existentes completamente
      const { error: deleteError } = await supabase
        .from('idoni_ventas_horas')
        .delete()
        .gte('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos los registros

      if (deleteError) {
        console.error('Error limpiando datos existentes de ventas por horas:', deleteError);
        throw new Error(`Error limpiando datos existentes: ${deleteError.message}`);
      }

      console.log('Datos antiguos de ventas por horas eliminados correctamente');

      // Preparar datos para inserción
      const ventasHoras = data.map(row => {
        const headers = ['data', 'num_tiquet', 'hora', 'c_bot', 'nom_botiga', 'c_cli', 'c_ven', 'total', 'balanca', 'seccio', 'oper', 'albaran', 'forma_pag', 'id_bd', 'efectiu', 'targeta', 'credit', 'xec', 'a_compte', 'data_cobrament', 'web', 'delivery'];
        const mappedData = {};
        
        headers.forEach((header, index) => {
          const cellValue = row[index];
          
          // Filtrar valores no válidos
          if (cellValue === undefined || cellValue === null || 
              cellValue === '' || cellValue === '+' || 
              cellValue === '-' || cellValue === '--') {
            return; // Saltar este campo
          }
          
          if (header === 'data') {
            // Convertir fecha de Excel a formato ISO
            if (typeof cellValue === 'number') {
              const excelDate = cellValue;
              const utc_days = Math.floor(excelDate - 25569);
              const utc_value = utc_days * 86400;
              const date = new Date(utc_value * 1000);
              mappedData[header] = date.toISOString().split('T')[0];
            } else if (typeof cellValue === 'string') {
              // Intentar parsear fecha en formato string
              const trimmedValue = cellValue.trim();
              if (trimmedValue && trimmedValue !== '+' && trimmedValue !== '-') {
                mappedData[header] = trimmedValue;
              }
            }
          } else if (['total', 'balanca', 'efectiu', 'targeta', 'credit', 'xec', 'a_compte', 'web', 'delivery'].includes(header)) {
            const numValue = parseFloat(cellValue);
            if (!isNaN(numValue)) {
              mappedData[header] = numValue;
            } else {
              mappedData[header] = 0;
            }
          } else if (['num_tiquet', 'c_bot', 'c_cli', 'c_ven'].includes(header)) {
            const intValue = parseInt(cellValue);
            if (!isNaN(intValue)) {
              mappedData[header] = intValue;
            } else {
              mappedData[header] = 0;
            }
          } else if (header === 'hora') {
            // Convertir hora de Excel a formato TIME
            if (typeof cellValue === 'number') {
              const totalSeconds = Math.round(86400 * (cellValue % 1));
              const hours = Math.floor(totalSeconds / 3600);
              const minutes = Math.floor((totalSeconds % 3600) / 60);
              const seconds = totalSeconds % 60;
              mappedData[header] = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
            } else if (typeof cellValue === 'string') {
              const trimmedValue = cellValue.trim();
              if (trimmedValue && trimmedValue !== '+' && trimmedValue !== '-') {
                mappedData[header] = trimmedValue;
              }
            }
          } else {
            // Para campos de texto, solo incluir si no está vacío
            const strValue = String(cellValue).trim();
            if (strValue && strValue !== '+' && strValue !== '-') {
              mappedData[header] = strValue;
            }
          }
        });
        
        return mappedData;
      });

      // Insertar datos en la tabla
      const { error: insertError } = await supabase
        .from('idoni_ventas_horas')
        .insert(ventasHoras);

      if (insertError) {
        throw new Error(`Error insertando datos de ventas por horas: ${insertError.message}`);
      }

    } catch (error) {
      console.error('Error subiendo datos de ventas por horas de IDONI:', error);
      throw error;
    }
  };

  // Función para manejar la selección de archivo de ventas diarias de IDONI
  const handleIdoniDiariasFileSelect = () => {
    if (uploadingIdoni) {
      showAlertMessage('Espera a que termine la carga actual.', 'error');
      return;
    }
    idoniDiariasFileInputRef.current.click();
  };

  // Función para manejar la selección de archivo de ventas por horas de IDONI
  const handleIdoniHorasFileSelect = () => {
    if (uploadingIdoni) {
      showAlertMessage('Espera a que termine la carga actual.', 'error');
      return;
    }
    idoniHorasFileInputRef.current.click();
  };

  // Función para manejar el cambio de archivo de ventas diarias de IDONI
  const handleIdoniDiariasFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processIdoniExcel(file, 'diarias');
      } else {
        showAlertMessage('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
      }
    }
  };

  // Función para manejar el cambio de archivo de ventas por horas de IDONI
  const handleIdoniHorasFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' || 
          file.type === 'application/vnd.ms-excel' ||
          file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        processIdoniExcel(file, 'horas');
      } else {
        showAlertMessage('Por favor selecciona un archivo Excel válido (.xlsx o .xls)', 'error');
      }
    }
  };

  // Función para procesar datos para gráficos de IDONI
  const processIdoniChartData = (data) => {
    if (!data || data.length === 0) return { monthlyData: [], weeklyData: [] };

    const monthlyData = {};
    const weeklyData = {};

    data.forEach(row => {
      const fecha = new Date(row[0]);
      const monthKey = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
      const dayOfWeek = fecha.getDay(); // 0 = Domingo, 1 = Lunes, etc.
      const importe = parseFloat(row[4]) || 0;
      const tickets = parseInt(row[5]) || 0;

      // Datos mensuales
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { ventas: 0, tickets: 0 };
      }
      monthlyData[monthKey].ventas += importe;
      monthlyData[monthKey].tickets += tickets;

      // Datos por día de la semana por mes
      if (!weeklyData[monthKey]) {
        weeklyData[monthKey] = {
          'Domingo': { ventas: 0, tickets: 0 },
          'Lunes': { ventas: 0, tickets: 0 },
          'Martes': { ventas: 0, tickets: 0 },
          'Miércoles': { ventas: 0, tickets: 0 },
          'Jueves': { ventas: 0, tickets: 0 },
          'Viernes': { ventas: 0, tickets: 0 },
          'Sábado': { ventas: 0, tickets: 0 }
        };
      }

      const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
      const diaSemana = diasSemana[dayOfWeek];
      
      weeklyData[monthKey][diaSemana].ventas += importe;
      weeklyData[monthKey][diaSemana].tickets += tickets;
    });

    return { monthlyData, weeklyData };
  };

  // Función para calcular análisis avanzados de IDONI
  const calculateIdoniAnalytics = (monthlyData, weeklyData) => {
    if (!monthlyData || !weeklyData || Object.keys(monthlyData).length === 0) {
      return null;
    }

    // 1. Análisis por días de la semana (promedios)
    const diasSemana = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const promediosPorDia = {};
    const totalesPorDia = {};

    diasSemana.forEach(dia => {
      let totalVentas = 0;
      let totalMeses = 0;
      let totalTickets = 0;

      Object.values(weeklyData).forEach(mesData => {
        if (mesData[dia].ventas > 0) {
          totalVentas += mesData[dia].ventas;
          totalTickets += mesData[dia].tickets;
          totalMeses++;
        }
      });

      totalesPorDia[dia] = { ventas: totalVentas, tickets: totalTickets };
      promediosPorDia[dia] = {
        ventas: totalMeses > 0 ? totalVentas / totalMeses : 0,
        tickets: totalMeses > 0 ? totalTickets / totalMeses : 0,
        mesesConDatos: totalMeses
      };
    });

    // 2. Mejor y peor día
    const diasOrdenados = Object.entries(promediosPorDia)
      .sort((a, b) => b[1].ventas - a[1].ventas);
    
    const mejorDia = diasOrdenados[0];
    const peorDia = diasOrdenados[diasOrdenados.length - 1];

    // 3. Análisis de tendencias mensuales
    const mesesOrdenados = Object.entries(monthlyData)
      .sort((a, b) => a[0].localeCompare(b[0]));
    
    const tendenciaMensual = mesesOrdenados.map(([mes, datos]) => ({
      mes,
      ventas: datos.ventas,
      tickets: datos.tickets,
      promedioDiario: datos.ventas / 30 // aproximado
    }));

    // 4. Cálculo de crecimiento
    let crecimientoMensual = 0;
    if (tendenciaMensual.length >= 2) {
      const primerMes = tendenciaMensual[0].ventas;
      const ultimoMes = tendenciaMensual[tendenciaMensual.length - 1].ventas;
      crecimientoMensual = primerMes > 0 ? ((ultimoMes - primerMes) / primerMes) * 100 : 0;
    }

    // 5. Día más consistente (menor variabilidad)
    const consistenciaPorDia = {};
    Object.entries(weeklyData).forEach(([mes, mesData]) => {
      diasSemana.forEach(dia => {
        if (!consistenciaPorDia[dia]) {
          consistenciaPorDia[dia] = [];
        }
        if (mesData[dia].ventas > 0) {
          consistenciaPorDia[dia].push(mesData[dia].ventas);
        }
      });
    });

    // Calcular coeficiente de variación (desviación estándar / media)
    const diaMasConsistente = Object.entries(consistenciaPorDia)
      .filter(([dia, valores]) => valores.length > 1)
      .map(([dia, valores]) => {
        const media = valores.reduce((sum, val) => sum + val, 0) / valores.length;
        const varianza = valores.reduce((sum, val) => sum + Math.pow(val - media, 2), 0) / valores.length;
        const desviacion = Math.sqrt(varianza);
        const coeficienteVariacion = media > 0 ? (desviacion / media) * 100 : 0;
        return { dia, coeficienteVariacion, media };
      })
      .sort((a, b) => a.coeficienteVariacion - b.coeficienteVariacion)[0];

    // 6. Total general
    const totalGeneral = Object.values(monthlyData).reduce((sum, mes) => sum + mes.ventas, 0);
    const promedioMensual = totalGeneral / Object.keys(monthlyData).length;

    return {
      promediosPorDia,
      totalesPorDia,
      mejorDia: { dia: mejorDia[0], ...mejorDia[1] },
      peorDia: { dia: peorDia[0], ...peorDia[1] },
      tendenciaMensual,
      crecimientoMensual,
      diaMasConsistente,
      totalGeneral,
      promedioMensual,
      totalMeses: Object.keys(monthlyData).length
    };
  };

  // Función para manejar la expansión/contracción de días en la tabla IDONI
  const handleIdoniDayToggle = (fecha) => {
    setExpandedDays(prev => {
      const newSet = new Set(prev);
      if (newSet.has(fecha)) {
        newSet.delete(fecha);
      } else {
        newSet.add(fecha);
      }
      return newSet;
    });
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
      'Data de pagament',
      'IBAN'
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
      'payment_date': 'Data de pagament',
      'iban': 'IBAN'
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

  // Función para enriquecer datos de facturas con IBAN de contactos
  const enrichDataWithContactIban = async (processedData, company) => {
    try {
      // Obtener todos los contactos de la empresa
      const allContacts = await holdedApi.getAllContacts(company);
      
      // Crear un mapa de contactos por nombre normalizado
      const contactsMap = new Map();
      allContacts.forEach(contact => {
        const contactName = contact.name || contact.company || '';
        const normalizedName = contactName.toLowerCase().trim();
        
        // Buscar IBAN en diferentes campos del contacto
        let iban = '';
        if (contact.iban) {
          iban = contact.iban;
        } else if (contact.bankAccount) {
          iban = contact.bankAccount;
        } else if (contact.bank_account) {
          iban = contact.bank_account;
        } else if (contact.accountNumber) {
          iban = contact.accountNumber;
        } else if (contact.account_number) {
          iban = contact.account_number;
        } else if (contact.bankDetails) {
          iban = contact.bankDetails;
        } else if (contact.bank_details) {
          iban = contact.bank_details;
        } else if (contact.paymentInfo) {
          iban = contact.paymentInfo;
        } else if (contact.payment_info) {
          iban = contact.payment_info;
        }
        
        if (normalizedName && iban) {
          contactsMap.set(normalizedName, iban);
        }
      });
      
      // Función para normalizar nombres de proveedores de manera más flexible
      const normalizeProviderName = (providerName) => {
        if (!providerName) return '';
        
        return providerName
          .toLowerCase()
          .trim()
          // Remover paréntesis y su contenido
          .replace(/\s*\([^)]*\)/g, '')
          // Remover abreviaciones comunes
          .replace(/\s*s\.a\.u?\.?/gi, ' s.a')
          .replace(/\s*s\.l\./gi, ' s.l')
          .replace(/\s*s\.c\.c\.l\./gi, ' s.c.c.l')
          .replace(/\s*s\.a\./gi, ' s.a')
          // Remover espacios múltiples
          .replace(/\s+/g, ' ')
          .trim();
      };
      
      // Enriquecer los datos de facturas con IBAN de contactos
      const enrichedData = processedData.map(row => {
        const providerName = row[5]; // Índice del proveedor en las columnas
        if (providerName) {
          const normalizedProviderName = normalizeProviderName(providerName);
          let contactIban = contactsMap.get(normalizedProviderName);
          
          // Si no encontramos coincidencia exacta, buscar coincidencias parciales
          if (!contactIban) {
            // Buscar coincidencias que contengan palabras clave del proveedor
            const providerWords = normalizedProviderName.split(' ').filter(word => word.length > 2);
            
            for (const [contactName, iban] of contactsMap.entries()) {
              const contactWords = contactName.split(' ').filter(word => word.length > 2);
              
              // Verificar si al menos 2 palabras coinciden
              const matchingWords = providerWords.filter(word => 
                contactWords.some(contactWord => contactWord.includes(word) || word.includes(contactWord))
              );
              
              if (matchingWords.length >= 2) {
                contactIban = iban;
                break;
              }
            }
          }
          
          // Si encontramos un IBAN del contacto y no hay uno en la factura, usarlo
          if (contactIban && (!row[20] || row[20] === '' || row[20] === null)) {
            const newRow = [...row];
            newRow[20] = contactIban; // Índice del IBAN
            return newRow;
          }
        }
        return row;
      });
      
      return enrichedData;
    } catch (error) {
      console.error('Error enriqueciendo datos con IBAN de contactos:', error);
      return processedData; // Retornar datos originales si hay error
    }
  };



  // Función para manejar el cambio de dataset con animación
  const handleDatasetChange = (newDataset) => {
    if (newDataset !== selectedDataset) {
      setIsChangingDataset(true);
      setTimeout(async () => {
        setSelectedDataset(newDataset);
        
        // Cargar datos específicos según el dataset seleccionado
        if (newDataset === 'idoni') {
          await loadIdoniData();
        }
        
        // Limpiar filtros al cambiar de dataset
        setSelectedProvider('');
        setSelectedChannel('');
        setExpandedProvider('');
        setSelectedMonth(''); // Resetear filtro de mes
        setShowMonthFilter(false); // Cerrar dropdown
        setIsChangingDataset(false);
      }, 100); // Pausa más corta para una transición más rápida
    }
  };

  // Obtener los datos y headers del dataset seleccionado (desde Supabase)
  const currentHeaders = selectedDataset === 'solucions' 
    ? supabaseData.solucions.headers 
    : selectedDataset === 'menjar'
    ? supabaseData.menjar.headers
    : supabaseData.idoni.headers;
  
  // Datos base sin filtrar
  const baseData = selectedDataset === 'solucions' 
    ? supabaseData.solucions.data 
    : selectedDataset === 'menjar'
    ? supabaseData.menjar.data
    : supabaseData.idoni.data;

  // Datos para gráficos de IDONI
  const idoniChartData = useMemo(() => {
    if (selectedDataset !== 'idoni') return null;
    const filteredData = getFilteredIdoniData(baseData);
    return processIdoniChartData(filteredData);
  }, [selectedDataset, baseData]);
  
  // Análisis avanzados de IDONI
  const idoniAnalytics = useMemo(() => {
    if (!idoniChartData) return null;
    return calculateIdoniAnalytics(idoniChartData.monthlyData, idoniChartData.weeklyData);
  }, [idoniChartData]);
  
  // Datos para la vista General (sin filtro de mes)
  const generalData = useMemo(() => {
    return baseData;
  }, [baseData]);
  
  // Datos para la vista Sergi (con filtro de mes si está seleccionado)
  const sergiData = useMemo(() => {
    if (!selectedMonth) return baseData;
    return filterDataByMonth(baseData, selectedMonth);
  }, [baseData, selectedMonth]);
  
  // Datos para la vista Bruno (sin filtro de mes)
  const brunoData = useMemo(() => {
    return baseData;
  }, [baseData]);

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
          // Convertir fechas usando parseSpanishDate para ordenamiento correcto
          if (aValue && bValue) {
            aValue = parseSpanishDate(aValue);
            bValue = parseSpanishDate(bValue);
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
          // Convertir fechas usando parseSpanishDate para ordenamiento correcto
          if (aValue && bValue) {
            aValue = parseSpanishDate(aValue);
            bValue = parseSpanishDate(bValue);
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
    if (!columnIndices.provider || generalData.length === 0) return [];
    const providers = new Set();
    generalData.forEach(row => {
      if (row[columnIndices.provider]) providers.add(row[columnIndices.provider]);
    });
    return Array.from(providers).sort();
  }, [generalData, columnIndices.provider]);

  // Calcular estadísticas por proveedor
  const providerStats = useMemo(() => {
    if (!columnIndices.provider || !columnIndices.total) return [];
    
    const stats = {};
    brunoData.forEach(row => {
      const provider = row[columnIndices.provider];
      const total = parseFloat(row[columnIndices.total]) || 0;
      const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
      const iban = columnIndices.iban ? row[columnIndices.iban] : '';
      
      if (provider) {
        if (!stats[provider]) {
          stats[provider] = {
            totalAmount: 0,
            totalPending: 0,
            invoiceCount: 0,
            invoices: [],
            iban: iban || ''
          };
        }
        stats[provider].totalAmount += total;
        stats[provider].totalPending += pending;
        stats[provider].invoiceCount += 1;
        stats[provider].invoices.push(row);
        // Actualizar IBAN si encontramos uno no vacío
        if (iban && !stats[provider].iban) {
          stats[provider].iban = iban;
        }
      }
    });
    
    return Object.entries(stats).map(([provider, data]) => ({
      provider,
      ...data
    })).sort((a, b) => b.totalAmount - a.totalAmount);
  }, [brunoData, columnIndices]);

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
    } else if (selectedDataset === 'idoni') {
      channels = {
        'Ventas Diarias': { total: 0, count: 0 },
        'Ventas por Hora': { total: 0, count: 0 },
        'Análisis Mensual': { total: 0, count: 0 },
        'Análisis por Día': { total: 0, count: 0 }
      };
    } else {
      return {};
    }
    
    sergiData.forEach(row => {
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
      } else if (selectedDataset === 'idoni') {
        // Para IDONI, usar la tienda como canal
        const tienda = row[2] || ''; // Índice de la tienda en los datos de IDONI
        if (tienda) {
          channel = tienda;
        } else {
          channel = 'Ventas Diarias';
        }
      }
      
      channels[channel].total += total;
      channels[channel].count += 1;
    });
    
    return channels;
  }, [sergiData, columnIndices, selectedDataset]);

  // Filtrar y ordenar datos según vista seleccionada
  const filteredData = useMemo(() => {
    let data = generalData;
    if (selectedProvider && columnIndices.provider) {
      data = generalData.filter(row => row[columnIndices.provider] === selectedProvider);
    }
    
    // Aplicar ordenamiento si hay configuración
    if (sortConfig.key) {
      data = sortData(data, sortConfig.key, sortConfig.direction);
    }
    
    return data;
  }, [generalData, selectedProvider, columnIndices.provider, sortConfig]);

  // Filtrar datos por canal seleccionado
  const channelFilteredData = useMemo(() => {
    if (!selectedChannel) return [];
    
    // Para IDONI, no necesitamos description y account
    if (selectedDataset === 'idoni') {
      return sergiData.filter(row => {
        const tienda = row[2] || ''; // Índice de la tienda
        return tienda === selectedChannel;
      });
    }
    
    if (!columnIndices.description || !columnIndices.account) return [];
    
    return sergiData.filter(row => {
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
  }, [sergiData, selectedChannel, columnIndices, selectedDataset]);

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
    : selectedDataset === 'menjar'
    ? '(Obrador, Estructura, Catering)'
    : '(Ventas Diarias, Ventas por Hora, Análisis Mensual, Análisis por Día)';

  const views = [
    { id: 'general', name: 'Vista General', description: 'Todas las facturas con columnas personalizables' },
    { id: 'sergi', name: 'Vista Sergi', description: `Análisis por canales ${sergiChannelsText}` },
    { id: 'bruno', name: 'Vista Bruno', description: 'Análisis de deudas por proveedor' }
  ];

  // Función mejorada para convertir fechas a formato legible
  function formatDate(dateValue) {
    if (!dateValue) return '-';
    
    // Si es un número (Excel date)
    if (typeof dateValue === 'number' && !isNaN(dateValue)) {
      const utc_days = Math.floor(dateValue - 25569);
      const utc_value = utc_days * 86400;
      const date_info = new Date(utc_value * 1000);
      
      if (dateValue % 1 !== 0) {
        const totalSeconds = Math.round(86400 * (dateValue % 1));
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        date_info.setHours(hours, minutes, seconds);
      }
      
      return date_info.toLocaleDateString('es-ES');
    }
    
    // Si es un string que contiene formato ISO
    if (typeof dateValue === 'string') {
      // Si es formato ISO (2025-07-13T22:00:00.000Z)
      if (dateValue.includes('T') && dateValue.includes('Z')) {
        const date = new Date(dateValue);
        return date.toLocaleDateString('es-ES');
      }
      
      // Si es un número en string
      if (/^\d+(\.\d+)?$/.test(dateValue)) {
        return formatDate(Number(dateValue));
      }
      
      // Si ya es una fecha en formato legible (DD/MM/YYYY)
      if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateValue)) {
        return dateValue; // Ya está en formato español
      }
      
      // Si es una fecha en formato YYYY-MM-DD
      if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateValue)) {
        const [year, month, day] = dateValue.split('-');
        return `${day}/${month}/${year}`;
      }
      
      // Si ya es una fecha en formato legible
      return dateValue;
    }
    
    // Si es un objeto Date
    if (dateValue instanceof Date) {
      return dateValue.toLocaleDateString('es-ES');
    }
    
    return dateValue;
  }

  // Función para parsear fecha en formato español (DD/MM/YYYY)
  function parseSpanishDate(dateString) {
    if (!dateString) return null;
    
    // Si es formato ISO
    if (dateString.includes('T') && dateString.includes('Z')) {
      return new Date(dateString);
    }
    
    // Si es un número (Excel date)
    if (typeof dateString === 'number' || /^\d+(\.\d+)?$/.test(dateString)) {
      const numValue = typeof dateString === 'number' ? dateString : Number(dateString);
      const utc_days = Math.floor(numValue - 25569);
      const utc_value = utc_days * 86400;
      return new Date(utc_value * 1000);
    }
    
    // Si es formato español DD/MM/YYYY
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateString)) {
      const [day, month, year] = dateString.split('/');
      return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Si es formato YYYY-MM-DD
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateString)) {
      return new Date(dateString);
    }
    
    return null;
  }

  // Función para obtener los meses disponibles en los datos
  function getAvailableMonths(data) {
    const months = new Set();
    
    data.forEach(row => {
      const dateValue = row[columnIndices.date]; // Usar el índice correcto de fecha
      if (dateValue) {
        const date = parseSpanishDate(dateValue);
        if (date && !isNaN(date.getTime())) {
          const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
          months.add(monthKey);
        }
      }
    });
    
    return Array.from(months).sort().reverse();
  }

  // Función para filtrar datos por mes
  function filterDataByMonth(data, monthKey) {
    if (!monthKey) return data;
    
    return data.filter(row => {
      const dateValue = row[0]; // Asumiendo que la primera columna es la fecha
      if (!dateValue) return false;
      
      const date = parseSpanishDate(dateValue);
      if (!date || isNaN(date.getTime())) return false;
      
      const rowMonthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return rowMonthKey === monthKey;
    });
  }

  // Función para obtener el nombre del mes
  function getMonthName(monthKey) {
    if (!monthKey) return 'Todos los meses';
    
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
  }

  // --- Unificar lógica de filtrado de facturas por canal ---
  function getChannelRows(channel, data, columnIndices) {
    return data.filter(row => {
      // Para IDONI, usar la tienda como canal
      if (selectedDataset === 'idoni') {
        const tienda = row[2] || ''; // Índice de la tienda
        return tienda === channel;
      }
      
      const description = (row[columnIndices.description] || '').toLowerCase();
      const account = (row[columnIndices.account] || '').toLowerCase();
      
      if (selectedDataset === 'solucions') {
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
      } else if (selectedDataset === 'menjar') {
        switch (channel) {
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
    const channelColors = {
      // Canales de Solucions Socials
      'catering': '#4CAF50',
      'estructura': '#2196F3',
      'idoni': '#E91E63',
      
      // Canales de Menjar D'Hort
      'obrador': '#FF9800',
      'catering': '#4CAF50',
      'estructura': '#2196F3',
      'menjar_d_hort': '#FF6B35',
      
      // Canales de IDONI
      'ventas diarias': '#FF5722',
      'ventas por hora': '#9C27B0',
      'análisis mensual': '#3F51B5',
      'análisis por día': '#009688',
      
      // Canales generales
      'otros': '#9E9E9E',
      'default': '#2196F3'
    };
    
    return channelColors[channel.toLowerCase()] || channelColors.default;
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
    return generalData.reduce((sum, row) => {
      const total = parseFloat(row[columnIndices.total]) || 0;
      return sum + total;
    }, 0);
  }, [generalData, columnIndices]);

  const totalAPagar = useMemo(() => {
    if (!columnIndices.total || columnIndices.estat === undefined) return 0;
    return generalData.reduce((sum, row) => {
      if (isPending(row, columnIndices)) {
        const total = parseFloat(row[columnIndices.total]) || 0;
        return sum + total;
      }
      return sum;
    }, 0);
  }, [generalData, columnIndices]);

  // Función para procesar datos de ventas por horas de IDONI
  const processIdoniHourlyData = (ventasHoras) => {
    if (!ventasHoras || ventasHoras.length === 0) return null;

    // Crear array simple de franjas horarias
    const franjas = [
      { nombre: '09:00-10:00', inicio: 9, fin: 10, ventas: 0, tickets: 0, tipo: 'preparacion' },
      { nombre: '10:00-11:00', inicio: 10, fin: 11, ventas: 0, tickets: 0, tipo: 'comercial' },
      { nombre: '11:00-12:00', inicio: 11, fin: 12, ventas: 0, tickets: 0, tipo: 'comercial' },
      { nombre: '12:00-13:00', inicio: 12, fin: 13, ventas: 0, tickets: 0, tipo: 'comercial' },
      { nombre: '13:00-14:00', inicio: 13, fin: 14, ventas: 0, tickets: 0, tipo: 'comercial' },
      { nombre: '14:00-15:00', inicio: 14, fin: 15, ventas: 0, tickets: 0, tipo: 'comercial' },
      { nombre: '15:00-16:00', inicio: 15, fin: 16, ventas: 0, tickets: 0, tipo: 'comercial' },
      { nombre: '16:00-17:00', inicio: 16, fin: 17, ventas: 0, tickets: 0, tipo: 'cierre' },
      { nombre: '17:00-18:00', inicio: 17, fin: 18, ventas: 0, tickets: 0, tipo: 'cierre' },
      { nombre: '18:00-20:00', inicio: 18, fin: 20, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '20:00-22:00', inicio: 20, fin: 22, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '22:00-00:00', inicio: 22, fin: 24, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '00:00-02:00', inicio: 0, fin: 2, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '02:00-04:00', inicio: 2, fin: 4, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '04:00-06:00', inicio: 4, fin: 6, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '06:00-07:00', inicio: 6, fin: 7, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '07:00-08:00', inicio: 7, fin: 8, ventas: 0, tickets: 0, tipo: 'correccion' },
      { nombre: '08:00-09:00', inicio: 8, fin: 9, ventas: 0, tickets: 0, tipo: 'correccion' }
    ];

    // Procesar cada venta por hora - SUMAR TODO SIN FILTROS
    let totalProcesado = 0;
    let registrosProcesados = 0;
    let registrosOmitidos = 0;
    
    ventasHoras.forEach((venta, index) => {
      if (!venta.hora) {
        registrosOmitidos++;
        return;
      }
      
      const importe = parseFloat(venta.total) || 0;

      // Extraer la hora del campo TIME
      const horaStr = venta.hora;
      let hora = 0;
      
      if (typeof horaStr === 'string') {
        const partes = horaStr.split(':');
        if (partes.length >= 2) {
          hora = parseInt(partes[0]);
        }
      } else if (typeof horaStr === 'number') {
        hora = Math.floor(horaStr * 24);
      }

      // Encontrar la franja horaria correspondiente
      let franjaEncontrada = false;
                      for (const franja of franjas) {
          if (hora >= franja.inicio && hora < franja.fin) {
            franja.ventas += importe;
            franja.tickets += 1;
            totalProcesado += importe;
            registrosProcesados++;
            break;
          }
        }
    });
    
          console.log('=== PROCESAMIENTO VENTAS POR HORAS ===');
      console.log('Total registros:', ventasHoras.length);
      console.log('Total procesado:', totalProcesado);

    return {
      franjasArray: franjas,
      totalVentas: franjas.reduce((sum, f) => sum + f.ventas, 0),
      totalTickets: franjas.reduce((sum, f) => sum + f.tickets, 0)
    };
  };

  // Función para calcular análisis de franjas horarias
  const calculateIdoniHourlyAnalytics = (hourlyData) => {
    if (!hourlyData || !hourlyData.franjasArray) return null;

    const franjas = hourlyData.franjasArray;
    
    // Encontrar mejor y peor franja por ventas
    const mejorFranjaVentas = franjas.reduce((max, franja) => 
      franja.ventas > max.ventas ? franja : max, franjas[0]);
    
    const peorFranjaVentas = franjas.reduce((min, franja) => 
      franja.ventas < min.ventas ? franja : min, franjas[0]);

    // Encontrar mejor y peor franja por tickets
    const mejorFranjaTickets = franjas.reduce((max, franja) => 
      franja.tickets > max.tickets ? franja : max, franjas[0]);
    
    const peorFranjaTickets = franjas.reduce((min, franja) => 
      franja.tickets < min.tickets ? franja : min, franjas[0]);

    // Análisis por tipo de franja
    const franjasComerciales = franjas.filter(f => f.tipo === 'comercial');
    const franjasCorreccion = franjas.filter(f => f.tipo === 'correccion');
    const franjasPreparacion = franjas.filter(f => f.tipo === 'preparacion');
    const franjasCierre = franjas.filter(f => f.tipo === 'cierre');

    // Mejor franja comercial
    const mejorFranjaComercial = franjasComerciales.reduce((max, franja) => 
      franja.ventas > max.ventas ? franja : max, franjasComerciales[0] || { ventas: 0 });

    // Peor franja comercial
    const peorFranjaComercial = franjasComerciales.reduce((min, franja) => 
      franja.ventas < min.ventas ? franja : min, franjasComerciales[0] || { ventas: 0 });

    // Total de correcciones
    const totalCorrecciones = franjasCorreccion.reduce((sum, f) => sum + f.ventas, 0);
    const ticketsCorrecciones = franjasCorreccion.reduce((sum, f) => sum + f.tickets, 0);

    // Calcular franja más consistente (menor desviación estándar)
    const ventas = franjas.map(f => f.ventas).filter(v => v > 0);
    const mediaVentas = ventas.reduce((sum, v) => sum + v, 0) / ventas.length;
    const varianza = ventas.reduce((sum, v) => sum + Math.pow(v - mediaVentas, 2), 0) / ventas.length;
    const desviacionEstandar = Math.sqrt(varianza);

    // Encontrar franja más consistente (más cercana a la media)
    const franjaMasConsistente = franjas.reduce((consistente, franja) => {
      if (franja.ventas === 0) return consistente;
      const distancia = Math.abs(franja.ventas - mediaVentas);
      const distanciaConsistente = Math.abs(consistente.ventas - mediaVentas);
      return distancia < distanciaConsistente ? franja : consistente;
    }, franjas[0]);

    // Calcular crecimiento entre franjas consecutivas
    const franjasConVentas = franjas.filter(f => f.ventas > 0);
    const crecimientoPromedio = franjasConVentas.length > 1 ? 
      (franjasConVentas[franjasConVentas.length - 1].ventas - franjasConVentas[0].ventas) / (franjasConVentas.length - 1) : 0;

    return {
      mejorFranjaVentas,
      peorFranjaVentas,
      mejorFranjaTickets,
      peorFranjaTickets,
      franjaMasConsistente,
      crecimientoPromedio,
      mediaVentas,
      desviacionEstandar,
      totalFranjas: franjas.length,
      franjasConActividad: franjas.filter(f => f.ventas > 0).length,
      
      // Análisis por tipo de franja
      mejorFranjaComercial,
      peorFranjaComercial,
      totalCorrecciones,
      ticketsCorrecciones,
      franjasComerciales: franjasComerciales.length,
      franjasCorreccion: franjasCorreccion.length,
      franjasPreparacion: franjasPreparacion.length,
      franjasCierre: franjasCierre.length
    };
  };

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
        Análisis de Compras
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
              {supabaseData.solucions.data.length > 0 ? `${supabaseData.solucions.data.length} compras de Holded` : 'No hay compras cargadas'}
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
              Menjar D'Hort
            </span>
            <span style={{ 
              fontSize: 13, 
              color: selectedDataset === 'menjar' ? colors.primary : colors.textSecondary, 
              marginTop: 2 
            }}>
              {supabaseData.menjar.data.length > 0 ? `${supabaseData.menjar.data.length} compras de Holded` : 'No hay compras cargadas'}
            </span>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.04, boxShadow: selectedDataset === 'idoni' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleDatasetChange('idoni')}
            style={{
              minWidth: 200,
              flex: '1 1 200px',
              background: colors.card,
              borderRadius: 12,
              boxShadow: selectedDataset === 'idoni' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
              border: selectedDataset === 'idoni' ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
              color: selectedDataset === 'idoni' ? colors.primary : colors.text,
              cursor: isChangingDataset ? 'not-allowed' : 'pointer',
              padding: '22px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              transition: 'all 0.18s',
              fontWeight: selectedDataset === 'idoni' ? 600 : 400,
              fontSize: 16,
              outline: selectedDataset === 'idoni' ? `2px solid ${colors.primary}` : 'none',
              position: 'relative',
              opacity: isChangingDataset ? 0.6 : 1
            }}
          >
            {/* Indicador de carga para IDONI */}
            <AnimatePresence>
              {isChangingDataset && selectedDataset === 'idoni' && (
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
              IDONI
            </span>
            <span style={{ 
              fontSize: 13, 
              color: selectedDataset === 'idoni' ? colors.primary : colors.textSecondary, 
              marginTop: 2 
            }}>
              {supabaseData.idoni.data.length > 0 ? `${supabaseData.idoni.data.length} ventas registradas` : 'No hay datos de ventas'}
            </span>
          </motion.div>
        </div>
      </motion.div>

      {/* Tarjetas de selección de vista - Solo mostrar para Holded */}
      {selectedDataset !== 'idoni' && (
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
      )}

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
              Esto puede tardar unos segundos
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
            No hay datos importados para {selectedDataset === 'solucions' ? 'Solucions Socials' : selectedDataset === 'menjar' ? 'Menjar d\'Hort' : 'IDONI'}. Por favor, importa un archivo Excel en la sección correspondiente.
          </motion.div>
        ) : selectedDataset === 'idoni' ? (
          // Interfaz específica para IDONI
          <motion.div
            key="idoni-content"
            initial={{ opacity: 0, y: 20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -20, scale: 0.98 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            style={{ display: 'flex', flexDirection: 'column', height: 'calc(100% - 80px)', gap: '24px' }}
          >
            {/* Descripción para IDONI */}
            <div style={{ marginBottom: 0, color: colors.textSecondary, fontSize: 15, minHeight: 22 }}>
              Análisis de ventas de IDONI - Datos de tienda y análisis temporal
            </div>
            
            {/* Contenido específico para IDONI */}
            <div style={{ background: colors.card, borderRadius: 8, boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>
                  Análisis de Ventas IDONI
                </h3>
                
                {/* Botones para cargar archivos Excel */}
                <div style={{ display: 'flex', gap: '12px' }}>
                  {/* Botón para ventas diarias */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleIdoniDiariasFileSelect}
                    disabled={uploadingIdoni}
                    style={{
                      background: colors.success,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: uploadingIdoni ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: uploadingIdoni ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {uploadingIdoni && uploadType === 'diarias' ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{
                            width: '16px',
                            height: '16px',
                            border: `2px solid transparent`,
                            borderTop: `2px solid white`,
                            borderRadius: '50%'
                          }}
                        />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        Ventas Diarias
                      </>
                    )}
                  </motion.button>
                  
                  {/* Botón para ventas por horas */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleIdoniHorasFileSelect}
                    disabled={uploadingIdoni}
                    style={{
                      background: colors.warning,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: uploadingIdoni ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: uploadingIdoni ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {uploadingIdoni && uploadType === 'horas' ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          style={{
                            width: '16px',
                            height: '16px',
                            border: `2px solid transparent`,
                            borderTop: `2px solid white`,
                            borderRadius: '50%'
                          }}
                        />
                        Cargando...
                      </>
                    ) : (
                      <>
                        <FileText size={16} />
                        Ventas por Horas
                      </>
                    )}
                  </motion.button>
                </div>
              </div>
              
              {/* Barra de progreso */}
              {uploadingIdoni && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: colors.surface,
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '20px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <span style={{ fontSize: '14px', color: colors.textSecondary }}>
                      Procesando archivo...
                    </span>
                    <span style={{ fontSize: '14px', color: colors.primary, fontWeight: '600' }}>
                      {uploadProgress}%
                    </span>
                  </div>
                  <div style={{
                    width: '100%',
                    height: '4px',
                    background: colors.border,
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress}%` }}
                      transition={{ duration: 0.3 }}
                      style={{
                        height: '100%',
                        background: colors.primary,
                        borderRadius: '2px'
                      }}
                    />
                  </div>
                </motion.div>
              )}
              
              {/* Inputs de archivo ocultos */}
              <input
                ref={idoniDiariasFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleIdoniDiariasFileChange}
                style={{ display: 'none' }}
              />
              <input
                ref={idoniHorasFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleIdoniHorasFileChange}
                style={{ display: 'none' }}
              />
              
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '20px', 
                marginBottom: '32px' 
              }}>
                <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                    Total Ventas
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.success, marginBottom: '8px' }}>
                    {formatCurrency(getFilteredIdoniData(baseData).reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0))}
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Ventas totales registradas
                  </div>
                </div>
                
                <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                    Total Tickets
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.primary, marginBottom: '8px' }}>
                    {getFilteredIdoniData(baseData).reduce((sum, row) => sum + (parseInt(row[5]) || 0), 0)}
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Número total de tickets
                  </div>
                </div>
                
                <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                  <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                    Media por Ticket
                  </h4>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.warning, marginBottom: '8px' }}>
                    {(() => {
                      const filteredData = getFilteredIdoniData(baseData);
                      const totalImport = filteredData.reduce((sum, row) => sum + (parseFloat(row[4]) || 0), 0);
                      const totalTickets = filteredData.reduce((sum, row) => sum + (parseInt(row[5]) || 0), 0);
                      return formatCurrency(totalTickets > 0 ? totalImport / totalTickets : 0);
                    })()}
                  </div>
                  <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                    Promedio por transacción
                  </div>
                </div>
              </div>
              
              {/* Tarjetas de análisis avanzado IDONI */}
              {idoniAnalytics && (
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                  gap: '20px', 
                  marginBottom: '32px' 
                }}>
                  <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                      Mejor Día
                    </h4>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.success, marginBottom: '8px' }}>
                      {idoniAnalytics.mejorDia.dia}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                      {formatCurrency(idoniAnalytics.mejorDia.ventas)} promedio
                    </div>
                  </div>
                  
                  <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                      Peor Día
                    </h4>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.error, marginBottom: '8px' }}>
                      {idoniAnalytics.peorDia.dia}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                      {formatCurrency(idoniAnalytics.peorDia.ventas)} promedio
                    </div>
                  </div>
                  
                  <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                      Día Más Consistente
                    </h4>
                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: colors.info, marginBottom: '8px' }}>
                      {idoniAnalytics.diaMasConsistente?.dia || 'N/A'}
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                      Menor variabilidad
                    </div>
                  </div>
                  
                  <div style={{ background: colors.surface, padding: '20px', borderRadius: '8px' }}>
                    <h4 style={{ margin: '0 0 12px 0', color: colors.text, fontSize: '16', fontWeight: 600, lineHeight: 1.2 }}>
                      Crecimiento Mensual
                    </h4>
                    <div style={{ 
                      fontSize: '24px', 
                      fontWeight: 'bold', 
                      color: idoniAnalytics.crecimientoMensual >= 0 ? colors.success : colors.error, 
                      marginBottom: '8px' 
                    }}>
                      {idoniAnalytics.crecimientoMensual >= 0 ? '+' : ''}{idoniAnalytics.crecimientoMensual.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                      Desde el primer mes
                    </div>
                  </div>
                </div>
              )}
              
              {/* Gráficos de análisis de ventas IDONI */}
              {idoniChartData && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  {/* Gráfico de ventas mensuales */}
                  <div style={{ background: colors.surface, borderRadius: '8px', padding: '20px' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16', fontWeight: 600 }}>
                      Ventas Mensuales
                    </h4>
                    <div style={{ height: '300px' }}>
                      <Bar
                        data={{
                          labels: Object.keys(idoniChartData.monthlyData).map(month => {
                            const [year, monthNum] = month.split('-');
                            return `${getMonthName(month)} ${year}`;
                          }),
                          datasets: [
                            {
                              label: 'Ventas (€)',
                              data: Object.values(idoniChartData.monthlyData).map(month => month.ventas),
                              backgroundColor: colors.primary,
                              borderColor: colors.primary,
                              borderWidth: 1,
                              borderRadius: 4,
                            },
                            {
                              label: 'Tickets',
                              data: Object.values(idoniChartData.monthlyData).map(month => month.tickets),
                              backgroundColor: colors.warning,
                              borderColor: colors.warning,
                              borderWidth: 1,
                              borderRadius: 4,
                              yAxisID: 'y1'
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'top',
                              labels: {
                                color: colors.text,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 20
                              }
                            },
                            tooltip: {
                              mode: 'index',
                              intersect: false,
                              backgroundColor: colors.background,
                              titleColor: colors.text,
                              bodyColor: colors.text,
                              borderColor: colors.border,
                              borderWidth: 1,
                              titleFont: {
                                size: 16,
                                weight: 'bold'
                              },
                              bodyFont: {
                                size: 14,
                                weight: 'bold'
                              },
                              padding: 12,
                              callbacks: {
                                title: function(context) {
                                  return context[0].label;
                                },
                                label: function(context) {
                                  return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                                },
                                afterBody: function(context) {
                                  const monthKey = Object.keys(idoniChartData.monthlyData)[context[0].dataIndex];
                                  const monthData = idoniChartData.monthlyData[monthKey];
                                  if (monthData) {
                                    const avgTicket = monthData.tickets > 0 ? monthData.ventas / monthData.tickets : 0;
                                    return [
                                      '',
                                      'Resumen del mes:',
                                      `   • Total: ${formatCurrency(monthData.ventas)}`,
                                      `   • Tickets: ${monthData.tickets.toLocaleString()}`,
                                      `   • Media/ticket: ${formatCurrency(avgTicket)}`
                                    ];
                                  }
                                  return '';
                                }
                              }
                            }
                          },
                          scales: {
                            x: {
                              grid: {
                                color: colors.border
                              },
                              ticks: {
                                color: colors.textSecondary
                              }
                            },
                            y: {
                              type: 'linear',
                              display: true,
                              position: 'left',
                              grid: {
                                color: colors.border
                              },
                              ticks: {
                                color: colors.textSecondary,
                                callback: function(value) {
                                  return formatCurrency(value);
                                }
                              },
                              title: {
                                display: true,
                                text: 'Ventas (€)',
                                color: colors.textSecondary
                              }
                            },
                            y1: {
                              type: 'linear',
                              display: true,
                              position: 'right',
                              grid: {
                                drawOnChartArea: false,
                              },
                              ticks: {
                                color: colors.textSecondary
                              },
                              title: {
                                display: true,
                                text: 'Tickets',
                                color: colors.textSecondary
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Gráfico de ventas por días de la semana */}
                  <div style={{ background: colors.surface, borderRadius: '8px', padding: '20px' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16', fontWeight: 600 }}>
                      Ventas por Días de la Semana
                    </h4>
                    <div style={{ height: '400px' }}>
                      <Line
                        data={{
                          labels: Object.keys(idoniChartData.weeklyData).map(month => {
                            const [year, monthNum] = month.split('-');
                            return `${getMonthName(month)} ${year}`;
                          }),
                          datasets: [
                            {
                              label: 'Domingo',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Domingo'].ventas
                              ),
                              borderColor: '#FF6B6B',
                              backgroundColor: '#FF6B6B20',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#FF6B6B',
                              pointBorderColor: '#FF6B6B',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Lunes',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Lunes'].ventas
                              ),
                              borderColor: '#4ECDC4',
                              backgroundColor: '#4ECDC420',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#4ECDC4',
                              pointBorderColor: '#4ECDC4',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Martes',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Martes'].ventas
                              ),
                              borderColor: '#6C5CE7',
                              backgroundColor: '#6C5CE720',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#6C5CE7',
                              pointBorderColor: '#6C5CE7',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Miércoles',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Miércoles'].ventas
                              ),
                              borderColor: '#00B894',
                              backgroundColor: '#00B89420',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#00B894',
                              pointBorderColor: '#00B894',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Jueves',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Jueves'].ventas
                              ),
                              borderColor: '#FDCB6E',
                              backgroundColor: '#FDCB6E20',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#FDCB6E',
                              pointBorderColor: '#FDCB6E',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Viernes',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Viernes'].ventas
                              ),
                              borderColor: '#E84393',
                              backgroundColor: '#E8439320',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#E84393',
                              pointBorderColor: '#E84393',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            },
                            {
                              label: 'Sábado',
                              data: Object.keys(idoniChartData.weeklyData).map(month => 
                                idoniChartData.weeklyData[month]['Sábado'].ventas
                              ),
                              borderColor: '#74B9FF',
                              backgroundColor: '#74B9FF20',
                              borderWidth: 2,
                              fill: false,
                              tension: 0.4,
                              pointStyle: 'circle',
                              pointBackgroundColor: '#74B9FF',
                              pointBorderColor: '#74B9FF',
                              pointBorderWidth: 2,
                              pointRadius: 6,
                              pointHoverRadius: 8
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              position: 'top',
                              labels: {
                                color: colors.text,
                                usePointStyle: true,
                                pointStyle: 'circle',
                                padding: 20
                              }
                            },
                            tooltip: {
                              mode: 'index',
                              intersect: false,
                              backgroundColor: colors.background,
                              titleColor: colors.text,
                              bodyColor: colors.text,
                              borderColor: colors.border,
                              borderWidth: 1,
                              titleFont: {
                                size: 14,
                                weight: 'bold'
                              },
                              bodyFont: {
                                size: 14,
                                weight: 'bold'
                              },
                              padding: 12,
                              callbacks: {
                                title: function(context) {
                                  return context[0].label;
                                },
                                label: function(context) {
                                  return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                                },
                                afterBody: function(context) {
                                  return '';
                                }
                              }
                            }
                          },
                          scales: {
                            x: {
                              grid: {
                                color: colors.border
                              },
                              ticks: {
                                color: colors.textSecondary
                              }
                            },
                            y: {
                              grid: {
                                color: colors.border
                              },
                              ticks: {
                                color: colors.textSecondary,
                                callback: function(value) {
                                  return formatCurrency(value);
                                }
                              },
                              title: {
                                display: true,
                                text: 'Ventas (€)',
                                color: colors.textSecondary
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}
              
              {/* Tabla comparativa de días de la semana */}
              {idoniAnalytics && (
                <div style={{ background: colors.surface, borderRadius: '8px', padding: '20px', marginTop: '24px' }}>
                  <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16', fontWeight: 600 }}>
                    Análisis por Días de la Semana
                  </h4>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                          <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                            Día
                          </th>
                          <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                            Promedio Ventas
                          </th>
                          <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                            Total Ventas
                          </th>
                          <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                            Promedio Tickets
                          </th>
                          <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                            Meses con Datos
                          </th>
                          <th style={{ padding: '12px', textAlign: 'center', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                            Rendimiento
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {Object.entries(idoniAnalytics.promediosPorDia)
                          .sort((a, b) => b[1].ventas - a[1].ventas)
                          .map(([dia, datos], index) => {
                            const esMejorDia = dia === idoniAnalytics.mejorDia.dia;
                            const esPeorDia = dia === idoniAnalytics.peorDia.dia;
                            const esMasConsistente = idoniAnalytics.diaMasConsistente?.dia === dia;
                            
                            return (
                              <tr key={dia} style={{ 
                                borderBottom: `1px solid ${colors.border}`,
                                backgroundColor: esMejorDia ? `${colors.success}10` : 
                                               esPeorDia ? `${colors.error}10` : 
                                               esMasConsistente ? `${colors.info}10` : 'transparent'
                              }}>
                                <td style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: esMejorDia || esPeorDia || esMasConsistente ? 600 : 400 }}>
                                  {dia}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600 }}>
                                  {formatCurrency(datos.ventas)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', color: colors.textSecondary }}>
                                  {formatCurrency(idoniAnalytics.totalesPorDia[dia].ventas)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', color: colors.textSecondary }}>
                                  {datos.tickets.toFixed(1)}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'right', color: colors.textSecondary }}>
                                  {datos.mesesConDatos}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <div style={{
                                    width: '60px',
                                    height: '8px',
                                    backgroundColor: colors.border,
                                    borderRadius: '4px',
                                    overflow: 'hidden',
                                    margin: '0 auto'
                                  }}>
                                    <div style={{
                                      width: `${(datos.ventas / idoniAnalytics.mejorDia.ventas) * 100}%`,
                                      height: '100%',
                                      backgroundColor: esMejorDia ? colors.success : 
                                                     esPeorDia ? colors.error : 
                                                     colors.primary,
                                      borderRadius: '4px'
                                    }} />
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Análisis de Ventas por Horas */}
              {idoniHourlyData && idoniHourlyAnalytics && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: 18, fontWeight: 600 }}>
                    Análisis de Ventas por Franjas Horarias (Enero-Julio)
                  </h3>

                  
                  {/* Tarjetas de resumen de franjas horarias */}
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    marginBottom: '24px'
                  }}>
                    <div style={{
                      background: colors.surface,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ color: colors.success, fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                        {idoniHourlyAnalytics.mejorFranjaComercial?.nombre || 'N/A'}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: '12px' }}>Mejor Hora Comercial</div>
                    </div>
                    
                    <div style={{
                      background: colors.surface,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ color: colors.error, fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                        {idoniHourlyAnalytics.peorFranjaComercial?.nombre || 'N/A'}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: '12px' }}>Peor Hora Comercial</div>
                    </div>
                    
                    <div style={{
                      background: colors.surface,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ color: colors.warning, fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                        {formatCurrency(idoniHourlyAnalytics.totalCorrecciones)}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: '12px' }}>Total Correcciones</div>
                    </div>
                    
                    <div style={{
                      background: colors.surface,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ color: colors.primary, fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                        {idoniHourlyAnalytics.franjasComerciales}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: '12px' }}>Horas Comerciales</div>
                    </div>
                    
                    <div style={{
                      background: colors.surface,
                      padding: '16px',
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{ color: colors.info, fontSize: '24px', fontWeight: '700', marginBottom: '4px' }}>
                        {formatCurrency(idoniHourlyData?.totalVentas || 0)}
                      </div>
                      <div style={{ color: colors.textSecondary, fontSize: '12px' }}>Total Ventas por Horas</div>
                    </div>
                  </div>

                  {/* Gráfico de ventas por franjas horarias */}
                  <div style={{ background: colors.surface, borderRadius: '8px', padding: '20px', marginBottom: '24px' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16', fontWeight: 600 }}>
                      Ventas por Franjas Horarias
                    </h4>
                                        <div style={{ height: '400px' }}>
                      <Bar
                        data={{
                          labels: idoniHourlyChartData.labels,
                          datasets: [
                            {
                              label: 'Ventas (€)',
                              data: idoniHourlyChartData.data,
                              backgroundColor: idoniHourlyChartData.backgroundColor,
                              borderColor: idoniHourlyChartData.borderColor,
                              borderWidth: 2,
                              borderRadius: 4
                            }
                          ]
                        }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                              display: false
                            },
                            tooltip: {
                              backgroundColor: colors.background,
                              titleColor: colors.text,
                              bodyColor: colors.text,
                              borderColor: colors.border,
                              borderWidth: 1,
                              titleFont: {
                                size: 14,
                                weight: 'bold'
                              },
                              bodyFont: {
                                size: 14,
                                weight: 'bold'
                              },
                              padding: 12,
                              callbacks: {
                                title: function(context) {
                                  return context[0].label;
                                },
                                label: function(context) {
                                  return `Ventas: ${formatCurrency(context.parsed.y)}`;
                                },
                                afterBody: function(context) {
                                  const franja = idoniHourlyData.franjasArray.find(f => f.nombre === context[0].label);
                                  
                                  if (franja) {
                                    const tipoLabels = {
                                      'comercial': 'Horario Comercial',
                                      'correccion': 'Corrección de Tickets',
                                      'preparacion': 'Preparación',
                                      'cierre': 'Cierre'
                                    };
                                    
                                    const mediaPorTicket = franja.tickets > 0 ? franja.ventas / franja.tickets : 0;
                                    
                                    return [
                                      '',
                                      'Detalles de la franja:',
                                      `   • Tipo: ${tipoLabels[franja.tipo] || franja.tipo}`,
                                      `   • Tickets: ${franja.tickets}`,
                                      `   • Media/ticket: ${formatCurrency(mediaPorTicket)}`
                                    ];
                                  }
                                  return '';
                                }
                              }
                            }
                          },
                          scales: {
                            x: {
                              grid: {
                                color: colors.border
                              },
                              ticks: {
                                color: colors.textSecondary
                              }
                            },
                            y: {
                              grid: {
                                color: colors.border
                              },
                              ticks: {
                                color: colors.textSecondary,
                                callback: function(value) {
                                  return formatCurrency(value);
                                }
                              },
                              title: {
                                display: true,
                                text: 'Ventas (€)',
                                color: colors.textSecondary
                              }
                            }
                          }
                        }}
                      />
                    </div>
                  </div>

                  {/* Tabla comparativa de franjas horarias */}
                  <div style={{ background: colors.surface, borderRadius: '8px', padding: '20px' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16', fontWeight: 600 }}>
                      Análisis Detallado por Franjas Horarias
                    </h4>
                    <div style={{ 
                      overflowX: 'auto',
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${colors.border} transparent`
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                        <thead>
                          <tr>
                            <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                              Franja Horaria
                            </th>
                            <th style={{ padding: '12px', textAlign: 'center', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                              Tipo
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                              Ventas (€)
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                              Tickets
                            </th>
                            <th style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                              Media/Ticket
                            </th>
                            <th style={{ padding: '12px', textAlign: 'center', color: colors.text, fontWeight: 600, fontSize: '14px' }}>
                              Rendimiento
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {idoniHourlyData.franjasArray
                            .sort((a, b) => b.ventas - a.ventas)
                            .map((franja, index) => {
                                                             const esMejorFranjaComercial = franja.nombre === idoniHourlyAnalytics.mejorFranjaComercial?.nombre;
                               const esPeorFranjaComercial = franja.nombre === idoniHourlyAnalytics.peorFranjaComercial?.nombre;
                               
                               const tipoLabels = {
                                 'comercial': 'Comercial',
                                 'correccion': 'Corrección',
                                 'preparacion': 'Preparación',
                                 'cierre': 'Cierre'
                               };
                               
                               const tipoColors = {
                                 'comercial': colors.primary,
                                 'correccion': colors.warning,
                                 'preparacion': colors.info,
                                 'cierre': colors.error
                               };
                               
                               return (
                                 <tr key={franja.nombre} style={{ 
                                   borderBottom: `1px solid ${colors.border}`,
                                   backgroundColor: esMejorFranjaComercial ? `${colors.success}10` : 
                                                  esPeorFranjaComercial ? `${colors.error}10` : 'transparent'
                                 }}>
                                   <td style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: esMejorFranjaComercial || esPeorFranjaComercial ? 600 : 400 }}>
                                     {franja.nombre}
                                   </td>
                                   <td style={{ padding: '12px', textAlign: 'center' }}>
                                     <span style={{
                                       padding: '4px 8px',
                                       borderRadius: '4px',
                                       fontSize: '12px',
                                       fontWeight: '500',
                                       backgroundColor: `${tipoColors[franja.tipo]}20`,
                                       color: tipoColors[franja.tipo],
                                       border: `1px solid ${tipoColors[franja.tipo]}40`
                                     }}>
                                       {tipoLabels[franja.tipo]}
                                     </span>
                                   </td>
                                   <td style={{ padding: '12px', textAlign: 'right', color: colors.text, fontWeight: 600 }}>
                                     {formatCurrency(franja.ventas)}
                                   </td>
                                   <td style={{ padding: '12px', textAlign: 'right', color: colors.textSecondary }}>
                                     {franja.tickets}
                                   </td>
                                   <td style={{ padding: '12px', textAlign: 'right', color: colors.textSecondary }}>
                                     {formatCurrency(franja.tickets > 0 ? franja.ventas / franja.tickets : 0)}
                                   </td>
                                   <td style={{ padding: '12px', textAlign: 'center' }}>
                                     <div style={{
                                       width: '60px',
                                       height: '8px',
                                       backgroundColor: colors.border,
                                       borderRadius: '4px',
                                       overflow: 'hidden',
                                       margin: '0 auto'
                                     }}>
                                       <div style={{
                                         width: `${(franja.ventas / idoniHourlyAnalytics.mejorFranjaComercial.ventas) * 100}%`,
                                         height: '100%',
                                         backgroundColor: esMejorFranjaComercial ? colors.success : 
                                                        esPeorFranjaComercial ? colors.error : 
                                                        tipoColors[franja.tipo],
                                         borderRadius: '4px'
                                       }} />
                                     </div>
                                   </td>
                                 </tr>
                               );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                                  ? (col.index !== undefined && row[col.index] ? formatDate(row[col.index]) : '')
                                  : col.key === 'total' || col.key === 'pending' || col.key === 'subtotal'
                                    ? (col.index !== undefined && row[col.index] ? formatCurrency(row[col.index]) : '-')
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

                {/* Filtro por Meses - Solo en vista Sergi */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  style={{
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    flexWrap: 'wrap',
                    position: 'relative'
                  }}
                >
                  <div 
                    data-month-filter
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      padding: '8px 16px',
                      background: colors.card,
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      userSelect: 'none'
                    }}
                    onClick={() => setShowMonthFilter(!showMonthFilter)}
                  >
                    <Filter size={16} color={colors.text} />
                    <span style={{ color: colors.text, fontSize: '14px', fontWeight: '500' }}>
                      {selectedMonth ? getMonthName(selectedMonth) : 'Todos los meses'}
                    </span>
                    {selectedMonth && (
                      <span style={{
                        background: colors.primary + '22',
                        color: colors.primary,
                        fontSize: '11px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: '500'
                      }}>
                        Filtrado
                      </span>
                    )}
                  </div>

                  {/* Dropdown de meses */}
                  <AnimatePresence>
                    {showMonthFilter && (
                      <motion.div
                        data-month-filter
                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          background: colors.card,
                          borderRadius: '8px',
                          border: `1px solid ${colors.border}`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                          zIndex: 1000,
                          minWidth: '200px',
                          maxHeight: '300px',
                          overflowY: 'auto'
                        }}
                      >
                        <div
                          style={{
                            padding: '8px 12px',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s ease',
                            borderBottom: `1px solid ${colors.border}`,
                            background: !selectedMonth ? colors.hover : 'transparent',
                            color: colors.text,
                            fontSize: '14px',
                            fontWeight: '500'
                          }}
                          onClick={() => {
                            setSelectedMonth('');
                            setShowMonthFilter(false);
                          }}
                        >
                          Todos los meses
                        </div>
                        {getAvailableMonths(baseData).map(monthKey => (
                          <div
                            key={monthKey}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s ease',
                              borderBottom: `1px solid ${colors.border}`,
                              background: selectedMonth === monthKey ? colors.hover : 'transparent',
                              color: colors.text,
                              fontSize: '14px'
                            }}
                            onClick={() => {
                              setSelectedMonth(monthKey);
                              setShowMonthFilter(false);
                            }}
                          >
                            {getMonthName(monthKey)}
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
                
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
                    const channelRows = getChannelRows(channel, sergiData, columnIndices);
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
                      
                      <div style={{ 
                        overflowX: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${colors.border} transparent`
                      }}>
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
                                  {row[columnIndices.date] ? formatDate(row[columnIndices.date]) : '-'}
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
                          {sergiData.length} facturas encontradas
                          {selectedMonth && baseData.length !== sergiData.length && (
                            <span style={{ color: colors.primary, fontWeight: '600' }}>
                              {' '}(filtradas de {baseData.length})
                            </span>
                          )}
                        </span>
                      </div>
                      <div style={{ 
                        overflowX: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${colors.border} transparent`
                      }}>
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
                              const groupedData = sergiData.reduce((acc, row) => {
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
                                
                                if (!acc[displayKey]) {
                                  acc[displayKey] = { 
                                    total: 0, 
                                    count: 0, 
                                    channel, 
                                    description, 
                                    account
                                  };
                                }
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
                  <div style={{ 
                    overflowX: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${colors.border} transparent`
                  }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
                      <thead>
                        <tr>
                          <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>Proveedor</th>
                          <th style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', textAlign: 'left', color: colors.primary, fontWeight: 600, background: colors.surface }}>IBAN</th>
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
                                <td style={{ borderBottom: `1px solid ${colors.border}`, padding: '12px 8px', color: colors.textSecondary, fontSize: '13px', fontFamily: 'monospace' }}>
                                  {stat.iban || '-'}
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
                                    <td colSpan="5" style={{ padding: 0, border: 'none' }}>
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
                                        <div style={{ 
                                          overflowX: 'auto',
                                          scrollbarWidth: 'thin',
                                          scrollbarColor: `${colors.border} transparent`
                                        }}>
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
                                                    {invoice[columnIndices.date] ? formatDate(invoice[columnIndices.date]) : '-'}
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

      {/* Componente de alerta */}
      <AnimatePresence>
        {showAlert && (
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
              backgroundColor: alertType === 'success' ? colors.success + '22' : colors.error + '22',
              border: `1px solid ${alertType === 'success' ? colors.success : colors.error}`,
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
              backgroundColor: alertType === 'success' ? colors.success : colors.error,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              {alertType === 'success' ? (
                <Check size={14} color="white" />
              ) : (
                <X size={14} color="white" />
              )}
            </div>
            <div style={{
              flex: 1,
              fontSize: '15px',
              fontWeight: '500',
              color: colors.text,
              lineHeight: '1.4'
            }}>
              {alertMessage}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AnalyticsPage; 