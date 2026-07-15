import { supabase } from '../config/supabase';

export const PIG_OBJETIVOS_DEFAULTS = {
  cateringNormal: '650000',
  cateringOptim: '600000',
  idoniNormal: '140000',
  idoniOptim: '150000',
  koikiNormal: '20207',
  koikiOptim: '23881'
};

const FIELD_MAP = [
  { key: 'cateringNormal', linea: 'CATERING', variant: 'normal' },
  { key: 'cateringOptim', linea: 'CATERING', variant: 'optim' },
  { key: 'idoniNormal', linea: 'IDONI', variant: 'normal' },
  { key: 'idoniOptim', linea: 'IDONI', variant: 'optim' },
  { key: 'koikiNormal', linea: 'KOIKI', variant: 'normal' },
  { key: 'koikiOptim', linea: 'KOIKI', variant: 'optim' }
];

function parseEuroAmount(input) {
  const s = String(input ?? '').trim();
  if (!s) return 0;
  const normalized = s.replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(normalized);
  return Number.isFinite(n) ? n : 0;
}

function formatEuroAmount(amount) {
  const n = Number(amount) || 0;
  if (n === 0) return '0';
  const hasDecimals = Math.abs(n % 1) > 0.0005;
  if (hasDecimals) {
    return String(n).replace('.', ',');
  }
  return String(Math.round(n));
}

function normalizeObjetivosInput(objetivos) {
  const out = { ...PIG_OBJETIVOS_DEFAULTS };
  for (const { key } of FIELD_MAP) {
    const raw = objetivos?.[key];
    if (raw === undefined || raw === null) continue;
    out[key] = String(raw).trim();
  }
  return out;
}

export async function loadPigObjetivosComparativa({ year }) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { objetivos: { ...PIG_OBJETIVOS_DEFAULTS }, error: new Error('Año inválido') };
  }

  const { data, error } = await supabase
    .from('pig_objetivos_comparativa')
    .select('linea, variant, amount')
    .eq('year', y);

  if (error) {
    const missingTable =
      error.code === '42P01'
      || error.code === 'PGRST205'
      || /does not exist/i.test(String(error.message || ''))
      || error.status === 404;
    if (missingTable) {
      return { objetivos: { ...PIG_OBJETIVOS_DEFAULTS }, error: null, tableMissing: true };
    }
    return { objetivos: null, error };
  }

  if (!data || data.length === 0) {
    return { objetivos: { ...PIG_OBJETIVOS_DEFAULTS }, error: null };
  }

  const objetivos = { ...PIG_OBJETIVOS_DEFAULTS };
  for (const row of data) {
    const linea = String(row.linea || '').toUpperCase();
    const variant = String(row.variant || '').toLowerCase();
    const field = FIELD_MAP.find((f) => f.linea === linea && f.variant === variant);
    if (field) objetivos[field.key] = formatEuroAmount(row.amount);
  }
  return { objetivos, error: null };
}

export async function upsertPigObjetivosComparativa({ year, objetivos }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { error: new Error('Año inválido') };

  const normalized = normalizeObjetivosInput(objetivos);
  const payload = FIELD_MAP.map(({ key, linea, variant }) => ({
    linea,
    year: y,
    variant,
    amount: parseEuroAmount(normalized[key])
  }));

  const { error: deleteError } = await supabase
    .from('pig_objetivos_comparativa')
    .delete()
    .eq('year', y);

  if (deleteError) return { error: deleteError };

  const { error: insertError } = await supabase
    .from('pig_objetivos_comparativa')
    .insert(payload);

  if (insertError) return { error: insertError };
  return { error: null };
}
