import fichajeSupabaseService from './fichajeSupabaseService';
import fichajeDescansosService from './fichajeDescansosService';
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
      const { data: fichajesPendientes } = await fichajeSupabaseService.obtenerFichajesPendientes(empleadoId);
      
      if (fichajesPendientes && fichajesPendientes.length > 0) {
        console.log(`⚠️ Se encontraron ${fichajesPendientes.length} fichaje(s) pendiente(s). Cerrando automáticamente...`);
        
        for (const fichajePendiente of fichajesPendientes) {
          // Solo cerrar fichajes de días anteriores (no el de hoy)
          const fechaFichaje = new Date(fichajePendiente.fecha);
          fechaFichaje.setHours(0, 0, 0, 0);
          const hoyLimpio = new Date(hoy);
          hoyLimpio.setHours(0, 0, 0, 0);
          
          if (fechaFichaje < hoyLimpio) {
            console.log(`🔒 Cerrando automáticamente fichaje del ${fichajePendiente.fecha}`);
            const resultadoCierre = await fichajeSupabaseService.cerrarFichajeAutomaticamente(fichajePendiente.id);
            
            if (resultadoCierre.success) {
              console.log(`✅ Fichaje del ${fichajePendiente.fecha} cerrado automáticamente`);
            } else {
              console.warn(`⚠️ No se pudo cerrar el fichaje del ${fichajePendiente.fecha}:`, resultadoCierre.error);
            }
          }
        }
      }

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
   * Obtener estado actual del fichaje del día
   * @param {string} empleadoId - ID del empleado
   * @returns {Promise<Object>} Estado del fichaje
   */
  async obtenerEstadoFichaje(empleadoId) {
    try {
      const hoy = new Date();
      const hoyLimpio = new Date(hoy);
      hoyLimpio.setHours(0, 0, 0, 0);
      
      // Verificar si hay fichajes pendientes de días anteriores y cerrarlos automáticamente
      const { data: fichajesPendientes } = await fichajeSupabaseService.obtenerFichajesPendientes(empleadoId);
      
      if (fichajesPendientes && fichajesPendientes.length > 0) {
        // Filtrar solo fichajes de días anteriores (no el de hoy)
        const fichajesAnterioresPendientes = fichajesPendientes.filter(fp => {
          const fechaFichaje = new Date(fp.fecha);
          fechaFichaje.setHours(0, 0, 0, 0);
          return fechaFichaje < hoyLimpio;
        });
        
        // Cerrar automáticamente fichajes anteriores pendientes
        if (fichajesAnterioresPendientes.length > 0) {
          console.log(`⚠️ Se encontraron ${fichajesAnterioresPendientes.length} fichaje(s) pendiente(s) de días anteriores. Cerrando automáticamente...`);
          
          for (const fichajePendiente of fichajesAnterioresPendientes) {
            console.log(`🔒 Cerrando automáticamente fichaje del ${fichajePendiente.fecha}`);
            const resultadoCierre = await fichajeSupabaseService.cerrarFichajeAutomaticamente(fichajePendiente.id);
            
            if (resultadoCierre.success) {
              console.log(`✅ Fichaje del ${fichajePendiente.fecha} cerrado automáticamente`);
            } else {
              console.warn(`⚠️ No se pudo cerrar el fichaje del ${fichajePendiente.fecha}:`, resultadoCierre.error);
            }
          }
        }
      }
      
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

      // Verificar y gestionar descansos automáticos (solo si no tiene pausa activa y no ha fichado salida)
      let descansoAutomatico = null;
      if (!fichaje.hora_salida && fichaje.hora_entrada) {
        // Calcular horas trabajadas hasta ahora
        const ahora = new Date();
        const horaEntrada = new Date(fichaje.hora_entrada);
        const horasTrabajadas = (ahora - horaEntrada) / (1000 * 60 * 60); // Convertir a horas
        
        // Verificar regla de descanso
        const verificacionDescanso = await fichajeDescansosService.verificarDescansoObligatorio(
          empleadoId,
          horasTrabajadas
        );
        
        if (verificacionDescanso.success && verificacionDescanso.debeDescanso) {
          // Verificar si ya hizo este descanso hoy (buscar pausas del mismo tipo ya finalizadas)
          const pausasDescansoHoy = (pausas || []).filter(p => 
            p.tipo === verificacionDescanso.tipo && 
            p.fin !== null &&
            p.duracion_minutos >= verificacionDescanso.duracionMinutos * 0.8 // Al menos 80% de la duración requerida
          );
          
          if (pausasDescansoHoy.length === 0) {
            // Verificar si hay una pausa activa del mismo tipo (puede estar en curso)
            const pausaActivaMismoTipo = pausaActiva && pausaActiva.tipo === verificacionDescanso.tipo;
            
            if (!pausaActivaMismoTipo) {
              // Calcular tiempo desde la entrada para descansos obligatorios
              const minutosDesdeEntrada = (ahora - horaEntrada) / (1000 * 60);
              
              // Para descansos obligatorios (sin horas_minimas), iniciar después de 30 minutos desde entrada
              // Para descansos condicionales (con horas_minimas), iniciar inmediatamente si cumple condición
              const debeIniciarAhora = verificacionDescanso.horasMinimas === null || 
                                       verificacionDescanso.horasMinimas === undefined ||
                                       (verificacionDescanso.horasMinimas && horasTrabajadas >= verificacionDescanso.horasMinimas);
              
              // NOTA: Para pruebas, cambiado a 1 minuto. En producción debe ser 30 minutos
              const tiempoMinimoEspera = 1; // 1 minuto para pruebas (en producción: 30 minutos)
              
              if (debeIniciarAhora && (verificacionDescanso.horasMinimas || minutosDesdeEntrada >= tiempoMinimoEspera)) {
                // Debe hacer el descanso automático - iniciarlo ahora
                descansoAutomatico = {
                  debeHacer: true,
                  tipo: verificacionDescanso.tipo,
                  duracionMinutos: verificacionDescanso.duracionMinutos,
                  horasTrabajadas: horasTrabajadas,
                  motivo: verificacionDescanso.motivo
                };
                
                console.log(`🔄 Iniciando descanso automático para empleado ${empleadoId}: ${verificacionDescanso.tipo} de ${verificacionDescanso.duracionMinutos} minutos`);
                const resultadoDescanso = await fichajeSupabaseService.iniciarPausa(
                  fichaje.id,
                  verificacionDescanso.tipo,
                  `Descanso automático obligatorio (${verificacionDescanso.motivo})`
                );
                
                if (resultadoDescanso.success) {
                  console.log(`✅ Descanso automático iniciado correctamente`);
                  // Actualizar pausaActiva para reflejar el cambio
                  const { data: nuevaPausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
                  if (nuevaPausaActiva) {
                    // Programar verificación de finalización (se verificará en la próxima carga de estado)
                    // La finalización se gestionará automáticamente al verificar el estado
                  }
                } else {
                  console.warn('⚠️ No se pudo iniciar el descanso automático:', resultadoDescanso.error);
                }
              } else if (!verificacionDescanso.horasMinimas && minutosDesdeEntrada < tiempoMinimoEspera) {
                // Descanso obligatorio pero aún no han pasado 30 minutos
                descansoAutomatico = {
                  debeHacer: true,
                  tipo: verificacionDescanso.tipo,
                  duracionMinutos: verificacionDescanso.duracionMinutos,
                  horasTrabajadas: horasTrabajadas,
                  motivo: `Se iniciará automáticamente en ${Math.ceil(tiempoMinimoEspera - minutosDesdeEntrada)} minutos`,
                  pendiente: true
                };
              }
            }
          }
        }
        
        // Verificar si hay pausas activas que deben finalizarse automáticamente
        if (pausaActiva && pausaActiva.inicio) {
          const inicioPausa = new Date(pausaActiva.inicio);
          const minutosPausa = (ahora - inicioPausa) / (1000 * 60);
          
          // Obtener la duración esperada de la pausa desde la regla
          const reglaDescanso = await fichajeDescansosService.obtenerReglaDescanso(empleadoId);
          if (reglaDescanso.success && reglaDescanso.data && reglaDescanso.data.duracion_minutos) {
            const duracionEsperada = reglaDescanso.data.duracion_minutos;
            
            // Si la pausa ha durado más de la duración esperada, finalizarla automáticamente
            if (minutosPausa >= duracionEsperada) {
              console.log(`⏰ Finalizando descanso automático después de ${duracionEsperada} minutos (actual: ${minutosPausa.toFixed(1)} minutos)`);
              const resultadoFinalizar = await fichajeSupabaseService.finalizarPausa(pausaActiva.id);
              
              if (resultadoFinalizar.success) {
                console.log(`✅ Descanso automático finalizado correctamente`);
                // Recalcular horas trabajadas
                await this.recalcularHoras(fichaje.id);
                // Recargar pausas para reflejar el cambio
                const { data: pausasActualizadas } = await fichajeSupabaseService.obtenerPausas(fichaje.id);
                const { data: nuevaPausaActiva } = await fichajeSupabaseService.obtenerPausaActiva(fichaje.id);
                return {
                  success: true,
                  data: {
                    tieneFichaje: true,
                    fichaje: fichaje,
                    puedeFicharEntrada: false,
                    puedeFicharSalida: !fichaje.hora_salida && !nuevaPausaActiva,
                    puedeIniciarPausa: !fichaje.hora_salida && !nuevaPausaActiva,
                    puedeFinalizarPausa: !!nuevaPausaActiva,
                    pausaActiva: nuevaPausaActiva,
                    pausas: pausasActualizadas || []
                  }
                };
              }
            }
          }
        }
      }

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
          pausas: pausas || [],
          descansoAutomatico: descansoAutomatico
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



