/**
 * Client Holded API v2 (RRHH / nòmines / accounting / sales) via IPC Electron.
 * Incluye caché de sesión + inflight para no repetir el mismo listado.
 * @see https://www.holded.com/developers/api-reference/invoices/list-invoices
 */
import { HOLDED_API_KEYS } from './holdedHttpClient';

const HOLDED_V2_BASE = 'https://api.holded.com/api/v2';
/** TTL caché en memoria (sesión Kronos). 0 coste API. */
const SESSION_CACHE_TTL_MS = 30 * 60 * 1000;

function extractList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.results)) return payload.results;
  return [];
}

function nextCursor(payload) {
  if (!payload || typeof payload !== 'object') return null;
  if (payload.has_more === false) return null;
  return payload.nextCursor || payload.next_cursor || payload.cursor || null;
}

/** Rango ISO de un año civil (filtro v2 start_date/end_date). */
export function holdedV2YearRange(year) {
  const y = Number(year);
  if (!Number.isFinite(y)) return {};
  return {
    start_date: `${y}-01-01`,
    end_date: `${y}-12-31`
  };
}

class HoldedApiV2Service {
  constructor() {
    /** @type {Map<string, { data: any, ts: number }>} */
    this._sessionCache = new Map();
    /** @type {Map<string, Promise<any>>} */
    this._inflight = new Map();
  }

  clearSessionCache(prefix = null) {
    if (!prefix) {
      this._sessionCache.clear();
      return;
    }
    for (const key of [...this._sessionCache.keys()]) {
      if (key.startsWith(prefix)) this._sessionCache.delete(key);
    }
  }

  _cacheKey(endpoint, company, params) {
    return `${company}|${endpoint}|${JSON.stringify(params || {})}`;
  }

  async _cached(key, loader) {
    const hit = this._sessionCache.get(key);
    if (hit && Date.now() - hit.ts < SESSION_CACHE_TTL_MS) {
      return hit.data;
    }
    if (this._inflight.has(key)) {
      return this._inflight.get(key);
    }
    const promise = (async () => {
      try {
        const data = await loader();
        this._sessionCache.set(key, { data, ts: Date.now() });
        return data;
      } finally {
        this._inflight.delete(key);
      }
    })();
    this._inflight.set(key, promise);
    return promise;
  }

  async makeRequest(endpoint, options = {}, company = 'solucions') {
    const envKeyByCompany = {
      solucions: String(process.env.HOLDED_V2_API_KEY_SOLUCIONS || '').trim(),
      menjar_dhort: String(process.env.HOLDED_V2_API_KEY_MENJAR_DHORT || '').trim()
    };
    const envKey = envKeyByCompany[company] || '';
    const apiKey = envKey || HOLDED_API_KEYS[company];
    if (!apiKey) throw new Error(`API key no encontrada para: ${company}`);

    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const requestData = {
      url: `${HOLDED_V2_BASE}${path}`,
      options: {
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          ...(options.headers || {})
        },
        body: options.body ?? undefined
      }
    };

    if (!window.electronAPI?.makeHoldedRequest) {
      throw new Error('API de Electron no disponible.');
    }

    const response = await window.electronAPI.makeHoldedRequest(requestData);
    if (!response.ok) {
      if (response.status === 402) {
        throw new Error(`Holded (${company}): límit de pla assolit (402).`);
      }
      const detail =
        typeof response.data === 'string'
          ? response.data
          : response.data?.message || response.statusText || `HTTP ${response.status}`;
      throw new Error(`Holded v2 (${company}): ${detail}`);
    }
    return response.data;
  }

  async fetchAllPages(endpoint, params = {}, company = 'solucions') {
    let all = [];
    let cursor = null;
    let guard = 0;
    do {
      const query = new URLSearchParams({ limit: '50' });
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') query.set(k, String(v));
      });
      if (cursor) query.set('cursor', cursor);
      const qs = query.toString();
      const path = qs ? `${endpoint}?${qs}` : endpoint;
      const page = await this.makeRequest(path, {}, company);
      all = all.concat(extractList(page));
      cursor = nextCursor(page);
      guard += 1;
    } while (cursor && guard < 200);
    return all;
  }

  async fetchAllPagesCached(endpoint, params = {}, company = 'solucions') {
    const key = this._cacheKey(endpoint, company, params);
    return this._cached(key, () => this.fetchAllPages(endpoint, params, company));
  }

  async getEmployees(company = 'solucions') {
    return this.fetchAllPagesCached('/employees', {}, company);
  }

  async getPayrollRecords(year, company = 'solucions') {
    return this.fetchAllPagesCached('/payroll-records', { year }, company);
  }

  /**
   * Registros de salario / líquido a pagar (Holded v2).
   * Preferible a /payroll-records (404 en algunas cuentas).
   * Filtrar por fecha en cliente: start_date/end_date no siempre aplica.
   */
  async getSalaryRecords(params = {}, company = 'solucions') {
    return this.fetchAllPagesCached('/salary-records', params || {}, company);
  }

  async getSalaryRecordById(id, company = 'solucions') {
    const sid = String(id || '').trim();
    if (!sid) return null;
    return this.makeRequest(`/salary-records/${sid}`, {}, company);
  }

  /**
   * Plan de cuentas Holded v2.
   * Con `start_date` + `end_date` (ISO YYYY-MM-DD, distintos) Holded rellena debit/credit/balance del periodo.
   * Sin fechas, los saldos no coinciden con el plan contable de la UI.
   */
  async getAccountingAccounts(company = 'solucions', params = {}) {
    return this.fetchAllPagesCached('/accounting-accounts', params || {}, company);
  }

  /**
   * Facturas v2. Soporta start_date/end_date (issue date), sort, status, etc.
   * Firma: getInvoices(company) | getInvoices(company, params)
   */
  async getInvoices(company = 'solucions', params = {}) {
    return this.fetchAllPagesCached('/invoices', params || {}, company);
  }

  /** Solo facturas emitidas en un año civil (filtro API, no histórico entero). */
  async getInvoicesForYear(year, company = 'solucions', extraParams = {}) {
    return this.getInvoices(company, {
      ...holdedV2YearRange(year),
      sort: '-date',
      ...extraParams
    });
  }

  async getEstimates(params = {}, company = 'solucions') {
    return this.fetchAllPagesCached('/estimates', params, company);
  }

  async getEstimatesForYear(year, company = 'solucions', extraParams = {}) {
    return this.getEstimates({
      ...holdedV2YearRange(year),
      sort: '-date',
      ...extraParams
    }, company);
  }

  async getProformas(params = {}, company = 'solucions') {
    return this.fetchAllPagesCached('/proformas', params, company);
  }

  async getProformasForYear(year, company = 'solucions', extraParams = {}) {
    return this.getProformas({
      ...holdedV2YearRange(year),
      sort: '-date',
      ...extraParams
    }, company);
  }

  /** Comptes de tresoreria (bancs, targetes, caixa, passarel·les). Scope: accounting:banks.read */
  async getTreasuryAccounts(params = {}, company = 'solucions') {
    const query = { archived: 'false', ...params };
    return this.fetchAllPagesCached('/treasury/accounts', query, company);
  }
}

const holdedApiV2Service = new HoldedApiV2Service();
export default holdedApiV2Service;
