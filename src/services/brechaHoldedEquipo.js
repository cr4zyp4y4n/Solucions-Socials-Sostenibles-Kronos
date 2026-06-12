import { categoriaFromHoldedEquipo, inferCategoriaFuncion } from '../constants/brechaSalarialCategories';
import { getHoldedTeamsMap } from './holdedTeamIdLabelsStorage';

function normKey(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function fromCustomFields(customFields) {
  if (!customFields) return '';
  if (Array.isArray(customFields)) {
    const hit = customFields.find((f) => {
      const key = normKey(f?.name ?? f?.key ?? f?.label ?? f?.field);
      return key === 'equipo' || key === 'team' || key.includes('equip');
    });
    return String(hit?.value ?? hit?.text ?? '').trim();
  }
  if (typeof customFields === 'object') {
    return String(
      customFields.equipo ??
        customFields.Equipo ??
        customFields.team ??
        customFields.Team ??
        ''
    ).trim();
  }
  return '';
}

/**
 * Mapa teamId → nombre (Holded no tiene GET /teams en team/v1).
 */
export async function loadHoldedTeamsMap(company = 'solucions') {
  return getHoldedTeamsMap(company);
}

/**
 * Obté el nom d'equip del treballador (prioritat: teamIds + mapa configurat).
 */
export function extractEquipoHolded(employee, teamsMap = new Map()) {
  if (!employee || typeof employee !== 'object') return '';

  const ids = employee.teamIds ?? employee.teamId ?? employee.teamsId;
  const idList = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
  for (const id of idList) {
    const name = teamsMap.get(String(id));
    if (name) return name;
  }

  const direct = [
    employee.equipo,
    employee.Equipo,
    employee.team,
    employee.teamName,
    employee.team_name,
    employee.group,
    employee.department
  ]
    .map((v) => String(v || '').trim())
    .find(Boolean);
  if (direct) return direct;

  if (Array.isArray(employee.teams) && employee.teams.length) {
    const t0 = employee.teams[0];
    if (typeof t0 === 'string') return t0.trim();
    if (t0 && typeof t0 === 'object') {
      return String(t0.name ?? t0.title ?? t0.label ?? '').trim();
    }
  }

  const cf = fromCustomFields(employee.customFields ?? employee.custom_fields);
  if (cf) return cf;

  return '';
}

/** teamIds sense etiqueta al mapa (per avisos / UI de configuració). */
export function findUnmappedHoldedTeamIds(employees, teamsMap = new Map()) {
  const counts = new Map();
  for (const emp of employees || []) {
    const raw = emp?.raw || emp;
    const ids = raw?.teamIds ?? emp?.teamIds;
    const list = Array.isArray(ids) ? ids : ids != null ? [ids] : [];
    for (const id of list) {
      const sid = String(id);
      if (!teamsMap.has(sid)) {
        counts.set(sid, (counts.get(sid) || 0) + 1);
      }
    }
  }
  return [...counts.entries()].map(([id, count]) => ({ id, count }));
}

/**
 * Categoria per a brecha: equip Holded (prioritari) o fallback puesto/dept.
 */
export function resolveCategoriaFuncion({ equipoHolded, puesto = '', departamento = '' }) {
  const fromEquipo = categoriaFromHoldedEquipo(equipoHolded);
  if (fromEquipo) return { categoria: fromEquipo, source: 'holded_equipo' };
  return { categoria: inferCategoriaFuncion(puesto, departamento), source: 'inferido' };
}
