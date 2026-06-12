import { HOLDED_TEAM_ID_LABELS_DEFAULT } from '../constants/holdedTeamIdLabels';

const STORAGE_PREFIX = 'kronos.holdedTeamIdLabels.v1';

function storageKey(company) {
  return `${STORAGE_PREFIX}.${company}`;
}

export function loadHoldedTeamIdLabels(company = 'solucions') {
  const defaults = { ...(HOLDED_TEAM_ID_LABELS_DEFAULT[company] || {}) };
  try {
    const raw = localStorage.getItem(storageKey(company));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return { ...defaults, ...parsed };
      }
    }
  } catch {
    /* ignore */
  }
  return defaults;
}

export function setHoldedTeamIdLabel(company, teamId, label) {
  const current = loadHoldedTeamIdLabels(company);
  if (label) current[String(teamId)] = label;
  else delete current[String(teamId)];
  localStorage.setItem(storageKey(company), JSON.stringify(current));
  return current;
}

/** Mapa id → nombre de equipo para brecha. */
export function getHoldedTeamsMap(company = 'solucions') {
  const labels = loadHoldedTeamIdLabels(company);
  const map = new Map();
  Object.entries(labels).forEach(([id, name]) => {
    if (id && name) map.set(String(id), String(name).trim());
  });
  return map;
}
