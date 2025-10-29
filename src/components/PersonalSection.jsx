import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Users, ExternalLink, Clock, Edit2, Save, X } from 'lucide-react';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';
import holdedEmployeesService from '../services/holdedEmployeesService';
import hojaRutaService from '../services/hojaRutaSupabaseService';

const PersonalSection = ({ personal, hojaId, onNavigateToEmployee, onUpdate }) => {
  const { colors } = useTheme();
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState(null);
  
  // Cargar perfil del usuario para obtener el rol
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('role')
          .eq('id', user.id)
          .single();
          
        if (!error && data) {
          setUserProfile(data);
        }
      }
    };
    fetchUserProfile();
  }, [user]);
  
  // Verificar si el usuario puede ver/editar horas (solo jefes y admins)
  const canManageHoras = useMemo(() => {
    const role = userProfile?.role || user?.user_metadata?.role || '';
    return ['jefe', 'admin', 'administrador'].includes(role.toLowerCase());
  }, [userProfile, user]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [trabajadores, setTrabajadores] = useState([]);
  const [editingHoras, setEditingHoras] = useState(null);
  const [tempHoras, setTempHoras] = useState(0);

  // Cargar empleados y horas existentes
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        // Cargar empleados de Holded
        const empleadosData = await holdedEmployeesService.getEmployeesTransformed('solucions');
        setEmpleados(empleadosData);

        // Función auxiliar para buscar empleado dentro del useEffect
        const buscarEmpleadoEnData = (nombre) => {
          if (!nombre || !empleadosData.length) return null;
          
          const nombreLimpio = nombre.toLowerCase().trim();
          const palabrasBusqueda = nombreLimpio.split(/\s+/);
          
          return empleadosData.find(emp => {
            const nombreCompletoLower = emp.nombreCompleto?.toLowerCase() || '';
            const nombreLower = emp.nombre?.toLowerCase() || '';
            const apellidosLower = emp.apellidos?.toLowerCase() || '';
            const nombreCompletoLowerSinEspacios = nombreCompletoLower.replace(/\s+/g, '');
            const nombreBusquedaSinEspacios = nombreLimpio.replace(/\s+/g, '');
            
            // Coincidencia exacta
            if (nombreCompletoLower === nombreLimpio || nombreLower === nombreLimpio) {
              return true;
            }
            
            // Incluye el nombre completo
            if (nombreCompletoLower.includes(nombreLimpio) || nombreLimpio.includes(nombreCompletoLower)) {
              return true;
            }
            
            // Coincidencia sin espacios
            if (nombreCompletoLowerSinEspacios.includes(nombreBusquedaSinEspacios)) {
              return true;
            }
            
            // Coincidencia parcial por palabras
            if (palabrasBusqueda.length > 1) {
              const todasLasPalabrasCoinciden = palabrasBusqueda.every(palabra => 
                nombreCompletoLower.includes(palabra) || nombreLower.includes(palabra) || apellidosLower.includes(palabra)
              );
              if (todasLasPalabrasCoinciden) {
                return true;
              }
            }
            
            // Coincidencia con nombre o apellidos individuales
            if (nombreLower.includes(nombreLimpio) || apellidosLower.includes(nombreLimpio)) {
              return true;
            }
            
            return false;
          });
        };

        // Cargar horas existentes
        const horasExistentes = hojaId ? await hojaRutaService.obtenerHorasPersonal(hojaId) : [];
        
        // Dividir personal y crear estructura de trabajadores
        const nombresPersonal = dividirPersonal(personal);
        const trabajadoresData = nombresPersonal.map((nombre, index) => {
          const nombreLimpio = nombre.trim();
          const horasData = horasExistentes.find(h => h.nombre === nombreLimpio);
          
          // Si hay horasData con empleadoId, buscar ese empleado específico por ID
          let empleado = null;
          if (horasData?.empleadoId) {
            empleado = empleadosData.find(emp => String(emp.id) === String(horasData.empleadoId));
            if (empleado) {
              console.log('✅ Empleado encontrado por ID:', nombreLimpio, '->', empleado.nombreCompleto, 'ID:', empleado.id);
            } else {
              console.log('⚠️ No se encontró empleado con ID:', horasData.empleadoId, 'para:', nombreLimpio);
            }
          }
          
          // Si no se encontró por ID, buscar por nombre
          if (!empleado) {
            empleado = buscarEmpleadoEnData(nombreLimpio);
            if (empleado) {
              console.log('✅ Empleado encontrado por nombre:', nombreLimpio, '->', empleado.nombreCompleto, 'ID:', empleado.id);
            }
          }
          
          return {
            id: index,
            nombre: nombreLimpio,
            empleado: empleado,
            empleadoId: empleado?.id ? String(empleado.id) : (horasData?.empleadoId ? String(horasData.empleadoId) : null),
            horas: horasData?.horas || 0
          };
        });

        setTrabajadores(trabajadoresData);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [personal, hojaId]);

  // Función para buscar empleados por nombre
  const buscarEmpleado = (nombre) => {
    if (!nombre || !empleados.length) return null;
    
    const nombreLimpio = nombre.toLowerCase().trim();
    
    // Dividir el nombre en palabras
    const palabrasBusqueda = nombreLimpio.split(/\s+/);
    
    return empleados.find(emp => {
      const nombreCompletoLower = emp.nombreCompleto?.toLowerCase() || '';
      const nombreLower = emp.nombre?.toLowerCase() || '';
      const apellidosLower = emp.apellidos?.toLowerCase() || '';
      const nombreCompletoLowerSinEspacios = nombreCompletoLower.replace(/\s+/g, '');
      const nombreBusquedaSinEspacios = nombreLimpio.replace(/\s+/g, '');
      
      // Coincidencia exacta
      if (nombreCompletoLower === nombreLimpio || nombreLower === nombreLimpio) {
        return true;
      }
      
      // Incluye el nombre completo
      if (nombreCompletoLower.includes(nombreLimpio) || nombreLimpio.includes(nombreCompletoLower)) {
        return true;
      }
      
      // Coincidencia sin espacios
      if (nombreCompletoLowerSinEspacios.includes(nombreBusquedaSinEspacios)) {
        return true;
      }
      
      // Coincidencia parcial por palabras (si el nombre tiene múltiples palabras)
      if (palabrasBusqueda.length > 1) {
        const todasLasPalabrasCoinciden = palabrasBusqueda.every(palabra => 
          nombreCompletoLower.includes(palabra) || nombreLower.includes(palabra) || apellidosLower.includes(palabra)
        );
        if (todasLasPalabrasCoinciden) {
          return true;
        }
      }
      
      // Coincidencia con nombre o apellidos individuales
      if (nombreLower.includes(nombreLimpio) || apellidosLower.includes(nombreLimpio)) {
        return true;
      }
      
      return false;
    });
  };

  // Función para dividir el personal por +, comas, puntos y comas, o saltos de línea
  const dividirPersonal = (personal) => {
    if (!personal) return [];
    
    // Dividir por +, comas, puntos y comas, o saltos de línea
    return personal.split(/\+|[,;\n]/)
      .map(nombre => nombre.trim())
      .filter(nombre => nombre.length > 0);
  };

  // Iniciar edición de horas
  const iniciarEdicionHoras = (trabajador) => {
    setEditingHoras(trabajador.id);
    setTempHoras(trabajador.horas || 0);
  };

  // Cancelar edición
  const cancelarEdicion = () => {
    setEditingHoras(null);
    setTempHoras(0);
  };

  // Guardar horas
  const guardarHoras = async (trabajador) => {
    console.log('💾 Guardar horas - Trabajador:', trabajador);
    
    // Si hay un empleado vinculado, usar su ID; si no, buscar uno por nombre
    let empleadoVinculado = trabajador.empleado;
    
    // Si no hay empleado vinculado, intentar buscarlo de nuevo
    if (!empleadoVinculado && empleados.length > 0) {
      const nombreLimpio = trabajador.nombre.toLowerCase().trim();
      const palabrasBusqueda = nombreLimpio.split(/\s+/);
      
      empleadoVinculado = empleados.find(emp => {
        const nombreCompletoLower = emp.nombreCompleto?.toLowerCase() || '';
        const nombreLower = emp.nombre?.toLowerCase() || '';
        const apellidosLower = emp.apellidos?.toLowerCase() || '';
        const nombreCompletoLowerSinEspacios = nombreCompletoLower.replace(/\s+/g, '');
        const nombreBusquedaSinEspacios = nombreLimpio.replace(/\s+/g, '');
        
        // Coincidencia exacta
        if (nombreCompletoLower === nombreLimpio || nombreLower === nombreLimpio) {
          return true;
        }
        
        // Incluye el nombre completo
        if (nombreCompletoLower.includes(nombreLimpio) || nombreLimpio.includes(nombreCompletoLower)) {
          return true;
        }
        
        // Coincidencia sin espacios
        if (nombreCompletoLowerSinEspacios.includes(nombreBusquedaSinEspacios)) {
          return true;
        }
        
        // Coincidencia parcial por palabras
        if (palabrasBusqueda.length > 1) {
          const todasLasPalabrasCoinciden = palabrasBusqueda.every(palabra => 
            nombreCompletoLower.includes(palabra) || nombreLower.includes(palabra) || apellidosLower.includes(palabra)
          );
          if (todasLasPalabrasCoinciden) {
            return true;
          }
        }
        
        // Coincidencia con nombre o apellidos individuales
        if (nombreLower.includes(nombreLimpio) || apellidosLower.includes(nombreLimpio)) {
          return true;
        }
        
        return false;
      });
      
      if (empleadoVinculado) {
        console.log('🔗 Vinculando empleado automáticamente:', trabajador.nombre, '->', empleadoVinculado.nombreCompleto, 'ID:', empleadoVinculado.id);
      } else {
        console.log('⚠️ No se encontró empleado para:', trabajador.nombre);
      }
    }
    
    // Determinar el empleadoId final
    const empleadoIdFinal = empleadoVinculado?.id 
      ? String(empleadoVinculado.id) 
      : (trabajador.empleadoId ? String(trabajador.empleadoId) : null);
    
    console.log('📌 EmpleadoId final a guardar:', empleadoIdFinal);
    
    const nuevasHoras = trabajadores.map(t => 
      t.id === trabajador.id 
        ? { 
            ...t, 
            horas: Math.max(0, parseFloat(tempHoras) || 0), 
            empleado: empleadoVinculado || t.empleado,
            empleadoId: empleadoIdFinal
          }
        : t
    );

    setTrabajadores(nuevasHoras);
    
    // Preparar datos para guardar
    const horasParaGuardar = nuevasHoras.map(t => ({
      nombre: t.nombre,
      horas: t.horas,
      empleadoId: t.empleadoId || null
    }));
    
    console.log('💾 Guardando horas de personal:', horasParaGuardar);

    // Guardar en el servicio
    if (hojaId) {
      try {
        const hojaActualizada = await hojaRutaService.actualizarHorasPersonal(hojaId, horasParaGuardar);
        if (hojaActualizada && onUpdate) {
          onUpdate(hojaActualizada);
        }
      } catch (error) {
        console.error('Error guardando horas:', error);
      }
    }

    setEditingHoras(null);
  };

  // Función para manejar click en empleado (ver datos)
  const handleEmpleadoClick = (empleado) => {
    if (onNavigateToEmployee) {
      onNavigateToEmployee(empleado);
    }
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ 
        fontSize: '12px', 
        fontWeight: '600', 
        color: colors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: '0.5px',
        marginBottom: '8px',
        display: 'block'
      }}>
        Personal
      </label>
      
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}>
        {trabajadores.map((trabajador) => {
          const isEditing = editingHoras === trabajador.id;
          
          return (
            <div key={trabajador.id} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px',
              backgroundColor: trabajador.empleado ? colors.surface : colors.background,
              border: `1px solid ${trabajador.empleado ? colors.primary : colors.border}`,
              borderRadius: '8px',
              transition: 'all 0.2s ease'
            }}>
              <Users size={14} color={trabajador.empleado ? colors.primary : colors.textSecondary} />
              
              <span style={{
                fontSize: '14px',
                fontWeight: '500',
                color: trabajador.empleado ? colors.text : colors.textSecondary,
                flex: 1
              }}>
                {trabajador.nombre}
              </span>

              {/* Input de horas - Solo visible para jefes/admins */}
              {canManageHoras && isEditing ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Clock size={14} color={colors.primary} />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={tempHoras}
                    onChange={(e) => setTempHoras(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        guardarHoras(trabajador);
                      } else if (e.key === 'Escape') {
                        cancelarEdicion();
                      }
                    }}
                    autoFocus
                    style={{
                      width: '70px',
                      padding: '4px 8px',
                      border: `1px solid ${colors.primary}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      textAlign: 'center',
                      backgroundColor: colors.background,
                      color: colors.text
                    }}
                  />
                  <span style={{
                    fontSize: '12px',
                    color: colors.textSecondary
                  }}>
                    h
                  </span>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => guardarHoras(trabajador)}
                    style={{
                      padding: '4px',
                      backgroundColor: colors.success,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <Save size={12} />
                  </motion.button>
                  
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={cancelarEdicion}
                    style={{
                      padding: '4px',
                      backgroundColor: colors.error,
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <X size={12} />
                  </motion.button>
                </div>
              ) : (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {/* Mostrar horas solo si tiene permisos */}
                  {canManageHoras && trabajador.horas > 0 && (
                    <span style={{
                      fontSize: '14px',
                      fontWeight: '600',
                      color: colors.primary,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Clock size={14} />
                      {trabajador.horas}h
                    </span>
                  )}
                  
                  {/* Botón para editar horas - Solo visible para jefes/admins */}
                  {canManageHoras && (
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => iniciarEdicionHoras(trabajador)}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: colors.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <Edit2 size={12} />
                      {trabajador.horas > 0 ? 'Editar' : 'Añadir horas'}
                    </motion.button>
                  )}
                  
                  {/* Botón ver datos si tiene empleado vinculado */}
                  {trabajador.empleado && (
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleEmpleadoClick(trabajador.empleado)}
                      style={{
                        padding: '4px 8px',
                        backgroundColor: colors.success,
                        color: 'white',
                        border: 'none',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}
                    >
                      <ExternalLink size={12} />
                      Ver datos
                    </motion.button>
                  )}
                  
                  {/* Indicador si no está vinculado */}
                  {!trabajador.empleado && (
                    <span style={{
                      fontSize: '12px',
                      color: colors.textSecondary,
                      fontStyle: 'italic'
                    }}>
                      No encontrado
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {loading && (
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          marginTop: '8px',
          fontSize: '12px',
          color: colors.textSecondary
        }}>
          Cargando empleados...
        </div>
      )}
      
      {/* Total horas - Solo visible para jefes/admins */}
      {canManageHoras && !loading && trabajadores.length > 0 && (
        <div style={{
          marginTop: '12px',
          padding: '12px',
          backgroundColor: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '12px',
              fontWeight: '500',
              color: colors.textSecondary
            }}>
              Total horas:
            </span>
            <span style={{
              fontSize: '16px',
              fontWeight: '600',
              color: colors.primary
            }}>
              {trabajadores.reduce((sum, t) => sum + (t.horas || 0), 0)}h
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default PersonalSection;