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
  Bell,
  Zap,
  CreditCard,
  Calendar,
  Coffee,
  DollarSign,
  ShoppingBag
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { useNavigation } from './NavigationContext';
import { CateringProvider } from './catering/CateringContext';
import { supabase } from '../config/supabase';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';
import HomePage from './HomePage';
import AnalyticsPage from './AnalyticsPage';
import SettingsPage from './SettingsPage';
import OnboardingPage from './OnboardingPage';
import UserProfile from './UserProfile';
import UserManagement from './UserManagement';
import AuditLog from './AuditLog';
import HoldedTest from './HoldedTest';
import ProvidersContacts from './ProvidersContacts';
import CateringApp from './catering/CateringApp';

// Componente visual de acceso denegado reutilizable
function AccessDenied({ message = 'No tienes permisos para acceder a esta sección.' }) {
  const { colors } = useTheme();
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 18,
      background: colors.card,
      border: `1.5px solid ${colors.error}33`,
      borderRadius: 12,
      padding: '32px 28px',
      margin: '40px auto',
      maxWidth: 480,
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
    }}>
      <Shield size={36} color={colors.error} style={{ flexShrink: 0 }} />
      <div>
        <div style={{ color: colors.error, fontWeight: 700, fontSize: 20, marginBottom: 6 }}>Acceso denegado</div>
        <div style={{ color: colors.textSecondary, fontSize: 15 }}>{message}</div>
      </div>
    </div>
  );
}

const Layout = () => {
  const { activeSection, navigateTo } = useNavigation();
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showAllNotifications, setShowAllNotifications] = useState(false);
  const [userProfile, setUserProfile] = useState(null); // Nuevo estado para el perfil real
  const { isDarkMode, toggleTheme, colors } = useTheme();
  const { user, signOut } = useAuth();

  // Consultar el perfil real del usuario desde la base de datos
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('name, role, onboarding_completed')
          .eq('id', user.id)
          .single();
        if (!error && data) {
          setUserProfile(data);
          
          // Mostrar onboarding automáticamente si es un usuario nuevo
          if (!data.onboarding_completed) {
            setShowOnboarding(true);
          }
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  // Verificar si el usuario es administrador
  const isAdmin = userProfile?.role === 'admin';
  const isManagementOrManager = userProfile?.role === 'management' || userProfile?.role === 'manager';
  const isUser = !isAdmin && !isManagementOrManager;

  // Configurar notificaciones en tiempo real
  useEffect(() => {
    if (user?.id) {
      loadNotifications();
      setupRealtimeNotifications();
    }
  }, [user]);

  // Cerrar notificaciones al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event) => {
      const notificationPanel = document.querySelector('[data-notification-panel]');
      const notificationButton = document.querySelector('[data-notification-button]');
      
      if (showNotifications && 
          notificationPanel && 
          !notificationPanel.contains(event.target) &&
          notificationButton &&
          !notificationButton.contains(event.target)) {
        setShowNotifications(false);
        setShowAllNotifications(false); // Resetear vista cuando se cierre
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  // Configurar listeners de actualizaciones para notificaciones
  useEffect(() => {
    if (window.electronAPI) {
      // Listener para actualización disponible - mostrar notificación a todos
      window.electronAPI.onUpdateAvailable((event, info) => {
        // Crear notificación automática para todos los usuarios
        createUpdateNotification(info);
      });
    }

    return () => {
      if (window.electronAPI) {
        window.electronAPI.removeAllListeners('update-available');
      }
    };
  }, [user]);

  // Función para crear notificación de actualización
  const createUpdateNotification = async (updateInfo) => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          title: '🔄 Nueva actualización disponible',
          message: `La versión ${updateInfo.version} de SSS Kronos está lista para descargar. Ve a Configuración > Actualizaciones para instalarla.`,
          type: 'update',
          read: false,
          created_at: new Date().toISOString()
        });

      if (!error) {
        // Recargar notificaciones para mostrar la nueva
        loadNotifications();
      }
    } catch (err) {
      console.error('Error creando notificación de actualización:', err);
    }
  };

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

  // Función para obtener color por estado de catering
  const getCateringStatusColor = (status) => {
    const statusColors = {
      'recibido': '#3B82F6', // Azul
      'aceptado': '#10B981', // Verde
      'en_preparacion': '#F59E0B', // Naranja
      'finalizado': '#6B7280', // Gris
      'rechazado': '#EF4444' // Rojo
    };
    return statusColors[status] || '#3B82F6';
  };

  // Función para procesar notificaciones y agregar información visual
  const processNotification = (notification) => {
    const processed = { ...notification };
    
    // Detectar si es una notificación de cambio de estado de catering
    if (notification.data?.status && notification.title?.includes('Estado de Evento')) {
      processed.isCateringStatus = true;
      processed.statusColor = getCateringStatusColor(notification.data.status);
      processed.statusLabel = notification.data.status.replace('_', ' ');
    }
    
    return processed;
  };

  // Obtener notificaciones para mostrar (limitadas o todas)
  const getDisplayNotifications = () => {
    const processedNotifications = notifications.map(processNotification);
    return showAllNotifications ? processedNotifications : processedNotifications.slice(0, 5);
  };

  // Menú lateral según rol
  const menuItems = [
    { key: 'home', label: 'Inicio', path: '/home', icon: Home },
    { key: 'catering', label: 'Catering', path: '/catering', icon: Coffee },
    { key: 'analytics', label: 'Análisis', path: '/analytics', icon: BarChart2 },
    { key: 'contacts', label: 'Contactos', path: '/contacts', icon: CreditCard },
    { key: 'settings', label: 'Configuración', path: '/settings', icon: Settings },
  ];
  if (isAdmin) {
    menuItems.push(
      { key: 'users', label: 'Usuarios', path: '/users', icon: Users },
      { key: 'audit', label: 'Auditoría', path: '/audit', icon: Activity }
    );
  }

  const handleSignOut = async () => {
    await signOut();
  };

  // Renderiza el componente correspondiente
  const renderSection = () => {
    switch (activeSection) {
      case 'home':
        return <HomePage />;
      case 'catering':
        return <CateringApp />;
      case 'contacts':
        return <ProvidersContacts />;
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
    <CateringProvider>
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
            const isActive = activeSection === item.key;
            
            return (
              <motion.div
                key={item.key}
                whileHover={{ backgroundColor: colors.hover || 'rgba(64,64,64,0.7)' }}
                whileTap={{ scale: 0.98 }}
                onClick={() => navigateTo(item.key)}
                style={{
                  padding: '12px 20px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  borderLeft: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
                  backgroundColor: isActive ? (colors.hover || 'rgba(64,64,64,0.7)') : colors.sidebar
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
            onClick={() => navigateTo('profile')}
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
            fontSize: 28,
            fontWeight: 700,
            color: colors.text,
            margin: 0,
            lineHeight: 1.2
          }}>
            {menuItems.find(item => item.key === activeSection)?.label}
          </h1>
          
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '15px',
          }}>
            {/* Botón de notificaciones */}
            <div style={{ position: 'relative' }}>
              <motion.button
                data-notification-button
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
                    data-notification-panel
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      width: 320,
                      maxHeight: 450,
                      background: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: 12,
                      boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                      zIndex: 1000,
                      overflow: 'visible',
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
                    
                    <div style={{ 
                      maxHeight: 380, 
                      overflow: 'auto',
                      userSelect: 'none',
                      paddingBottom: '8px',
                      paddingTop: '4px',
                      scrollBehavior: 'smooth',
                      scrollbarWidth: 'thin',
                      scrollbarColor: `${colors.border} transparent`
                    }}>
                      {/* Espacio al inicio para evitar problemas de scroll */}
                      <div style={{ height: '4px' }}></div>
                      
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
                        getDisplayNotifications().map((notification) => (
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
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginBottom: 4,
                                }}>
                                  <div style={{
                                    color: colors.text,
                                    fontSize: 14,
                                    fontWeight: 600,
                                    userSelect: 'none',
                                  }}>
                                    {notification.title}
                                  </div>
                                  {notification.isCateringStatus && (
                                    <div style={{
                                      padding: '2px 8px',
                                      borderRadius: '12px',
                                      fontSize: '11px',
                                      fontWeight: '600',
                                      color: notification.statusColor,
                                      background: notification.statusColor + '15',
                                      border: `1px solid ${notification.statusColor}30`,
                                      userSelect: 'none',
                                      textTransform: 'capitalize'
                                    }}>
                                      {notification.statusLabel}
                                    </div>
                                  )}
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
                      
                      {/* Espacio adicional para evitar problemas de scroll */}
                      <div style={{ height: '12px' }}></div>
                      
                      {/* Botón Ver más */}
                      {notifications.length > 5 && !showAllNotifications && (
                        <div style={{
                          padding: '12px 20px',
                          borderTop: `1px solid ${colors.border}`,
                          textAlign: 'center',
                          background: colors.surface
                        }}>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAllNotifications(!showAllNotifications)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: colors.primary,
                              fontSize: '13px',
                              fontWeight: '500',
                              padding: '8px 16px',
                              borderRadius: '6px',
                              transition: 'background 0.2s',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = colors.primary + '08';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                            }}
                          >
                            {`Ver ${notifications.length - 5} más`}
                          </motion.button>
                        </div>
                      )}
                      
                      {/* Botón Ver menos */}
                      {notifications.length > 5 && showAllNotifications && (
                        <div style={{
                          padding: '12px 20px',
                          borderTop: `1px solid ${colors.border}`,
                          textAlign: 'center',
                          background: colors.surface
                        }}>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setShowAllNotifications(false)}
                            style={{
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              color: colors.textSecondary,
                              fontSize: '13px',
                              fontWeight: '500',
                              padding: '8px 16px',
                              borderRadius: '6px',
                              transition: 'background 0.2s',
                              userSelect: 'none'
                            }}
                            onMouseEnter={(e) => {
                              e.target.style.background = colors.textSecondary + '08';
                            }}
                            onMouseLeave={(e) => {
                              e.target.style.background = 'transparent';
                            }}
                          >
                            Ver menos
                          </motion.button>
                        </div>
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
              onClick={() => navigateTo('settings')}
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
            padding: '0',
            overflow: 'auto',
            background: colors.background,
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.border} transparent`
          }}
        >
          {renderSection()}
        </motion.main>
      </div>
    </div>
    </CateringProvider>
  );
};

export default Layout; 