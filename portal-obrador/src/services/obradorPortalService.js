import { supabase } from '../config/supabase.js';

export const PROVEIDORS_SCHEMA_SQL = 'database/alter_obrador_proveidors_holded.sql';

function isMissingColumnError(error) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message || '');
}

export async function getProveidors() {
  const { data, error } = await supabase
    .from('obrador_proveidors')
    .select('id, nom, cif, holded_contact_id, holded_empresa')
    .order('nom');

  if (!error) {
    return { proveidors: data || [], schemaIncomplete: false };
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase
      .from('obrador_proveidors')
      .select('id, nom')
      .order('nom');
    if (fallback.error) throw fallback.error;
    return {
      proveidors: (fallback.data || []).map((p) => ({
        ...p,
        cif: null,
        holded_contact_id: null,
        holded_empresa: null
      })),
      schemaIncomplete: true
    };
  }

  throw error;
}

export async function crearRecepcio(dades) {
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .insert(dades)
    .select()
    .single();
  if (error) throw error;
  return data;
}
