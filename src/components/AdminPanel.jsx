import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import Sensitive from './Sensitive';
import { useNavigation } from './NavigationContext';
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
  TrendingUp,
  ExternalLink,
  Link2
} from 'feather-icons-react';
import { supabase, authService } from '../config/supabase';
import FichajeAdminSection from './FichajeAdminSection';
import FichajeCodigosAdmin from './FichajeCodigosAdmin';
import FichajeDescansosAdmin from './FichajeDescansosAdmin';
import FichajeFestivosAdmin from './FichajeFestivosAdmin';
import FichajeVinculosAdmin from './FichajeVinculosAdmin';
import AuditLog from './AuditLog';

/** Secciones del Panel de Administrador (landing + grupos). */
const ADMIN_SECTIONS = [
  {
    id: 'acceso',
    title: 'Acceso',
    description: 'Cuentas Kronos, roles y registro de actividad',
    items: [
      { key: 'usuarios', label: 'Usuarios', icon: Users },
      { key: 'auditoria', label: 'Auditoría', icon: Activity },
      { key: 'vinculos-fichaje', label: 'Vínculos fichaje', icon: Link2 }
    ]
  },
  {
    id: 'config-fichaje',
    title: 'Configuración de fichaje',
    description: 'Códigos, descansos y festivos',
    items: [
      { key: 'codigos-fichaje', label: 'Códigos', icon: Key },
      { key: 'descansos-fichaje', label: 'Reglas de descanso', icon: Clock },
      { key: 'festivos-fichaje', label: 'Festivos', icon: Calendar }
    ]
  },
  {
    id: 'inspeccion',
    title: 'Inspección de fichajes',
    description: 'Registros, anulación y export para inspección',
    items: [{ key: 'fichajes', label: 'Registros e inspección', icon: Clock }]
  }
];

const AdminPanel = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { navigateTo } = useNavigation();

  // Estados principales — landing por defecto
  const [activeTab, setActiveTab] = useState('home');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [creatingUser, setCreatingUser] = useState(false);
  const [newUserForm, setNewUserForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'user'
  });

  useEffect(() => {
    try {
      const tab = sessionStorage.getItem('kronos_admin_tab');
      if (tab) {
        setActiveTab(tab);
        sessionStorage.removeItem('kronos_admin_tab');
      }
    } catch (_) {
      /* ignore */
    }
  }, []);

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
  const [health, setHealth] = useState({
    loading: true,
    activeUsers: 0,
    pendingVinculos: 0
  });

  const ROLES_SIN_VINCULO = new Set([
    'admin', 'management', 'manager', 'jefe', 'administrador',
    'gestion', 'gestión', 'inspeccion', 'inspector'
  ]);

  const refreshHealth = async (userData) => {
    const list = userData || users;
    try {
      const { data: vinculos, error: vErr } = await supabase
        .from('fichajes_empleado_usuarios')
        .select('user_id')
        .eq('activo', true);
      if (vErr) throw vErr;
      const linked = new Set((vinculos || []).map((v) => v.user_id));
      const activeUsers = list.filter((u) => !u.disabled).length;
      const pendingVinculos = list.filter((u) => {
        if (u.disabled) return false;
        const role = String(u.role || '').toLowerCase();
        if (ROLES_SIN_VINCULO.has(role)) return false;
        return !linked.has(u.id);
      }).length;
      setHealth({ loading: false, activeUsers, pendingVinculos });
    } catch (_) {
      setHealth({
        loading: false,
        activeUsers: list.filter((u) => !u.disabled).length,
        pendingVinculos: 0
      });
    }
  };

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
      await refreshHealth(data || []);
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
      if (userId === user.id && updates.role) {
        const currentRole = users.find((u) => u.id === userId)?.role;
        if (currentRole && updates.role !== currentRole) {
          setError('No puedes cambiar tu propio rol');
          return;
        }
      }

      const { error: profileError } = await supabase
        .from('user_profiles')
        .update(updates)
        .eq('id', userId);

      if (profileError) throw profileError;

      // El rol efectivo vive en user_profiles (Layout/Auth lo priorizan).
      // No usamos auth.admin.updateUserById: requiere service_role y falla con anon key.

      setSuccess('Usuario actualizado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      setEditingUser(null);
      await loadUsers();
    } catch (e) {
      setError(`Error al actualizar usuario: ${e.message}`);
    }
  };

  // Resetear contraseña: envía email de recuperación (funciona con anon key)
  const handleSendPasswordReset = async (email) => {
    if (!isAdmin || !email) {
      setError('Email no disponible');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
        redirectTo: undefined
      });
      if (error) throw error;
      setSuccess(`Email de restablecimiento enviado a ${email}`);
      setTimeout(() => setSuccess(''), 5000);
      setShowPasswordReset(false);
    } catch (e) {
      setError(`No se pudo enviar el email: ${e.message}`);
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

  // Eliminar usuario (usa RPC que borra audit_logs, notifications, user_profiles y auth.users en orden; auth.admin requiere service_role y daría 403)
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
      const { error } = await supabase.rpc('complete_delete_user_cascade', { target_user_id: userId });
      if (error) throw error;

      setSuccess('Usuario eliminado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      await loadUsers();
    } catch (e) {
      setError(`Error al eliminar usuario: ${e.message}`);
    }
  };

  const handleCreateUser = async (e) => {
    e?.preventDefault();
    if (!isAdmin) return;
    const email = newUserForm.email.trim().toLowerCase();
    const name = newUserForm.name.trim();
    const password = newUserForm.password;
    const role = newUserForm.role || 'user';
    if (!email || !password || password.length < 8) {
      setError('Email y contraseña (mín. 8 caracteres) son obligatorios');
      return;
    }
    setCreatingUser(true);
    setError('');
    try {
      const { data, error: signErr } = await authService.adminCreateUser(email, password, {
        name: name || email.split('@')[0],
        role
      });
      if (signErr) throw signErr;
      const newId = data?.user?.id;
      if (newId) {
        await supabase
          .from('user_profiles')
          .upsert(
            {
              id: newId,
              email,
              name: name || email.split('@')[0],
              role,
              disabled: false
            },
            { onConflict: 'id' }
          );
      }
      setSuccess('Usuario creado. Ya puede iniciar sesión.');
      setTimeout(() => setSuccess(''), 4000);
      setShowCreateUser(false);
      setNewUserForm({ name: '', email: '', password: '', role: 'user' });
      await loadUsers();
    } catch (err) {
      setError(`Error al crear usuario: ${err.message}`);
    } finally {
      setCreatingUser(false);
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
    switch (role) {
      case 'admin': return colors.error;      // Rojo para Administrador
      case 'management': return colors.warning; // Naranja para Gestión
      case 'manager': return '#3b82f6';        // Azul distintivo para Jefe
      case 'tienda': return '#10b981';         // Verde para Tienda
      default: return colors.primary;
    }
  };

  // Función auxiliar para obtener etiqueta de rol
  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'management': return 'Gestión';
      case 'manager': return 'Jefe';
      case 'tienda': return 'Tienda';
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
      <div style={{ marginBottom: activeTab === 'home' ? '28px' : '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
          <Shield size={32} color={colors.primary} />
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: colors.text,
            margin: 0
          }}>
            Panel de Administrador
          </h1>
          {activeTab !== 'home' && (
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              style={{
                marginLeft: 'auto',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 14px',
                background: 'transparent',
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                color: colors.text,
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              <ChevronLeft size={16} />
              Inicio del panel
            </button>
          )}
        </div>
        <p style={{
          fontSize: '15px',
          color: colors.textSecondary,
          margin: 0
        }}>
          {activeTab === 'home'
            ? 'Elige una sección. El día a día de fichaje está en Panel Fichajes (RRHH).'
            : 'Usuarios, permisos, fichajes y configuración administrativa del sistema'}
        </p>
      </div>

      {/* Nav secundaria (cuando no estás en la landing) */}
      {activeTab !== 'home' && (
        <div style={{
          display: 'flex',
          gap: 6,
          marginBottom: 20,
          flexWrap: 'wrap',
          paddingBottom: 12,
          borderBottom: `1px solid ${colors.border}`
        }}>
          {ADMIN_SECTIONS.flatMap((sec) =>
            sec.items.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setActiveTab(item.key)}
                  style={{
                    padding: '8px 14px',
                    backgroundColor: active ? colors.primary + '18' : 'transparent',
                    border: `1px solid ${active ? colors.primary : colors.border}`,
                    borderRadius: 8,
                    color: active ? colors.primary : colors.textSecondary,
                    fontSize: 13,
                    fontWeight: active ? 600 : 500,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6
                  }}
                >
                  <Icon size={15} />
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      )}

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

      {/* Contenido según sección activa */}
      {activeTab === 'home' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: colors.textSecondary,
              padding: '12px 16px',
              backgroundColor: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 10,
              lineHeight: 1.45
            }}
          >
            {health.loading ? (
              'Cargando estado…'
            ) : (
              <>
                <span style={{ color: colors.text, fontWeight: 600 }}>
                  {health.activeUsers} usuario{health.activeUsers === 1 ? '' : 's'} activo{health.activeUsers === 1 ? '' : 's'}
                </span>
                {' · '}
                {health.pendingVinculos === 0 ? (
                  <span style={{ color: colors.success || colors.text }}>
                    todos los operativos tienen vínculo de fichaje
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveTab('vinculos-fichaje')}
                    style={{
                      background: 'none',
                      border: 'none',
                      padding: 0,
                      color: colors.warning || colors.primary,
                      fontWeight: 600,
                      fontSize: 14,
                      cursor: 'pointer',
                      textDecoration: 'underline'
                    }}
                  >
                    {health.pendingVinculos} vínculo{health.pendingVinculos === 1 ? '' : 's'} pendiente{health.pendingVinculos === 1 ? '' : 's'}
                  </button>
                )}
              </>
            )}
          </p>

          {ADMIN_SECTIONS.map((sec) => (
            <section key={sec.id}>
              <h2 style={{
                fontSize: 16,
                fontWeight: 700,
                color: colors.text,
                margin: '0 0 4px 0'
              }}>
                {sec.title}
              </h2>
              <p style={{
                fontSize: 13,
                color: colors.textSecondary,
                margin: '0 0 12px 0'
              }}>
                {sec.description}
              </p>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                gap: 12
              }}>
                {sec.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setActiveTab(item.key)}
                      style={{
                        textAlign: 'left',
                        padding: '18px 16px',
                        backgroundColor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: 12,
                        cursor: 'pointer',
                        color: colors.text,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10
                      }}
                    >
                      <Icon size={22} color={colors.primary} />
                      <span style={{ fontSize: 15, fontWeight: 600 }}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>
          ))}

          <section>
            <h2 style={{
              fontSize: 16,
              fontWeight: 700,
              color: colors.text,
              margin: '0 0 4px 0'
            }}>
              Enlaces rápidos
            </h2>
            <p style={{
              fontSize: 13,
              color: colors.textSecondary,
              margin: '0 0 12px 0'
            }}>
              Otras pantallas de administración fuera de este panel
            </p>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
              gap: 12
            }}>
              <button
                type="button"
                onClick={() => navigateTo('panel-fichajes')}
                style={{
                  textAlign: 'left',
                  padding: '18px 16px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  color: colors.text,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <Activity size={22} color={colors.primary} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Panel Fichajes (RRHH)</span>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>
                  Operativa diaria por empleado
                </span>
              </button>
              <button
                type="button"
                onClick={() => navigateTo('settings')}
                style={{
                  textAlign: 'left',
                  padding: '18px 16px',
                  backgroundColor: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 12,
                  cursor: 'pointer',
                  color: colors.text,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10
                }}
              >
                <ExternalLink size={22} color={colors.primary} />
                <span style={{ fontSize: 15, fontWeight: 600 }}>Configuración</span>
                <span style={{ fontSize: 12, color: colors.textSecondary }}>
                  Ajustes generales de Kronos
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : activeTab === 'fichajes' ? (
        <FichajeAdminSection />
      ) : activeTab === 'codigos-fichaje' ? (
        <FichajeCodigosAdmin />
      ) : activeTab === 'descansos-fichaje' ? (
        <FichajeDescansosAdmin />
      ) : activeTab === 'festivos-fichaje' ? (
        <FichajeFestivosAdmin />
      ) : activeTab === 'auditoria' ? (
        <AuditLog embedded />
      ) : activeTab === 'vinculos-fichaje' ? (
        <FichajeVinculosAdmin />
      ) : activeTab === 'usuarios' ? (
        <>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
            flexWrap: 'wrap',
            gap: 12
          }}>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, color: colors.text, margin: 0 }}>
                Usuarios Kronos
              </h2>
              <p style={{ fontSize: 13, color: colors.textSecondary, margin: '4px 0 0 0' }}>
                Crea cuentas, asigna roles y activa o desactiva el acceso
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateUser(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 16px',
                backgroundColor: colors.primary,
                color: '#fff',
                border: 'none',
                borderRadius: 8,
                fontWeight: 600,
                fontSize: 14,
                cursor: 'pointer'
              }}
            >
              <UserPlus size={18} />
              Crear usuario
            </button>
          </div>

          {/* Resumen compacto */}
          <p style={{
            margin: '0 0 16px 0',
            fontSize: 13,
            color: colors.textSecondary
          }}>
            {stats.active} activos · {stats.inactive} inactivos · {stats.admins} admin · {stats.managers} gestión/manager
          </p>

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
                  <option value="tienda">Tienda</option>
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
                                <Sensitive value={usr.name || 'Sin nombre'} type="name" />
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
                              <Sensitive value={usr.email || 'N/A'} type="email" />
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
            {showCreateUser && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: 1000,
                  padding: 20
                }}
                onClick={() => !creatingUser && setShowCreateUser(false)}
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.95, opacity: 0 }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    background: colors.surface,
                    borderRadius: 16,
                    width: '100%',
                    maxWidth: 440,
                    padding: 24,
                    border: `1px solid ${colors.border}`
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 18, color: colors.text }}>Crear usuario</h3>
                    <button
                      type="button"
                      onClick={() => setShowCreateUser(false)}
                      disabled={creatingUser}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: colors.textSecondary }}
                    >
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Nombre</label>
                      <input
                        value={newUserForm.name}
                        onChange={(e) => setNewUserForm({ ...newUserForm, name: e.target.value })}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          background: colors.background,
                          color: colors.text,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Email *</label>
                      <input
                        type="email"
                        required
                        value={newUserForm.email}
                        onChange={(e) => setNewUserForm({ ...newUserForm, email: e.target.value })}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          background: colors.background,
                          color: colors.text,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Contraseña temporal *</label>
                      <input
                        type="password"
                        required
                        minLength={8}
                        value={newUserForm.password}
                        onChange={(e) => setNewUserForm({ ...newUserForm, password: e.target.value })}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          background: colors.background,
                          color: colors.text,
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: 13, marginBottom: 6, color: colors.text }}>Rol</label>
                      <select
                        value={newUserForm.role}
                        onChange={(e) => setNewUserForm({ ...newUserForm, role: e.target.value })}
                        style={{
                          width: '100%',
                          padding: 10,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                          background: colors.background,
                          color: colors.text
                        }}
                      >
                        <option value="user">Usuario</option>
                        <option value="tienda">Tienda</option>
                        <option value="manager">Manager</option>
                        <option value="management">Gestión</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                    <p style={{ margin: 0, fontSize: 12, color: colors.textSecondary }}>
                      Tu sesión de admin no se cierra. Entrega la contraseña temporal al usuario.
                    </p>
                    <button
                      type="submit"
                      disabled={creatingUser}
                      style={{
                        marginTop: 8,
                        padding: '12px 16px',
                        borderRadius: 8,
                        border: 'none',
                        background: colors.primary,
                        color: '#fff',
                        fontWeight: 600,
                        cursor: creatingUser ? 'wait' : 'pointer'
                      }}
                    >
                      {creatingUser ? 'Creando…' : 'Crear cuenta'}
                    </button>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

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
                              onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
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
                              onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
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
                              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value })}
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
                              <option value="tienda">Tienda - Gestión de tienda</option>
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
                            type="button"
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
                              gap: '8px'
                            }}
                          >
                            <Key size={16} />
                            Restablecer contraseña
                          </button>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            <p style={{ margin: 0, fontSize: 13, color: colors.textSecondary }}>
                              Se enviará un email a <strong>{editingUser.email}</strong> con el enlace para
                              elegir una nueva contraseña.
                            </p>
                            <div style={{ display: 'flex', gap: 8 }}>
                              <button
                                type="button"
                                onClick={() => handleSendPasswordReset(editingUser.email)}
                                style={{
                                  flex: 1,
                                  padding: '10px 12px',
                                  background: colors.primary,
                                  color: '#fff',
                                  border: 'none',
                                  borderRadius: 8,
                                  fontWeight: 600,
                                  cursor: 'pointer'
                                }}
                              >
                                Enviar email
                              </button>
                              <button
                                type="button"
                                onClick={() => setShowPasswordReset(false)}
                                style={{
                                  padding: '10px 12px',
                                  background: 'transparent',
                                  border: `1px solid ${colors.border}`,
                                  borderRadius: 8,
                                  color: colors.text,
                                  cursor: 'pointer'
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
      ) : null}
    </div>
  );
};

export default AdminPanel;
