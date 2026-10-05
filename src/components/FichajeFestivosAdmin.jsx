import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Trash2, RefreshCw, CheckCircle, AlertCircle, Search } from 'lucide-react';
import fichajeSupabaseService from '../services/fichajeSupabaseService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { ambitoFestivoLabel, FESTIVO_COLOR } from './panelFichajes/panelFichajesHelpers';
import { formatDateShortMadrid } from '../utils/timeUtils';
import AdminSectionHeader from './AdminSectionHeader';

const AMBITOS = [
  { value: 'estatal', label: 'Estatal' },
  { value: 'autonomico', label: 'Autonómico' },
  { value: 'local', label: 'Local' }
];

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
  const [search, setSearch] = useState('');
  const [filterAmbito, setFilterAmbito] = useState('all');
  const [filterEstado, setFilterEstado] = useState('all');

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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return festivos.filter((f) => {
      if (filterAmbito !== 'all' && f.ambito !== filterAmbito) return false;
      if (filterEstado === 'activo' && !f.activo) return false;
      if (filterEstado === 'inactivo' && f.activo) return false;
      if (!q) return true;
      const blob = [f.nombre, f.fecha, ambitoFestivoLabel(f.ambito), formatDateShortMadrid(f.fecha)]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [festivos, search, filterAmbito, filterEstado]);

  const activosCount = festivos.filter((f) => f.activo).length;

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

  const inputStyle = {
    width: '100%',
    padding: '10px 12px',
    borderRadius: 8,
    border: `1px solid ${colors.border}`,
    background: colors.background,
    color: colors.text,
    fontSize: 14,
    boxSizing: 'border-box',
    fontFamily: 'inherit'
  };

  const btnPrimary = {
    padding: '10px 16px',
    backgroundColor: colors.primary,
    color: 'white',
    border: 'none',
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit'
  };

  const btnGhost = {
    padding: '10px 14px',
    backgroundColor: colors.surface,
    color: colors.text,
    border: `1px solid ${colors.border}`,
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 8,
    fontFamily: 'inherit'
  };

  const ambitoBadge = (ambito) => {
    const map = {
      estatal: colors.primary,
      autonomico: colors.info || colors.primary,
      local: FESTIVO_COLOR
    };
    const c = map[ambito] || colors.textSecondary;
    return {
      display: 'inline-block',
      padding: '4px 10px',
      borderRadius: 8,
      fontSize: 12,
      fontWeight: 600,
      backgroundColor: c + '18',
      color: c
    };
  };

  return (
    <div>
      <AdminSectionHeader
        title="Festivos"
        description="Calendario laboral (estatal + Cataluña + locales). No resta de vacaciones."
        colors={colors}
        actions={
          <>
            <select
              value={anio}
              onChange={(e) => setAnio(Number(e.target.value))}
              style={{ ...inputStyle, width: 110, padding: '9px 10px' }}
            >
              {[anio - 1, anio, anio + 1, anio + 2]
                .filter((y, i, a) => a.indexOf(y) === i)
                .map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
            </select>
            <button type="button" onClick={load} disabled={loading} style={btnGhost}>
              <RefreshCw size={15} />
              Actualizar
            </button>
            <button
              type="button"
              onClick={() => setShowForm((v) => !v)}
              style={btnPrimary}
            >
              <Plus size={15} />
              {showForm ? 'Cancelar' : 'Añadir'}
            </button>
          </>
        }
      />

      <p style={{ margin: '0 0 16px 0', fontSize: 13, color: colors.textSecondary }}>
        {festivos.length} festivo{festivos.length === 1 ? '' : 's'} en {anio}
        {festivos.length > 0 ? ` · ${activosCount} activo${activosCount === 1 ? '' : 's'}` : ''}
      </p>

      {error ? (
        <div
          style={{
            marginBottom: 12,
            padding: '12px 14px',
            borderRadius: 8,
            background: `${colors.error}15`,
            border: `1px solid ${colors.error}`,
            color: colors.error,
            fontSize: 13,
            display: 'flex',
            alignItems: 'center',
            gap: 8
          }}
        >
          <AlertCircle size={16} />
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error }}>×</button>
        </div>
      ) : null}
      {success ? (
        <div
          style={{
            marginBottom: 12,
            padding: '12px 14px',
            borderRadius: 8,
            background: `${colors.success}15`,
            border: `1px solid ${colors.success}`,
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
        <div
          style={{
            marginBottom: 16,
            padding: 16,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600, color: colors.text, marginBottom: 12 }}>
            Nuevo festivo
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Fecha</label>
              <input
                type="date"
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Nombre</label>
              <input
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
                placeholder="Ej. La Mercè"
                style={inputStyle}
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Ámbito</label>
              <select
                value={form.ambito}
                onChange={(e) => setForm((f) => ({ ...f, ambito: e.target.value }))}
                style={inputStyle}
              >
                {AMBITOS.map((a) => (
                  <option key={a.value} value={a.value}>{a.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button type="button" onClick={handleCrear} disabled={saving} style={btnPrimary}>
              {saving ? 'Guardando…' : 'Guardar festivo'}
            </button>
          </div>
        </div>
      ) : null}

      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
          alignItems: 'center',
          marginBottom: 16
        }}
      >
        <div style={{ position: 'relative', flex: '1 1 220px', minWidth: 200, maxWidth: 360 }}>
          <Search
            size={16}
            color={colors.textSecondary}
            style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nombre o fecha…"
            style={{ ...inputStyle, paddingLeft: 36 }}
          />
        </div>
        <select
          value={filterAmbito}
          onChange={(e) => setFilterAmbito(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 140 }}
        >
          <option value="all">Todos los ámbitos</option>
          {AMBITOS.map((a) => (
            <option key={a.value} value={a.value}>{a.label}</option>
          ))}
        </select>
        <select
          value={filterEstado}
          onChange={(e) => setFilterEstado(e.target.value)}
          style={{ ...inputStyle, width: 'auto', minWidth: 130 }}
        >
          <option value="all">Todos</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      <div
        style={{
          backgroundColor: colors.surface,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          overflow: 'hidden'
        }}
      >
        {loading && festivos.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: colors.textSecondary }}>
            Cargando festivos…
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr
                  style={{
                    backgroundColor: colors.background,
                    borderBottom: `2px solid ${colors.border}`
                  }}
                >
                  {['Fecha', 'Nombre', 'Ámbito', 'Estado', 'Acciones'].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: 16,
                        textAlign: h === 'Estado' || h === 'Acciones' ? 'center' : 'left',
                        color: colors.text,
                        fontWeight: 600,
                        fontSize: 13
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      style={{ padding: 40, textAlign: 'center', color: colors.textSecondary }}
                    >
                      {festivos.length === 0
                        ? `No hay festivos para ${anio}. Ejecuta el SQL de seed o añádelos manualmente.`
                        : 'No hay resultados con esos filtros'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((f) => (
                    <tr
                      key={f.id}
                      style={{
                        borderBottom: `1px solid ${colors.border}`,
                        opacity: f.activo ? 1 : 0.65
                      }}
                    >
                      <td
                        style={{
                          padding: 16,
                          color: colors.text,
                          whiteSpace: 'nowrap',
                          fontVariantNumeric: 'tabular-nums'
                        }}
                      >
                        {formatDateShortMadrid(f.fecha)}
                      </td>
                      <td style={{ padding: 16, color: colors.text, fontWeight: 600 }}>
                        {f.nombre}
                      </td>
                      <td style={{ padding: 16 }}>
                        <span style={ambitoBadge(f.ambito)}>
                          {ambitoFestivoLabel(f.ambito)}
                        </span>
                      </td>
                      <td style={{ padding: 16, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleToggleActivo(f)}
                          title={f.activo ? 'Desactivar' : 'Activar'}
                          style={{
                            padding: '4px 12px',
                            borderRadius: 12,
                            fontSize: 12,
                            fontWeight: 600,
                            border: 'none',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            backgroundColor: f.activo
                              ? colors.success + '20'
                              : colors.error + '20',
                            color: f.activo ? colors.success : colors.error
                          }}
                        >
                          {f.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td style={{ padding: 16, textAlign: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleEliminar(f)}
                          title="Eliminar"
                          style={{
                            padding: 8,
                            borderRadius: 8,
                            border: `1px solid ${colors.border}`,
                            background: 'transparent',
                            color: colors.error,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center'
                          }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default FichajeFestivosAdmin;


