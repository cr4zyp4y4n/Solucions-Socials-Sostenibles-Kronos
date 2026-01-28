/**
 * SERVICIO PARA GESTIÓN DE SUBVENCIONES DE EMPRESA DE INSERCIÓN (EI)
 * L1: Técnico de Acompañamiento
 * L2: Trabajadores con certificado de vulnerabilidad
 */

import { supabase } from '../config/supabase';
import * as XLSX from 'xlsx';

// ============================================================================
// FUNCIONES DE PARSEO
// ============================================================================

/**
 * Parsea precio/importe con formato español
 */
function parseCurrency(value) {
  if (!value || value === '' || value === null || value === undefined) return 0;
  
  const str = value.toString().trim();
  
  // Si contiene texto descriptivo, intentar extraer solo el número
  const cleaned = str
    .replace(/€/g, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '') // Eliminar separadores de miles
    .replace(',', '.'); // Convertir coma decimal a punto
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Parsea fecha en formato DD/MM/YYYY
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr === '' || dateStr === null) return null;
  
  const str = dateStr.toString().trim();
  const parts = str.split('/');
  
  if (parts.length === 3) {
    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Meses son 0-indexed
    const year = parseInt(parts[2], 10);
    
    if (!isNaN(day) && !isNaN(month) && !isNaN(year)) {
      return new Date(year, month, day);
    }
  }
  
  return null;
}

/**
 * Parsea periodo en formato "DD-MM-YY AL DD-MM-YY" o similar
 */
function parsePeriodo(periodoStr) {
  if (!periodoStr || periodoStr === '') return { inicio: null, fin: null };
  
  const str = periodoStr.toString().trim();
  
  // Intentar extraer fechas del formato "01-09-23 AL 30-09-24"
  const match = str.match(/(\d{1,2})-(\d{1,2})-(\d{2,4})\s+AL\s+(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  
  if (match) {
    const [, d1, m1, y1, d2, m2, y2] = match;
    
    // Ajustar año (si es 2 dígitos, asumir 2000-2099)
    const year1 = y1.length === 2 ? 2000 + parseInt(y1, 10) : parseInt(y1, 10);
    const year2 = y2.length === 2 ? 2000 + parseInt(y2, 10) : parseInt(y2, 10);
    
    const inicio = new Date(year1, parseInt(m1, 10) - 1, parseInt(d1, 10));
    const fin = new Date(year2, parseInt(m2, 10) - 1, parseInt(d2, 10));
    
    return { inicio, fin };
  }
  
  return { inicio: null, fin: null };
}

/**
 * Procesa el CSV L1 (Técnico de Acompañamiento)
 */
export function processL1CSV(csvText) {
  console.log('📋 Procesando CSV L1 (Técnico de Acompañamiento)...');
  
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  const subvenciones = [];
  
  // Buscar la fila de encabezados (fila 4, índice 3)
  const headerRow = jsonData[3] || [];
  
  // Procesar filas de datos (empezando desde la fila 5, índice 4)
  for (let i = 4; i < jsonData.length; i++) {
    const row = jsonData[i] || [];
    
    // Si la fila está vacía o no tiene técnico, saltar
    if (!row[0] || row[0].toString().trim() === '') continue;
    
    const tecnico = row[0]?.toString().trim();
    const expediente = row[1]?.toString().trim() || null;
    const numTrabajadores = parseInt(row[2]) || null;
    const periodo = row[3]?.toString().trim() || null;
    const fechaAbono80 = row[4] ? parseDate(row[4]) : null;
    const subvL1_80 = parseCurrency(row[5]);
    const fechaAbono20 = row[6] ? parseDate(row[6]) : null;
    const subvL1_20 = parseCurrency(row[7]);
    const costeEmpresa = parseCurrency(row[8]);
    const totalOtorgado = parseCurrency(row[9]);
    const costeReal = parseCurrency(row[10]);
    const observaciones = row[11]?.toString().trim() || null;
    
    // Parsear periodo para obtener fechas
    const { inicio, fin } = parsePeriodo(periodo);
    
    // Determinar estado
    let estado = 'PENDIENTE';
    let tieneConvocatoria = false;
    
    if (observaciones && observaciones.toLowerCase().includes('no ha salido convocatoria')) {
      estado = 'PENDIENTE';
      tieneConvocatoria = false;
    } else if (totalOtorgado > 0) {
      estado = subvL1_20 > 0 ? 'PARCIAL' : 'OTORGADO';
      tieneConvocatoria = true;
    }
    
    const subvencion = {
      tecnico,
      expediente,
      num_trabajadores: numTrabajadores,
      periodo,
      fecha_inicio: inicio,
      fecha_fin: fin,
      fecha_abono_80: fechaAbono80,
      subvencion_l1_80: subvL1_80,
      fecha_abono_20: fechaAbono20,
      subvencion_l1_20: subvL1_20,
      total_otorgado: totalOtorgado,
      coste_empresa_tecnico: costeEmpresa,
      coste_real_empresa: costeReal,
      observaciones,
      estado,
      tiene_convocatoria: tieneConvocatoria
    };
    
    subvenciones.push(subvencion);
  }
  
  console.log(`✅ Procesadas ${subvenciones.length} subvenciones L1`);
  return subvenciones;
}

/**
 * Procesa el CSV L2 (Trabajadores EI)
 */
export function processL2CSV(csvText) {
  console.log('📋 Procesando CSV L2 (Trabajadores EI)...');
  
  const workbook = XLSX.read(csvText, { type: 'string' });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
  
  const subvenciones = [];
  
  // El CSV tiene múltiples secciones con diferentes encabezados
  // Buscar todas las filas que empiezan con "LINEA" (encabezados)
  let currentHeaderRow = null;
  
  for (let i = 0; i < jsonData.length; i++) {
    const row = jsonData[i] || [];
    const firstCell = row[0]?.toString().trim();
    
    // Si encontramos una fila de encabezados
    if (firstCell === 'LINEA') {
      currentHeaderRow = row;
      continue;
    }
    
    // Si encontramos "TOTAL OTORGADO", es el final de una sección
    if (firstCell === '' && row[1]?.toString().trim() === 'TOTAL OTORGADO') {
      continue;
    }
    
    // Si la fila está vacía, saltar
    if (!firstCell || firstCell === '') continue;
    
    // Si no tenemos encabezados, saltar
    if (!currentHeaderRow) continue;
    
    // Procesar fila de datos
    const linea = row[0]?.toString().trim() || null;
    const trabajador = row[1]?.toString().trim();
    const fecha = row[2] ? parseDate(row[2]) : null;
    const jornada = row[3]?.toString().trim() || null;
    const expediente = row[4]?.toString().trim() || null;
    const periodo = row[5]?.toString().trim() || null;
    const periodoMeses = row[6] ? parseFloat(row[6].toString().replace(',', '.')) : null;
    const estado = row[7]?.toString().trim() || 'PENDIENTE';
    const subvL2_80 = parseCurrency(row[8]);
    const subvL2_20 = parseCurrency(row[9]);
    const costeEmpresa = parseCurrency(row[10]);
    const costeEmpresaMenosSubv = parseCurrency(row[11]);
    const costeReal = parseCurrency(row[13]);
    
    // Información adicional (puede estar en columnas posteriores)
    const dataAlta = row[18] ? parseDate(row[18]) : null;
    const dni = row[19]?.toString().trim() || null;
    const trabajadorSubv = row[20]?.toString().trim() || null;
    const tipoContrato = row[21]?.toString().trim() || null;
    const jornadaContrato = row[22]?.toString().trim() || null;
    const costeBruto = parseCurrency(row[23]);
    const costeEmpresaContrato = parseCurrency(row[24]);
    
    // Motivo de rechazo (si está disponible)
    const motivoRechazo = row[12]?.toString().trim() || null;
    
    // Determinar tipo de pago y subvención total
    let tipoPago = null;
    let subvL2_100 = 0;
    
    if (subvL2_80 > 0 && subvL2_20 > 0) {
      tipoPago = '80_20';
      subvL2_100 = subvL2_80 + subvL2_20;
    } else if (row[8] && parseCurrency(row[8]) > 0 && !row[9]) {
      // Si solo hay un campo y es el 100%
      subvL2_100 = parseCurrency(row[8]);
      tipoPago = '100';
    }
    
    // Si no hay trabajador, saltar
    if (!trabajador || trabajador === '') continue;
    
    const subvencion = {
      linea,
      trabajador,
      fecha_inicio: fecha,
      jornada,
      expediente,
      periodo,
      periodo_meses: periodoMeses,
      estado: estado.toUpperCase(),
      motivo_rechazo: motivoRechazo,
      subvencion_l2_80: subvL2_80,
      subvencion_l2_20: subvL2_20,
      subvencion_l2_100: subvL2_100,
      tipo_pago: tipoPago,
      coste_empresa_trabajador: costeEmpresa,
      coste_empresa_menos_subv: costeEmpresaMenosSubv,
      coste_real_empresa: costeReal,
      data_alta: dataAlta,
      dni,
      trabajador_subv: trabajadorSubv,
      tipo_contrato: tipoContrato,
      jornada_contrato: jornadaContrato,
      coste_bruto: costeBruto,
      coste_empresa_contrato: costeEmpresaContrato,
      finalizado_por_permiso: false // Se puede determinar si hay información específica
    };
    
    subvenciones.push(subvencion);
  }
  
  console.log(`✅ Procesadas ${subvenciones.length} subvenciones L2`);
  return subvenciones;
}

// ============================================================================
// SERVICIO DE SUPABASE
// ============================================================================

class EISubvencionesService {
  // ===== L1 (Técnico de Acompañamiento) =====
  
  async getAllL1() {
    try {
      const { data, error } = await supabase
        .from('ei_subvenciones_l1')
        .select('*')
        .order('fecha_inicio', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error obteniendo subvenciones L1:', error);
      throw error;
    }
  }
  
  async createL1(subvencionData) {
    try {
      const { data, error } = await supabase
        .from('ei_subvenciones_l1')
        .insert([subvencionData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creando subvención L1:', error);
      throw error;
    }
  }
  
  async syncL1FromCSV(csvText) {
    try {
      const processed = processL1CSV(csvText);
      const results = { created: 0, updated: 0, errors: 0 };
      
      for (const subvencion of processed) {
        try {
          // Buscar si ya existe (por técnico, expediente y periodo)
          const { data: existing } = await supabase
            .from('ei_subvenciones_l1')
            .select('id')
            .eq('tecnico', subvencion.tecnico)
            .eq('expediente', subvencion.expediente || '')
            .eq('periodo', subvencion.periodo || '')
            .maybeSingle();
          
          if (existing) {
            // Actualizar
            const { error } = await supabase
              .from('ei_subvenciones_l1')
              .update(subvencion)
              .eq('id', existing.id);
            
            if (error) throw error;
            results.updated++;
          } else {
            // Crear
            await this.createL1(subvencion);
            results.created++;
          }
        } catch (error) {
          console.error(`Error procesando subvención L1:`, error);
          results.errors++;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error sincronizando L1 desde CSV:', error);
      throw error;
    }
  }
  
  // ===== L2 (Trabajadores EI) =====
  
  async getAllL2() {
    try {
      const { data, error } = await supabase
        .from('ei_subvenciones_l2')
        .select('*')
        .order('fecha_inicio', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error obteniendo subvenciones L2:', error);
      throw error;
    }
  }
  
  async createL2(subvencionData) {
    try {
      const { data, error } = await supabase
        .from('ei_subvenciones_l2')
        .insert([subvencionData])
        .select()
        .single();
      
      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creando subvención L2:', error);
      throw error;
    }
  }
  
  async syncL2FromCSV(csvText) {
    try {
      const processed = processL2CSV(csvText);
      const results = { created: 0, updated: 0, errors: 0 };
      
      for (const subvencion of processed) {
        try {
          // Buscar si ya existe (por trabajador, expediente y periodo)
          const { data: existing } = await supabase
            .from('ei_subvenciones_l2')
            .select('id')
            .eq('trabajador', subvencion.trabajador)
            .eq('expediente', subvencion.expediente || '')
            .eq('periodo', subvencion.periodo || '')
            .maybeSingle();
          
          if (existing) {
            // Actualizar
            const { error } = await supabase
              .from('ei_subvenciones_l2')
              .update(subvencion)
              .eq('id', existing.id);
            
            if (error) throw error;
            results.updated++;
          } else {
            // Crear
            await this.createL2(subvencion);
            results.created++;
          }
        } catch (error) {
          console.error(`Error procesando subvención L2:`, error);
          results.errors++;
        }
      }
      
      return results;
    } catch (error) {
      console.error('Error sincronizando L2 desde CSV:', error);
      throw error;
    }
  }
}

export default new EISubvencionesService();
