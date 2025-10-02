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
  ShoppingCart,
  Layers,
  DollarSign,
  Activity,
  Clock,
  GitBranch,
  AlertCircle
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
      description: "Sistema completo para gestionar facturas, análisis de ventas y subvenciones.",
      icon: Star,
      color: colors.primary,
      content: (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: colors.primary + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <Star size={50} color={colors.primary} />
          </div>
          <h3 style={{ color: colors.text, marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>
            ¡Tu cuenta está lista!
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
            Vamos a explorar todas las funcionalidades que te ayudarán a gestionar tu empresa.
          </p>
          
          {/* Aviso de Beta */}
          <div style={{
            padding: '16px',
            backgroundColor: colors.warning + '15',
            borderRadius: '8px',
            border: `2px solid ${colors.warning}`,
            marginTop: '20px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
              <AlertCircle size={20} color={colors.warning} />
              <span style={{ fontSize: '16px', fontWeight: '600', color: colors.warning }}>
                Versión Beta
              </span>
            </div>
            <p style={{ color: colors.text, fontSize: '13px', lineHeight: '1.5', margin: 0 }}>
              Esta aplicación está en fase beta. Pueden aparecer errores ocasionales.
            </p>
            <p style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '8px', margin: '8px 0 0 0' }}>
              Reporta cualquier problema a: <a href="mailto:comunicacio@solucionssocials.org" style={{ color: colors.primary, textDecoration: 'none', fontWeight: '600' }}>comunicacio@solucionssocials.org</a>
            </p>
          </div>
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
                Estado de facturas y pagos en tiempo real
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
                Métricas Clave
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '12px' }}>
                Gráficos interactivos
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
              Sincronización automática con Holded e IDONI
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Gestión de Compras",
      subtitle: "Control de proveedores y facturas",
      description: "Administra compras, facturas pendientes, proveedores y exporta datos para pagos bancarios.",
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
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <AlertTriangle size={22} color={colors.warning} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Facturas Pendientes
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Control de vencimientos
              </p>
            </div>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Briefcase size={22} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Base de Proveedores
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                IBANs y datos bancarios
              </p>
            </div>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Download size={22} color={colors.success} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Vista Bruno
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Export Excel para pagos
              </p>
            </div>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Eye size={22} color={colors.info} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Visibilidad por Rol
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Ocultar facturas
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
              Integración completa con Holded API
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Análisis de Ventas - IDONI",
      subtitle: "Dashboards inteligentes de ventas",
      description: "Analiza tus ventas por día, franjas horarias y productos con gráficos avanzados.",
      icon: PieChart,
      color: colors.info,
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
              <Calendar size={20} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Ventas Diarias
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Tendencias y comparativas
              </p>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Clock size={20} color={colors.warning} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Franjas Horarias
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Análisis por horas
              </p>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <ShoppingCart size={20} color={colors.success} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Ventas por Producto
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Rankings y análisis
              </p>
            </div>
            <div style={{
              padding: '12px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <TrendingUp size={20} color={colors.info} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Tendencias Semanales
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Evolución por día
              </p>
            </div>
          </div>
          
          <div style={{
            padding: '10px',
            backgroundColor: colors.info + '10',
            borderRadius: '6px',
            border: `1px solid ${colors.info + '30'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <Upload size={14} color={colors.info} />
            <span style={{ color: colors.info, fontSize: '12px', fontWeight: '500' }}>
              Sube tus Excels de IDONI y obtén análisis instantáneos
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Gestión de Subvenciones",
      subtitle: "Control completo de ayudas y subvenciones",
      description: "Gestiona subvenciones, fases de proyecto, abonos y seguimiento de saldos pendientes.",
      icon: Layers,
      color: colors.success,
      content: (
        <div style={{ marginTop: '20px' }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '12px',
            marginBottom: '12px'
          }}>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <FileText size={22} color={colors.primary} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Subvenciones
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Crear, editar, eliminar
              </p>
            </div>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <GitBranch size={22} color={colors.success} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Fases de Proyecto
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                8 fases personalizables
              </p>
            </div>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <DollarSign size={22} color={colors.warning} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Abonos y Saldos
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Control de pagos
              </p>
            </div>
            <div style={{
              padding: '14px',
              backgroundColor: colors.surface,
              borderRadius: '8px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Search size={22} color={colors.info} style={{ marginBottom: '6px' }} />
              <h4 style={{ color: colors.text, fontSize: '13px', marginBottom: '2px', fontWeight: '600' }}>
                Filtros Avanzados
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '11px' }}>
                Por estado, fase, imputación
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
            <Database size={14} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '12px', fontWeight: '500' }}>
              Almacenamiento permanente en Supabase
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Gestión de Contactos",
      subtitle: "Base de datos de proveedores",
      description: "Consulta y gestiona todos tus contactos con información bancaria completa.",
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
              <CreditCard size={18} color={colors.success} style={{ marginBottom: '4px' }} />
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
                Búsqueda Rápida
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Encuentra proveedores
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
                Datos completos
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
            <Zap size={14} color={colors.primary} />
            <span style={{ color: colors.primary, fontSize: '12px', fontWeight: '500' }}>
              Actualización automática desde Holded
            </span>
          </div>
        </div>
      )
    },
    {
      title: "Configuración",
      subtitle: "Personaliza tu experiencia",
      description: "Ajusta tema oscuro/claro, zona horaria, moneda y gestiona la seguridad.",
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
              <Activity size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <h4 style={{ color: colors.text, fontSize: '12px', marginBottom: '2px', fontWeight: '600' }}>
                Tema
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                Claro / Oscuro
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
                Roles y permisos
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
                Región
              </h4>
              <p style={{ color: colors.textSecondary, fontSize: '10px' }}>
                EUR y ES
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
              Datos encriptados y seguros en Supabase
            </span>
          </div>
        </div>
      )
    },
    {
      title: "¡Todo listo!",
      subtitle: "Comienza a usar SSS Kronos",
      description: "Ya tienes acceso a todas las funcionalidades. ¡Empieza a gestionar tu empresa!",
      icon: CheckCircle,
      color: colors.success,
      content: (
        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: colors.success + '20',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 20px',
          }}>
            <CheckCircle size={50} color={colors.success} />
          </div>
          <h3 style={{ color: colors.text, marginBottom: '12px', fontSize: '18px', fontWeight: '600' }}>
            ¡Configuración completada!
          </h3>
          <p style={{ color: colors.textSecondary, fontSize: '14px', lineHeight: '1.5', marginBottom: '20px' }}>
            Ya puedes empezar a usar todas las funcionalidades de SSS Kronos.
          </p>
          
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '8px',
            marginTop: '20px',
            marginBottom: '20px'
          }}>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Home size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Dashboard
              </div>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <ShoppingCart size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Compras
              </div>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <BarChart2 size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Análisis
              </div>
            </div>
            <div style={{
              padding: '10px',
              backgroundColor: colors.surface,
              borderRadius: '6px',
              border: `1px solid ${colors.border}`,
              textAlign: 'center'
            }}>
              <Layers size={18} color={colors.primary} style={{ marginBottom: '4px' }} />
              <div style={{ fontSize: '10px', color: colors.textSecondary }}>
                Subvenciones
              </div>
            </div>
          </div>

          {/* Recordatorio de soporte */}
          <div style={{
            padding: '14px',
            backgroundColor: colors.primary + '10',
            borderRadius: '8px',
            border: `1px solid ${colors.primary}`,
            marginTop: '16px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', marginBottom: '6px' }}>
              <Mail size={16} color={colors.primary} />
              <span style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                ¿Necesitas ayuda?
              </span>
            </div>
            <p style={{ color: colors.textSecondary, fontSize: '12px', margin: 0 }}>
              Contáctanos en: <a href="mailto:comunicacio@solucionssocials.org" style={{ color: colors.primary, textDecoration: 'none', fontWeight: '600' }}>comunicacio@solucionssocials.org</a>
            </p>
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
          <div>
            <span style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text,
              display: 'block'
            }}>
              SSS Kronos
            </span>
            <span style={{
              fontSize: '11px',
              color: colors.warning,
              fontWeight: '600',
              backgroundColor: colors.warning + '20',
              padding: '2px 6px',
              borderRadius: '4px',
              display: 'inline-block',
              marginTop: '2px'
            }}>
              BETA
            </span>
          </div>
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
        height: '4px',
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
        padding: '40px 24px',
        overflowY: 'auto'
      }}>
        <div style={{
          maxWidth: '650px',
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
                width: '90px',
                height: '90px',
                borderRadius: '50%',
                backgroundColor: currentStepData.color + '20',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}>
                <currentStepData.icon size={45} color={currentStepData.color} />
              </div>

              {/* Title */}
              <h1 style={{
                fontSize: '30px',
                fontWeight: '700',
                color: colors.text,
                margin: '0 0 8px 0',
                lineHeight: '1.2'
              }}>
                {currentStepData.title}
              </h1>

              {/* Subtitle */}
              <h2 style={{
                fontSize: '19px',
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
                maxWidth: '520px',
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
        borderTop: `1px solid ${colors.border}`,
        backgroundColor: colors.surface
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
            backgroundColor: colors.background,
            color: currentStep === 0 ? colors.textSecondary : colors.text,
            cursor: currentStep === 0 ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            opacity: currentStep === 0 ? 0.5 : 1,
            transition: 'all 0.2s'
          }}
        >
          <ArrowLeft size={16} />
          Anterior
        </button>

        <div style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'center'
        }}>
          {steps.map((_, index) => (
            <div
              key={index}
              style={{
                width: index === currentStep ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                backgroundColor: index === currentStep ? colors.primary : colors.border,
                transition: 'all 0.3s'
              }}
            />
          ))}
          <span style={{ marginLeft: '8px', fontSize: '13px', color: colors.textSecondary, fontWeight: '500' }}>
            {currentStep + 1} / {steps.length}
          </span>
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
            fontWeight: '600',
            transition: 'all 0.2s',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
          onMouseEnter={(e) => {
            e.target.style.transform = 'translateY(-2px)';
            e.target.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.target.style.transform = 'translateY(0)';
            e.target.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
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