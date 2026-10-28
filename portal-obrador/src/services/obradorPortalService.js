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

export async function getProductesActius() {
  const { data, error } = await supabase
    .from('obrador_productes')
    .select('id, nom')
    .eq('actiu', true)
    .order('nom');
  if (!error) return data || [];
  if (isMissingColumnError(error)) {
    const fallback = await supabase
      .from('obrador_productes')
      .select('id, nom')
      .order('nom');
    if (fallback.error) throw fallback.error;
    return fallback.data || [];
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

  const nom = String(dades.id_client || '').trim();
  if (nom) {
    try {
      await supabase.rpc('obrador_upsert_client', { p_nom: nom, p_codi: null });
    } catch {
      /* best-effort */
    }
  }

  return data?.expedicio || null;
}

/** Última expedició d'un lot (en trànsit o entregada). Requereix sessió staff. */
export async function getExpedicioPerLot(id_lot) {
  const { data, error } = await supabase
    .from('obrador_expedicions')
    .select('id, id_client, data_sortida, estat, check_client, comanda_holded')
    .eq('id_lot', id_lot)
    .neq('estat', 'anulada')
    .order('data_sortida', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Estat de l'OK del servei receptor. No cal sessió. */
export async function getOkClientPublic(codi) {
  const { data, error } = await supabase.rpc('obrador_ok_client_public', { p_codi: codi });
  if (error) throw error;
  return data;
}

/** El servei receptor confirma la recepció escanejant el QR. No marca l'entrega. */
export async function confirmarOkClient(codi, nom, nota) {
  const { data, error } = await supabase.rpc('obrador_confirmar_ok_client', {
    p_codi: codi,
    p_nom: nom,
    p_nota: nota || null
  });
  if (error) throw error;
  return data;
}

const SQL_REGISTRES_PORTAL = 'database/alter_obrador_registres_portal.sql';

function errorRegistrePortal(error) {
  const msg = error?.message || '';
  if (/row-level security|permission denied/i.test(msg)) {
    throw new Error(`El compte del portal encara no pot desar aquest registre. Cal executar ${SQL_REGISTRES_PORTAL}.`);
  }
  if (/Ja hi ha un registre|màxim de registres/i.test(msg)) {
    throw new Error('Aquest període ja està complet.');
  }
  if (/número de fitxatge|fitxatge no correspon/i.test(msg)) {
    throw new Error(msg);
  }
  if (/codi_fichatge|nom_operari|obrador_nom_per_codi_fichatge/i.test(msg)) {
    throw new Error('Falta aplicar database/alter_obrador_registres_fichatge.sql a Supabase.');
  }
  throw error;
}

export async function nomPerCodiFichatge(codi) {
  const { data, error } = await supabase.rpc('obrador_nom_per_codi_fichatge', {
    p_codi: String(codi || '').trim()
  });
  if (error) errorRegistrePortal(error);
  const nom = String(data || '').trim();
  return nom || null;
}

export async function getTipusRegistre() {
  let { data, error } = await supabase
    .from('obrador_tipus_registre')
    .select('codi, etiqueta, frequencia, unic_per_periode, es_checklist, actiu, maxim_per_periode')
    .eq('actiu', true);
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('obrador_tipus_registre')
      .select('codi, etiqueta, frequencia, unic_per_periode, es_checklist, actiu')
      .eq('actiu', true));
    data = (data || []).map((row) => ({ ...row, maxim_per_periode: null }));
  }
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') {
      throw new Error('Falta aplicar database/alter_obrador_registres_higiene.sql a Supabase.');
    }
    throw error;
  }
  return data || [];
}

export async function getRegistresHigieneDesDe(desde) {
  const columnes = 'id, data, periode_inici, tipus_codi, items, detall, observacions, created_at, codi_fichatge, nom_operari';
  let { data, error } = await supabase
    .from('obrador_registres_torn')
    .select(columnes)
    .gte('data', desde)
    .order('data', { ascending: false })
    .limit(300);
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await supabase
      .from('obrador_registres_torn')
      .select('id, data, periode_inici, tipus_codi, items, detall, observacions, created_at')
      .gte('data', desde)
      .order('data', { ascending: false })
      .limit(300));
    data = (data || []).map((row) => ({ ...row, codi_fichatge: null, nom_operari: null }));
  }
  if (error) errorRegistrePortal(error);
  return data || [];
}

export async function crearRegistreHigiene(dades) {
  const items = Array.isArray(dades.items) ? dades.items : [];
  const { data, error } = await supabase
    .from('obrador_registres_torn')
    .insert({
      data: dades.data,
      tipus_codi: dades.tipus_codi,
      items,
      detall: dades.detall || null,
      incidencia_detectada: Boolean(dades.incidencia_detectada) || items.some((item) => item.ok === false),
      observacions: String(dades.observacions || '').trim() || null,
      origen_extern: false,
      document_adjunt_path: null,
      codi_fichatge: String(dades.codi_fichatge || '').trim() || null
    })
    .select('id, data, tipus_codi, items, detall, codi_fichatge, nom_operari')
    .single();
  if (error) errorRegistrePortal(error);
  return data;
}

export async function obrirIncidenciaDeRegistre(idRegistre, descripcio) {
  const text = String(descripcio || '').trim();
  if (text.length < 10) {
    throw new Error('La descripció ha de tenir almenys 10 caràcters.');
  }
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .insert({
      origen: 'registre',
      id_registre: idRegistre,
      tipus: 'qualitat',
      descripcio: text,
      estat: 'oberta'
    })
    .select('id')
    .single();
  if (error) errorRegistrePortal(error);

  const lligam = await supabase
    .from('obrador_registres_torn')
    .update({ id_incidencia: data.id })
    .eq('id', idRegistre);
  if (lligam.error) errorRegistrePortal(lligam.error);
  return data;
}

/** Marca l'expedició com a entregada al destí (transport / oficina). */
export async function marcarExpedicioEntregada(id, { check_client = false } = {}) {
  const { data, error } = await supabase.rpc('obrador_marcar_expedicio_entregada', {
    p_id: id,
    p_check_client: Boolean(check_client)
  });
  if (error) throw error;
  return data;
}
