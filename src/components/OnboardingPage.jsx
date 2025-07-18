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
  Shield,
  Home,
  Search,
  Download,
  Eye,
  Database,
  Zap,
  Target,
  PieChart,
  Calendar,
  AlertTriangle,
  RefreshCw,
  CreditCard,
  Briefcase,
  Phone,
  Mail,
  Globe,
  Lock,
  Star,
  ShoppingCart
} from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';

const OnboardingPage = ({ onComplete }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const { colors } = useTheme();
  const { user } = useAuth();

  // Marcar onboarding como completado en la base de datos
  const markOnboardingCompleted = async () => {
    if (user?.id) {
      try {
        await supabase
          .from('user_profiles')
          .update({ onboarding_completed: true })
          .eq('id', user.id);
      } catch (error) {
        console.error('Error marcando onboarding como completado:', error);
      }
    }
  };

  const steps = [
    {
      title: "¡Bienvenido a SSS Kronos!",
      subtitle: "Tu plataforma integral de gestión administrativa",
      description: "Descubre todas las herramientas que tienes a tu disposición para gestionar tu empresa de forma eficiente.",
      icon: Star,
      color: colors.primary,
      content: (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: colors.primary + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Star size={40} color={colors.primary} />
          </div>
          <h3 style={{ color: colors.text, marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>
            ¡Tu cuenta está lista!
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: '1.5' }}>
            Vamos a explorar todas las funcionalidades que te ayudarán a gestionar tu empresa de forma profesional.
          </p>
        </div>
      )
    },
    {
      title: "Panel de Control",
      subtitle: "Vista general de tu empresa",
      description: "Accede rápidamente a toda la información importante desde el dashboard principal.",
      icon: Home,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '24px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '16px'
          }}>
            <div style={{
              padding: '16px',
              backgroundColor: colors.surface,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <TrendingUp size={24} color={colors.success} style={{ marginBottom: '8px' }} />
              <h4 style={{ color: colors.text, fontSize: '14px', marginBottom: '4px', fontWeight: '600' }}>
                Resumen Financiero
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '12px' }}>
                Estado de facturas y pagos
              </p>
            </div>
            <div style={{
              padding: '16px',
              backgroundColor: colors.surface,
              borderRadius: '12px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <BarChart2 size={24} color={colors.primary} style={{ marginBottom: '8px' }} />
              <h4 style={{ color: colors.text, fontSize: '14px', marginBottom: '4px', fontWeight: '600' }}>
                Análisis Rápido
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '12px' }}>
                Gráficos y métricas clave
              </p>
            </div>
          </div>
          
          <div style={{
            padding: '12px',
            backgroundColor: colors.success + '10',
            borderRadius: '8px',
            border: `1px solid ${colors.success + '30'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <CheckCircle size={16} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '13px', fontWeight: '500' }}>
              Acceso directo a todas las funciones principales
            </span>
          </div>
        </div>
      )
    },
        {
      title: "Gestión de Compras",
      subtitle: "Control total de proveedores",
      description: "Gestiona tus compras, facturas pendientes y proveedores de forma eficiente.",
      icon: ShoppingCart,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <AlertTriangle size={20} color={colors.warning} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Facturas Pendientes
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Control de pagos
              </p>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Briefcase size={20} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Gestión Proveedores
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Base de datos IBAN
              </p>
            </div>
          </div>
          
          <div style={{
            padding: '10px',
            backgroundColor: colors.primary + '10',
            borderRadius: '6px',
            border: `1px solid ${colors.primary + '30'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Database size={14} color={colors.primary} />
            <span style={{ color: colors.primary, fontSize: '12px', fontWeight: '500' }}>
              Integración completa con Holded
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Análisis Avanzado",
      subtitle: "Dashboards y reportes inteligentes",
      description: "Visualiza tus datos con gráficos interactivos y obtén insights valiosos para tu negocio.",
      icon: PieChart,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '10px',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <PieChart size={20} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Análisis Canales
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Distribución compras
              </p>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <TrendingUp size={20} color={colors.success} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Tendencias
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Evolución temporal
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
            <Zap size={14} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '12px', fontWeight: '500' }}>
              Procesamiento automático en tiempo real
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Gestión de Contactos",
      subtitle: "Base de datos de proveedores",
      description: "Consulta y gestiona todos tus contactos de proveedores con información de IBAN integrada.",
      icon: Users,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <CheckCircle size={18} color={colors.success} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                IBAN Completo
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Datos bancarios
              </p>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Search size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                Búsqueda
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Filtros inteligentes
              </p>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Download size={18} color={colors.warning} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                Exportar CSV
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Análisis externo
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      title: "Configuración y Seguridad",
      subtitle: "Personaliza tu experiencia",
      description: "Ajusta la moneda, zona horaria y gestiona la seguridad de tu cuenta.",
      icon: Settings,
      color: colors.primary,
      content: (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '10px',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <CreditCard size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                Moneda EUR
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Euro por defecto
              </p>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Shield size={18} color={colors.success} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                Seguridad
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Encriptación
              </p>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Globe size={18} color={colors.warning} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                Zona Horaria
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Auto-configuración
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
            <Lock size={14} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '12px', fontWeight: '500' }}>
              Datos seguros y protegidos
            </span>
          </div>
        </div>
      )
    },
    {
      title: "¡Todo listo!",
      subtitle: "Comienza a usar SSS Kronos",
      description: "Ya tienes acceso a todas las funcionalidades. ¡Empieza a gestionar tu empresa de forma profesional!",
      icon: CheckCircle,
      color: colors.success,
      content: (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <div style={{
            width: '80px',
            height: '80px',
            borderRadius: '50%',
            backgroundColor: colors.success + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle size={40} color={colors.success} />
          </div>
          <h3 style={{ color: colors.text, marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>
            ¡Configuración completada!
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
            Ya puedes empezar a usar todas las funcionalidades de SSS Kronos para gestionar tu empresa de forma eficiente.
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '8px',
            marginTop: '16px'
          }}>
            <div style={{
              padding: '8px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Home size={16} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Dashboard
              </div>
            </div>
            <div style={{
              padding: '8px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <BarChart2 size={16} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Análisis
              </div>
            </div>
            <div style={{
              padding: '8px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Users size={16} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Contactos
              </div>
            </div>
          </div>
        </div>
      )
    }
  ];

  const handleNext = async () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      await markOnboardingCompleted();
      onComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = async () => {
    await markOnboardingCompleted();
    onComplete();
  };

  const currentStepData = steps[currentStep];

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.background,
      display: 'flex',
      flexDirection: 'column',
      zIndex: 9999
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
        borderBottom: `1px solid ${colors.border}`
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <img 
            src={logo} 
            alt="SSS Kronos" 
            style={{ 
              height: '32px',
              width: 'auto'
            }} 
          />
          <span style={{
            fontSize: '18px',
            fontWeight: '600',
            color: colors.text
          }}>
            SSS Kronos
          </span>
        </div>
        
        <button
          onClick={handleSkip}
          style={{
            background: 'none',
            border: 'none',
            color: colors.textSecondary,
            cursor: 'pointer',
            padding: '8px',
            borderRadius: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px'
          }}
        >
          <X size={16} />
          Saltar
        </button>
      </div>

      {/* Progress Bar */}
      <div style={{
        height: '3px',
        backgroundColor: colors.border,
        position: 'relative'
      }}>
        <motion.div
          style={{
            height: '100%',
            backgroundColor: colors.primary,
            position: 'absolute',
            top: 0,
            left: 0
          }}
          initial={{ width: 0 }}
          animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Content */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px'
      }}>
        <div style={{
          maxWidth: '600px',
          width: '100%',
          textAlign: 'center'
        }}>
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Icon */}
              <div style={{
                width: '80px',
                height: '80px',
                borderRadius: '50%',
                backgroundColor: currentStepData.color + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <currentStepData.icon size={40} color={currentStepData.color} />
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: '28px',
                fontWeight: '700',
                color: colors.text,
                margin: '0 0 8px 0',
                lineHeight: '1.2'
              }}>
                {currentStepData.title}
              </h1>

              {/* Subtitle */}
              <h2 style={{
                fontSize: '18px',
                fontWeight: '500',
                color: colors.primary,
                margin: '0 0 16px 0'
              }}>
                {currentStepData.subtitle}
              </h2>

              {/* Description */}
              <p style={{
                fontSize: '16px',
                color: colors.textSecondary,
                lineHeight: '1.6',
                margin: '0 0 32px 0',
                maxWidth: '500px',
                marginLeft: 'auto',
                marginRight: 'auto'
              }}>
                {currentStepData.description}
              </p>

              {/* Content */}
              {currentStepData.content}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '24px',
        borderTop: `1px solid ${colors.border}`
      }}>
        <button
          onClick={handlePrevious}
          disabled={currentStep === 0}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            backgroundColor: colors.surface,
            color: currentStep === 0 ? colors.textSecondary : colors.text,
            cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: currentStep === 0 ? 0.5 : 1
          }}
        >
          <ArrowLeft size={16} />
          Anterior
        </button>

        <div style={{
          display: 'flex',
          gap: '8px'
        }}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: index === currentStep ? colors.primary : colors.border,
                transition: 'background-color 0.2s'
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 24px',
            border: 'none',
            borderRadius: '8px',
            backgroundColor: colors.primary,
            color: 'white',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'all 0.2s'
          }}
        >
          {currentStep === steps.length - 1 ? (
            <>
              Comenzar
              <Play size={16} />
            </>
          ) : (
            <>
              Siguiente
              <ArrowRight size={16} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default OnboardingPage; 