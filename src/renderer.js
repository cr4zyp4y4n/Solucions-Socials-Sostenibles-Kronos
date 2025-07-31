/**
 * This file will automatically be loaded by webpack and run in the "renderer" context.
 * To learn more about the differences between the "main" and the "renderer" context in
 * Electron, visit:
 *
 * https://electronjs.org/docs/tutorial/process-model
 *
 * By default, Node.js integration in this file is disabled. When enabling Node.js integration
 * in a renderer process, please be aware of potential security implications. You can read
 * more about security risks here:
 *
 * https://electronjs.org/docs/tutorial/security
 *
 * To enable Node.js integration in this file, open up `main.js` and enable the `nodeIntegration`
 * flag:
 *
 * ```
 *  // Create the browser window.
 *  mainWindow = new BrowserWindow({
 *    width: 800,
 *    height: 600,
 *    webPreferences: {
 *      nodeIntegration: true
 *    }
 *  });
 * ```
 */

import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { AnimatePresence } from 'framer-motion';
import './index.css';
import SplashScreen from './components/SplashScreen';
import MainApp from './components/MainApp';
import LoginPage from './components/LoginPage';
import OnboardingPage from './components/OnboardingPage';
import { DataProvider } from './components/DataContext';
import { ThemeProvider } from './components/ThemeContext';
import { CurrencyProvider } from './components/CurrencyContext';
import { AuthProvider, useAuth } from './components/AuthContext';

// Componente que maneja la lógica de autenticación
const AppContent = () => {
  const [showSplash, setShowSplash] = useState(false); // ahora solo se muestra tras login
  const [showWelcomeSplash, setShowWelcomeSplash] = useState(false);
  const [welcomeName, setWelcomeName] = useState('');
  const { isAuthenticated, loading, user } = useAuth();
  const hasShownWelcomeSplash = useRef(false);

  // Mostrar splash de bienvenida tras login/registro SOLO UNA VEZ
  useEffect(() => {
    if (
      isAuthenticated &&
      user &&
      user.user_metadata?.name &&
      !hasShownWelcomeSplash.current
    ) {
      setWelcomeName(user.user_metadata.name);
      setShowWelcomeSplash(true);
      hasShownWelcomeSplash.current = true;
      setTimeout(() => {
        setShowWelcomeSplash(false);
      }, 2200); // 2.2 segundos de bienvenida
    }
  }, [isAuthenticated, user]);

  // Mostrar loading mientras verifica autenticación
  if (loading) {
    return (
      <div style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          border: '3px solid #e0e0e0',
          borderTop: '3px solid #4CAF50',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite'
        }} />
        <style>
          {`
            @keyframes spin {
              0% { transform: rotate(0deg); }
              100% { transform: rotate(360deg); }
            }
          `}
        </style>
      </div>
    );
  }

  // Mostrar login si no está autenticado
  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Splash de bienvenida tras login/registro
  if (showWelcomeSplash && welcomeName) {
    return <SplashScreen name={welcomeName} onComplete={() => setShowWelcomeSplash(false)} />;
  }

  // Mostrar la aplicación principal si está autenticado
  return <MainApp />;
};

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <DataProvider>
          <CurrencyProvider>
            <AppContent />
          </CurrencyProvider>
        </DataProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

const container = document.getElementById('root');
const root = createRoot(container);
root.render(<App />);
