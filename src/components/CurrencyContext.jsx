import React, { createContext, useContext, useState, useEffect } from 'react';

const CurrencyContext = createContext();

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    throw new Error('useCurrency must be used within a CurrencyProvider');
  }
  return context;
};

export const CurrencyProvider = ({ children }) => {
  const [currency, setCurrency] = useState('EUR');
  const [exchangeRates, setExchangeRates] = useState({});
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const currencies = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'Dólar Estadounidense' },
    { code: 'GBP', symbol: '£', name: 'Libra Esterlina' },
    { code: 'JPY', symbol: '¥', name: 'Yen Japonés' },
    { code: 'CHF', symbol: 'CHF', name: 'Franco Suizo' },
    { code: 'CAD', symbol: 'C$', name: 'Dólar Canadiense' },
    { code: 'AUD', symbol: 'A$', name: 'Dólar Australiano' }
  ];

  // Función para obtener tasas de cambio
  const fetchExchangeRates = async () => {
    setLoading(true);
    try {
      const { ipcRenderer } = window.require('electron');
      const data = await ipcRenderer.invoke('get-exchange-rates');
      if (data.conversion_rates) {
        setExchangeRates(data.conversion_rates);
        setLastUpdate(new Date());
        // Guardar en localStorage para uso offline
        localStorage.setItem('exchangeRates', JSON.stringify({
          rates: data.conversion_rates,
          timestamp: Date.now()
        }));
      }
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      // Intentar cargar desde localStorage si hay error
      const cached = localStorage.getItem('exchangeRates');
      if (cached) {
        const cachedData = JSON.parse(cached);
        setExchangeRates(cachedData.rates);
        setLastUpdate(new Date(cachedData.timestamp));
      }
    } finally {
      setLoading(false);
    }
  };

  // Cargar tasas de cambio al montar el componente
  useEffect(() => {
    fetchExchangeRates();
  }, []);

  // Función para convertir moneda
  const convertCurrency = (amount, fromCurrency = 'EUR', toCurrency = currency) => {
    if (fromCurrency === toCurrency) return amount;
    
    const amountNum = parseFloat(amount) || 0;
    
    // Si no hay tasas de cambio, devolver el valor original
    if (Object.keys(exchangeRates).length === 0) {
      return amountNum;
    }

    // Convertir desde EUR a la moneda objetivo
    if (fromCurrency === 'EUR') {
      const rate = exchangeRates[toCurrency];
      return rate ? amountNum * rate : amountNum;
    }
    
    // Si la moneda origen no es EUR, primero convertir a EUR
    const rateToEUR = exchangeRates[fromCurrency];
    if (rateToEUR) {
      const amountInEUR = amountNum / rateToEUR;
      const rateToTarget = exchangeRates[toCurrency];
      return rateToTarget ? amountInEUR * rateToTarget : amountNum;
    }
    
    return amountNum;
  };

  const formatCurrency = (amount, currencyCode = currency) => {
    const selectedCurrency = currencies.find(c => c.code === currencyCode) || currencies[0];
    const convertedAmount = convertCurrency(amount, 'EUR', currencyCode);
    
    return `${selectedCurrency.symbol}${convertedAmount.toLocaleString('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  const value = {
    currency,
    setCurrency,
    currencies,
    formatCurrency,
    convertCurrency,
    exchangeRates,
    loading,
    lastUpdate,
    refreshRates: fetchExchangeRates
  };

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  );
}; 