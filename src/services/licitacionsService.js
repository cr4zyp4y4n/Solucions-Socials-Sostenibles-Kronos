import { supabase as defaultSupabase } from '../config/supabase';
import { LICITACIONS_CPV_FILTER } from '../constants/licitacionsCpv';
import { LICITACIONS_ESTAT_CONTRACTACIO } from '../constants/licitacionsEstat';
import { shouldPurgeLicitacioFromDb } from './licitacionsVigent';

const TABLE = 'licitacions';

let supabaseClientOverride = null;
let httpClientOverride = null;

export function setLicitacionsSupabaseClient(client) {
  supabaseClientOverride = client || null;
}

export function setLicitacionsHttpClient(fn) {
  httpClientOverride = typeof fn === 'function' ? fn : null;
}

function getSupabase() {
  return supabaseClientOverride || defaultSupabase;
}

const TED_SEARCH_URL = 'https://api.ted.europa.eu/v3/notices/search';
/** opendata.aoc.cat ya no resuelve DNS (jun 2026). Fuente actual: Transparencia Catalunya (Socrata). */
const PSCP_CATALUNYA_URL = 'https://analisi.transparenciacatalunya.cat/resource/ybgg-dgi6.json';
/** Legacy (solo fallback informativo; suele fallar con ENOTFOUND). */
const PSCP_RECORDS_URL_LEGACY =
  'https://opendata.aoc.cat/api/explore/v2.1/catalog/datasets/contractacio-publica-pscp/records';
const PLACSP_ATOM_URLS = [
  'https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratanteCompleto3.atom',
  'https://contrataciondelestado.es/sindicacion/sindicacion_643/licitacionesPerfilesContratante.atom'
];
const PLACSP_MAX_ENTRIES_SCAN = 600;

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

const SECTOR_PREFIXES = [
  { sector: 'Catering', prefixes: ['55'] },
  { sector: 'Congressos', prefixes: ['7995', '79952', '79951'] },
  { sector: 'Medi Ambient', prefixes: ['907'] },
  { sector: 'Tecnologia', prefixes: ['72'] }
];

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

function cpvMatchesFilter(codes) {
  const list = Array.isArray(codes) ? codes.map((c) => String(c).replace(/\D/g, '').slice(0, 8)) : [];
  return list.some((code) =>
    LICITACIONS_CPV_FILTER.some((f) => code === f || code.startsWith(f.slice(0, 2)))
  );
}

export function inferSector(cpvCodes) {
  const list = Array.isArray(cpvCodes) ? cpvCodes : [cpvCodes];
  for (const raw of list) {
    const code = String(raw || '').replace(/\D/g, '').slice(0, 8);
    if (!code) continue;
    for (const rule of SECTOR_PREFIXES) {
      if (rule.prefixes.some((p) => code.startsWith(p))) return rule.sector;
    }
  }
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
    ofertes_rebudes: row.ofertes_rebudes ?? null
  };
}

function normalizeBase({ source, externalId, title, organismo, cpvCodes, importEstimat, termini, url, extra = {} }) {
  const ext = buildExternalId(source, externalId);
  const cpv = Array.isArray(cpvCodes) ? [...new Set(cpvCodes.map((c) => String(c).replace(/\D/g, '').slice(0, 8)).filter(Boolean))] : [];
  if (!ext || !title) return null;
  if (cpv.length && !cpvMatchesFilter(cpv)) return null;

  return {
    source,
    external_id: ext,
    title: String(title).trim().slice(0, 2000),
    organismo: organismo ? String(organismo).trim().slice(0, 500) : null,
    sector: inferSector(cpv),
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

function normalizeTEDNotice(notice) {
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
    extra: status
  });
}

function normalizePSCPRecord(record) {
  const fields = record?.record?.fields || record?.fields || record || {};
  const enllac = fields.enllac_publicacio;
  const urlFromEnllac = typeof enllac === 'string' ? enllac : enllac?.url || '';
  const externalId =
    firstField(fields, ['id', 'id_expedient', 'expedient', 'codi_expedient', 'recordid']) ||
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
  const organismo = firstField(fields, [
    'nom_organ',
    'organisme',
    'organismo',
    'organisme_contractor',
    'contracting_authority'
  ]);
  const cpvRaw = firstField(fields, ['cpv', 'cpv_principal', 'codi_cpv', 'cpv_code']) || fields.cpv;
  const cpv = Array.isArray(cpvRaw) ? cpvRaw : cpvRaw ? [cpvRaw] : [];
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
    'pressupost_licitacio_amb',
    'pressupost_licitacio_sense',
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

  return normalizeBase({
    source: 'PSCP',
    externalId,
    title,
    organismo,
    cpvCodes: cpv,
    importEstimat,
    termini: terminiParsed || termini,
    url,
    extra: { duracio: fields.durada_contracte || null, ...status }
  });
}

function parsePlacspSummary(summary) {
  const text = String(summary || '');
  const organismo =
    text.match(/[ÓO]rgano de Contrataci[oó]n:\s*([^;]+)/i)?.[1]?.trim() ||
    text.match(/[ÓO]rgan de Contractaci[oó]:\s*([^;]+)/i)?.[1]?.trim() ||
    null;
  const importRaw = text.match(/Importe:\s*([\d.,]+)\s*EUR/i)?.[1];
  const importEstimat = importRaw ? Number(String(importRaw).replace(/\./g, '').replace(',', '.')) : null;
  const estadoCode = text.match(/Estado:\s*([A-Z]+)/i)?.[1]?.toUpperCase() || '';
  return {
    organismo,
    importEstimat: Number.isFinite(importEstimat) ? importEstimat : null,
    estadoCode
  };
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

function parseAtomEntriesDom(xmlText, { maxEntries = PLACSP_MAX_ENTRIES_SCAN } = {}) {
  const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
  if (doc.querySelector('parsererror')) {
    throw new Error('PLACSP: XML no vàlid');
  }
  const entries = [...doc.getElementsByTagName('entry')].slice(0, maxEntries);
  return entries.map((entry) => {
    const textOf = (tag) => entry.getElementsByTagName(tag)[0]?.textContent?.trim() || '';
    let link = '';
    const links = entry.getElementsByTagName('link');
    for (let i = 0; i < links.length; i += 1) {
      const href = links[i].getAttribute('href');
      if (href) {
        link = href;
        break;
      }
    }
    return {
      id: textOf('id'),
      title: textOf('title'),
      link,
      updated: textOf('updated'),
      summary: textOf('summary') || textOf('content'),
      blob: entry.textContent || ''
    };
  });
}

/** Parseja feed ATOM (DOMParser al renderer; regex al main process). */
function parseAtomEntries(xmlText, options = {}) {
  if (typeof DOMParser !== 'undefined') {
    try {
      return parseAtomEntriesDom(xmlText, options);
    } catch {
      return parseAtomEntriesRegex(xmlText, options);
    }
  }
  return parseAtomEntriesRegex(xmlText, options);
}

function normalizePLACSPEntry(entry) {
  const id = entry?.id || '';
  const title = entry?.title || '';
  const link = entry?.link || '';
  const summary = entry?.summary || '';
  const blob = `${title} ${summary} ${entry?.blob || ''}`;
  const cpvFound = LICITACIONS_CPV_FILTER.filter((cpv) => blob.includes(cpv));
  if (!cpvFound.length) return null;
  const parsedSummary = parsePlacspSummary(summary);
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
    importEstimat: parsedSummary.importEstimat,
    termini: deadline,
    url: typeof link === 'string' ? link : pickLang(link),
    extra: status
  });
}

function buildTedQuery() {
  const cpvPart = LICITACIONS_CPV_FILTER.map((c) => `PC=${c}`).join(' OR ');
  return `CY=ESP AND (${cpvPart}) AND PD>=20240101`;
}

function buildPscpWhereLegacy() {
  return LICITACIONS_CPV_FILTER.map((c) => `cpv='${c}' OR cpv_principal='${c}' OR codi_cpv='${c}'`).join(' OR ');
}

function buildPscpCatalunyaCpvClause() {
  return LICITACIONS_CPV_FILTER.map((c) => `codi_cpv like '${c}%'`).join(' OR ');
}

/** Solo plazo abierto o anuncio previo (evita histórico adjudicado de PSCP). */
function buildPscpCatalunyaWhereVigents() {
  const today = new Date().toISOString().slice(0, 10);
  const cpv = buildPscpCatalunyaCpvClause();
  return `(${cpv}) AND (termini_presentacio_ofertes >= '${today}' OR lower(fase_publicacio) like '%anunci previ%')`;
}

function buildPscpCatalunyaUrls(limit = 200) {
  const where = encodeURIComponent(buildPscpCatalunyaWhereVigents());
  return [
    `${PSCP_CATALUNYA_URL}?$where=${where}&$order=termini_presentacio_ofertes ASC&$limit=${limit}`,
    `${PSCP_CATALUNYA_URL}?$where=${where}&$order=data_publicacio_anunci DESC&$limit=${limit}`
  ];
}

/** HTTP des del procés main d'Electron (sense CSP del renderer). */
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
  if (typeof window !== 'undefined' && window.electronAPI?.licitacionsHttpRequest) {
    const res = await window.electronAPI.licitacionsHttpRequest({
      url,
      method: options.method || 'GET',
      headers,
      body: options.body ?? null
    });
    return res;
  }
  const res = await fetch(url, { ...options, headers });
  const text = await res.text();
  return { ok: res.ok, status: res.status, statusText: res.statusText, text };
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
export async function fetchTEDAll({ maxPages = 3, limit = 100 } = {}) {
  const merged = new Map();
  for (let page = 1; page <= maxPages; page += 1) {
    const batch = await fetchTED({ page, limit });
    if (!batch.length) break;
    for (const row of batch) {
      if (row?.external_id) merged.set(row.external_id, row);
    }
    if (batch.length < limit) break;
  }
  return [...merged.values()];
}

/** TED — POST api.ted.europa.eu/v3/notices/search */
export async function fetchTED({ page = 1, limit = 100 } = {}) {
  const body = {
    query: buildTedQuery(),
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
  return notices.map(normalizeTEDNotice).filter(Boolean);
}

/** PSCP — Transparencia Catalunya (Socrata). Fallback legacy opendata.aoc.cat si vuelve a existir. */
export async function fetchPSCP({ limit = 100 } = {}) {
  const urls = [...buildPscpCatalunyaUrls(limit)];

  // El legacy host `opendata.aoc.cat` ya no resuelve DNS en muchos entornos (jun 2026).
  // Lo dejamos como fallback *solo* si se activa explícitamente.
  const legacyEnabled = (() => {
    try {
      return Boolean(process?.env?.LICITACIONS_PSCP_LEGACY);
    } catch (_) {
      return false;
    }
  })();

  if (legacyEnabled) {
    const where = encodeURIComponent(buildPscpWhereLegacy());
    urls.push(
      `${PSCP_RECORDS_URL_LEGACY}?where=${where}&limit=${limit}&order_by=publication_date DESC`,
      `${PSCP_RECORDS_URL_LEGACY}?where=${where}&limit=${limit}`
    );
  }

  let lastErr;
  const merged = new Map();
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      const results = Array.isArray(data?.results)
        ? data.results
        : Array.isArray(data)
          ? data
          : [];
      const normalized = results.map(normalizePSCPRecord).filter(Boolean);
      logDebug('PSCP ok', { url, raw: results.length, normalized: normalized.length });
      for (const row of normalized) {
        if (row?.external_id) merged.set(row.external_id, row);
      }
    } catch (e) {
      lastErr = e;
      const msg = e?.message || String(e);
      const hostBlocked = msg.includes('Host no permès per a licitacions: analisi.transparenciacatalunya.cat');
      const dnsLegacy = msg.includes('ENOTFOUND opendata.aoc.cat');
      const hint = hostBlocked
        ? ' (Tu app está corriendo con un main antiguo: reinicia Electron para cargar el allowlist actualizado)'
        : dnsLegacy
          ? ' (El legacy opendata.aoc.cat no resuelve DNS; no se usará salvo LICITACIONS_PSCP_LEGACY=1)'
          : '';
      logDebug('PSCP fallback failed', { url, message: msg + hint });
    }
  }
  if (merged.size) return [...merged.values()];
  if (lastErr?.message?.includes?.('Host no permès per a licitacions: analisi.transparenciacatalunya.cat')) {
    throw new Error(
      "PSCP: el proceso main está bloqueando 'analisi.transparenciacatalunya.cat'. Reinicia la app (cerrar Electron por completo y volver a ejecutar npm start) para que se apliquen los cambios en src/main.js."
    );
  }
  throw lastErr || new Error('PSCP: no se pudo obtener resultados con los filtros CPV actuales');
}

async function fetchPlacspAtomFromUrl(atomUrl) {
  const res = await httpRequest(atomUrl, {
    headers: {
      Accept: 'application/atom+xml, application/xml, text/xml, */*'
    }
  });
  let text = res.text || '';
  const preview = String(text || '').slice(0, 220).replace(/\s+/g, ' ');

  logDebug('PLACSP response', {
    url: atomUrl,
    ok: res.ok,
    status: res.status,
    statusText: res.statusText,
    contentType: res.headers?.['content-type'],
    contentEncoding: res.headers?.['content-encoding'],
    startsWith: String(text || '').trim().slice(0, 20),
    preview
  });

  const trimmed = String(text || '').trim();
  const looksHtml = trimmed.startsWith('<html') || trimmed.startsWith('<!DOCTYPE html');

  if (!res.ok) {
    throw new Error(`PLACSP HTTP ${res.status} ${res.statusText || ''}`.trim());
  }

  if (looksHtml) {
    const refreshUrl = extractMetaRefreshUrl(text);
    if (refreshUrl) {
      logDebug('PLACSP meta-refresh detectado', { from: atomUrl, to: refreshUrl });
      throw new Error(
        `PLACSP devolvió HTML de redirección (URL antigua o bloqueo). Meta-refresh → ${refreshUrl}. Preview: ${preview}`
      );
    }
    throw new Error(`PLACSP devolvió HTML (posible bloqueo/WAF). Preview: ${preview}`);
  }

  const entries = parseAtomEntries(text);
  const normalized = entries.map(normalizePLACSPEntry).filter(Boolean);
  logDebug('PLACSP parsed', {
    url: atomUrl,
    scanned_entries: entries.length,
    matched: normalized.length
  });
  return normalized;
}

/** PLACSP — feed ATOM (URL actualizada; la antigua *_licitaciones_todas.atom redirige a HTML). */
export async function fetchPLACSP() {
  const merged = new Map();
  let lastErr;
  for (const atomUrl of PLACSP_ATOM_URLS) {
    try {
      const batch = await withRetries(
        async () => fetchPlacspAtomFromUrl(atomUrl),
        { label: 'fetchPLACSP', retries: 1, baseDelayMs: 900 }
      );
      for (const row of batch) {
        if (row?.external_id) merged.set(row.external_id, row);
      }
    } catch (e) {
      lastErr = e;
      logDebug('PLACSP URL failed', { url: atomUrl, message: e?.message || String(e) });
    }
  }
  if (merged.size) return [...merged.values()];
  throw lastErr || new Error('PLACSP: no se pudo leer ningún feed ATOM');
}

function dedupeByExternalId(rows) {
  const map = new Map();
  for (const row of rows) {
    if (row?.external_id) map.set(row.external_id, row);
  }
  return [...map.values()];
}

async function upsertLicitacions(records) {
  const rows = dedupeByExternalId(records);
  if (!rows.length) {
    return { inserted: 0, updated: 0, total: 0 };
  }

  const externalIds = rows.map((r) => r.external_id);
  const { data: existing, error: readErr } = await getSupabase()
    .from(TABLE)
    .select('external_id')
    .in('external_id', externalIds);
  if (readErr) throw readErr;

  const existingSet = new Set((existing || []).map((r) => r.external_id));
  const toInsert = rows.filter((r) => !existingSet.has(r.external_id));
  const toUpdate = rows.filter((r) => existingSet.has(r.external_id));

  if (toInsert.length) {
    const { error: insErr } = await getSupabase().from(TABLE).insert(
      toInsert.map((r) => ({ ...syncPayloadFromNormalized(r), estat_jc: 'Pendent' }))
    );
    if (insErr) throw insErr;
  }

  for (const row of toUpdate) {
    const { error: updErr } = await getSupabase()
      .from(TABLE)
      .update(syncPayloadFromNormalized(row))
      .eq('external_id', row.external_id);
    if (updErr) throw updErr;
  }

  return { inserted: toInsert.length, updated: toUpdate.length, total: rows.length };
}

/** Elimina de Supabase licitaciones caducadas/cerradas sin seguimiento Interessant/Contactat. */
export async function purgeCaducadasLicitacions() {
  const db = getSupabase();
  const { data, error } = await db
    .from(TABLE)
    .select('id, source, estat_contractacio, termini_oferta, estat_jc');
  if (error) throw error;

  const toDelete = (data || []).filter(shouldPurgeLicitacioFromDb).map((r) => r.id);
  if (!toDelete.length) return { deleted: 0 };

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 100) {
    const batch = toDelete.slice(i, i + 100);
    const { error: delErr } = await db.from(TABLE).delete().in('id', batch);
    if (delErr) throw delErr;
    deleted += batch.length;
  }
  return { deleted };
}

/**
 * Obté licitacions de TED + PSCP + PLACSP i les desa a Supabase sense esborrar estat JC ni notes.
 */
export async function fetchAll(options = {}) {
  const { limit = 100, tedMaxPages = 3, purgeCaducadas = true } = options;
  const errors = {};
  const fetched = { ted: 0, pscp: 0, placsp: 0, tedPages: 0 };

  const [tedRes, pscpRes, placspRes] = await Promise.allSettled([
    fetchTEDAll({ maxPages: tedMaxPages, limit }),
    fetchPSCP({ limit }),
    fetchPLACSP()
  ]);

  const all = [];
  if (tedRes.status === 'fulfilled') {
    fetched.ted = tedRes.value.length;
    all.push(...tedRes.value);
  } else {
    errors.ted = tedRes.reason?.message || String(tedRes.reason);
    console.warn('[licitacions] TED:', errors.ted);
  }

  if (pscpRes.status === 'fulfilled') {
    fetched.pscp = pscpRes.value.length;
    all.push(...pscpRes.value);
  } else {
    errors.pscp = pscpRes.reason?.message || String(pscpRes.reason);
    console.warn('[licitacions] PSCP:', errors.pscp);
  }

  if (placspRes.status === 'fulfilled') {
    fetched.placsp = placspRes.value.length;
    all.push(...placspRes.value);
  } else {
    errors.placsp = placspRes.reason?.message || String(placspRes.reason);
    console.warn('[licitacions] PLACSP:', errors.placsp);
  }

  const sync = await upsertLicitacions(all);

  let purge = { deleted: 0 };
  if (purgeCaducadas) {
    try {
      purge = await purgeCaducadasLicitacions();
    } catch (e) {
      errors.purge = e?.message || String(e);
      console.warn('[licitacions] Purge:', errors.purge);
    }
  }

  if (tedRes.status === 'fulfilled' && fetched.ted >= limit) {
    fetched.tedPages = tedMaxPages;
  } else if (tedRes.status === 'fulfilled') {
    fetched.tedPages = 1;
  }

  return {
    ...sync,
    fetched,
    purge,
    errors: Object.keys(errors).length ? errors : null
  };
}

export async function loadLicitacions(filters = {}) {
  // Nuevas primero (detected_at DESC); desempate por plazo de oferta.
  let q = getSupabase()
    .from(TABLE)
    .select('*')
    .order('detected_at', { ascending: false, nullsFirst: false })
    .order('termini_oferta', { ascending: true, nullsFirst: false });
  if (filters.source) q = q.eq('source', filters.source);
  if (filters.sector) q = q.eq('sector', filters.sector);
  if (filters.estat_jc) q = q.eq('estat_jc', filters.estat_jc);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function updateLicitacio(id, patch) {
  const allowed = ['notes_paula', 'estat_jc', 'data_contacte', 'resultat_jc'];
  const payload = {};
  for (const key of allowed) {
    if (patch[key] !== undefined) payload[key] = patch[key];
  }
  const { data, error } = await getSupabase().from(TABLE).update(payload).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

const licitacionsService = {
  fetchTED,
  fetchTEDAll,
  fetchPSCP,
  fetchPLACSP,
  fetchAll,
  purgeCaducadasLicitacions,
  loadLicitacions,
  updateLicitacio,
  inferSector,
  setLicitacionsHttpClient,
  setLicitacionsSupabaseClient,
  LICITACIONS_CPV_FILTER
};

export default licitacionsService;
