import React, { useState } from 'react';
import { buildOcrDebugReport, formatOcrDebugText, downloadOcrDebugLog } from '../utils/obradorOcrDebug';
import { colors } from '../theme';

export default function OcrDebugPanel({ ocrDebug }) {
  const [open, setOpen] = useState(false);

  if (!ocrDebug?.report) return null;

  const { report } = ocrDebug;
  const border = colors.border || '#ccc';
  const textSecondary = colors.textSecondary || '#666';
  const surface = colors.surface || '#f5f5f5';

  return (
    <div style={{
      marginBottom: 16,
      borderRadius: 10,
      border: `1px solid ${border}`,
      overflow: 'hidden',
      fontSize: 12
    }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%',
          textAlign: 'left',
          padding: '10px 14px',
          border: 'none',
          background: surface,
          cursor: 'pointer',
          fontWeight: 600,
          fontSize: 13
        }}
      >
        {open ? '▼' : '▶'} Log OCR / depuració
        {!report.parser?.lotProveidor && ['multiembalajes', 'jotri', 'alvilardan'].includes(report.parser?.id) && (
          <span style={{ color: '#c0392b', marginLeft: 8 }}>— nº albarà no detectat</span>
        )}
      </button>

      {open && (
        <div style={{ padding: '12px 14px', lineHeight: 1.5 }}>
          <div style={{ marginBottom: 10, color: textSecondary }}>
            Origen: <strong>{report.ocr?.source}</strong>
            {' · '}
            {report.ocr?.charCount} caràcters
            {report.ocr?.usedHeaderCrop ? ' · retall capçalera (foto)' : ''}
            {report.ocr?.usedJotriRegions ? ' · retalls JOTRI al PDF' : ''}
          </div>

          {report.searchHints?.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <strong>Pistes de cerca:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {report.searchHints.map((hint) => (
                  <li key={hint} style={{ whiteSpace: 'pre-wrap', marginBottom: 4 }}>{hint}</li>
                ))}
              </ul>
            </div>
          )}

          <button
            type="button"
            onClick={() => downloadOcrDebugLog(report, report.fileName || 'obrador-ocr')}
            style={{
              marginBottom: 10,
              padding: '8px 12px',
              borderRadius: 8,
              border: `1px solid ${border}`,
              background: '#fff',
              cursor: 'pointer',
              fontSize: 12
            }}
          >
            Descarregar log (.txt)
          </button>

          <pre style={{
            margin: 0,
            padding: 10,
            borderRadius: 8,
            background: '#1e1e1e',
            color: '#d4d4d4',
            fontSize: 11,
            maxHeight: 280,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
          }}
          >
            {formatOcrDebugText(report)}
          </pre>
        </div>
      )}
    </div>
  );
}

export { buildOcrDebugReport };
