import { supabase } from '../config/supabase';

// Servicio para manejar las facturas de Bruno
export const brunoInvoicesService = {
  
  // Obtener todas las facturas visibles para Bruno
  async getVisibleInvoices() {
    try {
      const { data, error } = await supabase
        .from('bruno_invoices')
        .select('*')
        .eq('is_hidden', false)
        .order('issue_date', { ascending: false });

      if (error) {
        console.error('Error obteniendo facturas visibles:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error en getVisibleInvoices:', error);
      return { data: null, error };
    }
  },

  // Obtener todas las facturas (para management/admin)
  async getAllInvoices() {
    try {
      const { data, error } = await supabase
        .from('bruno_invoices')
        .select('*')
        .order('issue_date', { ascending: false });

      if (error) {
        console.error('Error obteniendo todas las facturas:', error);
        throw error;
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error en getAllInvoices:', error);
      return { data: null, error };
    }
  },

                // Sincronizar datos de Holded con bruno_invoices
              async syncHoldedData(holdedInvoices) {
                try {
                  console.log('🔄 Iniciando sincronización de datos de Holded...');

                  let newInvoices = 0;
                  let updatedInvoices = 0;
                  let errors = 0;
                  let skippedInvoices = 0;

                  for (const holdedInvoice of holdedInvoices) {
                    try {
                      // Verificar que invoice_number existe y no es undefined
                      if (!holdedInvoice.invoice_number) {
                        console.warn('⚠️ Factura sin invoice_number, saltando:', holdedInvoice);
                        skippedInvoices++;
                        continue;
                      }

                      // Usar upsert para insertar o actualizar automáticamente
                      const { error: upsertError } = await supabase
                        .from('bruno_invoices')
                        .upsert({
                          invoice_number: holdedInvoice.invoice_number,
                          provider: holdedInvoice.provider,
                          issue_date: holdedInvoice.issue_date,
                          due_date: holdedInvoice.due_date,
                          total: holdedInvoice.total,
                          subtotal: holdedInvoice.subtotal,
                          vat: holdedInvoice.vat,
                          status: holdedInvoice.status,
                          description: holdedInvoice.description,
                          tags: holdedInvoice.tags,
                          account: holdedInvoice.account,
                          project: holdedInvoice.project,
                          retention: holdedInvoice.retention,
                          employees: holdedInvoice.employees,
                          equipment_recovery: holdedInvoice.equipment_recovery,
                          pending: holdedInvoice.pending,
                          payment_date: holdedInvoice.payment_date,
                          holded_id: holdedInvoice.holded_id,
                          holded_contact_id: holdedInvoice.holded_contact_id,
                          document_type: holdedInvoice.document_type
                          // NO actualizar is_hidden, hidden_reason, hidden_by, hidden_at en upsert
                        }, {
                          onConflict: 'invoice_number',
                          ignoreDuplicates: false
                        });

                      if (upsertError) {
                        console.error('Error en upsert de factura:', upsertError);
                        errors++;
                      } else {
                        // Contar como nueva o actualizada basándose en si existía antes
                        // Por simplicidad, contamos como actualizada
                        updatedInvoices++;
                        console.log('🔄 Factura procesada:', holdedInvoice.invoice_number);
                      }
        } catch (error) {
          console.error('Error procesando factura:', error);
          errors++;
        }
      }

                        console.log(`✅ Sincronización completada: ${newInvoices} nuevas, ${updatedInvoices} actualizadas, ${errors} errores, ${skippedInvoices} saltadas`);

                  return {
                    data: { newInvoices, updatedInvoices, errors, skippedInvoices },
                    error: null
                  };
    } catch (error) {
      console.error('Error en syncHoldedData:', error);
      return { data: null, error };
    }
  },

  // Ocultar una factura
  async hideInvoice(invoiceId, reason = '') {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error obteniendo usuario:', userError);
        return { data: null, error: { message: 'No se pudo obtener el usuario actual' } };
      }

      const { data, error } = await supabase
        .from('bruno_invoices')
        .update({
          is_hidden: true,
          hidden_reason: reason,
          hidden_by: user.id,
          hidden_at: new Date().toISOString()
        })
        .eq('id', invoiceId)
        .select();

      if (error) {
        console.error('Error ocultando factura:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error en hideInvoice:', error);
      return { data: null, error };
    }
  },

  // Mostrar una factura (quitar ocultación)
  async showInvoice(invoiceId) {
    try {
      const { data, error } = await supabase
        .from('bruno_invoices')
        .update({
          is_hidden: false,
          hidden_reason: null,
          hidden_by: null,
          hidden_at: null
        })
        .eq('id', invoiceId)
        .select();

      if (error) {
        console.error('Error mostrando factura:', error);
        return { data: null, error };
      }

      return { data, error: null };
    } catch (error) {
      console.error('Error en showInvoice:', error);
      return { data: null, error };
    }
  },

  // Obtener estadísticas de visibilidad
  async getVisibilityStats() {
    try {
      const { data, error } = await supabase
        .from('bruno_invoices')
        .select('is_hidden')
        .then(result => {
          if (result.error) throw result.error;
          
          const stats = {
            total: result.data.length,
            visible: result.data.filter(item => !item.is_hidden).length,
            hidden: result.data.filter(item => item.is_hidden).length
          };
          
          return { data: stats, error: null };
        });

      return { data, error: null };
    } catch (error) {
      console.error('Error en getVisibilityStats:', error);
      return { data: null, error };
    }
  }
}; 