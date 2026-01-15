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
  ShoppingBag,
  ExternalLink,
  UploadCloud,
  Package,
  Download,
  CheckCircle,
  X,
  Clock
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
import AdminPanel from './AdminPanel';
import AuditLog from './AuditLog';
import HoldedTest from './HoldedTest';
import ProvidersContacts from './ProvidersContacts';
import InnuvaConverterPage from './InnuvaConverterPage';
import CateringApp from './catering/CateringApp';
import SubvencionesPage from './SubvencionesPage';
import EmpleadosPage from './EmpleadosPage';
import HojaRutaPage from './HojaRutaPage';
import SociosPage from './SociosPage';
import SalesInvoicesPage from './SalesInvoicesPage';
import InventoryPage from './InventoryPage';
import FichajePage from './FichajePage';
import GestionTiendaPage from './GestionTiendaPage';


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
  const [cateringEventId, setCateringEventId] = useState(null); // Para navegación a eventos específicos
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState(null);
  const [showUpdateTooltip, setShowUpdateTooltip] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [showNoUpdateMessage, setShowNoUpdateMessage] = useState(false);
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
        } else if (error) {
          console.error('❌ Error al cargar perfil:', error.message);
        }
      }
    };
    fetchUserProfile();
  }, [user]);

  // Verificar si el usuario es administrador
  const isAdmin = userProfile?.role === 'admin';

  // Limpiar eventId cuando se navega a otra sección
  useEffect(() => {
    if (activeSection !== 'catering') {
      setCateringEventId(null);
    }
  }, [activeSection]);
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

  // Obtener versión de la app al iniciar
  useEffect(() => {
    const getVersion = async () => {
      if (window.electronAPI?.getAppVersion) {
        try {
          const version = await window.electronAPI.getAppVersion();
          setAppVersion(version);
        } catch (error) {
          console.error('Error obteniendo versión:', error);
        }
      }
    };
    getVersion();
  }, []);

  // Verificar actualizaciones al iniciar la app
  useEffect(() => {
    const checkForUpdatesOnStart = async () => {
      if (!window.electronAPI || !appVersion) return;

      try {
        // Verificar con GitHub API directamente
        const response = await fetch('https://api.github.com/repos/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases/latest', {
          method: 'GET',
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'SSS-Kronos-App'
          }
        });

        if (response.ok) {
          const githubData = await response.json();
          const currentVersion = appVersion.replace('v', '');
          const latestVersion = githubData.tag_name.replace('v', '');

          // Comparar versiones (formato semver: x.y.z)
          if (latestVersion > currentVersion) {
            setUpdateAvailable(true);
            setUpdateInfo({
              version: latestVersion,
              currentVersion: currentVersion,
              releaseNotes: githubData.body,
              htmlUrl: githubData.html_url
            });
            // Mostrar tooltip automáticamente al detectar actualización
            setShowUpdateTooltip(true);
            // Ocultar tooltip después de 5 segundos
            setTimeout(() => setShowUpdateTooltip(false), 5000);
          }
        }
      } catch (error) {
        console.error('Error verificando actualizaciones:', error);
      }
    };

    if (appVersion) {
      checkForUpdatesOnStart();
    }
  }, [appVersion]);

  // Configurar listeners de actualizaciones para notificaciones
  useEffect(() => {
    if (window.electronAPI) {
      // Listener para actualización disponible - mostrar notificación a todos
      window.electronAPI.onUpdateAvailable((event, info) => {
        setUpdateAvailable(true);
        setUpdateInfo(info);
        setShowUpdateTooltip(true);
        setTimeout(() => setShowUpdateTooltip(false), 5000);
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
          console.error('Error en suscripción de notificaciones:', error);
        })
        .subscribe((status) => {

        });

      return () => {
        try {
          supabase.removeChannel(channel);
        } catch (error) {
          console.error('Error al remover canal de notificaciones:', error);
        }
      };
    } catch (error) {
      console.error('Error al configurar notificaciones en tiempo real:', error);
      return () => { };
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
        console.error('Error loading notifications:', error);
      } else {
        setNotifications(data || []);
        setUnreadCount(data?.filter(n => !n.read_at).length || 0);
      }
    } catch (e) {
      console.error('Error loading notifications:', e);
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    try {
      // Encontrar la notificación para obtener sus datos
      const notification = notifications.find(n => n.id === notificationId);

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

      // Navegar si es una notificación de hoja de ruta
      if (notification?.data?.navigation_target === 'hoja_ruta') {
        navigateTo('hoja_ruta');
      }
    } catch (e) {
      // Error marking notification as read
    }
  };

  // Manejar clic en el enlace de ver evento
  const handleViewEventClick = async (notification) => {
    // Marcar como leída
    await markNotificationAsRead(notification.id);

    // Navegar al evento
    setCateringEventId(notification.data.event_id);
    navigateTo('catering');
    setShowNotifications(false); // Cerrar panel de notificaciones
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
    { key: 'analytics', label: 'Análisis', path: '/analytics', icon: BarChart2 },
    { key: 'sales-invoices', label: 'Resum Caterings', path: '/sales-invoices', icon: DollarSign },
    { key: 'inventory', label: 'Inventario', path: '/inventory', icon: Package },
    { key: 'innuva-converter', label: 'Conversor Innuva', path: '/innuva-converter', icon: UploadCloud },
    { key: 'subvenciones', label: 'Subvenciones', path: '/subvenciones', icon: FileText },
    { key: 'empleados', label: 'Empleados', path: '/empleados', icon: Users },
    { key: 'hoja-ruta', label: 'Hoja de Ruta', path: '/hoja-ruta', icon: Calendar },
    { key: 'fichaje', label: 'Fichaje', path: '/fichaje', icon: Clock },
    { key: 'socios', label: 'Socios IDONI', path: '/socios', icon: Users },
    { key: 'gestion-tienda', label: 'Gestión Tienda', path: '/gestion-tienda', icon: ShoppingBag },
    { key: 'contacts', label: 'Contactos', path: '/contacts', icon: CreditCard },
    { key: 'settings', label: 'Configuración', path: '/settings', icon: Settings },
  ];

  // Solo administradores pueden ver catering
  if (isAdmin) {
    menuItems.splice(1, 0, { key: 'catering', label: 'Catering', path: '/catering', icon: Coffee });
    menuItems.push(
      { key: 'users', label: 'Usuarios', path: '/users', icon: Shield },
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
        if (!isAdmin) {
          return <AccessDenied message="Solo los administradores pueden acceder a la sección de Catering." />;
        }
        return <CateringApp
          eventId={cateringEventId}
          onEventIdProcessed={() => setCateringEventId(null)}
        />;
      case 'contacts':
        return <ProvidersContacts />;
      case 'analytics':
        return <AnalyticsPage />;
      case 'sales-invoices':
        return <SalesInvoicesPage />;
      case 'inventory':
        return <InventoryPage />;
      case 'innuva-converter':
        return <InnuvaConverterPage />;
      case 'subvenciones':
        return <SubvencionesPage />;
      case 'empleados':
        return <EmpleadosPage />;
      case 'hoja-ruta':
        return <HojaRutaPage />;
      case 'fichaje':
        return <FichajePage />;
      case 'socios':
        return <SociosPage />;
      case 'gestion-tienda':
        return <GestionTiendaPage />;
      case 'settings':
        return <SettingsPage />;
      case 'users':
        if (!isAdmin) {
          return <AccessDenied message="Solo los administradores pueden acceder a la gestión de usuarios." />;
        }
        return <AdminPanel />;
      case 'audit':
        if (!isAdmin) {
          return <AccessDenied message="Solo los administradores pueden acceder a la auditoría." />;
        }
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
                            <motion.div
                              key={notification.id}
                              className="notification-item"
                              whileHover={!notification.read_at ? { backgroundColor: colors.hover } : {}}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => markNotificationAsRead(notification.id)}
                              style={{
                                padding: '12px 20px',
                                borderBottom: `1px solid ${colors.border}`,
                                cursor: !notification.read_at ? 'pointer' : 'default',
                                background: 'transparent',
                                userSelect: 'none',
                                WebkitUserSelect: 'none',
                                MozUserSelect: 'none',
                                msUserSelect: 'none',
                                WebkitTouchCallout: 'none',
                                WebkitTapHighlightColor: 'transparent',
                                WebkitHighlight: 'none',
                                WebkitTextFillColor: 'inherit',
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
                                  boxShadow: !notification.read_at ? `0 0 0 2px ${colors.primary}33` : 'none',
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
                                    {notification.data?.navigation_target === 'hoja_ruta' && (
                                      <div style={{
                                        padding: '2px 8px',
                                        borderRadius: '12px',
                                        fontSize: '11px',
                                        fontWeight: '600',
                                        color: '#10B981',
                                        background: '#10B98115',
                                        border: `1px solid #10B98130`,
                                        userSelect: 'none'
                                      }}>
                                        Hoja de Ruta
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

                                  {/* Información adicional para notificaciones de hoja de ruta */}
                                  {notification.data?.navigation_target === 'hoja_ruta' && (
                                    <div style={{
                                      fontSize: '11px',
                                      color: colors.textSecondary,
                                      marginBottom: '6px',
                                      padding: '6px 8px',
                                      backgroundColor: colors.background,
                                      borderRadius: '4px',
                                      border: `1px solid ${colors.border}`,
                                      userSelect: 'none'
                                    }}>
                                      <div style={{ marginBottom: '2px' }}>
                                        <strong>Responsable:</strong> {notification.data?.responsable || 'No asignado'}
                                      </div>
                                      <div style={{ marginBottom: '2px' }}>
                                        <strong>Contacto:</strong> {notification.data?.contacto || 'No especificado'}
                                      </div>
                                      <div style={{ marginBottom: '2px' }}>
                                        <strong>Transportista:</strong> {notification.data?.transportista || 'No asignado'}
                                      </div>
                                      <div>
                                        <strong>Personal:</strong> {notification.data?.personal || 'No asignado'}
                                      </div>
                                    </div>
                                  )}

                                  {notification.data?.event_id && (
                                    <motion.div
                                      whileHover={{ backgroundColor: colors.primary + '15' }}
                                      whileTap={{ scale: 0.98 }}
                                      onClick={() => handleViewEventClick(notification)}
                                      style={{
                                        color: colors.primary,
                                        fontSize: 11,
                                        fontStyle: 'italic',
                                        marginBottom: 4,
                                        userSelect: 'none',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '4px',
                                        cursor: 'pointer',
                                        padding: '2px 4px',
                                        borderRadius: '4px',
                                      }}
                                    >
                                      <ExternalLink size={10} />
                                      Clic para ver evento →
                                    </motion.div>
                                  )}
                                  <div style={{
                                    color: colors.textSecondary,
                                    fontSize: 11,
                                    userSelect: 'none',
                                  }}>
                                    {formatDate(notification.created_at)}
                                  </div>
                                </div>
                              </div>
                            </motion.div>
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
                              whileHover={{
                                scale: 1.02,
                                backgroundColor: colors.primary + '08'
                              }}
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
                                userSelect: 'none'
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
                              whileHover={{
                                scale: 1.02,
                                backgroundColor: colors.textSecondary + '08'
                              }}
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
                                userSelect: 'none'
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

              {/* Botón de actualización */}
              <div style={{ position: 'relative' }}>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={async () => {
                    if (updateAvailable) {
                      navigateTo('settings');
                    } else {
                      // Verificar actualizaciones manualmente
                      try {
                        if (window.electronAPI?.checkForUpdates) {
                          await window.electronAPI.checkForUpdates();
                        }

                        // Verificar también con GitHub API
                        const response = await fetch('https://api.github.com/repos/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases/latest', {
                          method: 'GET',
                          headers: {
                            'Accept': 'application/vnd.github.v3+json',
                            'User-Agent': 'SSS-Kronos-App'
                          }
                        });

                        if (response.ok) {
                          const githubData = await response.json();
                          const currentVersion = appVersion.replace('v', '');
                          const latestVersion = githubData.tag_name.replace('v', '');

                          if (latestVersion > currentVersion) {
                            // Hay actualización disponible, actualizar estado
                            setUpdateAvailable(true);
                            setUpdateInfo({
                              version: latestVersion,
                              currentVersion: currentVersion,
                              releaseNotes: githubData.body,
                              htmlUrl: githubData.html_url
                            });
                            navigateTo('settings');
                          } else {
                            // No hay actualización, mostrar mensaje
                            setShowNoUpdateMessage(true);
                            setTimeout(() => setShowNoUpdateMessage(false), 3000);
                          }
                        } else {
                          // No hay actualización, mostrar mensaje
                          setShowNoUpdateMessage(true);
                          setTimeout(() => setShowNoUpdateMessage(false), 3000);
                        }
                      } catch (error) {
                        // No hay actualización, mostrar mensaje
                        setShowNoUpdateMessage(true);
                        setTimeout(() => setShowNoUpdateMessage(false), 3000);
                      }
                    }
                  }}
                  onMouseEnter={() => updateAvailable && setShowUpdateTooltip(true)}
                  onMouseLeave={() => setShowUpdateTooltip(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: updateAvailable ? colors.primary : colors.textSecondary,
                    transition: 'all 0.2s ease',
                    position: 'relative',
                  }}
                >
                  <Download size={18} />
                  {updateAvailable && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      style={{
                        position: 'absolute',
                        top: 2,
                        right: 2,
                        background: colors.error,
                        color: 'white',
                        borderRadius: '50%',
                        width: 8,
                        height: 8,
                        border: `2px solid ${colors.header}`,
                      }}
                    />
                  )}
                </motion.button>

                {/* Tooltip de actualización disponible */}
                <AnimatePresence>
                  {showUpdateTooltip && updateAvailable && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      style={{
                        position: 'absolute',
                        top: '100%',
                        right: 0,
                        marginTop: 8,
                        width: 280,
                        background: colors.surface,
                        border: `1px solid ${colors.primary}`,
                        borderRadius: 12,
                        padding: '16px',
                        boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                        zIndex: 1001,
                        pointerEvents: 'auto',
                      }}
                      onMouseEnter={() => setShowUpdateTooltip(true)}
                      onMouseLeave={() => setShowUpdateTooltip(false)}
                    >
                      <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 12,
                      }}>
                        <div style={{
                          width: 32,
                          height: 32,
                          borderRadius: '50%',
                          background: colors.primary + '20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          <Download size={16} color={colors.primary} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            color: colors.text,
                            fontSize: 14,
                            fontWeight: 600,
                            marginBottom: 4,
                          }}>
                            Actualización disponible
                          </div>
                          <div style={{
                            color: colors.textSecondary,
                            fontSize: 12,
                            lineHeight: 1.4,
                            marginBottom: 12,
                          }}>
                            Hay una nueva versión disponible ({updateInfo?.version || 'Nueva versión'}). Tu versión actual es {updateInfo?.currentVersion || appVersion}.
                          </div>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              navigateTo('settings');
                              setShowUpdateTooltip(false);
                            }}
                            style={{
                              width: '100%',
                              background: colors.primary,
                              color: 'white',
                              border: 'none',
                              borderRadius: 8,
                              padding: '8px 16px',
                              fontSize: 13,
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: 8,
                            }}
                          >
                            <Download size={14} />
                            Ir a actualizaciones
                          </motion.button>
                        </div>
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
              overflowX: 'hidden', /* Prevenir scroll horizontal */
              background: colors.background,
              scrollbarWidth: 'thin',
              scrollbarColor: `${colors.border} transparent`,
              height: '100%', /* Asegurar que no exceda el viewport */
              boxSizing: 'border-box'
            }}
          >
            {renderSection()}
          </motion.main>
        </div>

        {/* Mensaje de "No hay actualización disponible" */}
        <AnimatePresence>
          {showNoUpdateMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              style={{
                position: 'fixed',
                top: '20px',
                right: '20px',
                zIndex: 1001,
                backgroundColor: colors.primary + '22',
                border: `1px solid ${colors.primary}`,
                borderRadius: '12px',
                padding: '16px 20px',
                boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                maxWidth: '400px',
                minWidth: '300px'
              }}
            >
              <div style={{
                width: '24px',
                height: '24px',
                borderRadius: '50%',
                backgroundColor: colors.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <CheckCircle size={14} color="white" />
              </div>
              <div style={{
                flex: 1,
                fontSize: '15px',
                fontWeight: '500',
                color: colors.text,
                lineHeight: '1.4'
              }}>
                Ya tienes la última versión disponible ({appVersion || 'actual'})
              </div>
              <button
                onClick={() => setShowNoUpdateMessage(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: colors.text,
                  opacity: 0.7,
                  transition: 'opacity 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
                onMouseEnter={(e) => e.target.style.opacity = '1'}
                onMouseLeave={(e) => e.target.style.opacity = '0.7'}
              >
                <X size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </CateringProvider>
  );
};

export default Layout; 