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
  ChevronRight
} from 'feather-icons-react';
import { supabase } from '../config/supabase';

const UserManagement = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Log cuando cambia el estado de loading
  useEffect(() => {
    console.log('🔍 [DEBUG] Estado de loading cambiado a:', loading);
  }, [loading]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('all');
  
  // Estados para verificación de admin
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminVerified, setIsAdminVerified] = useState(false);
  
  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [usersPerPage] = useState(5);

  // Verificar si el usuario actual es administrador
  const verifyAdminStatus = async () => {
    console.log('🔍 [DEBUG] Iniciando verificación de admin status...');
    console.log('🔍 [DEBUG] User ID:', user?.id);
    
    if (!user?.id) {
      console.log('❌ [DEBUG] No hay user ID, retornando false');
      return false;
    }
    
    try {
      console.log('🔍 [DEBUG] Haciendo consulta a user_profiles...');
      const startTime = performance.now();
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      const endTime = performance.now();
      console.log(`⏱️ [DEBUG] Consulta user_profiles completada en ${(endTime - startTime).toFixed(2)}ms`);

      if (error) {
        console.error('❌ [DEBUG] Error verifying admin status:', error);
        return false;
      }

      console.log('🔍 [DEBUG] Datos obtenidos:', data);
      console.log('🔍 [DEBUG] User metadata role:', user?.user_metadata?.role);
      
      const isAdminUser = data?.role === 'admin' || user?.user_metadata?.role === 'admin';
      console.log(`✅ [DEBUG] Es admin: ${isAdminUser}`);
      
      return isAdminUser;
    } catch (e) {
      console.error('❌ [DEBUG] Error verifying admin status:', e);
      return false;
    }
  };

  // Función para cargar usuarios
  const loadUsers = async (forceAdminCheck = null) => {
    console.log('🔍 [DEBUG] Iniciando carga de usuarios...');
    console.log('🔍 [DEBUG] isAdmin:', isAdmin);
    console.log('🔍 [DEBUG] forceAdminCheck:', forceAdminCheck);
    
    // Usar forceAdminCheck si se proporciona, sino usar isAdmin
    const shouldLoad = forceAdminCheck !== null ? forceAdminCheck : isAdmin;
    
    if (!shouldLoad) {
      console.log('❌ [DEBUG] No es admin, no cargando usuarios');
      return;
    }
    
    try {
      console.log('🔍 [DEBUG] Haciendo consulta para cargar todos los usuarios...');
      const startTime = performance.now();
      
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      const endTime = performance.now();
      console.log(`⏱️ [DEBUG] Consulta de usuarios completada en ${(endTime - startTime).toFixed(2)}ms`);

      if (error) {
        console.error('❌ [DEBUG] Error al cargar usuarios:', error);
        setError('Error al cargar usuarios');
        return;
      }

      console.log(`✅ [DEBUG] Usuarios cargados exitosamente: ${data?.length || 0} usuarios`);
      console.log('🔍 [DEBUG] Primeros 3 usuarios:', data?.slice(0, 3));
      
      setUsers(data || []);
      setLoading(false);
      console.log('✅ [DEBUG] Estado de loading establecido en false');
    } catch (e) {
      console.error('❌ [DEBUG] Error inesperado al cargar usuarios:', e);
      setError('Error inesperado al cargar usuarios');
    }
  };

  useEffect(() => {
    const checkAdminAndLoadUsers = async () => {
      console.log('🔍 [DEBUG] useEffect ejecutándose...');
      console.log('🔍 [DEBUG] User ID en useEffect:', user?.id);
      
      if (!user?.id) {
        console.log('❌ [DEBUG] No hay user ID en useEffect, saliendo');
        return;
      }

      console.log('🔍 [DEBUG] Iniciando verificación de admin...');
      const startTime = performance.now();
      
      const adminStatus = await verifyAdminStatus();
      
      const endTime = performance.now();
      console.log(`⏱️ [DEBUG] Verificación de admin completada en ${(endTime - startTime).toFixed(2)}ms`);
      
      console.log('🔍 [DEBUG] Admin status:', adminStatus);
      setIsAdmin(adminStatus);
      setIsAdminVerified(true);

      if (adminStatus) {
        console.log('🔍 [DEBUG] Es admin, cargando usuarios...');
        setLoading(true);
        console.log('🔍 [DEBUG] Estado de loading establecido en true');
        await loadUsers(adminStatus); // Pasar el adminStatus directamente
      } else {
        console.log('❌ [DEBUG] No es admin, no cargando usuarios');
        setLoading(false);
      }
    };

    checkAdminAndLoadUsers();
  }, [user?.id]);



  // Actualizar usuario
  const handleUpdateUser = async (userId, updates) => {
    if (!isAdmin || !isAdminVerified) return;
    
    try {
      // Verificar que no se está editando a sí mismo para cambiar el rol
      if (userId === user.id && updates.role && updates.role !== user?.user_metadata?.role) {
        setError('No puedes cambiar tu propio rol desde la gestión de usuarios.');
        return;
      }

      // Buscar el email actual del usuario
      const userRow = users.find(u => u.id === userId);
      const email = userRow?.email || null;

      
      // 1. Actualizar user_profiles
      const { data, error } = await supabase
        .from('user_profiles')
        .update({ ...updates, email })
        .eq('id', userId)
        .select();

      if (error) {
        // Error updating user profile
        setError(`Error al actualizar usuario: ${error.message}`);
        return;
      }

      // 2. Si se está actualizando el rol, también actualizar los metadatos del usuario
      if (updates.role) {
        try {
          const { error: authError } = await supabase.auth.updateUser({
            data: { role: updates.role }
          });
          
          if (authError) {
            // Error updating user auth metadata
          } else {
            // User auth metadata updated successfully
          }
        } catch (e) {
          // Error updating auth metadata
        }
      }

      if (error) {
        // Error updating user
        setError(`Error al actualizar usuario: ${error.message}`);
      } else {
        // User updated successfully
        setEditingUser(null);
        setSuccess('Usuario actualizado correctamente');
        setTimeout(() => setSuccess(''), 3000);
        loadUsers(); // Recargar lista (usará isAdmin actual)
      }
    } catch (e) {
      // Unexpected error
      setError('Error inesperado al actualizar usuario');
    }
  };

  // Eliminar usuario
  const handleDeleteUser = async (userId) => {
    if (!isAdmin || !isAdminVerified) return;
    
    // Prevenir que el admin se elimine a sí mismo
    if (userId === user.id) {
      setError('No puedes eliminar tu propio usuario.');
      return;
    }
    
    if (!confirm('¿Estás seguro de que quieres eliminar este usuario? Esta acción también eliminará su cuenta de autenticación.')) {
      return;
    }

    try {
      console.log('🔍 [DEBUG] Iniciando eliminación de usuario:', userId);
      
      // 1. Primero obtener el email del usuario antes de eliminarlo
      const { data: userData, error: fetchError } = await supabase
        .from('user_profiles')
        .select('email')
        .eq('id', userId)
        .single();

      if (fetchError) {
        console.error('❌ [DEBUG] Error obteniendo datos del usuario:', fetchError);
        setError(`Error al obtener datos del usuario: ${fetchError.message}`);
        return;
      }

      const userEmail = userData?.email;
      console.log('🔍 [DEBUG] Email del usuario a eliminar:', userEmail);

      // 2. Eliminar de user_profiles
      console.log('🔍 [DEBUG] Eliminando de user_profiles...');
      const { error: deleteProfileError } = await supabase
        .from('user_profiles')
        .delete()
        .eq('id', userId);

      if (deleteProfileError) {
        console.error('❌ [DEBUG] Error eliminando de user_profiles:', deleteProfileError);
        setError(`Error al eliminar usuario: ${deleteProfileError.message}`);
        return;
      }

      console.log('✅ [DEBUG] Usuario eliminado de user_profiles');

      // 3. Usar la función de eliminación en cascada de la base de datos
      console.log('🔍 [DEBUG] Usando eliminación en cascada...');
      try {
        const { data: cascadeResult, error: cascadeError } = await supabase
          .rpc('delete_user_cascade', { user_id: userId });
        
        if (cascadeError) {
          console.warn('⚠️ [DEBUG] Error en eliminación en cascada:', cascadeError);
          console.warn('⚠️ [DEBUG] Intentando eliminación manual...');
          
          // Fallback: intentar eliminación manual
          try {
            const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
            if (authDeleteError) {
              console.warn('⚠️ [DEBUG] No se pudo eliminar de auth.users:', authDeleteError);
            } else {
              console.log('✅ [DEBUG] Usuario eliminado de auth.users (manual)');
            }
          } catch (authError) {
            console.warn('⚠️ [DEBUG] Error eliminando de auth.users:', authError);
          }
        } else {
          console.log('✅ [DEBUG] Eliminación en cascada completada exitosamente');
        }
      } catch (cascadeError) {
        console.warn('⚠️ [DEBUG] Error en función de cascada:', cascadeError);
        console.warn('⚠️ [DEBUG] El usuario puede permanecer en auth.users');
      }

      setSuccess('Usuario eliminado correctamente');
      setTimeout(() => setSuccess(''), 3000);
      loadUsers(); // Recargar lista
      
    } catch (e) {
      console.error('❌ [DEBUG] Error inesperado al eliminar usuario:', e);
      setError('Error inesperado al eliminar usuario');
    }
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

  // Función para obtener el color del rol
  const getRoleColor = (role) => {
    switch (role) {
      case 'admin': return colors.error;
      case 'management': return '#8B5CF6';
      case 'manager': return colors.warning;
      case 'user': return colors.primary;
      default: return colors.primary;
    }
  };

  // Filtrado y paginación
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = filterRole === 'all' || user.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const endIndex = startIndex + usersPerPage;
  const currentUsers = filteredUsers.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
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

  // Resetear página cuando cambien los filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterRole]);

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
        Gestión de Usuarios
      </h1>

      {/* Mensajes de éxito/error */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              maxWidth: 1200,
              margin: '0 0 16px 0',
              padding: '12px 20px',
              background: colors.success + '11',
              border: `1px solid ${colors.success}33`,
              borderRadius: 8,
              color: colors.success,
              fontSize: 14,
              fontWeight: 500,
              userSelect: 'none',
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
              maxWidth: 1200,
              margin: '0 0 16px 0',
              padding: '12px 20px',
              background: colors.error + '11',
              border: `1px solid ${colors.error}33`,
              borderRadius: 8,
              color: colors.error,
              fontSize: 14,
              fontWeight: 500,
              userSelect: 'none',
            }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filtros y búsqueda */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        style={{
          maxWidth: 1200,
          margin: '0 0 24px 0',
          background: colors.surface,
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: `1px solid ${colors.border}`,
          padding: '24px 32px',
          display: 'flex',
          gap: 16,
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        {/* Búsqueda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 200 }}>
          <Search size={18} color={colors.textSecondary} />
          <input
            type="text"
            placeholder="Buscar usuarios..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              flex: 1,
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              color: colors.text,
              background: colors.background,
              outline: 'none',
            }}
          />
        </div>

        {/* Filtro por rol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={18} color={colors.textSecondary} />
          <select
            value={filterRole}
            onChange={e => setFilterRole(e.target.value)}
            style={{
              padding: '8px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              fontSize: 14,
              color: colors.text,
              background: colors.background,
              outline: 'none',
            }}
          >
            <option value="all">Todos los roles</option>
            <option value="admin">Administradores</option>
            <option value="management">Gestión</option>
            <option value="manager">Jefes</option>
            <option value="user">Usuarios</option>
          </select>
        </div>



        {/* Contador */}
        <div style={{
          color: colors.textSecondary,
          fontSize: 14,
          fontWeight: 500,
        }}>
          {filteredUsers.length} usuario{filteredUsers.length !== 1 ? 's' : ''}
        </div>
      </motion.div>

      {/* Lista de usuarios */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        style={{
          maxWidth: 1200,
          background: colors.surface,
          borderRadius: 16,
          boxShadow: '0 2px 12px rgba(0,0,0,0.06)',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden',
        }}
      >
        {loading ? (
          <div style={{
            padding: '60px 32px',
            textAlign: 'center',
            color: colors.textSecondary,
          }}>
            Cargando usuarios...
          </div>
        ) : error ? (
          <div style={{
            padding: '60px 32px',
            textAlign: 'center',
            color: colors.error,
          }}>
            {error}
          </div>
        ) : currentUsers.length === 0 ? (
          <div style={{
            padding: '60px 32px',
            textAlign: 'center',
            color: colors.textSecondary,
          }}>
            No se encontraron usuarios
          </div>
        ) : (
          <div style={{ overflow: 'auto' }}>
            {currentUsers.map((userItem, index) => {
              const isSelf = userItem.id === user.id;
              return (
                <motion.div
                  key={userItem.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  style={{
                    padding: '20px 32px',
                    borderBottom: `1px solid ${colors.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    background: isSelf ? colors.primary + '08' : undefined,
                    opacity: isSelf ? 1 : 1,
                  }}
                >
                  {/* Avatar */}
                  <div style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: isSelf ? colors.primary + '33' : colors.primary + '22',
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    userSelect: 'none',
                    flexShrink: 0,
                    border: isSelf ? `2px solid ${colors.primary}` : undefined,
                  }}>
                    {(userItem.name || userItem.email || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  {/* Información del usuario */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                      <span style={{
                        color: colors.text,
                        fontSize: 16,
                        fontWeight: 600,
                        userSelect: 'none',
                      }}>
                        {isSelf ? 'Tú mismo' : (userItem.name || 'Sin nombre')}
                      </span>
                      <span style={{
                        color: getRoleColor(userItem.role),
                        fontSize: 12,
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: 6,
                        background: getRoleColor(userItem.role) + '22',
                        border: `1px solid ${getRoleColor(userItem.role)}33`,
                        userSelect: 'none',
                      }}>
                        {getRoleName(userItem.role)}
                      </span>
                      {isSelf && (
                        <span style={{
                          color: colors.primary,
                          fontSize: 12,
                          fontWeight: 600,
                          marginLeft: 8,
                          userSelect: 'none',
                        }}>
                          (tú)
                        </span>
                      )}
                    </div>
                    <div style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      userSelect: 'none',
                    }}>
                      ID: {userItem.id}
                    </div>
                  </div>
                  {/* Fecha de creación */}
                  <div style={{
                    color: colors.textSecondary,
                    fontSize: 13,
                    userSelect: 'none',
                    textAlign: 'right',
                    minWidth: 120,
                  }}>
                    {userItem.created_at ? new Date(userItem.created_at).toLocaleDateString('es-ES') : '-'}
                  </div>
                  {/* Acciones */}
                  {!isSelf && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => setEditingUser(userItem)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: colors.primary,
                          cursor: 'pointer',
                          padding: 8,
                          borderRadius: 6,
                        }}
                        title="Editar usuario"
                      >
                        <Edit2 size={16} />
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleDeleteUser(userItem.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: colors.error,
                          cursor: 'pointer',
                          padding: 8,
                          borderRadius: 6,
                        }}
                        title="Eliminar usuario"
                      >
                        <Trash2 size={16} />
                      </motion.button>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Paginación */}
      {totalPages > 1 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.3 }}
          style={{
            maxWidth: 1200,
            margin: '24px 0 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
          }}
        >
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            style={{
              background: currentPage === 1 ? colors.border : colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              color: currentPage === 1 ? colors.textSecondary : colors.text,
              cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: currentPage === 1 ? 0.5 : 1,
            }}
          >
            <ChevronLeft size={16} />
            Anterior
          </motion.button>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
              <motion.button
                key={page}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => handlePageChange(page)}
                style={{
                  background: page === currentPage ? colors.primary : colors.surface,
                  border: `1px solid ${page === currentPage ? colors.primary : colors.border}`,
                  borderRadius: 6,
                  padding: '6px 10px',
                  color: page === currentPage ? 'white' : colors.text,
                  cursor: 'pointer',
                  fontSize: 14,
                  fontWeight: page === currentPage ? 600 : 500,
                  minWidth: 32,
                  userSelect: 'none',
                }}
              >
                {page}
              </motion.button>
            ))}
          </div>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            style={{
              background: currentPage === totalPages ? colors.border : colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              padding: '8px 12px',
              color: currentPage === totalPages ? colors.textSecondary : colors.text,
              cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              opacity: currentPage === totalPages ? 0.5 : 1,
            }}
          >
            Siguiente
            <ChevronRight size={16} />
          </motion.button>
        </motion.div>
      )}

      {/* Modal de edición */}
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
              background: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
              padding: '20px',
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: colors.surface,
                borderRadius: 18,
                padding: '38px 38px 32px 38px',
                maxWidth: 440,
                width: '100%',
                boxShadow: '0 20px 40px rgba(0,0,0,0.3)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Si es el propio usuario, solo mensaje informativo */}
              {editingUser.id === user.id ? (
                <>
                  <div style={{
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    background: colors.primary + '22',
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 38,
                    fontWeight: 700,
                    marginBottom: 18,
                    userSelect: 'none',
                    border: `2.5px solid ${colors.primary}33`,
                  }}>
                    {(user.name || user.email || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  <h3 style={{ color: colors.text, fontSize: 20, fontWeight: 700, margin: '0 0 12px 0' }}>
                    No puedes editarte aquí
                  </h3>
                  <div style={{ color: colors.textSecondary, fontSize: 15, marginBottom: 24, textAlign: 'center' }}>
                    Para editar tu propio perfil, ve a la sección <b>Perfil de usuario</b> desde el menú lateral.
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => setEditingUser(null)}
                    style={{
                      background: colors.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: 8,
                      padding: '12px 32px',
                      fontWeight: 600,
                      fontSize: 15,
                      cursor: 'pointer',
                      marginTop: 8,
                    }}
                  >
                    Cerrar
                  </motion.button>
                </>
              ) : (
                <>
                  {/* Avatar grande */}
                  <div style={{
                    width: 90,
                    height: 90,
                    borderRadius: '50%',
                    background: colors.primary + '22',
                    color: colors.primary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 38,
                    fontWeight: 700,
                    marginBottom: 18,
                    userSelect: 'none',
                    border: `2.5px solid ${colors.primary}33`,
                  }}>
                    {(editingUser.name || editingUser.email || 'U').split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase()}
                  </div>
                  {/* Info */}
                  <div style={{ width: '100%', marginBottom: 18 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Mail size={16} color={colors.textSecondary} />
                      <span style={{ color: colors.textSecondary, fontSize: 14 }}>{editingUser.email}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Shield size={16} color={getRoleColor(editingUser.role)} />
                      <span style={{ color: getRoleColor(editingUser.role), fontSize: 14, fontWeight: 600 }}>{getRoleName(editingUser.role)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Calendar size={16} color={colors.textSecondary} />
                      <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                        {editingUser.created_at ? new Date(editingUser.created_at).toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <User size={16} color={colors.textSecondary} />
                      <span style={{ color: colors.textSecondary, fontSize: 14 }}>ID: {editingUser.id}</span>
                    </div>
                  </div>
                  {/* Formulario */}
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div>
                      <label style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 6,
                        display: 'block',
                      }}>
                        Nombre
                      </label>
                      <input
                        type="text"
                        value={editingUser.name || ''}
                        onChange={e => setEditingUser({...editingUser, name: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          color: colors.text,
                          background: colors.background,
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div>
                      <label style={{
                        color: colors.text,
                        fontSize: 14,
                        fontWeight: 600,
                        marginBottom: 6,
                        display: 'block',
                      }}>
                        Rol
                      </label>
                      <select
                        value={editingUser.role}
                        onChange={e => setEditingUser({...editingUser, role: e.target.value})}
                        style={{
                          width: '100%',
                          padding: '10px 14px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: 8,
                          fontSize: 14,
                          color: colors.text,
                          background: colors.background,
                          outline: 'none',
                        }}
                      >
                        <option value="user">Usuario</option>
                        <option value="manager">Jefe</option>
                        <option value="management">Gestión</option>
                        <option value="admin">Administrador</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleUpdateUser(editingUser.id, {
                          name: editingUser.name,
                          role: editingUser.role
                        })}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          background: colors.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <Save size={16} style={{ marginRight: 8 }} />
                        Guardar
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setEditingUser(null)}
                        style={{
                          flex: 1,
                          padding: '12px 24px',
                          background: colors.error + '11',
                          color: colors.error,
                          border: `1px solid ${colors.error}33`,
                          borderRadius: 8,
                          fontSize: 14,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        <X size={16} style={{ marginRight: 8 }} />
                        Cancelar
                      </motion.button>
                    </div>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default UserManagement; 