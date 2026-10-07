import React from 'react';
import { X } from 'feather-icons-react';

/**
 * Modal unificado del Panel de Administrador.
 */
export default function AdminModal({
  open,
  onClose,
  title,
  description,
  colors,
  children,
  footer = null,
  maxWidth = 520,
  closeDisabled = false
}) {
  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20
      }}
      onClick={() => {
        if (!closeDisabled) onClose?.();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          width: '100%',
          maxWidth,
          border: `1px solid ${colors.border}`,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 12px 40px rgba(0,0,0,0.18)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '16px 18px',
            borderBottom: `1px solid ${colors.border}`
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                color: colors.text
              }}
            >
              {title}
            </h2>
            {description ? (
              <p
                style={{
                  margin: '6px 0 0',
                  fontSize: 13,
                  color: colors.textSecondary,
                  lineHeight: 1.4
                }}
              >
                {description}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Cerrar"
            style={{
              background: 'none',
              border: 'none',
              cursor: closeDisabled ? 'not-allowed' : 'pointer',
              color: colors.textSecondary,
              padding: 4,
              opacity: closeDisabled ? 0.5 : 1
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 18 }}>{children}</div>

        {footer ? (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              flexWrap: 'wrap',
              padding: '14px 18px',
              borderTop: `1px solid ${colors.border}`
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
