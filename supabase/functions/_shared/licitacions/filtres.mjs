/**
 * Filtres de licitacions (ESM pur).
 * Sense imports de Node, Deno, Supabase ni React.
 * Usat per Electron (webpack) i per l'Edge Function.
 */

/** Prefixe jeràrquic CPV: treu zeros finals. 55520000 → '5552', 72000000 → '72'. */
export function cpvPrefix(code) {
  const c = String(code || '').replace(/\D/g, '').slice(0, 8);
  if (!c) return '';
  const p = c.replace(/0+$/, '');
  return p.length < 2 ? c.slice(0, 2) : p;
}

/** Minúscules, sense accents (NFD), espais col·lapsats. */
export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function digits8(code) {
  return String(code || '').replace(/\D/g, '').slice(0, 8);
}

/**
 * El codi cau sota el filtre jeràrquic (prefix).
 * Excepció cantina: filtre 555 (de 55500000) NO exclou catering 5552*.
 */
export function cpvIsUnder(code, filter) {
  const c = cpvPrefix(code);
  const f = cpvPrefix(filter);
  if (!c || !f) return false;
  if (f === '555') {
    return c === '555' || c.startsWith('5550') || c.startsWith('5551');
  }
  return c === f || c.startsWith(f);
}

function listHit(code, list) {
  const arr = Array.isArray(list) ? list : [];
  for (const item of arr) {
    if (cpvIsUnder(code, item)) return String(item);
  }
  return null;
}

/**
 * Classifica per CPV. Prioritat: principal; si no, qualsevol de la llista.
 * cpv_exclusio s'avalua ABANS que les llistes d'inclusió.
 * @returns {{ area: 'Catering'|'Tech'|'Altres'|null, cpvMatch: string|null }}
 */
export function classifyCpv(cpvCodes, config) {
  const codes = (Array.isArray(cpvCodes) ? cpvCodes : [cpvCodes])
    .map((c) => digits8(c))
    .filter(Boolean);
  if (!codes.length) return { area: null, cpvMatch: null };

  const exclusio = config?.cpv_exclusio || [];
  const catering = config?.cpv_catering || [];
  const tech = config?.cpv_tech || [];
  const altres = config?.cpv_altres || [];

  const tryOne = (code) => {
    const ex = listHit(code, exclusio);
    if (ex) return { area: null, cpvMatch: null, excluded: true };
    const cat = listHit(code, catering);
    if (cat) return { area: 'Catering', cpvMatch: cat };
    const te = listHit(code, tech);
    if (te) return { area: 'Tech', cpvMatch: te };
    const al = listHit(code, altres);
    if (al) return { area: 'Altres', cpvMatch: al };
    return null;
  };

  const primary = tryOne(codes[0]);
  if (primary?.excluded) return { area: null, cpvMatch: null };
  if (primary?.area) return { area: primary.area, cpvMatch: primary.cpvMatch };

  for (let i = 1; i < codes.length; i += 1) {
    const hit = tryOne(codes[i]);
    if (hit?.excluded) continue;
    if (hit?.area) return { area: hit.area, cpvMatch: hit.cpvMatch };
  }
  return { area: null, cpvMatch: null };
}

/**
 * Coincidència per paraula/frase sencera sobre text normalitzat.
 * "bar" NO casa amb "Barcelona".
 */
export function matchKeyword(text, keywords) {
  const hay = normalizeText(text);
  if (!hay) return false;
  const list = Array.isArray(keywords) ? keywords : [];
  for (const raw of list) {
    const needle = normalizeText(raw);
    if (!needle) continue;
    const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    const re = new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i');
    if (re.test(hay)) return true;
  }
  return false;
}

/**
 * Pipeline complet de filtre.
 * @returns {{ keep: true, area: string, reservada: boolean } | { keep: false, motiu: 'cpv'|'keyword'|'import' }}
 */
export function evaluateLicitacio({ cpvCodes, title, summary, importEstimat }, config) {
  const cfg = config || {};
  const { area } = classifyCpv(cpvCodes, cfg);
  if (!area) return { keep: false, motiu: 'cpv' };

  const blob = `${title || ''} ${summary || ''}`;
  const reservada = matchKeyword(blob, cfg.keywords_reserva || []);

  if (!reservada) {
    const kwArea = cfg.keywords_exclusio?.[area] || [];
    if (matchKeyword(blob, kwArea)) return { keep: false, motiu: 'keyword' };

    const max = cfg.import_max?.[area];
    if (max != null && importEstimat != null && Number.isFinite(Number(importEstimat))) {
      if (Number(importEstimat) > Number(max)) return { keep: false, motiu: 'import' };
    }
  }

  return { keep: true, area, reservada: Boolean(reservada) };
}
