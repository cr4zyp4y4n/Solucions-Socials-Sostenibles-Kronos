import React, { createContext, useContext, useState, useMemo } from 'react';

const ObradorContext = createContext();

export function useObrador() {
  const ctx = useContext(ObradorContext);
  if (!ctx) {
    throw new Error('useObrador ha d\'usar-se dins ObradorProvider');
  }
  return ctx;
}

export function ObradorProvider({ children }) {
  const [currentView, setCurrentView] = useState('dashboard');

  const navigateTo = (view) => setCurrentView(view);

  const value = useMemo(
    () => ({ currentView, navigateTo }),
    [currentView]
  );

  return (
    <ObradorContext.Provider value={value}>
      {children}
    </ObradorContext.Provider>
  );
}
