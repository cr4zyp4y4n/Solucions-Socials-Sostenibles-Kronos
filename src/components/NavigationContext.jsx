import React, { createContext, useContext, useState } from 'react';

const NavigationContext = createContext();

export const useNavigation = () => {
  const context = useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation debe ser usado dentro de NavigationProvider');
  }
  return context;
};

export const NavigationProvider = ({ children }) => {
  const [activeSection, setActiveSection] = useState('home');

  const navigateTo = (section) => {
    setActiveSection(section);
  };

  return (
    <NavigationContext.Provider value={{ activeSection, navigateTo }}>
      {children}
    </NavigationContext.Provider>
  );
}; 