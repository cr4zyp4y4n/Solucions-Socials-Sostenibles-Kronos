import { supabase } from '../config/supabase';

class SubvencionesSupabaseService {
  // Obtener todas las subvenciones con sus comentarios y fases
  async getAllSubvenciones() {
    try {
      const { data: subvenciones, error: subvencionesError } = await supabase
        .from('subvenciones')
        .select(`
          *,
          subvenciones_comentarios (*),
          subvenciones_fases (*)
        `)
        .order('fecha_creacion', { ascending: false });

      if (subvencionesError) {
        console.error('Error obteniendo subvenciones:', subvencionesError);
        throw subvencionesError;
      }

      return subvenciones || [];
    } catch (error) {
      console.error('Error en getAllSubvenciones:', error);
      throw error;
    }
  }

  // Crear una nueva subvención
  async createSubvencion(subvencionData) {
    try {
      // Limpiar datos antes de insertar
      const cleanData = {
        nombre: subvencionData.nombre || '',
        organismo: subvencionData.organismo || '',
        importe_otorgado: subvencionData.importe_otorgado || 0,
        periodo_ejecucion: subvencionData.periodo_ejecucion || '',
        primer_abono: subvencionData.primer_abono || 0,
        saldo_pendiente: subvencionData.saldo_pendiente || 0,
        saldo_pendiente_texto: subvencionData.saldo_pendiente_texto || '',
        estado: subvencionData.estado || '',
        imputacion: subvencionData.imputacion || '',
        // Campos adicionales
        expediente: subvencionData.expediente || '',
        codigo: subvencionData.codigo || '',
        modalidad: subvencionData.modalidad || '',
        fecha_adjudicacion: subvencionData.fecha_adjudicacion || null,
        importe_solicitado: subvencionData.importe_solicitado || 0,
        soc_l1_acompanamiento: subvencionData.soc_l1_acompanamiento || 0,
        soc_l2_contratacion: subvencionData.soc_l2_contratacion || 0,
        fecha_primer_abono: subvencionData.fecha_primer_abono || null,
        segundo_abono: subvencionData.segundo_abono || 0,
        fecha_segundo_abono: subvencionData.fecha_segundo_abono || null,
        prevision_pago: subvencionData.prevision_pago || '',
        fecha_justificacion: subvencionData.fecha_justificacion || null,
        revisado_gestoria: subvencionData.revisado_gestoria || false,
        holded_asentamiento: subvencionData.holded_asentamiento || '',
        importes_por_cobrar: subvencionData.importes_por_cobrar || 0
      };

      const { data, error } = await supabase
        .from('subvenciones')
        .insert([cleanData])
        .select()
        .single();

      if (error) {
        console.error('Error creando subvención:', error);
        console.error('Datos que causaron el error:', cleanData);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error en createSubvencion:', error);
      throw error;
    }
  }

  // Actualizar una subvención
  async updateSubvencion(id, subvencionData) {
    try {
      const { data, error } = await supabase
        .from('subvenciones')
        .update(subvencionData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando subvención:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error en updateSubvencion:', error);
      throw error;
    }
  }

  // Eliminar una subvención
  async deleteSubvencion(id) {
    try {
      const { error } = await supabase
        .from('subvenciones')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Error eliminando subvención:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error en deleteSubvencion:', error);
      throw error;
    }
  }

  // Obtener comentarios de una subvención
  async getComentarios(subvencionId) {
    try {
      const { data, error } = await supabase
        .from('subvenciones_comentarios')
        .select(`
          *,
          created_by_user:auth.users!created_by(email)
        `)
        .eq('subvencion_id', subvencionId)
        .order('fecha_creacion', { ascending: false });

      if (error) {
        console.error('Error obteniendo comentarios:', error);
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error en getComentarios:', error);
      throw error;
    }
  }

  // Añadir comentario a una subvención
  async addComentario(subvencionId, comentario) {
    try {
      const { data, error } = await supabase
        .from('subvenciones_comentarios')
        .insert([{
          subvencion_id: subvencionId,
          comentario: comentario
        }])
        .select(`
          *,
          created_by_user:auth.users!created_by(email)
        `)
        .single();

      if (error) {
        console.error('Error añadiendo comentario:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error en addComentario:', error);
      throw error;
    }
  }

  // Actualizar comentario
  async updateComentario(comentarioId, comentario) {
    try {
      const { data, error } = await supabase
        .from('subvenciones_comentarios')
        .update({ comentario })
        .eq('id', comentarioId)
        .select(`
          *,
          created_by_user:auth.users!created_by(email)
        `)
        .single();

      if (error) {
        console.error('Error actualizando comentario:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error en updateComentario:', error);
      throw error;
    }
  }

  // Eliminar comentario
  async deleteComentario(comentarioId) {
    try {
      const { error } = await supabase
        .from('subvenciones_comentarios')
        .delete()
        .eq('id', comentarioId);

      if (error) {
        console.error('Error eliminando comentario:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error en deleteComentario:', error);
      throw error;
    }
  }

  // Guardar fases del proyecto
  async saveFases(subvencionId, fases) {
    try {
      if (!fases || !Array.isArray(fases) || fases.length === 0) {
        return [];
      }

      // Primero eliminar las fases existentes
      await supabase
        .from('subvenciones_fases')
        .delete()
        .eq('subvencion_id', subvencionId);

      // Insertar las nuevas fases
      const fasesData = fases.map((fase, index) => ({
        subvencion_id: subvencionId,
        fase_numero: index + 1,
        fase_nombre: `Fase ${index + 1}`,
        fase_contenido: (fase.contenido || '').toString().substring(0, 500), // Limitar longitud
        fase_activa: Boolean(fase.activa)
      }));

      const { data, error } = await supabase
        .from('subvenciones_fases')
        .insert(fasesData)
        .select();

      if (error) {
        console.error('Error guardando fases:', error);
        console.error('Fases que causaron el error:', fasesData);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error en saveFases:', error);
      throw error;
    }
  }

  // Sincronizar datos del CSV con la base de datos
  async syncCSVData(csvData) {
    try {
      const results = {
        created: 0,
        updated: 0,
        errors: 0
      };

      // Primero, eliminar todas las subvenciones existentes para evitar duplicados
      const { error: deleteError } = await supabase
        .from('subvenciones')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000'); // Eliminar todas

      if (deleteError) {
        console.warn('Error eliminando subvenciones existentes:', deleteError);
      }

      for (const subvencion of csvData) {
        try {
          // Crear nueva subvención (siempre crear, no actualizar)
          const newSubvencion = await this.createSubvencion({
            nombre: subvencion.nombre,
            organismo: subvencion.organismo,
            importe_otorgado: subvencion.importe_otorgado,
            periodo_ejecucion: subvencion.periodo_ejecucion,
            primer_abono: subvencion.primer_abono,
            saldo_pendiente: subvencion.saldo_pendiente,
            saldo_pendiente_texto: subvencion.saldo_pendiente_texto,
            estado: subvencion.estado,
            imputacion: subvencion.imputacion
          });

          // Guardar fases
          if (subvencion.fases && subvencion.fases.length > 0) {
            await this.saveFases(newSubvencion.id, subvencion.fases);
          }

          results.created++;
          
          if (process.env.NODE_ENV === 'development') {
            console.log(`✅ Subvención creada: ${subvencion.nombre}`);
          }
        } catch (error) {
          console.error(`❌ Error procesando subvención ${subvencion.nombre}:`, error);
          results.errors++;
        }
      }

      return results;
    } catch (error) {
      console.error('Error en syncCSVData:', error);
      throw error;
    }
  }
}

export default new SubvencionesSupabaseService();
