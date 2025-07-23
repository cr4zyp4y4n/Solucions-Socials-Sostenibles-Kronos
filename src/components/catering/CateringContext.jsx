import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';

// Función para crear notificaciones de cambio de estado
const createStatusChangeNotification = async (event, oldStatus, newStatus, user) => {
  if (!user?.id) return;

  const statusLabels = {
    'recibido': 'Recibido',
    'aceptado': 'Aceptado',
    'en_preparacion': 'En Preparación',
    'finalizado': 'Finalizado',
    'rechazado': 'Rechazado'
  };

  const statusColors = {
    'recibido': '#3B82F6',
    'aceptado': '#10B981',
    'en_preparacion': '#F59E0B',
    'finalizado': '#6B7280',
    'rechazado': '#EF4444'
  };

  try {
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id');

    if (usersError) {
      console.error('Error obteniendo usuarios:', usersError);
      return;
    }

    const notifications = users.map(u => ({
      recipient_id: u.id,
      sender_id: user.id,
      title: 'Estado de Evento Actualizado',
      message: `El evento "${event.event_type}" ha cambiado de estado: ${statusLabels[oldStatus]} → ${statusLabels[newStatus]}`,
      type: 'system',
      data: {
        event_id: event.id,
        event_type: event.event_type,
        status: newStatus,
        old_status: oldStatus
      },
      read_at: null,
      created_at: new Date().toISOString()
    }));

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('Error creando notificaciones de cambio de estado:', notificationError);
    }
  } catch (error) {
    console.error('Error en notificación de cambio de estado:', error);
  }
};

// Función para crear notificaciones inteligentes de edición de eventos
const createEventEditNotification = async (event, oldData, newData, user) => {
  if (!user?.id) return;

  // Definir campos importantes que requieren notificación
  const importantFields = {
    date: 'Fecha',
    time: 'Hora', 
    location: 'Ubicación',
    guests: 'Invitados',
    event_type: 'Tipo de Evento',
    client_name: 'Cliente',
    client_phone: 'Teléfono',
    client_email: 'Email'
  };

  // Detectar cambios importantes
  const changes = [];
  for (const [field, label] of Object.entries(importantFields)) {
    if (oldData[field] !== newData[field]) {
      const oldValue = oldData[field];
      const newValue = newData[field];
      
      // Formatear valores según el tipo de campo
      let formattedOldValue = oldValue;
      let formattedNewValue = newValue;
      
      if (field === 'date') {
        formattedOldValue = new Date(oldValue).toLocaleDateString('es-ES');
        formattedNewValue = new Date(newValue).toLocaleDateString('es-ES');
      } else if (field === 'guests') {
        formattedOldValue = `${oldValue} personas`;
        formattedNewValue = `${newValue} personas`;
      } else if (field === 'time') {
        formattedOldValue = oldValue;
        formattedNewValue = newValue;
      }
      
      changes.push({
        field: label,
        oldValue: formattedOldValue,
        newValue: formattedNewValue
      });
    }
  }

  // Solo crear notificación si hay cambios importantes
  if (changes.length === 0) return;

  // Crear mensaje de notificación
  let message = `El evento "${event.event_type}" ha sido actualizado:`;
  changes.forEach(change => {
    message += `\n• ${change.field}: ${change.oldValue} → ${change.newValue}`;
  });

  // Obtener todos los usuarios para enviar la notificación
  try {
    const { data: users, error: usersError } = await supabase
      .from('user_profiles')
      .select('id');

    if (usersError) {
      console.error('Error obteniendo usuarios:', usersError);
      return;
    }

    // Crear notificaciones para todos los usuarios
    const notifications = users.map(user => ({
      recipient_id: user.id,
      sender_id: user.id,
      title: 'Evento de Catering Actualizado',
      message: message,
      type: 'system',
      data: {
        event_id: event.id,
        event_type: event.event_type,
        changes: changes
      },
      read_at: null,
      created_at: new Date().toISOString()
    }));

    const { error: notificationError } = await supabase
      .from('notifications')
      .insert(notifications);

    if (notificationError) {
      console.error('Error creando notificaciones:', notificationError);
    }
  } catch (error) {
    console.error('Error en notificación de edición:', error);
  }
};

const CateringContext = createContext();

export const useCatering = () => {
  const context = useContext(CateringContext);
  if (!context) {
    throw new Error('useCatering debe ser usado dentro de un CateringProvider');
  }
  return context;
};

export const CateringProvider = ({ children }) => {
  const [events, setEvents] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [orders, setOrders] = useState([]);
  const [checklists, setChecklists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentView, setCurrentView] = useState('dashboard');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedBudget, setSelectedBudget] = useState(null);

  // Estados para formularios
  const [showNewEventForm, setShowNewEventForm] = useState(false);
  const [showEventDetails, setShowEventDetails] = useState(false);
  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [navigationHistory, setNavigationHistory] = useState([]);

  // Cargar eventos desde Supabase
  const loadEvents = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_events')
        .select('*')
        .order('date', { ascending: true });

      if (error) {
        console.error('Error cargando eventos:', error);
        return;
      }

      setEvents(data || []);
    } catch (error) {
      console.error('Error cargando eventos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cargar presupuestos desde Supabase
  const loadBudgets = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_budgets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error cargando presupuestos:', error);
        return;
      }

      setBudgets(data || []);
    } catch (error) {
      console.error('Error cargando presupuestos:', error);
    } finally {
      setLoading(false);
    }
  };

  // Crear nuevo evento
  const createEvent = async (eventData, user = null) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_events')
        .insert([{
          ...eventData,
          status: 'recibido',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creando evento:', error);
        throw error;
      }

      setEvents(prev => [data, ...prev]);
      setShowNewEventForm(false);

      // Crear notificación para todos los usuarios sobre el nuevo evento
      if (user) {
        try {
          const { data: users, error: usersError } = await supabase
            .from('user_profiles')
            .select('id');

          if (!usersError && users) {
            const notifications = users.map(u => ({
              recipient_id: u.id,
              sender_id: user.id,
              title: 'Nuevo Evento de Catering',
              message: `Se ha creado un nuevo evento: "${data.event_type}" para ${data.client_name} el ${new Date(data.date).toLocaleDateString('es-ES')} a las ${data.time}`,
              type: 'system',
              data: {
                event_id: data.id,
                event_type: data.event_type,
                client_name: data.client_name
              },
              read_at: null,
              created_at: new Date().toISOString()
            }));

            await supabase
              .from('notifications')
              .insert(notifications);
          }
        } catch (notificationError) {
          console.error('Error creando notificaciones de nuevo evento:', notificationError);
        }
      }

      return data;
    } catch (error) {
      console.error('Error creando evento:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar evento
  const updateEvent = async (eventId, updates, user = null) => {
    setLoading(true);
    try {
      // Obtener el evento actual antes de actualizarlo
      const { data: oldEvent, error: fetchError } = await supabase
        .from('catering_events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (fetchError) {
        console.error('Error obteniendo evento actual:', fetchError);
        throw fetchError;
      }

      // Actualizar el evento
      const { data, error } = await supabase
        .from('catering_events')
        .update(updates)
        .eq('id', eventId)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando evento:', error);
        throw error;
      }

      setEvents(prev => prev.map(event => 
        event.id === eventId ? data : event
      ));

      // Crear notificación inteligente si hay cambios importantes
      if (user) {
        // Si es un cambio de estado, crear notificación específica
        if (updates.status && updates.status !== oldEvent.status) {
          await createStatusChangeNotification(data, oldEvent.status, updates.status, user);
        } else {
          // Si son otros cambios, crear notificación de edición
          await createEventEditNotification(data, oldEvent, data, user);
        }
      }

      return data;
    } catch (error) {
      console.error('Error actualizando evento:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Eliminar evento
  const deleteEvent = async (eventId) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('catering_events')
        .delete()
        .eq('id', eventId);

      if (error) {
        console.error('Error eliminando evento:', error);
        throw error;
      }

      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error) {
      console.error('Error eliminando evento:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Crear presupuesto
  const createBudget = async (budgetData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_budgets')
        .insert([{
          ...budgetData,
          status: 'borrador',
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creando presupuesto:', error);
        throw error;
      }

      setBudgets(prev => [data, ...prev]);
      return data;
    } catch (error) {
      console.error('Error creando presupuesto:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar presupuesto
  const updateBudget = async (budgetId, updates) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_budgets')
        .update(updates)
        .eq('id', budgetId)
        .select()
        .single();

      if (error) {
        console.error('Error actualizando presupuesto:', error);
        throw error;
      }

      setBudgets(prev => prev.map(budget => 
        budget.id === budgetId ? data : budget
      ));
      return data;
    } catch (error) {
      console.error('Error actualizando presupuesto:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Enviar presupuesto
  const sendBudget = async (budgetId) => {
    return await updateBudget(budgetId, {
      status: 'enviado',
      sent_at: new Date().toISOString()
    });
  };

  // Aceptar presupuesto
  const acceptBudget = async (budgetId) => {
    const budget = await updateBudget(budgetId, {
      status: 'aceptado',
      accepted_at: new Date().toISOString()
    });

    // Actualizar el evento relacionado
    if (budget.event_id) {
      await updateEvent(budget.event_id, {
        status: 'aceptado',
        budget_id: budget.id
      });
    }

    return budget;
  };

  // Rechazar presupuesto
  const rejectBudget = async (budgetId, reason) => {
    return await updateBudget(budgetId, {
      status: 'rechazado',
      rejected_at: new Date().toISOString(),
      rejection_reason: reason
    });
  };

  // Navegación
  const navigateTo = (view, params = {}) => {
    // Guardar el estado actual en el historial (excepto si es dashboard)
    if (currentView !== 'dashboard') {
      setNavigationHistory(prev => [...prev, {
        view: currentView,
        event: selectedEvent,
        budget: selectedBudget
      }]);
    }
    
    setCurrentView(view);
    if (params.event) setSelectedEvent(params.event);
    if (params.budget) setSelectedBudget(params.budget);
  };

  const goBack = () => {
    if (navigationHistory.length > 0) {
      // Volver al estado anterior del historial
      const previousState = navigationHistory[navigationHistory.length - 1];
      setNavigationHistory(prev => prev.slice(0, -1));
      
      setCurrentView(previousState.view);
      setSelectedEvent(previousState.event);
      setSelectedBudget(previousState.budget);
    } else {
      // Si no hay historial, ir al dashboard
      setCurrentView('dashboard');
      setSelectedEvent(null);
      setSelectedBudget(null);
    }
  };

  // Navegar directamente sin guardar en historial (para notificaciones)
  const navigateDirectly = (view, params = {}) => {
    setCurrentView(view);
    if (params.event) setSelectedEvent(params.event);
    if (params.budget) setSelectedBudget(params.budget);
  };

  // Cargar datos iniciales
  useEffect(() => {
    loadEvents();
    loadBudgets();
  }, []);

  const value = {
    // Estado
    events,
    budgets,
    orders,
    checklists,
    loading,
    currentView,
    selectedEvent,
    selectedBudget,
    showNewEventForm,
    showEventDetails,
    showBudgetForm,

    // Acciones de eventos
    createEvent,
    updateEvent,
    deleteEvent,
    loadEvents,

    // Acciones de presupuestos
    createBudget,
    updateBudget,
    sendBudget,
    acceptBudget,
    rejectBudget,
    loadBudgets,

    // Navegación
    navigateTo,
    navigateDirectly,
    goBack,
    setShowNewEventForm,
    setShowEventDetails,
    setShowBudgetForm,

    // Utilidades
    getEventById: (id) => events.find(event => event.id === id),
    getBudgetById: (id) => budgets.find(budget => budget.id === id),
    getEventsByStatus: (status) => events.filter(event => event.status === status),
    getBudgetsByStatus: (status) => budgets.filter(budget => budget.status === status)
  };

  return (
    <CateringContext.Provider value={value}>
      {children}
    </CateringContext.Provider>
  );
}; 