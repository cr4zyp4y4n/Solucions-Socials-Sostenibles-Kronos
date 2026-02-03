import fichajeSupabaseService from './fichajeSupabaseService';
import holdedEmployeesService from './holdedEmployeesService';
import { supabase } from '../config/supabase';

class FichajeService {
  // =====================================================
  // OPERACIONES PRINCIPALES
  // =====================================================

  /**
   * Fichar entrada
   * @param {string} empleadoId - ID del empleado
   * @param {string} userId - ID del usuario autenticado
   * @returns {Promise<Object>} Resultado del fichaje
   */
  async ficharEntrada(empleadoId, userId) {
    try {
      const hoy = new Date();
      
      // Verificar si ya existe un fichaje hoy
      const { data: fichajeExistente } = await fichajeSupabaseService.obtenerFichajeDia(empleadoId, hoy);
      
      if (fichajeExistente) {
        return {
          success: false,
          error: 'Ya has fichado la entrada hoy',
          data: fichajeExistente
        };
      }

      // ANTES de crear el nuevo fichaje, cerrar automáticamente cualquier fichaje pendiente
      await this.verificarYcerrarFichajesOlvidados(empleadoId);

      // Crear nuevo fichaje
      const resultado = await fichajeSupabaseService.crearFichajeEntrada(empleadoId, hoy, userId);
      
      if (!resultado.success) {
        return resultado;
      }

      return {
        success: true,
        message: 'Entrada registrada correctamente',
        data: resultado.data
      };
    } catch (error) {
      console.error('Error en ficharEntrada:', error);
      return {
        success: false,
        error: error.message || 'Error al registrar la entrada'
      };
    }
  }

  /**
   * Fichar salida
   * @param {string} empleadoId - ID del empleado
   * @param {string} userId - ID del usuario autenticado
   * @returns {Promise<Object>} Resultado del fichaje
   */
  async ficharSalida(empleadoId, userId) {
    try {
      const hoy = new Date();
      
      // Obtener fichaje del día
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(empleadoId, hoy);
      
      if (!fichaje) {
        return {
          success: false,
          error: 'No has fichado la entrada hoy'
        };
      }

      if (fichaje.hora_salida) {
        return {
          success: false,
          error: 'Ya has fichado la salida hoy',
          data: fichaje
        };
      }

      // Verificar si hay pausas activas
      const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
      
      if (pausaActiva) {
        return {
          success: false,
          error: 'Tienes una pausa activa. Por favor, finaliza la pausa antes de fichar la salida'
        };
      }

      // Registrar salida
      const resultado = await fichajeSupabaseService.registrarSalida(fichaje.id);
      
      if (!resultado.success) {
        return resultado;
      }

      return {
        success: true,
        message: 'Salida registrada correctamente',
        data: resultado.data
      };
    } catch (error) {
      console.error('Error en ficharSalida:', error);
      return {
        success: false,
        error: error.message || 'Error al registrar la salida'
      };
    }
  }

  /**
   * Iniciar pausa
   * @param {string} empleadoId - ID del empleado
   * @param {string} tipo - Tipo de pausa
   * @param {string} descripcion - Descripción opcional
   * @returns {Promise<Object>} Resultado
   */
  async iniciarPausa(empleadoId, tipo = 'descanso', descripcion = null) {
    try {
      const hoy = new Date();
      
      // Obtener fichaje del día
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(empleadoId, hoy);
      
      if (!fichaje) {
        return {
          success: false,
          error: 'No has fichado la entrada hoy'
        };
      }

      if (fichaje.hora_salida) {
        return {
          success: false,
          error: 'Ya has fichado la salida. No puedes iniciar una pausa'
        };
      }

      // Verificar si ya hay una pausa activa
      const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
      
      if (pausaActiva) {
        return {
          success: false,
          error: 'Ya tienes una pausa activa. Finaliza la pausa actual antes de iniciar otra'
        };
      }

      // Iniciar pausa
      const resultado = await fichajeSupabaseService.iniciarPausa(fichaje.id, tipo, descripcion);
      
      if (!resultado.success) {
        return resultado;
      }

      return {
        success: true,
        message: `Pausa de ${tipo} iniciada`,
        data: resultado.data
      };
    } catch (error) {
      console.error('Error en iniciarPausa:', error);
      return {
        success: false,
        error: error.message || 'Error al iniciar la pausa'
      };
    }
  }

  /**
   * Finalizar pausa
   * @param {string} empleadoId - ID del empleado
   * @returns {Promise<Object>} Resultado
   */
  async finalizarPausa(empleadoId) {
    try {
      const hoy = new Date();
      
      // Obtener fichaje del día
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(empleadoId, hoy);
      
      if (!fichaje) {
        return {
          success: false,
          error: 'No has fichado la entrada hoy'
        };
      }

      // Obtener pausa activa
      const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
      
      if (!pausaActiva) {
        return {
          success: false,
          error: 'No tienes ninguna pausa activa'
        };
      }

      // Finalizar pausa
      const resultado = await fichajeSupabaseService.finalizarPausa(pausaActiva.id);
      
      if (!resultado.success) {
        return resultado;
      }

      // Recalcular horas trabajadas
      await this.recalcularHoras(fichaje.id);

      return {
        success: true,
        message: 'Pausa finalizada correctamente',
        data: resultado.data
      };
    } catch (error) {
      console.error('Error en finalizarPausa:', error);
      return {
        success: false,
        error: error.message || 'Error al finalizar la pausa'
      };
    }
  }

  /**
   * Verificar y cerrar fichajes olvidados para todos los empleados (para admin)
   * @returns {Promise<Object>} Resultado de la verificación
   */
  async verificarYcerrarFichajesOlvidadosTodos() {
    try {
      // Obtener todos los fichajes pendientes (sin hora_salida) de todos los empleados
      const { data: todosFichajesPendientes, error } = await supabase
        .from('fichajes')
        .select('empleado_id')
        .is('hora_salida', null)
        .order('fecha', { ascending: false });

      if (error) throw error;

      // Obtener empleados únicos
      const empleadosUnicos = [...new Set(todosFichajesPendientes.map(f => f.empleado_id))];
      
      let totalCerrados = 0;
      let totalErrores = 0;

      // Verificar fichajes olvidados para cada empleado
      for (const empleadoId of empleadosUnicos) {
        try {
          await this.verificarYcerrarFichajesOlvidados(empleadoId);
          // Contar cuántos se cerraron (esto se hace dentro de la función)
        } catch (err) {
          console.error(`Error verificando fichajes olvidados para empleado ${empleadoId}:`, err);
          totalErrores++;
        }
      }

      return {
        success: true,
        message: `Verificación completada para ${empleadosUnicos.length} empleado(s)`,
        empleadosVerificados: empleadosUnicos.length
      };
    } catch (error) {
      console.error('Error verificando fichajes olvidados de todos los empleados:', error);
      return {
        success: false,
        error: error.message || 'Error al verificar fichajes olvidados'
      };
    }
  }

  /**
   * Verificar y cerrar fichajes olvidados (del mismo día que llevan demasiado tiempo abiertos)
   * @param {string} empleadoId - ID del empleado
   * @private
   */
  async verificarYcerrarFichajesOlvidados(empleadoId) {
    try {
      const ahora = new Date();
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      
      // Obtener fichajes pendientes
      const { data: fichajesPendientes } = await fichajeSupabaseService.obtenerFichajesPendientes(empleadoId);
      
      if (!fichajesPendientes || fichajesPendientes.length === 0) {
        return;
      }
      
      // Verificar cada fichaje pendiente
      for (const fichaje of fichajesPendientes) {
        // Verificar si hay pausas activas - si las hay, no cerrar el fichaje
        const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
        if (pausaActiva) {
          console.log(`⏸️ Fichaje del ${fichaje.fecha} tiene una pausa activa. No se cerrará automáticamente.`);
          continue; // Saltar este fichaje si tiene pausa activa
        }
        
        const fechaFichaje = new Date(fichaje.fecha);
        fechaFichaje.setHours(0, 0, 0, 0);
        const esHoy = fechaFichaje.getTime() === hoy.getTime();
        
        // Si es de hoy, verificar si lleva más de 14 horas abierto
        if (esHoy && fichaje.hora_entrada) {
          const horaEntrada = new Date(fichaje.hora_entrada);
          const horasAbierto = (ahora - horaEntrada) / (1000 * 60 * 60); // Horas en decimal
          
          // Si lleva más de 14 horas abierto, cerrarlo automáticamente
          if (horasAbierto >= 14) {
            console.log(`⚠️ Fichaje del día actual lleva ${horasAbierto.toFixed(2)} horas abierto. Cerrando automáticamente...`);
            
            const resultadoCierre = await fichajeSupabaseService.cerrarFichajeAutomaticamente(
              fichaje.id,
              `Cerrado automáticamente: el fichaje llevaba ${horasAbierto.toFixed(2)} horas abierto sin registrar salida. El empleado olvidó fichar la salida.`
            );
            
            if (resultadoCierre.success) {
              console.log(`✅ Fichaje del ${fichaje.fecha} cerrado automáticamente (llevaba ${horasAbierto.toFixed(2)} horas abierto)`);
            } else {
              console.warn(`⚠️ No se pudo cerrar el fichaje del ${fichaje.fecha}:`, resultadoCierre.error);
            }
          }
        }
        // Si es de días anteriores, cerrarlo automáticamente
        else if (fechaFichaje < hoy) {
          console.log(`🔒 Cerrando automáticamente fichaje del ${fichaje.fecha} (día anterior)`);
          const resultadoCierre = await fichajeSupabaseService.cerrarFichajeAutomaticamente(
            fichaje.id,
            'Cerrado automáticamente por el servidor: fichaje de día anterior sin salida registrada.'
          );
          
          if (resultadoCierre.success) {
            console.log(`✅ Fichaje del ${fichaje.fecha} cerrado automáticamente`);
          } else {
            console.warn(`⚠️ No se pudo cerrar el fichaje del ${fichaje.fecha}:`, resultadoCierre.error);
          }
        }
      }
    } catch (error) {
      console.error('Error verificando fichajes olvidados:', error);
      // No fallar, solo loguear el error
    }
  }

  /**
   * Obtener estado actual del fichaje del día
   * @param {string} empleadoId - ID del empleado
   * @returns {Promise<Object>} Estado del fichaje
   */
  async obtenerEstadoFichaje(empleadoId) {
    try {
      const hoy = new Date();
      const hoyLimpio = new Date(hoy);
      hoyLimpio.setHours(0, 0, 0, 0);
      
      // PRIMERO: Verificar y cerrar fichajes olvidados (del mismo día o anteriores)
      await this.verificarYcerrarFichajesOlvidados(empleadoId);
      
      // Obtener fichaje del día
      const { data: fichaje } = await fichajeSupabaseService.obtenerFichajeDia(empleadoId, hoy);
      
      if (!fichaje) {
        return {
          success: true,
          data: {
            tieneFichaje: false,
            puedeFicharEntrada: true,
            puedeFicharSalida: false,
            puedeIniciarPausa: false,
            puedeFinalizarPausa: false,
            pausaActiva: null
          }
        };
      }

      // Obtener pausas
      const { data: pausas } = await fichajeSupabaseService.obtenerPausas(fichaje.id);
      const { data: pausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);

      // El trabajador debe iniciar y finalizar las pausas manualmente
      // No hay descansos automáticos - cumplimiento normativa: registro manual por el trabajador

      return {
        success: true,
        data: {
          tieneFichaje: true,
          fichaje: fichaje,
          puedeFicharEntrada: false,
          puedeFicharSalida: !fichaje.hora_salida && !pausaActiva,
          puedeIniciarPausa: !fichaje.hora_salida && !pausaActiva,
          puedeFinalizarPausa: !!pausaActiva,
          pausaActiva: pausaActiva,
          pausas: pausas || []
        }
      };
    } catch (error) {
      console.error('Error en obtenerEstadoFichaje:', error);
      return {
        success: false,
        error: error.message || 'Error al obtener el estado del fichaje'
      };
    }
  }

  // =====================================================
  // AÑADIR FICHAJE A POSTERIORI
  // =====================================================

  /**
   * Añadir fichaje a posteriori (cuando el trabajador se olvidó)
   * @param {string} empleadoId - ID del empleado
   * @param {Date} fecha - Fecha del fichaje
   * @param {Date} horaEntrada - Hora de entrada
   * @param {Date} horaSalida - Hora de salida (opcional)
   * @param {string} userId - ID del usuario
   * @returns {Promise<Object>} Resultado
   */
  async añadirFichajePosteriori(empleadoId, fecha, horaEntrada, horaSalida = null, userId) {
    try {
      // Verificar si ya existe un fichaje para esa fecha
      const { data: fichajeExistente } = await fichajeSupabaseService.obtenerFichajeDia(empleadoId, fecha);
      
      if (fichajeExistente) {
        return {
          success: false,
          error: 'Ya existe un fichaje para esta fecha'
        };
      }

      // Validar que la fecha no sea futura
      const hoy = new Date();
      hoy.setHours(23, 59, 59, 999);
      
      if (fecha > hoy) {
        return {
          success: false,
          error: 'No puedes añadir fichajes para fechas futuras'
        };
      }

      // Validar que la hora de entrada sea anterior a la de salida
      if (horaSalida && horaEntrada >= horaSalida) {
        return {
          success: false,
          error: 'La hora de entrada debe ser anterior a la hora de salida'
        };
      }

      // Añadir fichaje
      const resultado = await fichajeSupabaseService.añadirFichajePosteriori(
        empleadoId,
        fecha,
        horaEntrada,
        horaSalida,
        userId
      );

      return resultado;
    } catch (error) {
      console.error('Error en añadirFichajePosteriori:', error);
      return {
        success: false,
        error: error.message || 'Error al añadir el fichaje'
      };
    }
  }

  // =====================================================
  // MODIFICAR FICHAJE (ADMIN/JEFE)
  // =====================================================

  /**
   * Modificar fichaje (solo admin/jefe)
   * @param {string} fichajeId - ID del fichaje
   * @param {Object} cambios - Cambios a realizar
   * @param {string} userId - ID del usuario que modifica
   * @param {string} motivo - Motivo de la modificación
   * @returns {Promise<Object>} Resultado
   */
  async modificarFichaje(fichajeId, cambios, userId, motivo = null) {
    try {
      // Verificar permisos (esto se puede hacer en el componente)
      // Por ahora, confiamos en que el componente verifica los permisos

      // Modificar fichaje
      const resultado = await fichajeSupabaseService.modificarFichaje(
        fichajeId,
        cambios,
        userId,
        motivo
      );

      if (!resultado.success) {
        return resultado;
      }

      // Notificar al trabajador
      await this.marcarParaNotificacion(fichajeId, resultado.data.empleado_id, userId, motivo);

      return {
        success: true,
        message: 'Fichaje modificado correctamente. El trabajador será notificado.',
        data: resultado.data
      };
    } catch (error) {
      console.error('Error en modificarFichaje:', error);
      return {
        success: false,
        error: error.message || 'Error al modificar el fichaje'
      };
    }
  }

  /**
   * Marcar fichaje para notificación al trabajador y crear notificación
   * @param {string} fichajeId - ID del fichaje
   * @param {string} empleadoId - ID del empleado (Holded)
   * @param {string} modificadoPor - ID del usuario que modificó
   * @param {string} motivo - Motivo de la modificación
   * @private
   */
  async marcarParaNotificacion(fichajeId, empleadoId, modificadoPor, motivo = null) {
    try {
      // Obtener información del empleado desde Holded
      let empleadoEmail = null;
      try {
        // Intentar obtener de ambas empresas
        const [empleadoSolucions, empleadoMenjar] = await Promise.all([
          holdedEmployeesService.getEmployee(empleadoId, 'solucions').catch(() => null),
          holdedEmployeesService.getEmployee(empleadoId, 'menjar').catch(() => null)
        ]);
        
        const empleado = empleadoSolucions || empleadoMenjar;
        if (empleado && empleado.email) {
          empleadoEmail = empleado.email.toLowerCase();
        }
      } catch (err) {
        console.error('Error obteniendo empleado de Holded:', err);
      }

      if (!empleadoEmail) {
        console.warn('No se pudo obtener el email del empleado, no se creará notificación');
        return;
      }

      // Buscar el usuario en user_profiles por email
      const { data: usuario, error: usuarioError } = await supabase
        .from('user_profiles')
        .select('id, name, email')
        .eq('email', empleadoEmail)
        .single();

      if (usuarioError || !usuario) {
        console.warn('Usuario no encontrado para el empleado, no se creará notificación');
        return;
      }

      // Obtener información del usuario que modificó
      const { data: modificador } = await supabase
        .from('user_profiles')
        .select('name, email')
        .eq('id', modificadoPor)
        .single();

      // Obtener información del fichaje
      const { data: fichaje } = await supabase
        .from('fichajes')
        .select('*')
        .eq('id', fichajeId)
        .single();

      if (!fichaje) {
        console.error('Fichaje no encontrado');
        return;
      }

      // Crear notificación
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          recipient_id: usuario.id,
          sender_id: modificadoPor,
          title: 'Fichaje Modificado',
          message: `Tu fichaje del ${new Date(fichaje.fecha).toLocaleDateString('es-ES')} ha sido modificado por ${modificador?.name || modificador?.email || 'un administrador'}.${motivo ? ` Motivo: ${motivo}` : ''}`,
          type: 'system',
          data: {
            fichaje_id: fichajeId,
            empleado_id: empleadoId,
            fecha: fichaje.fecha,
            motivo: motivo,
            modificado_por: modificador?.name || modificador?.email,
            navigation_target: 'fichaje',
            action_type: 'fichaje_modificado',
            requiere_validacion: true
          },
          read_at: null,
          created_at: new Date().toISOString()
        });

      if (notificationError) {
        console.error('Error creando notificación:', notificationError);
      } else {
        // Marcar como notificado
        await supabase
          .from('fichajes')
          .update({ notificado_trabajador: true })
          .eq('id', fichajeId);
      }
    } catch (error) {
      console.error('Error marcando para notificación:', error);
    }
  }

  /**
   * Trabajador valida/acepta un cambio realizado por la empresa
   * @param {string} fichajeId - ID del fichaje
   * @param {string} userId - ID del usuario
   * @param {boolean} acepta - Si acepta o rechaza el cambio
   * @returns {Promise<Object>} Resultado
   */
  async validarCambioTrabajador(fichajeId, userId, acepta) {
    try {
      const resultado = await fichajeSupabaseService.validarCambio(fichajeId, acepta);
      
      if (!resultado.success) {
        return resultado;
      }

      return {
        success: true,
        message: acepta 
          ? 'Cambio aceptado correctamente' 
          : 'Cambio rechazado. Se notificará al administrador.',
        data: resultado.data
      };
    } catch (error) {
      console.error('Error en validarCambioTrabajador:', error);
      return {
        success: false,
        error: error.message || 'Error al validar el cambio'
      };
    }
  }

  // =====================================================
  // UTILIDADES
  // =====================================================

  /**
   * Recalcular horas trabajadas de un fichaje
   * @param {string} fichajeId - ID del fichaje
   * @private
   */
  async recalcularHoras(fichajeId) {
    try {
      // Obtener fichaje
      const { data: fichaje } = await supabase
        .from('fichajes')
        .select('*')
        .eq('id', fichajeId)
        .single();

      if (!fichaje || !fichaje.hora_salida) {
        return; // No se puede calcular sin salida
      }

      // Obtener pausas
      const { data: pausas } = await fichajeSupabaseService.obtenerPausas(fichajeId);
      
      // Calcular minutos de pausas
      const minutosPausas = pausas
        .filter(p => p.fin)
        .reduce((total, p) => total + (p.duracion_minutos || 0), 0);

      // Calcular horas totales
      const entrada = new Date(fichaje.hora_entrada);
      const salida = new Date(fichaje.hora_salida);
      const horasTotales = (salida - entrada) / (1000 * 60 * 60);
      
      // Calcular horas trabajadas (restando pausas)
      const horasTrabajadas = horasTotales - (minutosPausas / 60);

      // Actualizar
      await supabase
        .from('fichajes')
        .update({
          horas_trabajadas: Math.round(horasTrabajadas * 100) / 100,
          horas_totales: Math.round(horasTotales * 100) / 100
        })
        .eq('id', fichajeId);
    } catch (error) {
      console.error('Error recalculando horas:', error);
    }
  }

  /**
   * Formatear horas para mostrar
   * @param {number} horas - Horas en decimal
   * @returns {string} Horas formateadas (ej: "8h 30m")
   */
  formatearHoras(horas) {
    if (!horas && horas !== 0) return '0h';
    
    const horasEnteras = Math.floor(horas);
    const minutos = Math.round((horas - horasEnteras) * 60);
    
    if (minutos === 0) {
      return `${horasEnteras}h`;
    }
    return `${horasEnteras}h ${minutos}m`;
  }

  /**
   * Formatear duración de pausa
   * @param {number} minutos - Minutos
   * @returns {string} Duración formateada
   */
  formatearDuracionPausa(minutos) {
    if (!minutos && minutos !== 0) return '0m';
    
    if (minutos < 60) {
      return `${minutos}m`;
    }
    
    const horas = Math.floor(minutos / 60);
    const mins = minutos % 60;
    
    if (mins === 0) {
      return `${horas}h`;
    }
    return `${horas}h ${mins}m`;
  }
}

// Exportar instancia única
const fichajeService = new FichajeService();
export default fichajeService;



