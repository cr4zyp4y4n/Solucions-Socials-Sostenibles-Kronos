import * as XLSX from 'xlsx';

class SubvencionesService {
  constructor() {
    this.subvencionesData = [];
  }

  // Procesar datos CSV de subvenciones
  processCSVData(csvData) {
    try {
      // Convertir CSV a JSON
      const workbook = XLSX.read(csvData, { type: 'string' });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

      // Encontrar la fila que contiene los nombres de las subvenciones
      let subvencionesRowIndex = -1;
      let subvencionesNames = [];
      let subvencionesColumns = []; // Array de índices de columnas donde están las subvenciones

      for (let i = 0; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (row && row[0] === 'SUBVENCIÓN') {
          subvencionesRowIndex = i;
          
          // Encontrar todas las columnas que tienen nombres de subvenciones
          for (let j = 1; j < row.length; j++) {
            if (row[j] && row[j].trim() !== '') {
              subvencionesNames.push(row[j].trim());
              subvencionesColumns.push(j);
            }
          }
          break;
        }
      }

      if (subvencionesRowIndex === -1) {
        throw new Error('No se encontró la fila de subvenciones');
      }

      // Mapear los índices de las filas de datos (cada fila es un campo)
      const dataFields = [
        'SUBVENCIÓN',           // fila 8
        'PROYECTO',             // fila 9
        'IMPUTACIÓN',           // fila 10
        'No. EXPEDIENTE',       // fila 11
        'COD. SUBVENCIÓN -ORDEN', // fila 12
        'MODALIDAD',            // fila 13
        'FECHA FINAL ADJUDICACIÓN', // fila 14
        'IMPORTE SOLICITADO',   // fila 15
        'PERIODO DE EJECUCIÓN', // fila 16
        'IMPORTE OTORGADO',     // fila 17
        'SOC: L1 ACOMP',        // fila 18
        'SOC: L2 CONTRAT. TRABAJ', // fila 19
        '1r ABONO',             // fila 20
        'FECHA/CTA',            // fila 21
        '2o ABONO',             // fila 22
        'FECHA/CTA',            // fila 23
        'FASE DEL PROYECTO 1',  // fila 24
        'FASE DEL PROYECTO 2',  // fila 25
        'FASE DEL PROYECTO 3',  // fila 26
        'FASE DEL PROYECTO 4',  // fila 27
        'FASE DEL PROYECTO 5',  // fila 28
        'FASE DEL PROYECTO 6',  // fila 29
        'FASE DEL PROYECTO 7',  // fila 30
        'FASE DEL PROYECTO 8',  // fila 31
        'SALDO PDTE DE ABONO',  // fila 33
        'PREVISIÓN PAGO TOTAL', // fila 34
        'FECHA JUSTIFICACIÓN',  // fila 35
        'REV. GESTORIA',        // fila 41
        'ESTADO',               // fila 48
        'HOLDED ASENTAM.',      // fila 56
        'IMPORTES POR COBRAR'   // fila 57
      ];

      // Mapear índices específicos basados en la estructura real del CSV
      const fieldIndices = {
        'SUBVENCIÓN': subvencionesRowIndex,           // fila 8
        'PROYECTO': subvencionesRowIndex + 1,         // fila 9
        'IMPUTACIÓN': subvencionesRowIndex + 2,       // fila 10
        'No. EXPEDIENTE': subvencionesRowIndex + 3,   // fila 11
        'COD. SUBVENCIÓN -ORDEN': subvencionesRowIndex + 4, // fila 12
        'MODALIDAD': subvencionesRowIndex + 5,        // fila 13
        'FECHA FINAL ADJUDICACIÓN': subvencionesRowIndex + 6, // fila 14
        'IMPORTE SOLICITADO': subvencionesRowIndex + 7, // fila 15
        'PERIODO DE EJECUCIÓN': subvencionesRowIndex + 8, // fila 16
        'IMPORTE OTORGADO': subvencionesRowIndex + 9,  // fila 17
        'SOC: L1 ACOMP': subvencionesRowIndex + 10,    // fila 18
        'SOC: L2 CONTRAT. TRABAJ': subvencionesRowIndex + 11, // fila 19
        '1r ABONO': subvencionesRowIndex + 12,         // fila 20
        'FECHA/CTA': subvencionesRowIndex + 13,        // fila 21
        '2o ABONO': subvencionesRowIndex + 14,         // fila 22
        'FECHA/CTA': subvencionesRowIndex + 15,        // fila 23
        'FASE DEL PROYECTO 1': subvencionesRowIndex + 16, // fila 24
        'FASE DEL PROYECTO 2': subvencionesRowIndex + 17, // fila 25
        'FASE DEL PROYECTO 3': subvencionesRowIndex + 18, // fila 26
        'FASE DEL PROYECTO 4': subvencionesRowIndex + 19, // fila 27
        'FASE DEL PROYECTO 5': subvencionesRowIndex + 20, // fila 28
        'FASE DEL PROYECTO 6': subvencionesRowIndex + 21, // fila 29
        'FASE DEL PROYECTO 7': subvencionesRowIndex + 22, // fila 30
        'FASE DEL PROYECTO 8': subvencionesRowIndex + 23, // fila 31
        'SALDO PDTE DE ABONO': subvencionesRowIndex + 25, // fila 33 (hay una fila vacía en 32)
        'PREVISIÓN PAGO TOTAL': subvencionesRowIndex + 26, // fila 34
        'FECHA JUSTIFICACIÓN': subvencionesRowIndex + 27, // fila 35
        'REV. GESTORIA': subvencionesRowIndex + 33,     // fila 41 (hay varias filas de datos adicionales)
        'ESTADO': subvencionesRowIndex + 40            // fila 48
      };

      // Procesar cada subvención
      const processedSubvenciones = [];

      console.log('🔍 Procesando subvenciones:', subvencionesNames);
      console.log('📊 Columnas de subvenciones:', subvencionesColumns);
      console.log('📊 Índices de campos:', fieldIndices);

      subvencionesNames.forEach((subvencionName, index) => {
        if (!subvencionName || subvencionName.trim() === '') return;
        
        const columnIndex = subvencionesColumns[index]; // Usar el índice real de la columna

        const subvencionData = {
          id: index + 1,
          nombre: subvencionName.trim(),
          proyecto: this.getFieldValue(jsonData, fieldIndices['PROYECTO'], columnIndex),
          imputacion: this.getFieldValue(jsonData, fieldIndices['IMPUTACIÓN'], columnIndex),
          expediente: this.getFieldValue(jsonData, fieldIndices['No. EXPEDIENTE'], columnIndex),
          codigo: this.getFieldValue(jsonData, fieldIndices['COD. SUBVENCIÓN -ORDEN'], columnIndex),
          modalidad: this.getFieldValue(jsonData, fieldIndices['MODALIDAD'], columnIndex),
          fechaAdjudicacion: this.getFieldValue(jsonData, fieldIndices['FECHA FINAL ADJUDICACIÓN'], columnIndex),
          importeSolicitado: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['IMPORTE SOLICITADO'], columnIndex)),
          periodo: this.getFieldValue(jsonData, fieldIndices['PERIODO DE EJECUCIÓN'], columnIndex),
          importeOtorgado: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['IMPORTE OTORGADO'], columnIndex)),
          socL1Acomp: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['SOC: L1 ACOMP'], columnIndex)),
          socL2Contrat: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['SOC: L2 CONTRAT. TRABAJ'], columnIndex)),
          primerAbono: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['1r ABONO'], columnIndex)),
          fechaPrimerAbono: this.getFieldValue(jsonData, fieldIndices['FECHA/CTA'], columnIndex),
          segundoAbono: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['2o ABONO'], columnIndex)),
          fechaSegundoAbono: this.getFieldValue(jsonData, fieldIndices['FECHA/CTA'], columnIndex),
          fasesProyecto: {
            fase1: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 1'], columnIndex),
            fase2: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 2'], columnIndex),
            fase3: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 3'], columnIndex),
            fase4: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 4'], columnIndex),
            fase5: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 5'], columnIndex),
            fase6: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 6'], columnIndex),
            fase7: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 7'], columnIndex),
            fase8: this.getFieldValue(jsonData, fieldIndices['FASE DEL PROYECTO 8'], columnIndex)
          },
          saldoPendiente: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['SALDO PDTE DE ABONO'], columnIndex)),
          saldoPendienteTexto: this.getFieldValue(jsonData, fieldIndices['SALDO PDTE DE ABONO'], columnIndex),
          previsionPago: this.getFieldValue(jsonData, fieldIndices['PREVISIÓN PAGO TOTAL'], columnIndex),
          fechaJustificacion: this.getFieldValue(jsonData, fieldIndices['FECHA JUSTIFICACIÓN'], columnIndex),
          revisadoGestoria: this.getFieldValue(jsonData, fieldIndices['REV. GESTORIA'], columnIndex),
          estado: this.getFieldValue(jsonData, fieldIndices['ESTADO'], columnIndex),
          holdedAsentamiento: this.getFieldValue(jsonData, fieldIndices['HOLDED ASENTAM.'], columnIndex),
          importesPorCobrar: this.parseCurrency(this.getFieldValue(jsonData, fieldIndices['IMPORTES POR COBRAR'], columnIndex))
        };

        // Log de depuración para campos específicos
        if (index < 5) { // Solo para las primeras 5 subvenciones
          console.log(`📋 ${subvencionName} (Columna ${columnIndex}):`, {
            periodo: subvencionData.periodo,
            importeOtorgado: subvencionData.importeOtorgado,
            primerAbono: subvencionData.primerAbono,
            saldoPendiente: subvencionData.saldoPendiente
          });
        }

        // Limpiar datos vacíos o nulos
        Object.keys(subvencionData).forEach(key => {
          if (subvencionData[key] === '' || subvencionData[key] === null || subvencionData[key] === undefined) {
            if (typeof subvencionData[key] === 'number') {
              subvencionData[key] = 0;
            } else {
              subvencionData[key] = '';
            }
          }
        });

        processedSubvenciones.push(subvencionData);
      });

      this.subvencionesData = processedSubvenciones;
      return processedSubvenciones;

    } catch (error) {
      console.error('Error procesando datos CSV de subvenciones:', error);
      throw error;
    }
  }

  // Obtener valor de un campo específico
  getFieldValue(data, rowIndex, colIndex) {
    if (!data || rowIndex >= data.length || !data[rowIndex] || colIndex >= data[rowIndex].length) {
      return '';
    }
    return data[rowIndex][colIndex] || '';
  }

  // Parsear moneda a número
  parseCurrency(value) {
    if (!value || value === '') return 0;
    
    // Convertir a string para asegurar que tenemos un string
    const stringValue = value.toString();
    
    // Si contiene texto descriptivo (como "PEND. GESTIONAR"), devolver 0
    if (stringValue.includes('PEND') || stringValue.includes('GESTIONAR') || 
        stringValue.includes('SIN FECHA') || stringValue.includes('POR DEFINIR') ||
        stringValue.includes('ACLARAR') || stringValue.includes('CORRESP')) {
      return 0;
    }
    
    // Remover caracteres no numéricos excepto comas y puntos
    const cleanValue = stringValue.replace(/[^\d,.-]/g, '');
    
    // Si no hay números después de limpiar, devolver 0
    if (!cleanValue || cleanValue === '') return 0;
    
    // Detectar si es formato español (1.234,56) o inglés (1,234.56)
    const hasCommaDecimal = cleanValue.includes(',') && cleanValue.split(',')[1] && cleanValue.split(',')[1].length <= 2;
    const hasDotDecimal = cleanValue.includes('.') && cleanValue.split('.')[1] && cleanValue.split('.')[1].length <= 2;
    
    let normalizedValue;
    
    if (hasCommaDecimal) {
      // Formato español: 1.234,56 -> 1234.56
      normalizedValue = cleanValue.replace(/\./g, '').replace(',', '.');
    } else if (hasDotDecimal) {
      // Formato inglés: 1,234.56 -> 1234.56
      normalizedValue = cleanValue.replace(/,/g, '');
    } else {
      // Sin decimales claros, asumir formato español
      normalizedValue = cleanValue.replace(/\./g, '').replace(',', '.');
    }
    
    const parsed = parseFloat(normalizedValue);
    
    // Log de depuración para valores problemáticos
    if (value && value !== '' && (parsed < 1000 || stringValue.includes('.'))) {
      console.log(`💰 Parseando: "${stringValue}" -> "${cleanValue}" -> "${normalizedValue}" -> ${parsed}`);
    }
    
    return isNaN(parsed) ? 0 : parsed;
  }

  // Obtener datos procesados
  getSubvencionesData() {
    return this.subvencionesData;
  }

  // Filtrar subvenciones por criterios
  filterSubvenciones(filters) {
    let filtered = [...this.subvencionesData];

    if (filters.searchTerm) {
      const searchLower = filters.searchTerm.toLowerCase();
      filtered = filtered.filter(subvencion => {
        const nombre = (subvencion.nombre || '').toString().toLowerCase();
        const proyecto = (subvencion.proyecto || '').toString().toLowerCase();
        const expediente = (subvencion.expediente || '').toString().toLowerCase();
        
        return nombre.includes(searchLower) ||
               proyecto.includes(searchLower) ||
               expediente.includes(searchLower);
      });
    }

    if (filters.estado && filters.estado !== 'todos') {
      filtered = filtered.filter(subvencion => (subvencion.estado || '') === filters.estado);
    }

    if (filters.imputacion && filters.imputacion !== 'todos') {
      filtered = filtered.filter(subvencion => (subvencion.imputacion || '') === filters.imputacion);
    }

    if (filters.año) {
      filtered = filtered.filter(subvencion => {
        const periodo = (subvencion.periodo || '').toString();
        return periodo.includes(filters.año);
      });
    }

    return filtered;
  }

  // Obtener estadísticas
  getEstadisticas() {
    const total = this.subvencionesData.length;
    const totalOtorgado = this.subvencionesData.reduce((sum, s) => sum + s.importeOtorgado, 0);
    const totalPendiente = this.subvencionesData.reduce((sum, s) => sum + s.saldoPendiente, 0);
    const totalPorCobrar = this.subvencionesData.reduce((sum, s) => sum + s.importesPorCobrar, 0);

    const estados = {};
    this.subvencionesData.forEach(subvencion => {
      const estado = subvencion.estado || 'Sin estado';
      estados[estado] = (estados[estado] || 0) + 1;
    });

    const imputaciones = {};
    this.subvencionesData.forEach(subvencion => {
      const imputacion = subvencion.imputacion || 'Sin imputación';
      imputaciones[imputacion] = (imputaciones[imputacion] || 0) + 1;
    });

    return {
      total,
      totalOtorgado,
      totalPendiente,
      totalPorCobrar,
      estados,
      imputaciones
    };
  }

  // Exportar a Excel
  exportToExcel(subvenciones = null) {
    const dataToExport = subvenciones || this.subvencionesData;
    
    const wb = XLSX.utils.book_new();
    
    const excelData = dataToExport.map(subvencion => ({
      'Subvención': subvencion.nombre,
      'Proyecto': subvencion.proyecto,
      'Imputación': subvencion.imputacion,
      'Expediente': subvencion.expediente,
      'Código': subvencion.codigo,
      'Modalidad': subvencion.modalidad,
      'Fecha Adjudicación': subvencion.fechaAdjudicacion,
      'Importe Solicitado': subvencion.importeSolicitado,
      'Período': subvencion.periodo,
      'Importe Otorgado': subvencion.importeOtorgado,
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

    const ws = XLSX.utils.json_to_sheet(excelData);
    
    // Ajustar anchos de columna
    const colWidths = [
      { wch: 30 }, // Subvención
      { wch: 50 }, // Proyecto
      { wch: 15 }, // Imputación
      { wch: 25 }, // Expediente
      { wch: 20 }, // Código
      { wch: 20 }, // Modalidad
      { wch: 20 }, // Fecha Adjudicación
      { wch: 15 }, // Importe Solicitado
      { wch: 25 }, // Período
      { wch: 15 }, // Importe Otorgado
      { wch: 20 }, // SOC L1 Acompañamiento
      { wch: 20 }, // SOC L2 Contratación
      { wch: 15 }, // Primer Abono
      { wch: 20 }, // Fecha Primer Abono
      { wch: 15 }, // Segundo Abono
      { wch: 20 }, // Fecha Segundo Abono
      { wch: 15 }, // Saldo Pendiente
      { wch: 20 }, // Previsión Pago
      { wch: 25 }, // Fecha Justificación
      { wch: 20 }, // Revisado Gestoría
      { wch: 25 }, // Estado
      { wch: 20 }, // Holded Asentamiento
      { wch: 20 }  // Importes por Cobrar
    ];
    ws['!cols'] = colWidths;

    XLSX.utils.book_append_sheet(wb, ws, 'Subvenciones');
    
    return wb;
  }
}

export default new SubvencionesService();
