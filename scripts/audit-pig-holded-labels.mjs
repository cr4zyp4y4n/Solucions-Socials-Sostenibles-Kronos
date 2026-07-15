import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

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
  'A.1) EXCEDENTE DE LA ACTIVIDAD',
  '15. Gastos financieros',
  'b) Por deudas con terceros',
  'A.2) EXCEDENTE DE LAS OPERACIONES FINANCIERAS',
  'A.3) EXCEDENTE ANTES DE IMPUESTOS',
  'A.4) Variación de patrimonio neto reconocida en el excedente del ejercicio',
  'B.1) Variación de patrimonio neto por ingresos y gastos reconocidos en el patrimonio neto',
  'C.1) Variación de patrimonio neto por reclasificaciones al excedente del ejercicio',
  'D) Variaciones de patrimonio neto por ingresos y gastos imputados directamente al patrimonio neto',
  'I) RESULTADO TOTAL, VARIACIÓN DEL PATRIMONIO NETO EN EL EJERCICIO (A.4+D+E+F+G+H)'
];

const GROUP_CHILDREN = {
  '2. Venta y otros ingresos de la actividad mercantil': ['Venta y otros ingresos de la actividad mercantil'],
  '6. Aprovisionamientos': ['Aprovisionamientos'],
  '7. Otros ingresos de la actividad': ['Otros ingresos de la actividad'],
  '8. Gastos de personal': ['a) Sueldos,salarios y asimilados', 'b) Cargas sociales'],
  '9. Otros gastos de la actividad': [
    'a) Sevicios exteriores',
    'b) Tributos',
    'd) Otros gastos de gestión corriente'
  ],
  '15. Gastos financieros': ['b) Por deudas con terceros']
};

function norm(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ');
}

function parseHoldedXlsx(filePath) {
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  const lines = [];
  const cuentas = [];
  let currentGroup = null;
  let currentSub = null;

  for (const row of rows) {
    const label = String(row[0] ?? '').trim();
    if (!label || !/[a-zA-ZÀ-ÿ]/.test(label)) continue;

    if (/^\d+\.\s+/.test(label)) {
      currentGroup = label;
      currentSub = null;
      lines.push({ type: 'group', label, group: label });
      continue;
    }

    if (/^[a-z]\)\s+/i.test(label) && !/^d\)\s+Subv/i.test(label)) {
      currentSub = label;
      lines.push({ type: 'sub', label, group: currentGroup, sub: label });
      continue;
    }

    if (/^[A-Z]\.\d\)|^[A-Z]\)|^I\)/.test(label) || /^d\)\s+Subv/i.test(label)) {
      lines.push({ type: 'result', label, group: currentGroup });
      continue;
    }

    if (/^\d{3,}/.test(label)) {
      const m = label.match(/^(\d{3,})\s*-\s*(.*)$/);
      cuentas.push({
        code: m?.[1] || label.split(/\s+/)[0],
        name: (m?.[2] || '').trim(),
        label,
        group: currentGroup,
        sub: currentSub
      });
      continue;
    }

    if (label.length > 3) {
      lines.push({ type: 'other', label, group: currentGroup });
    }
  }

  return { lines, cuentas };
}

function findDownloadsFiles() {
  const dir = 'C:/Users/brian/Downloads';
  return fs.readdirSync(dir)
    .filter((f) => /NUEVO.*P.rdues.*2026\.xlsx$/i.test(f))
    .map((f) => path.join(dir, f));
}

const files = findDownloadsFiles();
const anualFile = files.find((f) => /ANUAL/i.test(f));
const mensualFile = files.find((f) => /MENSUAL/i.test(f));

if (!anualFile || !mensualFile) {
  console.error('No se encontraron los xlsx en Downloads:', files);
  process.exit(1);
}

const anual = parseHoldedXlsx(anualFile);
const mensual = parseHoldedXlsx(mensualFile);

const summarySet = new Set(SUMMARY_LABELS.map(norm));
const inSummary = (label) => summarySet.has(norm(label));

const holdedLines = anual.lines;
const holdedSubs = holdedLines.filter((l) => l.type === 'sub');
const holdedGroups = holdedLines.filter((l) => l.type === 'group');
const holdedResults = holdedLines.filter((l) => l.type === 'result');
const holdedOther = holdedLines.filter((l) => l.type === 'other');

console.log('=== GRUPOS NUMERADOS EN HOLDED (anual) ===');
for (const g of holdedGroups) console.log(' ', g.label);

console.log('\n=== SUBAPARTADOS (a,b,c,d...) EN HOLDED NO EN SUMMARY_LABELS ===');
const missingSubs = holdedSubs.filter((s) => !inSummary(s.label));
for (const s of missingSubs) {
  const cuentas = anual.cuentas.filter((c) => norm(c.sub) === norm(s.label));
  const totalHint = cuentas.length ? ` (${cuentas.length} cuenta(s))` : '';
  console.log(`  [${s.group}] ${s.label}${totalHint}`);
}

console.log('\n=== OTRAS LÍNEAS DE TEXTO EN HOLDED NO EN SUMMARY_LABELS ===');
for (const o of holdedOther.filter((x) => !inSummary(x.label))) {
  console.log(`  [${o.group || '-'}] ${o.label}`);
}

console.log('\n=== RESULTADOS / EXCEDENTES EN HOLDED NO EN SUMMARY_LABELS ===');
for (const r of holdedResults.filter((x) => !inSummary(x.label))) {
  console.log(' ', r.label);
}

console.log('\n=== HIJOS DEFINIDOS EN CÓDIGO vs SUBS REALES DEL GRUPO 9 ===');
const g9SubsHolded = holdedSubs.filter((s) => String(s.group || '').startsWith('9.')).map((s) => s.label);
const g9ChildrenCode = GROUP_CHILDREN['9. Otros gastos de la actividad'];
console.log('Holded:', g9SubsHolded.join(' | '));
console.log('Código:', g9ChildrenCode.join(' | '));
const g9Missing = g9SubsHolded.filter((l) => !g9ChildrenCode.some((c) => norm(c) === norm(l)));
const g9Extra = g9ChildrenCode.filter((l) => !g9SubsHolded.some((c) => norm(c) === norm(l)));
if (g9Missing.length) console.log('Faltan en código:', g9Missing);
if (g9Extra.length) console.log('Sobra en código (no en Holded):', g9Extra);

for (const [group, children] of Object.entries(GROUP_CHILDREN)) {
  const subsInHolded = holdedSubs.filter((s) => norm(s.group) === norm(group)).map((s) => s.label);
  const missing = subsInHolded.filter((l) => !children.some((c) => norm(c) === norm(l)));
  if (missing.length) {
    console.log(`\nGrupo ${group}: subs en Holded no sumadas en código:`, missing);
  }
}

console.log('\n=== CUENTAS CONTABLES (no van al PIG GENERAL, pero sí a hojas detalle) ===');
console.log('Total cuentas anual:', anual.cuentas.length);
console.log('Total cuentas mensual:', mensual.cuentas.length);

const mensualLabels = new Set(mensual.lines.map((l) => norm(l.label)));
const anualOnlyLines = anual.lines.filter((l) => l.type !== 'group' && !mensualLabels.has(norm(l.label)));
if (anualOnlyLines.length) {
  console.log('\nLíneas en ANUAL que no aparecen igual en MENSUAL:');
  for (const l of anualOnlyLines.slice(0, 20)) console.log(' ', l.type, l.label);
}

console.log('\n=== EN SUMMARY_LABELS PERO NO EN HOLDED (posible nombre distinto) ===');
const holdedAllLabels = new Set([
  ...anual.lines.map((l) => norm(l.label)),
  ...mensual.lines.map((l) => norm(l.label))
]);
for (const s of SUMMARY_LABELS) {
  if (!holdedAllLabels.has(norm(s))) console.log(' ', s);
}
