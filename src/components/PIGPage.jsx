import React, { useCallback, useMemo, useState } from 'react';
import { Upload, Download, FileText, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { useTheme } from './ThemeContext';

function parseEuroNumber(input) {
  if (input === null || input === undefined) return 0;
  const s0 = String(input).replace(/\u00a0/g, ' ').trim(); // NBSP → space
  if (!s0) return 0;
  // Holded a veces usa "-   €"
  if (/^-\s*€?$/.test(s0) || s0.includes('-   €') || s0 === '-') return 0;

  const negative = s0.startsWith('-');
  const cleaned = s0
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
}

function isLikelyLabelCell(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  // Ej: "1. Ingresos..." "A.1) ..." "Venta y otros..."
  return /[a-zA-ZÀ-ÿ]/.test(t);
}

function splitSemicolonCsv(text) {
  // Los CSV de Holded aquí son simples (sin comillas con ; dentro)
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.split(';').map((c) => c.trim()));
}

function parseHoldedAnual(csvText) {
  const rows = splitSemicolonCsv(csvText);
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
  const rows = splitSemicolonCsv(csvText);
  const headerRow = rows.find((r) => r && r.length >= 13 && String(r[0] || '').trim() === '' && /Gener/i.test(r[1] || ''));
  const monthNames = headerRow ? headerRow.slice(1, 13).map((m) => String(m || '').trim()).filter(Boolean) : [];

  const map = new Map(); // label -> number[12]
  const cuentas = []; // { code, name, months:number[12], groupLabel, subLabel, order }
  let currentGroupLabel = null;
  let currentSubLabel = null;
  let order = 0;
  for (const row of rows) {
    if (!row || row.length < 13) continue;
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
      cuentas.push({
        code: m?.[1] || label.split(/\s+/)[0],
        name: (m?.[2] || '').trim(),
        months: row.slice(1, 13).map(parseEuroNumber),
        groupLabel: currentGroupLabel,
        subLabel: currentSubLabel,
        order: order++
      });
      continue;
    } // cuentas
    const vals = row.slice(1, 13).map(parseEuroNumber);
    map.set(label, vals);
  }
  return { map, monthNames, cuentas };
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

  const canGenerate = useMemo(() => Boolean(anualFile && mensualFile), [anualFile, mensualFile]);

  const generateExcel = useCallback(async () => {
    try {
      setError('');
      if (!anualFile || !mensualFile) {
        setError('Sube los 2 CSV: PIG anual y PIG mensual.');
        return;
      }

      const [anualText, mensualText] = await Promise.all([anualFile.text(), mensualFile.text()]);
      const anualParsed = parseHoldedAnual(anualText);
      const mensualParsed = parseHoldedMensual(mensualText);
      const anual = anualParsed.map;
      const mensual = mensualParsed.map;
      const monthNames = mensualParsed.monthNames;

      // Construcción de hoja
      const months = monthNames.length === 12 ? monthNames : [
        'Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'
      ];
      const yearGuess = (() => {
        const m = mensualText.match(/01\/01\/(\d{4})/);
        return m ? m[1] : '';
      })();

      const titleFull = `Cierre PIG GENERAL  EI.SSS ${yearGuess ? `01/01/${yearGuess.slice(2)} A 31/12/${yearGuess.slice(2)}` : ''}`.trim();
      const titleNov = `PIG GENERAL EISSS A NOVIEMBRE ${yearGuess ? `01/01/${yearGuess.slice(2)} A 30/11/${yearGuess.slice(2)}` : ''}`.trim();

      const { aoa: aoaFull, monthsLimited: monthsFull } = buildGeneralAoa({
        title: titleFull,
        months,
        mensualMap: mensual,
        annualTotalsMap: anual,
        monthLimit: 12
      });
      const ws = XLSX.utils.aoa_to_sheet(aoaFull);
      styleGeneralSheet({ ws, aoa: aoaFull, monthsLimited: monthsFull });

      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'PIG GENERAL EISSS');

      // Hoja hasta Noviembre (enero–noviembre)
      const { aoa: aoaNov, monthsLimited: monthsNov } = buildGeneralAoa({
        title: titleNov,
        months,
        mensualMap: mensual,
        annualTotalsMap: anual,
        monthLimit: 11
      });
      const wsNov = XLSX.utils.aoa_to_sheet(aoaNov);
      styleGeneralSheet({ ws: wsNov, aoa: aoaNov, monthsLimited: monthsNov });
      XLSX.utils.book_append_sheet(wb, wsNov, 'PIG GENERAL EISSS A NOVIEMBRE');

      // ===== Hojas auxiliares (CUENTAS) para siguientes informes =====
      if (Array.isArray(anualParsed.cuentas) && anualParsed.cuentas.length > 0) {
        const aoaC = [['Cuenta', 'Nombre', 'Total']];
        for (const c of anualParsed.cuentas) aoaC.push([c.code, c.name, c.total]);
        const wsC = XLSX.utils.aoa_to_sheet(aoaC);
        wsC['!cols'] = [{ wch: 14 }, { wch: 70 }, { wch: 16 }];
        wsC['!sheetView'] = [{ showGridLines: false }];
        // estilos básicos
        setRangeStyle(wsC, 0, 0, 0, 2, {
          font: { bold: true, name: 'Calibri' },
          fill: makeFill('#E7E6E6'),
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          },
          alignment: { horizontal: 'center' }
        });
        for (let r = 1; r < aoaC.length; r++) {
          setCellStyle(wsC, r, 2, { numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
        }
        XLSX.utils.book_append_sheet(wb, wsC, 'PIG CUENTAS ANUAL');
      }

      if (Array.isArray(mensualParsed.cuentas) && mensualParsed.cuentas.length > 0) {
        const months2 = monthNames.length === 12 ? monthNames : months;
        const aoaM = [['Cuenta', 'Nombre', ...months2, 'TOTAL']];
        for (const c of mensualParsed.cuentas) {
          const total = (c.months || []).reduce((a, b) => a + b, 0);
          aoaM.push([c.code, c.name, ...(c.months || new Array(12).fill(0)), total]);
        }
        const wsM = XLSX.utils.aoa_to_sheet(aoaM);
        wsM['!cols'] = [{ wch: 14 }, { wch: 60 }, ...new Array(12).fill({ wch: 14 }), { wch: 14 }];
        wsM['!sheetView'] = [{ showGridLines: false }];
        setRangeStyle(wsM, 0, 0, 0, 14, {
          font: { bold: true, name: 'Calibri' },
          fill: makeFill('#E7E6E6'),
          border: {
            top: { style: 'thin', color: { rgb: '000000' } },
            bottom: { style: 'thin', color: { rgb: '000000' } },
            left: { style: 'thin', color: { rgb: '000000' } },
            right: { style: 'thin', color: { rgb: '000000' } }
          },
          alignment: { horizontal: 'center', wrapText: true }
        });
        for (let r = 1; r < aoaM.length; r++) {
          for (let c = 2; c <= 14; c++) setCellStyle(wsM, r, c, { numFmt: '#,##0.00;[Red]-#,##0.00', alignment: { horizontal: 'right' } });
        }
        XLSX.utils.book_append_sheet(wb, wsM, 'PIG CUENTAS MENSUAL');
      }

      // ===== DESPESES MP-APROV-PRFIRPF (Grupo 6) =====
      try {
        const cuentasG6 = (anualParsed.cuentas || []).filter((c) => String(c.groupLabel || '').startsWith('6.'));
        const g6Total =
          anual.get('6. Aprovisionamientos') ??
          anual.get('Aprovisionamientos') ??
          cuentasG6.reduce((sum, c) => sum + (Number(c.total) || 0), 0);

        const titleG6 = `GASTOS MP/APROVIZONAMENT/PROF.IRPF EI SSS ${yearGuess ? `01/01/${yearGuess.slice(2)} A 31/12/${yearGuess.slice(2)}` : ''}`.trim();
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
          title: `SUELDOS Y SALARIOS GENERA EI SSS ${yearGuess ? `01/01/${yearGuess.slice(2)} A 31/12/${yearGuess.slice(2)}` : ''}`.trim(),
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
          title: `CONCEPTE OTROS GASTOS ${yearGuess ? `01/01/${yearGuess} al 31/12/${yearGuess}` : ''}`.trim(),
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
      XLSX.writeFile(wb, `PIG_GENERAL_EISSS_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Error generando el Excel.');
    }
  }, [anualFile, mensualFile]);

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
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>1) CSV anual (Pèrdues i guanys)</div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, fontWeight: 900 }}>
            <Upload size={18} />
            {anualFile ? anualFile.name : 'Seleccionar archivo'}
            <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => setAnualFile(e.target.files?.[0] || null)} />
          </label>
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>2) CSV mensual (Pèrdues i guanys Mensual)</div>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, fontWeight: 900 }}>
            <Upload size={18} />
            {mensualFile ? mensualFile.name : 'Seleccionar archivo'}
            <input type="file" accept=".csv,text/csv" style={{ display: 'none' }} onChange={(e) => setMensualFile(e.target.files?.[0] || null)} />
          </label>
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

