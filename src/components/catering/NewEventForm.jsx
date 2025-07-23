import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Calendar, 
  Clock, 
  Users, 
  MapPin, 
  User,
  Phone,
  Mail,
  Save,
  X,
  AlertCircle,
  CheckCircle
} from 'feather-icons-react';
import { useTheme } from '../ThemeContext';
import { useCatering } from './CateringContext';

const eventTypes = [
  'Boda',
  'Cumpleaños',
  'Evento Corporativo',
  'Comida de Empresa',
  'Celebración Familiar',
  'Otro'
];

const NewEventForm = ({ onCancel }) => {
  const { colors } = useTheme();
  const { createEvent, goBack } = useCatering();
  const [formData, setFormData] = useState({
    clientName: '',
    clientPhone: '',
    clientEmail: '',
    eventType: '',
    date: '',
    time: '',
    location: '',
    guests: '',
    notes: '',
    priority: 'media'
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validateForm = () => {
    const newErrors = {};

    if (!formData.clientName.trim()) {
      newErrors.clientName = 'El nombre del cliente es obligatorio';
    }

    if (!formData.clientPhone.trim()) {
      newErrors.clientPhone = 'El teléfono es obligatorio';
    }

    if (!formData.clientEmail.trim()) {
      newErrors.clientEmail = 'El email es obligatorio';
    } else if (!/\S+@\S+\.\S+/.test(formData.clientEmail)) {
      newErrors.clientEmail = 'El email no es válido';
    }

    if (!formData.eventType) {
      newErrors.eventType = 'Debes seleccionar un tipo de evento';
    }

    if (!formData.date) {
      newErrors.date = 'La fecha es obligatoria';
    } else {
      const selectedDate = new Date(formData.date);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        newErrors.date = 'La fecha no puede ser anterior a hoy';
      }
    }

    if (!formData.time) {
      newErrors.time = 'La hora es obligatoria';
    }

    if (!formData.location.trim()) {
      newErrors.location = 'La ubicación es obligatoria';
    }

    if (!formData.guests || formData.guests < 1) {
      newErrors.guests = 'El número de invitados debe ser mayor a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      const eventData = {
        client_name: formData.clientName,
        client_phone: formData.clientPhone,
        client_email: formData.clientEmail,
        event_type: formData.eventType,
        date: formData.date,
        time: formData.time,
        location: formData.location,
        guests: parseInt(formData.guests),
        notes: formData.notes,
        priority: formData.priority
      };

      await createEvent(eventData);
      goBack();
    } catch (error) {
      console.error('Error al guardar evento:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Limpiar error del campo si existe
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const getMinDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
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
      zIndex: 1000,
      padding: '40px 20px'
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        style={{
          background: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          padding: '24px',
          maxWidth: '1000px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          scrollbarWidth: 'thin',
          scrollbarColor: `${colors.border} transparent`
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '32px'
        }}>
          <h2 style={{
            color: colors.text,
            fontSize: '24px',
            fontWeight: '700',
            margin: 0
          }}>
            Nuevo Evento de Catering
          </h2>
          
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={onCancel || goBack}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '6px',
              color: colors.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </motion.button>
        </div>

        <form onSubmit={handleSubmit}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '24px',
            marginBottom: '32px',
            position: 'relative'
          }}>
            <div style={{
              position: 'absolute',
              left: '50%',
              top: '0',
              bottom: '0',
              width: '1px',
              background: colors.border,
              transform: 'translateX(-50%)'
            }} />
            {/* Información del Cliente */}
            <div style={{ maxWidth: '400px' }}>
              <h3 style={{
                color: colors.text,
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '12px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <User size={18} />
                Información del Cliente
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px'
                  }}>
                    Nombre del Cliente *
                  </label>
                  <input
                    type="text"
                    value={formData.clientName}
                    onChange={(e) => handleInputChange('clientName', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `1px solid ${errors.clientName ? colors.error : colors.border}`,
                      borderRadius: '8px',
                      background: colors.background,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="Nombre completo del cliente"
                  />
                  {errors.clientName && (
                    <div style={{
                      color: colors.error,
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={12} />
                      {errors.clientName}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px'
                    }}>
                      Teléfono *
                    </label>
                    <input
                      type="tel"
                      value={formData.clientPhone}
                      onChange={(e) => handleInputChange('clientPhone', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '140px',
                        padding: '12px 16px',
                        border: `1px solid ${errors.clientPhone ? colors.error : colors.border}`,
                        borderRadius: '8px',
                        background: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="+34 600 000 000"
                    />
                    {errors.clientPhone && (
                      <div style={{
                        color: colors.error,
                        fontSize: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} />
                        {errors.clientPhone}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px'
                    }}>
                      Email *
                    </label>
                    <input
                      type="email"
                      value={formData.clientEmail}
                      onChange={(e) => handleInputChange('clientEmail', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '200px',
                        padding: '12px 16px',
                        border: `1px solid ${errors.clientEmail ? colors.error : colors.border}`,
                        borderRadius: '8px',
                        background: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="cliente@email.com"
                    />
                    {errors.clientEmail && (
                      <div style={{
                        color: colors.error,
                        fontSize: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} />
                        {errors.clientEmail}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Detalles del Evento */}
            <div style={{ maxWidth: '400px' }}>
              <h3 style={{
                color: colors.text,
                fontSize: '18px',
                fontWeight: '600',
                marginBottom: '20px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                paddingBottom: '12px',
                borderBottom: `1px solid ${colors.border}`
              }}>
                <Calendar size={18} />
                Detalles del Evento
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px'
                  }}>
                    Tipo de Evento *
                  </label>
                  <select
                    value={formData.eventType}
                    onChange={(e) => handleInputChange('eventType', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `1px solid ${errors.eventType ? colors.error : colors.border}`,
                      borderRadius: '8px',
                      background: colors.background,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none'
                    }}
                  >
                    <option value="">Seleccionar tipo de evento</option>
                    {eventTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  {errors.eventType && (
                    <div style={{
                      color: colors.error,
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={12} />
                      {errors.eventType}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px'
                    }}>
                      Fecha *
                    </label>
                    <input
                      type="date"
                      value={formData.date}
                      onChange={(e) => handleInputChange('date', e.target.value)}
                      min={getMinDate()}
                      style={{
                        width: '100%',
                        maxWidth: '140px',
                        padding: '12px 16px',
                        border: `1px solid ${errors.date ? colors.error : colors.border}`,
                        borderRadius: '8px',
                        background: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    {errors.date && (
                      <div style={{
                        color: colors.error,
                        fontSize: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} />
                        {errors.date}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px'
                    }}>
                      Hora *
                    </label>
                    <input
                      type="time"
                      value={formData.time}
                      onChange={(e) => handleInputChange('time', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '120px',
                        padding: '12px 16px',
                        border: `1px solid ${errors.time ? colors.error : colors.border}`,
                        borderRadius: '8px',
                        background: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                    {errors.time && (
                      <div style={{
                        color: colors.error,
                        fontSize: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} />
                        {errors.time}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label style={{
                    display: 'block',
                    color: colors.text,
                    fontSize: '14px',
                    fontWeight: '500',
                    marginBottom: '8px'
                  }}>
                    Ubicación *
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      border: `1px solid ${errors.location ? colors.error : colors.border}`,
                      borderRadius: '8px',
                      background: colors.background,
                      color: colors.text,
                      fontSize: '14px',
                      outline: 'none'
                    }}
                    placeholder="Dirección del evento"
                  />
                  {errors.location && (
                    <div style={{
                      color: colors.error,
                      fontSize: '12px',
                      marginTop: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <AlertCircle size={12} />
                      {errors.location}
                    </div>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <label style={{
                      display: 'block',
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px'
                    }}>
                      Número de Invitados *
                    </label>
                    <input
                      type="number"
                      value={formData.guests}
                      onChange={(e) => handleInputChange('guests', e.target.value)}
                      min="1"
                      style={{
                        width: '100%',
                        maxWidth: '100px',
                        padding: '12px 16px',
                        border: `1px solid ${errors.guests ? colors.error : colors.border}`,
                        borderRadius: '8px',
                        background: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none'
                      }}
                      placeholder="50"
                    />
                    {errors.guests && (
                      <div style={{
                        color: colors.error,
                        fontSize: '12px',
                        marginTop: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <AlertCircle size={12} />
                        {errors.guests}
                      </div>
                    )}
                  </div>

                  <div>
                    <label style={{
                      display: 'block',
                      color: colors.text,
                      fontSize: '14px',
                      fontWeight: '500',
                      marginBottom: '8px'
                    }}>
                      Prioridad
                    </label>
                    <select
                      value={formData.priority}
                      onChange={(e) => handleInputChange('priority', e.target.value)}
                      style={{
                        width: '100%',
                        maxWidth: '120px',
                        padding: '12px 16px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        background: colors.background,
                        color: colors.text,
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    >
                      <option value="baja">Baja</option>
                      <option value="media">Media</option>
                      <option value="alta">Alta</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notas adicionales */}
          <div style={{ marginBottom: '32px', maxWidth: '800px' }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              marginBottom: '20px',
              paddingBottom: '12px',
              borderBottom: `1px solid ${colors.border}`
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                background: colors.primary,
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  background: 'white',
                  borderRadius: '50%'
                }} />
              </div>
              <span style={{
                color: colors.text,
                fontSize: '18px',
                fontWeight: '600'
              }}>
                Notas Adicionales
              </span>
            </div>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              rows="4"
              style={{
                width: '100%',
                padding: '12px 16px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                background: colors.background,
                color: colors.text,
                fontSize: '14px',
                outline: 'none',
                resize: 'vertical'
              }}
              placeholder="Información adicional, alergias, preferencias especiales..."
            />
          </div>

          {/* Separador antes de botones */}
          <div style={{
            height: '1px',
            background: colors.border,
            margin: '32px 0 24px 0'
          }} />

          {/* Botones de acción */}
          <div style={{
            display: 'flex',
            gap: '16px',
            justifyContent: 'flex-end'
          }}>
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onCancel || goBack}
              style={{
                padding: '12px 24px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                background: colors.surface,
                color: colors.text,
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer'
              }}
            >
              Cancelar
            </motion.button>

            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={isSubmitting}
              style={{
                padding: '12px 24px',
                border: 'none',
                borderRadius: '8px',
                background: isSubmitting ? colors.textSecondary : colors.primary,
                color: 'white',
                fontSize: '14px',
                fontWeight: '600',
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              {isSubmitting ? (
                <>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid transparent',
                    borderTop: '2px solid white',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  Guardando...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Guardar Evento
                </>
              )}
            </motion.button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default NewEventForm; 