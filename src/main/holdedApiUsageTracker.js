/**
 * Contador local de llamadas Holded (0 coste API) + snapshot oficial del panel Holded
 * (manual: Holded no expone endpoint de uso).
 * Persiste en userData/holded-api-usage.json
 */
const fs = require('node:fs');
const path = require('node:path');
const { app } = require('electron');

const HOLDED_PLAN_LIMIT = 7500;

const DEFAULT_OFFICIAL_SNAPSHOT = {
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
  note: 'Copiado del panel Holded (Desenvolupadors → Ús de l\'API). No hay endpoint oficial.'
};

function currentPeriodKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

function normalizeEndpoint(pathname) {
  if (!pathname || typeof pathname !== 'string') return 'unknown';
  return pathname
    .replace(/\/[a-f0-9]{16,}/gi, '/{id}')
    .replace(/\/\d+(?=\/|$)/g, '/{id}');
}

function classifyZone(hostname, pathname) {
  if (pathname.startsWith('/api/invoicing/v1')) return 'v1_legacy';
  if (pathname.startsWith('/api/v2')) return 'v2';
  if (pathname.startsWith('/api/team/v1')) return 'team';
  if (hostname.includes('holded')) return 'other_holded';
  return 'other';
}

function emptyBucket() {
  return { total: 0, byEndpoint: {}, byZone: {}, byMethod: {} };
}

function createEmptyState() {
  const now = new Date().toISOString();
  return {
    period: currentPeriodKey(),
    planLimit: HOLDED_PLAN_LIMIT,
    session: {
      startedAt: now,
      ...emptyBucket()
    },
    month: emptyBucket(),
    lastCallAt: null,
    updatedAt: now,
    official: null
  };
}

function normalizeOfficialInput(input = {}) {
  const planLimit = Number(input.planLimit) || HOLDED_PLAN_LIMIT;
  const used = Math.max(0, Number(input.used) || 0);
  const remaining = input.remaining != null
    ? Math.max(0, Number(input.remaining))
    : Math.max(0, planLimit - used);
  const percentUsed = input.percentUsed != null
    ? Number(input.percentUsed)
    : (planLimit > 0 ? Math.round((used / planLimit) * 1000) / 10 : 0);

  return {
    period: input.period || currentPeriodKey(),
    planLimit,
    used,
    remaining,
    percentUsed,
    warningMessage: input.warningMessage || '',
    zones: Array.isArray(input.zones) ? input.zones : [],
    endpoints: Array.isArray(input.endpoints) ? input.endpoints : [],
    source: input.source || 'panel_holded_manual',
    capturedAt: input.capturedAt || new Date().toISOString(),
    note: input.note || '',
    localMonthTotalAtCapture: Number(input.localMonthTotalAtCapture) || 0
  };
}

class HoldedApiUsageTracker {
  constructor() {
    this._state = null;
    this._filePath = null;
    this._saveTimer = null;
  }

  _ensureLoaded() {
    if (this._state) return;
    try {
      this._filePath = path.join(app.getPath('userData'), 'holded-api-usage.json');
      if (fs.existsSync(this._filePath)) {
        const raw = fs.readFileSync(this._filePath, 'utf8');
        this._state = JSON.parse(raw);
      }
    } catch (e) {
      console.warn('[HoldedUsage] No se pudo leer contador local:', e.message);
    }
    if (!this._state || typeof this._state !== 'object') {
      this._state = createEmptyState();
    }
    this._rolloverPeriodIfNeeded();
    // Nueva sesión de app
    this._state.session = {
      startedAt: new Date().toISOString(),
      ...emptyBucket()
    };
    this._state.planLimit = HOLDED_PLAN_LIMIT;

    // Semilla snapshot oficial del panel Holded si falta (mismo periodo)
    if (!this._state.official || !this._state.official.used) {
      this._state.official = normalizeOfficialInput({
        ...DEFAULT_OFFICIAL_SNAPSHOT,
        localMonthTotalAtCapture: this._state.month?.total || 0
      });
      this._flush();
    } else if (this._state.official.localMonthTotalAtCapture == null) {
      this._state.official.localMonthTotalAtCapture = this._state.month?.total || 0;
    }
  }

  _rolloverPeriodIfNeeded() {
    const period = currentPeriodKey();
    if (this._state.period !== period) {
      this._state.period = period;
      this._state.month = emptyBucket();
      // Nuevo mes: el snapshot oficial del mes anterior ya no aplica
      if (this._state.official && this._state.official.period !== period) {
        this._state.official = null;
      }
    }
  }

  _inc(bucket, endpoint, zone, method) {
    bucket.total = (bucket.total || 0) + 1;
    bucket.byEndpoint[endpoint] = (bucket.byEndpoint[endpoint] || 0) + 1;
    bucket.byZone[zone] = (bucket.byZone[zone] || 0) + 1;
    bucket.byMethod[method] = (bucket.byMethod[method] || 0) + 1;
  }

  record(url, method = 'GET') {
    try {
      this._ensureLoaded();
      this._rolloverPeriodIfNeeded();

      let pathname = 'unknown';
      let hostname = '';
      try {
        const u = new URL(url);
        pathname = u.pathname;
        hostname = u.hostname;
      } catch (_) {
        pathname = String(url || 'unknown').split('?')[0];
      }

      const endpoint = normalizeEndpoint(pathname);
      const zone = classifyZone(hostname, pathname);
      const m = (method || 'GET').toUpperCase();

      this._inc(this._state.session, endpoint, zone, m);
      this._inc(this._state.month, endpoint, zone, m);
      this._state.lastCallAt = new Date().toISOString();
      this._state.updatedAt = this._state.lastCallAt;
      this._scheduleSave();
    } catch (e) {
      console.warn('[HoldedUsage] Error registrando llamada:', e.message);
    }
  }

  _scheduleSave() {
    if (this._saveTimer) return;
    this._saveTimer = setTimeout(() => {
      this._saveTimer = null;
      this._flush();
    }, 400);
  }

  _flush() {
    try {
      this._ensureLoaded();
      if (!this._filePath) {
        this._filePath = path.join(app.getPath('userData'), 'holded-api-usage.json');
      }
      fs.writeFileSync(this._filePath, JSON.stringify(this._state, null, 2), 'utf8');
    } catch (e) {
      console.warn('[HoldedUsage] No se pudo guardar contador:', e.message);
    }
  }

  /**
   * Actualizar snapshot copiado del panel web de Holded (0 coste API).
   */
  setOfficialSnapshot(input = {}) {
    this._ensureLoaded();
    const monthTotal = this._state.month.total || 0;
    this._state.official = normalizeOfficialInput({
      ...input,
      period: input.period || currentPeriodKey(),
      localMonthTotalAtCapture: monthTotal,
      capturedAt: new Date().toISOString()
    });
    if (input.planLimit) {
      this._state.planLimit = Number(input.planLimit) || HOLDED_PLAN_LIMIT;
    }
    this._state.updatedAt = new Date().toISOString();
    this._flush();
    return this.getSnapshot();
  }

  getSnapshot() {
    this._ensureLoaded();
    this._rolloverPeriodIfNeeded();
    const monthTotal = this._state.month.total || 0;
    const limit = this._state.planLimit || HOLDED_PLAN_LIMIT;
    const remainingLocal = Math.max(0, limit - monthTotal);
    const pctLocal = limit > 0 ? Math.round((monthTotal / limit) * 1000) / 10 : 0;

    const topEndpoints = Object.entries(this._state.month.byEndpoint || {})
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([endpoint, count]) => ({ endpoint, count }));

    const official = this._state.official
      ? normalizeOfficialInput(this._state.official)
      : null;

    // Aprox actual = usado en panel + llamadas Kronos desde que se pegó el snapshot
    let estimated = null;
    if (official) {
      const deltaLocal = Math.max(0, monthTotal - (official.localMonthTotalAtCapture || 0));
      const estimatedUsed = official.used + deltaLocal;
      const estimatedRemaining = Math.max(0, official.planLimit - estimatedUsed);
      const estimatedPct = official.planLimit > 0
        ? Math.round((estimatedUsed / official.planLimit) * 1000) / 10
        : 0;
      estimated = {
        used: estimatedUsed,
        remaining: estimatedRemaining,
        percentUsed: estimatedPct,
        deltaSinceOfficial: deltaLocal,
        planLimit: official.planLimit
      };
    }

    return {
      period: this._state.period,
      planLimit: limit,
      monthTotal,
      remaining: remainingLocal,
      percentUsed: pctLocal,
      sessionTotal: this._state.session.total || 0,
      sessionStartedAt: this._state.session.startedAt,
      lastCallAt: this._state.lastCallAt,
      byZoneMonth: { ...(this._state.month.byZone || {}) },
      byZoneSession: { ...(this._state.session.byZone || {}) },
      topEndpoints,
      filePath: this._filePath,
      official,
      estimated
    };
  }

  resetMonth() {
    this._ensureLoaded();
    this._state.period = currentPeriodKey();
    this._state.month = emptyBucket();
    this._state.updatedAt = new Date().toISOString();
    this._flush();
    return this.getSnapshot();
  }

  resetSession() {
    this._ensureLoaded();
    this._state.session = {
      startedAt: new Date().toISOString(),
      ...emptyBucket()
    };
    this._state.updatedAt = new Date().toISOString();
    this._flush();
    return this.getSnapshot();
  }
}

module.exports = {
  holdedApiUsageTracker: new HoldedApiUsageTracker(),
  HOLDED_PLAN_LIMIT,
  DEFAULT_OFFICIAL_SNAPSHOT
};
