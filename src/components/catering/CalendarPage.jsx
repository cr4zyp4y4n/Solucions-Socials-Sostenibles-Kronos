import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  Search,
  Eye,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  XCircle,
  ExternalLink
} from 'feather-icons-react';
import { useTheme } from '../ThemeContext';

// Mock data para eventos del calendario
const mockCalendarEvents = [
  {
    id: 1,
    title: 'Boda - María García',
    date: '2024-02-15',
    time: '19:00',
    location: 'Finca Los Olivos',
    guests: 120,
    status: 'aceptado',
    type: 'catering',
    color: '#10B981'
  },
  {
    id: 2,
    title: 'Cumpleaños - Carlos Rodríguez',
    date: '2024-02-20',
    time: '14:00',
    location: 'Restaurante El Mirador',
    guests: 45,
    status: 'recibido',
    type: 'catering',
    color: '#3B82F6'
  },
  {
    id: 3,
    title: 'Evento Corporativo - Ana López',
    date: '2024-02-25',
    time: '09:00',
    location: 'Hotel Plaza Mayor',
    guests: 80,
    status: 'en_preparacion',
    type: 'catering',
    color: '#F59E0B'
  },
  {
    id: 4,
    title: 'Reunión de Equipo',
    date: '2024-02-18',
    time: '10:00',
    location: 'Oficina SSS',
    guests: 8,
    status: 'confirmado',
    type: 'interno',
    color: '#8B5CF6'
  }
];

const statusColors = {
  recibido: '#3B82F6',
  aceptado: '#10B981',
  en_preparacion: '#F59E0B',
  finalizado: '#6B7280',
  rechazado: '#EF4444',
  confirmado: '#8B5CF6'
};

const statusLabels = {
  recibido: 'Recibido',
  aceptado: 'Aceptado',
  en_preparacion: 'En Preparación',
  finalizado: 'Finalizado',
  rechazado: 'Rechazado',
  confirmado: 'Confirmado'
};

const CalendarPage = () => {
  const { colors } = useTheme();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [events, setEvents] = useState(mockCalendarEvents);
  const [filterType, setFilterType] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [viewMode, setViewMode] = useState('month'); // month, week, day

  // Generar calendario mensual
  const generateCalendar = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const calendar = [];
    const currentDate = new Date(startDate);

    while (currentDate <= lastDay || calendar.length < 42) {
      calendar.push(new Date(currentDate));
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return calendar;
  };

  const calendar = generateCalendar(currentDate);

  // Obtener eventos para una fecha específica
  const getEventsForDate = (date) => {
    const dateStr = date.toISOString().split('T')[0];
    return events.filter(event => event.date === dateStr);
  };

  // Navegación del calendario
  const goToPreviousMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() - 1);
      return newDate;
    });
  };

  const goToNextMonth = () => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      newDate.setMonth(newDate.getMonth() + 1);
      return newDate;
    });
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Filtrar eventos
  const filteredEvents = events.filter(event => {
    const matchesType = filterType === 'todos' || event.type === filterType;
    const matchesStatus = filterStatus === 'todos' || event.status === filterStatus;
    const matchesSearch = event.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         event.location.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesType && matchesStatus && matchesSearch;
  });

  // Formatear fecha
  const formatDate = (date) => {
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long'
    });
  };

  // Verificar si una fecha es hoy
  const isToday = (date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  // Verificar si una fecha es del mes actual
  const isCurrentMonth = (date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const handleDateClick = (date) => {
    setSelectedDate(date);
    const eventsForDate = getEventsForDate(date);
    if (eventsForDate.length > 0) {
      setSelectedEvent(eventsForDate[0]);
    }
  };

  const handleEventClick = (event) => {
    setSelectedEvent(event);
  };

  const handleNewEvent = () => {
    // TODO: Implementar creación de evento
    console.log('Nuevo evento');
  };

  const handleExportToGoogle = () => {
    // TODO: Implementar exportación a Google Calendar
    console.log('Exportar a Google Calendar');
  };

  return (
    <div style={{ padding: '30px', maxWidth: '1400px', margin: '0 auto' }}>
      {/* Header del calendario */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '32px',
          flexWrap: 'wrap',
          gap: '20px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{
            color: colors.text,
            fontSize: '28px',
            fontWeight: '700',
            margin: 0
          }}>
            Calendario de Eventos
          </h1>
          
          <div style={{ display: 'flex', gap: '8px' }}>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToPreviousMonth}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: colors.textSecondary
              }}
            >
              <ChevronLeft size={16} />
            </motion.button>
            
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={goToNextMonth}
              style={{
                background: colors.surface,
                border: `1px solid ${colors.border}`,
                padding: '8px',
                borderRadius: '6px',
                cursor: 'pointer',
                color: colors.textSecondary
              }}
            >
              <ChevronRight size={16} />
            </motion.button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={goToToday}
            style={{
              background: colors.primary,
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer'
            }}
          >
            Hoy
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleNewEvent}
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
            <Plus size={16} />
            Nuevo Evento
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleExportToGoogle}
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
            <ExternalLink size={16} />
            Exportar a Google
          </motion.button>
        </div>
      </motion.div>

      {/* Controles de filtro */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        style={{
          display: 'flex',
          gap: '16px',
          marginBottom: '24px',
          flexWrap: 'wrap',
          alignItems: 'center'
        }}
      >
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
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
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
          <option value="todos">Todos los tipos</option>
          <option value="catering">Catering</option>
          <option value="interno">Interno</option>
        </select>

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
      </motion.div>

      {/* Calendario */}
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
        {/* Header del mes */}
        <div style={{
          padding: '20px 24px',
          borderBottom: `1px solid ${colors.border}`,
          textAlign: 'center'
        }}>
          <h2 style={{
            color: colors.text,
            fontSize: '24px',
            fontWeight: '700',
            margin: 0
          }}>
            {formatDate(currentDate)}
          </h2>
        </div>

        {/* Días de la semana */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: `1px solid ${colors.border}`
        }}>
          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map(day => (
            <div key={day} style={{
              padding: '12px',
              textAlign: 'center',
              fontWeight: '600',
              color: colors.textSecondary,
              fontSize: '14px',
              borderRight: `1px solid ${colors.border}`
            }}>
              {day}
            </div>
          ))}
        </div>

        {/* Días del mes */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: '600px'
        }}>
          {calendar.map((date, index) => {
            const eventsForDate = getEventsForDate(date);
            const isCurrentMonthDate = isCurrentMonth(date);
            const isTodayDate = isToday(date);
            const isSelected = selectedDate && date.toDateString() === selectedDate.toDateString();

            return (
              <motion.div
                key={index}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleDateClick(date)}
                style={{
                  padding: '8px',
                  borderRight: `1px solid ${colors.border}`,
                  borderBottom: `1px solid ${colors.border}`,
                  minHeight: '100px',
                  cursor: 'pointer',
                  background: isSelected ? colors.primary + '10' : 'transparent',
                  position: 'relative'
                }}
              >
                <div style={{
                  color: isCurrentMonthDate ? colors.text : colors.textSecondary,
                  fontSize: '14px',
                  fontWeight: isTodayDate ? '700' : '400',
                  marginBottom: '8px',
                  textAlign: 'center',
                  background: isTodayDate ? colors.primary : 'transparent',
                  color: isTodayDate ? 'white' : (isCurrentMonthDate ? colors.text : colors.textSecondary),
                  borderRadius: '50%',
                  width: '24px',
                  height: '24px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 8px auto'
                }}>
                  {date.getDate()}
                </div>

                {/* Eventos del día */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  {eventsForDate.slice(0, 3).map((event, eventIndex) => (
                    <motion.div
                      key={event.id}
                      whileHover={{ scale: 1.05 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEventClick(event);
                      }}
                      style={{
                        background: event.color,
                        color: 'white',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {event.title}
                    </motion.div>
                  ))}
                  {eventsForDate.length > 3 && (
                    <div style={{
                      color: colors.textSecondary,
                      fontSize: '10px',
                      textAlign: 'center',
                      padding: '2px'
                    }}>
                      +{eventsForDate.length - 3} más
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Panel lateral de eventos del día seleccionado */}
      {selectedDate && (
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          style={{
            position: 'fixed',
            top: '50%',
            right: '20px',
            transform: 'translateY(-50%)',
            background: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            padding: '24px',
            width: '320px',
            maxHeight: '80vh',
            overflow: 'auto',
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.border} transparent`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
            zIndex: 100
          }}
        >
          <h3 style={{
            color: colors.text,
            fontSize: '18px',
            fontWeight: '600',
            marginBottom: '16px'
          }}>
            {selectedDate.toLocaleDateString('es-ES', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            })}
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {getEventsForDate(selectedDate).length === 0 ? (
              <div style={{
                color: colors.textSecondary,
                fontSize: '14px',
                textAlign: 'center',
                padding: '20px'
              }}>
                No hay eventos para este día
              </div>
            ) : (
              getEventsForDate(selectedDate).map(event => (
                <motion.div
                  key={event.id}
                  whileHover={{ scale: 1.02 }}
                  style={{
                    background: colors.background,
                    borderRadius: '8px',
                    padding: '12px',
                    border: `1px solid ${colors.border}`,
                    cursor: 'pointer'
                  }}
                  onClick={() => handleEventClick(event)}
                >
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '8px'
                  }}>
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: event.color,
                      flexShrink: 0
                    }} />
                    <div style={{
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '600'
                    }}>
                      {event.title}
                    </div>
                  </div>
                  
                  <div style={{
                    color: colors.textSecondary,
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      {event.time}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} />
                      {event.location}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Users size={12} />
                      {event.guests} personas
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </motion.div>
      )}

      {/* Modal de detalles del evento */}
      {selectedEvent && (
        <EventDetailsModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  );
};

// Componente Modal para detalles del evento
const EventDetailsModal = ({ event, onClose }) => {
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
          maxWidth: '500px',
          width: '100%'
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
            {event.title}
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

        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 12px',
            background: event.color + '15',
            borderRadius: '6px'
          }}>
            <div style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: event.color
            }} />
            <span style={{
              color: event.color,
              fontSize: '14px',
              fontWeight: '600'
            }}>
              {statusLabels[event.status]}
            </span>
          </div>

          <div style={{ display: 'grid', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={16} style={{ color: colors.textSecondary }} />
              <span style={{ color: colors.text, fontSize: '14px' }}>
                {new Date(event.date).toLocaleDateString('es-ES')}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Clock size={16} style={{ color: colors.textSecondary }} />
              <span style={{ color: colors.text, fontSize: '14px' }}>
                {event.time}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MapPin size={16} style={{ color: colors.textSecondary }} />
              <span style={{ color: colors.text, fontSize: '14px' }}>
                {event.location}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={16} style={{ color: colors.textSecondary }} />
              <span style={{ color: colors.text, fontSize: '14px' }}>
                {event.guests} personas
              </span>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '12px',
            marginTop: '16px'
          }}>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
              <Eye size={16} />
              Ver Detalles
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
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
              <Edit size={16} />
              Editar
            </motion.button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default CalendarPage; 