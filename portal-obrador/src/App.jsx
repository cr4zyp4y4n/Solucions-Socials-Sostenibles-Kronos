import React, { useState, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from './config/supabase';
import LoginPage from './components/LoginPage';
import RecepcioPage from './components/RecepcioPage';
import TraceLotPage from './components/TraceLotPage';
import AyudaPage from './components/AyudaPage';
import { colors } from './theme';

function getTraceCodeFromUrl() {
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get('trace')?.trim() || '';
  } catch {
    return '';
  }
}

function isAyudaRoute() {
  try {
    const path = window.location.pathname.replace(/\/$/, '') || '/';
    if (path === '/ayuda') return true;
    return new URLSearchParams(window.location.search).get('ayuda') === '1';
  } catch {
    return false;
  }
}

function goToAyuda() {
  window.location.href = '/ayuda';
}

function goToHome() {
  window.location.href = '/';
}

function ConfigMissing() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: colors.background
    }}>
      <div style={{
        maxWidth: 420,
        padding: 24,
        borderRadius: 12,
        border: `1px solid ${colors.border}`,
        background: colors.card
      }}>
        <h1 style={{ margin: '0 0 12px', fontSize: 20 }}>Falta configuració</h1>
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5, color: colors.textSecondary }}>
          Crea <code>portal-obrador/.env</code> amb{' '}
          <code>VITE_SUPABASE_URL</code> i <code>VITE_SUPABASE_ANON_KEY</code>{' '}
          (mateixes credencials que Kronos). Després reinicia <code>npm run dev</code>.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [traceCode] = useState(() => getTraceCodeFromUrl());
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setChecking(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setUser(session?.user ?? null);
    });
    return () => subscription?.unsubscribe();
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!isSupabaseConfigured) {
    return <ConfigMissing />;
  }

  if (isAyudaRoute()) {
    return <AyudaPage onBack={goToHome} />;
  }

  if (traceCode) {
    return <TraceLotPage traceCode={traceCode} staffUser={user} onStaffLogin={setUser} />;
  }

  if (checking) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: colors.textSecondary
      }}>
        Carregant...
      </div>
    );
  }

  if (!user) {
    return <LoginPage onLogin={setUser} onAyuda={goToAyuda} />;
  }

  return (
    <div style={{ minHeight: '100vh', background: colors.background }}>
      <header style={{
        padding: '12px 16px',
        borderBottom: `1px solid ${colors.border}`,
        background: colors.card,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 8
      }}>
        <span style={{ fontWeight: 700, fontSize: 15 }}>Portal Obrador</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            onClick={goToAyuda}
            style={{
              padding: '8px 12px',
              fontSize: 13,
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              cursor: 'pointer',
              color: colors.primary,
              fontWeight: 600
            }}
          >
            Guia
          </button>
          <button
          type="button"
          onClick={handleLogout}
          style={{
            padding: '8px 12px',
            fontSize: 13,
            borderRadius: 8,
            border: `1px solid ${colors.border}`,
            background: colors.surface,
            cursor: 'pointer'
          }}
        >
          Sortir
        </button>
        </div>
      </header>
      <main>
        <RecepcioPage userEmail={user.email} />
      </main>
    </div>
  );
}
