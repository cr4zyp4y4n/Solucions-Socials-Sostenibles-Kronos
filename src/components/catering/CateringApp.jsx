import React, { useEffect } from 'react';
import { useCatering } from './CateringContext';
import CateringDashboard from './CateringDashboard';
import NewEventForm from './NewEventForm';
import EventDetails from './EventDetails';
import BudgetPage from './BudgetPage';
import CalendarPage from './CalendarPage';

const CateringApp = ({ eventId = null, onEventIdProcessed }) => {
  const { currentView, selectedEvent, selectedBudget, goBack, events, navigateTo, navigateDirectly } = useCatering();

  // Navegar automáticamente al evento si se proporciona un eventId
  useEffect(() => {
    if (eventId && events.length > 0) {
      const targetEvent = events.find(event => event.id === eventId);
      if (targetEvent) {
        // Navegar directamente sin guardar en historial cuando viene de notificación
        navigateDirectly('event-details', { event: targetEvent });
        // Notificar que el eventId ha sido procesado para limpiarlo
        if (onEventIdProcessed) {
          onEventIdProcessed();
        }
      }
    }
  }, [eventId, events, navigateDirectly, onEventIdProcessed]);

  const renderCurrentView = () => {
    switch (currentView) {
      case 'dashboard':
        return <CateringDashboard />;
      case 'new-event':
        return <NewEventForm />;
      case 'event-details':
        return <EventDetails event={selectedEvent} onBack={goBack} />;
      case 'budget':
        return <BudgetPage budget={selectedBudget} onBack={goBack} />;
      case 'calendar':
        return <CalendarPage onBack={goBack} />;
      default:
        return <CateringDashboard />;
    }
  };

  return (
    <div style={{ width: '100%', height: '100%' }}>
      {renderCurrentView()}
    </div>
  );
};

export default CateringApp; 