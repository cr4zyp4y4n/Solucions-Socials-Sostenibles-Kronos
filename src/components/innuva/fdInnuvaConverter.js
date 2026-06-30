import { breakdownForDay, formatEuroEs } from './fdHorasLookup';
import { parsePlantillaFdRows, parseCsvText } from './fdPlantillaParser';

export const INNUVA_INCIDENCIAS_HEADERS = [
  'Código',
  'Nombre',
  'Fecha',
  '',
  '1 - Salario Base (Importe)',
  '1 - Salario Base (Unidades)',
  '39 - Mejoras voluntarias (Importe)',
  '39 - Mejoras voluntarias (Unidades)',
  '34 - P.p.extra (Importe)',
  '34 - P.p.extra (Unidades)',
  '122 - Liquidacion vacaciones (Importe)',
  '122 - Liquidacion vacaciones (Unidades)'
];

function formatDateEs(date) {
  if (!date) return '';
  const d = date.getDate();
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function lastDayOfMonth(year, month) {
  return new Date(year, month, 0);
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * @param {Record<string, string>} codigoByWorkerKey mapa opcional nombre normalizado → código Innuva
 */
export function buildInnuvaIncidenciasFromPlantilla(rows, fileName = '', codigoByWorkerKey = {}) {
  const parsed = parsePlantillaFdRows(rows, fileName);
  const warnings = [...parsed.warnings];
  const incidencias = [];
  const previewDays = [];

  for (const worker of parsed.workers) {
    let sb = 0;
    let pp = 0;
    let mej = 0;
    let fin = 0;
    let lastWorkDate = null;

    for (const day of worker.days) {
      const bd = breakdownForDay(day.brutoTotal);
      if (!bd) continue;
      if (bd.warning) warnings.push(`${worker.workerName} (${formatDateEs(day.date)}): ${bd.warning}`);

      sb += bd.salarioBase;
      pp += bd.ppExtra;
      mej += bd.mejoraVoluntaria;
      fin += bd.finiquito;
      lastWorkDate = day.date;

      previewDays.push({
        workerName: worker.workerName,
        fecha: formatDateEs(day.date),
        lugares: day.lugares.join(' · ') || '—',
        brutoDia: day.brutoTotal,
        tramoUsado: bd.tierDevengo,
        salarioBase: bd.salarioBase,
        ppExtra: bd.ppExtra,
        mejoraVoluntaria: bd.mejoraVoluntaria,
        finiquito: bd.finiquito,
        warning: bd.warning
      });
    }

    const unidades = worker.numDias;
    const codigo =
      codigoByWorkerKey[worker.workerKey] ||
      worker.innuvaCode ||
      '';

    if (!codigo) {
      warnings.push(`${worker.workerName}: sin código Innuva (se dejará vacío hasta que lo añadáis).`);
    }

    const fechaNomina = formatDateEs(lastWorkDate || lastDayOfMonth(parsed.year, parsed.month));

    incidencias.push({
      codigo,
      nombre: worker.workerName.toUpperCase(),
      fecha: fechaNomina,
      salarioBaseImporte: round2(sb),
      salarioBaseUnidades: unidades,
      mejoraImporte: round2(mej),
      mejoraUnidades: unidades,
      ppExtraImporte: round2(pp),
      ppExtraUnidades: unidades,
      liquidacionImporte: round2(fin),
      liquidacionUnidades: unidades,
      brutoTotalMes: worker.totalBruto,
      numDias: unidades
    });
  }

  incidencias.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

  return {
    ...parsed,
    incidencias,
    previewDays,
    warnings: [...new Set(warnings)]
  };
}

export function convertPlantillaFileToInnuva(input, fileName, codigoByWorkerKey = {}) {
  const rows = Array.isArray(input)
    ? input.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
    : parseCsvText(input);
  return buildInnuvaIncidenciasFromPlantilla(rows, fileName, codigoByWorkerKey);
}

export function incidenciasToExportRows(incidencias) {
  return incidencias.map((r) => ({
    Código: r.codigo,
    Nombre: r.nombre,
    Fecha: r.fecha,
    '': '',
    '1 - Salario Base (Importe)': formatEuroEs(r.salarioBaseImporte),
    '1 - Salario Base (Unidades)': r.salarioBaseUnidades,
    '39 - Mejoras voluntarias (Importe)': formatEuroEs(r.mejoraImporte),
    '39 - Mejoras voluntarias (Unidades)': r.mejoraUnidades,
    '34 - P.p.extra (Importe)': formatEuroEs(r.ppExtraImporte),
    '34 - P.p.extra (Unidades)': r.ppExtraUnidades,
    '122 - Liquidacion vacaciones (Importe)': formatEuroEs(r.liquidacionImporte),
    '122 - Liquidacion vacaciones (Unidades)': r.liquidacionUnidades
  }));
}
