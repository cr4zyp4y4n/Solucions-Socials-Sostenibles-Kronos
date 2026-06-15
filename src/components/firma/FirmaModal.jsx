import React, { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { X } from 'feather-icons-react';
import { useTheme } from '../ThemeContext';

export function useModalEscape(open, onClose) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
}

export function useClickOutside(ref, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onClose, enabled]);
}

export default function FirmaModal({
  open,
  onClose,
  title,
  subtitle,
  titleId,
  children,
  footer,
  width = 520
}) {
  const { colors } = useTheme();
  useModalEscape(open, onClose);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="presentation"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16
          }}
        >
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: `min(${width}px, 100%)`,
              maxHeight: 'min(88vh, 720px)',
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              borderRadius: 18,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
              color: colors.text
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                gap: 12,
                padding: '18px 20px',
                borderBottom: `1px solid ${colors.border}`,
                flexShrink: 0
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div id={titleId} style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.3 }}>
                  {title}
                </div>
                {subtitle ? (
                  <div style={{ marginTop: 6, fontSize: 13, color: colors.textSecondary, fontWeight: 500 }}>
                    {subtitle}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                aria-label="Cerrar"
                onClick={onClose}
                style={{
                  flexShrink: 0,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: colors.background,
                  color: colors.text,
                  cursor: 'pointer'
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: '16px 20px 20px', overflow: 'auto', flex: 1 }}>{children}</div>
            {footer ? (
              <div
                style={{
                  padding: '14px 20px 18px',
                  borderTop: `1px solid ${colors.border}`,
                  flexShrink: 0
                }}
              >
                {footer}
              </div>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
