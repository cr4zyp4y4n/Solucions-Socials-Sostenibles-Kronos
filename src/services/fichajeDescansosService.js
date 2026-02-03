import { supabase } from '../config/supabase';
import holdedEmployeesService from './holdedEmployeesService';

class FichajeDescansosService {
  /**
   * Obtener regla de descanso de un empleado
   * @param {string} empleadoId - ID del empleado
   * @returns {Promise<Object>} Regla de descanso o null
   */
  async obtenerReglaDescanso(empleadoId) {
    try {
      const { data, error } = await supabase
        .from('fichajes_reglas_descanso')
        .select('*')
        .eq('empleado_id', empleadoId)
        .eq('activo', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No se encontró ningún registro
          return {
            success: true,
            data: null // No tiene regla de descanso
          };
        }
        throw error;
      }

      return {
        success: true,
        data: data
      };
    } catch (error) {
      console.error('Error obteniendo regla de descanso:', error);
      return {
        success: false,
        error: error.message || 'Error al obtener la regla de descanso',
        data: null
      };
    }
  }

  /**
   * Verificar si un empleado debe hacer un descanso automático
   * @param {string} empleadoId - ID del empleado
   * @param {number} horasTrabajadas - Horas trabajadas hasta el momento
   * @returns {Promise<Object>} Información sobre si debe hacer descanso
   */
  async verificarDescansoObligatorio(empleadoId, horasTrabajadas) {
    try {
      const resultado = await this.obtenerReglaDescanso(empleadoId);
      
      if (!resultado.success || !resultado.data) {
        return {
          success: true,
          debeDescanso: false,
          motivo: 'No tiene regla de descanso configurada'
        };
      }

      const regla = resultado.data;
      
      // Si no tiene tipo de descanso o duración, no debe descansar
      if (!regla.tipo_descanso || !regla.duracion_minutos) {
        return {
          success: true,
          debeDescanso: false,
          motivo: 'No tiene descanso obligatorio configurado'
        };
      }

      // Si tiene horas_minimas, es descanso condicional (solo si trabaja más de X horas)
      // Si NO tiene horas_minimas (null), es descanso obligatorio (siempre)
      if (regla.horas_minimas !== null && regla.horas_minimas !== undefined) {
        // Descanso condicional: solo si ha trabajado las horas mínimas
        if (horasTrabajadas >= regla.horas_minimas) {
          return {
            success: true,
            debeDescanso: true,
            tipo: regla.tipo_descanso,
            duracionMinutos: regla.duracion_minutos,
            horasMinimas: regla.horas_minimas,
            horasTrabajadas: horasTrabajadas,
            motivo: `Ha trabajado ${horasTrabajadas.toFixed(2)} horas (mínimo: ${regla.horas_minimas} horas)`
          };
        } else {
          return {
            success: true,
            debeDescanso: false,
            motivo: `Aún no ha alcanzado las ${regla.horas_minimas} horas mínimas (actual: ${horasTrabajadas.toFixed(2)} horas)`
          };
        }
      } else {
        // Descanso obligatorio: siempre debe hacerlo (sin condición de horas)
        return {
          success: true,
          debeDescanso: true,
          tipo: regla.tipo_descanso,
          duracionMinutos: regla.duracion_minutos,
          horasMinimas: null,
          horasTrabajadas: horasTrabajadas,
          motivo: 'Descanso obligatorio (sin condición de horas mínimas)'
        };
      }
    } catch (error) {
      console.error('Error verificando descanso obligatorio:', error);
      return {
        success: false,
        error: error.message || 'Error al verificar descanso obligatorio',
        debeDescanso: false
      };
    }
  }

  /**
   * Crear o actualizar regla de descanso
   * @param {string} empleadoId - ID del empleado
   * @param {Object} reglaData - Datos de la regla
   * @param {string} userId - ID del usuario que crea/actualiza
   * @returns {Promise<Object>} Resultado de la operación
   */
  async crearOActualizarRegla(empleadoId, reglaData, userId = null) {
    try {
      if (!empleadoId) {
        return {
          success: false,
          error: 'El ID del empleado es requerido'
        };
      }

      // Verificar si ya existe una regla para este empleado
      const { data: reglaExistente, error: errorBusqueda } = await supabase
        .from('fichajes_reglas_descanso')
        .select('id')
        .eq('empleado_id', empleadoId)
        .maybeSingle(); // Usar maybeSingle() en lugar de single() para evitar error si no existe

      const reglaDataCompleta = {
        empleado_id: empleadoId,
        jornada_laboral: reglaData.jornada_laboral || null,
        tipo_descanso: reglaData.tipo_descanso || null,
        horas_minimas: reglaData.horas_minimas || null,
        duracion_minutos: reglaData.duracion_minutos || null,
        activo: reglaData.activo !== undefined ? reglaData.activo : true,
        centro: reglaData.centro || null,
        empresa: reglaData.empresa || null,
        convenio: reglaData.convenio || null,
        descripcion: reglaData.descripcion || null,
        updated_at: new Date().toISOString()
      };

      if (userId) {
        reglaDataCompleta.created_by = userId;
      }

      let result;
      if (reglaExistente) {
        // Actualizar regla existente
        const { data, error } = await supabase
          .from('fichajes_reglas_descanso')
          .update(reglaDataCompleta)
          .eq('id', reglaExistente.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Crear nueva regla
        const { data, error } = await supabase
          .from('fichajes_reglas_descanso')
          .insert(reglaDataCompleta)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return {
        success: true,
        message: reglaExistente ? 'Regla de descanso actualizada correctamente' : 'Regla de descanso creada correctamente',
        data: result
      };
    } catch (error) {
      console.error('Error creando/actualizando regla de descanso:', error);
      return {
        success: false,
        error: error.message || 'Error al crear/actualizar la regla de descanso'
      };
    }
  }

  /**
   * Importar reglas de descanso desde Excel (hoja 2)
   * @param {File} file - Archivo Excel
   * @param {string} userId - ID del usuario que importa
   * @returns {Promise<Object>} Resultado de la importación
   */
  async importarReglasDesdeExcel(file, userId = null) {
    try {
      const XLSX = require('xlsx');
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Verificar que hay hojas
            if (!workbook.SheetNames || workbook.SheetNames.length < 2) {
              return resolve({
                success: false,
                error: 'El archivo Excel debe tener al menos 2 hojas. La hoja 2 contiene las reglas de descanso.'
              });
            }
            
            // Usar la segunda hoja (índice 1 = hoja 2 en Excel)
            const sheetName = workbook.SheetNames[1];
            console.log(`📄 Procesando hoja 2: "${sheetName}" para reglas de descanso`);
            
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (!json || json.length === 0) {
              return resolve({
                success: false,
                error: 'La hoja 2 del Excel está vacía'
              });
            }

            // Buscar la fila de headers
            const headers = json[0] || [];
            
            // Buscar índices de columnas
            const centroIndex = headers.findIndex(h => 
              h && h.toString().toLowerCase().includes('centro')
            );
            const empresaIndex = headers.findIndex(h => 
              h && h.toString().toLowerCase().includes('empresa')
            );
            const convenioIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('convenio') || 
                   h.toString().toLowerCase().includes('contrato'))
            );
            const trabajadorIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('trabajador') || 
                   h.toString().toLowerCase().includes('nombre') ||
                   h.toString().toLowerCase().includes('empleado'))
            );
            const jornadaIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('jornada') || 
                   h.toString().toLowerCase().includes('laboral'))
            );
            const breakIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('break') || 
                   h.toString().toLowerCase().includes('descanso') ||
                   h.toString().toLowerCase().includes('pausa'))
            );

            if (trabajadorIndex === -1) {
              return resolve({
                success: false,
                error: 'No se encontró la columna "TRABAJADOR" (o "Nombre", "Empleado")'
              });
            }

            // Cargar todos los empleados de ambas empresas para buscar por nombre
            console.log('🔄 Cargando empleados de Holded para buscar por nombre...');
            const [empleadosSolucions, empleadosMenjar] = await Promise.all([
              holdedEmployeesService.getEmployeesTransformed('solucions').catch(() => []),
              holdedEmployeesService.getEmployeesTransformed('menjar').catch(() => [])
            ]);
            
            const todosEmpleados = [
              ...(empleadosSolucions || []),
              ...(empleadosMenjar || [])
            ];
            
            console.log(`✅ Cargados ${todosEmpleados.length} empleados de Holded`);

            // Función para buscar empleado por nombre
            const buscarEmpleadoPorNombre = (nombre) => {
              if (!nombre || !todosEmpleados.length) return null;
              
              const nombreLimpio = nombre.toString().toLowerCase().trim();
              const palabrasBusqueda = nombreLimpio.split(/\s+/);
              
              return todosEmpleados.find(emp => {
                const nombreCompletoLower = emp.nombreCompleto?.toLowerCase() || '';
                const nombreLower = emp.nombre?.toLowerCase() || '';
                const apellidosLower = emp.apellidos?.toLowerCase() || '';
                const nombreCompletoLowerSinEspacios = nombreCompletoLower.replace(/\s+/g, '');
                const nombreBusquedaSinEspacios = nombreLimpio.replace(/\s+/g, '');
                
                // Coincidencia exacta
                if (nombreCompletoLower === nombreLimpio || nombreLower === nombreLimpio) {
                  return true;
                }
                
                // Incluye el nombre completo
                if (nombreCompletoLower.includes(nombreLimpio) || nombreLimpio.includes(nombreCompletoLower)) {
                  return true;
                }
                
                // Coincidencia sin espacios
                if (nombreCompletoLowerSinEspacios.includes(nombreBusquedaSinEspacios)) {
                  return true;
                }
                
                // Coincidencia parcial por palabras
                if (palabrasBusqueda.length > 1) {
                  const todasLasPalabrasCoinciden = palabrasBusqueda.every(palabra => 
                    nombreCompletoLower.includes(palabra) || nombreLower.includes(palabra) || apellidosLower.includes(palabra)
                  );
                  if (todasLasPalabrasCoinciden) {
                    return true;
                  }
                }
                
                // Coincidencia con nombre o apellidos individuales
                if (nombreLower.includes(nombreLimpio) || apellidosLower.includes(nombreLimpio)) {
                  return true;
                }
                
                return false;
              });
            };

            // Función para parsear el tipo de descanso y duración desde BREAK
            const parsearBreak = (breakValue) => {
              if (!breakValue) {
                return { tipo: null, duracion: null, horasMinimas: null };
              }

              const breakStr = breakValue.toString().toLowerCase().trim();
              
              // Si dice "no aplica", "no", "sin" o está vacío, no tiene descanso
              if (breakStr === 'no aplica' || breakStr === 'no' || breakStr === '' || 
                  breakStr === 'sin' || breakStr === 'ninguno' || breakStr.includes('no aplica')) {
                return { tipo: null, duracion: null, horasMinimas: null };
              }

              // Caso especial: "si hace más de 5h se aplica el descanso de 20 minutos"
              // Solo estos 3 empleados tienen esta lógica condicional
              if (breakStr.includes('más de 5h') || breakStr.includes('mas de 5h') || 
                  breakStr.includes('más de 5 h') || breakStr.includes('mas de 5 h') ||
                  (breakStr.includes('5') && breakStr.includes('20'))) {
                return { 
                  tipo: 'descanso', 
                  duracion: 20, 
                  horasMinimas: 5.0 // Condicional: solo si trabaja más de 5 horas
                };
              }

              // Buscar patrones como "20m", "30m", "20 min", "30 minutos"
              const matchMinutos = breakStr.match(/(\d+)\s*(?:m|min|minutos?)/);
              if (matchMinutos) {
                const minutos = parseInt(matchMinutos[1]);
                // Si tiene minutos pero no es el caso especial de "más de 5h", es descanso obligatorio
                return { 
                  tipo: 'descanso', 
                  duracion: minutos, 
                  horasMinimas: null // Obligatorio, sin condición de horas mínimas
                };
              }

              // Buscar "comida" o "descanso" (obligatorio)
              if (breakStr.includes('comida')) {
                return { tipo: 'comida', duracion: 30, horasMinimas: null };
              }
              if (breakStr.includes('descanso')) {
                return { tipo: 'descanso', duracion: 20, horasMinimas: null };
              }

              // Por defecto, si hay algo pero no se reconoce, usar descanso obligatorio de 20 min
              return { tipo: 'descanso', duracion: 20, horasMinimas: null };
            };

            // Procesar filas
            const filas = json.slice(1);
            const resultados = {
              exitosos: 0,
              errores: 0,
              erroresDetalle: []
            };

            for (let i = 0; i < filas.length; i++) {
              const fila = filas[i];
              const nombreTrabajador = trabajadorIndex !== -1 ? fila[trabajadorIndex] : null;
              const centro = centroIndex !== -1 ? fila[centroIndex] : null;
              const empresa = empresaIndex !== -1 ? fila[empresaIndex] : null;
              const convenio = convenioIndex !== -1 ? fila[convenioIndex] : null;
              const jornada = jornadaIndex !== -1 ? fila[jornadaIndex] : null;
              const breakValue = breakIndex !== -1 ? fila[breakIndex] : null;

              if (!nombreTrabajador) {
                resultados.errores++;
                resultados.erroresDetalle.push({
                  fila: i + 2,
                  error: 'Nombre del trabajador vacío'
                });
                continue;
              }

              // Buscar empleado por nombre
              const empleadoEncontrado = buscarEmpleadoPorNombre(nombreTrabajador.toString());
              
              if (!empleadoEncontrado) {
                resultados.errores++;
                resultados.erroresDetalle.push({
                  fila: i + 2,
                  nombre: nombreTrabajador.toString(),
                  error: `Empleado "${nombreTrabajador}" no encontrado en Holded`
                });
                continue;
              }

              // Parsear información del descanso
              const descansoInfo = parsearBreak(breakValue);

              const reglaData = {
                jornada_laboral: jornada ? jornada.toString() : null,
                tipo_descanso: descansoInfo.tipo,
                horas_minimas: descansoInfo.horasMinimas,
                duracion_minutos: descansoInfo.duracion,
                centro: centro ? centro.toString() : null,
                empresa: empresa ? empresa.toString() : null,
                convenio: convenio ? convenio.toString() : null,
                activo: true
              };

              const resultado = await this.crearOActualizarRegla(
                empleadoEncontrado.id,
                reglaData,
                userId
              );

              if (resultado.success) {
                resultados.exitosos++;
              } else {
                resultados.errores++;
                resultados.erroresDetalle.push({
                  fila: i + 2,
                  nombre: nombreTrabajador.toString(),
                  error: resultado.error
                });
              }
            }

            resolve({
              success: true,
              message: `Importación completada: ${resultados.exitosos} exitosos, ${resultados.errores} errores`,
              data: resultados
            });
          } catch (error) {
            reject(error);
          }
        };
        reader.onerror = () => reject(new Error('Error al leer el archivo'));
        reader.readAsArrayBuffer(file);
      });
    } catch (error) {
      console.error('Error importando reglas de descanso desde Excel:', error);
      return {
        success: false,
        error: error.message || 'Error al importar las reglas de descanso'
      };
    }
  }

  /**
   * Obtener todas las reglas activas
   * @returns {Promise<Array>} Lista de reglas
   */
  async obtenerTodasLasReglas() {
    try {
      const { data, error } = await supabase
        .from('fichajes_reglas_descanso')
        .select('*')
        .eq('activo', true)
        .order('empleado_id', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error obteniendo reglas de descanso:', error);
      return {
        success: false,
        error: error.message || 'Error al obtener las reglas de descanso',
        data: []
      };
    }
  }
}

export default new FichajeDescansosService();

