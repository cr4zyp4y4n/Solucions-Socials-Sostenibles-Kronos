import holdedPayrollV1Service from './holdedPayrollV1Service';
import holdedEmployeesService from './holdedEmployeesService';
import { mergeNominasCsvIntoRows } from './brechaNominasCsvService';
import {
  BRECHA_CATEGORIA_ORDER,
  BRECHA_SEMANAS_ANUAL,
  BRECHA_SEMANAS_MES
} from '../constants/brechaSalarialCategories';
import { resolveCategoriaFuncion } from './brechaHoldedEquipo';
import {
  loadBrechaCategoriasSupabase,
  resolveCategoriaDesdeSupabase
} from './brechaCategoriaSupabaseService';

const GENDER_LABEL = {
  male: 'Hombre',
  m: 'Hombre',
  hombre: 'Hombre',
  h: 'Hombre',
  female: 'Mujer',
  f: 'Mujer',
  mujer: 'Mujer',
  woman: 'Mujer'
};

export function normalizeGender(raw) {
  const key = String(raw || '')
    .trim()
    .toLowerCase();
  if (!key) return 'Sin especificar';
  return GENDER_LABEL[key] || (key.includes('muj') || key.includes('fem') ? 'Mujer' : key.includes('hom') || key.includes('mal') ? 'Hombre' : 'Sin especificar');
}

/** Import retributiu anual segons RD 902 (nòmina IT: brut − complement SS). */
export function payrollRecordAmount(record) {
  let amount = Number(record?.grossAmount ?? record?.gross ?? record?.amount ?? 0);
  if (!Number.isFinite(amount)) amount = 0;
  const contingency = String(record?.contingencyType || record?.contingency_type || 'normal').toLowerCase();
  if (contingency === 'it') {
    const comp = Number(record?.socialSecurityComplement ?? record?.social_security_complement ?? 0);
    if (Number.isFinite(comp)) amount -= comp;
  }
  return Math.max(0, amount);
}

function annualizeContractSalary(salary, interval) {
  const n = Number(salary);
  if (!Number.isFinite(n) || n <= 0) return 0;
  const iv = String(interval || '').toLowerCase();
  if (iv.includes('month') || iv.includes('mes') || iv === 'm') return n * 12;
  if (iv.includes('week') || iv.includes('setman')) return n * 52;
  if (iv.includes('day') || iv.includes('dia')) return n * 365;
  if (iv.includes('year') || iv.includes('anual')) return n;
  // Holded team v1: sense interval → salari mensual si < 25.000 €
  if (!iv && n < 25000) return n * 12;
  return n;
}

function inferHorasSemanales(emp) {
  const candidates = [
    emp?.contratoHoras,
    emp?.raw?.currentContract?.scheduleHours,
    emp?.raw?.workingHours,
    emp?.raw?.weeklyHours
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0 && n <= 60) return n;
  }
  return 40;
}

function enrichBrechaRow(base) {
  const horasSemana = inferHorasSemanales(base);
  const horasTrabajadas = Math.round(horasSemana * BRECHA_SEMANAS_ANUAL * 10) / 10;
  const horasMes = Math.round(horasSemana * BRECHA_SEMANAS_MES * 10) / 10;
  const salarioAnual = base.salarioAnual || 0;
  const salarioBrutoMensual =
    base.salarioBrutoMensual > 0
      ? base.salarioBrutoMensual
      : salarioAnual > 0
        ? Math.round((salarioAnual / 12) * 100) / 100
        : 0;
  const devengoHora =
    salarioAnual > 0 && horasTrabajadas > 0
      ? Math.round((salarioAnual / horasTrabajadas) * 100) / 100
      : 0;
  const jornadaLabel = horasSemana >= 40 ? '40H' : horasSemana >= 35 ? '35H' : `${Math.round(horasSemana)}H`;
  let categoriaFuncion = base.categoriaFuncion;
  let categoriaSource = base.categoriaSource;
  if (!categoriaFuncion) {
    const cat = resolveCategoriaFuncion({
      equipoHolded: base.equipoHolded,
      puesto: base.puesto,
      departamento: base.departamento
    });
    categoriaFuncion = cat.categoria;
    categoriaSource = cat.source;
  }
  return {
    ...base,
    categoriaFuncion,
    categoriaSource,
    horasSemana,
    horasTrabajadas,
    horasMes,
    jornadaLabel,
    salarioBrutoMensual,
    devengoHora
  };
}

function getCurrentContractFromRaw(raw) {
  const cc = raw?.currentContract;
  if (!cc) return null;
  if (Array.isArray(cc)) return cc.length ? cc[cc.length - 1] : null;
  if (typeof cc === 'object') return cc;
  return null;
}

function contractFieldsFromEmployee(emp) {
  const raw = emp?.raw || emp;
  const cc = getCurrentContractFromRaw(raw);
  if (cc && cc.salary != null) {
    return {
      contratoSalario: cc.salary,
      contratoSalarioIntervalo: String(cc.salaryInterval || ''),
      contratoHoras: cc.scheduleHours ?? emp.contratoHoras
    };
  }
  return {
    contratoSalario: emp.contratoSalario ?? null,
    contratoSalarioIntervalo: emp.contratoSalarioIntervalo || '',
    contratoHoras: emp.contratoHoras
  };
}

/** Normalitza payslip v1 al format comú. */
export function normalizePayrollEntry(pr) {
  const empRef = pr?.employee;
  const employeeId = String(
    pr?.employeeId ??
      pr?.employee_id ??
      (typeof empRef === 'string' ? empRef : empRef?.id) ??
      pr?.userId ??
      ''
  );
  const grossAmount =
    pr?.grossAmount ??
    pr?.gross ??
    pr?.totalGross ??
    pr?.bruto ??
    pr?.total ??
    pr?.amount ??
    0;
  return {
    employeeId,
    grossAmount,
    contingencyType: pr?.contingencyType ?? pr?.contingency_type ?? 'normal',
    socialSecurityComplement:
      pr?.socialSecurityComplement ?? pr?.social_security_complement ?? 0
  };
}

function payrollMonthKey(pr, fallbackYear) {
  const y = Number(pr?.year ?? pr?.fiscalYear ?? fallbackYear);
  const m = Number(pr?.month ?? pr?.payrollMonth);
  if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
    return `${y}-${String(m).padStart(2, '0')}`;
  }
  const d = pr?.date ?? pr?.payDate ?? pr?.createdAt;
  if (d) {
    const dt = new Date(d);
    if (!Number.isNaN(dt.getTime())) {
      return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    }
  }
  return null;
}

/**
 * Media del brut mensual de cada mes amb nòmina a l'any (no l'últim mes ni suma simple).
 */
export function buildPayrollMonthlyAverageByEmployee(payrolls, year) {
  const byEmp = new Map();

  for (const pr of payrolls || []) {
    const norm = normalizePayrollEntry(pr);
    if (!norm.employeeId) continue;
    const mk = payrollMonthKey(pr, year);
    if (mk && Number.parseInt(mk.slice(0, 4), 10) !== year) continue;

    const amount = payrollRecordAmount(norm);
    if (amount <= 0) continue;

    if (!byEmp.has(norm.employeeId)) byEmp.set(norm.employeeId, new Map());
    const months = byEmp.get(norm.employeeId);
    const key = mk || `u${months.size}`;
    const prev = months.get(key) || 0;
    months.set(key, prev + amount);
  }

  const result = new Map();
  for (const [eid, monthsMap] of byEmp) {
    const monthlyTotals = [...monthsMap.values()];
    if (!monthlyTotals.length) continue;
    const mediaMensual =
      Math.round((monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length) * 100) / 100;
    result.set(eid, {
      mediaMensual,
      mesesNomina: monthlyTotals.length,
      salarioAnual: Math.round(mediaMensual * 12 * 100) / 100
    });
  }
  return result;
}

/** Agrupa nóminas por id Holded del empleado; si el id no cuadra, enlaza por DNI. */
export function buildPayrollByEmployeeMap(payrolls, employees, year) {
  const byId = buildPayrollMonthlyAverageByEmployee(payrolls, year);
  const dniToId = new Map();
  for (const e of employees) {
    const dni = String(e.dni || '').replace(/\s/g, '').toUpperCase();
    if (dni) dniToId.set(dni, e.id);
  }
  const extra = [];
  for (const pr of payrolls || []) {
    const prDni = String(pr?.employeeDni ?? pr?.dni ?? pr?.nif ?? pr?.code ?? '').replace(/\s/g, '').toUpperCase();
    const eid = dniToId.get(prDni);
    if (!eid || byId.has(eid)) continue;
    extra.push({ ...pr, employeeId: eid });
  }
  if (!extra.length) return byId;
  const merged = buildPayrollMonthlyAverageByEmployee(extra, year);
  for (const [eid, info] of merged) byId.set(eid, info);
  return byId;
}

/** Ordre de la taula: DIRECCIÓ → TECNIC → ADMINISTRACIÓ → CATERING → OTROS, després per nom. */
export function sortBrechaRowsByCategoria(rows) {
  const catIndex = (c) => {
    const i = BRECHA_CATEGORIA_ORDER.indexOf(c);
    return i >= 0 ? i : BRECHA_CATEGORIA_ORDER.length;
  };
  return [...(rows || [])].sort((a, b) => {
    const d = catIndex(a.categoriaFuncion) - catIndex(b.categoriaFuncion);
    if (d !== 0) return d;
    return String(a.nombreCompleto || '').localeCompare(String(b.nombreCompleto || ''), 'ca');
  });
}

export async function buildBrechaDataset({
  company = 'solucions',
  year,
  soloActivos = true,
  useV2 = false,
  nominasCsvMap = null,
  categoriaOverrides = null
}) {
  let employees = [];
  let payrolls = [];
  const warnings = [];
  let dataSource = 'holded_team_v1';

  const supabaseCats = await loadBrechaCategoriasSupabase(company);
  if (supabaseCats.error) {
    warnings.push(
      `Categorías Supabase no disponibles (${supabaseCats.error}). Ejecuta database/create_brecha_empleados_categoria.sql en Supabase.`
    );
  } else if (!supabaseCats.registros.length) {
    warnings.push('No hay categorías en Supabase para esta empresa. Añade filas en brecha_empleados_categoria.');
  }

  if (useV2) {
    warnings.push('v2 desactivada en brecha; se usa solo API v1 (team + nóminas).');
  }

  const legacy = await holdedEmployeesService.getEmployeesTransformed(company);
  employees = legacy.map((emp) => {
    const raw = emp.raw || emp;
    const contract = contractFieldsFromEmployee({ ...emp, raw });
    return {
      id: emp.id,
      nombreCompleto: emp.nombreCompleto,
      dni: emp.dni,
      genero: normalizeGender(emp.genero),
      equipoHolded: '',
      departamento: emp.departamento || emp.departamentoLegacy || '',
      puesto: emp.puesto || emp.puestoLegacy || '',
      activo: emp.activo,
      contratoSalario: contract.contratoSalario,
      contratoSalarioIntervalo: contract.contratoSalarioIntervalo,
      contratoHoras: contract.contratoHoras,
      raw
    };
  });

  try {
    const { list: paysV1, endpoint } = await holdedPayrollV1Service.getPayslipsForYear(
      year,
      company,
      employees
    );
    if (paysV1.length) {
      payrolls = paysV1;
      dataSource = 'holded_team_v1_payroll';
      warnings.push(`Nóminas v1: ${paysV1.length} registros (${endpoint}).`);
    }
  } catch (v1Err) {
    warnings.push(
      v1Err?.message?.includes('employeeId not found')
        ? 'Nóminas: Holded no devuelve nóminas por API para estos empleados (Bruno/Joan suelen ir sin contrato en team/v1). Sube CSV de nóminas o revisa permisos módulo Nóminas en Holded.'
        : `Nóminas v1: ${v1Err?.message || v1Err}. Puedes importar CSV de brutos.`
    );
  }

  const payrollByEmp = buildPayrollByEmployeeMap(payrolls, employees, year);
  let rows = employees.map((emp, idx) => {
    const payrollInfo = payrollByEmp.get(emp.id);
    const fromContract = annualizeContractSalary(emp.contratoSalario, emp.contratoSalarioIntervalo);
    const salarioAnual = payrollInfo?.salarioAnual > 0 ? payrollInfo.salarioAnual : fromContract;
    const salarioBrutoMensual =
      payrollInfo?.mediaMensual > 0
        ? payrollInfo.mediaMensual
        : fromContract > 0
          ? Math.round((fromContract / 12) * 100) / 100
          : 0;
    const origen = payrollInfo?.salarioAnual
      ? `Nóminas ${year} (media ${payrollInfo.mesesNomina} meses)`
      : fromContract > 0
        ? 'Contrato'
        : 'Sin dato';
    const sup = resolveCategoriaDesdeSupabase(
      { id: emp.id, nombreCompleto: emp.nombreCompleto },
      supabaseCats
    );
    return enrichBrechaRow({
      numero: idx + 1,
      id: emp.id,
      nombreCompleto: emp.nombreCompleto,
      dni: emp.dni,
      genero: emp.genero,
      departamento: emp.departamento,
      puesto: emp.puesto,
      equipoHolded: sup?.categoria || '',
      categoriaFuncion: sup?.categoria,
      categoriaSource: sup?.source,
      salarioAnual: Math.round(salarioAnual * 100) / 100,
      salarioBrutoMensual,
      mesesNomina: payrollInfo?.mesesNomina ?? 0,
      origenDato: origen,
      activo: emp.activo,
      contratoHoras: emp.contratoHoras,
      raw: emp.raw
    });
  });

  if (soloActivos) rows = rows.filter((r) => r.activo !== false);

  if (nominasCsvMap?.size) {
    const { rows: mergedRows, merged } = mergeNominasCsvIntoRows(rows, nominasCsvMap);
    rows = mergedRows;
    if (merged) warnings.push(`${merged} salario(s) actualizados desde CSV de nóminas.`);
  }

  if (categoriaOverrides && typeof categoriaOverrides === 'object') {
    rows = rows.map((r) => {
      const cat = categoriaOverrides[r.id];
      if (!cat) return r;
      return { ...r, categoriaFuncion: cat, categoriaSource: 'manual' };
    });
  }

  const sinCategoriaDb = rows.filter(
    (r) => !r.categoriaSource || !String(r.categoriaSource).startsWith('supabase')
  ).length;
  if (sinCategoriaDb && supabaseCats.registros.length) {
    warnings.push(
      `${sinCategoriaDb} empleado(s) sin categoría en Supabase — añade su nombre en la tabla brecha_empleados_categoria o asígnalo en la tabla.`
    );
  }

  const conGenero = rows.filter((r) => r.genero === 'Hombre' || r.genero === 'Mujer');
  const conSalario = rows.filter((r) => r.salarioAnual > 0);
  const desdeNomina = rows.filter((r) => r.origenDato?.includes('Nóminas')).length;
  const desdeContrato = rows.filter((r) => r.origenDato === 'Contrato').length;

  if (desdeContrato > 0 && !payrolls.length) {
    warnings.push(
      `${desdeContrato} empleado(s) usan salario de contrato (sin nóminas API). Revisa que el importe sea anual.`
    );
  }

  rows = sortBrechaRowsByCategoria(rows);

  return {
    rows,
    meta: {
      company,
      year,
      dataSource,
      categoriasSupabase: supabaseCats.registros.length,
      totalEmpleados: rows.length,
      conGenero: conGenero.length,
      conSalario: conSalario.length,
      desdeNomina,
      desdeContrato,
      payrollRecords: payrolls.length
    },
    warnings
  };
}

/** Solo filas con retribución > 0 (no exportar a Excel). */
export function filterRowsForBrechaExport(rows) {
  return (rows || [])
    .filter((r) => {
      const anual = Number(r.salarioAnual) || 0;
      return anual > 0;
    })
    .map((r, i) => ({ ...r, numero: i + 1 }));
}

export function computeBrechaStats(rows) {
  const eligible = (rows || []).filter(
    (r) => (r.genero === 'Hombre' || r.genero === 'Mujer') && r.salarioAnual > 0
  );
  const byGender = (g) => eligible.filter((r) => r.genero === g).map((r) => r.salarioBrutoMensual ?? r.salarioAnual / 12);
  const hombres = byGender('Hombre');
  const mujeres = byGender('Mujer');
  const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);
  const median = (arr) => {
    if (!arr.length) return 0;
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  const mediaH = avg(hombres);
  const mediaM = avg(mujeres);
  const medianaH = median(hombres);
  const medianaM = median(mujeres);
  const brechaMediaPct = mediaH > 0 ? ((mediaH - mediaM) / mediaH) * 100 : null;
  const brechaMedianaPct = medianaH > 0 ? ((medianaH - medianaM) / medianaH) * 100 : null;
  return {
    plantillaHombres: hombres.length,
    plantillaMujeres: mujeres.length,
    mediaHombres: mediaH,
    mediaMujeres: mediaM,
    medianaHombres: medianaH,
    medianaMujeres: medianaM,
    brechaMediaPct,
    brechaMedianaPct
  };
}
