import React from 'react';

/**
 * Cabecera unificada para secciones del Panel de Administrador.
 */
export default function AdminSectionHeader({
  title,
  description,
  colors,
  actions = null
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 16,
        marginBottom: 20,
        flexWrap: 'wrap'
      }}
    >
      <div style={{ minWidth: 200, flex: 1 }}>
        <h2
          style={{
            fontSize: 20,
            fontWeight: 700,
            color: colors.text,
            margin: 0
          }}
        >
          {title}
        </h2>
        {description ? (
          <p
            style={{
              fontSize: 13,
              color: colors.textSecondary,
              margin: '6px 0 0 0',
              lineHeight: 1.4,
              maxWidth: 640
            }}
          >
            {description}
          </p>
        ) : null}
      </div>
      {actions ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {actions}
        </div>
      ) : null}
    </div>
  );
}
