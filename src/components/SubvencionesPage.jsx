import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building,
  Calendar,
  CreditCard,
  Download,
  Euro,
  FileCheck,
  FileText,
  Layers,
  Search,
  ExternalLink,
  Upload,
  X
} from 'lucide-react';
import * as XLSX from 'xlsx';
import subvencionesService from '../services/subvencionesService';
import * as menjarDhortService from '../services/menjarDhortService';
import { useTheme } from './ThemeContext';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { useNavigation } from './NavigationContext';

const InfoField = ({ label, value, colors, icon, valueColor, fullWidth }) => {
  if (value === null || value === undefined || value === '') return null;

  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '600' }}>
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '14px',
          color: valueColor || colors.text,
          fontWeight: '600',
          wordBreak: 'break-word',
          overflowWrap: 'anywhere'
        }}
      >
        {icon ? <span style={{ color: colors.primary, display: 'inline-flex' }}>{icon}</span> : null}
        {value}
      </div>
    </div>
  );
};

export default function SubvencionesPage() {
  const { colors } = useTheme();
  const { navigateTo } = useNavigation();

  const [selectedEntity, setSelectedEntity] = useState('EI_SSS');
  const [subvencionesData, setSubvencionesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedSubvencion, setSelectedSubvencion] = useState(null);
  const [matrixPageStart, setMatrixPageStart] = useState(0);
  const [matrixVisibleCols, setMatrixVisibleCols] = useState(4);
  const [showRawJson, setShowRawJson] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editMode, setEditMode] = useState('edit'); // 'create' | 'edit'
  const [form, setForm] = useState(null);
  const [subvencionEmployeesById, setSubvencionEmployeesById] = useState({});
  const [empleadosCatalog, setEmpleadosCatalog] = useState([]);
  const [empleadosCatalogLoading, setEmpleadosCatalogLoading] = useState(false);
  const [empleadosSearch, setEmpleadosSearch] = useState('');
  const [hoverEmployeesForSubvencionId, setHoverEmployeesForSubvencionId] = useState(null);
  const [pendingOpenSubvencionId, setPendingOpenSubvencionId] = useState(null);

  // Abrir automáticamente una subvención desde navegación (por localStorage)
  useEffect(() => {
    const id = localStorage.getItem('selectedSubvencionId');
    if (id) {
      localStorage.removeItem('selectedSubvencionId');
      setPendingOpenSubvencionId(String(id));
      // La relación empleados↔subvención vive en EI_SSS; forzamos entidad para asegurar que exista.
      setSelectedEntity('EI_SSS');
    }
  }, []);

  const formatCurrency = useCallback((amount) => {
    const num = typeof amount === 'number' ? amount : 0;
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
  }, []);

  const parseNumberEs = useCallback((value) => {
    if (value === null || value === undefined) return 0;
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const str = String(value).trim();
    if (!str) return 0;
    // Permite formato ES: 1.234,56 y también 1234.56
    const normalized = str
      .replace(/\s/g, '')
      .replace(/€/g, '')
      .replace(/\./g, '')
      .replace(',', '.');
    const num = Number.parseFloat(normalized);
    return Number.isFinite(num) ? num : 0;
  }, []);

  const toInternalForSave = useCallback((f) => {
    const safe = f || {};
    return {
      nombre: String(safe.nombre || '').trim(),
      proyecto: String(safe.proyecto || '').trim(),
      imputacion: String(safe.imputacion || '').trim(),
      expediente: String(safe.expediente || '').trim(),
      codigo: String(safe.codigo || '').trim(),
      modalidad: String(safe.modalidad || '').trim(),
      fechaAdjudicacion: String(safe.fechaAdjudicacion || '').trim(),
      periodo: String(safe.periodo || '').trim(),
      estado: String(safe.estado || '').trim(),
      faseActual: safe.faseActual === '' || safe.faseActual === null || safe.faseActual === undefined
        ? null
        : Math.max(1, Math.min(8, Number(safe.faseActual))),
      // numéricos
      importeSolicitado: parseNumberEs(safe.importeSolicitado),
      importeOtorgado: parseNumberEs(safe.importeOtorgado),
      primerAbono: parseNumberEs(safe.primerAbono),
      segundoAbono: parseNumberEs(safe.segundoAbono),
      saldoPendiente: parseNumberEs(safe.saldoPendiente),
      importesPorCobrar: parseNumberEs(safe.importesPorCobrar),
      socL1Acomp: safe.socL1Acomp ?? '',
      socL2Contrat: safe.socL2Contrat ?? '',
      saldoPendienteTexto: String(safe.saldoPendienteTexto || '').trim(),
      previsionPago: String(safe.previsionPago || '').trim(),
      fechaJustificacion: String(safe.fechaJustificacion || '').trim(),
      revisadoGestoria: String(safe.revisadoGestoria || '').trim(),
      holdedAsentamiento: String(safe.holdedAsentamiento || '').trim(),
      fechaPrimerAbono: String(safe.fechaPrimerAbono || '').trim(),
      fechaSegundoAbono: String(safe.fechaSegundoAbono || '').trim()
    };
  }, [parseNumberEs]);

  const openCreate = useCallback(() => {
    setEditMode('create');
    setForm({
      nombre: '',
      proyecto: '',
      imputacion: '',
      expediente: '',
      codigo: '',
      modalidad: '',
      fechaAdjudicacion: '',
      periodo: '',
      estado: '',
      faseActual: '',
      importeSolicitado: '',
      importeOtorgado: '',
      socL1Acomp: '',
      socL2Contrat: '',
      primerAbono: '',
      fechaPrimerAbono: '',
      segundoAbono: '',
      fechaSegundoAbono: '',
      saldoPendiente: '',
      saldoPendienteTexto: '',
      previsionPago: '',
      fechaJustificacion: '',
      revisadoGestoria: '',
      holdedAsentamiento: '',
      importesPorCobrar: ''
    });
    setShowEditModal(true);
  }, []);

  const openEdit = useCallback((subvencion) => {
    if (!subvencion) return;
    setEditMode('edit');
    setForm({
      id: subvencion.id,
      nombre: subvencion.nombre || '',
      proyecto: subvencion.proyecto || '',
      imputacion: subvencion.imputacion || '',
      expediente: subvencion.expediente || '',
      codigo: subvencion.codigo || '',
      modalidad: subvencion.modalidad || '',
      fechaAdjudicacion: subvencion.fechaAdjudicacion || '',
      periodo: subvencion.periodo || '',
      estado: subvencion.estado || '',
      faseActual: subvencion.faseActual ?? '',
      importeSolicitado: subvencion.importeSolicitado ?? '',
      importeOtorgado: subvencion.importeOtorgado ?? '',
      socL1Acomp: subvencion.socL1Acomp ?? '',
      socL2Contrat: subvencion.socL2Contrat ?? '',
      primerAbono: subvencion.primerAbono ?? '',
      fechaPrimerAbono: subvencion.fechaPrimerAbono || '',
      segundoAbono: subvencion.segundoAbono ?? '',
      fechaSegundoAbono: subvencion.fechaSegundoAbono || '',
      saldoPendiente: subvencion.saldoPendiente ?? '',
      saldoPendienteTexto: subvencion.saldoPendienteTexto || '',
      previsionPago: subvencion.previsionPago || '',
      fechaJustificacion: subvencion.fechaJustificacion || '',
      revisadoGestoria: subvencion.revisadoGestoria || '',
      holdedAsentamiento: subvencion.holdedAsentamiento || '',
      importesPorCobrar: subvencion.importesPorCobrar ?? ''
    });
    setShowEditModal(true);
  }, []);

  const getEstadoFaseLabel = useCallback((subvencion) => {
    if (!subvencion) return '—';
    if (subvencion.faseActual && Number.isFinite(Number(subvencion.faseActual))) {
      const n = Number(subvencion.faseActual);
      if (n >= 1 && n <= 8) return `Fase ${n}`;
    }
    if (subvencion.fasesProyecto && typeof subvencion.fasesProyecto === 'object') {
      const maxN = subvencionesService.obtenerNumeroFaseMaximaDesdeMarcas(subvencion.fasesProyecto);
      if (maxN !== null) return `Fase ${maxN}`;
    }
    if (subvencion.estado && typeof subvencion.estado === 'string') {
      const mEst = subvencion.estado.match(/FASE\s*(\d+)/i);
      if (mEst) return `Fase ${mEst[1]}`;
    }
    if (subvencion.faseProyecto && typeof subvencion.faseProyecto === 'string') {
      const match = subvencion.faseProyecto.match(/FASE (\d+)/i);
      return match ? `Fase ${match[1]}` : subvencion.faseProyecto;
    }
    return '—';
  }, []);

  const loadSubvencionesData = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const service = selectedEntity === 'MENJAR_DHORT' ? menjarDhortService : subvencionesService;
      const data = await service.loadFromSupabase();
      const subvenciones = Array.isArray(data) ? data : [];
      setSubvencionesData(subvenciones);

      // Cargar relación empleados ↔ subvención (solo EI_SSS)
      if (selectedEntity === 'EI_SSS' && subvenciones.length > 0) {
        try {
          const rel = await subvencionesService.getEmpleadosBySubvencionIds(subvenciones.map((s) => s.id));
          const map = {};
          for (const r of rel) {
            const sid = r.subvencion_id;
            if (!map[sid]) map[sid] = [];
            map[sid].push(r);
          }
          setSubvencionEmployeesById(map);
        } catch (e) {
          console.error('Error cargando empleados por subvención:', e);
          setSubvencionEmployeesById({});
        }
      } else {
        setSubvencionEmployeesById({});
      }
    } catch (e) {
      console.error(e);
      setSubvencionesData([]);
      setError('Error cargando subvenciones.');
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  // Si venimos con un id “pendiente”, abrir su modal cuando ya tengamos data cargada
  useEffect(() => {
    if (!pendingOpenSubvencionId) return;
    if (loading) return;
    if (!Array.isArray(subvencionesData) || subvencionesData.length === 0) return;

    const found = subvencionesData.find((s) => String(s.id) === String(pendingOpenSubvencionId));
    if (found) {
      setSelectedSubvencion(found);
      setPendingOpenSubvencionId(null);
    }
  }, [loading, pendingOpenSubvencionId, subvencionesData]);

  const ensureEmployeesCatalogLoaded = useCallback(async () => {
    if (empleadosCatalogLoading) return;
    if (empleadosCatalog.length > 0) return;
    try {
      setEmpleadosCatalogLoading(true);
      const emps = await holdedEmployeesService.getEmployeesTransformed('solucions');
      setEmpleadosCatalog(Array.isArray(emps) ? emps : []);
    } catch (e) {
      console.error('Error cargando catálogo de empleados (Holded):', e);
      setEmpleadosCatalog([]);
    } finally {
      setEmpleadosCatalogLoading(false);
    }
  }, [empleadosCatalog.length, empleadosCatalogLoading]);

  const closeEditModal = useCallback(() => {
    setShowEditModal(false);
    setForm(null);
  }, []);

  const saveForm = useCallback(async () => {
    if (selectedEntity !== 'EI_SSS') {
      setError('Edición solo disponible para EI SSS por ahora.');
      return;
    }
    const payload = toInternalForSave(form);
    if (!payload.nombre) {
      setError('El campo "Nombre" es obligatorio.');
      return;
    }
    try {
      setLoading(true);
      setError('');
      if (editMode === 'create') {
        const created = await subvencionesService.createSubvencion(payload);
        await loadSubvencionesData();
        setSelectedSubvencion(created);
      } else {
        const id = form?.id;
        if (!id) throw new Error('Falta el id para editar.');
        const updated = await subvencionesService.updateSubvencion(id, payload);
        await loadSubvencionesData();
        setSelectedSubvencion(updated);
      }
      closeEditModal();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Error guardando la subvención.');
    } finally {
      setLoading(false);
    }
  }, [closeEditModal, editMode, form, loadSubvencionesData, selectedEntity, toInternalForSave]);

  const deleteSelected = useCallback(async (subvencion) => {
    if (selectedEntity !== 'EI_SSS') {
      setError('Eliminar solo disponible para EI SSS por ahora.');
      return;
    }
    if (!subvencion?.id) return;
    // eslint-disable-next-line no-alert
    const ok = window.confirm(`¿Eliminar la subvención "${subvencion.nombre}"?`);
    if (!ok) return;
    try {
      setLoading(true);
      setError('');
      await subvencionesService.deleteSubvencion(subvencion.id);
      setSelectedSubvencion(null);
      await loadSubvencionesData();
    } catch (e) {
      console.error(e);
      setError(e?.message || 'Error eliminando la subvención.');
    } finally {
      setLoading(false);
    }
  }, [loadSubvencionesData, selectedEntity]);

  useEffect(() => {
    setSearchTerm('');
    setSelectedSubvencion(null);
    setCsvFile(null);
    setMatrixPageStart(0);
    setShowRawJson(false);
    setEmpleadosSearch('');
    loadSubvencionesData();
  }, [loadSubvencionesData]);

  useEffect(() => {
    if (!selectedSubvencion) return;
    if (selectedEntity !== 'EI_SSS') return;
    // cuando abrimos modal, aseguramos catálogo de empleados
    ensureEmployeesCatalogLoaded();
  }, [ensureEmployeesCatalogLoaded, selectedEntity, selectedSubvencion]);

  const filteredData = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return subvencionesData;
    return subvencionesData.filter((s) => {
      const hay = `${s?.nombre || ''} ${s?.proyecto || ''} ${s?.imputacion || ''} ${s?.expediente || ''}`.toLowerCase();
      return hay.includes(term);
    });
  }, [subvencionesData, searchTerm]);

  const handleFileUpload = useCallback((event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.type === 'text/csv' || file.name.toLowerCase().endsWith('.csv')) {
      setCsvFile(file);
      setShowUploadModal(true);
      return;
    }
    setError('Selecciona un CSV válido.');
  }, []);

  const processCSVFile = useCallback(async () => {
    if (!csvFile) return;
    try {
      setLoading(true);
      setError('');
      const csvText = await csvFile.text();
      const service = selectedEntity === 'MENJAR_DHORT' ? menjarDhortService : subvencionesService;
      const processed = selectedEntity === 'MENJAR_DHORT'
        ? service.processHorizontalCSV(csvText)
        : service.processCSVData(csvText);
      await service.syncToSupabase(processed);
      setShowUploadModal(false);
      setCsvFile(null);
      await loadSubvencionesData();
    } catch (e) {
      console.error(e);
      setError('Error procesando CSV.');
    } finally {
      setLoading(false);
    }
  }, [csvFile, selectedEntity, loadSubvencionesData]);

  const exportToExcel = useCallback(() => {
    try {
      const wb = subvencionesService.exportToExcel(filteredData);
      XLSX.writeFile(wb, `Subvenciones_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      console.error(e);
      setError('Error exportando Excel.');
    }
  }, [filteredData]);

  const matrix = useMemo(() => {
    if (selectedEntity !== 'EI_SSS') return null;
    if (!filteredData?.length) return null;

    const columns = filteredData;
    const totalCols = columns.length;
    const visibleCount = Math.max(1, Math.min(matrixVisibleCols, totalCols));
    const safeStart = Math.max(0, Math.min(matrixPageStart, Math.max(0, totalCols - visibleCount)));
    const visibleColumns = columns.slice(safeStart, safeStart + visibleCount);
    const headerTitle = 'EI SOLUCIONS SOCIALS SOSTENIBLES SCCL - SUBVENCIONES ENTIDADES PÚBLICAS';

    const leftHeaderStyle = {
      position: 'sticky',
      left: 0,
      top: 0,
      zIndex: 4,
      background: colors.background,
      borderRight: `1px solid ${colors.border}`,
      borderBottom: `1px solid ${colors.border}`,
      width: 240,
      minWidth: 240,
      maxWidth: 240,
      padding: '10px 12px',
      textAlign: 'left',
      color: colors.text,
      fontWeight: 900,
      fontSize: 12,
      lineHeight: 1.2
    };

    const rowLabelStyle = {
      position: 'sticky',
      left: 0,
      zIndex: 3,
      background: colors.background,
      borderRight: `1px solid ${colors.border}`,
      borderBottom: `1px solid ${colors.border}`,
      width: 240,
      minWidth: 240,
      maxWidth: 240,
      padding: '8px 12px',
      textAlign: 'left',
      color: colors.textSecondary,
      fontWeight: 800,
      fontSize: 12
    };

    const colHeaderStyle = {
      position: 'sticky',
      top: 0,
      zIndex: 2,
      background: colors.background,
      borderBottom: `1px solid ${colors.border}`,
      borderRight: `1px solid ${colors.border}`,
      padding: '10px 12px',
      color: colors.text,
      fontWeight: 900,
      fontSize: 12,
      lineHeight: 1.25,
      verticalAlign: 'top',
      cursor: 'pointer',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere'
    };

    const cellStyle = {
      borderBottom: `1px solid ${colors.border}`,
      borderRight: `1px solid ${colors.border}`,
      padding: '8px 12px',
      color: colors.textSecondary,
      fontSize: 12,
      lineHeight: 1.35,
      verticalAlign: 'top',
      cursor: 'pointer',
      wordBreak: 'break-word',
      overflowWrap: 'anywhere'
    };

    const sectionStyle = {
      padding: '10px 12px',
      background: (colors.primary || '#3b82f6') + '14',
      color: colors.text,
      fontWeight: 950,
      fontSize: 12,
      textTransform: 'uppercase',
      borderBottom: `1px solid ${colors.border}`
    };

    const saldoPendienteCell = (s) => {
      if (s?.saldoPendienteTexto && String(s.saldoPendienteTexto).trim() !== '') return s.saldoPendienteTexto;
      if (s?.saldoPendiente && s.saldoPendiente !== 0) return formatCurrency(s.saldoPendiente);
      return '';
    };

    // Orden y etiquetas alineadas con el CSV original (Subvenciones EISSS)
    const empleadosResumenCell = (s) => {
      const rel = subvencionEmployeesById?.[s?.id] || [];
      if (!rel.length) return '';
      const counts = { presentado: 0, aceptado: 0, rechazado: 0 };
      for (const r of rel) {
        const st = (r.estado || 'presentado').toLowerCase();
        if (counts[st] !== undefined) counts[st] += 1;
      }
      const parts = [];
      if (counts.presentado) parts.push(`${counts.presentado} presentados`);
      if (counts.aceptado) parts.push(`${counts.aceptado} aceptados`);
      if (counts.rechazado) parts.push(`${counts.rechazado} rechazados`);
      const summary = parts.join(' · ');

      const grouped = { presentado: [], aceptado: [], rechazado: [] };
      for (const r of rel) {
        const st = (r.estado || 'presentado').toLowerCase();
        if (!grouped[st]) grouped[st] = [];
        grouped[st].push(r.empleado_nombre || r.empleado_holded_id);
      }

      const renderGroup = (label, items, color) => {
        if (!items || items.length === 0) return null;
        return (
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, fontWeight: 950, color, marginBottom: 6, textTransform: 'capitalize' }}>
              {label} ({items.length})
            </div>
            <div style={{ display: 'grid', gap: 4 }}>
              {items.slice(0, 12).map((name) => (
                <div key={`${label}_${name}`} style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.25 }}>
                  {name}
                </div>
              ))}
              {items.length > 12 ? (
                <div style={{ fontSize: 12, color: colors.textSecondary }}>
                  +{items.length - 12} más…
                </div>
              ) : null}
            </div>
          </div>
        );
      };

      return (
        <div
          style={{ position: 'relative' }}
          onMouseEnter={() => setHoverEmployeesForSubvencionId(s.id)}
          onMouseLeave={() => setHoverEmployeesForSubvencionId(null)}
        >
          <div style={{ fontWeight: 900, color: colors.textSecondary }}>
            {summary}
          </div>

          {hoverEmployeesForSubvencionId === s.id ? (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                marginTop: 8,
                zIndex: 50,
                minWidth: 280,
                maxWidth: 360,
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: 12,
                boxShadow: '0 12px 30px rgba(0,0,0,0.25)'
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 950, color: colors.text, marginBottom: 10 }}>
                Empleados
              </div>
              {renderGroup('aceptado', grouped.aceptado, colors.success)}
              {renderGroup('presentado', grouped.presentado, colors.primary)}
              {renderGroup('rechazado', grouped.rechazado, colors.error)}
            </div>
          ) : null}
        </div>
      );
    };

    const rows = [
      { kind: 'section', label: 'INFORMACION' },
      { kind: 'row', label: 'PROYECTO', render: (s) => s.proyecto || '' },
      { kind: 'row', label: 'IMPUTACIÓN', render: (s) => s.imputacion || '' },
      { kind: 'row', label: 'No. EXPEDIENTE', render: (s) => s.expediente || '' },
      { kind: 'row', label: 'COD. SUBVENCIÓN -ORDEN', render: (s) => s.codigo || '' },
      { kind: 'row', label: 'MODALIDAD', render: (s) => s.modalidad || '' },
      { kind: 'row', label: 'FECHA POSTULACIÓN (BRUNO)', render: (s) => s.fechaAdjudicacion || '' },
      { kind: 'row', label: 'IMPORTE SOLICITADO', render: (s) => (s.importeSolicitado ? formatCurrency(s.importeSolicitado) : '') },
      { kind: 'row', label: 'PERIODO DE EJECUCIÓN', render: (s) => s.periodo || '' },
      { kind: 'row', label: 'IMPORTE OTORGADO', render: (s) => (s.importeOtorgado ? formatCurrency(s.importeOtorgado) : '') },
      { kind: 'row', label: 'SOC: L1  ACOMP', render: (s) => s.socL1Acomp || '' },
      { kind: 'row', label: 'SOC: L2 CONTRAT. TRABAJ', render: (s) => s.socL2Contrat || '' },
      { kind: 'row', label: '1r ABONO', render: (s) => (s.primerAbono ? formatCurrency(s.primerAbono) : '') },
      { kind: 'row', label: 'FECHA/CTA', render: (s) => s.fechaPrimerAbono || '' },
      { kind: 'row', label: '2o ABONO', render: (s) => (s.segundoAbono ? formatCurrency(s.segundoAbono) : '') },
      { kind: 'row', label: 'FECHA/CTA', render: (s) => s.fechaSegundoAbono || '' },
      { kind: 'row', label: 'SALDO PDTE DE ABONO', render: (s) => saldoPendienteCell(s) },
      { kind: 'row', label: 'PREVISIÓN PAGO TOTAL', render: (s) => s.previsionPago || '' },
      { kind: 'row', label: 'FECHA JUSTIFICACIÓN', render: (s) => s.fechaJustificacion || '' },
      { kind: 'row', label: 'EMPLEADOS', render: (s) => empleadosResumenCell(s) },
      { kind: 'row', label: 'ESTADO', render: (s) => s.estado || getEstadoFaseLabel(s) },
      { kind: 'row', label: 'HOLDED ASENTAM.', render: (s) => s.holdedAsentamiento || '' },
      { kind: 'row', label: 'IMPORTES POR COBRAR', render: (s) => (s.importesPorCobrar ? formatCurrency(s.importesPorCobrar) : '') }
    ];

    return (
      <div style={{ width: '100%', maxWidth: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '10px 12px',
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            background: colors.surface,
            marginBottom: 10,
            flexWrap: 'wrap'
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 900, color: colors.text }}>
            Columnas: {safeStart + 1}-{Math.min(totalCols, safeStart + visibleCount)} de {totalCols}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <select
              value={matrixVisibleCols}
              onChange={(e) => {
                const next = Number(e.target.value) || 4;
                setMatrixVisibleCols(next);
                setMatrixPageStart(0);
              }}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: colors.background,
                color: colors.text,
                fontWeight: 800,
                cursor: 'pointer'
              }}
            >
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  Ver {n}
                </option>
              ))}
            </select>

            <button
              onClick={() => setMatrixPageStart((s) => Math.max(0, s - visibleCount))}
              disabled={safeStart === 0}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                cursor: safeStart === 0 ? 'not-allowed' : 'pointer',
                border: `1px solid ${colors.border}`,
                background: colors.background,
                color: colors.text,
                fontWeight: 950,
                opacity: safeStart === 0 ? 0.5 : 1
              }}
            >
              ◀
            </button>
            <button
              onClick={() =>
                setMatrixPageStart((s) => Math.min(Math.max(0, totalCols - visibleCount), s + visibleCount))
              }
              disabled={safeStart + visibleCount >= totalCols}
              style={{
                padding: '8px 10px',
                borderRadius: 10,
                cursor: safeStart + visibleCount >= totalCols ? 'not-allowed' : 'pointer',
                border: `1px solid ${colors.border}`,
                background: colors.background,
                color: colors.text,
                fontWeight: 950,
                opacity: safeStart + visibleCount >= totalCols ? 0.5 : 1
              }}
            >
              ▶
            </button>
          </div>
        </div>

        <div
          style={{
            width: '100%',
            maxWidth: '100%',
            overflowY: 'visible',
            border: `1px solid ${colors.border}`,
            borderRadius: 12,
            boxSizing: 'border-box',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          <table
            style={{
              borderCollapse: 'separate',
              borderSpacing: 0,
              width: '100%',
              tableLayout: 'fixed',
              background: colors.surface
            }}
          >
            <thead>
              <tr>
                <th style={leftHeaderStyle}>{headerTitle}</th>
                {visibleColumns.map((s) => (
                  <th key={s.id} style={colHeaderStyle} onClick={() => setSelectedSubvencion(s)} title="Clica para ver detalles">
                    <div>{s.nombre}</div>
                    <div style={{ marginTop: 6, fontSize: 11, fontWeight: 950, color: colors.primary }}>
                      {getEstadoFaseLabel(s)}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                if (row.kind === 'section') {
                  return (
                    <tr key={`sec_${idx}`}>
                      <td colSpan={visibleColumns.length + 1} style={sectionStyle}>
                        {row.label}
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={`row_${idx}_${row.label}`}>
                    <th style={rowLabelStyle}>{row.label}</th>
                    {visibleColumns.map((s) => (
                      <td key={`${s.id}_${row.label}`} style={cellStyle} onClick={() => setSelectedSubvencion(s)} title="Clica para ver detalles">
                        {row.render(s)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }, [selectedEntity, filteredData, colors, formatCurrency, getEstadoFaseLabel, matrixPageStart, matrixVisibleCols, subvencionEmployeesById]);

  if (loading) {
    return (
      <div style={{ padding: 24, background: colors.background, minHeight: '100vh', color: colors.text }}>
        Cargando subvenciones…
      </div>
    );
  }

  return (
    <div style={{ padding: 24, background: colors.background, minHeight: '100vh', maxWidth: '100%', overflowX: 'hidden', boxSizing: 'border-box', color: colors.text }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <FileText size={28} color={colors.primary} />
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>Subvenciones</h1>
      </div>

      {error ? (
        <div style={{ marginBottom: 14, padding: 12, borderRadius: 10, border: `1px solid ${colors.error}`, background: colors.error + '18' }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <button
          onClick={() => setSelectedEntity('EI_SSS')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 10,
            cursor: 'pointer',
            border: selectedEntity === 'EI_SSS' ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            fontWeight: 900
          }}
        >
          <Building size={18} />
          EI SSS SCCL
        </button>
        <button
          onClick={() => setSelectedEntity('MENJAR_DHORT')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 10,
            cursor: 'pointer',
            border: selectedEntity === 'MENJAR_DHORT' ? `2px solid ${colors.primary}` : `1px solid ${colors.border}`,
            background: colors.surface,
            color: colors.text,
            fontWeight: 900
          }}
        >
          <Building size={18} />
          Menjar d'Hort
        </button>
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, padding: 14, marginBottom: 12, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 260px', minWidth: 220, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Search size={18} color={colors.textSecondary} />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar por nombre, proyecto, imputación, expediente…"
              style={{
                width: '100%',
                padding: '10px 10px',
                borderRadius: 10,
                border: `1px solid ${colors.border}`,
                background: colors.background,
                color: colors.text,
                outline: 'none',
                minWidth: 0
              }}
            />
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, fontWeight: 900 }}>
            <Upload size={18} />
            Cargar CSV
            <input type="file" accept=".csv" style={{ display: 'none' }} onChange={handleFileUpload} />
          </label>

          <button
            onClick={openCreate}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px',
              borderRadius: 10,
              cursor: 'pointer',
              border: `1px solid ${colors.primary}`,
              background: colors.primary,
              color: 'white',
              fontWeight: 950
            }}
            title="Crear una nueva subvención"
          >
            + Nueva subvención
          </button>

          <button
            onClick={exportToExcel}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, fontWeight: 900 }}
          >
            <Download size={18} />
            Exportar
          </button>
        </div>
      </div>

      <div style={{ marginBottom: 10, color: colors.textSecondary, fontSize: 13 }}>
        Mostrando {filteredData.length} subvenciones
      </div>

      <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 12, overflow: 'hidden' }}>
        {selectedEntity === 'EI_SSS' ? (
          matrix
        ) : (
          <div style={{ padding: 16, color: colors.textSecondary }}>
            Vista Menjar d&apos;Hort: pendiente de rehacer en matriz (por ahora la dejamos simple para no romper el layout).
          </div>
        )}
      </div>

      {showUploadModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: 16 }}>
          <div style={{ background: colors.surface, border: `1px solid ${colors.border}`, borderRadius: 14, width: '100%', maxWidth: 520, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontWeight: 950 }}>Importar CSV</div>
              <button onClick={() => setShowUploadModal(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: colors.text }}>
                <X />
              </button>
            </div>
            <div style={{ color: colors.textSecondary, fontSize: 13, marginBottom: 12 }}>
              Archivo: <span style={{ color: colors.text, fontWeight: 900 }}>{csvFile?.name || '—'}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowUploadModal(false)} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.border}`, background: colors.background, color: colors.text, fontWeight: 900 }}>
                Cancelar
              </button>
              <button onClick={processCSVFile} style={{ padding: '10px 12px', borderRadius: 10, cursor: 'pointer', border: `1px solid ${colors.primary}`, background: colors.primary, color: 'white', fontWeight: 950 }}>
                Importar
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedSubvencion && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2000,
            padding: '20px'
          }}
          onClick={() => {
            setSelectedSubvencion(null);
            setShowRawJson(false);
          }}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '28px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <FileCheck size={28} color={colors.primary} />
                <h2 style={{ fontSize: '24px', fontWeight: '800', margin: 0, color: colors.text }}>
                  Detalles de la Subvención
                </h2>
              </div>
              <button
                onClick={() => {
                  setSelectedSubvencion(null);
                  setShowRawJson(false);
                }}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px'
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </button>
            </div>

            {/* Título */}
            <div style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '18px', fontWeight: '900', color: colors.text, marginBottom: 6 }}>
                {selectedSubvencion.nombre}
              </div>
              <div style={{ fontSize: '14px', color: colors.textSecondary }}>
                {selectedSubvencion.proyecto || '—'}
              </div>
              <div style={{ marginTop: 10, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 999,
                    background: (colors.primary || '#3b82f6') + '22',
                    border: `1px solid ${colors.primary}`,
                    color: colors.primary,
                    fontWeight: 900,
                    fontSize: 12
                  }}
                >
                  <Layers size={14} />
                  {getEstadoFaseLabel(selectedSubvencion)}
                </div>
                {selectedSubvencion.estado ? (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      padding: '6px 10px',
                      borderRadius: 999,
                      background: colors.background,
                      border: `1px solid ${colors.border}`,
                      color: colors.text,
                      fontWeight: 900,
                      fontSize: 12
                    }}
                  >
                    {selectedSubvencion.estado}
                  </div>
                ) : null}

                <button
                  onClick={() => openEdit(selectedSubvencion)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: `1px solid ${colors.border}`,
                    background: colors.background,
                    color: colors.text,
                    fontWeight: 900,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Editar
                </button>
                <button
                  onClick={() => deleteSelected(selectedSubvencion)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 999,
                    border: `1px solid ${colors.error}`,
                    background: colors.error + '18',
                    color: colors.error,
                    fontWeight: 950,
                    fontSize: 12,
                    cursor: 'pointer'
                  }}
                >
                  Eliminar
                </button>
              </div>
            </div>

            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Información Básica */}
              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: colors.primary, margin: '0 0 12px 0' }}>
                  Información Básica
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField label="Imputación" value={selectedSubvencion.imputacion} colors={colors} icon={<Building size={16} />} />
                  <InfoField label="Expediente" value={selectedSubvencion.expediente} colors={colors} />
                  <InfoField label="Código" value={selectedSubvencion.codigo} colors={colors} />
                  <InfoField label="Modalidad" value={selectedSubvencion.modalidad} colors={colors} />
                  <InfoField label="Periodo" value={selectedSubvencion.periodo} colors={colors} icon={<Calendar size={16} />} fullWidth />
                  <InfoField label="Fecha presentación (Bruno)" value={selectedSubvencion.fechaAdjudicacion} colors={colors} icon={<Calendar size={16} />} />
                </div>
              </div>

              {/* Información Financiera */}
              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: colors.primary, margin: '0 0 12px 0' }}>
                  Información Financiera
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField
                    label="Importe solicitado"
                    value={selectedSubvencion.importeSolicitado ? formatCurrency(selectedSubvencion.importeSolicitado) : null}
                    colors={colors}
                    icon={<Euro size={16} />}
                  />
                  <InfoField
                    label="Importe otorgado"
                    value={selectedSubvencion.importeOtorgado ? formatCurrency(selectedSubvencion.importeOtorgado) : null}
                    colors={colors}
                    icon={<Euro size={16} />}
                    valueColor={colors.success}
                  />
                  <InfoField
                    label="Saldo pendiente"
                    value={
                      selectedSubvencion.saldoPendienteTexto
                        ? selectedSubvencion.saldoPendienteTexto
                        : (selectedSubvencion.saldoPendiente ? formatCurrency(selectedSubvencion.saldoPendiente) : null)
                    }
                    colors={colors}
                    icon={<Euro size={16} />}
                    valueColor={colors.warning}
                  />
                  <InfoField
                    label="Importes por cobrar"
                    value={selectedSubvencion.importesPorCobrar ? formatCurrency(selectedSubvencion.importesPorCobrar) : null}
                    colors={colors}
                    icon={<Euro size={16} />}
                  />
                </div>
              </div>

              {/* Abonos */}
              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: colors.primary, margin: '0 0 12px 0' }}>
                  Abonos
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField
                    label="1r abono"
                    value={selectedSubvencion.primerAbono ? formatCurrency(selectedSubvencion.primerAbono) : null}
                    colors={colors}
                    icon={<CreditCard size={16} />}
                  />
                  <InfoField label="Fecha/CTA (1r abono)" value={selectedSubvencion.fechaPrimerAbono} colors={colors} icon={<Calendar size={16} />} />
                  <InfoField
                    label="2o abono"
                    value={selectedSubvencion.segundoAbono ? formatCurrency(selectedSubvencion.segundoAbono) : null}
                    colors={colors}
                    icon={<CreditCard size={16} />}
                  />
                  <InfoField label="Fecha/CTA (2o abono)" value={selectedSubvencion.fechaSegundoAbono} colors={colors} icon={<Calendar size={16} />} />
                </div>
              </div>

              {/* Gestión */}
              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: colors.primary, margin: '0 0 12px 0' }}>
                  Gestión
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField label="SOC: L1 ACOMP" value={selectedSubvencion.socL1Acomp} colors={colors} fullWidth />
                  <InfoField label="SOC: L2 CONTRAT. TRABAJ" value={selectedSubvencion.socL2Contrat} colors={colors} fullWidth />
                  <InfoField label="Previsión pago total" value={selectedSubvencion.previsionPago} colors={colors} />
                  <InfoField label="Fecha justificación" value={selectedSubvencion.fechaJustificacion} colors={colors} icon={<Calendar size={16} />} />
                  <InfoField label="Rev. gestoría" value={selectedSubvencion.revisadoGestoria} colors={colors} />
                  <InfoField label="Holded asentam." value={selectedSubvencion.holdedAsentamiento} colors={colors} />
                </div>
              </div>

              {/* Empleados */}
              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: '16px', fontWeight: '700', color: colors.primary, margin: '0 0 12px 0' }}>
                  Empleados (presentados)
                </h3>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 12 }}>
                  <input
                    value={empleadosSearch}
                    onChange={(e) => setEmpleadosSearch(e.target.value)}
                    placeholder={empleadosCatalogLoading ? 'Cargando empleados…' : 'Buscar empleado por nombre/DNI/email…'}
                    style={{
                      flex: '1 1 260px',
                      minWidth: 220,
                      padding: 10,
                      borderRadius: 10,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      outline: 'none'
                    }}
                  />
                  <button
                    onClick={ensureEmployeesCatalogLoaded}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 10,
                      cursor: 'pointer',
                      border: `1px solid ${colors.border}`,
                      background: colors.surface,
                      color: colors.text,
                      fontWeight: 900
                    }}
                  >
                    Recargar
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  {(subvencionEmployeesById?.[selectedSubvencion.id] || []).length === 0 ? (
                    <div style={{ color: colors.textSecondary, fontSize: 13 }}>
                      No hay empleados añadidos a esta subvención.
                    </div>
                  ) : (
                    (subvencionEmployeesById?.[selectedSubvencion.id] || []).map((rel) => (
                      <div
                        key={rel.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 10,
                          padding: '10px 12px',
                          borderRadius: 10,
                          border: `1px solid ${colors.border}`,
                          background: colors.surface,
                          flexWrap: 'wrap'
                        }}
                      >
                        <div
                          onClick={() => {
                            const eid = rel?.empleado_holded_id;
                            if (eid) localStorage.setItem('selectedEmpleadoId', String(eid));
                            setSelectedSubvencion(null);
                            navigateTo('empleados');
                          }}
                          title="Clica para abrir el empleado"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            minWidth: 220,
                            fontWeight: 950,
                            color: colors.text,
                            cursor: 'pointer'
                          }}
                        >
                          <span style={{ display: 'inline-flex', color: colors.textSecondary }}>
                            <ExternalLink size={16} />
                          </span>
                          <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {rel.empleado_nombre || rel.empleado_holded_id}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select
                            value={rel.estado || 'presentado'}
                            onChange={async (e) => {
                              const next = e.target.value;
                              try {
                                await subvencionesService.updateEmpleadoSubvencion({ id: rel.id, estado: next });
                                await loadSubvencionesData();
                              } catch (err) {
                                console.error(err);
                                setError('Error actualizando estado del empleado.');
                              }
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: `1px solid ${colors.border}`,
                              background: colors.background,
                              color: colors.text,
                              fontWeight: 800,
                              cursor: 'pointer'
                            }}
                          >
                            <option value="presentado">presentado</option>
                            <option value="aceptado">aceptado</option>
                            <option value="rechazado">rechazado</option>
                          </select>
                          <button
                            onClick={async () => {
                              // eslint-disable-next-line no-alert
                              const ok = window.confirm('¿Quitar este empleado de la subvención?');
                              if (!ok) return;
                              try {
                                await subvencionesService.removeEmpleadoFromSubvencion({ id: rel.id });
                                await loadSubvencionesData();
                              } catch (err) {
                                console.error(err);
                                setError('Error quitando el empleado.');
                              }
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 10,
                              border: `1px solid ${colors.error}`,
                              background: colors.error + '18',
                              color: colors.error,
                              fontWeight: 950,
                              cursor: 'pointer'
                            }}
                          >
                            Quitar
                          </button>
                        </div>
                      </div>
                    ))
                  )}

                  <div style={{ marginTop: 8, borderTop: `1px solid ${colors.border}`, paddingTop: 12 }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, fontWeight: 800, marginBottom: 8 }}>
                      Añadir empleado
                    </div>
                    <div style={{ display: 'grid', gap: 8, maxHeight: 220, overflow: 'auto', borderRadius: 10 }}>
                      {empleadosCatalog
                        .filter((e) => {
                          const term = empleadosSearch.trim().toLowerCase();
                          if (!term) return false;
                          const hay = `${e?.nombreCompleto || ''} ${e?.dni || ''} ${e?.email || ''}`.toLowerCase();
                          return hay.includes(term);
                        })
                        .slice(0, 12)
                        .map((emp) => {
                          const already = (subvencionEmployeesById?.[selectedSubvencion.id] || []).some(
                            (r) => r.empleado_holded_id === emp.id
                          );
                          return (
                            <div
                              key={emp.id}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 10,
                                border: `1px solid ${colors.border}`,
                                background: colors.surface
                              }}
                            >
                              <div style={{ color: colors.text }}>
                                <div style={{ fontWeight: 900 }}>{emp.nombreCompleto}</div>
                                <div style={{ fontSize: 12, color: colors.textSecondary }}>{emp.dni || emp.email || ''}</div>
                              </div>
                              <button
                                disabled={already}
                                onClick={async () => {
                                  try {
                                    await subvencionesService.addEmpleadoToSubvencion({
                                      subvencionId: selectedSubvencion.id,
                                      empleadoHoldedId: emp.id,
                                      empleadoNombre: emp.nombreCompleto,
                                      estado: 'presentado'
                                    });
                                    await loadSubvencionesData();
                                  } catch (err) {
                                    console.error(err);
                                    setError('Error añadiendo empleado a la subvención.');
                                  }
                                }}
                                style={{
                                  padding: '8px 10px',
                                  borderRadius: 10,
                                  cursor: already ? 'not-allowed' : 'pointer',
                                  border: `1px solid ${already ? colors.border : colors.primary}`,
                                  background: already ? colors.background : colors.primary,
                                  color: already ? colors.textSecondary : 'white',
                                  fontWeight: 950,
                                  opacity: already ? 0.7 : 1
                                }}
                              >
                                {already ? 'Añadido' : 'Añadir'}
                              </button>
                            </div>
                          );
                        })}
                      {empleadosSearch.trim() && empleadosCatalog.length === 0 ? (
                        <div style={{ color: colors.textSecondary, fontSize: 13 }}>
                          No hay empleados cargados (revisa Holded o pulsa Recargar).
                        </div>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary }}>
                      Consejo: escribe para buscar y añade (máximo 12 resultados).
                    </div>
                  </div>
                </div>
              </div>

              {/* JSON (opcional) */}
              <div style={{ borderTop: `1px solid ${colors.border}`, paddingTop: 14 }}>
                <button
                  onClick={() => setShowRawJson((v) => !v)}
                  style={{
                    padding: '10px 12px',
                    borderRadius: 10,
                    cursor: 'pointer',
                    border: `1px solid ${colors.border}`,
                    background: colors.background,
                    color: colors.text,
                    fontWeight: 900,
                    fontSize: 13
                  }}
                >
                  {showRawJson ? 'Ocultar JSON' : 'Ver JSON completo'}
                </button>
                {showRawJson ? (
                  <pre style={{ marginTop: 12, marginBottom: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', overflowWrap: 'anywhere', color: colors.textSecondary, fontSize: 12 }}>
                    {JSON.stringify(selectedSubvencion, null, 2)}
                  </pre>
                ) : null}
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {showEditModal && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 2100,
            padding: '20px'
          }}
          onClick={closeEditModal}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '24px',
              maxWidth: '920px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: `1px solid ${colors.border}`
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <FileCheck size={26} color={colors.primary} />
                <h2 style={{ fontSize: '22px', fontWeight: '900', margin: 0, color: colors.text }}>
                  {editMode === 'create' ? 'Nueva subvención' : 'Editar subvención'}
                </h2>
              </div>
              <button
                onClick={closeEditModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px'
                }}
              >
                <X size={24} color={colors.textSecondary} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 16 }}>
              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.primary, margin: '0 0 12px 0' }}>Información</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Nombre *</div>
                    <input
                      value={form?.nombre ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, nombre: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="Ej: IMPULSEM 2024…"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Proyecto</div>
                    <input
                      value={form?.proyecto ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, proyecto: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Imputación</div>
                    <input
                      value={form?.imputacion ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, imputacion: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Estado</div>
                    <input
                      value={form?.estado ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, estado: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="Ej: FASE 8 / CERRADA…"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fase (1-8)</div>
                    <select
                      value={form?.faseActual ?? ''}
                      onChange={(e) => {
                        const next = e.target.value;
                        setForm((p) => {
                          const prevEstado = String(p?.estado || '').trim();
                          const prevLooksLikePhase = /^FASE\s+\d+$/i.test(prevEstado) || prevEstado === '';
                          const nextEstado = prevLooksLikePhase && next ? `FASE ${next}` : (p?.estado ?? '');
                          return { ...p, faseActual: next, estado: nextEstado };
                        });
                      }}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box', cursor: 'pointer' }}
                    >
                      <option value="">(sin fase)</option>
                      {[1,2,3,4,5,6,7,8].map((n) => (
                        <option key={n} value={String(n)}>{`Fase ${n}`}</option>
                      ))}
                    </select>
                    <div style={{ marginTop: 6, fontSize: 11, color: colors.textSecondary }}>
                      Si el Estado está vacío o es “FASE X”, se sincroniza automáticamente.
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Expediente</div>
                    <input
                      value={form?.expediente ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, expediente: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Código subvención</div>
                    <input
                      value={form?.codigo ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, codigo: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Modalidad</div>
                    <input
                      value={form?.modalidad ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, modalidad: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha postulación (YYYY-MM-DD)</div>
                    <input
                      value={form?.fechaAdjudicacion ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, fechaAdjudicacion: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="2025-01-31"
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Periodo de ejecución</div>
                    <input
                      value={form?.periodo ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, periodo: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="01/11/2023 - 30/11/2024"
                    />
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.primary, margin: '0 0 12px 0' }}>Importes</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Importe solicitado</div>
                    <input
                      value={form?.importeSolicitado ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, importeSolicitado: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="25000,00"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Importe otorgado</div>
                    <input
                      value={form?.importeOtorgado ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, importeOtorgado: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="17500,00"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Saldo pendiente</div>
                    <input
                      value={form?.saldoPendiente ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, saldoPendiente: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="0,00"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Saldo pendiente (texto)</div>
                    <input
                      value={form?.saldoPendienteTexto ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, saldoPendienteTexto: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="PEND. GESTIONAR…"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Importes por cobrar</div>
                    <input
                      value={form?.importesPorCobrar ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, importesPorCobrar: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="30923,32"
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Previsión pago total</div>
                    <input
                      value={form?.previsionPago ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, previsionPago: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.primary, margin: '0 0 12px 0' }}>Abonos</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>1r abono</div>
                    <input
                      value={form?.primerAbono ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, primerAbono: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha/CTA (1r abono)</div>
                    <input
                      value={form?.fechaPrimerAbono ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, fechaPrimerAbono: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>2o abono</div>
                    <input
                      value={form?.segundoAbono ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, segundoAbono: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha/CTA (2o abono)</div>
                    <input
                      value={form?.fechaSegundoAbono ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, fechaSegundoAbono: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ padding: 16, backgroundColor: colors.background, borderRadius: 12, border: `1px solid ${colors.border}` }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: colors.primary, margin: '0 0 12px 0' }}>Gestión</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>SOC: L1 ACOMP</div>
                    <input
                      value={form?.socL1Acomp ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, socL1Acomp: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>SOC: L2 CONTRAT. TRABAJ</div>
                    <input
                      value={form?.socL2Contrat ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, socL2Contrat: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Fecha justificación</div>
                    <input
                      value={form?.fechaJustificacion ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, fechaJustificacion: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="21/01/2025…"
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Holded asentam.</div>
                    <input
                      value={form?.holdedAsentamiento ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, holdedAsentamiento: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>Rev. gestoría</div>
                    <input
                      value={form?.revisadoGestoria ?? ''}
                      onChange={(e) => setForm((p) => ({ ...p, revisadoGestoria: e.target.value }))}
                      style={{ width: '100%', padding: 10, borderRadius: 10, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text, boxSizing: 'border-box' }}
                      placeholder="OK / Rechazado…"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', marginTop: 18 }}>
              <button
                onClick={closeEditModal}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  fontWeight: 900
                }}
              >
                Cancelar
              </button>
              <button
                onClick={saveForm}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  cursor: 'pointer',
                  border: `1px solid ${colors.primary}`,
                  background: colors.primary,
                  color: 'white',
                  fontWeight: 950
                }}
              >
                Guardar
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
