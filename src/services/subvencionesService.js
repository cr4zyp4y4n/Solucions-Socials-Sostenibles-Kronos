import * as XLSX from 'xlsx';
import { supabase } from '../config/supabase';

class SubvencionesService {
  constructor() {
    this.subvencionesData = [];
  }

  // Procesar CSV y guardar en memoria (NO en Supabase)
  processCSVData(csvData) {
    try {
      console.log('📋 Procesando CSV de subvenciones...');
      
      // Convertir CSV a JSON
      const workbook = XLSX.read(csvData, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Encontrar la fila de SUBVENCIÓN (fila 8, índice 7)
      const subvencionesRow = jsonData[7]; // Fila 8
      const subvencionesNames = [];
      const subvencionesColumns = [];

      // Encontrar todas las columnas con nombres de subvenciones
      for (let j = 1; j < subvencionesRow.length; j++) {
        const cellValue = subvencionesRow[j];
        if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
          // Convertir a string si no lo es
          const strValue = String(cellValue).trim();
          // Filtrar valores vacíos, puntos solos, guiones, etc.
          if (strValue !== '' && 
              strValue !== '.' && 
              strValue !== '-' && 
              strValue !== '--' &&
              strValue.length > 1) {
            subvencionesNames.push(strValue);
            subvencionesColumns.push(j);
          }
        }
      }

      console.log(`✅ Encontradas ${subvencionesNames.length} subvenciones en el CSV`);
      console.log('📝 Nombres encontrados:', subvencionesNames);

      // Procesar cada subvención
      const processedSubvenciones = subvencionesNames.map((subvencionName, index) => {
        const columnIndex = subvencionesColumns[index];
        return this.processSubvencionData(jsonData, columnIndex, subvencionName);
      });

      console.log(`🔄 Procesadas ${processedSubvenciones.length} subvenciones`);

      // Filtrar subvenciones inválidas (nombres demasiado cortos o inválidos)
      const invalidSubvenciones = [];
      const validSubvenciones = processedSubvenciones.filter(sub => {
        const isValid = sub.nombre && 
               sub.nombre.trim().length > 1 && 
               sub.nombre.trim() !== '.' && 
               sub.nombre.trim() !== '-';
        
        if (!isValid) {
          invalidSubvenciones.push(sub.nombre);
        }
        return isValid;
      });

      if (invalidSubvenciones.length > 0) {
        console.warn('⚠️ Subvenciones filtradas por ser inválidas:', invalidSubvenciones);
      }

      // Guardar en memoria
      this.subvencionesData = validSubvenciones;
      console.log(`💾 ${validSubvenciones.length} subvenciones válidas guardadas en memoria`);
      
      return validSubvenciones;

    } catch (error) {
      console.error('❌ Error procesando CSV:', error);
      throw error;
    }
  }

  // Procesar datos de una subvención específica
  processSubvencionData(jsonData, columnIndex, subvencionName) {
    // Mapeo de filas del CSV (alineado con Subvenciones EISSS.csv)
    const rowMap = {
      proyecto: 8,            // Fila 9 - PROYECTO
      imputacion: 9,         // Fila 10 - IMPUTACIÓN
      expediente: 10,        // Fila 11 - No. EXPEDIENTE
      codigo: 11,            // Fila 12 - COD. SUBVENCIÓN
      modalidad: 12,         // Fila 13 - MODALIDAD
      fechaAdjudicacion: 13, // Fila 14 - FECHA PRESENTACIÓN (BRUNO)
      importeSolicitado: 14, // Fila 15 - IMPORTE SOLICITADO
      periodo: 15,            // Fila 16 - PERIODO DE EJECUCIÓN
      importeOtorgado: 16,   // Fila 17 - IMPORTE OTORGADO
      socL1Acomp: 18,        // Fila 19 - SOC: L1 ACOMP
      socL2Contrat: 19,      // Fila 20 - SOC: L2 CONTRAT. TRABAJ
      primerAbono: 21,       // Fila 22 - 1r ABONO
      fechaPrimerAbono: 22,  // Fila 23 - FECHA/CTA (1r abono)
      segundoAbono: 23,      // Fila 24 - 2o ABONO
      fechaSegundoAbono: 24, // Fila 25 - FECHA/CTA (2o abono)
      fase1: 25,              // Fila 26 - FASE DEL PROYECTO 1
      fase2: 26,              // Fila 27 - FASE DEL PROYECTO 2
      fase3: 27,              // Fila 28 - FASE DEL PROYECTO 3
      fase4: 28,              // Fila 29 - FASE DEL PROYECTO 4
      fase5: 29,              // Fila 30 - FASE DEL PROYECTO 5
      fase6: 30,              // Fila 31 - FASE DEL PROYECTO 6
      fase7: 31,              // Fila 32 - FASE DEL PROYECTO 7
      fase8: 32,              // Fila 33 - FASE DEL PROYECTO 8
      saldoPendiente: 34,    // Fila 35 - SALDO PDTE DE ABONO
      previsionPago: 35,     // Fila 36 - PREVISIÓN PAGO TOTAL
      fechaJustificacion: 36, // Fila 37 - FECHA JUSTIFICACIÓN
      revisadoGestoria: 42,  // Fila 43 - REV. GESTORIA
      estado: 48,            // Fila 49 - ESTADO
      holdedAsentamiento: 59, // Fila 60 - HOLDED ASENTAM.
      importesPorCobrar: 60  // Fila 61 - IMPORTES POR COBRAR
    };

    const subvencionData = {
      id: `subvencion_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      nombre: subvencionName.trim()
    };

    // Procesar cada campo
    Object.entries(rowMap).forEach(([field, rowIndex]) => {
      const value = this.getFieldValue(jsonData, rowIndex, columnIndex);
      subvencionData[field] = this.processFieldValue(value, field);
    });

    // Procesar fases del proyecto
    subvencionData.fasesProyecto = {
      fase1: subvencionData.fase1,
      fase2: subvencionData.fase2,
      fase3: subvencionData.fase3,
      fase4: subvencionData.fase4,
      fase5: subvencionData.fase5,
      fase6: subvencionData.fase6,
      fase7: subvencionData.fase7,
      fase8: subvencionData.fase8
    };

    // Log para depuración
    console.log(`📋 ${subvencionName}:`, {
      importeOtorgado: subvencionData.importeOtorgado,
      importeSolicitado: subvencionData.importeSolicitado,
      primerAbono: subvencionData.primerAbono,
      segundoAbono: subvencionData.segundoAbono,
      saldoPendiente: subvencionData.saldoPendiente,
      fechaPrimerAbono: subvencionData.fechaPrimerAbono,
      fechaSegundoAbono: subvencionData.fechaSegundoAbono,
      estado: subvencionData.estado
    });

    return subvencionData;
  }

  // Obtener valor del campo
  getFieldValue(jsonData, rowIndex, columnIndex) {
    if (rowIndex < 0 || rowIndex >= jsonData.length) return '';
    if (columnIndex < 0 || columnIndex >= jsonData[rowIndex].length) return '';
    return jsonData[rowIndex][columnIndex] || '';
  }

  // Procesar valor del campo
  processFieldValue(value, fieldName) {
    if (!value || value === '') return null;

    // Campos de fases del proyecto (convertir X a boolean)
    const faseFields = ['fase1', 'fase2', 'fase3', 'fase4', 'fase5', 'fase6', 'fase7', 'fase8'];
    if (faseFields.includes(fieldName)) {
      const str = value.toString().trim().toUpperCase();
      // Si es solo "X", convertir a true (fase activa)
      if (str === 'X') return true;
      // Si está vacío, null o guión, devolver false
      if (str === '' || str === '-' || str === '--') return false;
      // Si tiene cualquier otro contenido, guardarlo como texto
      return value.toString().trim();
    }

    // Campos de líneas de financiación SOC (mantener como texto completo)
    const socFields = ['socL1Acomp', 'socL2Contrat'];
    if (socFields.includes(fieldName)) {
      return this.parseSOCText(value);
    }

    // Campos numéricos
    const numericFields = [
      'importeSolicitado', 'importeOtorgado', 'primerAbono', 'segundoAbono', 
      'saldoPendiente', 'importesPorCobrar'
    ];

    if (numericFields.includes(fieldName)) {
      return this.parseCurrency(value);
    }

    // Campos de fecha
    const dateFields = ['fechaAdjudicacion', 'fechaPrimerAbono', 'fechaSegundoAbono', 'fechaJustificacion'];
    if (dateFields.includes(fieldName)) {
      return this.parseDate(value);
    }

    // Campos de texto
    return value.toString().trim();
  }

  // Parsear línea de financiación SOC (mantener como texto completo)
  parseSOCText(value) {
    if (!value || value === '') return null;
    
    const str = value.toString().trim();
    
    // Si contiene texto descriptivo sin información útil, devolver null
    if (str.includes('PEND.') || str.includes('SIN FECHA') || 
        str.includes('POR DEFINIR') || str.includes('GESTIONAR')) {
      return null;
    }
    
    // Limpiar espacios extra pero mantener el formato completo
    return str.replace(/\s+/g, ' ').trim();
  }


  // Parsear moneda
  parseCurrency(value) {
    if (value === null || value === undefined || value === '') return 0;
    // Si es un número muy grande, suele ser fecha serial de Excel en una celda de importe → ignorar
    if (typeof value === 'number' && (value > 1e10 || value < -1e10)) return 0;

    const str = value.toString().trim();
    
    // Si contiene texto descriptivo, devolver 0
    if (str.includes('PEND') || str.includes('ESTIMADOS') || 
        str.includes('SIN FECHA') || str.includes('POR DEFINIR') || 
        str.includes('GESTIONAR') || str.includes('SALDO') || 
        str.includes('%') || str.includes('SOLO')) {
      return 0;
    }
    
    // Si el valor tiene paréntesis o porcentajes, extraer solo el primer número
    // Ej: "9.523,65€ (80%) SALDO 2.380.91 (20%)" -> "9.523,65"
    let extractedValue = str;
    if (str.includes('(') || str.includes('%')) {
      // Extraer solo la parte antes del primer paréntesis
      extractedValue = str.split('(')[0].trim();
    }
    
    // Remover símbolos de moneda y espacios
    let cleanValue = extractedValue.replace(/[€$]/g, '').replace(/\s/g, '');
    
    // Caso especial: si es un número que parece haber sido mal interpretado por Excel
    // (ej: 37.70428 cuando debería ser 37.704,28)
    if (typeof value === 'number' && cleanValue.includes('.') && !cleanValue.includes(',')) {
      // Si el número tiene más de 2 decimales, probablemente sea un error de Excel
      const parts = cleanValue.split('.');
      if (parts.length === 2 && parts[1].length > 2) {
        // Convertir de formato inglés mal interpretado a español
        // 37.70428 -> 37704.28
        const integerPart = parts[0];
        const decimalPart = parts[1];
        const correctDecimal = decimalPart.slice(-2); // últimos 2 dígitos
        const correctInteger = integerPart + decimalPart.slice(0, -2); // resto como entero
        cleanValue = correctInteger + '.' + correctDecimal;
      }
    }
    
    // Detectar si es formato español (1.234,56) o inglés (1,234.56)
    const hasComma = cleanValue.includes(',');
    const hasDot = cleanValue.includes('.');
    
    if (hasComma && hasDot) {
      // Formato mixto: determinar cuál es el separador decimal
      const lastComma = cleanValue.lastIndexOf(',');
      const lastDot = cleanValue.lastIndexOf('.');
      
      if (lastComma > lastDot) {
        // Formato español: 1.234,56 o 37.704,28
        // El separador decimal es la coma, los puntos son separadores de miles
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
      } else {
        // Formato inglés: 1,234.56
        cleanValue = cleanValue.replace(/,/g, '');
      }
    } else if (hasComma && !hasDot) {
      // Solo comas: podría ser español (1234,56) o inglés (1,234)
      const parts = cleanValue.split(',');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Formato español: 1234,56
        cleanValue = cleanValue.replace(',', '.');
      } else {
        // Formato inglés: 1,234
        cleanValue = cleanValue.replace(/,/g, '');
      }
    } else if (hasDot && !hasComma) {
      // Solo puntos: podría ser decimal (1234.56) o miles (1.234)
      const parts = cleanValue.split('.');
      if (parts.length === 2 && parts[1].length <= 2) {
        // Formato decimal: 1234.56
        // No hacer nada
      } else {
        // Formato de miles: 1.234
        cleanValue = cleanValue.replace(/\./g, '');
      }
    }
    
    const parsed = parseFloat(cleanValue);
    return isNaN(parsed) ? 0 : parsed;
  }

  // Parsear fecha (preservando información adicional como cuentas bancarias)
  parseDate(value) {
    if (!value || value === '') return null;
    
    const str = value.toString().trim();
    
    // Si contiene texto descriptivo sin fecha, devolver null
    if (str.includes('PENDIENTE') || str.includes('SIN FECHA') || str.includes('POR DEFINIR') || 
        str.includes('GESTIONAR') || str.includes('ESTIMADOS')) {
      return null;
    }
    
    const dateFormats = [
      /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
      /(\d{1,2})\/(\d{1,2})\/(\d{4})/, // DD/MM/YYYY
      /(\d{1,2})\/(\d{1,2})\/(\d{2})/, // DD/MM/YY
      /(\d{1,2})-(\d{1,2})-(\d{4})/,   // DD-MM-YYYY
      /(\d{1,2})\.(\d{1,2})\.(\d{4})/, // DD.MM.YYYY
      /(\d{1,2})\/(\d{1,2})/,          // DD/MM (asumir año actual)
    ];
    
    for (const format of dateFormats) {
      const match = str.match(format);
      if (match) {
        if (format === dateFormats[0]) {
          // YYYY-MM-DD - devolver tal como está
          return str;
        } else if (format === dateFormats[1] || format === dateFormats[3] || format === dateFormats[4]) {
          // DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY - preservar texto adicional
          const [, day, month, year] = match;
          const datePart = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          const additionalInfo = str.substring(match[0].length).trim();
          return additionalInfo ? `${datePart} ${additionalInfo}` : datePart;
        } else if (format === dateFormats[2]) {
          // DD/MM/YY - preservar texto adicional
          const [, day, month, year] = match;
          const fullYear = year.length === 2 ? `20${year}` : year;
          const datePart = `${fullYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          const additionalInfo = str.substring(match[0].length).trim();
          return additionalInfo ? `${datePart} ${additionalInfo}` : datePart;
        } else if (format === dateFormats[5]) {
          // DD/MM - asumir año actual y preservar texto adicional
          const [, day, month] = match;
          const currentYear = new Date().getFullYear();
          const datePart = `${currentYear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
          const additionalInfo = str.substring(match[0].length).trim();
          return additionalInfo ? `${datePart} ${additionalInfo}` : datePart;
        }
      }
    }
    
    return null;
  }

  // Obtener datos actuales
  getSubvencionesData() {
    return this.subvencionesData;
  }

  // Establecer datos (para sincronización)
  setData(data) {
    this.subvencionesData = data;
  }

  // Filtrar subvenciones
  filterSubvenciones({ searchTerm, estado, imputacion, modalidad, proyecto, fase, año, sortBy }) {
    let filtered = [...this.subvencionesData];

    // Filtro por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(subvencion => 
        subvencion.nombre.toLowerCase().includes(term) ||
        subvencion.proyecto?.toLowerCase().includes(term) ||
        subvencion.expediente?.toLowerCase().includes(term) ||
        subvencion.codigo?.toLowerCase().includes(term) ||
        subvencion.modalidad?.toLowerCase().includes(term)
      );
    }

    // Filtro por estado
    if (estado && estado !== 'Todas') {
      filtered = filtered.filter(subvencion => subvencion.estado === estado);
    }

    // Filtro por imputación
    if (imputacion && imputacion !== 'Todas') {
      filtered = filtered.filter(subvencion => subvencion.imputacion === imputacion);
    }

    // Filtro por modalidad
    if (modalidad && modalidad !== 'Todas') {
      filtered = filtered.filter(subvencion => subvencion.modalidad === modalidad);
    }

    // Filtro por proyecto
    if (proyecto && proyecto !== 'Todas') {
      filtered = filtered.filter(subvencion => subvencion.proyecto === proyecto);
    }

    // Filtro por fase
    if (fase && fase !== 'Todas') {
      filtered = filtered.filter(subvencion => {
        const fases = this.analizarFasesProyecto(subvencion.fasesProyecto);
        return fases.some(f => f.numero.toString() === fase);
      });
    }

    // Filtro por año
    if (año && año !== 'Todos') {
      filtered = filtered.filter(subvencion => {
        return this.isSubvencionActiveInYear(subvencion.periodo, año);
      });
    }

    // Ordenamiento
    if (sortBy) {
      filtered.sort((a, b) => {
        switch (sortBy) {
          case 'nombre':
            return a.nombre.localeCompare(b.nombre);
          case 'importe':
            return (b.importeOtorgado || 0) - (a.importeOtorgado || 0);
          case 'fecha':
            return new Date(b.fechaCreacion) - new Date(a.fechaCreacion);
          default:
            return 0;
        }
      });
    }

    return filtered;
  }

  // Obtener estadísticas
  getEstadisticas() {
    const totalOtorgado = this.subvencionesData.reduce((sum, subvencion) => 
      sum + (subvencion.importeOtorgado || 0), 0
    );

    const totalSolicitado = this.subvencionesData.reduce((sum, subvencion) => 
      sum + (subvencion.importeSolicitado || 0), 0
    );

    const totalAbonado = this.subvencionesData.reduce((sum, subvencion) => 
      sum + (subvencion.primerAbono || 0) + (subvencion.segundoAbono || 0), 0
    );

    // Usar el saldoPendiente directamente del CSV en lugar de calcularlo
    const totalPendiente = this.subvencionesData.reduce((sum, subvencion) => 
      sum + (subvencion.saldoPendiente || 0), 0
    );

    // También calcular total por cobrar desde el campo importesPorCobrar
    const totalPorCobrar = this.subvencionesData.reduce((sum, subvencion) => 
      sum + (subvencion.importesPorCobrar || 0), 0
    );

    return {
      totalOtorgado,
      totalSolicitado,
      totalAbonado,
      totalPendiente,
      totalPorCobrar,
      total: this.subvencionesData.length,
      totalSubvenciones: this.subvencionesData.length
    };
  }

  /**
   * Normaliza una celda fase_* leída de Supabase (texto/boolean) al formato interno.
   */
  normalizeMarcadoFaseFromDb(raw) {
    if (raw === null || raw === undefined) return false;
    if (typeof raw === 'boolean') return raw;
    const s = String(raw).trim();
    if (s === '' || s === '-' || s === '--') return false;
    const u = s.toUpperCase();
    if (u === 'X' || u === 'SI' || u === 'SÍ' || u === '1' || u === 'Y' || u === 'YES') return true;
    return s;
  }

  /** Guarda en columnas text de Supabase: true → 'X', vacío → null. */
  serializeMarcadoFaseParaSupabase(v) {
    if (v === true) return 'X';
    if (v === false || v === null || v === undefined) return null;
    if (typeof v === 'string') {
      const t = v.trim();
      return t === '' ? null : t;
    }
    return String(v);
  }

  /**
   * Indica si una fase está "marcada" en la cuadrícula (equivalente a una X en el Excel).
   */
  esFaseMarcadaActiva(fase) {
    if (fase === null || fase === undefined) return false;
    if (typeof fase === 'boolean') return fase === true;
    const s = String(fase).trim();
    if (s === '' || s === '-' || s === '--') return false;
    const u = s.toUpperCase();
    if (u === 'FALSE' || u === 'NO' || u === '0') return false;
    if (u === 'X' || u === 'SI' || u === 'SÍ' || u === '1' || u === 'Y' || u === 'YES') return true;
    return true;
  }

  /**
   * Fase mostrada en cabecera: la más alta marcada (1–8). En el Excel hay varias X a la vez;
   * la fase "actual" alinea con la fila ESTADO (ej. Fase 8 si 4, 5 y 8 están marcadas).
   */
  obtenerNumeroFaseMaximaDesdeMarcas(fasesProyecto) {
    if (!fasesProyecto) return null;
    let maxN = null;
    for (let i = 1; i <= 8; i++) {
      if (this.esFaseMarcadaActiva(fasesProyecto[`fase${i}`])) maxN = i;
    }
    return maxN;
  }

  // Analizar fases del proyecto
  analizarFasesProyecto(fasesProyecto) {
    if (!fasesProyecto) return [];

    const nombresFases = {
      1: 'Fase 1',
      2: 'Fase 2',
      3: 'Fase 3',
      4: 'Fase 4',
      5: 'Fase 5',
      6: 'Fase 6',
      7: 'Fase 7',
      8: 'Fase 8'
    };

    const fases = [];
    for (let i = 1; i <= 8; i++) {
      const fase = fasesProyecto[`fase${i}`];
      if (!this.esFaseMarcadaActiva(fase)) continue;

      const isBoolean = typeof fase === 'boolean';
      fases.push({
        numero: i,
        campo: `fase${i}`,
        nombre: nombresFases[i] || `Fase ${i}`,
        contenido: isBoolean ? 'Activa' : (String(fase).trim().toUpperCase() === 'X' ? 'Activa' : fase),
        activa: true
      });
    }

    return fases;
  }

  // Exportar a Excel
  exportToExcel(data) {
    const wb = XLSX.utils.book_new();
    
    const exportData = data.map(subvencion => ({
      'Nombre': subvencion.nombre,
      'Proyecto': subvencion.proyecto,
      'Imputación': subvencion.imputacion,
      'Expediente': subvencion.expediente,
      'Código': subvencion.codigo,
      'Modalidad': subvencion.modalidad,
      'Fecha Adjudicación': subvencion.fechaAdjudicacion,
      'Importe Solicitado': subvencion.importeSolicitado,
      'Importe Otorgado': subvencion.importeOtorgado,
      'Período Ejecución': subvencion.periodo,
      'SOC L1 Acompañamiento': subvencion.socL1Acomp,
      'SOC L2 Contratación': subvencion.socL2Contrat,
      'Primer Abono': subvencion.primerAbono,
      'Fecha Primer Abono': subvencion.fechaPrimerAbono,
      'Segundo Abono': subvencion.segundoAbono,
      'Fecha Segundo Abono': subvencion.fechaSegundoAbono,
      'Saldo Pendiente': subvencion.saldoPendiente,
      'Previsión Pago': subvencion.previsionPago,
      'Fecha Justificación': subvencion.fechaJustificacion,
      'Revisado Gestoría': subvencion.revisadoGestoria,
      'Estado': subvencion.estado,
      'Holded Asentamiento': subvencion.holdedAsentamiento,
      'Importes por Cobrar': subvencion.importesPorCobrar
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Subvenciones');
    
    return wb;
  }

  // Obtener opciones de filtros
  getFiltros() {
    const estados = [...new Set(this.subvencionesData.map(s => s.estado).filter(Boolean))];
    const imputaciones = [...new Set(this.subvencionesData.map(s => s.imputacion).filter(Boolean))];
    const modalidades = [...new Set(this.subvencionesData.map(s => s.modalidad).filter(Boolean))];
    const proyectos = [...new Set(this.subvencionesData.map(s => s.proyecto).filter(Boolean))];
    
    // Obtener años disponibles
    const años = this.getAvailableYears();
    
    return {
      estados: ['Todas', ...estados.sort()],
      imputaciones: ['Todas', ...imputaciones.sort()],
      modalidades: ['Todas', ...modalidades.sort()],
      proyectos: ['Todas', ...proyectos.sort()],
      fases: ['Todas', '1', '2', '3', '4', '5', '6', '7', '8'],
      años: años
    };
  }

  // ===== FUNCIONES DE AÑOS =====

  /**
   * Verifica si una subvención está activa en un año específico
   * @param {string} periodo - Período de ejecución (ej: "01/11/2023 - 30/11/2024")
   * @param {string} año - Año a verificar (ej: "2023")
   * @returns {boolean}
   */
  isSubvencionActiveInYear(periodo, año) {
    if (!periodo || !año) return false;
    
    // Si el período contiene el año directamente
    if (periodo.includes(año)) return true;
    
    // Intentar parsear fechas de inicio y fin
    const partes = periodo.split(' - ');
    if (partes.length === 2) {
      const fechaInicio = this.parseDate(partes[0].trim());
      const fechaFin = this.parseDate(partes[1].trim());
      
      if (fechaInicio && fechaFin) {
        const añoInicio = fechaInicio.getFullYear();
        const añoFin = fechaFin.getFullYear();
        const añoNum = parseInt(año);
        
        // La subvención está activa si el año está entre inicio y fin
        return añoNum >= añoInicio && añoNum <= añoFin;
      }
    }
    
    // Si no se puede parsear, verificar si contiene el año como texto
    return periodo.includes(año);
  }

  /**
   * Obtiene todos los años disponibles en las subvenciones
   * @returns {Array} Array de años ordenados
   */
  getAvailableYears() {
    const años = new Set();
    
    this.subvencionesData.forEach(subvencion => {
      if (subvencion.periodo) {
        // Extraer años del período
        const añosEnPeriodo = this.extractYearsFromPeriod(subvencion.periodo);
        añosEnPeriodo.forEach(año => años.add(año));
      }
    });
    
    // Convertir a array y ordenar
    const añosArray = Array.from(años).map(año => año.toString()).sort((a, b) => b - a);
    return ['Todos', ...añosArray];
  }

  /**
   * Extrae todos los años de un período
   * @param {string} periodo - Período de ejecución
   * @returns {Array} Array de años
   */
  extractYearsFromPeriod(periodo) {
    const años = new Set();
    
    // Buscar años de 4 dígitos en el período
    const añoRegex = /\b(20\d{2})\b/g;
    let match;
    
    while ((match = añoRegex.exec(periodo)) !== null) {
      años.add(match[1]);
    }
    
    return Array.from(años);
  }

  /**
   * Parsea una fecha en formato DD/MM/YYYY, YYYY-MM-DD o número serial (Excel)
   * @param {string|number} dateStr - String de fecha o número serial Excel
   * @returns {Date|null}
   */
  parseDate(dateStr) {
    if (dateStr === null || dateStr === undefined || dateStr === '') return null;

    // Si viene como número (fecha serial de Excel)
    if (typeof dateStr === 'number') {
      if (isNaN(dateStr)) return null;
      // Excel: días desde 30/12/1899. 25569 = días de 1900-01-01 a 1970-01-01
      const date = new Date((dateStr - 25569) * 86400 * 1000);
      return isNaN(date.getTime()) ? null : date;
    }

    const str = String(dateStr).trim();
    if (!str) return null;

    // Formato DD/MM/YYYY
    if (str.includes('/')) {
      const partes = str.split('/');
      if (partes.length === 3) {
        const dia = parseInt(partes[0], 10);
        const mes = parseInt(partes[1], 10) - 1; // Los meses en JS van de 0-11
        const año = parseInt(partes[2], 10);
        if (!isNaN(dia) && !isNaN(mes) && !isNaN(año)) {
          return new Date(año, mes, dia);
        }
      }
    }

    // Formato YYYY-MM-DD
    if (str.includes('-')) {
      const fecha = new Date(str);
      return isNaN(fecha.getTime()) ? null : fecha;
    }

    return null;
  }

  // ===== FUNCIONES DE SUPABASE =====

  // Cargar datos desde Supabase
  async loadFromSupabase() {
    try {
      console.log('📥 Cargando datos desde Supabase...');
      
      const { data, error } = await supabase
        .from('subvenciones')
        .select('*')
        // Importante: respetar el orden original del Excel/CSV (se insertan en ese orden)
        .order('fecha_creacion', { ascending: true });

      if (error) {
        console.error('Error cargando datos de Supabase:', error);
        throw error;
      }

      // Convertir formato de Supabase al formato interno
      const formattedData = data.map(sub => this.formatSupabaseToInternal(sub));
      
      // Guardar en memoria también para compatibilidad
      this.subvencionesData = formattedData;
      
      console.log(`✅ ${formattedData.length} subvenciones cargadas desde Supabase`);
      return formattedData;
    } catch (error) {
      console.error('Error en loadFromSupabase:', error);
      throw error;
    }
  }

  // Convertir formato de Supabase al formato interno
  formatSupabaseToInternal(supabaseRecord) {
    return {
      id: supabaseRecord.id,
      nombre: supabaseRecord.nombre || '',
      proyecto: supabaseRecord.proyecto || '',
      imputacion: supabaseRecord.imputacion || '',
      expediente: supabaseRecord.expediente || '',
      codigo: supabaseRecord.codigo_subvencion || '',
      modalidad: supabaseRecord.modalidad || '',
      fechaAdjudicacion: supabaseRecord.fecha_adjudicacion || '',
      faseActual: supabaseRecord.fase_actual ?? null,
      importeSolicitado: supabaseRecord.importe_solicitado || 0,
      importeOtorgado: supabaseRecord.importe_otorgado || 0,
      periodo: supabaseRecord.periodo_ejecucion || '',
      socL1Acomp: supabaseRecord.soc_l1_acompanamiento || 0,
      socL2Contrat: supabaseRecord.soc_l2_contratacion || 0,
      primerAbono: supabaseRecord.primer_abono || 0,
      fechaPrimerAbono: supabaseRecord.fecha_primer_abono || '',
      segundoAbono: supabaseRecord.segundo_abono || 0,
      fechaSegundoAbono: supabaseRecord.fecha_segundo_abono || '',
      saldoPendiente: supabaseRecord.saldo_pendiente || 0,
      saldoPendienteTexto: supabaseRecord.saldo_pendiente_texto || '',
      previsionPago: supabaseRecord.prevision_pago_total || '',
      fechaJustificacion: supabaseRecord.fecha_justificacion || '',
      revisadoGestoria: supabaseRecord.revisado_gestoria || '',
      estado: supabaseRecord.estado || '',
      holdedAsentamiento: supabaseRecord.holded_asentamiento || '',
      importesPorCobrar: supabaseRecord.importes_por_cobrar || 0,
      fasesProyecto: {
        fase1: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_1),
        fase2: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_2),
        fase3: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_3),
        fase4: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_4),
        fase5: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_5),
        fase6: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_6),
        fase7: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_7),
        fase8: this.normalizeMarcadoFaseFromDb(supabaseRecord.fase_proyecto_8)
      }
    };
  }

  // Convertir formato interno al formato de Supabase
  formatInternalToSupabase(internalData) {
    // Función auxiliar para limpiar valores numéricos
    const cleanNumeric = (value) => {
      if (value === null || value === undefined || value === '') return 0;
      if (typeof value === 'number') return value;
      
      const str = value.toString().trim();
      
      // Si es texto descriptivo, devolver 0
      if (str.includes('PEND') || str.includes('ESTIMADOS') || 
          str.includes('SIN FECHA') || str.includes('POR DEFINIR') || 
          str.includes('GESTIONAR') || str.includes('SALDO') || 
          str.includes('%') || str.includes('SOLO')) {
        return 0;
      }
      
      // Si el valor tiene paréntesis o porcentajes, extraer solo el primer número
      let extractedValue = str;
      if (str.includes('(') || str.includes('%')) {
        extractedValue = str.split('(')[0].trim();
      }
      
      // Remover símbolos de moneda y espacios
      let cleanValue = extractedValue.replace(/[€$]/g, '').replace(/\s/g, '');
      
      // Convertir formato español a punto decimal
      if (cleanValue.includes(',')) {
        cleanValue = cleanValue.replace(/\./g, '').replace(',', '.');
      }
      
      const parsed = parseFloat(cleanValue);
      return isNaN(parsed) ? 0 : parsed;
    };

    return {
      nombre: internalData.nombre || '',
      proyecto: internalData.proyecto || '',
      imputacion: internalData.imputacion || '',
      expediente: internalData.expediente || '',
      codigo_subvencion: internalData.codigo || '',
      modalidad: internalData.modalidad || '',
      fecha_adjudicacion: internalData.fechaAdjudicacion || null,
      fase_actual: internalData.faseActual ?? null,
      importe_solicitado: cleanNumeric(internalData.importeSolicitado),
      importe_otorgado: cleanNumeric(internalData.importeOtorgado),
      periodo_ejecucion: internalData.periodo || '',
      soc_l1_acompanamiento: cleanNumeric(internalData.socL1Acomp),
      soc_l2_contratacion: cleanNumeric(internalData.socL2Contrat),
      primer_abono: cleanNumeric(internalData.primerAbono),
      fecha_primer_abono: internalData.fechaPrimerAbono || '',
      segundo_abono: cleanNumeric(internalData.segundoAbono),
      fecha_segundo_abono: internalData.fechaSegundoAbono || '',
      fase_proyecto_1: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase1),
      fase_proyecto_2: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase2),
      fase_proyecto_3: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase3),
      fase_proyecto_4: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase4),
      fase_proyecto_5: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase5),
      fase_proyecto_6: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase6),
      fase_proyecto_7: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase7),
      fase_proyecto_8: this.serializeMarcadoFaseParaSupabase(internalData.fasesProyecto?.fase8),
      saldo_pendiente: cleanNumeric(internalData.saldoPendiente),
      saldo_pendiente_texto: internalData.saldoPendienteTexto || '',
      prevision_pago_total: internalData.previsionPago || '',
      fecha_justificacion: internalData.fechaJustificacion || '',
      revisado_gestoria: internalData.revisadoGestoria || '',
      estado: internalData.estado || '',
      holded_asentamiento: internalData.holdedAsentamiento || '',
      importes_por_cobrar: cleanNumeric(internalData.importesPorCobrar)
    };
  }

  // Sincronizar datos procesados del CSV a Supabase
  async syncToSupabase(processedData) {
    try {
      console.log('🔄 Sincronizando datos con Supabase...');
      
      const results = {
        created: 0,
        updated: 0,
        errors: 0
      };

      // Primero, eliminar todas las subvenciones existentes
      const { error: deleteError } = await supabase
        .from('subvenciones')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');

      if (deleteError) {
        console.warn('⚠️ Error eliminando subvenciones existentes:', deleteError);
      } else {
        console.log('🗑️ Subvenciones anteriores eliminadas');
      }

      // Insertar todas las subvenciones del CSV
      for (const subvencion of processedData) {
        try {
          const supabaseData = this.formatInternalToSupabase(subvencion);
          
          const { data, error: insertError } = await supabase
            .from('subvenciones')
            .insert([supabaseData])
            .select();

          if (insertError) {
            console.error(`❌ Error insertando ${subvencion.nombre}:`, insertError);
            console.error('📋 Datos que causaron el error:', supabaseData);
            console.error('📋 Mensaje del error:', insertError.message);
            results.errors++;
          } else {
            results.created++;
          }
        } catch (error) {
          console.error(`❌ Error procesando ${subvencion.nombre}:`, error);
          results.errors++;
        }
      }

      console.log(`✅ Sincronización completada: ${results.created} creadas, ${results.errors} errores`);
      return results;
    } catch (error) {
      console.error('Error en syncToSupabase:', error);
      throw error;
    }
  }

  // Crear nueva subvención
  async createSubvencion(subvencionData) {
    try {
      const supabaseData = this.formatInternalToSupabase(subvencionData);
      
      const { data, error } = await supabase
        .from('subvenciones')
        .insert([supabaseData])
        .select()
        .single();

      if (error) throw error;
      
      return this.formatSupabaseToInternal(data);
    } catch (error) {
      console.error('Error creando subvención:', error);
      throw error;
    }
  }

  // Actualizar subvención existente
  async updateSubvencion(subvencionId, subvencionData) {
    try {
      const supabaseData = this.formatInternalToSupabase(subvencionData);
      
      const { data, error } = await supabase
        .from('subvenciones')
        .update(supabaseData)
        .eq('id', subvencionId)
        .select()
        .single();

      if (error) throw error;
      
      return this.formatSupabaseToInternal(data);
    } catch (error) {
      console.error('Error actualizando subvención:', error);
      throw error;
    }
  }

  // Eliminar subvención
  async deleteSubvencion(subvencionId) {
    try {
      const { error } = await supabase
        .from('subvenciones')
        .delete()
        .eq('id', subvencionId);

      if (error) throw error;
      
      return true;
    } catch (error) {
      console.error('Error eliminando subvención:', error);
      throw error;
    }
  }

  // ===== SUBVENCIONES ↔ EMPLEADOS (Holded) =====

  async getEmpleadosBySubvencionIds(subvencionIds = []) {
    if (!Array.isArray(subvencionIds) || subvencionIds.length === 0) return [];
    const { data, error } = await supabase
      .from('subvenciones_empleados')
      .select('*')
      .in('subvencion_id', subvencionIds);
    if (error) throw error;
    return data || [];
  }

  async getSubvencionesByEmpleadoHoldedId(empleadoHoldedId) {
    if (!empleadoHoldedId) return [];
    const { data, error } = await supabase
      .from('subvenciones_empleados')
      .select(
        `
        id,
        subvencion_id,
        empleado_holded_id,
        empleado_nombre,
        estado,
        created_at,
        updated_at,
        subvencion:subvenciones (
          id,
          nombre,
          estado
        )
      `
      )
      .eq('empleado_holded_id', String(empleadoHoldedId));
    if (error) throw error;
    return data || [];
  }

  async addEmpleadoToSubvencion({ subvencionId, empleadoHoldedId, empleadoNombre, estado = 'presentado' }) {
    const payload = {
      subvencion_id: subvencionId,
      empleado_holded_id: empleadoHoldedId,
      empleado_nombre: empleadoNombre || null,
      estado
    };

    const { data, error } = await supabase
      .from('subvenciones_empleados')
      .upsert(payload, { onConflict: 'subvencion_id,empleado_holded_id' })
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async updateEmpleadoSubvencion({ id, estado }) {
    const { data, error } = await supabase
      .from('subvenciones_empleados')
      .update({ estado })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async removeEmpleadoFromSubvencion({ id }) {
    const { error } = await supabase
      .from('subvenciones_empleados')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return true;
  }
}

export default new SubvencionesService();