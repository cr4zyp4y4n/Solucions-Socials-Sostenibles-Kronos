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
  const [navPayload, setNavPayload] = useState(null);

  const navigateTo = (view, payload = null) => {
    setCurrentView(view);
    setNavPayload(payload || null);
  };

  const clearNavPayload = () => setNavPayload(null);

  const value = useMemo(
    () => ({ currentView, navigateTo, navPayload, clearNavPayload }),
    [currentView, navPayload]
  );

  return (
    <ObradorContext.Provider value={value}>
      {children}
    </ObradorContext.Provider>
  );
}
