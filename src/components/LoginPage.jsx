import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Lock, 
  Eye, 
  EyeOff,
  LogIn,
  UserPlus,
  CheckCircle,
  XCircle
} from 'feather-icons-react';
import { useAuth } from './AuthContext';
import { useTheme } from './ThemeContext';
import ConnectionTest from './ConnectionTest';
import logo from '../assets/Logo Minimalist SSS Highest Opacity.PNG';

// Función para validar contraseña fuerte
function getPasswordStrength(password) {
  return {
    length: password.length >= 8,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(password)
  };
}

const LoginPage = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('user');
  const [showChecklist, setShowChecklist] = useState(false);
  const passwordInputRef = useRef();
  
  const { signIn, signUp, loading, error, clearError } = useAuth();
  const { colors } = useTheme();

  // Validación de contraseña
  const passwordChecks = getPasswordStrength(password);
  const isPasswordStrong = Object.values(passwordChecks).every(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();
    
    if (!isLogin && !isPasswordStrong) {
      return; // No permitir registro si la contraseña es débil
    }
    if (isLogin) {
      const result = await signIn(email, password);
      if (!result.success) {
        return;
      }
    } else {
      const userData = {
        name: name,
        role: role,
        created_at: new Date().toISOString()
      };
      const result = await signUp(email, password, userData);
      if (!result.success) {
        return;
      }
    }
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    setEmail('');
    setPassword('');
    setName('');
    setRole('user');
    clearError();
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '16px',
      position: 'relative',
      boxSizing: 'border-box'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 40, height: 0 }}
        animate={{ opacity: 1, scale: 1, y: 0, height: 'auto' }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        style={{
          width: '100%',
          maxWidth: '400px',
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: window.innerWidth < 480 ? '24px' : '32px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
          border: `1px solid ${colors.border}`,
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Logo y título */}
        <div style={{
          textAlign: 'center',
          marginBottom: '24px'
        }}>
          <img 
            src={logo} 
            alt="SSS Kronos" 
            style={{ 
              height: '48px', 
              width: '48px', 
              borderRadius: '10px',
              marginBottom: '12px',
              objectFit: 'contain'
            }} 
          />
          <h1 style={{
            color: colors.primary,
            fontSize: '24px',
            fontWeight: '700',
            margin: '0 0 6px 0',
            userSelect: 'none'
          }}>
            SSS Kronos
          </h1>
          <p style={{
            color: colors.textSecondary,
            fontSize: '14px',
            margin: 0,
            userSelect: 'none'
          }}>
            {isLogin ? 'Inicia sesión en tu cuenta' : 'Crea tu cuenta'}
          </p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit}>
          <AnimatePresence mode="wait">
            {!isLogin && (
              <motion.div
                key="register-fields"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3 }}
                style={{ marginBottom: '16px', overflow: 'hidden' }}
              >
                {/* Campos de registro */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '6px',
                    userSelect: 'none'
                  }}>
                    Nombre completo
                  </label>
                  <div style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center'
                  }}>
                    <User 
                      size={18} 
                      color={colors.textSecondary}
                      style={{ position: 'absolute', left: '12px' }}
                    />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Tu nombre completo"
                      required={!isLogin}
                      style={{
                        width: '100%',
                        padding: '12px 12px 12px 40px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none',
                        transition: 'border-color 0.2s'
                      }}
                      onFocus={(e) => e.target.style.borderColor = colors.primary}
                      onBlur={(e) => e.target.style.borderColor = colors.border}
                    />
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '6px',
                    userSelect: 'none'
                  }}>
                    Rol
                  </label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '8px',
                      backgroundColor: colors.background,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none',
                      transition: 'border-color 0.2s'
                    }}
                    onFocus={(e) => e.target.style.borderColor = colors.primary}
                    onBlur={(e) => e.target.style.borderColor = colors.border}
                  >
                    <option value="user">Usuario</option>
                    <option value="manager">Jefe</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

            <div style={{ marginBottom: '12px' }}>
              <label style={{
                display: 'block',
                color: colors.text,
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '6px',
                userSelect: 'none'
              }}>
                Correo electrónico
              </label>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <User 
                  size={18} 
                  color={colors.textSecondary}
                  style={{ position: 'absolute', left: '12px' }}
                />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@email.com"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.background,
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => e.target.style.borderColor = colors.primary}
                  onBlur={(e) => e.target.style.borderColor = colors.border}
                />
              </div>
            </div>

            <div style={{ marginBottom: isLogin ? '20px' : '6px', position: 'relative' }}>
              <label style={{
                display: 'block',
                color: colors.text,
                fontSize: '14px',
                fontWeight: '500',
                marginBottom: '6px',
                userSelect: 'none'
              }}>
                Contraseña
              </label>
              <div style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center'
              }}>
                <Lock 
                  size={18} 
                  color={colors.textSecondary}
                  style={{ position: 'absolute', left: '12px' }}
                />
                <input
                  ref={passwordInputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tu contraseña"
                  required
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 40px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    backgroundColor: colors.background,
                    color: colors.text,
                    fontSize: '14px',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={() => setShowChecklist(true)}
                  onBlur={() => setTimeout(() => setShowChecklist(false), 150)}
                  onInput={() => setShowChecklist(true)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: colors.textSecondary,
                    padding: '4px'
                  }}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {/* Checklist tipo tooltip */}
              <AnimatePresence>
                {!isLogin && showChecklist && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      position: 'absolute',
                      left: '105%',
                      top: 0,
                      zIndex: 20,
                      minWidth: 220,
                      maxWidth: 260,
                      background: colors.surface,
                      borderRadius: '10px',
                      border: `1px solid ${colors.border}`,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.13)',
                      padding: '14px 18px',
                      fontSize: '13px',
                      color: colors.textSecondary,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      // Responsive: debajo en móvil
                      ...(window.innerWidth < 700 ? {
                        left: 0,
                        top: '110%',
                        minWidth: '100%',
                        maxWidth: '100%',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.10)'
                      } : {})
                    }}
                  >
                    <div style={{ fontWeight: 500, marginBottom: 2, color: colors.text }}>La contraseña debe contener:</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {passwordChecks.length ? <CheckCircle size={14} color={colors.success} /> : <XCircle size={14} color={colors.error} />}
                      <span>Mínimo 8 caracteres</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {passwordChecks.upper ? <CheckCircle size={14} color={colors.success} /> : <XCircle size={14} color={colors.error} />}
                      <span>Una mayúscula</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {passwordChecks.lower ? <CheckCircle size={14} color={colors.success} /> : <XCircle size={14} color={colors.error} />}
                      <span>Una minúscula</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {passwordChecks.number ? <CheckCircle size={14} color={colors.success} /> : <XCircle size={14} color={colors.error} />}
                      <span>Un número</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      {passwordChecks.special ? <CheckCircle size={14} color={colors.success} /> : <XCircle size={14} color={colors.error} />}
                      <span>Un carácter especial</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Error message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    backgroundColor: colors.error + '22',
                    border: `1px solid ${colors.error}`,
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '16px',
                    color: colors.error,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                >
                  {error}
                </motion.div>
              )}
              {/* Mensaje si la contraseña es débil */}
              {!isLogin && !isPasswordStrong && password.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  style={{
                    backgroundColor: colors.warning + '22',
                    border: `1px solid ${colors.warning}`,
                    borderRadius: '8px',
                    padding: '10px',
                    marginBottom: '16px',
                    color: colors.warning,
                    fontSize: '14px',
                    userSelect: 'none'
                  }}
                >
                  La contraseña no cumple los requisitos mínimos.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Botón de envío */}
            <motion.button
              type="submit"
              disabled={loading || (!isLogin && !isPasswordStrong)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '16px',
                fontWeight: '600',
                cursor: loading || (!isLogin && !isPasswordStrong) ? 'not-allowed' : 'pointer',
                opacity: loading || (!isLogin && !isPasswordStrong) ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s ease',
                userSelect: 'none'
              }}
            >
              {loading ? (
                <div style={{
                  width: '20px',
                  height: '20px',
                  border: '2px solid transparent',
                  borderTop: '2px solid white',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite'
                }} />
              ) : (
                <>
                  {isLogin ? <LogIn size={18} /> : <UserPlus size={18} />}
                  {isLogin ? 'Iniciar sesión' : 'Crear cuenta'}
                </>
              )}
            </motion.button>
          </form>

          {/* Cambiar modo */}
          <div style={{
            textAlign: 'center',
            marginTop: '20px',
            paddingTop: '20px',
            borderTop: `1px solid ${colors.border}`
          }}>
            <p style={{
              color: colors.textSecondary,
              fontSize: '14px',
              margin: '0 0 8px 0',
              userSelect: 'none'
            }}>
              {isLogin ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
            </p>
            <button
              onClick={toggleMode}
              style={{
                background: 'none',
                border: 'none',
                color: colors.primary,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                textDecoration: 'underline',
                userSelect: 'none'
              }}
            >
              {isLogin ? 'Crear cuenta' : 'Iniciar sesión'}
            </button>
          </div>
        </motion.div>

      {/* Indicador de conexión en la esquina inferior derecha */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 1000
      }}>
        <ConnectionTest compact={true} />
      </div>

      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoginPage; 