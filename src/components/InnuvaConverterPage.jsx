import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useTheme } from './ThemeContext';
import {
  buildNominasCuentasIndex,
  loadNominasCuentasEmpleados,
  normalizeCodigo,
  upsertNominasCuentasEmpleados
} from '../services/nominasCuentasService';
import {
  UploadCloud,
  FileText,
  RefreshCw,
  DownloadCloud,
  AlertCircle,
  CheckCircle
} from 'feather-icons-react';

const MAX_PREVIEW_ROWS = 10;

const HOLDEN_NOMINAS_HEADERS = [
  "Document d'identificació",
  'Data dd/mm/yyyy',
  'Descripció',
  'Salario',
  'Salario Compte (640)',
  'Total S.S.',
  'Total S.S. Compte (476)',
  'Gasto S.S. Empresa',
  'Gasto S.S. Empresa Compte (642)',
  'IRPF',
  'IRPF Compte (4751)',
  'Etiquetes separades per -',
  'Import del pagament',
  'Data de pagament',
  'Compte de càrrega'
];

const parseEsNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).replace(/\u00a0/g, ' ').trim();
  if (!s) return 0;
  if (s.includes('-   €') || s === '-') return 0;
  const negative = s.startsWith('-');
  // Normalización robusta:
  // - Si hay "," asumimos decimal "," (y "." miles)
  // - Caso especial Innuva: a veces viene "1,33192" para significar "1331,92"
  //   (5 decimales con coma y parte entera pequeña). Lo convertimos a 2 decimales.
  // - Si NO hay "," pero hay "." y parece decimal (1-2 decimales), asumimos decimal "."
  // - Si NO, "." se trata como miles
  const raw = s.replace(/€/g, '').replace(/\s/g, '');
  const hasComma = raw.includes(',');

  // Si trae ambos separadores, decidimos el decimal por el separador más a la derecha:
  // - "1.331,91" => decimal "," (ES)
  // - "1,331.91" => decimal "." (EN)
  if (hasComma && raw.includes('.')) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    const isDotDecimal = lastDot > lastComma;
    const cleaned = (isDotDecimal
      ? raw.replace(/,/g, '') // quitar miles ","
      : raw.replace(/\./g, '').replace(',', '.') // quitar miles "." y decimal ","
    ).replace(/[^0-9.\-]/g, '');
    const n = Number.parseFloat(cleaned);
    if (!Number.isFinite(n)) return 0;
    return negative ? -Math.abs(n) : n;
  }

  if (hasComma && /^-?\d{1,3},\d{5}$/.test(raw)) {
    const digits = raw.replace(/[^0-9\-]/g, '').replace('-', '');
    if (digits.length >= 3) {
      const intPart = digits.slice(0, -2);
      const decPart = digits.slice(-2);
      const fixed = `${negative ? '-' : ''}${intPart}.${decPart}`;
      const n = Number.parseFloat(fixed);
      return Number.isFinite(n) ? n : 0;
    }
  }

  const looksLikeDotDecimal = !hasComma && /-?\d+\.\d{1,2}$/.test(raw);
  const cleaned = (hasComma
    ? raw.replace(/\./g, '').replace(',', '.')
    : looksLikeDotDecimal
      ? raw
      : raw.replace(/\./g, '')
  ).replace(/[^0-9.\-]/g, '');
  const n = Number.parseFloat(cleaned);
  if (!Number.isFinite(n)) return 0;
  return negative ? -Math.abs(n) : n;
};

const toDdMmYyyy = (isoOrDdMmYyyy) => {
  const s = String(isoOrDdMmYyyy || '').trim();
  if (!s) return '';
  // already dd/mm/yyyy
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  // yyyy-mm-dd
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
};

const monthNameEs = (monthIndex1to12) => {
  const names = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const idx = Number(monthIndex1to12) - 1;
  return names[idx] || '';
};

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

function parseInnuvaNominasCsv(csvText) {
  const lines = String(csvText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l !== undefined);
  const rows = lines.map((l) => l.split(';').map((c) => c.trim()));

  // Buscar cabecera de tabla
  let headerRowIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const joined = row.join('|').toLowerCase();
    if (joined.includes('trabajador') && joined.includes('nif') && joined.includes('importe bruto')) {
      headerRowIndex = i;
      break;
    }
  }
  if (headerRowIndex < 0) {
    return { meta: {}, rows: [] };
  }

  // Meta fechas: "Del 01/03/2026 al 31/03/2026 .... 07/04/2026"
  const meta = {};
  for (const row of rows.slice(0, headerRowIndex)) {
    const text = row.join(' ').replace(/\s+/g, ' ').trim();
    const m = text.match(/Del\s+(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4}).*?(\d{2}\/\d{2}\/\d{4})/i);
    if (m) {
      meta.periodStart = m[1];
      meta.periodEnd = m[2];
      meta.paymentDate = m[3];
      break;
    }
  }

  const headerRow = rows[headerRowIndex] || [];
  const colIndex = (name) => headerRow.findIndex((c) => String(c || '').toLowerCase() === name.toLowerCase());

  const idxTrabajador = colIndex('TRABAJADOR');
  const idxNif = colIndex('NIF');
  const idxBruto = colIndex('Importe bruto');
  const idxSsTrab = colIndex('Seguridad Social trabajador');
  const idxSsEmp = colIndex('Total Seguridad Social de empresa');
  const idxLiquido = colIndex('Importe líquido');
  const idxIrpf = colIndex('Tributación IRPF total');
  const idxCodigo = idxTrabajador >= 0 ? idxTrabajador - 1 : -1;

  const out = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const all = r.join('').trim();
    if (!all) continue;
    // cortar en totales
    if (String(r[0] || '').toLowerCase().includes('total') || String(r[2] || '').toLowerCase().includes('total')) {
      break;
    }

    const nif = idxNif >= 0 ? (r[idxNif] || '') : '';
    const trabajador = idxTrabajador >= 0 ? (r[idxTrabajador] || '') : '';
    if (!nif || !trabajador) continue;
    const codigo = idxCodigo >= 0 ? (r[idxCodigo] || '') : '';

    out.push({
      codigo: normalizeCodigo(codigo),
      trabajador,
      nif,
      bruto: parseEsNumber(idxBruto >= 0 ? r[idxBruto] : 0),
      ssTrabajador: parseEsNumber(idxSsTrab >= 0 ? r[idxSsTrab] : 0),
      ssEmpresa: parseEsNumber(idxSsEmp >= 0 ? r[idxSsEmp] : 0),
      liquido: parseEsNumber(idxLiquido >= 0 ? r[idxLiquido] : 0),
      irpf: parseEsNumber(idxIrpf >= 0 ? r[idxIrpf] : 0)
    });
  }

  return { meta, rows: out };
}

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const buildObjectRows = (headers, rows) => {
  if (!headers.length) return [];
  return rows.map((row, index) => {
    const rowObject = {};
    headers.forEach((header, headerIndex) => {
      rowObject[header || `Campo ${headerIndex + 1}`] = row?.[headerIndex] ?? '';
    });
    rowObject.__rowIndex = index;
    return rowObject;
  });
};

const InnuvaConverterPage = () => {
  const { colors } = useTheme();
  const fileInputRef = useRef(null);
  const rootRef = useRef(null);

  const [innuvaFile, setInnuvaFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [sourceObjects, setSourceObjects] = useState([]);
  const [holdedDraft, setHoldedDraft] = useState([]);
  const [conversionLog, setConversionLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [holdedNominasConfig, setHoldedNominasConfig] = useState({
    salarioCompte640: '64000000',
    totalSsCompte476: '47600000',
    gastoSsEmpresaCompte642: '64200000',
    irpfCompte4751: '47510000',
    etiquetas: '',
    compteCarrega: ''
  });
  const [cuentasByCodigo, setCuentasByCodigo] = useState(new Map());
  const [cuentasLoading, setCuentasLoading] = useState(false);
  const [cuentasError, setCuentasError] = useState('');
  const [cuentasCsvFile, setCuentasCsvFile] = useState(null);

  // Evitar overflow horizontal de la app al renderizar tablas anchas (Windows + scrollbar).
  useEffect(() => {
    const prevHtml = document.documentElement.style.overflowX;
    const prevBody = document.body.style.overflowX;
    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';
    return () => {
      document.documentElement.style.overflowX = prevHtml;
      document.body.style.overflowX = prevBody;
    };
  }, []);

  const addLogEntry = useCallback((message, type = 'info') => {
    setConversionLog(prev => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        timestamp: new Date(),
        message,
        type
      }
    ]);
  }, []);

  const refreshCuentasFromDb = useCallback(async () => {
    try {
      setCuentasError('');
      setCuentasLoading(true);
      const rows = await loadNominasCuentasEmpleados();
      setCuentasByCodigo(buildNominasCuentasIndex(rows));
      addLogEntry(`Cuentas por empleado cargadas: ${rows.length}`, 'success');
    } catch (e) {
      console.error('Error cargando cuentas por empleado:', e);
      setCuentasByCodigo(new Map());
      setCuentasError(e?.message || 'Error cargando cuentas por empleado.');
      addLogEntry('Error cargando cuentas por empleado desde Supabase.', 'error');
    } finally {
      setCuentasLoading(false);
    }
  }, [addLogEntry]);

  useEffect(() => {
    refreshCuentasFromDb();
  }, [refreshCuentasFromDb]);

  const parseCuentasEmpleadosCsv = useCallback(async (file) => {
    const text = await file.text();
    const lines = String(text || '')
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .split('\n')
      .filter((l) => l.trim() !== '');
    const rows = lines.map((l) => l.split(';').map((c) => c.trim()));
    const header = rows[0] || [];
    const idx = (name) => header.findIndex((h) => String(h || '').toLowerCase() === name.toLowerCase());
    const iCodigo = idx('CODIGO');
    const iTrab = idx('TRABAJADOR');
    const i640 = idx('Salario Compte (640)');
    const i476 = idx('Total S.S. Compte (476)');
    const i642 = idx('Gasto S.S. Empresa Compte (642)');
    const i4751 = idx('IRPF Compte (4751)');
    const out = [];
    for (const r of rows.slice(1)) {
      out.push({
        codigo_innuva: normalizeCodigo(iCodigo >= 0 ? r[iCodigo] : ''),
        trabajador: iTrab >= 0 ? r[iTrab] : '',
        salario_compte_640: i640 >= 0 ? r[i640] : '',
        total_ss_compte_476: i476 >= 0 ? r[i476] : '',
        gasto_ss_empresa_compte_642: i642 >= 0 ? r[i642] : '',
        irpf_compte_4751: i4751 >= 0 ? r[i4751] : ''
      });
    }
    return out;
  }, []);

  const importCuentasCsvToDb = useCallback(async () => {
    if (!cuentasCsvFile) return;
    try {
      setCuentasError('');
      setCuentasLoading(true);
      const rows = await parseCuentasEmpleadosCsv(cuentasCsvFile);
      const res = await upsertNominasCuentasEmpleados(rows);
      addLogEntry(`Importadas/actualizadas cuentas: ${res.upserted}`, 'success');
      setCuentasCsvFile(null);
      await refreshCuentasFromDb();
    } catch (e) {
      console.error('Error importando CSV de cuentas:', e);
      setCuentasError(e?.message || 'Error importando CSV de cuentas.');
      addLogEntry('Error importando CSV de cuentas a Supabase.', 'error');
    } finally {
      setCuentasLoading(false);
    }
  }, [addLogEntry, cuentasCsvFile, parseCuentasEmpleadosCsv, refreshCuentasFromDb]);

  const debugOverflow = useCallback((reason = '') => {
    try {
      const root = rootRef.current || document.querySelector('main') || document.body;
      const docEl = document.documentElement;
      const body = document.body;
      const rootRect = root?.getBoundingClientRect?.();

      const snapshot = {
        reason,
        doc_clientWidth: docEl?.clientWidth,
        doc_scrollWidth: docEl?.scrollWidth,
        body_clientWidth: body?.clientWidth,
        body_scrollWidth: body?.scrollWidth,
        root_clientWidth: root?.clientWidth,
        root_scrollWidth: root?.scrollWidth,
        root_left: rootRect?.left,
        root_right: rootRect?.right
      };
      console.log('🧪 [InnuvaConverterPage] Overflow snapshot', snapshot);

      const offenders = [];
      const nodes = root?.querySelectorAll ? root.querySelectorAll('*') : [];
      const buildPath = (el) => {
        const parts = [];
        let cur = el;
        while (cur && cur instanceof HTMLElement && cur !== root && parts.length < 6) {
          const tag = cur.tagName.toLowerCase();
          const id = cur.id ? `#${cur.id}` : '';
          const cls = cur.className ? `.${String(cur.className).trim().split(/\s+/).slice(0, 2).join('.')}` : '';
          parts.unshift(`${tag}${id}${cls}`);
          cur = cur.parentElement;
        }
        return parts.join(' > ');
      };
      for (const el of nodes) {
        if (!(el instanceof HTMLElement)) continue;
        // ignorar elementos invisibles
        const cs = window.getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') continue;
        const cw = el.clientWidth;
        const sw = el.scrollWidth;
        if (cw > 0 && sw - cw > 2) {
          const r = el.getBoundingClientRect();
          offenders.push({
            tag: el.tagName.toLowerCase(),
            id: el.id || '',
            className: (el.className && String(el.className).slice(0, 120)) || '',
            path: buildPath(el),
            clientWidth: cw,
            scrollWidth: sw,
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width)
          });
        }
      }
      offenders.sort((a, b) => (b.scrollWidth - b.clientWidth) - (a.scrollWidth - a.clientWidth));

      const top = offenders.slice(0, 8);
      console.log('🧪 [InnuvaConverterPage] Top overflow offenders', top);

      // Resaltar visualmente el top offender (si existe)
      if (top[0]) {
        const el = Array.from(nodes).find((n) => {
          if (!(n instanceof HTMLElement)) return false;
          const r = n.getBoundingClientRect();
          return (
            Math.round(r.left) === top[0].left &&
            Math.round(r.right) === top[0].right &&
            Math.round(r.width) === top[0].width
          );
        });
        if (el) {
          const prevOutline = el.style.outline;
          el.style.outline = '3px solid #ff3b30';
          window.setTimeout(() => {
            el.style.outline = prevOutline;
          }, 2500);
        }
      }
      addLogEntry(
        `Debug overflow${reason ? ` (${reason})` : ''}: root ${snapshot.root_clientWidth}px → ${snapshot.root_scrollWidth}px. Top offender: ${top[0]?.tag || '—'} (scroll ${top[0]?.scrollWidth || '—'} / client ${top[0]?.clientWidth || '—'}) ${top[0]?.path ? `| ${top[0].path}` : ''}`,
        top.length ? 'error' : 'success'
      );
    } catch (e) {
      console.error('🧪 [InnuvaConverterPage] Overflow debug failed', e);
      addLogEntry(`Debug overflow falló: ${e?.message || e}`, 'error');
    }
  }, [addLogEntry]);

  useEffect(() => {
    // tras render (subida de archivo o cambios grandes), inspeccionar overflow
    const id = window.requestAnimationFrame(() => debugOverflow(sourceObjects.length > 0 ? 'post-upload' : 'initial'));
    return () => window.cancelAnimationFrame(id);
  }, [debugOverflow, sourceObjects.length]);

  const resetState = useCallback(() => {
    setHeaders([]);
    setRawRows([]);
    setSourceObjects([]);
    setHoldedDraft([]);
    setConversionLog([]);
    setError(null);
    setInnuvaFile(null);
  }, []);

  const handleFileButtonClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    await processFile(file);
  };

  const processFile = async (file) => {
    resetState();
    setIsProcessing(true);
    addLogEntry(`Procesando archivo "${file.name}"`, 'info');

    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';

      let innuvaParsed = null;
      let sourcePreview = [];
      if (isCsv) {
        const text = await file.text();
        innuvaParsed = parseInnuvaNominasCsv(text);
        sourcePreview = innuvaParsed.rows.map((r, idx) => ({ ...r, __rowIndex: idx }));
      } else {
        // XLSX: convertimos primera hoja a CSV interno para reutilizar parser
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        if (!workbook.SheetNames.length) throw new Error('El archivo no contiene hojas.');
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
        innuvaParsed = parseInnuvaNominasCsv(csv);
        sourcePreview = innuvaParsed.rows.map((r, idx) => ({ ...r, __rowIndex: idx }));
      }

      setInnuvaFile(file);
      setHeaders(['trabajador', 'nif', 'bruto', 'ssTrabajador', 'ssEmpresa', 'liquido', 'irpf']);
      setRawRows(sourcePreview);
      setSourceObjects(sourcePreview);

      const dataDate = toDdMmYyyy(innuvaParsed?.meta?.periodEnd || innuvaParsed?.meta?.periodStart || '');
      // Holded rellenará la fecha de pago manualmente al importar
      const paymentDate = '';

      const periodEnd = innuvaParsed?.meta?.periodEnd || innuvaParsed?.meta?.periodStart || '';
      const mPeriod = String(periodEnd).match(/^\d{2}\/(\d{2})\/(\d{4})$/);
      const monthLabel = mPeriod ? `${monthNameEs(mPeriod[1])} ${mPeriod[2]}`.trim() : '';

      const mapped = (innuvaParsed?.rows || []).map((r) => {
        const salario = round2(r.bruto || 0);
        const totalSs = round2(r.ssTrabajador || 0);
        const gastoSsEmpresa = round2(r.ssEmpresa || 0);
        const irpf = round2(r.irpf || 0);
        const importePagament = round2(r.liquido || 0);

        const nombreEmpleado = r.trabajador || r.nif;
        const desc = `Nómina${monthLabel ? ` ${monthLabel}` : ''} - ${nombreEmpleado}`.trim();

        const byCodigo = r.codigo ? cuentasByCodigo.get(String(r.codigo)) : null;
        const salario640 = byCodigo?.salario640 || holdedNominasConfig.salarioCompte640;
        const total476 = byCodigo?.total476 || holdedNominasConfig.totalSsCompte476;
        const gasto642 = byCodigo?.gasto642 || holdedNominasConfig.gastoSsEmpresaCompte642;
        const irpf4751 = byCodigo?.irpf4751 || holdedNominasConfig.irpfCompte4751;

        return {
          "Document d'identificació": r.nif,
          'Data dd/mm/yyyy': dataDate,
          'Descripció': desc,
          'Salario': salario,
          'Salario Compte (640)': salario640,
          'Total S.S.': totalSs,
          'Total S.S. Compte (476)': total476,
          'Gasto S.S. Empresa': gastoSsEmpresa,
          'Gasto S.S. Empresa Compte (642)': gasto642,
          'IRPF': irpf,
          'IRPF Compte (4751)': irpf4751,
          'Etiquetes separades per -': holdedNominasConfig.etiquetas,
          'Import del pagament': importePagament,
          'Data de pagament': paymentDate,
          'Compte de càrrega': holdedNominasConfig.compteCarrega
        };
      });

      // Agrupar por empleado (NIF) para que, si hay varias nóminas, queden en una sola fila
      const groupedByNif = new Map();
      for (const row of mapped) {
        const nifKey = String(row["Document d'identificació"] || '').trim();
        if (!nifKey) continue;

        const prev = groupedByNif.get(nifKey);
        if (!prev) {
          groupedByNif.set(nifKey, { ...row, __count: 1 });
          continue;
        }

        // Aseguramos consistencia en campos no numéricos (si difieren, nos quedamos con el primero)
        prev.__count += 1;

        // Sumatorios numéricos importantes
        prev['Salario'] = round2((prev['Salario'] || 0) + (row['Salario'] || 0));
        prev['Total S.S.'] = round2((prev['Total S.S.'] || 0) + (row['Total S.S.'] || 0));
        prev['Gasto S.S. Empresa'] = round2((prev['Gasto S.S. Empresa'] || 0) + (row['Gasto S.S. Empresa'] || 0));
        prev['IRPF'] = round2((prev['IRPF'] || 0) + (row['IRPF'] || 0));
        prev['Import del pagament'] = round2((prev['Import del pagament'] || 0) + (row['Import del pagament'] || 0));

        // Si hay varias descripciones, dejamos la original pero indicamos cantidad
        if (prev.__count > 1) {
          const base = String(prev['Descripció'] || '').replace(/\s*\(x\d+\)\s*$/i, '').trim();
          prev['Descripció'] = `${base} (x${prev.__count})`;
        }
      }

      const merged = Array.from(groupedByNif.values()).map(({ __count, ...r }) => r);

      // Orden de columnas exacto como plantilla Holded
      const ordered = merged.map((row) => {
        const obj = {};
        HOLDEN_NOMINAS_HEADERS.forEach((h) => {
          obj[h] = row[h] ?? '';
        });
        return obj;
      });

      setHoldedDraft(ordered);
      addLogEntry(`Archivo leído correctamente. Generadas ${ordered.length} filas para la plantilla de nóminas de Holded.`, 'success');
    } catch (err) {
      console.error('❌ Error procesando Excel de Innuva:', err);
      setError(err.message || 'No se pudo procesar el Excel de Innuva.');
      addLogEntry(err.message || 'Error al procesar el archivo de Innuva.', 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReset = () => {
    resetState();
    addLogEntry('Reiniciado el conversor. Listo para un nuevo archivo.', 'info');
  };

  const previewSourceRows = useMemo(() => {
    return sourceObjects.slice(0, MAX_PREVIEW_ROWS);
  }, [sourceObjects]);

  const previewHoldedRows = useMemo(() => {
    return holdedDraft.slice(0, MAX_PREVIEW_ROWS);
  }, [holdedDraft]);

  const handleDownloadDraft = () => {
    if (!holdedDraft.length) return;

    const worksheet = XLSX.utils.json_to_sheet(holdedDraft);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Holded Draft');

    const fileName = innuvaFile
      ? innuvaFile.name.replace(/(\.xlsx?|\.csv)$/i, '_HOLD-PLAN.xlsx')
      : 'innuva_holded_plan.xlsx';

    XLSX.writeFile(workbook, fileName);
    addLogEntry(`Descargado borrador de Holded: ${fileName}`, 'success');
  };

  const hasData = sourceObjects.length > 0;

  return (
    <div
      ref={rootRef}
      style={{
        width: '100%',
        minHeight: '100%',
        padding: '24px',
        boxSizing: 'border-box',
        background: colors.background,
        maxWidth: '100%',
        overflowX: 'hidden',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '20px',
          width: '100%',
          maxWidth: '1300px',
          margin: '0 auto',
          boxSizing: 'border-box',
          overflowX: 'hidden',
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            marginBottom: '4px',
          }}
        >
          <UploadCloud size={40} color={colors.primary} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <h1
              style={{
                margin: 0,
                color: colors.text,
                fontSize: '30px',
                fontWeight: 700,
              }}
            >
              Innuva → Holded
            </h1>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ color: colors.primary, fontWeight: 700, fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Conversor Innuva → Holded
            </div>
            <h2 style={{ margin: 0, color: colors.text, fontSize: '28px', fontWeight: 700 }}>
              Prepara los datos de Innuva para Holded
            </h2>
            <p style={{ margin: 0, color: colors.textSecondary, fontSize: '15px', lineHeight: 1.45 }}>
              Sube el Excel/CSV generado en Innuva y la aplicación generará el fichero importable en Holded, aplicando automáticamente las cuentas por empleado desde Supabase.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {[
              { icon: UploadCloud, label: '1. Subir Excel de Innuva', description: 'Selecciona el archivo exportado desde Innuva (formato XLSX o CSV).' },
              { icon: RefreshCw, label: '2. Transformación automática', description: 'Convertimos las nóminas y aplicamos cuentas por empleado (si existen en Supabase).' },
              { icon: FileText, label: '3. Revisión previa', description: 'Visualiza una muestra de los datos antes de descargar el archivo.' },
              { icon: DownloadCloud, label: '4. Descargar', description: 'Descarga el Excel listo para importar en Holded.' },
            ].map((step, index) => {
              const Icon = step.icon;
              return (
                <motion.div
                  key={step.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 * index, duration: 0.2 }}
                  style={{
                    flex: '1 1 240px',
                    background: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex',
                    gap: '14px',
                    alignItems: 'flex-start',
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: '10px',
                      background: colors.primary + '18',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={18} color={colors.primary} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ color: colors.text, fontWeight: 600, fontSize: '15px' }}>{step.label}</div>
                    <div style={{ color: colors.textSecondary, fontSize: '13px', lineHeight: 1.4 }}>{step.description}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
          }}
        >
          <h3 style={{ margin: 0, color: colors.text, fontSize: '18px', fontWeight: 700 }}>
            Configuración Holded (campos verdes)
          </h3>
          <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
            Kronos rellena los campos necesarios. Las cuentas se aplican automáticamente por empleado desde Supabase; si un empleado no tiene mapeo, se usan valores por defecto.
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ color: colors.textSecondary, fontSize: 13 }}>
              Cuentas por empleado en Supabase:{' '}
              <span style={{ color: colors.text, fontWeight: 800 }}>
                {cuentasLoading ? 'Cargando…' : `${cuentasByCodigo.size} empleados`}
              </span>
            </div>
            <button
              onClick={refreshCuentasFromDb}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                cursor: 'pointer',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontWeight: 800
              }}
            >
              Recargar
            </button>
          </div>

          {cuentasError ? (
            <div style={{ padding: 12, borderRadius: 10, border: `1px solid ${colors.error}`, background: colors.error + '14', color: colors.error, fontSize: 13 }}>
              {cuentasError}
            </div>
          ) : null}

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <label
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '10px 12px',
                borderRadius: 10,
                cursor: 'pointer',
                border: `1px solid ${colors.border}`,
                background: colors.surface,
                color: colors.text,
                fontWeight: 800
              }}
              title="Importa/actualiza el mapeo de cuentas por empleado en Supabase"
            >
              <UploadCloud size={16} />
              {cuentasCsvFile ? cuentasCsvFile.name : 'Importar CSV cuentas empleados'}
              <input
                type="file"
                accept=".csv,text/csv"
                style={{ display: 'none' }}
                onChange={(e) => setCuentasCsvFile(e.target.files?.[0] || null)}
              />
            </label>
            <button
              onClick={importCuentasCsvToDb}
              disabled={!cuentasCsvFile || cuentasLoading}
              style={{
                padding: '10px 12px',
                borderRadius: 10,
                cursor: !cuentasCsvFile || cuentasLoading ? 'not-allowed' : 'pointer',
                border: `1px solid ${!cuentasCsvFile || cuentasLoading ? colors.border : colors.primary}`,
                background: !cuentasCsvFile || cuentasLoading ? colors.background : colors.primary,
                color: !cuentasCsvFile || cuentasLoading ? colors.textSecondary : 'white',
                fontWeight: 900,
                opacity: !cuentasCsvFile || cuentasLoading ? 0.7 : 1
              }}
            >
              Guardar en Supabase
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {[
              { key: 'etiquetas', label: 'Etiquetes separades per -' },
              { key: 'compteCarrega', label: 'Compte de càrrega' },
            ].map((field) => (
              <div key={field.key} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>{field.label}</div>
                <input
                  value={holdedNominasConfig[field.key] ?? ''}
                  onChange={(e) => setHoldedNominasConfig((p) => ({ ...p, [field.key]: e.target.value }))}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    color: colors.text,
                    outline: 'none'
                  }}
                />
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => debugOverflow('manual')}
              style={{
                border: `1px solid ${colors.border}`,
                outline: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 14px',
                borderRadius: '10px',
                cursor: 'pointer',
                background: colors.surface,
                color: colors.text,
                fontWeight: 600,
                fontSize: '13px',
              }}
              title="Imprime en consola el elemento que provoca overflow horizontal"
            >
              <AlertCircle size={16} />
              Debug overflow
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            background: colors.card,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxShadow: '0 4px 14px rgba(0,0,0,0.07)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <h3 style={{ margin: 0, color: colors.text, fontSize: '20px', fontWeight: 700 }}>Archivo de Innuva</h3>
              <span style={{ color: colors.textSecondary, fontSize: '14px' }}>
                Aceptamos formatos `.xlsx`, `.xls` y `.csv`. El archivo no se envía a servidores externos, todo se procesa localmente.
              </span>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleFileButtonClick}
                disabled={isProcessing}
                style={{
                  border: 'none',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '12px 18px',
                  borderRadius: '10px',
                  cursor: isProcessing ? 'not-allowed' : 'pointer',
                  background: colors.primary,
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '14px',
                  boxShadow: '0 3px 10px rgba(76, 175, 80, 0.25)',
                  opacity: isProcessing ? 0.7 : 1,
                }}
              >
                <UploadCloud size={18} />
                {isProcessing ? 'Procesando...' : 'Seleccionar archivo'}
              </motion.button>

              {hasData && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReset}
                  style={{
                    border: `1px solid ${colors.border}`,
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    background: colors.surface,
                    color: colors.text,
                    fontWeight: 500,
                    fontSize: '14px',
                  }}
                >
                  <RefreshCw size={16} />
                  Reiniciar
                </motion.button>
              )}
            </div>
          </div>

          {innuvaFile && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '18px',
                background: colors.surface,
                border: `1px dashed ${colors.border}`,
                padding: '18px',
                borderRadius: '12px',
              }}
            >
              <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Archivo seleccionado
                </span>
                <span style={{ color: colors.text, fontWeight: 600, fontSize: '15px' }}>
                  {innuvaFile.name}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Tamaño
                </span>
                <span style={{ color: colors.text, fontWeight: 500, fontSize: '15px' }}>
                  {formatFileSize(innuvaFile.size)}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <span style={{ color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Última modificación
                </span>
                <span style={{ color: colors.text, fontWeight: 500, fontSize: '15px' }}>
                  {new Date(innuvaFile.lastModified).toLocaleString('es-ES')}
                </span>
              </div>
            </div>
          )}

          <AnimatePresence>
            {error && (
              <motion.div
                key="innuva-error"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  background: colors.error + '15',
                  border: `1px solid ${colors.error}55`,
                  borderRadius: '10px',
                  padding: '16px',
                  color: colors.error,
                }}
              >
                <AlertCircle size={18} style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px' }}>No se pudo procesar el archivo</div>
                  <div style={{ fontSize: '13px', color: colors.error }}>
                    {error}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <AnimatePresence>
          {hasData && (
            <motion.div
              key="preview-section"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.25 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '100%', overflowX: 'hidden', minWidth: 0 }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
                  minWidth: 0,
                }}
              >
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Registros leídos
                  </span>
                  <span style={{ color: colors.text, fontSize: '26px', fontWeight: 700 }}>
                    {rawRows.length.toLocaleString('es-ES')}
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                    Filas detectadas en la primera hoja del Excel de Innuva.
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.08 }}
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Columnas detectadas
                  </span>
                  <span style={{ color: colors.text, fontSize: '26px', fontWeight: 700 }}>
                    {headers.length}
                  </span>
                  <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                    Estas cabeceras se usarán como referencia inicial hasta definir el mapeo a Holded.
                  </span>
                </motion.div>

                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, delay: 0.16 }}
                  style={{
                    background: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '14px',
                    padding: '20px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.06)',
                    minWidth: 0,
                  }}
                >
                  <span style={{ color: colors.textSecondary, fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                    Estado del mapeo
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <AlertCircle size={18} color={colors.warning} />
                    <span style={{ color: colors.warning, fontSize: '15px', fontWeight: 600 }}>Pendiente de definir</span>
                  </div>
                  <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                    Cuando recibamos los formatos, vincularemos cada columna de Innuva con su campo de Holded.
                  </span>
                </motion.div>
              </div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '16px',
                  padding: '20px 20px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: colors.text, fontSize: '18px', fontWeight: 700 }}>
                      Vista previa de Innuva
                    </h3>
                    <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                      Primeras {Math.min(previewSourceRows.length, MAX_PREVIEW_ROWS)} filas detectadas. Columnas originales del Excel.
                    </span>
                  </div>
                </div>

                <div style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr>
                        {headers.map((header) => (
                          <th
                            key={header}
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              background: colors.surface,
                              borderBottom: `1px solid ${colors.border}`,
                              color: colors.textSecondary,
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewSourceRows.map((row) => (
                        <tr key={row.__rowIndex} style={{ background: colors.background }}>
                          {headers.map((header) => (
                            <td
                              key={`${row.__rowIndex}-${header}`}
                              style={{
                                padding: '10px 12px',
                                borderBottom: `1px solid ${colors.border}`,
                                color: colors.text,
                                fontSize: '13px',
                                maxWidth: '220px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={row[header]}
                            >
                              {row[header] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '16px',
                  padding: '20px 20px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div>
                    <h3 style={{ margin: 0, color: colors.text, fontSize: '18px', fontWeight: 700 }}>
                      Borrador para Holded
                    </h3>
                    <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                      Vista previa temporal. En cuanto definamos el mapeo, las columnas se ajustarán al formato definitivo de Holded.
                    </span>
                  </div>
                  <motion.button
                    whileHover={{ scale: holdedDraft.length ? 1.02 : 1 }}
                    whileTap={{ scale: holdedDraft.length ? 0.97 : 1 }}
                    disabled={!holdedDraft.length}
                    onClick={handleDownloadDraft}
                    style={{
                      border: 'none',
                      outline: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '11px 16px',
                      borderRadius: '10px',
                      cursor: holdedDraft.length ? 'pointer' : 'not-allowed',
                      background: holdedDraft.length ? colors.success : colors.surface,
                      color: holdedDraft.length ? '#fff' : colors.textSecondary,
                      fontWeight: 600,
                      fontSize: '14px',
                      opacity: holdedDraft.length ? 1 : 0.6,
                      boxShadow: holdedDraft.length ? '0 3px 10px rgba(40,167,69,0.22)' : 'none',
                    }}
                  >
                    <DownloadCloud size={18} />
                    Descargar borrador
                  </motion.button>
                </div>

                <div style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '600px' }}>
                    <thead>
                      <tr>
                        {Object.keys(holdedDraft[0] || {}).map((header) => (
                          <th
                            key={`holded-header-${header}`}
                            style={{
                              textAlign: 'left',
                              padding: '10px 12px',
                              background: colors.surface,
                              borderBottom: `1px solid ${colors.border}`,
                              color: colors.textSecondary,
                              fontSize: '12px',
                              textTransform: 'uppercase',
                              letterSpacing: '0.05em',
                            }}
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewHoldedRows.map((row, index) => (
                        <tr key={`holded-row-${index}`} style={{ background: colors.background }}>
                          {Object.keys(holdedDraft[0] || {}).map((header) => (
                            <td
                              key={`holded-${index}-${header}`}
                              style={{
                                padding: '10px 12px',
                                borderBottom: `1px solid ${colors.border}`,
                                color: colors.text,
                                fontSize: '13px',
                                maxWidth: '220px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={row[header]}
                            >
                              {row[header] ?? ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {!holdedDraft.length && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      background: colors.warning + '12',
                      border: `1px dashed ${colors.warning}55`,
                      borderRadius: '10px',
                      padding: '14px',
                    }}
                  >
                    <AlertCircle size={18} color={colors.warning} />
                    <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                      Aún no tenemos columnas de destino. Necesitamos los formatos de Innuva y Holded para completar el mapeo.
                    </span>
                  </div>
                )}
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                style={{
                  background: colors.card,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '16px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 4px 14px rgba(0,0,0,0.06)',
                }}
              >
                <h3 style={{ margin: 0, color: colors.text, fontSize: '18px', fontWeight: 700 }}>
                  Registro de acciones
                </h3>
                <div style={{ color: colors.textSecondary, fontSize: '13px' }}>
                  Seguimiento de los pasos realizados durante la conversión.
                </div>
                <div
                  style={{
                    maxHeight: '220px',
                    overflowY: 'auto',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                  }}
                >
                  {conversionLog.length === 0 ? (
                    <div
                      style={{
                        padding: '18px',
                        color: colors.textSecondary,
                        fontSize: '13px',
                        textAlign: 'center',
                      }}
                    >
                      Aún no hay eventos registrados.
                    </div>
                  ) : (
                    conversionLog
                      .slice()
                      .reverse()
                      .map((entry) => {
                        const isSuccess = entry.type === 'success';
                        const isError = entry.type === 'error';
                        const iconColor = isError
                          ? colors.error
                          : isSuccess
                            ? colors.success
                            : colors.primary;

                        const IconComponent = isError ? AlertCircle : isSuccess ? CheckCircle : RefreshCw;

                        return (
                          <div
                            key={entry.id}
                            style={{
                              padding: '14px 18px',
                              display: 'flex',
                              gap: '12px',
                              alignItems: 'flex-start',
                              borderBottom: `1px solid ${colors.border}`,
                              background: 'transparent',
                            }}
                          >
                            <IconComponent size={18} color={iconColor} style={{ marginTop: '2px' }} />
                            <div style={{ flex: 1 }}>
                              <div style={{ color: colors.text, fontSize: '14px', fontWeight: 500 }}>
                                {entry.message}
                              </div>
                              <div style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '4px' }}>
                                {entry.timestamp.toLocaleString('es-ES')}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default InnuvaConverterPage;

