import React, { useState, useEffect, useRef } from 'react';
import { LogIn, LogOut, Loader2, MapPin, CheckCircle, AlertCircle } from 'lucide-react';
import * as fichajePortalService from '../services/fichajePortalService';
import { formatTimeMadrid } from '../utils/timeUtils';
import { colors } from '../theme';

/**
 * Página para fichar entrada/salida desde el portal, con captura de ubicación.
 * La ubicación se guarda en el fichaje de entrada (ubicacion_lat, ubicacion_lng, ubicacion_texto).
 */
export default function FicharPage({ user }) {
  const [codigo, setCodigo] = useState('');
  const [empleado, setEmpleado] = useState(null);
  const [estadoDia, setEstadoDia] = useState(null);
  const [loading, setLoading] = useState(false);
  const [validandoCodigo, setValidandoCodigo] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false);
  const ubicacionCachedRef = useRef(null);

  const getUbicacionParaFichaje = async () => {
    if (ubicacionCachedRef.current && typeof ubicacionCachedRef.current.lat === 'number' && typeof ubicacionCachedRef.current.lng === 'number') {
      return ubicacionCachedRef.current;
    }
    const fromGeolocation = await new Promise((resolve) => {
      if (!navigator.geolocation) { resolve(null); return; }
      const timeout = setTimeout(() => resolve(null), 6000);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          clearTimeout(timeout);
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude, texto: '' });
        },
        () => { clearTimeout(timeout); resolve(null); },
        { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
      );
    });
    if (fromGeolocation) {
      ubicacionCachedRef.current = fromGeolocation;
      return fromGeolocation;
    }
    try {
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) return null;
      const data = await res.json();
      const lat = data.latitude != null ? Number(data.latitude) : null;
      const lng = data.longitude != null ? Number(data.longitude) : null;
      if (typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)) {
        const u = { lat, lng, texto: '' };
        ubicacionCachedRef.current = u;
        return u;
      }
    } catch (_) {}
    return null;
  };

  const loadEstadoDia = async () => {
    if (!empleado?.empleadoId) return;
    const res = await fichajePortalService.obtenerFichajeDia(empleado.empleadoId, new Date());
    setEstadoDia(res.data || null);
  };

  useEffect(() => {
    loadEstadoDia();
    const t = setInterval(loadEstadoDia, 30000);
    return () => clearInterval(t);
  }, [empleado?.empleadoId]);

  // Pre-capturar ubicación en segundo plano cuando hay empleado (para usarla al fichar entrada)
  useEffect(() => {
    if (!empleado?.empleadoId || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        ubicacionCachedRef.current = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          texto: '',
        };
      },
      () => {},
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }, [empleado?.empleadoId]);

  const validarCodigo = async (e) => {
    e?.preventDefault();
    const c = codigo.trim();
    if (!c) {
      setError('Introduce tu código');
      return;
    }
    setValidandoCodigo(true);
    setError('');
    setEmpleado(null);
    try {
      const res = await fichajePortalService.obtenerEmpleadoPorCodigo(c);
      if (res.success) {
        setEmpleado({
          empleadoId: res.data.empleadoId,
          nombre: res.data.descripcion,
        });
        setSuccess('Código válido');
        setTimeout(() => setSuccess(''), 2000);
        const resDia = await fichajePortalService.obtenerFichajeDia(res.data.empleadoId, new Date());
        setEstadoDia(resDia.data || null);
      } else {
        setError(res.error || 'Código no válido');
      }
    } catch (err) {
      setError('Error al validar el código');
    } finally {
      setValidandoCodigo(false);
    }
  };

  const handleFicharEntrada = async () => {
    if (!empleado?.empleadoId || !user?.id) return;
    setLoading(true);
    setError('');
    setSuccess('');
    setObteniendoUbicacion(true);
    let ubicacion = null;
    try {
      ubicacion = await getUbicacionParaFichaje();
    } finally {
      setObteniendoUbicacion(false);
    }
    try {
      const res = await fichajePortalService.crearFichajeEntrada(
        empleado.empleadoId,
        user.id,
        ubicacion
      );
      if (res.success) {
        setSuccess(ubicacion ? 'Entrada registrada (con ubicación)' : 'Entrada registrada');
        setTimeout(() => setSuccess(''), 3000);
        await loadEstadoDia();
      } else {
        setError(res.error || 'Error al registrar la entrada');
      }
    } catch (err) {
      setError('Error al registrar la entrada');
    } finally {
      setLoading(false);
    }
  };

  const handleFicharSalida = async () => {
    if (!empleado?.empleadoId) return;
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await fichajePortalService.registrarSalida(empleado.empleadoId);
      if (res.success) {
        setSuccess('Salida registrada');
        setTimeout(() => setSuccess(''), 3000);
        await loadEstadoDia();
      } else {
        setError(res.error || 'Error al registrar la salida');
      }
    } catch (err) {
      setError('Error al registrar la salida');
    } finally {
      setLoading(false);
    }
  };

  const clearEmpleado = () => {
    setEmpleado(null);
    setEstadoDia(null);
    setCodigo('');
    setError('');
    setSuccess('');
  };

  return (
    <div style={{ padding: 24, maxWidth: 480, margin: '0 auto' }}>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: colors.text, marginBottom: 24 }}>
        Fichar entrada / salida
      </h2>
      <p style={{ color: colors.textSecondary, fontSize: 14, marginBottom: 20 }}>
        Introduce tu código de fichaje. La ubicación se guarda automáticamente al fichar la entrada.
      </p>

      {!empleado ? (
        <form onSubmit={validarCodigo} style={{ marginBottom: 20 }}>
          <input
            type="text"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de fichaje"
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 16,
              border: `2px solid ${colors.border}`,
              borderRadius: 8,
              marginBottom: 12,
              boxSizing: 'border-box',
            }}
          />
          <button
            type="submit"
            disabled={validandoCodigo}
            style={{
              width: '100%',
              padding: 12,
              fontSize: 16,
              fontWeight: 600,
              color: 'white',
              background: colors.primary,
              border: 'none',
              borderRadius: 8,
              cursor: validandoCodigo ? 'wait' : 'pointer',
            }}
          >
            {validandoCodigo ? (
              <>
                <Loader2 size={18} style={{ verticalAlign: 'middle', marginRight: 8 }} />
                Validando...
              </>
            ) : (
              'Validar código'
            )}
          </button>
        </form>
      ) : (
        <>
          <div
            style={{
              background: colors.card,
              border: `1px solid ${colors.border}`,
              borderRadius: 12,
              padding: 16,
              marginBottom: 20,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 600, color: colors.text }}>{empleado.nombre}</span>
              <button
                type="button"
                onClick={clearEmpleado}
                style={{
                  fontSize: 12,
                  color: colors.textSecondary,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  textDecoration: 'underline',
                }}
              >
                Cambiar código
              </button>
            </div>
            {estadoDia && (
              <div style={{ marginTop: 12, fontSize: 14, color: colors.textSecondary }}>
                {estadoDia.hora_entrada ? (
                  <>
                    Entrada: {formatTimeMadrid(estadoDia.hora_entrada)}
                    {estadoDia.hora_salida ? (
                      <> · Salida: {formatTimeMadrid(estadoDia.hora_salida)}</>
                    ) : (
                      ' · Sin salida'
                    )}
                  </>
                ) : (
                  'Sin entrada hoy'
                )}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {!estadoDia ? (
              <button
                type="button"
                onClick={handleFicharEntrada}
                disabled={loading || obteniendoUbicacion}
                style={{
                  padding: 14,
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'white',
                  background: colors.primary,
                  border: 'none',
                  borderRadius: 8,
                  cursor: loading || obteniendoUbicacion ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {obteniendoUbicacion ? (
                  <>
                    <MapPin size={20} />
                    Obteniendo ubicación...
                  </>
                ) : loading ? (
                  <Loader2 size={20} className="spin" />
                ) : (
                  <>
                    <LogIn size={20} />
                    Fichar entrada {navigator.geolocation ? '(con ubicación)' : ''}
                  </>
                )}
              </button>
            ) : estadoDia && !estadoDia.hora_salida ? (
              <button
                type="button"
                onClick={handleFicharSalida}
                disabled={loading}
                style={{
                  padding: 14,
                  fontSize: 16,
                  fontWeight: 600,
                  color: 'white',
                  background: colors.info,
                  border: 'none',
                  borderRadius: 8,
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {loading ? (
                  <Loader2 size={20} className="spin" />
                ) : (
                  <>
                    <LogOut size={20} />
                    Fichar salida
                  </>
                )}
              </button>
            ) : (
              <div
                style={{
                  padding: 14,
                  fontSize: 14,
                  color: colors.textSecondary,
                  textAlign: 'center',
                  background: colors.surface,
                  borderRadius: 8,
                }}
              >
                <CheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                Has completado el fichaje de hoy
              </div>
            )}
          </div>
        </>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: 16,
            padding: 12,
            background: colors.error + '22',
            border: `1px solid ${colors.error}`,
            borderRadius: 8,
            color: colors.error,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <AlertCircle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            background: colors.success + '22',
            border: `1px solid ${colors.success}`,
            borderRadius: 8,
            color: colors.success,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <CheckCircle size={18} />
          {success}
        </div>
      )}

      {navigator.geolocation && empleado && (
        <p style={{ marginTop: 20, fontSize: 12, color: colors.textSecondary }}>
          <MapPin size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />
          La ubicación se obtiene automáticamente al fichar la entrada.
        </p>
      )}
    </div>
  );
}
