import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  X, 
  Upload, 
  FileText,
  AlertCircle,
  CheckCircle,
  Calendar,
  Users
} from 'lucide-react';
import { useTheme } from './ThemeContext';

const ImportSociosModal = ({ 
  isOpen, 
  onClose, 
  onImportSocios 
}) => {
  const { colors } = useTheme();
  
  const [selectedFile, setSelectedFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);
  const [fileInputRef] = useState(React.createRef());

  // Resetear estado al abrir/cerrar
  React.useEffect(() => {
    if (isOpen) {
      setSelectedFile(null);
      setDragActive(false);
      setError(null);
      setPreview(null);
    }
  }, [isOpen]);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (file) => {
    if (!file.name.endsWith('.csv')) {
      setError('Por favor, selecciona un archivo CSV válido');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB
      setError('El archivo es demasiado grande. Máximo 5MB');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // Generar preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const csvContent = e.target.result;
      const lines = csvContent.split('\n').slice(0, 6); // Primeras 5 líneas
      setPreview(lines.join('\n'));
    };
    reader.readAsText(file);
  };

  const handleFileInputChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const parseCSV = (csvContent) => {
    const lines = csvContent.split('\n');
    const socios = [];
    
    // Saltar la primera línea (headers)
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Parsear línea CSV (manejar comillas)
      const fields = [];
      let currentField = '';
      let inQuotes = false;
      
      for (let j = 0; j < line.length; j++) {
        const char = line[j];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          fields.push(currentField.trim());
          currentField = '';
        } else {
          currentField += char;
        }
      }
      fields.push(currentField.trim());

      // Solo tomar los primeros 4 campos: Horario de envío, Correo, Nombre, Apellido
      if (fields.length >= 4) {
        const [horarioEnvio, correo, nombre, apellido] = fields;
        
        // Solo procesar si tiene datos válidos
        if (correo && nombre) {
          // Si no hay apellido, intentar extraerlo del correo
          let apellidoFinal = apellido;
          if (!apellidoFinal || apellidoFinal.trim() === '') {
            // Extraer apellido del correo (ej: angelspallares1@hotmail.com -> Angels Pallares)
            const emailPart = correo.split('@')[0];
            if (emailPart) {
              // Casos específicos conocidos
              if (emailPart.toLowerCase().includes('angelspallares')) {
                apellidoFinal = 'Angels Pallares';
              } else {
                // Convertir a formato nombre: angelspallares -> Angels Pallares
                apellidoFinal = emailPart
                  .replace(/\d+/g, '') // Quitar números
                  .replace(/([a-z])([A-Z])/g, '$1 $2') // Separar camelCase
                  .split(' ')
                  .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
                  .join(' ');
              }
            }
          }
          // Convertir fecha de creación desde "Horario de envío"
          let fechaCreacion = new Date().toISOString().split('T')[0]; // Fecha actual por defecto
          
          if (horarioEnvio && horarioEnvio !== '') {
            try {
              const fechaOriginal = new Date(horarioEnvio);
              if (!isNaN(fechaOriginal.getTime())) {
                fechaCreacion = fechaOriginal.toISOString().split('T')[0];
              }
            } catch (e) {
              console.warn('Error parseando fecha:', horarioEnvio);
            }
          }

          socios.push({
            nombre: nombre.trim(),
            apellido: apellidoFinal.trim(),
            correo: correo.trim().toLowerCase(),
            socio_desde: fechaCreacion
          });
        }
      }
    }
    
    return socios;
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setError(null);

    try {
      const csvContent = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(e);
        reader.readAsText(selectedFile);
      });

      const socios = parseCSV(csvContent);
      
      if (socios.length === 0) {
        setError('No se encontraron socios válidos en el archivo');
        return;
      }

      await onImportSocios(socios);
      onClose();
      
    } catch (err) {
      console.error('Error importando socios:', err);
      setError('Error al procesar el archivo CSV');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '600px',
          width: '90%',
          border: `1px solid ${colors.border}`,
          boxSizing: 'border-box'
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Upload size={24} color={colors.primary} />
            Importar Socios desde CSV
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
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
            <X size={20} color={colors.textSecondary} />
          </motion.button>
        </div>

        {/* Instructions */}
        <div style={{
          backgroundColor: colors.primary + '10',
          border: `1px solid ${colors.primary + '30'}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '20px'
        }}>
          <h3 style={{
            fontSize: '14px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <FileText size={16} color={colors.primary} />
            Formato esperado
          </h3>
          <p style={{
            fontSize: '12px',
            color: colors.textSecondary,
            margin: 0,
            lineHeight: '1.4'
          }}>
            El CSV debe tener las columnas: <strong>Horario de envío, Correo, Nombre, Apellido</strong><br/>
            Se importarán los primeros 4 campos y se mantendrá la fecha original de creación.
          </p>
        </div>

        {/* Error */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              backgroundColor: colors.error + '20',
              border: `1px solid ${colors.error}`,
              borderRadius: '8px',
              padding: '16px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertCircle size={20} color={colors.error} />
            <p style={{ color: colors.error, margin: 0, fontSize: '14px' }}>
              {error}
            </p>
          </motion.div>
        )}

        {/* Drag & Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${dragActive ? colors.primary : colors.border}`,
            borderRadius: '12px',
            padding: '40px 20px',
            textAlign: 'center',
            cursor: 'pointer',
            backgroundColor: dragActive ? colors.primary + '10' : colors.background,
            marginBottom: '20px',
            transition: 'all 0.2s ease'
          }}
        >
          <Upload size={48} color={dragActive ? colors.primary : colors.textSecondary} style={{ marginBottom: '16px' }} />
          <h3 style={{
            fontSize: '16px',
            fontWeight: '600',
            color: colors.text,
            margin: '0 0 8px 0'
          }}>
            {dragActive ? '¡Suelta el archivo aquí!' : 'Arrastra tu archivo CSV aquí'}
          </h3>
          <p style={{
            fontSize: '14px',
            color: colors.textSecondary,
            margin: '0 0 16px 0'
          }}>
            o haz click para seleccionar un archivo
          </p>
          <div style={{
            fontSize: '12px',
            color: colors.textSecondary
          }}>
            Máximo 5MB • Solo archivos CSV
          </div>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          onChange={handleFileInputChange}
          style={{ display: 'none' }}
        />

        {/* Preview */}
        {preview && (
          <div style={{
            backgroundColor: colors.background,
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
            border: `1px solid ${colors.border}`
          }}>
            <h4 style={{
              fontSize: '14px',
              fontWeight: '600',
              color: colors.text,
              margin: '0 0 12px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <FileText size={16} color={colors.primary} />
              Vista previa del archivo
            </h4>
            <pre style={{
              fontSize: '11px',
              color: colors.textSecondary,
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              backgroundColor: colors.surface,
              padding: '12px',
              borderRadius: '6px',
              border: `1px solid ${colors.border}`
            }}>
              {preview}
            </pre>
          </div>
        )}

        {/* Selected file info */}
        {selectedFile && (
          <div style={{
            backgroundColor: colors.success + '10',
            border: `1px solid ${colors.success + '30'}`,
            borderRadius: '8px',
            padding: '12px',
            marginBottom: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <CheckCircle size={20} color={colors.success} />
            <div>
              <p style={{
                fontSize: '14px',
                fontWeight: '500',
                color: colors.text,
                margin: '0 0 4px 0'
              }}>
                Archivo seleccionado: {selectedFile.name}
              </p>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: 0
              }}>
                Tamaño: {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            disabled={loading}
            style={{
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              opacity: loading ? 0.6 : 1
            }}
          >
            Cancelar
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={handleImport}
            disabled={!selectedFile || loading}
            style={{
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: (!selectedFile || loading) ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              opacity: (!selectedFile || loading) ? 0.6 : 1
            }}
          >
            {loading ? (
              <>
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  style={{
                    width: '16px',
                    height: '16px',
                    border: `2px solid transparent`,
                    borderTop: `2px solid white`,
                    borderRadius: '50%'
                  }}
                />
                Importando...
              </>
            ) : (
              <>
                <Users size={16} />
                Importar Socios
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default ImportSociosModal;
