import React, { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { Upload, X, FileText, AlertCircle, CheckCircle, Loader } from 'lucide-react';
import { useTheme } from './ThemeContext';
import hojaRutaService from '../services/hojaRutaSupabaseService';

const HojaRutaUploadModal = ({ isOpen, onClose, onUploadSuccess, userId }) => {
  const { colors } = useTheme();
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Solo cambiar a false si realmente salimos del contenedor
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      handleFileSelect(files[0]);
    }
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    // Validar tipo de archivo
    const fileName = file.name.toLowerCase();
    const isExcel = fileName.endsWith('.xlsx') || fileName.endsWith('.xls');
    const isCSV = fileName.endsWith('.csv');

    if (!isExcel && !isCSV) {
      setError('Solo se permiten archivos Excel (.xlsx, .xls) o CSV (.csv)');
      return;
    }

    // Validar tamaño (máximo 10MB para Excel, 5MB para CSV)
    const maxSize = isExcel ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
    if (file.size > maxSize) {
      setError(`El archivo es demasiado grande. Máximo ${isExcel ? '10MB' : '5MB'}`);
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Generar preview del archivo
    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const lines = content.split('\n').slice(0, 10); // Primeras 10 líneas
        setPreview(lines.join('\n'));
      };
      reader.readAsText(file, 'UTF-8');
    } else {
      // Para Excel, mostrar información básica
      setPreview(`Archivo Excel: ${file.name}\nTamaño: ${formatFileSize(file.size)}\n\nEl contenido se procesará automáticamente al subir.`);
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setError(null);

    try {
      const nuevaHoja = await hojaRutaService.uploadFile(selectedFile, userId);
      onUploadSuccess(nuevaHoja);
      onClose();
    } catch (err) {
      console.error('Error subiendo CSV:', err);
      setError(err.message || 'Error al procesar el archivo CSV');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    setUploading(false);
    onClose();
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px'
      }}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '32px',
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: `1px solid ${colors.border}`
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}>
          <h2 style={{
            fontSize: '24px',
            fontWeight: 'bold',
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Upload size={28} color={colors.primary} />
            Subir Hoja de Ruta
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={handleClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={24} color={colors.textSecondary} />
          </motion.button>
        </div>

        {/* Instrucciones */}
        <div style={{
          backgroundColor: colors.background,
          borderRadius: '12px',
          padding: '20px',
          marginBottom: '24px',
          border: `1px solid ${colors.border}`
        }}>
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 12px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FileText size={18} color={colors.primary} />
            Instrucciones
          </h3>
          <ul style={{
            fontSize: '14px',
            color: colors.textSecondary,
            margin: 0,
            paddingLeft: '20px',
            lineHeight: '1.6'
          }}>
            <li>Selecciona un archivo Excel (.xlsx, .xls) o CSV (.csv)</li>
            <li>El archivo debe tener el formato correcto con todas las columnas</li>
            <li>Tamaño máximo: 10MB (Excel) / 5MB (CSV)</li>
            <li>La nueva hoja reemplazará la actual</li>
          </ul>
        </div>

        {/* Zona de subida */}
        <div
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? colors.primary : colors.border}`,
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? colors.primary + '10' : colors.background,
            transition: 'all 0.2s ease',
            marginBottom: '24px'
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileInputChange}
            style={{ display: 'none' }}
          />

          {selectedFile ? (
            <div>
              <CheckCircle size={48} color={colors.success} style={{ marginBottom: '16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                margin: '0 0 8px 0'
              }}>
                Archivo seleccionado
              </h3>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: '0 0 8px 0'
              }}>
                {selectedFile.name}
              </p>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: 0
              }}>
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
          ) : dragActive ? (
            <div>
              <Upload size={48} color={colors.primary} style={{ marginBottom: '16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.primary,
                margin: '0 0 8px 0'
              }}>
                ¡Suelta el archivo aquí!
              </h3>
              <p style={{
                fontSize: '14px',
                color: colors.primary,
                margin: '0 0 16px 0'
              }}>
                El archivo se procesará automáticamente
              </p>
            </div>
          ) : (
            <div>
              <Upload size={48} color={colors.primary} style={{ marginBottom: '16px' }} />
              <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                margin: '0 0 8px 0'
              }}>
                Arrastra tu archivo aquí
              </h3>
              <p style={{
                fontSize: '14px',
                color: colors.textSecondary,
                margin: '0 0 16px 0'
              }}>
                o haz clic para seleccionar
              </p>
              <div style={{
                fontSize: '12px',
                color: colors.textSecondary,
                backgroundColor: colors.surface,
                padding: '8px 16px',
                borderRadius: '6px',
                display: 'inline-block'
              }}>
                Excel (.xlsx, .xls) o CSV (.csv)
              </div>
            </div>
          )}
        </div>

        {/* Preview del archivo */}
        {preview && (
          <div style={{
            backgroundColor: colors.background,
            borderRadius: '12px',
            padding: '20px',
            marginBottom: '24px',
            border: `1px solid ${colors.border}`
          }}>
            <h3 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 12px 0'
            }}>
              Vista previa (primeras 10 líneas)
            </h3>
            <pre style={{
              fontSize: '12px',
              color: colors.textSecondary,
              backgroundColor: colors.surface,
              padding: '12px',
              borderRadius: '8px',
              overflow: 'auto',
              maxHeight: '200px',
              margin: 0,
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap'
            }}>
              {preview}
            </pre>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{
            backgroundColor: colors.error + '20',
            border: `1px solid ${colors.error}`,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '24px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={20} color={colors.error} />
            <span style={{ color: colors.error, fontWeight: '500' }}>{error}</span>
          </div>
        )}

        {/* Botones */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleClose}
            disabled={uploading}
            style={{
              padding: '12px 24px',
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: uploading ? 0.6 : 1
            }}
          >
            Cancelar
          </motion.button>

          <motion.button
            whileHover={{ scale: uploading ? 1 : 1.05 }}
            whileTap={{ scale: uploading ? 1 : 0.95 }}
            onClick={handleUpload}
            disabled={!selectedFile || uploading}
            style={{
              padding: '12px 24px',
              backgroundColor: selectedFile && !uploading ? colors.primary : colors.textSecondary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: (!selectedFile || uploading) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: (!selectedFile || uploading) ? 0.6 : 1
            }}
          >
            {uploading ? (
              <>
                <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                Procesando...
              </>
            ) : (
              <>
                <Upload size={16} />
                Subir Archivo
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default HojaRutaUploadModal;
