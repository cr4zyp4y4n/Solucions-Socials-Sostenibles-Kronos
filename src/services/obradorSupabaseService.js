import { supabase } from '../config/supabase';
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz';
import { subDays } from 'date-fns';
import { normalitzarCodiQR as normalitzarCodiQRShared } from '../utils/obradorTraceCode';
import { MOMENTS_TORN } from '../../shared/obrador/checklistsTorn';

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

/** Expedicions del dia que han sortit de veritat. Les anul·lades queden a la taula, però no compten. */
async function countExpedicionsActives(daysAgo = 0) {
  const { count, error } = await supabase
    .from('obrador_expedicions')
    .select('*', { count: 'exact', head: true })
    .gte('data_sortida', madridDayStartIso(daysAgo))
    .lte('data_sortida', madridDayEndIso(daysAgo))
    .neq('estat', 'anulada');
  if (error) throw error;
  return count || 0;
}

/** Recepcions d'avui incompletes per APPCC (sense temp. o sense lot proveïdor). */
async function countRecepcionsAppccBuits(daysAgo = 0) {
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .select('id, temperatura_arribada, lot_proveidor')
    .gte('data_recepcio', madridDayStartIso(daysAgo))
    .lte('data_recepcio', madridDayEndIso(daysAgo));
  if (error) throw error;
  return (data || []).filter((r) => (
    r.temperatura_arribada == null
    || !String(r.lot_proveidor || '').trim()
  )).length;
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

export async function getProductes(opts = {}) {
  const incloureInactius = Boolean(opts && opts.incloureInactius);

  function consulta(columnes) {
    let q = supabase.from('obrador_productes').select(columnes).order('nom');
    if (!incloureInactius) q = q.eq('actiu', true);
    return q;
  }

  const ambRelacio = `
      id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens, fitxa_tecnica, actiu,
      obrador_producte_proveidors (
        id, id_proveidor, ingredient_nom,
        obrador_proveidors ( id, nom )
      )
    `;
  const senseFitxa = `
      id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens, actiu,
      obrador_producte_proveidors (
        id, id_proveidor, ingredient_nom,
        obrador_proveidors ( id, nom )
      )
    `;

  let resultat = await consulta(ambRelacio);
  if (resultat.error && isMissingColumnError(resultat.error)) {
    resultat = await consulta(senseFitxa);
  }
  if (!resultat.error) return resultat.data || [];

  const error = resultat.error;
  // Schema antic sense taula producte↔proveïdor. Només llegeix.
  if (error?.code === 'PGRST200' || /obrador_producte_proveidors/i.test(error?.message || '')) {
    let fallback = await consulta(
      'id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens, fitxa_tecnica, actiu'
    );
    if (fallback.error && isMissingColumnError(fallback.error)) {
      fallback = await consulta('id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens');
    }
    if (fallback.error) throw fallback.error;
    return (fallback.data || []).map((p) => ({ ...p, obrador_producte_proveidors: [] }));
  }

  throw error;
}

function netejaAllergens(llista) {
  const nets = [];
  const vistos = new Set();
  for (const item of Array.isArray(llista) ? llista : []) {
    const text = String(item || '').trim();
    if (!text || text.includes(',')) continue;
    const clau = text.toLowerCase();
    if (vistos.has(clau)) continue;
    vistos.add(clau);
    nets.push(text);
  }
  return nets;
}

function numeroOpcional(valor, etiqueta) {
  if (valor === '' || valor == null) return null;
  const n = Number(String(valor).replace(',', '.'));
  if (!Number.isFinite(n) || Math.abs(n) > 999.9) {
    throw new Error(`${etiqueta} no és un número vàlid.`);
  }
  return Math.round(n * 10) / 10;
}

function caducitatObligatoria(valor) {
  const n = Number(valor);
  if (!Number.isInteger(n) || n <= 0) {
    throw new Error('La caducitat en dies és obligatòria i ha de ser més gran que zero.');
  }
  return n;
}

async function exigirNomProducteUnic(nom, idExclos) {
  const net = String(nom || '').trim();
  if (!net) throw new Error('El nom del producte és obligatori.');
  const { data, error } = await supabase
    .from('obrador_productes')
    .select('id, nom')
    .eq('actiu', true);
  if (error) throw error;
  const clau = net.toLowerCase();
  const ocupat = (data || []).some(
    (p) => p.id !== idExclos && String(p.nom || '').trim().toLowerCase() === clau
  );
  if (ocupat) throw new Error('Ja hi ha un producte actiu amb aquest nom.');
  return net;
}

function payloadProducte(dades, nom) {
  const allergens = netejaAllergens(dades.allergens);
  if ((dades.allergens || []).some((item) => String(item || '').includes(','))) {
    throw new Error('Afegeix cada al·lergen per separat, sense comes.');
  }
  return {
    nom,
    caducitat_dies: caducitatObligatoria(dades.caducitat_dies),
    allergens,
    temp_coccio: numeroOpcional(dades.temp_coccio, 'La temperatura de cocció'),
    temp_conservacio: numeroOpcional(dades.temp_conservacio, 'La temperatura de conservació'),
    fitxa_tecnica: String(dades.fitxa_tecnica || '').trim() || null
  };
}

const SELECT_PRODUCTE = 'id, nom, caducitat_dies, temp_coccio, temp_conservacio, allergens, fitxa_tecnica, actiu';

export async function crearProducte(dades) {
  const nom = await exigirNomProducteUnic(dades?.nom);
  const { data, error } = await supabase
    .from('obrador_productes')
    .insert({ ...payloadProducte(dades, nom), actiu: true })
    .select(SELECT_PRODUCTE)
    .single();
  if (error) throw error;
  return data;
}

export async function actualitzarProducte(id, dades) {
  if (!id) throw new Error('Falta el producte.');
  const { data: actual, error: errorLectura } = await supabase
    .from('obrador_productes')
    .select('id, actiu')
    .eq('id', id)
    .single();
  if (errorLectura) throw errorLectura;
  let nom;
  if (actual?.actiu === false) {
    nom = String(dades?.nom || '').trim();
    if (!nom) throw new Error('El nom del producte és obligatori.');
  } else {
    nom = await exigirNomProducteUnic(dades?.nom, id);
  }
  const { data, error } = await supabase
    .from('obrador_productes')
    .update({ ...payloadProducte(dades, nom), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT_PRODUCTE)
    .single();
  if (error) throw error;
  return data;
}

/** Amaga el producte dels lots nous. No l'esborra: els lots històrics hi apunten. */
export async function arxivarProducte(id) {
  if (!id) throw new Error('Falta el producte.');
  const { data, error } = await supabase
    .from('obrador_productes')
    .update({ actiu: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select(SELECT_PRODUCTE)
    .single();
  if (error) throw error;
  return data;
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

export async function getRecepcions(limitOrOpts = 50, maybeOpts) {
  const opts = typeof limitOrOpts === 'object' && limitOrOpts != null
    ? limitOrOpts
    : { limit: limitOrOpts, ...(maybeOpts || {}) };
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const cerca = String(opts.cerca || '').trim();

  let q = supabase
    .from('obrador_recepcions')
    .select(`
      id, id_proveidor, data_recepcio, lot_proveidor, temperatura_arribada,
      estat, caducitat, congelat, observacions, operari, id_operari,
      obrador_proveidors ( id, nom )
    `)
    .order('data_recepcio', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cerca) {
    q = q.or(
      `lot_proveidor.ilike.%${cerca}%,observacions.ilike.%${cerca}%,operari.ilike.%${cerca}%`
    );
  }
  if (opts.estat) q = q.eq('estat', opts.estat);
  if (opts.idProveidor) q = q.eq('id_proveidor', opts.idProveidor);

  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

/** Capçalera de la fitxa: totals sense descarregar l'historial. */
export async function getResumProveidor(idProveidor) {
  if (!idProveidor) throw new Error('Falta el proveïdor.');

  async function comptar(estat) {
    let q = supabase
      .from('obrador_recepcions')
      .select('id', { count: 'exact', head: true })
      .eq('id_proveidor', idProveidor);
    if (estat) q = q.eq('estat', estat);
    const { count, error } = await q;
    if (error) throw error;
    return count || 0;
  }

  const [total, bo, regular, rebutjat, ultima] = await Promise.all([
    comptar(),
    comptar('bo'),
    comptar('regular'),
    comptar('rebutjat'),
    supabase
      .from('obrador_recepcions')
      .select('data_recepcio')
      .eq('id_proveidor', idProveidor)
      .order('data_recepcio', { ascending: false })
      .limit(1)
      .maybeSingle()
  ]);

  if (ultima.error) throw ultima.error;

  return {
    total,
    ultimaRecepcio: ultima.data?.data_recepcio || null,
    perEstat: { bo, regular, rebutjat }
  };
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

/** Actualitza camps d'una recepció (management). */
export async function updateRecepcio(id, camps) {
  const payload = { updated_at: new Date().toISOString() };
  const allowed = [
    'id_proveidor', 'lot_proveidor', 'temperatura_arribada', 'estat',
    'caducitat', 'congelat', 'observacions', 'operari', 'id_operari'
  ];
  for (const key of allowed) {
    if (Object.prototype.hasOwnProperty.call(camps, key)) {
      payload[key] = camps[key];
    }
  }
  const { data, error } = await supabase
    .from('obrador_recepcions')
    .update(payload)
    .eq('id', id)
    .select(`
      id, id_proveidor, data_recepcio, lot_proveidor, temperatura_arribada,
      estat, caducitat, congelat, observacions, operari, id_operari,
      obrador_proveidors ( id, nom )
    `)
    .single();
  if (error) throw error;
  return data;
}

// ── LOTS ───────────────────────────────────────────────────────

export async function getLots(limitOrOpts = 50, maybeOpts) {
  const opts = typeof limitOrOpts === 'object' && limitOrOpts != null
    ? limitOrOpts
    : { limit: limitOrOpts, ...(maybeOpts || {}) };
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const cerca = String(opts.cerca || '').trim();

  const selectFull = `
      id, codi_lot, data_produccio, temp_final_coccio,
      estat, mostra_guardada, quantitat_kg, observacions, id_recepcio,
      obrador_productes ( nom, allergens, caducitat_dies ),
      obrador_operaris ( nom ),
      obrador_etiquetes ( codi_qr, data_caducitat, allergens, data_envasat ),
      obrador_lot_recepcions (
        ordre, id_recepcio,
        obrador_recepcions (
          lot_proveidor, data_recepcio,
          obrador_proveidors ( nom )
        )
      )
    `;
  const selectFallback = `
        id, codi_lot, data_produccio, temp_final_coccio,
        estat, mostra_guardada, quantitat_kg, observacions, id_recepcio,
        obrador_productes ( nom, allergens, caducitat_dies ),
        obrador_operaris ( nom ),
        obrador_etiquetes ( codi_qr, data_caducitat, allergens, data_envasat )
      `;

  let q = supabase
    .from('obrador_lots')
    .select(selectFull)
    .order('data_produccio', { ascending: false })
    .range(offset, offset + limit - 1);

  if (cerca) q = q.ilike('codi_lot', `%${cerca}%`);
  if (opts.estat) q = q.eq('estat', opts.estat);

  const { data, error } = await q;

  if (!error) return data || [];

  if (error?.code === 'PGRST200' || /obrador_lot_recepcions/i.test(error?.message || '')) {
    let fallback = supabase
      .from('obrador_lots')
      .select(selectFallback)
      .order('data_produccio', { ascending: false })
      .range(offset, offset + limit - 1);
    if (cerca) fallback = fallback.ilike('codi_lot', `%${cerca}%`);
    if (opts.estat) fallback = fallback.eq('estat', opts.estat);
    const res = await fallback;
    if (res.error) throw res.error;
    return (res.data || []).map((l) => ({ ...l, obrador_lot_recepcions: [] }));
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

/** Normalitza el codi QR (URL ?trace=, QR-… o codi de lot). */
export function normalitzarCodiQR(input) {
  return normalitzarCodiQRShared(input);
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

export async function getExpedicions(limitOrOpts = 50, maybeOpts) {
  const opts = typeof limitOrOpts === 'object' && limitOrOpts != null
    ? limitOrOpts
    : { limit: limitOrOpts, ...(maybeOpts || {}) };
  const limit = opts.limit ?? 50;
  const offset = opts.offset ?? 0;
  const cerca = String(opts.cerca || '').trim();

  function consulta(columnes) {
    let q = supabase
      .from('obrador_expedicions')
      .select(columnes)
      .order('data_sortida', { ascending: false })
      .range(offset, offset + limit - 1);
    if (cerca) {
      q = q.or(`id_client.ilike.%${cerca}%,comanda_holded.ilike.%${cerca}%`);
    }
    if (opts.estat) q = q.eq('estat', opts.estat);
    return q;
  }

  const ambQui = `
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida,
      confirmat_client_nom, confirmat_client_at, confirmat_client_nota,
      anulada_at, anulada_per, anulada_motiu, expedida_per,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `;
  const ambAnulacio = `
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida,
      confirmat_client_nom, confirmat_client_at, confirmat_client_nota,
      anulada_at, anulada_per, anulada_motiu,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `;
  const ambOk = `
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida,
      confirmat_client_nom, confirmat_client_at, confirmat_client_nota,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `;
  const senseOk = `
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `;

  let resultat = await consulta(ambQui);
  if (resultat.error && isMissingColumnError(resultat.error)) {
    resultat = await consulta(ambAnulacio);
  }
  if (resultat.error && isMissingColumnError(resultat.error)) {
    resultat = await consulta(ambOk);
  }
  if (resultat.error && isMissingColumnError(resultat.error)) {
    resultat = await consulta(senseOk);
  }
  if (resultat.error) throw resultat.error;
  return ambNomAnulacio(resultat.data || []);
}

async function ambNomAnulacio(rows) {
  const llista = rows || [];
  const teQui = llista.some((row) => (
    Object.prototype.hasOwnProperty.call(row, 'anulada_per')
    || Object.prototype.hasOwnProperty.call(row, 'expedida_per')
  ));
  if (!teQui) return llista;
  const ids = llista.flatMap((row) => [row.anulada_per, row.expedida_per]).filter(Boolean);
  const noms = ids.length ? await nomsPerfilsObrador(ids) : {};
  return llista.map((row) => ({
    ...row,
    anulada_per_nom: row.anulada_per ? (noms[row.anulada_per] || null) : null,
    expedida_per_nom: row.expedida_per ? (noms[row.expedida_per] || null) : null
  }));
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

  const nomClient = String(dades.id_client || '').trim();
  if (nomClient) {
    try {
      await upsertClient(nomClient);
    } catch {
      /* el mestre de clients és best-effort */
    }
  }

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

/** Marca l'expedició en trànsit com a anulada (no l'esborra) i torna el lot a envasat. */
export async function anularExpedicio(id, motiu) {
  const net = String(motiu || '').trim();
  const { data, error } = await supabase.rpc('obrador_anular_expedicio', {
    p_id: id,
    p_motiu: net || null
  });
  if (error) {
    const msg = error.message || '';
    if (error.code === 'PGRST202' || /could not find the function|p_motiu/i.test(msg)) {
      throw new Error(
        'Aquesta base de dades no té la versió d\'anul·lació amb rastre. ' +
        'Cal aplicar database/alter_obrador_expedicions_anular_rastre.sql abans ' +
        'de poder anul·lar expedicions.'
      );
    }
    throw error;
  }
  return data;
}

// ── CLIENTS ────────────────────────────────────────────────────

export async function getClients(limit = 100, cerca = '') {
  let q = supabase
    .from('obrador_clients')
    .select('id, nom, codi, actiu')
    .eq('actiu', true)
    .order('nom')
    .limit(limit);
  if (cerca) q = q.ilike('nom', `%${cerca}%`);
  const { data, error } = await q;
  if (error) {
    // Taula encara no migrada → fallback des d'expedicions
    if (/obrador_clients|does not exist|PGRST/i.test(error.message || '') || error.code === '42P01') {
      const { data: rows, error: e2 } = await supabase
        .from('obrador_expedicions')
        .select('id_client')
        .not('id_client', 'is', null)
        .order('data_sortida', { ascending: false })
        .limit(200);
      if (e2) throw e2;
      const seen = new Set();
      const list = [];
      for (const r of rows || []) {
        const nom = String(r.id_client || '').trim();
        if (!nom || seen.has(nom.toLowerCase())) continue;
        if (cerca && !nom.toLowerCase().includes(cerca.toLowerCase())) continue;
        seen.add(nom.toLowerCase());
        list.push({ id: null, nom, codi: null, actiu: true });
        if (list.length >= limit) break;
      }
      return list;
    }
    throw error;
  }
  return data || [];
}

export async function upsertClient(nom, codi = null) {
  const { data, error } = await supabase.rpc('obrador_upsert_client', {
    p_nom: nom,
    p_codi: codi
  });
  if (error) throw error;
  return data;
}

// ── INCIDÈNCIES ────────────────────────────────────────────────

async function usuariAutenticatId() {
  const { data, error } = await supabase.auth.getUser();
  if (error) throw error;
  const id = data?.user?.id;
  if (!id) throw new Error('Cal iniciar sessió.');
  return id;
}

async function nomsPerfilsObrador(ids) {
  const unique = [...new Set((ids || []).filter(Boolean))];
  if (!unique.length) return {};
  const { data, error } = await supabase.rpc('obrador_noms_perfils', { p_ids: unique });
  if (error) {
    const msg = error.message || '';
    if (error.code === '42883' || error.code === 'PGRST202' || /function .* does not exist|could not find the function/i.test(msg)) {
      return {};
    }
    throw error;
  }
  const map = {};
  for (const row of data || []) map[row.id] = row.nom;
  return map;
}

function ambNomsResponsables(rows, noms) {
  return (rows || []).map((row) => ({
    ...row,
    tancada_per_nom: row.tancada_per ? (noms[row.tancada_per] || null) : null,
    verificada_per_nom: row.verificada_per ? (noms[row.verificada_per] || null) : null
  }));
}

export async function getIncidencies(limit = 100, { estat, estats } = {}) {
  const selectFull = `
      id, tipus, descripcio, data_incidencia, estat, origen, id_sensor, valor_extrem,
      tancada_at, notes_tancament, checklist_tancament, inici_episodi_at,
      tancada_per, verificada_per, verificada_at,
      obrador_lots ( codi_lot ),
      obrador_sensors ( nom, ubicacio )
    `;
  const selectNotes = `
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

  let rows;
  const full = await run(selectFull);
  if (full.error) {
    if (!isMissingColumnError(full.error)) throw full.error;
    const notes = await run(selectNotes);
    if (notes.error) {
      if (!isMissingColumnError(notes.error)) throw notes.error;
      const antic = await run(selectFallback);
      if (antic.error) throw antic.error;
      return antic.data || [];
    }
    rows = notes.data || [];
  } else {
    rows = full.data || [];
  }

  const noms = await nomsPerfilsObrador(rows.flatMap((row) => [row.tancada_per, row.verificada_per]));
  return ambNomsResponsables(rows, noms);
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

const ACCIO_CORRECTIVA_MIN = 10;

function notesTancamentExigides(notes) {
  const text = String(notes ?? '').trim();
  if (text.length < ACCIO_CORRECTIVA_MIN) {
    throw new Error('L\'acció correctiva ha de tenir almenys 10 caràcters.');
  }
  return text;
}

/**
 * Tancament amb checklist (lot o sensor).
 * Exigeix descriure l'acció correctiva i deixa qui la tanca.
 * Si falta la columna del motiu, no tanca: abans el tercer intent desa el tancament sense acció.
 * @param {string} id
 * @param {{ checklist?: Record<string, boolean|string>, notes?: string }} [opts]
 */
export async function tancarIncidencia(id, opts = {}) {
  const notes = notesTancamentExigides(opts.notes);
  const ara = new Date().toISOString();
  let tancadaPer = null;
  try {
    tancadaPer = await usuariAutenticatId();
  } catch (_) {
    tancadaPer = null;
  }

  const base = {
    estat: 'tancada',
    tancada_at: ara,
    updated_at: ara,
    notes_tancament: notes
  };
  if (opts.checklist && typeof opts.checklist === 'object') {
    base.checklist_tancament = opts.checklist;
  }

  const intents = [
    { ...base, tancada_per: tancadaPer },
    base
  ];

  let ultimError = null;
  for (const payload of intents) {
    const { data, error } = await supabase
      .from('obrador_incidencies')
      .update(payload)
      .eq('id', id)
      .select()
      .single();
    if (!error) return data;
    ultimError = error;
    if (!isMissingColumnError(error)) throw error;
  }
  if (isMissingColumnError(ultimError)) {
    throw new Error(
      'Falta aplicar database/alter_obrador_incidencies_accio_correctiva.sql abans de tancar incidències.'
    );
  }
  throw ultimError;
}

/**
 * Gestió comprova que l'acció correctiva ha estat efectiva.
 * Pot ser una persona distinta de qui ha tancat.
 */
export async function verificarIncidencia(id) {
  const { data: esGestio, error: errorRol } = await supabase.rpc('obrador_is_management_user');
  if (errorRol) throw errorRol;
  if (!esGestio) {
    throw new Error('Només el rol de gestió pot verificar una incidència.');
  }

  const uid = await usuariAutenticatId();
  const { data: actual, error: errorLectura } = await supabase
    .from('obrador_incidencies')
    .select('id, estat, verificada_at')
    .eq('id', id)
    .single();

  if (errorLectura) {
    if (isMissingColumnError(errorLectura)) {
      throw new Error('Falta aplicar la migració d\'acció correctiva a la base de dades.');
    }
    throw errorLectura;
  }
  if (actual?.estat !== 'tancada') {
    throw new Error('Només es pot verificar una incidència tancada.');
  }
  if (actual?.verificada_at) {
    throw new Error('Aquesta incidència ja està verificada.');
  }

  const ara = new Date().toISOString();
  const { data, error } = await supabase
    .from('obrador_incidencies')
    .update({
      verificada_per: uid,
      verificada_at: ara,
      updated_at: ara
    })
    .eq('id', id)
    .eq('estat', 'tancada')
    .is('verificada_at', null)
    .select()
    .single();

  if (error) {
    if (isMissingColumnError(error)) {
      throw new Error('Falta aplicar la migració d\'acció correctiva a la base de dades.');
    }
    throw error;
  }
  return data;
}

// ── REGISTRES APPCC PER TORN ───────────────────────────────────

const MOMENTS_TORN_VALIDS = new Set(MOMENTS_TORN.map((m) => m.id));

function faltaTaulaRegistresTorn(error) {
  const msg = error?.message || '';
  return error?.code === '42P01'
    || error?.code === 'PGRST205'
    || (/obrador_registres_torn/i.test(msg) && /does not exist|schema cache|could not find/i.test(msg));
}

function errorRegistreTorn(error) {
  if (!error) return;
  if (error.code === '23505') {
    throw new Error('Ja hi ha un registre d\'aquest moment per aquest dia.');
  }
  if (faltaTaulaRegistresTorn(error)) {
    throw new Error('Falta aplicar database/create_obrador_registres_torn.sql a Supabase.');
  }
  throw error;
}

function normalitzarItemsTorn(items) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error('El registre ha de tenir els ítems del checklist.');
  }
  return items.map((item) => {
    if (typeof item?.ok !== 'boolean' || !String(item.clau || '').trim() || !String(item.etiqueta || '').trim()) {
      throw new Error('Cada ítem ha de tenir clau, etiqueta i una resposta sí o no.');
    }
    const valor = String(item.valor ?? '').trim();
    const nota = String(item.nota ?? '').trim();
    return {
      clau: String(item.clau).trim(),
      etiqueta: String(item.etiqueta).trim(),
      ok: item.ok,
      valor: valor || null,
      nota: nota || null
    };
  });
}

const SELECT_REGISTRE_TORN = `
  id, data, moment, id_operari, registrat_per, items, incidencia_detectada,
  id_incidencia, observacions, created_at, updated_at,
  obrador_operaris ( nom )
`;

async function ambNomQuiRegistra(rows) {
  const noms = await nomsPerfilsObrador((rows || []).map((row) => row.registrat_per));
  return (rows || []).map((row) => ({
    ...row,
    registrat_per_nom: row.registrat_per ? (noms[row.registrat_per] || null) : null,
    operari_nom: row.obrador_operaris?.nom || null
  }));
}

export async function getRegistresTorn({ desde, fins } = {}) {
  let q = supabase
    .from('obrador_registres_torn')
    .select(SELECT_REGISTRE_TORN)
    .order('data', { ascending: false })
    .order('created_at', { ascending: false });
  if (desde) q = q.gte('data', desde);
  if (fins) q = q.lte('data', fins);
  const { data, error } = await q;
  if (error) errorRegistreTorn(error);
  return ambNomQuiRegistra(data || []);
}

export async function getRegistreTornDelDia(data, moment) {
  if (!MOMENTS_TORN_VALIDS.has(moment)) {
    throw new Error('Moment de torn no vàlid.');
  }
  const { data: row, error } = await supabase
    .from('obrador_registres_torn')
    .select(SELECT_REGISTRE_TORN)
    .eq('data', data)
    .eq('moment', moment)
    .maybeSingle();
  if (error) errorRegistreTorn(error);
  if (!row) return null;
  const [enriquit] = await ambNomQuiRegistra([row]);
  return enriquit;
}

export async function crearRegistreTorn(dades) {
  if (!MOMENTS_TORN_VALIDS.has(dades?.moment)) {
    throw new Error('Moment de torn no vàlid.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dades?.data || ''))) {
    throw new Error('Data no vàlida.');
  }
  const items = normalitzarItemsTorn(dades.items);
  let registratPer = null;
  try {
    registratPer = await usuariAutenticatId();
  } catch (_) {
    registratPer = null;
  }

  const { data, error } = await supabase
    .from('obrador_registres_torn')
    .insert({
      data: dades.data,
      moment: dades.moment,
      id_operari: dades.id_operari || null,
      registrat_per: registratPer,
      items,
      incidencia_detectada: items.some((item) => item.ok === false),
      id_incidencia: dades.id_incidencia || null,
      observacions: String(dades.observacions || '').trim() || null
    })
    .select(SELECT_REGISTRE_TORN)
    .single();
  if (error) errorRegistreTorn(error);
  const [enriquit] = await ambNomQuiRegistra([data]);
  return enriquit;
}

// ── EXPORTACIÓ PER A INSPECCIÓ ─────────────────────────────────

const EXPORT_PAGE = 1000;
const EXPORT_MAX = 20000;

function iniciDiaMadridIso(dia) {
  return fromZonedTime(`${dia}T00:00:00`, TIMEZONE_MADRID).toISOString();
}

function fiDiaMadridIso(dia) {
  return fromZonedTime(`${dia}T23:59:59.999`, TIMEZONE_MADRID).toISOString();
}

async function llegirAmbSelect(taula, columna, inici, fi, select) {
  const rows = [];
  for (let offset = 0; offset < EXPORT_MAX; offset += EXPORT_PAGE) {
    const { data, error } = await supabase
      .from(taula)
      .select(select)
      .gte(columna, inici)
      .lte(columna, fi)
      .order(columna, { ascending: true })
      .range(offset, offset + EXPORT_PAGE - 1);
    if (error) throw error;
    const batch = data || [];
    rows.push(...batch);
    if (batch.length < EXPORT_PAGE) return { rows, truncat: false };
  }
  return { rows, truncat: true };
}

async function llegirRang(taula, columna, inici, fi, selects) {
  let ultimError = null;
  for (const select of selects) {
    try {
      return await llegirAmbSelect(taula, columna, inici, fi, select);
    } catch (error) {
      ultimError = error;
      const msg = error?.message || '';
      const esEsquema = isMissingColumnError(error)
        || error?.code === 'PGRST200'
        || /obrador_lot_recepcions|obrador_sensors/i.test(msg);
      if (!esEsquema) throw error;
    }
  }
  throw ultimError;
}

async function nomDeQuiExporta() {
  try {
    const id = await usuariAutenticatId();
    const noms = await nomsPerfilsObrador([id]);
    return noms[id] || 'Usuari registrat';
  } catch (_) {
    return 'Usuari registrat';
  }
}

export async function getExportacioInspeccio({ desde, fins }) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(desde || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(fins || ''))) {
    throw new Error('Cal indicar un rang de dates vàlid.');
  }
  if (desde > fins) {
    throw new Error('La data d\'inici no pot ser posterior a la data final.');
  }

  const inici = iniciDiaMadridIso(desde);
  const fi = fiDiaMadridIso(fins);

  const [recepcions, lots, expedicions, incidenciesRaw, registres, temperatures, generatPer] = await Promise.all([
    llegirRang('obrador_recepcions', 'data_recepcio', inici, fi, [`
      id, data_recepcio, lot_proveidor, temperatura_arribada, estat, caducitat,
      congelat, observacions, operari,
      obrador_proveidors ( nom )
    `]),
    llegirRang('obrador_lots', 'data_produccio', inici, fi, [`
      id, codi_lot, data_produccio, temp_final_coccio, estat, mostra_guardada,
      quantitat_kg, observacions,
      obrador_productes ( nom ),
      obrador_operaris ( nom ),
      obrador_lot_recepcions (
        ordre,
        obrador_recepcions (
          lot_proveidor, data_recepcio,
          obrador_proveidors ( nom )
        )
      )
    `, `
      id, codi_lot, data_produccio, temp_final_coccio, estat, mostra_guardada,
      quantitat_kg, observacions,
      obrador_productes ( nom ),
      obrador_operaris ( nom )
    `]),
    llegirRang('obrador_expedicions', 'data_sortida', inici, fi, [`
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida, observacions,
      confirmat_client_nom, confirmat_client_at, confirmat_client_nota,
      anulada_at, anulada_per, anulada_motiu,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `, `
      id, id_client, data_sortida, comanda_holded, estat, check_client, check_sortida, observacions,
      confirmat_client_nom, confirmat_client_at, confirmat_client_nota,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `, `
      id, id_client, data_sortida, comanda_holded, estat, check_client, observacions,
      obrador_lots ( codi_lot, obrador_productes ( nom ) )
    `]),
    llegirRang('obrador_incidencies', 'data_incidencia', inici, fi, [`
      id, tipus, descripcio, data_incidencia, estat, origen,
      tancada_at, notes_tancament, tancada_per, verificada_per, verificada_at,
      obrador_lots ( codi_lot ),
      obrador_sensors ( nom, ubicacio )
    `, `
      id, tipus, descripcio, data_incidencia, estat, origen,
      tancada_at, notes_tancament,
      obrador_lots ( codi_lot ),
      obrador_sensors ( nom, ubicacio )
    `, `
      id, tipus, descripcio, data_incidencia, estat, origen, tancada_at,
      obrador_lots ( codi_lot )
    `]),
    getRegistresTorn({ desde, fins }),
    llegirRang('obrador_temperatures', 'mesura_at', inici, fi, [`
      ubicacio, valor, tipus, mesura_at, humitat,
      obrador_sensors ( nom )
    `, `
      ubicacio, valor, tipus, mesura_at, humitat
    `]),
    nomDeQuiExporta()
  ]);

  const noms = await nomsPerfilsObrador([
    ...incidenciesRaw.rows.flatMap((row) => [row.tancada_per, row.verificada_per]),
    ...expedicions.rows.map((row) => row.anulada_per)
  ]);

  return {
    desde,
    fins,
    generatEl: new Date().toISOString(),
    generatPer,
    recepcions: recepcions.rows,
    lots: lots.rows.map((lot) => ({ ...lot, obrador_lot_recepcions: lot.obrador_lot_recepcions || [] })),
    expedicions: expedicions.rows.map((row) => ({
      ...row,
      anulada_per_nom: row.anulada_per ? (noms[row.anulada_per] || null) : null
    })),
    incidencies: ambNomsResponsables(incidenciesRaw.rows, noms),
    registres,
    temperatures: temperatures.rows,
    temperaturesTruncades: temperatures.truncat
  };
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
    registresAppcc,
    registresAppccBuits
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
    countExpedicionsActives(0),
    countEnRang('obrador_etiquetes', 'data_envasat', 0),
    countEnRang('obrador_recepcions', 'data_recepcio', 0),
    countRecepcionsAppccBuits(0)
  ]);

  return {
    lotsAvui,
    lotsAhir,
    alertesTemp: alertesSensors + alertesLegacy,
    incidenciesObertes,
    expedicionsDia,
    etiquetesGenerades,
    registresAppcc,
    registresAppccBuits
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
