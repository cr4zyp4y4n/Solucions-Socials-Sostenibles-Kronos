import React, { useCallback, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, Download, RefreshCw, AlertCircle, CheckCircle, Users, Upload } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { usePrivacy } from './PrivacyContext';
import { applyPrivacyMoney } from '../utils/privacyFormat';
import SectionHeader from './SectionHeader';
import {
  buildBrechaDataset,
  computeBrechaStats,
  filterRowsForBrechaExport
} from '../services/brechaSalarialService';
import { parseNominasCsvText } from '../services/brechaNominasCsvService';
import { buildBrechaSalarialWorkbook, downloadBrechaWorkbook } from '../utils/brechaSalarialExcel';
import { BRECHA_CATEGORIA_ORDER } from '../constants/brechaSalarialCategories';
import { upsertBrechaCategoriaSupabase } from '../services/brechaCategoriaSupabaseService';

const ENTITY_OPTIONS = [
  { id: 'EI_SSS', label: 'EI SSS (Solucions)', company: 'solucions' },
  { id: 'MENJAR_DHORT', label: "Menjar d'Hort", company: 'menjar' }
];

function formatEuroBase(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(n);
}

function formatPct(n) {
  if (n == null || !Number.isFinite(n)) return '—';
  return `${n.toFixed(2)} %`;
}

export default function BrechaSalarialPage() {
  const { colors } = useTheme();
  const { hideSensitiveData } = usePrivacy();
  const formatEuro = useCallback(
    (n) => applyPrivacyMoney(formatEuroBase(n), hideSensitiveData),
    [hideSensitiveData]
  );
  const currentYear = new Date().getFullYear();
  const [entity, setEntity] = useState('EI_SSS');
  const [year, setYear] = useState(currentYear - 1);
  const [soloActivos, setSoloActivos] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dataset, setDataset] = useState(null);
  const [nominasCsvMap, setNominasCsvMap] = useState(null);
  const [nominasCsvName, setNominasCsvName] = useState('');
  const [savingCategoriaId, setSavingCategoriaId] = useState('');

  const entityOpt = ENTITY_OPTIONS.find((o) => o.id === entity) || ENTITY_OPTIONS[0];
  const stats = useMemo(() => (dataset?.rows ? computeBrechaStats(dataset.rows) : null), [dataset]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = await buildBrechaDataset({
        company: entityOpt.company,
        year,
        soloActivos,
        useV2: false,
        nominasCsvMap
      });
      setDataset(result);
      if (result.warnings?.length) {
        setError('');
      }
    } catch (e) {
      setError(e?.message || 'Error al cargar datos de Holded');
      setDataset(null);
    } finally {
      setLoading(false);
    }
  }, [entityOpt.company, year, soloActivos, nominasCsvMap]);

  const onNominasCsv = useCallback(async (file) => {
    if (!file) {
      setNominasCsvMap(null);
      setNominasCsvName('');
      return;
    }
    try {
      const text = await file.text();
      const map = parseNominasCsvText(text);
      setNominasCsvMap(map);
      setNominasCsvName(file.name);
      if (!map.size) setError('El CSV no tiene filas con bruto reconocible (DNI/nombre + importe).');
      else setError('');
    } catch (e) {
      setError(e?.message || 'Error leyendo CSV');
    }
  }, []);

  const setCategoria = useCallback(
    async (row, cat) => {
      setSavingCategoriaId(row.id);
      setError('');
      const res = await upsertBrechaCategoriaSupabase({
        empresa: entityOpt.company,
        nombreCompleto: row.nombreCompleto,
        categoriaFuncion: cat,
        holdedEmployeeId: row.id
      });
      setSavingCategoriaId('');
      if (!res.success) {
        setError(res.error || 'No se pudo guardar en Supabase');
        return;
      }
      await loadData();
    },
    [entityOpt.company, loadData]
  );

  const rowsForExport = useMemo(() => {
    if (!dataset?.rows) return [];
    return filterRowsForBrechaExport(dataset.rows);
  }, [dataset]);

  const generateExcel = useCallback(() => {
    if (!rowsForExport.length) {
      setError(
        dataset?.rows?.length
          ? 'Ningún empleado con salario > 0 para exportar. Revisa nóminas/CSV/contrato.'
          : 'Primero carga los datos desde Holded.'
      );
      return;
    }
    const wb = buildBrechaSalarialWorkbook({
      rows: rowsForExport,
      meta: dataset.meta,
      empresaLabel: entityOpt.label
    });
    const safeName = entityOpt.label.replace(/[^\w\d]+/g, '_');
    downloadBrechaWorkbook(wb, `Brecha_Salarial_${safeName}_${year}.xlsx`);
  }, [dataset, entityOpt.label, year, stats, rowsForExport]);

  const canGenerate = dataset?.rows?.length > 0 && !loading;

  return (
    <div style={{ padding: 24, maxWidth: 1200, margin: '0 auto' }}>
      <SectionHeader
        icon={Scale}
        title="Brecha salarial"
        subtitle={(
          <span>
            Función desde <b>Supabase</b>. Salarios: nóminas API v1 (módulo nóminas Holded, no la ficha empleado) o CSV de
            brutos. Sin nómina API → contrato en Holded (Bruno/Joan suelen no tener contrato en team/v1).
          </span>
        )}
      />

      {error ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${colors.error}`,
            background: `${colors.error}18`,
            display: 'flex',
            gap: 10,
            alignItems: 'center'
          }}
        >
          <AlertCircle size={18} color={colors.error} />
          <div>{error}</div>
        </motion.div>
      ) : null}

      {dataset?.warnings?.length ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          style={{
            marginBottom: 14,
            padding: 12,
            borderRadius: 10,
            border: `1px solid ${colors.primary}`,
            background: `${colors.primary}14`,
            fontSize: 13,
            lineHeight: 1.45,
            color: colors.text
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertCircle size={16} color={colors.primary} />
            Avisos Holded
          </div>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {dataset.warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </motion.div>
      ) : null}

      <div style={{ display: 'grid', gap: 12, maxWidth: 720 }}>
        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 10 }}>Empresa</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {ENTITY_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setEntity(opt.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  border: `1px solid ${entity === opt.id ? colors.primary : colors.border}`,
                  background: entity === opt.id ? colors.primary : colors.background,
                  color: entity === opt.id ? 'white' : colors.text,
                  fontWeight: 950,
                  cursor: 'pointer'
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 10 }}>Año de referencia (nóminas)</div>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            style={{
              padding: '10px 12px',
              borderRadius: 10,
              border: `1px solid ${colors.border}`,
              background: colors.background,
              color: colors.text,
              fontWeight: 800,
              minWidth: 120
            }}
          >
            {[currentYear, currentYear - 1, currentYear - 2].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: 13, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={soloActivos}
              onChange={(e) => setSoloActivos(e.target.checked)}
            />
            Solo empleados activos
          </label>
        </div>

        <div style={{ padding: 14, borderRadius: 12, border: `1px solid ${colors.border}`, background: colors.surface }}>
          <div style={{ fontSize: 13, fontWeight: 950, marginBottom: 8 }}>CSV nóminas (opcional)</div>
          <p style={{ fontSize: 12, color: colors.textSecondary, margin: '0 0 10px', lineHeight: 1.4 }}>
            Si la API de nóminas devuelve 403, sube un export con DNI o nombre y bruto anual/mensual. Tiene prioridad
            sobre el salario de contrato.
          </p>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              borderRadius: 10,
              cursor: 'pointer',
              border: `1px solid ${colors.border}`,
              background: colors.background,
              fontWeight: 900
            }}
          >
            <Upload size={18} />
            {nominasCsvName || 'Seleccionar CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => onNominasCsv(e.target.files?.[0] || null)}
            />
          </label>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 14px',
              borderRadius: 10,
              cursor: loading ? 'not-allowed' : 'pointer',
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              fontWeight: 950,
              opacity: loading ? 0.7 : 1
            }}
          >
            <RefreshCw size={18} />
            {loading ? 'Cargando Holded…' : 'Cargar datos'}
          </button>
          <button
            type="button"
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

      <AnimatePresence>
        {dataset ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{ marginTop: 24 }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: 12,
                marginBottom: 16
              }}
            >
              {[
                { label: 'Empleados', value: dataset.meta.totalEmpleados, icon: Users },
                { label: 'Con género H/M', value: dataset.meta.conGenero, icon: CheckCircle },
                { label: 'Con salario', value: dataset.meta.conSalario, icon: CheckCircle },
                { label: 'Brecha media', value: formatPct(stats?.brechaMediaPct), icon: Scale }
              ].map((kpi) => (
                <div
                  key={kpi.label}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: `1px solid ${colors.border}`,
                    background: colors.surface
                  }}
                >
                  <kpi.icon size={20} color={colors.primary} style={{ marginBottom: 8 }} />
                  <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 700 }}>{kpi.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 950, color: colors.text }}>{kpi.value}</div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 12 }}>
              Fuente: <b>{dataset.meta.dataSource}</b>
              {dataset.meta.payrollRecords
                ? ` · ${dataset.meta.payrollRecords} nóminas`
                : ' · sin nóminas API'}
              {dataset.meta.desdeNomina != null
                ? ` · ${dataset.meta.desdeNomina} desde nómina, ${dataset.meta.desdeContrato} desde contrato`
                : ''}
            </div>
            <div
              style={{
                overflow: 'auto',
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.surface
              }}
            >
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: colors.primary, color: 'white' }}>
                    {['Nombre', 'Función (Supabase)', 'Género', '€/hora', 'Bruto mensual', 'Origen'].map((h) => (
                      <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 800 }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dataset.rows.map((r) => (
                    <tr key={r.id || r.numero} style={{ borderTop: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '8px 12px' }}>{r.nombreCompleto}</td>
                      <td style={{ padding: '8px 12px' }}>
                        <select
                          value={r.categoriaFuncion || 'OTROS'}
                          disabled={savingCategoriaId === r.id}
                          onChange={(e) => setCategoria(r, e.target.value)}
                          style={{
                            padding: '6px 8px',
                            borderRadius: 8,
                            border: `1px solid ${colors.border}`,
                            background: colors.background,
                            color: colors.text,
                            fontSize: 12,
                            maxWidth: 160
                          }}
                        >
                          {BRECHA_CATEGORIA_ORDER.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td style={{ padding: '8px 12px' }}>{r.genero}</td>
                      <td style={{ padding: '8px 12px', fontWeight: 800 }}>{formatEuro(r.devengoHora)}</td>
                      <td style={{ padding: '8px 12px' }}>{formatEuro(r.salarioBrutoMensual)}</td>
                      <td style={{ padding: '8px 12px', color: colors.textSecondary }}>{r.origenDato}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: 10, fontSize: 12, color: colors.textSecondary }}>
                {dataset.rows.length} empleados · {dataset.meta?.categoriasSupabase ?? 0} categorías en Supabase · Los
                cambios de función se guardan en <b>brecha_empleados_categoria</b>.
              </div>
            </div>
            {stats ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 14,
                  borderRadius: 12,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  fontSize: 13,
                  lineHeight: 1.5
                }}
              >
                <b>Resumen calculado:</b> Media H {formatEuro(stats.mediaHombres)} · Media M{' '}
                {formatEuro(stats.mediaMujeres)} · Brecha media {formatPct(stats.brechaMediaPct)} · Brecha mediana{' '}
                {formatPct(stats.brechaMedianaPct)}
              </div>
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
