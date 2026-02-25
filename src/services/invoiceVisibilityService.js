import { supabase } from '../config/supabase';

const TABLE = 'invoice_visibility';

/**
 * Servicio de visibilidad de facturas por rol.
 * Tabla: invoice_visibility (invoice_id TEXT, hidden_for_role, hidden_by, hidden_at, reason).
 */

/**
 * Obtener las facturas ocultas para un rol.
 * @param {string} role - 'manager' | 'admin' | 'management' | 'user'
 * @returns {Promise<{ data: Array, error: Error | null }>}
 */
export async function getHiddenInvoicesForRole(role) {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .eq('hidden_for_role', role)
      .order('hidden_at', { ascending: false });

    if (error) throw error;
    return { data: data || [], error: null };
  } catch (err) {
    console.error('Error getHiddenInvoicesForRole:', err);
    return { data: [], error: err };
  }
}

/**
 * Ocultar una factura para un rol.
 * @param {string} invoiceId - Identificador de la factura (Holded id o compuesto)
 * @param {string} role - 'manager' | 'admin' | 'management' | 'user'
 * @param {string} reason - Motivo de ocultación
 * @returns {Promise<{ data: object | null, error: Error | null }>}
 */
export async function hideInvoiceForRole(invoiceId, role, reason) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    const payload = {
      invoice_id: String(invoiceId),
      hidden_for_role: role,
      hidden_by: user?.id || null,
      reason: reason || null
    };
    // Eliminar si ya existe (evita conflicto UNIQUE) y luego insertar
    await supabase.from(TABLE).delete().eq('invoice_id', payload.invoice_id).eq('hidden_for_role', payload.hidden_for_role);
    const { data, error } = await supabase.from(TABLE).insert(payload).select().single();
    if (error) throw error;
    return { data, error: null };
  } catch (err) {
    console.error('Error hideInvoiceForRole:', err);
    return { data: null, error: err };
  }
}

/**
 * Mostrar una factura para un rol (eliminar la ocultación).
 * @param {string} invoiceId - Identificador de la factura
 * @param {string} role - 'manager' | 'admin' | 'management' | 'user'
 * @returns {Promise<{ error: Error | null }>}
 */
export async function showInvoiceForRole(invoiceId, role) {
  try {
    const { error } = await supabase
      .from(TABLE)
      .delete()
      .eq('invoice_id', String(invoiceId))
      .eq('hidden_for_role', role);

    if (error) throw error;
    return { error: null };
  } catch (err) {
    console.error('Error showInvoiceForRole:', err);
    return { error: err };
  }
}

/**
 * Comprobar si una factura está oculta para un rol.
 * Usa la función RPC si existe, o una consulta directa.
 * @param {string} invoiceIdentifier - Identificador de la factura (ej. número_proveedor_fecha)
 * @param {string} role - 'manager' | 'admin' | 'management' | 'user'
 * @returns {Promise<{ data: boolean, error: Error | null }>}
 */
export async function isInvoiceHiddenForRole(invoiceIdentifier, role) {
  try {
    const { data, error } = await supabase.rpc('is_invoice_hidden_for_role', {
      invoice_identifier: String(invoiceIdentifier),
      user_role: role
    });

    if (error) {
      // Fallback: consulta directa si la RPC no existe
      const { data: rows, error: selectError } = await supabase
        .from(TABLE)
        .select('id')
        .eq('invoice_id', String(invoiceIdentifier))
        .eq('hidden_for_role', role)
        .limit(1);

      if (selectError) throw selectError;
      return { data: (rows && rows.length > 0) || false, error: null };
    }
    return { data: !!data, error: null };
  } catch (err) {
    console.error('Error isInvoiceHiddenForRole:', err);
    return { data: false, error: err };
  }
}

export const invoiceVisibilityService = {
  getHiddenInvoicesForRole,
  hideInvoiceForRole,
  showInvoiceForRole,
  isInvoiceHiddenForRole
};

export default invoiceVisibilityService;
