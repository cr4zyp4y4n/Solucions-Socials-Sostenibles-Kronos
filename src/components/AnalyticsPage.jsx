import React, { useState, useMemo, useRef, Fragment, useEffect } from 'react';
import { useDataContext } from './DataContext';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import holdedApi from '../services/holdedApi';
import { brunoInvoicesService } from '../services/brunoInvoicesService';
import { solucionsInvoicesService } from '../services/solucionsInvoicesService';
import { Calendar, Filter, Upload, FileText, Check, X, ChevronDown, ChevronRight, Download } from 'lucide-react';
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

  // Estados para ventas de productos de IDONI
  const [idoniProductosData, setIdoniProductosData] = useState(null);
  const [idoniProductosAnalytics, setIdoniProductosAnalytics] = useState(null);
  const [uploadingIdoniProductos, setUploadingIdoniProductos] = useState(false);
  const [uploadTypeProductos, setUploadTypeProductos] = useState(''); // 'productos'
  const [productosSearchTerm, setProductosSearchTerm] = useState('');
  const [productosNuevoFormatoSearchTerm, setProductosNuevoFormatoSearchTerm] = useState('');

  // Estados para visibilidad de facturas
  const [solucionsInvoicesData, setSolucionsInvoicesData] = useState([]);
  const [loadingSolucionsInvoices, setLoadingSolucionsInvoices] = useState(false);

  
  // Estados para modal de ocultar factura
  const [showHideModal, setShowHideModal] = useState(false);
  const [selectedInvoiceForHide, setSelectedInvoiceForHide] = useState(null);
  const [hideReason, setHideReason] = useState('');

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
  const idoniProductosFileInputRef = useRef(null);
  const idoniProductosImporteFileInputRef = useRef(null);
  const idoniProductosCantidadFileInputRef = useRef(null);

  // Filtrar productos según el término de búsqueda
  const filteredProductos = useMemo(() => {
    if (!idoniProductosData || !idoniProductosData.productosArray) return [];
    
    if (!productosSearchTerm.trim()) {
      return idoniProductosData.productosArray;
    }
    
    const searchTerm = productosSearchTerm.toLowerCase();
    return idoniProductosData.productosArray.filter(producto => 
      producto.codi.toLowerCase().includes(searchTerm) ||
      producto.descripcio.toLowerCase().includes(searchTerm)
    );
  }, [idoniProductosData, productosSearchTerm]);

  // Filtrar productos del nuevo formato según el término de búsqueda
  const filteredProductosNuevoFormato = useMemo(() => {
    if (!idoniProductosData || !idoniProductosData.productosArray) return [];
    
    if (!productosNuevoFormatoSearchTerm.trim()) {
      return idoniProductosData.productosArray;
    }
    
    const searchTerm = productosNuevoFormatoSearchTerm.toLowerCase();
    return idoniProductosData.productosArray.filter(producto => 
      producto.codi.toLowerCase().includes(searchTerm) ||
      producto.descripcio.toLowerCase().includes(searchTerm)
    );
  }, [idoniProductosData, productosNuevoFormatoSearchTerm]);

  // Cargar datos desde Holded al montar el componente
  useEffect(() => {
    loadDataFromHolded();
    loadBrunoData(); // Cargar datos de Bruno
    loadSolucionsData(); // Cargar datos de Solucions
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
      loadBrunoData(); // Cargar datos de Bruno
      loadSolucionsData(); // Cargar datos de Solucions
      markTabUpdated('analytics');
    }
  }, []);

  // Escuchar cambios en shouldReloadHolded para recargar datos
  useEffect(() => {
    if (shouldReloadHolded) {
      loadDataFromHolded();
      loadBrunoData(); // Cargar datos de Bruno
      loadSolucionsData(); // Cargar datos de Solucions
      setShouldReloadHolded(false);
    }
  }, [shouldReloadHolded]);



  // Función para cargar datos desde Holded con filtrado de visibilidad
  const loadDataFromHolded = async () => {
    setLoading(true);
    setError('');

    try {
      // Obtener el rol del usuario actual
      const userRole = user?.user_metadata?.role || 'user';
      
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

      // Sincronizar datos de Holded con las tablas de facturas
      // Usar los datos originales de Holded (objetos), no los arrays procesados
      const allHoldedData = [...solucionsPurchases, ...menjarPurchases];
      
      // Sincronizar con bruno_invoices (para la vista de Bruno)
      await brunoInvoicesService.syncHoldedData(allHoldedData);
      
      // Sincronizar con solucions_invoices (para la vista de Solucions)
      await solucionsInvoicesService.syncHoldedData(solucionsPurchases);

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

  // Función simplificada para filtrar datos por visibilidad
  // Función para cargar datos de Bruno desde la nueva tabla
  const loadBrunoData = async () => {
    try {
      setLoading(true);
      
      // Obtener facturas de Bruno según el rol del usuario
      let { data: brunoInvoices, error } = user?.user_metadata?.role === 'manager' 
        ? await brunoInvoicesService.getVisibleInvoices()
        : await brunoInvoicesService.getAllInvoices();
      
      if (error) {
        console.error('Error cargando datos de Bruno:', error);
        return;
      }

      console.log('📊 Datos de Bruno cargados:', brunoInvoices?.length || 0, 'facturas');
      
      // Convertir datos al formato esperado por el componente
      const processedData = brunoInvoices?.map(invoice => [
        invoice.invoice_number,
        invoice.provider,
        invoice.issue_date,
        invoice.total,
        invoice.status,
        invoice.pending,
        invoice.description,
        invoice.due_date,
        invoice.subtotal,
        invoice.vat,
        invoice.retention,
        invoice.employees,
        invoice.equipment_recovery,
        invoice.payment_date,
        invoice.tags,
        invoice.account,
        invoice.project,
        invoice.holded_id,
        invoice.holded_contact_id,
        invoice.document_type
      ]) || [];

      setGeneralData(processedData);
      setBrunoData(processedData);
      
    } catch (error) {
      console.error('Error cargando datos de Bruno:', error);
    } finally {
      setLoading(false);
    }
  };

  // Función para cargar datos de Solucions desde la nueva tabla
  const loadSolucionsData = async () => {
    try {
      setLoadingSolucionsInvoices(true);
      
      // Obtener facturas de Solucions según el rol del usuario
      let { data: solucionsInvoices, error } = user?.user_metadata?.role === 'manager' 
        ? await solucionsInvoicesService.getVisibleInvoices()
        : await solucionsInvoicesService.getAllInvoices();
      
      if (error) {
        console.error('Error cargando datos de Solucions:', error);
        return;
      }

      console.log('📊 Datos de Solucions cargados:', solucionsInvoices?.length || 0, 'facturas');
      
      // Convertir datos al formato esperado por el componente
      const processedData = solucionsInvoices?.map(invoice => [
        invoice.invoice_number,
        invoice.provider,
        invoice.issue_date,
        invoice.total,
        invoice.status,
        invoice.pending,
        invoice.description,
        invoice.due_date,
        invoice.subtotal,
        invoice.vat,
        invoice.retention,
        invoice.employees,
        invoice.equipment_recovery,
        invoice.payment_date,
        invoice.tags,
        invoice.account,
        invoice.project,
        invoice.holded_id,
        invoice.holded_contact_id,
        invoice.document_type
      ]) || [];

      setSolucionsInvoicesData(processedData);
      
    } catch (error) {
      console.error('Error cargando datos de Solucions:', error);
    } finally {
      setLoadingSolucionsInvoices(false);
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

      // Cargar datos de ventas de productos por importe
      let ventasProductosImporte = [];
      try {
        const { data: productosImporteData, error: errorImporte } = await supabase
          .from('idoni_ventas_productos_importe')
          .select('*')
          .order('data_importacio', { ascending: false });

        if (errorImporte) {
          console.warn('Tabla idoni_ventas_productos_importe no existe aún. Error:', errorImporte);
          ventasProductosImporte = [];
        } else {
          ventasProductosImporte = productosImporteData || [];
        }
      } catch (error) {
        console.warn('Error cargando ventas de productos por importe de IDONI:', error);
        ventasProductosImporte = [];
      }

      // Cargar datos de ventas de productos por cantidad
      let ventasProductosCantidad = [];
      try {
        const { data: productosCantidadData, error: errorCantidad } = await supabase
          .from('idoni_ventas_productos_cantidad')
          .select('*')
          .order('data_importacio', { ascending: false });

        if (errorCantidad) {
          console.warn('Tabla idoni_ventas_productos_cantidad no existe aún. Error:', errorCantidad);
          ventasProductosCantidad = [];
        } else {
          ventasProductosCantidad = productosCantidadData || [];
        }
      } catch (error) {
        console.warn('Error cargando ventas de productos por cantidad de IDONI:', error);
        ventasProductosCantidad = [];
      }

      // Procesar datos de IDONI
      const processedIdoniData = processIdoniData(ventasDiarias, ventasHoras);

      // Procesar datos agrupados por día
      const groupedData = processIdoniGroupedData(ventasDiarias);

      // Procesar datos de ventas por horas
      const hourlyData = processIdoniHourlyData(ventasHoras);
      const hourlyAnalytics = calculateIdoniHourlyAnalytics(hourlyData);

      // Procesar datos de ventas de productos (nuevo formato)
      const productosData = (ventasProductosImporte.length > 0 || ventasProductosCantidad.length > 0) 
        ? processIdoniProductosNuevoFormato(ventasProductosImporte, ventasProductosCantidad) 
        : null;
      const productosAnalytics = productosData ? calculateIdoniProductosNuevoFormatoAnalytics(productosData) : null;





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
      setIdoniProductosData(productosData);
      setIdoniProductosAnalytics(productosAnalytics);

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
        } else if (newDataset === 'bruno') {
          await loadBrunoData();
        } else if (newDataset === 'solucions') {
          await loadSolucionsData();
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
    ? ['Número', 'Proveedor', 'Fecha', 'Total', 'Estado', 'Pendiente', 'Descripción', 'Vencimiento', 'Subtotal', 'IVA', 'Retención', 'Empleados', 'Equipos', 'Pago', 'Etiquetas', 'Cuenta', 'Proyecto', 'Holded ID', 'Contacto', 'Tipo']
    : selectedDataset === 'menjar'
    ? supabaseData.menjar.headers
    : selectedDataset === 'bruno'
    ? ['Número', 'Proveedor', 'Fecha', 'Total', 'Estado', 'Pendiente', 'Descripción', 'Vencimiento', 'Subtotal', 'IVA', 'Retención', 'Empleados', 'Equipos', 'Pago', 'Etiquetas', 'Cuenta', 'Proyecto', 'Holded ID', 'Contacto', 'Tipo']
    : supabaseData.idoni.headers;
  
  // Datos base sin filtrar
  const baseData = selectedDataset === 'solucions' 
    ? solucionsInvoicesData
    : selectedDataset === 'menjar'
    ? supabaseData.menjar.data
    : selectedDataset === 'bruno'
    ? brunoData
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
        // Para facturas pendientes, usar el monto pendiente en lugar del total
        const amountToAdd = pending > 0 ? pending : total;
        stats[provider].totalAmount += amountToAdd;
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
      const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
      
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
      
      // Para facturas pendientes, usar el monto pendiente en lugar del total
      const amountToAdd = pending > 0 ? pending : total;
      channels[channel].total += amountToAdd;
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
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    
    const monthName = monthNames[parseInt(month) - 1];
    return `${monthName} ${year}`;
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

  // ========================================
  // FUNCIONES DE VISIBILIDAD DE FACTURAS
  // ========================================

  // Función para abrir modal de ocultar factura
  const openHideModal = (invoice) => {
    setSelectedInvoiceForHide(invoice);
    setHideReason('');
    setShowHideModal(true);
  };

  // Función para cerrar modal de ocultar factura
  const closeHideModal = () => {
    setShowHideModal(false);
    setSelectedInvoiceForHide(null);
    setHideReason('');
  };

  // Función para ocultar una factura
  const hideInvoice = async (invoice, reason = '') => {
    try {
      if (!user) {
        showAlertMessage('Debes iniciar sesión para ocultar facturas', 'error');
        return false;
      }

      console.log('Intentando ocultar factura:', invoice);

      // Encontrar la factura en brunoData por número de factura
      const brunoInvoice = brunoData.find(row => row[0] === invoice[0]); // Comparar por número de factura
      
      if (!brunoInvoice) {
        showAlertMessage('No se encontró la factura en la base de datos de Bruno', 'error');
        return false;
      }

      // Obtener el ID de la factura desde la base de datos
      const { data: invoiceData, error: fetchError } = await brunoInvoicesService.getAllInvoices();
      
      if (fetchError) {
        showAlertMessage('Error obteniendo datos de la factura', 'error');
        return false;
      }

      const dbInvoice = invoiceData.find(inv => inv.invoice_number === invoice[0]);
      
      if (!dbInvoice) {
        showAlertMessage('No se encontró la factura en la base de datos', 'error');
        return false;
      }

      const result = await brunoInvoicesService.hideInvoice(dbInvoice.id, reason);

      if (result.error) {
        const errorMessage = extractErrorMessage(result.error);
        showAlertMessage(errorMessage, 'error');
        return false;
      }

      showAlertMessage('Factura ocultada correctamente', 'success');
      // Recargar datos de Bruno para reflejar los cambios
      await loadBrunoData();
      closeHideModal();
      return true;
      
    } catch (error) {
      console.error('Error al ocultar factura:', error);
      const errorMessage = extractErrorMessage(error);
      showAlertMessage(errorMessage, 'error');
      return false;
    }
  };

  // Función para verificar si el usuario actual puede ocultar facturas
  const canHideInvoices = () => {
    return user && (user.user_metadata?.role === 'management' || user.user_metadata?.role === 'admin');
  };

  // Función helper para extraer mensajes de error de Supabase
  const extractErrorMessage = (error) => {
    if (typeof error === 'string') return error;
    if (error?.message) return error.message;
    if (error?.details) return error.details;
    if (error?.hint) return error.hint;
    return 'Error desconocido';
  };

  // Función helper para crear identificador único de factura
  const createInvoiceIdentifier = (invoice, columnIndices) => {
    const invoiceNumber = invoice[columnIndices.invoiceNumber] || '';
    const provider = invoice[columnIndices.provider] || '';
    const date = invoice[columnIndices.date] || '';
    
    if (!invoiceNumber || !provider || !date) {
      return null;
    }
    
    // Crear un identificador único y limpio
    const cleanInvoiceNumber = invoiceNumber.toString().replace(/[^a-zA-Z0-9]/g, '_');
    const cleanProvider = provider.toString().replace(/[^a-zA-Z0-9]/g, '_');
    const cleanDate = date.toString().replace(/[^a-zA-Z0-9]/g, '_');
    
    return `${cleanInvoiceNumber}_${cleanProvider}_${cleanDate}`;
  };

  // Función para obtener el estado de pago de una factura
  const getInvoicePaymentStatus = (invoice, columnIndices) => {
    if (!columnIndices.status) return 'unknown';
    
    const status = invoice[columnIndices.status]?.toLowerCase() || '';
    
    if (status.includes('paid') || status.includes('pagado')) return 'paid';
    if (status.includes('partially') || status.includes('parcial')) return 'partially_paid';
    if (status.includes('pending') || status.includes('pendiente')) return 'pending';
    if (status.includes('overdue') || status.includes('vencido')) return 'overdue';
    
    // Si no hay estado, verificar si hay monto pendiente
    if (columnIndices.pending) {
      const pending = parseFloat(invoice[columnIndices.pending]) || 0;
      if (pending > 0) return 'pending';
    }
    
    return 'unknown';
  };

  // Función para verificar si una factura está oculta para el rol manager
  const isInvoiceHiddenForManager = async (invoice) => {
    try {
      // Crear el mismo identificador que se usa para ocultar
      const invoiceNumber = invoice[columnIndices.invoiceNumber];
      const provider = invoice[columnIndices.provider];
      const issueDate = invoice[columnIndices.date];
      
      const cleanInvoiceNumber = (invoiceNumber || '').toString().replace(/[^a-zA-Z0-9]/g, '_');
      const cleanProvider = (provider || '').toString().replace(/[^a-zA-Z0-9]/g, '_');
      const cleanDate = (issueDate || '').toString().replace(/[^a-zA-Z0-9]/g, '_');
      
      const invoiceIdentifier = `${cleanInvoiceNumber}_${cleanProvider}_${cleanDate}`;
      
      const result = await invoiceVisibilityService.isInvoiceHiddenForRole(invoiceIdentifier, 'manager');
      return result.data || false;
    } catch (error) {
      console.error('Error verificando si factura está oculta:', error);
      return false;
    }
  };



  // Calcular total facturado y total a pagar (solo pendientes o vencidas)
  const totalFacturado = useMemo(() => {
    if (!columnIndices.total) return 0;
    return generalData.reduce((sum, row) => {
      const total = parseFloat(row[columnIndices.total]) || 0;
      const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
      // Para facturas pendientes, usar el monto pendiente en lugar del total
      const amountToAdd = pending > 0 ? pending : total;
      return sum + amountToAdd;
    }, 0);
  }, [generalData, columnIndices]);

  const totalAPagar = useMemo(() => {
    if (!columnIndices.total || columnIndices.estat === undefined) return 0;
    return generalData.reduce((sum, row) => {
      if (isPending(row, columnIndices)) {
        const total = parseFloat(row[columnIndices.total]) || 0;
        const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
        // Para facturas pendientes, usar el monto pendiente en lugar del total
        const amountToAdd = pending > 0 ? pending : total;
        return sum + amountToAdd;
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

  // Función para procesar archivo Excel de ventas de productos de IDONI
  const processIdoniProductosExcel = async (file) => {
    setUploadingIdoniProductos(true);
    setUploadProgress(0);
    setUploadTypeProductos('productos');

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
            
            // Encontrar la fila de headers
            const bestHeaderIdx = findIdoniProductosHeaderRow(json);
            
            if (bestHeaderIdx === -1 || bestHeaderIdx >= json.length) {
              throw new Error('No se encontraron headers válidos para ventas de productos');
            }
            
            // Combinar headers de las dos filas anteriores
            const headerRow1 = json[bestHeaderIdx - 1] || [];
            const headerRow2 = json[bestHeaderIdx] || [];
            
            const headers = headerRow1.map((cell1, index) => {
              const cell2 = headerRow2[index] || '';
              const header1 = typeof cell1 === 'string' ? cell1.trim() : '';
              const header2 = typeof cell2 === 'string' ? cell2.trim() : '';
              
              // Combinar headers (ej: "Article" + "Codi" = "Article Codi")
              if (header1 && header2) {
                return `${header1} ${header2}`.trim();
              } else if (header1) {
                return header1;
              } else if (header2) {
                return header2;
              }
              return '';
            });
            
        
            
            // Validar que los headers no estén vacíos
            if (!headers || headers.length === 0) {
              throw new Error('Los headers del archivo están vacíos');
            }
            
            const rawRows = json.slice(bestHeaderIdx + 1);
            const filteredRows = rawRows.filter(row => isValidIdoniProductosRow(row, headers));
            
            if (filteredRows.length === 0) {
              throw new Error('No se encontraron filas válidas en el archivo');
            }
            
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
      await uploadIdoniProductosToSupabase(processedData.data, processedData.headers);
      setUploadProgress(80);

      // Paso 3: Recargar datos
      await loadIdoniData();
      setUploadProgress(100);

      showAlertMessage(`Archivo de IDONI ventas de productos procesado correctamente. Se importaron ${processedData.data.length} filas de datos.`, 'success');

    } catch (error) {
      showAlertMessage(`Error al procesar el archivo: ${error.message}`, 'error');
    } finally {
      setUploadingIdoniProductos(false);
      setUploadProgress(0);
      setUploadTypeProductos('');
    }
  };

  // Función para encontrar la fila de headers en archivo Excel de ventas de productos de IDONI
  const findIdoniProductosHeaderRow = (rows) => {
    const expectedHeaders = ['Article Codi', 'Article Descripció', 'Quantitat Unit.', 'Quantitat Kgs.', 'Venda PVP', 'Venda Import', 'Cost Preu', 'Cost Import', 'Marge sobre Cost %', 'Marge sobre Cost Import', 'Operacions'];
    

    
    // Buscar patrón de headers divididos en dos filas
    for (let i = 0; i < Math.min(rows.length - 1, 10); i++) {
      const row1 = rows[i] || [];
      const row2 = rows[i + 1] || [];
      
      
      
      // Combinar headers de ambas filas
      const combinedHeaders = row1.map((cell1, index) => {
        const cell2 = row2[index] || '';
        const header1 = typeof cell1 === 'string' ? cell1.trim() : '';
        const header2 = typeof cell2 === 'string' ? cell2.trim() : '';
        
        // Combinar headers (ej: "Article" + "Codi" = "Article Codi")
        if (header1 && header2) {
          return `${header1} ${header2}`.trim();
        } else if (header1) {
          return header1;
        } else if (header2) {
          return header2;
        }
        return '';
      });
      
      
      
      // Verificar si los headers combinados coinciden con los esperados
      let score = 0;
      const foundHeaders = [];
      
      for (const expected of expectedHeaders) {
        const found = combinedHeaders.some(combinedHeader => {
          if (combinedHeader) {
            const combinedLower = combinedHeader.toLowerCase().trim();
            const expectedLower = expected.toLowerCase().trim();
            const matches = combinedLower.includes(expectedLower) || expectedLower.includes(combinedLower);
            if (matches) {
              foundHeaders.push(combinedHeader);
            }
            return matches;
          }
          return false;
        });
        
        if (found) {
          score++;
        }
      }
      
      
      
      // Si encontramos suficientes headers, usar la segunda fila como punto de inicio
      if (score >= 5) {

        return i + 1; // Retornar la fila después de los headers
      }
    }
    

    return -1;
  };

  // Función para validar filas de datos de ventas de productos de IDONI
  const isValidIdoniProductosRow = (row, headers) => {
    if (!row || row.length < 3) return false;
    
    
    
    // Verificar que al menos tenga código de artículo
    const codiIndex = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('codi')
    );
    
    
    
    if (codiIndex === -1) {
      
      return false;
    }
    
    const codi = row[codiIndex];
    
    
    // Debe tener código válido (no vacío)
    if (!codi || (typeof codi === 'string' && codi.trim() === '')) {
      
      return false;
    }
    
    // Verificar que al menos una columna numérica tenga valor
    const numericIndices = ['Quantitat Unit.', 'Quantitat Kgs.', 'Venda PVP', 'Venda Import', 'Cost Preu', 'Cost Import', 'Marge sobre Cost Import'];
    const hasNumericValue = numericIndices.some(headerName => {
      const index = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes(headerName.toLowerCase())
      );
      if (index !== -1) {
        const value = row[index];
        return value !== null && value !== undefined && value !== '' && !isNaN(parseFloat(value));
      }
      return false;
    });
    
    
    
    return hasNumericValue;
  };

  // Función para subir datos de ventas de productos de IDONI a Supabase
  const uploadIdoniProductosToSupabase = async (data, headers) => {
    try {
      // Primero, eliminar todos los datos existentes
      try {
        const { error: deleteError } = await supabase
          .from('idoni_ventas_productos')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todos excepto un registro dummy

        if (deleteError) {
          console.error('Error limpiando datos existentes de ventas de productos:', deleteError);
          throw new Error(`Error limpiando datos existentes: ${deleteError.message}`);
        }


      } catch (error) {
        console.warn('No se pudieron eliminar datos existentes (tabla puede no existir):', error);
        // Continuar con la inserción
      }

      // Preparar datos para inserción
      if (!headers || headers.length === 0) {
        throw new Error('Headers no disponibles para procesar los datos');
      }
      
      
      
      const productosToInsert = data.map(row => {
        
        
        // Encontrar índices de las columnas basándose en los headers reales
        const findColumnIndex = (headerName) => {
          return headers.findIndex(h => 
            typeof h === 'string' && h.toLowerCase().includes(headerName.toLowerCase())
          );
        };
        
        const codiIndex = findColumnIndex('Codi');
        const descripcioIndex = findColumnIndex('Descripció');
        const unitIndex = findColumnIndex('Unit.');
        const kgsIndex = findColumnIndex('Kgs.');
        const pvpIndex = findColumnIndex('PVP');
        
        // Buscar los diferentes campos "Import" por posición
        const vendaImportIndex = headers.findIndex(h => 
          typeof h === 'string' && h.toLowerCase().includes('import') && 
          headers.indexOf(h) < headers.findIndex(h2 => h2 && h2.toLowerCase().includes('preu'))
        );
        const costImportIndex = headers.findIndex(h => 
          typeof h === 'string' && h.toLowerCase().includes('import') && 
          headers.indexOf(h) > headers.findIndex(h2 => h2 && h2.toLowerCase().includes('preu'))
        );
        const margeImportIndex = headers.findIndex(h => 
          typeof h === 'string' && h.toLowerCase().includes('import') && 
          headers.indexOf(h) > costImportIndex
        );
        
        const costPreuIndex = findColumnIndex('Preu');
        const margePercentIndex = findColumnIndex('%');
                const operacionsIndex = findColumnIndex('Operacions');
        
        return {
          article_codi: codiIndex !== -1 ? (row[codiIndex] || '') : '',
          article_descripcio: descripcioIndex !== -1 ? (row[descripcioIndex] || '') : '',
          quantitat_unit: unitIndex !== -1 ? (parseInt(row[unitIndex]) || 0) : 0,
          quantitat_kgs: kgsIndex !== -1 ? (parseFloat(row[kgsIndex]) || 0) : 0,
          venda_pvp: pvpIndex !== -1 ? (parseFloat(row[pvpIndex]) || 0) : 0,
          venda_import: vendaImportIndex !== -1 ? (parseFloat(row[vendaImportIndex]) || 0) : 0,
          cost_preu: costPreuIndex !== -1 ? (parseFloat(row[costPreuIndex]) || 0) : 0,
          cost_import: costImportIndex !== -1 ? (parseFloat(row[costImportIndex]) || 0) : 0,
          marge_sobre_cost_percent: margePercentIndex !== -1 ? (parseFloat(row[margePercentIndex]) || 0) : 0,
          marge_sobre_cost_import: margeImportIndex !== -1 ? (parseFloat(row[margeImportIndex]) || 0) : 0,
          operacions: operacionsIndex !== -1 ? (row[operacionsIndex] || '') : '',
          data_venta: new Date().toISOString().split('T')[0] // Fecha actual como fallback
        };
      });

      // Insertar nuevos datos
      try {
        const { error: insertError } = await supabase
          .from('idoni_ventas_productos')
          .insert(productosToInsert);

        if (insertError) {
          console.error('Error insertando datos de ventas de productos:', insertError);
          throw new Error(`Error insertando datos: ${insertError.message}`);
        }


      } catch (error) {
        console.error('Error insertando datos de ventas de productos:', error);
        throw new Error(`La tabla idoni_ventas_productos no existe. Por favor, ejecuta el script SQL en Supabase primero.`);
      }

    } catch (error) {
      console.error('Error subiendo datos de ventas de productos de IDONI:', error);
      throw error;
    }
  };

  // Función para manejar la selección de archivo de ventas de productos de IDONI
  const handleIdoniProductosFileSelect = () => {
    if (uploadingIdoniProductos) {
      return;
    }
    idoniProductosFileInputRef.current.click();
  };

  // Función para manejar el cambio de archivo de ventas de productos de IDONI
  const handleIdoniProductosFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processIdoniProductosExcel(file);
    }
    e.target.value = '';
  };

  // Función para procesar datos de ventas de productos de IDONI
  const processIdoniProductosData = (ventasProductos) => {
    if (!ventasProductos || ventasProductos.length === 0) return null;

    // Agrupar productos por código y descripción
    const productosAgrupados = {};
    
    ventasProductos.forEach(producto => {
      const key = `${producto.article_codi}_${producto.article_descripcio}`;
      
      if (!productosAgrupados[key]) {
        productosAgrupados[key] = {
          codi: producto.article_codi,
          descripcio: producto.article_descripcio,
          totalUnit: 0,
          totalKgs: 0,
          totalVendaImport: 0,
          totalCostImport: 0,
          totalMargeImport: 0,
          count: 0,
          pvpIndividual: parseFloat(producto.venda_pvp) || 0,
          costIndividual: parseFloat(producto.cost_preu) || 0,
          pvpPromedio: 0,
          costPromedio: 0,
          margePromedio: 0
        };
      }
      
      const p = productosAgrupados[key];
      p.totalUnit += parseInt(producto.quantitat_unit) || 0;
      p.totalKgs += parseFloat(producto.quantitat_kgs) || 0;
      p.totalVendaImport += parseFloat(producto.venda_import) || 0;
      p.totalCostImport += parseFloat(producto.cost_import) || 0;
      p.totalMargeImport += parseFloat(producto.marge_sobre_cost_import) || 0;
      p.count += 1;
    });

    // Calcular promedios y convertir a array
    const productosArray = Object.values(productosAgrupados).map(producto => ({
      ...producto,
      pvpPromedio: producto.count > 0 ? producto.totalVendaImport / producto.count : 0,
      costPromedio: producto.count > 0 ? producto.totalCostImport / producto.count : 0,
      margePromedio: producto.count > 0 ? producto.totalMargeImport / producto.count : 0
    }));

    // Ordenar por total de ventas (descendente)
    productosArray.sort((a, b) => b.totalVendaImport - a.totalVendaImport);

    return {
      productosArray,
      totalProductos: productosArray.length,
      totalVentas: productosArray.reduce((sum, p) => sum + p.totalVendaImport, 0),
      totalCostos: productosArray.reduce((sum, p) => sum + p.totalCostImport, 0),
      totalMargen: productosArray.reduce((sum, p) => sum + p.totalMargeImport, 0),
      totalUnidades: productosArray.reduce((sum, p) => sum + p.totalUnit, 0),
      totalKilos: productosArray.reduce((sum, p) => sum + p.totalKgs, 0)
    };
  };

  // Función para calcular análisis de ventas de productos de IDONI
  const calculateIdoniProductosAnalytics = (productosData) => {
    if (!productosData || !productosData.productosArray) return null;

    const productos = productosData.productosArray;
    
    // Top 10 productos por ventas
    const top10PorVentas = productos.slice(0, 10);
    
    // Top 10 productos por margen
    const top10PorMargen = [...productos].sort((a, b) => b.totalMargeImport - a.totalMargeImport).slice(0, 10);
    
    // Top 10 productos por unidades vendidas
    const top10PorUnidades = [...productos].sort((a, b) => b.totalUnit - a.totalUnit).slice(0, 10);
    
    // Productos con mayor margen porcentual
    const productosConMargen = productos.filter(p => p.totalCostImport > 0);
    const top10PorMargenPorcentual = productosConMargen
      .sort((a, b) => (b.totalMargeImport / b.totalCostImport) - (a.totalMargeImport / a.totalCostImport))
      .slice(0, 10);

    // Calcular estadísticas generales
    const margenPromedio = productosData.totalCostos > 0 ? 
      (productosData.totalMargen / productosData.totalCostos) * 100 : 0;
    
    const ventaPromedioPorProducto = productosData.totalProductos > 0 ? 
      productosData.totalVentas / productosData.totalProductos : 0;

    return {
      top10PorVentas,
      top10PorMargen,
      top10PorUnidades,
      top10PorMargenPorcentual,
      margenPromedio,
      ventaPromedioPorProducto,
      totalProductos: productosData.totalProductos,
      totalVentas: productosData.totalVentas,
      totalCostos: productosData.totalCostos,
      totalMargen: productosData.totalMargen,
      totalUnidades: productosData.totalUnidades,
      totalKilos: productosData.totalKilos
    };
  };

  // ===== NUEVAS FUNCIONES PARA EL NUEVO FORMATO DE VENTAS POR PRODUCTOS =====

  // Función para procesar Excel de ventas por productos por importe (nuevo formato)
  const processIdoniProductosImporteExcel = async (file) => {
    setUploadingIdoniProductos(true);
    setUploadProgress(0);
    setUploadTypeProductos('productos_importe');

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
            
            // Encontrar la fila de headers
            const bestHeaderIdx = findIdoniProductosImporteHeaderRow(json);
            
            if (bestHeaderIdx === -1 || bestHeaderIdx >= json.length) {
              throw new Error('No se encontraron headers válidos para ventas de productos por importe');
            }
            
            const headers = json[bestHeaderIdx] || [];
            
            // Validar que los headers no estén vacíos
            if (!headers || headers.length === 0) {
              throw new Error('Los headers del archivo están vacíos');
            }
            
            const rawRows = json.slice(bestHeaderIdx + 1);
            const filteredRows = rawRows.filter(row => isValidIdoniProductosImporteRow(row, headers));
            
            if (filteredRows.length === 0) {
              throw new Error('No se encontraron filas válidas en el archivo');
            }
            
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
      await uploadIdoniProductosImporteToSupabase(processedData.data, processedData.headers);
      setUploadProgress(80);

      // Paso 3: Recargar datos
      await loadIdoniData();
      setUploadProgress(100);

      showAlertMessage(`Archivo de IDONI ventas de productos por importe procesado correctamente. Se importaron ${processedData.data.length} filas de datos.`, 'success');

    } catch (error) {
      showAlertMessage(`Error al procesar el archivo: ${error.message}`, 'error');
    } finally {
      setUploadingIdoniProductos(false);
      setUploadProgress(0);
      setUploadTypeProductos('');
    }
  };

  // Función para procesar Excel de ventas por productos por cantidad (nuevo formato)
  const processIdoniProductosCantidadExcel = async (file) => {
    setUploadingIdoniProductos(true);
    setUploadProgress(0);
    setUploadTypeProductos('productos_cantidad');

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
            
            // Encontrar la fila de headers
            const bestHeaderIdx = findIdoniProductosCantidadHeaderRow(json);
            
            if (bestHeaderIdx === -1 || bestHeaderIdx >= json.length) {
              throw new Error('No se encontraron headers válidos para ventas de productos por cantidad');
            }
            
            const headers = json[bestHeaderIdx] || [];
            
            // Validar que los headers no estén vacíos
            if (!headers || headers.length === 0) {
              throw new Error('Los headers del archivo están vacíos');
            }
            
            const rawRows = json.slice(bestHeaderIdx + 1);
            const filteredRows = rawRows.filter(row => isValidIdoniProductosCantidadRow(row, headers));
            
            if (filteredRows.length === 0) {
              throw new Error('No se encontraron filas válidas en el archivo');
            }
            
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
      await uploadIdoniProductosCantidadToSupabase(processedData.data, processedData.headers);
      setUploadProgress(80);

      // Paso 3: Recargar datos
      await loadIdoniData();
      setUploadProgress(100);

      showAlertMessage(`Archivo de IDONI ventas de productos por cantidad procesado correctamente. Se importaron ${processedData.data.length} filas de datos.`, 'success');

    } catch (error) {
      showAlertMessage(`Error al procesar el archivo: ${error.message}`, 'error');
    } finally {
      setUploadingIdoniProductos(false);
      setUploadProgress(0);
      setUploadTypeProductos('');
    }
  };

  // Función para encontrar la fila de headers en archivo Excel de ventas de productos por importe
  const findIdoniProductosImporteHeaderRow = (rows) => {
    const expectedHeaders = ['Codi', 'Descripció', 'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre', 'TOTAL'];
    
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i] || [];
      let score = 0;
      
      for (const expected of expectedHeaders) {
        const found = row.some(cell => {
          if (cell && typeof cell === 'string') {
            const cellLower = cell.toLowerCase().trim();
            const expectedLower = expected.toLowerCase().trim();
            return cellLower.includes(expectedLower) || expectedLower.includes(cellLower);
          }
          return false;
        });
        
        if (found) {
          score++;
        }
      }
      
      // Si encontramos suficientes headers, usar esta fila
      if (score >= 8) {
        return i;
      }
    }
    
    return -1;
  };

  // Función para encontrar la fila de headers en archivo Excel de ventas de productos por cantidad
  const findIdoniProductosCantidadHeaderRow = (rows) => {
    const expectedHeaders = ['Codi', 'Descripció', 'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre', 'TOTAL'];
    
    for (let i = 0; i < Math.min(rows.length, 10); i++) {
      const row = rows[i] || [];
      let score = 0;
      
      for (const expected of expectedHeaders) {
        const found = row.some(cell => {
          if (cell && typeof cell === 'string') {
            const cellLower = cell.toLowerCase().trim();
            const expectedLower = expected.toLowerCase().trim();
            return cellLower.includes(expectedLower) || expectedLower.includes(cellLower);
          }
          return false;
        });
        
        if (found) {
          score++;
        }
      }
      
      // Si encontramos suficientes headers, usar esta fila
      if (score >= 8) {
        return i;
      }
    }
    
    return -1;
  };

  // Función para validar filas de datos de ventas de productos por importe
  const isValidIdoniProductosImporteRow = (row, headers) => {
    if (!row || row.length < 3) return false;
    
    // Verificar que al menos tenga código de producto
    const codiIndex = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('codi')
    );
    
    if (codiIndex === -1) {
      return false;
    }
    
    const codi = row[codiIndex];
    
    // Debe tener código válido (no vacío)
    if (!codi || (typeof codi === 'string' && codi.trim() === '')) {
      return false;
    }
    
    // Verificar que al menos una columna de mes tenga valor numérico
    const monthHeaders = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre', 'TOTAL'];
    const hasNumericValue = monthHeaders.some(monthName => {
      const index = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes(monthName.toLowerCase())
      );
      if (index !== -1) {
        const value = row[index];
        return value !== null && value !== undefined && value !== '' && !isNaN(parseFloat(value));
      }
      return false;
    });
    
    return hasNumericValue;
  };

  // Función para validar filas de datos de ventas de productos por cantidad
  const isValidIdoniProductosCantidadRow = (row, headers) => {
    if (!row || row.length < 3) return false;
    
    // Verificar que al menos tenga código de producto
    const codiIndex = headers.findIndex(h => 
      typeof h === 'string' && h.toLowerCase().includes('codi')
    );
    
    if (codiIndex === -1) {
      return false;
    }
    
    const codi = row[codiIndex];
    
    // Debe tener código válido (no vacío)
    if (!codi || (typeof codi === 'string' && codi.trim() === '')) {
      return false;
    }
    
    // Verificar que al menos una columna de mes tenga valor numérico
    const monthHeaders = ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre', 'TOTAL'];
    const hasNumericValue = monthHeaders.some(monthName => {
      const index = headers.findIndex(h => 
        typeof h === 'string' && h.toLowerCase().includes(monthName.toLowerCase())
      );
      if (index !== -1) {
        const value = row[index];
        return value !== null && value !== undefined && value !== '' && !isNaN(parseFloat(value));
      }
      return false;
    });
    
    return hasNumericValue;
  };

  // Función para subir datos de ventas de productos por importe a Supabase
  const uploadIdoniProductosImporteToSupabase = async (data, headers) => {
    try {
      // Primero, eliminar todos los datos existentes de productos por importe
      try {
        const { error: deleteError } = await supabase
          .from('idoni_ventas_productos_importe')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          console.error('Error limpiando datos existentes de ventas de productos por importe:', deleteError);
          throw new Error(`Error limpiando datos existentes: ${deleteError.message}`);
        }
      } catch (error) {
        console.warn('No se pudieron eliminar datos existentes (tabla puede no existir):', error);
        // Continuar con la inserción
      }

      // Preparar datos para inserción
      if (!headers || headers.length === 0) {
        throw new Error('Headers no disponibles para procesar los datos');
      }
      
      const productosToInsert = data.map(row => {
        // Encontrar índices de las columnas
        const findColumnIndex = (headerName) => {
          return headers.findIndex(h => 
            typeof h === 'string' && h.toLowerCase().includes(headerName.toLowerCase())
          );
        };
        
        const codiIndex = findColumnIndex('Codi');
        const descripcioIndex = findColumnIndex('Descripció');
        const generIndex = findColumnIndex('Gener');
        const febrerIndex = findColumnIndex('Febrer');
        const marcIndex = findColumnIndex('Març');
        const abrilIndex = findColumnIndex('Abril');
        const maigIndex = findColumnIndex('Maig');
        const junyIndex = findColumnIndex('Juny');
        const juliolIndex = findColumnIndex('Juliol');
        const agostIndex = findColumnIndex('Agost');
        const setembreIndex = findColumnIndex('Setembre');
        const octubreIndex = findColumnIndex('Octubre');
        const novembreIndex = findColumnIndex('Novembre');
        const desembreIndex = findColumnIndex('Desembre');
        const totalIndex = findColumnIndex('TOTAL');
        
        return {
          codi: codiIndex !== -1 ? (row[codiIndex] || '') : '',
          descripcio: descripcioIndex !== -1 ? (row[descripcioIndex] || '') : '',
          gener: generIndex !== -1 ? (parseFloat(row[generIndex]) || 0) : 0,
          febrer: febrerIndex !== -1 ? (parseFloat(row[febrerIndex]) || 0) : 0,
          marc: marcIndex !== -1 ? (parseFloat(row[marcIndex]) || 0) : 0,
          abril: abrilIndex !== -1 ? (parseFloat(row[abrilIndex]) || 0) : 0,
          maig: maigIndex !== -1 ? (parseFloat(row[maigIndex]) || 0) : 0,
          juny: junyIndex !== -1 ? (parseFloat(row[junyIndex]) || 0) : 0,
          juliol: juliolIndex !== -1 ? (parseFloat(row[juliolIndex]) || 0) : 0,
          agost: agostIndex !== -1 ? (parseFloat(row[agostIndex]) || 0) : 0,
          setembre: setembreIndex !== -1 ? (parseFloat(row[setembreIndex]) || 0) : 0,
          octubre: octubreIndex !== -1 ? (parseFloat(row[octubreIndex]) || 0) : 0,
          novembre: novembreIndex !== -1 ? (parseFloat(row[novembreIndex]) || 0) : 0,
          desembre: desembreIndex !== -1 ? (parseFloat(row[desembreIndex]) || 0) : 0,
          total: totalIndex !== -1 ? (parseFloat(row[totalIndex]) || 0) : 0,
          data_importacio: new Date().toISOString().split('T')[0]
        };
      });

      // Insertar nuevos datos
      try {
        const { error: insertError } = await supabase
          .from('idoni_ventas_productos_importe')
          .insert(productosToInsert);

        if (insertError) {
          console.error('Error insertando datos de ventas de productos por importe:', insertError);
          
          // Manejar errores específicos de RLS
          if (insertError.code === '42501') {
            throw new Error(`Error de permisos: ${insertError.message}. Por favor, ejecuta el script SQL actualizado en Supabase.`);
          } else {
            throw new Error(`Error insertando datos: ${insertError.message}`);
          }
        }
      } catch (error) {
        console.error('Error insertando datos de ventas de productos por importe:', error);
        
        // Si es un error de tabla no existente, dar instrucciones específicas
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          throw new Error(`La tabla idoni_ventas_productos_importe no existe. Por favor, ejecuta el script SQL en Supabase primero.`);
        } else {
          throw error;
        }
      }

    } catch (error) {
      console.error('Error subiendo datos de ventas de productos por importe de IDONI:', error);
      throw error;
    }
  };

  // Función para subir datos de ventas de productos por cantidad a Supabase
  const uploadIdoniProductosCantidadToSupabase = async (data, headers) => {
    try {
      // Primero, eliminar todos los datos existentes de productos por cantidad
      try {
        const { error: deleteError } = await supabase
          .from('idoni_ventas_productos_cantidad')
          .delete()
          .neq('id', '00000000-0000-0000-0000-000000000000');

        if (deleteError) {
          console.error('Error limpiando datos existentes de ventas de productos por cantidad:', deleteError);
          throw new Error(`Error limpiando datos existentes: ${deleteError.message}`);
        }
      } catch (error) {
        console.warn('No se pudieron eliminar datos existentes (tabla puede no existir):', error);
        // Continuar con la inserción
      }

      // Preparar datos para inserción
      if (!headers || headers.length === 0) {
        throw new Error('Headers no disponibles para procesar los datos');
      }
      
      const productosToInsert = data.map(row => {
        // Encontrar índices de las columnas
        const findColumnIndex = (headerName) => {
          return headers.findIndex(h => 
            typeof h === 'string' && h.toLowerCase().includes(headerName.toLowerCase())
          );
        };
        
        const codiIndex = findColumnIndex('Codi');
        const descripcioIndex = findColumnIndex('Descripció');
        const generIndex = findColumnIndex('Gener');
        const febrerIndex = findColumnIndex('Febrer');
        const marcIndex = findColumnIndex('Març');
        const abrilIndex = findColumnIndex('Abril');
        const maigIndex = findColumnIndex('Maig');
        const junyIndex = findColumnIndex('Juny');
        const juliolIndex = findColumnIndex('Juliol');
        const agostIndex = findColumnIndex('Agost');
        const setembreIndex = findColumnIndex('Setembre');
        const octubreIndex = findColumnIndex('Octubre');
        const novembreIndex = findColumnIndex('Novembre');
        const desembreIndex = findColumnIndex('Desembre');
        const totalIndex = findColumnIndex('TOTAL');
        
        return {
          codi: codiIndex !== -1 ? (row[codiIndex] || '') : '',
          descripcio: descripcioIndex !== -1 ? (row[descripcioIndex] || '') : '',
          gener: generIndex !== -1 ? (parseFloat(row[generIndex]) || 0) : 0,
          febrer: febrerIndex !== -1 ? (parseFloat(row[febrerIndex]) || 0) : 0,
          marc: marcIndex !== -1 ? (parseFloat(row[marcIndex]) || 0) : 0,
          abril: abrilIndex !== -1 ? (parseFloat(row[abrilIndex]) || 0) : 0,
          maig: maigIndex !== -1 ? (parseFloat(row[maigIndex]) || 0) : 0,
          juny: junyIndex !== -1 ? (parseFloat(row[junyIndex]) || 0) : 0,
          juliol: juliolIndex !== -1 ? (parseFloat(row[juliolIndex]) || 0) : 0,
          agost: agostIndex !== -1 ? (parseFloat(row[agostIndex]) || 0) : 0,
          setembre: setembreIndex !== -1 ? (parseFloat(row[setembreIndex]) || 0) : 0,
          octubre: octubreIndex !== -1 ? (parseFloat(row[octubreIndex]) || 0) : 0,
          novembre: novembreIndex !== -1 ? (parseFloat(row[novembreIndex]) || 0) : 0,
          desembre: desembreIndex !== -1 ? (parseFloat(row[desembreIndex]) || 0) : 0,
          total: totalIndex !== -1 ? (parseFloat(row[totalIndex]) || 0) : 0,
          data_importacio: new Date().toISOString().split('T')[0]
        };
      });

      // Insertar nuevos datos
      try {
        const { error: insertError } = await supabase
          .from('idoni_ventas_productos_cantidad')
          .insert(productosToInsert);

        if (insertError) {
          console.error('Error insertando datos de ventas de productos por cantidad:', insertError);
          
          // Manejar errores específicos de RLS
          if (insertError.code === '42501') {
            throw new Error(`Error de permisos: ${insertError.message}. Por favor, ejecuta el script SQL actualizado en Supabase.`);
          } else {
            throw new Error(`Error insertando datos: ${insertError.message}`);
          }
        }
      } catch (error) {
        console.error('Error insertando datos de ventas de productos por cantidad:', error);
        
        // Si es un error de tabla no existente, dar instrucciones específicas
        if (error.message.includes('relation') || error.message.includes('does not exist')) {
          throw new Error(`La tabla idoni_ventas_productos_cantidad no existe. Por favor, ejecuta el script SQL en Supabase primero.`);
        } else {
          throw error;
        }
      }

    } catch (error) {
      console.error('Error subiendo datos de ventas de productos por cantidad de IDONI:', error);
      throw error;
    }
  };

  // Función para manejar la selección de archivo de ventas de productos por importe
  const handleIdoniProductosImporteFileSelect = () => {
    if (uploadingIdoniProductos) {
      return;
    }
    idoniProductosImporteFileInputRef.current.click();
  };

  // Función para manejar la selección de archivo de ventas de productos por cantidad
  const handleIdoniProductosCantidadFileSelect = () => {
    if (uploadingIdoniProductos) {
      return;
    }
    idoniProductosCantidadFileInputRef.current.click();
  };

  // Función para manejar el cambio de archivo de ventas de productos por importe
  const handleIdoniProductosImporteFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processIdoniProductosImporteExcel(file);
    }
    e.target.value = '';
  };

  // Función para manejar el cambio de archivo de ventas de productos por cantidad
  const handleIdoniProductosCantidadFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      processIdoniProductosCantidadExcel(file);
    }
    e.target.value = '';
  };

  // ===== NUEVAS FUNCIONES PARA PROCESAR DATOS DEL NUEVO FORMATO =====

  // Función para procesar datos del nuevo formato de productos
  const processIdoniProductosNuevoFormato = (ventasProductosImporte, ventasProductosCantidad) => {
    if ((!ventasProductosImporte || ventasProductosImporte.length === 0) && 
        (!ventasProductosCantidad || ventasProductosCantidad.length === 0)) {
      return null;
    }

    // Crear un mapa combinado de productos
    const productosCombinados = new Map();

    // Procesar datos por importe
    if (ventasProductosImporte && ventasProductosImporte.length > 0) {
      ventasProductosImporte.forEach(producto => {
        const key = producto.codi;
        if (!productosCombinados.has(key)) {
          productosCombinados.set(key, {
            codi: producto.codi,
            descripcio: producto.descripcio,
            importe: {
              gener: producto.gener || 0,
              febrer: producto.febrer || 0,
              marc: producto.marc || 0,
              abril: producto.abril || 0,
              maig: producto.maig || 0,
              juny: producto.juny || 0,
              juliol: producto.juliol || 0,
              agost: producto.agost || 0,
              setembre: producto.setembre || 0,
              octubre: producto.octubre || 0,
              novembre: producto.novembre || 0,
              desembre: producto.desembre || 0,
              total: producto.total || 0
            },
            cantidad: {
              gener: 0,
              febrer: 0,
              marc: 0,
              abril: 0,
              maig: 0,
              juny: 0,
              juliol: 0,
              agost: 0,
              setembre: 0,
              octubre: 0,
              novembre: 0,
              desembre: 0,
              total: 0
            }
          });
        } else {
          // Actualizar datos de importe existentes
          const existing = productosCombinados.get(key);
          existing.importe = {
            gener: producto.gener || 0,
            febrer: producto.febrer || 0,
            marc: producto.marc || 0,
            abril: producto.abril || 0,
            maig: producto.maig || 0,
            juny: producto.juny || 0,
            juliol: producto.juliol || 0,
            agost: producto.agost || 0,
            setembre: producto.setembre || 0,
            octubre: producto.octubre || 0,
            novembre: producto.novembre || 0,
            desembre: producto.desembre || 0,
            total: producto.total || 0
          };
        }
      });
    }

    // Procesar datos por cantidad
    if (ventasProductosCantidad && ventasProductosCantidad.length > 0) {
      ventasProductosCantidad.forEach(producto => {
        const key = producto.codi;
        if (!productosCombinados.has(key)) {
          productosCombinados.set(key, {
            codi: producto.codi,
            descripcio: producto.descripcio,
            importe: {
              gener: 0,
              febrer: 0,
              marc: 0,
              abril: 0,
              maig: 0,
              juny: 0,
              juliol: 0,
              agost: 0,
              setembre: 0,
              octubre: 0,
              novembre: 0,
              desembre: 0,
              total: 0
            },
            cantidad: {
              gener: producto.gener || 0,
              febrer: producto.febrer || 0,
              marc: producto.marc || 0,
              abril: producto.abril || 0,
              maig: producto.maig || 0,
              juny: producto.juny || 0,
              juliol: producto.juliol || 0,
              agost: producto.agost || 0,
              setembre: producto.setembre || 0,
              octubre: producto.octubre || 0,
              novembre: producto.novembre || 0,
              desembre: producto.desembre || 0,
              total: producto.total || 0
            }
          });
        } else {
          // Actualizar datos de cantidad existentes
          const existing = productosCombinados.get(key);
          existing.cantidad = {
            gener: producto.gener || 0,
            febrer: producto.febrer || 0,
            marc: producto.marc || 0,
            abril: producto.abril || 0,
            maig: producto.maig || 0,
            juny: producto.juny || 0,
            juliol: producto.juliol || 0,
            agost: producto.agost || 0,
            setembre: producto.setembre || 0,
            octubre: producto.octubre || 0,
            novembre: producto.novembre || 0,
            desembre: producto.desembre || 0,
            total: producto.total || 0
          };
        }
      });
    }

    // Convertir a array y ordenar por total de importe
    const productosArray = Array.from(productosCombinados.values());
    productosArray.sort((a, b) => b.importe.total - a.importe.total);

    return {
      productosArray,
      totalProductos: productosArray.length,
      totalImporte: productosArray.reduce((sum, p) => sum + p.importe.total, 0),
      totalCantidad: productosArray.reduce((sum, p) => sum + p.cantidad.total, 0),
      productosConImporte: productosArray.filter(p => p.importe.total > 0).length,
      productosConCantidad: productosArray.filter(p => p.cantidad.total > 0).length
    };
  };

  // Función para calcular análisis del nuevo formato de productos
  const calculateIdoniProductosNuevoFormatoAnalytics = (productosData) => {
    if (!productosData || !productosData.productosArray) return null;

    const productos = productosData.productosArray;
    
    // Top 10 productos por importe
    const top10PorImporte = productos
      .filter(p => p.importe.total > 0)
      .slice(0, 10);
    
    // Top 10 productos por cantidad
    const top10PorCantidad = productos
      .filter(p => p.cantidad.total > 0)
      .sort((a, b) => b.cantidad.total - a.cantidad.total)
      .slice(0, 10);
    
    // Productos con mayor crecimiento mensual (comparando últimos meses)
    const productosConCrecimiento = productos
      .filter(p => p.importe.total > 0)
      .map(producto => {
        const meses = ['gener', 'febrer', 'marc', 'abril', 'maig', 'juny', 'juliol', 'agost', 'setembre', 'octubre', 'novembre', 'desembre'];
        const valores = meses.map(mes => producto.importe[mes] || 0);
        const crecimiento = valores.length > 1 ? ((valores[valores.length - 1] - valores[0]) / valores[0]) * 100 : 0;
        
        return {
          ...producto,
          crecimiento: isFinite(crecimiento) ? crecimiento : 0
        };
      })
      .sort((a, b) => b.crecimiento - a.crecimiento)
      .slice(0, 10);

    // Calcular estadísticas generales
    const importePromedioPorProducto = productosData.totalProductos > 0 ? 
      productosData.totalImporte / productosData.totalProductos : 0;
    
    const cantidadPromedioPorProducto = productosData.totalProductos > 0 ? 
      productosData.totalCantidad / productosData.totalProductos : 0;

    return {
      top10PorImporte,
      top10PorCantidad,
      top10PorCrecimiento: productosConCrecimiento,
      importePromedioPorProducto,
      cantidadPromedioPorProducto,
      totalProductos: productosData.totalProductos,
      totalImporte: productosData.totalImporte,
      totalCantidad: productosData.totalCantidad,
      productosConImporte: productosData.productosConImporte,
      productosConCantidad: productosData.productosConCantidad
    };
  };

  // Función para generar resumen completo de datos de IDONI para análisis de IA
  const generateIdoniSummary = () => {
    const summary = {
      metadata: {
        fechaGeneracion: new Date().toISOString(),
        empresa: 'IDONI',
        tipoAnalisis: 'Resumen Completo para IA',
        version: '1.0'
      },
      
      // Datos de ventas diarias
      ventasDiarias: {
        disponible: idoniGroupedData.length > 0,
        totalDias: idoniGroupedData.length,
        rangoFechas: idoniGroupedData.length > 0 ? {
          inicio: idoniGroupedData[0]?.fecha,
          fin: idoniGroupedData[idoniGroupedData.length - 1]?.fecha
        } : null,
        datos: idoniGroupedData.map(dia => ({
          fecha: dia.fecha,
          ventas: dia.ventas,
          tickets: dia.tickets,
          promedioTicket: dia.ventas / dia.tickets
        }))
      },
      
      // Datos de ventas por horas
      ventasPorHoras: {
        disponible: idoniHourlyData !== null,
        franjas: idoniHourlyData?.franjasArray?.map(franja => ({
          nombre: franja.nombre,
          tipo: franja.tipo,
          ventas: franja.ventas,
          tickets: franja.tickets,
          promedioTicket: franja.ventas / franja.tickets
        })) || [],
        analytics: idoniHourlyAnalytics ? {
          mejorFranja: idoniHourlyAnalytics.mejorFranjaVentas,
          peorFranja: idoniHourlyAnalytics.peorFranjaVentas,
          franjaMasConsistente: idoniHourlyAnalytics.franjaMasConsistente,
          totalCorrecciones: idoniHourlyAnalytics.totalCorrecciones,
          mediaVentas: idoniHourlyAnalytics.mediaVentas,
          desviacionEstandar: idoniHourlyAnalytics.desviacionEstandar
        } : null
      },
      
      // Datos de productos
      productos: {
        disponible: idoniProductosData !== null,
        totalProductos: idoniProductosData?.totalProductos || 0,
        totalVentas: idoniProductosData?.totalVentas || 0,
        totalCostos: idoniProductosData?.totalCostos || 0,
        totalMargen: idoniProductosData?.totalMargen || 0,
        margenPromedio: idoniProductosAnalytics?.margenPromedio || 0,
        topProductos: idoniProductosAnalytics?.top10PorVentas?.map(p => ({
          nombre: p.nombre,
          ventas: p.totalVentas,
          costos: p.totalCostImport,
          margen: p.totalMargeImport,
          unidades: p.totalUnit,
          kilos: p.totalKilos
        })) || []
      },
      
      // Analytics generales
      analyticsGenerales: {
        mejorDia: idoniAnalytics?.mejorDia,
        peorDia: idoniAnalytics?.peorDia,
        diaMasConsistente: idoniAnalytics?.diaMasConsistente,
        crecimientoMensual: idoniAnalytics?.crecimientoMensual,
        totalGeneral: idoniAnalytics?.totalGeneral,
        promedioMensual: idoniAnalytics?.promedioMensual,
        promediosPorDia: idoniAnalytics?.promediosPorDia,
        tendenciaMensual: idoniAnalytics?.tendenciaMensual
      },
      
      // Recomendaciones para IA
      recomendacionesIA: {
        areasAnalisis: [
          'Identificar patrones de ventas por día de la semana',
          'Analizar franjas horarias más rentables',
          'Evaluar rendimiento de productos por margen',
          'Detectar tendencias de crecimiento mensual',
          'Identificar oportunidades de optimización de horarios',
          'Analizar correlación entre productos y horarios'
        ],
        preguntasSugeridas: [
          '¿Qué días de la semana son más rentables y por qué?',
          '¿Qué franjas horarias generan más ventas?',
          '¿Qué productos tienen mejor margen de beneficio?',
          '¿Hay tendencias de crecimiento o decrecimiento?',
          '¿Qué recomendaciones darías para optimizar las ventas?',
          '¿Qué estrategias de precios serían más efectivas?'
        ]
      }
    };
    
    return summary;
  };

  // Función para exportar resumen de IDONI
  const exportIdoniSummary = () => {
    const summary = generateIdoniSummary();
    
    // Crear archivo JSON
    const jsonContent = JSON.stringify(summary, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    // Crear enlace de descarga
    const link = document.createElement('a');
    link.href = url;
    link.download = `resumen_idoni_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showAlertMessage('Resumen de IDONI exportado correctamente. El archivo está listo para análisis de IA.', 'success');
  };

  // Función para descargar datos de la vista Sergi
  const downloadSergiData = () => {
    if (!sergiData || sergiData.length === 0) {
      showAlertMessage('No hay datos para descargar.', 'error');
      return;
    }

    try {
      // Crear workbook
      const wb = XLSX.utils.book_new();
      const datasetName = selectedDataset === 'solucions' ? 'Solucions Socials' : 'Menjar D\'Hort';
      const monthFilter = selectedMonth ? ` - ${getMonthName(selectedMonth)}` : '';
      
      // Obtener canales disponibles según el dataset
      const channels = selectedDataset === 'solucions' 
        ? ['Estructura', 'Catering', 'IDONI', 'Otros']
        : selectedDataset === 'menjar'
        ? ['OBRADOR', 'ESTRUCTURA', 'CATERING', 'Otros']
        : ['Ventas Diarias', 'Ventas por Hora', 'Análisis Mensual', 'Análisis por Día'];

      // Crear una hoja por cada canal
      channels.forEach(channel => {
        // Filtrar datos por canal
        let channelData;
        if (selectedDataset === 'idoni') {
          channelData = sergiData.filter(row => {
            const tienda = row[2] || '';
            return tienda === channel;
          });
        } else {
          channelData = sergiData.filter(row => {
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

        // Solo crear hoja si hay datos para este canal
        if (channelData.length > 0) {
          // Preparar datos para descarga
          const downloadData = channelData.map(row => {
            const total = parseFloat(row[columnIndices.total]) || 0;
            const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
            // Para facturas pendientes, usar el monto pendiente en lugar del total
            const amountToShow = pending > 0 ? pending : total;
            
            return {
              'Fecha': formatDate(row[columnIndices.date]),
              'Número de Factura': row[columnIndices.invoiceNumber] || '-',
              'Proveedor': row[columnIndices.provider] || '-',
              'Descripción': row[columnIndices.description] || '-',
              'Cuenta': row[columnIndices.account] || '-',
              'Total': total, // Total real de la factura
              'Pendiente': columnIndices.pending ? pending : 0, // Monto pendiente
              'Canal': channel,
              'Estado': isPending(row, columnIndices) ? 'Pendiente' : 'Pagado'
            };
          });

          // Calcular totales del canal
          const totalAmount = channelData.reduce((sum, row) => {
            const total = parseFloat(row[columnIndices.total]) || 0;
            return sum + total;
          }, 0);

          const pendingAmount = channelData.reduce((sum, row) => {
            const pending = columnIndices.pending ? (parseFloat(row[columnIndices.pending]) || 0) : 0;
            return sum + pending;
          }, 0);

          // Agregar fila de separación
          downloadData.push({
            'Fecha': '',
            'Número de Factura': '',
            'Proveedor': '',
            'Descripción': '',
            'Cuenta': '',
            'Total': '',
            'Pendiente': '',
            'Canal': '',
            'Estado': ''
          });

          // Agregar texto del total y suma en la misma fila
          downloadData.push({
            'Fecha': '',
            'Número de Factura': '',
            'Proveedor': '',
            'Descripción': '',
            'Cuenta': '',
            'Total': `TOTAL ${channel}`,
            'Pendiente': pendingAmount,
            'Canal': '',
            'Estado': ''
          });

          const ws = XLSX.utils.json_to_sheet(downloadData);

          // Configurar anchos de columna
          const colWidths = [
            { wch: 12 }, // Fecha
            { wch: 15 }, // Número de Factura
            { wch: 25 }, // Proveedor
            { wch: 30 }, // Descripción
            { wch: 20 }, // Cuenta
            { wch: 12 }, // Total
            { wch: 15 }, // Canal
            { wch: 10 }  // Estado
          ];
          ws['!cols'] = colWidths;

          // Crear nombre de hoja limitado a 31 caracteres
          const sheetName = `${channel}${monthFilter}`.substring(0, 31);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      });

      // Descargar archivo
      const fileName = `${datasetName}_Vista_Sergi_Todos_Canales${monthFilter}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showAlertMessage('Datos de todos los canales descargados correctamente', 'success');
    } catch (error) {
      console.error('Error al descargar datos:', error);
      showAlertMessage('Error al descargar los datos', 'error');
    }
  };

  // Función para formatear IBAN con espacios cada 4 dígitos
  const formatIBAN = (iban) => {
    if (!iban || iban === '-') return iban;
    
    // Eliminar espacios y caracteres especiales existentes
    const cleanIBAN = iban.replace(/[\s\-_]/g, '');
    
    // Formatear cada 4 dígitos
    const formattedIBAN = cleanIBAN.replace(/(.{4})/g, '$1 ').trim();
    
    return formattedIBAN;
  };

  // Función para descargar datos de la vista Bruno
  const downloadBrunoData = () => {
    if (!brunoData || brunoData.length === 0) {
      showAlertMessage('No hay datos para descargar', 'error');
      return;
    }

    try {
      // Crear workbook
      const wb = XLSX.utils.book_new();
      const fileName = `Vista_Bruno_Facturas_${new Date().toISOString().split('T')[0]}.xlsx`;

      // Preparar datos para Excel
      const excelData = brunoData.map(row => ({
        'Número': row[0] || '-',
        'Proveedor': row[1] || '-',
        'Fecha': formatDate(row[2]) || '-',
        'Total': parseFloat(row[3]) || 0,
        'Estado': row[4] || '-',
        'Pendiente': parseFloat(row[5]) || 0,
        'Descripción': row[6] || '-',
        'Vencimiento': formatDate(row[7]) || '-',
        'Subtotal': parseFloat(row[8]) || 0,
        'IVA': parseFloat(row[9]) || 0,
        'Retención': parseFloat(row[10]) || 0,
        'Empleados': parseFloat(row[11]) || 0,
        'Equipos': parseFloat(row[12]) || 0,
        'Pago': formatDate(row[13]) || '-',
        'Etiquetas': row[14] || '-',
        'Cuenta': row[15] || '-',
        'Proyecto': row[16] || '-',
        'Holded ID': row[17] || '-',
        'Contacto': row[18] || '-',
        'Tipo': row[19] || '-'
      }));

      // Crear hoja con todos los datos
      const ws = XLSX.utils.json_to_sheet(excelData);

      // Configurar anchos de columna
      const colWidths = [
        { wch: 15 }, // Número
        { wch: 25 }, // Proveedor
        { wch: 12 }, // Fecha
        { wch: 12 }, // Total
        { wch: 12 }, // Estado
        { wch: 12 }, // Pendiente
        { wch: 30 }, // Descripción
        { wch: 12 }, // Vencimiento
        { wch: 12 }, // Subtotal
        { wch: 10 }, // IVA
        { wch: 12 }, // Retención
        { wch: 12 }, // Empleados
        { wch: 12 }, // Equipos
        { wch: 12 }, // Pago
        { wch: 20 }, // Etiquetas
        { wch: 15 }, // Cuenta
        { wch: 15 }, // Proyecto
        { wch: 15 }, // Holded ID
        { wch: 15 }, // Contacto
        { wch: 10 }  // Tipo
      ];
      ws['!cols'] = colWidths;

      // Agregar hoja con todas las facturas
      XLSX.utils.book_append_sheet(wb, ws, 'Facturas de Bruno');

      // Descargar archivo
      XLSX.writeFile(wb, fileName);

      showAlertMessage('Facturas de Bruno descargadas correctamente', 'success');
    } catch (error) {
      console.error('Error al descargar datos:', error);
      showAlertMessage('Error al descargar los datos', 'error');
    }
  };

  // Función para exportar resumen completo de IDONI para análisis de IA
  const downloadIdoniAIAnalysis = () => {
    if (!idoniData || !idoniAnalytics || !idoniHourlyAnalytics || !idoniProductosAnalytics) {
      showAlertMessage('No hay datos completos de IDONI disponibles para análisis', 'error');
      return;
    }

    try {
      // Crear estructura de datos para IA
      const aiAnalysisData = {
        metadata: {
          fechaGeneracion: new Date().toISOString(),
          empresa: 'IDONI',
          periodoAnalisis: {
            mesesDisponibles: Object.keys(idoniData.monthlyData || {}).length,
            rangoFechas: {
              inicio: Object.keys(idoniData.monthlyData || {}).sort()[0],
              fin: Object.keys(idoniData.monthlyData || {}).sort().pop()
            }
          }
        },
        
        // 1. RESUMEN EJECUTIVO
        resumenEjecutivo: {
          totalVentas: idoniAnalytics.totalGeneral || 0,
          promedioMensual: idoniAnalytics.promedioMensual || 0,
          crecimientoMensual: idoniAnalytics.crecimientoMensual || 0,
          totalMeses: idoniAnalytics.totalMeses || 0,
          mejorDia: idoniAnalytics.mejorDia || {},
          peorDia: idoniAnalytics.peorDia || {},
          diaMasConsistente: idoniAnalytics.diaMasConsistente || {}
        },

        // 2. ANÁLISIS POR DÍAS DE LA SEMANA
        analisisDiasSemana: {
          promediosPorDia: idoniAnalytics.promediosPorDia || {},
          totalesPorDia: idoniAnalytics.totalesPorDia || {},
          recomendaciones: {
            mejorDia: idoniAnalytics.mejorDia?.dia || 'N/A',
            peorDia: idoniAnalytics.peorDia?.dia || 'N/A',
            diaMasConsistente: idoniAnalytics.diaMasConsistente?.dia || 'N/A'
          }
        },

        // 3. TENDENCIAS MENSUALES
        tendenciasMensuales: {
          datos: idoniAnalytics.tendenciaMensual || [],
          crecimiento: idoniAnalytics.crecimientoMensual || 0,
          prediccion: {
            tendencia: idoniAnalytics.crecimientoMensual > 0 ? 'CRECIENTE' : 'DECRECIENTE',
            porcentajeCrecimiento: Math.abs(idoniAnalytics.crecimientoMensual || 0)
          }
        },

        // 4. ANÁLISIS POR HORAS
        analisisHorario: {
          mejorFranjaVentas: idoniHourlyAnalytics.mejorFranjaVentas || {},
          peorFranjaVentas: idoniHourlyAnalytics.peorFranjaVentas || {},
          mejorFranjaTickets: idoniHourlyAnalytics.mejorFranjaTickets || {},
          peorFranjaTickets: idoniHourlyAnalytics.peorFranjaTickets || {},
          franjaMasConsistente: idoniHourlyAnalytics.franjaMasConsistente || {},
          estadisticasGenerales: {
            totalFranjas: idoniHourlyAnalytics.totalFranjas || 0,
            franjasConActividad: idoniHourlyAnalytics.franjasConActividad || 0,
            mediaVentas: idoniHourlyAnalytics.mediaVentas || 0,
            desviacionEstandar: idoniHourlyAnalytics.desviacionEstandar || 0,
            crecimientoPromedio: idoniHourlyAnalytics.crecimientoPromedio || 0
          },
          analisisPorTipo: {
            mejorFranjaComercial: idoniHourlyAnalytics.mejorFranjaComercial || {},
            peorFranjaComercial: idoniHourlyAnalytics.peorFranjaComercial || {},
            totalCorrecciones: idoniHourlyAnalytics.totalCorrecciones || 0,
            ticketsCorrecciones: idoniHourlyAnalytics.ticketsCorrecciones || 0,
            franjasComerciales: idoniHourlyAnalytics.franjasComerciales || 0,
            franjasCorreccion: idoniHourlyAnalytics.franjasCorreccion || 0,
            franjasPreparacion: idoniHourlyAnalytics.franjasPreparacion || 0,
            franjasCierre: idoniHourlyAnalytics.franjasCierre || 0
          }
        },

        // 5. ANÁLISIS DE PRODUCTOS
        analisisProductos: {
          totalProductos: idoniProductosAnalytics.totalProductos || 0,
          totalVentas: idoniProductosAnalytics.totalVentas || 0,
          totalCostos: idoniProductosAnalytics.totalCostos || 0,
          totalMargen: idoniProductosAnalytics.totalMargen || 0,
          totalUnidades: idoniProductosAnalytics.totalUnidades || 0,
          totalKilos: idoniProductosAnalytics.totalKilos || 0,
          margenPromedio: idoniProductosAnalytics.margenPromedio || 0,
          ventaPromedioPorProducto: idoniProductosAnalytics.ventaPromedioPorProducto || 0,
          topProductos: {
            porVentas: idoniProductosAnalytics.top10PorVentas || [],
            porMargen: idoniProductosAnalytics.top10PorMargen || [],
            porUnidades: idoniProductosAnalytics.top10PorUnidades || [],
            porMargenPorcentual: idoniProductosAnalytics.top10PorMargenPorcentual || []
          }
        },

        // 6. DATOS DETALLADOS PARA ANÁLISIS PROFUNDO
        datosDetallados: {
          ventasDiarias: idoniData.ventasDiarias || [],
          ventasHoras: idoniData.ventasHoras || [],
          productos: idoniProductosData?.productosArray || []
        },

        // 7. RECOMENDACIONES AUTOMÁTICAS
        recomendaciones: {
          horarios: {
            mejorHorario: idoniHourlyAnalytics.mejorFranjaVentas?.franja || 'N/A',
            horarioOptimizacion: idoniHourlyAnalytics.peorFranjaVentas?.franja || 'N/A',
            recomendacion: idoniHourlyAnalytics.mejorFranjaVentas?.ventas > (idoniHourlyAnalytics.mediaVentas * 1.5) ? 
              'Considerar ampliar horario en la mejor franja' : 'Horarios actuales parecen óptimos'
          },
          productos: {
            productoEstrella: idoniProductosAnalytics.top10PorVentas?.[0]?.descripcio || 'N/A',
            productoMargen: idoniProductosAnalytics.top10PorMargen?.[0]?.descripcio || 'N/A',
            recomendacion: idoniProductosAnalytics.margenPromedio > 30 ? 
              'Margen promedio saludable' : 'Considerar revisar precios o costos'
          },
          dias: {
            diaMasRentable: idoniAnalytics.mejorDia?.dia || 'N/A',
            diaMenosRentable: idoniAnalytics.peorDia?.dia || 'N/A',
            recomendacion: idoniAnalytics.mejorDia?.ventas > (idoniAnalytics.promedioMensual * 1.3) ? 
              'Considerar promociones en días menos rentables' : 'Distribución de ventas equilibrada'
          }
        },

        // 8. MÉTRICAS DE RENDIMIENTO
        metricasRendimiento: {
          eficienciaVentas: {
            ventasPorDia: idoniAnalytics.totalGeneral / (idoniAnalytics.totalMeses * 30) || 0,
            ventasPorHora: idoniHourlyAnalytics.mediaVentas || 0,
            ticketsPorDia: idoniAnalytics.totalesPorDia ? 
              Object.values(idoniAnalytics.totalesPorDia).reduce((sum, dia) => sum + (dia.tickets || 0), 0) / 7 : 0
          },
          rentabilidad: {
            margenPromedio: idoniProductosAnalytics.margenPromedio || 0,
            rentabilidadPorProducto: idoniProductosAnalytics.ventaPromedioPorProducto || 0,
            eficienciaOperativa: idoniHourlyAnalytics.franjasConActividad / idoniHourlyAnalytics.totalFranjas || 0
          }
        }
      };

      // Crear archivo JSON para descarga
      const jsonString = JSON.stringify(aiAnalysisData, null, 2);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      // Crear enlace de descarga
      const link = document.createElement('a');
      link.href = url;
      
      // Generar nombre de archivo con fecha
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      link.download = `IDONI_Analisis_IA_${dateStr}.json`;
      
      // Descargar archivo
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Limpiar URL
      URL.revokeObjectURL(url);
      
      showAlertMessage('Análisis de IDONI para IA descargado correctamente', 'success');

    } catch (error) {
      console.error('Error al generar análisis para IA:', error);
      showAlertMessage('Error al generar análisis de IDONI para IA', 'error');
    }
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
      {!loading && (
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
      )}

      {/* Tarjetas de selección de vista - Solo mostrar para Holded */}
      {!loading && selectedDataset !== 'idoni' && (
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
                opacity: 1
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
              Análisis de ventas de IDONI - Datos de tienda y análisis temporal. Exporta un resumen completo para análisis de IA.
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
                  
                  {/* Botón para ventas de productos por importe */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleIdoniProductosImporteFileSelect}
                    disabled={uploadingIdoniProductos}
                    style={{
                      background: colors.idoni,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: uploadingIdoniProductos ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: uploadingIdoniProductos ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {uploadingIdoniProductos && uploadTypeProductos === 'productos_importe' ? (
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
                        Productos por Importe
                      </>
                    )}
                  </motion.button>
                  
                  {/* Botón para ventas de productos por cantidad */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleIdoniProductosCantidadFileSelect}
                    disabled={uploadingIdoniProductos}
                    style={{
                      background: colors.idoni,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: uploadingIdoniProductos ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: uploadingIdoniProductos ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    {uploadingIdoniProductos && uploadTypeProductos === 'productos_cantidad' ? (
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
                        Productos por Cantidad
                      </>
                    )}
                  </motion.button>
                  
                  {/* Botón para exportar resumen para IA */}
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={exportIdoniSummary}
                    disabled={!idoniGroupedData.length && !idoniHourlyData && !idoniProductosData}
                    style={{
                      background: colors.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '10px 16px',
                      fontSize: '14px',
                      fontWeight: '600',
                      cursor: (!idoniGroupedData.length && !idoniHourlyData && !idoniProductosData) ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      opacity: (!idoniGroupedData.length && !idoniHourlyData && !idoniProductosData) ? 0.6 : 1,
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Download size={16} />
                    Exportar para IA
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
              <input
                ref={idoniProductosFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleIdoniProductosFileChange}
                style={{ display: 'none' }}
              />
              <input
                ref={idoniProductosImporteFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleIdoniProductosImporteFileChange}
                style={{ display: 'none' }}
              />
              <input
                ref={idoniProductosCantidadFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleIdoniProductosCantidadFileChange}
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
                            return getMonthName(month);
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
                                  if (context.dataset.label === 'Tickets') {
                                    return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                                  } else {
                                    return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                                  }
                                },
                                afterBody: function(context) {
                                  const monthKey = Object.keys(idoniChartData.monthlyData)[context[0].dataIndex];
                                  const monthData = idoniChartData.monthlyData[monthKey];
                                  if (monthData) {
                                    const avgTicket = monthData.tickets > 0 ? monthData.ventas / monthData.tickets : 0;
                                    return [
                                      '',
                                      `Media por ticket: ${formatCurrency(avgTicket)}`
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

              {/* Análisis de Ventas de Productos - Nuevo Formato */}
              {idoniProductosData && idoniProductosAnalytics && (
                <div style={{ marginTop: '24px' }}>
                  <h3 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: 18, fontWeight: 600 }}>
                    Análisis de Ventas de Productos (Nuevo Formato)
                  </h3>

                  {/* Tarjetas de resumen de productos */}
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
                    gap: '16px', 
                    marginBottom: '24px' 
                  }}>
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: '14', fontWeight: 600 }}>
                        Total Importe
                      </h4>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: colors.success }}>
                        {formatCurrency(idoniProductosAnalytics.totalImporte)}
                      </div>
                    </div>
                    
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: '14', fontWeight: 600 }}>
                        Total Cantidad
                      </h4>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: colors.info }}>
                        {idoniProductosAnalytics.totalCantidad.toLocaleString()}
                      </div>
                    </div>
                    
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: '14', fontWeight: 600 }}>
                        Total Productos
                      </h4>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: colors.primary }}>
                        {idoniProductosAnalytics.totalProductos}
                      </div>
                    </div>
                    
                    <div style={{ background: colors.surface, padding: '16px', borderRadius: '8px' }}>
                      <h4 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: '14', fontWeight: 600 }}>
                        Productos con Importe
                      </h4>
                      <div style={{ fontSize: '20px', fontWeight: 'bold', color: colors.warning }}>
                        {idoniProductosAnalytics.productosConImporte}
                      </div>
                    </div>
                  </div>

                  {/* Charts de productos más vendidos */}
                    <div style={{
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', 
                    gap: '24px', 
                    marginBottom: '32px' 
                  }}>
                    {/* Chart Top 10 por Importe */}
                    {idoniProductosAnalytics.top10PorImporte && idoniProductosAnalytics.top10PorImporte.length > 0 && (
                      <div style={{ background: colors.card, padding: '20px', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                        <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16px', fontWeight: '600' }}>
                          Top 10 Productos por Importe
                    </h4>
                        <div style={{ height: '300px' }}>
                      <Bar
                                                    data={{
                              labels: idoniProductosAnalytics.top10PorImporte.map(p => p.codi),
                              datasets: [{
                                label: 'Importe Total (€)',
                                data: idoniProductosAnalytics.top10PorImporte.map(p => p.importe.total),
                                backgroundColor: colors.primary,
                                borderColor: colors.primary,
                                borderWidth: 1
                              }]
                            }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                                  display: false
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
                                  const producto = idoniProductosAnalytics.top10PorImporte[context[0].dataIndex];
                                  return `${producto.codi} - ${producto.descripcio}`;
                                },
                                label: function(context) {
                                  return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                                }
                              }
                            }
                          },
                                                        scales: {
                                y: {
                                  beginAtZero: true,
                                  ticks: {
                                    callback: function(value) {
                                      return formatCurrency(value);
                                    }
                                  }
                                },
                                x: {
                                  display: true,
                                  ticks: {
                                    color: colors.textSecondary,
                                    font: {
                                      size: 12
                                    }
                                  }
                                }
                              }
                        }}
                      />
                    </div>
                  </div>
                    )}

                    {/* Chart Top 10 por Cantidad */}
                    {idoniProductosAnalytics.top10PorCantidad && idoniProductosAnalytics.top10PorCantidad.length > 0 && (
                      <div style={{ background: colors.card, padding: '20px', borderRadius: '12px', border: `1px solid ${colors.border}` }}>
                        <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16px', fontWeight: '600' }}>
                          Top 10 Productos por Cantidad
                    </h4>
                        <div style={{ height: '300px' }}>
                      <Bar
                                                    data={{
                              labels: idoniProductosAnalytics.top10PorCantidad.map(p => p.codi),
                              datasets: [{
                                label: 'Cantidad Total',
                                data: idoniProductosAnalytics.top10PorCantidad.map(p => p.cantidad.total),
                                backgroundColor: colors.warning,
                                borderColor: colors.warning,
                                borderWidth: 1
                              }]
                            }}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          plugins: {
                            legend: {
                                  display: false
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
                                  const producto = idoniProductosAnalytics.top10PorCantidad[context[0].dataIndex];
                                  return `${producto.codi} - ${producto.descripcio}`;
                                },
                                label: function(context) {
                                  return `${context.dataset.label}: ${context.parsed.y.toLocaleString()}`;
                                }
                              }
                            }
                          },
                                                        scales: {
                                y: {
                                  beginAtZero: true,
                                  ticks: {
                                    callback: function(value) {
                                      return value.toLocaleString();
                                    }
                                  }
                                },
                                x: {
                                  display: true,
                                  ticks: {
                                    color: colors.textSecondary,
                                    font: {
                                      size: 12
                                    }
                                  }
                                }
                              }
                        }}
                      />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Tabla con buscador de productos */}
                  <div style={{ marginBottom: '32px' }}>
                    <h4 style={{ margin: '0 0 16px 0', color: colors.text, fontSize: '16px', fontWeight: '600' }}>
                      Buscar Productos
                    </h4>
                    <div style={{ marginBottom: '16px' }}>
                      <input
                        type="text"
                        placeholder="Buscar por código, descripción..."
                        value={productosNuevoFormatoSearchTerm}
                        onChange={(e) => setProductosNuevoFormatoSearchTerm(e.target.value)}
                        style={{
                          width: 'calc(100% - 32px)',
                          padding: '12px 16px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          fontSize: '14px',
                          backgroundColor: colors.card,
                          color: colors.text,
                          outline: 'none',
                          transition: 'border-color 0.2s',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    
                    <div style={{
                      maxHeight: '500px',
                      overflowY: 'auto',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      backgroundColor: colors.card
                    }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead style={{ position: 'sticky', top: 0, backgroundColor: colors.card, zIndex: 1 }}>
                          <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '120px' }}>Código</th>
                            <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '200px' }}>Descripción</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '120px' }}>Total Importe</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '120px' }}>Total Cantidad</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '80px' }}>Q1</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '80px' }}>Q2</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '80px' }}>Q3</th>
                            <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600', color: colors.text, fontSize: '14px', minWidth: '80px' }}>Q4</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredProductosNuevoFormato.map((producto, index) => {
                            // Calcular totales por trimestre
                            const q1 = producto.importe.gener + producto.importe.febrer + producto.importe.marc;
                            const q2 = producto.importe.abril + producto.importe.maig + producto.importe.juny;
                            const q3 = producto.importe.juliol + producto.importe.agost + producto.importe.setembre;
                            const q4 = producto.importe.octubre + producto.importe.novembre + producto.importe.desembre;
                            
                            return (
                              <tr key={producto.codi} style={{ 
                                borderBottom: `1px solid ${colors.border}`,
                                backgroundColor: index % 2 === 0 ? colors.card : colors.background
                              }}>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, fontWeight: '500' }}>{producto.codi}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text }}>{producto.descripcio}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, textAlign: 'right', fontWeight: '600' }}>{formatCurrency(producto.importe.total)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, textAlign: 'right', fontWeight: '600' }}>{producto.cantidad.total.toLocaleString()}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, textAlign: 'right' }}>{formatCurrency(q1)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, textAlign: 'right' }}>{formatCurrency(q2)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, textAlign: 'right' }}>{formatCurrency(q3)}</td>
                                <td style={{ padding: '12px 16px', fontSize: '14px', color: colors.text, textAlign: 'right' }}>{formatCurrency(q4)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    
                    <div style={{ marginTop: '12px', fontSize: '14px', color: colors.textSecondary }}>
                      Mostrando {filteredProductosNuevoFormato.length} de {idoniProductosData.productosArray.length} productos
                    </div>
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <motion.h3
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    transition={{ duration: 0.3, ease: 'easeOut' }}
                    style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}
                  >
                    Análisis por Canales
                  </motion.h3>
                  
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={downloadSergiData}
                    style={{
                      background: colors.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 16px',
                      fontSize: 14,
                      fontWeight: 600,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <Download size={16} />
                    Descargar Datos
                  </motion.button>
                </div>

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
                              {columnIndices.pending && (
                                <SortableHeader
                                  label={currentHeaders[columnIndices.pending] || 'Pendiente'}
                                  sortKey="pending"
                                  currentSortKey={channelSortConfig.key}
                                  currentDirection={channelSortConfig.direction}
                                  onSort={handleChannelSort}
                                />
                              )}
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
                                {columnIndices.pending && (
                                  <td style={{ 
                                    borderBottom: `1px solid ${colors.border}`, 
                                    padding: '12px 8px', 
                                    color: colors.text, 
                                    fontWeight: '600',
                                    color: (() => {
                                      const pending = parseFloat(row[columnIndices.pending]) || 0;
                                      return pending > 0 ? colors.error : colors.text;
                                    })()
                                  }}>
                                    {(() => {
                                      const total = parseFloat(row[columnIndices.total]) || 0;
                                      const pending = parseFloat(row[columnIndices.pending]) || 0;
                                      // Para facturas pendientes, mostrar el monto pendiente
                                      const amountToShow = pending > 0 ? pending : total;
                                      return formatCurrency(amountToShow);
                                    })()}
                                  </td>
                                )}
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 600, lineHeight: 1.2 }}>Análisis de Deudas por Proveedor</h3>
                    
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={downloadBrunoData}
                      style={{
                        background: colors.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: 8,
                        padding: '10px 16px',
                        fontSize: 14,
                        fontWeight: 600,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <Download size={16} />
                      Descargar Datos
                    </motion.button>
                  </div>
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
                                  {formatIBAN(stat.iban) || '-'}
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
                                                  Monto
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
                                                {canHideInvoices() && (
                                                  <th style={{ 
                                                    borderBottom: `1px solid ${colors.border}`, 
                                                    padding: '8px 12px', 
                                                    textAlign: 'center', 
                                                    color: colors.primary, 
                                                    fontWeight: 600, 
                                                    background: colors.card,
                                                    fontSize: '12px'
                                                  }}>
                                                    Acciones
                                                  </th>
                                                )}
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
                                                    {(() => {
                                                      const total = parseFloat(invoice[columnIndices.total]) || 0;
                                                      const pending = columnIndices.pending ? (parseFloat(invoice[columnIndices.pending]) || 0) : 0;
                                                      // Para facturas pendientes, mostrar el monto pendiente en lugar del total
                                                      const amountToShow = pending > 0 ? pending : total;
                                                      return formatCurrency(amountToShow);
                                                    })()}
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
                                                  {canHideInvoices() && (
                                                    <td style={{ 
                                                      borderBottom: `1px solid ${colors.border}`, 
                                                      padding: '8px 12px', 
                                                      textAlign: 'center',
                                                      color: colors.text,
                                                      fontSize: '12px'
                                                    }}>
                                                      <button
                                                        onClick={(e) => {
                                                          e.stopPropagation();
                                                          openHideModal(invoice);
                                                        }}
                                                        style={{
                                                          background: colors.error,
                                                          color: 'white',
                                                          border: 'none',
                                                          borderRadius: '4px',
                                                          padding: '4px 8px',
                                                          fontSize: '11px',
                                                          cursor: 'pointer',
                                                          transition: 'all 0.2s ease',
                                                          fontWeight: '500'
                                                        }}
                                                        onMouseEnter={(e) => {
                                                          e.target.style.background = colors.error + 'DD';
                                                        }}
                                                        onMouseLeave={(e) => {
                                                          e.target.style.background = colors.error;
                                                        }}
                                                      >
                                                        Ocultar
                                                      </button>
                                                    </td>
                                                  )}
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

      {/* Modal para ocultar factura */}
      <AnimatePresence>
        {showHideModal && selectedInvoiceForHide && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 600 }}>
                  Ocultar Factura
                </h3>
                <button
                  onClick={closeHideModal}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: colors.text, fontWeight: 600 }}>
                      {selectedInvoiceForHide[columnIndices.invoiceNumber] || 'Sin número'}
                    </span>
                    <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {formatDate(selectedInvoiceForHide[columnIndices.date])}
                    </span>
                  </div>
                  <div style={{ color: colors.text, marginBottom: '4px' }}>
                    {selectedInvoiceForHide[columnIndices.provider]}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {selectedInvoiceForHide[columnIndices.description] || 'Sin descripción'}
                  </div>
                  <div style={{ color: colors.text, fontWeight: 600, marginTop: '8px' }}>
                    {formatCurrency(parseFloat(selectedInvoiceForHide[columnIndices.total]) || 0)}
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    Rol afectado: <strong>Manager</strong>
                  </label>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    Razón para ocultar (opcional)
                  </label>
                  <textarea
                    value={hideReason}
                    onChange={(e) => setHideReason(e.target.value)}
                    placeholder="Explica por qué ocultas esta factura..."
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      fontSize: 14,
                      color: colors.text,
                      background: colors.background,
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={closeHideModal}
                  style={{
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => hideInvoice(selectedInvoiceForHide, hideReason)}
                  style={{
                    background: colors.error,
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Ocultar Factura
                </motion.button>
              </div>
            </motion.div>
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