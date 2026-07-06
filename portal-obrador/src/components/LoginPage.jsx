import React, { useState } from 'react';
import { Package } from 'lucide-react';
import { supabase } from '../config/supabase';
import { colors } from '../theme';

export default function LoginPage({ onLogin, onAyuda }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data, error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) throw err;
      if (data?.user) onLogin(data.user);
    } catch (err) {
      setError(err?.message || 'Error en iniciar sessió');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: colors.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 20
    }}>
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: colors.card,
        border: `1px solid ${colors.border}`,
        borderRadius: 12,
        padding: 24
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Package size={28} color={colors.primary} />
          <div>
            <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Portal Obrador</h1>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: colors.textSecondary }}>
              Recepcions amb foto d&apos;albarà
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Email
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`
              }}
            />
          </label>
          <label style={{ fontSize: 13, fontWeight: 600 }}>
            Contrasenya
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                display: 'block',
                width: '100%',
                marginTop: 6,
                padding: '10px 12px',
                borderRadius: 8,
                border: `1px solid ${colors.border}`
              }}
            />
          </label>
          {error && <p style={{ margin: 0, color: colors.error, fontSize: 13 }}>{error}</p>}
          <button
            type="submit"
            disabled={loading}
            style={{
              padding: '12px',
              borderRadius: 8,
              border: 'none',
              background: colors.primary,
              color: '#fff',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? 'Entrant...' : 'Entrar'}
          </button>
        </form>
        {onAyuda ? (
          <button
            type="button"
            onClick={onAyuda}
            style={{
              display: 'block',
              width: '100%',
              marginTop: 16,
              padding: '10px',
              fontSize: 13,
              fontWeight: 600,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.primary,
              cursor: 'pointer'
            }}
          >
            Guia d&apos;ús (QR, expedicions, entregues)
          </button>
        ) : null}
      </div>
    </div>
  );
}
