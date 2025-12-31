import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { 
  Users, 
  UserPlus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  Shield, 
  Mail, 
  Calendar,
  Search,
  Filter,
  User,
  ChevronLeft,
  ChevronRight,
  Key,
  Lock,
  Unlock,
  Activity,
  Clock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  BarChart2,
  TrendingUp
} from 'feather-icons-react';
import { supabase } from '../config/supabase';
import FichajeAdminSection from './FichajeAdminSection';

const AdminPanel = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Estados principales
  const [activeTab, setActiveTab] = useState('usuarios'); // 'usuarios' o 'fichajes'
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de edición
  const [editingUser, setEditingUser] = useState(null);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // Estados de búsqueda y filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Estados de admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(10);

  // Estadísticas
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    admins: 0,
    managers: 0,
    regularUsers: 0
  });

  // Verificar si el usuario actual es administrador
  const verifyAdminStatus = async () => {
    console.log('🔍 AdminPanel: Verificando estado de admin...');
    
    if (!user?.id) {
      console.log('❌ AdminPanel: No hay user.id');
      return false;
    }
    
    console.log('🆔 AdminPanel: User ID:', user.id);
    
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();
      
      console.log('🗄️ AdminPanel: Respuesta de Supabase:');
      console.log('  - Data:', data);
      console.log('  - Error:', error);
        
      if (error) {
        console.error('❌ AdminPanel: Error en query:', error.message);
        return false;
      }
      
      const isAdminFromDB = data?.role === 'admin';
      const isAdminFromMetadata = user?.user_metadata?.role === 'admin';
      const finalIsAdmin = isAdminFromDB || isAdminFromMetadata;
      
      console.log('🔐 AdminPanel: Verificación de admin:');
      console.log('  - Rol desde DB:', data?.role);
      console.log('  - Es admin desde DB:', isAdminFromDB);
      console.log('  - Rol desde metadata:', user?.user_metadata?.role);
      console.log('  - Es admin desde metadata:', isAdminFromMetadata);
      console.log('  - Resultado final:', finalIsAdmin);
      
      return finalIsAdmin;
    } catch (e) {
      console.error('❌ AdminPanel: Error inesperado:', e);
      return false;
    }
  };

  // Cargar usuarios
  const loadUsers = async (forceAdminCheck = null) => {
    const shouldLoad = forceAdminCheck !== null ? forceAdminCheck : isAdmin;
    
    console.log('📥 AdminPanel: Intentando cargar usuarios...');
    console.log('  - forceAdminCheck:', forceAdminCheck);
    console.log('  - isAdmin:', isAdmin);
    console.log('  - shouldLoad:', shouldLoad);
    
    if (!shouldLoad) {
      console.log('❌ AdminPanel: No es admin, abortando carga');
      return;
    }
    
    try {
      console.log('🔄 AdminPanel: Iniciando carga de usuarios...');
      setLoading(true);
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });
      
      console.log('📦 AdminPanel: Respuesta de carga de usuarios:');
      console.log('  - Data recibida:', data);
      console.log('  - Error:', error);
      console.log('  - Cantidad de usuarios:', data?.length);
        
      if (error) {
        console.error('❌ AdminPanel: Error al cargar usuarios:', error.message);
        setError('Error al cargar usuarios');
        return;
      }
      
      console.log('✅ AdminPanel: Usuarios cargados exitosamente');
      setUsers(data || []);
      calculateStats(data || []);
    } catch (e) {
      console.error('❌ AdminPanel: Error inesperado:', e);
      setError('Error inesperado al cargar usuarios');
    } finally {
      console.log('🏁 AdminPanel: Finalizando carga (setLoading(false))');
      setLoading(false);
    }
  };

  // Calcular estadísticas
  const calculateStats = (userData) => {
    setStats({
      total: userData.length,
      active: userData.filter(u => !u.disabled).length,
      inactive: userData.filter(u => u.disabled).length,
      admins: userData.filter(u => u.role === 'admin').length,
      managers: userData.filter(u => u.role === 'manager' || u.role === 'management').length,
      regularUsers: userData.filter(u => u.role === 'user').length
    });
  };

  useEffect(() => {
    const init = async () => {
      console.log('🚀 AdminPanel: Inicializando...');
      console.log('  - user.id:', user?.id);
      
      const adminStatus = await verifyAdminStatus();
      
      console.log('👤 AdminPanel: Resultado de verificación:');
      console.log('  - adminStatus:', adminStatus);
      
      setIsAdmin(adminStatus);
      setIsAdminVerified(true);
      
      if (adminStatus) {
        console.log('✅ AdminPanel: Usuario es admin, cargando usuarios...');
        // Pasar adminStatus directamente para evitar problema de timing
        await loadUsers(adminStatus);
      } else {
        console.log('❌ AdminPanel: Usuario NO es admin');
        setLoading(false);
      }
      
      console.log('🏁 AdminPanel: Inicialización completada');
    };
    
    init();
  }, [user?.id]);

  // Actualizar usuario
  const handleUpdateUser = async (userId, updates) => {
    if (!isAdmin) return;
    
    try {
      if (userId === user.id && updates.role && updates.role !== user?.user_metadata?.role) {
        setError('No puedes cambiar tu propio rol');
        return;
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (profileError) throw profileError;

      if (updates.role) {
        await supabase.auth.admin.updateUserById(userId, {
          user_metadata: { role: updates.role }
        });
      }

      setSuccess('Usuario actualizado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      setEditingUser(null);
      await loadUsers();
    } catch (e) {
      setError(`Error al actualizar usuario: ${e.message}`);
    }
  };

  // Resetear contraseña
  const handleResetPassword = async (userId, newPass) => {
    if (!isAdmin || !newPass || newPass.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    try {
      const { error } = await supabase.auth.admin.updateUserById(userId, {
        password: newPass
      });

      if (error) throw error;

      setSuccess('Contraseña actualizada correctamente');
      setTimeout(() => setSuccess(''), 3000);
      setShowPasswordReset(false);
      setNewPassword('');
    } catch (e) {
      setError(`Error al resetear contraseña: ${e.message}`);
    }
  };

  // Activar/Desactivar usuario
  const handleToggleUserStatus = async (userId, currentStatus) => {
    if (!isAdmin) return;
    
    if (userId === user.id) {
      setError('No puedes desactivar tu propia cuenta');
      return;
    }

    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ disabled: !currentStatus })
        .eq('id', userId);

      if (error) throw error;

      setSuccess(`Usuario ${!currentStatus ? 'desactivado' : 'activado'} correctamente`);
      setTimeout(() => setSuccess(''), 3000);
      await loadUsers();
    } catch (e) {
      setError(`Error al cambiar estado: ${e.message}`);
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId) => {
    if (!isAdmin) return;
    
    if (userId === user.id) {
      setError('No puedes eliminar tu propia cuenta');
      return;
    }

    if (!confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción no se puede deshacer.')) {
      return;
    }

    try {
      const { error } = await supabase.auth.admin.deleteUser(userId);
      if (error) throw error;

      setSuccess('Usuario eliminado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      await loadUsers();
    } catch (e) {
      setError(`Error al eliminar usuario: ${e.message}`);
    }
  };

  // Filtrar usuarios
  const filteredUsers = users.filter(u => {
    const matchesSearch = u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || u.role === filterRole;
    const matchesStatus = filterStatus === 'all' || 
                         (filterStatus === 'active' && !u.disabled) ||
                         (filterStatus === 'inactive' && u.disabled);
    
    return matchesSearch && matchesRole && matchesStatus;
  });

  // Paginación
  const indexOfLastUser = currentPage * usersPerPage;
  const indexOfFirstUser = indexOfLastUser - usersPerPage;
  const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

  // Función auxiliar para obtener color de rol
  const getRoleColor = (role) => {
    switch(role) {
      case 'admin': return colors.error;      // Rojo para Administrador
      case 'management': return colors.warning; // Naranja para Gestión
      case 'manager': return '#3b82f6';        // Azul distintivo para Jefe
      default: return colors.primary;
    }
  };

  // Función auxiliar para obtener etiqueta de rol
  const getRoleLabel = (role) => {
    switch(role) {
      case 'admin': return 'Administrador';
      case 'management': return 'Gestión';
      case 'manager': return 'Jefe';
      default: return 'Usuario';
    }
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (!isAdminVerified) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: colors.textSecondary 
      }}>
        <Shield size={48} color={colors.border} style={{ marginBottom: '16px' }} />
        <p>Verificando permisos de administrador...</p>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div style={{ 
        padding: '40px', 
        textAlign: 'center',
        color: colors.textSecondary 
      }}>
        <Shield size={48} color={colors.error} style={{ marginBottom: '16px' }} />
        <h2 style={{ color: colors.text, marginBottom: '8px' }}>Acceso Denegado</h2>
        <p>Solo los administradores pueden acceder a esta sección</p>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '24px',
      maxWidth: '1400px',
      margin: '0 auto'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <Shield size={32} color={colors.primary} />
          <h1 style={{ 
            fontSize: '28px', 
            fontWeight: '700', 
            color: colors.text,
            margin: 0
          }}>
            Panel de Administración
          </h1>
        </div>
        <p style={{ 
          fontSize: '15px', 
          color: colors.textSecondary,
          margin: 0
        }}>
          Gestión completa de usuarios, permisos, seguridad y fichajes del sistema
        </p>
      </div>

      {/* Pestañas */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: `2px solid ${colors.border}`
      }}>
        <button
          onClick={() => setActiveTab('usuarios')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'usuarios' ? `3px solid ${colors.primary}` : '3px solid transparent',
            color: activeTab === 'usuarios' ? colors.primary : colors.textSecondary,
            fontSize: '15px',
            fontWeight: activeTab === 'usuarios' ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Users size={18} />
          Usuarios
        </button>
        <button
          onClick={() => setActiveTab('fichajes')}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            border: 'none',
            borderBottom: activeTab === 'fichajes' ? `3px solid ${colors.primary}` : '3px solid transparent',
            color: activeTab === 'fichajes' ? colors.primary : colors.textSecondary,
            fontSize: '15px',
            fontWeight: activeTab === 'fichajes' ? '600' : '500',
            cursor: 'pointer',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Clock size={18} />
          Fichajes
        </button>
      </div>

      {/* Mensajes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.error + '15',
              border: `2px solid ${colors.error}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertCircle size={20} color={colors.error} />
            <span style={{ color: colors.error, fontSize: '14px', fontWeight: '500' }}>{error}</span>
            <button 
              onClick={() => setError('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.error
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.success + '15',
              border: `2px solid ${colors.success}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle size={20} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '14px', fontWeight: '500' }}>{success}</span>
            <button 
              onClick={() => setSuccess('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.success
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Contenido según pestaña activa */}
      {activeTab === 'fichajes' ? (
        <FichajeAdminSection />
      ) : (
        <>
      {/* Estadísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <div style={{
          padding: '20px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Users size={24} color={colors.primary} />
            <TrendingUp size={16} color={colors.success} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.text, marginBottom: '4px' }}>
            {stats.total}
          </div>
          <div style={{ fontSize: '13px', color: colors.textSecondary }}>
            Total Usuarios
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Activity size={24} color={colors.success} />
            <CheckCircle size={16} color={colors.success} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.success, marginBottom: '4px' }}>
            {stats.active}
          </div>
          <div style={{ fontSize: '13px', color: colors.textSecondary }}>
            Activos
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <Shield size={24} color={colors.error} />
            <BarChart2 size={16} color={colors.error} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.error, marginBottom: '4px' }}>
            {stats.admins}
          </div>
          <div style={{ fontSize: '13px', color: colors.textSecondary }}>
            Administradores
          </div>
        </div>

        <div style={{
          padding: '20px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <User size={24} color={colors.info} />
            <Users size={16} color={colors.info} />
          </div>
          <div style={{ fontSize: '28px', fontWeight: '700', color: colors.info, marginBottom: '4px' }}>
            {stats.regularUsers}
          </div>
          <div style={{ fontSize: '13px', color: colors.textSecondary }}>
            Usuarios Regulares
          </div>
        </div>
      </div>

      {/* Búsqueda y Filtros */}
      <div style={{
        backgroundColor: colors.surface,
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '24px',
        border: `1px solid ${colors.border}`
      }}>
        <div style={{ display: 'flex', gap: '20px', alignItems: 'end', marginBottom: '20px', width: '100%' }}>
          {/* Búsqueda */}
          <div style={{ flex: '2', minWidth: '250px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Buscar
            </label>
            <div style={{ position: 'relative' }}>
              <Search 
                size={20} 
                color={colors.textSecondary} 
                style={{ 
                  position: 'absolute', 
                  left: '12px', 
                  top: '50%', 
                  transform: 'translateY(-50%)' 
                }} 
              />
              <input
                type="text"
                placeholder="Buscar por nombre o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  color: colors.text,
                  backgroundColor: colors.surface,
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Filtro por rol */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Rol
            </label>
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                color: colors.text,
                backgroundColor: colors.surface,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">Todos los roles</option>
              <option value="admin">Administradores</option>
              <option value="management">Gestión</option>
              <option value="manager">Jefes</option>
              <option value="user">Usuarios</option>
            </select>
          </div>

          {/* Filtro por estado */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Estado
            </label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                color: colors.text,
                backgroundColor: colors.surface,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            >
              <option value="all">Todos los estados</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </div>

          {/* Botón Limpiar Filtros */}
          <div style={{ flexShrink: 0 }}>
            <button
              onClick={() => {
                setFilterRole('all');
                setFilterStatus('all');
                setSearchTerm('');
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        <div style={{ 
          marginTop: '12px', 
          fontSize: '13px', 
          color: colors.textSecondary 
        }}>
          Mostrando {currentUsers.length} de {filteredUsers.length} usuarios
        </div>
      </div>

      {/* Tabla de Usuarios */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: `4px solid ${colors.border}`,
              borderTop: `4px solid ${colors.primary}`,
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto 16px'
            }} />
            <p style={{ color: colors.textSecondary }}>Cargando usuarios...</p>
          </div>
        ) : currentUsers.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Users size={48} color={colors.border} style={{ marginBottom: '16px' }} />
            <p style={{ color: colors.textSecondary }}>No se encontraron usuarios</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: colors.background, borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    USUARIO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    EMAIL
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ROL
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ESTADO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    REGISTRO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody>
                {currentUsers.map((usr, index) => (
                  <motion.tr
                    key={usr.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      backgroundColor: usr.disabled ? colors.error + '08' : 'transparent'
                    }}
                  >
                    {/* Usuario */}
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          backgroundColor: getRoleColor(usr.role) + '20',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontWeight: '600',
                          color: getRoleColor(usr.role),
                          fontSize: '16px'
                        }}>
                          {usr.name?.charAt(0)?.toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div style={{ color: colors.text, fontWeight: '600', fontSize: '14px' }}>
                            {usr.name || 'Sin nombre'}
                          </div>
                          {usr.id === user.id && (
                            <div style={{ 
                              fontSize: '11px', 
                              color: colors.primary,
                              backgroundColor: colors.primary + '15',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              display: 'inline-block',
                              marginTop: '2px',
                              fontWeight: '600'
                            }}>
                              Tú
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Email */}
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Mail size={14} color={colors.textSecondary} />
                        <span style={{ color: colors.text, fontSize: '14px' }}>
                          {usr.email || 'N/A'}
                        </span>
                      </div>
                    </td>

                    {/* Rol */}
                    <td style={{ padding: '16px' }}>
                      <div style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '6px 12px',
                        backgroundColor: getRoleColor(usr.role) + '15',
                        borderRadius: '6px',
                        border: `1px solid ${getRoleColor(usr.role)}30`
                      }}>
                        <Shield size={14} color={getRoleColor(usr.role)} />
                        <span style={{ 
                          color: getRoleColor(usr.role), 
                          fontSize: '13px',
                          fontWeight: '600'
                        }}>
                          {getRoleLabel(usr.role)}
                        </span>
                      </div>
                    </td>

                    {/* Estado */}
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      {usr.disabled ? (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          backgroundColor: colors.error + '15',
                          borderRadius: '6px'
                        }}>
                          <Lock size={14} color={colors.error} />
                          <span style={{ color: colors.error, fontSize: '13px', fontWeight: '600' }}>
                            Inactivo
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '6px 12px',
                          backgroundColor: colors.success + '15',
                          borderRadius: '6px'
                        }}>
                          <Unlock size={14} color={colors.success} />
                          <span style={{ color: colors.success, fontSize: '13px', fontWeight: '600' }}>
                            Activo
                          </span>
                        </div>
                      )}
                    </td>

                    {/* Fecha de registro */}
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} color={colors.textSecondary} />
                        <span style={{ color: colors.textSecondary, fontSize: '13px' }}>
                          {formatDate(usr.created_at)}
                        </span>
                      </div>
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '16px' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => setEditingUser(usr)}
                          style={{
                            padding: '8px 12px',
                            backgroundColor: colors.primary,
                            color: 'white',
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '12px',
                            fontWeight: '500',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                            transition: 'all 0.2s'
                          }}
                          title="Editar usuario"
                        >
                          <Edit2 size={14} />
                          Editar
                        </button>

                        {usr.id !== user.id && (
                          <>
                            <button
                              onClick={() => handleToggleUserStatus(usr.id, usr.disabled)}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: usr.disabled ? colors.success : colors.warning,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                              title={usr.disabled ? 'Activar' : 'Desactivar'}
                            >
                              {usr.disabled ? <Unlock size={14} /> : <Lock size={14} />}
                            </button>

                            <button
                              onClick={() => handleDeleteUser(usr.id)}
                              style={{
                                padding: '8px 12px',
                                backgroundColor: colors.error,
                                color: 'white',
                                border: 'none',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                fontSize: '12px',
                                fontWeight: '500',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px',
                                transition: 'all 0.2s'
                              }}
                              title="Eliminar usuario"
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          marginTop: '24px'
        }}>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              backgroundColor: colors.surface,
              color: currentPage === 1 ? colors.textSecondary : colors.text,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: currentPage === 1 ? 0.5 : 1
            }}
          >
            <ChevronLeft size={16} />
            Anterior
          </button>

          <div style={{ 
            fontSize: '14px', 
            color: colors.text,
            fontWeight: '500'
          }}>
            Página {currentPage} de {totalPages}
          </div>

          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '6px',
              backgroundColor: colors.surface,
              color: currentPage === totalPages ? colors.textSecondary : colors.text,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              opacity: currentPage === totalPages ? 0.5 : 1
            }}
          >
            Siguiente
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* Modal de Edición */}
      <AnimatePresence>
        {editingUser && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10000,
              padding: '20px'
            }}
            onClick={() => {
              setEditingUser(null);
              setShowPasswordReset(false);
              setNewPassword('');
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                backgroundColor: colors.background,
                borderRadius: '16px',
                maxWidth: '600px',
                width: '100%',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
              }}
            >
              {/* Header del Modal */}
              <div style={{
                padding: '24px',
                borderBottom: `1px solid ${colors.border}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '50%',
                    backgroundColor: getRoleColor(editingUser.role) + '20',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: '700',
                    color: getRoleColor(editingUser.role),
                    fontSize: '20px'
                  }}>
                    {editingUser.name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: '700', color: colors.text, margin: 0 }}>
                      Editar Usuario
                    </h2>
                    <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '2px 0 0 0' }}>
                      Gestión completa de cuenta
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setShowPasswordReset(false);
                    setNewPassword('');
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    padding: '8px',
                    borderRadius: '6px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              {/* Contenido del Modal */}
              <div style={{ padding: '24px' }}>
                <div style={{ display: 'grid', gap: '20px' }}>
                  {/* Información Básica */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: colors.surface,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h3 style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: colors.text, 
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <User size={18} color={colors.primary} />
                      Información Básica
                    </h3>
                    
                    <div style={{ display: 'grid', gap: '16px' }}>
                      <div>
                        <label style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: colors.text, 
                          marginBottom: '6px',
                          display: 'block'
                        }}>
                          Nombre completo
                        </label>
                        <input
                          type="text"
                          value={editingUser.name || ''}
                          onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: colors.text,
                            backgroundColor: colors.background,
                            outline: 'none'
                          }}
                          placeholder="Nombre del usuario"
                        />
                      </div>

                      <div>
                        <label style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: colors.text, 
                          marginBottom: '6px',
                          display: 'block'
                        }}>
                          Email
                        </label>
                        <input
                          type="email"
                          value={editingUser.email || ''}
                          onChange={(e) => setEditingUser({...editingUser, email: e.target.value})}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: colors.text,
                            backgroundColor: colors.background,
                            outline: 'none'
                          }}
                          placeholder="email@ejemplo.com"
                        />
                        <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', margin: '4px 0 0 0' }}>
                          ⚠️ Cambiar el email requiere que el usuario verifique el nuevo correo
                        </p>
                      </div>

                      <div>
                        <label style={{ 
                          fontSize: '13px', 
                          fontWeight: '600', 
                          color: colors.text, 
                          marginBottom: '6px',
                          display: 'block'
                        }}>
                          Rol del sistema
                        </label>
                        <select
                          value={editingUser.role || 'user'}
                          onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                          disabled={editingUser.id === user.id}
                          style={{
                            width: '100%',
                            padding: '12px',
                            border: `2px solid ${getRoleColor(editingUser.role)}`,
                            borderRadius: '8px',
                            fontSize: '14px',
                            color: colors.text,
                            backgroundColor: colors.background,
                            outline: 'none',
                            fontWeight: '600',
                            cursor: editingUser.id === user.id ? 'not-allowed' : 'pointer',
                            opacity: editingUser.id === user.id ? 0.6 : 1
                          }}
                        >
                          <option value="user">Usuario - Acceso básico</option>
                          <option value="manager">Jefe - Visualización avanzada</option>
                          <option value="management">Gestión - Control completo</option>
                          <option value="admin">Administrador - Todos los permisos</option>
                        </select>
                        {editingUser.id === user.id && (
                          <p style={{ fontSize: '11px', color: colors.warning, marginTop: '4px', margin: '4px 0 0 0' }}>
                            ⚠️ No puedes cambiar tu propio rol
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Seguridad */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: colors.surface,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h3 style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: colors.text, 
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Key size={18} color={colors.warning} />
                      Seguridad
                    </h3>

                    {!showPasswordReset ? (
                      <button
                        onClick={() => setShowPasswordReset(true)}
                        style={{
                          width: '100%',
                          padding: '12px',
                          backgroundColor: colors.warning + '15',
                          color: colors.warning,
                          border: `1px solid ${colors.warning}`,
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '14px',
                          fontWeight: '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          transition: 'all 0.2s'
                        }}
                      >
                        <Key size={16} />
                        Cambiar Contraseña
                      </button>
                    ) : (
                      <div style={{ display: 'grid', gap: '12px' }}>
                        <div>
                          <label style={{ 
                            fontSize: '13px', 
                            fontWeight: '600', 
                            color: colors.text, 
                            marginBottom: '6px',
                            display: 'block'
                          }}>
                            Nueva contraseña
                          </label>
                          <div style={{ position: 'relative' }}>
                            <input
                              type={showPassword ? 'text' : 'password'}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '12px',
                                paddingRight: '40px',
                                border: `1px solid ${colors.border}`,
                                borderRadius: '8px',
                                fontSize: '14px',
                                color: colors.text,
                                backgroundColor: colors.background,
                                outline: 'none'
                              }}
                              placeholder="Mínimo 6 caracteres"
                            />
                            <button
                              onClick={() => setShowPassword(!showPassword)}
                              style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                color: colors.textSecondary
                              }}
                            >
                              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                          </div>
                          <p style={{ fontSize: '11px', color: colors.textSecondary, marginTop: '4px', margin: '4px 0 0 0' }}>
                            La nueva contraseña será aplicada inmediatamente
                          </p>
                        </div>

                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => handleResetPassword(editingUser.id, newPassword)}
                            disabled={!newPassword || newPassword.length < 6}
                            style={{
                              flex: 1,
                              padding: '10px',
                              backgroundColor: colors.success,
                              color: 'white',
                              border: 'none',
                              borderRadius: '6px',
                              cursor: (!newPassword || newPassword.length < 6) ? 'not-allowed' : 'pointer',
                              fontSize: '13px',
                              fontWeight: '600',
                              opacity: (!newPassword || newPassword.length < 6) ? 0.5 : 1
                            }}
                          >
                            Guardar Nueva Contraseña
                          </button>
                          <button
                            onClick={() => {
                              setShowPasswordReset(false);
                              setNewPassword('');
                            }}
                            style={{
                              padding: '10px 16px',
                              backgroundColor: 'transparent',
                              color: colors.textSecondary,
                              border: `1px solid ${colors.border}`,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              fontSize: '13px',
                              fontWeight: '600'
                            }}
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Información del Sistema */}
                  <div style={{
                    padding: '16px',
                    backgroundColor: colors.surface,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <h3 style={{ 
                      fontSize: '15px', 
                      fontWeight: '600', 
                      color: colors.text, 
                      marginBottom: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}>
                      <Activity size={18} color={colors.info} />
                      Información del Sistema
                    </h3>

                    <div style={{ display: 'grid', gap: '12px' }}>
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        backgroundColor: colors.background,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                          ID de Usuario
                        </span>
                        <span style={{ 
                          fontSize: '12px', 
                          color: colors.text, 
                          fontFamily: 'monospace',
                          backgroundColor: colors.surface,
                          padding: '4px 8px',
                          borderRadius: '4px'
                        }}>
                          {editingUser.id?.substring(0, 8)}...
                        </span>
                      </div>

                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        backgroundColor: colors.background,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                          Fecha de Registro
                        </span>
                        <span style={{ fontSize: '13px', color: colors.text, fontWeight: '500' }}>
                          {formatDate(editingUser.created_at)}
                        </span>
                      </div>

                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        backgroundColor: colors.background,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                          Última Actualización
                        </span>
                        <span style={{ fontSize: '13px', color: colors.text, fontWeight: '500' }}>
                          {formatDate(editingUser.updated_at)}
                        </span>
                      </div>

                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between',
                        padding: '10px',
                        backgroundColor: colors.background,
                        borderRadius: '6px'
                      }}>
                        <span style={{ fontSize: '13px', color: colors.textSecondary }}>
                          Onboarding Completado
                        </span>
                        <span style={{ 
                          fontSize: '13px', 
                          color: editingUser.onboarding_completed ? colors.success : colors.warning,
                          fontWeight: '600'
                        }}>
                          {editingUser.onboarding_completed ? 'Sí' : 'No'}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer del Modal */}
              <div style={{
                padding: '20px 24px',
                borderTop: `1px solid ${colors.border}`,
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <button
                  onClick={() => {
                    setEditingUser(null);
                    setShowPasswordReset(false);
                    setNewPassword('');
                  }}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'transparent',
                    color: colors.textSecondary,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600'
                  }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => handleUpdateUser(editingUser.id, {
                    name: editingUser.name,
                    email: editingUser.email,
                    role: editingUser.role
                  })}
                  style={{
                    padding: '10px 24px',
                    backgroundColor: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Save size={16} />
                  Guardar Cambios
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CSS para animación de carga */}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
        </>
      )}
    </div>
  );
};

export default AdminPanel;
