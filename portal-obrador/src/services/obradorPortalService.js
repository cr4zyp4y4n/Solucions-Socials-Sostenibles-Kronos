import { supabase } from '../config/supabase.js';

export const PROVEIDORS_SCHEMA_SQL = 'database/alter_obrador_proveidors_holded.sql';
export const ESTATS_LOT_EXPEDIBLE = ['envasat'];

function isMissingColumnError(error) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message || '');
}

export function lotEsExpedible(estat) {
  return ESTATS_LOT_EXPEDIBLE.includes(String(estat || '').toLowerCase());
}

export function getLotNoExpedibleMessage(estat) {
  if (!estat) return 'No s\'ha pogut validar l\'estat del lot.';
  if (String(estat).toLowerCase() === 'expedit') return 'Aquest lot ja ha estat expedit.';
  return `Aquest lot està en estat "${estat}" i no es pot expedir fins que estigui envasat.`;
}

export async function getProveidors() {
  const { data, error } = await supabase
    .from('obrador_proveidors')
    .select('id, nom, cif, holded_contact_id, holded_empresa')
    .order('nom');

  if (!error) {
    return { proveidors: data || [], schemaIncomplete: false };
  }

  if (isMissingColumnError(error)) {
    const fallback = await supabase
      .from('obrador_proveidors')
      .select('id, nom')
      .order('nom');
    if (fallback.error) throw fallback.error;
    return {
      proveidors: (fallback.data || []).map((p) => ({
        ...p,
        cif: null,
        holded_contact_id: null,
        holded_empresa: null
      })),
      schemaIncomplete: true
    };
  }

  throw error;
}

export async function crearRecepcio(dades) {
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .insert(dades)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getLotPerCodi(codi_lot) {
  const { data, error } = await supabase
    .from('obrador_lots')
    .select(`
      id, codi_lot, estat, quantitat_kg, data_produccio,
      obrador_productes ( nom, allergens ),
      obrador_etiquetes ( codi_qr, data_caducitat, allergens )
    `)
    .eq('codi_lot', codi_lot)
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    const err = new Error('Codi de lot no trobat');
    err.code = 'PGRST116';
    throw err;
  }
  return data;
}

export async function getLotPerQR(codiQR) {
  const { normalitzarCodiQR } = await import('../utils/obradorTraceCode.js');
  const codi = normalitzarCodiQR(codiQR);
  if (!codi) throw new Error('Codi QR buit');

  const select = `
      codi_qr, data_caducitat, allergens,
      obrador_lots (
        id, codi_lot, estat, quantitat_kg, data_produccio,
        obrador_productes ( nom )
      )
    `;

  let { data, error } = await supabase
    .from('obrador_etiquetes')
    .select(select)
    .eq('codi_qr', codi)
    .maybeSingle();

  if (!data && !error) {
    ({ data, error } = await supabase
      .from('obrador_etiquetes')
      .select(select)
      .ilike('codi_qr', codi)
      .maybeSingle());
  }

  if (error) throw error;

  if (!data && /^LOT-/i.test(codi)) {
    const lot = await getLotPerCodi(codi);
    const etiqueta = Array.isArray(lot?.obrador_etiquetes)
      ? lot.obrador_etiquetes[0]
      : lot?.obrador_etiquetes;
    return {
      codi_qr: etiqueta?.codi_qr || null,
      data_caducitat: etiqueta?.data_caducitat || null,
      allergens: etiqueta?.allergens || null,
      obrador_lots: {
        id: lot.id,
        codi_lot: lot.codi_lot,
        estat: lot.estat,
        quantitat_kg: lot.quantitat_kg,
        data_produccio: lot.data_produccio,
        obrador_productes: lot.obrador_productes
      }
    };
  }

  if (!data) {
    const err = new Error('Codi QR no trobat');
    err.code = 'PGRST116';
    throw err;
  }
  return data;
}

export async function crearExpedicio(dades) {
  const { data, error } = await supabase.rpc('obrador_crear_expedicio_i_marcar_lot', {
    p_id_lot: dades.id_lot,
    p_id_client: dades.id_client,
    p_comanda_holded: dades.comanda_holded || null,
    p_check_sortida: Boolean(dades.check_sortida),
    p_check_client: Boolean(dades.check_client),
    p_observacions: dades.observacions || null
  });
  if (error) throw error;
  return data?.expedicio || null;
}

/** Última expedició d'un lot (en trànsit o entregada). Requereix sessió staff. */
export async function getExpedicioPerLot(id_lot) {
  const { data, error } = await supabase
    .from('obrador_expedicions')
    .select('id, id_client, data_sortida, estat, check_client, comanda_holded')
    .eq('id_lot', id_lot)
    .order('data_sortida', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Marca l'expedició com a entregada al destí (catering / client). */
export async function marcarExpedicioEntregada(id, { check_client = false } = {}) {
  const { data, error } = await supabase
    .from('obrador_expedicions')
    .update({
      estat: 'entregat',
      check_client: Boolean(check_client),
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}
