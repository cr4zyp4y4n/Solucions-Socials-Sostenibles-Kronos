import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Home, 
  FileText, 
  Users, 
  Settings, 
  BarChart2,
  Filter,
  Moon,
  Sun,
  LogOut,
  User
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';
import HomePage from './HomePage';
import ProvidersPage from './ProvidersPage';
import AnalyticsPage from './AnalyticsPage';
import SettingsPage from './SettingsPage';
import OnboardingPage from './OnboardingPage';
import UserProfile from './UserProfile';

const Layout = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user, signOut } = useAuth();

  const menuItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'providers', icon: Users, label: 'Proveedores' },
    { id: 'analytics', icon: BarChart2, label: 'Análisis' },
    { id: 'settings', icon: Settings, label: 'Configuración' },
  ];

  const handleSignOut = async () => {
    await signOut();
  };

  // Renderiza el componente correspondiente
  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HomePage />;
      case 'providers':
        return <ProvidersPage />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'settings':
        return <SettingsPage />;
      case 'profile':
        return <UserProfile />;
      default:
        return <HomePage />;
    }
  };

  if (showOnboarding) {
    return <OnboardingPage onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div style={{
      display: 'flex',
      height: '100vh',
      backgroundColor: colors.background,
    }}>
      {/* Sidebar */}
      <motion.div
        initial={{ x: -250 }}
        animate={{ x: 0 }}
        transition={{ duration: 0.3 }}
        style={{
          width: '250px',
          backgroundColor: colors.sidebar,
          borderRight: `1px solid ${colors.border}`,
          padding: '0 0 20px 0',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Logo y título */}
        <div style={{
          padding: '32px 20px 20px 20px',
          borderBottom: `1px solid ${colors.border}`,
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
        }}>
          <img src={logo} alt="Logo Solucions Socials" style={{ height: 44, width: 44, borderRadius: 8, objectFit: 'contain', background: colors.surface }} />
          <h2 style={{
            color: colors.primary,
            fontSize: '25px',
            fontWeight: 700,
            margin: 0,
            lineHeight: 1.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
            SSS Kronos
          </h2>
        </div>

        {/* Menu Items */}
        <nav style={{ flex: 1 }}>
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            
            return (
              <motion.div
                key={item.id}
                whileHover={{ backgroundColor: colors.hover || 'rgba(64,64,64,0.7)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setActiveSection(item.id)}
                style={{
                  padding: '12px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderLeft: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
                  backgroundColor: isActive ? (colors.hover || 'rgba(64,64,64,0.7)') : colors.sidebar,
                }}
              >
                <Icon 
                  size={18} 
                  color={isActive ? colors.primary : colors.textSecondary} 
                />
                <span style={{
                  color: isActive ? colors.primary : colors.textSecondary,
                  fontSize: '14px',
                  fontWeight: isActive ? '500' : '400',
                }}>
                  {item.label}
                </span>
              </motion.div>
            );
          })}
        </nav>

        {/* User Info y Logout */}
        <div style={{
          padding: '20px',
          borderTop: `1px solid ${colors.border}`,
        }}>
          {/* Bloque de usuario clickable */}
          <div
            onClick={() => setActiveSection('profile')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              marginBottom: '12px',
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'background 0.2s',
              boxShadow: '0 1px 4px rgba(76,175,80,0.04)',
              border: `1px solid ${colors.primary}22`,
            }}
            title="Ver perfil"
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: colors.primary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <User size={16} color="white" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: colors.text,
                fontSize: '14px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                userSelect: 'none'
              }}>
                {user?.user_metadata?.name || user?.email || 'Usuario'}
              </div>
              <div style={{
                color: colors.textSecondary,
                fontSize: '12px',
                userSelect: 'none'
              }}>
                {user?.user_metadata?.role || 'Usuario'}
              </div>
            </div>
          </div>
          {/* Botón para ver el tutorial/onboarding */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowOnboarding(true)}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: colors.primary,
              border: 'none',
              borderRadius: '6px',
              color: 'white',
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '10px',
              marginTop: '2px',
              gap: '8px',
              userSelect: 'none',
              boxShadow: '0 2px 8px rgba(76,175,80,0.08)'
            }}
          >
            <BarChart2 size={15} style={{ marginRight: 4 }} />
            Ver tutorial
          </motion.button>
          {/* Botón cerrar sesión */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={signOut}
            style={{
              width: '100%',
              padding: '10px 16px',
              backgroundColor: 'transparent',
              border: `1px solid ${colors.error}`,
              borderRadius: '6px',
              color: colors.error,
              fontSize: '13px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LogOut size={15} style={{ marginRight: 4 }} />
            Cerrar sesión
          </motion.button>
        </div>
      </motion.div>

      {/* Main Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {/* Header */}
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          style={{
            height: '60px',
            backgroundColor: colors.header,
            borderBottom: `1px solid ${colors.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 30px',
            justifyContent: 'space-between',
          }}
        >
          <h1 style={{
            fontSize: '20px',
            fontWeight: '500',
            color: colors.text,
            margin: 0,
          }}>
            {menuItems.find(item => item.id === activeSection)?.label}
          </h1>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
          }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleTheme}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.idoni,
                transition: 'all 0.2s ease'
              }}
            >
              {isDarkMode ? <Sun size={18} /> : <Moon size={18} />}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.05, rotate: 60 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setActiveSection('settings')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '8px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: colors.textSecondary,
                transition: 'all 0.2s ease'
              }}
            >
              <Settings size={18} />
            </motion.button>
          </div>
        </motion.header>

        {/* Content Area */}
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          style={{
            flex: 1,
            padding: '16px 16px 0 16px',
            overflow: 'auto',
            background: colors.background,
          }}
        >
          {renderSection()}
        </motion.main>
      </div>
    </div>
  );
};

export default Layout; 