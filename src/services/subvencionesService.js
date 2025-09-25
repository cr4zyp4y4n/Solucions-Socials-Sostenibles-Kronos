import * as XLSX from 'xlsx';

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
        if (subvencionesRow[j] && subvencionesRow[j].trim() !== '') {
          subvencionesNames.push(subvencionesRow[j].trim());
          subvencionesColumns.push(j);
        }
      }

      console.log(`✅ Encontradas ${subvencionesNames.length} subvenciones`);

      // Procesar cada subvención
      const processedSubvenciones = subvencionesNames.map((subvencionName, index) => {
        const columnIndex = subvencionesColumns[index];
        return this.processSubvencionData(jsonData, columnIndex, subvencionName);
      });

      // Guardar en memoria
      this.subvencionesData = processedSubvenciones;
      console.log('💾 Datos guardados en memoria');
      
      return processedSubvenciones;

    } catch (error) {
      console.error('❌ Error procesando CSV:', error);
      throw error;
    }
  }

  // Procesar datos de una subvención específica
  processSubvencionData(jsonData, columnIndex, subvencionName) {
    // Mapeo de filas del CSV
    const rowMap = {
      proyecto: 8,           // Fila 9
      imputacion: 9,         // Fila 10
      expediente: 10,        // Fila 11
      codigo: 11,            // Fila 12
      modalidad: 12,         // Fila 13
      fechaAdjudicacion: 13, // Fila 14
      importeSolicitado: 14, // Fila 15
      periodo: 15,           // Fila 16
      importeOtorgado: 16,   // Fila 17
      socL1Acomp: 17,        // Fila 18
      socL2Contrat: 18,      // Fila 19
      primerAbono: 19,       // Fila 20
      fechaPrimerAbono: 20,  // Fila 21
      segundoAbono: 21,      // Fila 22
      fechaSegundoAbono: 22, // Fila 23
      fase1: 23,             // Fila 24
      fase2: 24,             // Fila 25
      fase3: 25,             // Fila 26
      fase4: 26,             // Fila 27
      fase5: 27,             // Fila 28
      fase6: 28,             // Fila 29
      fase7: 29,             // Fila 30
      fase8: 30,             // Fila 31
      saldoPendiente: 32,    // Fila 33
      previsionPago: 33,     // Fila 34
      fechaJustificacion: 34, // Fila 35
      revisadoGestoria: 40,  // Fila 41
      estado: 47,            // Fila 48
      holdedAsentamiento: 55, // Fila 56
      importesPorCobrar: 56  // Fila 57
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
    if (!value || value === '') return 0;
    
    const str = value.toString().trim();
    
    // Si contiene texto descriptivo, devolver 0
    if (str.includes('PEND.') || str.includes('ESTIMADOS') || 
        str.includes('SIN FECHA') || str.includes('POR DEFINIR') || str.includes('GESTIONAR')) {
      return 0;
    }
    
    // Remover símbolos de moneda y espacios
    let cleanValue = str.replace(/[€$]/g, '').replace(/\s/g, '');
    
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

  // Filtrar subvenciones
  filterSubvenciones({ searchTerm, estado, imputacion, fase, sortBy }) {
    let filtered = [...this.subvencionesData];

    // Filtro por término de búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(subvencion => 
        subvencion.nombre.toLowerCase().includes(term) ||
        subvencion.proyecto?.toLowerCase().includes(term) ||
        subvencion.expediente?.toLowerCase().includes(term) ||
        subvencion.codigo?.toLowerCase().includes(term)
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

    // Filtro por fase
    if (fase && fase !== 'Todas') {
      if (fase === 'sin-fases') {
        filtered = filtered.filter(subvencion => {
          const fases = subvencion.fasesProyecto || {};
          return !Object.values(fases).some(faseValue => faseValue && faseValue !== 'X' && faseValue.trim() !== '');
        });
      } else {
        filtered = filtered.filter(subvencion => {
          const fases = subvencion.fasesProyecto || {};
          return fases[`fase${fase}`] && fases[`fase${fase}`] !== 'X' && fases[`fase${fase}`].trim() !== '';
        });
      }
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

    const totalPendiente = totalOtorgado - totalAbonado;

    return {
      totalOtorgado,
      totalSolicitado,
      totalAbonado,
      totalPendiente,
      total: this.subvencionesData.length,
      totalSubvenciones: this.subvencionesData.length
    };
  }

  // Analizar fases del proyecto
  analizarFasesProyecto(fasesProyecto) {
    if (!fasesProyecto) return [];

    const nombresFases = {
      1: 'Fase 1 - Inicio del Proyecto',
      2: 'Fase 2 - Desarrollo',
      3: 'Fase 3 - Implementación',
      4: 'Fase 4 - Ejecución',
      5: 'Fase 5 - Seguimiento',
      6: 'Fase 6 - Evaluación',
      7: 'Fase 7 - Finalización',
      8: 'Fase 8 - Cierre'
    };

    const fases = [];
    for (let i = 1; i <= 8; i++) {
      const fase = fasesProyecto[`fase${i}`];
      
      // Verificar si es una fase activa
      if (fase && fase.trim() !== '') {
        // Si es "X" o contiene "Fase" en el texto, es una fase activa
        if (fase === 'X' || fase.toLowerCase().includes('fase')) {
          fases.push({
            numero: i,
            campo: `fase${i}`,
            nombre: nombresFases[i] || `Fase ${i}`,
            contenido: fase,
            activa: true
          });
        }
        // Si contiene "OK" o fechas, no es una fase activa, es información de seguimiento
        // (no se incluye en las fases activas)
      }
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
    
    return {
      estados: ['Todas', ...estados],
      imputaciones: ['Todas', ...imputaciones],
      fases: ['Todas', '1', '2', '3', '4', '5', '6', '7', '8']
    };
  }
}

export default new SubvencionesService();