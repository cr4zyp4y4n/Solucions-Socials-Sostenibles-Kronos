import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { 
  Activity, 
  User, 
  Edit2, 
  Trash2, 
  Plus,
  Calendar,
  Clock,
  Eye,
  EyeOff
} from 'feather-icons-react';
import { supabase } from '../config/supabase';

const AuditLog = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState({});
  const [dbRole, setDbRole] = useState(null);
  const isAdmin = dbRole === 'admin';

  useEffect(() => {
    const fetchRole = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        if (!error && data) {
          setDbRole(data.role);
        } else {
          setDbRole(null);
        }
      }
    };
    fetchRole();
  }, [user]);

  useEffect(() => {
    if (isAdmin) {
      loadAuditLogs();
    }
  }, [isAdmin]);

  const loadAuditLogs = async () => {
    if (!isAdmin) return;
    
    setLoading(true);
    setError('');
    
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) {
        setError(`Error al cargar el historial: ${error.message}`);
      } else {
        setAuditLogs(data || []);
      }
    } catch (e) {
      setError('Error inesperado al cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  const getActionIcon = (action) => {
    switch (action) {
      case 'INSERT': return <Plus size={16} />;
      case 'UPDATE': return <Edit2 size={16} />;
      case 'DELETE': return <Trash2 size={16} />;
      default: return <Activity size={16} />;
    }
  };

  const getActionColor = (action) => {
    switch (action) {
      case 'INSERT': return colors.success;
      case 'UPDATE': return colors.warning;
      case 'DELETE': return colors.error;
      default: return colors.primary;
    }
  };

  const getActionName = (action) => {
    switch (action) {
      case 'INSERT': return 'Creación';
      case 'UPDATE': return 'Actualización';
      case 'DELETE': return 'Eliminación';
      default: return action;
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatChanges = (oldValues, newValues) => {
    if (!oldValues && !newValues) return 'Sin cambios';
    
    const changes = [];
    
    if (oldValues && newValues) {
      // Comparar valores
      const old = oldValues;
      const new_ = newValues;
      
      if (old.name !== new_.name) {
        changes.push(`Nombre: "${old.name || 'vacío'}" → "${new_.name || 'vacío'}"`);
      }
      if (old.role !== new_.role) {
        changes.push(`Rol: "${old.role || 'vacío'}" → "${new_.role || 'vacío'}"`);
      }
      if (old.email !== new_.email) {
        changes.push(`Email: "${old.email || 'vacío'}" → "${new_.email || 'vacío'}"`);
      }
    } else if (oldValues) {
      // Eliminación
      changes.push('Usuario eliminado');
    } else if (newValues) {
      // Creación
      changes.push('Usuario creado');
    }
    
    return changes.length > 0 ? changes.join(', ') : 'Sin cambios';
  };

  // Si no es administrador, mostrar mensaje de acceso denegado
  if (!isAdmin) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          width: '100%',
          minHeight: '100%',
          backgroundColor: colors.background,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '40px',
        }}
      >
        <div style={{
          textAlign: 'center',
          maxWidth: 400,
        }}>
          <Activity size={64} color={colors.error} style={{ marginBottom: 24 }} />
          <h2 style={{
            color: colors.text,
            fontSize: 24,
            fontWeight: 700,
            margin: '0 0 16px 0',
          }}>
            Acceso Denegado
          </h2>
          <p style={{
            color: colors.textSecondary,
            fontSize: 16,
            lineHeight: 1.5,
            margin: 0,
          }}>
            Solo los administradores pueden acceder al historial de auditoría.
          </p>
        </div>
      </motion.div>
    );
  }

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
        padding: '24px',
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
        Historial de Auditoría
      </h1>

      {/* Mensajes de error */}
      <AnimatePresence>
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

      {/* Lista de auditoría */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
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
            Cargando historial...
          </div>
        ) : auditLogs.length === 0 ? (
          <div style={{
            padding: '60px 32px',
            textAlign: 'center',
            color: colors.textSecondary,
          }}>
            No hay registros de auditoría
          </div>
        ) : (
          <div style={{ 
            overflow: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.border} transparent`
          }}>
            {auditLogs.map((log, index) => {
              const actionColor = getActionColor(log.action);
              const isExpanded = showDetails[log.id];
              
              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  style={{
                    padding: '20px 32px',
                    borderBottom: `1px solid ${colors.border}`,
                  }}
                >
                  {/* Cabecera del log */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16,
                    marginBottom: 12,
                  }}>
                    {/* Icono de acción */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: '50%',
                      background: actionColor + '22',
                      color: actionColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      userSelect: 'none',
                    }}>
                      {getActionIcon(log.action)}
                    </div>
                    
                    {/* Información principal */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        marginBottom: 4,
                      }}>
                        <span style={{
                          color: colors.text,
                          fontSize: 16,
                          fontWeight: 600,
                          userSelect: 'none',
                        }}>
                          {getActionName(log.action)} de usuario
                        </span>
                        <span style={{
                          color: actionColor,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 6,
                          background: actionColor + '22',
                          border: `1px solid ${actionColor}33`,
                          userSelect: 'none',
                        }}>
                          {log.action}
                        </span>
                      </div>
                      
                      <div style={{
                        color: colors.textSecondary,
                        fontSize: 13,
                        userSelect: 'none',
                      }}>
                        Por: Usuario ID {log.user_id?.slice(0, 8)}...
                      </div>
                    </div>
                    
                    {/* Fecha */}
                    <div style={{
                      color: colors.textSecondary,
                      fontSize: 13,
                      userSelect: 'none',
                      textAlign: 'right',
                      minWidth: 140,
                    }}>
                      {formatDate(log.created_at)}
                    </div>
                    
                    {/* Botón expandir */}
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setShowDetails(prev => ({
                        ...prev,
                        [log.id]: !prev[log.id]
                      }))}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.textSecondary,
                        cursor: 'pointer',
                        padding: 8,
                        borderRadius: 6,
                      }}
                      title={isExpanded ? 'Ocultar detalles' : 'Ver detalles'}
                    >
                      {isExpanded ? <EyeOff size={16} /> : <Eye size={16} />}
                    </motion.button>
                  </div>
                  
                  {/* Detalles expandibles */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        style={{
                          overflow: 'hidden',
                          marginTop: 12,
                          padding: '16px',
                          background: colors.background,
                          borderRadius: 8,
                          border: `1px solid ${colors.border}`,
                        }}
                      >
                        <div style={{
                          color: colors.text,
                          fontSize: 14,
                          fontWeight: 600,
                          marginBottom: 8,
                          userSelect: 'none',
                        }}>
                          Cambios realizados:
                        </div>
                        <div style={{
                          color: colors.textSecondary,
                          fontSize: 13,
                          lineHeight: 1.5,
                          userSelect: 'none',
                          fontFamily: 'monospace',
                          background: colors.surface,
                          padding: '12px',
                          borderRadius: 6,
                          border: `1px solid ${colors.border}`,
                        }}>
                          {formatChanges(log.old_values, log.new_values)}
                        </div>
                        
                        {log.old_values && log.new_values && (
                          <div style={{ marginTop: 12 }}>
                            <details style={{ color: colors.textSecondary, fontSize: 13 }}>
                              <summary style={{ cursor: 'pointer', userSelect: 'none' }}>
                                Ver datos completos
                              </summary>
                              <div style={{ marginTop: 8 }}>
                                <div style={{ marginBottom: 8 }}>
                                  <strong>Valores anteriores:</strong>
                                  <pre style={{
                                    background: colors.surface,
                                    padding: '8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    overflow: 'auto',
                                    margin: '4px 0 0 0',
                                    userSelect: 'none',
                                  }}>
                                    {JSON.stringify(log.old_values, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <strong>Valores nuevos:</strong>
                                  <pre style={{
                                    background: colors.surface,
                                    padding: '8px',
                                    borderRadius: 4,
                                    fontSize: 11,
                                    overflow: 'auto',
                                    margin: '4px 0 0 0',
                                    userSelect: 'none',
                                  }}>
                                    {JSON.stringify(log.new_values, null, 2)}
                                  </pre>
                                </div>
                              </div>
                            </details>
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

export default AuditLog; 