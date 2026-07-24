import { supabase } from '../config/supabase';

export const PIG_TESORERIA_PREVISIONES_BLOCKS = {
  ingresos_por_subv: {
    key: 'ingresos_por_subv',
    title: 'PREVISIÓN DE TESORERIA - INGRESOS POR SUBV',
    amountHeader: 'INGRESO PREVISTO',
    obsHeader: 'OBSERVACION DE SUBVENCIONES IMPUTADAS',
    totalLabel: 'TOTAL SUBVENCIONES POR COBRAR',
    totalObsDefault: 'REQUERIMIENTO ENVIADO'
  },
  por_aprobar: {
    key: 'por_aprobar',
    title: 'PREVISIÓN DE SUBV. POR APROBAR',
    amountHeader: 'INGRESO PREVISTO',
    obsHeader: 'OBSERVACION DE SUBVENCIONES QUE FALTA DINERO POR INGRESAR E IMPUTAR',
    totalLabel: 'TOTAL PREV. SUBVENCIONES POR APROBAR',
    totalObsDefault: ''
  }
};

/** Defaults Lizeth (incluye ACOL para cuadrar el total 69.647,10). */
export const PIG_TESORERIA_PREVISIONES_DEFAULTS = {
  ingresos_por_subv: [
    {
      concepto: 'E.I L2 01/09/25 - 31/12/25',
      ingreso: '15613,27',
      observacion: 'IMPULSEM 10.000 A IDONI 10 MESES, SE IMPUTA DE 01/01 AL 01/10 DE 2026'
    },
    { concepto: 'ACOL 11/2023 - 12/2024', ingreso: '25017,03', observacion: '' },
    {
      concepto: 'E.I L1 01/07/24 - 30/06/25',
      ingreso: '4200',
      observacion: 'OBSERVACION DE SUBVENCIONES QUE FALTA DINERO POR INGRESAR E IMPUTAR'
    },
    {
      concepto: 'E.I L2 01/09/23 - 30/09/24',
      ingreso: '1706,29',
      observacion: 'A espera de que acepten a David puede ser 1.300 aproximadamente adicional'
    },
    {
      concepto: 'INVES (INVERSIÓN) 10/12/25 - 09/12/2026',
      ingreso: '19750',
      observacion: 'A LA ESPERA DE INGRESO YA SE ENVIO REQUERIMIENTO'
    },
    {
      concepto: 'E.I L1 01/07/25 - 31/12/25',
      ingreso: '3360,51',
      observacion: 'SOLICITARON REQUERIMIENTO (SE ENCUENTRA EN REVISIÓN)'
    }
  ],
  por_aprobar: [
    {
      concepto: 'E.I L1 ESTRUCTURALES 01/01/26 - 31/12/26',
      ingreso: '33610,44',
      observacion: 'RESOLUCIÓN PROVISIONAL POR ESTE IMPORTE, FALTA RESOLUCIÓN FINAL'
    },
    {
      concepto: 'ENFORTIM APROVADO ESPERA RESOLUCION FINAL 14/12/26 - 13/12/27',
      ingreso: '6300',
      observacion: ''
    },
    {
      concepto: 'CAMBIO CLIMATICO 14/12/2026 AL 31/03/2028',
      ingreso: '80000',
      observacion: 'RESOLUCIÓN PROVISIONAL POR ESTE IMPORTE, SE DEBE ENVIAR REFORMULACIÓN'
    },
    {
      concepto: 'IMPULSEM 2.026 - 2.027',
      ingreso: '',
      observacion: 'POSTULACIÓN (NO TENEMOS AUN RESOLUCIÓN PROVISIONAL)'
    },
    {
      concepto: 'E.I L2 ESTRUCTURAL 01/01/26 al 31/08/2026',
      ingreso: '52793,44',
      observacion: 'BRUNO DEBE POSTULARSE'
    },
    { concepto: 'SINGULAR 26/27', ingreso: '', observacion: '' }
  ],
  totalObsIngresos: 'REQUERIMIENTO ENVIADO'
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
    ingresos_por_subv: PIG_TESORERIA_PREVISIONES_DEFAULTS.ingresos_por_subv.map((r) => ({ ...r })),
    por_aprobar: PIG_TESORERIA_PREVISIONES_DEFAULTS.por_aprobar.map((r) => ({ ...r })),
    totalObsIngresos: PIG_TESORERIA_PREVISIONES_DEFAULTS.totalObsIngresos
  };
}

export function createEmptyPrevisionRow() {
  return { concepto: '', ingreso: '', observacion: '' };
}

export function sumPrevisionesIngresos(rows = []) {
  return (rows || []).reduce((acc, r) => {
    const n = parseEuroAmount(r?.ingreso);
    return acc + (n == null ? 0 : n);
  }, 0);
}

export async function loadPigTesoreriaPrevisiones({ year }) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { previsiones: cloneDefaults(), error: new Error('Año inválido') };
  }

  const { data, error } = await supabase
    .from('pig_tesoreria_previsiones')
    .select('bloque, sort_order, concepto, ingreso_previsto, observacion')
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
      return { previsiones: cloneDefaults(), error: null, tableMissing: true };
    }
    return { previsiones: null, error };
  }

  if (!data || data.length === 0) {
    return { previsiones: cloneDefaults(), error: null };
  }

  const previsiones = {
    ingresos_por_subv: [],
    por_aprobar: [],
    totalObsIngresos: PIG_TESORERIA_PREVISIONES_DEFAULTS.totalObsIngresos
  };

  for (const row of data) {
    const mapped = {
      concepto: String(row.concepto || ''),
      ingreso: formatEuroAmount(row.ingreso_previsto),
      observacion: String(row.observacion || '')
    };
    if (row.bloque === 'por_aprobar') previsiones.por_aprobar.push(mapped);
    else previsiones.ingresos_por_subv.push(mapped);
  }

  if (!previsiones.ingresos_por_subv.length) {
    previsiones.ingresos_por_subv = cloneDefaults().ingresos_por_subv;
  }
  if (!previsiones.por_aprobar.length) {
    previsiones.por_aprobar = cloneDefaults().por_aprobar;
  }

  return { previsiones, error: null };
}

export async function upsertPigTesoreriaPrevisiones({ year, previsiones }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { error: new Error('Año inválido') };

  const ingresos = Array.isArray(previsiones?.ingresos_por_subv) ? previsiones.ingresos_por_subv : [];
  const porAprobar = Array.isArray(previsiones?.por_aprobar) ? previsiones.por_aprobar : [];

  const payload = [
    ...ingresos.map((r, i) => ({
      year: y,
      bloque: 'ingresos_por_subv',
      sort_order: i + 1,
      concepto: String(r.concepto || '').trim(),
      ingreso_previsto: parseEuroAmount(r.ingreso),
      observacion: String(r.observacion || '').trim()
    })),
    ...porAprobar.map((r, i) => ({
      year: y,
      bloque: 'por_aprobar',
      sort_order: i + 1,
      concepto: String(r.concepto || '').trim(),
      ingreso_previsto: parseEuroAmount(r.ingreso),
      observacion: String(r.observacion || '').trim()
    }))
  ];

  const { error: deleteError } = await supabase
    .from('pig_tesoreria_previsiones')
    .delete()
    .eq('year', y);
  if (deleteError) return { error: deleteError };

  if (!payload.length) return { error: null };

  const { error: insertError } = await supabase
    .from('pig_tesoreria_previsiones')
    .insert(payload);
  if (insertError) return { error: insertError };
  return { error: null };
}

/** Normaliza previsiones UI → filas numéricas para el Excel. */
export function previsionesToExcelBlocks(previsiones) {
  const src = previsiones || cloneDefaults();
  const mapRows = (rows) => (rows || []).map((r) => ({
    concepto: String(r.concepto || ''),
    amount: parseEuroAmount(r.ingreso),
    observacion: String(r.observacion || '')
  }));

  return {
    ingresosPorSubv: {
      ...PIG_TESORERIA_PREVISIONES_BLOCKS.ingresos_por_subv,
      rows: mapRows(src.ingresos_por_subv),
      total: sumPrevisionesIngresos(src.ingresos_por_subv),
      totalObs: src.totalObsIngresos || PIG_TESORERIA_PREVISIONES_DEFAULTS.totalObsIngresos
    },
    porAprobar: {
      ...PIG_TESORERIA_PREVISIONES_BLOCKS.por_aprobar,
      rows: mapRows(src.por_aprobar),
      total: sumPrevisionesIngresos(src.por_aprobar),
      totalObs: ''
    }
  };
}
