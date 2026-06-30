import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  buildNominasCuentasIndex,
  EMPRESAS_NOMINAS,
  loadNominasCuentasEmpleados,
  normalizeCodigo,
  upsertNominasCuentasEmpleados
} from '../../services/nominasCuentasService';
import {
  DEFAULT_HOLDED_NOMINAS_CONFIG,
  HOLDEN_NOMINAS_EXPORT_HEADERS,
  mapInnuvaRowsToHolded,
  MAX_PREVIEW_ROWS,
  parseInnuvaNominasCsv
} from './innuvaConverterCore';

export function useInnuvaHoldedConverter() {
  const fileInputRef = useRef(null);

  const [innuvaFile, setInnuvaFile] = useState(null);
  const [empresa, setEmpresa] = useState(EMPRESAS_NOMINAS.SOLUCIONS);
  const [sourceObjects, setSourceObjects] = useState([]);
  const [holdedDraft, setHoldedDraft] = useState([]);
  const [conversionLog, setConversionLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState('');
  const [parsedSnapshot, setParsedSnapshot] = useState(null);
  const [cuentasByCodigo, setCuentasByCodigo] = useState(new Map());
  const [cuentasLoading, setCuentasLoading] = useState(false);
  const [cuentasError, setCuentasError] = useState('');
  const [cuentasCsvFile, setCuentasCsvFile] = useState(null);

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

  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 6000);
    return () => clearTimeout(t);
  }, [message]);

  const addLogEntry = useCallback((entryMessage, type = 'info') => {
    setConversionLog((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${prev.length}`,
        timestamp: new Date(),
        message: entryMessage,
        type
      }
    ]);
  }, []);

  const refreshCuentasFromDb = useCallback(async () => {
    try {
      setCuentasError('');
      setCuentasLoading(true);
      const rows = await loadNominasCuentasEmpleados(empresa);
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
  }, [addLogEntry, empresa]);

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
      const res = await upsertNominasCuentasEmpleados(rows, empresa);
      addLogEntry(`Importadas/actualizadas cuentas: ${res.upserted}`, 'success');
      setCuentasCsvFile(null);
      setMessage(`Cuentas actualizadas: ${res.upserted} empleados.`);
      await refreshCuentasFromDb();
    } catch (e) {
      console.error('Error importando CSV de cuentas:', e);
      setCuentasError(e?.message || 'Error importando CSV de cuentas.');
      addLogEntry('Error importando CSV de cuentas a Supabase.', 'error');
    } finally {
      setCuentasLoading(false);
    }
  }, [addLogEntry, cuentasCsvFile, empresa, parseCuentasEmpleadosCsv, refreshCuentasFromDb]);

  const resetState = useCallback(() => {
    setSourceObjects([]);
    setHoldedDraft([]);
    setConversionLog([]);
    setParsedSnapshot(null);
    setError(null);
    setInnuvaFile(null);
  }, []);

  const remapHoldedDraft = useCallback((snapshot, cuentas) => {
    if (!snapshot?.rows?.length) return [];
    return mapInnuvaRowsToHolded({
      rows: snapshot.rows,
      meta: snapshot.meta,
      cuentasByCodigo: cuentas,
      holdedNominasConfig: DEFAULT_HOLDED_NOMINAS_CONFIG
    });
  }, []);

  useEffect(() => {
    if (!parsedSnapshot?.rows?.length) return;
    setHoldedDraft(remapHoldedDraft(parsedSnapshot, cuentasByCodigo));
  }, [parsedSnapshot, cuentasByCodigo, remapHoldedDraft]);

  const processFile = useCallback(async (file) => {
    resetState();
    setIsProcessing(true);
    setError('');
    addLogEntry(`Procesando archivo "${file.name}"`, 'info');

    try {
      const isCsv = file.name.toLowerCase().endsWith('.csv') || file.type === 'text/csv';
      let innuvaParsed = null;

      if (isCsv) {
        const text = await file.text();
        innuvaParsed = parseInnuvaNominasCsv(text);
      } else {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        if (!workbook.SheetNames.length) throw new Error('El archivo no contiene hojas.');
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const csv = XLSX.utils.sheet_to_csv(worksheet, { FS: ';' });
        innuvaParsed = parseInnuvaNominasCsv(csv);
      }

      if (!innuvaParsed?.rows?.length) {
        throw new Error('No se encontraron filas de nóminas en el archivo. Comprueba que sea un export de Innuva.');
      }

      const sourcePreview = innuvaParsed.rows.map((r, idx) => ({ ...r, __rowIndex: idx }));
      const snapshot = { rows: innuvaParsed.rows, meta: innuvaParsed.meta };
      const ordered = remapHoldedDraft(snapshot, cuentasByCodigo);

      setInnuvaFile(file);
      setParsedSnapshot(snapshot);
      setSourceObjects(sourcePreview);
      setHoldedDraft(ordered);
      addLogEntry(`Archivo leído. Generadas ${ordered.length} filas para Holded.`, 'success');
      setMessage(`Listo: ${ordered.length} filas para importar en Holded.`);
    } catch (err) {
      console.error('Error procesando Excel de Innuva:', err);
      setError(err.message || 'No se pudo procesar el archivo de Innuva.');
      addLogEntry(err.message || 'Error al procesar el archivo de Innuva.', 'error');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [addLogEntry, cuentasByCodigo, remapHoldedDraft, resetState]);

  const handleFileChange = useCallback(async (event) => {
    const file = event.target.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const handleFileButtonClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReset = useCallback(() => {
    resetState();
    addLogEntry('Conversor reiniciado.', 'info');
    setMessage('');
  }, [addLogEntry, resetState]);

  const handleDownloadDraft = useCallback(() => {
    if (!holdedDraft.length) return;
    const exportRows = holdedDraft.map((row) => {
      const out = {};
      HOLDEN_NOMINAS_EXPORT_HEADERS.forEach((h) => {
        out[h] = row?.[h] ?? '';
      });
      return out;
    });
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Holded');
    const fileName = innuvaFile
      ? innuvaFile.name.replace(/(\.xlsx?|\.csv)$/i, '_HOLDED.xlsx')
      : 'innuva_holded.xlsx';
    XLSX.writeFile(workbook, fileName);
    addLogEntry(`Descargado: ${fileName}`, 'success');
    setMessage(`Descargado ${fileName}`);
  }, [addLogEntry, holdedDraft, innuvaFile]);

  const previewSourceRows = useMemo(
    () => sourceObjects.slice(0, MAX_PREVIEW_ROWS),
    [sourceObjects]
  );

  const previewHoldedRows = useMemo(
    () => holdedDraft.slice(0, MAX_PREVIEW_ROWS),
    [holdedDraft]
  );

  const sourceHeaders = useMemo(
    () => (sourceObjects[0] ? Object.keys(sourceObjects[0]).filter((k) => k !== '__rowIndex') : []),
    [sourceObjects]
  );

  return {
    fileInputRef,
    empresa,
    setEmpresa,
    innuvaFile,
    sourceObjects,
    holdedDraft,
    conversionLog,
    isProcessing,
    error,
    message,
    cuentasByCodigo,
    cuentasLoading,
    cuentasError,
    cuentasCsvFile,
    setCuentasCsvFile,
    refreshCuentasFromDb,
    importCuentasCsvToDb,
    handleFileChange,
    handleFileButtonClick,
    handleReset,
    handleDownloadDraft,
    previewSourceRows,
    previewHoldedRows,
    sourceHeaders,
    hasData: sourceObjects.length > 0
  };
}
