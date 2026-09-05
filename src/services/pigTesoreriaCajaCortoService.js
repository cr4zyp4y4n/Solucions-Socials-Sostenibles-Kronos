import { supabase } from '../config/supabase';

/** Defaults estructurales (Lizeth introduce importes y ajusta títulos/fechas). */
export const PIG_TESORERIA_CAJA_CORTO_DEFAULTS = {
  tituloPagos: 'PREVISIÓN PAGOS DE … A …',
  tituloIngresos: 'INGRESOS PREVISTOS',
  fechaTotal: 'dd/mm',
  pagos: [
    { concepto: 'NOMINAS', importe: '' },
    { concepto: 'PROVEEDORES DOMICILIADOS', importe: '' },
    { concepto: 'PROVEEDORES 1 AL 5 DE SEPTIEMBRE', importe: '' },
    { concepto: 'SEGUROS SOCIALES', importe: '' },
    { concepto: 'AUTONOMOS', importe: '' }
  ],
  ingresos: [{ concepto: 'PREVISIÓN DE INGRESOS AGOSTO', importe: '' }]
};

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

function cloneDefaults() {
  return {
    tituloPagos: PIG_TESORERIA_CAJA_CORTO_DEFAULTS.tituloPagos,
    tituloIngresos: PIG_TESORERIA_CAJA_CORTO_DEFAULTS.tituloIngresos,
    fechaTotal: PIG_TESORERIA_CAJA_CORTO_DEFAULTS.fechaTotal,
    pagos: PIG_TESORERIA_CAJA_CORTO_DEFAULTS.pagos.map((r) => ({ ...r })),
    ingresos: PIG_TESORERIA_CAJA_CORTO_DEFAULTS.ingresos.map((r) => ({ ...r }))
  };
}

export function createEmptyCajaCortoRow() {
  return { concepto: '', importe: '' };
}

export function sumCajaCortoImportes(rows = []) {
  return (rows || []).reduce((acc, r) => {
    const n = parseEuroAmount(r?.importe);
    return acc + (n == null ? 0 : n);
  }, 0);
}

export async function loadPigTesoreriaCajaCorto({ year }) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { cajaCorto: cloneDefaults(), error: new Error('Año inválido') };
  }

  const { data, error } = await supabase
    .from('pig_tesoreria_caja_corto')
    .select('bloque, sort_order, concepto, importe, observacion')
    .eq('year', y)
    .order('bloque', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    const missingTable =
      error.code === '42P01'
      || error.code === 'PGRST205'
      || /does not exist/i.test(String(error.message || ''))
      || error.status === 404;
    if (missingTable) {
      return { cajaCorto: cloneDefaults(), error: null, tableMissing: true };
    }
    return { cajaCorto: null, error };
  }

  if (!data || data.length === 0) {
    return { cajaCorto: cloneDefaults(), error: null };
  }

  const cajaCorto = cloneDefaults();
  cajaCorto.pagos = [];
  cajaCorto.ingresos = [];

  for (const row of data) {
    if (row.bloque === 'meta') {
      const key = String(row.concepto || '');
      const val = String(row.observacion || '').trim();
      if (key === 'titulo_pagos' && val) cajaCorto.tituloPagos = val;
      else if (key === 'titulo_ingresos' && val) cajaCorto.tituloIngresos = val;
      else if (key === 'fecha_total' && val) cajaCorto.fechaTotal = val;
      continue;
    }
    const mapped = {
      concepto: String(row.concepto || ''),
      importe: formatEuroAmount(row.importe)
    };
    if (row.bloque === 'ingresos') cajaCorto.ingresos.push(mapped);
    else if (row.bloque === 'pagos') cajaCorto.pagos.push(mapped);
  }

  if (!cajaCorto.pagos.length) cajaCorto.pagos = cloneDefaults().pagos;
  if (!cajaCorto.ingresos.length) cajaCorto.ingresos = cloneDefaults().ingresos;

  return { cajaCorto, error: null };
}

export async function upsertPigTesoreriaCajaCorto({ year, cajaCorto }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { error: new Error('Año inválido') };

  const pagos = Array.isArray(cajaCorto?.pagos) ? cajaCorto.pagos : [];
  const ingresos = Array.isArray(cajaCorto?.ingresos) ? cajaCorto.ingresos : [];

  const payload = [
    {
      year: y,
      bloque: 'meta',
      sort_order: 1,
      concepto: 'titulo_pagos',
      importe: null,
      observacion: String(cajaCorto?.tituloPagos || '').trim()
    },
    {
      year: y,
      bloque: 'meta',
      sort_order: 2,
      concepto: 'titulo_ingresos',
      importe: null,
      observacion: String(cajaCorto?.tituloIngresos || '').trim()
    },
    {
      year: y,
      bloque: 'meta',
      sort_order: 3,
      concepto: 'fecha_total',
      importe: null,
      observacion: String(cajaCorto?.fechaTotal || '').trim()
    },
    ...pagos.map((r, i) => ({
      year: y,
      bloque: 'pagos',
      sort_order: i + 1,
      concepto: String(r.concepto || '').trim(),
      importe: parseEuroAmount(r.importe),
      observacion: ''
    })),
    ...ingresos.map((r, i) => ({
      year: y,
      bloque: 'ingresos',
      sort_order: i + 1,
      concepto: String(r.concepto || '').trim(),
      importe: parseEuroAmount(r.importe),
      observacion: ''
    }))
  ];

  const { error: upsertError } = await supabase
    .from('pig_tesoreria_caja_corto')
    .upsert(payload, { onConflict: 'year,bloque,sort_order' });
  if (upsertError) return { error: upsertError };

  for (const [bloque, keepCount] of [
    ['pagos', pagos.length],
    ['ingresos', ingresos.length]
  ]) {
    let query = supabase
      .from('pig_tesoreria_caja_corto')
      .delete()
      .eq('year', y)
      .eq('bloque', bloque);
    if (keepCount > 0) query = query.gt('sort_order', keepCount);

    const { error: deleteError } = await query;
    if (deleteError) return { error: deleteError };
  }

  return { error: null };
}

/** Normaliza UI → filas numéricas para el Excel PIG Normal. */
export function cajaCortoToExcelBlock(cajaCorto) {
  const src = cajaCorto || cloneDefaults();
  const mapRows = (rows) => (rows || []).map((r) => ({
    concepto: String(r.concepto || ''),
    amount: parseEuroAmount(r.importe)
  }));

  const pagosRows = mapRows(src.pagos);
  const ingresosRows = mapRows(src.ingresos);
  const totalPagos = sumCajaCortoImportes(src.pagos);
  const totalIngresos = sumCajaCortoImportes(src.ingresos);
  const fecha = String(src.fechaTotal || '').trim() || 'dd/mm';

  return {
    tituloPagos: String(src.tituloPagos || PIG_TESORERIA_CAJA_CORTO_DEFAULTS.tituloPagos),
    tituloIngresos: String(src.tituloIngresos || PIG_TESORERIA_CAJA_CORTO_DEFAULTS.tituloIngresos),
    fechaTotal: fecha,
    totalLabel: `TOTAL PREVISIÓN TESORERIA A ${fecha}`,
    pagosRows,
    ingresosRows,
    totalPagos,
    totalIngresos
  };
}
