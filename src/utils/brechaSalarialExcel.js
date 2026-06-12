import * as XLSX from 'xlsx-js-style';
import { BRECHA_CATEGORIA_ORDER } from '../constants/brechaSalarialCategories';
import { filterRowsForBrechaExport } from '../services/brechaSalarialService';

const EURO_FMT = '#,##0.00';
const PCT_NUM_FMT = '0.00';

const HEADER_STYLE = {
  font: { bold: true },
  fill: { fgColor: { rgb: 'D8F3DC' } },
  alignment: { horizontal: 'center', vertical: 'center', wrapText: true }
};

const CAT_STYLE = { font: { bold: true } };

function setCell(ws, r, c, value, opts = {}) {
  if (value === null || value === undefined) return;
  if (value === '' && !opts.allowEmpty) return;
  const ref = XLSX.utils.encode_cell({ r, c });
  const cell = {};
  if (opts.formula) {
    cell.f = value;
    cell.t = 'n';
  } else if (typeof value === 'number') {
    cell.t = 'n';
    cell.v = value;
  } else {
    cell.t = 's';
    cell.v = String(value);
  }
  if (opts.fmt) cell.z = opts.fmt;
  if (opts.style) cell.s = opts.style;
  ws[ref] = cell;
}

function colLetter(c) {
  return XLSX.utils.encode_col(c);
}

function buildRegistroSheet(wb, rows, meta, empresaLabel) {
  const year = meta?.year || new Date().getFullYear();
  const aoa = [
    [`Datos Holded — ${empresaLabel} — ${year}`],
    [],
    [
      'Nº',
      'Nombre',
      'Género',
      'Función',
      'Jornada',
      'Horas año',
      '€/hora',
      'Bruto mensual (media)',
      'Meses nómina',
      'Bruto anual (media×12)',
      'Origen'
    ]
  ];
  for (const r of rows || []) {
    aoa.push([
      r.numero,
      r.nombreCompleto,
      r.genero,
      r.categoriaFuncion,
      r.jornadaLabel,
      r.horasTrabajadas,
      r.devengoHora,
      r.salarioBrutoMensual,
      r.mesesNomina ?? '',
      r.salarioAnual,
      r.origenDato
    ]);
  }
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [5, 28, 10, 16, 8, 10, 10, 14, 8, 14, 22].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(wb, ws, 'DATOS HOLDED');
}

/**
 * Taula Sergi: capçalera + blocs per funció (resum amb mitjanes → detall treballadors) + TOTAL MITJANA PONDERADA.
 */
function buildSergiSheet(ws, rows) {
  const eligible = filterRowsForBrechaExport(rows);
  const headers = ['FUNCIÓN', 'JORNADA', 'HORAS TRABAJADAS', 'DEVENGO H', 'DEVENGO M', 'HOME', 'DONA', '%'];

  let r = 0;
  headers.forEach((h, i) => setCell(ws, r, i, h, { style: HEADER_STYLE }));
  r += 1;

  const categoryPctRows = [];

  for (const cat of BRECHA_CATEGORIA_ORDER) {
    const emps = eligible.filter((e) => e.categoriaFuncion === cat);
    if (!emps.length) continue;

    const firstEmpRow = r + 1;
    const sumRow = r;

    setCell(ws, sumRow, 0, cat, { style: CAT_STYLE });

    const lastEmpRow = firstEmpRow + emps.length - 1;
    const dCol = colLetter(3);
    const eCol = colLetter(4);
    const fCol = colLetter(5);
    const gCol = colLetter(6);
    const hCol = colLetter(7);

    if (emps.length > 0) {
      const rangeD = `${dCol}${firstEmpRow}:${dCol}${lastEmpRow}`;
      const rangeE = `${eCol}${firstEmpRow}:${eCol}${lastEmpRow}`;
      const rangeF = `${fCol}${firstEmpRow}:${fCol}${lastEmpRow}`;
      const rangeG = `${gCol}${firstEmpRow}:${gCol}${lastEmpRow}`;

      setCell(ws, sumRow, 3, `IFERROR(AVERAGEIFS(${rangeD},${rangeF},">0"),"N/A")`, {
        formula: true,
        fmt: EURO_FMT
      });
      setCell(ws, sumRow, 4, `IFERROR(AVERAGEIFS(${rangeE},${rangeG},">0"),"N/A")`, {
        formula: true,
        fmt: EURO_FMT
      });
      setCell(ws, sumRow, 5, `COUNTIF(${rangeF},">0")`, { formula: true });
      setCell(ws, sumRow, 6, `COUNTIF(${rangeG},">0")`, { formula: true });
      setCell(
        ws,
        sumRow,
        7,
        `IF(AND(${fCol}${sumRow + 1}>0,${gCol}${sumRow + 1}>0,ISNUMBER(${dCol}${sumRow + 1}),ISNUMBER(${eCol}${sumRow + 1})),(${dCol}${sumRow + 1}-${eCol}${sumRow + 1})/${dCol}${sumRow + 1}*100,"N/A")`,
        { formula: true, fmt: PCT_NUM_FMT }
      );
      categoryPctRows.push(sumRow + 1);
    }

    r = firstEmpRow;
    for (const emp of emps) {
      setCell(ws, r, 0, emp.nombreCompleto);
      setCell(ws, r, 1, emp.jornadaLabel || 'N/A');
      setCell(ws, r, 2, emp.horasTrabajadas, { fmt: '0' });
      if (emp.genero === 'Hombre' && emp.devengoHora > 0) {
        setCell(ws, r, 3, emp.devengoHora, { fmt: EURO_FMT });
        setCell(ws, r, 5, 1);
      }
      if (emp.genero === 'Mujer' && emp.devengoHora > 0) {
        setCell(ws, r, 4, emp.devengoHora, { fmt: EURO_FMT });
        setCell(ws, r, 6, 1);
      }
      r += 1;
    }
    r += 1;
  }

  if (categoryPctRows.length) {
    const pctRefs = categoryPctRows.map((rowNum) => `${colLetter(7)}${rowNum}`).join(',');
    setCell(ws, r, 0, 'TOTAL MITJANA PONDERADA', { style: CAT_STYLE });
    setCell(ws, r, 7, `IFERROR(AVERAGE(${pctRefs}),"")`, { formula: true, fmt: PCT_NUM_FMT });
  }

  ws['!cols'] = [26, 10, 16, 12, 12, 6, 6, 10].map((wch) => ({ wch }));
  ws['!ref'] = XLSX.utils.encode_range({
    s: { r: 0, c: 0 },
    e: { r: Math.max(r + 2, 12), c: 7 }
  });
}

export function buildBrechaSalarialWorkbook({ rows, meta, empresaLabel }) {
  const wb = XLSX.utils.book_new();
  const year = meta?.year || new Date().getFullYear();
  const empresaShort =
    empresaLabel?.includes('Menjar') ? 'MH' : empresaLabel?.includes('Solucions') ? 'EI SSS' : empresaLabel;

  const exportRows = filterRowsForBrechaExport(rows);

  buildRegistroSheet(wb, exportRows, meta, empresaLabel);

  const sheetName = `${year} ${empresaShort}`.slice(0, 31);
  const wsMain = {};
  buildSergiSheet(wsMain, exportRows);
  XLSX.utils.book_append_sheet(wb, wsMain, sheetName);

  return wb;
}

export function downloadBrechaWorkbook(wb, filename) {
  XLSX.writeFile(wb, filename);
}
