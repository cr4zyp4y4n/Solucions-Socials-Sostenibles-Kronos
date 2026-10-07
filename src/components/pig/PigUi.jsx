import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';

export function PigCard({ children, style, noPadding = false }) {
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

export function PigFieldLabel({ children }) {
  const { colors } = useTheme();
  return (
    <div style={{ fontSize: 12, color: colors.textSecondary, marginBottom: 6, fontWeight: 700 }}>
      {children}
    </div>
  );
}

export function PigSectionTitle({ children, hint }) {
  const { colors } = useTheme();
  return (
    <div style={{ marginBottom: hint ? 8 : 12 }}>
      <div style={{ fontSize: 15, fontWeight: 900, color: colors.text }}>{children}</div>
      {hint ? (
        <div style={{ marginTop: 6, fontSize: 12, color: colors.textSecondary, lineHeight: 1.4 }}>
          {hint}
        </div>
      ) : null}
    </div>
  );
}

export function PigHint({ children, style }) {
  const { colors } = useTheme();
  return (
    <div style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 1.4, ...style }}>
      {children}
    </div>
  );
}

export function PigStatusText({ children }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, color: colors.textSecondary }}>
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
  fontFamily: 'inherit',
  fontWeight: 700
});

export function PigInput({ style, ...props }) {
  const { colors } = useTheme();
  return <input {...props} style={{ ...inputBase(colors), ...style }} />;
}

export function PigSelect({ style, children, ...props }) {
  const { colors } = useTheme();
  return (
    <select {...props} style={{ ...inputBase(colors), ...style }}>
      {children}
    </select>
  );
}

export function PigButton({
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

export function PigSheetBadge({ children, style }) {
  const { colors } = useTheme();
  if (!children) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        border: `1px solid ${colors.primary}44`,
        background: `${colors.primary}12`,
        color: colors.primary,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: 0.2,
        ...style
      }}
    >
      → {children}
    </span>
  );
}

export function PigTabs({ tabs, active, onChange }) {
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
            title={tab.sheet ? `${tab.label} → ${tab.sheet}` : tab.label}
            onClick={() => onChange(tab.id)}
            style={{
              flex: '1 1 auto',
              minWidth: tab.sheet ? 140 : 120,
              padding: tab.sheet ? '8px 12px' : '10px 16px',
              borderRadius: 9,
              border: 'none',
              background: isActive ? colors.surface : 'transparent',
              color: isActive ? colors.text : colors.textSecondary,
              fontWeight: isActive ? 800 : 600,
              fontSize: 13,
              cursor: 'pointer',
              boxShadow: isActive ? `0 1px 4px ${colors.border}` : 'none',
              fontFamily: 'inherit',
              transition: 'background 0.2s, color 0.2s',
              textAlign: 'center'
            }}
          >
            <div>{tab.label}</div>
            {tab.sheet ? (
              <div
                style={{
                  marginTop: 2,
                  fontSize: 10,
                  fontWeight: 700,
                  color: isActive ? colors.primary : colors.textSecondary,
                  lineHeight: 1.25,
                  opacity: isActive ? 1 : 0.85,
                  textAlign: 'center'
                }}
              >
                → {tab.sheet}
              </div>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export function PigChip({ active, onClick, children }) {
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

export function PigFilePick({ label, file, accept, onChange, emptyLabel = 'Seleccionar archivo' }) {
  const { colors } = useTheme();
  return (
    <label
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        cursor: 'pointer',
        border: `1px solid ${colors.border}`,
        background: colors.background,
        fontWeight: 800,
        width: 'fit-content',
        maxWidth: '100%',
        color: colors.text
      }}
    >
      {label}
      <span
        style={{
          fontWeight: 700,
          fontSize: 13,
          color: file ? colors.text : colors.textSecondary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: 360
        }}
      >
        {file ? file.name : emptyLabel}
      </span>
      <input type="file" accept={accept} style={{ display: 'none' }} onChange={onChange} />
    </label>
  );
}

export function PigTabPanel({ children }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      style={{ display: 'grid', gap: 14 }}
    >
      {children}
    </motion.div>
  );
}
