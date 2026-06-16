import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, MoreHorizontal } from 'feather-icons-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import { FirmaButton } from './FirmaUi';

function useDropdownPosition(triggerRef, open) {
  const [rect, setRect] = useState(null);

  const update = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setRect({
      top: r.bottom + 6,
      left: r.left,
      right: r.right,
      bottom: r.top - 6
    });
  }, [triggerRef]);

  useLayoutEffect(() => {
    if (!open) return;
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, update]);

  return rect;
}

function DropdownPanel({
  open,
  rect,
  align,
  onClose,
  items,
  triggerRef,
  minWidth = 200
}) {
  const { colors } = useTheme();
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (panelRef.current?.contains(e.target)) return;
      if (triggerRef?.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, onClose, triggerRef]);

  if (!open || !rect || typeof document === 'undefined') return null;

  const style = {
    position: 'fixed',
    zIndex: 10050,
    minWidth,
    padding: 6,
    borderRadius: 12,
    background: colors.surface,
    border: `1px solid ${colors.border}`,
    boxShadow: '0 16px 40px rgba(0,0,0,0.28)'
  };

  if (align === 'right') {
    style.right = Math.max(8, window.innerWidth - rect.right);
    style.top = rect.top;
  } else {
    style.left = Math.max(8, rect.left);
    style.top = rect.top;
  }

  const maxHeight = window.innerHeight - (style.top || 0) - 12;
  if (maxHeight > 120) style.maxHeight = maxHeight;
  style.overflowY = 'auto';

  return createPortal(
    <AnimatePresence>
      <motion.div
        ref={panelRef}
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        style={style}
        role="menu"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="menuitem"
            disabled={item.disabled}
            onClick={() => {
              onClose();
              item.onClick?.();
            }}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 12px',
              border: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: item.danger ? colors.error : colors.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
              opacity: item.disabled ? 0.45 : 1,
              textAlign: 'left',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = colors.hover;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            {item.icon ? <item.icon size={15} /> : null}
            {item.label}
          </button>
        ))}
      </motion.div>
    </AnimatePresence>,
    document.body
  );
}

export function FirmaDropdown({ label, icon: Icon, items, disabled, align = 'left' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const rect = useDropdownPosition(triggerRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-flex' }}>
        <FirmaButton
          size="sm"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          style={{ gap: 4 }}
          aria-expanded={open}
          aria-haspopup="menu"
        >
          {Icon ? <Icon size={14} /> : null}
          {label}
          <ChevronDown size={14} style={{ opacity: 0.7 }} />
        </FirmaButton>
      </div>
      <DropdownPanel
        open={open}
        rect={rect}
        align={align}
        items={items}
        triggerRef={triggerRef}
        onClose={() => setOpen(false)}
      />
    </>
  );
}

export function FirmaIconMenu({ items, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const rect = useDropdownPosition(triggerRef, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <div ref={triggerRef} style={{ display: 'inline-flex' }}>
        <FirmaButton
          size="sm"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
          title="Más acciones"
          aria-expanded={open}
          aria-haspopup="menu"
        >
          <MoreHorizontal size={18} />
        </FirmaButton>
      </div>
      <DropdownPanel
        open={open}
        rect={rect}
        align={align}
        items={items}
        triggerRef={triggerRef}
        minWidth={196}
        onClose={() => setOpen(false)}
      />
    </>
  );
}
