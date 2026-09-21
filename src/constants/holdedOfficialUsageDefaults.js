/**
 * Snapshot por defecto del panel Holded (EI SSS).
 * Holded no expone endpoint de uso: se copia a mano desde la web.
 * Usado por Settings (UI) y como semilla en el tracker del main.
 */
export const HOLDED_PLAN_LIMIT_DEFAULT = 7500;

export const HOLDED_OFFICIAL_USAGE_DEFAULT = {
  period: '2026-09',
  planLimit: 7500,
  used: 6370,
  remaining: 1130,
  percentUsed: 85,
  warningMessage:
    "El teu ús s'acosta al límit de trucades inclòs al teu pla. Actualitza ara i afegeix 22.500 addicionals.",
  zones: [
    { name: 'v1', count: 5626, percent: 88 },
    { name: 'Vendes', count: 628, percent: 10 },
    { name: 'Comptabilitat', count: 74, percent: 1 },
    { name: 'Equip', count: 42, percent: 1 }
  ],
  endpoints: [
    { method: 'GET', path: '/api/v1/legacy', count: 5626 },
    { method: 'GET', path: '/api/v2/invoices', count: 419 },
    { method: 'GET', path: '/api/v2/estimates', count: 202 },
    { method: 'GET', path: '/api/v2/accounting-accounts', count: 64 },
    { method: 'GET', path: '/api/v2/salary-records', count: 37 },
    { method: 'GET', path: '/api/v2/treasury/accounts', count: 10 },
    { method: 'GET', path: '/api/v2/proformas', count: 7 },
    { method: 'GET', path: '/api/v2/employees', count: 2 },
    { method: 'GET', path: '/api/v2/salary-records/{salaryRecordId}', count: 2 },
    { method: 'GET', path: '/api/v2/salary-records/form-data', count: 1 }
  ],
  source: 'panel_holded_manual',
  capturedAt: '2026-09-21T10:00:00.000Z',
  note: "Copiado del panel Holded (Desenvolupadors → Ús de l'API)."
};
