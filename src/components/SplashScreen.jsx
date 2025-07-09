import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';
import { useTheme } from './ThemeContext';

const SplashScreen = ({ onComplete, name }) => {
  const [progress, setProgress] = useState(0);
  const { colors } = useTheme();

  useEffect(() => {
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(timer);
          setTimeout(() => {
            onComplete();
          }, 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    return () => clearInterval(timer);
  }, [onComplete]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="splash-screen"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: colors.background,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 1000,
        }}
      >
        {/* Logo con animación de entrada y pulsación */}
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{
            marginBottom: '40px',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <motion.div
            animate={{ 
              scale: [1, 1.05, 1],
              opacity: [1, 0.8, 1]
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              ease: "easeInOut"
            }}
          >
            <img
              src={logo}
              alt="Solucions Socias Sostenibles"
              style={{
                width: '200px',
                height: 'auto',
                filter: colors.background === '#1a1a1a' ? 'brightness(1.2) contrast(1.2)' : 'none',
              }}
            />
          </motion.div>
        </motion.div>

        {/* Barra de carga fija con relleno verde */}
        <motion.div
          initial={{ scaleX: 0, opacity: 0 }}
          animate={{ scaleX: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{
            width: '300px',
            height: '6px',
            backgroundColor: colors.surface,
            borderRadius: '3px',
            overflow: 'hidden',
            position: 'relative',
            marginBottom: '20px',
            border: `1px solid ${colors.border}`
          }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.1 }}
            style={{
              height: '100%',
              backgroundColor: colors.primary,
              borderRadius: '3px',
              transition: 'width 0.1s ease',
            }}
          />
        </motion.div>

        {/* Mensaje personalizado de bienvenida */}
        {name ? (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            style={{
              color: colors.primary,
              marginTop: '10px',
              fontSize: '22px',
              fontWeight: 700,
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
            }}
          >
            {`¡Bienvenido, ${name}!`}
          </motion.p>
        ) : (
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            style={{
              color: colors.textSecondary,
              marginTop: '10px',
              fontSize: '16px',
              fontFamily: 'Arial, sans-serif',
              textAlign: 'center',
            }}
          >
            Cargando sistema...
          </motion.p>
        )}
        {/* Porcentaje de carga */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          style={{
            color: colors.primary,
            marginTop: '10px',
            fontSize: '12px',
            fontFamily: 'Arial, sans-serif',
            fontWeight: 'bold',
          }}
        >
          {progress}%
        </motion.p>
      </motion.div>
    </AnimatePresence>
  );
};

export default SplashScreen; 