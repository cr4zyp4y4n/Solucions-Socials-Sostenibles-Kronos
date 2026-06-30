import fs from 'fs';

function parseCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

const text = fs.readFileSync('2026 ALTAS - BAJAS PLANTILLA CAMAREROS.xlsx - JUNIO.csv', 'utf8');
const lines = text.replace(/\r\n/g, '\n').split('\n');
const rows = lines.map(parseCsvLine);

function normHeader(cell) {
  return String(cell || '').trim().toLowerCase();
}

function isFdBlockAt(headers, i) {
  return (
    normHeader(headers[i]) === 'parcialidad' &&
    normHeader(headers[i + 1]) === 'horario' &&
    normHeader(headers[i + 2]) === 'parcialidad' &&
    normHeader(headers[i + 3]) === 'horas' &&
    normHeader(headers[i + 4]) === 'bruto'
  );
}

console.log('rows', rows.length);
for (let ri = 0; ri < 5; ri++) {
  const hits = [];
  const r = rows[ri] || [];
  for (let i = 0; i < r.length - 4; i++) {
    if (isFdBlockAt(r, i)) hits.push(i);
  }
  console.log('row', ri, 'len', r.length, 'fd hits', hits.slice(0, 5));
}

const headerRowIdx = rows.findIndex((r, idx) => idx >= 1 && r.some((_, i) => isFdBlockAt(r, i)));
console.log('headerRowIdx', headerRowIdx);
const headers = rows[headerRowIdx];
const nameRow = rows[0];

let blocks = 0;
for (let i = 0; i < headers.length - 4; i++) {
  if (!isFdBlockAt(headers, i)) continue;
  blocks++;
  const nameCols = [];
  for (let c = i; c >= Math.max(0, i - 12); c--) {
    if (nameRow[c]) nameCols.push(`${c}:${nameRow[c]}`);
  }
  if (blocks <= 3) console.log('block', blocks, 'at', i, 'name scan', nameCols.slice(0, 5));
  i += 4;
}
console.log('total fd blocks pattern', blocks);
