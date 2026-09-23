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

/** Estat IoT: prioritza llindars del sensor i incidències actives (oberta / en_curs). */
export function classificarEstatSensor(sensor, lectura, incidenciesActives = []) {
  if (!sensor?.actiu) return 'inactiu';

  const active = (incidenciesActives || []).filter(
    (i) =>
      i.id_sensor === sensor.id &&
      (i.estat === 'oberta' || i.estat === 'en_curs')
  );

  const senseSenyal = active.filter((i) => i.tipus === 'sensor_sense_senyal');
  if (senseSenyal.length) {
    return senseSenyal.some((i) => i.estat === 'en_curs') ? 'en_revisio' : 'sense_senyal';
  }

  const foraRang = active.filter((i) => i.tipus === 'sensor_fora_rang');
  if (foraRang.length) {
    return foraRang.some((i) => i.estat === 'en_curs') ? 'en_revisio' : 'fora_rang';
  }

  if (!lectura?.mesura_at) return 'sense_dades';

  const ageMin = (Date.now() - new Date(lectura.mesura_at).getTime()) / 60000;
  const senseMax = Number(sensor.minuts_sense_senyal) || 30;
  if (ageMin > senseMax) return 'sense_senyal';

  const v = Number(lectura.valor);
  const min = sensor.llindar_min;
  const max = sensor.llindar_max;
  if (min != null || max != null) {
    if (min != null && v < Number(min)) return 'fora_rang';
    if (max != null && v > Number(max)) return 'fora_rang';
    return 'ok';
  }

  return classificarTemperatura(v, sensor.tipus_lectura || lectura.tipus || 'refrigeracio') === 'ok'
    ? 'ok'
    : 'fora_rang';
}

export function etiquetaEstatSensor(estat) {
  switch (estat) {
    case 'ok':
      return 'OK';
    case 'fora_rang':
      return 'Fora de rang';
    case 'sense_senyal':
      return 'Sense senyal';
    case 'en_revisio':
      return 'En revisió';
    case 'sense_dades':
      return 'Sense dades';
    case 'inactiu':
      return 'Inactiu';
    default:
      return estat || '—';
  }
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
export const PROVEIDORS_ESTAT_US_SQL = 'database/alter_obrador_proveidors_estat_us.sql';

export const ESTATS_US_PROVEIDOR = ['habitual', 'ocasional', 'inactiu', 'revisar'];

const ESTAT_US_ORDER = { habitual: 0, ocasional: 1, revisar: 2, inactiu: 3 };

export function isMissingColumnError(error) {
  return error?.code === '42703' || /column .* does not exist/i.test(error?.message || '');
}

export function sortProveidorsByEstatUs(list) {
  return [...(list || [])].sort((a, b) => {
    const ea = ESTAT_US_ORDER[a.estat_us] ?? 9;
    const eb = ESTAT_US_ORDER[b.estat_us] ?? 9;
    if (ea !== eb) return ea - eb;
    return String(a.nom || '').localeCompare(String(b.nom || ''), 'ca', { sensitivity: 'base' });
  });
}

/**
 * Filtra per selector: per defecte només habitual + ocasional.
 * Manté sempre `selectedId` visible (recepcions històriques amb inactiu).
 */
export function filterProveidorsForSelector(
  list,
  { incloureInactius = false, cerca = '', selectedId = null } = {}
) {
  let out = list || [];
  if (!incloureInactius) {
    out = out.filter(
      (p) =>
        p.id === selectedId ||
        p.estat_us === 'habitual' ||
        p.estat_us === 'ocasional' ||
        p.estat_us == null
    );
  }
  const q = String(cerca || '').trim().toLowerCase();
  if (q) {
    out = out.filter((p) => {
      if (p.id === selectedId) return true;
      const nom = String(p.nom || '').toLowerCase();
      const cif = String(p.cif || '').toLowerCase();
      const codi = String(p.codi_intern || '').toLowerCase();
      return nom.includes(q) || cif.includes(q) || codi.includes(q);
    });
  }
  return sortProveidorsByEstatUs(out);
}

/**
 * Llista proveïdors per als formularis.
 * Si falten columnes cif/holded_* / estat_us a Supabase, fa fallback.
 */
export async function getProveidors() {
  const full = await supabase
    .from('obrador_proveidors')
    .select('id, nom, cif, contacte, estat_us, codi_intern, holded_contact_id, holded_empresa')
    .order('nom');

  if (!full.error) {
    return {
      proveidors: sortProveidorsByEstatUs(full.data || []),
      schemaIncomplete: false
    };
  }

  if (isMissingColumnError(full.error)) {
    const mid = await supabase
      .from('obrador_proveidors')
      .select('id, nom, cif, holded_contact_id, holded_empresa')
      .order('nom');
    if (!mid.error) {
      return {
        proveidors: (mid.data || []).map((p) => ({
          ...p,
          contacte: null,
          estat_us: 'habitual',
          codi_intern: null
        })),
        schemaIncomplete: true
      };
    }
    const fallback = await supabase
      .from('obrador_proveidors')
      .select('id, nom')
      .order('nom');
    if (fallback.error) throw fallback.error;
    return {
      proveidors: (fallback.data || []).map((p) => ({
        ...p,
        cif: null,
        contacte: null,
        estat_us: 'habitual',
        codi_intern: null,
        holded_contact_id: null,
        holded_empresa: null
      })),
      schemaIncomplete: true
    };
  }

  throw full.error;
}

/** Canviar estat_us (admin/management). No esborra el proveïdor. */
export async function updateProveidorEstatUs(id, estatUs) {
  if (!ESTATS_US_PROVEIDOR.includes(estatUs)) {
    throw new Error(`estat_us invàlid: ${estatUs}`);
  }
  const { data, error } = await supabase
    .from('obrador_proveidors')
    .update({ estat_us: estatUs, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id, nom, cif, contacte, estat_us, codi_intern, holded_contact_id, holded_empresa')
    .single();
  if (error) throw error;
  return data;
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

// ── TEMPERATURES / SENSORS IoT ─────────────────────────────────

export async function getTemperatures() {
  const { data, error } = await supabase
    .from('obrador_temperatures')
    .select('ubicacio, valor, tipus, mesura_at, sensor_id, humitat')
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
      tipus: row.tipus || 'refrigeracio',
      mesura_at: row.mesura_at,
      sensor_id: row.sensor_id || null,
      humitat: row.humitat != null ? Number(row.humitat) : null
    });
  }
  return latest;
}

export async function getSensors() {
  const { data, error } = await supabase
    .from('obrador_sensors')
    .select(
      'id, dev_eui, nom, ubicacio, tipus, tipus_lectura, llindar_min, llindar_max, minuts_tolerancia, minuts_sense_senyal, actiu, ultima_lectura_at, notes'
    )
    .order('ubicacio');
  if (error) throw error;
  return data || [];
}

/** Última lectura + estat + sèrie 24 h per sensor (dashboard IoT). */
export async function getSensorsDashboard() {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  const [sensors, tempsRes, incRes] = await Promise.all([
    getSensors(),
    supabase
      .from('obrador_temperatures')
      .select('sensor_id, valor, humitat, tipus, mesura_at')
      .not('sensor_id', 'is', null)
      .gte('mesura_at', since)
      .order('mesura_at', { ascending: true })
      .limit(2000),
    supabase
      .from('obrador_incidencies')
      .select('id, id_sensor, tipus, estat, origen')
      .eq('origen', 'sensor')
      .in('estat', ['oberta', 'en_curs'])
  ]);

  if (tempsRes.error) throw tempsRes.error;
  if (incRes.error) throw incRes.error;

  const seriesBySensor = new Map();
  const latestBySensor = new Map();
  for (const row of tempsRes.data || []) {
    const sid = row.sensor_id;
    if (!seriesBySensor.has(sid)) seriesBySensor.set(sid, []);
    seriesBySensor.get(sid).push({
      valor: Number(row.valor),
      humitat: row.humitat != null ? Number(row.humitat) : null,
      mesura_at: row.mesura_at
    });
    latestBySensor.set(sid, {
      valor: Number(row.valor),
      humitat: row.humitat != null ? Number(row.humitat) : null,
      tipus: row.tipus,
      mesura_at: row.mesura_at
    });
  }

  const incs = incRes.data || [];

  return (sensors || []).map((s) => {
    const lectura = latestBySensor.get(s.id) || null;
    // Si no hi ha sèrie 24 h però sí ultima_lectura_at al sensor, no tenim valor
    const estat = classificarEstatSensor(s, lectura, incs);
    return {
      ...s,
      lectura,
      estat,
      serie24h: seriesBySensor.get(s.id) || []
    };
  });
}

/** Subscripció Realtime per refrescar el panell IoT. Retorna unsubscribe. */
export function subscribeObradorIoT(onChange) {
  const channel = supabase
    .channel('obrador-iot-dashboard')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'obrador_temperatures' },
      () => onChange?.('temperatures')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'obrador_sensors' },
      () => onChange?.('sensors')
    )
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'obrador_incidencies' },
      () => onChange?.('incidencies')
    )
    .subscribe();

  return () => {
    try {
      supabase.removeChannel(channel);
    } catch {
      /* ignore */
    }
  };
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

export async function getIncidencies(limit = 100, { estat, estats } = {}) {
  const selectFull = `
      id, tipus, descripcio, data_incidencia, estat, origen, id_sensor, valor_extrem,
      tancada_at, notes_tancament, checklist_tancament, inici_episodi_at,
      obrador_lots ( codi_lot ),
      obrador_sensors ( nom, ubicacio )
    `;
  const selectFallback = `
      id, tipus, descripcio, data_incidencia, estat, origen, id_sensor, valor_extrem,
      tancada_at, inici_episodi_at,
      obrador_lots ( codi_lot ),
      obrador_sensors ( nom, ubicacio )
    `;

  async function run(selectCols) {
    let q = supabase
      .from('obrador_incidencies')
      .select(selectCols)
      .order('data_incidencia', { ascending: false })
      .limit(limit);
    if (Array.isArray(estats) && estats.length) q = q.in('estat', estats);
    else if (estat) q = q.eq('estat', estat);
    return q;
  }

  const { data, error } = await run(selectFull);
  if (error) {
    if (isMissingColumnError(error)) {
      const res2 = await run(selectFallback);
      if (res2.error) throw res2.error;
      return res2.data || [];
    }
    throw error;
  }
  return data || [];
}

/** Compatibilitat dashboard: actives = oberta + en_curs. */
export async function getIncidenciesObertes(limit = 50) {
  return getIncidencies(limit, { estats: ['oberta', 'en_curs'] });
}

export async function crearIncidencia(dades) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .insert({
      ...dades,
      origen: dades.origen || 'lot',
      estat: 'oberta'
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Marca incidència com a reconeguda (en revisió). No tanca l'episodi. */
export async function marcarIncidenciaEnCurs(id) {
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .update({
      estat: 'en_curs',
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .in('estat', ['oberta', 'en_curs'])
    .select()
    .single();
  if (error) throw error;
  return data;
}

/**
 * Tancament amb checklist (lot o sensor).
 * @param {string} id
 * @param {{ checklist?: Record<string, boolean|string>, notes?: string }} [opts]
 */
export async function tancarIncidencia(id, opts = {}) {
  const payload = {
    estat: 'tancada',
    tancada_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
  if (opts.checklist && typeof opts.checklist === 'object') {
    payload.checklist_tancament = opts.checklist;
  }
  if (opts.notes != null) {
    payload.notes_tancament = String(opts.notes).trim() || null;
  }

  const { data, error } = await supabase
    .from('obrador_incidencies')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    // Fallback sense columnes noves
    if (isMissingColumnError(error)) {
      const { data: d2, error: e2 } = await supabase
        .from('obrador_incidencies')
        .update({
          estat: 'tancada',
          tancada_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();
      if (e2) throw e2;
      return d2;
    }
    throw error;
  }
  return data;
}

// ── KPIs DASHBOARD ─────────────────────────────────────────────

export async function getKpisDashboard() {
  const [temperatures, sensorsDash] = await Promise.all([
    getTemperatures(),
    getSensorsDashboard().catch(() => [])
  ]);

  const alertesSensors = (sensorsDash || []).filter(
    (s) => s.estat === 'fora_rang' || s.estat === 'sense_senyal' || s.estat === 'en_revisio'
  ).length;

  // Ubicacions sense sensor_id (lectures manuals / seed antic)
  const alertesLegacy = comptarAlertesTemperatures(
    (temperatures || []).filter((t) => !t.sensor_id)
  );

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
      .in('estat', ['oberta', 'en_curs'])
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
    alertesTemp: alertesSensors + alertesLegacy,
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
