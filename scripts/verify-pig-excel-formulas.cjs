/** Smoke test autónomo (CJS) del contrato de fórmulas CR. */
const XLSX = require('xlsx-js-style');

function colLetter(c) {
  return XLSX.utils.encode_col(c);
}
function cellRef(r, c) {
  return `${colLetter(c)}${r + 1}`;
}
function rangeRef(r0, c0, r1, c1) {
  return `${cellRef(r0, c0)}:${cellRef(r1, c1)}`;
}
function setFormulaCell(ws, r, c, formula, cachedValue = 0) {
  const ref = XLSX.utils.encode_cell({ r, c });
  const f = String(formula || '').trim().replace(/^=/, '');
  const prev = ws[ref] || {};
  ws[ref] = {
    ...prev,
    t: 'n',
    f,
    v: Number.isFinite(Number(cachedValue)) ? Number(cachedValue) : 0
  };
}
function sumFormula(r0, c0, r1, c1) {
  return `SUM(${rangeRef(r0, c0, r1, c1)})`;
}
function sumCellsFormula(rows, col) {
  const parts = (rows || []).map((r) => cellRef(r, col));
  if (!parts.length) return '0';
  if (parts.length === 1) return parts[0];
  return `SUM(${parts.join(',')})`;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const ws = XLSX.utils.aoa_to_sheet([
  ['Cuenta', 'Ene', 'Feb', 'Mar', 'TOTAL'],
  ['A', 1, 2, 3, 6],
  ['B', 4, 5, 6, 15],
  ['TOT', 5, 7, 9, 21]
]);
setFormulaCell(ws, 1, 4, sumFormula(1, 1, 1, 3), 6);
setFormulaCell(ws, 3, 1, sumCellsFormula([1, 2], 1), 5);
const totA = ws[XLSX.utils.encode_cell({ r: 1, c: 4 })];
const totMes = ws[XLSX.utils.encode_cell({ r: 3, c: 1 })];
assert(totA.f === 'SUM(B2:D2)' && totA.v === 6, `row total fail: ${totA.f} ${totA.v}`);
assert(totMes.f === 'SUM(B2,B3)' && totMes.v === 5, `beneficio fail: ${totMes.f}`);

const sheet = "'PIG LINEA CATERING'!B1";
setFormulaCell(ws, 0, 1, `SUM(${sheet})`, 10);
assert(ws[XLSX.utils.encode_cell({ r: 0, c: 1 })].f.includes('PIG LINEA CATERING'), 'cross-sheet');

console.log('OK verify-cr smoke (xlsx formula cell.f + cached v)');
