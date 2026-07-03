import React from 'react';
import { useTheme } from '../ThemeContext';
import { KronosButton, KronosModal } from '../kronos';
import {
  LICITACIONS_LEYENDA_CONTRACTACIO,
  LICITACIONS_LEYENDA_FUENTES,
  LICITACIONS_LEYENDA_JC
} from '../../constants/licitacionsLeyenda';

function SectionTitle({ children, colors }) {
  return (
    <h3 style={{
      margin: '0 0 12px',
      fontSize: 14,
      fontWeight: 800,
      color: colors.primary,
      letterSpacing: '0.02em'
    }}>
      {children}
    </h3>
  );
}

function ColorBadge({ label, color }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 10px',
      borderRadius: 999,
      fontSize: 11,
      fontWeight: 700,
      color,
      background: `${color}18`,
      border: `1px solid ${color}33`,
      lineHeight: 1.2,
      whiteSpace: 'nowrap'
    }}>
      {label}
    </span>
  );
}

function LeyendaRow({ badge, title, description, extra, colors }) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: 12,
      border: `1px solid ${colors.border}`,
      background: colors.background
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
        {badge}
        {title ? (
          <span style={{ fontSize: 13, fontWeight: 700, color: colors.text }}>{title}</span>
        ) : null}
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: colors.textSecondary }}>
        {description}
      </p>
      {extra ? (
        <div style={{ marginTop: 8, fontSize: 12, color: colors.textSecondary, lineHeight: 1.45 }}>
          {extra}
        </div>
      ) : null}
    </div>
  );
}

export default function LicitacionsLeyendaModal({ open, onClose }) {
  const { colors } = useTheme();

  return (
    <KronosModal
      open={open}
      onClose={onClose}
      title="Leyenda de estados"
      subtitle="Referencia rápida para revisar licitaciones (estado público, seguimiento SSS y fuentes)"
      titleId="licitacions-leyenda-title"
      width={680}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <KronosButton onClick={onClose}>Entendido</KronosButton>
        </div>
      )}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        <section>
          <SectionTitle colors={colors}>Estado del expediente (fuente pública)</SectionTitle>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
            Es el estado que publica TED, PSCP o PLACSP. Por defecto solo ves las
            {' '}
            <strong style={{ color: colors.text }}>vigentes</strong>
            {' '}
            (PRE y PUB con plazo abierto). El texto puede variar según la fuente, pero el código interno es el mismo.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LICITACIONS_LEYENDA_CONTRACTACIO.map((item) => (
              <LeyendaRow
                key={item.code}
                colors={colors}
                badge={(
                  <>
                    <ColorBadge label={item.label} color={item.color} />
                    <ColorBadge
                      label={item.vigent ? 'Vigente' : 'Cerrada / caducada'}
                      color={item.vigent ? '#10B981' : '#94A3B8'}
                    />
                  </>
                )}
                title={`Código ${item.code}`}
                description={item.description}
                extra={item.examples?.length ? (
                  <>
                    <strong style={{ color: colors.text }}>Ejemplos en pantalla:</strong>
                    {' '}
                    {item.examples.join(' · ')}
                  </>
                ) : null}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle colors={colors}>Estado JC (seguimiento interno SSS)</SectionTitle>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: colors.textSecondary, lineHeight: 1.5 }}>
            Lo gestionáis vosotros en la columna de estado. No lo publica la administración.
            {' '}
            <strong style={{ color: colors.text }}>Interessant</strong>
            {' '}
            y
            {' '}
            <strong style={{ color: colors.text }}>Contactat</strong>
            {' '}
            se conservan en base de datos aunque el plazo público haya cerrado.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LICITACIONS_LEYENDA_JC.map((item) => (
              <LeyendaRow
                key={item.value}
                colors={colors}
                badge={<ColorBadge label={item.label} color={item.color} />}
                description={item.description}
              />
            ))}
          </div>
        </section>

        <section>
          <SectionTitle colors={colors}>Fuentes de datos</SectionTitle>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {LICITACIONS_LEYENDA_FUENTES.map((item) => (
              <LeyendaRow
                key={item.source}
                colors={colors}
                badge={<ColorBadge label={item.source} color={item.color} />}
                description={item.description}
              />
            ))}
          </div>
        </section>

        <div style={{
          padding: '12px 14px',
          borderRadius: 12,
          background: `${colors.primary}10`,
          border: `1px solid ${colors.primary}25`,
          fontSize: 12,
          lineHeight: 1.5,
          color: colors.textSecondary
        }}>
          <strong style={{ color: colors.text }}>¿Por qué hay textos distintos?</strong>
          {' '}
          PSCP suele mostrar la fase en catalán (“Anunci previ”, “Anunci de licitació”).
          TED añade “(TED)” al estado. Kronos unifica todo con el mismo código (PRE, PUB…)
          para filtrar y contar vigentes.
        </div>
      </div>
    </KronosModal>
  );
}
