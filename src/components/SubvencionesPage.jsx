import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { 
  FileText, 
  Search, 
  Filter, 
  Download, 
  Calendar, 
  Euro, 
  CheckCircle, 
  Clock, 
  AlertCircle,
  Eye,
  ChevronRight,
  Building,
  User,
  Upload
} from 'lucide-react';
import * as XLSX from 'xlsx';
import subvencionesService from '../services/subvencionesService';
import { useTheme } from './ThemeContext';

const SubvencionesPage = () => {
  const { colors, isDarkMode } = useTheme();
  const [subvencionesData, setSubvencionesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedEstado, setSelectedEstado] = useState('todos');
  const [selectedImputacion, setSelectedImputacion] = useState('todos');
  const [selectedSubvencion, setSelectedSubvencion] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // Estados de subvenciones
  const estados = {
    'CERRADA': { color: colors.success, icon: CheckCircle, label: 'Cerrada' },
    'CERRAD PDTE INGRESO DEL SALDO': { color: colors.warning, icon: Clock, label: 'Cerrada - Pendiente Ingreso' },
    'CERRADA PDTE APROBACIÓN FINAL': { color: colors.warning, icon: Clock, label: 'Cerrada - Pendiente Aprobación' },
    'VIGENTE': { color: colors.primary, icon: CheckCircle, label: 'Vigente' },
    'POR DEFINIR': { color: colors.textSecondary, icon: AlertCircle, label: 'Por Definir' },
    'CERRADA DESDE EL PROVEE': { color: colors.success, icon: CheckCircle, label: 'Cerrada - Proveedor' }
  };

  // Cargar datos de subvenciones
  useEffect(() => {
    loadSubvencionesData();
  }, []);

  const loadSubvencionesData = async () => {
    try {
      setLoading(true);
      setError('');

      // Cargar datos del servicio
      const data = subvencionesService.getSubvencionesData();
      setSubvencionesData(data);
    } catch (error) {
      console.error('Error cargando datos de subvenciones:', error);
      setError('Error al cargar los datos de subvenciones');
    } finally {
      setLoading(false);
    }
  };

  // Manejar carga de archivo CSV
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/csv') {
      setCsvFile(file);
      setShowUploadModal(true);
    } else {
      alert('Por favor selecciona un archivo CSV válido');
    }
  };

  // Procesar archivo CSV
  const processCSVFile = async () => {
    if (!csvFile) return;

    try {
      setLoading(true);
      setError('');

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const csvData = e.target.result;
          const processedData = subvencionesService.processCSVData(csvData);
          setSubvencionesData(processedData);
          setShowUploadModal(false);
          setCsvFile(null);
        } catch (error) {
          console.error('Error procesando CSV:', error);
          setError('Error al procesar el archivo CSV');
        } finally {
          setLoading(false);
        }
      };
      reader.readAsText(csvFile);
    } catch (error) {
      console.error('Error cargando archivo:', error);
      setError('Error al cargar el archivo');
      setLoading(false);
    }
  };

  // Filtrar datos usando el servicio
  const filteredData = useMemo(() => {
    return subvencionesService.filterSubvenciones({
      searchTerm,
      estado: selectedEstado,
      imputacion: selectedImputacion
    });
  }, [subvencionesData, searchTerm, selectedEstado, selectedImputacion]);

  // Obtener estados únicos
  const estadosUnicos = useMemo(() => {
    const estados = [...new Set(subvencionesData.map(s => s.estado))];
    return estados.filter(estado => estado && estado.trim() !== '');
  }, [subvencionesData]);

  // Obtener imputaciones únicas
  const imputacionesUnicas = useMemo(() => {
    const imputaciones = [...new Set(subvencionesData.map(s => s.imputacion))];
    return imputaciones.filter(imputacion => imputacion && imputacion.trim() !== '');
  }, [subvencionesData]);

  // Calcular totales usando el servicio
  const totales = useMemo(() => {
    const stats = subvencionesService.getEstadisticas();
    return {
      totalOtorgado: stats.totalOtorgado,
      totalPendiente: stats.totalPendiente,
      totalSubvenciones: stats.total,
      totalPorCobrar: stats.totalPorCobrar
    };
  }, [subvencionesData]);

  // Formatear moneda
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  // Formatear fecha
  const formatDate = (dateString) => {
    if (!dateString || dateString.includes('PENDIENTE') || dateString.includes('SIN FECHA')) {
      return 'Sin fecha';
    }
    return dateString;
  };

  // Exportar a Excel usando el servicio
  const exportToExcel = () => {
    try {
      const wb = subvencionesService.exportToExcel(filteredData);
      const fileName = `Subvenciones_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
      console.log('Subvenciones exportadas correctamente');
    } catch (error) {
      console.error('Error al exportar:', error);
    }
  };

  // Mostrar detalles de subvención
  const showSubvencionDetails = (subvencion) => {
    setSelectedSubvencion(subvencion);
    setShowDetails(true);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: colors.background
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
          Cargando subvenciones...
        </div>
        <div style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center' }}>
          Por favor espera mientras se cargan los datos
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: colors.background,
        padding: '20px'
      }}>
        <AlertCircle size={48} color={colors.error} style={{ marginBottom: '16px' }} />
        <div style={{ fontSize: 18, fontWeight: 500, color: colors.error, marginBottom: '8px' }}>
          Error al cargar las subvenciones
        </div>
        <div style={{ fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: '20px' }}>
          {error}
        </div>
        <button
          onClick={loadSubvencionesData}
          style={{
            padding: '10px 20px',
            backgroundColor: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: '24px', backgroundColor: colors.background, minHeight: '100vh' }}>
      {/* Header */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '16px' }}>
          <FileText size={32} color={colors.primary} style={{ marginRight: '12px' }} />
          <h1 style={{ fontSize: '28px', fontWeight: '700', color: colors.text, margin: 0 }}>
            Subvenciones
          </h1>
        </div>
        <p style={{ fontSize: '16px', color: colors.textSecondary, margin: 0 }}>
          Gestión y seguimiento de subvenciones de entidades públicas
        </p>
      </div>

      {/* Filtros y búsqueda */}
      <div style={{
        backgroundColor: colors.surface,
        padding: '20px',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '16px', alignItems: 'end' }}>
          {/* Búsqueda */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Buscar
            </label>
            <div style={{ position: 'relative' }}>
              <Search size={20} color={colors.textSecondary} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                placeholder="Buscar por nombre o proyecto..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 12px 12px 44px',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  fontSize: '14px',
                  outline: 'none',
                  backgroundColor: colors.surface
                }}
              />
            </div>
          </div>

          {/* Filtro por estado */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Estado
            </label>
            <select
              value={selectedEstado}
              onChange={(e) => setSelectedEstado(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: colors.surface
              }}
            >
              <option value="todos">Todos los estados</option>
              {estadosUnicos.map(estado => (
                <option key={estado} value={estado}>
                  {estados[estado]?.label || estado}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por imputación */}
          <div>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Imputación
            </label>
            <select
              value={selectedImputacion}
              onChange={(e) => setSelectedImputacion(e.target.value)}
              style={{
                width: '100%',
                padding: '12px',
                border: `1px solid ${colors.border}`,
                borderRadius: '8px',
                fontSize: '14px',
                outline: 'none',
                backgroundColor: colors.surface
              }}
            >
              <option value="todos">Todas las imputaciones</option>
              {imputacionesUnicas.map(imputacion => (
                <option key={imputacion} value={imputacion}>
                  {imputacion}
                </option>
              ))}
            </select>
          </div>

          {/* Botones de acción */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <label style={{
              display: 'flex',
              alignItems: 'center',
              padding: '12px 16px',
              backgroundColor: colors.primary,
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: '500',
              gap: '8px'
            }}>
              <Upload size={16} />
              Cargar CSV
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </label>
            <button
              onClick={exportToExcel}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '12px 16px',
                backgroundColor: colors.success,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px',
                fontWeight: '500',
                gap: '8px'
              }}
            >
              <Download size={16} />
              Exportar
            </button>
          </div>
        </div>
      </div>

      {/* Totales */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        <div style={{
          backgroundColor: colors.surface,
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.primary, marginBottom: '4px' }}>
            {totales.totalSubvenciones}
          </div>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>
            Total Subvenciones
          </div>
        </div>
        <div style={{
          backgroundColor: colors.surface,
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.success, marginBottom: '4px' }}>
            {formatCurrency(totales.totalOtorgado)}
          </div>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>
            Total Otorgado
          </div>
        </div>
        <div style={{
          backgroundColor: colors.surface,
          padding: '20px',
          borderRadius: '12px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '24px', fontWeight: '700', color: colors.warning, marginBottom: '4px' }}>
            {formatCurrency(totales.totalPendiente)}
          </div>
          <div style={{ fontSize: '14px', color: colors.textSecondary }}>
            Saldo Pendiente
          </div>
        </div>
      </div>

      {/* Lista de subvenciones */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        overflow: 'hidden'
      }}>
        {filteredData.length === 0 ? (
          <div style={{
            padding: '40px',
            textAlign: 'center',
            color: colors.textSecondary
          }}>
            <FileText size={48} color={colors.border} style={{ marginBottom: '16px' }} />
            <div style={{ fontSize: '16px', fontWeight: '500', marginBottom: '8px' }}>
              No se encontraron subvenciones
            </div>
            <div style={{ fontSize: '14px' }}>
              Intenta ajustar los filtros de búsqueda
            </div>
          </div>
        ) : (
          <div>
            {filteredData.map((subvencion, index) => {
              const estadoInfo = estados[subvencion.estado] || { color: colors.textSecondary, icon: AlertCircle, label: subvencion.estado };
              const EstadoIcon = estadoInfo.icon;
              
              return (
                <motion.div
                  key={subvencion.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.1 }}
                  style={{
                    padding: '20px',
                    borderBottom: index < filteredData.length - 1 ? `1px solid ${colors.border}` : 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => {
                    e.target.style.backgroundColor = colors.background;
                  }}
                  onMouseLeave={(e) => {
                    e.target.style.backgroundColor = 'transparent';
                  }}
                  onClick={() => showSubvencionDetails(subvencion)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                        <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0, marginRight: '12px' }}>
                          {subvencion.nombre}
                        </h3>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px 8px',
                          backgroundColor: estadoInfo.color + '20',
                          borderRadius: '6px',
                          gap: '4px'
                        }}>
                          <EstadoIcon size={14} color={estadoInfo.color} />
                          <span style={{ fontSize: '12px', fontWeight: '500', color: estadoInfo.color }}>
                            {estadoInfo.label}
                          </span>
                        </div>
                      </div>
                      <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '0 0 8px 0' }}>
                        {subvencion.proyecto}
                      </p>
                      <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: colors.textSecondary }}>
                        <span><Building size={14} style={{ marginRight: '4px' }} />{subvencion.imputacion}</span>
                        <span><Calendar size={14} style={{ marginRight: '4px' }} />{subvencion.periodo}</span>
                        <span><Euro size={14} style={{ marginRight: '4px' }} />{formatCurrency(subvencion.importeOtorgado)}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text }}>
                          {subvencion.saldoPendienteTexto && 
                           (subvencion.saldoPendienteTexto.includes('PEND') || 
                            subvencion.saldoPendienteTexto.includes('GESTIONAR') ||
                            subvencion.saldoPendienteTexto.includes('SIN FECHA') ||
                            subvencion.saldoPendienteTexto.includes('POR DEFINIR')) ? 
                            subvencion.saldoPendienteTexto : 
                            formatCurrency(subvencion.saldoPendiente)}
                        </div>
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                          Saldo pendiente
                        </div>
                      </div>
                      <ChevronRight size={20} color={colors.textSecondary} />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      {showDetails && selectedSubvencion && (
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
          padding: '20px'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '600px',
              width: '100%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: colors.text, margin: 0 }}>
                Detalles de la Subvención
              </h2>
              <button
                onClick={() => setShowDetails(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '24px',
                  cursor: 'pointer',
                  color: colors.textSecondary
                }}
              >
                ×
              </button>
            </div>
            
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Información Básica */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0' }}>📋 Información Básica</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Subvención</label>
                    <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.nombre}</div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Proyecto</label>
                    <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.proyecto}</div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Imputación</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.imputacion}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Expediente</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.expediente}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Código Subvención</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.codigo || 'N/A'}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Modalidad</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.modalidad || 'N/A'}</div>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Período de Ejecución</label>
                    <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.periodo}</div>
                  </div>
                  
                  {selectedSubvencion.fechaAdjudicacion && (
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Fecha Final Adjudicación</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.fechaAdjudicacion}</div>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Información Financiera */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0' }}>💰 Información Financiera</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Importe Solicitado</label>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text }}>
                        {selectedSubvencion.importeSolicitado > 0 ? formatCurrency(selectedSubvencion.importeSolicitado) : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Importe Otorgado</label>
                      <div style={{ fontSize: '16px', fontWeight: '600', color: colors.success }}>{formatCurrency(selectedSubvencion.importeOtorgado)}</div>
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Saldo Pendiente de Abono</label>
                    <div style={{ fontSize: '16px', fontWeight: '600', color: colors.warning }}>
                      {selectedSubvencion.saldoPendienteTexto && 
                       (selectedSubvencion.saldoPendienteTexto.includes('PEND') || 
                        selectedSubvencion.saldoPendienteTexto.includes('GESTIONAR') ||
                        selectedSubvencion.saldoPendienteTexto.includes('SIN FECHA') ||
                        selectedSubvencion.saldoPendienteTexto.includes('POR DEFINIR')) ? 
                        selectedSubvencion.saldoPendienteTexto : 
                        formatCurrency(selectedSubvencion.saldoPendiente)}
                    </div>
                  </div>
                  
                  {selectedSubvencion.previsionPago && (
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Previsión Pago Total</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.previsionPago}</div>
                    </div>
                  )}
                  
                </div>
              </div>
              
              {/* Abonos */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0' }}>💳 Abonos</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  {/* Primer Abono */}
                  <div style={{
                    padding: '12px',
                    backgroundColor: colors.surface,
                    borderRadius: '8px',
                    border: `1px solid ${colors.border}`
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                      <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>Primer Abono</span>
                      <span style={{ fontSize: '16px', fontWeight: '600', color: colors.primary }}>
                        {formatCurrency(selectedSubvencion.primerAbono)}
                      </span>
                    </div>
                    {selectedSubvencion.fechaPrimerAbono && (
                      <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                        📅 {selectedSubvencion.fechaPrimerAbono}
                      </div>
                    )}
                  </div>
                  
                  {/* Segundo Abono (solo si existe) */}
                  {selectedSubvencion.segundoAbono && selectedSubvencion.segundoAbono > 0 && (
                    <div style={{
                      padding: '12px',
                      backgroundColor: colors.surface,
                      borderRadius: '8px',
                      border: `1px solid ${colors.border}`
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                        <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>Segundo Abono</span>
                        <span style={{ fontSize: '16px', fontWeight: '600', color: colors.secondary }}>
                          {formatCurrency(selectedSubvencion.segundoAbono)}
                        </span>
                      </div>
                      {selectedSubvencion.fechaSegundoAbono && (
                        <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                          📅 {selectedSubvencion.fechaSegundoAbono}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SOC L1 y L2 (solo si existen) */}
              {(selectedSubvencion.socL1Acomp > 0 || selectedSubvencion.socL2Contrat > 0) && (
                <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0' }}>🏢 SOC - Líneas de Financiación</h3>
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {selectedSubvencion.socL1Acomp > 0 && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>SOC: L1 Acompañamiento</span>
                          <span style={{ fontSize: '16px', fontWeight: '600', color: colors.primary }}>
                            {formatCurrency(selectedSubvencion.socL1Acomp)}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {selectedSubvencion.socL2Contrat > 0 && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>SOC: L2 Contratación Trabajo</span>
                          <span style={{ fontSize: '16px', fontWeight: '600', color: colors.secondary }}>
                            {formatCurrency(selectedSubvencion.socL2Contrat)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Fases del Proyecto (solo si hay alguna fase) */}
              {(selectedSubvencion.fasesProyecto.fase1 || selectedSubvencion.fasesProyecto.fase2 || 
                selectedSubvencion.fasesProyecto.fase3 || selectedSubvencion.fasesProyecto.fase4 ||
                selectedSubvencion.fasesProyecto.fase5 || selectedSubvencion.fasesProyecto.fase6 ||
                selectedSubvencion.fasesProyecto.fase7 || selectedSubvencion.fasesProyecto.fase8) && (
                <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0' }}>📋 Fases del Proyecto</h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {Object.entries(selectedSubvencion.fasesProyecto).map(([fase, valor], index) => {
                      if (!valor || valor === '') return null;
                      return (
                        <div key={fase} style={{
                          padding: '8px 12px',
                          backgroundColor: colors.surface,
                          borderRadius: '6px',
                          border: `1px solid ${colors.border}`
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>
                              Fase {index + 1}
                            </span>
                            <span style={{ fontSize: '14px', color: colors.textSecondary }}>
                              {valor}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              
              {/* Estado y Seguimiento */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0' }}>📊 Estado y Seguimiento</h3>
                <div style={{ display: 'grid', gap: '12px' }}>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Estado</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {(() => {
                        const estadoInfo = estados[selectedSubvencion.estado] || { color: colors.textSecondary, icon: AlertCircle, label: selectedSubvencion.estado };
                        const EstadoIcon = estadoInfo.icon;
                        return (
                          <>
                            <EstadoIcon size={16} color={estadoInfo.color} />
                            <span style={{ fontSize: '16px', color: estadoInfo.color, fontWeight: '500' }}>
                              {estadoInfo.label}
                            </span>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Fecha de Justificación</label>
                    <div style={{ fontSize: '16px', color: colors.textSecondary }}>{formatDate(selectedSubvencion.fechaJustificacion)}</div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Revisado por Gestoría</label>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {selectedSubvencion.revisadoGestoria ? (
                        <>
                          <CheckCircle size={16} color={colors.success} />
                          <span style={{ fontSize: '16px', color: colors.success, fontWeight: '500' }}>Sí</span>
                        </>
                      ) : (
                        <>
                          <AlertCircle size={16} color={colors.warning} />
                          <span style={{ fontSize: '16px', color: colors.warning, fontWeight: '500' }}>No</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal de carga de archivo CSV */}
      {showUploadModal && (
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
          padding: '20px'
        }}>
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            style={{
              backgroundColor: colors.surface,
              borderRadius: '12px',
              padding: '24px',
              maxWidth: '500px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: '0 0 8px 0' }}>
                Cargar Archivo CSV de Subvenciones
              </h3>
              <p style={{ fontSize: '14px', color: colors.textSecondary, margin: 0 }}>
                Selecciona el archivo CSV con los datos de subvenciones para procesar.
              </p>
            </div>
            
            <div style={{ marginBottom: '20px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
                Archivo seleccionado:
              </div>
              <div style={{
                padding: '12px',
                backgroundColor: colors.background,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
                fontSize: '14px',
                color: colors.textSecondary
              }}>
                {csvFile ? csvFile.name : 'Ningún archivo seleccionado'}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  setCsvFile(null);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: 'transparent',
                  color: colors.textSecondary,
                  border: `1px solid ${colors.border}`,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Cancelar
              </button>
              <button
                onClick={processCSVFile}
                disabled={!csvFile}
                style={{
                  padding: '10px 20px',
                  backgroundColor: csvFile ? colors.primary : colors.border,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: csvFile ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                Procesar Archivo
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SubvencionesPage;
