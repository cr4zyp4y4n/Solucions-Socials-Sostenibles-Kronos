/** Reexporta vigència des del mòdul compartit (Electron + Edge). */
export {
  LICITACIONES_CERRADAS,
  daysUntil,
  isLicitacioVigent,
  shouldArchiveLicitacio
} from '../../supabase/functions/_shared/licitacions/vigent.mjs';

/** @deprecated Preferir shouldArchiveLicitacio (T4). */
export { shouldArchiveLicitacio as shouldPurgeLicitacioFromDb } from '../../supabase/functions/_shared/licitacions/vigent.mjs';
