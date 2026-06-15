import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';

export function FirmaCard({ children, style, noPadding = false }) {
  const { colors } = useTheme();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28 }}
      style={{
        background: colors.surface,
        border: `1px solid ${colors.border}`,
        borderRadius: 16,
        padding: noPadding ? 0 : 20,
        ...style
      }}
    >
      {children}
    </motion.div>
  );
}

export function FirmaFieldLabel({ children }) {
  const { colors } = useTheme();
  return (
    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>
      {children}
    </div>
  );
}

const inputBase = (colors) => ({
  width: '100%',
  padding: '10px 12px',
  borderRadius: 10,
  border: `1px solid ${colors.border}`,
  background: colors.background,
  color: colors.text,
  boxSizing: 'border-box',
  fontSize: 14,
  fontFamily: 'inherit'
});

export function FirmaInput({ style, ...props }) {
  const { colors } = useTheme();
  return <input {...props} style={{ ...inputBase(colors), ...style }} />;
}

export function FirmaSelect({ style, children, ...props }) {
  const { colors } = useTheme();
  return (
    <select {...props} style={{ ...inputBase(colors), ...style }}>
      {children}
    </select>
  );
}

export function FirmaTextarea({ style, ...props }) {
  const { colors } = useTheme();
  return (
    <textarea
      {...props}
      style={{ ...inputBase(colors), resize: 'vertical', minHeight: 80, ...style }}
    />
  );
}

export function FirmaButton({
  children,
  onClick,
  disabled,
  variant = 'secondary',
  size = 'md',
  style,
  title,
  type = 'button'
}) {
  const { colors } = useTheme();
  const pad = size === 'sm' ? '7px 11px' : '10px 14px';
  const fontSize = size === 'sm' ? 12 : 14;

  const variants = {
    primary: {
      border: 'none',
      background: colors.primary,
      color: '#fff',
      fontWeight: 800
    },
    success: {
      border: `1px solid ${colors.success}55`,
      background: `${colors.success}14`,
      color: colors.success,
      fontWeight: 800
    },
    danger: {
      border: `1px solid ${colors.error}55`,
      background: `${colors.error}10`,
      color: colors.error,
      fontWeight: 700
    },
    ghost: {
      border: 'none',
      background: 'transparent',
      color: colors.textSecondary,
      fontWeight: 600
    },
    secondary: {
      border: `1px solid ${colors.border}`,
      background: colors.background,
      color: colors.text,
      fontWeight: 700
    }
  };

  const v = variants[variant] || variants.secondary;

  return (
    <button
      type={type}
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        padding: pad,
        borderRadius: 10,
        fontSize,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        fontFamily: 'inherit',
        whiteSpace: 'nowrap',
        transition: 'opacity 0.15s, transform 0.15s',
        ...v,
        ...style
      }}
    >
      {children}
    </button>
  );
}

export function FirmaStatusBadge({ flow, onClick, title }) {
  const { colors } = useTheme();
  const tone = {
    firmado: colors.success,
    cancelado: colors.error,
    otp_enviado: colors.info,
    portal_abierto: colors.info,
    link_enviado: colors.warning,
    pendiente: colors.textSecondary
  }[flow.key] || colors.textSecondary;

  const Comp = onClick ? 'button' : 'span';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      title={title}
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '5px 11px',
        borderRadius: 999,
        border: onClick ? 'none' : `1px solid ${tone}33`,
        background: `${tone}18`,
        color: tone,
        fontWeight: 800,
        fontSize: 12,
        fontFamily: 'inherit',
        cursor: onClick ? 'pointer' : 'default'
      }}
    >
      {flow.label}
    </Comp>
  );
}

export function FirmaTabs({ tabs, active, onChange }) {
  const { colors } = useTheme();
  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: 4,
        borderRadius: 12,
        background: colors.background,
        border: `1px solid ${colors.border}`,
        flexWrap: 'wrap'
      }}
    >
      {tabs.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            style={{
              flex: '1 1 auto',
              minWidth: 120,
              padding: '10px 16px',
              borderRadius: 9,
              border: 'none',
              background: isActive ? colors.surface : 'transparent',
              color: isActive ? colors.text : colors.textSecondary,
              fontWeight: isActive ? 800 : 600,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: isActive ? `0 1px 4px ${colors.border}` : 'none',
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s'
            }}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

export function FirmaChip({ active, onClick, children }) {
  const { colors } = useTheme();
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '6px 12px',
        borderRadius: 999,
        border: `1px solid ${active ? colors.primary : colors.border}`,
        background: active ? `${colors.primary}18` : colors.background,
        color: active ? colors.primary : colors.textSecondary,
        fontWeight: active ? 800 : 600,
        fontSize: 12,
        cursor: 'pointer',
        fontFamily: 'inherit'
      }}
    >
      {children}
    </button>
  );
}
