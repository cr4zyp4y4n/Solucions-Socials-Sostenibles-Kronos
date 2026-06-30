import { normalizeCodigo } from '../../services/nominasCuentasService';

export const DEFAULT_HOLDED_NOMINAS_CONFIG = {
  salarioCompte640: '64000000',
  totalSsCompte476: '47600000',
  gastoSsEmpresaCompte642: '64200000',
  irpfCompte4751: '47510000'
};

export const MAX_PREVIEW_ROWS = 10;

export const HOLDEN_NOMINAS_PREVIEW_HEADERS = [
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
  'Import del pagament'
];

export const HOLDEN_NOMINAS_EXPORT_HEADERS = [...HOLDEN_NOMINAS_PREVIEW_HEADERS];

import { EMPRESAS_NOMINAS } from '../../services/nominasCuentasService';

export const INNUVA_EMPRESA_OPTIONS = [
  { key: EMPRESAS_NOMINAS.SOLUCIONS, title: 'Solucions Socials', subtitle: 'EI SSS SCCL' },
  { key: EMPRESAS_NOMINAS.MENJAR_DHORT, title: "Menjar d'Hort", subtitle: "Menjar d'Hort SCCL" }
];

export const parseEsNumber = (value) => {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const s = String(value).replace(/\u00a0/g, ' ').trim();
  if (!s) return 0;
  if (s.includes('-   €') || s === '-') return 0;
  const negative = s.startsWith('-');
  const raw = s.replace(/€/g, '').replace(/\s/g, '');
  const hasComma = raw.includes(',');

  if (hasComma && raw.includes('.')) {
    const lastDot = raw.lastIndexOf('.');
    const lastComma = raw.lastIndexOf(',');
    const isDotDecimal = lastDot > lastComma;
    const cleaned = (isDotDecimal
      ? raw.replace(/,/g, '')
      : raw.replace(/\./g, '').replace(',', '.')
    ).replace(/[^0-9.\-]/g, '');
    const n = Number.parseFloat(cleaned);
    if (!Number.isFinite(n)) return 0;
    return negative ? -Math.abs(n) : n;
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

export const toDdMmYyyy = (isoOrDdMmYyyy) => {
  const s = String(isoOrDdMmYyyy || '').trim();
  if (!s) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s;
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return s;
};

export const monthNameEs = (monthIndex1to12) => {
  const names = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  const idx = Number(monthIndex1to12) - 1;
  return names[idx] || '';
};

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export function parseInnuvaNominasCsv(csvText) {
  const lines = String(csvText || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .filter((l) => l !== undefined);
  const rows = lines.map((l) => l.split(';').map((c) => c.trim()));

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
  const idxCodigoHeader = headerRow.findIndex((c) => /^(c[oó]digo|cod\.?|codi)$/i.test(String(c || '').trim()));
  const idxCodigo = idxCodigoHeader >= 0 ? idxCodigoHeader : idxTrabajador >= 0 ? idxTrabajador - 1 : -1;

  const out = [];
  for (let i = headerRowIndex + 1; i < rows.length; i++) {
    const r = rows[i] || [];
    const all = r.join('').trim();
    if (!all) continue;

    const nif = idxNif >= 0 ? (r[idxNif] || '') : '';
    const trabajador = idxTrabajador >= 0 ? (r[idxTrabajador] || '') : '';
    const isTotalsFooter =
      !nif &&
      !trabajador &&
      (/^total\b/i.test(String(r[0] || '').trim()) || /^total\b/i.test(String(r[2] || '').trim()));
    if (isTotalsFooter) {
      break;
    }
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

export const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function mapInnuvaRowsToHolded({
  rows,
  meta,
  cuentasByCodigo,
  holdedNominasConfig
}) {
  const dataDate = toDdMmYyyy(meta?.periodEnd || meta?.periodStart || '');
  const periodEnd = meta?.periodEnd || meta?.periodStart || '';
  const mPeriod = String(periodEnd).match(/^\d{2}\/(\d{2})\/(\d{4})$/);
  const monthLabel = mPeriod ? `${monthNameEs(mPeriod[1])} ${mPeriod[2]}`.trim() : '';

  const mapped = (rows || []).map((r) => {
    const salario = round2(r.bruto || 0);
    const ssTrab = round2(r.ssTrabajador || 0);
    const ssEmp = round2(r.ssEmpresa || 0);
    const totalSs = round2(Math.abs(ssTrab) + Math.abs(ssEmp));
    const gastoSsEmpresa = round2(Math.abs(ssEmp));
    const irpf = round2(Math.abs(r.irpf || 0));
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
      Salario: salario,
      'Salario Compte (640)': salario640,
      'Total S.S.': totalSs,
      'Total S.S. Compte (476)': total476,
      'Gasto S.S. Empresa': gastoSsEmpresa,
      'Gasto S.S. Empresa Compte (642)': gasto642,
      IRPF: irpf,
      'IRPF Compte (4751)': irpf4751,
      'Import del pagament': importePagament
    };
  });

  const groupedByNif = new Map();
  for (const row of mapped) {
    const nifKey = String(row["Document d'identificació"] || '').trim();
    if (!nifKey) continue;

    const prev = groupedByNif.get(nifKey);
    if (!prev) {
      groupedByNif.set(nifKey, { ...row, __count: 1 });
      continue;
    }

    prev.__count += 1;
    prev.Salario = round2((prev.Salario || 0) + (row.Salario || 0));
    prev['Total S.S.'] = round2((prev['Total S.S.'] || 0) + (row['Total S.S.'] || 0));
    prev['Gasto S.S. Empresa'] = round2((prev['Gasto S.S. Empresa'] || 0) + (row['Gasto S.S. Empresa'] || 0));
    prev.IRPF = round2((prev.IRPF || 0) + (row.IRPF || 0));
    prev['Import del pagament'] = round2((prev['Import del pagament'] || 0) + (row['Import del pagament'] || 0));

    if (prev.__count > 1) {
      const base = String(prev.Descripció || '').replace(/\s*\(x\d+\)\s*$/i, '').trim();
      prev.Descripció = `${base} (x${prev.__count})`;
    }
  }

  return Array.from(groupedByNif.values()).map(({ __count, ...r }) => {
    const obj = {};
    HOLDEN_NOMINAS_PREVIEW_HEADERS.forEach((h) => {
      obj[h] = r[h] ?? '';
    });
    return obj;
  });
}
