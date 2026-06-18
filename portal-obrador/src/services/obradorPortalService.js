import { supabase } from '../config/supabase.js';

export async function getProveidors() {
  const { data, error } = await supabase
    .from('obrador_proveidors')
    .select('id, nom, cif')
    .order('nom');
  if (error) throw error;
  return data || [];
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
