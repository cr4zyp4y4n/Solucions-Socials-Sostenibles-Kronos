import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { 
  Users, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  Phone, 
  Mail,
  Eye,
  Building,
  User,
  Briefcase,
  CreditCard,
  MapPin,
  UserCheck,
  UserX,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Info,
  FileText,
  ExternalLink
} from 'lucide-react';
import holdedEmployeesService from '../services/holdedEmployeesService';
import hojaRutaService from '../services/hojaRutaSupabaseService';
import { useTheme } from './ThemeContext';
import { useNavigation } from './NavigationContext';
import { useAuth } from './AuthContext';
import { supabase } from '../config/supabase';

const EmpleadosPage = () => {
  const { colors } = useTheme();
  const { navigateTo } = useNavigation();
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
  
  // Verificar si el usuario puede ver horas (solo jefes y admins)
  const canManageHoras = useMemo(() => {
    const role = userProfile?.role || user?.user_metadata?.role || '';
    return ['jefe', 'admin', 'administrador'].includes(role.toLowerCase());
  }, [userProfile, user]);

  // Estados
  const [selectedEntity, setSelectedEntity] = useState('EI_SSS');
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('todos'); // todos, activos, inactivos
  const [selectedEmpleado, setSelectedEmpleado] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [historialServicios, setHistorialServicios] = useState([]);
  const [estadisticasHoras, setEstadisticasHoras] = useState(null);

  // Mapeo de entidades a company
  const entityToCompany = {
    'EI_SSS': 'solucions',
    'MENJAR_DHORT': 'menjar'
  };

  // Cargar empleados
  const loadEmpleados = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const company = entityToCompany[selectedEntity];
      console.log('🔍 Cargando empleados para:', company);
      
      const data = await holdedEmployeesService.getEmployeesTransformed(company);
      console.log('✅ Empleados cargados:', data);
      
      if (!Array.isArray(data)) {
        console.error('❌ Los datos no son un array:', data);
        throw new Error('Los datos recibidos no tienen el formato esperado');
      }
      
      setEmpleados(data);
    } catch (err) {
      console.error('❌ Error cargando empleados:', err);
      setError(err.message || 'Error al cargar los empleados');
      setEmpleados([]);
    } finally {
      setLoading(false);
    }
  }, [selectedEntity]);

  // Cargar histórico de servicios de un empleado
  const loadHistorialServicios = useCallback(async (empleadoId) => {
    try {
      console.log('📋 Cargando histórico para empleado:', empleadoId);
      const [historial, estadisticas] = await Promise.all([
        hojaRutaService.obtenerHistorialServicios(empleadoId),
        hojaRutaService.obtenerEstadisticasHorasEmpleado(empleadoId)
      ]);
      
      console.log('📊 Historial cargado:', historial);
      console.log('📈 Estadísticas:', estadisticas);
      
      setHistorialServicios(historial);
      setEstadisticasHoras(estadisticas);
    } catch (error) {
      console.error('❌ Error cargando histórico:', error);
      setHistorialServicios([]);
      setEstadisticasHoras(null);
    }
  }, []);

  // Cargar empleados al montar y cuando cambia la entidad
  useEffect(() => {
    loadEmpleados();
  }, [loadEmpleados]);

  // Abrir automáticamente el empleado seleccionado desde localStorage (navegación desde hoja de ruta)
  useEffect(() => {
    if (empleados.length > 0) {
      const selectedEmpleadoId = localStorage.getItem('selectedEmpleadoId');
      if (selectedEmpleadoId) {
        // Limpiar el localStorage primero para evitar loops
        localStorage.removeItem('selectedEmpleadoId');
        
        // Buscar el empleado por ID
        const empleadoEncontrado = empleados.find(emp => 
          String(emp.id) === String(selectedEmpleadoId)
        );
        
        if (empleadoEncontrado) {
          console.log('🔍 Empleado encontrado desde navegación:', empleadoEncontrado.nombreCompleto);
          // Abrir el modal del empleado directamente
          setSelectedEmpleado(empleadoEncontrado);
          setShowModal(true);
          
          // Cargar histórico de servicios
          if (empleadoEncontrado.id) {
            loadHistorialServicios(String(empleadoEncontrado.id));
          }
        } else {
          console.warn('⚠️ No se encontró el empleado con ID:', selectedEmpleadoId);
        }
      }
    }
  }, [empleados, loadHistorialServicios]);

  // Filtrar empleados
  const empleadosFiltrados = useMemo(() => {
    let filtered = [...empleados];

    // Filtrar por estado
    if (filterStatus === 'activos') {
      filtered = filtered.filter(emp => emp.activo);
    } else if (filterStatus === 'inactivos') {
      filtered = filtered.filter(emp => !emp.activo);
    }

    // Filtrar por búsqueda
    if (searchTerm.trim()) {
      filtered = holdedEmployeesService.searchEmployees(filtered, searchTerm);
    }

    return filtered;
  }, [empleados, filterStatus, searchTerm]);

  // Estadísticas
  const estadisticas = useMemo(() => {
    return holdedEmployeesService.getStatistics(empleados);
  }, [empleados]);

  // Mostrar detalles del empleado
  const showEmpleadoDetails = (empleado) => {
    console.log('👤 Abriendo detalles del empleado:', empleado.nombreCompleto, 'ID:', empleado.id, 'Tipo:', typeof empleado.id);
    setSelectedEmpleado(empleado);
    setShowModal(true);
    
    // Cargar histórico de servicios si el empleado tiene ID
    if (empleado.id) {
      console.log('🔍 Llamando loadHistorialServicios con ID:', empleado.id, 'String:', String(empleado.id));
      loadHistorialServicios(String(empleado.id));
    } else {
      console.warn('⚠️ El empleado no tiene ID:', empleado);
    }
  };

  // Cerrar modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedEmpleado(null);
  };

  // Exportar a Excel normal
  const exportToExcel = () => {
    alert('Función de exportación normal en desarrollo');
  };

  // Exportar para Subvención L2
  const exportForSubsidy = () => {
    try {
      const count = holdedEmployeesService.exportToExcelForSubsidy(empleados, [], 'empleados_subvencion_l2');
      alert(`✅ Exportado correctamente: ${count} empleados para Subvención L2`);
    } catch (error) {
      console.error('Error exportando para subvención:', error);
      alert('❌ Error al exportar para subvención');
    }
  };

  return (
    <div style={{
      padding: '32px',
      backgroundColor: colors.background,
      minHeight: '100vh',
      color: colors.text
    }}>
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        style={{ marginBottom: '32px' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <Users size={32} color={colors.primary} />
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text }}>
                Empleados
              </h1>
              <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '4px 0 0 0' }}>
                Gestión de empleados desde Holded
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadEmpleados}
            disabled={loading}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              backgroundColor: colors.primary,
              color: '#ffffff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1
            }}
          >
            <RefreshCw size={16} style={{ animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {loading ? 'Cargando...' : 'Actualizar'}
          </motion.button>
        </div>

        {/* Selector de Entidad - Estilo SubvencionesPage */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          style={{ marginBottom: '28px' }}
        >
          <h3 style={{ 
            margin: '0 0 20px 0', 
            color: colors.text, 
            fontSize: '20px', 
            fontWeight: '600' 
          }}>
            Seleccionar Entidad
          </h3>
          <div style={{
            display: 'flex',
            gap: '18px',
            flexWrap: 'wrap',
          }}>
            {/* EI SSS SCCL */}
            <motion.div
              whileHover={{ scale: 1.04, boxShadow: selectedEntity === 'EI_SSS' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedEntity('EI_SSS')}
              style={{
                minWidth: 200,
                flex: '1 1 200px',
                background: colors.card || colors.surface,
                borderRadius: 12,
                boxShadow: selectedEntity === 'EI_SSS' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
                border: selectedEntity === 'EI_SSS' ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
                color: selectedEntity === 'EI_SSS' ? colors.primary : colors.text,
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '22px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                transition: 'all 0.18s',
                fontWeight: selectedEntity === 'EI_SSS' ? 600 : 400,
                fontSize: 16,
                outline: selectedEntity === 'EI_SSS' ? `2px solid ${colors.primary}` : 'none',
                position: 'relative',
                opacity: loading ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Building size={24} />
                <span style={{ fontSize: '18px', fontWeight: '600' }}>EI SSS SCCL</span>
              </div>
              <span style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                Solucions Socials · Estructura i Serveis
              </span>
            </motion.div>

            {/* Menjar d'Hort */}
            <motion.div
              whileHover={{ scale: 1.04, boxShadow: selectedEntity === 'MENJAR_DHORT' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setSelectedEntity('MENJAR_DHORT')}
              style={{
                minWidth: 200,
                flex: '1 1 200px',
                background: colors.card || colors.surface,
                borderRadius: 12,
                boxShadow: selectedEntity === 'MENJAR_DHORT' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
                border: selectedEntity === 'MENJAR_DHORT' ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
                color: selectedEntity === 'MENJAR_DHORT' ? colors.primary : colors.text,
                cursor: loading ? 'not-allowed' : 'pointer',
                padding: '22px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                transition: 'all 0.18s',
                fontWeight: selectedEntity === 'MENJAR_DHORT' ? 600 : 400,
                fontSize: 16,
                outline: selectedEntity === 'MENJAR_DHORT' ? `2px solid ${colors.primary}` : 'none',
                position: 'relative',
                opacity: loading ? 0.6 : 1
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <Building size={24} />
                <span style={{ fontSize: '18px', fontWeight: '600' }}>Menjar d'Hort</span>
              </div>
              <span style={{ fontSize: '13px', color: colors.textSecondary, marginTop: '4px' }}>
                Cooperativa d'alimentació ecològica
              </span>
            </motion.div>
          </div>
        </motion.div>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          style={{ fontSize: '16px', color: colors.textSecondary, margin: '0 0 24px 0' }}
        >
          Gestión de empleados de {selectedEntity === 'MENJAR_DHORT' ? 'Menjar d\'Hort SCCL' : 'EI SSS SCCL'}
        </motion.p>

        {/* Estadísticas */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px'
          }}
        >
          {[
            { label: 'Total Empleados', value: estadisticas.total, icon: Users, color: colors.primary },
            { label: 'Activos', value: estadisticas.activos, icon: UserCheck, color: '#4CAF50' },
            { label: 'Inactivos', value: estadisticas.inactivos, icon: UserX, color: '#f44336' },
            { label: 'Departamentos', value: estadisticas.departamentos, icon: Briefcase, color: colors.primary }
          ].map((stat, index) => {
            const Icon = stat.icon;
            return (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.25 + index * 0.1 }}
                style={{
                  padding: '20px',
                  backgroundColor: colors.surface,
                  borderRadius: '12px',
                  border: `1px solid ${colors.border}`,
                  userSelect: 'none'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                  <Icon size={20} color={stat.color} />
                  <span style={{ fontSize: '14px', color: colors.textSecondary, fontWeight: '500' }}>{stat.label}</span>
                </div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: colors.text }}>{stat.value}</div>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Filtros y Búsqueda */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          style={{
            backgroundColor: colors.surface,
            padding: '20px',
            borderRadius: '12px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
            marginBottom: '24px'
          }}
        >
          <div style={{ display: 'flex', gap: '20px', alignItems: 'end', marginBottom: '20px', width: '100%' }}>
            {/* Búsqueda */}
            <div style={{ flex: '2', minWidth: '250px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                Buscar
              </label>
              <div style={{ position: 'relative' }}>
                <Search size={20} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, email, DNI, puesto..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '12px 12px 12px 44px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: '8px',
                    fontSize: '14px',
                    outline: 'none',
                    backgroundColor: colors.surface,
                    color: colors.text,
                    boxSizing: 'border-box'
                  }}
                />
              </div>
            </div>

            {/* Filtro de Estado */}
            <div style={{ flex: '1', minWidth: '200px' }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                Estado
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  boxSizing: 'border-box'
                }}
              >
                <option value="todos">Todos</option>
                <option value="activos">Activos</option>
                <option value="inactivos">Inactivos</option>
              </select>
            </div>

            {/* Botones de Exportación */}
            <div style={{ flexShrink: 0, display: 'flex', gap: '12px' }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportToExcel}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: colors.surface,
                  color: colors.text,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <Download size={16} />
                Exportar
              </motion.button>
              
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={exportForSubsidy}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  backgroundColor: colors.primary,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                <FileText size={16} />
                Exportar L2
              </motion.button>
            </div>
          </div>

          {/* Filtros activos */}
          {(searchTerm || filterStatus !== 'todos') && (
            <div>
              <div style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                Filtros activos:
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {searchTerm && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: colors.primary + '15',
                    border: `1px solid ${colors.primary}`,
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: colors.primary
                  }}>
                    <Search size={12} />
                    "{searchTerm}"
                    <button
                      onClick={() => setSearchTerm('')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.primary,
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                {filterStatus !== 'todos' && (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    backgroundColor: colors.success + '15',
                    border: `1px solid ${colors.success}`,
                    borderRadius: '20px',
                    fontSize: '12px',
                    color: colors.success
                  }}>
                    <UserCheck size={12} />
                    {filterStatus === 'activos' ? 'Activos' : 'Inactivos'}
                    <button
                      onClick={() => setFilterStatus('todos')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: colors.success,
                        cursor: 'pointer',
                        padding: '0',
                        fontSize: '14px',
                        fontWeight: 'bold'
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>

      </motion.div>

      {/* Contenido Principal */}
      {loading ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
            style={{
              width: '40px',
              height: '40px',
              border: `3px solid ${colors.border}`,
              borderTop: `3px solid ${colors.primary}`,
              borderRadius: '50%',
              marginBottom: '20px'
            }}
          />
          <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 8, color: colors.text }}>
            Cargando empleados...
          </div>
          <div style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
            Por favor espera mientras se cargan los datos
          </div>
        </div>
      ) : error ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <AlertCircle size={48} color="#f44336" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', color: '#f44336', marginBottom: '8px' }}>Error al cargar empleados</p>
          <p style={{ fontSize: '14px', color: colors.textSecondary }}>{error}</p>
        </div>
      ) : empleadosFiltrados.length === 0 ? (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '60px',
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`
        }}>
          <Users size={48} color={colors.textSecondary} style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '16px', color: colors.textSecondary }}>
            {searchTerm || filterStatus !== 'todos' 
              ? 'No se encontraron empleados con los filtros aplicados' 
              : 'No hay empleados registrados'}
          </p>
        </div>
      ) : (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          style={{
            backgroundColor: colors.surface,
            borderRadius: '12px',
            border: `1px solid ${colors.border}`,
            overflow: 'hidden'
          }}
        >
          {empleadosFiltrados.map((empleado, index) => (
            <motion.div
              key={empleado.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: 0.5 + index * 0.05 }}
              whileHover={{ backgroundColor: colors.hover }}
              whileTap={{ scale: 0.99 }}
              style={{
                padding: '20px',
                borderBottom: index < empleadosFiltrados.length - 1 ? `1px solid ${colors.border}` : 'none',
                cursor: 'pointer',
                userSelect: 'none'
              }}
              onClick={() => showEmpleadoDetails(empleado)}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px', gap: '12px' }}>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0 }}>
                      {empleado.nombreCompleto}
                    </h3>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      padding: '4px 10px',
                      backgroundColor: empleado.activo ? '#4CAF5020' : '#f4433620',
                      border: `1px solid ${empleado.activo ? '#4CAF50' : '#f44336'}`,
                      borderRadius: '6px',
                      gap: '4px'
                    }}>
                      {empleado.activo ? <CheckCircle size={12} color="#4CAF50" /> : <AlertCircle size={12} color="#f44336" />}
                      <span style={{ 
                        fontSize: '11px', 
                        fontWeight: '600', 
                        color: empleado.activo ? '#4CAF50' : '#f44336'
                      }}>
                        {empleado.activo ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>
                  
                  {empleado.puesto && (
                    <p style={{ fontSize: '14px', color: colors.primary, margin: '0 0 8px 0', fontWeight: '500' }}>
                      {empleado.puesto}
                    </p>
                  )}
                  
                  <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: colors.textSecondary }}>
                    {empleado.email && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Mail size={14} />
                        {empleado.email}
                      </span>
                    )}
                    {empleado.telefono && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={14} />
                        {empleado.telefono}
                      </span>
                    )}
                    {empleado.departamento && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Briefcase size={14} />
                        {empleado.departamento}
                      </span>
                    )}
                  </div>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {empleado.fechaAlta && (
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '14px', fontWeight: '600', color: colors.text }}>
                        {empleado.fechaAlta}
                      </div>
                      <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                        Fecha de alta
                      </div>
                    </div>
                  )}
                  <Eye size={20} color={colors.primary} />
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {/* Modal de Detalles */}
      {showModal && selectedEmpleado && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '20px'
          }}
          onClick={closeModal}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: colors.surface,
              borderRadius: '16px',
              padding: '32px',
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Header del Modal */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <User size={28} color={colors.primary} />
                <h2 style={{ fontSize: '24px', fontWeight: '700', margin: 0, color: colors.text }}>
                  Detalles del Empleado
                </h2>
              </div>
              <button
                onClick={closeModal}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  transition: 'background-color 0.2s'
                }}
              >
                <AlertCircle size={24} color={colors.textSecondary} />
              </button>
            </div>

            {/* Información del Empleado */}
            <div style={{ display: 'grid', gap: '24px' }}>
              {/* Información Personal */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.primary, marginBottom: '12px' }}>
                  Información Personal
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField label="Nombre Completo" value={selectedEmpleado.nombreCompleto} colors={colors} />
                  <InfoField label="DNI/NIF" value={selectedEmpleado.dni} colors={colors} />
                  <InfoField label="Fecha de Nacimiento" value={selectedEmpleado.fechaNacimiento} colors={colors} />
                  <InfoField label="Género" value={selectedEmpleado.genero} colors={colors} />
                  <InfoField label="Estado Civil" value={selectedEmpleado.estadoCivil} colors={colors} />
                  <InfoField label="NSS" value={selectedEmpleado.nss} colors={colors} />
                </div>
              </div>

              {/* Información de Contacto */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.primary, marginBottom: '12px' }}>
                  Información de Contacto
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField label="Email" value={selectedEmpleado.email} colors={colors} icon={<Mail size={16} />} />
                  <InfoField label="Teléfono" value={selectedEmpleado.telefono} colors={colors} icon={<Phone size={16} />} />
                  <InfoField label="Dirección" value={selectedEmpleado.direccion} colors={colors} icon={<MapPin size={16} />} fullWidth />
                  <InfoField label="Ciudad" value={selectedEmpleado.ciudad} colors={colors} />
                  <InfoField label="Código Postal" value={selectedEmpleado.codigoPostal} colors={colors} />
                  <InfoField label="País" value={selectedEmpleado.pais} colors={colors} />
                </div>
              </div>

              {/* Información Laboral */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.primary, marginBottom: '12px' }}>
                  Información Laboral
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField label="Puesto" value={selectedEmpleado.puesto} colors={colors} icon={<Briefcase size={16} />} />
                  <InfoField label="Departamento" value={selectedEmpleado.departamento} colors={colors} icon={<Building size={16} />} />
                  <InfoField label="Tipo de Contrato" value={selectedEmpleado.tipoContrato} colors={colors} />
                  <InfoField label="Fecha de Alta" value={selectedEmpleado.fechaAlta} colors={colors} icon={<Calendar size={16} />} />
                  {selectedEmpleado.fechaBaja && (
                    <InfoField label="Fecha de Baja" value={selectedEmpleado.fechaBaja} colors={colors} icon={<Calendar size={16} />} />
                  )}
                  <InfoField 
                    label="Estado" 
                    value={selectedEmpleado.activo ? 'Activo' : 'Inactivo'} 
                    colors={colors}
                    valueColor={selectedEmpleado.activo ? '#4CAF50' : '#f44336'}
                  />
                  <InfoField label="Jornada Semanal" value={selectedEmpleado.jornadaSemanal} colors={colors} />
                  <InfoField label="Porcentaje Jornada" value={selectedEmpleado.porcentajeJornada} colors={colors} />
                  <InfoField label="Código Contrato" value={selectedEmpleado.codigoContrato} colors={colors} />
                </div>
              </div>

              {/* Información para Subvenciones */}
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.primary, marginBottom: '12px' }}>
                  Información para Subvenciones
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
                  <InfoField label="Colectivo" value={selectedEmpleado.colectivo} colors={colors} />
                  <InfoField label="Servicio Social" value={selectedEmpleado.servicioSocial} colors={colors} />
                  <InfoField label="Subvención Previa 2025" value={selectedEmpleado.subvencionPrevia} colors={colors} />
                  <InfoField label="Fecha Inicio Subvención" value={selectedEmpleado.fechaInicioSubvencion} colors={colors} />
                  <InfoField label="Fecha Fin Subvención" value={selectedEmpleado.fechaFinSubvencion} colors={colors} />
                </div>
              </div>

              {/* Información Bancaria */}
              {selectedEmpleado.iban && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.primary, marginBottom: '12px' }}>
                    Información Bancaria
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(1, 1fr)', gap: '16px' }}>
                    <InfoField label="IBAN" value={selectedEmpleado.iban} colors={colors} icon={<CreditCard size={16} />} />
                  </div>
                </div>
              )}

              {/* Notas */}
              {selectedEmpleado.notas && (
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.primary, marginBottom: '12px' }}>
                    Notas
                  </h3>
                  <div style={{
                    padding: '12px',
                    backgroundColor: colors.background,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`,
                    fontSize: '14px',
                    color: colors.text,
                    lineHeight: '1.6'
                  }}>
                    {selectedEmpleado.notas}
                  </div>
                </div>
              )}
            </div>

            {/* Sección de Historial de Servicios */}
            <div style={{ marginTop: '32px' }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                marginBottom: '20px',
                paddingBottom: '12px',
                borderBottom: `2px solid ${colors.border}`
              }}>
                <Calendar size={20} color={colors.primary} />
                <h3 style={{
                  fontSize: '18px',
                  fontWeight: '600',
                  margin: 0,
                  color: colors.text
                }}>
                  Historial de Servicios
                </h3>
              </div>

              {/* Estadísticas - Solo mostrar horas si tiene permisos */}
              {estadisticasHoras && (
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: canManageHoras ? 'repeat(auto-fit, minmax(150px, 1fr))' : 'repeat(auto-fit, minmax(150px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px'
                }}>
                  <div style={{
                    backgroundColor: colors.background,
                    padding: '16px',
                    borderRadius: '12px',
                    border: `1px solid ${colors.border}`,
                    textAlign: 'center'
                  }}>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: colors.primary,
                      marginBottom: '4px'
                    }}>
                      {estadisticasHoras.totalServicios}
                    </div>
                    <div style={{
                      fontSize: '12px',
                      color: colors.textSecondary,
                      fontWeight: '500'
                    }}>
                      Total Servicios
                    </div>
                  </div>

                  {/* Total Horas - Solo visible para jefes/admins */}
                  {canManageHoras && (
                    <div style={{
                      backgroundColor: colors.background,
                      padding: '16px',
                      borderRadius: '12px',
                      border: `1px solid ${colors.border}`,
                      textAlign: 'center'
                    }}>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: colors.success,
                        marginBottom: '4px'
                      }}>
                        {estadisticasHoras.totalHoras}h
                      </div>
                      <div style={{
                        fontSize: '12px',
                        color: colors.textSecondary,
                        fontWeight: '500'
                      }}>
                        Total Horas
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Lista de servicios */}
              {historialServicios.length > 0 ? (
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  paddingRight: '4px'
                }}>
                  {historialServicios.map((servicio, index) => (
                    <motion.div
                      key={index}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{ 
                        borderColor: colors.primary,
                        backgroundColor: colors.hover || `${colors.primary}10`
                      }}
                      onClick={async () => {
                        // Guardar el hojaId en localStorage
                        if (servicio.hojaId) {
                          localStorage.setItem('selectedHojaRutaId', servicio.hojaId);
                        }
                        // Cerrar el modal si está abierto
                        setShowModal(false);
                        // Navegar a la sección de hoja de ruta
                        // El HojaRutaPage detectará el cambio y cargará la hoja automáticamente
                        navigateTo('hoja-ruta');
                      }}
                      style={{
                        backgroundColor: colors.background,
                        padding: '16px',
                        borderRadius: '12px',
                        border: `2px solid ${colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      <div>
                        <div style={{
                          fontSize: '16px',
                          fontWeight: '600',
                          color: colors.text,
                          marginBottom: '4px'
                        }}>
                          {servicio.cliente}
                        </div>
                        <div style={{
                          fontSize: '14px',
                          color: colors.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px'
                        }}>
                          <Calendar size={14} />
                          {new Date(servicio.fechaServicio).toLocaleDateString('es-ES')}
                        </div>
                      </div>

                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '16px'
                      }}>
                        {/* Horas - Solo visible para jefes/admins */}
                        {canManageHoras && (
                          <div style={{
                            fontSize: '18px',
                            fontWeight: '600',
                            color: colors.primary
                          }}>
                            {servicio.horas}h
                          </div>
                        )}

                        <div style={{
                          padding: '4px 8px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '500',
                          backgroundColor: servicio.estado === 'completado' ? colors.success : colors.warning,
                          color: 'white'
                        }}>
                          {servicio.estado}
                        </div>
                        
                        <ExternalLink 
                          size={16} 
                          color={colors.primary}
                          style={{ marginLeft: '8px' }}
                        />
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  color: colors.textSecondary,
                  fontSize: '14px'
                }}>
                  <Calendar size={48} color={colors.textSecondary} style={{ marginBottom: '12px' }} />
                  <div>No hay servicios registrados</div>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Los servicios aparecerán aquí cuando se asignen horas en las hojas de ruta
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// Componente auxiliar para mostrar campos de información
const InfoField = ({ label, value, colors, icon, valueColor, fullWidth }) => {
  if (!value) return null;
  
  return (
    <div style={{ gridColumn: fullWidth ? '1 / -1' : 'auto' }}>
      <div style={{ fontSize: '12px', color: colors.textSecondary, marginBottom: '4px', fontWeight: '500' }}>
        {label}
      </div>
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '8px',
        fontSize: '14px', 
        color: valueColor || colors.text,
        fontWeight: '500'
      }}>
        {icon && <span style={{ color: colors.primary }}>{icon}</span>}
        {value}
      </div>
    </div>
  );
};

export default EmpleadosPage;

