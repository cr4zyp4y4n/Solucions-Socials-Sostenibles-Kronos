import React from 'react';
import { motion } from 'framer-motion';
import { useTheme } from './ThemeContext';

export default function SectionHeader({ icon: Icon, title, subtitle, actions }) {
  const { colors } = useTheme();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ marginBottom: 24 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, minWidth: 280 }}>
          {Icon ? <Icon size={32} color={colors.primary} /> : null}
          <div>
            <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0, color: colors.text }}>
              {title}
            </h1>
            {subtitle ? (
              typeof subtitle === 'string' ? (
                <p style={{ fontSize: 14, color: colors.textSecondary, margin: '4px 0 0 0' }}>
                  {subtitle}
                </p>
              ) : (
                <div style={{ fontSize: 14, color: colors.textSecondary, margin: '4px 0 0 0' }}>
                  {subtitle}
                </div>
              )
            ) : null}
          </div>
        </div>
        {actions ? <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>{actions}</div> : null}
      </div>
    </motion.div>
  );
}

