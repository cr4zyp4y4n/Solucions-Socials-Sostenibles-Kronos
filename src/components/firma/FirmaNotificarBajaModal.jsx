import React from 'react';
import { CheckCircle, Mail, Phone } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import FirmaModal from './FirmaModal';
import { FirmaButton } from './FirmaUi';
import { canalesNotificacionBaja, envioLabel } from './firmaPageHelpers';

export default function FirmaNotificarBajaModal({
  envio,
  onClose,
  onWhatsApp,
  onEmail,
  onRefresh
}) {
  const { colors } = useTheme();
  if (!envio) return null;

  const canales = canalesNotificacionBaja(envio);
  const telefono = String(envio.trabajador?.telefono || '').trim();
  const email = String(envio.trabajador?.email || '').trim();

  return (
    <FirmaModal
      open={!!envio}
      onClose={onClose}
      titleId="firma-notificar-baja-title"
      title="Notificar fin de relación laboral"
      subtitle={`${envio.trabajador?.nombre || 'Trabajador'} · ${envioLabel(envio)}`}
      width={520}
      footer={(
        <div style={{ display: 'grid', gap: 8 }}>
          {onRefresh ? (
            <FirmaButton variant="ghost" onClick={onRefresh} style={{ width: '100%' }}>
              Actualizar estado
            </FirmaButton>
          ) : null}
          <FirmaButton variant="ghost" onClick={onClose} style={{ width: '100%' }}>
            {canales.completo ? 'Cerrar' : 'Cerrar (puedes enviar después desde Envíos)'}
          </FirmaButton>
        </div>
      )}
    >
      <p style={{ margin: '0 0 16px', fontSize: 13, color: colors.textSecondary, lineHeight: 1.5 }}>
        Para acreditar la comunicación al trabajador, envía el mismo enlace del portal por{' '}
        <strong>WhatsApp</strong> y por <strong>email</strong>. Cada vía queda registrada en el seguimiento
        y en la auditoría.
      </p>

      {canales.completo ? (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: `${colors.success}12`,
            border: `1px solid ${colors.success}44`,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <CheckCircle size={18} color={colors.success} />
          Doble vía completada: WhatsApp y email registrados.
        </div>
      ) : (
        <div
          style={{
            marginBottom: 16,
            padding: 12,
            borderRadius: 12,
            background: `${colors.warning}10`,
            border: `1px solid ${colors.warning}44`,
            fontSize: 13
          }}
        >
          Pendiente: envía por {[!canales.whatsapp && 'WhatsApp', !canales.email && 'email'].filter(Boolean).join(' y ')}.
        </div>
      )}

      <div style={{ display: 'grid', gap: 12 }}>
        <CanalCard
          colors={colors}
          icon={Phone}
          titulo="WhatsApp"
          destino={telefono || 'Sin teléfono en Holded'}
          enviado={canales.whatsapp}
          disabled={!telefono}
          onClick={() => onWhatsApp(envio)}
        />
        <CanalCard
          colors={colors}
          icon={Mail}
          titulo="Email"
          destino={email || 'Sin email en Holded'}
          enviado={canales.email}
          disabled={!email}
          onClick={() => onEmail(envio)}
        />
      </div>
    </FirmaModal>
  );
}

function CanalCard({ colors, icon: Icon, titulo, destino, enviado, disabled, onClick }) {
  return (
    <div
      style={{
        padding: 14,
        borderRadius: 12,
        border: `1px solid ${enviado ? colors.success : colors.border}`,
        background: enviado ? `${colors.success}08` : colors.background
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 14 }}>
            <Icon size={16} color={enviado ? colors.success : colors.primary} />
            {titulo}
            {enviado ? (
              <span style={{ fontSize: 11, color: colors.success, fontWeight: 800 }}>✓ Enviado</span>
            ) : null}
          </div>
          <div style={{ marginTop: 6, fontSize: 12, color: colors.textSecondary }}>{destino}</div>
        </div>
        <FirmaButton size="sm" disabled={disabled} onClick={onClick}>
          {enviado ? 'Reenviar' : 'Enviar'}
        </FirmaButton>
      </div>
    </div>
  );
}
