import { supabase } from '../config/supabase';

const TABLE = 'nominas_cuentas_empleados';

const normalizeCodigo = (codigo) => {
  const s = String(codigo ?? '').trim();
  if (!s) return '';
  const n = Number.parseInt(s.replace(/^0+/, '') || '0', 10);
  return Number.isFinite(n) ? String(n) : s.replace(/^0+/, '');
};

export async function loadNominasCuentasEmpleados() {
  const { data, error } = await supabase.from(TABLE).select('*');
  if (error) throw error;
  return data || [];
}

export async function upsertNominasCuentasEmpleados(rows = []) {
  const payload = (Array.isArray(rows) ? rows : [])
    .map((r) => ({
      codigo_innuva: normalizeCodigo(r.codigo_innuva ?? r.codigo ?? r.CODIGO ?? ''),
      trabajador: r.trabajador ?? r.TRABAJADOR ?? null,
      salario_compte_640: String(r.salario_compte_640 ?? r['Salario Compte (640)'] ?? r.salario640 ?? '').trim(),
      total_ss_compte_476: String(r.total_ss_compte_476 ?? r['Total S.S. Compte (476)'] ?? r.total476 ?? '').trim(),
      gasto_ss_empresa_compte_642: String(
        r.gasto_ss_empresa_compte_642 ?? r['Gasto S.S. Empresa Compte (642)'] ?? r.gasto642 ?? ''
      ).trim(),
      irpf_compte_4751: String(r.irpf_compte_4751 ?? r['IRPF Compte (4751)'] ?? r.irpf4751 ?? '').trim()
    }))
    .filter(
      (p) =>
        p.codigo_innuva &&
        p.salario_compte_640 &&
        p.total_ss_compte_476 &&
        p.gasto_ss_empresa_compte_642 &&
        p.irpf_compte_4751
    );

  if (payload.length === 0) return { upserted: 0 };

  const { data, error } = await supabase
    .from(TABLE)
    .upsert(payload, { onConflict: 'codigo_innuva' })
    .select('codigo_innuva');
  if (error) throw error;
  return { upserted: (data || []).length };
}

export function buildNominasCuentasIndex(rows = []) {
  const map = new Map();
  for (const r of rows || []) {
    const key = normalizeCodigo(r.codigo_innuva);
    if (!key) continue;
    map.set(key, {
      codigo: key,
      trabajador: r.trabajador || '',
      salario640: r.salario_compte_640,
      total476: r.total_ss_compte_476,
      gasto642: r.gasto_ss_empresa_compte_642,
      irpf4751: r.irpf_compte_4751
    });
  }
  return map;
}

export { normalizeCodigo };

