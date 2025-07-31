import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme debe ser usado dentro de un ThemeProvider');
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    // Intentar recuperar el tema guardado en localStorage
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    // Guardar el tema en localStorage cuando cambie
    localStorage.setItem('darkMode', JSON.stringify(isDarkMode));
  }, [isDarkMode]);

  const toggleTheme = () => {
    setIsDarkMode(prev => !prev);
  };

  const theme = {
    isDarkMode,
    toggleTheme,
    colors: isDarkMode ? {
      // Colores modo oscuro
      background: '#1a1a1a',
      surface: '#2d2d2d',
      primary: '#4CAF50',
      secondary: '#666',
      text: '#ffffff',
      textSecondary: '#b0b0b0',
      border: '#404040',
      sidebar: '#2d2d2d',
      header: '#2d2d2d',
      card: '#333333',
      hover: '#404040',
      success: '#4CAF50',
      warning: '#ff9800',
      error: '#f44336',
      idoni: '#ff69b4'
    } : {
      // Colores modo claro
      background: '#fafafa',
      surface: '#ffffff',
      primary: '#4CAF50',
      secondary: '#666',
      text: '#333333',
      textSecondary: '#666666',
      border: '#e0e0e0',
      sidebar: '#ffffff',
      header: '#ffffff',
      card: '#ffffff',
      hover: '#f5f5f5',
      success: '#4CAF50',
      warning: '#ff9800',
      error: '#f44336',
      idoni: '#ff69b4'
    }
  };

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
}; 