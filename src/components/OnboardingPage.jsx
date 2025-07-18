import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, 
  BarChart2, 
  Users, 
  Settings, 
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  X,
  Play,
  FileText,
  TrendingUp,
  Shield
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';

const OnboardingPage = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { colors } = useTheme();
  const { user } = useAuth();

  const steps = [
    {
      title: "¡Bienvenido a SSS Kronos!",
      subtitle: "Tu plataforma de gestión administrativa",
      description: "Vamos a configurar tu cuenta para que puedas aprovechar al máximo todas las funcionalidades.",
      icon: CheckCircle,
      color: colors.success,
      content: (
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <div style={{
            width: '60px',
            height: '60px',
            borderRadius: '50%',
            backgroundColor: colors.success + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <CheckCircle size={32} color={colors.success} />
          </div>
          <h3 style={{ color: colors.text, marginBottom: '8px', fontSize: '16px' }}>
            ¡Cuenta creada exitosamente!
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '13px' }}>
            Tu cuenta está lista para usar. Ahora vamos a configurar todo lo necesario.
          </p>
        </div>
      )
    },
    {
      title: "Importar Datos",
      subtitle: "Sube tus archivos Excel",
      description: "Importa tus datos de facturas y análisis financieros de forma inteligente.",
      icon: Upload,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginBottom: '16px',
            padding: '12px',
            backgroundColor: colors.surface,
            borderRadius: '6px',
            border: `1px solid ${colors.border}`
          }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              backgroundColor: colors.primary + '20',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <Upload size={20} color={colors.primary} />
            </div>
            <div style={{ flex: 1 }}>
              <h4 style={{ color: colors.text, marginBottom: '2px', fontSize: '14px' }}>
                Subir archivos Excel
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '12px' }}>
                Arrastra tus archivos o haz clic para seleccionar
              </p>
            </div>
          </div>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '8px'
          }}>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <TrendingUp size={18} color={colors.textSecondary} style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                Facturas
              </div>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <BarChart2 size={18} color={colors.textSecondary} style={{ marginBottom: '6px' }} />
              <div style={{ fontSize: '11px', color: colors.textSecondary }}>
                Análisis
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Análisis Inteligente",
      subtitle: "Dashboards y reportes",
      description: "Visualiza tus datos con gráficos interactivos y reportes personalizados.",
      icon: BarChart2,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <BarChart2 size={20} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px' }}>
                Dashboards
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Visualización en tiempo real
              </p>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <TrendingUp size={20} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px' }}>
                Reportes
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Análisis detallado
              </p>
            </div>
          </div>
          
          <div style={{
            padding: '10px',
            backgroundColor: colors.success + '10',
            borderRadius: '6px',
            border: `1px solid ${colors.success + '30'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <CheckCircle size={14} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '12px' }}>
              Datos procesados automáticamente
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Configuración",
      subtitle: "Personaliza tu experiencia",
      description: "Ajusta la moneda, zona horaria y otras preferencias según tus necesidades.",
      icon: Settings,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.primary + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: colors.primary, fontSize: '12px', fontWeight: 'bold' }}>€</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.text, fontSize: '13px' }}>
                  Moneda: Euro (EUR)
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`
            }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: colors.primary + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{ color: colors.primary, fontSize: '12px', fontWeight: 'bold' }}>🕐</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.text, fontSize: '13px' }}>
                  Zona horaria: Madrid (GMT+1)
                </div>
              </div>
            </div>
            
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`
            }}>
              <Shield size={18} color={colors.primary} />
              <div style={{ flex: 1 }}>
                <div style={{ color: colors.text, fontSize: '13px' }}>
                  Seguridad: Activada
                </div>
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const currentStepData = steps[currentStep];
  const Icon = currentStepData.icon;

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      onComplete();
    }
  };

  const handleSkip = () => {
    onComplete();
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100vw',
      overflow: 'auto',
      backgroundColor: colors.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 0,
      position: 'relative'
    }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{
          width: '100%',
          maxWidth: '500px',
          maxHeight: 'calc(100vh - 40px)',
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          border: `1px solid ${colors.border}`,
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Header con logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img 
            src={logo} 
            alt="SSS Kronos" 
            style={{ 
              height: '40px', 
              width: '40px', 
              borderRadius: '8px',
              marginBottom: '12px',
              objectFit: 'contain'
            }} 
          />
          <h1 style={{
            color: colors.primary,
            fontSize: 28,
            fontWeight: 700,
            margin: '0 0 6px 0',
            lineHeight: 1.2,
            userSelect: 'none'
          }}>
            SSS Kronos
          </h1>
        </div>

        {/* Progress bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '24px',
          position: 'relative'
        }}>
          {steps.map((_, index) => (
            <div key={index} style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              flex: 1,
              position: 'relative'
            }}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: index <= currentStep ? colors.primary : colors.border,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold',
                zIndex: 2,
                position: 'relative'
              }}>
                {index < currentStep ? (
                  <CheckCircle size={16} />
                ) : (
                  index + 1
                )}
              </div>
              {index < steps.length - 1 && (
                <div style={{
                  position: 'absolute',
                  top: '16px',
                  left: '50%',
                  width: '100%',
                  height: '2px',
                  backgroundColor: index < currentStep ? colors.primary : colors.border,
                  zIndex: 1
                }} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div style={{
              textAlign: 'center',
              marginBottom: '20px'
            }}>
              <div style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: currentStepData.color + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 12px',
              }}>
                <Icon size={28} color={currentStepData.color} />
              </div>
              <h2 style={{
                color: colors.text,
                fontSize: '20px',
                fontWeight: '600',
                margin: '0 0 6px 0',
                userSelect: 'none'
              }}>
                {currentStepData.title}
              </h2>
              <p style={{
                color: colors.textSecondary,
                fontSize: '14px',
                margin: '0 0 12px 0',
                userSelect: 'none'
              }}>
                {currentStepData.subtitle}
              </p>
              <p style={{
                color: colors.textSecondary,
                fontSize: '13px',
                lineHeight: '1.5',
                userSelect: 'none'
              }}>
                {currentStepData.description}
              </p>
            </div>

            {/* Step specific content */}
            {currentStepData.content}
          </motion.div>
        </AnimatePresence>

        {/* Navigation buttons */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '24px',
          paddingTop: '20px',
          borderTop: `1px solid ${colors.border}`
        }}>
          <button
            onClick={handleSkip}
            style={{
              background: 'none',
              border: 'none',
              color: colors.textSecondary,
              fontSize: '14px',
              cursor: 'pointer',
              padding: '8px 16px',
              borderRadius: '6px',
              userSelect: 'none'
            }}
          >
            Saltar tutorial
          </button>

          <div style={{ display: 'flex', gap: '12px' }}>
            {currentStep > 0 && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setCurrentStep(currentStep - 1)}
                style={{
                  padding: '12px 20px',
                  backgroundColor: 'transparent',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  color: colors.text,
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  userSelect: 'none'
                }}
              >
                <ArrowLeft size={16} />
                Anterior
              </motion.button>
            )}
            
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleNext}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.primary,
                border: 'none',
                borderRadius: '8px',
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                userSelect: 'none'
              }}
            >
              {currentStep === steps.length - 1 ? 'Comenzar' : 'Siguiente'}
              {currentStep < steps.length - 1 && <ArrowRight size={16} />}
            </motion.button>
          </div>
        </div>
      </motion.div>
      {/* Responsive: reducir padding y maxWidth en móvil */}
      <style>{`
        @media (max-width: 600px) {
          .onboarding-main {
            max-width: 100vw !important;
            padding: 10px !important;
            border-radius: 0 !important;
            min-height: 100vh !important;
            max-height: 100vh !important;
          }
        }
      `}</style>
    </div>
  );
};

export default OnboardingPage; 