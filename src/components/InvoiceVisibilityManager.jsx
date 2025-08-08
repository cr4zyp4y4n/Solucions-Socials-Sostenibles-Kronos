import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Eye, 
  EyeOff, 
  Filter, 
  Search, 
  X, 
  AlertCircle,
  CheckCircle,
  Clock,
  DollarSign,
  User
} from 'feather-icons-react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import { invoiceVisibilityService } from '../services/invoiceVisibilityService';
import { supabase } from '../config/supabase';

const InvoiceVisibilityManager = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  
  // Estados principales
  const [allInvoices, setAllInvoices] = useState([]);
  const [hiddenInvoices, setHiddenInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Estados de filtros
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRole, setSelectedRole] = useState('manager');
  const [filterProvider, setFilterProvider] = useState('');
  
  // Estados de UI
  const [showHideModal, setShowHideModal] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [hideReason, setHideReason] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'hidden', 'stats'
  
  // Verificar si el usuario puede gestionar visibilidad
  const canManageVisibility = user?.user_metadata?.role === 'management' || 
                             user?.user_metadata?.role === 'admin';

  // Cargar todas las facturas (solo paid y partially_paid)
  const loadAllInvoices = async () => {
    try {
      const { data, error } = await supabase
        .from('invoices')
        .select(`
          *,
          excel_uploads (
            filename,
            uploaded_at
          )
        `)
        .or('status.eq.paid,status.eq.partially_paid,status.eq.Pagado,status.eq.Parcial')
        .order('processed_at', { ascending: false });

      if (error) throw error;
      
      // Filtrar también por lógica adicional si es necesario
      const filteredData = (data || []).filter(invoice => {
        const status = invoice.status?.toLowerCase() || '';
        return status.includes('paid') || status.includes('pagado') || status.includes('parcial');
      });
      
      setAllInvoices(filteredData);
    } catch (error) {
      console.error('Error cargando facturas:', error);
      setError('Error al cargar las facturas');
    }
  };

  // Cargar facturas ocultas
  const loadHiddenInvoices = async () => {
    try {
      const { data, error } = await invoiceVisibilityService.getHiddenInvoicesForRole(selectedRole);
      if (error) throw error;
      setHiddenInvoices(data || []);
    } catch (error) {
      console.error('Error cargando facturas ocultas:', error);
      setError('Error al cargar las facturas ocultas');
    }
  };

  // Cargar datos iniciales
  useEffect(() => {
    if (canManageVisibility) {
      loadAllInvoices();
      loadHiddenInvoices();
      setLoading(false);
    }
  }, [canManageVisibility, selectedRole]);

  // Ocultar factura
  const handleHideInvoice = async () => {
    if (!selectedInvoice || !hideReason.trim()) {
      setError('Debes proporcionar una razón para ocultar la factura');
      return;
    }

    try {
      const { error } = await invoiceVisibilityService.hideInvoiceForRole(
        selectedInvoice.id,
        selectedRole,
        hideReason
      );

      if (error) throw error;

      setSuccess(`Factura ocultada para ${selectedRole} correctamente`);
      setShowHideModal(false);
      setSelectedInvoice(null);
      setHideReason('');
      
      // Recargar datos
      loadHiddenInvoices();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error ocultando factura:', error);
      setError('Error al ocultar la factura');
    }
  };

  // Mostrar factura (eliminar ocultación)
  const handleShowInvoice = async (invoiceId) => {
    try {
      const { error } = await invoiceVisibilityService.showInvoiceForRole(invoiceId, selectedRole);
      
      if (error) throw error;

      setSuccess(`Factura mostrada para ${selectedRole} correctamente`);
      loadHiddenInvoices();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (error) {
      console.error('Error mostrando factura:', error);
      setError('Error al mostrar la factura');
    }
  };

  // Filtrar facturas
  const filteredInvoices = allInvoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.description?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesProvider = !filterProvider || invoice.provider === filterProvider;
    
    return matchesSearch && matchesProvider;
  });

  // Obtener proveedores únicos
  const uniqueProviders = [...new Set(allInvoices.map(invoice => invoice.provider))].filter(Boolean).sort();

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  // Formatear moneda
  const formatCurrency = (amount) => {
    if (!amount) return '0,00 €';
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  if (!canManageVisibility) {
    return (
      <div style={{
        padding: '40px 20px',
        textAlign: 'center',
        color: colors.text
      }}>
        <AlertCircle size={48} style={{ marginBottom: '20px', opacity: 0.6 }} />
        <h3>Acceso Restringido</h3>
        <p>No tienes permisos para gestionar la visibilidad de facturas.</p>
      </div>
    );
  }

  return (
    <div style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '30px',
        borderBottom: `1px solid ${colors.border}`,
        paddingBottom: '20px'
      }}>
        <div>
          <h2 style={{ margin: 0, color: colors.text, fontSize: 24, fontWeight: 600 }}>
            Gestión de Visibilidad de Facturas
          </h2>
          <p style={{ margin: '8px 0 0 0', color: colors.textSecondary, fontSize: 14 }}>
            Controla qué facturas pueden ver los diferentes roles
          </p>
        </div>
      </div>

      {/* Alertas */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: '#fee2e2',
              border: '1px solid #fecaca',
              color: '#dc2626',
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <AlertCircle size={16} />
            {error}
            <button
              onClick={() => setError('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#dc2626',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: '#dcfce7',
              border: '1px solid #bbf7d0',
              color: '#16a34a',
              padding: '12px 16px',
              borderRadius: 8,
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <CheckCircle size={16} />
            {success}
            <button
              onClick={() => setSuccess('')}
              style={{
                background: 'none',
                border: 'none',
                color: '#16a34a',
                cursor: 'pointer',
                marginLeft: 'auto'
              }}
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '2px',
        marginBottom: '20px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        {[
          { id: 'all', label: 'Todas las Facturas', icon: Eye },
          { id: 'hidden', label: 'Facturas Ocultas', icon: EyeOff },
          { id: 'stats', label: 'Estadísticas', icon: Filter }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? colors.primary : 'transparent',
              color: activeTab === tab.id ? 'white' : colors.text,
              border: 'none',
              padding: '12px 20px',
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderRadius: activeTab === tab.id ? '8px 8px 0 0' : '0',
              transition: 'all 0.2s ease'
            }}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de tabs */}
      <AnimatePresence mode="wait">
        {activeTab === 'all' && (
          <motion.div
            key="all"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {/* Filtros */}
            <div style={{
              display: 'flex',
              gap: '16px',
              marginBottom: '20px',
              flexWrap: 'wrap'
            }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <input
                  type="text"
                  placeholder="Buscar facturas..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 14px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    fontSize: 14,
                    color: colors.text,
                    background: colors.background,
                    outline: 'none'
                  }}
                />
              </div>

              <select
                value={filterProvider}
                onChange={(e) => setFilterProvider(e.target.value)}
                style={{
                  padding: '10px 14px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  fontSize: 14,
                  color: colors.text,
                  background: colors.background,
                  outline: 'none',
                  minWidth: '150px'
                }}
              >
                <option value="">Todos los proveedores</option>
                {uniqueProviders.map(provider => (
                  <option key={provider} value={provider}>{provider}</option>
                ))}
              </select>

              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                style={{
                  padding: '10px 14px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  fontSize: 14,
                  color: colors.text,
                  background: colors.background,
                  outline: 'none',
                  minWidth: '120px'
                }}
              >
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                <option value="management">Management</option>
                <option value="user">User</option>
              </select>
            </div>

            {/* Lista de facturas */}
            <div style={{
              background: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '16px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.surface
              }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 16, fontWeight: 600 }}>
                  Facturas Disponibles ({filteredInvoices.length})
                </h3>
                <p style={{ margin: '4px 0 0 0', color: colors.textSecondary, fontSize: 12 }}>
                  Selecciona facturas para ocultarlas del rol: <strong>{selectedRole}</strong>
                </p>
              </div>

              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {filteredInvoices.map(invoice => (
                  <div
                    key={invoice.id}
                    style={{
                      padding: '16px',
                      borderBottom: `1px solid ${colors.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease'
                    }}
                    onMouseEnter={(e) => e.target.style.background = colors.surface}
                    onMouseLeave={(e) => e.target.style.background = 'transparent'}
                    onClick={() => {
                      setSelectedInvoice(invoice);
                      setShowHideModal(true);
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <span style={{
                          color: colors.text,
                          fontWeight: 600,
                          fontSize: 14
                        }}>
                          {invoice.invoice_number || 'Sin número'}
                        </span>
                        <span style={{
                          color: colors.textSecondary,
                          fontSize: 12
                        }}>
                          {formatDate(invoice.issue_date)}
                        </span>
                      </div>
                      
                      <div style={{
                        color: colors.text,
                        fontSize: 14,
                        marginBottom: '4px'
                      }}>
                        {invoice.provider}
                      </div>
                      
                      <div style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}>
                        {invoice.description || 'Sin descripción'}
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'right',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{
                        color: colors.text,
                        fontWeight: 600,
                        fontSize: 14
                      }}>
                        {formatCurrency(invoice.total)}
                      </span>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedInvoice(invoice);
                          setShowHideModal(true);
                        }}
                        style={{
                          background: colors.primary,
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <EyeOff size={14} />
                        Ocultar
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'hidden' && (
          <motion.div
            key="hidden"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              background: colors.background,
              border: `1px solid ${colors.border}`,
              borderRadius: 8,
              overflow: 'hidden'
            }}>
              <div style={{
                padding: '16px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.surface
              }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 16, fontWeight: 600 }}>
                  Facturas Ocultas para {selectedRole} ({hiddenInvoices.length})
                </h3>
                <p style={{ margin: '4px 0 0 0', color: colors.textSecondary, fontSize: 12 }}>
                  Facturas que no pueden ver los usuarios con rol: <strong>{selectedRole}</strong>
                </p>
              </div>

              <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {hiddenInvoices.map(visibility => (
                  <div
                    key={visibility.id}
                    style={{
                      padding: '16px',
                      borderBottom: `1px solid ${colors.border}`,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '12px',
                        marginBottom: '8px'
                      }}>
                        <span style={{
                          color: colors.text,
                          fontWeight: 600,
                          fontSize: 14
                        }}>
                          {visibility.invoices?.invoice_number || 'Sin número'}
                        </span>
                        <span style={{
                          color: colors.textSecondary,
                          fontSize: 12
                        }}>
                          {formatDate(visibility.invoices?.issue_date)}
                        </span>
                      </div>
                      
                      <div style={{
                        color: colors.text,
                        fontSize: 14,
                        marginBottom: '4px'
                      }}>
                        {visibility.invoices?.provider}
                      </div>
                      
                      <div style={{
                        color: colors.textSecondary,
                        fontSize: 12,
                        fontStyle: 'italic'
                      }}>
                        Razón: {visibility.reason || 'Sin razón especificada'}
                      </div>
                    </div>

                    <div style={{
                      textAlign: 'right',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}>
                      <span style={{
                        color: colors.text,
                        fontWeight: 600,
                        fontSize: 14
                      }}>
                        {formatCurrency(visibility.invoices?.total)}
                      </span>
                      
                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleShowInvoice(visibility.invoice_id)}
                        style={{
                          background: '#16a34a',
                          color: 'white',
                          border: 'none',
                          borderRadius: 6,
                          padding: '6px 12px',
                          fontSize: 12,
                          fontWeight: 500,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Eye size={14} />
                        Mostrar
                      </motion.button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'stats' && (
          <motion.div
            key="stats"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
              gap: '20px',
              marginBottom: '20px'
            }}>
              {[
                { role: 'manager', label: 'Manager', icon: User },
                { role: 'admin', label: 'Admin', icon: User },
                { role: 'management', label: 'Management', icon: User },
                { role: 'user', label: 'User', icon: User }
              ].map(roleInfo => (
                <div
                  key={roleInfo.role}
                  style={{
                    background: colors.background,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: '20px',
                    textAlign: 'center'
                  }}
                >
                  <roleInfo.icon size={32} style={{ color: colors.primary, marginBottom: '12px' }} />
                  <h3 style={{ margin: '0 0 8px 0', color: colors.text, fontSize: 16, fontWeight: 600 }}>
                    {roleInfo.label}
                  </h3>
                  <p style={{ margin: 0, color: colors.textSecondary, fontSize: 14 }}>
                    {hiddenInvoices.filter(h => h.hidden_for_role === roleInfo.role).length} facturas ocultas
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal para ocultar factura */}
      <AnimatePresence>
        {showHideModal && selectedInvoice && (
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
              background: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                background: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                maxHeight: '80vh',
                overflowY: 'auto'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '20px'
              }}>
                <h3 style={{ margin: 0, color: colors.text, fontSize: 18, fontWeight: 600 }}>
                  Ocultar Factura
                </h3>
                <button
                  onClick={() => setShowHideModal(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: colors.textSecondary,
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={20} />
                </button>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{
                  background: colors.surface,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  padding: '16px',
                  marginBottom: '16px'
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '8px'
                  }}>
                    <span style={{ color: colors.text, fontWeight: 600 }}>
                      {selectedInvoice.invoice_number || 'Sin número'}
                    </span>
                    <span style={{ color: colors.textSecondary, fontSize: 14 }}>
                      {formatDate(selectedInvoice.issue_date)}
                    </span>
                  </div>
                  <div style={{ color: colors.text, marginBottom: '4px' }}>
                    {selectedInvoice.provider}
                  </div>
                  <div style={{ color: colors.textSecondary, fontSize: 14 }}>
                    {selectedInvoice.description || 'Sin descripción'}
                  </div>
                  <div style={{ color: colors.text, fontWeight: 600, marginTop: '8px' }}>
                    {formatCurrency(selectedInvoice.total)}
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    Rol afectado: <strong>{selectedRole}</strong>
                  </label>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: 14,
                    fontWeight: 600,
                    marginBottom: '8px'
                  }}>
                    Razón para ocultar *
                  </label>
                  <textarea
                    value={hideReason}
                    onChange={(e) => setHideReason(e.target.value)}
                    placeholder="Explica por qué ocultas esta factura..."
                    style={{
                      width: '100%',
                      minHeight: '80px',
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: 8,
                      fontSize: 14,
                      color: colors.text,
                      background: colors.background,
                      outline: 'none',
                      resize: 'vertical'
                    }}
                  />
                </div>
              </div>

              <div style={{
                display: 'flex',
                gap: '12px',
                justifyContent: 'flex-end'
              }}>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowHideModal(false)}
                  style={{
                    background: 'transparent',
                    color: colors.text,
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancelar
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleHideInvoice}
                  disabled={!hideReason.trim()}
                  style={{
                    background: colors.primary,
                    color: 'white',
                    border: 'none',
                    borderRadius: 8,
                    padding: '10px 20px',
                    fontSize: 14,
                    fontWeight: 500,
                    cursor: hideReason.trim() ? 'pointer' : 'not-allowed',
                    opacity: hideReason.trim() ? 1 : 0.6
                  }}
                >
                  Ocultar Factura
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InvoiceVisibilityManager; 