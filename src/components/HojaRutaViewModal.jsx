import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  X,
  Calendar,
  Users,
  Clock,
  MapPin,
  Phone,
  Truck,
  FileText,
  AlertCircle,
  CheckCircle,
  Coffee,
  Utensils,
  Wine,
  Pen
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import productosIdoniService from '../services/productosIdoniSupabaseService';
import { supabase } from '../config/supabase';

const HojaRutaViewModal = ({
  isOpen,
  onClose,
  hojaRuta
}) => {
  const { colors } = useTheme();
  const [productosIdoni, setProductosIdoni] = useState([]);

  // Cargar productos IDONI/BONCOR de esta hoja de ruta
  useEffect(() => {
    const cargarProductos = async () => {
      if (!hojaRuta?.id || !isOpen) return;

      try {
        const { data, error } = await supabase
          .from('productos_idoni')
          .select('*')
          .eq('hoja_ruta_id', hojaRuta.id);

        if (!error && data) {
          setProductosIdoni(data);
        }
      } catch (error) {
        console.error('Error cargando productos IDONI:', error);
      }
    };

    cargarProductos();
  }, [isOpen, hojaRuta]);

  // Función para obtener el estado de un producto por su nombre
  const getProductoEstado = (nombreProducto) => {
    const producto = productosIdoni.find(p =>
      p.producto.toLowerCase() === nombreProducto.toLowerCase()
    );
    return producto?.estado || null;
  };

  // Función para obtener el color del estado
  const getEstadoColor = (estado) => {
    switch (estado) {
      case 'disponible':
        return '#10B981';
      case 'no_disponible':
        return '#EF4444';
      case 'pendiente':
      default:
        return '#F59E0B';
    }
  };

  // Función para obtener el label del estado
  const getEstadoLabel = (estado) => {
    switch (estado) {
      case 'disponible':
        return 'Disponible';
      case 'no_disponible':
        return 'No Disponible';
      case 'pendiente':
      default:
        return 'Pendiente';
    }
  };

  if (!isOpen || !hojaRuta) return null;

  const formatFecha = (fecha) => {
    if (!fecha) return '';
    return new Date(fecha).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatHora = (hora) => {
    if (!hora) return '';
    return hora.replace('H', 'h');
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1001
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        style={{
          backgroundColor: colors.surface,
          borderRadius: '16px',
          padding: '24px',
          maxWidth: '1000px',
          width: '95%',
          maxHeight: '90vh',
          overflow: 'hidden',
          border: `1px solid ${colors.border}`
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px',
          paddingBottom: '16px',
          borderBottom: `1px solid ${colors.border}`
        }}>
          <h2 style={{
            fontSize: '20px',
            fontWeight: 'bold',
            color: colors.text,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}>
            <FileText size={24} color={colors.primary} />
            {hojaRuta.cliente || 'Hoja de Ruta'}
          </h2>
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} color={colors.textSecondary} />
          </motion.button>
        </div>

        {/* Content */}
        <div style={{
          maxHeight: '70vh',
          overflowY: 'auto',
          paddingRight: '8px'
        }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            {/* Información principal */}
            <div style={{ flex: 2 }}>
              {/* Información General */}
              <div style={{
                backgroundColor: colors.background,
                borderRadius: '12px',
                padding: '20px',
                border: `1px solid ${colors.border}`,
                marginBottom: '20px'
              }}>
                <h3 style={{
                  fontSize: '16px',
                  fontWeight: 'bold',
                  color: colors.text,
                  margin: '0 0 16px 0',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  <Calendar size={18} color={colors.primary} />
                  Información General
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Fecha del Servicio
                    </label>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      margin: 0
                    }}>
                      {formatFecha(hojaRuta.fechaServicio)}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Cliente
                    </label>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      margin: 0
                    }}>
                      {hojaRuta.cliente}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Nº Personas
                    </label>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Users size={12} color={colors.primary} />
                      {hojaRuta.numPersonas}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Responsable
                    </label>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      margin: 0
                    }}>
                      {hojaRuta.responsable}
                    </p>
                  </div>

                  {/* Verificación de Listas y Material */}
                  {hojaRuta.firmaInfo?.firmado && (
                    <div style={{ gridColumn: '1 / -1' }}>
                      <label style={{
                        fontSize: '11px',
                        fontWeight: '600',
                        color: colors.textSecondary,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                        marginBottom: '8px',
                        display: 'block'
                      }}>
                        Verificación de Listas y Material
                      </label>
                      <div style={{
                        padding: '16px',
                        border: `2px solid ${colors.success}`,
                        borderRadius: '8px',
                        backgroundColor: colors.success + '10',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          color: colors.success,
                          fontWeight: '600'
                        }}>
                          <CheckCircle size={20} />
                          <span>FIRMADA</span>
                        </div>

                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '14px',
                            color: colors.text,
                            marginBottom: '4px',
                            fontWeight: '600'
                          }}>
                            Verificado por: <strong>{hojaRuta.firmaInfo.firmadoPor || hojaRuta.firmaInfo.firmado_por || 'N/A'}</strong>
                          </div>
                          <div style={{
                            fontSize: '12px',
                            color: colors.textSecondary
                          }}>
                            Fecha: {hojaRuta.firmaInfo.fechaFirma ? new Date(hojaRuta.firmaInfo.fechaFirma).toLocaleString('es-ES') : 'N/A'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Transportista
                    </label>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Truck size={12} color={colors.primary} />
                      {hojaRuta.transportista}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Personal
                    </label>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: colors.text,
                      margin: 0
                    }}>
                      {hojaRuta.personal}
                    </p>
                  </div>
                </div>

                {/* Contacto y Dirección */}
                <div style={{ marginTop: '16px' }}>
                  <div style={{ marginBottom: '8px' }}>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Contacto
                    </label>
                    <p style={{
                      fontSize: '12px',
                      color: colors.text,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <Phone size={12} color={colors.primary} />
                      {hojaRuta.contacto}
                    </p>
                  </div>

                  <div>
                    <label style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      color: colors.textSecondary,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      marginBottom: '2px',
                      display: 'block'
                    }}>
                      Dirección
                    </label>
                    <p style={{
                      fontSize: '12px',
                      color: colors.text,
                      margin: 0,
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '4px'
                    }}>
                      <MapPin size={12} color={colors.primary} style={{ marginTop: '1px', flexShrink: 0 }} />
                      {hojaRuta.direccion}
                    </p>
                  </div>
                </div>
              </div>

              {/* Horarios */}
              {hojaRuta.horarios && Object.keys(hojaRuta.horarios).length > 0 && (
                <div style={{
                  backgroundColor: colors.background,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`,
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: colors.text,
                    margin: '0 0 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Clock size={18} color={colors.primary} />
                    Horarios
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }}>
                    {Object.entries(hojaRuta.horarios).map(([key, value]) => (
                      <div key={key} style={{
                        padding: '12px',
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <label style={{
                          fontSize: '10px',
                          fontWeight: '600',
                          color: colors.textSecondary,
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          marginBottom: '2px',
                          display: 'block'
                        }}>
                          {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                        </label>
                        <p style={{
                          fontSize: '14px',
                          fontWeight: '500',
                          color: colors.text,
                          margin: 0
                        }}>
                          {formatHora(value)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Equipamiento */}
              {hojaRuta.equipamiento && hojaRuta.equipamiento.length > 0 && (
                <div style={{
                  backgroundColor: colors.background,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`,
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: colors.text,
                    margin: '0 0 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Utensils size={18} color={colors.primary} />
                    Equipamiento y Material
                  </h3>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    {hojaRuta.equipamiento.map((item, index) => (
                      <div key={index} style={{
                        padding: '8px',
                        backgroundColor: colors.surface,
                        borderRadius: '6px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <p style={{
                          fontSize: '12px',
                          fontWeight: '600',
                          color: colors.text,
                          margin: '0 0 2px 0'
                        }}>
                          {item.item}
                        </p>
                        {item.cantidad && (
                          <p style={{
                            fontSize: '10px',
                            color: colors.textSecondary,
                            margin: 0
                          }}>
                            Cantidad: {item.cantidad}
                          </p>
                        )}
                        {item.nota && (
                          <p style={{
                            fontSize: '10px',
                            color: colors.textSecondary,
                            margin: '2px 0 0 0',
                            fontStyle: 'italic'
                          }}>
                            Nota: {item.nota}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Sidebar */}
            <div style={{ flex: 1 }}>
              {/* Menús */}
              {hojaRuta.menus && hojaRuta.menus.length > 0 && (
                <div style={{
                  backgroundColor: colors.background,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`,
                  marginBottom: '20px'
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: colors.text,
                    margin: '0 0 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <Coffee size={18} color={colors.primary} />
                    Menús
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {Object.entries(
                      hojaRuta.menus.reduce((groups, menu) => {
                        const tipo = menu.tipo;
                        if (!groups[tipo]) groups[tipo] = [];
                        groups[tipo].push(menu);
                        return groups;
                      }, {})
                    ).map(([tipo, menus]) => (
                      <div key={tipo}>
                        <h4 style={{
                          fontSize: '12px',
                          fontWeight: 'bold',
                          color: colors.primary,
                          margin: '0 0 8px 0',
                          padding: '4px 8px',
                          backgroundColor: colors.primary + '10',
                          borderRadius: '4px'
                        }}>
                          {hojaRuta.menuTitles && hojaRuta.menuTitles[tipo]
                            ? hojaRuta.menuTitles[tipo]
                            : tipo.replace('_', ' ').toUpperCase()
                          }
                        </h4>
                        <div style={{ marginLeft: '8px' }}>
                          {menus.map((menu, index) => {
                            const proveedorUpper = menu.proveedor?.trim().toUpperCase() || '';
                            const esProductoIdoni = proveedorUpper.includes('IDONI') || proveedorUpper.includes('BONCOR');
                            const estadoProducto = esProductoIdoni ? getProductoEstado(menu.item) : null;

                            return (
                              <div key={index} style={{
                                padding: '6px',
                                backgroundColor: colors.surface,
                                borderRadius: '4px',
                                marginBottom: '4px',
                                fontSize: '11px'
                              }}>
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginBottom: '2px'
                                }}>
                                  <p style={{
                                    fontWeight: '600',
                                    color: colors.text,
                                    margin: 0,
                                    flex: 1
                                  }}>
                                    {menu.item}
                                  </p>
                                  {estadoProducto && (
                                    <span style={{
                                      fontSize: '9px',
                                      fontWeight: '600',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      backgroundColor: `${getEstadoColor(estadoProducto)}15`,
                                      color: getEstadoColor(estadoProducto),
                                      whiteSpace: 'nowrap'
                                    }}>
                                      {getEstadoLabel(estadoProducto)}
                                    </span>
                                  )}
                                </div>
                                {menu.cantidad && (
                                  <p style={{
                                    color: colors.textSecondary,
                                    margin: 0
                                  }}>
                                    {menu.cantidad} {menu.proveedor && `- ${menu.proveedor}`}
                                  </p>
                                )}
                                {menu.nota && (
                                  <p style={{
                                    color: colors.textSecondary,
                                    margin: '2px 0 0 0',
                                    fontStyle: 'italic',
                                    fontSize: '10px'
                                  }}>
                                    Nota: {menu.nota}
                                  </p>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Notas importantes */}
              {hojaRuta.notas && hojaRuta.notas.length > 0 && (
                <div style={{
                  backgroundColor: colors.background,
                  borderRadius: '12px',
                  padding: '20px',
                  border: `1px solid ${colors.border}`
                }}>
                  <h3 style={{
                    fontSize: '16px',
                    fontWeight: 'bold',
                    color: colors.text,
                    margin: '0 0 16px 0',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <AlertCircle size={18} color={colors.warning} />
                    Notas Importantes
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {hojaRuta.notas.map((nota, index) => (
                      <div key={index} style={{
                        padding: '8px',
                        backgroundColor: colors.warning + '10',
                        borderRadius: '6px',
                        border: `1px solid ${colors.warning + '30'}`
                      }}>
                        <p style={{
                          fontSize: '11px',
                          color: colors.text,
                          margin: 0,
                          fontWeight: '500'
                        }}>
                          {nota}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          marginTop: '20px',
          paddingTop: '16px',
          borderTop: `1px solid ${colors.border}`,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onClose}
            style={{
              backgroundColor: colors.surface,
              color: colors.text,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              padding: '12px 24px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            Cerrar
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
};

export default HojaRutaViewModal;
