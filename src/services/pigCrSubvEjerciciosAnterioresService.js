import { supabase } from '../config/supabase';

/** Título fijo del bloque en Excel CR GENERAL (hojas 1 y 2). */
export const PIG_CR_SUBV_EJERCICIOS_ANTERIORES_TITLE =
  'Ingresos Subvenciones Ejercicios Anteriores';

/** Fila de suma del bloque (solo informativa; no entra en totales del PIG). */
export const PIG_CR_SUBV_EJERCICIOS_ANTERIORES_TOTAL_LABEL =
  'TOTAL Ingresos Subvenciones Ejercicios Anteriores';

export function createEmptyCrSubvEjerciciosAnterioresRow() {
  return { concepto: '', importe: '' };
}

function parseEuroAmount(input) {
  const s = String(input ?? '').trim();
  if (!s) return null;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : null;
}

function formatEuroAmount(amount) {
  if (amount === null || amount === undefined || amount === '') return '';
  const n = Number(amount);
  if (!Number.isFinite(n)) return '';
  if (Math.abs(n % 1) < 0.0005) return String(Math.round(n));
  return String(n).replace('.', ',');
}

export async function loadPigCrSubvEjerciciosAnteriores({ year }) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { rows: [], error: new Error('Año inválido') };
  }

  const { data, error } = await supabase
    .from('pig_cr_subv_ejercicios_anteriores')
    .select('sort_order, concepto, importe')
    .eq('year', y)
    .order('sort_order', { ascending: true });

  if (error) {
    const missingTable =
      error.code === '42P01'
      || error.code === 'PGRST205'
      || /does not exist/i.test(String(error.message || ''))
      || error.status === 404;
    if (missingTable) {
      return { rows: [], error: null, tableMissing: true };
    }
    return { rows: null, error };
  }

  const rows = (data || []).map((row) => ({
    concepto: String(row.concepto || ''),
    importe: formatEuroAmount(row.importe)
  }));

  return { rows, error: null };
}

export async function upsertPigCrSubvEjerciciosAnteriores({ year, rows }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { error: new Error('Año inválido') };

  const list = Array.isArray(rows) ? rows : [];
  const payload = list
    .map((r, i) => ({
      year: y,
      sort_order: i + 1,
      concepto: String(r?.concepto || '').trim(),
      importe: parseEuroAmount(r?.importe)
    }))
    .filter((r) => r.concepto || r.importe != null);

  const { error: deleteError } = await supabase
    .from('pig_cr_subv_ejercicios_anteriores')
    .delete()
    .eq('year', y);
  if (deleteError) return { error: deleteError };

  if (!payload.length) return { error: null };

  const { error: insertError } = await supabase
    .from('pig_cr_subv_ejercicios_anteriores')
    .insert(payload);
  if (insertError) return { error: insertError };
  return { error: null };
}

/** Filas UI → números para Excel (omite filas totalmente vacías). */
export function crSubvEjerciciosAnterioresToExcelRows(rows = []) {
  return (rows || [])
    .map((r) => ({
      concepto: String(r?.concepto || '').trim(),
      amount: parseEuroAmount(r?.importe)
    }))
    .filter((r) => r.concepto || r.amount != null);
}

export function sumCrSubvEjerciciosAnteriores(rows = []) {
  return (rows || []).reduce((acc, r) => {
    const n = parseEuroAmount(r?.importe ?? r?.amount);
    return acc + (n == null ? 0 : n);
  }, 0);
}
