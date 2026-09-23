import { supabase } from '../config/supabase';

async function deleteRowsByIds(table, ids) {
  if (!ids.length) return { error: null };
  const { error } = await supabase
    .from(table)
    .delete()
    .in('id', ids);
  return { error };
}

/**
 * Replaces a year's rows without deleting the existing data until the new
 * non-empty payload has been written successfully.
 */
export async function safeReplacePigRowsByYear({ table, year, payload }) {
  const rows = Array.isArray(payload) ? payload : [];

  if (!rows.length) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq('year', year);
    return { error };
  }

  const { data: existingRows, error: selectError } = await supabase
    .from(table)
    .select('id')
    .eq('year', year);
  if (selectError) return { error: selectError };

  const { error: insertError } = await supabase
    .from(table)
    .insert(rows);
  if (insertError) return { error: insertError };

  const oldIds = (existingRows || []).map((row) => row.id).filter(Boolean);
  return deleteRowsByIds(table, oldIds);
}
