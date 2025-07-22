import React from 'react';
import { useCatering } from './CateringContext';
import CateringDashboard from './CateringDashboard';
import NewEventForm from './NewEventForm';
import EventDetails from './EventDetails';
import BudgetPage from './BudgetPage';
import CalendarPage from './CalendarPage';

const CateringApp = () => {
  const { currentView, selectedEvent, selectedBudget, goBack } = useCatering();

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