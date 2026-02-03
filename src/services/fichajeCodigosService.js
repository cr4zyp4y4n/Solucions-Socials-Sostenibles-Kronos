import { supabase } from '../config/supabase';
import holdedEmployeesService from './holdedEmployeesService';

class FichajeCodigosService {
  /**
   * Buscar empleado por código de fichaje
   * @param {string} codigo - Código único de fichaje
   * @returns {Promise<Object>} Empleado encontrado o null
   */
  async buscarEmpleadoPorCodigo(codigo) {
    try {
      if (!codigo || !codigo.trim()) {
        return {
          success: false,
          error: 'El código no puede estar vacío'
        };
      }

      const codigoLimpio = codigo.trim().toUpperCase();

      const { data, error } = await supabase
        .from('fichajes_codigos')
        .select('*, empleado_id')
        .eq('codigo', codigoLimpio)
        .eq('activo', true)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No se encontró ningún registro
          return {
            success: false,
            error: 'Código no encontrado o no válido'
          };
        }
        throw error;
      }

      if (!data) {
        return {
          success: false,
          error: 'Código no encontrado'
        };
      }

      return {
        success: true,
        data: {
          codigo: data.codigo,
          empleadoId: data.empleado_id,
          descripcion: data.descripcion
        }
      };
    } catch (error) {
      console.error('Error buscando empleado por código:', error);
      return {
        success: false,
        error: error.message || 'Error al buscar el código'
      };
    }
  }

  /**
   * Obtener todos los códigos activos
   * @returns {Promise<Array>} Lista de códigos
   */
  async obtenerTodosLosCodigos() {
    try {
      const { data, error } = await supabase
        .from('fichajes_codigos')
        .select('*')
        .eq('activo', true)
        .order('codigo', { ascending: true });

      if (error) throw error;

      return {
        success: true,
        data: data || []
      };
    } catch (error) {
      console.error('Error obteniendo códigos:', error);
      return {
        success: false,
        error: error.message || 'Error al obtener los códigos',
        data: []
      };
    }
  }

  /**
   * Crear o actualizar un código de fichaje
   * @param {string} codigo - Código único
   * @param {string} empleadoId - ID del empleado en Holded
   * @param {string} descripcion - Descripción opcional
   * @param {string} userId - ID del usuario que crea el código
   * @returns {Promise<Object>} Resultado de la operación
   */
  async crearOActualizarCodigo(codigo, empleadoId, descripcion = null, userId = null) {
    try {
      if (!codigo || !codigo.trim()) {
        return {
          success: false,
          error: 'El código no puede estar vacío'
        };
      }

      if (!empleadoId) {
        return {
          success: false,
          error: 'El ID del empleado es requerido'
        };
      }

      const codigoLimpio = codigo.trim().toUpperCase();

      // Verificar si el código ya existe
      const { data: codigoExistente } = await supabase
        .from('fichajes_codigos')
        .select('id, empleado_id')
        .eq('codigo', codigoLimpio)
        .single();

      const codigoData = {
        codigo: codigoLimpio,
        empleado_id: empleadoId,
        activo: true,
        descripcion: descripcion || null,
        updated_at: new Date().toISOString()
      };

      if (userId) {
        codigoData.created_by = userId;
      }

      let result;
      if (codigoExistente) {
        // Actualizar código existente
        const { data, error } = await supabase
          .from('fichajes_codigos')
          .update(codigoData)
          .eq('id', codigoExistente.id)
          .select()
          .single();

        if (error) throw error;
        result = data;
      } else {
        // Crear nuevo código
        const { data, error } = await supabase
          .from('fichajes_codigos')
          .insert(codigoData)
          .select()
          .single();

        if (error) throw error;
        result = data;
      }

      return {
        success: true,
        message: codigoExistente ? 'Código actualizado correctamente' : 'Código creado correctamente',
        data: result
      };
    } catch (error) {
      console.error('Error creando/actualizando código:', error);
      
      // Manejar error de código duplicado
      if (error.code === '23505') {
        return {
          success: false,
          error: 'Este código ya está en uso por otro empleado'
        };
      }

      return {
        success: false,
        error: error.message || 'Error al crear/actualizar el código'
      };
    }
  }

  /**
   * Desactivar un código
   * @param {string} codigoId - ID del código
   * @returns {Promise<Object>} Resultado de la operación
   */
  async desactivarCodigo(codigoId) {
    try {
      const { data, error } = await supabase
        .from('fichajes_codigos')
        .update({ activo: false, updated_at: new Date().toISOString() })
        .eq('id', codigoId)
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        message: 'Código desactivado correctamente',
        data
      };
    } catch (error) {
      console.error('Error desactivando código:', error);
      return {
        success: false,
        error: error.message || 'Error al desactivar el código'
      };
    }
  }

  /**
   * Importar códigos desde Excel
   * @param {File} file - Archivo Excel
   * @param {string} userId - ID del usuario que importa
   * @returns {Promise<Object>} Resultado de la importación
   */
  async importarCodigosDesdeExcel(file, userId = null) {
    try {
      const XLSX = require('xlsx');
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = async (e) => {
          try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            
            // Verificar que hay hojas
            if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
              return resolve({
                success: false,
                error: 'El archivo Excel no contiene hojas'
              });
            }
            
            // Usar la primera hoja (índice 0 = hoja 1 en Excel)
            const sheetName = workbook.SheetNames[0];
            console.log(`📄 Procesando hoja: "${sheetName}" (primera hoja del Excel)`);
            
            // Si hay más de una hoja, informar pero continuar con la primera
            if (workbook.SheetNames.length > 1) {
              console.log(`ℹ️ El archivo tiene ${workbook.SheetNames.length} hojas. Se procesará la primera: "${sheetName}"`);
            }
            
            const worksheet = workbook.Sheets[sheetName];
            const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (!json || json.length === 0) {
              return resolve({
                success: false,
                error: 'El archivo Excel está vacío'
              });
            }

            // Buscar la fila de headers (asumimos que la primera fila tiene los headers)
            const headers = json[0] || [];
            
            // Buscar índices de columnas - Buscar "CLAVE" o "Código" para el código
            const codigoIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('clave') ||
                   h.toString().toLowerCase().includes('código') || 
                   h.toString().toLowerCase().includes('codigo') ||
                   h.toString().toLowerCase().includes('code'))
            );
            // Buscar "NOMBRE" o "Nombre" para el nombre del empleado
            const nombreIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('nombre') || 
                   h.toString().toLowerCase().includes('name') ||
                   h.toString().toLowerCase().includes('empleado') ||
                   h.toString().toLowerCase().includes('employee'))
            );
            const descripcionIndex = headers.findIndex(h => 
              h && (h.toString().toLowerCase().includes('descripción') || 
                   h.toString().toLowerCase().includes('descripcion') ||
                   h.toString().toLowerCase().includes('description'))
            );

            if (codigoIndex === -1 || nombreIndex === -1) {
              return resolve({
                success: false,
                error: 'No se encontraron las columnas requeridas. Se necesitan "CLAVE" (o "Código") y "NOMBRE" (o "Nombre")'
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

            // Procesar filas
            const filas = json.slice(1);
            const resultados = {
              exitosos: 0,
              errores: 0,
              erroresDetalle: []
            };

            for (let i = 0; i < filas.length; i++) {
              const fila = filas[i];
              const codigo = fila[codigoIndex];
              const nombreEmpleado = fila[nombreIndex];
              const descripcion = descripcionIndex !== -1 ? fila[descripcionIndex] : null;

              if (!codigo || !nombreEmpleado) {
                resultados.errores++;
                resultados.erroresDetalle.push({
                  fila: i + 2,
                  error: 'Código o Nombre del empleado vacío'
                });
                continue;
              }

              // Buscar empleado por nombre
              const empleadoEncontrado = buscarEmpleadoPorNombre(nombreEmpleado.toString());
              
              if (!empleadoEncontrado) {
                resultados.errores++;
                resultados.erroresDetalle.push({
                  fila: i + 2,
                  codigo: codigo.toString(),
                  nombre: nombreEmpleado.toString(),
                  error: `Empleado "${nombreEmpleado}" no encontrado en Holded`
                });
                continue;
              }

              const resultado = await this.crearOActualizarCodigo(
                codigo.toString(),
                empleadoEncontrado.id,
                descripcion ? descripcion.toString() : null,
                userId
              );

              if (resultado.success) {
                resultados.exitosos++;
              } else {
                resultados.errores++;
                resultados.erroresDetalle.push({
                  fila: i + 2,
                  codigo: codigo.toString(),
                  nombre: nombreEmpleado.toString(),
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
      console.error('Error importando códigos desde Excel:', error);
      return {
        success: false,
        error: error.message || 'Error al importar los códigos'
      };
    }
  }
}

export default new FichajeCodigosService();

