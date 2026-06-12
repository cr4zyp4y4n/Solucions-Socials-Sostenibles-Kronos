import { supabase } from '../config/supabase';

const TABLE = 'brecha_empleados_categoria';

/** Normaliza nombre para emparejar Holded ↔ Supabase. */
export function normalizeNombreBrecha(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\./g, ' ')
    .replace(/[^A-Z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(name) {
  return normalizeNombreBrecha(name).split(' ').filter(Boolean);
}

/** Coincidencia flexible (ej. MARYELIN ADRIANA PAEZ ↔ MARYELIN PAEZ). */
export function nombreBrechaCoincide(nombreEmpleado, nombreRegistro) {
  const e = normalizeNombreBrecha(nombreEmpleado);
  const s = normalizeNombreBrecha(nombreRegistro);
  if (!e || !s) return false;
  if (e === s || e.includes(s) || s.includes(e)) return true;

  const et = tokens(nombreEmpleado);
  const st = tokens(nombreRegistro);
  if (!st.length) return false;

  return st.every((t) => {
    if (t.length <= 1) {
      return et.some((w) => w.startsWith(t));
    }
    return et.some((w) => w === t || w.startsWith(t) || w.includes(t));
  });
}

/**
 * @returns {{ byHoldedId: Map, registros: Array }}
 */
export async function loadBrechaCategoriasSupabase(empresa = 'solucions') {
  const byHoldedId = new Map();
  const registros = [];

  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id, nombre, nombre_normalizado, categoria_funcion, holded_employee_id')
      .eq('empresa', empresa)
      .order('nombre', { ascending: true });

    if (error) {
      console.warn('[brecha] Supabase categorías:', error.message);
      return { byHoldedId, registros, error: error.message };
    }

    for (const row of data || []) {
      registros.push(row);
      if (row.holded_employee_id) {
        byHoldedId.set(String(row.holded_employee_id), row.categoria_funcion);
      }
    }
    return { byHoldedId, registros, error: null };
  } catch (e) {
    return { byHoldedId, registros, error: e?.message || String(e) };
  }
}

export function resolveCategoriaDesdeSupabase(row, { byHoldedId, registros }) {
  const id = String(row?.id || '').trim();
  if (id && byHoldedId.has(id)) {
    return { categoria: byHoldedId.get(id), source: 'supabase_id' };
  }

  const nombre = row?.nombreCompleto || '';
  for (const reg of registros || []) {
    if (nombreBrechaCoincide(nombre, reg.nombre)) {
      return { categoria: reg.categoria_funcion, source: 'supabase_nombre' };
    }
  }
  return null;
}

export async function upsertBrechaCategoriaSupabase({
  empresa,
  nombreCompleto,
  categoriaFuncion,
  holdedEmployeeId = null
}) {
  const nombre = String(nombreCompleto || '').trim();
  const nombre_normalizado = normalizeNombreBrecha(nombre);
  if (!nombre_normalizado || !categoriaFuncion) {
    return { success: false, error: 'Nombre y categoría obligatorios' };
  }

  const payload = {
    empresa,
    nombre,
    nombre_normalizado,
    categoria_funcion: categoriaFuncion,
    holded_employee_id: holdedEmployeeId ? String(holdedEmployeeId) : null
  };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'empresa,nombre_normalizado' })
    .select()
    .single();

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}
