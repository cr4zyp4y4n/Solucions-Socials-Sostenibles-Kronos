import { supabase } from '../config/supabase';

/** Defaults Lizeth / PIG99%LISTO (año 2026). */
export const PIG_ITINERARIO_EI_DEFAULTS = {
  semestre1: [
    { linea: 'ESTRUCTURA', trabajador: 'ANGIE LIZETH CIFUENTES BENAVIDES', fecha: '1/1/2026', jornada: '40H', num_orden: '1', observaciones: '' },
    { linea: 'IDONI', trabajador: 'BELINDA ELIZABETH CUBAS CASTELLANOS', fecha: '1/1/2026', jornada: '40H', num_orden: '2', observaciones: '' },
    { linea: 'KOIKI', trabajador: 'AHMAD FAHED ALHAMDO', fecha: '01-01-26 AL 18-03-26', jornada: '40H', num_orden: '3', observaciones: '' },
    { linea: 'KOIKI', trabajador: 'AHMAD FAHED ALHAMDO', fecha: '19-03-26 AL 29-05-2026', jornada: '32.5H', num_orden: '3', observaciones: '' },
    { linea: 'KOIKI', trabajador: 'MARYELIN ADRIANA PAEZ PEÑA', fecha: '14/5/2026', jornada: '20H', num_orden: '4', observaciones: '' },
    { linea: 'ESTRUCTURA', trabajador: 'JUAN SEBASTIAN RUIZ BARRERA', fecha: '01/01/2026 AL 13/07/2026', jornada: '20H', num_orden: '5', observaciones: '' },
    { linea: 'CATERING', trabajador: 'DAVID LOPEZ GOMIZ', fecha: '1/1/2026', jornada: '20H', num_orden: '6', observaciones: '' },
    { linea: 'IDONI', trabajador: 'LOLA IZQUIERDO BENEDICO', fecha: '01/01/2026 AL 02/07/2026', jornada: '27H', num_orden: '7', observaciones: '' },
    { linea: 'IDONI', trabajador: 'GIOVANA ELVIRA LAMAURE PARRA', fecha: '1/1/2026', jornada: '24H', num_orden: '8', observaciones: '' },
    { linea: 'CATERING', trabajador: 'BENJAMIN MARTINEZ', fecha: '1/1/2026', jornada: 'FD', num_orden: '9', observaciones: '' },
    { linea: 'CATERING', trabajador: 'ENCARNACIÓN PEREZ', fecha: '1/1/2026', jornada: 'FD', num_orden: '10', observaciones: '' }
  ],
  semestre2: [
    {
      linea: 'ESTRUCTURA',
      trabajador: 'ANGIE LIZETH CIFUENTES BENAVIDES',
      fecha: '1/1/2026',
      jornada: '40H',
      num_orden: '1',
      observaciones: 'SUBVENCIONABLE HASTA ? (BRUNO DEBE ENVIAR CORREO PARA CONFIRMAR)'
    },
    {
      linea: 'IDONI',
      trabajador: 'BELINDA ELIZABETH CUBAS CASTELLANOS',
      fecha: '1/1/2026',
      jornada: '40H',
      num_orden: '2',
      observaciones: 'SUBVENCIONABLE HASTA 28 DE OCTUBRE 2027'
    },
    {
      linea: 'KOIKI',
      trabajador: 'MARYELIN ADRIANA PAEZ PEÑA',
      fecha: '14/5/2026',
      jornada: '20H',
      num_orden: '3',
      observaciones: 'POR VALIDAR SI CONTINUA'
    },
    {
      linea: 'CATERING',
      trabajador: 'DAVID LOPEZ GOMIZ',
      fecha: '1/1/2026',
      jornada: '20H',
      num_orden: '4',
      observaciones: 'CONFIRMAR SI LO APRUEBAN EN INTINERARIO SUBV.'
    },
    {
      linea: 'IDONI',
      trabajador: 'GIOVANA ELVIRA LAMAURE PARRA',
      fecha: '1/1/2026',
      jornada: '24H',
      num_orden: '5',
      observaciones: 'CONFIRMAR SI SE AUMENTA JORNADA POR TEMA DE VISADO'
    },
    {
      linea: 'CATERING',
      trabajador: 'BENJAMIN MARTINEZ',
      fecha: '1/1/2026',
      jornada: 'FD',
      num_orden: '6',
      observaciones: 'CONTRATO FD, AUN VIENE A UNO QUE OTRO CATERING'
    },
    {
      linea: 'CATERING',
      trabajador: 'ENCARNACIÓN PEREZ',
      fecha: '1/1/2026',
      jornada: 'FD',
      num_orden: '7',
      observaciones: 'CONTRATO FD, VIENE A LOS CATERING QUE NO SE CRUCEN CON SU OTRO TRABAJO'
    },
    {
      linea: 'ESTRUCTURA',
      trabajador: 'BRIAN BAUTISTA',
      fecha: '',
      jornada: '20H?',
      num_orden: '8',
      observaciones: 'POR CONFIRMAR SI SE VA A REALIZAR CONTRATO E.I'
    },
    {
      linea: 'CATERING/ KOIKI',
      trabajador: 'NEREA PAREDES',
      fecha: '',
      jornada: '',
      num_orden: '',
      observaciones: 'SE PODRIA MIRAR DE QUE SOLICITE CERT. DE VULNERABILIDAD COMO HA REALIZADO BRIAN'
    }
  ]
};

function emptyRow() {
  return { linea: '', trabajador: '', fecha: '', jornada: '', num_orden: '', observaciones: '' };
}

function cloneDefaults() {
  return {
    semestre1: PIG_ITINERARIO_EI_DEFAULTS.semestre1.map((r) => ({ ...r })),
    semestre2: PIG_ITINERARIO_EI_DEFAULTS.semestre2.map((r) => ({ ...r }))
  };
}

function mapDbRow(row) {
  return {
    linea: String(row.linea || ''),
    trabajador: String(row.trabajador || ''),
    fecha: String(row.fecha || ''),
    jornada: String(row.jornada || ''),
    num_orden: String(row.num_orden || ''),
    observaciones: String(row.observaciones || '')
  };
}

export function createEmptyItinerarioRow() {
  return emptyRow();
}

export async function loadPigItinerarioEi({ year }) {
  const y = Number(year);
  if (!Number.isFinite(y)) {
    return { itinerario: cloneDefaults(), error: new Error('Año inválido') };
  }

  const { data, error } = await supabase
    .from('pig_itinerario_ei')
    .select('semestre, sort_order, linea, trabajador, fecha, jornada, num_orden, observaciones')
    .eq('year', y)
    .order('semestre', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) {
    const missingTable =
      error.code === '42P01'
      || error.code === 'PGRST205'
      || /does not exist/i.test(String(error.message || ''))
      || error.status === 404;
    if (missingTable) {
      return { itinerario: cloneDefaults(), error: null, tableMissing: true };
    }
    return { itinerario: null, error };
  }

  if (!data || data.length === 0) {
    return { itinerario: cloneDefaults(), error: null };
  }

  const itinerario = { semestre1: [], semestre2: [] };
  for (const row of data) {
    const mapped = mapDbRow(row);
    if (Number(row.semestre) === 2) itinerario.semestre2.push(mapped);
    else itinerario.semestre1.push(mapped);
  }
  if (!itinerario.semestre1.length) itinerario.semestre1 = cloneDefaults().semestre1;
  if (!itinerario.semestre2.length) itinerario.semestre2 = cloneDefaults().semestre2;
  return { itinerario, error: null };
}

export async function upsertPigItinerarioEi({ year, itinerario }) {
  const y = Number(year);
  if (!Number.isFinite(y)) return { error: new Error('Año inválido') };

  const s1 = Array.isArray(itinerario?.semestre1) ? itinerario.semestre1 : [];
  const s2 = Array.isArray(itinerario?.semestre2) ? itinerario.semestre2 : [];

  const payload = [
    ...s1.map((r, i) => ({
      year: y,
      semestre: 1,
      sort_order: i + 1,
      linea: String(r.linea || '').trim(),
      trabajador: String(r.trabajador || '').trim(),
      fecha: String(r.fecha || '').trim(),
      jornada: String(r.jornada || '').trim(),
      num_orden: String(r.num_orden || '').trim(),
      observaciones: String(r.observaciones || '').trim()
    })),
    ...s2.map((r, i) => ({
      year: y,
      semestre: 2,
      sort_order: i + 1,
      linea: String(r.linea || '').trim(),
      trabajador: String(r.trabajador || '').trim(),
      fecha: String(r.fecha || '').trim(),
      jornada: String(r.jornada || '').trim(),
      num_orden: String(r.num_orden || '').trim(),
      observaciones: String(r.observaciones || '').trim()
    }))
  ];

  const { error: deleteError } = await supabase
    .from('pig_itinerario_ei')
    .delete()
    .eq('year', y);
  if (deleteError) return { error: deleteError };

  if (!payload.length) return { error: null };

  const { error: insertError } = await supabase
    .from('pig_itinerario_ei')
    .insert(payload);
  if (insertError) return { error: insertError };
  return { error: null };
}
