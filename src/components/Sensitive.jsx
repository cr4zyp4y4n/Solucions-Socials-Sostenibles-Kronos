import React from 'react';
import { usePrivacy } from './PrivacyContext';
import { applyPrivacyMask } from '../utils/privacyFormat';

/**
 * Muestra texto sensible enmascarado cuando el modo privacidad está activo.
 * Uso: <Sensitive value={empleado.dni} type="dni" />
 */
export default function Sensitive({
  value,
  type = 'text',
  children,
  as: Tag = 'span',
  style,
  className,
  title
}) {
  const { hideSensitiveData } = usePrivacy();
  const raw = value ?? children;
  if (raw == null || raw === '') return null;

  const display = applyPrivacyMask(raw, type, hideSensitiveData);

  return (
    <Tag
      data-sensitive={hideSensitiveData ? type : undefined}
      style={style}
      className={className}
      title={title}
    >
      {display}
    </Tag>
  );
}
