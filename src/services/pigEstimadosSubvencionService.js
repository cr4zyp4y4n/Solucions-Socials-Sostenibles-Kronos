import { supabase } from '../config/supabase';

/** Líneas con estimado de subvención en PIG (incluye ESTRUCTURA para hoja SUBV 740). */
export const PIG_ESTIMADOS_LINEAS = /** @type {const} */ (['CATERING', 'IDONI', 'KOIKI', 'ESTRUCTURA']);

export const PIG_ESTIMADO_MONTH_OPTIONS = [
  { value: 1, label: 'Gener' },
  { value: 2, label: 'Febrer' },
  { value: 3, label: 'Març' },
  { value: 4, label: 'Abril' },
  { value: 5, label: 'Maig' },
  { value: 6, label: 'Juny' },
  { value: 7, label: 'Juliol' },
  { value: 8, label: 'Agost' },
  { value: 9, label: 'Setembre' },
  { value: 10, label: 'Octubre' },
  { value: 11, label: 'Novembre' },
  { value: 12, label: 'Desembre' }
];

function emptyTramo() {
  return { amount: '', from: 1, to: 12 };
}

function emptySubvSlot() {
  return { tramos: [emptyTramo(), emptyTramo()] };
}

function emptyEstimados() {
  return {
    CATERING: { subv1: emptySubvSlot(), subv2: emptySubvSlot() },
    IDONI: { subv1: emptySubvSlot(), subv2: emptySubvSlot() },
    KOIKI: { subv1: emptySubvSlot(), subv2: emptySubvSlot() },
    ESTRUCTURA: { subv1: emptySubvSlot(), subv2: emptySubvSlot() }
  };
}

export const PIG_ESTIMADOS_DEFAULTS = {
  CATERING: {
    subv1: { tramos: [{ amount: '1200', from: 1, to: 12 }, emptyTramo()] },
    subv2: emptySubvSlot()
  },
  IDONI: {
    subv1: { tramos: [{ amount: '2500', from: 1, to: 12 }, emptyTramo()] },
    subv2: emptySubvSlot()
  },
  KOIKI: {
    subv1: { tramos: [{ amount: '900', from: 1, to: 12 }, emptyTramo()] },
    subv2: emptySubvSlot()
  },
  ESTRUCTURA: {
    subv1: { tramos: [{ amount: '2800,87', from: 1, to: 12 }, emptyTramo()] },
    subv2: emptySubvSlot()
  }
};

function clampMonth(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.min(12, Math.round(n)));
}

function parseEuroAmount(input) {
  const s = String(input ?? '').trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatEuroAmount(amount) {
  const n = Number(amount) || 0;
  return n === 0 ? '' : String(n).replace('.', ',');
}

function normalizeTramo(raw = {}) {
  return {
    amount: String(raw.amount ?? '').trim(),
    from: clampMonth(raw.from, 1),
    to: clampMonth(raw.to, 12)
  };
}

function normalizeSubvSlot(raw) {
  const tramos = Array.isArray(raw?.tramos) ? raw.tramos : [];
  return {
    tramos: [
      normalizeTramo(tramos[0] || emptyTramo()),
      normalizeTramo(tramos[1] || emptyTramo())
    ]
  };
}

function normalizeEstimadosInput(estimados) {
  const out = emptyEstimados();
  for (const linea of PIG_ESTIMADOS_LINEAS) {
    const row = estimados?.[linea] || {};
    if (row.subv1 != null && typeof row.subv1 === 'object') {
      out[linea] = {
        subv1: normalizeSubvSlot(row.subv1),
        subv2: normalizeSubvSlot(row.subv2)
      };
      continue;
    }
    // Compatibilidad formato antiguo: subv1/subv2 como string único todo el año
    out[linea].subv1.tramos[0] = {
      amount: String(row.subv1 ?? '').trim(),
      from: 1,
      to: 12
    };
    out[linea].subv2.tramos[0] = {
      amount: String(row.subv2 ?? '').trim(),
      from: 1,
      to: 12
    };
  }
  return out;
}

function tramoHasAmount(tramo) {
  return Boolean(String(tramo?.amount ?? '').trim()) || parseEuroAmount(tramo?.amount) !== 0;
}

export function buildMonthlyAmountsFromTramos(tramos = [], monthsLen = 12) {
  const months = new Array(12).fill(0);
  const len = Math.max(1, Math.min(12, Number(monthsLen) || 12));
  for (const tramo of tramos || []) {
    if (!tramoHasAmount(tramo)) continue;
    const amount = parseEuroAmount(tramo.amount);
    const from = clampMonth(tramo.from, 1);
    const to = clampMonth(tramo.to, 12);
    for (let idx = from - 1; idx < to && idx < 12; idx++) {
      months[idx] = amount;
    }
  }
  return months.slice(0, len);
}

function slotHasData(slot) {
  return (slot?.tramos || []).some(tramoHasAmount);
}

export function estimadosToSlots(estimados) {
  const normalized = normalizeEstimadosInput(estimados);
  const byLinea = {};
  for (const linea of PIG_ESTIMADOS_LINEAS) {
    const slots = [];
    for (const slotNum of [1, 2]) {
      const slot = normalized[linea][`subv${slotNum}`];
      if (!slotHasData(slot)) {
        if (slotNum === 1) slots.push({ slot: 1, months: new Array(12).fill(0) });
        continue;
      }
      slots.push({
        slot: slotNum,
        months: buildMonthlyAmountsFromTramos(slot.tramos, 12)
      });
    }
    byLinea[linea] = slots;
  }
  return byLinea;
}

export async function loadPigEstimadosSubvencion({ year }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { estimados: { ...PIG_ESTIMADOS_DEFAULTS }, error: new Error('Año inválido') };

  const { data, error } = await supabase
    .from('pig_estimados_subvencion')
    .select('linea, slot, segment, month_from, month_to, amount')
    .eq('year', y)
    .order('linea', { ascending: true })
    .order('slot', { ascending: true })
    .order('segment', { ascending: true });

  if (error) {
    const missingTable =
      error.code === '42P01'
      || error.code === 'PGRST205'
      || /does not exist/i.test(String(error.message || ''))
      || error.status === 404;
    if (missingTable) {
      return { estimados: { ...PIG_ESTIMADOS_DEFAULTS }, error: null, tableMissing: true };
    }
    return { estimados: null, error };
  }

  if (!data || data.length === 0) {
    return { estimados: { ...PIG_ESTIMADOS_DEFAULTS }, error: null };
  }

  const estimados = emptyEstimados();
  for (const row of data) {
    const linea = String(row.linea || '').toUpperCase();
    if (!PIG_ESTIMADOS_LINEAS.includes(linea)) continue;
    const slot = Number(row.slot);
    if (slot !== 1 && slot !== 2) continue;
    const segment = Number(row.segment) || 1;
    const segIdx = segment - 1;
    if (segIdx < 0 || segIdx > 1) continue;
    estimados[linea][`subv${slot}`].tramos[segIdx] = {
      amount: formatEuroAmount(row.amount),
      from: clampMonth(row.month_from, 1),
      to: clampMonth(row.month_to, 12)
    };
  }
  return { estimados, error: null };
}

export async function upsertPigEstimadosSubvencion({ year, estimados }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { error: new Error('Año inválido') };

  const normalized = normalizeEstimadosInput(estimados);
  const payload = [];

  for (const linea of PIG_ESTIMADOS_LINEAS) {
    for (const slot of [1, 2]) {
      const slotData = normalized[linea][`subv${slot}`];
      const tramos = slotData?.tramos || [];
      for (let segIdx = 0; segIdx < tramos.length; segIdx++) {
        const tramo = tramos[segIdx];
        if (!tramoHasAmount(tramo)) continue;
        payload.push({
          linea,
          year: y,
          slot,
          segment: segIdx + 1,
          month_from: clampMonth(tramo.from, 1),
          month_to: clampMonth(tramo.to, 12),
          amount: parseEuroAmount(tramo.amount)
        });
      }
    }
  }

  const { error: deleteError } = await supabase
    .from('pig_estimados_subvencion')
    .delete()
    .eq('year', y)
    .in('linea', [...PIG_ESTIMADOS_LINEAS]);

  if (deleteError) return { error: deleteError };

  if (!payload.length) return { error: null };

  const { error: upsertError } = await supabase
    .from('pig_estimados_subvencion')
    .insert(payload);

  if (upsertError) return { error: upsertError };
  return { error: null };
}
