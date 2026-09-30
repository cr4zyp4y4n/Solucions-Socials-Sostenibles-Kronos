import React from 'react';

/** Banner compartit per vistes Enfortim encara no tancades post-reunió. */
export default function ObradorEnfortimBanner({ colors }) {
  const warning = colors?.warning || '#e67e22';
  return (
    <div
      style={{
        padding: '12px 16px',
        marginBottom: 20,
        borderRadius: 8,
        background: `${warning}18`,
        border: `1px solid ${warning}66`,
        color: colors?.text || '#222',
        fontSize: 13,
        lineHeight: 1.5
      }}
    >
      <strong>Enfortim / ESCALBRADOR — esquelet provisional.</strong>
      {' '}
      No tancar esquema SQL ni lliurables fins després de la reunió amb Sergi i Bruno.
      {' '}
      Dossier: <code style={{ fontSize: 12 }}>docs/ENFORTIM_DOSSIER_REUNION.md</code>
      {' · '}
      SOPs: <code style={{ fontSize: 12 }}>docs/sops/</code>
    </div>
  );
}
