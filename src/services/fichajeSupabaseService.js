import { supabase } from '../config/supabase';

class FichajeSupabaseService {
  // =====================================================
  // OPERACIONES CRUD BÁSICAS
  // =====================================================

  /**
   * Crear un nuevo fichaje de entrada
   * @param {string} empleadoId - ID del empleado (de Holded)
   * @param {Date} fecha - Fecha del fichaje
   * @param {string} userId - ID del usuario que crea el fichaje
   * @param {Object} ubicacion - Opcional: { lat, lng, texto } desde donde se ficha
   * @returns {Promise<Object>} Fichaje creado
   */
  async crearFichajeEntrada(empleadoId, fecha, userId = null, ubicacion = null) {
    try {
      const payload = {
        empleado_id: empleadoId,
        fecha: fecha.toISOString().split('T')[0], // Solo la fecha (YYYY-MM-DD)
        hora_entrada: null, // El trigger usará now() (hora del servidor)
        created_by: userId,
        es_modificado: false
      };
      if (ubicacion && typeof ubicacion.lat === 'number' && typeof ubicacion.lng === 'number') {
        payload.ubicacion_lat = ubicacion.lat;
        payload.ubicacion_lng = ubicacion.lng;
        if (ubicacion.texto) payload.ubicacion_texto = ubicacion.texto;
      }
      const { data, error } = await supabase
        .from('fichajes')
        .insert(payload)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error creando fichaje de entrada:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Registrar salida en un fichaje existente
   * @param {string} fichajeId - ID del fichaje
   * @returns {Promise<Object>} Fichaje actualizado
   */
  async registrarSalida(fichajeId) {
    try {
      // Usar función RPC que actualiza directamente con hora del servidor
      const { data, error } = await supabase.rpc('registrar_salida_fichaje', {
        p_fichaje_id: fichajeId
      });

      if (error) throw error;
      
      // La función RPC devuelve un array, tomar el primer elemento
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      console.error('Error registrando salida:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener fichaje del día actual de un empleado
   * @param {string} empleadoId - ID del empleado
   * @param {Date} fecha - Fecha a consultar (opcional, por defecto hoy)
   * @returns {Promise<Object>} Fichaje del día
   */
  async obtenerFichajeDia(empleadoId, fecha = new Date()) {
    try {
      const fechaStr = fecha.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('fichajes')
        .select('*')
        .eq('empleado_id', empleadoId)
        .eq('fecha', fechaStr)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no encontrado
      return { success: true, data: data || null };
    } catch (error) {
      console.error('Error obteniendo fichaje del día:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener fichajes pendientes (sin hora de salida) de un empleado
   * @param {string} empleadoId - ID del empleado
   * @returns {Promise<Object>} Lista de fichajes pendientes
   */
  async obtenerFichajesPendientes(empleadoId) {
    try {
      const { data, error } = await supabase
        .from('fichajes')
        .select('*')
        .eq('empleado_id', empleadoId)
        .is('hora_salida', null)
        .order('fecha', { ascending: false });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error obteniendo fichajes pendientes:', error);
      return { success: false, error: error.message, data: [] };
    }
  }

  /**
   * Cerrar automáticamente un fichaje pendiente
   * @param {string} fichajeId - ID del fichaje
   * @param {string} motivo - Motivo del cierre automático (opcional)
   * @returns {Promise<Object>} Fichaje cerrado
   */
  async cerrarFichajeAutomaticamente(fichajeId, motivo = null) {
    try {
      // Usar la función RPC para cerrar el fichaje
      const { data, error } = await supabase.rpc('registrar_salida_fichaje', {
        p_fichaje_id: fichajeId
      });

      if (error) throw error;
      
      // Marcar como modificado automáticamente por el servidor
      const fichajeCerrado = data && data.length > 0 ? data[0] : null;
      if (fichajeCerrado) {
        const motivoCierre = motivo || 'Cerrado automáticamente por el servidor al fichar entrada en otro día';
        
        const { error: updateError } = await supabase
          .from('fichajes')
          .update({
            es_modificado: true,
            modificado_por: null, // null indica que fue el servidor
            fecha_modificacion: new Date().toISOString(),
            valor_original: {
              hora_salida: null,
              cerrado_automaticamente: true,
              motivo: motivoCierre,
              aviso: '⚠️ Este fichaje fue cerrado automáticamente porque se detectó que el empleado olvidó fichar la salida.'
            }
          })
          .eq('id', fichajeId);

        if (updateError) {
          console.warn('Error marcando fichaje como cerrado automáticamente:', updateError);
          // No fallar si no se puede marcar, el fichaje ya está cerrado
        }
      }

      return { success: true, data: fichajeCerrado };
    } catch (error) {
      console.error('Error cerrando fichaje automáticamente:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener todos los fichajes de un empleado en un rango de fechas
   * @param {string} empleadoId - ID del empleado
   * @param {Date} fechaInicio - Fecha de inicio
   * @param {Date} fechaFin - Fecha de fin
   * @returns {Promise<Object>} Lista de fichajes
   */
  async obtenerFichajesEmpleado(empleadoId, fechaInicio, fechaFin) {
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
    } catch (error) {
      console.error('Error obteniendo fichajes del empleado:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener todos los fichajes (para admin)
   * @param {Object} filtros - Filtros opcionales (empleadoId, fechaInicio, fechaFin)
   * @returns {Promise<Object>} Lista de fichajes
   */
  async obtenerTodosFichajes(filtros = {}) {
    try {
      let query = supabase
        .from('fichajes')
        .select('*');

      if (filtros.empleadoId) {
        query = query.eq('empleado_id', filtros.empleadoId);
      }

      if (filtros.fechaInicio) {
        query = query.gte('fecha', filtros.fechaInicio.toISOString().split('T')[0]);
      }

      if (filtros.fechaFin) {
        query = query.lte('fecha', filtros.fechaFin.toISOString().split('T')[0]);
      }

      query = query.order('fecha', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error obteniendo todos los fichajes:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // GESTIÓN DE PAUSAS
  // =====================================================

  /**
   * Iniciar una pausa
   * @param {string} fichajeId - ID del fichaje
   * @param {string} tipo - Tipo de pausa ('comida', 'descanso', 'cafe', 'otro')
   * @param {string} descripcion - Descripción opcional
   * @returns {Promise<Object>} Pausa creada
   */
  async iniciarPausa(fichajeId, tipo = 'descanso', descripcion = null) {
    try {
      // Usar null para que el trigger use now() (hora del servidor)
      const { data, error } = await supabase
        .from('fichajes_pausas')
        .insert({
          fichaje_id: fichajeId,
          tipo: tipo,
          inicio: null, // El trigger usará now() (hora del servidor)
          descripcion: descripcion
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error iniciando pausa:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Finalizar una pausa
   * @param {string} pausaId - ID de la pausa
   * @returns {Promise<Object>} Pausa actualizada
   */
  async finalizarPausa(pausaId) {
    try {
      // Usar función RPC que actualiza directamente con hora del servidor
      const { data, error } = await supabase.rpc('finalizar_pausa_fichaje', {
        p_pausa_id: pausaId
      });

      if (error) throw error;
      
      // La función RPC devuelve un array, tomar el primer elemento
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      console.error('Error finalizando pausa:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener pausas de un fichaje
   * @param {string} fichajeId - ID del fichaje
   * @returns {Promise<Object>} Lista de pausas
   */
  async obtenerPausas(fichajeId) {
    try {
      const { data, error } = await supabase
        .from('fichajes_pausas')
        .select('*')
        .eq('fichaje_id', fichajeId)
        .order('inicio', { ascending: true });

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error obteniendo pausas:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener pausa activa (sin finalizar) de un fichaje
   * @param {string} fichajeId - ID del fichaje
   * @returns {Promise<Object>} Pausa activa o null
   */
  async obtenerPausaActiva(fichajeId) {
    try {
      const { data, error } = await supabase
        .from('fichajes_pausas')
        .select('*')
        .eq('fichaje_id', fichajeId)
        .is('fin', null)
        .order('inicio', { ascending: false })
        .limit(1);

      if (error) throw error;
      
      // Si hay datos, devolver el primero; si no, null
      return { success: true, data: data && data.length > 0 ? data[0] : null };
    } catch (error) {
      console.error('Error obteniendo pausa activa:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // AÑADIR FICHAJE A POSTERIORI
  // =====================================================

  /**
   * Añadir un fichaje a posteriori (cuando el trabajador se olvidó)
   * @param {string} empleadoId - ID del empleado
   * @param {Date} fecha - Fecha del fichaje
   * @param {Date} horaEntrada - Hora de entrada
   * @param {Date} horaSalida - Hora de salida (opcional)
   * @param {string} userId - ID del usuario que añade el fichaje
   * @returns {Promise<Object>} Fichaje creado
   */
  async añadirFichajePosteriori(empleadoId, fecha, horaEntrada, horaSalida = null, userId = null) {
    try {
      const { data, error } = await supabase
        .from('fichajes')
        .insert({
          empleado_id: empleadoId,
          fecha: fecha.toISOString().split('T')[0],
          hora_entrada: horaEntrada.toISOString(),
          hora_salida: horaSalida ? horaSalida.toISOString() : null,
          es_modificado: true,
          modificado_por: userId,
          fecha_modificacion: new Date().toISOString(),
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error añadiendo fichaje a posteriori:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // MODIFICAR FICHAJE (SOLO ADMIN/JEFE)
  // =====================================================

  /**
   * Modificar un fichaje existente (solo admin/jefe)
   * @param {string} fichajeId - ID del fichaje
   * @param {Object} cambios - Cambios a realizar
   * @param {string} userId - ID del usuario que modifica
   * @param {string} motivo - Motivo de la modificación
   * @returns {Promise<Object>} Fichaje actualizado
   */
  async modificarFichaje(fichajeId, cambios, userId, motivo = null) {
    try {
      // Primero obtener el fichaje actual para guardar el valor original
      const { data: fichajeActual, error: errorActual } = await supabase
        .from('fichajes')
        .select('*')
        .eq('id', fichajeId)
        .single();

      if (errorActual) throw errorActual;

      // Guardar valor original
      const valorOriginal = {
        hora_entrada: fichajeActual.hora_entrada,
        hora_salida: fichajeActual.hora_salida,
        horas_trabajadas: fichajeActual.horas_trabajadas
      };

      // Preparar actualización
      const actualizacion = {
        ...cambios,
        es_modificado: true,
        modificado_por: userId,
        fecha_modificacion: new Date().toISOString(),
        valor_original: valorOriginal,
        notificado_trabajador: false, // Se notificará después
        validado_por_trabajador: false
      };

      // Actualizar fichaje
      const { data, error } = await supabase
        .from('fichajes')
        .update(actualizacion)
        .eq('id', fichajeId)
        .select()
        .single();

      if (error) throw error;

      // Registrar en auditoría con motivo
      if (motivo) {
        await supabase
          .from('fichajes_auditoria')
          .insert({
            fichaje_id: fichajeId,
            accion: 'modificado',
            quien: userId,
            cuando: new Date().toISOString(),
            valor_anterior: valorOriginal,
            valor_nuevo: cambios,
            motivo: motivo
          });
      }

      return { success: true, data };
    } catch (error) {
      console.error('Error modificando fichaje:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // VALIDACIÓN POR TRABAJADOR
  // =====================================================

  /**
   * Trabajador valida/acepta un cambio realizado por la empresa
   * @param {string} fichajeId - ID del fichaje
   * @param {boolean} aceptado - Si acepta o rechaza el cambio
   * @returns {Promise<Object>} Resultado
   */
  async validarCambio(fichajeId, aceptado) {
    try {
      const { data, error } = await supabase
        .from('fichajes')
        .update({
          validado_por_trabajador: aceptado
        })
        .eq('id', fichajeId)
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };
    } catch (error) {
      console.error('Error validando cambio:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // AUDITORÍA
  // =====================================================

  /**
   * Obtener historial de auditoría de un fichaje
   * @param {string} fichajeId - ID del fichaje
   * @returns {Promise<Object>} Lista de registros de auditoría
   */
  async obtenerAuditoria(fichajeId) {
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
    } catch (error) {
      console.error('Error obteniendo auditoría:', error);
      return { success: false, error: error.message };
    }
  }

  // =====================================================
  // RESUMENES Y ESTADÍSTICAS
  // =====================================================

  /**
   * Obtener resumen mensual de fichajes
   * @param {string} empleadoId - ID del empleado
   * @param {number} mes - Mes (1-12)
   * @param {number} ano - Año
   * @returns {Promise<Object>} Resumen mensual
   */
  async obtenerResumenMensual(empleadoId, mes, ano) {
    try {
      const { data, error } = await supabase
        .rpc('get_resumen_mensual_fichajes', {
          p_empleado_id: empleadoId,
          p_mes: mes,
          p_ano: ano
        });

      if (error) throw error;
      return { success: true, data: data?.[0] || null };
    } catch (error) {
      console.error('Error obteniendo resumen mensual:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Obtener fichajes pendientes de validación
   * @param {string} empleadoId - ID del empleado (opcional)
   * @returns {Promise<Object>} Lista de fichajes pendientes
   */
  async obtenerFichajesPendientesValidacion(empleadoId = null) {
    try {
      let query = supabase
        .from('fichajes')
        .select('*')
        .eq('es_modificado', true)
        .eq('notificado_trabajador', true)
        .eq('validado_por_trabajador', false);

      if (empleadoId) {
        query = query.eq('empleado_id', empleadoId);
      }

      const { data, error } = await query;

      if (error) throw error;
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Error obteniendo fichajes pendientes:', error);
      return { success: false, error: error.message };
    }
  }
}

// Exportar instancia única
const fichajeSupabaseService = new FichajeSupabaseService();
export default fichajeSupabaseService;



