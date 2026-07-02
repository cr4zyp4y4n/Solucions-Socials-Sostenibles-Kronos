import * as XLSX from 'xlsx-js-style';
import { formatEuroEs } from './fdHorasLookup';

/** Plantilla canónica copiada del CSV oficial de Innuva. */
export const INNUVA_INCIDENCIAS_TEMPLATE = {
  columnCount: 55,
  sheetName: 'Empresa (1)',
  rows: [
    Array.from({ length: 55 }, () => ''),
    [
      '', '', 'EMPRESA', '', ' 1  EMP. INSERCIÓ SOLUCIONS SOC SOSTEN.',
      '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', 'NEWVC',
      '11I,11U,3939I,3939U,3434I,3434U,122122I,122122U,', '008'
    ],
    Array.from({ length: 55 }, () => ''),
    Array.from({ length: 55 }, () => ''),
    Array.from({ length: 55 }, () => ''),
    Array.from({ length: 55 }, () => ''),
    ['TRABAJADORES', ...Array.from({ length: 54 }, () => '')],
    [
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
      '122 - Liquidacion vacaciones (Unidades)',
      ...Array.from({ length: 43 }, () => '')
    ]
  ],
  cols: [
    { wch: 10 }, { wch: 30 }, { wch: 12 }, { wch: 4 },
    { wch: 24 }, { wch: 24 }, { wch: 28 }, { wch: 28 },
    { wch: 22 }, { wch: 22 }, { wch: 28 }, { wch: 28 },
    ...Array.from({ length: 43 }, () => ({ wch: 8 }))
  ]
};

function emptyRow(length) {
  return Array.from({ length }, () => '');
}

/** Código Innuva a 6 dígitos (ej. 000106). Vacío si no hay código. */
export function formatCodigoInnuva(codigo) {
  const raw = String(codigo || '').trim();
  if (!raw) return '';
  const digits = raw.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.length <= 6) return digits.padStart(6, '0');
  return digits;
}

/**
 * Matriz de hoja idéntica a la plantilla Innuva (filas 1-8 fijas + datos).
 * @param {Array<object>} incidencias
 * @param {{ empresaNombre?: string }} [options]
 */
export function buildInnuvaIncidenciasSheetMatrix(incidencias, options = {}) {
  const tpl = INNUVA_INCIDENCIAS_TEMPLATE;
  const matrix = tpl.rows.map((row) => [...row]);

  for (const row of incidencias || []) {
    const dataRow = emptyRow(tpl.columnCount);
    dataRow[0] = formatCodigoInnuva(row.codigo);
    dataRow[1] = row.nombre || '';
    dataRow[2] = row.fecha || '';
    dataRow[4] = formatEuroEs(row.salarioBaseImporte);
    dataRow[5] = row.salarioBaseUnidades ?? '';
    dataRow[6] = formatEuroEs(row.mejoraImporte);
    dataRow[7] = row.mejoraUnidades ?? '';
    dataRow[8] = formatEuroEs(row.ppExtraImporte);
    dataRow[9] = row.ppExtraUnidades ?? '';
    dataRow[10] = formatEuroEs(row.liquidacionImporte);
    dataRow[11] = row.liquidacionUnidades ?? '';
    matrix.push(dataRow);
  }

  return matrix;
}

export function buildInnuvaIncidenciasWorkbook(incidencias, options = {}) {
  const matrix = buildInnuvaIncidenciasSheetMatrix(incidencias, options);
  const worksheet = XLSX.utils.aoa_to_sheet(matrix);
  worksheet['!cols'] = INNUVA_INCIDENCIAS_TEMPLATE.cols;
  worksheet['!merges'] = [{ s: { r: 6, c: 0 }, e: { r: 6, c: 2 } }];

  const headerBorder = {
    top: { style: 'medium', color: { rgb: '000000' } },
    bottom: { style: 'medium', color: { rgb: '000000' } },
    left: { style: 'medium', color: { rgb: '000000' } },
    right: { style: 'medium', color: { rgb: '000000' } }
  };

  const setCellStyle = (cellRef, patch) => {
    if (!worksheet[cellRef]) return;
    worksheet[cellRef].s = {
      ...(worksheet[cellRef].s || {}),
      ...patch,
      font: {
        ...((worksheet[cellRef].s && worksheet[cellRef].s.font) || {}),
        ...((patch && patch.font) || {})
      },
      border: {
        ...((worksheet[cellRef].s && worksheet[cellRef].s.border) || {}),
        ...((patch && patch.border) || {})
      }
    };
  };

  setCellStyle('C2', { font: { bold: true } });
  setCellStyle('A7', {
    font: { bold: true },
    border: headerBorder,
    alignment: { horizontal: 'center', vertical: 'center' }
  });
  setCellStyle('A8', { font: { name: 'Arial' } });

  for (const cellRef of ['A8', 'B8', 'C8', 'D8', 'E8', 'F8', 'G8', 'H8', 'I8', 'J8', 'K8', 'L8']) {
    setCellStyle(cellRef, {
      border: headerBorder,
      font: { name: 'Arial', bold: true }
    });
  }

  setCellStyle('C2', { font: { bold: true, name: 'Arial' } });
  setCellStyle('A7', {
    font: { bold: true, name: 'Arial' },
    border: headerBorder,
    alignment: { horizontal: 'center', vertical: 'center' }
  });

  const range = XLSX.utils.decode_range(worksheet['!ref']);
  for (let row = range.s.r; row <= range.e.r; row++) {
    for (let col = range.s.c; col <= range.e.c; col++) {
      const ref = XLSX.utils.encode_cell({ r: row, c: col });
      if (!worksheet[ref]) continue;
      setCellStyle(ref, {
        font: {
          name: 'Arial',
          sz: 10
        }
      });

      if (col >= 4) {
        setCellStyle(ref, {
          alignment: { horizontal: 'right', vertical: 'center' }
        });
      }
    }
  }

  for (const cellRef of ['A8', 'B8', 'C8', 'D8']) {
    setCellStyle(cellRef, {
      alignment: { horizontal: 'left', vertical: 'center' }
    });
  }

  const workbook = XLSX.utils.book_new();
  const sheetName = options.sheetName || INNUVA_INCIDENCIAS_TEMPLATE.sheetName;
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return workbook;
}

export function downloadInnuvaIncidenciasWorkbook(incidencias, fileName, options = {}) {
  const workbook = buildInnuvaIncidenciasWorkbook(incidencias, options);
  XLSX.writeFile(workbook, fileName);
}
