import React from 'react';
import Layout from './Layout';
import { NavigationProvider } from './NavigationContext';

const MainApp = () => {
  return (
    <NavigationProvider>
      <Layout />
    </NavigationProvider>
  );
};

export default MainApp; 