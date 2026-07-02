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

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function isNextCalendarDay(prevDate, nextDate) {
  if (!prevDate || !nextDate) return false;
  const expected = new Date(prevDate.getFullYear(), prevDate.getMonth(), prevDate.getDate() + 1);
  return (
    expected.getFullYear() === nextDate.getFullYear() &&
    expected.getMonth() === nextDate.getMonth() &&
    expected.getDate() === nextDate.getDate()
  );
}

/** Agrupa jornadas del mismo trabajador en rachas de días de calendario consecutivos. */
export function groupConsecutiveDayStreaks(days) {
  const sorted = [...(days || [])].sort((a, b) => a.date - b.date);
  const streaks = [];
  let current = null;

  for (const day of sorted) {
    if (!current) {
      current = {
        startDate: day.date,
        endDate: day.date,
        brutoTotal: day.brutoTotal,
        numDias: 1,
        days: [day],
        lugares: [...(day.lugares || [])]
      };
      continue;
    }

    if (isNextCalendarDay(current.endDate, day.date)) {
      current.endDate = day.date;
      current.brutoTotal = round2(current.brutoTotal + day.brutoTotal);
      current.numDias += 1;
      current.days.push(day);
      current.lugares.push(...(day.lugares || []));
    } else {
      streaks.push(current);
      current = {
        startDate: day.date,
        endDate: day.date,
        brutoTotal: day.brutoTotal,
        numDias: 1,
        days: [day],
        lugares: [...(day.lugares || [])]
      };
    }
  }

  if (current) streaks.push(current);
  return streaks;
}

function formatStreakFecha(startDate, endDate) {
  const a = formatDateEs(startDate);
  const b = formatDateEs(endDate);
  return a === b ? a : `${a} → ${b}`;
}

/**
 * @param {Record<string, string>} codigoByWorkerKey mapa opcional nombre normalizado → código Innuva
 */
export function buildInnuvaIncidenciasFromPlantilla(rows, fileName = '', codigoByWorkerKey = {}) {
  const parsed = parsePlantillaFdRows(rows, fileName);
  const warnings = [...parsed.warnings];
  const incidencias = [];
  const previewBlocks = [];
  const resumenPorTrabajador = new Map();

  for (const worker of parsed.workers) {
    const matchedWorker = codigoByWorkerKey[worker.workerKey] || null;
    const codigo =
      matchedWorker?.codigo ||
      worker.innuvaCode ||
      '';
    const nombreExacto =
      matchedWorker?.nombre ||
      worker.workerName.toUpperCase();

    if (!codigo) {
      warnings.push(`${worker.workerName}: sin código Innuva (se dejará vacío hasta que lo añadáis).`);
    }

    const streaks = groupConsecutiveDayStreaks(worker.days);

    for (const streak of streaks) {
      const bd = breakdownForDay(streak.brutoTotal);
      if (!bd) continue;

      const label = formatStreakFecha(streak.startDate, streak.endDate);
      const fechaBloque = formatDateEs(streak.endDate);

      if (bd.warning) {
        warnings.push(`${worker.workerName} (bloque ${label}, ${streak.numDias} día(s)): ${bd.warning}`);
      }

      const fila = {
        codigo,
        nombre: nombreExacto,
        fecha: fechaBloque,
        bloqueLabel: label,
        salarioBaseImporte: round2(bd.salarioBase),
        salarioBaseUnidades: streak.numDias,
        mejoraImporte: round2(bd.mejoraVoluntaria),
        mejoraUnidades: streak.numDias,
        ppExtraImporte: round2(bd.ppExtra),
        ppExtraUnidades: streak.numDias,
        liquidacionImporte: round2(bd.finiquito),
        liquidacionUnidades: streak.numDias,
        brutoBloque: streak.brutoTotal,
        tramoDevengo: bd.tierDevengo,
        numDias: streak.numDias
      };

      incidencias.push(fila);

      previewBlocks.push({
        workerName: worker.workerName,
        fecha: label,
        fechaInnuva: fechaBloque,
        numDias: streak.numDias,
        lugares: [...new Set(streak.lugares)].join(' · ') || '—',
        brutoBloque: streak.brutoTotal,
        tramoUsado: bd.tierDevengo,
        salarioBase: fila.salarioBaseImporte,
        ppExtra: fila.ppExtraImporte,
        mejoraVoluntaria: fila.mejoraImporte,
        finiquito: fila.liquidacionImporte,
        warning: bd.warning
      });

      const prev = resumenPorTrabajador.get(worker.workerKey) || {
        codigo,
        nombre: fila.nombre,
        numDias: 0,
        brutoTotalMes: 0,
        salarioBaseImporte: 0,
        mejoraImporte: 0,
        ppExtraImporte: 0,
        liquidacionImporte: 0,
        numBloques: 0
      };
      prev.numDias += streak.numDias;
      prev.brutoTotalMes = round2(prev.brutoTotalMes + streak.brutoTotal);
      prev.salarioBaseImporte = round2(prev.salarioBaseImporte + fila.salarioBaseImporte);
      prev.mejoraImporte = round2(prev.mejoraImporte + fila.mejoraImporte);
      prev.ppExtraImporte = round2(prev.ppExtraImporte + fila.ppExtraImporte);
      prev.liquidacionImporte = round2(prev.liquidacionImporte + fila.liquidacionImporte);
      prev.numBloques += 1;
      resumenPorTrabajador.set(worker.workerKey, prev);
    }
  }

  incidencias.sort(
    (a, b) => a.nombre.localeCompare(b.nombre, 'es') || String(a.fecha).localeCompare(String(b.fecha), 'es')
  );

  const resumenTrabajadores = Array.from(resumenPorTrabajador.values()).sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es')
  );

  return {
    ...parsed,
    incidencias,
    resumenTrabajadores,
    previewBlocks,
    /** @deprecated Usa previewBlocks */
    previewDays: previewBlocks,
    warnings: [...new Set(warnings)]
  };
}

export function convertPlantillaFileToInnuva(input, fileName, codigoByWorkerKey = {}) {
  const rows = Array.isArray(input)
    ? input.map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
    : parseCsvText(input);
  return buildInnuvaIncidenciasFromPlantilla(rows, fileName, codigoByWorkerKey);
}

function formatEuroCell(value) {
  return formatEuroEs(value);
}

export function incidenciasToExportRows(incidencias) {
  return incidencias.map((r) => ({
    Código: r.codigo,
    Nombre: r.nombre,
    Fecha: r.fecha,
    '': '',
    '1 - Salario Base (Importe)': formatEuroCell(r.salarioBaseImporte),
    '1 - Salario Base (Unidades)': r.salarioBaseUnidades,
    '39 - Mejoras voluntarias (Importe)': formatEuroCell(r.mejoraImporte),
    '39 - Mejoras voluntarias (Unidades)': r.mejoraUnidades,
    '34 - P.p.extra (Importe)': formatEuroCell(r.ppExtraImporte),
    '34 - P.p.extra (Unidades)': r.ppExtraUnidades,
    '122 - Liquidacion vacaciones (Importe)': formatEuroCell(r.liquidacionImporte),
    '122 - Liquidacion vacaciones (Unidades)': r.liquidacionUnidades
  }));
}
