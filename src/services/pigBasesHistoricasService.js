import { supabase } from '../config/supabase';

export const PIG_LINEAS = /** @type {const} */ (['CATERING', 'IDONI', 'KOIKI']);

function normalizeLinea(linea) {
  const l = String(linea || '').trim().toUpperCase();
  return PIG_LINEAS.includes(l) ? l : null;
}

export async function loadPigBaseMensual({ linea, year }) {
  const l = normalizeLinea(linea);
  const y = Number(year);
  if (!l || !Number.isFinite(y)) return { months: null, error: new Error('Parámetros inválidos') };

  const { data, error } = await supabase
    .from('pig_bases_historicas')
    .select('month, base')
    .eq('linea', l)
    .eq('year', y)
    .order('month', { ascending: true });

  if (error) return { months: null, error };
  if (!data || data.length === 0) return { months: null, error: null };

  const months = new Array(12).fill(0);
  for (const row of data) {
    const m = Number(row.month);
    if (m >= 1 && m <= 12) months[m - 1] = Number(row.base) || 0;
  }
  return { months, error: null };
}

export async function upsertPigBaseMensual({ linea, year, months }) {
  const l = normalizeLinea(linea);
  const y = Number(year);
  if (!l || !Number.isFinite(y)) return { error: new Error('Parámetros inválidos') };
  const arr = Array.isArray(months) ? months : [];
  const payload = [];
  for (let i = 0; i < 12; i++) {
    payload.push({
      linea: l,
      year: y,
      month: i + 1,
      base: Number(arr[i]) || 0
    });
  }

  const { error } = await supabase
    .from('pig_bases_historicas')
    .upsert(payload, { onConflict: 'linea,year,month' });

  return { error: error || null };
}

