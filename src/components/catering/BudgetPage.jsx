import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Download, 
  Send, 
  CheckCircle,
  XCircle,
  Clock,
  DollarSign,
  Users,
  Calendar,
  Edit,
  Trash2,
  Plus,
  Search,
  Filter
} from 'feather-icons-react';
import { useTheme } from '../ThemeContext';

// Mock data para presupuestos
const mockBudgets = [
  {
    id: 1,
    eventId: 1,
    clientName: 'María García',
    eventType: 'Boda',
    date: '2024-02-15',
    guests: 120,
    totalAmount: 8500,
    status: 'aceptado',
    createdAt: '2024-01-20',
    sentAt: '2024-01-21',
    acceptedAt: '2024-01-25',
    items: [
      { name: 'Servicio de Catering Completo', quantity: 1, unitPrice: 5000, total: 5000 },
      { name: 'Personal de Servicio (8 personas)', quantity: 8, unitPrice: 150, total: 1200 },
      { name: 'Equipamiento y Mobiliario', quantity: 1, unitPrice: 800, total: 800 },
      { name: 'Transporte y Logística', quantity: 1, unitPrice: 500, total: 500 },
      { name: 'Decoración y Presentación', quantity: 1, unitPrice: 1000, total: 1000 }
    ]
  },
  {
    id: 2,
    eventId: 2,
    clientName: 'Carlos Rodríguez',
    eventType: 'Cumpleaños',
    date: '2024-02-20',
    guests: 45,
    totalAmount: 3200,
    status: 'enviado',
    createdAt: '2024-01-22',
    sentAt: '2024-01-23',
    items: [
      { name: 'Servicio de Catering Básico', quantity: 1, unitPrice: 2000, total: 2000 },
      { name: 'Personal de Servicio (4 personas)', quantity: 4, unitPrice: 150, total: 600 },
      { name: 'Equipamiento Básico', quantity: 1, unitPrice: 400, total: 400 },
      { name: 'Transporte', quantity: 1, unitPrice: 200, total: 200 }
    ]
  },
  {
    id: 3,
    eventId: 3,
    clientName: 'Ana López',
    eventType: 'Evento Corporativo',
    date: '2024-02-25',
    guests: 80,
    totalAmount: 6500,
    status: 'rechazado',
    createdAt: '2024-01-24',
    sentAt: '2024-01-25',
    rejectedAt: '2024-01-28',
    rejectionReason: 'Presupuesto fuera del rango esperado',
    items: [
      { name: 'Servicio de Catering Corporativo', quantity: 1, unitPrice: 4000, total: 4000 },
      { name: 'Personal de Servicio (6 personas)', quantity: 6, unitPrice: 150, total: 900 },
      { name: 'Equipamiento Profesional', quantity: 1, unitPrice: 800, total: 800 },
      { name: 'Transporte y Logística', quantity: 1, unitPrice: 400, total: 400 },
      { name: 'Presentación Corporativa', quantity: 1, unitPrice: 400, total: 400 }
    ]
  }
];

const statusColors = {
  borrador: '#6B7280',
  enviado: '#3B82F6',
  aceptado: '#10B981',
  rechazado: '#EF4444'
};

const statusLabels = {
  borrador: 'Borrador',
  enviado: 'Enviado',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado'
};

const BudgetPage = () => {
  const { colors } = useTheme();
  const [budgets, setBudgets] = useState(mockBudgets);
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBudget, setSelectedBudget] = useState(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);

  const filteredBudgets = budgets.filter(budget => {
    const matchesStatus = filterStatus === 'todos' || budget.status === filterStatus;
    const matchesSearch = budget.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         budget.eventType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusCount = (status) => {
    return budgets.filter(budget => budget.status === status).length;
  };

  const getTotalRevenue = () => {
    return budgets
      .filter(budget => budget.status === 'aceptado')
      .reduce((total, budget) => total + budget.totalAmount, 0);
  };

  const handleCreateBudget = () => {
    // TODO: Implementar creación de presupuesto
    console.log('Crear presupuesto');
  };

  const handleViewBudget = (budget) => {
    setSelectedBudget(budget);
    setShowBudgetModal(true);
  };

  const handleSendBudget = (budgetId) => {
    // TODO: Implementar envío de presupuesto
    console.log('Enviar presupuesto:', budgetId);
  };

  const handleExportPDF = (budget) => {
    // TODO: Implementar exportación PDF
    console.log('Exportar PDF:', budget);
  };

  const handleAcceptBudget = (budgetId) => {
    // TODO: Implementar aceptación de presupuesto
    console.log('Aceptar presupuesto:', budgetId);
  };

  const handleRejectBudget = (budgetId) => {
    // TODO: Implementar rechazo de presupuesto
    console.log('Rechazar presupuesto:', budgetId);
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header con estadísticas */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '20px',
          marginBottom: '30px'
        }}
      >
        <div style={{
          background: colors.surface,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <div style={{ color: colors.primary, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            {budgets.length}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Total Presupuestos</div>
        </div>

        <div style={{
          background: colors.surface,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <div style={{ color: statusColors.aceptado, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            {getStatusCount('aceptado')}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Aceptados</div>
        </div>

        <div style={{
          background: colors.surface,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <div style={{ color: statusColors.enviado, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            {getStatusCount('enviado')}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Pendientes</div>
        </div>

        <div style={{
          background: colors.surface,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <div style={{ color: colors.primary, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            {getTotalRevenue().toLocaleString('es-ES')}€
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Ingresos Totales</div>
        </div>
      </motion.div>

      {/* Controles */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          gap: '20px',
          flexWrap: 'wrap'
        }}
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative' }}>
            <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: colors.textSecondary }} />
            <input
              type="text"
              placeholder="Buscar presupuestos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                padding: '10px 12px 10px 40px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                background: colors.surface,
                color: colors.text,
                fontSize: '14px',
                width: '250px',
                outline: 'none'
              }}
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            style={{
              padding: '10px 12px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              background: colors.surface,
              color: colors.text,
              fontSize: '14px',
              outline: 'none'
            }}
          >
            <option value="todos">Todos los estados</option>
            <option value="borrador">Borradores</option>
            <option value="enviado">Enviados</option>
            <option value="aceptado">Aceptados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreateBudget}
          style={{
            background: colors.primary,
            color: 'white',
            border: 'none',
            padding: '12px 24px',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Plus size={16} />
          Nuevo Presupuesto
        </motion.button>
      </motion.div>

      {/* Lista de presupuestos */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{
          background: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden'
        }}
      >
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${colors.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <h3 style={{ color: colors.text, fontSize: '18px', fontWeight: '600', margin: 0 }}>
            Presupuestos ({filteredBudgets.length})
          </h3>
        </div>

        <div style={{ 
          maxHeight: '600px', 
          overflow: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.border} transparent`
        }}>
          {filteredBudgets.length === 0 ? (
            <div style={{
              padding: '60px 24px',
              textAlign: 'center',
              color: colors.textSecondary
            }}>
              <FileText size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>No hay presupuestos</div>
              <div style={{ fontSize: '14px' }}>Crea tu primer presupuesto para empezar</div>
            </div>
          ) : (
            filteredBudgets.map((budget, index) => (
              <motion.div
                key={budget.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                style={{
                  padding: '20px 24px',
                  borderBottom: `1px solid ${colors.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  cursor: 'pointer',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.target.style.background = colors.hover}
                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                onClick={() => handleViewBudget(budget)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: statusColors[budget.status],
                    flexShrink: 0
                  }} />
                  
                  <div style={{ flex: 1 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      marginBottom: '8px'
                    }}>
                      <div style={{ color: colors.text, fontSize: '16px', fontWeight: '600' }}>
                        {budget.clientName}
                      </div>
                      <div style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: statusColors[budget.status] + '15',
                        color: statusColors[budget.status]
                      }}>
                        {statusLabels[budget.status]}
                      </div>
                    </div>
                    
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '20px',
                      color: colors.textSecondary,
                      fontSize: '14px'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Calendar size={14} />
                        {new Date(budget.date).toLocaleDateString('es-ES')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} />
                        {budget.guests} personas
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <FileText size={14} />
                        {budget.eventType}
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{
                    color: colors.textSecondary,
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    {budget.totalAmount.toLocaleString('es-ES')}€
                  </div>
                  
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {budget.status === 'borrador' && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSendBudget(budget.id);
                        }}
                        style={{
                          background: colors.primary,
                          color: 'white',
                          border: 'none',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: '500',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px'
                        }}
                      >
                        <Send size={12} />
                        Enviar
                      </motion.button>
                    )}

                    {budget.status === 'enviado' && (
                      <>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAcceptBudget(budget.id);
                          }}
                          style={{
                            background: colors.primary,
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <CheckCircle size={12} />
                          Aceptar
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRejectBudget(budget.id);
                          }}
                          style={{
                            background: colors.error,
                            color: 'white',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            fontSize: '12px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <XCircle size={12} />
                          Rechazar
                        </motion.button>
                      </>
                    )}

                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExportPDF(budget);
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '8px',
                        borderRadius: '6px',
                        color: colors.textSecondary,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <Download size={16} />
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Modal de detalles del presupuesto */}
      {showBudgetModal && selectedBudget && (
        <BudgetModal
          budget={selectedBudget}
          onClose={() => {
            setShowBudgetModal(false);
            setSelectedBudget(null);
          }}
          onAccept={handleAcceptBudget}
          onReject={handleRejectBudget}
          onExport={handleExportPDF}
        />
      )}
    </div>
  );
};

// Componente Modal para detalles del presupuesto
const BudgetModal = ({ budget, onClose, onAccept, onReject, onExport }) => {
  const { colors } = useTheme();

  return (
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
        padding: '20px'
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        style={{
          background: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          padding: '32px',
          maxWidth: '800px',
          width: '100%',
          maxHeight: '80vh',
          overflow: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.border} transparent`
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '24px'
        }}>
          <h2 style={{
            color: colors.text,
            fontSize: '24px',
            fontWeight: '700',
            margin: 0
          }}>
            Presupuesto - {budget.clientName}
          </h2>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </motion.button>
        </div>

        {/* Información del presupuesto */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '16px',
            marginBottom: '24px'
          }}>
            <div>
              <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Cliente</label>
              <div style={{ color: colors.text, fontSize: '16px', fontWeight: '500' }}>{budget.clientName}</div>
            </div>
            <div>
              <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Evento</label>
              <div style={{ color: colors.text, fontSize: '16px' }}>{budget.eventType}</div>
            </div>
            <div>
              <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Fecha</label>
              <div style={{ color: colors.text, fontSize: '16px' }}>{new Date(budget.date).toLocaleDateString('es-ES')}</div>
            </div>
            <div>
              <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Invitados</label>
              <div style={{ color: colors.text, fontSize: '16px' }}>{budget.guests} personas</div>
            </div>
          </div>
        </div>

        {/* Items del presupuesto */}
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{
            color: colors.text,
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px'
          }}>
            Detalle del Presupuesto
          </h3>

          <div style={{
            background: colors.background,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '12px 16px',
              background: colors.surface,
              borderBottom: `1px solid ${colors.border}`,
              fontSize: '12px',
              fontWeight: '600',
              color: colors.textSecondary
            }}>
              <div>Concepto</div>
              <div>Cantidad</div>
              <div>Precio Unit.</div>
              <div>Total</div>
            </div>

            {budget.items.map((item, index) => (
              <div key={index} style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.border}`,
                fontSize: '14px'
              }}>
                <div style={{ color: colors.text }}>{item.name}</div>
                <div style={{ color: colors.textSecondary }}>{item.quantity}</div>
                <div style={{ color: colors.textSecondary }}>{item.unitPrice.toLocaleString('es-ES')}€</div>
                <div style={{ color: colors.text, fontWeight: '500' }}>{item.total.toLocaleString('es-ES')}€</div>
              </div>
            ))}

            <div style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1fr 1fr',
              padding: '16px',
              background: colors.primary + '10',
              fontSize: '16px',
              fontWeight: '600',
              color: colors.primary
            }}>
              <div>TOTAL</div>
              <div></div>
              <div></div>
              <div>{budget.totalAmount.toLocaleString('es-ES')}€</div>
            </div>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-end'
        }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onExport(budget)}
            style={{
              background: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Download size={16} />
            Exportar PDF
          </motion.button>

          {budget.status === 'enviado' && (
            <>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onAccept(budget.id)}
                style={{
                  background: colors.primary,
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <CheckCircle size={16} />
                Aceptar
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => onReject(budget.id)}
                style={{
                  background: colors.error,
                  color: 'white',
                  border: 'none',
                  padding: '10px 20px',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <XCircle size={16} />
                Rechazar
              </motion.button>
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
};

export default BudgetPage; 