/**
 * Nóminas Holded API v1 (header `key`).
 * Empleados: team/v1. Nóminas: módulo payroll (si responde JSON) o team/v1/employees/payrolls por empleado.
 */
import { holdedRequest } from './holdedHttpClient';

const TEAM_V1_BASE = 'https://api.holded.com/api/team/v1';
const PAYROLL_V1_BASE = 'https://api.holded.com/api/payroll/v1';

function extractList(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.data)) return payload.data;
  if (Array.isArray(payload.payslips)) return payload.payslips;
  if (Array.isArray(payload.payrolls)) return payload.payrolls;
  if (Array.isArray(payload.items)) return payload.items;
  if (Array.isArray(payload.employees)) return payload.employees;
  return [];
}

function payslipYear(p, fallbackYear) {
  const y = p?.year ?? p?.fiscalYear;
  if (y) return Number(y);
  const d = p?.date ?? p?.payDate ?? p?.createdAt ?? p?.startDate;
  if (d) {
    const n = typeof d === 'number' && d < 1e12 ? new Date(d * 1000) : new Date(d);
    if (!Number.isNaN(n.getTime())) return n.getFullYear();
  }
  const m = p?.month;
  if (m && typeof m === 'string' && m.length >= 4) return Number.parseInt(m.slice(0, 4), 10);
  return fallbackYear;
}

function filterByYear(list, year) {
  const filtered = (list || []).filter((p) => payslipYear(p, year) === year);
  return filtered.length ? filtered : list || [];
}

async function fetchPagedV1(baseUrl, path, company) {
  let all = [];
  let page = 1;
  const limit = 100;
  for (let guard = 0; guard < 80; guard++) {
    const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
    const data = await holdedRequest({ baseUrl, endpoint: `${path}?${qs}`, company });
    const batch = extractList(data);
    if (!batch.length) break;
    all = all.concat(batch);
    if (batch.length < limit) break;
    page += 1;
  }
  return all;
}

/** Nóminas de un empleado (team/v1 — módulo nóminas, no ficha empleado). */
async function fetchPayrollsForEmployee(employeeId, year, company) {
  const qs = new URLSearchParams({ employeeId: String(employeeId), year: String(year) });
  const data = await holdedRequest({
    baseUrl: TEAM_V1_BASE,
    endpoint: `/employees/payrolls?${qs}`,
    company
  });
  return extractList(data);
}

class HoldedPayrollV1Service {
  /**
   * @param {number} year
   * @param {string} company
   * @param {{ id: string }[]} [employees] — si se pasan, se consulta team/v1/employees/payrolls por cada uno
   */
  async getPayslipsForYear(year, company = 'solucions', employees = []) {
    const errors = [];

    for (const { base, path } of [
      { base: PAYROLL_V1_BASE, path: '/payslips' },
      { base: PAYROLL_V1_BASE, path: '/payslip' }
    ]) {
      try {
        const withYear = await holdedRequest({
          baseUrl: base,
          endpoint: `${path}?year=${year}&page=1&limit=100`,
          company
        });
        const list = filterByYear(extractList(withYear), year);
        if (list.length) return { list, endpoint: `${base}${path}` };
      } catch (e) {
        errors.push(`${base}${path}: ${e.message}`);
        if (e.status === 403) throw e;
      }
      try {
        const all = filterByYear(await fetchPagedV1(base, path, company), year);
        if (all.length) return { list: all, endpoint: `${base}${path}` };
      } catch (e) {
        errors.push(`${base}${path} (paged): ${e.message}`);
      }
    }

    if (employees?.length) {
      const all = [];
      let ok = 0;
      for (const emp of employees) {
        const eid = String(emp?.id || '').trim();
        if (!eid) continue;
        try {
          const batch = filterByYear(await fetchPayrollsForEmployee(eid, year, company), year);
          if (batch.length) {
            ok += 1;
            for (const p of batch) {
              all.push({ ...p, employeeId: p.employeeId ?? p.employee_id ?? eid });
            }
          }
        } catch (e) {
          const msg = e?.message || String(e);
          if (!msg.includes('employeeId not found')) errors.push(`${eid}: ${msg}`);
        }
      }
      if (all.length) {
        return {
          list: all,
          endpoint: `team/v1/employees/payrolls (${ok}/${employees.length} empleados con nómina)`
        };
      }
    }

    const err = new Error(
      errors.join(' | ') ||
        'Nóminas v1 no disponibles (Holded no expone listado global o employeeId no reconocido). Usa CSV de nóminas.'
    );
    err.status = 404;
    throw err;
  }
}

const holdedPayrollV1Service = new HoldedPayrollV1Service();
export default holdedPayrollV1Service;
