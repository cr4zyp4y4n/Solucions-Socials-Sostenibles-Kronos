import { supabase } from '../config/supabase';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { subDays } from 'date-fns';

const TIMEZONE_MADRID = 'Europe/Madrid';

const TEMP_RANGS = {
  refrigeracio: { min: 0, max: 4, avis: 5 },
  congelacio: { min: -22, max: -18, avis: -17 },
  conservacio: { min: 2, max: 8, avis: 9 },
  zonaProduccio: { min: 18, max: 25, avis: 26 }
};

const DIES_SETMANA = ['Dilluns', 'Dimarts', 'Dimecres', 'Dijous', 'Divendres', 'Dissabte', 'Diumenge'];
export const ESTATS_RECEPCIO_PRODUCCIO = ['bo', 'regular'];
export const ESTATS_LOT_EXPEDIBLE = ['envasat'];

function madridDayStartIso(daysAgo = 0) {
  const ref = subDays(new Date(), daysAgo);
  const dayStr = formatInTimeZone(ref, TIMEZONE_MADRID, 'yyyy-MM-dd');
  return fromZonedTime(`${dayStr}T00:00:00`, TIMEZONE_MADRID).toISOString();
}

function madridDayEndIso(daysAgo = 0) {
  const ref = subDays(new Date(), daysAgo);
  const dayStr = formatInTimeZone(ref, TIMEZONE_MADRID, 'yyyy-MM-dd');
  return fromZonedTime(`${dayStr}T23:59:59.999`, TIMEZONE_MADRID).toISOString();
}

export function classificarTemperatura(valor, tipus) {
  const r = TEMP_RANGS[tipus] || TEMP_RANGS.refrigeracio;
  const v = Number(valor);
  if (v >= r.min && v <= r.max) return 'ok';
  if (tipus === 'congelacio') {
    if (v > (r.avis ?? r.max + 2)) return 'crític';
    if (v > r.max) return 'avís';
    return 'avís';
  }
  if (r.avis != null) {
    if (v < r.min || v > r.avis) return 'crític';
    if (v > r.max) return 'avís';
  } else if (v < r.min || v > r.max) {
    return 'avís';
  }
  return 'ok';
}

export function recepcioEsValidaPerProduccio(estat) {
  return ESTATS_RECEPCIO_PRODUCCIO.includes(String(estat || '').toLowerCase());
}

export function lotEsExpedible(estat) {
  return ESTATS_LOT_EXPEDIBLE.includes(String(estat || '').toLowerCase());
}

export function getLotNoExpedibleMessage(estat) {
  if (!estat) return 'No s\'ha pogut validar l\'estat del lot.';
  if (String(estat).toLowerCase() === 'expedit') return 'Aquest lot ja ha estat expedit.';
  return `Aquest lot està en estat "${estat}" i no es pot expedir fins que estigui envasat.`;
}

function comptarAlertesTemperatures(temperatures) {
  return (temperatures || []).filter(
    (t) => classificarTemperatura(t.valor, t.tipus) !== 'ok'
  ).length;
}

async function countEnRang(table, column, daysAgo = 0) {
  const { count, error } = await supabase
    .from(table)
    .select('*', { count: 'exact', head: true })
    .gte(column, madridDayStartIso(daysAgo))
    .lte(column, madridDayEndIso(daysAgo));
  if (error) throw error;
  return count || 0;
}

// ── SELECTS (formularis) ───────────────────────────────────────

export const PROVEIDORS_SCHEMA_SQL = 'database/alter_obrador_proveidors_holded.sql';

export function isMissingColumnError(error) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message || '');
}

/**
 * Llista proveïdors per als formularis.
 * Si falten columnes cif/holded_* a Supabase, fa fallback a id+nom i marca schemaIncomplete.
 */
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

export const LOT_MULTI_RECEPCIO_SCHEMA_SQL = 'database/alter_obrador_lot_multi_recepcio.sql';

export async function getProductes() {
  const { data, error } = await supabase
    .from('obrador_productes')
    .select(`
      id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens,
      obrador_producte_proveidors (
        id, id_proveidor, ingredient_nom,
        obrador_proveidors ( id, nom )
      )
    `)
    .eq('actiu', true)
    .order('nom');

  if (!error) return data || [];

  // Schema antic sense taula producte↔proveïdor
  if (error?.code === 'PGRST200' || /obrador_producte_proveidors/i.test(error?.message || '')) {
    const fallback = await supabase
      .from('obrador_productes')
      .select('id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens')
      .eq('actiu', true)
      .order('nom');
    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map((p) => ({ ...p, obrador_producte_proveidors: [] }));
  }

  throw error;
}

/** Substitueix els proveïdors associats a un producte. */
export async function setProducteProveidors(idProducte, files) {
  const list = Array.isArray(files) ? files : [];
  const { error: delError } = await supabase
    .from('obrador_producte_proveidors')
    .delete()
    .eq('id_producte', idProducte);
  if (delError) throw delError;

  if (!list.length) return [];

  const rows = list
    .filter((f) => f?.id_proveidor)
    .map((f) => ({
      id_producte: idProducte,
      id_proveidor: f.id_proveidor,
      ingredient_nom: String(f.ingredient_nom || '').trim()
    }));

  if (!rows.length) return [];

  const { data, error } = await supabase
    .from('obrador_producte_proveidors')
    .insert(rows)
    .select(`
      id, id_proveidor, ingredient_nom,
      obrador_proveidors ( id, nom )
    `);
  if (error) throw error;
  return data || [];
}

export async function getOperaris() {
  const { data, error } = await supabase
    .from('obrador_operaris')
    .select('id, nom, rol')
    .order('nom');
  if (error) throw error;
  return data || [];
}

// ── TEMPERATURES ───────────────────────────────────────────────

export async function getTemperatures() {
  const { data, error } = await supabase
    .from('obrador_temperatures')
    .select('ubicacio, valor, tipus, mesura_at')
    .order('mesura_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  const vistes = new Set();
  const latest = [];
  for (const row of data || []) {
    if (vistes.has(row.ubicacio)) continue;
    vistes.add(row.ubicacio);
    latest.push({
      nom: row.ubicacio,
      valor: Number(row.valor),
      tipus: row.tipus || 'refrigeracio'
    });
  }
  return latest;
}

// ── RECEPCIONS ─────────────────────────────────────────────────

export async function getRecepcions(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .select(`
      id, id_proveidor, data_recepcio, lot_proveidor, temperatura_arribada,
      estat, caducitat, congelat, observacions, operari, id_operari,
      obrador_proveidors ( id, nom )
    `)
    .order('data_recepcio', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
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

// ── LOTS ───────────────────────────────────────────────────────

export async function getLots(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_lots')
    .select(`
      id, codi_lot, data_produccio, temp_final_coccio,
      estat, mostra_guardada, quantitat_kg, observacions, id_recepcio,
      obrador_productes ( nom ),
      obrador_operaris ( nom ),
      obrador_lot_recepcions (
        ordre, id_recepcio,
        obrador_recepcions (
          lot_proveidor, data_recepcio,
          obrador_proveidors ( nom )
        )
      )
    `)
    .order('data_produccio', { ascending: false })
    .limit(limit);

  if (!error) return data || [];

  if (error?.code === 'PGRST200' || /obrador_lot_recepcions/i.test(error?.message || '')) {
    const fallback = await supabase
      .from('obrador_lots')
      .select(`
        id, codi_lot, data_produccio, temp_final_coccio,
        estat, mostra_guardada, quantitat_kg, observacions, id_recepcio,
        obrador_productes ( nom ),
        obrador_operaris ( nom )
      `)
      .order('data_produccio', { ascending: false })
      .limit(limit);
    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map((l) => ({ ...l, obrador_lot_recepcions: [] }));
  }

  throw error;
}

export async function getLotsActius(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_lots')
    .select(`
      id, codi_lot, data_produccio, estat,
      obrador_productes ( nom )
    `)
    .in('estat', ['produit', 'envasat'])
    .order('data_produccio', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/** Lots on es pot obrir incidència (inclou expedits, exclou retirats). */
export async function getLotsPerIncidencia(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_lots')
    .select(`
      id, codi_lot, data_produccio, estat,
      obrador_productes ( nom )
    `)
    .in('estat', ['produit', 'envasat', 'expedit'])
    .order('data_produccio', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

export async function crearLot(dades) {
  const ids = Array.isArray(dades.id_recepcions)
    ? dades.id_recepcions.filter(Boolean)
    : (dades.id_recepcio ? [dades.id_recepcio] : []);
  const principal = ids[0] || dades.id_recepcio || null;

  const { data, error } = await supabase.rpc('obrador_crear_lot_i_etiqueta', {
    p_id_producte: dades.id_producte,
    p_id_recepcio: principal,
    p_id_operari: dades.id_operari || null,
    p_quantitat_kg: dades.quantitat_kg ?? null,
    p_temp_final_coccio: dades.temp_final_coccio ?? null,
    p_mostra_guardada: Boolean(dades.mostra_guardada),
    p_observacions: dades.observacions || null,
    p_caducitat_dies: dades.caducitat_dies ?? 3,
    p_allergens: dades.allergens || [],
    p_id_recepcions: ids.length ? ids : null
  });
  if (error) throw error;
  return {
    lot: data?.lot || null,
    etiqueta: data?.etiqueta || null
  };
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
    .single();
  if (error) throw error;
  return data;
}

import { extractTraceCodeFromScan } from '../utils/obradorTraceCode';

/** Normalitza el codi QR (URL ?trace=, QR-… o codi de lot). */
export function normalitzarCodiQR(input) {
  const t = extractTraceCodeFromScan(input);
  if (!t) return '';
  if (/^qr-/i.test(t)) return `QR-${t.slice(3)}`;
  return t;
}

export async function getLotPerQR(codiQR) {
  const codi = normalitzarCodiQR(codiQR);
  if (!codi) throw new Error('Codi QR buit');

  const select = `
      codi_qr, data_caducitat, allergens,
      obrador_lots (
        id, codi_lot, estat, quantitat_kg, data_produccio,
        obrador_productes ( nom, allergens )
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
    if (lot) {
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
  }
  if (!data) {
    const err = new Error('Codi QR no trobat');
    err.code = 'PGRST116';
    throw err;
  }
  return data;
}

// ── ETIQUETES ──────────────────────────────────────────────────

export async function crearEtiqueta(id_lot, caducitat_dies, allergens) {
  const data_caducitat = new Date();
  data_caducitat.setDate(data_caducitat.getDate() + (caducitat_dies || 3));
  const codi_qr = `QR-${id_lot}-${Date.now()}`;

  const { data, error } = await supabase
    .from('obrador_etiquetes')
    .insert({
      id_lot,
      codi_qr,
      allergens: allergens || [],
      data_caducitat: data_caducitat.toISOString().slice(0, 10)
    })
    .select()
    .single();
  if (error) throw error;

  const { error: lotError } = await supabase
    .from('obrador_lots')
    .update({ estat: 'envasat' })
    .eq('id', id_lot);
  if (lotError) throw lotError;

  return data;
}

// ── EXPEDICIONS ────────────────────────────────────────────────

export async function getExpedicions(limit = 50) {
  const { data, error } = await supabase
    .from('obrador_expedicions')
    .select(`
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida,
      obrador_lots (
        codi_lot,
        obrador_productes ( nom )
      )
    `)
    .order('data_sortida', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
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

/** Marca l'expedició com a entregada al client (destí). */
export async function marcarExpedicioEntregada(id, { check_client = false } = {}) {
  const { data, error } = await supabase.rpc('obrador_marcar_expedicio_entregada', {
    p_id: id,
    p_check_client: Boolean(check_client)
  });
  if (error) throw error;
  return data;
}

// ── INCIDÈNCIES ────────────────────────────────────────────────

export async function getIncidencies(limit = 100, { estat } = {}) {
  let q = supabase
    .from('obrador_incidencies')
    .select(`
      id, tipus, descripcio, data_incidencia, estat,
      obrador_lots ( codi_lot )
    `)
    .order('data_incidencia', { ascending: false })
    .limit(limit);

  if (estat) q = q.eq('estat', estat);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Compatibilitat dashboard: només obertes. */
export async function getIncidenciesObertes(limit = 50) {
  return getIncidencies(limit, { estat: 'oberta' });
}

export async function crearIncidencia(dades) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .insert({ ...dades, estat: 'oberta' })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function tancarIncidencia(id) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .update({ estat: 'tancada', updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ── KPIs DASHBOARD ─────────────────────────────────────────────

export async function getKpisDashboard() {
  const temperatures = await getTemperatures();

  const [
    lotsAvui,
    lotsAhir,
    incidenciesObertes,
    expedicionsDia,
    etiquetesGenerades,
    registresAppcc
  ] = await Promise.all([
    countEnRang('obrador_lots', 'data_produccio', 0),
    countEnRang('obrador_lots', 'data_produccio', 1),
    supabase
      .from('obrador_incidencies')
      .select('*', { count: 'exact', head: true })
      .eq('estat', 'oberta')
      .then(({ count, error }) => {
        if (error) throw error;
        return count || 0;
      }),
    countEnRang('obrador_expedicions', 'data_sortida', 0),
    countEnRang('obrador_etiquetes', 'data_envasat', 0),
    countEnRang('obrador_recepcions', 'data_recepcio', 0)
  ]);

  return {
    lotsAvui,
    lotsAhir,
    alertesTemp: comptarAlertesTemperatures(temperatures),
    incidenciesObertes,
    expedicionsDia,
    etiquetesGenerades,
    registresAppcc,
    registresAppccBuits: 0
  };
}

export async function getProduccioSetmanal() {
  const fa7dies = madridDayStartIso(6);
  const { data, error } = await supabase
    .from('obrador_lots')
    .select('data_produccio')
    .gte('data_produccio', fa7dies);
  if (error) throw error;

  const counts = Array(7).fill(0);
  for (const lot of data || []) {
    const dow = Number(formatInTimeZone(lot.data_produccio, TIMEZONE_MADRID, 'i'));
    const idx = dow - 1;
    if (idx >= 0 && idx < 7) counts[idx] += 1;
  }

  return { labels: DIES_SETMANA, data: counts };
}
