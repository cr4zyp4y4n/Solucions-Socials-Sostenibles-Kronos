import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../../config/supabase';

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