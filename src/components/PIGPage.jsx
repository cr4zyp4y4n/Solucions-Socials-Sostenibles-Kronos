import React, { useCallback, useMemo, useState } from 'react';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { useTheme } from './ThemeContext';
import { loadPigBaseMensual } from '../services/pigBasesHistoricasService';

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
  const headerRow = rows.find((r) => r && r.length >= 2 && String(r[0] || '').trim() === '' && /(Gener|Enero|Jan)/i.test(r[1] || ''));
  const headerMonths = headerRow ? headerRow.slice(1).map((m) => String(m || '').trim()).filter(Boolean) : [];
  const monthCount = Math.min(12, headerMonths.length);
  const monthNames = headerMonths.slice(0, monthCount);

  const yearGuess = (() => {
    const m = String(csvText || '').match(/01\/01\/(\d{4})/);
    if (m) return m[1];
    // fallback: intentar extraer del primer mes "Gener 26"
    const first = monthNames[0] || '';
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
      const monthsRaw = row.slice(1, 1 + monthCount).map(parseEuroNumber);
      const months = [...monthsRaw, ...new Array(Math.max(0, 12 - monthsRaw.length)).fill(0)];
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
    const valsRaw = row.slice(1, 1 + monthCount).map(parseEuroNumber);
    const vals = [...valsRaw, ...new Array(Math.max(0, 12 - valsRaw.length)).fill(0)];
    map.set(label, vals);
  }
  return { map, monthNames, cuentas, yearGuess, monthCount };
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
  aoa.push(['', groupTotal]);

  for (const sec of sections) {
    aoa.push(['', '']);
    aoa.push([sec.label, '']);
    aoa.push(['', sec.total]);

    const items = cuentas
      .filter((c) => String(c.subLabel || '').toLowerCase() === String(sec.label || '').toLowerCase())
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    for (const c of items) {
      aoa.push([`${c.code} - ${c.name}`.trim(), '']);
      aoa.push(['', c.total]);
    }
  }

  // Si no hay secciones, solo listamos cuentas del grupo
  if (!sections.length) {
    const items = cuentas.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    aoa.push(['', '']);
    for (const c of items) {
      aoa.push([`${c.code} - ${c.name}`.trim(), '']);
      aoa.push(['', c.total]);
    }
  }

  return aoa;
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

function buildPigLineaCateringAoa({ title, months, cuentasMensuales = [], mensualMap }) {
  const aoa = [];
  const cols = ['Cuenta', ...months, 'TOTAL 25', '', 'TOTAL 25 ESTIMADO SUBV'];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isCatering = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('catering');
  };
  const isSubv = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('subv') || String(c?.code || '').startsWith('7404') || String(c?.code || '').startsWith('7408');
  };
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  const catering = (cuentasMensuales || []).filter(isCatering);
  const subv = catering.filter(isSubv).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const resto = catering.filter((c) => !isSubv(c)).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));

  // ===== Tabla principal =====
  const monthsLen = Math.min(12, months.length);

  // Fila hardcodeada: "ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO"
  // Nota: estos importes NO entran en "TOTAL BENEFICIO POR MES", solo se suman en la columna de TOTAL ESTIMADO SUBV.
  const ESTIMADO_SUBV_CATERING = new Array(12).fill(1200);
  const estimadoAntesIngreso = ESTIMADO_SUBV_CATERING;
  {
    const vals = estimadoAntesIngreso.slice(0, monthsLen);
    const total = vals.reduce((a, b) => a + (Number(b) || 0), 0);
    // En el Excel de referencia esta fila no suma en TOTAL 25 (solo en ESTIMADO)
    aoa.push(['ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO', ...vals, '', '', total]);
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
    aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
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
  aoa.push(['TOTAL BENEFICIO POR MES CATERING', ...totalBeneficioMes, totalBeneficioMesTotal, '', (totalBeneficioMesTotal + estimadoTotal)]);
  // 1 fila de espacio antes del bloque de 3 líneas
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(['TOTAL INGRESOS CATERING SIN SUBVENCIONES', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
  aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
  aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);

  // ===== Tablas inferiores (totales computados) =====
  // Construimos 2 listados: enero–nov y enero–dic
  const listAll = catering.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
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
  for (let i = 0; i < maxLen; i++) {
    const left = novRows[i] || ['', ''];
    const right = decRows[i] || ['', ''];
    const row = new Array(cols.length).fill('');
    row[0] = left[0];
    row[1] = left[1];
    // Right: label en D (se fusionará D..H), valor en I
    row[3] = right[0];
    row[8] = right[1];
    aoa.push(row);
  }

  // Totales inferiores
  const novTotal = listAll.reduce((sum, c) => sum + sumMonths(c.months, novLimit), 0);
  const decTotal = listAll.reduce((sum, c) => sum + sumMonths(c.months, decLimit), 0);
  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL BENEFICIO CATERING A ${endOfMonthStr(novLimit - 1)}`;
    row[1] = novTotal;
    row[3] = `TOTAL BENEFICIO CATERING A ${endOfMonthStr(decLimit - 1)}`;
    row[8] = decTotal;
    aoa.push(row);
  }

  return aoa;
}

function buildPigLineaIdoniAoa({ title, months, cuentasMensuales = [], mensualMap }) {
  const aoa = [];
  const cols = ['Cuenta', ...months, 'TOTAL 25', '', 'TOTAL 25 ESTIMADO'];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isIdoni = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('idoni');
  };
  const isSubv = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('subv') || String(c?.code || '').startsWith('7404') || String(c?.code || '').startsWith('7406') || String(c?.code || '').startsWith('7408');
  };
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  const idoni = (cuentasMensuales || []).filter(isIdoni);
  const subv = idoni.filter(isSubv).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const resto = idoni.filter((c) => !isSubv(c)).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));

  const monthsLen = Math.min(12, months.length);

  // Fila hardcodeada: "ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO"
  const ESTIMADO_SUBV_IDONI = new Array(12).fill(2500);
  const estimadoAntesIngreso = ESTIMADO_SUBV_IDONI;
  {
    const vals = estimadoAntesIngreso.slice(0, monthsLen);
    const total = vals.reduce((a, b) => a + (Number(b) || 0), 0);
    aoa.push(['ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO', ...vals, '', '', total]);
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
    aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
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
  aoa.push(['TOTAL BENEFICIO POR MES IDONI', ...totalBeneficioMes, totalBeneficioMesTotal, '', (totalBeneficioMesTotal + estimadoTotal)]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(['TOTAL INGRESOS IDONI SIN SUBV.', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
  aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
  aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);

  // ===== Tablas inferiores (totales computados) =====
  const listAll = idoni.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
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

  const novTotal = listAll.reduce((sum, c) => sum + sumMonths(c.months, novLimit), 0);
  const decTotal = listAll.reduce((sum, c) => sum + sumMonths(c.months, decLimit), 0);
  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL  BENEFICIO IDONI A ${endOfMonthStr(novLimit - 1)}`;
    row[1] = novTotal;
    row[3] = `TOTAL  BENEFICIO IDONI A ${endOfMonthStr(decLimit - 1)}`;
    row[8] = decTotal;
    aoa.push(row);
  }

  return aoa;
}

function buildPigLineaKoikiAoa({ title, months, cuentasMensuales = [], mensualMap }) {
  const aoa = [];
  const cols = ['Cuenta', ...months, 'TOTAL 25', '', 'TOTAL 25 ESTIMADO'];
  aoa.push([title, ...new Array(cols.length - 1).fill('')]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(cols);

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));
  const sumMonths = (arr, limit) => (arr || []).slice(0, limit).reduce((a, b) => a + (Number(b) || 0), 0);

  const isKoiki = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('koiki');
  };
  const isSubv = (c) => {
    const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
    return hay.includes('subv') || String(c?.code || '').startsWith('7404') || String(c?.code || '').startsWith('7408');
  };
  const isIncomeGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('1.') || g.startsWith('2.') || g.startsWith('7.');
  };
  const isExpenseGroup = (c) => {
    const g = String(c?.groupLabel || '');
    return g.startsWith('6.') || g.startsWith('8.') || g.startsWith('9.') || g.startsWith('10.') || g.startsWith('11.') || g.startsWith('12.') || g.startsWith('13.') || g.startsWith('14.') || g.startsWith('15.') || g.startsWith('16.');
  };

  const koiki = (cuentasMensuales || []).filter(isKoiki);
  const subv = koiki.filter(isSubv).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
  const resto = koiki.filter((c) => !isSubv(c)).slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));

  const monthsLen = Math.min(12, months.length);

  // Fila hardcodeada: "ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO"
  const ESTIMADO_SUBV_KOIKI = new Array(12).fill(900);
  const estimadoAntesIngreso = ESTIMADO_SUBV_KOIKI;
  {
    const vals = estimadoAntesIngreso.slice(0, monthsLen);
    const total = vals.reduce((a, b) => a + (Number(b) || 0), 0);
    aoa.push(['ESTIMADO DE SUBVENCIÓN ANTES DE INGRESO', ...vals, '', '', total]);
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
    aoa.push([`${c.code} - ${c.name}`.trim(), ...monthsVals, total, '', total]);
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
  aoa.push(['TOTAL BENEFICIO POR MES KOIKI', ...totalBeneficioMes, totalBeneficioMesTotal, '', (totalBeneficioMesTotal + estimadoTotal)]);
  aoa.push(new Array(cols.length).fill(''));
  aoa.push(['TOTAL INGRESOS KOIKI SIN SUBVENCIONES', ...ingresosSinSubvMonths, ingresosSinSubvTotal, '', '']);
  aoa.push(['TOTAL DESPESES', ...despesesMonths, despesesTotal, '', '']);
  aoa.push(['BENEFICIO SIN SUBVENCIONES', ...beneficioSinSubvMonths, beneficioSinSubvTotal, '', '']);

  // ===== Tablas inferiores (totales computados) =====
  const listAll = koiki.slice().sort((a, b) => String(a.code).localeCompare(String(b.code)));
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

  const novTotal = listAll.reduce((sum, c) => sum + sumMonths(c.months, novLimit), 0);
  const decTotal = listAll.reduce((sum, c) => sum + sumMonths(c.months, decLimit), 0);
  aoa.push(new Array(cols.length).fill(''));
  {
    const row = new Array(cols.length).fill('');
    row[0] = `TOTAL  BENEFICIO KOIKI A ${endOfMonthStr(novLimit - 1)}`;
    row[1] = novTotal;
    row[3] = `TOTAL  BENEFICIO KOIKI A ${endOfMonthStr(decLimit - 1)}`;
    row[8] = decTotal;
    aoa.push(row);
  }

  return aoa;
}

function buildComparativaAnualAoa({ mensualParsed, objetivos, basesPrevYear }) {
  const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const aoa = [];
  const yearCurrent = Number(mensualParsed?.yearGuess || 2025) || 2025;
  const yy = String(yearCurrent).slice(2);
  const yearPrev = yearCurrent - 1;

  const sumArray = (arrA, arrB) => arrA.map((v, i) => (Number(v) || 0) + (Number(arrB[i]) || 0));

  const computeIngresosSinSubv = ({ contains, extraCodePred, subvCodePred }) => {
    const cuentas = mensualParsed?.cuentas || [];
    const inLine = (c) => {
      const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
      if (extraCodePred && extraCodePred(c)) return true;
      return hay.includes(String(contains).toLowerCase());
    };
    const isSubv = (c) => {
      const hay = `${c?.code || ''} ${c?.name || ''}`.toLowerCase();
      if (subvCodePred && subvCodePred(c)) return true;
      return hay.includes('subv') || String(c?.code || '').startsWith('7404') || String(c?.code || '').startsWith('7406') || String(c?.code || '').startsWith('7408');
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

  const prevBases = basesPrevYear || {};
  const cateringPrev = (Array.isArray(prevBases.CATERING) && prevBases.CATERING.length === 12)
    ? prevBases.CATERING
    : (yearPrev === 2024 ? CATERING_BASE_2024 : new Array(12).fill(0));
  const idoniPrev = (Array.isArray(prevBases.IDONI) && prevBases.IDONI.length === 12)
    ? prevBases.IDONI
    : (yearPrev === 2024 ? IDONI_BASE_2024 : new Array(12).fill(0));
  const koikiPrev = (Array.isArray(prevBases.KOIKI) && prevBases.KOIKI.length === 12)
    ? prevBases.KOIKI
    : (yearPrev === 2024 ? KOIKI_BASE_2024 : new Array(12).fill(0));

  // ===== Bases 2025 calculadas desde el CSV mensual (ingresos sin subvenciones) =====
  const catering2025 = computeIngresosSinSubv({ contains: 'catering' });
  const idoni2025 = computeIngresosSinSubv({ contains: 'idoni' });
  const koiki2025Raw = computeIngresosSinSubv({ contains: 'koiki' });

  // KOIKI: el “+ NOV/DIC” era un caso concreto del Excel 2025 (facturado en 2026).
  // Solo lo aplicamos cuando el año actual es 2025.
  const koikiCurrent = koiki2025Raw.slice();
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

  const cateringObjNormalRest = buildObjetivoRestante(cateringObjNormal, catering2025);
  const cateringObjOptimRest = buildObjetivoRestante(cateringObjOptim, catering2025);
  const idoniObjNormalRest = buildObjetivoRestante(idoniObjNormal, idoni2025);
  const idoniObjOptimRest = buildObjetivoRestante(idoniObjOptim, idoni2025);
  const koikiObjNormalRest = buildObjetivoRestante(koikiObjNormal, koikiCurrent);
  const koikiObjOptimRest = buildObjetivoRestante(koikiObjOptim, koikiCurrent);

  // ===== Construcción AOA =====
  const blank = () => [];
  aoa.push(['CATERING']);
  aoa.push([
    'MES',
    'Base 2022',
    'Base 2023',
    `BASE ${yearPrev}`,
    `DIFERENCIA 23 - ${String(yearPrev).slice(2)}`,
    `BASE ${yearCurrent}`,
    `DIFERENCIA ${String(yearPrev).slice(2)} - ${yy}`,
    `OBJECTIU ${yy} ESCENARI NORMAL`,
    `OBJECTIU ${yy} ESCENARI ÒPTIM`
  ]);
  aoa.push(['', '', '', '', '', '', '', cateringObjNormal, cateringObjOptim]); // objetivo inicial
  for (let i = 0; i < 12; i++) {
    aoa.push([
      months[i],
      CATERING_BASE_2022[i],
      CATERING_BASE_2023[i],
      cateringPrev[i],
      (cateringPrev[i] - CATERING_BASE_2023[i]),
      catering2025[i],
      (catering2025[i] - cateringPrev[i]),
      cateringObjNormalRest[i],
      cateringObjOptimRest[i]
    ]);
  }
  aoa.push(blank());
  aoa.push([
    'TOTAL ACUMULADO',
    sum(CATERING_BASE_2022),
    sum(CATERING_BASE_2023),
    sum(cateringPrev),
    sum(cateringPrev) - sum(CATERING_BASE_2023),
    sum(catering2025),
    sum(catering2025) - sum(cateringPrev),
    (sum(catering2025) - cateringObjNormal),
    (sum(catering2025) - cateringObjOptim)
  ]);

  aoa.push(blank());
  aoa.push(blank());
  aoa.push(['IDONI']);
  aoa.push([
    'MES',
    `BASE ${yearPrev}`,
    `BASE ${yearCurrent}`,
    `DIFERENCIA ${String(yearPrev).slice(2)} - ${yy}`,
    `OBJECTIU ${yy} ESCENARI NORMAL`,
    `OBJECTIU ${yy} ESCENARI ÒPTIM`
  ]);
  aoa.push(['', '', '', '', idoniObjNormal, idoniObjOptim]); // objetivo inicial
  for (let i = 0; i < 12; i++) {
    aoa.push([months[i], idoniPrev[i], idoni2025[i], (idoni2025[i] - idoniPrev[i]), idoniObjNormalRest[i], idoniObjOptimRest[i]]);
  }
  aoa.push(blank());
  aoa.push([
    'TOTAL ACUMULADO',
    sum(idoniPrev),
    sum(idoni2025),
    sum(idoni2025) - sum(idoniPrev),
    (sum(idoni2025) - idoniObjNormal),
    (sum(idoni2025) - idoniObjOptim)
  ]);

  aoa.push(blank());
  aoa.push(blank());
  aoa.push(['KOIKI']);
  aoa.push([
    'MES',
    `BASE ${yearPrev}`,
    `BASE ${yearCurrent}`,
    `BASE ${yearCurrent} + NOV/DIC`,
    `DIFERENCIA ${String(yearPrev).slice(2)} - ${yy}`,
    `OBJECTIU ${yy} ESCENARI NORMAL`,
    `OBJECTIU ${yy} ESCENARI ÒPTIM`
  ]);
  aoa.push(['', '', '', '', '', koikiObjNormal, koikiObjOptim]); // objetivo inicial
  const koikiDiff = new Array(12).fill(0);
  for (let i = 0; i < 12; i++) {
    // Regla general: diferencia = 2025 - 2024
    // Caso especial KOIKI (en el Excel de referencia): Nov/Dic 2025 se dejaron a 0 (facturado en 2026),
    // pero 2024 sí tiene base; en ese caso mostramos 2024 - 2025 para que no salga negativo.
    const bPrev = Number(koikiPrev[i]) || 0;
    const bCur = Number(koikiCurrent[i]) || 0;
    // Caso especial KOIKI 2025 (facturado en 2026): evitar negativo cuando el mes está a 0 por ese motivo
    koikiDiff[i] = (yearCurrent === 2025 && bCur === 0 && bPrev > 0) ? (bPrev - bCur) : (bCur - bPrev);
    aoa.push([
      months[i],
      koikiPrev[i],
      koikiCurrent[i],
      koikiCurrentPlusNovDic[i],
      koikiDiff[i],
      koikiObjNormalRest[i],
      koikiObjOptimRest[i]
    ]);
  }
  aoa.push(blank());
  aoa.push([
    'TOTAL ACUMULADO',
    sum(koikiPrev),
    sum(koikiCurrent),
    sum(koikiCurrentPlusNovDic),
    sum(koikiDiff),
    (sum(koikiCurrent) - koikiObjNormal),
    (sum(koikiCurrent) - koikiObjOptim)
  ]);

  return aoa;
}

function styleComparativaAnualSheet({ ws, aoa }) {
  ws['!sheetView'] = [{ showGridLines: false }];
  ws['!cols'] = [
    { wch: 18 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 22 }
  ];

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
      // Fondo suave de sección
      const fill =
        String(v0).toUpperCase() === 'CATERING'
          ? makeFill('#E2EFDA')
          : String(v0).toUpperCase() === 'IDONI'
            ? makeFill('#FCE4D6')
            : makeFill('#DDEBF7');
      setRangeStyle(ws, r, 0, r, 8, { fill, border: borderThin, font: { bold: true, name: 'Calibri' } });
      // Merge título a lo ancho
      ws['!merges'] = ws['!merges'] || [];
      ws['!merges'].push({ s: { r, c: 0 }, e: { r, c: 8 } });
      continue;
    }

    // Cabeceras (MES, BASE..., etc.)
    if (v0 && String(v0).trim().toUpperCase() === 'MES') {
      setRangeStyle(ws, r, 0, r, 8, { fill: makeFill('#E7E6E6'), border: borderThin, font: { bold: true, name: 'Calibri' }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } });
      continue;
    }

    // Total acumulado
    if (v0 && String(v0).toUpperCase().includes('TOTAL ACUMULADO')) {
      setRangeStyle(ws, r, 0, r, 8, { fill: makeFill('#F8CBAD'), border: borderThin, font: { bold: true, name: 'Calibri' } });
    }

    // Bordes/formatos por defecto en filas con datos (si hay números en B)
    const v1 = ws[XLSX.utils.encode_cell({ r, c: 1 })]?.v;
    if (v0 && (typeof v1 === 'number' || v0 === 'TOTAL ACUMULADO')) {
      setCellStyle(ws, r, 0, labelStyle);
      for (let c = 1; c <= 8; c++) {
        const cell = ws[XLSX.utils.encode_cell({ r, c })];
        if (!cell) continue;
        if (typeof cell.v === 'number') setCellStyle(ws, r, c, numStyle);
        else setCellStyle(ws, r, c, { border: borderThin, alignment: { horizontal: 'center', vertical: 'center' } });
      }
    }
  }
}

function stylePigLineaCateringSheet({ ws, aoa }) {
  ws['!sheetView'] = [{ showGridLines: false }];
  // Cuenta + 12 meses + total + separador + total subv
  ws['!cols'] = [
    { wch: 62 },
    ...new Array(12).fill({ wch: 12 }),
    { wch: 14 },
    { wch: 2 },
    { wch: 18 }
  ];
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

      // Totales finales (amarillo en valores)
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

function buildGeneralAoa({ title, months, mensualMap, annualTotalsMap, monthLimit }) {
  const lim = Math.max(1, Math.min(12, Number(monthLimit || 12)));
  const monthsLimited = months.slice(0, lim);

  const aoa = [];
  aoa.push([title, '', '']);
  aoa.push(['', '', '']);

  // Resumen (label + valor) -> si monthLimit<12, recalculamos desde mensual; si no, usamos anual.
  for (const label of SUMMARY_LABELS) {
    aoa.push([label, '', '']);
    const mensualVals = mensualMap.get(label) || new Array(12).fill(0);
    const v =
      lim >= 12
        ? (annualTotalsMap.get(label) ?? mensualVals.reduce((a, b) => a + b, 0))
        : mensualVals.slice(0, lim).reduce((a, b) => a + b, 0);
    aoa.push(['', v ?? 0, '']);
  }

  aoa.push(['', '', '']);
  aoa.push(['', '', '']);

  // Tabla mensual
  const header = ['', ...monthsLimited, 'TOTAL'];
  aoa.push(header);
  for (const label of SUMMARY_LABELS) {
    const vals = (mensualMap.get(label) || new Array(12).fill(0)).slice(0, lim);
    const total = vals.reduce((a, b) => a + b, 0);
    aoa.push([label, ...vals, total]);
  }

  return { aoa, monthsLimited, lim };
}

function styleGeneralSheet({ ws, aoa, monthsLimited }) {
  const totalCols = 1 + monthsLimited.length + 1; // label + months + total

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

  // Column widths
  ws['!cols'] = [{ wch: 58 }, ...new Array(monthsLimited.length).fill({ wch: 14 }), { wch: 14 }];

  // Row heights (aprox)
  ws['!rows'] = [];
  ws['!rows'][0] = { hpt: 18 };

  // Merge título a todo el ancho
  ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: totalCols - 1 } }];
  setRangeStyle(ws, 0, 0, 0, totalCols - 1, titleStyle);

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

  // Negritas líneas principales
  for (let i = 0; i < SUMMARY_LABELS.length; i++) {
    const labelRow = 2 + i * 2;
    const lbl = SUMMARY_LABELS[i];
    if (isMainLine(lbl) || /EXCEDENTE|RESULTADO TOTAL/.test(lbl)) {
      setCellStyle(ws, labelRow, 0, labelBold);
      setCellStyle(ws, labelRow + 1, 1, labelBold);
    }
  }

  // Tabla mensual: cabecera + bordes + numfmt
  if (mensualHeaderRow >= 0) {
    setRangeStyle(ws, mensualHeaderRow, 0, mensualHeaderRow, totalCols - 1, headerMonthlyStyle);

    for (let r = mensualHeaderRow + 1; r < aoa.length; r++) {
      setCellStyle(ws, r, 0, { border: borderThin, alignment: { vertical: 'center' } });
      const lbl = ws[XLSX.utils.encode_cell({ r, c: 0 })]?.v;
      if (lbl && (isMainLine(String(lbl)) || /EXCEDENTE|RESULTADO TOTAL/.test(String(lbl)))) {
        setCellStyle(ws, r, 0, labelBold);
      }
      for (let c = 1; c < totalCols; c++) setCellStyle(ws, r, c, { border: borderThin, ...moneyStyle });
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
  const [anualFile, setAnualFile] = useState(null);
  const [mensualFile, setMensualFile] = useState(null);
  const [error, setError] = useState('');
  const [objetivosComparativa, setObjetivosComparativa] = useState({
    cateringNormal: '525849,55',
    cateringOptim: '575849,55',
    idoniNormal: '140000',
    idoniOptim: '150000',
    koikiNormal: '20207',
    koikiOptim: '23881'
  });

  const canGenerate = useMemo(() => Boolean(anualFile && mensualFile), [anualFile, mensualFile]);

  const generateExcel = useCallback(async () => {
    try {
      setError('');
      if (!anualFile || !mensualFile) {
        setError('Sube los 2 archivos del PIG: anual y mensual (CSV o Excel).');
        return;
      }

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

      const getLastNonZeroMonthIndex = () => {
        let last = -1;
        // mirar cuentas (más “real” que map)
        for (const c of (mensualParsed.cuentas || [])) {
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

      const monthLabelUpper = (idx) => {
        const src = (monthNames.length ? monthNames : [
          'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
        ])[idx] || '';
        return String(src || '').toUpperCase();
      };

      // Construcción de hoja
      // IMPORTANTE: aunque Holded venga con 3/4 meses, las hojas PIG LINEA y GENERAL
      // deben mantener SIEMPRE 12 columnas de meses para que no se desplace TOTAL/TOTAL ESTIMADO.
      const defaultMonths = [
        'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
      ];
      const months = new Array(12).fill(null).map((_, idx) => {
        const fromCsv = monthNames[idx];
        return fromCsv && String(fromCsv).trim() ? String(fromCsv).trim() : defaultMonths[idx];
      });

      const yy = yearGuess ? yearGuess.slice(2) : '';
      const titleFull = `Cierre PIG GENERAL  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
      const titlePrev = `PIG GENERAL EISSS A ${monthLabelUpper(prevIdx)} ${yy ? `01/01/${yy} A ${endOfMonthStr(prevIdx)}` : ''}`.trim();
      const sheetNamePrev = (`PIG GENERAL EISSS A ${monthLabelUpper(prevIdx)}`.trim()).slice(0, 31);

      const { aoa: aoaFull, monthsLimited: monthsFull } = buildGeneralAoa({
        title: titleFull,
        months,
        mensualMap: mensual,
        annualTotalsMap: anual,
        monthLimit: monthLimitFull
      });
      const ws = XLSX.utils.aoa_to_sheet(aoaFull);
      styleGeneralSheet({ ws, aoa: aoaFull, monthsLimited: monthsFull });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PIG GENERAL EISSS');

      // Hoja hasta Noviembre (enero–noviembre)
      const { aoa: aoaNov, monthsLimited: monthsNov } = buildGeneralAoa({
        title: titlePrev,
        months,
        mensualMap: mensual,
        annualTotalsMap: anual,
        monthLimit: monthLimitPrev
      });
      const wsNov = XLSX.utils.aoa_to_sheet(aoaNov);
      styleGeneralSheet({ ws: wsNov, aoa: aoaNov, monthsLimited: monthsNov });
      XLSX.utils.book_append_sheet(wb, wsNov, sheetNamePrev);

      // Nota: Las hojas auxiliares "PIG CUENTAS ANUAL" y "PIG CUENTAS MENSUAL" eran solo para debug.
      // Las quitamos para que el Excel generado coincida con el original.

      // ===== DESPESES MP-APROV-PRFIRPF (Grupo 6) =====
      try {
        const cuentasG6 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('6.'));
        const g6Total =
          anual.get('6. Aprovisionamientos') ??
          anual.get('Aprovisionamientos') ??
          cuentasG6.reduce((sum, c) => sum + (Number(c.total) || 0), 0);

        const titleG6 = `GASTOS MP/APROVIZONAMENT/PROF.IRPF EI SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();
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
      } catch (e) {
        console.error('Error generando hoja DESPESES MP-APROV-PRFIRPF:', e);
      }

      // ===== Grupo 8: Gastos de personal =====
      try {
        const cuentasG8 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('8.'));
        const groupLabel = '8. Gastos de personal';
        const groupTotal = anual.get(groupLabel) ?? cuentasG8.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
        const secA = 'a) Sueldos,salarios y asimilados';
        const secB = 'b) Cargas sociales';
        const aoa8 = buildGroupAccountsAoa({
          title: `SUELDOS Y SALARIOS GENERA EI SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim(),
          groupLabel,
          groupTotal,
          sections: [
            { label: secA, total: anual.get(secA) ?? 0 },
            { label: secB, total: anual.get(secB) ?? 0 }
          ],
          cuentas: cuentasG8
        });
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
        XLSX.utils.book_append_sheet(wb, ws8, 'SUELDOS Y SALARIOS GENERAL');
      } catch (e) {
        console.error('Error generando hoja GRUPO 8 - PERSONAL:', e);
      }

      // ===== Grupo 9: Otros gastos de la actividad =====
      try {
        const cuentasG9 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('9.'));
        const groupLabel = '9. Otros gastos de la actividad';
        const groupTotal = anual.get(groupLabel) ?? cuentasG9.reduce((sum, c) => sum + (Number(c.total) || 0), 0);
        const secA = 'a) Sevicios exteriores';
        const secB = 'b) Tributos';
        const aoa9 = buildGroupAccountsAoa({
          title: `CONCEPTE OTROS GASTOS ${yearGuess ? `01/01/${yearGuess} al ${endOfMonthStr(lastIdx)}` : ''}`.trim(),
          groupLabel,
          groupTotal,
          sections: [
            { label: secA, total: anual.get(secA) ?? 0 },
            { label: secB, total: anual.get(secB) ?? 0 }
          ],
          cuentas: cuentasG9
        });
        const ws9 = XLSX.utils.aoa_to_sheet(aoa9);
        styleGroupAccountsSheet({ ws: ws9, aoa: aoa9, yellowRows: [] });
        XLSX.utils.book_append_sheet(wb, ws9, 'OTROS GASTOS');
      } catch (e) {
        console.error('Error generando hoja GRUPO 9 - OTROS GASTOS:', e);
      }

      // ===== PIG LINEA CATERING (multi-columna) =====
      try {
        const yy = yearGuess ? yearGuess.slice(2) : '';
        const monthsCatering = (monthNames.length === 12 ? monthNames : months).map((m) => {
          const base = String(m || '').trim();
          if (!yy) return base;
          // Si ya incluye el año (ej: "Gener 25"), no añadirlo otra vez
          if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
          return `${base} ${yy}`.trim();
        });
        const titleCatering = `Cierre PIG LINEA CATERING  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();

        const aoaCat = buildPigLineaCateringAoa({
          title: titleCatering,
          months: monthsCatering,
          cuentasMensuales: mensualParsed.cuentas || [],
          mensualMap: mensual
        });
        const wsCat = XLSX.utils.aoa_to_sheet(aoaCat);
        stylePigLineaCateringSheet({ ws: wsCat, aoa: aoaCat });
        XLSX.utils.book_append_sheet(wb, wsCat, 'PIG LINEA CATERING');
      } catch (e) {
        console.error('Error generando hoja PIG LINEA CATERING:', e);
      }

      // ===== PIG LINEA IDONI (multi-columna) =====
      try {
        const yy = yearGuess ? yearGuess.slice(2) : '';
        const monthsIdoni = (monthNames.length === 12 ? monthNames : months).map((m) => {
          const base = String(m || '').trim();
          if (!yy) return base;
          if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
          return `${base} ${yy}`.trim();
        });
        const titleIdoni = `Cierre PIG LINEA IDONI  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();

        const aoaIdoni = buildPigLineaIdoniAoa({
          title: titleIdoni,
          months: monthsIdoni,
          cuentasMensuales: mensualParsed.cuentas || [],
          mensualMap: mensual
        });
        const wsIdoni = XLSX.utils.aoa_to_sheet(aoaIdoni);
        stylePigLineaCateringSheet({ ws: wsIdoni, aoa: aoaIdoni });
        XLSX.utils.book_append_sheet(wb, wsIdoni, 'PIG LINEA IDONI');
      } catch (e) {
        console.error('Error generando hoja PIG LINEA IDONI:', e);
      }

      // ===== PIG LINEA KOIKI (multi-columna) =====
      try {
        const yy = yearGuess ? yearGuess.slice(2) : '';
        const monthsKoiki = (monthNames.length === 12 ? monthNames : months).map((m) => {
          const base = String(m || '').trim();
          if (!yy) return base;
          if (new RegExp(`\\b${yy}\\b`).test(base)) return base;
          return `${base} ${yy}`.trim();
        });
        const titleKoiki = `Cierre PIG LINEA KOIKI  EI.SSS ${yy ? `01/01/${yy} A ${endOfMonthStr(lastIdx)}` : ''}`.trim();

        const aoaKoiki = buildPigLineaKoikiAoa({
          title: titleKoiki,
          months: monthsKoiki,
          cuentasMensuales: mensualParsed.cuentas || [],
          mensualMap: mensual
        });
        const wsKoiki = XLSX.utils.aoa_to_sheet(aoaKoiki);
        stylePigLineaCateringSheet({ ws: wsKoiki, aoa: aoaKoiki });
        XLSX.utils.book_append_sheet(wb, wsKoiki, 'PIG LINEA KOIKI');
      } catch (e) {
        console.error('Error generando hoja PIG LINEA KOIKI:', e);
      }

      // ===== COMPARATIVA ANUAL =====
      try {
        const objetivos = {
          catering: { normal: parseEuroNumber(objetivosComparativa.cateringNormal), optim: parseEuroNumber(objetivosComparativa.cateringOptim) },
          idoni: { normal: parseEuroNumber(objetivosComparativa.idoniNormal), optim: parseEuroNumber(objetivosComparativa.idoniOptim) },
          koiki: { normal: parseEuroNumber(objetivosComparativa.koikiNormal), optim: parseEuroNumber(objetivosComparativa.koikiOptim) }
        };
        const yearCurrent = Number(mensualParsed.yearGuess || 0) || 0;
        const yearPrev = yearCurrent ? yearCurrent - 1 : 0;
        const [cPrev, iPrev, kPrev] = await Promise.all([
          yearPrev ? loadPigBaseMensual({ linea: 'CATERING', year: yearPrev }) : Promise.resolve({ months: null, error: null }),
          yearPrev ? loadPigBaseMensual({ linea: 'IDONI', year: yearPrev }) : Promise.resolve({ months: null, error: null }),
          yearPrev ? loadPigBaseMensual({ linea: 'KOIKI', year: yearPrev }) : Promise.resolve({ months: null, error: null })
        ]);
        const basesPrevYear = {
          CATERING: cPrev.months,
          IDONI: iPrev.months,
          KOIKI: kPrev.months
        };

        const aoaComp = buildComparativaAnualAoa({ mensualParsed, objetivos, basesPrevYear });
        const wsComp = XLSX.utils.aoa_to_sheet(aoaComp);
        styleComparativaAnualSheet({ ws: wsComp, aoa: aoaComp });
        XLSX.utils.book_append_sheet(wb, wsComp, 'COMPARATIVA ANUAL');
      } catch (e) {
        console.error('Error generando hoja COMPARATIVA ANUAL:', e);
      }
      XLSX.writeFile(wb, `PIG_GENERAL_EISSS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Error generando el Excel.');
    }
  }, [anualFile, mensualFile, objetivosComparativa]);

  return (
    <div style={{ padding: 24, background: colors.background, minHeight: '100vh', color: colors.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
        <FileText size={28} color={colors.primary} />
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>PIG</h1>
      </div>

      <div style={{ color: colors.textSecondary, marginBottom: 16, maxWidth: 900 }}>
        Sube los 2 CSV exportados desde Holded (<b>Pèrdues i guanys</b> anual y <b>Pèrdues i guanys mensual</b>) y KRONOS generará un Excel
        con la hoja <b>PIG GENERAL EISSS</b>.
      </div>

      {error ? (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: `1px solid ${colors.error}`, background: colors.error + '18', display: 'flex', gap: 10, alignItems: 'center' }}>
          <AlertCircle size={18} color={colors.error} />
          <div>{error}</div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
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

        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 10 }}>Objetivos (COMPARATIVA ANUAL)</div>
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
                  placeholder="Ej: 525849,55"
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
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={generateExcel}
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
        </div>
      </div>
    </div>
  );
}

