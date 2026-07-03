import { useCallback, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { convertPlantillaFileToInnuva } from './fdInnuvaConverter';
import { downloadInnuvaIncidenciasWorkbook } from './innuvaIncidenciasExport';
import { loadInnuvaWorkersCatalog, resolveInnuvaWorkerMatch } from './innuvaWorkersCatalog';
import { parseCsvText, readTextFileWithEncoding } from './fdPlantillaParser';

async function readPlantillaRows(file) {
  const isCsv = /\.csv$/i.test(file.name) || file.type === 'text/csv';
  if (isCsv) {
    const text = await readTextFileWithEncoding(file);
    return parseCsvText(text);
  }
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  if (!workbook.SheetNames.length) throw new Error('El archivo no contiene hojas.');
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  return matrix.map((row) => (Array.isArray(row) ? row.map((c) => String(c ?? '')) : []));
}

export function useInnuvaPersonalConverter() {
  const fileInputRef = useRef(null);
  const [sourceFile, setSourceFile] = useState(null);
  const [result, setResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');

  const processFile = useCallback(async (file) => {
    setIsProcessing(true);
    setError('');
    setResult(null);
    setSourceFile(file);

    try {
      const rows = await readPlantillaRows(file);
      const catalog = await loadInnuvaWorkersCatalog().catch(() => new Map());
      const codigoByWorkerKey = {};
      const convertedPre = convertPlantillaFileToInnuva(rows, file.name);
      for (const worker of convertedPre.workers || []) {
        const match = resolveInnuvaWorkerMatch(worker.workerName, catalog);
        if (match) codigoByWorkerKey[worker.workerKey] = match;
      }
      const converted = convertPlantillaFileToInnuva(rows, file.name, codigoByWorkerKey);
      if (!converted.incidencias.length) {
        const hint = converted.warnings?.length
          ? ` ${converted.warnings.slice(0, 3).join(' · ')}`
          : '';
        setError(
          `No se generaron filas. Revisa que la hoja tenga bloques de fijos discontinuos con importes Bruto.${hint}`
        );
      }
      setResult(converted);
    } catch (e) {
      console.error(e);
      setError(e?.message || 'No se pudo procesar la plantilla.');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  const handleFileChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (file) await processFile(file);
  }, [processFile]);

  const handleSelectFile = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleReset = useCallback(() => {
    setSourceFile(null);
    setResult(null);
    setError('');
  }, []);

  const handleDownload = useCallback(() => {
    if (!result?.incidencias?.length) return;
    const base = sourceFile?.name?.replace(/\.(xlsx?|csv)$/i, '') || 'plantilla_fd';
    downloadInnuvaIncidenciasWorkbook(result.incidencias, `${base}_INNUVA_INCIDENCIAS.xlsx`);
  }, [result, sourceFile]);

  return {
    fileInputRef,
    sourceFile,
    result,
    isProcessing,
    error,
    handleFileChange,
    handleSelectFile,
    handleReset,
    handleDownload,
    hasResult: !!result?.incidencias?.length
  };
}
