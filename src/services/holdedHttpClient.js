/**
 * Peticiones Holded v1 via IPC (procés main). Reutilitzable per team, payroll, HR.
 */
/** Claves API Holded por empresa (v1: header `key`, v2: Bearer). */
export const HOLDED_API_KEYS = {
  solucions: 'c2c5422f061d6aeda899e3941cbb4b04',
  menjar: '44758c63e2fc4dc5dd37a3eedc1ae580'
};

export async function holdedRequest({ baseUrl, endpoint, company = 'solucions', method = 'GET', body = null }) {
  const apiKey = HOLDED_API_KEYS[company];
  if (!apiKey) throw new Error(`API key no encontrada para: ${company}`);
  if (!window.electronAPI?.makeHoldedRequest) {
    throw new Error('API de Electron no disponible.');
  }

  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const response = await window.electronAPI.makeHoldedRequest({
    url: `${baseUrl}${path}`,
    options: {
      method,
      headers: {
        'Content-Type': 'application/json',
        key: apiKey
      },
      body: body ?? undefined
    }
  });

  if (!response.ok) {
    const detail =
      typeof response.data === 'string'
        ? response.data
        : response.data?.message || response.statusText || `HTTP ${response.status}`;
    const err = new Error(`Holded (${company}): ${detail}`);
    err.status = response.status;
    throw err;
  }
  return response.data;
}
