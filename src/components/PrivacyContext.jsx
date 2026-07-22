import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { applyPrivacyMask, applyPrivacyMoney } from '../utils/privacyFormat';

const STORAGE_KEY = 'kronosHideSensitiveData';

const PrivacyContext = createContext(null);

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error('usePrivacy debe usarse dentro de un PrivacyProvider');
  }
  return context;
};

export const PrivacyProvider = ({ children }) => {
  const [hideSensitiveData, setHideSensitiveData] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved) : false;
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(hideSensitiveData));
    } catch {
      /* ignore */
    }
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('privacy-mode-active', hideSensitiveData);
    }
  }, [hideSensitiveData]);

  const toggleHideSensitiveData = useCallback(() => {
    setHideSensitiveData((prev) => !prev);
  }, []);

  const mask = useCallback(
    (value, type = 'text') => applyPrivacyMask(value, type, hideSensitiveData),
    [hideSensitiveData]
  );

  const maskMoney = useCallback(
    (formatted) => applyPrivacyMoney(formatted, hideSensitiveData),
    [hideSensitiveData]
  );

  const value = useMemo(
    () => ({
      hideSensitiveData,
      toggleHideSensitiveData,
      mask,
      maskMoney
    }),
    [hideSensitiveData, toggleHideSensitiveData, mask, maskMoney]
  );

  return <PrivacyContext.Provider value={value}>{children}</PrivacyContext.Provider>;
};
