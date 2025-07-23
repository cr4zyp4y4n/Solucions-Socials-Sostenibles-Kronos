import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';
import { useAuth } from '../AuthContext';

const CateringContext = createContext();

export const useCatering = () => {
  const context = useContext(CateringContext);
  if (!context) {
    throw new Error('useCatering debe ser usado dentro de un CateringProvider');
  }
  return context;
};

// Función helper para crear notificaciones de catering
const createCateringNotification = async (title, message, eventData = null) => {
  try {
    // Obtener todos los usuarios (excepto el creador)
    let query = supabase
      .from('user_profiles')
      .select('id');
    
    // Solo excluir al creador si existe
    if (eventData?.created_by) {
      query = query.neq('id', eventData.created_by);
    }
    
    const { data: users, error: usersError } = await query;

    if (usersError) {
      console.error('Error obteniendo usuarios para notificaciones:', usersError);
      return;
    }

    if (users && users.length > 0) {
      // Crear notificaciones para cada usuario
      const notifications = users.map(user => ({
        recipient_id: user.id,
        sender_id: eventData?.created_by || null,
        type: 'system',
        title: title,
        message: message,
        data: {
          event_id: eventData?.id,
          event_type: eventData?.event_type,
          client_name: eventData?.client_name,
          date: eventData?.date,
          status: eventData?.status
        }
      }));

      const { error } = await supabase
        .from('notifications')
        .insert(notifications);

      if (error) {
        console.error('Error creando notificaciones de catering:', error);
      } else {
        console.log(`Notificaciones enviadas a ${users.length} usuarios`);
      }
    } else {
      console.log('No hay usuarios para enviar notificaciones');
    }
  } catch (error) {
    console.error('Error en createCateringNotification:', error);
  }
};

export const CateringProvider = ({ children }) => {
  const { user } = useAuth();
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
  const createEvent = async (eventData) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_events')
        .insert([{
          ...eventData,
          status: 'recibido',
          created_at: new Date().toISOString(),
          created_by: user?.id || null
        }])
        .select()
        .single();

      if (error) {
        console.error('Error creando evento:', error);
        throw error;
      }

      setEvents(prev => [data, ...prev]);
      setShowNewEventForm(false);
      
      // Crear notificación para nuevo evento
      const notificationMessage = `Se ha creado un nuevo evento de catering: ${data.client_name} - ${data.event_type} para el ${data.date}`;
      await createCateringNotification('Nuevo Evento de Catering', notificationMessage, data);
      
      return data;
    } catch (error) {
      console.error('Error creando evento:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar evento
  const updateEvent = async (eventId, updates) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('catering_events')
        .update({
          ...updates,
          updated_by: user?.id || null,
          updated_at: new Date().toISOString()
        })
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
      
      // Crear notificación solo si el estado cambió
      const oldEvent = events.find(event => event.id === eventId);
      if (oldEvent && oldEvent.status !== data.status) {
        const statusMessages = {
          'aceptado': 'aceptado',
          'en_preparacion': 'en preparación',
          'finalizado': 'finalizado',
          'rechazado': 'rechazado'
        };
        
        const statusText = statusMessages[data.status] || data.status;
        const notificationMessage = `El evento de catering "${data.client_name}" ha cambiado su estado a: ${statusText}`;
        await createCateringNotification('Estado de Evento Actualizado', notificationMessage, data);
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
    setCurrentView(view);
    if (params.event) setSelectedEvent(params.event);
    if (params.budget) setSelectedBudget(params.budget);
  };

  const goBack = () => {
    setCurrentView('dashboard');
    setSelectedEvent(null);
    setSelectedBudget(null);
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