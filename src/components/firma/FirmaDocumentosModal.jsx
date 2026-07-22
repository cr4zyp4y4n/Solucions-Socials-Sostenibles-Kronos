import React from 'react';
import { CheckCircle, Download, Eye } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import Sensitive from '../Sensitive';
import { getFirmaDocumentoLabel } from '../../constants/firmaDocumentos';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';
import {
  documentosPackOrdenados,
  envioLabel,
  formatFirmaDate
} from './firmaPageHelpers';

export default function FirmaDocumentosModal({
  envio,
  loadingId,
  onClose,
  onVerPdf,
  onDescargarPdf
}) {
  const { colors } = useTheme();
  if (!envio) return null;

  const docs = documentosPackOrdenados(envio);

  return (
    <FirmaModal
      open={!!envio}
      onClose={onClose}
      titleId="firma-docs-title"
      title="Documentos firmados"
      subtitle={(
        <>
          <Sensitive value={envio.trabajador?.nombre || 'Trabajador'} type="name" />
          {' · '}
          {envioLabel(envio)}
        </>
      )}
      width={540}
      footer={(
        <FirmaButton variant="ghost" onClick={onClose} style={{ width: '100%' }}>
          Cerrar
        </FirmaButton>
      )}
    >
      {envio.firmado_at ? (
        <div style={{ marginBottom: 14, fontSize: 12, color: colors.success, fontWeight: 700 }}>
          Pack firmado el {formatFirmaDate(envio.firmado_at)}
        </div>
      ) : null}
      <div style={{ display: 'grid', gap: 10 }}>
        {docs.map((doc, idx) => {
          const firmado = !!(doc.storage_path_firmado || doc.firmado_at || doc.estado === 'firmado');
          const verKey = `${doc.id}:firmado`;
          const dlKey = `${doc.id}:dl:firmado`;
          return (
            <div
              key={doc.id}
              style={{
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${colors.border}`,
                background: colors.background
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 800, color: colors.textSecondary }}>
                    DOC {idx + 1}
                  </div>
                  <div style={{ fontWeight: 800, fontSize: 14, marginTop: 4 }}>
                    {getFirmaDocumentoLabel(doc.tipo_documento)}
                  </div>
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 12,
                      color: firmado ? colors.success : colors.textSecondary,
                      fontWeight: 700
                    }}
                  >
                    {firmado
                      ? `Firmado${doc.firmado_at ? ` · ${formatFirmaDate(doc.firmado_at)}` : ''}`
                      : 'Pendiente'}
                  </div>
                </div>
                {firmado ? <CheckCircle size={20} color={colors.success} /> : null}
              </div>
              {firmado ? (
                <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                  <FirmaButton
                    size="sm"
                    disabled={!!loadingId}
                    onClick={() => onVerPdf(doc)}
                  >
                    <Eye size={14} />
                    {loadingId === verKey ? 'Abriendo…' : 'Ver'}
                  </FirmaButton>
                  <FirmaButton
                    size="sm"
                    disabled={!!loadingId}
                    onClick={() => onDescargarPdf(doc)}
                  >
                    <Download size={14} />
                    {loadingId === dlKey ? 'Descargando…' : 'Descargar'}
                  </FirmaButton>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </FirmaModal>
  );
}
