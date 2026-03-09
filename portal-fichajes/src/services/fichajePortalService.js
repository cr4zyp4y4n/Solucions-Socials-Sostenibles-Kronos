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
 * Obtener vacaciones de un empleado en un rango (solo lectura, para calendario perfil).
 * @param {string} empleadoId
 * @param {Date} fechaInicio
 * @param {Date} fechaFin
 * @returns {Promise<{ success: boolean, data: Array }>}
 */
export async function obtenerVacacionesEmpleado(empleadoId, fechaInicio, fechaFin) {
  try {
    const { data, error } = await supabase
      .from('vacaciones')
      .select('*')
      .eq('empleado_id', empleadoId)
      .gte('fecha', fechaInicio.toISOString().split('T')[0])
      .lte('fecha', fechaFin.toISOString().split('T')[0])
      .order('fecha', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo vacaciones del empleado:', err);
    return { success: false, data: [] };
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
 * Obtener bajas de un empleado en un rango (solo lectura).
 */
export async function obtenerBajasEmpleado(empleadoId, fechaInicio, fechaFin) {
  try {
    const inicioStr = fechaInicio.toISOString().split('T')[0];
    const finStr = fechaFin.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('bajas')
      .select('*')
      .eq('empleado_id', empleadoId)
      .lte('fecha_inicio', finStr)
      .gte('fecha_fin', inicioStr)
      .order('fecha_inicio', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo bajas del empleado:', err);
    return { success: false, data: [] };
  }
}

/**
 * Obtener todas las bajas que solapan con un rango (solo lectura, para panel).
 */
export async function obtenerBajasEnRango(fechaInicio, fechaFin) {
  try {
    const inicioStr = fechaInicio.toISOString().split('T')[0];
    const finStr = fechaFin.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('bajas')
      .select('*')
      .lte('fecha_inicio', finStr)
      .gte('fecha_fin', inicioStr)
      .order('empleado_id')
      .order('fecha_inicio', { ascending: true });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo bajas en rango:', err);
    return { success: false, data: [] };
  }
}

/**
 * Obtener historial de auditoría de un fichaje (solo lectura, para inspección).
 * @param {string} fichajeId - UUID del fichaje
 * @returns {Promise<{ success: boolean, data: Array }>}
 */
export async function obtenerAuditoria(fichajeId) {
  try {
    const { data, error } = await supabase
      .from('fichajes_auditoria')
      .select(`
        *,
        quien:user_profiles(id, name, email)
      `)
      .eq('fichaje_id', fichajeId)
      .order('cuando', { ascending: false });

    if (error) throw error;
    return { success: true, data: data || [] };
  } catch (err) {
    console.error('Error obteniendo auditoría:', err);
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

// ========== ESCRITURA: Fichar entrada/salida (con ubicación) ==========

/**
 * Obtener empleado por código de fichaje (para pantalla de fichar).
 * @param {string} codigo
 * @returns {Promise<{ success: boolean, data?: { empleadoId: string, descripcion: string }, error?: string }>}
 */
export async function obtenerEmpleadoPorCodigo(codigo) {
  try {
    const c = (codigo || '').trim();
    if (!c) return { success: false, error: 'Introduce un código' };
    const { data, error } = await supabase
      .from('fichajes_codigos')
      .select('empleado_id, descripcion')
      .eq('codigo', c)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.empleado_id) return { success: false, error: 'Código no válido' };
    return {
      success: true,
      data: {
        empleadoId: data.empleado_id,
        descripcion: (data.descripcion || '').trim() || `Empleado (${c})`,
      },
    };
  } catch (err) {
    console.error('Error obteniendo empleado por código:', err);
    return { success: false, error: err.message || 'Error al validar el código' };
  }
}

/**
 * Obtener fichaje del día de un empleado.
 */
export async function obtenerFichajeDia(empleadoId, fecha = new Date()) {
  try {
    const fechaStr = fecha.toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('fichajes')
      .select('*')
      .eq('empleado_id', empleadoId)
      .eq('fecha', fechaStr)
      .maybeSingle();
    if (error) throw error;
    return { success: true, data: data || null };
  } catch (err) {
    console.error('Error obteniendo fichaje del día:', err);
    return { success: false, data: null };
  }
}

/**
 * Cerrar automáticamente un fichaje pendiente (RPC).
 */
async function cerrarFichajeAutomaticamente(fichajeId, motivo = null) {
  try {
    const { data, error } = await supabase.rpc('cerrar_fichaje_automaticamente', {
      p_fichaje_id: fichajeId,
      p_motivo: motivo || null,
    });
    if (!error) return { success: true, data: data && data.length > 0 ? data[0] : null };
    if (error.code === '42883' || error.message?.includes('does not exist')) {
      const { data: dataRpc } = await supabase.rpc('registrar_salida_fichaje', { p_fichaje_id: fichajeId });
      return { success: true, data: dataRpc && dataRpc.length > 0 ? dataRpc[0] : null };
    }
    throw error;
  } catch (err) {
    console.error('Error cerrando fichaje automáticamente:', err);
    return { success: false };
  }
}

/**
 * Crear fichaje de entrada (con ubicación opcional).
 * Cierra antes cualquier fichaje pendiente del empleado.
 * @param {string} empleadoId
 * @param {string} userId - auth.uid()
 * @param {{ lat: number, lng: number, texto?: string } | null} ubicacion
 */
export async function crearFichajeEntrada(empleadoId, userId, ubicacion = null) {
  try {
    const hoy = new Date();
    const fechaStr = hoy.toISOString().split('T')[0];

    const { data: existente } = await obtenerFichajeDia(empleadoId, hoy);
    if (existente) {
      return { success: false, error: 'Ya has fichado la entrada hoy' };
    }

    const { data: listaPendientes } = await supabase
      .from('fichajes')
      .select('id')
      .eq('empleado_id', empleadoId)
      .is('hora_salida', null);
    const pendientes = listaPendientes || [];
    for (const p of pendientes) {
      const id = p?.id;
      if (id) await cerrarFichajeAutomaticamente(id, 'Cerrado al fichar entrada desde el portal');
    }

    const payload = {
      empleado_id: empleadoId,
      fecha: fechaStr,
      hora_entrada: null,
      created_by: userId,
      es_modificado: false,
    };
    const lat = ubicacion?.lat != null ? Number(ubicacion.lat) : null;
    const lng = ubicacion?.lng != null ? Number(ubicacion.lng) : null;
    if (typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)) {
      payload.ubicacion_lat = lat;
      payload.ubicacion_lng = lng;
      if (ubicacion.texto) payload.ubicacion_texto = String(ubicacion.texto);
    }

    const { data, error } = await supabase.from('fichajes').insert(payload).select().single();
    if (error) throw error;
    return { success: true, data };
  } catch (err) {
    console.error('Error creando fichaje de entrada:', err);
    return { success: false, error: err.message || 'Error al registrar la entrada' };
  }
}

/**
 * Registrar salida en el fichaje del día.
 */
export async function registrarSalida(empleadoId) {
  try {
    const { data: fichaje } = await obtenerFichajeDia(empleadoId, new Date());
    if (!fichaje || !fichaje.id) return { success: false, error: 'No has fichado la entrada hoy' };
    if (fichaje.hora_salida) return { success: false, error: 'Ya has fichado la salida hoy' };
    const { data, error } = await supabase.rpc('registrar_salida_fichaje', { p_fichaje_id: fichaje.id });
    if (error) throw error;
    return { success: true, data: data && data.length > 0 ? data[0] : null };
  } catch (err) {
    console.error('Error registrando salida:', err);
    return { success: false, error: err.message || 'Error al registrar la salida' };
  }
}
