export const LICITACIONES_CERRADAS = new Set(['EV', 'ADJ', 'RES', 'ANUL', 'DES']);

export function daysUntil(dateStr) {
  if (!dateStr) return null;
  const iso = String(dateStr).match(/^(\d{4}-\d{2}-\d{2})/);
  if (!iso) return null;
  const target = new Date(`${iso[1]}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

/** Anuncios previos (PRE), publicados o licitaciones con plazo de oferta aún abierto. */
export function isLicitacioVigent(row) {
  if (!row) return false;
  const code = String(row.estat_contractacio || '').toUpperCase();
  if (LICITACIONES_CERRADAS.has(code)) return false;
  if (code === 'PRE') return true;

  const d = daysUntil(row.termini_oferta);
  if (d != null) return d >= 0;

  if (code === 'PUB') return true;
  return false;
}

function hasSeguimentValue(value) {
  if (value == null) return false;
  return String(value).trim() !== '';
}

export function hasLicitacioSeguiment(row) {
  if (!row) return false;
  const jc = String(row.estat_jc || '').trim();
  if (jc === 'Interessant' || jc === 'Contactat') return true;
  return (
    hasSeguimentValue(row.notes_paula) ||
    hasSeguimentValue(row.data_contacte) ||
    hasSeguimentValue(row.resultat_jc)
  );
}

/** Borrar de BBDD solo caducadas sin seguimiento comercial activo. */
export function shouldPurgeLicitacioFromDb(row) {
  if (!row) return false;
  if (isLicitacioVigent(row)) return false;
  if (hasLicitacioSeguiment(row)) return false;
  return true;
}
