import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { BarChart2, LogOut, Edit2, Save, X, User, Key, Mail, Calendar, Shield } from 'feather-icons-react';
import OnboardingPage from './OnboardingPage';
import { supabase } from '../config/supabase';

const UserProfile = ({ onShowOnboarding }) => {
  const { user, signOut } = useAuth();
  const { colors } = useTheme();
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(user?.user_metadata?.name || '');
  const [role, setRole] = useState(user?.user_metadata?.role || 'user');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Sincronizar datos del usuario cuando cambie
  useEffect(() => {
    if (user) {
      // Cargar datos desde user_profiles primero, luego desde metadata como fallback
      loadUserProfile();
    }
  }, [user]);

  // Cargar perfil del usuario desde la base de datos
  const loadUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('name, role')
        .eq('id', user.id)
        .single();

      if (error) {
        // No se encontró perfil en DB, creando uno nuevo
        // Crear perfil si no existe
        await createUserProfile();
        // Usar metadata como fallback mientras se crea
        setName(user?.user_metadata?.name || '');
        setRole(user?.user_metadata?.role || 'user');
      } else if (data) {
        // Perfil cargado desde DB
        setName(data.name || '');
        setRole(data.role || 'user');
      }
    } catch (e) {
      // Error loading user profile
      // Usar metadata como fallback
      setName(user?.user_metadata?.name || '');
      setRole(user?.user_metadata?.role || 'user');
    }
  };

  // Función para obtener el rol original del usuario (para no administradores)
  const getOriginalRole = () => {
    return user?.user_metadata?.role || 'user';
  };

  // Crear perfil de usuario si no existe
  const createUserProfile = async () => {
    if (!user?.id) return;
    
    try {
      const { error } = await supabase
        .from('user_profiles')
        .insert({
          id: user.id,
          name: user?.user_metadata?.name || user?.email || 'Usuario',
          role: user?.user_metadata?.role || 'user',
          email: user?.email || null
        });

      if (error) {
        // Error creating user profile
      }
    } catch (e) {
      // Error creating user profile
    }
  };

  // Cambiar datos de usuario en Supabase
  const handleSave = async () => {
    if (!name.trim()) {
      setError('El nombre no puede estar vacío.');
      return;
    }

    // Verificar permisos para cambiar rol
    if (!canEditRole && role !== user?.user_metadata?.role) {
      setError('No tienes permisos para cambiar tu rol. Solo los administradores pueden modificar roles.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');
    
    try {

      
      // 1. Actualizar metadatos del usuario en Auth
      const { data: authData, error: updateError } = await supabase.auth.updateUser({
        data: { name: name.trim(), role }
      });
      
      if (updateError) {
        setError(`Error al guardar los cambios: ${updateError.message}`);
        return;
      }

      // 2. Actualizar tabla user_profiles
      const { error: profileError } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          name: name.trim(),
          role: role,
          email: user?.email || null,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'id'
        });

      if (profileError) {
        setError(`Error al actualizar el perfil: ${profileError.message}`);
        return;
      }
      setSuccess('Datos actualizados correctamente.');
      setEditMode(false);
      
    } catch (e) {
      setError('Error inesperado al actualizar los datos. Verifica tu conexión.');
    } finally {
      setSaving(false);
    }
  };

  // Cambiar contraseña
  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!newPassword || newPassword.length < 8) {
      setPasswordError('La contraseña debe tener al menos 8 caracteres.');
      return;
    }
    try {
      const { data, error: passError } = await supabase.auth.updateUser({ 
        password: newPassword 
      });
      if (passError) {
        setPasswordError(`Error al cambiar la contraseña: ${passError.message}`);
      } else {
        setPasswordSuccess('Contraseña cambiada correctamente.');
        setNewPassword('');
        setShowPassword(false);
      }
    } catch (e) {
      setPasswordError('Error inesperado al cambiar la contraseña.');
    }
  };

  // Avatar con iniciales
  const initials = (name || user?.email || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase();

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
  // Función para obtener el color del rol
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return colors.error;
      case 'management': return '#8B5CF6'; // Violeta para Gestión
      case 'manager': return colors.warning;
      case 'user': return colors.primary;
      default: return colors.primary;
    }
  };

  // Verificar si el usuario es administrador
  const isAdmin = user?.user_metadata?.role === 'admin' || role === 'admin';

  // Verificar si puede editar el rol (solo administradores)
  const canEditRole = isAdmin;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      style={{
        width: '100%',
        minHeight: '100%',
        backgroundColor: colors.background,
        display: 'block',
        padding: '40px 40px 0 40px',
        boxSizing: 'border-box',
      }}
    >
      {/* Título de la sección */}
      <h1 style={{
        color: colors.text,
        fontSize: 28,
        fontWeight: 700,
        margin: '0 0 32px 0',
        letterSpacing: '-0.5px',
        userSelect: 'none',
      }}>
        Perfil de usuario
      </h1>

      {/* Card principal de datos del usuario */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          maxWidth: 700,
          margin: '0 0 32px 0',
          background: colors.surface,
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: `1px solid ${colors.border}`,
          padding: '32px 40px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 36,
          minHeight: 180,
        }}
      >
        {/* Avatar grande a la izquierda */}
        <div style={{
          width: 110,
          height: 110,
          borderRadius: '50%',
          background: colors.primary + '22',
          color: colors.primary,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 44,
          fontWeight: 700,
          userSelect: 'none',
          border: `3px solid ${colors.primary}33`,
          flexShrink: 0,
        }}>
          {initials}
        </div>
        {/* Datos a la derecha */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Cabecera: nombre + badge + botón editar */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
              {editMode ? (
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  style={{
                    fontSize: 24,
                    fontWeight: 700,
                    border: `2px solid ${colors.primary}`,
                    borderRadius: 8,
                    padding: '8px 14px',
                    color: colors.text,
                    background: colors.background,
                    maxWidth: 260,
                    textAlign: 'left',
                    outline: 'none',
                  }}
                  placeholder="Tu nombre"
                />
              ) : (
                <span style={{
                  color: colors.text,
                  fontSize: 24,
                  fontWeight: 700,
                  userSelect: 'none',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 260
                }}>{name || 'Sin nombre'}</span>
              )}
              {/* Badge de rol junto al nombre */}
              <span style={{
                color: getRoleColor(role),
                fontSize: 14,
                fontWeight: 600,
                padding: '4px 12px',
                borderRadius: 8,
                background: getRoleColor(role) + '22',
                border: `1px solid ${getRoleColor(role)}33`,
                userSelect: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                marginLeft: 2,
                position: 'relative'
              }}>
                <Shield size={14} style={{ marginRight: 3 }} />
                {getRoleName(role)}
                {/* Indicador de administrador */}
                {isAdmin && (
                  <span style={{
                    position: 'absolute',
                    top: -2,
                    right: -2,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: colors.success,
                    border: `2px solid ${colors.surface}`,
                    fontSize: 0
                  }}>
                    ★
                  </span>
                )}
              </span>
            </div>
            {/* Botón editar arriba derecha */}
            {!editMode && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setEditMode(true)}
                style={{
                  background: colors.surface,
                  color: colors.primary,
                  border: `1.5px solid ${colors.primary}`,
                  borderRadius: 8,
                  padding: '8px 18px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  boxShadow: 'none',
                }}
              >
                <Edit2 size={16} /> Editar
              </motion.button>
            )}
          </div>
          {/* Selector de rol en edición - Solo para administradores */}
          {editMode && canEditRole && (
            <div style={{ margin: '8px 0 0 0' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: 8, 
                marginBottom: 4 
              }}>
                <Shield size={14} color={colors.textSecondary} />
                <span style={{ 
                  fontSize: 13, 
                  color: colors.textSecondary, 
                  fontWeight: 500 
                }}>
                  Rol de usuario
                </span>
              </div>
              <select
                value={role}
                onChange={e => setRole(e.target.value)}
                style={{
                  fontSize: 15,
                  border: `2px solid ${getRoleColor(role)}`,
                  borderRadius: 8,
                  padding: '6px 12px',
                  color: colors.text,
                  background: colors.background,
                  fontWeight: 600,
                  outline: 'none',
                  marginRight: 8
                }}
              >
                <option value="user">Usuario</option>
                <option value="manager">Jefe</option>
                <option value="management">Gestión</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
          )}
          {/* Mensaje para usuarios no administradores */}
          {editMode && !canEditRole && (
            <div style={{ 
              margin: '8px 0 0 0',
              padding: '8px 12px',
              background: colors.warning + '11',
              border: `1px solid ${colors.warning}33`,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}>
              <Shield size={14} color={colors.warning} />
              <span style={{ 
                fontSize: 13, 
                color: colors.warning, 
                fontWeight: 500 
              }}>
                Solo los administradores pueden cambiar roles. Los usuarios de Gestión pueden editar su perfil pero no su rol.
              </span>
            </div>
          )}
          {/* Correo y fecha */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, margin: '18px 0 0 0', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: colors.textSecondary, fontSize: 15 }}>
              <Mail size={15} />
              <span style={{ userSelect: 'none' }}>{user?.email}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: colors.textSecondary, fontSize: 15 }}>
              <Calendar size={14} />
              <span style={{ userSelect: 'none' }}>
                Miembro desde: {user?.created_at ? new Date(user.created_at).toLocaleDateString('es-ES', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric'
                }) : '-'}
              </span>
            </div>
          </div>
          {/* Botones de guardar/cancelar en edición */}
          {editMode && (
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleSave}
                disabled={saving}
                style={{
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: 8,
                  padding: '10px 22px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: saving ? 'not-allowed' : 'pointer',
                  opacity: saving ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <Save size={16} /> Guardar
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => { 
                  setEditMode(false); 
                  setName(user?.user_metadata?.name || ''); 
                  // Restaurar rol original si no es administrador
                  setRole(canEditRole ? (user?.user_metadata?.role || 'user') : getOriginalRole()); 
                }}
                style={{
                  background: colors.error + '11',
                  color: colors.error,
                  border: `1px solid ${colors.error}33`,
                  borderRadius: 8,
                  padding: '10px 22px',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <X size={16} /> Cancelar
              </motion.button>
            </div>
          )}
          {/* Mensajes de éxito/error */}
          <AnimatePresence>
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  color: colors.success,
                  fontSize: 14,
                  marginTop: 16,
                  textAlign: 'left',
                  userSelect: 'none'
                }}
              >
                {success}
              </motion.div>
            )}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                style={{
                  color: colors.error,
                  fontSize: 14,
                  marginTop: 16,
                  textAlign: 'left',
                  userSelect: 'none'
                }}
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Card de cambiar contraseña */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{
          maxWidth: 700,
          margin: '0 0 24px 0',
          background: colors.surface,
          borderRadius: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: `1px solid ${colors.border}`,
          padding: '24px 40px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ 
          color: colors.text, 
          fontWeight: 600, 
          fontSize: 16, 
          marginBottom: 10, 
          display: 'flex', 
          alignItems: 'center', 
          gap: 8 
        }}>
          <Key size={18} color={colors.primary} /> Cambiar contraseña
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={e => setNewPassword(e.target.value)}
            placeholder="Nueva contraseña"
            style={{
              flex: 1,
              minWidth: 180,
              padding: '10px 14px',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              color: colors.text,
              background: colors.background,
              outline: 'none',
            }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(p => !p)}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              fontSize: 16,
              cursor: 'pointer',
              padding: 8,
              borderRadius: 6,
            }}
            title={showPassword ? 'Ocultar' : 'Mostrar'}
          >
            {showPassword ? <X size={16} /> : <User size={16} />}
          </button>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={handleChangePassword}
            style={{
              background: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: 8,
              padding: '10px 20px',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            Cambiar
          </motion.button>
        </div>
        <AnimatePresence>
          {passwordSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ 
                color: colors.success, 
                fontSize: 14, 
                marginBottom: 4,
                userSelect: 'none'
              }}
            >
              {passwordSuccess}
            </motion.div>
          )}
          {passwordError && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              style={{ 
                color: colors.error, 
                fontSize: 14, 
                marginBottom: 4,
                userSelect: 'none'
              }}
            >
              {passwordError}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Card de acciones */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
        style={{
          maxWidth: 700,
          margin: '0 0 24px 0',
          background: colors.surface,
          borderRadius: 14,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: `1px solid ${colors.border}`,
          padding: '24px 40px',
          position: 'relative',
          display: 'flex',
          flexDirection: 'row',
          gap: 16,
        }}
      >
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onShowOnboarding}
          style={{
            flex: 1,
            padding: '12px 0',
            backgroundColor: colors.primary,
            border: 'none',
            borderRadius: '8px',
            color: 'white',
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            userSelect: 'none',
            boxShadow: '0 2px 8px rgba(76,175,80,0.08)'
          }}
        >
          <BarChart2 size={17} />
          Ver tutorial
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={signOut}
          style={{
            flex: 1,
            padding: '12px 0',
            backgroundColor: 'transparent',
            border: `1px solid ${colors.error}`,
            borderRadius: '8px',
            color: colors.error,
            fontSize: '15px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            userSelect: 'none',
          }}
        >
          <LogOut size={17} />
          Cerrar sesión
        </motion.button>
      </motion.div>

      {/* Responsive: columna en móvil */}
      <style>{`
        @media (max-width: 800px) {
          .userprofile-maincard {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: 24px 10px !important;
            gap: 18px !important;
          }
          .userprofile-actions {
            flex-direction: column !important;
            padding: 18px 10px !important;
            gap: 10px !important;
          }
        }
      `}</style>
    </motion.div>
  );
};

export default UserProfile; 
