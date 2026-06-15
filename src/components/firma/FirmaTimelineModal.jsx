import React from 'react';
import { Clock, FileText } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';
import {
  buildFirmaTimeline,
  envioLabel,
  envioTieneDocumentosFirmados
} from './firmaPageHelpers';

export default function FirmaTimelineModal({ envio, onClose, onVerFirmados, onAuditoria }) {
  const { colors } = useTheme();
  if (!envio) return null;

  const steps = buildFirmaTimeline(envio);

  return (
    <FirmaModal
      open={!!envio}
      onClose={onClose}
      titleId="firma-timeline-title"
      title="Seguimiento del envío"
      subtitle={`${envio.trabajador?.nombre || 'Trabajador'} · ${envioLabel(envio)}`}
      width={480}
      footer={(
        <div style={{ display: 'grid', gap: 8 }}>
          {envioTieneDocumentosFirmados(envio) ? (
            <FirmaButton variant="success" onClick={() => onVerFirmados(envio)} style={{ width: '100%' }}>
              <FileText size={15} />
              Ver PDFs firmados
            </FirmaButton>
          ) : null}
          <FirmaButton onClick={() => onAuditoria(envio)} style={{ width: '100%' }}>
            <Clock size={15} />
            Ver auditoría
          </FirmaButton>
          <FirmaButton variant="ghost" onClick={onClose} style={{ width: '100%' }}>
            Cerrar
          </FirmaButton>
        </div>
      )}
    >
      <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
        {steps.map((step, idx, arr) => (
          <li
            key={step.key}
            style={{
              display: 'grid',
              gridTemplateColumns: '16px 1fr',
              columnGap: 14,
              paddingBottom: idx < arr.length - 1 ? 16 : 0
            }}
          >
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  display: 'block',
                  width: 10,
                  height: 10,
                  marginTop: 5,
                  marginLeft: 3,
                  borderRadius: '50%',
                  background: step.display ? colors.success : colors.border,
                  boxShadow: step.display ? `0 0 0 3px ${colors.success}22` : 'none'
                }}
              />
              {idx < arr.length - 1 ? (
                <span
                  style={{
                    position: 'absolute',
                    left: 7,
                    top: 18,
                    bottom: -16,
                    width: 2,
                    background: colors.border
                  }}
                />
              ) : null}
            </div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 13 }}>{step.title}</div>
              <div
                style={{
                  marginTop: 4,
                  fontSize: 13,
                  color: step.display ? colors.text : colors.textSecondary,
                  fontWeight: step.display ? 600 : 500
                }}
              >
                {step.display || 'Pendiente'}
              </div>
              {step.note ? (
                <div style={{ marginTop: 4, fontSize: 11, color: colors.textSecondary, lineHeight: 1.4 }}>
                  {step.note}
                </div>
              ) : null}
            </div>
          </li>
        ))}
      </ol>
    </FirmaModal>
  );
}
