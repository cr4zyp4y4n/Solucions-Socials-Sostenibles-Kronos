import React, { useMemo, useState } from 'react';
import {
  filterProveidorsForSelector,
  ESTATS_US_PROVEIDOR,
  updateProveidorEstatUs
} from '../../services/obradorSupabaseService';

const LABELS_ESTAT = {
  habitual: 'Habituals',
  ocasional: 'Ocasionals',
  revisar: 'Revisar',
  inactiu: 'Inactius'
};

/**
 * Selector de proveïdor Obrador: cerca, toggle inactius, grups per estat_us.
 */
export default function ObradorProveidorSelect({
  proveidors = [],
  value = '',
  onChange,
  colors,
  inputStyle,
  labelStyle,
  required = false,
  id = 'id_proveidor',
  disabled = false,
  /** Si true, mostra control per canviar estat_us del seleccionat */
  canEditEstat = false,
  onEstatUpdated
}) {
  const [cerca, setCerca] = useState('');
  const [mostrarInactius, setMostrarInactius] = useState(false);
  const [savingEstat, setSavingEstat] = useState(false);
  const [estatError, setEstatError] = useState('');

  const filtrats = useMemo(
    () =>
      filterProveidorsForSelector(proveidors, {
        incloureInactius: mostrarInactius,
        cerca,
        selectedId: value || null
      }),
    [proveidors, mostrarInactius, cerca, value]
  );

  const grups = useMemo(() => {
    const map = { habitual: [], ocasional: [], revisar: [], inactiu: [], altre: [] };
    for (const p of filtrats) {
      const k = LABELS_ESTAT[p.estat_us] ? p.estat_us : 'altre';
      map[k].push(p);
    }
    return map;
  }, [filtrats]);

  const seleccionat = useMemo(
    () => (proveidors || []).find((p) => p.id === value) || null,
    [proveidors, value]
  );

  const handleEstatChange = async (nouEstat) => {
    if (!seleccionat?.id || !canEditEstat) return;
    setSavingEstat(true);
    setEstatError('');
    try {
      const updated = await updateProveidorEstatUs(seleccionat.id, nouEstat);
      onEstatUpdated?.(updated);
    } catch (err) {
      setEstatError(err.message || 'Error actualitzant estat');
    } finally {
      setSavingEstat(false);
    }
  };

  const baseInput = inputStyle || {};
  const baseLabel = labelStyle || {
    display: 'block',
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 6,
    color: colors?.textSecondary
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <input
          type="search"
          placeholder="Cerca per nom, NIF o codi…"
          value={cerca}
          onChange={(e) => setCerca(e.target.value)}
          disabled={disabled}
          style={{ ...baseInput, flex: '1 1 160px', minWidth: 140 }}
          aria-label="Cercar proveïdor"
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: colors?.textSecondary,
            cursor: 'pointer',
            whiteSpace: 'nowrap'
          }}
        >
          <input
            type="checkbox"
            checked={mostrarInactius}
            onChange={(e) => setMostrarInactius(e.target.checked)}
            disabled={disabled}
          />
          Mostrar inactius
        </label>
      </div>

      <select
        id={id}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        style={baseInput}
        required={required}
        disabled={disabled}
      >
        <option value="">Selecciona proveïdor...</option>
        {grups.habitual.length > 0 && (
          <optgroup label={LABELS_ESTAT.habitual}>
            {grups.habitual.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}{p.cif ? ` · ${p.cif}` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {grups.ocasional.length > 0 && (
          <optgroup label={LABELS_ESTAT.ocasional}>
            {grups.ocasional.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}{p.cif ? ` · ${p.cif}` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {mostrarInactius && grups.revisar.length > 0 && (
          <optgroup label={LABELS_ESTAT.revisar}>
            {grups.revisar.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}{p.cif ? ` · ${p.cif}` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {mostrarInactius && grups.inactiu.length > 0 && (
          <optgroup label={LABELS_ESTAT.inactiu}>
            {grups.inactiu.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nom}{p.cif ? ` · ${p.cif}` : ''}
              </option>
            ))}
          </optgroup>
        )}
        {/* Seleccionat inactiu/revisar sense toggle: encara es veu */}
        {!mostrarInactius && seleccionat && (seleccionat.estat_us === 'inactiu' || seleccionat.estat_us === 'revisar') && (
          <optgroup label={LABELS_ESTAT[seleccionat.estat_us] || 'Altres'}>
            <option value={seleccionat.id}>
              {seleccionat.nom}{seleccionat.cif ? ` · ${seleccionat.cif}` : ''}
            </option>
          </optgroup>
        )}
      </select>

      {canEditEstat && seleccionat && (
        <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ ...baseLabel, marginBottom: 0 }}>Estat d&apos;ús</span>
          <select
            value={seleccionat.estat_us || 'habitual'}
            onChange={(e) => handleEstatChange(e.target.value)}
            disabled={disabled || savingEstat}
            style={{ ...baseInput, width: 'auto', minWidth: 140 }}
          >
            {ESTATS_US_PROVEIDOR.map((e) => (
              <option key={e} value={e}>{e}</option>
            ))}
          </select>
          {savingEstat ? (
            <span style={{ fontSize: 12, color: colors?.textSecondary }}>Desant…</span>
          ) : null}
          {estatError ? (
            <span style={{ fontSize: 12, color: colors?.error || '#c0392b' }}>{estatError}</span>
          ) : null}
        </div>
      )}
    </div>
  );
}
