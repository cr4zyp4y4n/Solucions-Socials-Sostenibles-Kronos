import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import AdminSectionHeader from './AdminSectionHeader';
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

const AuditLog = ({ embedded = false }) => {
  const { user } = useAuth();
  const { colors } = useTheme();
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDetails, setShowDetails] = useState({});
  const [dbRole, setDbRole] = useState(null);
  const [filterAction, setFilterAction] = useState('all');
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
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
      let query = supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (fechaDesde) {
        query = query.gte('created_at', `${fechaDesde}T00:00:00`);
      }
      if (fechaHasta) {
        query = query.lte('created_at', `${fechaHasta}T23:59:59`);
      }

      const { data, error } = await query;

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

  const filteredLogs = useMemo(() => {
    if (filterAction === 'all') return auditLogs;
    return auditLogs.filter((l) => l.action === filterAction);
  }, [auditLogs, filterAction]);

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
    <div
      style={{
        width: '100%',
        padding: embedded ? 0 : 24,
        boxSizing: 'border-box',
        backgroundColor: embedded ? 'transparent' : colors.background
      }}
    >
      <AdminSectionHeader
        title="Auditoría"
        description="Cambios recientes en el sistema."
        colors={colors}
        actions={
          <button
            type="button"
            onClick={loadAuditLogs}
            style={{
              padding: '8px 14px',
              borderRadius: 8,
              border: `1px solid ${colors.border}`,
              background: colors.surface,
              color: colors.text,
              fontWeight: 600,
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Actualizar
          </button>
        }
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 16, alignItems: 'flex-end' }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Acción</label>
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text }}
          >
            <option value="all">Todas</option>
            <option value="INSERT">Creación</option>
            <option value="UPDATE">Actualización</option>
            <option value="DELETE">Eliminación</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Desde</label>
          <input type="date" value={fechaDesde} onChange={(e) => setFechaDesde(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text }} />
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 12, color: colors.textSecondary, marginBottom: 4 }}>Hasta</label>
          <input type="date" value={fechaHasta} onChange={(e) => setFechaHasta(e.target.value)}
            style={{ padding: '8px 10px', borderRadius: 8, border: `1px solid ${colors.border}`, background: colors.surface, color: colors.text }} />
        </div>
        <button type="button" onClick={loadAuditLogs}
          style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: colors.primary, color: '#fff', fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
          Aplicar fechas
        </button>
      </div>

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
          maxWidth: embedded ? 'none' : 1200,
          background: colors.surface,
          borderRadius: embedded ? 12 : 16,
          boxShadow: embedded ? 'none' : '0 2px 12px rgba(0,0,0,0.06)',
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
        ) : filteredLogs.length === 0 ? (
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
            {filteredLogs.map((log, index) => {
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
    </div>
  );
};

export default AuditLog; 