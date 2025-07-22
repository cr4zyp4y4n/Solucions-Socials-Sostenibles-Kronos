import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  Plus,
  Filter,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  XCircle,
  Clock as ClockIcon
} from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import { useCatering } from './CateringContext';



const statusColors = {
  recibido: '#3B82F6',
  aceptado: '#10B981',
  en_preparacion: '#F59E0B',
  finalizado: '#6B7280',
  rechazado: '#EF4444'
};

const statusLabels = {
  recibido: 'Recibido',
  aceptado: 'Aceptado',
  en_preparacion: 'En Preparación',
  finalizado: 'Finalizado',
  rechazado: 'Rechazado'
};

const CateringDashboard = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { events, navigateTo } = useCatering();
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);

  const filteredEvents = events.filter(event => {
    const matchesStatus = filterStatus === 'todos' || event.status === filterStatus;
    const matchesSearch = (event.client_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (event.event_type || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const getStatusCount = (status) => {
    return events.filter(event => event.status === status).length;
  };

  const handleNewEvent = () => {
    navigateTo('new-event');
  };

  const handleViewEvent = (event) => {
    navigateTo('event-details', { event });
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
            {events.length}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Total Eventos</div>
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
          <div style={{ color: statusColors.en_preparacion, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            {getStatusCount('en_preparacion')}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>En Preparación</div>
        </div>

        <div style={{
          background: colors.surface,
          padding: '24px',
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <div style={{ color: statusColors.recibido, fontSize: '32px', fontWeight: '700', marginBottom: '8px' }}>
            {getStatusCount('recibido')}
          </div>
          <div style={{ color: colors.textSecondary, fontSize: '14px' }}>Pendientes</div>
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
              placeholder="Buscar eventos..."
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
            <option value="recibido">Recibidos</option>
            <option value="aceptado">Aceptados</option>
            <option value="en_preparacion">En Preparación</option>
            <option value="finalizado">Finalizados</option>
            <option value="rechazado">Rechazados</option>
          </select>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleNewEvent}
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
          Nuevo Evento
        </motion.button>
      </motion.div>

      {/* Lista de eventos */}
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
            Próximos Eventos ({filteredEvents.length})
          </h3>
        </div>

        <div style={{ maxHeight: '600px', overflow: 'auto' }}>
          {filteredEvents.length === 0 ? (
            <div style={{
              padding: '60px 24px',
              textAlign: 'center',
              color: colors.textSecondary
            }}>
              <Calendar size={48} style={{ marginBottom: '16px', opacity: 0.5 }} />
              <div style={{ fontSize: '16px', marginBottom: '8px' }}>No hay eventos</div>
              <div style={{ fontSize: '14px' }}>Crea tu primer evento para empezar</div>
            </div>
          ) : (
            filteredEvents.map((event, index) => (
              <motion.div
                key={event.id}
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
                onClick={() => handleViewEvent(event)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flex: 1 }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    background: statusColors[event.status],
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
                        {event.client_name}
                      </div>
                      <div style={{
                        padding: '4px 8px',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        background: statusColors[event.status] + '15',
                        color: statusColors[event.status]
                      }}>
                        {statusLabels[event.status]}
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
                        {new Date(event.date).toLocaleDateString('es-ES')}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <ClockIcon size={14} />
                        {event.time}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <MapPin size={14} />
                        {event.location}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Users size={14} />
                        {event.guests} personas
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <div style={{
                    color: colors.textSecondary,
                    fontSize: '16px',
                    fontWeight: '600'
                  }}>
                    {event.budget ? event.budget.toLocaleString('es-ES') : '0'}€
                  </div>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewEvent(event);
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
                    <Eye size={16} />
                  </motion.button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default CateringDashboard; 