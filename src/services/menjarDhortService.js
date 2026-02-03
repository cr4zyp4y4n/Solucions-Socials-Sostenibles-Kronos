/**
 * SERVICIO PARA GESTIÓN DE SUBVENCIONES DE MENJAR D'HORT SCCL
 * Maneja el formato horizontal especial del CSV
 */

import { supabase } from '../config/supabase';

// ============================================================================
// CONSTANTES
// ============================================================================

const TABLE_NAME = 'subvenciones_menjar_dhort';

// Mapeo de filas del CSV (índice 0 = primera línea), alineado con Subvenciones MH.csv
const ROW_MAPPING = {
  SUBVENCION: 5,            // Línea 6: SUBVENCIÓN
  PROYECTO: 6,              // Línea 7
  IMPUTACION: 7,            // Línea 8
  EXPEDIENTE: 8,            // Línea 9
  COD_SUBVENCION: 9,        // Línea 10
  MODALIDAD: 10,            // Línea 11 (línea 12 puede continuar modalidad)
  FECHA_ADJUDICACION: 12,   // Línea 13: FECHA FINAL ADJUDICACIÓN
  IMPORTE_SOLICITADO: 13,   // Línea 14
  PERIODO_EJECUCION: 14,    // Línea 15
  IMPORTE_OTORGADO: 15,     // Línea 16
  SOC_L1: 16,               // Línea 17
  SOC_L2: 17,               // Línea 18
  ARRELS_L3: 18,            // Línea 19
  PRIMER_ABONO: 19,         // Línea 20: 1r ABONO
  FECHA_PRIMER_ABONO: 20,   // Línea 21: FECHA/CTA
  SEGUNDO_ABONO: 21,        // Línea 22: 2o ABONO
  FECHA_SEGUNDO_ABONO: 22,  // Línea 23: FECHA/CTA
  SALDO_PENDIENTE: 33,      // Línea 34: SALDO PDTE DE ABONO
  PREVISION_PAGO: 34,       // Línea 35: PREVISIÓN PAGO TOTAL
  FECHA_JUSTIFICACION: 35,  // Línea 36: FECHA JUSTIFICACIÓN
  HOLDED_ASENTAMIENTO: 45,   // Línea 46: HOLDED ASENTAM.
  IMPORTES_POR_COBRAR: 46,   // Línea 47: IMPORTES POR COBRAR
  ADM_DIFERENCIAS: 49,       // Línea 50: ADM. DIFERENCIAS
  FASE_PROYECTO: 58         // Línea 59: FASE DEL PROYECTO - ESTADO
};

// ============================================================================
// FUNCIONES DE PARSEO
// ============================================================================

/**
 * Parsea precio/importe con formato español
 */
function parseCurrency(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number' && (value > 1e10 || value < -1e10)) return null;
  const str = value.toString().trim();
  const cleaned = str
    .replace(/€/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(',', '.');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

/**
 * Procesa el CSV con formato horizontal
 */
export function processHorizontalCSV(csvText) {
  console.log('📋 Procesando CSV horizontal de Menjar d\'Hort...');
  
  // Dividir en líneas; Subvenciones MH.csv usa punto y coma (;) como delimitador
  const lines = csvText.split(/\r?\n/).map(line => {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ';' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  });

  console.log(`📄 Total de líneas: ${lines.length}`);

  const headerRow = lines[ROW_MAPPING.SUBVENCION] || [];
  // MH: una subvención por columna; saltar columna 0 (etiqueta). Nombres en 1, 3, 5... o consecutivos
  const subvenciones = [];
  for (let col = 1; col < headerRow.length; col++) {
    const nombre = headerRow[col];
    
    // Si no hay nombre, saltar esta columna
    if (!nombre || nombre.trim() === '') continue;
    
    // Extraer datos de esta subvención
    const subvencion = {
      nombre: nombre.trim(),
      proyecto: lines[ROW_MAPPING.PROYECTO]?.[col] || '',
      imputacion: lines[ROW_MAPPING.IMPUTACION]?.[col] || '',
      expediente: lines[ROW_MAPPING.EXPEDIENTE]?.[col] || '',
      codigoSubvencion: lines[ROW_MAPPING.COD_SUBVENCION]?.[col] || '',
      modalidad: (lines[ROW_MAPPING.MODALIDAD]?.[col] || '') + ' ' + (lines[ROW_MAPPING.MODALIDAD + 1]?.[col] || ''),
      fechaAdjudicacion: lines[ROW_MAPPING.FECHA_ADJUDICACION]?.[col] || '',
      importeSolicitado: parseCurrency(lines[ROW_MAPPING.IMPORTE_SOLICITADO]?.[col]),
      periodoEjecucion: lines[ROW_MAPPING.PERIODO_EJECUCION]?.[col] || '',
      importeOtorgado: parseCurrency(lines[ROW_MAPPING.IMPORTE_OTORGADO]?.[col]),
      socL1Acompanamiento: lines[ROW_MAPPING.SOC_L1]?.[col] || '',
      socL2Contratacion: lines[ROW_MAPPING.SOC_L2]?.[col] || '',
      arrelsEssL3: lines[ROW_MAPPING.ARRELS_L3]?.[col] || '',
      primerAbono: parseCurrency(lines[ROW_MAPPING.PRIMER_ABONO]?.[col]),
      fechaPrimerAbono: lines[ROW_MAPPING.FECHA_PRIMER_ABONO]?.[col] || '',
      segundoAbono: parseCurrency(lines[ROW_MAPPING.SEGUNDO_ABONO]?.[col]),
      fechaSegundoAbono: lines[ROW_MAPPING.FECHA_SEGUNDO_ABONO]?.[col] || '',
      saldoPendiente: parseCurrency(lines[ROW_MAPPING.SALDO_PENDIENTE]?.[col]),
      previsionPagoTotal: lines[ROW_MAPPING.PREVISION_PAGO]?.[col] || '',
      fechaJustificacion: lines[ROW_MAPPING.FECHA_JUSTIFICACION]?.[col] || '',
      holdedAsentamiento: lines[ROW_MAPPING.HOLDED_ASENTAMIENTO]?.[col] || '',
      importesPorCobrar: lines[ROW_MAPPING.IMPORTES_POR_COBRAR]?.[col] || '',
      admDiferencias: lines[ROW_MAPPING.ADM_DIFERENCIAS]?.[col] || '',
      faseProyecto: lines[ROW_MAPPING.FASE_PROYECTO]?.[col] || '',
      estado: 'ACTIVO',
      revisadoGestoria: false
    };
    
    // Notas: líneas entre FECHA JUSTIFICACIÓN (35) y HOLDED (45), y entre IMPORTES (46) y FASE (58)
    const notas = [];
    for (let i = 36; i <= 44; i++) {
      const nota = lines[i]?.[col];
      if (nota && nota.trim() !== '') notas.push(nota.trim());
    }
    for (let i = 48; i < 58; i++) {
      const nota = lines[i]?.[col];
      if (nota && nota.trim() !== '') notas.push(nota.trim());
    }
    subvencion.notas = notas.join('\n');
    
    console.log(`📋 ${subvencion.nombre}:`, {
      importeOtorgado: subvencion.importeOtorgado,
      importeSolicitado: subvencion.importeSolicitado,
      primerAbono: subvencion.primerAbono,
      segundoAbono: subvencion.segundoAbono,
      saldoPendiente: subvencion.saldoPendiente,
      faseProyecto: subvencion.faseProyecto
    });
    
    subvenciones.push(subvencion);
  }
  
  console.log(`✅ Procesadas ${subvenciones.length} subvenciones`);
  return subvenciones;
}

// ============================================================================
// CACHE DE DATOS
// ============================================================================

// Variable para almacenar los datos cargados
let cachedData = [];

/**
 * Establece los datos en cache para filtrado
 */
export function setData(data) {
  cachedData = data;
}

// ============================================================================
// FUNCIONES DE SUPABASE
// ============================================================================

/**
 * Carga subvenciones desde Supabase
 */
export async function loadFromSupabase() {
  console.log('📥 Cargando subvenciones de Menjar d\'Hort desde Supabase...');
  
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .select('*')
    .order('nombre', { ascending: true });
  
  if (error) {
    console.error('❌ Error cargando desde Supabase:', error);
    throw error;
  }
  
  console.log(`✅ ${data.length} subvenciones cargadas desde Supabase`);
  const formattedData = data.map(formatSupabaseToInternal);
  
  // Actualizar cache para filtrado
  setData(formattedData);
  
  return formattedData;
}

/**
 * Sincroniza datos procesados con Supabase
 */
export async function syncToSupabase(subvenciones) {
  console.log('🔄 Sincronizando datos de Menjar d\'Hort con Supabase...');
  
  // 1. Eliminar subvenciones anteriores
  const { error: deleteError } = await supabase
    .from(TABLE_NAME)
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todo
  
  if (deleteError) {
    console.error('❌ Error eliminando datos anteriores:', deleteError);
    throw deleteError;
  }
  
  console.log('🗑️ Subvenciones anteriores eliminadas');
  
  // 2. Insertar nuevas subvenciones
  let createdCount = 0;
  let errorCount = 0;
  
  for (const subvencion of subvenciones) {
    const dbFormat = formatInternalToSupabase(subvencion);
    
    const { error } = await supabase
      .from(TABLE_NAME)
      .insert(dbFormat);
    
    if (error) {
      console.error(`❌ Error insertando ${subvencion.nombre}:`, error);
      errorCount++;
    } else {
      createdCount++;
    }
  }
  
  console.log(`✅ Sincronización completada: ${createdCount} creadas, ${errorCount} errores`);
  return { createdCount, errorCount };
}

/**
 * Crea una nueva subvención
 */
export async function createSubvencion(subvencion) {
  const dbFormat = formatInternalToSupabase(subvencion);
  
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .insert(dbFormat)
    .select()
    .single();
  
  if (error) throw error;
  return formatSupabaseToInternal(data);
}

/**
 * Actualiza una subvención existente
 */
export async function updateSubvencion(id, updates) {
  const dbFormat = formatInternalToSupabase(updates);
  delete dbFormat.id;
  delete dbFormat.created_at;
  delete dbFormat.created_by;
  
  const { data, error } = await supabase
    .from(TABLE_NAME)
    .update(dbFormat)
    .eq('id', id)
    .select()
    .single();
  
  if (error) throw error;
  return formatSupabaseToInternal(data);
}

/**
 * Elimina una subvención
 */
export async function deleteSubvencion(id) {
  const { error } = await supabase
    .from(TABLE_NAME)
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ============================================================================
// FUNCIONES DE FORMATO
// ============================================================================

function formatSupabaseToInternal(dbRow) {
  return {
    id: dbRow.id,
    nombre: dbRow.nombre || '',
    proyecto: dbRow.proyecto || '',
    imputacion: dbRow.imputacion || '',
    expediente: dbRow.expediente || '',
    codigoSubvencion: dbRow.codigo_subvencion || '',
    modalidad: dbRow.modalidad || '',
    fechaAdjudicacion: dbRow.fecha_adjudicacion || '',
    importeSolicitado: dbRow.importe_solicitado,
    periodoEjecucion: dbRow.periodo_ejecucion || '',
    importeOtorgado: dbRow.importe_otorgado,
    socL1Acompanamiento: dbRow.soc_l1_acompanamiento || '',
    socL2Contratacion: dbRow.soc_l2_contratacion || '',
    arrelsEssL3: dbRow.arrels_ess_l3 || '',
    primerAbono: dbRow.primer_abono,
    fechaPrimerAbono: dbRow.fecha_primer_abono || '',
    segundoAbono: dbRow.segundo_abono,
    fechaSegundoAbono: dbRow.fecha_segundo_abono || '',
    saldoPendiente: dbRow.saldo_pendiente,
    previsionPagoTotal: dbRow.prevision_pago_total || '',
    fechaJustificacion: dbRow.fecha_justificacion || '',
    holdedAsentamiento: dbRow.holded_asentamiento || '',
    importesPorCobrar: dbRow.importes_por_cobrar || '',
    admDiferencias: dbRow.adm_diferencias || '',
    faseProyecto: dbRow.fase_proyecto || '',
    estado: dbRow.estado || 'ACTIVO',
    revisadoGestoria: dbRow.revisado_gestoria || false,
    notas: dbRow.notas || '',
    createdAt: dbRow.created_at,
    updatedAt: dbRow.updated_at
  };
}

function formatInternalToSupabase(internal) {
  return {
    nombre: internal.nombre || '',
    proyecto: internal.proyecto || '',
    imputacion: internal.imputacion || '',
    expediente: internal.expediente || '',
    codigo_subvencion: internal.codigoSubvencion || '',
    modalidad: internal.modalidad || '',
    fecha_adjudicacion: internal.fechaAdjudicacion || '',
    importe_solicitado: internal.importeSolicitado,
    periodo_ejecucion: internal.periodoEjecucion || '',
    importe_otorgado: internal.importeOtorgado,
    soc_l1_acompanamiento: internal.socL1Acompanamiento || '',
    soc_l2_contratacion: internal.socL2Contratacion || '',
    arrels_ess_l3: internal.arrelsEssL3 || '',
    primer_abono: internal.primerAbono,
    fecha_primer_abono: internal.fechaPrimerAbono || '',
    segundo_abono: internal.segundoAbono,
    fecha_segundo_abono: internal.fechaSegundoAbono || '',
    saldo_pendiente: internal.saldoPendiente,
    prevision_pago_total: internal.previsionPagoTotal || '',
    fecha_justificacion: internal.fechaJustificacion || '',
    holded_asentamiento: internal.holdedAsentamiento || '',
    importes_por_cobrar: internal.importesPorCobrar || '',
    adm_diferencias: internal.admDiferencias || '',
    fase_proyecto: internal.faseProyecto || '',
    estado: internal.estado || 'ACTIVO',
    revisado_gestoria: internal.revisadoGestoria || false,
    notas: internal.notas || ''
  };
}

// ============================================================================
// FUNCIONES DE FILTRADO Y ESTADÍSTICAS (compatibilidad con SubvencionesPage)
// ============================================================================

/**
 * Filtra subvenciones según criterios
 */
export function filterSubvenciones({ searchTerm = '', imputacion = 'Todas', fase = 'Todas', año = 'Todos' }) {
  let filtered = [...cachedData];

  // Filtrar por término de búsqueda
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filtered = filtered.filter(sub => 
      (sub.nombre && sub.nombre.toLowerCase().includes(term)) ||
      (sub.proyecto && sub.proyecto.toLowerCase().includes(term)) ||
      (sub.expediente && sub.expediente.toLowerCase().includes(term))
    );
  }

  // Filtrar por imputación
  if (imputacion !== 'Todas') {
    filtered = filtered.filter(sub => sub.imputacion === imputacion);
  }

  // Filtrar por fase (usando faseProyecto)
  if (fase !== 'Todas') {
    filtered = filtered.filter(sub => {
      if (!sub.faseProyecto) return false;
      return sub.faseProyecto.includes(`FASE ${fase}`);
    });
  }

  // Filtrar por año
  if (año !== 'Todos') {
    filtered = filtered.filter(sub => {
      return isSubvencionActiveInYear(sub.periodoEjecucion, año);
    });
  }

  return filtered;
}

/**
 * Obtiene opciones de filtros disponibles
 */
export function getFiltros() {
  const imputaciones = [...new Set(cachedData.map(s => s.imputacion).filter(Boolean))];
  
  // Obtener años disponibles
  const años = getAvailableYears();
  
  return {
    imputaciones: ['Todas', ...imputaciones.sort()],
    fases: ['Todas', '1', '2', '3', '4', '5', '6', '7', '8'],
    años: años
  };
}

/**
 * Calcula estadísticas generales
 */
export function getEstadisticas() {
  const total = cachedData.length;
  const totalOtorgado = cachedData.reduce((sum, s) => sum + (s.importeOtorgado || 0), 0);
  const totalPendiente = cachedData.reduce((sum, s) => sum + (s.saldoPendiente || 0), 0);
  
  // Intentar calcular total por cobrar desde el campo correspondiente
  const totalPorCobrar = cachedData.reduce((sum, s) => {
    if (s.importesPorCobrar) {
      // Intentar parsear el importe
      const parsed = parseCurrency(s.importesPorCobrar);
      return sum + (parsed || 0);
    }
    return sum;
  }, 0);

  return {
    total,
    totalOtorgado,
    totalPendiente,
    totalPorCobrar
  };
}

// ============================================================================
// FUNCIONES DE AÑOS
// ============================================================================

/**
 * Verifica si una subvención está activa en un año específico
 * @param {string} periodo - Período de ejecución (ej: "01/11/2023 - 30/11/2024")
 * @param {string} año - Año a verificar (ej: "2023")
 * @returns {boolean}
 */
function isSubvencionActiveInYear(periodo, año) {
  if (!periodo || !año) return false;
  
  // Si el período contiene el año directamente
  if (periodo.includes(año)) return true;
  
  // Intentar parsear fechas de inicio y fin
  const partes = periodo.split(' - ');
  if (partes.length === 2) {
    const fechaInicio = parseDate(partes[0].trim());
    const fechaFin = parseDate(partes[1].trim());
    
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
function getAvailableYears() {
  const años = new Set();
  
  cachedData.forEach(subvencion => {
    if (subvencion.periodoEjecucion) {
      // Extraer años del período
      const añosEnPeriodo = extractYearsFromPeriod(subvencion.periodoEjecucion);
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
function extractYearsFromPeriod(periodo) {
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
 * Parsea una fecha en formato DD/MM/YYYY o YYYY-MM-DD
 * @param {string} dateStr - String de fecha
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  if (!dateStr) return null;
  
  // Formato DD/MM/YYYY
  if (dateStr.includes('/')) {
    const partes = dateStr.split('/');
    if (partes.length === 3) {
      const dia = parseInt(partes[0]);
      const mes = parseInt(partes[1]) - 1; // Los meses en JS van de 0-11
      const año = parseInt(partes[2]);
      return new Date(año, mes, dia);
    }
  }
  
  // Formato YYYY-MM-DD
  if (dateStr.includes('-')) {
    const fecha = new Date(dateStr);
    return isNaN(fecha.getTime()) ? null : fecha;
  }
  
  return null;
}

// La función setData ya se declara arriba, solo necesitamos asegurarnos de que
// loadFromSupabase la llama (ya lo hace en la línea 204)
