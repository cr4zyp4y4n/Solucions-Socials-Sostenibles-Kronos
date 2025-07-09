import React, { createContext, useContext, useState } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  // Datos para Solucions Socials
  const [solucionsHeaders, setSolucionsHeaders] = useState([]);
  const [solucionsData, setSolucionsData] = useState([]);
  
  // Datos para Menjar d'Hort
  const [menjarHeaders, setMenjarHeaders] = useState([]);
  const [menjarData, setMenjarData] = useState([]);

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
      
      // Función para limpiar todos los datos
      clearAllData,
      
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