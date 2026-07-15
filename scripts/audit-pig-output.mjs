import XLSX from 'xlsx';
import fs from 'fs';

const FILE = process.argv[2] || 'C:/Users/brian/Downloads/PIG_EISSS_2026-07-15_JUNIO.xlsx';

function sheetToRows(name, wb) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
}

function findRow(rows, pred, col = 0) {
  for (let r = 0; r < rows.length; r++) {
    const v = String(rows[r][col] ?? '').trim();
    if (pred(v, rows[r], r)) return { r, row: rows[r] };
  }
  return null;
}

function num(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const s = String(v ?? '').trim().replace(/\./g, '').replace(',', '.');
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

function fmt(n) {
  return Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function approx(a, b, tol = 0.02) {
  return Math.abs(Number(a) - Number(b)) <= tol;
}

const wb = XLSX.readFile(FILE);
const issues = [];
const ok = [];

function check(label, cond, detail = '') {
  if (cond) ok.push({ label, detail });
  else issues.push({ label, detail });
}

// === PIG GENERAL EISSS ===
const gen = sheetToRows('PIG GENERAL EISSS', wb);
if (gen) {
  const g9 = findRow(gen, (v) => v === '9. Otros gastos de la actividad');
  const g9a = findRow(gen, (v) => v === 'a) Sevicios exteriores');
  const g9b = findRow(gen, (v) => v === 'b) Tributos');
  const g9d = findRow(gen, (v) => v === 'd) Otros gastos de gestión corriente');
  const g11 = findRow(gen, (v) => v.startsWith('11. Subvenciones'));
  const g6 = findRow(gen, (v) => v === '6. Aprovisionamientos');

  const sumG9children = (g9a ? num(g9a.row[1]) : 0) + (g9b ? num(g9b.row[1]) : 0) + (g9d ? num(g9d.row[1]) : 0);
  const g9val = g9 ? num(g9.row[1]) : null;
  check('PIG GENERAL: grupo 9 = a+b+d (resumen)', g9 && approx(g9val, sumG9children), `9=${fmt(g9val)} vs suma=${fmt(sumG9children)}`);

  check('PIG GENERAL: grupo 11 presente', Boolean(g11), g11 ? `valor resumen B=${fmt(num(g11.row[1]))}` : 'no encontrado');
  if (g11) {
    check('PIG GENERAL: grupo 11 = 0 a junio (julio pendiente)', approx(num(g11.row[1]), 0), `valor=${fmt(num(g11.row[1]))}`);
  }

  check('PIG GENERAL: cuenta 6 en minitabla (col alta)', Boolean(g6), '');

  // minitabla: buscar filas en columnas 14+ (aprox)
  const mini6 = findRow(gen, (v) => v === '6. Aprovisionamientos', 14) || findRow(gen, (v) => v === '6. Aprovisionamientos', 15);
  check('PIG GENERAL: minitabla incluye 6. Aprovisionamientos', Boolean(mini6), mini6 ? `valor=${fmt(num(mini6.row[15] || mini6.row[16]))}` : '');

  const miniTotal = findRow(gen, (v) => v === 'TOTAL RESULTADO SIN SUBV.', 14) || findRow(gen, (v) => v === 'TOTAL RESULTADO SIN SUBV.', 15);
  if (miniTotal) {
    const miniVal = num(miniTotal.row[15] || miniTotal.row[16]);
    ok.push({ label: 'PIG GENERAL: TOTAL RESULTADO SIN SUBV. (minitabla)', detail: fmt(miniVal) });
  }

  // tabla mensual total grupo 9
  if (g9) {
    const g9monthTotal = num(g9.row[g9.row.length - 1]);
    ok.push({ label: 'PIG GENERAL: total mensual grupo 9 (col TOTAL)', detail: fmt(g9monthTotal) });
  }
}

// === PIG LINEA KOIKI ===
const koiki = sheetToRows('PIG LINEA KOIKI', wb);
if (koiki) {
  const est = findRow(koiki, (v) => /ESTIMADO DE SUBVENCI/i.test(v));
  if (est) {
    // cols: 0=cuenta, 1=ene, 2=feb, 3=mar, 4=abr, 5=may, 6=jun
    const mar = num(est.row[3]);
    const abr = num(est.row[4]);
    const may = num(est.row[5]);
    check('KOIKI: estimado març', approx(mar, 900.57), `=${fmt(mar)}`);
    check('KOIKI: estimado abril', approx(abr, 786), `=${fmt(abr)}`);
    check('KOIKI: estimado maig', approx(may, 1001.53), `=${fmt(may)}`);
    const estTotal = num(est.row[est.row.length - 1]);
    ok.push({ label: 'KOIKI: total estimado subv (col amarilla)', detail: fmt(estTotal) });
  } else {
    issues.push({ label: 'KOIKI: fila estimado subvención', detail: 'no encontrada' });
  }

  const obs = findRow(koiki, (v) => v === 'OBSERVACIONES', 17);
  check('KOIKI: observaciones columna lateral', Boolean(obs), '');

  const seur = findRow(koiki, (v) => /70030003|KOIKI.*SEUR/i.test(v));
  if (seur) {
    check('KOIKI: SEUR feb override', approx(num(seur.row[2]), 2017.11), `feb=${fmt(num(seur.row[2]))}`);
    check('KOIKI: SEUR mar override', approx(num(seur.row[3]), 1236.51), `mar=${fmt(num(seur.row[3]))}`);
  }
}

// === COMPARATIVA KOIKI objetivos ===
const comp = sheetToRows('COMPARATIVA ANUAL', wb);
if (comp) {
  const koikiSec = findRow(comp, (v) => v === 'KOIKI');
  if (koikiSec) {
    const objRow = comp.rows?.[koikiSec.r + 2];
    const r = koikiSec.r + 2;
    const row = comp[r];
    // find OBJECTIU columns in header row koikiSec.r+1
    const hdr = comp[koikiSec.r + 1] || [];
    const normIdx = hdr.findIndex((c) => /OBJECTIU.*NORMAL/i.test(String(c)));
    const optIdx = hdr.findIndex((c) => /OBJECTIU.*ÒPTIM|OPTIM/i.test(String(c)));
    const objRow2 = comp[koikiSec.r + 2] || [];
    if (normIdx >= 0) {
      check('COMPARATIVA KOIKI: objetivo normal en columna correcta', approx(num(objRow2[normIdx]), 20207), `col ${normIdx}=${num(objRow2[normIdx])}`);
    }
    if (optIdx >= 0) {
      check('COMPARATIVA KOIKI: objetivo òptim en columna correcta', approx(num(objRow2[optIdx]), 23881), `col ${optIdx}=${num(objRow2[optIdx])}`);
    }
  }
}

// === ESTRUCTURA ===
const estAll = sheetToRows('PIG LINEA ESTRUCTURA', wb);
const est740 = sheetToRows('PIG ESTRUCTURA SUBV 740', wb);
if (est740) {
  const c1 = findRow(est740, (v) => v.startsWith('74011003'));
  const c2 = findRow(est740, (v) => v.startsWith('74080004'));
  check('ESTRUCTURA SUBV 740: solo 74011003 y 74080004', Boolean(c1) && Boolean(c2), `${c1 ? '74011003 OK' : 'falta 74011003'} | ${c2 ? '74080004 OK' : 'falta 74080004'}`);
  const cuentaRows = est740.filter((row) => /^\d{3,}/.test(String(row[0])));
  check('ESTRUCTURA SUBV 740: número de cuentas', cuentaRows.length <= 3, `filas cuenta=${cuentaRows.length}`);
}

// === OTROS GASTOS hoja ===
const og = sheetToRows('OTROS GASTOS', wb);
if (og) {
  const d = findRow(og, (v) => v === 'd) Otros gastos de gestión corriente');
  const acc678 = findRow(og, (v) => v.startsWith('67800000'));
  check('OTROS GASTOS: incluye d) gestión corriente', Boolean(d), d ? fmt(num(d.row[1])) : '');
  check('OTROS GASTOS: cuenta 67800000', Boolean(acc678), acc678 ? fmt(num(acc678.row[1])) : '');
}

console.log('=== AUDITORÍA PIG_EISSS_2026-07-15_JUNIO ===\n');
console.log('OK (' + ok.length + '):');
for (const o of ok) console.log('  ✓', o.label + (o.detail ? ': ' + o.detail : ''));

console.log('\nISSUES (' + issues.length + '):');
for (const i of issues) console.log('  ✗', i.label + (i.detail ? ': ' + i.detail : ''));

if (!issues.length) console.log('\n>>> Sin incidencias detectadas en checks automáticos.');
