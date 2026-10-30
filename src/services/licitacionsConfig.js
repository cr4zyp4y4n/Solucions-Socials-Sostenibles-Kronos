/**
 * Configuració de filtres de licitacions (taula licitacions_config).
 * La font de veritat del fallback és _shared/licitacions/configFallback.mjs.
 */
export {
  LICITACIONS_CONFIG_FALLBACK,
  parseLicitacionsConfigRows,
  loadLicitacionsConfig
} from '../../supabase/functions/_shared/licitacions/configFallback.mjs';

// Nota: si a BBDD hi ha placsp_max_pages=60 / PLACSP_MENORS=true del seed SQL,
// el sync pot anar lent. El fallback nou (12 pàgines, menors off) només aplica
// si la clau no existeix o es canvia des de la UI Config.
