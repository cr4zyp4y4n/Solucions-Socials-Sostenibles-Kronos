/**
 * Fonts + sync de licitacions (ESM pur).
 * Sense DOMParser / Electron / React. Rep supabase i http via setters.
 * Usat per Electron (webpack) i per l'Edge Function.
 */
import { classifyCpv, cpvPrefix, evaluateLicitacio } from './filtres.mjs';
import { shouldArchiveLicitacio } from './vigent.mjs';
import { LICITACIONS_CONFIG_FALLBACK, loadLicitacionsConfig } from './configFallback.mjs';

const LICITACIONS_ESTAT_CONTRACTACIO = {
  PRE: { label: 'Anuncio previo' },
  PUB: { label: 'En plazo' },
  EV: { label: 'Pendiente de adjudicación' },
  ADJ: { label: 'Adjudicada' },
  RES: { label: 'Resuelta' },
  ANUL: { label: 'Anulada' },
  DES: { label: 'Desierta' }
};

/** Codis CPV d'inclusió (config) per a consultes HTTP. */
function cpvQueryList(config = LICITACIONS_CONFIG_FALLBACK) {
  return [
    ...new Set([
      ...(config.cpv_catering || []),
      ...(config.cpv_tech || []),
      ...(config.cpv_altres || [])
    ])
  ];
}

function emptyFilterStats() {
  return {
    llegits: { ted: 0, pscp: 0, placsp: 0, placsp_menors: 0 },
    exclosos: { cpv: 0, keyword: 0, import: 0 },
    incidencies: []
  };
}

function bumpExclos(stats, motiu) {
  if (!stats?.exclosos || !motiu) return;
  stats.exclosos[motiu] = (stats.exclosos[motiu] || 0) + 1;
}

const TABLE = 'licitacions';

let supabaseClientOverride = null;
let httpClientOverride = null;

export function setLicitacionsSupabaseClient(client) {
  supabaseClientOverride = client || null;
}

export function setLicitacionsHttpClient(fn) {
  httpClientOverride = typeof fn === 'function' ? fn : null;
}

/** Injecció conjunta (Edge / tests). */
export function setLicitacionsDeps({ supabase, httpRequest } = {}) {
  if (supabase) setLicitacionsSupabaseClient(supabase);
  if (httpRequest) setLicitacionsHttpClient(httpRequest);
}

function getSupabase() {
  if (!supabaseClientOverride) {
    throw new Error('licitacions fonts: cal setLicitacionsSupabaseClient / setLicitacionsDeps');
  }
  return supabaseClientOverride;
}

const TED_SEARCH_URL = 'https://api.ted.europa.eu/v3/notices/search';
/** opendata.aoc.cat ya no resuelve DNS (jun 2026). Fuente actual: Transparencia Catalunya (Socrata). */
const PSCP_CATALUNYA_URL = 'https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json';
/** Legacy (solo fallback informativo; suele fallar con ENOTFOUND). */
const PSCP_RECORDS_URL_LEGACY =
  'https://opendata.aoc.cat/api/explore/v2.1/catalog/datasets/contractacio-publica-pscp/records';
/** Només Completo3: el .atom "curt" retorna HTML de redirecció al portal (no és feed). */
const PLACSP_ATOM_URLS = [
  'https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom'
];
/** Contractes menors (Hacienda). Pot exigir certificat; si falla es registra com a incidència. */
const PLACSP_MENORS_ATOM_URLS = [
  'https://contrataciondelestado.es/sindicacion/sindicacion_1143/licitacionesPerfilesContratanteCompleto3.atom'
];
const PLACSP_MAX_ENTRIES_SCAN = 600;
const PSCP_MAX_PAGES_DEFAULT = 10;

const TED_FIELDS = [
  'ND',
  'PD',
  'TI',
  'buyer-name',
  'notice-type',
  'procedure-type',
  'deadline-receipt-request',
  'deadline-receipt-tender-date-lot',
  'deadline-receipt-request-date-lot',
  'links',
  'classification-cpv',
  'BT-27-Lot-Currency',
  'BT-27-Procedure-Currency',
  'estimated-value-cur-lot',
  'estimated-value-cur-glo'
];

function contractStatusPayload({ code, label, fase = null, ofertes = null }) {
  const normalized = String(code || '').toUpperCase() || null;
  const defaultLabel = normalized ? LICITACIONS_ESTAT_CONTRACTACIO[normalized]?.label : null;
  return {
    estat_contractacio: normalized,
    estat_contractacio_label: label || defaultLabel || null,
    fase_publicacio: fase || null,
    ofertes_rebudes: ofertes != null && !Number.isNaN(Number(ofertes)) ? Number(ofertes) : null
  };
}

function markClosedIfPastDeadline(status, terminiDate) {
  if (!terminiDate) return status;
  const today = new Date().toISOString().slice(0, 10);
  if (terminiDate >= today) return status;
  const code = String(status?.estat_contractacio || '').toUpperCase();
  if (code === 'PRE' || ['EV', 'ADJ', 'RES', 'ANUL', 'DES'].includes(code)) return status;
  return contractStatusPayload({ code: 'EV', label: 'Plazo cerrado' });
}

function extractPlacspDeadline(text) {
  const blob = String(text || '');
  const xmlEnd = blob.match(/EndDate[^>]*>(\d{4}-\d{2}-\d{2})/i)?.[1];
  if (xmlEnd) return parseDateOnly(xmlEnd);

  const patterns = [
    /fecha\s+fin\s+de\s+presentaci[oó]n[^:;]*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
    /fin\s+de\s+presentaci[oó]n\s+de\s+ofertas[^:;]*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
    /fecha\s+fin\s+presentaci[oó]n\s+ofertas[^:;]*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
    /presentaci[oó]n\s+de\s+ofertas[^:;]*:\s*(\d{1,2}[/.-]\d{1,2}[/.-]\d{4})/i,
    /deadline[^:;]*:\s*(\d{4}-\d{2}-\d{2})/i
  ];
  for (const pattern of patterns) {
    const match = String(text || '').match(pattern);
    if (match) return parseDateOnly(match[1]);
  }
  return null;
}

function mapPlacspStatusCode(code) {
  const key = String(code || '').toUpperCase();
  if (!key) return contractStatusPayload({});
  return contractStatusPayload({
    code: key,
    label: LICITACIONS_ESTAT_CONTRACTACIO[key]?.label || key
  });
}

function mapPscpFase(fase, { ofertes } = {}) {
  const f = String(fase || '').toLowerCase();
  if (!f) return contractStatusPayload({});
  if (f.includes('anunci') && (f.includes('licit') || f.includes('prev'))) {
    return contractStatusPayload({ code: f.includes('prev') ? 'PRE' : 'PUB', label: fase, fase, ofertes });
  }
  if (f.includes('avalu') || f.includes('evalu')) {
    return contractStatusPayload({ code: 'EV', label: 'Pendiente de adjudicación', fase, ofertes });
  }
  if (f.includes('adjudic')) {
    return contractStatusPayload({ code: 'ADJ', label: 'Adjudicada', fase, ofertes });
  }
  if (f.includes('formalitz') || f.includes('formaliz') || f.includes('execuc')) {
    return contractStatusPayload({ code: 'RES', label: 'Resuelta', fase, ofertes });
  }
  if (f.includes('anul')) {
    return contractStatusPayload({ code: 'ANUL', label: 'Anulada', fase, ofertes });
  }
  if (f.includes('desert')) {
    return contractStatusPayload({ code: 'DES', label: 'Desierta', fase, ofertes });
  }
  return contractStatusPayload({ code: null, label: fase, fase, ofertes });
}

function mapTedNoticeStatus(notice, deadline) {
  const noticeType = String(
    pickLang(notice?.['notice-type']) || notice?.['notice-type'] || ''
  ).toLowerCase();
  const termini = parseDateOnly(deadline);
  const today = new Date().toISOString().slice(0, 10);

  if (noticeType.includes('can') || noticeType.includes('award') || noticeType.includes('result')) {
    return contractStatusPayload({ code: 'ADJ', label: 'Adjudicada (TED)' });
  }
  if (noticeType.includes('pin') || noticeType.includes('prior')) {
    return contractStatusPayload({ code: 'PRE', label: 'Anuncio previo (TED)' });
  }
  if (noticeType.includes('cn') || noticeType.includes('contract')) {
    if (termini && termini < today) {
      return contractStatusPayload({ code: 'EV', label: 'Plazo cerrado (TED)' });
    }
    return contractStatusPayload({ code: 'PUB', label: 'En plazo (TED)' });
  }
  if (termini) {
    if (termini >= today) return contractStatusPayload({ code: 'PUB', label: 'En plazo (TED)' });
    return contractStatusPayload({ code: 'EV', label: 'Plazo cerrado (TED)' });
  }
  return contractStatusPayload({ code: 'PUB', label: 'Publicada (TED)' });
}

function isDebugEnabled() {
  try {
    if (typeof process !== 'undefined' && process?.env?.LICITACIONS_DEBUG) return true;
  } catch (_) {
    // ignore
  }
  if (typeof window !== 'undefined' && window?.__kronosDev?.licitacionsDebug) return true;
  return false;
}

function logDebug(...args) {
  if (!isDebugEnabled()) return;
  // eslint-disable-next-line no-console
  console.log('[licitacions]', ...args);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetries(fn, { label, retries = 2, baseDelayMs = 600 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const started = Date.now();
    try {
      const res = await fn({ attempt });
      const elapsed = Date.now() - started;
      logDebug(`${label} ok`, { attempt: attempt + 1, elapsed_ms: elapsed });
      return res;
    } catch (e) {
      lastErr = e;
      const elapsed = Date.now() - started;
      logDebug(`${label} fail`, {
        attempt: attempt + 1,
        elapsed_ms: elapsed,
        message: e?.message || String(e)
      });
      if (attempt >= retries) break;
      const delay = baseDelayMs * (attempt + 1);
      await sleep(delay);
    }
  }
  throw lastErr;
}

function normalizeText(text) {
  const s = String(text || '').trim();
  if (!s) return '';
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function pickLang(value, preferred = ['spa', 'cat', 'eng']) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value).trim();
  if (Array.isArray(value)) {
    for (const item of value) {
      const s = pickLang(item, preferred);
      if (s) return s;
    }
    return '';
  }
  if (typeof value === 'object') {
    for (const key of preferred) {
      if (value[key] != null) {
        const s = pickLang(value[key], preferred);
        if (s) return s;
      }
    }
    const first = Object.values(value).find((v) => v != null);
    return first != null ? pickLang(first, preferred) : '';
  }
  return '';
}

function parseDateOnly(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})/);
  if (dmy) {
    const dd = dmy[1].padStart(2, '0');
    const mm = dmy[2].padStart(2, '0');
    return `${dmy[3]}-${mm}-${dd}`;
  }
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return null;
}

export function inferSector(cpvCodes, config = LICITACIONS_CONFIG_FALLBACK) {
  const { area } = classifyCpv(cpvCodes, config);
  if (area === 'Catering') return 'Catering';
  if (area === 'Tech') return 'Tecnologia';
  return 'Altres';
}

function firstField(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const key of keys) {
    const v = obj[key];
    if (v != null && String(v).trim() !== '') return v;
  }
  return '';
}

/** PSCP pot portar "55520000-1||55521200-0" o llistes. */
function splitCpvField(raw) {
  if (raw == null || raw === '') return [];
  if (Array.isArray(raw)) return raw.flatMap((v) => splitCpvField(v));
  const matches = String(raw).match(/\d{8}/g);
  return matches ? [...new Set(matches)] : [];
}

function buildExternalId(source, rawId) {
  const id = String(rawId || '').trim();
  if (!id) return '';
  return `${source}:${id}`;
}

function syncPayloadFromNormalized(row) {
  return {
    source: row.source,
    external_id: row.external_id,
    title: row.title,
    organismo: row.organismo || null,
    sector: row.sector || 'Altres',
    area: row.area || null,
    reservada: Boolean(row.reservada),
    contracte_menor: Boolean(row.contracte_menor),
    cpv_codes: row.cpv_codes?.length ? row.cpv_codes : [],
    import_estimat: row.import_estimat ?? null,
    termini_oferta: row.termini_oferta || null,
    duracio: row.duracio || null,
    url: row.url || null,
    requisits: row.requisits || null,
    criteris: row.criteris || null,
    estat_contractacio: row.estat_contractacio || null,
    estat_contractacio_label: row.estat_contractacio_label || null,
    fase_publicacio: row.fase_publicacio || null,
    ofertes_rebudes: row.ofertes_rebudes ?? null,
    last_seen_at: new Date().toISOString()
  };
}

function normalizeBase({
  source,
  externalId,
  title,
  organismo,
  cpvCodes,
  importEstimat,
  termini,
  url,
  summary = '',
  extra = {},
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null,
  contracteMenor = false
}) {
  const ext = buildExternalId(source, externalId);
  const cpv = Array.isArray(cpvCodes)
    ? [...new Set(cpvCodes.map((c) => String(c).replace(/\D/g, '').slice(0, 8)).filter(Boolean))]
    : [];
  if (!ext || !title) return null;

  const verdict = evaluateLicitacio(
    { cpvCodes: cpv, title, summary, importEstimat },
    config
  );
  if (!verdict.keep) {
    bumpExclos(stats, verdict.motiu);
    return null;
  }

  return {
    source,
    external_id: ext,
    title: String(title).trim().slice(0, 2000),
    organismo: organismo ? String(organismo).trim().slice(0, 500) : null,
    sector: verdict.area === 'Tech' ? 'Tecnologia' : (verdict.area || 'Altres'),
    area: verdict.area,
    reservada: Boolean(verdict.reservada),
    contracte_menor: Boolean(contracteMenor || extra.contracte_menor),
    cpv_codes: cpv,
    import_estimat: importEstimat != null && !Number.isNaN(Number(importEstimat)) ? Number(importEstimat) : null,
    termini_oferta: parseDateOnly(termini),
    duracio: extra.duracio || null,
    url: url ? String(url).trim() : null,
    requisits: extra.requisits || null,
    criteris: extra.criteris || null,
    estat_contractacio: extra.estat_contractacio || null,
    estat_contractacio_label: extra.estat_contractacio_label || null,
    fase_publicacio: extra.fase_publicacio || null,
    ofertes_rebudes: extra.ofertes_rebudes ?? null
  };
}

function normalizeTEDNotice(notice, config = LICITACIONS_CONFIG_FALLBACK, stats = null) {
  const externalId = notice?.ND || notice?.['publication-number'];
  const title = pickLang(notice?.TI);
  const organismo = pickLang(notice?.['buyer-name']);
  const cpv = notice?.['classification-cpv'] || [];
  const deadline =
    notice?.['deadline-receipt-request']?.[0] ||
    notice?.['deadline-receipt-tender-date-lot']?.[0] ||
    notice?.['deadline-receipt-request-date-lot']?.[0];
  const amount =
    notice?.['estimated-value-cur-lot'] ||
    notice?.['estimated-value-cur-glo'] ||
    notice?.['BT-27-Lot-Currency'] ||
    notice?.['BT-27-Procedure-Currency'];
  const importRaw = Array.isArray(amount) ? amount[0] : amount;
  const importNum =
    typeof importRaw === 'object' && importRaw != null
      ? importRaw.value ?? importRaw['#text']
      : importRaw;
  const links = notice?.links || {};
  const url =
    links?.html?.SPA ||
    links?.html?.ENG ||
    links?.pdf?.SPA ||
    (notice?.ND ? `https://ted.europa.eu/es/notice/-/detail/${notice.ND}` : '');

  const status = mapTedNoticeStatus(notice, deadline);

  return normalizeBase({
    source: 'TED',
    externalId,
    title,
    organismo,
    cpvCodes: cpv,
    importEstimat: importNum,
    termini: deadline,
    url,
    extra: status,
    config,
    stats
  });
}

function normalizePSCPRecord(record, config = LICITACIONS_CONFIG_FALLBACK, stats = null) {
  const fields = record?.record?.fields || record?.fields || record || {};
  const enllac = fields.enllac_publicacio;
  const urlFromEnllac = typeof enllac === 'string' ? enllac : enllac?.url || '';
  const externalId =
    firstField(fields, ['id_intern', 'id', 'id_expedient', 'expedient', 'codi_expedient', 'recordid']) ||
    (fields.codi_dir3 && fields.codi_expedient
      ? `${fields.codi_dir3}-${fields.codi_expedient}${fields.numero_lot ? `-L${fields.numero_lot}` : ''}`
      : '') ||
    urlFromEnllac ||
    record?.record?.id;
  const title = firstField(fields, [
    'denominacio',
    'denominacion',
    'objecte_contracte',
    'objecte',
    'objeto',
    'titol',
    'titulo',
    'descripcio'
  ]);
  const objecte = firstField(fields, ['objecte_contracte', 'objecte', 'objeto', 'descripcio']);
  const organismo = firstField(fields, [
    'nom_organ',
    'organisme',
    'organismo',
    'organisme_contractor',
    'contracting_authority'
  ]);
  const cpvRaw = firstField(fields, ['cpv', 'cpv_principal', 'codi_cpv', 'cpv_code']) || fields.cpv;
  const cpv = splitCpvField(cpvRaw);
  const termini = firstField(fields, [
    'termini_presentacio_ofertes',
    'data_limit_presentacio',
    'data_fi_presentacio_ofertes',
    'termini_presentacio',
    'deadline'
  ]);
  const terminiParsed = parseDateOnly(termini);
  const url = firstField(fields, ['url', 'enllac', 'link', 'url_expedient']) || urlFromEnllac;
  const importEstimat = firstField(fields, [
    'valor_estimat_contracte',
    'valor_estimat_expedient',
    'pressupost_licitacio_sense',
    'pressupost_licitacio_amb',
    'import_adjudicacio_sense',
    'import_adjudicacio_amb_iva',
    'pressupost',
    'import',
    'valor_estimat',
    'estimated_value'
  ]);

  const fase = fields.fase_publicacio || null;
  const ofertes = fields.ofertes_rebudes ?? fields.ofertes_rebudes_oferta ?? null;
  let status = mapPscpFase(fase, { ofertes });
  status = markClosedIfPastDeadline(status, terminiParsed);
  const procediment = String(fields.procediment || '');
  const isMenor = /menor/i.test(procediment);

  return normalizeBase({
    source: 'PSCP',
    externalId,
    title,
    organismo,
    cpvCodes: cpv,
    importEstimat,
    termini: terminiParsed || termini,
    url,
    summary: objecte || title,
    extra: { duracio: fields.durada_contracte || null, ...status },
    config,
    stats,
    contracteMenor: isMenor
  });
}

function parseXmlAmount(raw) {
  if (raw == null || raw === '') return null;
  const n = Number(String(raw).replace(/\s/g, '').replace(/\./g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

function extractPlacspImport(blob) {
  const text = String(blob || '');
  const overall = text.match(/EstimatedOverallContractAmount[^>]*>([^<]+)</i)?.[1];
  const taxEx = text.match(/TaxExclusiveAmount[^>]*>([^<]+)</i)?.[1];
  const fromXml = parseXmlAmount(overall) ?? parseXmlAmount(taxEx);
  if (fromXml != null) return fromXml;
  const importRaw = text.match(/Importe:\s*([\d.,]+)\s*EUR/i)?.[1];
  return parseXmlAmount(importRaw);
}

function parsePlacspSummary(summary) {
  const text = String(summary || '');
  const organismo =
    text.match(/[ÓO]rgano de Contrataci[oó]n:\s*([^;]+)/i)?.[1]?.trim() ||
    text.match(/[ÓO]rgan de Contractaci[oó]:\s*([^;]+)/i)?.[1]?.trim() ||
    null;
  const estadoCode = text.match(/Estado:\s*([A-Z]+)/i)?.[1]?.toUpperCase() || '';
  return {
    organismo,
    importEstimat: extractPlacspImport(text),
    estadoCode
  };
}

function extractAtomNextHref(xmlText) {
  const text = String(xmlText || '');
  const patterns = [
    /<link[^>]+rel=["']next["'][^>]*href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]*rel=["']next["']/i
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim();
  }
  return null;
}

function extractPlacspStatusFromBlob(blob) {
  const text = String(blob || '');
  const fromSummary = text.match(/Estado:\s*([A-Z]+)/i)?.[1];
  const fromXml = text.match(/ContractFolderStatusCode[^>]*>([A-Z]+)</i)?.[1];
  return (fromSummary || fromXml || '').toUpperCase();
}

function extractMetaRefreshUrl(html) {
  const text = String(html || '');
  const match = text.match(/content=["']?\d+\s*;\s*url=([^"'>]+)/i);
  return match ? match[1].trim() : null;
}

function stripXmlCdata(text) {
  return String(text || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').trim();
}

function parseAtomEntriesRegex(xmlText, { maxEntries = PLACSP_MAX_ENTRIES_SCAN } = {}) {
  const entries = [];
  const entryRegex = /<entry\b[^>]*>([\s\S]*?)<\/entry>/gi;
  let match;
  while ((match = entryRegex.exec(xmlText)) && entries.length < maxEntries) {
    const inner = match[1];
    const textOf = (tag) => {
      const m = inner.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i'));
      return m ? stripXmlCdata(m[1]) : '';
    };
    let link = '';
    const linkMatch = inner.match(/<link[^>]+href=["']([^"']+)["']/i);
    if (linkMatch) link = linkMatch[1];
    entries.push({
      id: textOf('id'),
      title: textOf('title'),
      link,
      updated: textOf('updated'),
      summary: textOf('summary') || textOf('content'),
      blob: inner
    });
  }
  return entries;
}

/** Parseja feed ATOM només amb regex (compatible Deno / Edge / main). */
function parseAtomEntries(xmlText, options = {}) {
  return parseAtomEntriesRegex(xmlText, options);
}

/** Extreu tots els CPV de 8 dígits (CODICE / text). */
function extractCpvCodesFromText(text) {
  const found = [];
  const re = /ItemClassificationCode[^>]*>(\d{8})<|\b(\d{8})(?:-\d)?\b/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    found.push(m[1] || m[2]);
  }
  return [...new Set(found.map((c) => String(c).replace(/\D/g, '').slice(0, 8)).filter(Boolean))];
}

function normalizePLACSPEntry(
  entry,
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null,
  { contracteMenor = false } = {}
) {
  const id = entry?.id || '';
  const title = entry?.title || '';
  const link = entry?.link || '';
  const summary = entry?.summary || '';
  const blob = `${title} ${summary} ${entry?.blob || ''}`;
  const cpvFound = extractCpvCodesFromText(blob);
  if (!cpvFound.length) {
    bumpExclos(stats, 'cpv');
    return null;
  }
  const parsedSummary = parsePlacspSummary(summary);
  const importEstimat = extractPlacspImport(blob) ?? parsedSummary.importEstimat;
  const statusCode = parsedSummary.estadoCode || extractPlacspStatusFromBlob(entry?.blob || blob);
  const deadline = extractPlacspDeadline(`${summary}\n${entry?.blob || ''}`);
  let status = mapPlacspStatusCode(statusCode);
  status = markClosedIfPastDeadline(status, deadline);

  return normalizeBase({
    source: 'PLACSP',
    externalId: id,
    title: title || 'Licitación PLACSP',
    organismo: parsedSummary.organismo,
    cpvCodes: cpvFound,
    importEstimat,
    termini: deadline,
    url: typeof link === 'string' ? link : pickLang(link),
    summary,
    extra: status,
    config,
    stats,
    contracteMenor
  });
}

function buildTedQuery(config = LICITACIONS_CONFIG_FALLBACK) {
  const cpvPart = cpvQueryList(config).map((c) => `PC=${c}`).join(' OR ');
  return `CY=ESP AND (${cpvPart}) AND PD>=20240101`;
}

function buildPscpWhereLegacy(config = LICITACIONS_CONFIG_FALLBACK) {
  return cpvQueryList(config).map((c) => `cpv='${c}' OR cpv_principal='${c}' OR codi_cpv='${c}'`).join(' OR ');
}

/** Prefixos jeràrquics via starts_with (verificat a Socrata ybgg-dgi6). */
function buildPscpCatalunyaCpvClause(config = LICITACIONS_CONFIG_FALLBACK) {
  const prefixes = [
    ...new Set(cpvQueryList(config).map((c) => cpvPrefix(c)).filter((p) => p && p.length >= 2))
  ];
  if (!prefixes.length) return '1=0';
  return prefixes.map((p) => `starts_with(codi_cpv, '${p}')`).join(' OR ');
}

/** Solo plazo abierto o anuncio previo (evita histórico adjudicado de PSCP). */
function buildPscpCatalunyaWhereVigents(config = LICITACIONS_CONFIG_FALLBACK) {
  const today = new Date().toISOString().slice(0, 10);
  const cpv = buildPscpCatalunyaCpvClause(config);
  return `(${cpv}) AND (termini_presentacio_ofertes >= '${today}' OR lower(fase_publicacio) like '%anunci previ%')`;
}

function buildPscpCatalunyaPageUrl(limit, offset, config = LICITACIONS_CONFIG_FALLBACK, orderBy) {
  const where = encodeURIComponent(buildPscpCatalunyaWhereVigents(config));
  const order = encodeURIComponent(orderBy);
  return `${PSCP_CATALUNYA_URL}?$where=${where}&$order=${order}&$limit=${limit}&$offset=${offset}`;
}

async function resolvePlacspCutoffIso() {
  try {
    const { data, error } = await getSupabase()
      .from('licitacions_sync_log')
      .select('finished_at')
      .eq('ok', true)
      .not('finished_at', 'is', null)
      .order('finished_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!error && data?.finished_at) {
      const d = new Date(data.finished_at);
      d.setDate(d.getDate() - 1);
      return d.toISOString();
    }
  } catch (_) {
    // taula encara no disponible o sense sessió
  }
  const d = new Date();
  d.setDate(d.getDate() - 14);
  return d.toISOString();
}

/** HTTP: override (Electron main) o fetch global (Deno / Node). */
async function httpRequest(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (httpClientOverride) {
    return httpClientOverride({
      url,
      method: options.method || 'GET',
      headers,
      body: options.body ?? null
    });
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  return {
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    headers: Object.fromEntries([...(res.headers || [])]),
    text
  };
}

async function fetchJson(url, options = {}) {
  return withRetries(
    async () => {
      const res = await httpRequest(url, {
        ...options,
        headers: { Accept: 'application/json', ...(options.headers || {}) }
      });
      const text = res.text || '';
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        data = { _raw: text.slice(0, 300) };
      }

      logDebug('HTTP', {
        url,
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers?.['content-type'],
        contentEncoding: res.headers?.['content-encoding'],
        preview: String(text || '').slice(0, 140).replace(/\s+/g, ' ')
      });

      if (!res.ok) {
        const msg = data?.message || data?.error || res.statusText || `HTTP ${res.status}`;
        throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
      }
      return data;
    },
    { label: 'fetchJson', retries: 2, baseDelayMs: 700 }
  );
}

/** TED — varias páginas si la primera llega al límite (máx. 100 por página en la API). */
export async function fetchTEDAll({
  maxPages = 3,
  limit = 100,
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null
} = {}) {
  const merged = new Map();
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchTED({ page, limit, config, stats });
    if (!batch.length) break;
    for (const row of batch) {
      if (row?.external_id) merged.set(row.external_id, row);
    }
    if (batch.length < limit) break;
  }
  return [...merged.values()];
}

/** TED — POST api.ted.europa.eu/v3/notices/search */
export async function fetchTED({
  page = 1,
  limit = 100,
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null
} = {}) {
  const body = {
    query: buildTedQuery(config),
    page,
    limit,
    fields: TED_FIELDS
  };
  const data = await fetchJson(TED_SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const notices = Array.isArray(data?.notices) ? data.notices : [];
  if (stats?.llegits) stats.llegits.ted += notices.length;
  return notices.map((n) => normalizeTEDNotice(n, config, stats)).filter(Boolean);
}

/** PSCP — Transparencia Catalunya (Socrata) amb prefixos + paginació $offset. */
export async function fetchPSCP({
  limit = 100,
  maxPages = PSCP_MAX_PAGES_DEFAULT,
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null
} = {}) {
  const pageSize = Math.min(Math.max(Number(limit) || 100, 1), 200);
  const orderCandidates = ['termini_presentacio_ofertes ASC', 'data_publicacio_anunci DESC'];
  const merged = new Map();
  let lastErr;
  let usedOrder = null;
  let pagesOk = 0;

  for (const orderBy of orderCandidates) {
    try {
      await fetchJson(buildPscpCatalunyaPageUrl(1, 0, config, orderBy));
      usedOrder = orderBy;
      break;
    } catch (e) {
      lastErr = e;
      logDebug('PSCP order probe failed', { orderBy, message: e?.message || String(e) });
    }
  }

  if (usedOrder) {
    for (let page = 0; page < maxPages; page += 1) {
      const offset = page * pageSize;
      const url = buildPscpCatalunyaPageUrl(pageSize, offset, config, usedOrder);
      try {
        const data = await fetchJson(url);
        const results = Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data)
            ? data
            : [];
        pagesOk += 1;
        if (stats?.llegits) stats.llegits.pscp += results.length;
        const normalized = results
          .map((r) => normalizePSCPRecord(r, config, stats))
          .filter(Boolean);
        logDebug('PSCP page', {
          page: page + 1,
          offset,
          raw: results.length,
          normalized: normalized.length
        });
        for (const row of normalized) {
          if (row?.external_id) merged.set(row.external_id, row);
        }
        if (results.length < pageSize) break;
      } catch (e) {
        lastErr = e;
        logDebug('PSCP page failed', { url, message: e?.message || String(e) });
        break;
      }
    }
  }

  const legacyEnabled = (() => {
    try {
      return Boolean(process?.env?.LICITACIONS_PSCP_LEGACY);
    } catch (_) {
      return false;
    }
  })();
  if (!merged.size && legacyEnabled) {
    const where = encodeURIComponent(buildPscpWhereLegacy(config));
    const legacyUrl = `${PSCP_RECORDS_URL_LEGACY}?where=${where}&limit=${pageSize}&order_by=publication_date DESC`;
    try {
      const data = await fetchJson(legacyUrl);
      const results = Array.isArray(data?.results) ? data.results : [];
      if (stats?.llegits) stats.llegits.pscp += results.length;
      for (const row of results.map((r) => normalizePSCPRecord(r, config, stats)).filter(Boolean)) {
        if (row?.external_id) merged.set(row.external_id, row);
      }
    } catch (e) {
      lastErr = e;
    }
  }

  if (merged.size || pagesOk > 0) return [...merged.values()];
  if (lastErr?.message?.includes?.('Host no permès per a licitacions: analisi.transparenciacatalunya.cat')) {
    throw new Error(
      "PSCP: el proceso main está bloqueando 'analisi.transparenciacatalunya.cat'. Reinicia la app (cerrar Electron por completo y volver a ejecutar npm start) para que se apliquen los cambios en src/main.js."
    );
  }
  throw lastErr || new Error('PSCP: no se pudo obtener resultados con los filtros CPV actuales');
}

async function fetchPlacspAtomPage(atomUrl) {
  const res = await httpRequest(atomUrl, {
    headers: {
      Accept: 'application/atom+xml, application/xml, text/xml, */*'
    }
  });
  const text = res.text || '';
  const preview = String(text || '').slice(0, 220).replace(/\s+/g, ' ');

  logDebug('PLACSP response', {
    url: atomUrl,
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers?.['content-type'],
    startsWith: String(text || '').trim().slice(0, 20),
    preview
  });

  const trimmed = String(text || '').trim();
  const looksHtml = /^<!DOCTYPE html/i.test(trimmed) || /^<html/i.test(trimmed);

  if (!res.ok) {
    throw new Error(`PLACSP HTTP ${res.status} ${res.statusText || ''}`.trim());
  }

  // El feed Completo3 és gran (~4MB). Un HTML de redirecció sol ser <1KB.
  if (looksHtml || (trimmed.length < 800 && !trimmed.includes('<entry'))) {
    const refreshUrl = extractMetaRefreshUrl(text);
    if (refreshUrl) {
      throw new Error(
        `PLACSP devolvió HTML/redirección (posible certificat). Meta-refresh → ${refreshUrl}. Preview: ${preview}`
      );
    }
    if (looksHtml || /certificat|certificate|acceso|accedir/i.test(trimmed)) {
      throw new Error(`PLACSP requiere certificado o devolvió HTML. Preview: ${preview}`);
    }
  }

  const entries = parseAtomEntries(text);
  const nextHref = extractAtomNextHref(text);
  return { entries, nextHref, rawLength: trimmed.length };
}

/**
 * Segueix rel=next fins al tall temporal o placsp_max_pages.
 * @returns {{ rows: object[], pages: number, hitPageCap: boolean, hitCutoff: boolean }}
 */
async function fetchPlacspFeedPaginated(
  startUrls,
  {
    config = LICITACIONS_CONFIG_FALLBACK,
    stats = null,
    contracteMenor = false,
    cutoffIso = null,
    llegitsKey = 'placsp'
  } = {}
) {
  const maxPages = Number(config.placsp_max_pages) || LICITACIONS_CONFIG_FALLBACK.placsp_max_pages;
  const cutoffMs = cutoffIso ? Date.parse(cutoffIso) : NaN;
  const merged = new Map();
  let lastErr;
  let pages = 0;
  let hitPageCap = false;
  let hitCutoff = false;

  for (const startUrl of startUrls) {
    let url = startUrl;
    let feedPages = 0;
    try {
      while (url && feedPages < maxPages) {
        // Sense reintents llargs: si penja, el timeout HTTP ja falla (~25s).
        const page = await withRetries(
          async () => fetchPlacspAtomPage(url),
          { label: 'fetchPLACSP', retries: 0, baseDelayMs: 400 }
        );
        feedPages += 1;
        pages += 1;
        if (stats?.llegits) {
          stats.llegits[llegitsKey] = (stats.llegits[llegitsKey] || 0) + page.entries.length;
        }

        for (const entry of page.entries) {
          const updatedMs = entry.updated ? Date.parse(entry.updated) : NaN;
          if (Number.isFinite(cutoffMs) && Number.isFinite(updatedMs) && updatedMs < cutoffMs) {
            hitCutoff = true;
            break;
          }
          const row = normalizePLACSPEntry(entry, config, stats, { contracteMenor });
          if (row?.external_id) merged.set(row.external_id, row);
        }

        if (hitCutoff) break;
        if (!page.nextHref) break;
        if (feedPages >= maxPages) {
          hitPageCap = true;
          break;
        }
        url = page.nextHref;
      }
      if (merged.size || hitCutoff) break;
    } catch (e) {
      lastErr = e;
      logDebug('PLACSP feed failed', { url: startUrl, message: e?.message || String(e) });
    }
  }

  if (!merged.size && lastErr && !hitCutoff) throw lastErr;
  return { rows: [...merged.values()], pages, hitPageCap, hitCutoff };
}

/** PLACSP — feed ATOM amb paginació rel=next. */
export async function fetchPLACSP({
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null,
  cutoffIso = null
} = {}) {
  const result = await fetchPlacspFeedPaginated(PLACSP_ATOM_URLS, {
    config,
    stats,
    contracteMenor: false,
    cutoffIso,
    llegitsKey: 'placsp'
  });
  if (result.hitPageCap && !result.hitCutoff && stats?.incidencies) {
    stats.incidencies.push(
      `PLACSP: assolit placsp_max_pages=${config.placsp_max_pages} sense arribar al tall temporal`
    );
  }
  return result.rows;
}

/** PLACSP contractes menors (sindicacion_1143). Pot exigir certificat. */
export async function fetchPLACSPMenors({
  config = LICITACIONS_CONFIG_FALLBACK,
  stats = null,
  cutoffIso = null
} = {}) {
  try {
    const result = await fetchPlacspFeedPaginated(PLACSP_MENORS_ATOM_URLS, {
      config,
      stats,
      contracteMenor: true,
      cutoffIso,
      llegitsKey: 'placsp_menors'
    });
    if (result.hitPageCap && !result.hitCutoff && stats?.incidencies) {
      stats.incidencies.push(
        `PLACSP menors: assolit placsp_max_pages=${config.placsp_max_pages} sense arribar al tall temporal`
      );
    }
    return result.rows;
  } catch (e) {
    const msg = e?.message || String(e);
    if (stats?.incidencies) stats.incidencies.push(`PLACSP menors: ${msg}`);
    logDebug('PLACSP menors skipped', { message: msg });
    return [];
  }
}

function dedupeByExternalId(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row?.external_id) map.set(row.external_id, row);
  }
  return [...map.values()];
}

function bumpNovesArea(map, area) {
  const key = area === 'Catering' || area === 'Tech' ? area : 'Altres';
  map[key] = (map[key] || 0) + 1;
}

async function upsertLicitacions(records) {
  const rows = dedupeByExternalId(records);
  const novesPerArea = { Catering: 0, Tech: 0, Altres: 0 };
  const novesReservades = [];
  if (!rows.length) {
    return {
      inserted: 0,
      updated: 0,
      total: 0,
      noves_per_area: novesPerArea,
      noves_reservades: novesReservades,
      desarxivades: 0
    };
  }

  const externalIds = rows.map((r) => r.external_id);
  const { data: existing, error: readErr } = await getSupabase()
    .from(TABLE)
    .select('external_id, arxivada')
    .in('external_id', externalIds);
  if (readErr) throw readErr;

  const existingById = new Map((existing || []).map((r) => [r.external_id, r]));
  const toInsert = rows.filter((r) => !existingById.has(r.external_id));
  const toUpdate = rows.filter((r) => existingById.has(r.external_id));

  if (toInsert.length) {
    const { error: insErr } = await getSupabase().from(TABLE).insert(
      toInsert.map((r) => ({
        ...syncPayloadFromNormalized(r),
        estat_circuit: 'Detectada'
      }))
    );
    if (insErr) throw insErr;
    for (const row of toInsert) {
      bumpNovesArea(novesPerArea, row.area);
      if (row.reservada) {
        novesReservades.push({
          title: row.title,
          area: row.area,
          termini_oferta: row.termini_oferta,
          url: row.url,
          external_id: row.external_id
        });
      }
    }
  }

  let desarxivades = 0;
  for (const row of toUpdate) {
    const prev = existingById.get(row.external_id);
    const payload = {
      ...syncPayloadFromNormalized(row),
      arxivada: false,
      arxivada_at: null
    };
    if (prev?.arxivada) desarxivades += 1;
    const { error: updErr } = await getSupabase()
      .from(TABLE)
      .update(payload)
      .eq('external_id', row.external_id);
    if (updErr) throw updErr;
  }

  return {
    inserted: toInsert.length,
    updated: toUpdate.length,
    total: rows.length,
    noves_per_area: novesPerArea,
    noves_reservades: novesReservades,
    desarxivades
  };
}

/** Arxiva caducades/tancades. Mai esborra files de licitacions. */
export async function archiveCaducadasLicitacions() {
  const db = getSupabase();
  const { data, error } = await db
    .from(TABLE)
    .select('id, source, estat_contractacio, termini_oferta, arxivada')
    .eq('arxivada', false);
  if (error) throw error;

  const toArchive = (data || []).filter(shouldArchiveLicitacio).map((r) => r.id);
  if (!toArchive.length) return { arxivades: 0 };

  const nowIso = new Date().toISOString();
  let arxivades = 0;
  for (let i = 0; i < toArchive.length; i += 100) {
    const batch = toArchive.slice(i, i + 100);
    const { error: updErr } = await db
      .from(TABLE)
      .update({ arxivada: true, arxivada_at: nowIso })
      .in('id', batch);
    if (updErr) throw updErr;
    arxivades += batch.length;
  }
  return { arxivades };
}

/** @deprecated Preferir archiveCaducadasLicitacions (T4). */
export async function purgeCaducadasLicitacions() {
  const result = await archiveCaducadasLicitacions();
  return { deleted: 0, arxivades: result.arxivades };
}

async function openSyncLog(origen) {
  try {
    const { data, error } = await getSupabase()
      .from('licitacions_sync_log')
      .insert({ origen })
      .select('id')
      .single();
    if (error) {
      console.warn('[licitacions] sync_log open:', error.message || error);
      return null;
    }
    return data?.id || null;
  } catch (e) {
    console.warn('[licitacions] sync_log open:', e?.message || e);
    return null;
  }
}

async function closeSyncLog(id, payload) {
  if (!id) return;
  try {
    const { error } = await getSupabase()
      .from('licitacions_sync_log')
      .update({
        finished_at: new Date().toISOString(),
        ok: Boolean(payload.ok),
        llegits: payload.llegits || {},
        exclosos: payload.exclosos || {},
        noves_per_area: payload.noves_per_area || {},
        inserides: payload.inserides || 0,
        actualitzades: payload.actualitzades || 0,
        arxivades: payload.arxivades || 0,
        errors: payload.errors || null
      })
      .eq('id', id);
    if (error) console.warn('[licitacions] sync_log close:', error.message || error);
  } catch (e) {
    console.warn('[licitacions] sync_log close:', e?.message || e);
  }
}

/**
 * Obté licitacions de les fonts actives, desa sense esborrar circuit/notes,
 * arxiva caducades i registra el resultat a licitacions_sync_log.
 */
export async function runLicitacionsSync(options = {}) {
  return fetchAll(options);
}

export async function fetchAll(options = {}) {
  const {
    limit = 100,
    tedMaxPages = 3,
    pscpMaxPages = PSCP_MAX_PAGES_DEFAULT
  } = options;
  const doArchive =
    options.archiveCaducadas !== false && options.purgeCaducadas !== false;
  const origen = ['manual', 'cron_app', 'edge'].includes(options.origen)
    ? options.origen
    : 'manual';

  const syncLogId = await openSyncLog(origen);
  const errors = {};
  const stats = emptyFilterStats();
  const onProgress = typeof options.onProgress === 'function' ? options.onProgress : null;
  const report = (pct, label, extra = {}) => {
    if (!onProgress) return;
    try {
      onProgress({ pct, label, ...extra });
    } catch (_) {
      // ignore UI errors
    }
  };

  try {
    report(4, 'Carregant configuració…');
    const loaded = await loadLicitacionsConfig(getSupabase());
    const fromFallback = loaded.fromFallback;
    const configError = loaded.error;
    // Cap dur: el seed SQL posava 60 pàgines i el sync es podia eternitzar.
    const config = {
      ...loaded.config,
      placsp_max_pages: Math.min(
        Math.max(1, Number(loaded.config?.placsp_max_pages) || 12),
        15
      ),
      fonts_actives: {
        ...(loaded.config?.fonts_actives || LICITACIONS_CONFIG_FALLBACK.fonts_actives),
        // Menors (1143) penja sovint sense certificat; el sync manual no ha de bloquejar-s'hi.
        PLACSP_MENORS: false
      }
    };
    if (fromFallback && configError && stats.incidencies) {
      stats.incidencies.push(`Config: fallback (${configError.message || configError})`);
    }
    if (Number(loaded.config?.placsp_max_pages) > 15) {
      stats.incidencies.push(
        `PLACSP: placsp_max_pages limitat a 15 (config tenia ${loaded.config.placsp_max_pages})`
      );
    }

    const fonts = config.fonts_actives || LICITACIONS_CONFIG_FALLBACK.fonts_actives;
    const cutoffIso = await resolvePlacspCutoffIso();
    const fetched = { ted: 0, pscp: 0, placsp: 0, placsp_menors: 0, tedPages: 0 };

    const tasks = [];
    if (fonts.TED) {
      tasks.push(['ted', () => fetchTEDAll({ maxPages: tedMaxPages, limit, config, stats })]);
    }
    if (fonts.PSCP !== false) {
      tasks.push(['pscp', () => fetchPSCP({ limit, maxPages: pscpMaxPages, config, stats })]);
    }
    if (fonts.PLACSP !== false) {
      tasks.push(['placsp', () => fetchPLACSP({ config, stats, cutoffIso })]);
    }
    if (fonts.PLACSP_MENORS !== false) {
      tasks.push(['placsp_menors', () => fetchPLACSPMenors({ config, stats, cutoffIso })]);
    }

    const sourceLabels = {
      ted: 'TED',
      pscp: 'PSCP (Catalunya)',
      placsp: 'PLACSP (Estat)',
      placsp_menors: 'PLACSP menors'
    };
    report(
      10,
      tasks.length
        ? `Llegint fonts: ${tasks.map(([k]) => sourceLabels[k] || k).join(' · ')}…`
        : 'Sense fonts actives'
    );

    let sourcesDone = 0;
    const settled = await Promise.all(
      tasks.map(async ([key, fn]) => {
        try {
          const value = await fn();
          sourcesDone += 1;
          const pct = 10 + Math.round((sourcesDone / Math.max(tasks.length, 1)) * 65);
          report(pct, `${sourceLabels[key] || key}: ${value.length} oportunitats després del filtre`);
          return { key, status: 'fulfilled', value };
        } catch (reason) {
          sourcesDone += 1;
          const pct = 10 + Math.round((sourcesDone / Math.max(tasks.length, 1)) * 65);
          report(pct, `${sourceLabels[key] || key}: error (es continua amb la resta)`);
          return { key, status: 'rejected', reason };
        }
      })
    );

    const all = [];
    settled.forEach((res) => {
      const key = res.key;
      if (res.status === 'fulfilled') {
        fetched[key] = res.value.length;
        all.push(...res.value);
      } else {
        errors[key] = res.reason?.message || String(res.reason);
        console.warn(`[licitacions] ${key}:`, errors[key]);
      }
    });

    report(80, `Desant a Supabase (${all.length} registres)…`);
    const sync = await upsertLicitacions(all);

    let archive = { arxivades: 0 };
    if (doArchive) {
      try {
        report(90, 'Arxivant caducades…');
        archive = await archiveCaducadasLicitacions();
      } catch (e) {
        errors.archive = e?.message || String(e);
        console.warn('[licitacions] Archive:', errors.archive);
      }
    }
    report(97, 'Tancant registre de sync…');

    if (fonts.TED && fetched.ted >= limit) fetched.tedPages = tedMaxPages;
    else if (fonts.TED) fetched.tedPages = fetched.ted ? 1 : 0;

    if (stats.incidencies.length) {
      errors.incidencies = stats.incidencies;
    }

    const hasErrors = Object.keys(errors).length > 0;
    const allFontsFailed =
      tasks.length > 0 && settled.every((r) => r.status === 'rejected');
    const result = {
      ...sync,
      fetched,
      llegits: stats.llegits,
      exclosos: stats.exclosos,
      noves_per_area: sync.noves_per_area,
      noves_reservades: sync.noves_reservades || [],
      incidencies: stats.incidencies,
      config_from_fallback: fromFallback,
      arxivades: archive.arxivades || 0,
      purge: { deleted: 0, arxivades: archive.arxivades || 0 },
      errors: hasErrors ? errors : null
    };

    await closeSyncLog(syncLogId, {
      ok: !allFontsFailed,
      llegits: stats.llegits,
      exclosos: stats.exclosos,
      noves_per_area: sync.noves_per_area,
      inserides: sync.inserted,
      actualitzades: sync.updated,
      arxivades: archive.arxivades || 0,
      errors: hasErrors ? errors : null
    });

    report(100, 'Sync completat');
    return result;
  } catch (e) {
    await closeSyncLog(syncLogId, {
      ok: false,
      llegits: stats.llegits,
      exclosos: stats.exclosos,
      noves_per_area: { Catering: 0, Tech: 0, Altres: 0 },
      inserides: 0,
      actualitzades: 0,
      arxivades: 0,
      errors: { fatal: e?.message || String(e), ...errors }
    });
    throw e;
  }
}

export async function loadLicitacions(filters = {}) {
  let q = getSupabase()
    .from(TABLE)
    .select('*')
    .order('reservada', { ascending: false })
    .order('detected_at', { ascending: false, nullsFirst: false })
    .order('termini_oferta', { ascending: true, nullsFirst: false });
  if (filters.source) q = q.eq('source', filters.source);
  if (filters.sector) q = q.eq('sector', filters.sector);
  if (filters.area) q = q.eq('area', filters.area);
  if (filters.estat_circuit) q = q.eq('estat_circuit', filters.estat_circuit);
  if (filters.estat_jc) q = q.eq('estat_jc', filters.estat_jc);
  if (!filters.incloureArxivades && !filters.mostrarArxivades) {
    q = q.eq('arxivada', false);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateLicitacio(id, patch) {
  const allowed = [
    'notes_paula',
    'estat_jc',
    'data_contacte',
    'resultat_jc',
    'estat_circuit',
    'motiu_descart',
    'valoracio',
    'responsable_area_id',
    'area'
  ];
  const payload = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) payload[key] = patch[key];
  }
  if (payload.estat_circuit === 'Descartada') {
    const motiu = String(payload.motiu_descart ?? '').trim();
    if (!motiu) {
      throw new Error('Cal indicar el motiu per descartar la licitació');
    }
    payload.motiu_descart = motiu;
  }
  const { data, error } = await getSupabase().from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function loadLicitacioEvents(licitacioId) {
  if (!licitacioId) return [];
  const { data, error } = await getSupabase()
    .from('licitacions_events')
    .select('id, estat_anterior, estat_nou, nota, user_id, created_at')
    .eq('licitacio_id', licitacioId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function loadLastSyncLog() {
  const { data, error } = await getSupabase()
    .from('licitacions_sync_log')
    .select('*')
    .order('started_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

export async function loadLicitacionsResponsables() {
  const { data, error } = await getSupabase()
    .from('user_profiles')
    .select('id, name, role')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveLicitacionsConfigMap(configMap) {
  const entries = Object.entries(configMap || {});
  if (!entries.length) return;
  const rows = entries.map(([key, value]) => ({
    key,
    value,
    updated_at: new Date().toISOString()
  }));
  const { error } = await getSupabase().from('licitacions_config').upsert(rows, { onConflict: 'key' });
  if (error) throw error;
}

export {
  LICITACIONS_CONFIG_FALLBACK,
  loadLicitacionsConfig
};
