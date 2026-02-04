import React from 'react';
import { motion } from 'framer-motion';
import {
  Package,
  ShoppingBag,
  Users,
  Clock,
  Settings,
  LogOut
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';

const TiendaDashboard = () => {
  const { colors, isDark } = useTheme();
  const { navigateTo } = useNavigation();
  const { user, signOut } = useAuth();

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        type: "spring",
        stiffness: 100
      }
    }
  };

  const menuItems = [
    {
      key: 'inventory',
      title: 'Inventario',
      description: 'Gestión de stock y productos',
      icon: Package,
      color: '#3B82F6', // Blue
      gradient: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)'
    },
    {
      key: 'gestion-tienda',
      title: 'Gestión Tienda',
      description: 'Panel de control de la tienda',
      icon: ShoppingBag,
      color: '#10B981', // Emerald
      gradient: 'linear-gradient(135deg, #10B981 0%, #059669 100%)'
    },
    {
      key: 'socios',
      title: 'Socios',
      description: 'Administración de socios',
      icon: Users,
      color: '#8B5CF6', // Violet
      gradient: 'linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)'
    },
    {
      key: 'fichaje',
      title: 'Fichaje',
      description: 'Registro de jornada laboral',
      icon: Clock,
      color: '#F59E0B', // Amber
      gradient: 'linear-gradient(135deg, #F59E0B 0%, #D97706 100%)'
    },
    {
      key: 'settings',
      title: 'Configuración',
      description: 'Ajustes de la aplicación',
      icon: Settings,
      color: '#6B7280', // Gray
      gradient: 'linear-gradient(135deg, #6B7280 0%, #4B5563 100%)'
    }
  ];

  const getTimeGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  };

  return (
    <div style={{
      padding: '40px',
      maxWidth: '1200px',
      margin: '0 auto',
      width: '100%',
      boxSizing: 'border-box'
    }}>
      {/* Header Section */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '40px' }}
      >
        <h1 style={{
          fontSize: '32px',
          fontWeight: '800',
          color: colors.text,
          marginBottom: '8px',
          letterSpacing: '-0.5px'
        }}>
          {getTimeGreeting()}, {user?.user_metadata?.name || 'Compañero'}
        </h1>
        <p style={{
          fontSize: '16px',
          color: colors.textSecondary,
          maxWidth: '600px'
        }}>
          Bienvenido al panel de gestión de tienda. Selecciona una opción para comenzar.
        </p>
      </motion.div>

      {/* Grid Menu */}
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '24px'
        }}
      >
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.key}
              variants={itemVariants}
              whileHover={{ 
                y: -5,
                boxShadow: `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`
              }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigateTo(item.key)}
              style={{
                backgroundColor: colors.surface,
                borderRadius: '16px',
                padding: '24px',
                cursor: 'pointer',
                border: `1px solid ${colors.border}`,
                display: 'flex',
                flexDirection: 'column',
                height: '160px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                transition: 'border-color 0.2s'
              }}
            >
              {/* Decorative gradient background opacity */}
              <div style={{
                position: 'absolute',
                top: 0,
                right: 0,
                width: '150px',
                height: '150px',
                background: item.gradient,
                opacity: 0.1,
                borderRadius: '0 0 0 100%',
                pointerEvents: 'none'
              }} />

              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                background: item.gradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 'auto',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
              }}>
                <Icon size={24} color="white" />
              </div>

              <div>
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '700',
                  color: colors.text,
                  marginBottom: '4px'
                }}>
                  {item.title}
                </h3>
                <p style={{
                  fontSize: '14px',
                  color: colors.textSecondary,
                  lineHeight: '1.4'
                }}>
                  {item.description}
                </p>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
};

export default TiendaDashboard;
