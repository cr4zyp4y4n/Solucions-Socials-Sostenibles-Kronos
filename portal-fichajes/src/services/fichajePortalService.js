import { supabase } from '../config/supabase';

/**
 * Servicio del portal: solo lectura de fichajes.
 * Empleados se obtienen de fichajes (empleado_id único) + fichajes_codigos (descripcion = nombre).
 */

export async function obtenerTodosFichajes(filtros = {}) {
  try {
    let query = supabase.from('fichajes').select('*');

    if (filtros.empleadoId) query = query.eq('empleado_id', filtros.empleadoId);
    if (filtros.fechaInicio) query = query.gte('fecha', filtros.fechaInicio.toISOString().split('T')[0]);
    if (filtros.fechaFin) query = query.lte('fecha', filtros.fechaFin.toISOString().split('T')[0]);

    query = query.order('fecha', { ascending: false });

    const { data, error } = await query;
    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo fichajes:', err);
    return { success: false, data: [] };
  }
}

export async function obtenerFichajesEmpleado(empleadoId, fechaInicio, fechaFin) {
  try {
    const { data, error } = await supabase
      .from('fichajes')
      .select('*')
      .eq('empleado_id', empleadoId)
      .gte('fecha', fechaInicio.toISOString().split('T')[0])
      .lte('fecha', fechaFin.toISOString().split('T')[0])
      .order('fecha', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo fichajes empleado:', err);
    return { success: false, data: [] };
  }
}

/** Obtener códigos activos para mapear empleado_id -> nombre (descripcion) */
export async function obtenerCodigosParaNombres() {
  try {
    const { data, error } = await supabase
      .from('fichajes_codigos')
      .select('empleado_id, descripcion')
      .eq('activo', true);

    if (error) throw error;
    const map = {};
    (data || []).forEach((row) => {
      if (row.empleado_id && row.descripcion) {
        map[row.empleado_id] = row.descripcion.trim();
      }
    });
    return map;
  } catch (err) {
    console.error('Error obteniendo códigos:', err);
    return {};
  }
}

/**
 * Obtener todas las vacaciones en un rango (solo lectura, para panel listado).
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @returns {Promise<{ success: boolean, data: Array }>}
 */
export async function obtenerVacacionesEnRango(fechaInicio, fechaFin) {
  try {
    const { data, error } = await supabase
      .from('vacaciones')
      .select('*')
      .gte('fecha', fechaInicio.toISOString().split('T')[0])
      .lte('fecha', fechaFin.toISOString().split('T')[0])
      .order('empleado_id')
      .order('fecha', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo vacaciones en rango:', err);
    return { success: false, data: [] };
  }
}

/**
 * Lista de "empleados" para el panel: empleado_id únicos que tienen fichajes en el mes,
 * con nombre desde fichajes_codigos (descripcion).
 */
export async function obtenerEmpleadosConFichajes(fichajesMes) {
  const ids = [...new Set((fichajesMes || []).map((f) => f.empleado_id).filter(Boolean))];
  const nombres = await obtenerCodigosParaNombres();
  return ids.map((id) => ({
    id: id,
    nombreCompleto: nombres[id] || `Empleado ${id}`,
    name: nombres[id] || `Empleado ${id}`,
  }));
}
