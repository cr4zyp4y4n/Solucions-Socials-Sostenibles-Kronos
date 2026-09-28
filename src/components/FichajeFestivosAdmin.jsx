import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Plus, Trash2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { KronosButton, KronosCard, KronosFieldLabel, KronosInput, KronosSelect } from './kronos';
import { ambitoFestivoLabel, FESTIVO_COLOR } from './panelFichajes/panelFichajesHelpers';
import { formatDateShortMadrid } from '../utils/timeUtils';

const FichajeFestivosAdmin = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [anio, setAnio] = useState(() => new Date().getFullYear());
  const [festivos, setFestivos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fecha: '', nombre: '', ambito: 'estatal' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fichajeSupabaseService.obtenerFestivosAnio(anio);
      setFestivos(res.success ? res.data || [] : []);
      if (!res.success) setError(res.error || 'Error cargando festivos');
    } catch (err) {
      setError(err.message || 'Error cargando festivos');
      setFestivos([]);
    } finally {
      setLoading(false);
    }
  }, [anio]);

  useEffect(() => {
    load();
  }, [load]);

  const handleCrear = async () => {
    if (!form.fecha || !form.nombre.trim()) {
      setError('Fecha y nombre son obligatorios');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fichajeSupabaseService.crearFestivo({
        fecha: form.fecha,
        nombre: form.nombre,
        ambito: form.ambito,
        userId: user?.id
      });
      if (!res.success) {
        setError(res.error || 'No se pudo crear');
        return;
      }
      setSuccess('Festivo añadido');
      setForm({ fecha: '', nombre: '', ambito: 'estatal' });
      setShowForm(false);
      await load();
      setTimeout(() => setSuccess(''), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActivo = async (f) => {
    const res = await fichajeSupabaseService.actualizarFestivo(f.id, { activo: !f.activo });
    if (res.success) {
      setFestivos((prev) => prev.map((x) => (x.id === f.id ? { ...x, activo: !f.activo } : x)));
    } else {
      setError(res.error || 'No se pudo actualizar');
    }
  };

  const handleEliminar = async (f) => {
    if (!window.confirm(`¿Eliminar el festivo «${f.nombre}» (${f.fecha})?`)) return;
    const res = await fichajeSupabaseService.eliminarFestivo(f.id);
    if (res.success) {
      setFestivos((prev) => prev.filter((x) => x.id !== f.id));
    } else {
      setError(res.error || 'No se pudo eliminar');
    }
  };

  return (
    <div>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
          marginBottom: 18
        }}
      >
        <div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: colors.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Calendar size={20} color={FESTIVO_COLOR} />
            Festivos Barcelona
          </h3>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: colors.textSecondary, maxWidth: 560 }}>
            Calendario laboral de la ciudad (estatal + Cataluña + locales). No resta de vacaciones.
            Fuente inicial: Ajuntament de Barcelona.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <KronosSelect
            value={anio}
            onChange={(e) => setAnio(Number(e.target.value))}
            style={{ width: 110 }}
          >
            {[anio - 1, anio, anio + 1, anio + 2].filter((y, i, a) => a.indexOf(y) === i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </KronosSelect>
          <KronosButton size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw size={15} />
            Actualizar
          </KronosButton>
          <KronosButton size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus size={15} />
            {showForm ? 'Cancelar' : 'Añadir'}
          </KronosButton>
        </div>
      </div>

      {error ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: `${colors.error}14`,
            color: colors.error,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <AlertCircle size={16} />
          {error}
        </div>
      ) : null}
      {success ? (
        <div
          style={{
            marginBottom: 12,
            padding: '10px 12px',
            borderRadius: 8,
            background: `${colors.success}14`,
            color: colors.success,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <CheckCircle size={16} />
          {success}
        </div>
      ) : null}

      {showForm ? (
        <KronosCard style={{ marginBottom: 16, padding: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <KronosFieldLabel>Fecha</KronosFieldLabel>
              <KronosInput
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
              />
            </div>
            <div>
              <KronosFieldLabel>Nombre</KronosFieldLabel>
              <KronosInput
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. La Mercè"
              />
            </div>
            <div>
              <KronosFieldLabel>Ámbito</KronosFieldLabel>
              <KronosSelect
                value={form.ambito}
                onChange={(e) => setForm((f) => ({ ...f, ambito: e.target.value }))}
              >
                <option value="estatal">Estatal</option>
                <option value="autonomico">Autonómico</option>
                <option value="local">Local</option>
              </KronosSelect>
            </div>
          </div>
          <div style={{ marginTop: 12 }}>
            <KronosButton size="sm" onClick={handleCrear} disabled={saving}>
              Guardar festivo
            </KronosButton>
          </div>
        </KronosCard>
      ) : null}

      <KronosCard style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 28, textAlign: 'center', color: colors.textSecondary }}>Cargando…</div>
        ) : festivos.length === 0 ? (
          <div style={{ padding: 28, textAlign: 'center', color: colors.textSecondary }}>
            No hay festivos para {anio}. Ejecuta el SQL de seed o añádelos manualmente.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: colors.background, textAlign: 'left' }}>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: colors.textSecondary }}>Fecha</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: colors.textSecondary }}>Nombre</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: colors.textSecondary }}>Ámbito</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: colors.textSecondary }}>Estado</th>
                <th style={{ padding: '10px 14px', fontWeight: 600, color: colors.textSecondary }} />
              </tr>
            </thead>
            <tbody>
              {festivos.map((f) => (
                <tr key={f.id} style={{ borderTop: `1px solid ${colors.border}`, opacity: f.activo ? 1 : 0.55 }}>
                  <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>{formatDateShortMadrid(f.fecha)}</td>
                  <td style={{ padding: '10px 14px', fontWeight: 600 }}>{f.nombre}</td>
                  <td style={{ padding: '10px 14px' }}>{ambitoFestivoLabel(f.ambito)}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <button
                      type="button"
                      onClick={() => handleToggleActivo(f)}
                      style={{
                        border: 'none',
                        background: f.activo ? `${FESTIVO_COLOR}18` : `${colors.textSecondary}18`,
                        color: f.activo ? FESTIVO_COLOR : colors.textSecondary,
                        borderRadius: 6,
                        padding: '3px 8px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'inherit'
                      }}
                    >
                      {f.activo ? 'Activo' : 'Inactivo'}
                    </button>
                  </td>
                  <td style={{ padding: '10px 14px', textAlign: 'right' }}>
                    <KronosButton size="sm" variant="ghost" onClick={() => handleEliminar(f)} title="Eliminar">
                      <Trash2 size={14} />
                    </KronosButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </KronosCard>
    </div>
  );
};

export default FichajeFestivosAdmin;
