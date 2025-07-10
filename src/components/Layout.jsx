import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  User,
  Shield,
  Activity,
  Bell
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';
import HomePage from './HomePage';
import ProvidersPage from './ProvidersPage';
import AnalyticsPage from './AnalyticsPage';
import SettingsPage from './SettingsPage';
import OnboardingPage from './OnboardingPage';
import UserProfile from './UserProfile';
import UserManagement from './UserManagement';
import AuditLog from './AuditLog';

const Layout = () => {
  const [activeSection, setActiveSection] = useState('home');
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userProfile, setUserProfile] = useState(null); // Nuevo estado para el perfil real
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user, signOut } = useAuth();

  // Consultar el perfil real del usuario desde la base de datos
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('name, role')
          .eq('id', user.id)
          .single();
        if (!error && data) {
          setUserProfile(data);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  // Verificar si el usuario es administrador
  const isAdmin = userProfile?.role === 'admin';

  // Configurar notificaciones en tiempo real
  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      setupRealtimeNotifications();
    }
  }, [user]);

  // Recargar datos del usuario cuando cambien los metadatos
  useEffect(() => {
    const refreshUserData = async () => {
      if (user?.id) {
        try {
          const { data: { user: refreshedUser }, error } = await supabase.auth.getUser();
          if (!error && refreshedUser) {
            // User data refreshed
          }
        } catch (e) {
          // Error refreshing user data
        }
      }
    };

    // Recargar cada 30 segundos para mantener datos actualizados
    const interval = setInterval(refreshUserData, 30000);
    return () => clearInterval(interval);
  }, [user?.id]);

  const setupRealtimeNotifications = () => {
    if (!user?.id) return;

    try {
      const channel = supabase
        .channel('notifications')
        .on('postgres_changes', 
          { 
            event: 'INSERT', 
            schema: 'public', 
            table: 'notifications',
            filter: `recipient_id=eq.${user.id}`
          }, 
          (payload) => {
            setNotifications(prev => [payload.new, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        )
        .on('error', (error) => {
          // Error en suscripción de notificaciones
        })
        .subscribe((status) => {
          // Estado de suscripción de notificaciones
        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          // Error al remover canal de notificaciones
        }
      };
    } catch (error) {
      // Error al configurar notificaciones en tiempo real
      return () => {};
    }
  };

  const loadNotifications = async () => {
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        // Error loading notifications
      } else {
        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.read_at).length || 0);
      }
    } catch (e) {
      // Error loading notifications
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      await supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', notificationId);

      setNotifications(prev => 
        prev.map(n => 
          n.id === notificationId 
            ? { ...n, read_at: new Date().toISOString() }
            : n
        )
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (e) {
      // Error marking notification as read
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Función para obtener el nombre del rol
  const getRoleName = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'management': return 'Gestión';
      case 'manager': return 'Jefe';
      case 'user': return 'Usuario';
      default: return 'Usuario';
    }
  };

  const menuItems = [
    { id: 'home', icon: Home, label: 'Inicio' },
    { id: 'providers', icon: Users, label: 'Proveedores' },
    { id: 'analytics', icon: BarChart2, label: 'Análisis' },
    { id: 'settings', icon: Settings, label: 'Configuración' },
    // Solo mostrar gestión de usuarios y auditoría a administradores
    ...(isAdmin ? [
      { id: 'users', icon: Shield, label: 'Usuarios' },
      { id: 'audit', icon: Activity, label: 'Auditoría' }
    ] : []),
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
      case 'users':
        return <UserManagement />;
      case 'audit':
        return <AuditLog />;
      case 'profile':
        return <UserProfile onShowOnboarding={() => setShowOnboarding(true)} />;
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
                {userProfile?.name || user?.user_metadata?.name || user?.email || 'Usuario'}
              </div>
              <div style={{
                color: colors.textSecondary,
                fontSize: '12px',
                userSelect: 'none'
              }}>
                {getRoleName(userProfile?.role) || getRoleName(user?.user_metadata?.role) || 'Usuario'}
              </div>
            </div>
          </div>
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
            {/* Botón de notificaciones */}
            <div style={{ position: 'relative' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setShowNotifications(!showNotifications)}
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
                  transition: 'all 0.2s ease',
                  position: 'relative',
                }}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    background: colors.error,
                    color: 'white',
                    borderRadius: '50%',
                    width: 16,
                    height: 16,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    userSelect: 'none',
                    border: `2px solid ${colors.header}`,
                  }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </div>
                )}
              </motion.button>
              
              {/* Panel de notificaciones */}
              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      width: 320,
                      maxHeight: 400,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      zIndex: 1000,
                      overflow: 'hidden',
                      marginTop: 8,
                    }}
                  >
                    <div style={{
                      padding: '16px 20px',
                      borderBottom: `1px solid ${colors.border}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: 600,
                        userSelect: 'none',
                      }}>
                        Notificaciones
                      </span>
                      {unreadCount > 0 && (
                        <span style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: 600,
                          userSelect: 'none',
                        }}>
                          {unreadCount} nueva{unreadCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ maxHeight: 300, overflow: 'auto' }}>
                      {notifications.length === 0 ? (
                        <div style={{
                          padding: '40px 20px',
                          textAlign: 'center',
                          color: colors.textSecondary,
                          fontSize: 14,
                        }}>
                          No hay notificaciones
                        </div>
                      ) : (
                        notifications.map((notification) => (
                          <div
                            key={notification.id}
                            onClick={() => markNotificationAsRead(notification.id)}
                            style={{
                              padding: '12px 20px',
                              borderBottom: `1px solid ${colors.border}`,
                              cursor: 'pointer',
                              background: notification.read_at ? 'transparent' : colors.primary + '08',
                              transition: 'background 0.2s',
                            }}
                            onMouseEnter={(e) => {
                              if (!notification.read_at) {
                                e.target.style.background = colors.primary + '12';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!notification.read_at) {
                                e.target.style.background = colors.primary + '08';
                              }
                            }}
                          >
                            <div style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 12,
                            }}>
                              <div style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: notification.read_at ? colors.textSecondary : colors.primary,
                                marginTop: 6,
                                flexShrink: 0,
                              }} />
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  color: colors.text,
                                  fontSize: 14,
                                  fontWeight: 600,
                                  marginBottom: 4,
                                  userSelect: 'none',
                                }}>
                                  {notification.title}
                                </div>
                                <div style={{
                                  color: colors.textSecondary,
                                  fontSize: 13,
                                  lineHeight: 1.4,
                                  marginBottom: 6,
                                  userSelect: 'none',
                                }}>
                                  {notification.message}
                                </div>
                                <div style={{
                                  color: colors.textSecondary,
                                  fontSize: 11,
                                  userSelect: 'none',
                                }}>
                                  {formatDate(notification.created_at)}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

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