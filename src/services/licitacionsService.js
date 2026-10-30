/**
 * Capa fina Electron: injecta Supabase + HTTP (main) sobre fonts.mjs compartit.
 */
import { supabase as defaultSupabase } from '../config/supabase';
import {
  LICITACIONS_CONFIG_FALLBACK,
  loadLicitacionsConfig,
  setLicitacionsDeps,
  setLicitacionsHttpClient as setFontsHttp,
  setLicitacionsSupabaseClient as setFontsSupabase,
  fetchTED,
  fetchTEDAll,
  fetchPSCP,
  fetchPLACSP,
  fetchPLACSPMenors,
  fetchAll as fetchAllFonts,
  runLicitacionsSync,
  archiveCaducadasLicitacions,
  purgeCaducadasLicitacions,
  loadLicitacions,
  updateLicitacio,
  loadLicitacioEvents,
  loadLastSyncLog,
  loadLicitacionsResponsables,
  saveLicitacionsConfigMap,
  inferSector
} from '../../supabase/functions/_shared/licitacions/fonts.mjs';

let httpClientOverride = null;

function resolveHttpClient() {
  if (httpClientOverride) return httpClientOverride;
  return async ({ url, method, headers, body }) => {
    if (typeof window !== 'undefined' && window.electronAPI?.licitacionsHttpRequest) {
      return window.electronAPI.licitacionsHttpRequest({ url, method, headers, body });
    }
    const res = await fetch(url, { method: method || 'GET', headers, body });
    const text = await res.text();
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      headers: Object.fromEntries([...(res.headers || [])]),
      text
    };
  };
}

function ensureDeps() {
  setLicitacionsDeps({
    supabase: defaultSupabase,
    httpRequest: resolveHttpClient()
  });
}

export function setLicitacionsSupabaseClient(client) {
  setFontsSupabase(client || defaultSupabase);
}

export function setLicitacionsHttpClient(fn) {
  httpClientOverride = typeof fn === 'function' ? fn : null;
  setFontsHttp(resolveHttpClient());
}

export async function fetchAll(options = {}) {
  ensureDeps();
  return fetchAllFonts(options);
}

export {
  LICITACIONS_CONFIG_FALLBACK,
  loadLicitacionsConfig,
  fetchTED,
  fetchTEDAll,
  fetchPSCP,
  fetchPLACSP,
  fetchPLACSPMenors,
  runLicitacionsSync,
  archiveCaducadasLicitacions,
  purgeCaducadasLicitacions,
  loadLicitacions,
  updateLicitacio,
  loadLicitacioEvents,
  loadLastSyncLog,
  loadLicitacionsResponsables,
  saveLicitacionsConfigMap,
  inferSector
};

// Wrappers que asseguren deps abans de cridar fonts
const wrap =
  (fn) =>
  async (...args) => {
    ensureDeps();
    return fn(...args);
  };

const licitacionsService = {
  fetchTED: wrap(fetchTED),
  fetchTEDAll: wrap(fetchTEDAll),
  fetchPSCP: wrap(fetchPSCP),
  fetchPLACSP: wrap(fetchPLACSP),
  fetchPLACSPMenors: wrap(fetchPLACSPMenors),
  fetchAll,
  runLicitacionsSync: wrap(runLicitacionsSync),
  archiveCaducadasLicitacions: wrap(archiveCaducadasLicitacions),
  purgeCaducadasLicitacions: wrap(purgeCaducadasLicitacions),
  loadLicitacions: wrap(loadLicitacions),
  updateLicitacio: wrap(updateLicitacio),
  loadLicitacioEvents: wrap(loadLicitacioEvents),
  loadLastSyncLog: wrap(loadLastSyncLog),
  loadLicitacionsResponsables: wrap(loadLicitacionsResponsables),
  saveLicitacionsConfigMap: wrap(saveLicitacionsConfigMap),
  loadLicitacionsConfig,
  inferSector,
  setLicitacionsHttpClient,
  setLicitacionsSupabaseClient,
  LICITACIONS_CONFIG_FALLBACK
};

export default licitacionsService;
