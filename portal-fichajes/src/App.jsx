import React, { useState, useEffect } from 'react';
import { supabase } from './config/supabase';
import LoginPage from './components/LoginPage';
import PanelFichajesPage from './components/PanelFichajesPage';
import FicharPage from './components/FicharPage';
import { colors } from './theme';

const TAB_PANEL = 'panel';
const TAB_FICHAR = 'fichar';

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [tab, setTab] = useState(TAB_PANEL);

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
          flexWrap: 'wrap',
          gap: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span className="portal-header-title" style={{ fontSize: 16, fontWeight: 600, color: colors.text }}>
            Portal de Fichajes
          </span>
          <nav style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              onClick={() => setTab(TAB_FICHAR)}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: tab === TAB_FICHAR ? 600 : 400,
                color: tab === TAB_FICHAR ? colors.primary : colors.textSecondary,
                background: tab === TAB_FICHAR ? colors.primary + '22' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Fichar
            </button>
            <button
              type="button"
              onClick={() => setTab(TAB_PANEL)}
              style={{
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: tab === TAB_PANEL ? 600 : 400,
                color: tab === TAB_PANEL ? colors.primary : colors.textSecondary,
                background: tab === TAB_PANEL ? colors.primary + '22' : 'transparent',
                border: 'none',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Panel (solo lectura)
            </button>
          </nav>
        </div>
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
        {tab === TAB_FICHAR ? <FicharPage user={user} /> : <PanelFichajesPage />}
      </main>
    </div>
  );
}
