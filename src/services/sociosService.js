import { supabase } from '../config/supabase';

class SociosService {
  constructor() {
    this.tableName = 'socios_idoni';
  }

  // Obtener todos los socios
  async getSocios() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .order('socio_desde', { ascending: false });

      if (error) {
        console.error('Error obteniendo socios:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error en getSocios:', error);
      throw new Error('Error al obtener los socios');
    }
  }

  // Crear nuevo socio
  async crearSocio(socioData) {
    try {
      // Generar ID único de 5 dígitos
      const idUnico = await this.generarIdUnico();

      const socio = {
        id_unico: idUnico,
        nombre: socioData.nombre.trim(),
        apellido: socioData.apellido.trim(),
        correo: socioData.correo.trim().toLowerCase(),
        socio_desde: new Date().toISOString().split('T')[0] // Fecha actual en formato YYYY-MM-DD
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .insert([socio])
        .select()
        .single();

      if (error) {
        console.error('❌ Error creando socio:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('💥 Error en crearSocio:', error);
      throw new Error('Error al crear el socio: ' + error.message);
    }
  }

  // Actualizar socio existente
  async actualizarSocio(id, socioData) {
    try {
      const socio = {
        nombre: socioData.nombre.trim(),
        apellido: socioData.apellido.trim(),
        correo: socioData.correo.trim().toLowerCase()
      };

      const { data, error } = await supabase
        .from(this.tableName)
        .update(socio)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando socio:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error en actualizarSocio:', error);
      throw new Error('Error al actualizar el socio');
    }
  }

  // Eliminar socio
  async eliminarSocio(id) {
    try {
      const { error } = await supabase
        .from(this.tableName)
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando socio:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error en eliminarSocio:', error);
      throw new Error('Error al eliminar el socio');
    }
  }

  // Buscar socios por término
  async buscarSocios(termino) {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*')
        .or(`nombre.ilike.%${termino}%,apellido.ilike.%${termino}%,correo.ilike.%${termino}%,id_unico.ilike.%${termino}%`)
        .order('socio_desde', { ascending: false });

      if (error) {
        console.error('Error buscando socios:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error en buscarSocios:', error);
      throw new Error('Error al buscar socios');
    }
  }

  // Generar ID único de 5 dígitos
  async generarIdUnico() {
    try {
      // Obtener el último ID usado
      const { data, error } = await supabase
        .from(this.tableName)
        .select('id_unico')
        .order('id_unico', { ascending: false })
        .limit(1);

      if (error) {
        console.error('Error obteniendo último ID:', error);
        // Si hay error, empezar desde 10000
        return 10000;
      }

      if (data && data.length > 0) {
        const ultimoId = parseInt(data[0].id_unico);
        return ultimoId + 1;
      }

      // Si no hay datos, empezar desde 10000
      return 10000;
    } catch (error) {
      console.error('Error en generarIdUnico:', error);
      // En caso de error, generar un ID aleatorio entre 10000-99999
      return Math.floor(Math.random() * 90000) + 10000;
    }
  }

  // Importar múltiples socios desde CSV
  async importarSocios(sociosData) {
    try {
      const sociosImportados = [];
      let ultimoId = await this.generarIdUnico() - 1; // Empezar desde el siguiente ID disponible

      for (const socioData of sociosData) {
        ultimoId++;
        
        const socio = {
          id_unico: ultimoId,
          nombre: socioData.nombre.trim(),
          apellido: socioData.apellido.trim(),
          correo: socioData.correo.trim().toLowerCase(),
          socio_desde: socioData.socio_desde || new Date().toISOString().split('T')[0]
        };

        const { data, error } = await supabase
          .from(this.tableName)
          .insert([socio])
          .select()
          .single();

        if (error) {
          console.error('❌ Error importando socio:', socio.nombre, error);
          // Continuar con el siguiente socio en lugar de fallar completamente
          continue;
        }

        sociosImportados.push(data);
      }

      return sociosImportados;
    } catch (error) {
      console.error('💥 Error en importarSocios:', error);
      throw new Error('Error al importar los socios: ' + error.message);
    }
  }

  // Obtener estadísticas
  async getEstadisticas() {
    try {
      const { data, error } = await supabase
        .from(this.tableName)
        .select('*');

      if (error) {
        console.error('Error obteniendo estadísticas:', error);
        throw error;
      }

      const socios = data || [];
      const totalSocios = socios.length;
      
      // Contar socios por año
      const sociosPorAno = {};
      socios.forEach(socio => {
        const ano = new Date(socio.socio_desde).getFullYear();
        sociosPorAno[ano] = (sociosPorAno[ano] || 0) + 1;
      });

      // Obtener año con más socios
      const anoConMasSocios = Object.keys(sociosPorAno).reduce((a, b) => 
        sociosPorAno[a] > sociosPorAno[b] ? a : b, 
        new Date().getFullYear().toString()
      );

      return {
        totalSocios,
        sociosPorAno,
        anoConMasSocios,
        sociosRecientes: socios.slice(0, 5) // Últimos 5 socios
      };
    } catch (error) {
      console.error('Error en getEstadisticas:', error);
      throw new Error('Error al obtener estadísticas');
    }
  }
}

export default new SociosService();
