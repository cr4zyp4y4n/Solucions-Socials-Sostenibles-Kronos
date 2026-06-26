import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import { describeFirmaAuditoriaRow, describeDocumentoAceptacion } from '../../utils/firmaAuditoriaLabels';
import { documentosPackOrdenados } from './firmaPageHelpers';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';
import { envioLabel } from './firmaPageHelpers';

export default function FirmaAuditoriaModal({ envio, rows, loading, onClose }) {
  const { colors } = useTheme();
  const docsAceptacion = envio ? documentosPackOrdenados(envio).map(describeDocumentoAceptacion) : [];

  return (
    <FirmaModal
      open={!!envio}
      onClose={onClose}
      titleId="firma-auditoria-title"
      title="Auditoría del envío"
      subtitle={envio ? `${envio.trabajador?.nombre || 'Trabajador'} · ${envioLabel(envio)}` : ''}
      width={600}
      footer={(
        <FirmaButton variant="ghost" onClick={onClose} style={{ width: '100%' }}>
          Cerrar
        </FirmaButton>
      )}
    >
      <p style={{ margin: '0 0 16px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
        Registro de respuestas Sí/No, DNI, SMS, firma, IP y navegador en el portal.
        El trabajador debe elegir Sí o No en cada documento; puede firmar con cualquiera de las dos respuestas.
      </p>

      {docsAceptacion.length ? (
        <div
          style={{
            marginBottom: 18,
            padding: 14,
            borderRadius: 12,
            border: `1px solid ${colors.border}`,
            background: colors.background
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 10, color: colors.textSecondary }}>
            Declaraciones por documento
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            {docsAceptacion.map((item, idx) => (
              <div
                key={`${item.tipo}-${idx}`}
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  fontSize: 12
                }}
              >
                <span style={{ fontWeight: 700 }}>{item.tipo}</span>
                <span
                  style={{
                    fontWeight: 800,
                    color: item.ok
                      ? item.esNo
                        ? colors.warning
                        : colors.success
                      : colors.error,
                    fontSize: 11
                  }}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {loading ? (
        <motion.div
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
          style={{ padding: 24, textAlign: 'center', color: colors.textSecondary }}
        >
          Cargando auditoría…
        </motion.div>
      ) : rows?.length ? (
        <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
          {rows.map((row, idx) => {
            const item = describeFirmaAuditoriaRow(row);
            return (
              <li
                key={item.id || idx}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '14px 1fr',
                  columnGap: 12,
                  paddingBottom: idx < rows.length - 1 ? 14 : 0
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    marginTop: 5,
                    borderRadius: '50%',
                    background: item.ok ? colors.success : colors.error
                  }}
                />
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{item.title}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 800,
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: item.ok ? `${colors.success}18` : `${colors.error}18`,
                        color: item.ok ? colors.success : colors.error
                      }}
                    >
                      {item.resultado}
                    </span>
                  </div>
                  <div style={{ marginTop: 4, fontSize: 12, color: colors.textSecondary }}>{item.at}</div>
                  {item.note ? (
                    <div style={{ marginTop: 4, fontSize: 12, lineHeight: 1.4 }}>{item.note}</div>
                  ) : null}
                  {item.ip ? (
                    <div style={{ marginTop: 4, fontSize: 11, fontFamily: 'ui-monospace, monospace', color: colors.textSecondary }}>
                      IP: {item.ip}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <div style={{ padding: 20, textAlign: 'center', color: colors.textSecondary, fontSize: 13 }}>
          Sin eventos de auditoría todavía.
        </div>
      )}
    </FirmaModal>
  );
}
