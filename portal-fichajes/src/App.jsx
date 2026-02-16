import React, { useState, useEffect } from 'react';
import { supabase } from './config/supabase';
import LoginPage from './components/LoginPage';
import PanelFichajesPage from './components/PanelFichajesPage';
import { colors } from './theme';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  if (checking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: colors.textSecondary,
        }}
      >
        Cargando...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={(u) => setUser(u)} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <header
        className="portal-header"
        style={{
          padding: '12px 24px',
          borderBottom: `1px solid ${colors.border}`,
          background: colors.card,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span className="portal-header-title" style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
          Panel de Fichajes · Solo lectura
        </span>
        <div className="portal-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="portal-header-email" style={{ fontSize: 13, color: colors.textSecondary }} title={user.email}>{user.email}</span>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              padding: '8px 14px',
              fontSize: 13,
              color: colors.text,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              cursor: 'pointer',
            }}
          >
            Salir
          </button>
        </div>
      </header>
      <main>
        <PanelFichajesPage />
      </main>
    </div>
  );
}
