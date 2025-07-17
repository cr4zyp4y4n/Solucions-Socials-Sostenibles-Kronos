import React, { createContext, useContext, useState } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Datos para Solucions Socials
  const [solucionsHeaders, setSolucionsHeaders] = useState([]);
  const [solucionsData, setSolucionsData] = useState([]);
  
  // Datos para Menjar d'Hort
  const [menjarHeaders, setMenjarHeaders] = useState([]);
  const [menjarData, setMenjarData] = useState([]);

  // Estado para controlar recarga de datos de Holded
  const [shouldReloadHolded, setShouldReloadHolded] = useState(false);

  // Sistema de caché para datos de Holded
  const [holdedCache, setHoldedCache] = useState({
    solucions: {
      data: null,
      timestamp: null,
      loading: false
    },
    menjar: {
      data: null,
      timestamp: null,
      loading: false
    }
  });

  // Estado para resultados de pruebas de Holded
  const [testResults, setTestResults] = useState({});
  const [testing, setTesting] = useState(false);

  // Configuración del caché (5 minutos)
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos
  
  // Estado para tracking de última actualización por pestaña
  const [lastUpdateTime, setLastUpdateTime] = useState({
    home: null,
    analytics: null
  });

  const clearSolucionsData = () => {
    setSolucionsHeaders([]);
    setSolucionsData([]);
  };

  const clearMenjarData = () => {
    setMenjarHeaders([]);
    setMenjarData([]);
  };

  const clearAllData = () => {
    clearSolucionsData();
    clearMenjarData();
  };

  // Función para verificar si el caché es válido
  const isCacheValid = (company) => {
    const cache = holdedCache[company];
    if (!cache.data || !cache.timestamp) return false;
    
    const now = Date.now();
    const cacheAge = now - cache.timestamp;
    return cacheAge < CACHE_DURATION;
  };

  // Función para verificar si necesita actualización por pestaña
  const needsUpdate = (tab) => {
    const lastUpdate = lastUpdateTime[tab];
    if (!lastUpdate) return true;
    
    const now = Date.now();
    const timeSinceUpdate = now - lastUpdate;
    return timeSinceUpdate >= CACHE_DURATION;
  };

  // Función para marcar pestaña como actualizada
  const markTabUpdated = (tab) => {
    setLastUpdateTime(prev => ({
      ...prev,
      [tab]: Date.now()
    }));
  };

  // Función para obtener datos del caché
  const getCachedData = (company) => {
    if (isCacheValid(company)) {
      return holdedCache[company].data;
    }
    return null;
  };

  // Función para actualizar el caché
  const updateCache = (company, data) => {
    setHoldedCache(prev => ({
      ...prev,
      [company]: {
        data,
        timestamp: Date.now(),
        loading: false
      }
    }));
  };

  // Función para marcar como cargando
  const setLoading = (company, loading) => {
    setHoldedCache(prev => ({
      ...prev,
      [company]: {
        ...prev[company],
        loading
      }
    }));
  };

  // Función para limpiar el caché
  const clearCache = (company = null) => {
    if (company) {
      setHoldedCache(prev => ({
        ...prev,
        [company]: {
          data: null,
          timestamp: null,
          loading: false
        }
      }));
    } else {
      setHoldedCache({
        solucions: {
          data: null,
          timestamp: null,
          loading: false
        },
        menjar: {
          data: null,
          timestamp: null,
          loading: false
        }
      });
    }
  };

  return (
    <DataContext.Provider value={{ 
      // Datos de Solucions Socials
      solucionsHeaders, 
      setSolucionsHeaders, 
      solucionsData, 
      setSolucionsData,
      clearSolucionsData,
      
      // Datos de Menjar d'Hort
      menjarHeaders,
      setMenjarHeaders,
      menjarData,
      setMenjarData,
      clearMenjarData,
      
      // Estado para recarga de Holded
      shouldReloadHolded,
      setShouldReloadHolded,
      
      // Sistema de caché
      holdedCache,
      isCacheValid,
      getCachedData,
      updateCache,
      setLoading,
      clearCache,
      CACHE_DURATION,
      
      // Función para limpiar todos los datos
      clearAllData,
      
      // Resultados de pruebas de Holded
      testResults,
      setTestResults,
      testing,
      setTesting,
      
      // Sistema de actualización por pestaña
      needsUpdate,
      markTabUpdated,
      lastUpdateTime,
      
      // Mantener compatibilidad con el código existente
      excelHeaders: solucionsHeaders,
      setExcelHeaders: setSolucionsHeaders,
      excelData: solucionsData,
      setExcelData: setSolucionsData,
      clearData: clearSolucionsData
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => useContext(DataContext); 