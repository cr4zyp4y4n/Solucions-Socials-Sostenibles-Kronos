import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  FileText, 
  Image as ImageIcon,
  CheckCircle,
  X,
  AlertCircle,
  RefreshCw,
  Download,
  Eye,
  Edit2
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { createWorker } from 'tesseract.js';
import * as XLSX from 'xlsx';

const AlbaranOCRPage = () => {
  const { colors } = useTheme();
  const fileInputRef = useRef(null);
  
  // Estados
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedText, setExtractedText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Manejar selección de archivo
  const handleFileSelect = (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo de archivo
    const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(selectedFile.type)) {
      setError('Por favor, selecciona una imagen (JPG, PNG) o un PDF');
      return;
    }

    setFile(selectedFile);
    setError('');
    setExtractedText('');
    setParsedData(null);

    // Crear preview para imágenes
    if (selectedFile.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(selectedFile);
    } else {
      setPreview(null);
    }
  };

  // Procesar archivo con OCR
  const handleProcess = async () => {
    if (!file) {
      setError('Por favor, selecciona un archivo primero');
      return;
    }

    setProcessing(true);
    setError('');
    setProgress(0);
    setExtractedText('');
    setParsedData(null);

    let progressInterval = null;

    try {
      console.log('🔍 [OCR] Iniciando procesamiento de archivo:', file.name, file.type);
      
      // Si es PDF, necesitaríamos convertirlo a imagen primero
      // Por ahora, solo procesamos imágenes
      if (file.type === 'application/pdf') {
        setError('El procesamiento de PDFs estará disponible próximamente. Por favor, convierte el PDF a imagen primero.');
        setProcessing(false);
        return;
      }

      console.log('🔍 [OCR] Creando worker de Tesseract...');
      
      // Procesar con Tesseract usando Worker
      // Pasar el idioma directamente a createWorker
      const worker = await createWorker('spa+eng');
      
      console.log('🔍 [OCR] Worker creado e inicializado, iniciando reconocimiento...');

      // Simular progreso mientras se procesa (ya que no podemos pasar funciones al Worker)
      progressInterval = setInterval(() => {
        setProgress((prev) => {
          // Incrementar progreso gradualmente hasta 90% (dejar 10% para la finalización)
          if (prev < 90) {
            return Math.min(prev + 5, 90);
          }
          return prev;
        });
      }, 500);

      // Realizar el reconocimiento sin logger (las funciones no se pueden clonar para el Worker)
      const { data: { text } } = await worker.recognize(file);
      
      // Detener el intervalo de progreso y completar al 100%
      clearInterval(progressInterval);
      setProgress(100);
      
      console.log('🔍 [OCR] Reconocimiento completado, texto extraído:', text.substring(0, 100) + '...');
      
      // Terminar el worker
      await worker.terminate();
      console.log('🔍 [OCR] Worker terminado');

      setExtractedText(text);
      
      // Parsear los datos extraídos
      const parsed = parseAlbaranData(text);
      setParsedData(parsed);

      setSuccess('Texto extraído correctamente');
      setTimeout(() => setSuccess(''), 3000);

    } catch (err) {
      console.error('Error procesando archivo:', err);
      setError('Error al procesar el archivo: ' + err.message);
    } finally {
      // Limpiar intervalo si existe
      if (progressInterval) {
        clearInterval(progressInterval);
      }
      setProcessing(false);
      setProgress(0);
    }
  };

  // Parsear datos del albarán
  const parseAlbaranData = (text) => {
    const data = {
      numeroAlbaran: '',
      fecha: '',
      proveedor: '',
      productos: [],
      subtotal: '',
      iva: '',
      total: ''
    };

    // Normalizar texto (eliminar espacios múltiples, etc.)
    // Mantener saltos de línea para mejor parsing
    const normalizedText = text.replace(/\s{3,}/g, ' ').trim();
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);

    // Buscar número de albarán (patrones comunes más robustos)
    const albaranPatterns = [
      /albar[áa]n[:\s]*n[úu]m[\.\s]*([A-Z0-9\-]+)/i,
      /albar[áa]n[:\s]*([A-Z0-9\-]+)/i,
      /n[úu]m[\.\s]*albar[áa]n[:\s]*([A-Z0-9\-]+)/i,
      /referEnciA[:\s]*([A-Z0-9\-]+)/i,
      /referencia[:\s]*([A-Z0-9\-]+)/i,
      /ref[\.\s]*([A-Z0-9\-]+)/i,
      /c[óo]digo[:\s]*([A-Z0-9\-]+)/i
    ];
    
    // Buscar en líneas individuales primero (más preciso)
    for (const line of lines) {
      for (const pattern of albaranPatterns) {
        const match = line.match(pattern);
        if (match && match[1] && match[1].length >= 4) {
          data.numeroAlbaran = match[1].trim();
          break;
        }
      }
      if (data.numeroAlbaran) break;
    }
    
    // Si no encontramos, buscar números de 4+ dígitos cerca de "albarán" o "referencia"
    if (!data.numeroAlbaran) {
      for (const line of lines) {
        if (/albar|refer/i.test(line)) {
          const numbers = line.match(/\d{4,}/g);
          if (numbers && numbers.length > 0) {
            data.numeroAlbaran = numbers[0];
            break;
          }
        }
      }
    }

    // Buscar fecha (patrones más robustos)
    const datePatterns = [
      /fecha[:\s]*(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/i,
      /(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/,
      /(\d{2,4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
      /(\d{1,2}\s+de\s+[a-z]+\s+de\s+\d{2,4})/i
    ];
    
    for (const pattern of datePatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        data.fecha = match[1].trim();
        break;
      }
    }

    // Buscar proveedor (buscar "S.L.", "S.A.", nombres de empresas)
    // Buscar en las primeras líneas donde suele estar el nombre de la empresa
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i];
      // Buscar patrones de empresa (S.L., S.A., etc.)
      if (/(S\.L\.|S\.A\.|S\.C\.C\.|SL|SA)/i.test(line)) {
        // Extraer el nombre de la empresa (texto antes del patrón)
        const match = line.match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{5,40}?)\s*(S\.L\.|S\.A\.|S\.C\.C\.|SL|SA)/i);
        if (match && match[1]) {
          data.proveedor = match[1].trim() + ' ' + match[2];
          break;
        } else {
          // Si no encontramos el patrón completo, tomar la línea completa si parece un nombre de empresa
          const cleanLine = line.replace(/[^\w\s\.]/g, ' ').trim();
          if (cleanLine.length > 5 && cleanLine.length < 60) {
            data.proveedor = cleanLine;
            break;
          }
        }
      }
    }
    
    // Si no encontramos, buscar líneas con palabras clave
    if (!data.proveedor) {
      const proveedorPatterns = [
        /proveedor[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,30})/i,
        /empresa[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,30})/i
      ];
      
      for (const line of lines) {
        for (const pattern of proveedorPatterns) {
          const match = line.match(pattern);
          if (match && match[1]) {
            data.proveedor = match[1].trim();
            break;
          }
        }
        if (data.proveedor) break;
      }
    }

    // Buscar totales (más robusto, buscar el último "total" que suele ser el total final)
    const totalMatches = [...normalizedText.matchAll(/total[:\s]*([\d\s,\.]+)/gi)];
    if (totalMatches.length > 0) {
      // Tomar el último match (suele ser el total final)
      const lastMatch = totalMatches[totalMatches.length - 1];
      data.total = lastMatch[1].replace(/[^\d,\.]/g, '').replace(/,/g, '.');
    }

    // Buscar IVA (patrones más robustos)
    const ivaPatterns = [
      /(?:iva|i\.v\.a\.)[:\s]*([\d\s,\.]+)/i,
      /(?:impuestos|impuesto)[:\s]*([\d\s,\.]+)/i,
      /(?:%?\s*21\s*%?\s*[\d\s,\.]+)/i // IVA del 21%
    ];
    
    for (const pattern of ivaPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        data.iva = match[1].replace(/[^\d,\.]/g, '').replace(/,/g, '.');
        break;
      }
    }

    // Buscar subtotal/base imponible
    const subtotalPatterns = [
      /(?:subtotal|base\s+imponible|base)[:\s]*([\d\s,\.]+)/i,
      /(?:importe|cantidad)[:\s]*([\d\s,\.]+)/i
    ];
    
    for (const pattern of subtotalPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        data.subtotal = match[1].replace(/[^\d,\.]/g, '').replace(/,/g, '.');
        break;
      }
    }

    // Si no encontramos subtotal pero tenemos total e IVA, calcularlo
    if (!data.subtotal && data.total && data.iva) {
      const totalNum = parseFloat(data.total.replace(/,/g, '.')) || 0;
      const ivaNum = parseFloat(data.iva.replace(/,/g, '.')) || 0;
      data.subtotal = (totalNum - ivaNum).toFixed(2);
    }

    return data;
  };

  // Formatear para Holded
  const formatForHolded = () => {
    if (!parsedData) return null;

    // Formatear según el formato de Holded
    return {
      "Data d'emissió": parsedData.fecha || '',
      'Núm': parsedData.numeroAlbaran || '',
      'Núm. Intern': '',
      'Data comptable': parsedData.fecha || '',
      'Venciment': '',
      'Proveïdor': parsedData.proveedor || '',
      'Descripció': `Albarán ${parsedData.numeroAlbaran || 'sin número'}`,
      'Tags': '',
      'Compte': '',
      'Projecte': '',
      'Subtotal': parsedData.subtotal || '',
      'IVA': parsedData.iva || '',
      'Retención': '',
      'Empleados': '',
      'Rec. de eq.': '',
      'Total': parsedData.total || '',
      'Pagat': '0',
      'Pendents': parsedData.total || '',
      'Estat': 'Pendiente',
      'Data de pagament': ''
    };
  };

  // Exportar a Excel
  const handleExport = () => {
    const holdedData = formatForHolded();
    if (!holdedData) {
      setError('No hay datos para exportar');
      return;
    }

    try {
      // Crear workbook
      const wb = XLSX.utils.book_new();
      
      // Crear array con los datos (una fila)
      const excelData = [holdedData];
      
      // Crear hoja de trabajo
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Ajustar anchos de columna
      const colWidths = Object.keys(holdedData).map(() => ({ wch: 20 }));
      ws['!cols'] = colWidths;
      
      // Añadir hoja al workbook
      XLSX.utils.book_append_sheet(wb, ws, 'Albarán');
      
      // Generar nombre de archivo
      const timestamp = new Date().toISOString().slice(0, 10);
      const fileName = `Albaran_${parsedData.numeroAlbaran || 'sin_numero'}_${timestamp}.xlsx`;
      
      // Descargar archivo
      XLSX.writeFile(wb, fileName);
      
      setSuccess('Archivo Excel exportado correctamente');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Error exportando a Excel:', err);
      setError('Error al exportar el archivo: ' + err.message);
    }
  };

  const holdedFormatted = formatForHolded();

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: '32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <FileText size={32} color={colors.primary} />
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: colors.text,
            margin: 0
          }}>
            Formateador de Albaranes
          </h1>
        </div>
        <p style={{ 
          fontSize: '15px', 
          color: colors.textSecondary,
          margin: 0
        }}>
          Sube una imagen o PDF de un albarán para extraer los datos y formatearlos para Holded
        </p>
      </motion.div>

      {/* Mensajes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.error + '15',
              border: `2px solid ${colors.error}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertCircle size={20} color={colors.error} />
            <span style={{ color: colors.error, fontSize: '14px' }}>{error}</span>
            <button 
              onClick={() => setError('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.error
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.success + '15',
              border: `2px solid ${colors.success}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle size={20} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '14px' }}>{success}</span>
            <button 
              onClick={() => setSuccess('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.success
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zona de subida */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        padding: '32px',
        marginBottom: '24px',
        border: `2px dashed ${colors.border}`,
        textAlign: 'center'
      }}>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
        
        {!file ? (
          <div>
            <Upload size={48} color={colors.textSecondary} style={{ marginBottom: '16px' }} />
            <h3 style={{ color: colors.text, marginBottom: '8px' }}>
              Sube un albarán
            </h3>
            <p style={{ color: colors.textSecondary, marginBottom: '20px' }}>
              Arrastra una imagen o PDF aquí, o haz clic para seleccionar
            </p>
            <button
              onClick={() => fileInputRef.current?.click()}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <ImageIcon size={18} />
              Seleccionar archivo
            </button>
          </div>
        ) : (
          <div>
            <div style={{ marginBottom: '20px' }}>
              {preview && (
                <img 
                  src={preview} 
                  alt="Preview" 
                  style={{ 
                    maxWidth: '100%', 
                    maxHeight: '400px', 
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`
                  }} 
                />
              )}
              {!preview && (
                <FileText size={48} color={colors.textSecondary} />
              )}
            </div>
            <div style={{ marginBottom: '16px' }}>
              <p style={{ color: colors.text, fontWeight: '600' }}>{file.name}</p>
              <p style={{ color: colors.textSecondary, fontSize: '13px' }}>
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </p>
            </div>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                onClick={() => {
                  setFile(null);
                  setPreview(null);
                  setExtractedText('');
                  setParsedData(null);
                  if (fileInputRef.current) fileInputRef.current.value = '';
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cambiar archivo
              </button>
              <button
                onClick={handleProcess}
                disabled={processing}
                style={{
                  padding: '10px 20px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: processing ? 'not-allowed' : 'pointer',
                  opacity: processing ? 0.6 : 1,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {processing ? (
                  <>
                    <RefreshCw size={18} style={{ animation: 'spin 1s linear infinite' }} />
                    Procesando... {progress}%
                  </>
                ) : (
                  <>
                    <FileText size={18} />
                    Procesar con OCR
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Resultados */}
      {extractedText && (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: `1px solid ${colors.border}`
        }}>
          <h3 style={{ color: colors.text, marginBottom: '16px' }}>
            Texto Extraído
          </h3>
          <div style={{
            backgroundColor: colors.background,
            padding: '16px',
            borderRadius: '8px',
            maxHeight: '300px',
            overflowY: 'auto',
            fontSize: '13px',
            color: colors.text,
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            border: `1px solid ${colors.border}`
          }}>
            {extractedText}
          </div>
        </div>
      )}

      {/* Datos Parseados */}
      {parsedData && (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '24px',
          marginBottom: '24px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 style={{ color: colors.text }}>
              Datos Extraídos
            </h3>
            {holdedFormatted && (
              <button
                onClick={handleExport}
                style={{
                  padding: '8px 16px',
                  backgroundColor: colors.success,
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <Download size={16} />
                Exportar a Excel
              </button>
            )}
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontSize: '12px', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Número de Albarán
              </label>
              <input
                type="text"
                value={parsedData.numeroAlbaran}
                onChange={(e) => setParsedData({ ...parsedData, numeroAlbaran: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background
                }}
                placeholder="Número de albarán"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Fecha
              </label>
              <input
                type="text"
                value={parsedData.fecha}
                onChange={(e) => setParsedData({ ...parsedData, fecha: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background
                }}
                placeholder="Fecha"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Proveedor
              </label>
              <input
                type="text"
                value={parsedData.proveedor}
                onChange={(e) => setParsedData({ ...parsedData, proveedor: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background
                }}
                placeholder="Nombre del proveedor"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Subtotal
              </label>
              <input
                type="text"
                value={parsedData.subtotal}
                onChange={(e) => setParsedData({ ...parsedData, subtotal: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background
                }}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                IVA
              </label>
              <input
                type="text"
                value={parsedData.iva}
                onChange={(e) => setParsedData({ ...parsedData, iva: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background
                }}
                placeholder="0.00"
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', color: colors.textSecondary, display: 'block', marginBottom: '4px' }}>
                Total
              </label>
              <input
                type="text"
                value={parsedData.total}
                onChange={(e) => setParsedData({ ...parsedData, total: e.target.value })}
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '6px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.background
                }}
                placeholder="0.00"
              />
            </div>
          </div>
        </div>
      )}

      {/* Formato Holded */}
      {holdedFormatted && (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          padding: '24px',
          border: `1px solid ${colors.border}`
        }}>
          <h3 style={{ color: colors.text, marginBottom: '16px' }}>
            Formato Holded
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: colors.background, borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Campo
                  </th>
                  <th style={{ padding: '12px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Valor
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(holdedFormatted).map(([key, value]) => (
                  <tr key={key} style={{ borderBottom: `1px solid ${colors.border}` }}>
                    <td style={{ padding: '12px', color: colors.text, fontSize: '13px', fontWeight: '500' }}>
                      {key}
                    </td>
                    <td style={{ padding: '12px', color: colors.textSecondary, fontSize: '13px' }}>
                      {value || '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* CSS para animación */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default AlbaranOCRPage;

