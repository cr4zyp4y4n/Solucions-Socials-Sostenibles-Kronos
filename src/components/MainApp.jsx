import React from 'react';
import Layout from './Layout';
import { DataProvider } from './DataContext';
import { ThemeProvider } from './ThemeContext';
import { CurrencyProvider } from './CurrencyContext';

const MainApp = () => {
  return (
    <ThemeProvider>
      <DataProvider>
        <CurrencyProvider>
          <Layout />
        </CurrencyProvider>
      </DataProvider>
    </ThemeProvider>
  );
};

export default MainApp; 