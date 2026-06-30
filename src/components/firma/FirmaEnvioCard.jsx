import React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle,
  Clock,
  Copy,
  Eye,
  FileText,
  Link2,
  Mail,
  Phone,
  Send,
  XCircle
} from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { getFirmaDocumentoLabel, envioEsPackBaja } from '../../constants/firmaDocumentos';
import {
  canalesNotificacionBaja,
  envioLabel,
  envioTieneDocumentosFirmados,
  flowEstadoFirma,
  formatFirmaDate
} from './firmaPageHelpers';
import { FirmaButton, FirmaStatusBadge } from './FirmaUi';
import { FirmaDropdown, FirmaIconMenu } from './FirmaDropdown';

const flowIcon = (key) => {
  if (key === 'firmado') return CheckCircle;
  if (key === 'cancelado') return XCircle;
  if (key === 'otp_enviado') return Send;
  if (key === 'portal_abierto') return Eye;
  return FileText;
};

export default function FirmaEnvioCard({
  envio,
  index,
  onTimeline,
  onCopyLink,
  onCopyMessage,
  onOpenLink,
  onWhatsApp,
  onEmail,
  onNotificarBaja,
  onAuditoria,
  onVerFirmados,
  onCancelar
}) {
  const { colors } = useTheme();
  const flow = flowEstadoFirma(envio);
  const FlowIcon = flowIcon(flow.key);
  const docs = envio.documentos || [];
  const firmados = envioTieneDocumentosFirmados(envio);
  const hasLink = !!envio.portal_link;
  const esBaja = envioEsPackBaja(envio);
  const canales = canalesNotificacionBaja(envio);

  const shareItems = [
    {
      key: 'copy-link',
      label: 'Copiar enlace',
      icon: Copy,
      disabled: !hasLink,
      onClick: () => onCopyLink(envio)
    },
    {
      key: 'copy-msg',
      label: 'Copiar mensaje',
      icon: Copy,
      disabled: !hasLink,
      onClick: () => onCopyMessage(envio)
    },
    {
      key: 'wa',
      label: 'WhatsApp',
      icon: Phone,
      disabled: !hasLink,
      onClick: () => onWhatsApp(envio)
    },
    {
      key: 'email',
      label: 'Email',
      icon: Send,
      disabled: !hasLink,
      onClick: () => onEmail(envio)
    },
    {
      key: 'open',
      label: 'Abrir portal',
      icon: Link2,
      disabled: !hasLink,
      onClick: () => onOpenLink(envio.portal_link)
    }
  ];

  const moreItems = [
    {
      key: 'timeline',
      label: 'Seguimiento',
      icon: Eye,
      onClick: () => onTimeline(envio)
    },
    {
      key: 'audit',
      label: 'Auditoría',
      icon: Clock,
      onClick: () => onAuditoria(envio)
    },
    ...(firmados
      ? [{
        key: 'signed',
        label: 'Ver PDFs firmados',
        icon: FileText,
        onClick: () => onVerFirmados(envio)
      }]
      : []),
    ...(envio.estado !== 'cancelado'
      ? [{
        key: 'cancel',
        label: 'Cancelar envío',
        icon: XCircle,
        danger: true,
        onClick: () => onCancelar(envio)
      }]
      : [])
  ];

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.2) }}
      style={{
        listStyle: 'none',
        borderRadius: 16,
        border: `1px solid ${colors.border}`,
        background: colors.surface,
        overflow: 'visible',
        position: 'relative'
      }}
    >
      <div style={{ padding: '16px 18px' }}>
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12
          }}
        >
          <div style={{ flex: '1 1 200px', minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.3 }}>
                {envio.trabajador?.nombre || 'Sin trabajador'}
              </div>
              <FirmaStatusBadge
                flow={flow}
                onClick={() => onTimeline(envio)}
                title="Ver seguimiento"
              />
            </div>
            <div style={{ marginTop: 4, fontSize: 13, color: colors.textSecondary, fontWeight: 600 }}>
              {envioLabel(envio)}
            </div>
            <div
              style={{
                marginTop: 10,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 6
              }}
            >
              {docs.slice(0, 4).map((d) => (
                <span
                  key={d.id}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '4px 8px',
                    borderRadius: 6,
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                    color: colors.textSecondary
                  }}
                >
                  {getFirmaDocumentoLabel(d.tipo_documento)}
                </span>
              ))}
              {docs.length > 4 ? (
                <span style={{ fontSize: 11, color: colors.textSecondary, alignSelf: 'center' }}>
                  +{docs.length - 4}
                </span>
              ) : null}
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gap: 4,
              fontSize: 12,
              color: colors.textSecondary,
              textAlign: 'right',
              flex: '0 0 auto'
            }}
          >
            {envio.trabajador?.telefono ? <div>{envio.trabajador.telefono}</div> : null}
            {envio.trabajador?.email ? <div>{envio.trabajador.email}</div> : null}
            {envio.firmado_at ? (
              <div style={{ color: colors.success, fontWeight: 700 }}>
                Firmado {formatFirmaDate(envio.firmado_at)}
              </div>
            ) : envio.created_at ? (
              <div>Creado {formatFirmaDate(envio.created_at)}</div>
            ) : null}
          </div>
        </div>

        <div
          style={{
            marginTop: 14,
            paddingTop: 14,
            borderTop: `1px solid ${colors.border}`,
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            gap: 8
          }}
        >
          <FirmaButton size="sm" onClick={() => onTimeline(envio)}>
            <FlowIcon size={14} />
            Seguimiento
          </FirmaButton>
          {esBaja ? (
            <>
              <FirmaButton
                size="sm"
                variant={canales.whatsapp ? 'success' : 'secondary'}
                disabled={!hasLink}
                onClick={() => onWhatsApp(envio)}
              >
                <Phone size={14} />
                WhatsApp{canales.whatsapp ? ' ✓' : ''}
              </FirmaButton>
              <FirmaButton
                size="sm"
                variant={canales.email ? 'success' : 'secondary'}
                disabled={!hasLink}
                onClick={() => onEmail(envio)}
              >
                <Mail size={14} />
                Email{canales.email ? ' ✓' : ''}
              </FirmaButton>
              <FirmaButton
                size="sm"
                disabled={!hasLink}
                onClick={() => onNotificarBaja?.(envio)}
              >
                <Send size={14} />
                Notificar
              </FirmaButton>
              <FirmaDropdown label="Más" icon={Copy} items={shareItems} disabled={!hasLink} />
            </>
          ) : (
            <FirmaDropdown label="Compartir" icon={Send} items={shareItems} disabled={!hasLink} />
          )}
          {firmados ? (
            <FirmaButton size="sm" variant="success" onClick={() => onVerFirmados(envio)}>
              <FileText size={14} />
              PDFs firmados
            </FirmaButton>
          ) : null}
          <div style={{ marginLeft: 'auto' }}>
            <FirmaIconMenu items={moreItems} align="right" />
          </div>
        </div>
      </div>
    </motion.li>
  );
}
