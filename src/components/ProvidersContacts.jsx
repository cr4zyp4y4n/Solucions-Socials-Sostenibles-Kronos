import React, { useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import holdedApi from '../services/holdedApi';
import { motion } from 'framer-motion';
import { 
  Users, 
  CreditCard, 
  Search, 
  Filter,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Info,
  ChevronLeft,
  ChevronRight,
  Edit,
  Trash2,
  Plus,
  Save,
  X
} from 'lucide-react';

const ProvidersContacts = () => {
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterIban, setFilterIban] = useState('all'); // all, with-iban, without-iban
  const [selectedCompany, setSelectedCompany] = useState('solucions');
  const [stats, setStats] = useState({
    total: 0,
    withIban: 0,
    withoutIban: 0
  });

  // Estados de paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);



  useEffect(() => {
    loadContacts();
  }, [selectedCompany]);

  // Resetear página cuando cambie la búsqueda o filtros
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterIban]);

  const loadContacts = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('Cargando contactos de Holded...');
      const allContacts = await holdedApi.getAllContacts(selectedCompany);
      console.log('Contactos obtenidos de Holded:', allContacts.length);
      
      // Procesar contactos para extraer información de IBAN
      const processedContacts = allContacts.map(contact => {
        // Buscar IBAN en diferentes campos del contacto
        let iban = '';
        if (contact.iban) {
          iban = contact.iban;
        } else if (contact.bankAccount) {
          iban = contact.bankAccount;
        } else if (contact.bank_account) {
          iban = contact.bank_account;
        } else if (contact.accountNumber) {
          iban = contact.accountNumber;
        } else if (contact.account_number) {
          iban = contact.account_number;
        } else if (contact.bankDetails) {
          iban = contact.bankDetails;
        } else if (contact.bank_details) {
          iban = contact.bank_details;
        } else if (contact.paymentInfo) {
          iban = contact.paymentInfo;
        } else if (contact.payment_info) {
          iban = contact.payment_info;
        }

        return {
          ...contact,
          iban: iban,
          hasIban: !!iban,
          phone: contact.mobile || contact.phone || '' // Usar mobile como teléfono principal
        };
      });

      setContacts(processedContacts);
      
      // Calcular estadísticas
      const total = processedContacts.length;
      const withIban = processedContacts.filter(c => c.hasIban).length;
      const withoutIban = total - withIban;
      
      setStats({ total, withIban, withoutIban });

    } catch (error) {
      console.error('Error cargando contactos:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  // Filtrar contactos según búsqueda y filtro de IBAN
  const filteredContacts = contacts.filter(contact => {
    const matchesSearch = contact.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.company?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         contact.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesIbanFilter = filterIban === 'all' ||
                             (filterIban === 'with-iban' && contact.hasIban) ||
                             (filterIban === 'without-iban' && !contact.hasIban);
    
    return matchesSearch && matchesIbanFilter;
  });

  // Calcular datos de paginación
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentContacts = filteredContacts.slice(startIndex, endIndex);

  // Función para obtener el color de fondo de las filas
  const getRowBackgroundColor = (index) => {
    return index % 2 === 0 ? colors.surface : colors.card;
  };

  // Función para cambiar página
  const handlePageChange = (page) => {
    setCurrentPage(page);
  };

  // Función para cambiar items por página
  const handleItemsPerPageChange = (newItemsPerPage) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Resetear a la primera página
  };

  const exportToCSV = () => {
    const headers = ['Nombre', 'Empresa', 'Email', 'Teléfono', 'IBAN', 'Tiene IBAN'];
    const csvData = [
      headers.join(','),
      ...filteredContacts.map(contact => [
        `"${contact.name || ''}"`,
        `"${contact.company || ''}"`,
        `"${contact.email || ''}"`,
        `"${contact.phone || ''}"`,
        `"${contact.iban || ''}"`,
        contact.hasIban ? 'Sí' : 'No'
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `contactos_proveedores_${selectedCompany}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getCompanyName = (company) => {
    return company === 'solucions' ? 'Solucions Socials' : 'Menjar d\'Hort';
  };



  return (
    <div style={{
      padding: '24px',
      backgroundColor: colors.background,
      userSelect: 'none'
    }}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
        >
          <h1 style={{
            fontSize: 28,
            fontWeight: 700,
            color: colors.text,
            margin: '0 0 8px 0',
            lineHeight: 1.2
          }}>
            Contactos de Proveedores
          </h1>
          <p style={{
            color: colors.textSecondary,
            fontSize: '14px',
            margin: 0
          }}>
            Consulta de contactos con información de IBAN desde Holded
          </p>
        </motion.div>
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={loadContacts}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            <span>Actualizar</span>
          </motion.button>
          

          
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={exportToCSV}
            disabled={filteredContacts.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              backgroundColor: colors.success,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: filteredContacts.length === 0 ? 'not-allowed' : 'pointer',
              opacity: filteredContacts.length === 0 ? 0.6 : 1,
              transition: 'all 0.2s ease'
            }}
          >
            <Download size={16} />
            <span>Exportar CSV</span>
          </motion.button>
        </motion.div>
      </motion.div>

      {/* Estadísticas */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          style={{
            padding: '20px',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: colors.primary + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Users size={20} style={{ color: colors.primary }} />
            </div>
            <div>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                Total Contactos
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '600',
                color: colors.text,
                margin: 0
              }}>
                {stats.total}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1, ease: 'easeOut' }}
          style={{
            padding: '20px',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: colors.success + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CheckCircle size={20} style={{ color: colors.success }} />
            </div>
            <div>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                Con IBAN
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '600',
                color: colors.text,
                margin: 0
              }}>
                {stats.withIban}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
          style={{
            padding: '20px',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: colors.error + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <XCircle size={20} style={{ color: colors.error }} />
            </div>
            <div>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                Sin IBAN
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '600',
                color: colors.text,
                margin: 0
              }}>
                {stats.withoutIban}
              </p>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: 'easeOut' }}
          style={{
            padding: '20px',
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              backgroundColor: colors.warning + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <CreditCard size={20} style={{ color: colors.warning }} />
            </div>
            <div>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                % Con IBAN
              </p>
              <p style={{
                fontSize: '24px',
                fontWeight: '600',
                color: colors.text,
                margin: 0
              }}>
                {stats.total > 0 ? Math.round((stats.withIban / stats.total) * 100) : 0}%
              </p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Controles de filtro */}
      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
        style={{
          backgroundColor: colors.surface,
          padding: '20px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          marginBottom: '24px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Primera fila */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px'
          }}>
            {/* Selector de empresa */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '8px'
              }}>
                Empresa
              </label>
              <select
                value={selectedCompany}
                onChange={(e) => setSelectedCompany(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <option value="solucions">Solucions Socials</option>
                <option value="menjar">Menjar d'Hort</option>
              </select>
            </div>

            {/* Filtro de IBAN */}
            <div>
              <label style={{
                display: 'block',
                fontSize: '12px',
                fontWeight: '500',
                color: colors.textSecondary,
                marginBottom: '8px'
              }}>
                Filtro IBAN
              </label>
              <select
                value={filterIban}
                onChange={(e) => setFilterIban(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease'
                }}
              >
                <option value="all">Todos</option>
                <option value="with-iban">Con IBAN</option>
                <option value="without-iban">Sin IBAN</option>
              </select>
            </div>
          </div>

          {/* Segunda fila - Búsqueda */}
          <div>
            <label style={{
              display: 'block',
              fontSize: '12px',
              fontWeight: '500',
              color: colors.textSecondary,
              marginBottom: '8px'
            }}>
              Buscar
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={16} style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: colors.textSecondary,
                zIndex: 1
              }} />
              <input
                type="text"
                placeholder="Buscar por nombre, empresa o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px 10px 40px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none',
                  transition: 'border-color 0.2s ease',
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>
        </div>
      </motion.div>

      {/* Estado de carga */}
      {loading && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            padding: '60px 20px',
            color: colors.textSecondary 
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${colors.border}`,
              borderTop: `3px solid ${colors.primary}`,
              borderRadius: '50%',
              marginBottom: '20px'
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8 }}>
            Cargando contactos...
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary }}>
            Esto puede tardar unos segundos
          </div>
        </motion.div>
      )}

      {/* Error */}
      {error && (
        <div style={{
          backgroundColor: colors.error + '10',
          border: `1px solid ${colors.error}`,
          borderRadius: '8px',
          padding: '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <AlertCircle size={20} style={{ color: colors.error }} />
            <p style={{
              color: colors.error,
              fontSize: '14px',
              margin: 0
            }}>
              {error}
            </p>
          </div>
        </div>
      )}

      {/* Lista de contactos */}
      {!loading && !error && (
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 30 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
        >
          {/* Controles de paginación */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            padding: '16px',
            backgroundColor: colors.surface,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}>
              <span style={{
                fontSize: '14px',
                color: colors.textSecondary
              }}>
                Mostrar
              </span>
              <select
                value={itemsPerPage}
                onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                style={{
                  padding: '6px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  fontSize: '14px',
                  outline: 'none'
                }}
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
              <span style={{
                fontSize: '14px',
                color: colors.textSecondary
              }}>
                contactos por página
              </span>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span style={{
                fontSize: '14px',
                color: colors.textSecondary
              }}>
                {startIndex + 1}-{Math.min(endIndex, filteredContacts.length)} de {filteredContacts.length} contactos
              </span>
            </div>
          </div>

          {/* Tabla */}
          <div style={{ 
            overflowX: 'auto',
            backgroundColor: colors.surface,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
          }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse', 
              fontSize: 14
            }}>
              <thead>
                <tr>
                  <th style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '12px 8px',
                    textAlign: 'left',
                    color: colors.primary,
                    fontWeight: 600,
                    background: colors.surface
                  }}>
                    Contacto
                  </th>
                  <th style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '12px 8px',
                    textAlign: 'left',
                    color: colors.primary,
                    fontWeight: 600,
                    background: colors.surface
                  }}>
                    Empresa
                  </th>
                  <th style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '12px 8px',
                    textAlign: 'left',
                    color: colors.primary,
                    fontWeight: 600,
                    background: colors.surface
                  }}>
                    Email
                  </th>
                  <th style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '12px 8px',
                    textAlign: 'left',
                    color: colors.primary,
                    fontWeight: 600,
                    background: colors.surface
                  }}>
                    Teléfono
                  </th>
                  <th style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '12px 8px',
                    textAlign: 'left',
                    color: colors.primary,
                    fontWeight: 600,
                    background: colors.surface
                  }}>
                    IBAN
                  </th>
                  <th style={{
                    borderBottom: `1px solid ${colors.border}`,
                    padding: '12px 8px',
                    textAlign: 'left',
                    color: colors.primary,
                    fontWeight: 600,
                    background: colors.surface
                  }}>
                    Estado
                  </th>

                </tr>
              </thead>
              <tbody>
                {currentContacts.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={{
                      padding: '40px 20px',
                      textAlign: 'center',
                      color: colors.textSecondary,
                      fontSize: '14px'
                    }}>
                      No se encontraron contactos que coincidan con los filtros
                    </td>
                  </tr>
                ) : (
                  currentContacts.map((contact, index) => (
                    <tr
                      key={contact.id}
                      style={{
                        background: getRowBackgroundColor(index),
                        transition: 'background-color 0.2s ease'
                      }}
                      onMouseEnter={(e) => {
                        e.target.parentElement.style.backgroundColor = colors.hover || 'rgba(0,0,0,0.02)';
                      }}
                      onMouseLeave={(e) => {
                        e.target.parentElement.style.backgroundColor = getRowBackgroundColor(index);
                      }}
                    >
                      <td style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px',
                        color: colors.text
                      }}>
                        <div>
                          <p style={{
                            fontSize: '14px',
                            fontWeight: '500',
                            color: colors.text,
                            margin: '0 0 4px 0'
                          }}>
                            {contact.name || 'Sin nombre'}
                          </p>
                          {contact.company && contact.company !== contact.name && (
                            <p style={{
                              fontSize: '12px',
                              color: colors.textSecondary,
                              margin: 0
                            }}>
                              {contact.company}
                            </p>
                          )}
                        </div>
                      </td>
                      <td style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px',
                        color: colors.text
                      }}>
                        {contact.company || '-'}
                      </td>
                      <td style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px',
                        color: colors.text
                      }}>
                        {contact.email || '-'}
                      </td>
                      <td style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px',
                        color: colors.text
                      }}>
                        {contact.phone || '-'}
                      </td>
                      <td style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px',
                        color: colors.textSecondary,
                        fontSize: '13px',
                        fontFamily: 'monospace'
                      }}>
                        {contact.iban || '-'}
                      </td>
                      <td style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          {contact.hasIban ? (
                            <>
                              <CheckCircle size={16} style={{ color: colors.success }} />
                              <span style={{
                                fontSize: '12px',
                                color: colors.success,
                                fontWeight: '500'
                              }}>
                                Con IBAN
                              </span>
                            </>
                          ) : (
                            <>
                              <XCircle size={16} style={{ color: colors.error }} />
                              <span style={{
                                fontSize: '12px',
                                color: colors.error,
                                fontWeight: '500'
                              }}>
                                Sin IBAN
                              </span>
                            </>
                          )}
                        </div>
                      </td>

                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              marginTop: '20px',
              padding: '16px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  backgroundColor: colors.surface,
                  color: currentPage === 1 ? colors.textSecondary : colors.text,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                  opacity: currentPage === 1 ? 0.5 : 1,
                  fontSize: '14px'
                }}
              >
                <ChevronLeft size={16} />
                Anterior
              </button>

              <div style={{
                display: 'flex',
                gap: '4px'
              }}>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }

                  return (
                    <button
                      key={pageNum}
                      onClick={() => handlePageChange(pageNum)}
                      style={{
                        padding: '8px 12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '4px',
                        backgroundColor: currentPage === pageNum ? colors.primary : colors.surface,
                        color: currentPage === pageNum ? 'white' : colors.text,
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: currentPage === pageNum ? '600' : '400'
                      }}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '8px 12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '4px',
                  backgroundColor: colors.surface,
                  color: currentPage === totalPages ? colors.textSecondary : colors.text,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                  opacity: currentPage === totalPages ? 0.5 : 1,
                  fontSize: '14px'
                }}
              >
                Siguiente
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* Información adicional */}
      {!loading && !error && filteredContacts.length > 0 && (
        <div style={{
          backgroundColor: colors.primary + '10',
          border: `1px solid ${colors.primary}`,
          borderRadius: '8px',
          padding: '16px',
          marginTop: '24px'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <Info size={20} style={{ color: colors.primary }} />
            <div>
              <p style={{
                fontSize: '14px',
                color: colors.primary,
                margin: '0 0 4px 0',
                fontWeight: '500'
              }}>
                Mostrando {currentContacts.length} de {filteredContacts.length} contactos filtrados
              </p>
              <p style={{
                fontSize: '12px',
                color: colors.textSecondary,
                margin: 0
              }}>
                Los contactos se obtienen directamente de la API de Holded
              </p>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ProvidersContacts; 