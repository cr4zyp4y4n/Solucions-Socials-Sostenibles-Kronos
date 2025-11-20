import React, { useCallback, useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useTheme } from './ThemeContext';
import {
  UploadCloud,
  FileText,
  RefreshCw,
  DownloadCloud,
  AlertCircle,
  CheckCircle
} from 'feather-icons-react';

const MAX_PREVIEW_ROWS = 10;

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

  const [innuvaFile, setInnuvaFile] = useState(null);
  const [headers, setHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [sourceObjects, setSourceObjects] = useState([]);
  const [holdedDraft, setHoldedDraft] = useState([]);
  const [conversionLog, setConversionLog] = useState([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

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
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });

      if (!workbook.SheetNames.length) {
        throw new Error('El archivo no contiene hojas.');
      }

      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

      if (!rows.length) {
        throw new Error('No se encontraron datos en el Excel.');
      }

      const [headerRow, ...dataRows] = rows;
      const sanitizedHeaders = (headerRow || []).map((header, index) => {
        if (typeof header === 'string' && header.trim() !== '') {
          return header.trim();
        }
        return `Columna ${index + 1}`;
      });

      setInnuvaFile(file);
      setHeaders(sanitizedHeaders);
      setRawRows(dataRows);

      const sourceData = buildObjectRows(sanitizedHeaders, dataRows);
      setSourceObjects(sourceData);

      // TODO: reemplazar esta asignación cuando definamos el mapeo definitivo a Holded
      const preliminaryHoldedDraft = sourceData.map(row => {
        const { __rowIndex, ...rest } = row;
        return rest;
      });

      setHoldedDraft(preliminaryHoldedDraft);
      addLogEntry('Archivo leído correctamente. Generado borrador preliminar (pendiente de mapeo final).', 'success');
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
      style={{
        width: '100%',
        minHeight: '100%',
        padding: '24px',
        boxSizing: 'border-box',
        background: colors.background,
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
          maxWidth: '1300px',
          margin: '0 auto',
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
              Sube el Excel generado en Innuva y la aplicación preparará automáticamente el borrador con la estructura que aceptará Holded. Cuando dispongamos de los formatos definitivos definiremos el mapeo exacto de campos.
            </p>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px' }}>
            {[
              { icon: UploadCloud, label: '1. Subir Excel de Innuva', description: 'Selecciona el archivo exportado desde Innuva (formato XLSX o CSV).' },
              { icon: RefreshCw, label: '2. Transformación automática', description: 'Generamos un borrador con la estructura de Holded (pendiente de ajustar con el mapeo final).' },
              { icon: FileText, label: '3. Revisión previa', description: 'Visualiza una muestra de los datos antes de descargar el archivo para Holded.' },
              { icon: DownloadCloud, label: '4. Descargar borrador', description: 'Descarga el archivo listo para Holded cuando el mapeo esté finalizado.' },
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
              style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
                  gap: '16px',
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

                <div style={{ overflowX: 'auto' }}>
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

                <div style={{ overflowX: 'auto' }}>
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

