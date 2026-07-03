const { licitacionsHttpRequest } = require('./licitacionsHttp');
const { getMainSupabaseClient, hasMainSupabaseSession } = require('./licitacionsSupabaseMain');

let serviceModule = null;

function loadLicitacionsService() {
  if (serviceModule) return serviceModule;
  // Webpack empaqueta este módulo ESM al bundle del main process
  serviceModule = require('../services/licitacionsService');
  return serviceModule;
}

/**
 * Sincroniza TED + PSCP + PLACSP y purga caducadas desde el proceso main (sin renderer).
 * Requiere sesión Supabase replicada desde el renderer tras el login.
 */
async function runBackgroundLicitacionsSync(options = {}) {
  if (!hasMainSupabaseSession()) {
    const err = new Error('Sin sesión Supabase en main: inicia sesión al menos una vez con la app abierta');
    err.code = 'NO_SESSION';
    throw err;
  }

  const svc = loadLicitacionsService();
  svc.setLicitacionsHttpClient(licitacionsHttpRequest);
  svc.setLicitacionsSupabaseClient(getMainSupabaseClient());

  const result = await svc.fetchAll({
    limit: 100,
    tedMaxPages: 3,
    purgeCaducadas: true,
    ...options
  });

  return result;
}

module.exports = {
  runBackgroundLicitacionsSync,
  hasMainSupabaseSession
};
