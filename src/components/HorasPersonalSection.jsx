import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock, Plus, Trash2, Save, Users } from 'lucide-react';
import hojaRutaService from '../services/hojaRutaService';
import holdedEmployeesService from '../services/holdedEmployeesService';

const HorasPersonalSection = ({ hojaId, personal, onUpdate }) => {
  const [horasPersonal, setHorasPersonal] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Cargar datos iniciales
  useEffect(() => {
    const cargarDatos = async () => {
      setLoading(true);
      try {
        // Cargar horas existentes
        const horasExistentes = hojaRutaService.obtenerHorasPersonal(hojaId);
        setHorasPersonal(horasExistentes);

        // Cargar empleados de Holded
        const empleadosData = await holdedEmployeesService.getEmployeesTransformed('solucions');
        setEmpleados(empleadosData);
      } catch (error) {
        console.error('Error cargando datos:', error);
      } finally {
        setLoading(false);
      }
    };

    cargarDatos();
  }, [hojaId]);

  // Generar lista inicial de personal si no hay horas asignadas
  useEffect(() => {
    if (horasPersonal.length === 0 && personal) {
      const nombresPersonal = personal.split(/[,;,\n]/)
        .map(nombre => nombre.trim())
        .filter(nombre => nombre.length > 0);

      const horasIniciales = nombresPersonal.map(nombre => ({
        nombre,
        horas: 0,
        empleadoId: null
      }));

      setHorasPersonal(horasIniciales);
    }
  }, [personal, horasPersonal.length]);

  // Buscar empleado por nombre
  const buscarEmpleado = (nombre) => {
    if (!nombre || !empleados.length) return null;
    
    const nombreLimpio = nombre.toLowerCase().trim();
    return empleados.find(emp => 
      emp.nombreCompleto.toLowerCase().includes(nombreLimpio) ||
      emp.nombre.toLowerCase().includes(nombreLimpio) ||
      emp.apellidos.toLowerCase().includes(nombreLimpio)
    );
  };

  // Actualizar horas de un trabajador
  const actualizarHoras = (index, horas) => {
    const nuevasHoras = [...horasPersonal];
    nuevasHoras[index] = {
      ...nuevasHoras[index],
      horas: Math.max(0, horas) // No permitir horas negativas
    };
    setHorasPersonal(nuevasHoras);
  };

  // Vincular empleado
  const vincularEmpleado = (index, empleado) => {
    const nuevasHoras = [...horasPersonal];
    nuevasHoras[index] = {
      ...nuevasHoras[index],
      empleadoId: empleado.id,
      nombre: empleado.nombreCompleto
    };
    setHorasPersonal(nuevasHoras);
  };

  // Desvincular empleado
  const desvincularEmpleado = (index) => {
    const nuevasHoras = [...horasPersonal];
    nuevasHoras[index] = {
      ...nuevasHoras[index],
      empleadoId: null
    };
    setHorasPersonal(nuevasHoras);
  };

  // Añadir nuevo trabajador
  const añadirTrabajador = () => {
    const nuevasHoras = [...horasPersonal, {
      nombre: '',
      horas: 0,
      empleadoId: null
    }];
    setHorasPersonal(nuevasHoras);
  };

  // Eliminar trabajador
  const eliminarTrabajador = (index) => {
    const nuevasHoras = horasPersonal.filter((_, i) => i !== index);
    setHorasPersonal(nuevasHoras);
  };

  // Guardar cambios
  const guardarCambios = async () => {
    setSaving(true);
    try {
      const hojaActualizada = hojaRutaService.actualizarHorasPersonal(hojaId, horasPersonal);
      if (hojaActualizada && onUpdate) {
        onUpdate(hojaActualizada);
      }
      console.log('✅ Horas de personal guardadas');
    } catch (error) {
      console.error('❌ Error guardando horas:', error);
    } finally {
      setSaving(false);
    }
  };

  const colors = {
    background: '#FFFFFF',
    surface: '#F9FAFB',
    border: '#E5E7EB',
    text: '#1F2937',
    textSecondary: '#6B7280',
    primary: '#3B82F6',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444'
  };

  if (loading) {
    return (
      <div style={{
        padding: '20px',
        textAlign: 'center',
        color: colors.textSecondary
      }}>
        Cargando datos de personal...
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: colors.surface,
      borderRadius: '12px',
      padding: '20px',
      border: `1px solid ${colors.border}`,
      marginBottom: '20px'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: colors.primary,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white'
          }}>
            <Clock size={20} />
          </div>
          <div>
            <h3 style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.text,
              margin: 0
            }}>
              Horas de Asignación
            </h3>
            <p style={{
              fontSize: '14px',
              color: colors.textSecondary,
              margin: 0
            }}>
              Asigna horas a cada trabajador del servicio
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={añadirTrabajador}
            style={{
              padding: '8px 12px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <Plus size={16} />
            Añadir
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={guardarCambios}
            disabled={saving}
            style={{
              padding: '8px 16px',
              backgroundColor: saving ? colors.textSecondary : colors.success,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: saving ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              opacity: saving ? 0.7 : 1
            }}
          >
            <Save size={16} />
            {saving ? 'Guardando...' : 'Guardar'}
          </motion.button>
        </div>
      </div>

      {/* Lista de trabajadores */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {horasPersonal.map((trabajador, index) => {
          const empleadoEncontrado = buscarEmpleado(trabajador.nombre);
          
          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                backgroundColor: colors.background,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '16px'
              }}
            >
              {/* Información del trabajador */}
              <div style={{ flex: 1 }}>
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px'
                }}>
                  <Users size={16} color={colors.primary} />
                  <span style={{
                    fontSize: '16px',
                    fontWeight: '500',
                    color: colors.text
                  }}>
                    {trabajador.nombre}
                  </span>
                  
                  {empleadoEncontrado && (
                    <span style={{
                      fontSize: '12px',
                      backgroundColor: colors.success,
                      color: 'white',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: '500'
                    }}>
                      Vinculado
                    </span>
                  )}
                </div>

                {/* Input de horas */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Clock size={14} color={colors.textSecondary} />
                  <input
                    type="number"
                    min="0"
                    step="0.5"
                    value={trabajador.horas}
                    onChange={(e) => actualizarHoras(index, parseFloat(e.target.value) || 0)}
                    style={{
                      width: '80px',
                      padding: '6px 8px',
                      border: `1px solid ${colors.border}`,
                      borderRadius: '6px',
                      fontSize: '14px',
                      textAlign: 'center'
                    }}
                    placeholder="0"
                  />
                  <span style={{
                    fontSize: '14px',
                    color: colors.textSecondary
                  }}>
                    horas
                  </span>
                </div>
              </div>

              {/* Botones de acción */}
              <div style={{ display: 'flex', gap: '8px' }}>
                {empleadoEncontrado && !trabajador.empleadoId && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => vincularEmpleado(index, empleadoEncontrado)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: colors.primary,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Vincular
                  </motion.button>
                )}

                {trabajador.empleadoId && (
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => desvincularEmpleado(index)}
                    style={{
                      padding: '6px 12px',
                      backgroundColor: colors.warning,
                      color: 'white',
                      border: 'none',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: '500',
                      cursor: 'pointer'
                    }}
                  >
                    Desvincular
                  </motion.button>
                )}

                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => eliminarTrabajador(index)}
                  style={{
                    padding: '6px',
                    backgroundColor: colors.error,
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Trash2 size={14} />
                </motion.button>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Resumen */}
      {horasPersonal.length > 0 && (
        <div style={{
          marginTop: '20px',
          padding: '16px',
          backgroundColor: colors.background,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`
        }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{
              fontSize: '14px',
              fontWeight: '500',
              color: colors.text
            }}>
              Total de horas:
            </span>
            <span style={{
              fontSize: '18px',
              fontWeight: '600',
              color: colors.primary
            }}>
              {horasPersonal.reduce((sum, t) => sum + t.horas, 0)} horas
            </span>
          </div>
          
          <div style={{
            fontSize: '12px',
            color: colors.textSecondary,
            marginTop: '4px'
          }}>
            {horasPersonal.filter(t => t.empleadoId).length} de {horasPersonal.length} trabajadores vinculados
          </div>
        </div>
      )}
    </div>
  );
};

export default HorasPersonalSection;

