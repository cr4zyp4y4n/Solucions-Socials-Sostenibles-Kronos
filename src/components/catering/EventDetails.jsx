import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  User,
  Phone,
  Mail,
  Edit,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  FileText,
  ShoppingBag,
  Truck,
  Coffee,
  Gift,
  Package,
  Plus,
  Trash2
} from 'feather-icons-react';
import { useTheme } from '../ThemeContext';



const EventDetails = ({ event, onBack }) => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('general');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});

  useEffect(() => {
    if (!event) {
      console.error('No se proporcionó evento para mostrar');
      return;
    }
    console.log('Mostrando evento:', event);
  }, [event]);

  const handleSave = async () => {
    // TODO: Guardar cambios en la base de datos
    console.log('Guardando cambios:', editData);
    setIsEditing(false);
  };

  const handleChecklistToggle = (checklistType, taskId) => {
    // TODO: Implementar actualización de checklist en la base de datos
    console.log('Toggle checklist:', checklistType, taskId);
  };

  // Validación de evento
  if (!event) {
    return (
      <div style={{
        padding: '30px',
        textAlign: 'center',
        color: colors.textSecondary
      }}>
        <div style={{ fontSize: '18px', marginBottom: '8px' }}>Evento no encontrado</div>
        <div style={{ fontSize: '14px' }}>El evento que buscas no existe o ha sido eliminado.</div>
        {onBack && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            style={{
              marginTop: '20px',
              padding: '10px 20px',
              background: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Volver al Dashboard
          </motion.button>
        )}
      </div>
    );
  }

  const tabs = [
    { key: 'general', label: 'Información General', icon: FileText },
    { key: 'menu', label: 'Menú y Alimentación', icon: Coffee },
    { key: 'logistics', label: 'Logística', icon: Truck },
    { key: 'staff', label: 'Personal', icon: Users },
    { key: 'checklists', label: 'Checklists', icon: CheckCircle }
  ];

  const renderGeneralInfo = () => (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Información del Cliente */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <User size={18} />
          Información del Cliente
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Nombre</label>
            <div style={{ color: colors.text, fontSize: '16px', fontWeight: '500' }}>{event.client_name}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Teléfono</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.client_phone}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Email</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.client_email}</div>
          </div>
        </div>
      </div>

      {/* Detalles del Evento */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Calendar size={18} />
          Detalles del Evento
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Tipo de Evento</label>
            <div style={{ color: colors.text, fontSize: '16px', fontWeight: '500' }}>{event.event_type}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Fecha</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{new Date(event.date).toLocaleDateString('es-ES')}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Hora</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.time}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Invitados</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.guests} personas</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Ubicación</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.location}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Presupuesto</label>
            <div style={{ color: colors.primary, fontSize: '16px', fontWeight: '600' }}>{event.budget ? event.budget.toLocaleString('es-ES') : '0'}€</div>
          </div>
        </div>
      </div>

      {/* Notas */}
      {event.notes && (
        <div style={{
          background: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          padding: '24px'
        }}>
          <h3 style={{
            color: colors.text,
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px'
          }}>
            Notas Adicionales
          </h3>
          <div style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6' }}>
            {event.notes}
          </div>
        </div>
      )}
    </div>
  );

  const renderMenu = () => (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Aperitivos */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Coffee size={18} />
          Aperitivos
        </h3>
        <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.8' }}>
          {event.menu.appetizers.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Platos Principales */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Package size={18} />
          Platos Principales
        </h3>
        <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.8' }}>
          {event.menu.mainCourse.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Postres */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Coffee size={18} />
          Postres
        </h3>
        <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.8' }}>
          {event.menu.desserts.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Bebidas */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '16px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Gift size={18} />
          Bebidas
        </h3>
        <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.8' }}>
          {event.menu.beverages.map((item, index) => (
            <li key={index}>{item}</li>
          ))}
        </ul>
      </div>

      {/* Requisitos Especiales */}
      {event.menu.specialRequirements.length > 0 && (
        <div style={{
          background: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          padding: '24px'
        }}>
          <h3 style={{
            color: colors.text,
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <AlertCircle size={18} />
            Requisitos Especiales
          </h3>
          <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.8' }}>
            {event.menu.specialRequirements.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );

  const renderLogistics = () => (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Detalles del Servicio */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          Detalles del Servicio
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Tipo de Servicio</label>
            <div style={{ color: colors.text, fontSize: '16px', fontWeight: '500' }}>Servicio Completo</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Duración</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.serviceDetails.duration}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Tiempo de Montaje</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.serviceDetails.setupTime}</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Personal Requerido</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.serviceDetails.staffRequired} personas</div>
          </div>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Vehículos</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.serviceDetails.vehicles} vehículos</div>
          </div>
        </div>
      </div>

      {/* Logística */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          Logística
        </h3>

        <div style={{ display: 'grid', gap: '16px' }}>
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Hora de Entrega</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.logistics.deliveryTime}</div>
          </div>
          
          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Requisitos de Montaje</label>
            <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6', marginTop: '8px' }}>
              {event.logistics.setupRequirements.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Equipamiento</label>
            <ul style={{ color: colors.text, fontSize: '14px', lineHeight: '1.6', marginTop: '8px' }}>
              {event.logistics.equipment.map((item, index) => (
                <li key={index}>{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <label style={{ color: colors.textSecondary, fontSize: '12px', fontWeight: '500' }}>Estacionamiento</label>
            <div style={{ color: colors.text, fontSize: '16px' }}>{event.logistics.parking}</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStaff = () => (
    <div style={{
      background: colors.surface,
      borderRadius: '12px',
      border: `1px solid ${colors.border}`,
      padding: '24px'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '20px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          margin: 0
        }}>
          Personal Asignado
        </h3>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            background: colors.primary,
            color: 'white',
            border: 'none',
            padding: '8px 16px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          <Plus size={14} />
          Añadir Personal
        </motion.button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {event.staff.map((member) => (
          <div key={member.id} style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            background: colors.background,
            borderRadius: '8px',
            border: `1px solid ${colors.border}`
          }}>
            <div>
              <div style={{ color: colors.text, fontSize: '16px', fontWeight: '500' }}>
                {member.name}
              </div>
              <div style={{ color: colors.textSecondary, fontSize: '14px' }}>
                {member.role}
              </div>
            </div>
            <div style={{ color: colors.textSecondary, fontSize: '14px' }}>
              {member.phone}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderChecklists = () => (
    <div style={{ display: 'grid', gap: '24px' }}>
      {/* Checklist de Preparación */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          Checklist de Preparación
        </h3>

        <div style={{ display: 'grid', gap: '12px' }}>
          {event.preparationChecklist.map((task) => (
            <div key={task.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: colors.background,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleChecklistToggle('preparation', task.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: task.completed ? colors.primary : colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckCircle size={16} />
              </motion.button>
              
              <div style={{ flex: 1 }}>
                <div style={{
                  color: task.completed ? colors.textSecondary : colors.text,
                  fontSize: '14px',
                  textDecoration: task.completed ? 'line-through' : 'none'
                }}>
                  {task.task}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
                  Asignado a: {task.assignedTo}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Checklist de Retorno */}
      <div style={{
        background: colors.surface,
        borderRadius: '12px',
        border: `1px solid ${colors.border}`,
        padding: '24px'
      }}>
        <h3 style={{
          color: colors.text,
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '20px'
        }}>
          Checklist de Retorno
        </h3>

        <div style={{ display: 'grid', gap: '12px' }}>
          {event.returnChecklist.map((task) => (
            <div key={task.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '12px',
              background: colors.background,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`
            }}>
              <motion.button
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => handleChecklistToggle('return', task.id)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '4px',
                  borderRadius: '4px',
                  color: task.completed ? colors.primary : colors.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <CheckCircle size={16} />
              </motion.button>
              
              <div style={{ flex: 1 }}>
                <div style={{
                  color: task.completed ? colors.textSecondary : colors.text,
                  fontSize: '14px',
                  textDecoration: task.completed ? 'line-through' : 'none'
                }}>
                  {task.task}
                </div>
                <div style={{ color: colors.textSecondary, fontSize: '12px' }}>
                  Asignado a: {task.assignedTo}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'general':
        return renderGeneralInfo();
      case 'menu':
        return renderMenu();
      case 'logistics':
        return renderLogistics();
      case 'staff':
        return renderStaff();
      case 'checklists':
        return renderChecklists();
      default:
        return renderGeneralInfo();
    }
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px'
      }}>
        <div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textSecondary,
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '8px'
            }}
          >
            ← Volver al Dashboard
          </motion.button>
          <h1 style={{
            color: colors.text,
            fontSize: '28px',
            fontWeight: '700',
            margin: 0
          }}>
            {event.client_name} - {event.event_type}
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setIsEditing(!isEditing)}
            style={{
              background: isEditing ? colors.primary : colors.surface,
              color: isEditing ? 'white' : colors.text,
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
            <Edit size={16} />
            {isEditing ? 'Cancelar' : 'Editar'}
          </motion.button>

          {isEditing && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSave}
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
              <Save size={16} />
              Guardar
            </motion.button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        gap: '8px',
        marginBottom: '24px',
        borderBottom: `1px solid ${colors.border}`,
        overflowX: 'auto'
      }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          
          return (
            <motion.button
              key={tab.key}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '12px 20px',
                color: isActive ? colors.primary : colors.textSecondary,
                fontSize: '14px',
                fontWeight: isActive ? '600' : '400',
                borderBottom: isActive ? `2px solid ${colors.primary}` : '2px solid transparent',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Icon size={16} />
              {tab.label}
            </motion.button>
          );
        })}
      </div>

      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {renderContent()}
      </motion.div>
    </div>
  );
};

export default EventDetails; 