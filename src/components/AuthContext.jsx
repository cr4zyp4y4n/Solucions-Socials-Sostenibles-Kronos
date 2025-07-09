import React, { createContext, useContext, useState, useEffect } from 'react';
import { authService } from '../config/supabase';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Verificar sesión al cargar
  useEffect(() => {
    checkUser();
    
    // Escuchar cambios de autenticación
    const { data: { subscription } } = authService.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN') {
          setUser(session?.user || null);
          setError(null);
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          setError(null);
        }
        setLoading(false);
      }
    );

    return () => subscription?.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      const { user, error } = await authService.getCurrentUser();
      if (error) {
        console.error('Error al verificar usuario:', error);
      }
      setUser(user);
    } catch (err) {
      console.error('Error al verificar sesión:', err);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await authService.signIn(email, password);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      setError('Error inesperado al iniciar sesión');
      return { success: false, error: 'Error inesperado al iniciar sesión' };
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email, password, userData = {}) => {
    setLoading(true);
    setError(null);
    
    try {
      const { data, error } = await authService.signUp(email, password, userData);
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      return { success: true, data };
    } catch (err) {
      setError('Error inesperado al registrar usuario');
      return { success: false, error: 'Error inesperado al registrar usuario' };
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const { error } = await authService.signOut();
      if (error) {
        setError(error.message);
        return { success: false, error: error.message };
      }
      setUser(null);
      return { success: true };
    } catch (err) {
      setError('Error inesperado al cerrar sesión');
      return { success: false, error: 'Error inesperado al cerrar sesión' };
    } finally {
      setLoading(false);
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value = {
    user,
    loading,
    error,
    signIn,
    signUp,
    signOut,
    clearError,
    isAuthenticated: !!user
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}; 