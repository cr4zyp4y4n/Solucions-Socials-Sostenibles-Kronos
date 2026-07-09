/**
 * Client Holded API v2 (RRHH / nòmines) via IPC Electron.
 * @see holded-api-reference.md a l'arrel del repositori
 */
import { HOLDED_API_KEYS } from './holdedHttpClient';

const HOLDED_V2_BASE = 'https://api.holded.com/api/v2';

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

class HoldedApiV2Service {
  async makeRequest(endpoint, options = {}, company = 'solucions') {
    const envKey =
      company === 'solucions'
        ? String(process.env.HOLDED_V2_API_KEY_SOLUCIONS || '').trim()
        : '';
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

  async getEmployees(company = 'solucions') {
    return this.fetchAllPages('/employees', {}, company);
  }

  async getPayrollRecords(year, company = 'solucions') {
    return this.fetchAllPages('/payroll-records', { year }, company);
  }

  async getAccountingAccounts(company = 'solucions') {
    return this.fetchAllPages('/accounting-accounts', {}, company);
  }

  async getInvoices(company = 'solucions') {
    return this.fetchAllPages('/invoices', {}, company);
  }

  async getEstimates(params = {}, company = 'solucions') {
    return this.fetchAllPages('/estimates', params, company);
  }

  async getProformas(params = {}, company = 'solucions') {
    return this.fetchAllPages('/proformas', params, company);
  }
}

const holdedApiV2Service = new HoldedApiV2Service();
export default holdedApiV2Service;
