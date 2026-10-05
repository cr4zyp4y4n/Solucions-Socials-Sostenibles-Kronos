import React, { useState, useEffect, useMemo } from 'react';
import { Link2, Plus, RefreshCw, AlertCircle, CheckCircle, X, Search, Users } from 'feather-icons-react';
import { supabase } from '../config/supabase';
import holdedEmployeesService from '../services/holdedEmployeesService';
import fichajeCodigosService from '../services/fichajeCodigosService';
import { useTheme } from './ThemeContext';
import AdminSectionHeader from './AdminSectionHeader';

const ROLES_PRIVILEGIADOS = new Set([
  'admin', 'management', 'manager', 'jefe', 'administrador',
  'gestion', 'gestión', 'inspeccion', 'inspector'
]);

const normalizeName = (value) =>
  String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const isPrivilegedRole = (role) => ROLES_PRIVILEGIADOS.has(String(role || '').toLowerCase());

/**
 * Admin: vínculos usuario Kronos ↔ empleado Holded (RLS de fichajes).
 */
const FichajeVinculosAdmin = () => {
  const { colors } = useTheme();
  const [rows, setRows] = useState([]);
  const [users, setUsers] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [codigos, setCodigos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');
  const [userId, setUserId] = useState('');
  const [empleadoId, setEmpleadoId] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [vinculosRes, usersRes, empSol, empMen, codigosRes] = await Promise.all([
        supabase
          .from('fichajes_empleado_usuarios')
          .select('id, user_id, empleado_id, activo, created_at, updated_at, user:user_profiles(id, name, email, role)')
          .order('created_at', { ascending: false }),
        supabase
          .from('user_profiles')
          .select('id, name, email, role')
          .order('name', { ascending: true }),
        holdedEmployeesService.getEmployeesTransformed('solucions').catch(() => []),
        holdedEmployeesService.getEmployeesTransformed('menjar').catch(() => []),
        fichajeCodigosService.obtenerTodosLosCodigos().catch(() => ({ success: false, data: [] }))
      ]);

      if (vinculosRes.error) throw vinculosRes.error;
      if (usersRes.error) throw usersRes.error;

      setRows(vinculosRes.data || []);
      setUsers(usersRes.data || []);
      setEmpleados([...(empSol || []), ...(empMen || [])]);
      setCodigos(codigosRes?.success ? (codigosRes.data || []) : (codigosRes?.data || []));
    } catch (err) {
      setError(err.message || 'Error cargando vínculos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nombreEmpleado = (id) => {
    const e = empleados.find((x) => String(x.id) === String(id));
    return e?.nombreCompleto || id;
  };

  const userIdsConVinculoActivo = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => {
      if (r.activo) set.add(r.user_id);
    });
    return set;
  }, [rows]);

  const usuariosPendientes = useMemo(() => {
    return users.filter(
      (u) => !isPrivilegedRole(u.role) && !userIdsConVinculoActivo.has(u.id)
    );
  }, [users, userIdsConVinculoActivo]);

  /** Sugerencias: código activo → empleado; usuario pendiente con nombre coincidente. */
  const sugerenciasDesdeCodigos = useMemo(() => {
    const pendientes = usuariosPendientes;
    if (!pendientes.length) return [];

    const codigosActivos = (codigos || []).filter((c) => c.activo !== false && c.empleado_id);
    const sugeridas = [];
    const usadosUser = new Set();
    const usadosEmp = new Set();

    const candidatosPorNombre = new Map();
    pendientes.forEach((u) => {
      const key = normalizeName(u.name);
      if (!key) return;
      if (!candidatosPorNombre.has(key)) candidatosPorNombre.set(key, []);
      candidatosPorNombre.get(key).push(u);
    });

    for (const codigo of codigosActivos) {
      const empId = String(codigo.empleado_id);
      if (usadosEmp.has(empId)) continue;

      const empNombre = normalizeName(
        codigo.descripcion || nombreEmpleado(empId)
      );
      if (!empNombre) continue;

      let match = null;
      const exact = candidatosPorNombre.get(empNombre);
      if (exact?.length === 1 && !usadosUser.has(exact[0].id)) {
        match = exact[0];
      } else {
        const parciales = pendientes.filter((u) => {
          if (usadosUser.has(u.id)) return false;
          const un = normalizeName(u.name);
          if (!un) return false;
          return un === empNombre || empNombre.includes(un) || un.includes(empNombre);
        });
        if (parciales.length === 1) match = parciales[0];
      }

      if (!match) continue;
      usadosUser.add(match.id);
      usadosEmp.add(empId);
      sugeridas.push({
        userId: match.id,
        userName: match.name || match.email,
        userEmail: match.email,
        empleadoId: empId,
        empleadoNombre: codigo.descripcion || nombreEmpleado(empId),
        codigo: codigo.codigo
      });
    }

    return sugeridas;
  }, [codigos, usuariosPendientes, empleados]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const u = r.user;
      const blob = [
        u?.name,
        u?.email,
        r.empleado_id,
        nombreEmpleado(r.empleado_id)
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, search, empleados]);

  const handleCrear = async (e) => {
    e?.preventDefault();
    if (!userId || !empleadoId) {
      setError('Elige usuario y empleado');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase.from('fichajes_empleado_usuarios').upsert(
        {
          user_id: userId,
          empleado_id: String(empleadoId),
          activo: true,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'user_id,empleado_id' }
      );
      if (err) throw err;
      setSuccess('Vínculo guardado');
      setTimeout(() => setSuccess(''), 2500);
      setUserId('');
      setEmpleadoId('');
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo guardar');
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDesdeCodigos = async () => {
    if (!sugerenciasDesdeCodigos.length) return;
    setBulkLoading(true);
    setError('');
    try {
      const payload = sugerenciasDesdeCodigos.map((s) => ({
        user_id: s.userId,
        empleado_id: String(s.empleadoId),
        activo: true,
        updated_at: new Date().toISOString()
      }));
      const { error: err } = await supabase
        .from('fichajes_empleado_usuarios')
        .upsert(payload, { onConflict: 'user_id,empleado_id' });
      if (err) throw err;
      setSuccess(`${payload.length} vínculo(s) creados desde códigos`);
      setTimeout(() => setSuccess(''), 3500);
      await load();
    } catch (err) {
      setError(err.message || 'Error en vinculación masiva');
    } finally {
      setBulkLoading(false);
    }
  };

  const toggleActivo = async (row) => {
    setLoading(true);
    setError('');
    try {
      const { error: err } = await supabase
        .from('fichajes_empleado_usuarios')
        .update({ activo: !row.activo, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (err) throw err;
      await load();
    } catch (err) {
      setError(err.message || 'No se pudo actualizar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <AdminSectionHeader
        title="Vínculos usuario ↔ empleado"
        description="Controla qué usuario Kronos ve qué empleado Holded en fichajes. Admin/gestión no necesitan vínculo."
        colors={colors}
        actions={
          <>
            <button
              type="button"
              onClick={handleBulkDesdeCodigos}
              disabled={bulkLoading || !sugerenciasDesdeCodigos.length}
              style={{
                padding: '10px 16px',
                borderRadius: 8,
                border: 'none',
                background: sugerenciasDesdeCodigos.length ? (colors.info || colors.primary) : colors.border,
                color: '#fff',
                fontWeight: 600,
                fontSize: 14,
                cursor: sugerenciasDesdeCodigos.length ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                opacity: sugerenciasDesdeCodigos.length ? 1 : 0.6
              }}
              title={
                sugerenciasDesdeCodigos.length
                  ? 'Crea vínculos emparejando nombre de usuario con códigos activos'
                  : 'No hay coincidencias claras entre códigos y usuarios sin vínculo'
              }
            >
              <Users size={16} />
              {bulkLoading
                ? 'Vinculando…'
                : `Vincular desde códigos (${sugerenciasDesdeCodigos.length})`}
            </button>
            <button
              type="button"
              onClick={load}
              disabled={loading}
              style={{
                padding: '10px 14px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`,
                background: colors.background,
                color: colors.text,
                cursor: 'pointer'
              }}
            >
              <RefreshCw size={16} />
            </button>
          </>
        }
      />

      {usuariosPendientes.length > 0 && (
        <div
          style={{
            padding: 14,
            marginBottom: 14,
            borderRadius: 10,
            border: `1px solid ${(colors.warning || '#d97706')}55`,
            background: (colors.warning || '#d97706') + '12',
            color: colors.text
          }}
        >
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
            <AlertCircle size={18} color={colors.warning || '#d97706'} style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                {usuariosPendientes.length} usuario(s) sin vínculo activo
              </div>
              <div style={{ fontSize: 13, color: colors.textSecondary, lineHeight: 1.45 }}>
                {usuariosPendientes
                  .slice(0, 8)
                  .map((u) => u.name || u.email)
                  .join(' · ')}
                {usuariosPendientes.length > 8
                  ? ` · y ${usuariosPendientes.length - 8} más`
                  : ''}
              </div>
            </div>
          </div>
          {sugerenciasDesdeCodigos.length > 0 && (
            <div style={{ fontSize: 12, color: colors.textSecondary, paddingLeft: 26 }}>
              {sugerenciasDesdeCodigos.length} coincidencia(s) por nombre con códigos de fichaje listas para vincular.
            </div>
          )}
        </div>
      )}

      {error && (
        <div
          style={{
            padding: 12,
            marginBottom: 14,
            borderRadius: 8,
            border: `1px solid ${colors.error}`,
            background: colors.error + '15',
            color: colors.error,
            display: 'flex',
            gap: 8,
            alignItems: 'center'
          }}
        >
          <AlertCircle size={18} />
          <span style={{ flex: 1 }}>{error}</span>
          <button type="button" onClick={() => setError('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.error }}>
            <X size={16} />
          </button>
        </div>
      )}
      {success && (
        <div
          style={{
            padding: 12,
            marginBottom: 14,
            borderRadius: 8,
            border: `1px solid ${colors.success}`,
            background: colors.success + '15',
            color: colors.success,
            display: 'flex',
            gap: 8,
            alignItems: 'center'
          }}
        >
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {sugerenciasDesdeCodigos.length > 0 && (
        <div
          style={{
            marginBottom: 16,
            padding: 14,
            background: colors.surface,
            border: `1px solid ${colors.border}`,
            borderRadius: 12
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
            Sugerencias desde códigos
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {sugerenciasDesdeCodigos.slice(0, 12).map((s) => (
              <div
                key={`${s.userId}-${s.empleadoId}`}
                style={{ fontSize: 13, color: colors.textSecondary }}
              >
                <span style={{ color: colors.text, fontWeight: 500 }}>{s.userName}</span>
                {' → '}
                {s.empleadoNombre}
                <span style={{ opacity: 0.7 }}> (código {s.codigo})</span>
              </div>
            ))}
            {sugerenciasDesdeCodigos.length > 12 && (
              <div style={{ fontSize: 12, color: colors.textSecondary }}>
                …y {sugerenciasDesdeCodigos.length - 12} más
              </div>
            )}
          </div>
        </div>
      )}

      <form
        onSubmit={handleCrear}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 20,
          padding: 16,
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Usuario Kronos</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.background,
              color: colors.text
            }}
          >
            <option value="">Seleccionar…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {(u.name || u.email || u.id) + ` (${u.role || '—'})`}
                {!isPrivilegedRole(u.role) && !userIdsConVinculoActivo.has(u.id) ? ' · sin vínculo' : ''}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Empleado Holded</label>
          <select
            value={empleadoId}
            onChange={(e) => setEmpleadoId(e.target.value)}
            style={{
              width: '100%',
              padding: 10,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.background,
              color: colors.text
            }}
          >
            <option value="">Seleccionar…</option>
            {empleados.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.nombreCompleto || emp.id}
              </option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 600,
              cursor: loading ? 'wait' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6
            }}
          >
            <Plus size={16} />
            Vincular
          </button>
        </div>
      </form>

      <div style={{ marginBottom: 12, position: 'relative', maxWidth: 360 }}>
        <Search size={16} color={colors.textSecondary} style={{ position: 'absolute', left: 12, top: 12 }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar usuario o empleado…"
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.background,
            color: colors.text,
            boxSizing: 'border-box'
          }}
        />
      </div>

      <div
        style={{
          background: colors.surface,
          border: `1px solid ${colors.border}`,
          borderRadius: 12,
          overflow: 'hidden'
        }}
      >
        {loading && rows.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary }}>Cargando…</div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: colors.textSecondary }}>
            <Link2 size={36} style={{ marginBottom: 8, opacity: 0.5 }} />
            <div>No hay vínculos todavía</div>
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${colors.border}` }}>
                {['Usuario', 'Empleado', 'Estado', ''].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      fontSize: 12,
                      color: colors.textSecondary,
                      fontWeight: 600
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                  <td style={{ padding: '12px 14px', fontSize: 14, color: colors.text }}>
                    <div style={{ fontWeight: 600 }}>{r.user?.name || '—'}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{r.user?.email}</div>
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 14, color: colors.text }}>
                    <div>{nombreEmpleado(r.empleado_id)}</div>
                    <div style={{ fontSize: 12, color: colors.textSecondary }}>{r.empleado_id}</div>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: r.activo ? colors.success : colors.textSecondary
                      }}
                    >
                      {r.activo ? 'Activo' : 'Inactivo'}
                    </span>
                  </td>
                  <td style={{ padding: '12px 14px' }}>
                    <button
                      type="button"
                      onClick={() => toggleActivo(r)}
                      style={{
                        padding: '6px 10px',
                        fontSize: 12,
                        borderRadius: 6,
                        border: `1px solid ${colors.border}`,
                        background: 'transparent',
                        color: colors.text,
                        cursor: 'pointer'
                      }}
                    >
                      {r.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default FichajeVinculosAdmin;
