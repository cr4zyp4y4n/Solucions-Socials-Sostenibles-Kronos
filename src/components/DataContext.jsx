import React, { createContext, useContext, useState } from 'react';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [excelHeaders, setExcelHeaders] = useState([]);
  const [excelData, setExcelData] = useState([]);

  const clearData = () => {
    setExcelHeaders([]);
    setExcelData([]);
  };

  return (
    <DataContext.Provider value={{ 
      excelHeaders, 
      setExcelHeaders, 
      excelData, 
      setExcelData, 
      clearData 
    }}>
      {children}
    </DataContext.Provider>
  );
};

export const useDataContext = () => useContext(DataContext); 