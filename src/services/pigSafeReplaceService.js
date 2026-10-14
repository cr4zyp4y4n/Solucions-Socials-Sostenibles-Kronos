import { supabase } from '../config/supabase';

function applyFilters(query, filters = {}) {
  let next = query;
  for (const [column, value] of Object.entries(filters || {})) {
    if (Array.isArray(value)) next = next.in(column, value);
    else next = next.eq(column, value);
  }
  return next;
}

export async function safeReplacePigRowsById({ table, filters, payload }) {
  const rows = Array.isArray(payload) ? payload : [];
  const { data: existingRows, error: selectError } = await applyFilters(
    supabase.from(table).select('id'),
    filters
  );
  if (selectError) return { error: selectError };

  const oldIds = (existingRows || []).map((row) => row.id).filter(Boolean);

  if (rows.length) {
    const { error: insertError } = await supabase.from(table).insert(rows);
    if (insertError) return { error: insertError };
  }

  if (oldIds.length) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', oldIds);
    if (deleteError) return { error: deleteError };
  }

  return { error: null };
}
