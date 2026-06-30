import React from 'react';
import { AlertCircle, DownloadCloud, RefreshCw, UploadCloud } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { KronosButton, KronosCard } from '../kronos';
import { formatFileSize } from './innuvaConverterCore';

export default function InnuvaUploadPanel({
  innuvaFile,
  isProcessing,
  error,
  hasData,
  onSelectFile,
  onReset,
  onDownload,
  canDownload
}) {
  const { colors } = useTheme();

  return (
    <KronosCard>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ margin: '0 0 6px', fontSize: 16, fontWeight: 800, color: colors.text }}>
            Archivo de Innuva
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
            Sube el Excel o CSV de nóminas de Innuva. Todo se procesa en local, sin enviar datos a servidores externos.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <KronosButton variant="primary" onClick={onSelectFile} disabled={isProcessing}>
            <UploadCloud size={16} />
            {isProcessing ? 'Procesando…' : 'Seleccionar archivo'}
          </KronosButton>
          {hasData ? (
            <>
              <KronosButton onClick={onDownload} disabled={!canDownload}>
                <DownloadCloud size={16} />
                Descargar Holded
              </KronosButton>
              <KronosButton onClick={onReset}>
                <RefreshCw size={15} />
                Reiniciar
              </KronosButton>
            </>
          ) : null}
        </div>
      </div>

      {innuvaFile ? (
        <div
          style={{
            marginTop: 14,
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            padding: 14,
            borderRadius: 12,
            border: `1px dashed ${colors.border}`,
            background: colors.background
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Archivo</div>
            <div style={{ fontWeight: 700, fontSize: 14, marginTop: 4 }}>{innuvaFile.name}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tamaño</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>{formatFileSize(innuvaFile.size)}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Modificado</div>
            <div style={{ fontWeight: 600, fontSize: 14, marginTop: 4 }}>
              {new Date(innuvaFile.lastModified).toLocaleString('es-ES')}
            </div>
          </div>
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            marginTop: 14,
            display: 'flex',
            gap: 10,
            alignItems: 'flex-start',
            padding: 14,
            borderRadius: 12,
            border: `1px solid ${colors.error}55`,
            background: `${colors.error}10`,
            color: colors.error,
            fontSize: 13
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <div style={{ fontWeight: 700 }}>No se pudo procesar el archivo</div>
            <div>{error}</div>
          </div>
        </div>
      ) : null}
    </KronosCard>
  );
}
