import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { useTheme } from './ThemeContext';
import { loadPigBaseMensual } from '../services/pigBasesHistoricasService';
import {
  estimadosToSlots,
  loadPigEstimadosSubvencion,
  PIG_ESTIMADOS_DEFAULTS,
  PIG_ESTIMADO_MONTH_OPTIONS,
  upsertPigEstimadosSubvencion
} from '../services/pigEstimadosSubvencionService';
import {
  loadPigObjetivosComparativa,
  PIG_OBJETIVOS_DEFAULTS,
  upsertPigObjetivosComparativa
} from '../services/pigObjetivosComparativaService';
import {
  loadPigCateringBudgetMonthsByDueDate,
  mergeCateringBaseWithHoldedBudgets
} from '../services/pigCateringHoldedEstimatesService';
import {
  isPigEstructuraLineaCuenta,
  isPigEstructuraSubv740Cuenta,
  PIG_ESTRUCTURA_SUBV_740_ACCOUNT_CODES
} from '../services/pigEstructuraPurchasesService';
import {
  buildPigTesoreriaSheetAoa,
  loadPigTreasuryAccounts,
  TESORERIA_RIGHT_COL
} from '../services/pigTesoreriaService';
import {
  buildPigPresupuestosSheetAoa,
  loadPigPresupuestosPendientes
} from '../services/pigPresupuestosService';
import {
  buildPigFacturacionPendienteSheetAoa,
  loadPigFacturacionPendiente
} from '../services/pigFacturacionPendienteService';
import SectionHeader from './SectionHeader';
import {
  applyPigComparativaCuentaResultadosFormulas,
  applyPigDespesesMpFormulas,
  applyPigFacturacionCuentaResultadosFormulas,
  applyPigGastosCuentaResultadosFormulas,
  applyPigGeneralCuentaResultadosFormulas,
  applyPigLineaCuentaResultadosFormulas,
  applyPigPresupuestosCuentaResultadosFormulas,
  applyPigTesoreriaCuentaResultadosFormulas
} from '../utils/pigExcelFormulas';

function parseEuroNumber(input) {
  if (input === null || input === undefined) return 0;
  const s0 = String(input).replace(/\u00a0/g, ' ').trim(); // NBSP → space
  if (!s0) return 0;
  // Holded a veces usa "-   €" o "$ -"
  if (/^-\s*€?$/.test(s0) || s0.includes('-   €') || s0 === '-' || /\$\s*-\s*/.test(s0)) return 0;

  const hasParens = /\(.*\)/.test(s0);
  const hasLeadingMinus = /^\s*-/.test(s0);
  const negative = hasLeadingMinus || hasParens;

  // Normalizar: quitar símbolos, espacios, comillas y paréntesis
  const s = s0
    .replace(/["']/g, '')
    .replace(/[€$]/g, '')
    .replace(/\(|\)/g, '')
    .replace(/\s/g, '')
    .trim();

  // Formatos típicos ES: 45.436,17  /  10.000,00
  // También puede venir ya como 10000.00 (raro pero posible)
  const normalized = (() => {
    // Si hay coma y punto, decidir decimal por el último separador.
    // Ej XLSX (US): 10,000.00  => '.' decimal, ',' miles
    // Ej CSV (ES): 10.000,00   => ',' decimal, '.' miles
    if (s.includes(',') && s.includes('.')) {
      const lastComma = s.lastIndexOf(',');
      const lastDot = s.lastIndexOf('.');
      if (lastDot > lastComma) {
        // '.' decimal (US): quitar comas miles
        return s.replace(/,/g, '').replace(/[^0-9.\-]/g, '');
      }
      // ',' decimal (ES): quitar puntos miles y cambiar ',' por '.'
      return s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    }
    // Si hay coma (sin punto), asumimos coma decimal (ES)
    if (s.includes(',')) {
      return s.replace(/\./g, '').replace(',', '.').replace(/[^0-9.\-]/g, '');
    }
    // Sin coma: puede venir como "10.000" (miles) o "10000.00" (decimal)
    const sClean = s.replace(/[^0-9.\-]/g, '');
    const dots = (sClean.match(/\./g) || []).length;
    if (dots >= 2) {
      // 1.234.567 => miles
      return sClean.replace(/\./g, '');
    }
    if (dots === 1) {
      const [a, b] = sClean.split('.');
      // 10.000 => miles (grupo de 3)
      if (b && b.length === 3) return `${a}${b}`.replace(/[^0-9\-]/g, '');
      // 10000.00 => decimal
      return sClean;
    }
    return sClean;
  })();

  const n = Number.parseFloat(normalized);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function isLikelyLabelCell(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  // Ej: "1. Ingresos..." "A.1) ..." "Venta y otros..."
  return /[a-zA-ZÀ-ÿ]/.test(t);
}

function pigAccountOrderKey(c) {
  // Orden preferido en hojas PIG LINEA:
  // 1) Ingresos y subvenciones (70x/74x/75x...)
  // 2) Compras / aprovisionamientos (grupo 6, 60x/602/607)
  // 3) Resto de gastos (62x/64x/65x/66x..., grupos 8/9/15...)
  const code = String(c?.code || '');
  const group = String(c?.groupLabel || '');
  const n = Number.parseInt(code, 10);

  const isCompras =
    group.startsWith('6.') ||
    (Number.isFinite(n) && n >= 60000000 && n < 61000000) ||
    code.startsWith('600') ||
    code.startsWith('602') ||
    code.startsWith('607');

  const isIngresos =
    group.startsWith('1.') ||
    group.startsWith('2.') ||
    group.startsWith('7.') ||
    code.startsWith('700') ||
    code.startsWith('740') ||
    code.startsWith('759');

  if (isIngresos) return [0, code];
  if (isCompras) return [1, code];
  return [2, code];
}

function pigAccountCompare(a, b) {
  const ka = pigAccountOrderKey(a);
  const kb = pigAccountOrderKey(b);
  if (ka[0] !== kb[0]) return ka[0] - kb[0];
  return String(ka[1]).localeCompare(String(kb[1]));
}

function isPigSubvCuenta(c) {
  const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
  const code = String(c?.code || '');
  return hay.includes('subv') || code.startsWith('740');
}

function filterCuentasSinSubvenciones(cuentas = []) {
  return (cuentas || []).filter((c) => !isPigSubvCuenta(c));
}

function isPigGeneralSubvencionLabel(label) {
  const n = normalizePigLabel(label);
  return (
    n.includes('subvenc') ||
    n.includes('donaciones y legados de capital') ||
    n.includes('donaciones y legados de capital traspasados')
  );
}

function inferYearSuffix2({ title, months }) {
  // Intenta inferir el año (2 dígitos) desde el título (01/01/26) o desde el primer mes ("Gener 26").
  const t = String(title || '');
  const mTitle = t.match(/01\/01\/(\d{2})/);
  if (mTitle?.[1]) return mTitle[1];

  const m0 = String((months && months[0]) || '').trim();
  const mMonth = m0.match(/\b(\d{2})\b/);
  if (mMonth?.[1]) return mMonth[1];

  return '';
}

// KOIKI 2026: factura SEUR de febrero contabilizada en marzo en Holded.
const KOIKI_SEUR_OVERRIDE_2026 = {
  accountCode: '70030003',
  months: {
    1: 2017.11, // Febrero
    2: 1236.51 // Marzo
  }
};

// KOIKI 2026: estimado subvención (març, abril, maig) — valores fijos acordados.
const KOIKI_ESTIMADO_SUBV_OVERRIDE_2026 = {
  months: {
    2: 900.57, // Març
    3: 786, // Abril
    4: 1001.53 // Maig
  }
};

function applyKoikiEstimadoSubvOverrides2026(estimadosSlots = [], year) {
  if (Number(year) !== 2026) return estimadosSlots || [];
  const overrides = KOIKI_ESTIMADO_SUBV_OVERRIDE_2026.months;
  const slots = [...(estimadosSlots || [])];
  let slot1Idx = slots.findIndex((entry) => Number(entry.slot) === 1);

  if (slot1Idx < 0) {
    slots.push({ slot: 1, months: new Array(12).fill(0) });
    slot1Idx = slots.length - 1;
  }

  const months = [...(slots[slot1Idx].months || new Array(12).fill(0))];
  while (months.length < 12) months.push(0);
  for (const [idx, amount] of Object.entries(overrides)) {
    months[Number(idx)] = amount;
  }
  slots[slot1Idx] = { ...slots[slot1Idx], slot: 1, months };

  return slots.sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0));
}

const PIG_LINEA_KOIKI_OBS_COL = 17;
const PIG_LINEA_KOIKI_OBS_LINES = [
  [2, 'OBSERVACIONES'],
  [3, 'Se tiene en cuenta solo David, en caso de que aprueben su subv.'],
  [4, 'Esta subv. Corresponde al periodo 01/04/25 al 31/08/25, se imputa en los 12 meses de 2.026'],
  [5, 'La factura de Febrero, esta registrada contablemente en marzo']
];

function isKoikiSeurCuenta(c) {
  const code = String(c?.code || '').trim();
  return code === KOIKI_SEUR_OVERRIDE_2026.accountCode || code.startsWith('70030003');
}

function applyKoikiSeurOverrides2026(cuentas, year) {
  if (Number(year) !== 2026) return cuentas || [];
  return (cuentas || []).map((c) => {
    if (!isKoikiSeurCuenta(c)) return c;
    const months = [...(c.months || new Array(12).fill(0))];
    while (months.length < 12) months.push(0);
    months[1] = KOIKI_SEUR_OVERRIDE_2026.months[1];
    months[2] = KOIKI_SEUR_OVERRIDE_2026.months[2];
    return { ...c, months };
  });
}

function inferYearFullFromPigTitle(title, months) {
  const yy = inferYearSuffix2({ title, months });
  return yy ? Number(`20${yy}`) : null;
}

function splitHoldedCsv(text) {
  const raw = String(text || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const lines = raw.split('\n');

  // Detectar delimitador (Holded puede exportar con ; o con ,)
  const sample = lines.find((l) => l && (l.includes(';') || l.includes(','))) || '';
  // IMPORTANTE: si existe ';', preferimos ';' siempre.
  // En números procedentes de XLSX -> CSV pueden aparecer comas (10,000.00) y romper el auto-detect.
  const delim = sample.includes(';') ? ';' : ',';

  const parseLine = (line) => {
    const out = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        // CSV estándar: "" dentro de comillas = "
        const next = line[i + 1];
        if (inQuotes && next === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (!inQuotes && ch === delim) {
        out.push(cur.trim());
        cur = '';
        continue;
      }
      cur += ch;
    }
    out.push(cur.trim());
    return out;
  };

  return lines.map((line) => parseLine(line || ''));
}

function isPigDebugEnabled() {
  try {
    return typeof window !== 'undefined' && window.localStorage?.getItem('DEBUG_PIG_IMPORT') === '1';
  } catch {
    return false;
  }
}

async function readHoldedFileAsText(file) {
  const name = String(file?.name || '').toLowerCase();
  const isExcel = name.endsWith('.xlsx') || name.endsWith('.xls');
  if (!isExcel) return file.text();

  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const firstSheetName = workbook.SheetNames?.[0];
  if (!firstSheetName) throw new Error('El archivo Excel no contiene ninguna hoja.');
  const sheet = workbook.Sheets[firstSheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet, {
    FS: ';',
    RS: '\n',
    strip: false,
    blankrows: true
  });

  if (isPigDebugEnabled()) {
    const lines = String(csv || '').split('\n').map((l) => l.trim()).filter(Boolean);
    const sample = lines.slice(0, 25);
    console.log('🧪 [PIG] Import XLSX → CSV', {
      fileName: file?.name,
      sheet: firstSheetName,
      linesTotal: lines.length,
      sample
    });
  }

  return csv;
}

function parseHoldedAnual(csvText) {
  const rows = splitHoldedCsv(csvText);
  const map = new Map();
  const cuentas = []; // { code, name, total, groupLabel, subLabel, order }
  let currentGroupLabel = null;
  let currentSubLabel = null;
  let order = 0;
  for (const row of rows) {
    if (!row || row.length < 2) continue;
    const label = row[0]?.trim();
    const valRaw = row[1];
    if (!label || !isLikelyLabelCell(label)) continue;

    // Guardar el grupo actual para las cuentas que vienen debajo
    // Ej: "6. Aprovisionamientos" o "15. Gastos financieros"
    if (/^\d+\.\s+/.test(label)) {
      currentGroupLabel = label;
      currentSubLabel = null;
    }

    // Subapartados dentro de un grupo: "a) ..." "b) ..."
    if (/^[a-z]\)\s+/i.test(label)) {
      currentSubLabel = label;
    }
    // Cuentas contables: "74000003 - SUBVSOC"
    if (/^\d{3,}/.test(label)) {
      const m = label.match(/^(\d{3,})\s*-\s*(.*)$/);
      cuentas.push({
        code: m?.[1] || label.split(/\s+/)[0],
        name: (m?.[2] || '').trim(),
        total: parseEuroNumber(valRaw),
        groupLabel: currentGroupLabel,
        subLabel: currentSubLabel,
        order: order++
      });
      continue;
    }
    map.set(label, parseEuroNumber(valRaw));
  }
  return { map, cuentas };
}

function parseHoldedMensual(csvText) {
  const rows = splitHoldedCsv(csvText);
  const monthNameToIndex = (raw) => {
    const s = String(raw || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    // formatos típicos: "Abril 26", "abril 2026", "2026-04"
    const iso = s.match(/\b(20\d{2})-(\d{2})\b/);
    if (iso) return Math.max(0, Math.min(11, Number(iso[2]) - 1));
    if (/\b(gen|gener|enero|january|jan)\b/.test(s)) return 0;
    if (/\b(feb|febrer|febrero|february)\b/.test(s)) return 1;
    if (/\b(mar|marc|marzo|march)\b/.test(s)) return 2;
    if (/\b(abr|abril|april)\b/.test(s)) return 3;
    if (/\b(mai|mayo|may)\b/.test(s)) return 4;
    if (/\b(jun|juny|junio|june)\b/.test(s)) return 5;
    if (/\b(jul|juliol|julio|july)\b/.test(s)) return 6;
    if (/\b(ago|agost|agosto|august)\b/.test(s)) return 7;
    if (/\b(set|setembre|sept|septiembre|september)\b/.test(s)) return 8;
    if (/\b(oct|octubre|october)\b/.test(s)) return 9;
    if (/\b(nov|novembre|noviembre|november)\b/.test(s)) return 10;
    if (/\b(des|desembre|diciembre|december)\b/.test(s)) return 11;
    return null;
  };

  const extractRange = () => {
    const m = String(csvText || '').match(/(\d{2})\/(\d{2})\/(20\d{2})\s*-\s*(\d{2})\/(\d{2})\/(20\d{2})/);
    if (!m) return null;
    const startMonthIdx = Math.max(0, Math.min(11, Number(m[2]) - 1));
    const endMonthIdx = Math.max(0, Math.min(11, Number(m[5]) - 1));
    return { startMonthIdx, endMonthIdx, year: m[3] };
  };
  const range = extractRange();

  const headerRow = rows.find((r) => {
    if (!r || r.length < 2) return false;
    if (String(r[0] || '').trim() !== '') return false;
    const mIdx = monthNameToIndex(r[1]);
    return mIdx !== null;
  });

  const headerMonths = headerRow ? headerRow.slice(1).map((m) => String(m || '').trim()).filter(Boolean) : [];
  const monthCount = Math.min(12, headerMonths.length);
  const monthNames = headerMonths.slice(0, monthCount);
  const colMonthIndices = monthNames.map((m, pos) => {
    const idx = monthNameToIndex(m);
    if (idx !== null) return idx;
    if (range?.startMonthIdx !== undefined) return Math.min(11, range.startMonthIdx + pos);
    return pos; // fallback antiguo: asume Enero..N
  });
  const monthNamesByIndex = new Array(12).fill('');
  for (let i = 0; i < monthNames.length; i++) {
    const idx = colMonthIndices[i] ?? i;
    if (idx >= 0 && idx < 12) monthNamesByIndex[idx] = monthNames[i];
  }

  const yearGuess = (() => {
    if (range?.year) return range.year;
    const m = String(csvText || '').match(/01\/01\/(\d{4})/);
    if (m) return m[1];
    // fallback: intentar extraer del primer mes "Abril 26"
    const first = monthNames[0] || '';
    const y4 = String(first).match(/\b(20\d{2})\b/);
    if (y4) return y4[1];
    const y2 = String(first).match(/\b(\d{2})\b/);
    return y2 ? `20${y2[1]}` : '';
  })();

  const map = new Map(); // label -> number[12]
  const cuentas = []; // { code, name, months:number[12], groupLabel, subLabel, order }
  let currentGroupLabel = null;
  let currentSubLabel = null;
  let order = 0;
  for (const row of rows) {
    if (!row || row.length < 1 + monthCount) continue;
    const label = row[0]?.trim();
    if (!label || !isLikelyLabelCell(label)) continue;

    if (/^\d+\.\s+/.test(label)) {
      currentGroupLabel = label;
      currentSubLabel = null;
    }

    if (/^[a-z]\)\s+/i.test(label)) {
      currentSubLabel = label;
    }
    if (/^\d{3,}/.test(label)) {
      const m = label.match(/^(\d{3,})\s*-\s*(.*)$/);
      const months = new Array(12).fill(0);
      const vals = row.slice(1, 1 + monthCount).map(parseEuroNumber);
      for (let i = 0; i < vals.length; i++) {
        const idx = colMonthIndices[i] ?? i;
        if (idx >= 0 && idx < 12) months[idx] = vals[i];
      }
      cuentas.push({
        code: m?.[1] || label.split(/\s+/)[0],
        name: (m?.[2] || '').trim(),
        months,
        groupLabel: currentGroupLabel,
        subLabel: currentSubLabel,
        order: order++
      });
      continue;
    } // cuentas
    const vals = new Array(12).fill(0);
    const raw = row.slice(1, 1 + monthCount).map(parseEuroNumber);
    for (let i = 0; i < raw.length; i++) {
      const idx = colMonthIndices[i] ?? i;
      if (idx >= 0 && idx < 12) vals[idx] = raw[i];
    }
    map.set(label, vals);
  }
  return {
    map,
    monthNames,
    monthNamesByIndex,
    cuentas,
    yearGuess,
    monthCount,
    rangeStartIdx: range?.startMonthIdx ?? null,
    rangeEndIdx: range?.endMonthIdx ?? null
  };
}

function buildGroupAccountsAoa({
  title,
  groupLabel,
  groupTotal,
  sections = [],
  cuentas = [],
  yellowHeader = false
}) {
  const aoa = [];
  aoa.push([title, '']);
  aoa.push(['', '']);

  // Cabecera grupo
  aoa.push([groupLabel, '']);
  const groupTotalRow = aoa.length;
  aoa.push(['', groupTotal]);

  const sectionMetas = [];
  const allAccountValueRows = [];

  for (const sec of sections) {
    aoa.push(['', '']);
    aoa.push([sec.label, '']);
    const secTotalRow = aoa.length;
    aoa.push(['', sec.total]);

    const items = cuentas
      .filter((c) => String(c.subLabel || '').toLowerCase() === String(sec.label || '').toLowerCase())
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    const accountValueRows = [];
    for (const c of items) {
      aoa.push([`${c.code} - ${c.name}`.trim(), '']);
      accountValueRows.push(aoa.length);
      allAccountValueRows.push(aoa.length);
      aoa.push(['', c.total]);
    }
    sectionMetas.push({ totalRow: secTotalRow, accountValueRows });
  }

  // Si no hay secciones, solo listamos cuentas del grupo
  if (!sections.length) {
    const items = cuentas.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    aoa.push(['', '']);
    for (const c of items) {
      aoa.push([`${c.code} - ${c.name}`.trim(), '']);
      allAccountValueRows.push(aoa.length);
      aoa.push(['', c.total]);
    }
  }

  return {
    aoa,
    formulaMeta: {
      groupTotalRow,
      sectionMetas,
      allAccountValueRows
    }
  };
}

function styleGroupAccountsSheet({ ws, aoa, yellowRows = [] }) {
  ws['!sheetView'] = [{ showGridLines: false }];
  ws['!cols'] = [{ wch: 70 }, { wch: 16 }];
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  setRangeStyle(ws, 0, 0, 0, 1, {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  // Bordes y formato general
  for (let r = 2; r < aoa.length; r++) {
    setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
    setCellStyle(ws, r, 1, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });

    const vA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (vA && (/^\d+\.\s+/.test(String(vA)) || /^[a-z]\)\s+/i.test(String(vA)) || /^\d{3,}\s*-/.test(String(vA)))) {
      setCellStyle(ws, r, 0, { font: { bold: true, name: 'Calibri' } });
    }
  }

  // Aplicar amarillo a filas específicas (rangos de filas)
  const yellow = makeFill('#FFFF00');
  for (const rr of yellowRows) {
    setRangeStyle(ws, rr.r0, 0, rr.r1, 1, { fill: yellow, border: borderThin });
    // asegurar negritas en labels del bloque
    for (let r = rr.r0; r <= rr.r1; r++) {
      const vA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (vA) setCellStyle(ws, r, 0, { font: { bold: true, name: 'Calibri' } });
    }
  }
}

function stylePigTesoreriaSheet({ ws, aoa, meta = {} }) {
  const hasRight = Boolean(meta?.rightTables?.tables?.length);
  const colsLen = hasRight ? (TESORERIA_RIGHT_COL.obs + 1) : 6;
  ws['!sheetView'] = [{ showGridLines: false }];
  ws['!cols'] = [
    { wch: 52 },
    { wch: 22 },
    { wch: 8 },
    { wch: 28 },
    { wch: 16 },
    { wch: 14 },
    { wch: 3 },
    { wch: 48 },
    { wch: 16 },
    { wch: 62 }
  ].slice(0, colsLen);
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: Math.min(5, colsLen - 1) } }];

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };
  const moneyStyle = { numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const headerStyle = {
    font: { bold: true, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: makeFill('#E7E6E6'),
    border: borderThin
  };
  const yellow = makeFill('#FFFF00');
  const purpleHeader = makeFill('#D5A6E6');
  const pinkAmount = makeFill('#F8CBAD');
  const blueObsHeader = makeFill('#9DC3E6');
  const blueObsNote = makeFill('#DDEBF7');
  const purpleObsHeader = makeFill('#C5A0D0');

  setRangeStyle(ws, 0, 0, 0, Math.min(5, colsLen - 1), titleStyle);

  const summaryStart = meta.summaryStartRow ?? 2;
  const summaryEnd = meta.summaryEndRow ?? (meta.detailHeaderRow > 0 ? meta.detailHeaderRow - 3 : aoa.length - 1);
  for (let r = summaryStart; r <= summaryEnd; r++) {
    const hasA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const hasB = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v !== undefined && ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v !== '';
    if (!hasA && !hasB) continue;
    setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
    if (hasA) setCellStyle(ws, r, 0, { font: { bold: true, name: 'Calibri' } });
    if (hasB) setCellStyle(ws, r, 1, { border: borderThin, ...moneyStyle });
  }

  if (meta.detailHeaderRow >= 0) {
    const sectionRow = meta.detailHeaderRow - 1;
    if (sectionRow >= 0) {
      setCellStyle(ws, sectionRow, 0, {
        font: { bold: true, name: 'Calibri' },
        alignment: { vertical: 'center' }
      });
    }
    setRangeStyle(ws, meta.detailHeaderRow, 0, meta.detailHeaderRow, 5, headerStyle);

    const dataStart = meta.detailDataStartRow >= 0 ? meta.detailDataStartRow : meta.detailHeaderRow + 1;
    const dataEnd = meta.detailDataEndRow >= dataStart ? meta.detailDataEndRow : dataStart;
    for (let r = dataStart; r <= dataEnd; r++) {
      for (let c = 0; c < 6; c++) {
        const style = { border: borderThin, alignment: { vertical: 'center' } };
        if (c === 4) Object.assign(style, moneyStyle);
        if (c === 5) Object.assign(style, { numFmt: '0', alignment: { horizontal: 'right' } });
        setCellStyle(ws, r, c, style);
      }
    }
  }

  for (const rowIdx of meta.totalRows || []) {
    setRangeStyle(ws, rowIdx, 0, rowIdx, 5, {
      font: { bold: true, name: 'Calibri' },
      border: borderThin
    });
    setCellStyle(ws, rowIdx, 0, { alignment: { vertical: 'center' } });
    setCellStyle(ws, rowIdx, 4, { ...moneyStyle, font: { bold: true, name: 'Calibri' } });
    const label = String(ws[XLSX.utils.encode_cell({ r: rowIdx, c: 0 })]?.v || '');
    if (label.toUpperCase().includes('TOTAL TESORER')) {
      setRangeStyle(ws, rowIdx, 0, rowIdx, 5, {
        font: { bold: true, name: 'Calibri' },
        fill: yellow,
        border: borderThin
      });
      setCellStyle(ws, rowIdx, 4, {
        ...moneyStyle,
        font: { bold: true, name: 'Calibri' },
        fill: yellow
      });
    }
  }

  // Tablas hardcodeadas a la derecha (Cuenta Resultados)
  if (hasRight) {
    const { label: cLabel, amount: cAmount, obs: cObs } = TESORERIA_RIGHT_COL;
    for (const t of meta.rightTables.tables) {
      // Cabecera título + INGRESO PREVISTO
      setCellStyle(ws, t.titleRow, cLabel, {
        font: { bold: true, name: 'Calibri', color: { rgb: '000000' } },
        fill: purpleHeader,
        border: borderThin,
        alignment: { horizontal: 'left', vertical: 'center', wrapText: true }
      });
      setCellStyle(ws, t.titleRow, cAmount, {
        font: { bold: true, name: 'Calibri' },
        fill: pinkAmount,
        border: borderThin,
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
      });

      for (let r = t.dataStartRow; r <= t.dataEndRow; r++) {
        setCellStyle(ws, r, cLabel, {
          border: borderThin,
          font: { name: 'Calibri' },
          alignment: { vertical: 'center', wrapText: true }
        });
        setCellStyle(ws, r, cAmount, {
          border: borderThin,
          ...moneyStyle,
          font: { name: 'Calibri' }
        });
      }

      if (t.totalRow >= 0) {
        setCellStyle(ws, t.totalRow, cLabel, {
          font: { bold: true, name: 'Calibri' },
          fill: purpleHeader,
          border: borderThin,
          alignment: { vertical: 'center', wrapText: true }
        });
        setCellStyle(ws, t.totalRow, cAmount, {
          font: { bold: true, name: 'Calibri' },
          fill: purpleHeader,
          border: borderThin,
          ...moneyStyle
        });
      }

      // Observaciones
      const obsHeaderSet = new Set(t.obsHeaderRows || []);
      for (let r = t.obsStartRow; r <= t.obsEndRow; r++) {
        const val = ws[XLSX.utils.encode_cell({ r, c: cObs })]?.v;
        if (val === undefined || val === '') continue;
        const isHeader = obsHeaderSet.has(r);
        setCellStyle(ws, r, cObs, {
          font: {
            bold: isHeader,
            name: 'Calibri',
            color: isHeader && t.kind === 'porAprobar' ? { rgb: 'FFFFFF' } : { rgb: '000000' }
          },
          fill: isHeader
            ? (t.kind === 'porAprobar' ? purpleObsHeader : blueObsHeader)
            : blueObsNote,
          border: borderThin,
          alignment: { vertical: 'center', wrapText: true }
        });
      }
    }
  }
}

function stylePigPresupuestosSheet({ ws, aoa, meta = {} }) {
  const colsLen = 10;
  ws['!sheetView'] = [{ showGridLines: false }];
  ws['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 36 },
    { wch: 28 },
    { wch: 18 },
    { wch: 12 },
    { wch: 14 },
    { wch: 18 },
    { wch: 12 }
  ];
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colsLen - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colsLen - 1 } }
  ];

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };
  const moneyStyle = { numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const subtitleStyle = {
    font: { italic: true, name: 'Calibri', sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' }
  };
  const monthHeaderFill = makeFill('#EEF6C8');
  const colHeaderFill = makeFill('#E7E6E6');
  const totalFill = makeFill('#FFFF00');
  const facturadoFill = makeFill('#C6EFCE'); // verde clarito
  const subHeaderFill = makeFill('#DDEBF7');

  setRangeStyle(ws, 0, 0, 0, colsLen - 1, titleStyle);
  setRangeStyle(ws, 1, 0, 1, colsLen - 1, subtitleStyle);

  for (const r of meta.monthHeaderRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: monthHeaderFill,
      border: borderThin,
      alignment: { vertical: 'center' }
    });
    setCellStyle(ws, r, 7, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: monthHeaderFill, border: borderThin });
    setCellStyle(ws, r, 8, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: monthHeaderFill, border: borderThin });
  }

  for (const r of meta.subHeaderRows || []) {
    const estado = String(ws[XLSX.utils.encode_cell({ r, c: 9 })]?.v || '').toUpperCase();
    const fill = estado.includes('FACTURADO') ? facturadoFill : subHeaderFill;
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill,
      border: borderThin,
      alignment: { vertical: 'center', wrapText: true }
    });
    setCellStyle(ws, r, 7, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill, border: borderThin });
    setCellStyle(ws, r, 8, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill, border: borderThin });
  }

  for (const r of meta.headerRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: colHeaderFill,
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    });
  }

  const facturadoSet = new Set(meta.facturadoRows || []);
  for (const r of meta.dataRows || []) {
    const isFacturado = facturadoSet.has(r);
    for (let c = 0; c < colsLen; c++) {
      const style = {
        border: borderThin,
        alignment: { vertical: 'center' },
        font: { name: 'Calibri', bold: isFacturado },
        fill: isFacturado ? facturadoFill : undefined
      };
      if (c === 7 || c === 8) Object.assign(style, moneyStyle);
      setCellStyle(ws, r, c, style);
    }
  }

  for (const r of meta.monthTotalRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      border: borderThin
    });
    setCellStyle(ws, r, 7, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, border: borderThin });
    setCellStyle(ws, r, 8, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, border: borderThin });
  }

  for (const r of meta.blockTotalFacturadoRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: facturadoFill,
      border: borderThin
    });
    setCellStyle(ws, r, 7, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: facturadoFill, border: borderThin });
    setCellStyle(ws, r, 8, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: facturadoFill, border: borderThin });
  }

  for (const r of meta.blockTotalPendingRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: subHeaderFill,
      border: borderThin
    });
    setCellStyle(ws, r, 7, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: subHeaderFill, border: borderThin });
    setCellStyle(ws, r, 8, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: subHeaderFill, border: borderThin });
  }

  if (meta.grandTotalRow >= 0) {
    const r = meta.grandTotalRow;
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: totalFill,
      border: borderThin
    });
    setCellStyle(ws, r, 7, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: totalFill, border: borderThin });
    setCellStyle(ws, r, 8, { ...moneyStyle, font: { bold: true, name: 'Calibri' }, fill: totalFill, border: borderThin });
  }

  void aoa;
}

function stylePigFacturacionPendienteSheet({ ws, aoa, meta = {} }) {
  const colsLen = 12;
  ws['!sheetView'] = [{ showGridLines: false }];
  ws['!cols'] = [
    { wch: 12 },
    { wch: 16 },
    { wch: 28 },
    { wch: 34 },
    { wch: 28 },
    { wch: 16 },
    { wch: 16 },
    { wch: 12 },
    { wch: 12 },
    { wch: 12 },
    { wch: 16 },
    { wch: 12 }
  ];
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };
  ws['!merges'] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: colsLen - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: colsLen - 1 } }
  ];

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };
  const moneyStyle = { numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } };
  const titleStyle = {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  };
  const subtitleStyle = {
    font: { italic: true, name: 'Calibri', sz: 10 },
    alignment: { horizontal: 'left', vertical: 'center' }
  };

  setRangeStyle(ws, 0, 0, 0, colsLen - 1, titleStyle);
  setRangeStyle(ws, 1, 0, 1, colsLen - 1, subtitleStyle);

  for (const r of meta.sectionHeaderRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri', color: { rgb: 'FFFFFF' } },
      fill: makeFill('#556B0F'),
      border: borderThin,
      alignment: { vertical: 'center' }
    });
    for (const c of [8, 9, 10]) {
      setCellStyle(ws, r, c, {
        ...moneyStyle,
        font: { bold: true, name: 'Calibri', color: { rgb: 'FFFFFF' } },
        fill: makeFill('#556B0F'),
        border: borderThin
      });
    }
  }

  for (const r of meta.colHeaderRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#EEF6C8'),
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    });
  }

  const overdueSet = new Set(meta.overdueRows || []);
  for (const r of meta.dataRows || []) {
    const isOverdue = overdueSet.has(r);
    for (let c = 0; c < colsLen; c++) {
      const style = {
        border: borderThin,
        alignment: { vertical: 'center' },
        font: { name: 'Calibri', color: isOverdue ? { rgb: 'C00000' } : undefined },
        fill: isOverdue ? makeFill('#FCE4D6') : undefined
      };
      if (c === 8 || c === 9 || c === 10) Object.assign(style, moneyStyle);
      setCellStyle(ws, r, c, style);
    }
  }

  for (const r of meta.sectionTotalRows || []) {
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      border: borderThin,
      fill: makeFill('#F3F4F6')
    });
    for (const c of [8, 9, 10]) {
      setCellStyle(ws, r, c, {
        ...moneyStyle,
        font: { bold: true, name: 'Calibri' },
        border: borderThin,
        fill: makeFill('#F3F4F6')
      });
    }
  }

  if (meta.grandTotalRow >= 0) {
    const r = meta.grandTotalRow;
    setRangeStyle(ws, r, 0, r, colsLen - 1, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#FFFF00'),
      border: borderThin
    });
    for (const c of [8, 10]) {
      setCellStyle(ws, r, c, {
        ...moneyStyle,
        font: { bold: true, name: 'Calibri' },
        fill: makeFill('#FFFF00'),
        border: borderThin
      });
    }
  }

  void aoa;
}

function estimadoSubvLabel(slot, suffix = '') {
  const base = slot === 1
    ? 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO'
    : `ESTIMADO DE SUBVENCIÓN ${slot} ANTES DE INGRESO`;
  const sfx = String(suffix || '').trim();
  return sfx ? `${base} ${sfx}`.trim() : base;
}

function estimadosSlotsHaveAmount(estimadosSlots = []) {
  return (estimadosSlots || []).some((entry) =>
    (entry?.months || []).some((v) => Math.abs(Number(v) || 0) > 0.005)
  );
}

function appendEstimadoSubvRows({ aoa, monthsLen, estimadosSlots = [], labelSuffixBySlot = {}, totalInMainCol = false }) {
  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sorted = [...estimadosSlots].sort((a, b) => (Number(a.slot) || 0) - (Number(b.slot) || 0));
  let combined = new Array(monthsLen).fill(0);

  for (const entry of sorted) {
    const slot = Number(entry.slot) || 1;
    const vals = Array.isArray(entry.months)
      ? entry.months.slice(0, monthsLen)
      : new Array(monthsLen).fill(Number(entry.amount) || 0);
    while (vals.length < monthsLen) vals.push(0);
    const hasAmount = vals.some((v) => Math.abs(Number(v) || 0) > 0.005);
    if (!hasAmount) continue;
    const total = vals.reduce((a, b) => a + (Number(b) || 0), 0);
    const label = estimadoSubvLabel(slot, labelSuffixBySlot[slot] || '');
    if (totalInMainCol) {
      aoa.push([label, ...vals, total, '', '']);
    } else {
      aoa.push([label, ...vals, '', '', total]);
    }
    combined = sumArray(combined, vals);
  }

  return combined;
}

/** Subvenciones hardcodeadas para EISSS Cuenta Resultados (tabla grande LINEA). Ene–Jun 2026. */
const PIG_CTA_RESULTADOS_SUBV = {
  CATERING: [
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO  L2 2026 (DAVID)',
      months: [483.46, 483.46, 483.46, 483.46, 483.46, 483.46]
    },
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO  L1 2026 (TEC.ACOMP.)',
      months: [277.31, 277.31, 277.31, 277.31, 277.31, 277.31]
    }
  ],
  IDONI: [
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L2  GIO/LOLA/BELINDA',
      months: [2126.81, 2126.81, 2126.81, 2126.81, 2126.81, 2126.81]
    },
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L1  TEC. ACOMP.',
      months: [1192.43, 1192.43, 1192.43, 1192.43, 1192.43, 1192.43]
    },
    {
      label: 'IMPULSEM 10/25 A 10/26 SE IMPUTA 100% A IDONI (10.000)',
      months: [833.33, 833.33, 833.33, 833.33, 833.33, 833.33]
    },
    {
      label: 'ENFORTIM    2026  PERIODO  DE 12/26 A 12/27',
      months: [],
      forceShow: true
    }
  ],
  KOIKI: [
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L2 2026',
      months: [966.93, 966.93, 900.57, 786.0, 1001.53, 483.46]
    },
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L1  TEC. ACOMP.',
      months: [499.15, 499.15, 499.15, 499.15, 499.15, 499.15]
    }
  ],
  ESTRUCTURA: [
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L2 2026',
      months: [1448.4, 1448.4, 1448.4, 1448.4, 1448.4, 1448.4]
    },
    {
      label: 'ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO L1  TEC. ACOMP.',
      months: [831.9, 831.9, 831.9, 831.9, 831.9, 831.9]
    }
  ]
};

const PIG_CTA_RESULTADOS_GENERAL_SUBV_LABELS = [
  'SUBV EISSS L1 2026',
  'SUBV EISSS L2 2026',
  'IMPULSEM'
];

const PIG_CTA_RESULTADOS_GENERAL_INGRESOS_LABEL =
  'Estimado Subvenciones Imputadas Al Excedente Del Ejercicio 2026';
const PIG_GENERAL_INGRESOS_PROPIA_LABEL = '1. Ingresos de la actividad propia';

/** Agrupa subv hardcodeadas de todas las LINEA: L1 / L2 / resto→IMPULSEM. */
function classifyCtaResultadosSubvBucket(label) {
  const u = String(label || '').toUpperCase();
  if (/\bL1\b/.test(u)) return 'SUBV EISSS L1 2026';
  if (/\bL2\b/.test(u)) return 'SUBV EISSS L2 2026';
  return 'IMPULSEM';
}

function buildCuentaResultadosGeneralSubvMonths(monthsLen = 12) {
  const lim = Math.max(1, Math.min(12, Number(monthsLen) || 12));
  const buckets = {
    'SUBV EISSS L1 2026': new Array(lim).fill(0),
    'SUBV EISSS L2 2026': new Array(lim).fill(0),
    IMPULSEM: new Array(lim).fill(0)
  };
  for (const rows of Object.values(PIG_CTA_RESULTADOS_SUBV)) {
    for (const entry of rows || []) {
      const key = classifyCtaResultadosSubvBucket(entry.label);
      const src = Array.isArray(entry.months) ? entry.months : [];
      for (let i = 0; i < Math.min(6, lim, src.length); i++) {
        buckets[key][i] += Number(src[i]) || 0;
      }
    }
  }
  return buckets;
}

function sumMonthArrays(arrays, monthsLen = 12) {
  const lim = Math.max(1, Math.min(12, Number(monthsLen) || 12));
  const out = new Array(lim).fill(0);
  for (const arr of arrays || []) {
    for (let i = 0; i < lim; i++) out[i] += Number(arr?.[i]) || 0;
  }
  return out;
}

function clonePigNumberMap(map) {
  const out = new Map();
  if (!map) return out;
  for (const [k, v] of map.entries()) {
    out.set(k, Array.isArray(v) ? [...v] : v);
  }
  return out;
}

function appendCuentaResultadosSubvRows({ aoa, linea, monthsLen = 12 }) {
  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const rows = PIG_CTA_RESULTADOS_SUBV[linea] || [];
  let combined = new Array(monthsLen).fill(0);
  const subvDetail = [];

  for (const entry of rows) {
    const vals = new Array(monthsLen).fill('');
    const src = Array.isArray(entry.months) ? entry.months : [];
    for (let i = 0; i < Math.min(6, monthsLen, src.length); i++) {
      vals[i] = Number(src[i]) || 0;
    }
    const numeric = vals.map((v) => (v === '' ? 0 : Number(v) || 0));
    const total = numeric.reduce((a, b) => a + b, 0);
    const hasAmount = Math.abs(total) > 0.005;
    if (!hasAmount && !entry.forceShow) continue;
    const row = aoa.length;
    aoa.push([entry.label, ...vals, hasAmount ? total : '', '']);
    subvDetail.push({
      row,
      label: entry.label,
      bucket: classifyCtaResultadosSubvBucket(entry.label)
    });
    combined = sumArray(combined, numeric);
  }

  return { combined, subvDetail };
}

/** Compat: appendCuentaResultadosSubvRows ahora devuelve { combined, subvDetail }. */
function unwrapSubvAppend(result) {
  if (result && typeof result === 'object' && Array.isArray(result.combined)) {
    return result;
  }
  return { combined: result || [], subvDetail: [] };
}

function unwrapPigLineaAoa(result) {
  if (Array.isArray(result)) return { aoa: result, formulaMeta: null };
  return { aoa: result?.aoa || [], formulaMeta: result?.formulaMeta || null };
}

function appendPigLineaBottomTotales({
  aoa,
  cols,
  lineName,
  listAll,
  isSubv,
  novLimit,
  decLimit,
  endOfMonthStr,
  doubleSpaceBeneficio = false,
  cuentaResultados = false,
  beneficioConSubvTotal = null,
  beneficioSinSubvTotal = null
}) {
  const sumMonthsLocal = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);
  const novTotal = listAll.reduce((sum, c) => sum + sumMonthsLocal(c.months, novLimit), 0);
  const decTotal = listAll.reduce((sum, c) => sum + sumMonthsLocal(c.months, decLimit), 0);
  const novSinSubv = listAll
    .filter((c) => !isSubv(c))
    .reduce((sum, c) => sum + sumMonthsLocal(c.months, novLimit), 0);
  const decSinSubv = listAll
    .filter((c) => !isSubv(c))
    .reduce((sum, c) => sum + sumMonthsLocal(c.months, decLimit), 0);
  const novDate = endOfMonthStr(novLimit - 1);
  const decDate = endOfMonthStr(decLimit - 1);
  const beneficioPrefix = doubleSpaceBeneficio ? 'TOTAL  BENEFICIO' : 'TOTAL BENEFICIO';

  aoa.push(new Array(cols.length).fill(''));
  if (cuentaResultados) {
    // Misma cifra que la tabla grande (TOTAL BENEFICIO POR MES / BENEFICIO SIN SUBVENCIONES).
    const conSubv = Number(beneficioConSubvTotal) || 0;
    const sinSubv = Number(beneficioSinSubvTotal) || 0;
    const bottomConSubvRow = aoa.length;
    {
      const row = new Array(cols.length).fill('');
      row[0] = `TOTAL BENEFICIO ${lineName} CON SUBV.`;
      row[1] = conSubv;
      row[3] = `TOTAL BENEFICIO ${lineName} CON SUBV.`;
      row[8] = conSubv;
      aoa.push(row);
    }
    const bottomSinSubvRow = aoa.length;
    {
      const row = new Array(cols.length).fill('');
      row[0] = `TOTAL BENEFICIO ${lineName} SIN SUBV.`;
      row[1] = sinSubv;
      row[3] = `TOTAL BENEFICIO ${lineName} SIN SUBV.`;
      row[8] = sinSubv;
      aoa.push(row);
    }
    return { bottomConSubvRow, bottomSinSubvRow };
  }
  {
    const row = new Array(cols.length).fill('');
    row[0] = `${beneficioPrefix} ${lineName} A ${novDate}`;
    row[1] = novTotal;
    row[3] = `${beneficioPrefix} ${lineName} A ${decDate}`;
    row[8] = decTotal;
    aoa.push(row);
  }
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL BENEFICIO ${lineName} ${novDate} SIN SUBV.`;
    row[1] = novSinSubv;
    row[3] = `TOTAL BENEFICIO ${lineName} ${decDate} SIN SUBV.`;
    row[8] = decSinSubv;
    aoa.push(row);
  }
  return { bottomConSubvRow: null, bottomSinSubvRow: null };
}

function buildPigLineaCateringAoa({ title, months, cuentasMensuales = [], mensualMap, estimadosSlots = [], cuentaResultados = false }) {
  const aoa = [];
  const yy = inferYearSuffix2({ title, months });
  const totalLabel = `TOTAL ${yy || ''}`.trim();
  const totalEstLabel = `TOTAL ${yy || ''} ESTIMADO SUBV`.trim();
  // Cuenta Resultados: sin columna "TOTAL ESTIMADO SUBV" (como el Excel de Lizeth).
  const cols = cuentaResultados
    ? ['Cuenta', ...months, totalLabel, '']
    : ['Cuenta', ...months, totalLabel, '', totalEstLabel];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isCatering = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('catering');
  };
  const isSubv = (c) => isPigSubvCuenta(c);
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  const catering = (cuentasMensuales || []).filter(isCatering);
  const subv = cuentaResultados ? [] : catering.filter(isSubv).slice().sort(pigAccountCompare);
  const resto = catering.filter((c) => !isSubv(c)).slice().sort(pigAccountCompare);

  // ===== Tabla principal =====
  const monthsLen = Math.min(12, months.length);
  const totalCol = monthsLen + 1;
  const formulaMeta = cuentaResultados
    ? {
      enabled: true,
      monthsLen,
      totalCol,
      subvRows: [],
      accountRows: [],
      incomeRows: [],
      expenseRows: [],
      subvDetail: [],
      bottomAccountRows: []
    }
    : null;

  let estimadoAntesIngreso;
  if (cuentaResultados) {
    const subvAppend = unwrapSubvAppend(appendCuentaResultadosSubvRows({ aoa, linea: 'CATERING', monthsLen }));
    estimadoAntesIngreso = subvAppend.combined;
    formulaMeta.subvDetail = subvAppend.subvDetail;
    formulaMeta.subvRows = subvAppend.subvDetail.map((d) => d.row);
  } else {
    estimadoAntesIngreso = appendEstimadoSubvRows({ aoa, monthsLen, estimadosSlots });
  }

  if (subv.length) {
    for (const c of subv) {
      const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
      const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
    }
    aoa.push(new Array(cols.length).fill(''));
  }

  for (const c of resto) {
    const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
    const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
    const rowIdx = aoa.length;
    if (cuentaResultados) {
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '']);
      formulaMeta.accountRows.push(rowIdx);
      if (isIncomeGroup(c)) formulaMeta.incomeRows.push(rowIdx);
      if (isExpenseGroup(c)) formulaMeta.expenseRows.push(rowIdx);
    } else {
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
    }
  }

  // ===== Resumen inferior ligado a la tabla =====
  const allCateringMonths = catering.reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const totalBeneficioMes = allCateringMonths; // ingresos + gastos (gastos suelen venir negativos)
  const totalBeneficioMesTotal = totalBeneficioMes.reduce((a, b) => a + (Number(b) || 0), 0);

  const ingresosSinSubvMonths = catering
    .filter((c) => isIncomeGroup(c) && !isSubv(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const ingresosSinSubvTotal = ingresosSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const despesesMonths = catering
    .filter((c) => isExpenseGroup(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const despesesTotal = despesesMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const beneficioSinSubvMonths = sumArray(ingresosSinSubvMonths, despesesMonths);
  const beneficioSinSubvTotal = beneficioSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  aoa.push(new Array(cols.length).fill(''));
  const estimadoTotal = sumMonths(estimadoAntesIngreso, monthsLen);
  const beneficioConSubvTotalFinal = totalBeneficioMesTotal + estimadoTotal;
  if (cuentaResultados) {
    // Como el Excel de Lizeth: TOTAL BENEFICIO POR MES incluye subv hardcodeadas.
    const beneficioConSubv = sumArray(totalBeneficioMes, estimadoAntesIngreso);
    formulaMeta.beneficioPorMesRow = aoa.length;
    aoa.push(['TOTAL BENEFICIO POR MES CATERING', ...beneficioConSubv, beneficioConSubvTotalFinal, '']);
    aoa.push(new Array(cols.length).fill(''));
    formulaMeta.ingresosSinSubvRow = aoa.length;
    aoa.push(['TOTAL INGRESOS CATERING SIN SUBVENCIONES', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '']);
    formulaMeta.despesesRow = aoa.length;
    aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '']);
    formulaMeta.beneficioSinSubvRow = aoa.length;
    aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '']);
  } else {
    aoa.push(['TOTAL BENEFICIO POR MES CATERING', ...totalBeneficioMes, totalBeneficioMesTotal, '', beneficioConSubvTotalFinal]);
    aoa.push(new Array(cols.length).fill(''));
    aoa.push(['TOTAL INGRESOS CATERING SIN SUBVENCIONES', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
    aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
    aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);
  }

  // ===== Tablas inferiores (totales computados) =====
  // Construimos 2 listados: enero–nov y enero–dic
  const listAll = catering.slice().sort(pigAccountCompare);
  const lastNonZeroMonth = (() => {
    let last = -1;
    for (const c of listAll) {
      const m = (c.months || []);
      for (let i = 0; i < Math.min(12, m.length); i++) {
        if (Number(m[i]) !== 0) last = Math.max(last, i);
      }
    }
    return last;
  })();
  const decLimit = Math.max(1, Math.min(12, (lastNonZeroMonth >= 0 ? lastNonZeroMonth + 1 : 12)));
  const novLimit = Math.max(1, decLimit - 1);

  const endOfMonthStr = (monthIndex) => {
    const yy = (title.match(/01\/01\/(\d{2})/)?.[1] || '').trim();
    const year = yy ? Number(`20${yy}`) : new Date().getFullYear();
    const m = Math.min(11, Math.max(0, monthIndex));
    const d = new Date(year, m + 1, 0).getDate();
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    return `${dd}/${mm}/${yy || String(year).slice(2)}`;
  };

  const novRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, novLimit)]);
  const decRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, decLimit)]);

  aoa.push(new Array(cols.length).fill(''));
  // Títulos (en A y en I para que no choque con la tabla)
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(novLimit - 1)}`;
    // Tabla derecha: el label ocupará varias columnas (D..H) y el valor en I
    row[3] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(decLimit - 1)}`;
    aoa.push(row);
  }
  aoa.push(new Array(cols.length).fill(''));
  // Separación extra para que no “pegue” con la tabla principal
  aoa.push(new Array(cols.length).fill(''));

  const maxLen = Math.max(novRows.length, decRows.length);
  const accountLabelToRow = new Map();
  if (formulaMeta) {
    for (const r of formulaMeta.accountRows) {
      const label = String(aoa[r]?.[0] || '').trim();
      if (label) accountLabelToRow.set(label, r);
    }
  }
  for (let i = 0; i < maxLen; i++) {
    const left = novRows[i] || ['', ''];
    const right = decRows[i] || ['', ''];
    const row = new Array(cols.length).fill('');
    row[0] = left[0];
    row[1] = left[1];
    // Right: label en D (se fusionará D..H), valor en I
    row[3] = right[0];
    row[8] = right[1];
    const bottomRow = aoa.length;
    aoa.push(row);
    if (formulaMeta) {
      const sourceRow = accountLabelToRow.get(String(left[0] || '').trim());
      if (sourceRow != null) {
        formulaMeta.bottomAccountRows.push({
          row: bottomRow,
          sourceRow,
          novLimit,
          decLimit
        });
      }
    }
  }

  // Totales inferiores
  const bottomMeta = appendPigLineaBottomTotales({
    aoa,
    cols,
    lineName: 'CATERING',
    listAll,
    isSubv,
    novLimit,
    decLimit,
    endOfMonthStr,
    cuentaResultados,
    beneficioConSubvTotal: beneficioConSubvTotalFinal,
    beneficioSinSubvTotal: beneficioSinSubvTotal
  });
  if (formulaMeta && bottomMeta) {
    formulaMeta.bottomConSubvRow = bottomMeta.bottomConSubvRow;
    formulaMeta.bottomSinSubvRow = bottomMeta.bottomSinSubvRow;
  }

  return formulaMeta ? { aoa, formulaMeta } : aoa;
}

function inferYearFullFromTitle(title, months) {
  const m = String(title || '').match(/01\/01\/(\d{2})/);
  if (m?.[1]) return `20${m[1]}`;
  const yy = inferYearSuffix2({ title, months });
  return yy ? `20${yy}` : '';
}

function buildPigLineaEstructuraAoa({
  title,
  months,
  cuentasMensuales = [],
  filterCuenta = isPigEstructuraLineaCuenta,
  lineName = 'ESTRUCTURA',
  accountOrder = null,
  compactLayout = false,
  estimadosSlots = [],
  cuentaResultados = false
}) {
  const aoa = [];
  const yy = inferYearSuffix2({ title, months });
  const totalLabel = `TOTAL ${yy || ''}`.trim();
  const cols = ['Cuenta', ...months, totalLabel, '', ''];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isSubv = (c) => isPigSubvCuenta(c);
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  let estructura = cuentaResultados ? [] : (cuentasMensuales || []).filter(filterCuenta);
  if (Array.isArray(accountOrder) && accountOrder.length) {
    const orderMap = new Map(accountOrder.map((code, idx) => [String(code).trim(), idx]));
    estructura = estructura.slice().sort((a, b) => {
      const ia = orderMap.get(String(a.code).trim()) ?? 999;
      const ib = orderMap.get(String(b.code).trim()) ?? 999;
      return ia - ib;
    });
  }
  const subvRaw = estructura.filter(isSubv);
  const restoRaw = estructura.filter((c) => !isSubv(c));
  const subv = accountOrder?.length ? subvRaw : subvRaw.slice().sort(pigAccountCompare);
  const resto = accountOrder?.length ? restoRaw : restoRaw.slice().sort(pigAccountCompare);
  const monthsLen = Math.min(12, months.length);

  let estimadoAntesIngreso = new Array(monthsLen).fill(0);
  const totalCol = monthsLen + 1;
  const formulaMeta = cuentaResultados
    ? {
      enabled: true,
      monthsLen,
      totalCol,
      subvRows: [],
      accountRows: [],
      incomeRows: [],
      expenseRows: [],
      subvDetail: [],
      placeholderRows: []
    }
    : null;

  if (cuentaResultados) {
    const subvAppend = unwrapSubvAppend(appendCuentaResultadosSubvRows({ aoa, linea: 'ESTRUCTURA', monthsLen }));
    estimadoAntesIngreso = subvAppend.combined;
    formulaMeta.subvDetail = subvAppend.subvDetail;
    formulaMeta.subvRows = subvAppend.subvDetail.map((d) => d.row);
    // Filas placeholder como en el Excel de Lizeth (a rellenar más adelante).
    const r640 = aoa.length;
    aoa.push(['640 ESTRUCTURA', ...new Array(monthsLen).fill(''), '', '', '']);
    const r642 = aoa.length;
    aoa.push(['642 ESTRUCTURA', ...new Array(monthsLen).fill(''), '', '', '']);
    formulaMeta.placeholderRows = [r640, r642];
    formulaMeta.accountRows.push(r640, r642);
  } else if (compactLayout && estimadosSlotsHaveAmount(estimadosSlots)) {
    const yearFull = inferYearFullFromTitle(title, months);
    estimadoAntesIngreso = appendEstimadoSubvRows({
      aoa,
      monthsLen,
      estimadosSlots,
      labelSuffixBySlot: { 1: yearFull ? `L1 ${yearFull}` : 'L1' },
      totalInMainCol: true
    });
  }

  if (subv.length) {
    for (const c of subv) {
      const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
      const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', '']);
    }
    if (!compactLayout) aoa.push(new Array(cols.length).fill(''));
  }

  for (const c of resto) {
    const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
    const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
    const rowIdx = aoa.length;
    aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', '']);
    if (formulaMeta) {
      formulaMeta.accountRows.push(rowIdx);
      if (isIncomeGroup(c)) formulaMeta.incomeRows.push(rowIdx);
      if (isExpenseGroup(c)) formulaMeta.expenseRows.push(rowIdx);
    }
  }

  const allEstructuraMonths = estructura.reduce(
    (acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)),
    new Array(monthsLen).fill(0)
  );
  const totalBeneficioMes = cuentaResultados
    ? sumArray(allEstructuraMonths, estimadoAntesIngreso)
    : allEstructuraMonths;
  const totalBeneficioMesTotal = totalBeneficioMes.reduce((a, b) => a + (Number(b) || 0), 0);

  const ingresosSinSubvMonths = estructura
    .filter((c) => isIncomeGroup(c) && !isSubv(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const ingresosSinSubvTotal = ingresosSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const despesesMonths = estructura
    .filter((c) => isExpenseGroup(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const despesesTotal = despesesMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const beneficioSinSubvMonths = sumArray(ingresosSinSubvMonths, despesesMonths);
  const beneficioSinSubvTotal = beneficioSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  aoa.push(new Array(cols.length).fill(''));
  if (formulaMeta) formulaMeta.beneficioPorMesRow = aoa.length;
  aoa.push([`TOTAL BENEFICIO POR MES ${lineName}`, ...totalBeneficioMes, totalBeneficioMesTotal, '', '']);

  if (compactLayout) {
    return formulaMeta ? { aoa, formulaMeta } : aoa;
  }

  aoa.push(new Array(cols.length).fill(''));
  aoa.push([`TOTAL INGRESOS ${lineName} SIN SUBVENCIONES`, ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
  aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
  aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);

  const listAll = estructura.slice().sort(pigAccountCompare);
  const lastNonZeroMonth = (() => {
    let last = -1;
    for (const c of listAll) {
      const m = (c.months || []);
      for (let i = 0; i < Math.min(12, m.length); i++) {
        if (Number(m[i]) !== 0) last = Math.max(last, i);
      }
    }
    return last;
  })();
  const decLimit = Math.max(1, Math.min(12, (lastNonZeroMonth >= 0 ? lastNonZeroMonth + 1 : 12)));
  const novLimit = Math.max(1, decLimit - 1);

  const endOfMonthStr = (monthIndex) => {
    const yyLocal = (title.match(/01\/01\/(\d{2})/)?.[1] || '').trim();
    const year = yyLocal ? Number(`20${yyLocal}`) : new Date().getFullYear();
    const m = Math.min(11, Math.max(0, monthIndex));
    const d = new Date(year, m + 1, 0).getDate();
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    return `${dd}/${mm}/${yyLocal || String(year).slice(2)}`;
  };

  const novRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, novLimit)]);
  const decRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, decLimit)]);

  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(novLimit - 1)}`;
    row[3] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(decLimit - 1)}`;
    aoa.push(row);
  }
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(new Array(cols.length).fill(''));

  const maxLen = Math.max(novRows.length, decRows.length);
  for (let i = 0; i < maxLen; i++) {
    const left = novRows[i] || ['', ''];
    const right = decRows[i] || ['', ''];
    const row = new Array(cols.length).fill('');
    row[0] = left[0];
    row[1] = left[1];
    row[3] = right[0];
    row[8] = right[1];
    aoa.push(row);
  }

  appendPigLineaBottomTotales({
    aoa,
    cols,
    lineName,
    listAll,
    isSubv,
    novLimit,
    decLimit,
    endOfMonthStr
  });

  return formulaMeta ? { aoa, formulaMeta } : aoa;
}

function buildPigLineaIdoniAoa({ title, months, cuentasMensuales = [], mensualMap, estimadosSlots = [], cuentaResultados = false }) {
  const aoa = [];
  const yy = inferYearSuffix2({ title, months });
  const totalLabel = `TOTAL ${yy || ''}`.trim();
  const totalEstLabel = `TOTAL ${yy || ''} ESTIMADO`.trim();
  const cols = cuentaResultados
    ? ['Cuenta', ...months, totalLabel, '']
    : ['Cuenta', ...months, totalLabel, '', totalEstLabel];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isIdoni = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('idoni');
  };
  const isSubv = (c) => isPigSubvCuenta(c);
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  const idoni = (cuentasMensuales || []).filter(isIdoni);
  const subv = cuentaResultados ? [] : idoni.filter(isSubv).slice().sort(pigAccountCompare);
  const resto = idoni.filter((c) => !isSubv(c)).slice().sort(pigAccountCompare);

  const monthsLen = Math.min(12, months.length);
  const totalCol = monthsLen + 1;
  const formulaMeta = cuentaResultados
    ? {
      enabled: true,
      monthsLen,
      totalCol,
      subvRows: [],
      accountRows: [],
      incomeRows: [],
      expenseRows: [],
      subvDetail: [],
      bottomAccountRows: []
    }
    : null;

  let estimadoAntesIngreso;
  if (cuentaResultados) {
    const subvAppend = unwrapSubvAppend(appendCuentaResultadosSubvRows({ aoa, linea: 'IDONI', monthsLen }));
    estimadoAntesIngreso = subvAppend.combined;
    formulaMeta.subvDetail = subvAppend.subvDetail;
    formulaMeta.subvRows = subvAppend.subvDetail.map((d) => d.row);
  } else {
    estimadoAntesIngreso = appendEstimadoSubvRows({ aoa, monthsLen, estimadosSlots });
  }

  if (subv.length) {
    for (const c of subv) {
      const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
      const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
    }
  }

  for (const c of resto) {
    const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
    const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
    const rowIdx = aoa.length;
    if (cuentaResultados) {
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '']);
      formulaMeta.accountRows.push(rowIdx);
      if (isIncomeGroup(c)) formulaMeta.incomeRows.push(rowIdx);
      if (isExpenseGroup(c)) formulaMeta.expenseRows.push(rowIdx);
    } else {
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
    }
  }

  // ===== Resumen inferior =====
  const allIdoniMonths = idoni.reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const totalBeneficioMes = allIdoniMonths;
  const totalBeneficioMesTotal = totalBeneficioMes.reduce((a, b) => a + (Number(b) || 0), 0);

  const ingresosSinSubvMonths = idoni
    .filter((c) => isIncomeGroup(c) && !isSubv(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const ingresosSinSubvTotal = ingresosSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const despesesMonths = idoni
    .filter((c) => isExpenseGroup(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const despesesTotal = despesesMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const beneficioSinSubvMonths = sumArray(ingresosSinSubvMonths, despesesMonths);
  const beneficioSinSubvTotal = beneficioSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  aoa.push(new Array(cols.length).fill(''));
  const estimadoTotal = sumMonths(estimadoAntesIngreso, monthsLen);
  const beneficioConSubvTotalFinal = totalBeneficioMesTotal + estimadoTotal;
  if (cuentaResultados) {
    const beneficioConSubv = sumArray(totalBeneficioMes, estimadoAntesIngreso);
    formulaMeta.beneficioPorMesRow = aoa.length;
    aoa.push(['TOTAL BENEFICIO POR MES IDONI', ...beneficioConSubv, beneficioConSubvTotalFinal, '']);
    aoa.push(new Array(cols.length).fill(''));
    formulaMeta.ingresosSinSubvRow = aoa.length;
    aoa.push(['TOTAL INGRESOS IDONI SIN SUBV.', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '']);
    formulaMeta.despesesRow = aoa.length;
    aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '']);
    formulaMeta.beneficioSinSubvRow = aoa.length;
    aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '']);
  } else {
    aoa.push(['TOTAL BENEFICIO POR MES IDONI', ...totalBeneficioMes, totalBeneficioMesTotal, '', beneficioConSubvTotalFinal]);
    aoa.push(new Array(cols.length).fill(''));
    aoa.push(['TOTAL INGRESOS IDONI SIN SUBV.', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
    aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
    aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);
  }

  // ===== Tablas inferiores (totales computados) =====
  const listAll = idoni.slice().sort(pigAccountCompare);
  const lastNonZeroMonth = (() => {
    let last = -1;
    for (const c of listAll) {
      const m = (c.months || []);
      for (let i = 0; i < Math.min(12, m.length); i++) {
        if (Number(m[i]) !== 0) last = Math.max(last, i);
      }
    }
    return last;
  })();
  const decLimit = Math.max(1, Math.min(12, (lastNonZeroMonth >= 0 ? lastNonZeroMonth + 1 : 12)));
  const novLimit = Math.max(1, decLimit - 1);
  const endOfMonthStr = (monthIndex) => {
    const yy = (title.match(/01\/01\/(\d{2})/)?.[1] || '').trim();
    const year = yy ? Number(`20${yy}`) : new Date().getFullYear();
    const m = Math.min(11, Math.max(0, monthIndex));
    const d = new Date(year, m + 1, 0).getDate();
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    return `${dd}/${mm}/${yy || String(year).slice(2)}`;
  };

  const novRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, novLimit)]);
  const decRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, decLimit)]);

  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL COMPUTADO DE ENERO A ${endOfMonthStr(novLimit - 1)}`;
    row[3] = `TOTAL COMPUTADO DE ENERO A ${endOfMonthStr(decLimit - 1)}`;
    aoa.push(row);
  }
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(new Array(cols.length).fill(''));

  const maxLen = Math.max(novRows.length, decRows.length);
  const accountLabelToRowIdoni = new Map();
  if (formulaMeta) {
    for (const r of formulaMeta.accountRows) {
      const label = String(aoa[r]?.[0] || '').trim();
      if (label) accountLabelToRowIdoni.set(label, r);
    }
  }
  for (let i = 0; i < maxLen; i++) {
    const left = novRows[i] || ['', ''];
    const right = decRows[i] || ['', ''];
    const row = new Array(cols.length).fill('');
    row[0] = left[0];
    row[1] = left[1];
    row[3] = right[0];
    row[8] = right[1];
    const bottomRow = aoa.length;
    aoa.push(row);
    if (formulaMeta) {
      const sourceRow = accountLabelToRowIdoni.get(String(left[0] || '').trim());
      if (sourceRow != null) {
        formulaMeta.bottomAccountRows.push({
          row: bottomRow,
          sourceRow,
          novLimit,
          decLimit
        });
      }
    }
  }

  const bottomMetaIdoni = appendPigLineaBottomTotales({
    aoa,
    cols,
    lineName: 'IDONI',
    listAll,
    isSubv,
    novLimit,
    decLimit,
    endOfMonthStr,
    doubleSpaceBeneficio: true,
    cuentaResultados,
    beneficioConSubvTotal: beneficioConSubvTotalFinal,
    beneficioSinSubvTotal: beneficioSinSubvTotal
  });
  if (formulaMeta && bottomMetaIdoni) {
    formulaMeta.bottomConSubvRow = bottomMetaIdoni.bottomConSubvRow;
    formulaMeta.bottomSinSubvRow = bottomMetaIdoni.bottomSinSubvRow;
  }

  return formulaMeta ? { aoa, formulaMeta } : aoa;
}

function applyPigLineaKoikiObservaciones(aoa) {
  for (const [rowIdx, text] of PIG_LINEA_KOIKI_OBS_LINES) {
    ensureAoaCell(aoa, rowIdx, PIG_LINEA_KOIKI_OBS_COL, text);
  }
}

function buildPigLineaKoikiAoa({ title, months, cuentasMensuales = [], mensualMap, estimadosSlots = [], cuentaResultados = false }) {
  const aoa = [];
  const yy = inferYearSuffix2({ title, months });
  const totalLabel = `TOTAL ${yy || ''}`.trim();
  const totalEstLabel = `TOTAL ${yy || ''} ESTIMADO`.trim();
  const cols = cuentaResultados
    ? ['Cuenta', ...months, totalLabel, '']
    : ['Cuenta', ...months, totalLabel, '', totalEstLabel];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isKoiki = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('koiki');
  };
  const isSubv = (c) => isPigSubvCuenta(c);
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  const koiki = applyKoikiSeurOverrides2026(
    (cuentasMensuales || []).filter(isKoiki),
    inferYearFullFromPigTitle(title, months)
  );
  const subv = cuentaResultados ? [] : koiki.filter(isSubv).slice().sort(pigAccountCompare);
  const resto = koiki.filter((c) => !isSubv(c)).slice().sort(pigAccountCompare);

  const monthsLen = Math.min(12, months.length);
  const yearKoiki = inferYearFullFromPigTitle(title, months);
  const totalCol = monthsLen + 1;
  const formulaMeta = cuentaResultados
    ? {
      enabled: true,
      monthsLen,
      totalCol,
      subvRows: [],
      accountRows: [],
      incomeRows: [],
      expenseRows: [],
      subvDetail: [],
      bottomAccountRows: []
    }
    : null;

  let estimadoAntesIngreso;
  if (cuentaResultados) {
    const subvAppend = unwrapSubvAppend(appendCuentaResultadosSubvRows({ aoa, linea: 'KOIKI', monthsLen }));
    estimadoAntesIngreso = subvAppend.combined;
    formulaMeta.subvDetail = subvAppend.subvDetail;
    formulaMeta.subvRows = subvAppend.subvDetail.map((d) => d.row);
  } else {
    estimadoAntesIngreso = appendEstimadoSubvRows({
      aoa,
      monthsLen,
      estimadosSlots: applyKoikiEstimadoSubvOverrides2026(estimadosSlots, yearKoiki)
    });
  }

  if (subv.length) {
    for (const c of subv) {
      const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
      const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
    }
  }

  for (const c of resto) {
    const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
    const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
    const rowIdx = aoa.length;
    if (cuentaResultados) {
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '']);
      formulaMeta.accountRows.push(rowIdx);
      if (isIncomeGroup(c)) formulaMeta.incomeRows.push(rowIdx);
      if (isExpenseGroup(c)) formulaMeta.expenseRows.push(rowIdx);
    } else {
      aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
    }
  }

  // ===== Resumen inferior =====
  const allKoikiMonths = koiki.reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const totalBeneficioMes = allKoikiMonths;
  const totalBeneficioMesTotal = totalBeneficioMes.reduce((a, b) => a + (Number(b) || 0), 0);

  const ingresosSinSubvMonths = koiki
    .filter((c) => isIncomeGroup(c) && !isSubv(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const ingresosSinSubvTotal = ingresosSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const despesesMonths = koiki
    .filter((c) => isExpenseGroup(c))
    .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const despesesTotal = despesesMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  const beneficioSinSubvMonths = sumArray(ingresosSinSubvMonths, despesesMonths);
  const beneficioSinSubvTotal = beneficioSinSubvMonths.reduce((a, b) => a + (Number(b) || 0), 0);

  aoa.push(new Array(cols.length).fill(''));
  const estimadoTotal = sumMonths(estimadoAntesIngreso, monthsLen);
  const beneficioConSubvTotalFinal = totalBeneficioMesTotal + estimadoTotal;
  if (cuentaResultados) {
    const beneficioConSubv = sumArray(totalBeneficioMes, estimadoAntesIngreso);
    formulaMeta.beneficioPorMesRow = aoa.length;
    aoa.push(['TOTAL BENEFICIO POR MES KOIKI', ...beneficioConSubv, beneficioConSubvTotalFinal, '']);
    aoa.push(new Array(cols.length).fill(''));
    formulaMeta.ingresosSinSubvRow = aoa.length;
    aoa.push(['TOTAL INGRESOS KOIKI SIN SUBVENCIONES', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '']);
    formulaMeta.despesesRow = aoa.length;
    aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '']);
    formulaMeta.beneficioSinSubvRow = aoa.length;
    aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '']);
  } else {
    aoa.push(['TOTAL BENEFICIO POR MES KOIKI', ...totalBeneficioMes, totalBeneficioMesTotal, '', beneficioConSubvTotalFinal]);
    aoa.push(new Array(cols.length).fill(''));
    aoa.push(['TOTAL INGRESOS KOIKI SIN SUBVENCIONES', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
    aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
    aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);
  }

  // ===== Tablas inferiores (totales computados) =====
  const listAll = koiki.slice().sort(pigAccountCompare);
  const lastNonZeroMonth = (() => {
    let last = -1;
    for (const c of listAll) {
      const m = (c.months || []);
      for (let i = 0; i < Math.min(12, m.length); i++) {
        if (Number(m[i]) !== 0) last = Math.max(last, i);
      }
    }
    return last;
  })();
  const decLimit = Math.max(1, Math.min(12, (lastNonZeroMonth >= 0 ? lastNonZeroMonth + 1 : 12)));
  const novLimit = Math.max(1, decLimit - 1);
  const endOfMonthStr = (monthIndex) => {
    const yy = (title.match(/01\/01\/(\d{2})/)?.[1] || '').trim();
    const year = yy ? Number(`20${yy}`) : new Date().getFullYear();
    const m = Math.min(11, Math.max(0, monthIndex));
    const d = new Date(year, m + 1, 0).getDate();
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    return `${dd}/${mm}/${yy || String(year).slice(2)}`;
  };

  const novRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, novLimit)]);
  const decRows = listAll.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, decLimit)]);

  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(novLimit - 1)}`;
    row[3] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(decLimit - 1)}`;
    aoa.push(row);
  }
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(new Array(cols.length).fill(''));

  const maxLen = Math.max(novRows.length, decRows.length);
  const accountLabelToRowKoiki = new Map();
  if (formulaMeta) {
    for (const r of formulaMeta.accountRows) {
      const label = String(aoa[r]?.[0] || '').trim();
      if (label) accountLabelToRowKoiki.set(label, r);
    }
  }
  for (let i = 0; i < maxLen; i++) {
    const left = novRows[i] || ['', ''];
    const right = decRows[i] || ['', ''];
    const row = new Array(cols.length).fill('');
    row[0] = left[0];
    row[1] = left[1];
    row[3] = right[0];
    row[8] = right[1];
    const bottomRow = aoa.length;
    aoa.push(row);
    if (formulaMeta) {
      const sourceRow = accountLabelToRowKoiki.get(String(left[0] || '').trim());
      if (sourceRow != null) {
        formulaMeta.bottomAccountRows.push({
          row: bottomRow,
          sourceRow,
          novLimit,
          decLimit
        });
      }
    }
  }

  const bottomMetaKoiki = appendPigLineaBottomTotales({
    aoa,
    cols,
    lineName: 'KOIKI',
    listAll,
    isSubv,
    novLimit,
    decLimit,
    endOfMonthStr,
    doubleSpaceBeneficio: true,
    cuentaResultados,
    beneficioConSubvTotal: beneficioConSubvTotalFinal,
    beneficioSinSubvTotal: beneficioSinSubvTotal
  });
  if (formulaMeta && bottomMetaKoiki) {
    formulaMeta.bottomConSubvRow = bottomMetaKoiki.bottomConSubvRow;
    formulaMeta.bottomSinSubvRow = bottomMetaKoiki.bottomSinSubvRow;
  }

  if (!cuentaResultados) applyPigLineaKoikiObservaciones(aoa);

  return formulaMeta ? { aoa, formulaMeta } : aoa;
}

function buildPigLineaObradorAoa({ title, months, cuentasMensuales = [] }) {
  const aoa = [];
  const yy = inferYearSuffix2({ title, months });
  const totalLabel = `TOTAL ${yy || ''}`.trim();
  const cols = ['Cuenta', ...months, totalLabel];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const monthsLen = Math.min(12, months.length);
  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isObrador = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('obrador');
  };

  const obrador = (cuentasMensuales || []).filter(isObrador).slice().sort(pigAccountCompare);

  for (const c of obrador) {
    const monthsVals = (c.months || new Array(12).fill(0)).slice(0, 12);
    const total = monthsVals.reduce((a, b) => a + (Number(b) || 0), 0);
    aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total]);
  }

  // ===== Resumen inferior =====
  const totalBeneficioMes = obrador.reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
  const totalBeneficioMesTotal = totalBeneficioMes.reduce((a, b) => a + (Number(b) || 0), 0);

  aoa.push(new Array(cols.length).fill(''));
  aoa.push(['TOTAL BENEFICIO POR MES OBRADOR', ...totalBeneficioMes, totalBeneficioMesTotal]);

  // ===== Tablas inferiores (totales computados) =====
  const lastNonZeroMonth = (() => {
    let last = -1;
    for (const c of obrador) {
      const m = (c.months || []);
      for (let i = 0; i < Math.min(12, m.length); i++) {
        if (Number(m[i]) !== 0) last = Math.max(last, i);
      }
    }
    return last;
  })();
  const decLimit = Math.max(1, Math.min(12, (lastNonZeroMonth >= 0 ? lastNonZeroMonth + 1 : 12)));
  const novLimit = Math.max(1, decLimit - 1);

  const endOfMonthStr = (monthIndex) => {
    const yy = (title.match(/01\/01\/(\d{2})/)?.[1] || '').trim();
    const year = yy ? Number(`20${yy}`) : new Date().getFullYear();
    const m = Math.min(11, Math.max(0, monthIndex));
    const d = new Date(year, m + 1, 0).getDate();
    const dd = String(d).padStart(2, '0');
    const mm = String(m + 1).padStart(2, '0');
    return `${dd}/${mm}/${yy || String(year).slice(2)}`;
  };

  const novRows = obrador.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, novLimit)]);
  const decRows = obrador.map((c) => [`${c.code} - ${c.name}`.trim(), sumMonths(c.months, decLimit)]);

  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(novLimit - 1)}`;
    row[3] = `TOTAL COMPUTADO ENERO A ${endOfMonthStr(decLimit - 1)}`;
    aoa.push(row);
  }
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(new Array(cols.length).fill(''));

  const maxLen = Math.max(novRows.length, decRows.length);
  for (let i = 0; i < maxLen; i++) {
    const left = novRows[i] || ['', ''];
    const right = decRows[i] || ['', ''];
    const row = new Array(cols.length).fill('');
    row[0] = left[0];
    row[1] = left[1];
    row[3] = right[0];
    row[8] = right[1];
    aoa.push(row);
  }

  const novTotal = obrador.reduce((sum, c) => sum + sumMonths(c.months, novLimit), 0);
  const decTotal = obrador.reduce((sum, c) => sum + sumMonths(c.months, decLimit), 0);
  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL BENEFICIO OBRADOR A ${endOfMonthStr(novLimit - 1)}`;
    row[1] = novTotal;
    row[3] = `TOTAL BENEFICIO OBRADOR A ${endOfMonthStr(decLimit - 1)}`;
    row[8] = decTotal;
    aoa.push(row);
  }

  return aoa;
}

function buildPigLineaObrador2Aoa({ title, months, cuentasMensuales = [] }) {
  const normalizeCode = (code) => String(code || '').replace(/[^\d]/g, '').trim();
  // Cuentas definitivas para OBRADOR 2 (según foto)
  const allowed = new Set([
    '70000004', // SERVICIO COMERCIAL OBRADOR A EISSSIDNI
    '70000007', // OBRADOR
    '70000009', // SERVICIO COMERCIAL MH OBRADOR A CATBONCOR...
    '60000001', // COMPRAS OBRADOR
    '62300005', // SERV COMERCIAL IDONI A OBRADOR PRODUCCIÓN
    '62900079', // Otros servicios Obrador
    '64000001', // Sueldos y salarios OBRADOR
    '640000001', // variante (por si Holded lo exporta con 9 dígitos)
    '64200000' // SEG SOCIAL A CARGO DE LA EMP OBRADOR
  ]);
  const onlyThese = (cuentasMensuales || []).filter((c) => allowed.has(normalizeCode(c?.code)));
  return buildPigLineaObradorAoa({ title, months, cuentasMensuales: onlyThese });
}

function stylePigLineaObradorSheet({ ws, aoa }) {
  ws['!sheetView'] = [{ showGridLines: false }];
  const colsLen = Math.max(1, (aoa?.[2]?.length || 0));
  ws['!cols'] = new Array(colsLen).fill(null).map((_, i) => ({ wch: i === 0 ? 56 : 12 }));
  ws['!rows'] = ws['!rows'] || [];
  ws['!rows'][0] = { hpt: 20 };

  ws['!merges'] = ws['!merges'] || [];
  ws['!merges'].push({ s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, colsLen - 1) } });

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  // Título rojo centrado
  setRangeStyle(ws, 0, 0, 0, colsLen - 1, {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  // Header (fila 2, 0-index)
  const headerRow = 2;
  setRangeStyle(ws, headerRow, 0, headerRow, colsLen - 1, {
    font: { bold: true, name: 'Calibri' },
    fill: makeFill('#D9E1F2'),
    border: borderThin,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });

  const isBottomTitle = (v) => /TOTAL\s+COMPUTADO.*ENERO/i.test(String(v || '').replace(/\s+/g, ' '));
  const bottomStartRow = (() => {
    for (let r = headerRow + 1; r < aoa.length; r++) {
      const vA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (isBottomTitle(vA)) return r;
    }
    return -1;
  })();

  // Bloque principal: bordes + numFmt (sin tocar la zona de tablas inferiores)
  const rEndMain = bottomStartRow > 0 ? bottomStartRow - 1 : aoa.length - 1;
  for (let r = headerRow + 1; r <= rEndMain; r++) {
    setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
    for (let c = 1; c <= Math.min(12, colsLen - 2); c++) {
      setCellStyle(ws, r, c, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
    }
    // TOTAL (última columna)
    setCellStyle(ws, r, colsLen - 1, {
      border: borderThin,
      fill: makeFill('#C6EFCE'),
      numFmt: '#,##0.00;[Red]-#,##0.00',
      alignment: { horizontal: 'right' }
    });

    const vA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (vA && String(vA).toUpperCase().includes('TOTAL BENEFICIO POR MES')) {
      setRangeStyle(ws, r, 0, r, colsLen - 1, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFF2CC'), border: borderThin });
    }
  }

  // Tablas inferiores: misma solución que EISSS (merge D..H + valor en I) y limpiar estilos heredados
  if (bottomStartRow > 0 && colsLen > 8) {
    const rightLabelStartCol = 3; // D
    const rightLabelEndCol = 7; // H
    const rightValueCol = 8; // I

    // 1) Limpiar estilos de la zona inferior
    for (let r = bottomStartRow; r < aoa.length; r++) {
      for (let c = 0; c < colsLen; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr] && ws[addr].s) delete ws[addr].s;
      }
    }

    for (let r = bottomStartRow; r < aoa.length; r++) {
      const a0 = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      const a1 = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
      const d0 = ws[XLSX.utils.encode_cell({ r, c: rightLabelStartCol })]?.v;
      const d1 = ws[XLSX.utils.encode_cell({ r, c: rightValueCol })]?.v;

      // Izquierda (A-B)
      if (a0 && isBottomTitle(a0)) {
        setRangeStyle(ws, r, 0, r, 1, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#E7E6E6'), border: borderThin });
      } else {
        setCellStyle(ws, r, 0, { border: borderThin, font: a0 && /^\d{3,}/.test(String(a0)) ? { bold: true, name: 'Calibri' } : { name: 'Calibri' } });
        if (a1 !== undefined) setCellStyle(ws, r, 1, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      }

      // Derecha (D..H merge + I valor)
      if (d0) {
        ws['!merges'] = ws['!merges'] || [];
        ws['!merges'].push({ s: { r, c: rightLabelStartCol }, e: { r, c: rightLabelEndCol } });
      }

      if (d0 && isBottomTitle(d0)) {
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#E7E6E6'), border: borderThin });
        setCellStyle(ws, r, rightValueCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#E7E6E6'), border: borderThin });
      } else {
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, {
          border: borderThin,
          font: d0 && /^\d{3,}/.test(String(d0)) ? { bold: true, name: 'Calibri' } : { name: 'Calibri' },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: false }
        });
        if (d1 !== undefined) setCellStyle(ws, r, rightValueCol, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      }

      // Totales finales (amarillo)
      if (a0 && String(a0).toUpperCase().includes('TOTAL BENEFICIO OBRADOR A')) {
        setRangeStyle(ws, r, 0, r, 1, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin });
      }
      if (d0 && String(d0).toUpperCase().includes('TOTAL BENEFICIO OBRADOR A')) {
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin });
        setCellStyle(ws, r, rightValueCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      }
    }
  }
}

const PIG_COMPARATIVA_CATERING_OBS_LINES = (yearCurrent) => [
  'LAS CELDAS EN COLOR',
  `VERDE EN LA BASE ${yearCurrent}`,
  'SON PRESUPUESTOS',
  'APROBADOS'
];

function buildComparativaAnualAoa({ mensualParsed, objetivos, basesPrevYear, basesPrev2Year, cateringHoldedBudget = null }) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const aoa = [];
  const yearCurrent = Number(mensualParsed?.yearGuess || 2025) || 2025;
  const yy = String(yearCurrent).slice(2);
  const yearPrev = yearCurrent - 1;
  const yearPrev2 = yearCurrent - 2;
  const showBaseYearPrev2 = yearPrev2 > 2023;

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));

  const computeIngresosSinSubv = ({ contains, extraCodePred, subvCodePred }) => {
    let cuentas = mensualParsed?.cuentas || [];
    if (String(contains || '').toLowerCase() === 'koiki') {
      cuentas = applyKoikiSeurOverrides2026(cuentas, yearCurrent);
    }
    const inLine = (c) => {
      const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
      if (extraCodePred && extraCodePred(c)) return true;
      return hay.includes(String(contains).toLowerCase());
    };
    const isSubv = (c) => {
      if (subvCodePred && subvCodePred(c)) return true;
      return isPigSubvCuenta(c);
    };
    const isIncomeGroup = (c) => {
      const g = String(c?.groupLabel || '');
      return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
    };
    const monthsLen = 12;
    const vals = cuentas
      .filter((c) => inLine(c) && isIncomeGroup(c) && !isSubv(c))
      .reduce((acc, c) => sumArray(acc, (c.months || new Array(12).fill(0)).slice(0, monthsLen)), new Array(monthsLen).fill(0));
    return vals;
  };

  const sum = (arr) => (arr || []).reduce((a, b) => a + (Number(b) || 0), 0);
  const buildObjetivoRestante = (objetivoTotal, base2025Months) => {
    const out = new Array(12).fill(0);
    let rem = Number(objetivoTotal) || 0;
    for (let i = 0; i < 12; i++) {
      rem = rem - (Number(base2025Months?.[i]) || 0);
      out[i] = rem;
    }
    return out;
  };

  // ===== Datos fijos (bases históricas) según el CSV “bueno” =====
  const CATERING_BASE_2022 = [586.50, 1608.00, 6411.43, 19130.50, 17400.00, 41764.30, 14805.00, 0.00, 26804.76, 23986.00, 74105.20, 28063.50];
  const CATERING_BASE_2023 = [8085.00, 19665.50, 59432.50, 24254.73, 30594.50, 39039.70, 43199.82, 0.00, 18551.50, 35462.68, 55584.10, 60249.31];
  const CATERING_BASE_2024 = [16675.63, 34444.35, 31688.33, 23797.23, 62001.72, 64109.93, 51543.42, 0.00, 28529.52, 99723.71, 52183.66, 45869.00];

  const IDONI_BASE_2024 = [0, 0, 0, 8659.96, 8921.72, 8770.40, 8489.19, 2377.82, 8412.98, 9782.84, 9776.04, 19841.28];

  const KOIKI_BASE_2024 = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 146.00, 1108.15];
  const KOIKI_NOVDIC_REFERENCIA = { nov: 580.68, dic: 651.89 };

  const pickBaseMonths = (fromDb, year, fallback2024) => {
    if (Array.isArray(fromDb) && fromDb.length === 12) return fromDb;
    if (year === 2024 && fallback2024) return fallback2024;
    return new Array(12).fill(0);
  };

  const prevBases = basesPrevYear || {};
  const prev2Bases = basesPrev2Year || {};
  const cateringBase2024 = pickBaseMonths(prev2Bases.CATERING, yearPrev2, CATERING_BASE_2024);
  const idoniBase2024 = pickBaseMonths(prev2Bases.IDONI, yearPrev2, IDONI_BASE_2024);
  const koikiBase2024 = pickBaseMonths(prev2Bases.KOIKI, yearPrev2, KOIKI_BASE_2024);
  const cateringPrev = pickBaseMonths(prevBases.CATERING, yearPrev, yearPrev === 2024 ? CATERING_BASE_2024 : null);
  const idoniPrev = pickBaseMonths(prevBases.IDONI, yearPrev, yearPrev === 2024 ? IDONI_BASE_2024 : null);
  const koikiPrev = pickBaseMonths(prevBases.KOIKI, yearPrev, yearPrev === 2024 ? KOIKI_BASE_2024 : null);

  const cateringBaseYearCol = showBaseYearPrev2 ? 6 : 5;

  // ===== Bases del año actual calculadas desde el CSV mensual (ingresos sin subvenciones) =====
  const cateringCurrentBilling = computeIngresosSinSubv({ contains: 'catering' });
  let cateringBudgetFlags = new Array(12).fill(false);
  let cateringCurrent = cateringCurrentBilling;
  if (Array.isArray(cateringHoldedBudget)) {
    const merged = mergeCateringBaseWithHoldedBudgets(cateringCurrentBilling, cateringHoldedBudget);
    cateringCurrent = merged.months;
    cateringBudgetFlags = merged.fromBudget;
  }
  const idoniCurrent = computeIngresosSinSubv({ contains: 'idoni' });
  const koikiCurrentRaw = computeIngresosSinSubv({ contains: 'koiki' });

  // KOIKI: el “+ NOV/DIC” era un caso concreto del Excel 2025 (facturado en 2026).
  // Solo lo aplicamos cuando el año actual es 2025.
  const koikiCurrent = koikiCurrentRaw.slice();
  const koikiCurrentPlusNovDic = koikiCurrent.slice();
  if (yearCurrent === 2025) {
    koikiCurrent[10] = 0;
    koikiCurrent[11] = 0;
    koikiCurrentPlusNovDic[10] = KOIKI_NOVDIC_REFERENCIA.nov;
    koikiCurrentPlusNovDic[11] = KOIKI_NOVDIC_REFERENCIA.dic;
  }

  // ===== Objetivos (inputs) =====
  const obj = objetivos || {};
  const cateringObjNormal = Number(obj?.catering?.normal ?? 525849.55) || 0;
  const cateringObjOptim = Number(obj?.catering?.optim ?? 575849.55) || 0;
  const idoniObjNormal = Number(obj?.idoni?.normal ?? 140000.0) || 0;
  const idoniObjOptim = Number(obj?.idoni?.optim ?? 150000.0) || 0;
  const koikiObjNormal = Number(obj?.koiki?.normal ?? 20207.0) || 0;
  const koikiObjOptim = Number(obj?.koiki?.optim ?? 23881.0) || 0;

  const cateringObjNormalRest = buildObjetivoRestante(cateringObjNormal, cateringCurrent);
  const cateringObjOptimRest = buildObjetivoRestante(cateringObjOptim, cateringCurrent);
  const idoniObjNormalRest = buildObjetivoRestante(idoniObjNormal, idoniCurrent);
  const idoniObjOptimRest = buildObjetivoRestante(idoniObjOptim, idoniCurrent);
  const koikiObjNormalRest = buildObjetivoRestante(koikiObjNormal, koikiCurrent);
  const koikiObjOptimRest = buildObjetivoRestante(koikiObjOptim, koikiCurrent);

  const cateringDiffMid = showBaseYearPrev2
    ? cateringPrev.map((v, i) => (Number(v) || 0) - (Number(cateringBase2024[i]) || 0))
    : cateringPrev.map((v, i) => (Number(v) || 0) - (Number(CATERING_BASE_2023[i]) || 0));
  const cateringDiffMidLabel = showBaseYearPrev2
    ? `DIFERENCIA ${String(yearPrev2).slice(2)} - ${String(yearPrev).slice(2)}`
    : `DIFERENCIA 23 - ${String(yearPrev).slice(2)}`;

  const idoniDiffMid = showBaseYearPrev2
    ? idoniPrev.map((v, i) => (Number(v) || 0) - (Number(idoniBase2024[i]) || 0))
    : null;
  const idoniDiffMidLabel = showBaseYearPrev2
    ? `DIFERENCIA ${String(yearPrev2).slice(2)} - ${String(yearPrev).slice(2)}`
    : null;

  const koikiDiffMid = showBaseYearPrev2
    ? koikiPrev.map((v, i) => (Number(v) || 0) - (Number(koikiBase2024[i]) || 0))
    : null;
  const koikiDiffMidLabel = showBaseYearPrev2
    ? `DIFERENCIA ${String(yearPrev2).slice(2)} - ${String(yearPrev).slice(2)}`
    : null;

  // ===== Construcción AOA =====
  const blank = () => [];
  aoa.push(['CATERING']);
  const cateringHeader = [
    'MES',
    'Base 2022',
    'Base 2023'
  ];
  if (showBaseYearPrev2) cateringHeader.push(`BASE ${yearPrev2}`);
  cateringHeader.push(
    `BASE ${yearPrev}`,
    cateringDiffMidLabel,
    `BASE ${yearCurrent}`,
    `DIFERENCIA ${String(yearPrev).slice(2)} - ${yy}`,
    `OBJECTIU ${yy} ESCENARI NORMAL`,
    `OBJECTIU ${yy} ESCENARI ÒPTIM`
  );
  aoa.push(cateringHeader);
  const cateringObjRow = showBaseYearPrev2
    ? ['', '', '', '', '', '', '', '', cateringObjNormal, cateringObjOptim]
    : ['', '', '', '', '', '', '', cateringObjNormal, cateringObjOptim];
  aoa.push(cateringObjRow);
  const cateringDataStartRow = aoa.length;
  for (let i = 0; i < 12; i++) {
    const row = [
      months[i],
      CATERING_BASE_2022[i],
      CATERING_BASE_2023[i]
    ];
    if (showBaseYearPrev2) row.push(cateringBase2024[i]);
    row.push(
      cateringPrev[i],
      cateringDiffMid[i],
      cateringCurrent[i],
      (cateringCurrent[i] - cateringPrev[i]),
      cateringObjNormalRest[i],
      cateringObjOptimRest[i]
    );
    aoa.push(row);
  }
  aoa.push(blank());
  const cateringTotal = [
    'TOTAL ACUMULADO',
    sum(CATERING_BASE_2022),
    sum(CATERING_BASE_2023)
  ];
  if (showBaseYearPrev2) cateringTotal.push(sum(cateringBase2024));
  cateringTotal.push(
    sum(cateringPrev),
    sum(cateringDiffMid),
    sum(cateringCurrent),
    sum(cateringCurrent) - sum(cateringPrev),
    (sum(cateringCurrent) - cateringObjNormal),
    (sum(cateringCurrent) - cateringObjOptim)
  );
  const cateringTotalRow = aoa.length;
  aoa.push(cateringTotal);

  const cateringObsCol = cateringHeader.length;
  const cateringHeaderRow = 1;
  const cateringSectionMaxCol = cateringHeader.length - 1;
  const obsLines = PIG_COMPARATIVA_CATERING_OBS_LINES(yearCurrent);
  const cateringObsTextStartRow = cateringDataStartRow + Math.floor((12 - obsLines.length) / 2);
  ensureAoaCell(aoa, cateringHeaderRow, cateringObsCol, 'OBSERVACIONES');
  obsLines.forEach((line, idx) => {
    ensureAoaCell(aoa, cateringObsTextStartRow + idx, cateringObsCol, line);
  });

  // Columnas numéricas catering para fórmulas
  const catPrevCol = showBaseYearPrev2 ? 4 : 3;
  const catDiffMidCol = showBaseYearPrev2 ? 5 : 4;
  const catCurCol = showBaseYearPrev2 ? 6 : 5;
  const catDiffCurCol = showBaseYearPrev2 ? 7 : 6;
  const catDiffMidLeft = catPrevCol;
  const catDiffMidRight = showBaseYearPrev2 ? 3 : 2;
  const cateringSumCols = [];
  for (let c = 1; c <= catDiffCurCol; c++) cateringSumCols.push(c);
  // Totales objetivo (última pareja) también son acumulados vs objetivo, no SUMA de meses de obj —
  // se dejan como valor en TOTAL; solo sumamos bases/diffs.
  const cateringFormulaSection = {
    dataStartRow: cateringDataStartRow,
    totalRow: cateringTotalRow,
    months: 12,
    sumCols: cateringSumCols,
    diffSpecs: [
      { col: catDiffMidCol, leftCol: catDiffMidLeft, rightCol: catDiffMidRight },
      { col: catDiffCurCol, leftCol: catCurCol, rightCol: catPrevCol }
    ]
  };

  aoa.push(blank());
  aoa.push(blank());
  aoa.push(['IDONI']);
  const idoniHeader = ['MES'];
  if (showBaseYearPrev2) idoniHeader.push(`BASE ${yearPrev2}`, `BASE ${yearPrev}`, idoniDiffMidLabel);
  else idoniHeader.push(`BASE ${yearPrev}`);
  idoniHeader.push(
    `BASE ${yearCurrent}`,
    `DIFERENCIA ${String(yearPrev).slice(2)} - ${yy}`,
    `OBJECTIU ${yy} ESCENARI NORMAL`,
    `OBJECTIU ${yy} ESCENARI ÒPTIM`
  );
  aoa.push(idoniHeader);
  const idoniObjRow = showBaseYearPrev2
    ? ['', '', '', '', '', '', idoniObjNormal, idoniObjOptim]
    : ['', '', '', '', idoniObjNormal, idoniObjOptim];
  aoa.push(idoniObjRow);
  const idoniDataStartRow = aoa.length;
  for (let i = 0; i < 12; i++) {
    const row = [months[i]];
    if (showBaseYearPrev2) row.push(idoniBase2024[i], idoniPrev[i], idoniDiffMid[i]);
    else row.push(idoniPrev[i]);
    row.push(
      idoniCurrent[i],
      (idoniCurrent[i] - idoniPrev[i]),
      idoniObjNormalRest[i],
      idoniObjOptimRest[i]
    );
    aoa.push(row);
  }
  aoa.push(blank());
  const idoniTotal = ['TOTAL ACUMULADO'];
  if (showBaseYearPrev2) idoniTotal.push(sum(idoniBase2024), sum(idoniPrev), sum(idoniDiffMid));
  else idoniTotal.push(sum(idoniPrev));
  idoniTotal.push(
    sum(idoniCurrent),
    sum(idoniCurrent) - sum(idoniPrev),
    (sum(idoniCurrent) - idoniObjNormal),
    (sum(idoniCurrent) - idoniObjOptim)
  );
  const idoniTotalRow = aoa.length;
  aoa.push(idoniTotal);

  const idoniPrevCol = showBaseYearPrev2 ? 2 : 1;
  const idoniDiffMidCol = showBaseYearPrev2 ? 3 : null;
  const idoniCurCol = showBaseYearPrev2 ? 4 : 2;
  const idoniDiffCurCol = showBaseYearPrev2 ? 5 : 3;
  const idoniSumCols = [];
  for (let c = 1; c <= idoniDiffCurCol; c++) idoniSumCols.push(c);
  const idoniDiffSpecs = [{ col: idoniDiffCurCol, leftCol: idoniCurCol, rightCol: idoniPrevCol }];
  if (idoniDiffMidCol != null) {
    idoniDiffSpecs.unshift({ col: idoniDiffMidCol, leftCol: idoniPrevCol, rightCol: 1 });
  }
  const idoniFormulaSection = {
    dataStartRow: idoniDataStartRow,
    totalRow: idoniTotalRow,
    months: 12,
    sumCols: idoniSumCols,
    diffSpecs: idoniDiffSpecs
  };

  aoa.push(blank());
  aoa.push(blank());
  aoa.push(['KOIKI']);
  const koikiHeader = ['MES'];
  if (showBaseYearPrev2) koikiHeader.push(`BASE ${yearPrev2}`, `BASE ${yearPrev}`, koikiDiffMidLabel);
  else koikiHeader.push(`BASE ${yearPrev}`);
  koikiHeader.push(
    `BASE ${yearCurrent}`,
    `BASE ${yearCurrent} + NOV/DIC`,
    `DIFERENCIA ${String(yearPrev).slice(2)} - ${yy}`,
    `OBJECTIU ${yy} ESCENARI NORMAL`,
    `OBJECTIU ${yy} ESCENARI ÒPTIM`
  );
  aoa.push(koikiHeader);
  const koikiObjRow = showBaseYearPrev2
    ? ['', '', '', '', '', '', '', koikiObjNormal, koikiObjOptim]
    : ['', '', '', '', '', koikiObjNormal, koikiObjOptim];
  aoa.push(koikiObjRow);
  const koikiDataStartRow = aoa.length;
  const koikiDiff = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    const bPrev = Number(koikiPrev[i]) || 0;
    const bCur = Number(koikiCurrent[i]) || 0;
    koikiDiff[i] = (yearCurrent === 2025 && bCur === 0 && bPrev > 0) ? (bPrev - bCur) : (bCur - bPrev);
    const row = [months[i]];
    if (showBaseYearPrev2) row.push(koikiBase2024[i], koikiPrev[i], koikiDiffMid[i]);
    else row.push(koikiPrev[i]);
    row.push(
      koikiCurrent[i],
      koikiCurrentPlusNovDic[i],
      koikiDiff[i],
      koikiObjNormalRest[i],
      koikiObjOptimRest[i]
    );
    aoa.push(row);
  }
  aoa.push(blank());
  const koikiTotal = ['TOTAL ACUMULADO'];
  if (showBaseYearPrev2) koikiTotal.push(sum(koikiBase2024), sum(koikiPrev), sum(koikiDiffMid));
  else koikiTotal.push(sum(koikiPrev));
  koikiTotal.push(
    sum(koikiCurrent),
    sum(koikiCurrentPlusNovDic),
    sum(koikiDiff),
    (sum(koikiCurrent) - koikiObjNormal),
    (sum(koikiCurrent) - koikiObjOptim)
  );
  const koikiTotalRow = aoa.length;
  aoa.push(koikiTotal);

  const koikiPrevCol = showBaseYearPrev2 ? 2 : 1;
  const koikiDiffMidCol = showBaseYearPrev2 ? 3 : null;
  const koikiCurCol = showBaseYearPrev2 ? 4 : 2;
  const koikiDiffCurCol = showBaseYearPrev2 ? 6 : 4;
  const koikiSumCols = [];
  for (let c = 1; c <= koikiDiffCurCol; c++) koikiSumCols.push(c);
  const koikiDiffSpecs = [];
  if (koikiDiffMidCol != null) {
    koikiDiffSpecs.push({ col: koikiDiffMidCol, leftCol: koikiPrevCol, rightCol: 1 });
  }
  // Diff KOIKI puede invertir signo en 2025 — no forzar fórmula si yearCurrent===2025
  if (yearCurrent !== 2025) {
    koikiDiffSpecs.push({ col: koikiDiffCurCol, leftCol: koikiCurCol, rightCol: koikiPrevCol });
  }
  const koikiFormulaSection = {
    dataStartRow: koikiDataStartRow,
    totalRow: koikiTotalRow,
    months: 12,
    sumCols: koikiSumCols,
    diffSpecs: koikiDiffSpecs
  };

  return {
    aoa,
    cateringMeta: {
      dataStartRow: cateringDataStartRow,
      baseYearCol: cateringBaseYearCol,
      budgetMonthFlags: cateringBudgetFlags,
      billingMonths: cateringCurrentBilling,
      mergedMonths: cateringCurrent,
      cateringSectionMaxCol,
      cateringObsCol,
      cateringObsHeaderRow: cateringHeaderRow,
      cateringObsTextStartRow,
      cateringObsTextEndRow: cateringObsTextStartRow + obsLines.length - 1
    },
    formulaMeta: {
      sections: [cateringFormulaSection, idoniFormulaSection, koikiFormulaSection]
    }
  };
}

function styleComparativaAnualSheet({ ws, aoa, cateringMeta = null }) {
  ws['!sheetView'] = [{ showGridLines: false }];
  const maxCol = Math.max(8, ...aoa.map((row) => Math.max(0, (row?.length || 0) - 1)));
  ws['!cols'] = Array.from({ length: maxCol + 1 }, (_, i) => ({
    wch: i === 0 ? 18 : i >= maxCol - 1 ? 22 : 14
  }));

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };
  const numStyle = { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right', vertical: 'center' } };
  const labelStyle = { border: borderThin, alignment: { vertical: 'center' } };

  const isSectionTitle = (v) => ['CATERING', 'IDONI', 'KOIKI'].includes(String(v || '').trim().toUpperCase());

  for (let r = 0; r < aoa.length; r++) {
    const v0 = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (isSectionTitle(v0)) {
      const fill =
        String(v0).toUpperCase() === 'CATERING'
          ? makeFill('#E2EFDA')
          : String(v0).toUpperCase() === 'IDONI'
            ? makeFill('#FCE4D6')
            : makeFill('#DDEBF7');
      const sectionEndCol = (
        String(v0).toUpperCase() === 'CATERING' && cateringMeta?.cateringSectionMaxCol != null
      ) ? cateringMeta.cateringSectionMaxCol : maxCol;
      setRangeStyle(ws, r, 0, r, sectionEndCol, { fill, border: borderThin, font: { bold: true, name: 'Calibri' } });
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: sectionEndCol } });
      continue;
    }

    // Cabeceras (MES, BASE..., etc.)
    if (v0 && String(v0).trim().toUpperCase() === 'MES') {
      setRangeStyle(ws, r, 0, r, maxCol, { fill: makeFill('#E7E6E6'), border: borderThin, font: { bold: true, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } });
      continue;
    }

    // Total acumulado
    if (v0 && String(v0).toUpperCase().includes('TOTAL ACUMULADO')) {
      setRangeStyle(ws, r, 0, r, maxCol, { fill: makeFill('#F8CBAD'), border: borderThin, font: { bold: true, name: 'Calibri' } });
    }

    // Bordes/formatos por defecto en filas con datos (si hay números en B)
    const v1 = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
    if (v0 && (typeof v1 === 'number' || v0 === 'TOTAL ACUMULADO')) {
      setCellStyle(ws, r, 0, labelStyle);
      for (let c = 1; c <= maxCol; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        if (typeof cell.v === 'number') setCellStyle(ws, r, c, numStyle);
        else setCellStyle(ws, r, c, { border: borderThin, alignment: { horizontal: 'center', vertical: 'center' } });
      }
    }
  }

  if (cateringMeta) {
    const {
      dataStartRow,
      baseYearCol,
      budgetMonthFlags = [],
      cateringObsCol,
      cateringObsHeaderRow,
      cateringObsTextStartRow,
      cateringObsTextEndRow
    } = cateringMeta;
    const greenBudget = makeFill('#92D050');
    for (let i = 0; i < 12; i++) {
      if (!budgetMonthFlags[i]) continue;
      const r = dataStartRow + i;
      setCellStyle(ws, r, baseYearCol, {
        fill: greenBudget,
        border: borderThin,
        numFmt: '#,##0.00;[Red]-#,##0.00',
        alignment: { horizontal: 'right', vertical: 'center' },
        font: { name: 'Calibri' }
      });
    }

    if (cateringObsCol != null && cateringObsHeaderRow != null) {
      ws['!cols'][cateringObsCol] = { wch: 24 };
      setCellStyle(ws, cateringObsHeaderRow, cateringObsCol, {
        fill: makeFill('#E7E6E6'),
        border: borderThin,
        font: { bold: true, name: 'Calibri' },
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
      });
      if (cateringObsTextStartRow != null && cateringObsTextEndRow != null) {
        for (let r = cateringObsTextStartRow; r <= cateringObsTextEndRow; r++) {
          setCellStyle(ws, r, cateringObsCol, {
            border: borderThin,
            font: { bold: true, name: 'Calibri', sz: 11 },
            alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
          });
        }
      }
    }
  }
}

function stylePigLineaCateringSheet({ ws, aoa, koikiObservations = false }) {
  ws['!sheetView'] = [{ showGridLines: false }];
  // Cuenta + 12 meses + total + separador + total subv (+ obs KOIKI)
  const colDefs = [
    { wch: 62 },
    ...new Array(12).fill({ wch: 12 }),
    { wch: 14 },
    { wch: 2 },
    { wch: 18 }
  ];
  if (koikiObservations) {
    colDefs[16] = { wch: 3 };
    colDefs[PIG_LINEA_KOIKI_OBS_COL] = { wch: 34 };
  }
  ws['!cols'] = colDefs;
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  // Merge título (fila 0, col 0..15)
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 15 } }];
  setRangeStyle(ws, 0, 0, 0, 15, {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  const headerRow = 2;
  // Cabecera gris (Cuenta + meses + total)
  setRangeStyle(ws, headerRow, 0, headerRow, 13, {
    font: { bold: true, name: 'Calibri' },
    fill: makeFill('#E7E6E6'),
    border: borderThin,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });
  // Separador vacío con borde suave
  setCellStyle(ws, headerRow, 14, { border: borderThin, fill: makeFill('#FFFFFF') });
  // Cabecera amarilla "TOTAL 25 ESTIMADO SUBV"
  setCellStyle(ws, headerRow, 15, {
    font: { bold: true, name: 'Calibri' },
    fill: makeFill('#FFFF00'),
    border: borderThin,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
  });

  const isBottomTitle = (v) => /TOTAL\s+COMPUTADO.*ENERO/i.test(String(v || '').replace(/\s+/g, ' '));
  const bottomStartRow = (() => {
    for (let r = headerRow + 1; r < aoa.length; r++) {
      const vA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (isBottomTitle(vA)) return r;
    }
    return -1;
  })();

  // Columnas numéricas (bloque principal + resumen). Evitamos machacar las tablas inferiores.
  const rEndMain = bottomStartRow > 0 ? bottomStartRow - 1 : aoa.length - 1;
  for (let r = headerRow + 1; r <= rEndMain; r++) {
    // Col 0 label
    setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });

    // Meses (1..12)
    for (let c = 1; c <= 12; c++) {
      setCellStyle(ws, r, c, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
    }

    // Total 25 (col 13) fondo verde suave
    setCellStyle(ws, r, 13, {
      border: borderThin,
      fill: makeFill('#C6EFCE'),
      numFmt: '#,##0.00;[Red]-#,##0.00',
      alignment: { horizontal: 'right' }
    });

    // Separador (col 14)
    setCellStyle(ws, r, 14, { border: borderThin, fill: makeFill('#FFFFFF') });

    // Total estimado subv (col 15) fondo amarillo
    setCellStyle(ws, r, 15, {
      border: borderThin,
      fill: makeFill('#FFFF00'),
      numFmt: '#,##0.00;[Red]-#,##0.00',
      alignment: { horizontal: 'right' }
    });

    // Resaltar filas de sección / totales
    const vA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (vA && String(vA).toUpperCase().includes('ESTIMADO DE SUBVENCIÓN')) {
      setRangeStyle(ws, r, 0, r, 15, {
        font: { bold: true, name: 'Calibri' },
        fill: makeFill('#FFFFFF'),
        border: borderThin
      });
      setCellStyle(ws, r, 0, { alignment: { horizontal: 'center' } });
    }

    if (vA && (
      String(vA).toUpperCase().includes('TOTAL BENEFICIO POR MES') ||
      String(vA).toUpperCase().includes('TOTAL INGRESOS') ||
      String(vA).toUpperCase().includes('TOTAL DESPESES') ||
      String(vA).toUpperCase().includes('BENEFICIO SIN SUBVENCIONES')
    )) {
      setRangeStyle(ws, r, 0, r, 15, { font: { bold: true, name: 'Calibri' }, border: borderThin });
      // rellenos tipo captura
      if (String(vA).toUpperCase().includes('TOTAL BENEFICIO POR MES')) {
        setRangeStyle(ws, r, 0, r, 15, { fill: makeFill('#FFF2CC'), border: borderThin });
      }
      if (String(vA).toUpperCase().includes('TOTAL INGRESOS')) {
        setRangeStyle(ws, r, 0, r, 15, { fill: makeFill('#E2EFDA'), border: borderThin });
      }
      if (String(vA).toUpperCase().includes('TOTAL DESPESES')) {
        setRangeStyle(ws, r, 0, r, 15, { fill: makeFill('#FCE4D6'), border: borderThin });
      }
      if (String(vA).toUpperCase().includes('BENEFICIO SIN SUBVENCIONES')) {
        setRangeStyle(ws, r, 0, r, 15, { fill: makeFill('#E2EFDA'), border: borderThin });
      }
    }
  }

  // Estilos tablas inferiores (A-B y derecha con merge D..H + valor en I)
  if (bottomStartRow > 0) {
    const rightLabelStartCol = 3; // D
    const rightLabelEndCol = 7; // H
    const rightValueCol = 8; // I

    // 1) Limpiar estilos de TODA la zona inferior para evitar herencias del bloque superior
    for (let r = bottomStartRow; r < aoa.length; r++) {
      for (let c = 0; c <= 15; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr] && ws[addr].s) delete ws[addr].s;
      }
    }

    for (let r = bottomStartRow; r < aoa.length; r++) {
      const a0 = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      const a1 = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
      const d0 = ws[XLSX.utils.encode_cell({ r, c: rightLabelStartCol })]?.v;
      const d1 = ws[XLSX.utils.encode_cell({ r, c: rightValueCol })]?.v;

      if (a0 && isBottomTitle(a0)) {
        setRangeStyle(ws, r, 0, r, 1, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#E7E6E6'), border: borderThin });
      } else if (a0 && /^\d{3,}/.test(String(a0))) {
        setCellStyle(ws, r, 0, { border: borderThin, font: { bold: true, name: 'Calibri' } });
        setCellStyle(ws, r, 1, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      } else {
        // filas vacías / labels
        setCellStyle(ws, r, 0, { border: borderThin });
        if (a1 !== undefined) setCellStyle(ws, r, 1, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      }

      if (d0 && isBottomTitle(d0)) {
        // Merge título derecha D..H y valor en I vacío
        ws['!merges'] = ws['!merges'] || [];
        ws['!merges'].push({ s: { r, c: rightLabelStartCol }, e: { r, c: rightLabelEndCol } });
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#E7E6E6'), border: borderThin });
        setCellStyle(ws, r, rightValueCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#E7E6E6'), border: borderThin });
      } else if (d0 && /^\d{3,}/.test(String(d0))) {
        // Merge label D..H para dar ancho suficiente al texto
        ws['!merges'] = ws['!merges'] || [];
        ws['!merges'].push({ s: { r, c: rightLabelStartCol }, e: { r, c: rightLabelEndCol } });
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, {
          border: borderThin,
          font: { bold: true, name: 'Calibri' },
          alignment: { horizontal: 'left', vertical: 'center', wrapText: false }
        });
        setCellStyle(ws, r, rightValueCol, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      } else {
        if (d0) {
          ws['!merges'] = ws['!merges'] || [];
          ws['!merges'].push({ s: { r, c: rightLabelStartCol }, e: { r, c: rightLabelEndCol } });
        }
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, { border: borderThin });
        if (d1 !== undefined) setCellStyle(ws, r, rightValueCol, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      }

      // Totales finales (amarillo en beneficio sin subvenciones de tablas inferiores)
      const isBottomBeneficioSinSubv = (v) => (
        String(v || '').toUpperCase().includes('TOTAL BENEFICIO') &&
        String(v || '').toUpperCase().includes('SIN SUBV')
      );
      if (a0 && isBottomBeneficioSinSubv(a0)) {
        setRangeStyle(ws, r, 0, r, 1, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin });
        setCellStyle(ws, r, 1, {
          font: { bold: true, name: 'Calibri' },
          fill: makeFill('#FFFF00'),
          border: borderThin,
          numFmt: '#,##0.00;[Red]-#,##0.00',
          alignment: { horizontal: 'right' }
        });
      }
      if (d0 && isBottomBeneficioSinSubv(d0)) {
        ws['!merges'] = ws['!merges'] || [];
        ws['!merges'].push({ s: { r, c: rightLabelStartCol }, e: { r, c: rightLabelEndCol } });
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, {
          font: { bold: true, name: 'Calibri' },
          fill: makeFill('#FFFF00'),
          border: borderThin
        });
        setCellStyle(ws, r, rightValueCol, {
          font: { bold: true, name: 'Calibri' },
          fill: makeFill('#FFFF00'),
          border: borderThin,
          numFmt: '#,##0.00;[Red]-#,##0.00',
          alignment: { horizontal: 'right' }
        });
      }
      if (a0 && String(a0).toUpperCase().includes('TOTAL BENEFICIO') && String(a0).includes('30')) {
        setRangeStyle(ws, r, 0, r, 1, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin });
      }
      if (d0 && String(d0).toUpperCase().includes('TOTAL BENEFICIO') && String(d0).includes('31')) {
        ws['!merges'] = ws['!merges'] || [];
        ws['!merges'].push({ s: { r, c: rightLabelStartCol }, e: { r, c: rightLabelEndCol } });
        setRangeStyle(ws, r, rightLabelStartCol, r, rightLabelEndCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin });
        setCellStyle(ws, r, rightValueCol, { font: { bold: true, name: 'Calibri' }, fill: makeFill('#FFFF00'), border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
      }
    }
  }

  if (koikiObservations) {
    for (const [rowIdx, text] of PIG_LINEA_KOIKI_OBS_LINES) {
      const isHeader = String(text).trim().toUpperCase() === 'OBSERVACIONES';
      setCellStyle(ws, rowIdx, PIG_LINEA_KOIKI_OBS_COL, {
        border: borderThin,
        font: { bold: true, name: 'Calibri', sz: 11 },
        fill: isHeader ? makeFill('#E7E6E6') : makeFill('#FFFFFF'),
        alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
      });
    }
  }
}

const SUMMARY_LABELS = [
  '1. Ingresos de la actividad propia',
  'd) Subvenciones imputadas al excedente del ejercicio',
  '2. Venta y otros ingresos de la actividad mercantil',
  'Venta y otros ingresos de la actividad mercantil',
  '6. Aprovisionamientos',
  'Aprovisionamientos',
  '7. Otros ingresos de la actividad',
  'Otros ingresos de la actividad',
  '8. Gastos de personal',
  'a) Sueldos,salarios y asimilados',
  'b) Cargas sociales',
  '9. Otros gastos de la actividad',
  'a) Sevicios exteriores',
  'b) Tributos',
  'd) Otros gastos de gestión corriente',
  '11. Subvenciones, donaciones y legados de capital traspasados al exced',
  'b) Donaciones y legados de capital traspasados al excedente del ejercicio',
  'A.1) EXCEDENTE DE LA ACTIVIDAD',
  '15. Gastos financieros',
  'b) Por deudas con terceros',
  'A.2) EXCEDENTE DE LAS OPERACIONES FINANCIERAS',
  'A.3) EXCEDENTE ANTES DE IMPUESTOS',
  'A.4) Variación de patrimonio neto reconocida en el excedente del ejercicio',
  'B.1) Variación de patrimonio neto por ingresos y gastos reconocidos en el patrimonio neto',
  'C.1) Variación de patrimonio neto por reclasificaciones al excedente del ejercicio',
  'D) Variaciones de patrimonio neto por ingresos y gastos imputados directamente al patrimonio neto',
  'I) RESULTADO TOTAL, VARIACIÓN DEL PATRIMONIO NETO EN EL EJERCICIO (A.4+D+E+F+G+H)'
];

// Textos fijos al lado de la tabla resumen en PIG GENERAL EISSS (columna C).
const PIG_GENERAL_EISSS_OBSERVACIONES = [
  [2, 'OBSERVACION:'],
  [3, 'LAS SUBV. IMPUTADAS SON'],
  [4, 'INVESS 31.600 A CAT (12MESES) / IDONI 23.700 IDONI (12MESES) / ESTRUCTURA 23.700 (12MESES)'],
  [5, 'IMPULSEM 10K A IDONI 12 MESES'],
  [6, 'E.I L2 KOIKI Y ESTRUCTURA PERIODO (01/04/25 A 31/08/25) EN 12 MESES DE 2.026'],
  [8, 'SUBV. POR IMPUTAR:'],
  [9, 'E.I L2 01/09/25 AL 31/12/25 (15K) A LA ESPERA DE QUE APRUBEN DAVID'],
  [10, 'ACOL 11/2023 AL 12/24 (25K) A LA ESPERA DE INGRESO YA SE ENVIO REQUERIMIENTO'],
  [11, 'E.I 09/23 AL 09/24 L1 4.200 Y L2 1.70,29, SOLICITARON REQUERIMIENTO DE L1'],
  [12, 'INVESS 19.750 POR IMPUTAR CUANDO INGRESE (1 AÑO Y MEDIO APROX)'],
  [13, 'E.I L1 FALTA POR IMPUTAR 3.360,51 A LA ESPERA'],
  [14, 'E.I L1 2026 33K'],
  [17, 'SUBV. PEND RESOLUCIÓN'],
  [18, 'ENFORTIM (REFORMULACIÓN) APROX. 6.300'],
  [19, 'SUBV. CAMBIO CLIMATICO 80K A LA ESPERA DE APROVACIÓN']
];

function normalizePigLabel(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isPigGeneralGroupPrefix(groupLabel, prefix) {
  return String(groupLabel || '').trim().startsWith(`${prefix}.`);
}

/** Desglose de comptes del CSV mensual dins del PIG GENERAL (sense hardcodejar codis). */
const PIG_GENERAL_ACCOUNT_BREAKDOWNS = [
  {
    afterLabel: 'd) Subvenciones imputadas al excedente del ejercicio',
    filterCuenta: (c) => {
      if (!isPigGeneralGroupPrefix(c?.groupLabel, '1')) return false;
      if (normalizePigLabel(c?.subLabel).includes('subvenciones imputadas')) return true;
      return String(c?.code || '').startsWith('740');
    }
  },
  {
    afterLabel: 'Venta y otros ingresos de la actividad mercantil',
    filterCuenta: (c) => {
      if (!isPigGeneralGroupPrefix(c?.groupLabel, '2')) return false;
      if (normalizePigLabel(c?.subLabel).includes('venta y otros ingresos')) return true;
      return String(c?.code || '').startsWith('700');
    }
  }
];

function pigGeneralCuentaLabel(c) {
  return `${c.code} - ${c.name}`.trim();
}

function findPigGeneralCuentaByLabel(cuentas = [], label) {
  const target = String(label || '').trim();
  if (!target) return null;
  return (cuentas || []).find((c) => pigGeneralCuentaLabel(c) === target) || null;
}

function extractPigGeneralBreakdownCuentas(cuentas = [], filterCuenta) {
  return (cuentas || [])
    .filter(filterCuenta)
    .sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
}

function buildPigGeneralSummaryLabels(cuentasMensuales = [], { omitSubvenciones = false } = {}) {
  const breakdownRules = omitSubvenciones
    ? PIG_GENERAL_ACCOUNT_BREAKDOWNS.filter((rule) => !isPigGeneralSubvencionLabel(rule.afterLabel))
    : PIG_GENERAL_ACCOUNT_BREAKDOWNS;
  const breakdownByLabel = new Map(
    breakdownRules.map((rule) => [
      rule.afterLabel,
      extractPigGeneralBreakdownCuentas(cuentasMensuales, rule.filterCuenta)
    ])
  );
  const labels = [];
  for (const label of SUMMARY_LABELS) {
    if (omitSubvenciones && isPigGeneralSubvencionLabel(label)) {
      // Tras quitar subv Holded: insertar agrupación hardcodeada (L1 / L2 / IMPULSEM).
      if (label === 'd) Subvenciones imputadas al excedente del ejercicio') {
        labels.push(...PIG_CTA_RESULTADOS_GENERAL_SUBV_LABELS);
      }
      continue;
    }
    if (omitSubvenciones && label === PIG_GENERAL_INGRESOS_PROPIA_LABEL) {
      labels.push(PIG_CTA_RESULTADOS_GENERAL_INGRESOS_LABEL);
      continue;
    }
    labels.push(label);
    for (const cuenta of breakdownByLabel.get(label) || []) {
      labels.push(pigGeneralCuentaLabel(cuenta));
    }
  }
  return labels;
}

function sumCuentaMonths(cuenta, monthLimit) {
  const lim = Math.max(1, Math.min(12, Number(monthLimit || 12)));
  const months = cuenta?.months || [];
  let total = 0;
  for (let i = 0; i < lim; i++) total += Number(months[i]) || 0;
  return total;
}

const PIG_GENERAL_GROUP_CHILDREN = {
  '2. Venta y otros ingresos de la actividad mercantil': ['Venta y otros ingresos de la actividad mercantil'],
  '6. Aprovisionamientos': ['Aprovisionamientos'],
  '7. Otros ingresos de la actividad': ['Otros ingresos de la actividad'],
  '8. Gastos de personal': ['a) Sueldos,salarios y asimilados', 'b) Cargas sociales'],
  '9. Otros gastos de la actividad': [
    'a) Sevicios exteriores',
    'b) Tributos',
    'd) Otros gastos de gestión corriente'
  ],
  '11. Subvenciones, donaciones y legados de capital traspasados al exced': [
    'b) Donaciones y legados de capital traspasados al excedente del ejercicio'
  ],
  '15. Gastos financieros': ['b) Por deudas con terceros']
};

const PIG_GENERAL_MINITABLE_LABELS = [
  '2. Venta y otros ingresos de la actividad mercantil',
  '6. Aprovisionamientos',
  '7. Otros ingresos de la actividad',
  '8. Gastos de personal',
  '9. Otros gastos de la actividad'
];
const PIG_GENERAL_MINITABLE_TOTAL_LABEL = 'TOTAL RESULTADO SIN SUBV.';

function getPigGeneralSideCols(monthsLimited = []) {
  const lim = Math.max(1, Math.min(12, monthsLimited.length || 12));
  const totalCols = 1 + lim + 1;
  return {
    totalCols,
    monthlyLastCol: totalCols - 1,
    miniLabelCol: totalCols + 1,
    miniValueCol: totalCols + 2,
    obsCol: totalCols + 4
  };
}

function ensureAoaCell(aoa, row, col, value) {
  while (aoa.length <= row) aoa.push([]);
  if (!Array.isArray(aoa[row])) aoa[row] = [];
  while (aoa[row].length <= col) aoa[row].push('');
  aoa[row][col] = value;
}

function getPigGeneralGroupChildren(label) {
  return PIG_GENERAL_GROUP_CHILDREN[label] || null;
}

function getPigGeneralMensualValues({ label, mensualMap, monthLimit, cuentasMensuales = [] }) {
  const lim = Math.max(1, Math.min(12, Number(monthLimit || 12)));
  const cuenta = findPigGeneralCuentaByLabel(cuentasMensuales, label);
  if (cuenta) {
    return (cuenta.months || new Array(12).fill(0)).slice(0, lim);
  }
  const children = getPigGeneralGroupChildren(label);
  if (children?.length) {
    const summed = new Array(12).fill(0);
    for (const child of children) {
      const childVals = mensualMap.get(child) || new Array(12).fill(0);
      for (let i = 0; i < 12; i++) {
        summed[i] += Number(childVals[i]) || 0;
      }
    }
    return summed.slice(0, lim);
  }
  return (mensualMap.get(label) || new Array(12).fill(0)).slice(0, lim);
}

function getPigGeneralSummaryValue({ label, mensualMap, annualTotalsMap, monthLimit, cuentasMensuales = [] }) {
  const lim = Math.max(1, Math.min(12, Number(monthLimit || 12)));
  const cuenta = findPigGeneralCuentaByLabel(cuentasMensuales, label);
  if (cuenta) return sumCuentaMonths(cuenta, lim);
  const children = getPigGeneralGroupChildren(label);
  if (children?.length) {
    return children.reduce(
      (sum, child) => sum + getPigGeneralSummaryValue({ label: child, mensualMap, annualTotalsMap, monthLimit }),
      0
    );
  }
  const mensualVals = mensualMap.get(label) || new Array(12).fill(0);
  return lim >= 12
    ? (annualTotalsMap.get(label) ?? mensualVals.reduce((a, b) => a + (Number(b) || 0), 0))
    : mensualVals.slice(0, lim).reduce((a, b) => a + (Number(b) || 0), 0);
}

function applyPigGeneralEisssMiniTabla(aoa, { mensualMap, annualTotalsMap, monthLimit, labelCol, valueCol }) {
  const startRow = 2;
  let row = startRow;
  let total = 0;
  const conceptRows = [];

  for (const label of PIG_GENERAL_MINITABLE_LABELS) {
    const value = getPigGeneralSummaryValue({ label, mensualMap, annualTotalsMap, monthLimit });
    total += Number(value) || 0;
    ensureAoaCell(aoa, row, labelCol, label);
    ensureAoaCell(aoa, row, valueCol, value);
    conceptRows.push(row);
    row += 1;
  }

  const totalRow = row;
  ensureAoaCell(aoa, row, labelCol, PIG_GENERAL_MINITABLE_TOTAL_LABEL);
  ensureAoaCell(aoa, row, valueCol, total);

  return {
    startRow,
    endRow: row,
    total,
    labelCol,
    valueCol,
    conceptRows,
    totalRow
  };
}

function applyPigGeneralEisssObservaciones(aoa, { obsCol }) {
  for (const [rowIdx, text] of PIG_GENERAL_EISSS_OBSERVACIONES) {
    ensureAoaCell(aoa, rowIdx, obsCol, text);
  }
}

function hexToRgb(hex) {
  const h = String(hex || '').replace('#', '').trim();
  if (h.length !== 6) return { r: 255, g: 255, b: 255 };
  return {
    r: Number.parseInt(h.slice(0, 2), 16),
    g: Number.parseInt(h.slice(2, 4), 16),
    b: Number.parseInt(h.slice(4, 6), 16)
  };
}

function makeFill(hex) {
  const { r, g, b } = hexToRgb(hex);
  // SheetJS usa RGB en hex sin '#'
  const rgb = [r, g, b].map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase();
  return { patternType: 'solid', fgColor: { rgb } };
}

function setCellStyle(ws, r, c, s) {
  const addr = XLSX.utils.encode_cell({ r, c });
  if (!ws[addr]) return;
  ws[addr].s = { ...(ws[addr].s || {}), ...(s || {}) };
}

function setRangeStyle(ws, r0, c0, r1, c1, s) {
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) setCellStyle(ws, r, c, s);
  }
}

function stylePigEstructuraSheet({ ws, aoa, meta = null }) {
  const layout = meta?.layout || {};
  const subvTotalCol = meta?.subvTotalCol ?? 13;
  const purchaseMaxCol = meta?.purchaseMaxCol ?? 8;
  const sheetMaxCol = Math.max(subvTotalCol, purchaseMaxCol);

  ws['!sheetView'] = [{ showGridLines: false }];
  ws['!rows'] = [];
  if (layout.titleRow != null) ws['!rows'][layout.titleRow] = { hpt: 20 };
  ws['!cols'] = [
    { wch: 52 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 28 },
    { wch: 36 },
    { wch: 22 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 }
  ];
  ws['!merges'] = [];

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };
  const numStyle = {
    border: borderThin,
    numFmt: '#,##0.00;[Red]-#,##0.00',
    alignment: { horizontal: 'right', vertical: 'center' },
    font: { name: 'Calibri' }
  };
  const textStyle = {
    border: borderThin,
    alignment: { vertical: 'center', wrapText: true },
    font: { name: 'Calibri' }
  };
  const centerStyle = {
    border: borderThin,
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    font: { name: 'Calibri' }
  };

  const mergeRow = (r, c0, c1, style) => {
    if (r == null) return;
    ws['!merges'].push({ s: { r, c: c0 }, e: { r, c: c1 } });
    setRangeStyle(ws, r, c0, r, c1, style);
  };

  if (layout.titleRow != null) {
    mergeRow(layout.titleRow, 0, sheetMaxCol, {
      font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
      alignment: { horizontal: 'center', vertical: 'center' }
    });
  }

  if (layout.subvSectionRow != null) {
    mergeRow(layout.subvSectionRow, 0, subvTotalCol, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#DDEBF7'),
      border: borderThin,
      alignment: { vertical: 'center' }
    });
  }

  if (layout.subvHeaderRow != null) {
    setRangeStyle(ws, layout.subvHeaderRow, 0, layout.subvHeaderRow, subvTotalCol, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#E7E6E6'),
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    });
  }

  if (layout.subvDataStartRow != null && layout.subvDataEndRow != null && layout.subvDataEndRow >= layout.subvDataStartRow) {
    for (let r = layout.subvDataStartRow; r <= layout.subvDataEndRow; r++) {
      setCellStyle(ws, r, 0, { ...textStyle, font: { bold: true, name: 'Calibri' } });
      for (let c = 1; c <= 12; c++) setCellStyle(ws, r, c, numStyle);
      setCellStyle(ws, r, subvTotalCol, { ...numStyle, fill: makeFill('#C6EFCE') });
    }
  }

  if (layout.subvTotalRow != null) {
    setRangeStyle(ws, layout.subvTotalRow, 0, layout.subvTotalRow, subvTotalCol, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#FFF2CC'),
      border: borderThin
    });
    for (let c = 1; c <= subvTotalCol; c++) {
      setCellStyle(ws, layout.subvTotalRow, c, { ...numStyle, font: { bold: true, name: 'Calibri' } });
    }
  }

  if (layout.purchaseSectionRow != null) {
    mergeRow(layout.purchaseSectionRow, 0, purchaseMaxCol, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#E2EFDA'),
      border: borderThin,
      alignment: { vertical: 'center' }
    });
  }

  if (layout.purchaseHeaderRow != null) {
    setRangeStyle(ws, layout.purchaseHeaderRow, 0, layout.purchaseHeaderRow, purchaseMaxCol, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#E7E6E6'),
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
    });
  }

  if (layout.purchaseDataStartRow != null && layout.purchaseDataEndRow != null && layout.purchaseDataEndRow >= layout.purchaseDataStartRow) {
    for (let r = layout.purchaseDataStartRow; r <= layout.purchaseDataEndRow; r++) {
      const status = String(ws[XLSX.utils.encode_cell({ r, c: 8 })]?.v || '');
      const overdue = status === 'Vencida';
      const rowFill = overdue ? makeFill('#FCE4D6') : null;
      for (let c = 0; c <= purchaseMaxCol; c++) {
        const base = c >= 6 && c <= 7
          ? { ...numStyle, fill: rowFill || undefined }
          : c === 8
            ? {
              ...centerStyle,
              font: { bold: overdue, name: 'Calibri', color: overdue ? { rgb: 'C00000' } : undefined },
              fill: rowFill || (status === 'Pendiente' ? makeFill('#FFF2CC') : undefined)
            }
            : { ...textStyle, fill: rowFill || undefined };
        setCellStyle(ws, r, c, base);
      }
    }
  }

  if (layout.purchaseTotalRow != null) {
    setRangeStyle(ws, layout.purchaseTotalRow, 0, layout.purchaseTotalRow, purchaseMaxCol, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#FFF2CC'),
      border: borderThin
    });
    setCellStyle(ws, layout.purchaseTotalRow, 6, { ...numStyle, font: { bold: true, name: 'Calibri' } });
    setCellStyle(ws, layout.purchaseTotalRow, 7, { ...numStyle, font: { bold: true, name: 'Calibri' } });
  }

  if (layout.comparativaSectionRow != null) {
    mergeRow(layout.comparativaSectionRow, 0, 1, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#F8CBAD'),
      border: borderThin,
      alignment: { vertical: 'center' }
    });
  }

  if (layout.comparativaHeaderRow != null) {
    setRangeStyle(ws, layout.comparativaHeaderRow, 0, layout.comparativaHeaderRow, 1, {
      font: { bold: true, name: 'Calibri' },
      fill: makeFill('#E7E6E6'),
      border: borderThin,
      alignment: { horizontal: 'center', vertical: 'center' }
    });
  }

  if (layout.comparativaDataStartRow != null && layout.comparativaDataEndRow != null) {
    for (let r = layout.comparativaDataStartRow; r <= layout.comparativaDataEndRow; r++) {
      setCellStyle(ws, r, 0, { ...textStyle, font: { bold: r === layout.comparativaDiffRow, name: 'Calibri' } });
      setCellStyle(ws, r, 1, {
        ...numStyle,
        font: { bold: r === layout.comparativaDiffRow, name: 'Calibri' },
        fill: r === layout.comparativaDiffRow ? makeFill('#FFF2CC') : undefined
      });
    }
  }
}

function buildGeneralAoa({ title, months, mensualMap, annualTotalsMap, monthLimit, cuentasMensuales = [], omitSubvenciones = false }) {
  const lim = Math.max(1, Math.min(12, Number(monthLimit || 12)));
  const monthsLimited = months.slice(0, lim);
  const cuentas = omitSubvenciones ? filterCuentasSinSubvenciones(cuentasMensuales) : cuentasMensuales;
  const summaryLabels = buildPigGeneralSummaryLabels(cuentas, { omitSubvenciones });

  let mapMensual = mensualMap;
  let mapAnnual = annualTotalsMap;
  if (omitSubvenciones) {
    mapMensual = clonePigNumberMap(mensualMap);
    mapAnnual = clonePigNumberMap(annualTotalsMap);
    const subvBuckets = buildCuentaResultadosGeneralSubvMonths(12);
    const hardcodedAll = sumMonthArrays(Object.values(subvBuckets), 12);
    const holdedSubvLabel = 'd) Subvenciones imputadas al excedente del ejercicio';
    const holdedSubv = (mensualMap.get(holdedSubvLabel) || new Array(12).fill(0)).slice(0, 12);
    // Sustituir subv Holded por hardcodeadas en totales de ingresos / excedente.
    const parentLabelsToAdjust = [
      PIG_GENERAL_INGRESOS_PROPIA_LABEL,
      'A.1) EXCEDENTE DE LA ACTIVIDAD',
      'A.3) EXCEDENTE ANTES DE IMPUESTOS',
      'A.4) Variación de patrimonio neto reconocida en el excedente del ejercicio',
      SUMMARY_LABELS.find((l) => String(l).startsWith('I) RESULTADO'))
    ].filter(Boolean);
    for (const label of parentLabelsToAdjust) {
      if (!mapMensual.has(label) && !mensualMap.has(label)) continue;
      const base = (mapMensual.get(label) || mensualMap.get(label) || new Array(12).fill(0)).slice(0, 12);
      const next = base.map((v, i) => (Number(v) || 0) - (Number(holdedSubv[i]) || 0) + (Number(hardcodedAll[i]) || 0));
      mapMensual.set(label, next);
      mapAnnual.set(label, next.reduce((a, b) => a + (Number(b) || 0), 0));
    }
    // Misma cifra bajo el nombre de Cuenta Resultados (sin el "1.").
    const ingresosAjustados = mapMensual.get(PIG_GENERAL_INGRESOS_PROPIA_LABEL);
    if (ingresosAjustados) {
      mapMensual.set(PIG_CTA_RESULTADOS_GENERAL_INGRESOS_LABEL, [...ingresosAjustados]);
      mapAnnual.set(
        PIG_CTA_RESULTADOS_GENERAL_INGRESOS_LABEL,
        ingresosAjustados.reduce((a, b) => a + (Number(b) || 0), 0)
      );
    }
    for (const [label, monthsVals] of Object.entries(subvBuckets)) {
      const padded = [...monthsVals];
      while (padded.length < 12) padded.push(0);
      mapMensual.set(label, padded);
      mapAnnual.set(label, padded.reduce((a, b) => a + (Number(b) || 0), 0));
    }
    mapMensual.set(holdedSubvLabel, new Array(12).fill(0));
    mapAnnual.set(holdedSubvLabel, 0);
  }

  const aoa = [];
  aoa.push([title, '', '']);
  aoa.push(['', '', '']);

  const summaryValueRows = [];
  // Resumen (label + valor) -> si monthLimit<12, recalculamos desde mensual; si no, usamos anual.
  for (const label of summaryLabels) {
    aoa.push([label, '', '']);
    const v = getPigGeneralSummaryValue({
      label,
      mensualMap: mapMensual,
      annualTotalsMap: mapAnnual,
      monthLimit: lim,
      cuentasMensuales: cuentas
    });
    summaryValueRows.push(aoa.length);
    aoa.push(['', v ?? 0, '']);
  }

  aoa.push(['', '', '']);
  aoa.push(['', '', '']);

  // Tabla mensual
  const header = ['', ...monthsLimited, 'TOTAL'];
  const mensualHeaderRow = aoa.length;
  aoa.push(header);
  const mensualDataStartRow = aoa.length;
  for (const label of summaryLabels) {
    const vals = getPigGeneralMensualValues({ label, mensualMap: mapMensual, monthLimit: lim, cuentasMensuales: cuentas });
    const total = getPigGeneralSummaryValue({
      label,
      mensualMap: mapMensual,
      annualTotalsMap: mapAnnual,
      monthLimit: lim,
      cuentasMensuales: cuentas
    });
    aoa.push([label, ...vals, total]);
  }

  const parentLabelSet = new Set([
    PIG_GENERAL_INGRESOS_PROPIA_LABEL,
    PIG_CTA_RESULTADOS_GENERAL_INGRESOS_LABEL,
    'A.1) EXCEDENTE DE LA ACTIVIDAD',
    'A.3) EXCEDENTE ANTES DE IMPUESTOS',
    'A.4) Variación de patrimonio neto reconocida en el excedente del ejercicio',
    SUMMARY_LABELS.find((l) => String(l).startsWith('I) RESULTADO'))
  ].filter(Boolean));

  const subvMensualRows = {};
  const parentMensualRows = [];
  for (let i = 0; i < summaryLabels.length; i++) {
    const label = summaryLabels[i];
    const r = mensualDataStartRow + i;
    if (PIG_CTA_RESULTADOS_GENERAL_SUBV_LABELS.includes(label)) {
      subvMensualRows[label] = r;
    }
    if (omitSubvenciones && parentLabelSet.has(label)) {
      parentMensualRows.push(r);
    }
  }

  const formulaMeta = omitSubvenciones
    ? {
      enabled: true,
      lim,
      totalCol: lim + 1,
      summaryLabels,
      summaryValueRows,
      mensualHeaderRow,
      mensualDataStartRow,
      subvMensualRows,
      parentMensualRows
    }
    : null;

  return { aoa, monthsLimited, lim, summaryLabels, formulaMeta };
}

function styleGeneralSheet({ ws, aoa, monthsLimited, withObservaciones = false, miniTablaMeta = null, sideCols = null }) {
  const resolvedSideCols = sideCols || getPigGeneralSideCols(monthsLimited);
  const totalCols = resolvedSideCols.totalCols;
  const obsCol = resolvedSideCols.obsCol;

  const borderThin = {
    top: { style: 'thin', color: { rgb: '000000' } },
    bottom: { style: 'thin', color: { rgb: '000000' } },
    left: { style: 'thin', color: { rgb: '000000' } },
    right: { style: 'thin', color: { rgb: '000000' } }
  };

  const titleStyle = {
    font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center' }
  };

  const labelBold = { font: { bold: true, name: 'Calibri' } };
  const moneyStyle = { numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } };
  const headerMonthlyStyle = {
    font: { bold: true, name: 'Calibri' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: true },
    fill: makeFill('#E7E6E6'),
    border: borderThin
  };

  // Gridlines off (Excel)
  ws['!sheetView'] = [{ showGridLines: false }];

  // Column widths: tabla mensual uniforme; paneles laterales con su propio ancho
  const maxColIdx = Math.max(
    totalCols - 1,
    miniTablaMeta?.valueCol ?? 0,
    withObservaciones ? obsCol : 0
  );
  const colWidths = Array.from({ length: maxColIdx + 1 }, (_, i) => {
    if (i === 0) return { wch: 58 };
    if (i >= 1 && i <= monthsLimited.length) return { wch: 14 };
    if (i === totalCols - 1) return { wch: 14 };
    if (miniTablaMeta && i === miniTablaMeta.labelCol) return { wch: 48 };
    if (miniTablaMeta && i === miniTablaMeta.valueCol) return { wch: 16 };
    if (withObservaciones && i === obsCol) return { wch: 62 };
    return { wch: 3 };
  });
  ws['!cols'] = colWidths;

  // Row heights (aprox)
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };

  // Merge título solo sobre la tabla principal (sin paneles laterales)
  const titleMergeEndCol = totalCols - 1;
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: titleMergeEndCol } }];
  setRangeStyle(ws, 0, 0, 0, titleMergeEndCol, titleStyle);

  const isMainLine = (label) => /^\d+\./.test(label) || /^A\.\d\)/.test(label) || /^I\)/.test(label) || /^15\./.test(label);

  const mensualHeaderRow = aoa.findIndex((row) => Array.isArray(row) && row[0] === '' && row[1] === monthsLimited[0]);
  const summaryEnd = mensualHeaderRow > 0 ? mensualHeaderRow - 1 : aoa.length - 1;

  // Bordes + formato para bloque resumen (A y B)
  for (let r = 2; r <= summaryEnd; r++) {
    const hasA = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    const hasB = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v !== undefined && ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v !== '';
    if (hasA || hasB) {
      setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
      setCellStyle(ws, r, 1, { border: borderThin, ...moneyStyle });
    }
  }

  // Negritas líneas principales (bloc resum dinàmic)
  for (let r = 2; r <= summaryEnd; r++) {
    const lbl = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
    if (!lbl) continue;
    const label = String(lbl);
    if (isMainLine(label) || /^[a-z]\)\s+/i.test(label) || /EXCEDENTE|RESULTADO TOTAL/.test(label)) {
      setCellStyle(ws, r, 0, labelBold);
      const valueRow = r + 1;
      if (valueRow <= summaryEnd && !ws[XLSX.utils.encode_cell({ r: valueRow, c: 0 })]?.v) {
        if (isMainLine(label) || /EXCEDENTE|RESULTADO TOTAL/.test(label)) {
          setCellStyle(ws, valueRow, 1, labelBold);
        }
      }
    }
  }

  // Tabla mensual: cabecera + bordes + numfmt
  if (mensualHeaderRow >= 0) {
    setRangeStyle(ws, mensualHeaderRow, 0, mensualHeaderRow, totalCols - 1, headerMonthlyStyle);

    for (let r = mensualHeaderRow + 1; r < aoa.length; r++) {
      setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
      const lbl = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (lbl && (
        isMainLine(String(lbl))
        || /^[a-z]\)\s+/i.test(String(lbl))
        || /EXCEDENTE|RESULTADO TOTAL/.test(String(lbl))
      )) {
        setCellStyle(ws, r, 0, labelBold);
      }
      for (let c = 1; c < totalCols; c++) setCellStyle(ws, r, c, { border: borderThin, ...moneyStyle });
    }
  }

  if (withObservaciones) {
    const obsStyle = {
      font: { name: 'Calibri', sz: 11 },
      alignment: { horizontal: 'left', vertical: 'top', wrapText: true }
    };
    for (const [rowIdx, text] of PIG_GENERAL_EISSS_OBSERVACIONES) {
      const addr = XLSX.utils.encode_cell({ r: rowIdx, c: obsCol });
      if (!ws[addr]) ws[addr] = { t: 's', v: text };
      setCellStyle(ws, rowIdx, obsCol, {
        ...obsStyle,
        font: {
          ...obsStyle.font,
          bold: String(text).trim().endsWith(':')
        }
      });
    }
  }

  if (miniTablaMeta) {
    const { startRow, endRow, labelCol, valueCol } = miniTablaMeta;
    for (let r = startRow; r <= endRow; r++) {
      const isTotal = r === endRow;
      setCellStyle(ws, r, labelCol, {
        border: borderThin,
        alignment: { vertical: 'center', wrapText: true },
        font: { bold: isTotal, name: 'Calibri' }
      });
      setCellStyle(ws, r, valueCol, {
        border: borderThin,
        ...moneyStyle,
        font: { bold: isTotal, name: 'Calibri' }
      });
    }
  }

  // (mantenemos también z para compatibilidad con lectores)
  for (let r = 0; r < aoa.length; r++) {
    const cellB = XLSX.utils.encode_cell({ r, c: 1 });
    if (ws[cellB] && typeof ws[cellB].v === 'number') {
      ws[cellB].t = 'n';
      ws[cellB].z = moneyStyle.numFmt;
    }
  }
  if (mensualHeaderRow >= 0) {
    for (let r = mensualHeaderRow + 1; r < aoa.length; r++) {
      for (let c = 1; c < totalCols; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (ws[addr] && typeof ws[addr].v === 'number') {
          ws[addr].t = 'n';
          ws[addr].z = moneyStyle.numFmt;
        }
      }
    }
  }
}

export default function PIGPage() {
  const { colors } = useTheme();
  const [pigEmpresa, setPigEmpresa] = useState('EISSS'); // 'EISSS' | 'MH'
  const [anualFile, setAnualFile] = useState(null);
  const [mensualFile, setMensualFile] = useState(null);
  const [error, setError] = useState('');
  const [objetivosComparativa, setObjetivosComparativa] = useState(() => ({ ...PIG_OBJETIVOS_DEFAULTS }));
  const [objetivosLoading, setObjetivosLoading] = useState(false);
  const [objetivosSaving, setObjetivosSaving] = useState(false);
  const [objetivosStatus, setObjetivosStatus] = useState('');
  const [estimadosYear, setEstimadosYear] = useState(String(new Date().getFullYear()));
  const [estimadosSubv, setEstimadosSubv] = useState(() => JSON.parse(JSON.stringify(PIG_ESTIMADOS_DEFAULTS)));
  const [estimadosLoading, setEstimadosLoading] = useState(false);
  const [estimadosSaving, setEstimadosSaving] = useState(false);
  const [estimadosStatus, setEstimadosStatus] = useState('');

  const loadEstimadosForYear = useCallback(async (year) => {
    const y = Number(year);
    if (!Number.isFinite(y)) return;
    setEstimadosLoading(true);
    setEstimadosStatus('');
    const { estimados, error: loadError, tableMissing } = await loadPigEstimadosSubvencion({ year: y });
    setEstimadosLoading(false);
    if (loadError) {
      setEstimadosStatus('No se pudieron cargar los estimados guardados.');
      return;
    }
    if (tableMissing) {
      setEstimadosStatus('Ejecuta database/create_pig_estimados_subvencion.sql y alter_pig_estimados_subvencion_segments.sql en Supabase.');
    }
    if (estimados) setEstimadosSubv(estimados);
  }, []);

  const loadObjetivosForYear = useCallback(async (year) => {
    const y = Number(year);
    if (!Number.isFinite(y)) return;
    setObjetivosLoading(true);
    setObjetivosStatus('');
    const { objetivos, error: loadError, tableMissing } = await loadPigObjetivosComparativa({ year: y });
    setObjetivosLoading(false);
    if (loadError) {
      setObjetivosStatus('No se pudieron cargar los objetivos guardados.');
      return;
    }
    if (tableMissing) {
      setObjetivosStatus('Ejecuta database/create_pig_objetivos_comparativa.sql y alter_pig_objetivos_comparativa_rls.sql en Supabase.');
    }
    if (objetivos) setObjetivosComparativa(objetivos);
  }, []);

  useEffect(() => {
    loadEstimadosForYear(estimadosYear);
    loadObjetivosForYear(estimadosYear);
  }, [estimadosYear, loadEstimadosForYear, loadObjetivosForYear]);

  const saveObjetivosComparativa = useCallback(async () => {
    const y = Number(estimadosYear);
    if (!Number.isFinite(y)) {
      setObjetivosStatus('Introduce un año válido.');
      return false;
    }
    setObjetivosSaving(true);
    setObjetivosStatus('');
    const { error: saveError } = await upsertPigObjetivosComparativa({ year: y, objetivos: objetivosComparativa });
    setObjetivosSaving(false);
    if (saveError) {
      const detail = String(saveError.message || saveError.details || '').trim();
      setObjetivosStatus(
        detail
          ? `Error al guardar los objetivos: ${detail}`
          : 'Error al guardar los objetivos. ¿Has ejecutado el SQL de Supabase?'
      );
      return false;
    }
    setObjetivosStatus('Objetivos guardados.');
    return true;
  }, [objetivosComparativa, estimadosYear]);

  const saveEstimadosSubv = useCallback(async () => {
    const y = Number(estimadosYear);
    if (!Number.isFinite(y)) {
      setEstimadosStatus('Introduce un año válido.');
      return false;
    }
    setEstimadosSaving(true);
    setEstimadosStatus('');
    const { error: saveError } = await upsertPigEstimadosSubvencion({ year: y, estimados: estimadosSubv });
    setEstimadosSaving(false);
    if (saveError) {
      const detail = String(saveError.message || saveError.details || '').trim();
      setEstimadosStatus(
        detail
          ? `Error al guardar los estimados: ${detail}`
          : 'Error al guardar los estimados. ¿Has ejecutado el SQL de Supabase?'
      );
      return false;
    }
    setEstimadosStatus('Estimados guardados.');
    return true;
  }, [estimadosSubv, estimadosYear]);

  const canGenerate = useMemo(() => Boolean(anualFile && mensualFile), [anualFile, mensualFile]);

  const generateExcel = useCallback(async (opts = {}) => {
    try {
      setError('');
      if (!anualFile || !mensualFile) {
        setError('Sube los 2 archivos del PIG: anual y mensual (CSV o Excel).');
        return;
      }

      const cuentaResultados = Boolean(opts?.cuentaResultados);
      // Cuenta Resultados = mismo flujo EISSS, sin subvenciones de Holded ni estimados.
      const empresaMode = cuentaResultados ? 'EISSS' : pigEmpresa;
      const omitSubvenciones = cuentaResultados;

      const [anualText, mensualText] = await Promise.all([
        readHoldedFileAsText(anualFile),
        readHoldedFileAsText(mensualFile)
      ]);
      const anualParsed = parseHoldedAnual(anualText);
      const mensualParsed = parseHoldedMensual(mensualText);
      const anual = anualParsed.map;
      const mensual = mensualParsed.map;
      const monthNames = mensualParsed.monthNames;
      const yearGuess = mensualParsed.yearGuess || (() => {
        const m = mensualText.match(/01\/01\/(\d{4})/);
        return m ? m[1] : '';
      })();

      const yearForEstimados = Number(yearGuess || estimadosYear) || Number(estimadosYear);
      let estimadosForGenerate = estimadosSubv;
      let objetivosForGenerate = objetivosComparativa;
      if (!omitSubvenciones) {
        if (yearForEstimados && Number(yearForEstimados) !== Number(estimadosYear)) {
          const [{ estimados, error: loadEstError }, { objetivos, error: loadObjError }] = await Promise.all([
            loadPigEstimadosSubvencion({ year: yearForEstimados }),
            loadPigObjetivosComparativa({ year: yearForEstimados })
          ]);
          if (!loadEstError && estimados) estimadosForGenerate = estimados;
          if (!loadObjError && objetivos) objetivosForGenerate = objetivos;
        } else {
          await Promise.all([saveEstimadosSubv(), saveObjetivosComparativa()]);
        }
      } else if (yearForEstimados && Number(yearForEstimados) === Number(estimadosYear)) {
        // Objetivos de comparativa sí se pueden usar; estimados de subvención no.
        await saveObjetivosComparativa();
      }
      const estimadosSlotsByLinea = omitSubvenciones
        ? { CATERING: [], IDONI: [], KOIKI: [], ESTRUCTURA: [] }
        : estimadosToSlots(estimadosForGenerate);

      const cuentasMensualesRaw = mensualParsed.cuentas || [];
      const cuentasMensuales = omitSubvenciones
        ? filterCuentasSinSubvenciones(cuentasMensualesRaw)
        : cuentasMensualesRaw;

      const getLastNonZeroMonthIndex = () => {
        let last = -1;
        // mirar cuentas (más “real” que map)
        for (const c of cuentasMensualesRaw) {
          const m = c?.months || [];
          for (let i = 0; i < Math.min(12, m.length); i++) {
            if (Number(m[i]) !== 0) last = Math.max(last, i);
          }
        }
        // fallback: usar monthCount-1 si no encontramos nada
        if (last < 0) {
          const mc = Number(mensualParsed.monthCount || 12) || 12;
          return Math.max(0, Math.min(11, mc - 1));
        }
        return Math.max(0, Math.min(11, last));
      };

      const lastIdx = getLastNonZeroMonthIndex(); // último mes con datos
      const prevIdx = Math.max(0, lastIdx - 1); // mes anterior
      const monthLimitFull = lastIdx + 1;
      const monthLimitPrev = prevIdx + 1;

      const endOfMonthStr = (monthIndex) => {
        const yy = String(yearGuess || '').slice(2);
        const year = yearGuess ? Number(yearGuess) : new Date().getFullYear();
        const m = Math.min(11, Math.max(0, monthIndex));
        const d = new Date(year, m + 1, 0).getDate();
        const dd = String(d).padStart(2, '0');
        const mm = String(m + 1).padStart(2, '0');
        return `${dd}/${mm}/${yy || String(year).slice(2)}`;
      };
      const startOfMonthStr = (monthIndex) => {
        const yy = String(yearGuess || '').slice(2);
        const m = Math.min(11, Math.max(0, monthIndex));
        const mm = String(m + 1).padStart(2, '0');
        return `01/${mm}/${yy || String(new Date().getFullYear()).slice(2)}`;
      };

      // Construcción de hoja
      // IMPORTANTE: aunque Holded venga con 3/4 meses, las hojas PIG LINEA y GENERAL
      // deben mantener SIEMPRE 12 columnas de meses para que no se desplace TOTAL/TOTAL ESTIMADO.
      const defaultMonths = [
        'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
      ];
      const monthNamesByIndex = Array.isArray(mensualParsed.monthNamesByIndex) ? mensualParsed.monthNamesByIndex : [];
      const months = new Array(12).fill(null).map((_, idx) => {
        const fromCsv = monthNamesByIndex[idx];
        return fromCsv && String(fromCsv).trim() ? String(fromCsv).trim() : defaultMonths[idx];
      });
      const monthLabelUpper = (idx) => String(months[idx] || defaultMonths[idx] || '').toUpperCase();

      const yy = yearGuess ? yearGuess.slice(2) : '';
      const empresaLabel = empresaMode === 'MH' ? 'MH' : 'EI.SSS';
      const rangeStartIdx = (mensualParsed.rangeStartIdx ?? null);
      const startStr = yy ? (rangeStartIdx !== null ? startOfMonthStr(rangeStartIdx) : `01/01/${yy}`) : '';
      const titleDocKind = omitSubvenciones ? 'CUENTA RESULTADOS' : 'PIG';
      const titleFull = `Cierre ${titleDocKind} GENERAL  ${empresaLabel} ${yy ? `${startStr} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
      const titlePrev = `${titleDocKind} GENERAL ${empresaLabel} A ${monthLabelUpper(prevIdx)} ${yy ? `${startStr} A ${endOfMonthStr(prevIdx)}` : ''}`.trim();
      const sheetNamePrev = (`${titleDocKind} GENERAL ${empresaLabel} A ${monthLabelUpper(prevIdx)}`.trim()).slice(0, 31);

      const { aoa: aoaFull, monthsLimited: monthsFull, formulaMeta: generalFormulaMetaFull } = buildGeneralAoa({
        title: titleFull,
        months,
        mensualMap: mensual,
        annualTotalsMap: anual,
        monthLimit: monthLimitFull,
        cuentasMensuales,
        omitSubvenciones
      });
      let miniTablaMeta = null;
      const sideColsFull = getPigGeneralSideCols(monthsFull);
      if (empresaMode !== 'MH') {
        if (!omitSubvenciones) {
          applyPigGeneralEisssObservaciones(aoaFull, { obsCol: sideColsFull.obsCol });
        }
        miniTablaMeta = applyPigGeneralEisssMiniTabla(aoaFull, {
          mensualMap: mensual,
          annualTotalsMap: anual,
          monthLimit: monthLimitFull,
          labelCol: sideColsFull.miniLabelCol,
          valueCol: sideColsFull.miniValueCol
        });
      }
      const ws = XLSX.utils.aoa_to_sheet(aoaFull);
      styleGeneralSheet({
        ws,
        aoa: aoaFull,
        monthsLimited: monthsFull,
        withObservaciones: empresaMode !== 'MH' && !omitSubvenciones,
        miniTablaMeta,
        sideCols: sideColsFull
      });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, empresaMode === 'MH' ? 'PIG GENERAL MH' : (omitSubvenciones ? 'CR GENERAL EISSS' : 'PIG GENERAL EISSS'));
      let pendingGeneralFormulas = null;
      if (omitSubvenciones && generalFormulaMetaFull) {
        if (miniTablaMeta) generalFormulaMetaFull.miniTabla = miniTablaMeta;
        pendingGeneralFormulas = { ws, meta: generalFormulaMetaFull };
      }

      // Hoja hasta mes anterior
      const { aoa: aoaNov, monthsLimited: monthsNov, formulaMeta: generalFormulaMetaNov } = buildGeneralAoa({
        title: titlePrev,
        months,
        mensualMap: mensual,
        annualTotalsMap: anual,
        monthLimit: monthLimitPrev,
        cuentasMensuales,
        omitSubvenciones
      });
      let miniTablaMetaNov = null;
      const sideColsNov = getPigGeneralSideCols(monthsNov);
      if (empresaMode !== 'MH') {
        miniTablaMetaNov = applyPigGeneralEisssMiniTabla(aoaNov, {
          mensualMap: mensual,
          annualTotalsMap: anual,
          monthLimit: monthLimitPrev,
          labelCol: sideColsNov.miniLabelCol,
          valueCol: sideColsNov.miniValueCol
        });
      }
      const wsNov = XLSX.utils.aoa_to_sheet(aoaNov);
      styleGeneralSheet({
        ws: wsNov,
        aoa: aoaNov,
        monthsLimited: monthsNov,
        miniTablaMeta: miniTablaMetaNov,
        sideCols: sideColsNov
      });
      XLSX.utils.book_append_sheet(wb, wsNov, sheetNamePrev);
      let pendingGeneralFormulasNov = null;
      if (omitSubvenciones && generalFormulaMetaNov) {
        if (miniTablaMetaNov) generalFormulaMetaNov.miniTabla = miniTablaMetaNov;
        pendingGeneralFormulasNov = { ws: wsNov, meta: generalFormulaMetaNov };
      }

      const lineaFormulaMetas = {};

      // Nota: Las hojas auxiliares "PIG CUENTAS ANUAL" y "PIG CUENTAS MENSUAL" eran solo para debug.
      // Las quitamos para que el Excel generado coincida con el original.

      // ===== DESPESES MP-APROV-PRFIRPF (Grupo 6) =====
      try {
        const cuentasG6 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('6.'));
        const g6Total =
          anual.get('6. Aprovisionamientos') ??
          anual.get('Aprovisionamientos') ??
          cuentasG6.reduce((sum, c) => sum + (Number(c.total) || 0), 0);

        const titleG6 = `GASTOS MP/APROVIZONAMENT/PROF.IRPF ${empresaLabel} ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
        const aoaG6 = [];
        aoaG6.push([titleG6, '']);
        aoaG6.push(['', '']);
        aoaG6.push(['6. Aprovisionamientos', '']);
        aoaG6.push(['', '']);
        aoaG6.push(['Aprovisionamientos', '']);
        aoaG6.push(['', g6Total]);
        aoaG6.push(['', '']);

        for (const c of cuentasG6) {
          const label = `${c.code} - ${c.name}`.trim();
          aoaG6.push([label, '']);
          aoaG6.push(['', c.total]);
        }

        const wsG6 = XLSX.utils.aoa_to_sheet(aoaG6);
        wsG6['!sheetView'] = [{ showGridLines: false }];
        wsG6['!cols'] = [{ wch: 70 }, { wch: 16 }];
        wsG6['!rows'] = [];
        wsG6['!rows'][0] = { hpt: 18 };
        wsG6['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }];

        const borderThin = {
          top: { style: 'thin', color: { rgb: '000000' } },
          bottom: { style: 'thin', color: { rgb: '000000' } },
          left: { style: 'thin', color: { rgb: '000000' } },
          right: { style: 'thin', color: { rgb: '000000' } }
        };

        // Título rojo centrado
        setRangeStyle(wsG6, 0, 0, 0, 1, {
          font: { bold: true, color: { rgb: 'C00000' }, sz: 12, name: 'Calibri' },
          alignment: { horizontal: 'center', vertical: 'center' }
        });

        // Bloque amarillo cabecera grupo (filas 2..5 en 0-index => 2-5, cols A-B)
        const yellow = makeFill('#FFFF00');
        setRangeStyle(wsG6, 2, 0, 5, 1, { fill: yellow, border: borderThin });
        setCellStyle(wsG6, 2, 0, { font: { bold: true, name: 'Calibri' } });
        setCellStyle(wsG6, 4, 0, { font: { bold: true, name: 'Calibri' } });
        setCellStyle(wsG6, 5, 1, { font: { bold: true, name: 'Calibri' }, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });

        // Bordes + estilos tabla cuentas
        for (let r = 6; r < aoaG6.length; r++) {
          const a = XLSX.utils.encode_cell({ r, c: 0 });
          const b = XLSX.utils.encode_cell({ r, c: 1 });
          if (wsG6[a]) setCellStyle(wsG6, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
          if (wsG6[b]) setCellStyle(wsG6, r, 1, { border: borderThin, numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });

          // Labels de cuenta en negrita (fila de label)
          if (wsG6[a] && wsG6[a].v && /^\d{3,}/.test(String(wsG6[a].v))) {
            setCellStyle(wsG6, r, 0, { font: { bold: true, name: 'Calibri' } });
          }
        }

        XLSX.utils.book_append_sheet(wb, wsG6, 'DESPESES MP-APROV-PRFIRPF');
        if (omitSubvenciones) applyPigDespesesMpFormulas(wsG6, { totalRow: 5, scanFromRow: 7 });
      } catch (e) {
        console.error('Error generando hoja DESPESES MP-APROV-PRFIRPF:', e);
      }

      // ===== Grupo 8: Gastos de personal =====
      try {
        const cuentasG8 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('8.'));
        const groupLabel = '8. Gastos de personal';
        const secA = 'a) Sueldos,salarios y asimilados';
        const secB = 'b) Cargas sociales';
        const secATotal = anual.get(secA) ?? 0;
        const secBTotal = anual.get(secB) ?? 0;
        const groupTotal = secATotal + secBTotal;
        const group8Built = buildGroupAccountsAoa({
          title: `SUELDOS Y SALARIOS GENERAL ${empresaLabel} ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim(),
          groupLabel,
          groupTotal,
          sections: [
            { label: secA, total: secATotal },
            { label: secB, total: secBTotal }
          ],
          cuentas: cuentasG8
        });
        const aoa8 = group8Built.aoa;
        const ws8 = XLSX.utils.aoa_to_sheet(aoa8);
        // Amarillo: bloque inicial + sección a) (como en la foto)
        styleGroupAccountsSheet({
          ws: ws8,
          aoa: aoa8,
          yellowRows: [
            { r0: 2, r1: 3 }, // 8. + total
            { r0: 5, r1: 6 }  // a) + total
          ]
        });
        if (omitSubvenciones) applyPigGastosCuentaResultadosFormulas(ws8, group8Built.formulaMeta);
        XLSX.utils.book_append_sheet(wb, ws8, 'SUELDOS Y SALARIOS GENERAL');
      } catch (e) {
        console.error('Error generando hoja GRUPO 8 - PERSONAL:', e);
      }

      // ===== Grupo 9: Otros gastos de la actividad =====
      try {
        const cuentasG9 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('9.'));
        const groupLabel = '9. Otros gastos de la actividad';
        const secA = 'a) Sevicios exteriores';
        const secB = 'b) Tributos';
        const secD = 'd) Otros gastos de gestión corriente';
        const secATotal = anual.get(secA) ?? 0;
        const secBTotal = anual.get(secB) ?? 0;
        const secDTotal = anual.get(secD) ?? 0;
        const groupTotal = secATotal + secBTotal + secDTotal;
        const group9Built = buildGroupAccountsAoa({
          title: `CONCEPTE OTROS GASTOS ${yearGuess ? `01/01/${yearGuess} al ${endOfMonthStr(lastIdx)}` : ''}`.trim(),
          groupLabel,
          groupTotal,
          sections: [
            { label: secA, total: secATotal },
            { label: secB, total: secBTotal },
            { label: secD, total: secDTotal }
          ],
          cuentas: cuentasG9
        });
        const aoa9 = group9Built.aoa;
        const ws9 = XLSX.utils.aoa_to_sheet(aoa9);
        styleGroupAccountsSheet({ ws: ws9, aoa: aoa9, yellowRows: [] });
        if (omitSubvenciones) applyPigGastosCuentaResultadosFormulas(ws9, group9Built.formulaMeta);
        XLSX.utils.book_append_sheet(wb, ws9, 'OTROS GASTOS');
      } catch (e) {
        console.error('Error generando hoja GRUPO 9 - OTROS GASTOS:', e);
      }

      if (empresaMode === 'MH') {
        // ===== PIG LINEA OBRADOR (solo MH) =====
        try {
          const yy = yearGuess ? yearGuess.slice(2) : '';
          const monthsObrador = months.map((m) => {
            const base = String(m || '').trim();
            if (!yy) return base;
            if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
            return `${base} ${yy}`.trim();
          });
          const titleObrador = `Cierre PIG LINEA OBRADOR  MH ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          const aoaObrador = buildPigLineaObradorAoa({ title: titleObrador, months: monthsObrador, cuentasMensuales });
          const wsObrador = XLSX.utils.aoa_to_sheet(aoaObrador);
          stylePigLineaObradorSheet({ ws: wsObrador, aoa: aoaObrador });
          XLSX.utils.book_append_sheet(wb, wsObrador, 'PIG LINEA OBRADOR');
        } catch (e) {
          console.error('Error generando hoja PIG LINEA OBRADOR:', e);
        }

        // ===== PIG LINEA OBRADOR 2 (solo 4 cuentas, MH) =====
        try {
          const yy = yearGuess ? yearGuess.slice(2) : '';
          const monthsObrador = months.map((m) => {
            const base = String(m || '').trim();
            if (!yy) return base;
            if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
            return `${base} ${yy}`.trim();
          });
          const titleObrador2 = `Cierre PIG LINEA OBRADOR 2  MH ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          const aoaObrador2 = buildPigLineaObrador2Aoa({ title: titleObrador2, months: monthsObrador, cuentasMensuales });
          const wsObrador2 = XLSX.utils.aoa_to_sheet(aoaObrador2);
          stylePigLineaObradorSheet({ ws: wsObrador2, aoa: aoaObrador2 });
          XLSX.utils.book_append_sheet(wb, wsObrador2, 'PIG LINEA OBRADOR 2');
        } catch (e) {
          console.error('Error generando hoja PIG LINEA OBRADOR 2:', e);
        }
      }

      if (empresaMode !== 'MH') {
        // ===== PIG LINEA CATERING / IDONI / KOIKI + COMPARATIVA (solo EISSS) =====
        try {
          const yy = yearGuess ? yearGuess.slice(2) : '';
          const monthsCatering = months.map((m) => {
            const base = String(m || '').trim();
            if (!yy) return base;
            if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
            return `${base} ${yy}`.trim();
          });
          const titleCatering = `Cierre ${omitSubvenciones ? 'CUENTA RESULTADOS' : 'PIG'} LINEA CATERING  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          const catBuilt = unwrapPigLineaAoa(buildPigLineaCateringAoa({
            title: titleCatering,
            months: monthsCatering,
            cuentasMensuales,
            mensualMap: mensual,
            estimadosSlots: estimadosSlotsByLinea.CATERING,
            cuentaResultados: omitSubvenciones
          }));
          const aoaCat = catBuilt.aoa;
          const wsCat = XLSX.utils.aoa_to_sheet(aoaCat);
          stylePigLineaCateringSheet({ ws: wsCat, aoa: aoaCat });
          if (omitSubvenciones && catBuilt.formulaMeta) {
            catBuilt.formulaMeta.sheetName = 'PIG LINEA CATERING';
            applyPigLineaCuentaResultadosFormulas(wsCat, catBuilt.formulaMeta);
          }
          XLSX.utils.book_append_sheet(wb, wsCat, 'PIG LINEA CATERING');
          if (omitSubvenciones) lineaFormulaMetas.CATERING = catBuilt.formulaMeta;
        } catch (e) {
          console.error('Error generando hoja PIG LINEA CATERING:', e);
        }

        try {
          const yy = yearGuess ? yearGuess.slice(2) : '';
          const monthsIdoni = months.map((m) => {
            const base = String(m || '').trim();
            if (!yy) return base;
            if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
            return `${base} ${yy}`.trim();
          });
          const titleIdoni = `Cierre ${omitSubvenciones ? 'CUENTA RESULTADOS' : 'PIG'} LINEA IDONI  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          const idoniBuilt = unwrapPigLineaAoa(buildPigLineaIdoniAoa({
            title: titleIdoni,
            months: monthsIdoni,
            cuentasMensuales,
            mensualMap: mensual,
            estimadosSlots: estimadosSlotsByLinea.IDONI,
            cuentaResultados: omitSubvenciones
          }));
          const aoaIdoni = idoniBuilt.aoa;
          const wsIdoni = XLSX.utils.aoa_to_sheet(aoaIdoni);
          stylePigLineaCateringSheet({ ws: wsIdoni, aoa: aoaIdoni });
          if (omitSubvenciones && idoniBuilt.formulaMeta) {
            idoniBuilt.formulaMeta.sheetName = 'PIG LINEA IDONI';
            applyPigLineaCuentaResultadosFormulas(wsIdoni, idoniBuilt.formulaMeta);
          }
          XLSX.utils.book_append_sheet(wb, wsIdoni, 'PIG LINEA IDONI');
          if (omitSubvenciones) lineaFormulaMetas.IDONI = idoniBuilt.formulaMeta;
        } catch (e) {
          console.error('Error generando hoja PIG LINEA IDONI:', e);
        }

        try {
          const yy = yearGuess ? yearGuess.slice(2) : '';
          const monthsKoiki = months.map((m) => {
            const base = String(m || '').trim();
            if (!yy) return base;
            if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
            return `${base} ${yy}`.trim();
          });
          const titleKoiki = `Cierre ${omitSubvenciones ? 'CUENTA RESULTADOS' : 'PIG'} LINEA KOIKI  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          const koikiBuilt = unwrapPigLineaAoa(buildPigLineaKoikiAoa({
            title: titleKoiki,
            months: monthsKoiki,
            cuentasMensuales,
            mensualMap: mensual,
            estimadosSlots: estimadosSlotsByLinea.KOIKI,
            cuentaResultados: omitSubvenciones
          }));
          const aoaKoiki = koikiBuilt.aoa;
          const wsKoiki = XLSX.utils.aoa_to_sheet(aoaKoiki);
          stylePigLineaCateringSheet({ ws: wsKoiki, aoa: aoaKoiki, koikiObservations: !omitSubvenciones });
          if (omitSubvenciones && koikiBuilt.formulaMeta) {
            koikiBuilt.formulaMeta.sheetName = 'PIG LINEA KOIKI';
            applyPigLineaCuentaResultadosFormulas(wsKoiki, koikiBuilt.formulaMeta);
          }
          XLSX.utils.book_append_sheet(wb, wsKoiki, 'PIG LINEA KOIKI');
          if (omitSubvenciones) lineaFormulaMetas.KOIKI = koikiBuilt.formulaMeta;
        } catch (e) {
          console.error('Error generando hoja PIG LINEA KOIKI:', e);
        }

        try {
          const yy = yearGuess ? yearGuess.slice(2) : '';
          const monthsEstructura = months.map((m) => {
            const base = String(m || '').trim();
            if (!yy) return base;
            if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
            return `${base} ${yy}`.trim();
          });
          const titleEstructuraSubv740 = `Cierre ${omitSubvenciones ? 'CUENTA RESULTADOS' : 'PIG'} ESTRUCTURA SUBV 740  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          // En Cuenta Resultados: subvenciones hardcodeadas + filas 640/642 vacías (sin importes Holded).
          const cuentasSubv740Source = cuentasMensualesRaw.filter(isPigEstructuraSubv740Cuenta);
          const aoaEstructuraBuilt = unwrapPigLineaAoa(buildPigLineaEstructuraAoa({
            title: titleEstructuraSubv740,
            months: monthsEstructura,
            cuentasMensuales: omitSubvenciones ? [] : cuentasMensualesRaw,
            filterCuenta: isPigEstructuraSubv740Cuenta,
            lineName: 'ESTRUCTURA SUBV 740',
            accountOrder: PIG_ESTRUCTURA_SUBV_740_ACCOUNT_CODES,
            compactLayout: true,
            estimadosSlots: omitSubvenciones ? [] : (estimadosSlotsByLinea.ESTRUCTURA || []),
            cuentaResultados: omitSubvenciones
          }));
          const aoaEstructuraSubv740 = aoaEstructuraBuilt.aoa;
          console.log('[PIG ESTRUCTURA SUBV 740] Hoja generada:', {
            cuentaResultados: omitSubvenciones,
            cuentas: omitSubvenciones ? ['hardcoded'] : cuentasSubv740Source.map((c) => c.code),
            count: omitSubvenciones ? 2 : cuentasSubv740Source.length
          });
          const wsEstructuraSubv740 = XLSX.utils.aoa_to_sheet(aoaEstructuraSubv740);
          stylePigLineaCateringSheet({ ws: wsEstructuraSubv740, aoa: aoaEstructuraSubv740 });
          if (omitSubvenciones && aoaEstructuraBuilt.formulaMeta) {
            aoaEstructuraBuilt.formulaMeta.sheetName = 'PIG ESTRUCTURA SUBV 740';
            applyPigLineaCuentaResultadosFormulas(wsEstructuraSubv740, aoaEstructuraBuilt.formulaMeta);
          }
          XLSX.utils.book_append_sheet(wb, wsEstructuraSubv740, 'PIG ESTRUCTURA SUBV 740');
          if (omitSubvenciones) lineaFormulaMetas.ESTRUCTURA = aoaEstructuraBuilt.formulaMeta;
        } catch (e) {
          console.error('Error generando hoja PIG ESTRUCTURA SUBV 740:', e);
        }

        if (omitSubvenciones) {
          if (pendingGeneralFormulas) {
            applyPigGeneralCuentaResultadosFormulas(
              pendingGeneralFormulas.ws,
              pendingGeneralFormulas.meta,
              lineaFormulaMetas
            );
          }
          if (pendingGeneralFormulasNov) {
            applyPigGeneralCuentaResultadosFormulas(
              pendingGeneralFormulasNov.ws,
              pendingGeneralFormulasNov.meta,
              lineaFormulaMetas
            );
          }
        }

        try {
          const objetivos = {
            catering: { normal: parseEuroNumber(objetivosForGenerate.cateringNormal), optim: parseEuroNumber(objetivosForGenerate.cateringOptim) },
            idoni: { normal: parseEuroNumber(objetivosForGenerate.idoniNormal), optim: parseEuroNumber(objetivosForGenerate.idoniOptim) },
            koiki: { normal: parseEuroNumber(objetivosForGenerate.koikiNormal), optim: parseEuroNumber(objetivosForGenerate.koikiOptim) }
          };
          const yearCurrent = Number(mensualParsed.yearGuess || 0) || 0;
          const yearPrev = yearCurrent ? yearCurrent - 1 : 0;
          const yearPrev2 = yearCurrent ? yearCurrent - 2 : 0;
          const emptyBase = Promise.resolve({ months: null, error: null });
          const [cPrev2, iPrev2, kPrev2, cPrev, iPrev, kPrev] = await Promise.all([
            yearPrev2 > 2023 ? loadPigBaseMensual({ linea: 'CATERING', year: yearPrev2 }) : emptyBase,
            yearPrev2 > 2023 ? loadPigBaseMensual({ linea: 'IDONI', year: yearPrev2 }) : emptyBase,
            yearPrev2 > 2023 ? loadPigBaseMensual({ linea: 'KOIKI', year: yearPrev2 }) : emptyBase,
            yearPrev ? loadPigBaseMensual({ linea: 'CATERING', year: yearPrev }) : emptyBase,
            yearPrev ? loadPigBaseMensual({ linea: 'IDONI', year: yearPrev }) : emptyBase,
            yearPrev ? loadPigBaseMensual({ linea: 'KOIKI', year: yearPrev }) : emptyBase
          ]);
          const basesPrev2Year = { CATERING: cPrev2.months, IDONI: iPrev2.months, KOIKI: kPrev2.months };
          const basesPrevYear = { CATERING: cPrev.months, IDONI: iPrev.months, KOIKI: kPrev.months };
          const { months: cateringHoldedBudget, error: cateringHoldedBudgetError, debug: cateringHoldedDebug } = await loadPigCateringBudgetMonthsByDueDate({
            year: yearCurrent,
            company: 'solucions'
          });
          console.log('[PIG COMPARATIVA] Presupuestos Holded catering:', {
            year: yearCurrent,
            months: cateringHoldedBudget,
            error: cateringHoldedBudgetError?.message || null,
            debug: cateringHoldedDebug
          });
          if (cateringHoldedBudgetError) {
            console.warn('PIG COMPARATIVA: no se pudieron cargar presupuestos catering de Holded.', cateringHoldedBudgetError);
          }
          const comparativa = buildComparativaAnualAoa({
            mensualParsed,
            objetivos,
            basesPrevYear,
            basesPrev2Year,
            cateringHoldedBudget
          });
          console.log('[PIG COMPARATIVA] Merge catering BASE año:', {
            billing: comparativa.cateringMeta?.billingMonths,
            budget: cateringHoldedBudget,
            merged: comparativa.cateringMeta?.mergedMonths,
            greenMonths: comparativa.cateringMeta?.budgetMonthFlags?.map((on, i) => (on ? ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i] : null)).filter(Boolean),
            dataStartRow: comparativa.cateringMeta?.dataStartRow,
            baseYearCol: comparativa.cateringMeta?.baseYearCol
          });
          const wsComp = XLSX.utils.aoa_to_sheet(comparativa.aoa);
          styleComparativaAnualSheet({ ws: wsComp, aoa: comparativa.aoa, cateringMeta: comparativa.cateringMeta });
          if (omitSubvenciones && comparativa.formulaMeta) {
            applyPigComparativaCuentaResultadosFormulas(wsComp, comparativa.formulaMeta);
          }
          XLSX.utils.book_append_sheet(wb, wsComp, 'COMPARATIVA ANUAL');
        } catch (e) {
          console.error('Error generando hoja COMPARATIVA ANUAL:', e);
        }

        try {
          const yyTes = yearGuess ? yearGuess.slice(2) : '';
          const titleTesoreria = `Cierre TESORERÍA  EI.SSS ${yyTes ? `01/01/${yyTes} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
          const { accounts: treasuryAccounts, error: treasuryError } = await loadPigTreasuryAccounts({
            company: 'solucions'
          });
          if (treasuryError) {
            console.warn('PIG TESORERÍA: no se pudieron cargar cuentas de Holded.', treasuryError);
          }
          const { aoa: aoaTesoreria, meta: tesoreriaMeta } = buildPigTesoreriaSheetAoa({
            title: titleTesoreria,
            accounts: treasuryAccounts,
            errorMessage: treasuryError?.message || '',
            cuentaResultados: omitSubvenciones
          });
          const wsTesoreria = XLSX.utils.aoa_to_sheet(aoaTesoreria);
          stylePigTesoreriaSheet({ ws: wsTesoreria, aoa: aoaTesoreria, meta: tesoreriaMeta });
          if (omitSubvenciones) applyPigTesoreriaCuentaResultadosFormulas(wsTesoreria, tesoreriaMeta);
          XLSX.utils.book_append_sheet(wb, wsTesoreria, 'TESORERÍA');
        } catch (e) {
          console.error('Error generando hoja TESORERÍA:', e);
        }

        try {
          const yearPres = Number(yearGuess) || new Date().getFullYear();
          const { rows: presupuestosRows, error: presupuestosError } = await loadPigPresupuestosPendientes({
            year: yearPres,
            company: 'solucions'
          });
          if (presupuestosError) {
            console.warn('PIG PRESUPUESTOS: no se pudieron cargar presupuestos de Holded.', presupuestosError);
          }
          const titlePresupuestos = `PRESUPUESTOS EI.SSS ${yearPres} · Pendientes / Parciales por vencimiento`.trim();
          const { aoa: aoaPresupuestos, meta: presupuestosMeta } = buildPigPresupuestosSheetAoa({
            title: titlePresupuestos,
            rows: presupuestosRows,
            year: yearPres
          });
          const wsPresupuestos = XLSX.utils.aoa_to_sheet(aoaPresupuestos);
          stylePigPresupuestosSheet({ ws: wsPresupuestos, aoa: aoaPresupuestos, meta: presupuestosMeta });
          if (omitSubvenciones) applyPigPresupuestosCuentaResultadosFormulas(wsPresupuestos, presupuestosMeta);
          XLSX.utils.book_append_sheet(wb, wsPresupuestos, 'PRESUPUESTOS');
        } catch (e) {
          console.error('Error generando hoja PRESUPUESTOS:', e);
        }

        try {
          const yearFac = Number(yearGuess) || new Date().getFullYear();
          const { lineas: facturacionLineas, error: facturacionError } = await loadPigFacturacionPendiente({
            year: yearFac,
            company: 'solucions'
          });
          if (facturacionError) {
            console.warn('PIG FACTURACIÓN PENDIENTE: no se pudieron cargar facturas de Holded.', facturacionError);
          }
          const titleFacturacion = `FACTURACIÓN PENDIENTE EI.SSS ${yearFac} · Pendiente / Vencida por línea`.trim();
          const { aoa: aoaFacturacion, meta: facturacionMeta } = buildPigFacturacionPendienteSheetAoa({
            title: titleFacturacion,
            lineas: facturacionLineas,
            year: yearFac
          });
          const wsFacturacion = XLSX.utils.aoa_to_sheet(aoaFacturacion);
          stylePigFacturacionPendienteSheet({ ws: wsFacturacion, aoa: aoaFacturacion, meta: facturacionMeta });
          if (omitSubvenciones) applyPigFacturacionCuentaResultadosFormulas(wsFacturacion, facturacionMeta);
          XLSX.utils.book_append_sheet(wb, wsFacturacion, 'FACTURACIÓN PENDIENTE');
        } catch (e) {
          console.error('Error generando hoja FACTURACIÓN PENDIENTE:', e);
        }
      }
      XLSX.writeFile(
        wb,
        omitSubvenciones
          ? `PIG_EISSS_Cuenta_Resultados_${new Date().toISOString().slice(0, 10)}.xlsx`
          : `PIG_${empresaMode === 'MH' ? 'MH' : 'EISSS'}_${new Date().toISOString().slice(0, 10)}.xlsx`
      );
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Error generando el Excel.');
    }
  }, [anualFile, mensualFile, objetivosComparativa, pigEmpresa, estimadosSubv, estimadosYear, saveEstimadosSubv, saveObjetivosComparativa]);

  return (
    <div style={{ padding: 24, background: colors.background, minHeight: '100vh', color: colors.text }}>
      <SectionHeader
        icon={FileText}
        title="PIG"
        subtitle={(
          <span>
            Sube los 2 CSV exportados desde Holded (<b>Pèrdues i guanys</b> anual y <b>Pèrdues i guanys mensual</b>) y KRONOS generará un Excel con la hoja{' '}
            <b>{pigEmpresa === 'MH' ? 'PIG GENERAL MH' : 'PIG GENERAL EISSS'}</b>.
          </span>
        )}
      />

      {error ? (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: `1px solid ${colors.error}`, background: colors.error + '18', display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertCircle size={18} color={colors.error} />
          <div>{error}</div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 10 }}>Empresa</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { id: 'EISSS', label: 'EISSS' },
              { id: 'MH', label: 'Menjar d’Hort' }
            ].map((opt) => (
              <button
                key={opt.id}
                onClick={() => setPigEmpresa(opt.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${pigEmpresa === opt.id ? colors.primary : colors.border}`,
                  background: pigEmpresa === opt.id ? colors.primary : colors.background,
                  color: pigEmpresa === opt.id ? 'white' : colors.text,
                  fontWeight: 950,
                  cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 1.35 }}>
            Selecciona la empresa para generar el Excel con las hojas correspondientes (no se mezclan EISSS y MH).
          </div>
        </div>
        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>1) Archivo anual (Pèrdues i guanys)</div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, fontWeight: 900 }}>
            <Upload size={18} />
            {anualFile ? anualFile.name : 'Seleccionar archivo'}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={(e) => setAnualFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>2) Archivo mensual (Pèrdues i guanys Mensual)</div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, fontWeight: 900 }}>
            <Upload size={18} />
            {mensualFile ? mensualFile.name : 'Seleccionar archivo'}
            <input
              type="file"
              accept=".csv,.xlsx,.xls,text/csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              style={{ display: 'none' }}
              onChange={(e) => setMensualFile(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        {pigEmpresa !== 'MH' && (
          <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
            <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 4 }}>Estimados de subvención (PIG LINEA)</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 1.35 }}>
              Los cambios <b>no se guardan solos</b>: pulsa <b>Guardar estimados</b> (o genera el Excel del mismo año) antes de cerrar Kronos.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
              <label style={{ display: 'grid', gap: 6, minWidth: 120 }}>
                <div style={{ fontSize: 12, fontWeight: 900, color: colors.textSecondary }}>Año</div>
                <input
                  value={estimadosYear}
                  onChange={(e) => setEstimadosYear(e.target.value.replace(/[^\d]/g, '').slice(0, 4))}
                  placeholder="2026"
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: colors.background,
                    color: colors.text,
                    fontWeight: 800
                  }}
                />
              </label>
              <button
                type="button"
                onClick={saveEstimadosSubv}
                disabled={estimadosSaving || estimadosLoading}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.primary}`,
                  background: colors.primary,
                  color: 'white',
                  fontWeight: 900,
                  cursor: estimadosSaving || estimadosLoading ? 'not-allowed' : 'pointer',
                  opacity: estimadosSaving || estimadosLoading ? 0.7 : 1
                }}
              >
                {estimadosSaving ? 'Guardando…' : 'Guardar estimados'}
              </button>
            </div>
            <div style={{ display: 'grid', gap: 16 }}>
              {[
                { linea: 'CATERING', label: 'CATERING' },
                { linea: 'IDONI', label: 'IDONI' },
                { linea: 'KOIKI', label: 'KOIKI' },
                { linea: 'ESTRUCTURA', label: 'ESTRUCTURA (hoja SUBV 740)' }
              ].map((row) => (
                <div
                  key={row.linea}
                  style={{
                    display: 'grid',
                    gap: 10,
                    padding: 12,
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: colors.background
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 950, color: colors.text }}>{row.label}</div>
                  {[1, 2].map((slotNum) => {
                    const slotKey = `subv${slotNum}`;
                    const tramos = estimadosSubv[row.linea]?.[slotKey]?.tramos || [
                      { amount: '', from: 1, to: 12 },
                      { amount: '', from: 1, to: 12 }
                    ];
                    return (
                      <div key={slotKey} style={{ display: 'grid', gap: 8 }}>
                        <div style={{ fontSize: 12, fontWeight: 900, color: colors.textSecondary }}>
                          Subvención {slotNum}{slotNum === 2 ? ' (opcional)' : ''}
                        </div>
                        {[0, 1].map((tramoIdx) => (
                          <div
                            key={tramoIdx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'minmax(90px, 1fr) repeat(2, minmax(88px, 110px))',
                              gap: 8,
                              alignItems: 'end'
                            }}
                          >
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary }}>
                                {tramoIdx === 0 ? 'Importe €/mes' : '2º tramo (opcional)'}
                              </div>
                              <input
                                value={tramos[tramoIdx]?.amount ?? ''}
                                onChange={(e) => setEstimadosSubv((prev) => {
                                  const current = prev[row.linea]?.[slotKey] || { tramos: [{ amount: '', from: 1, to: 12 }, { amount: '', from: 1, to: 12 }] };
                                  const nextTramos = [...(current.tramos || [])];
                                  while (nextTramos.length < 2) nextTramos.push({ amount: '', from: 1, to: 12 });
                                  nextTramos[tramoIdx] = { ...nextTramos[tramoIdx], amount: e.target.value };
                                  return {
                                    ...prev,
                                    [row.linea]: {
                                      ...prev[row.linea],
                                      [slotKey]: { tramos: nextTramos }
                                    }
                                  };
                                })}
                                placeholder={tramoIdx === 0 ? 'Ej: 2100' : 'Ej: 1500'}
                                disabled={estimadosLoading}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: `1px solid ${colors.border}`,
                                  background: colors.surface,
                                  color: colors.text,
                                  fontWeight: 800
                                }}
                              />
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary }}>Des de</div>
                              <select
                                value={tramos[tramoIdx]?.from ?? 1}
                                onChange={(e) => setEstimadosSubv((prev) => {
                                  const current = prev[row.linea]?.[slotKey] || { tramos: [{ amount: '', from: 1, to: 12 }, { amount: '', from: 1, to: 12 }] };
                                  const nextTramos = [...(current.tramos || [])];
                                  while (nextTramos.length < 2) nextTramos.push({ amount: '', from: 1, to: 12 });
                                  nextTramos[tramoIdx] = { ...nextTramos[tramoIdx], from: Number(e.target.value) };
                                  return {
                                    ...prev,
                                    [row.linea]: {
                                      ...prev[row.linea],
                                      [slotKey]: { tramos: nextTramos }
                                    }
                                  };
                                })}
                                disabled={estimadosLoading}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: `1px solid ${colors.border}`,
                                  background: colors.surface,
                                  color: colors.text,
                                  fontWeight: 700
                                }}
                              >
                                {PIG_ESTIMADO_MONTH_OPTIONS.map((opt) => (
                                  <option key={`${row.linea}-${slotKey}-${tramoIdx}-from-${opt.value}`} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label style={{ display: 'grid', gap: 4 }}>
                              <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary }}>Fins a</div>
                              <select
                                value={tramos[tramoIdx]?.to ?? 12}
                                onChange={(e) => setEstimadosSubv((prev) => {
                                  const current = prev[row.linea]?.[slotKey] || { tramos: [{ amount: '', from: 1, to: 12 }, { amount: '', from: 1, to: 12 }] };
                                  const nextTramos = [...(current.tramos || [])];
                                  while (nextTramos.length < 2) nextTramos.push({ amount: '', from: 1, to: 12 });
                                  nextTramos[tramoIdx] = { ...nextTramos[tramoIdx], to: Number(e.target.value) };
                                  return {
                                    ...prev,
                                    [row.linea]: {
                                      ...prev[row.linea],
                                      [slotKey]: { tramos: nextTramos }
                                    }
                                  };
                                })}
                                disabled={estimadosLoading}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 8,
                                  border: `1px solid ${colors.border}`,
                                  background: colors.surface,
                                  color: colors.text,
                                  fontWeight: 700
                                }}
                              >
                                {PIG_ESTIMADO_MONTH_OPTIONS.map((opt) => (
                                  <option key={`${row.linea}-${slotKey}-${tramoIdx}-to-${opt.value}`} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 1.35 }}>
              Cada subvención puede tener hasta <b>2 tramos</b> (mismo estimado, distinto importe por meses). Ejemplo: 2.100 € de Gener a Maig y 1.500 € de Juny a Desembre.
              Si hay segunda subvención, se añade otra fila <b>ESTIMADO DE SUBVENCIÓN 2 ANTES DE INGRESO</b> en el Excel.
            </div>
            {estimadosStatus ? (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: colors.textSecondary }}>
                {estimadosStatus}
              </div>
            ) : null}
          </div>
        )}

        {pigEmpresa !== 'MH' && (
          <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
            <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 4 }}>Objetivos (COMPARATIVA ANUAL)</div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 10, lineHeight: 1.35 }}>
              Usan el mismo <b>año</b> que los estimados de subvención. Los cambios <b>no se guardan solos</b>: pulsa <b>Guardar objetivos</b> (o genera el Excel del mismo año) antes de cerrar Kronos.
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'end', marginBottom: 12 }}>
              <button
                type="button"
                onClick={saveObjetivosComparativa}
                disabled={objetivosSaving || objetivosLoading}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: `1px solid ${colors.primary}`,
                  background: colors.primary,
                  color: 'white',
                  fontWeight: 900,
                  cursor: objetivosSaving || objetivosLoading ? 'not-allowed' : 'pointer',
                  opacity: objetivosSaving || objetivosLoading ? 0.7 : 1
                }}
              >
                {objetivosSaving ? 'Guardando…' : 'Guardar objetivos'}
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {[
                { key: 'cateringNormal', label: 'CATERING · Normal' },
                { key: 'cateringOptim', label: 'CATERING · Òptim' },
                { key: 'idoniNormal', label: 'IDONI · Normal' },
                { key: 'idoniOptim', label: 'IDONI · Òptim' },
                { key: 'koikiNormal', label: 'KOIKI · Normal' },
                { key: 'koikiOptim', label: 'KOIKI · Òptim' }
              ].map((f) => (
                <label key={f.key} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 12, fontWeight: 900, color: colors.textSecondary }}>{f.label}</div>
                  <input
                    value={objetivosComparativa[f.key]}
                    onChange={(e) => setObjetivosComparativa((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder="Ej: 650000"
                    disabled={objetivosLoading}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.background,
                      color: colors.text,
                      fontWeight: 800
                    }}
                  />
                </label>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 1.35 }}>
              Estos valores alimentan las columnas <b>OBJECTIU 25</b>: se calcula el “restante” restando la <b>BASE 2025</b> mes a mes (cadena tipo H3-F4, H4-F5...).
            </div>
            {objetivosStatus ? (
              <div style={{ marginTop: 8, fontSize: 12, fontWeight: 800, color: colors.textSecondary }}>
                {objetivosStatus}
              </div>
            ) : null}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => generateExcel()}
            disabled={!canGenerate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              cursor: canGenerate ? 'pointer' : 'not-allowed',
              border: `1px solid ${canGenerate ? colors.primary : colors.border}`,
              background: canGenerate ? colors.primary : colors.surface,
              color: canGenerate ? 'white' : colors.textSecondary,
              fontWeight: 950,
              opacity: canGenerate ? 1 : 0.7
            }}
          >
            <Download size={18} />
            Generar Excel
          </button>
          {pigEmpresa !== 'MH' && (
            <button
              onClick={() => generateExcel({ cuentaResultados: true })}
              disabled={!canGenerate}
              title="Mismo PIG EISSS sin subvenciones de Holded ni estimados (para cuenta de resultados)"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 14px',
                borderRadius: 10,
                cursor: canGenerate ? 'pointer' : 'not-allowed',
                border: `1px solid ${canGenerate ? colors.border : colors.border}`,
                background: canGenerate ? colors.surface : colors.surface,
                color: canGenerate ? colors.text : colors.textSecondary,
                fontWeight: 950,
                opacity: canGenerate ? 1 : 0.7
              }}
            >
              <Download size={18} />
              EISSS Cuenta Resultados
            </button>
          )}
        </div>
        {pigEmpresa !== 'MH' && (
          <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 }}>
            <b>EISSS Cuenta Resultados</b> genera el PIG EISSS <b>sin subvenciones de Holded</b>, con las subvenciones
            hardcodeadas (Catering / Idoni / Koiki / Estructura SUBV 740) en las tablas grandes.
            Incluye también la hoja <b>PRESUPUESTOS</b> y <b>FACTURACIÓN PENDIENTE</b>
            (misma lógica que Informe Sergi: pendientes/parciales y cobros pendientes por línea).
          </div>
        )}
      </div>
    </div>
  );
}

