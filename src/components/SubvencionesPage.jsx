import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
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
  Upload,
  Info,
  CreditCard,
  Briefcase,
  BarChart3,
  FileCheck,
  Layers,
  MessageSquare,
  Edit3,
  Trash2,
  Save,
  X,
  Plus,
  Pencil,
  Trash,
  UserPlus,
  Settings
} from 'lucide-react';
import * as XLSX from 'xlsx';
import subvencionesService from '../services/subvencionesService';
import { useTheme } from './ThemeContext';

// Componente memoizado para cada item de subvención
const SubvencionItem = memo(({ 
  subvencion, 
  index, 
  colors, 
  estados, 
  formatCurrency, 
  getFasesActivas, 
  showSubvencionDetails, 
  handleEditSubvencion, 
  handleDeleteSubvencion, 
  isLast 
}) => {
  const estadoInfo = estados[subvencion.estado] || { color: colors.textSecondary, icon: AlertCircle, label: subvencion.estado };
  const EstadoIcon = estadoInfo.icon;
  const fasesActivas = getFasesActivas(subvencion.fasesProyecto);

  return (
    <motion.div
      key={subvencion.id}
      initial={false}
      animate={{ opacity: 1 }}
      whileHover={{ backgroundColor: colors.hover || 'rgba(64,64,64,0.7)' }}
      whileTap={{ scale: 0.99 }}
      style={{
        padding: '20px',
        borderBottom: !isLast ? `1px solid ${colors.border}` : 'none',
        cursor: 'pointer',
        userSelect: 'none'
      }}
      onClick={() => showSubvencionDetails(subvencion)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: colors.text, margin: 0, marginRight: '12px', userSelect: 'none' }}>
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
              <span style={{ fontSize: '12px', fontWeight: '500', color: estadoInfo.color, userSelect: 'none' }}>
                {estadoInfo.label}
              </span>
            </div>
          </div>
          <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '0 0 8px 0', userSelect: 'none' }}>
            {subvencion.proyecto}
          </p>
          <div style={{ display: 'flex', gap: '24px', fontSize: '14px', color: colors.textSecondary, userSelect: 'none' }}>
            <span><Building size={14} style={{ marginRight: '4px' }} />{subvencion.imputacion}</span>
            <span><Calendar size={14} style={{ marginRight: '4px' }} />{subvencion.periodo}</span>
            <span><Euro size={14} style={{ marginRight: '4px' }} />{formatCurrency(subvencion.importeOtorgado)}</span>
          </div>
          
          {fasesActivas.length > 0 && (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              marginTop: '8px',
              padding: '6px 12px',
              backgroundColor: colors.primary + '15',
              borderRadius: '6px',
              width: 'fit-content'
            }}>
              <Layers size={14} color={colors.primary} />
              <span style={{ fontSize: '12px', fontWeight: '500', color: colors.primary }}>
                Fases: {fasesActivas.join(', ')}
              </span>
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text, userSelect: 'none' }}>
              {subvencion.saldoPendienteTexto && 
               (subvencion.saldoPendienteTexto.includes('PEND') || 
                subvencion.saldoPendienteTexto.includes('GESTIONAR') ||
                subvencion.saldoPendienteTexto.includes('SIN FECHA') ||
                subvencion.saldoPendienteTexto.includes('POR DEFINIR')) ? 
                subvencion.saldoPendienteTexto : 
                formatCurrency(subvencion.saldoPendiente)}
            </div>
            <div style={{ fontSize: '12px', color: colors.textSecondary, userSelect: 'none' }}>
              Saldo pendiente
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleEditSubvencion(subvencion);
              }}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                color: colors.primary,
                border: `1px solid ${colors.primary}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = colors.primary;
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = colors.primary;
              }}
            >
              <Pencil size={14} />
              Editar
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteSubvencion(subvencion.id);
              }}
              style={{
                padding: '8px',
                backgroundColor: 'transparent',
                color: colors.error,
                border: `1px solid ${colors.error}`,
                borderRadius: '6px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '12px',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => {
                e.target.style.backgroundColor = colors.error;
                e.target.style.color = 'white';
              }}
              onMouseLeave={(e) => {
                e.target.style.backgroundColor = 'transparent';
                e.target.style.color = colors.error;
              }}
            >
              <Trash size={14} />
              Eliminar
            </button>
          </div>
          <ChevronRight size={20} color={colors.textSecondary} />
        </div>
      </div>
    </motion.div>
  );
});

SubvencionItem.displayName = 'SubvencionItem';

const SubvencionesPage = () => {
  const { colors, isDarkMode } = useTheme();
  const [subvencionesData, setSubvencionesData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedImputacion, setSelectedImputacion] = useState('Todas');
  const [selectedFase, setSelectedFase] = useState('Todas');
  const [selectedSubvencion, setSelectedSubvencion] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [csvFile, setCsvFile] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [newComentario, setNewComentario] = useState('');
  const [editingComentario, setEditingComentario] = useState(null);
  const [comentarioEditText, setComentarioEditText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingSubvencion, setEditingSubvencion] = useState(null);
  const [showNewSubvencionModal, setShowNewSubvencionModal] = useState(false);

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

      // Cargar datos desde Supabase
      const data = await subvencionesService.loadFromSupabase();
      setSubvencionesData(data);
      
      console.log('📊 Datos cargados desde Supabase:', data.length, 'subvenciones');
    } catch (error) {
      console.error('Error cargando datos de subvenciones:', error);
      setError('Error al cargar los datos de subvenciones desde la base de datos');
    } finally {
      setLoading(false);
    }
  };

  // Manejar carga de archivo CSV
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && (file.type === 'text/csv' || file.name.endsWith('.csv'))) {
      setCsvFile(file);
      setShowUploadModal(true);
    } else {
      setError('Por favor, selecciona un archivo CSV válido');
    }
  };

  // Procesar archivo CSV
  const processCSVFile = async () => {
    if (!csvFile) return;

    try {
      setLoading(true);
      setError('');

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const csvData = e.target.result;
          
          // Procesar CSV y subir a Supabase
          const processedData = subvencionesService.processCSVData(csvData);
          const results = await subvencionesService.syncToSupabase(processedData);
          
          // Recargar datos desde Supabase
          await loadSubvencionesData();
          
          setShowUploadModal(false);
          setCsvFile(null);
          
          console.log(`✅ Sincronización completada: ${results.created} creadas, ${results.updated} actualizadas, ${results.errors} errores`);
        } catch (error) {
          console.error('Error procesando CSV:', error);
          setError('Error al procesar el archivo CSV y sincronizar con la base de datos');
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

  // ===== FUNCIONES DE COMENTARIOS =====

  // Añadir comentario
  const handleAddComentario = async () => {
    if (!newComentario.trim() || !selectedSubvencion) return;

    try {
      setLoading(true);
      const comentarioData = await subvencionesService.addComentario(selectedSubvencion.id, newComentario.trim());
      
      // Actualizar la subvención seleccionada
      setSelectedSubvencion(prev => ({
        ...prev,
        comentarios: [comentarioData, ...(prev.comentarios || [])]
      }));
      
      setNewComentario('');
    } catch (error) {
      console.error('Error añadiendo comentario:', error);
      setError('Error al añadir el comentario');
    } finally {
      setLoading(false);
    }
  };

  // Editar comentario
  const handleEditComentario = (comentario) => {
    setEditingComentario(comentario.id);
    setComentarioEditText(comentario.comentario);
  };

  // Guardar comentario editado
  const handleSaveComentario = async () => {
    if (!comentarioEditText.trim() || !editingComentario) return;

    try {
      setLoading(true);
      const comentarioData = await subvencionesService.updateComentario(editingComentario, comentarioEditText.trim());
      
      // Actualizar la subvención seleccionada
      setSelectedSubvencion(prev => ({
        ...prev,
        comentarios: prev.comentarios.map(c => 
          c.id === editingComentario ? comentarioData : c
        )
      }));
      
      setEditingComentario(null);
      setComentarioEditText('');
    } catch (error) {
      console.error('Error actualizando comentario:', error);
      setError('Error al actualizar el comentario');
    } finally {
      setLoading(false);
    }
  };

  // Cancelar edición de comentario
  const handleCancelEditComentario = () => {
    setEditingComentario(null);
    setComentarioEditText('');
  };

  // Eliminar comentario
  const handleDeleteComentario = async (comentarioId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este comentario?')) return;

    try {
      setLoading(true);
      await subvencionesService.deleteComentario(comentarioId);
      
      // Actualizar la subvención seleccionada
      setSelectedSubvencion(prev => ({
        ...prev,
        comentarios: prev.comentarios.filter(c => c.id !== comentarioId)
      }));
    } catch (error) {
      console.error('Error eliminando comentario:', error);
      setError('Error al eliminar el comentario');
    } finally {
      setLoading(false);
    }
  };

  // ===== FUNCIONES DE EDICIÓN DE SUBVENCIONES =====

  // Abrir modal de edición
  const handleEditSubvencion = useCallback((subvencion) => {
    setEditingSubvencion({ ...subvencion });
    setShowEditModal(true);
  }, []);

  // Abrir modal de nueva subvención
  const handleNewSubvencion = () => {
    setEditingSubvencion({
      id: null,
      nombre: '',
      proyecto: '',
      imputacion: '',
      expediente: '',
      codigo: '',
      modalidad: '',
      fechaAdjudicacion: '',
      importeSolicitado: 0,
      importeOtorgado: 0,
      periodo: '',
      socL1Acomp: 0,
      socL2Contrat: 0,
      primerAbono: 0,
      fechaPrimerAbono: '',
      segundoAbono: 0,
      fechaSegundoAbono: '',
      saldoPendiente: 0,
      saldoPendienteTexto: '',
      previsionPago: '',
      fechaJustificacion: '',
      revisadoGestoria: false,
      estado: '',
      holdedAsentamiento: '',
      importesPorCobrar: 0,
      fasesProyecto: {
        fase1: '',
        fase2: '',
        fase3: '',
        fase4: '',
        fase5: '',
        fase6: '',
        fase7: '',
        fase8: ''
      }
    });
    setShowNewSubvencionModal(true);
  };

  // Guardar cambios de subvención
  const handleSaveSubvencion = async () => {
    if (!editingSubvencion) return;

    try {
      setLoading(true);
      
      if (editingSubvencion.id && editingSubvencion.id.startsWith('subvencion_')) {
        // Es una nueva subvención (ID temporal del CSV)
        await subvencionesService.createSubvencion(editingSubvencion);
      } else if (editingSubvencion.id) {
        // Actualizar subvención existente
        await subvencionesService.updateSubvencion(editingSubvencion.id, editingSubvencion);
      } else {
        // Crear nueva subvención
        await subvencionesService.createSubvencion(editingSubvencion);
      }

      // Recargar datos
      await loadSubvencionesData();
      
      // Cerrar modales
      setShowEditModal(false);
      setShowNewSubvencionModal(false);
      setEditingSubvencion(null);
      
    } catch (error) {
      console.error('Error guardando subvención:', error);
      setError('Error al guardar la subvención');
    } finally {
      setLoading(false);
    }
  };

  // Eliminar subvención
  const handleDeleteSubvencion = useCallback(async (subvencionId) => {
    if (!confirm('¿Estás seguro de que quieres eliminar esta subvención? Esta acción no se puede deshacer.')) return;

    try {
      setLoading(true);
      await subvencionesService.deleteSubvencion(subvencionId);
      
      // Recargar datos
      await loadSubvencionesData();
      
      // Cerrar modal de detalles si estaba abierto
      if (selectedSubvencion && selectedSubvencion.id === subvencionId) {
        setShowDetails(false);
        setSelectedSubvencion(null);
      }
      
    } catch (error) {
      console.error('Error eliminando subvención:', error);
      setError('Error al eliminar la subvención');
    } finally {
      setLoading(false);
    }
  }, [selectedSubvencion]);

  // Filtrar datos usando el servicio
  const filteredData = useMemo(() => {
    return subvencionesService.filterSubvenciones({
      searchTerm,
      imputacion: selectedImputacion,
      fase: selectedFase
    });
  }, [subvencionesData, searchTerm, selectedImputacion, selectedFase]);

  // Obtener opciones de filtros usando el servicio
  const filtros = useMemo(() => {
    return subvencionesService.getFiltros();
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

  // Obtener fases activas de una subvención usando el servicio
  const getFasesActivas = useCallback((fasesProyecto) => {
    const fasesAnalizadas = subvencionesService.analizarFasesProyecto(fasesProyecto);
    return fasesAnalizadas.map(fase => fase.numero);
  }, []);

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
  const showSubvencionDetails = useCallback((subvencion) => {
    setSelectedSubvencion(subvencion);
    setShowDetails(true);
  }, []);

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
        {/* Filtros simplificados */}
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
                  backgroundColor: colors.surface,
                  color: colors.text,
                  boxSizing: 'border-box'
                }}
              />
            </div>
          </div>

          {/* Filtro por fases */}
          <div style={{ flex: '1', minWidth: '200px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '8px' }}>
              Fases del Proyecto
            </label>
            <select
              value={selectedFase}
              onChange={(e) => setSelectedFase(e.target.value)}
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
              {filtros.fases.map(fase => (
                <option key={fase} value={fase}>
                  {fase === 'Todas' ? 'Todas las fases' : 
                   fase === 'sin-fases' ? 'Sin fases activas' : 
                   `Fase ${fase}`}
                </option>
              ))}
            </select>
          </div>

          {/* Filtro por imputación */}
          <div style={{ flex: '1', minWidth: '200px' }}>
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
                backgroundColor: colors.surface,
                color: colors.text,
                boxSizing: 'border-box'
              }}
            >
              {filtros.imputaciones.map(imputacion => (
                <option key={imputacion} value={imputacion}>
                  {imputacion}
                </option>
              ))}
            </select>
          </div>

          {/* Botón Limpiar Filtros */}
          <div style={{ flexShrink: 0 }}>
            <button
              onClick={() => {
                setSelectedImputacion('Todas');
                setSelectedFase('Todas');
                setSearchTerm('');
              }}
              style={{
                padding: '12px 24px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                whiteSpace: 'nowrap'
              }}
            >
              Limpiar Filtros
            </button>
          </div>
        </div>

        {/* Botones de acción */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
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
            onClick={handleNewSubvencion}
            style={{
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
            }}
          >
            <UserPlus size={16} />
            Nueva Subvención
          </button>
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
          textAlign: 'center',
          userSelect: 'none'
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
          textAlign: 'center',
          userSelect: 'none'
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
          textAlign: 'center',
          userSelect: 'none'
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
            {filteredData.map((subvencion, index) => (
              <SubvencionItem
                key={subvencion.id}
                subvencion={subvencion}
                index={index}
                colors={colors}
                estados={estados}
                formatCurrency={formatCurrency}
                getFasesActivas={getFasesActivas}
                showSubvencionDetails={showSubvencionDetails}
                handleEditSubvencion={handleEditSubvencion}
                handleDeleteSubvencion={handleDeleteSubvencion}
                isLast={index === filteredData.length - 1}
              />
            ))}
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
              maxWidth: '800px',
              width: '100%',
              maxHeight: '90vh',
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
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileCheck size={18} color={colors.primary} />
                  Información Básica
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Subvención</label>
                    <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.nombre}</div>
                  </div>
                  
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Proyecto</label>
                    <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.proyecto}</div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Imputación</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.imputacion}</div>
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '4px' }}>Expediente</label>
                      <div style={{ fontSize: '16px', color: colors.textSecondary }}>{selectedSubvencion.expediente}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Euro size={18} color={colors.success} />
                  Información Financiera
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CreditCard size={18} color={colors.primary} />
                  Abonos
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
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
                        <Calendar size={14} style={{ marginRight: '4px' }} />
                        {selectedSubvencion.fechaPrimerAbono}
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
                          <Calendar size={14} style={{ marginRight: '4px' }} />
                          {selectedSubvencion.fechaSegundoAbono}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* SOC L1 y L2 (solo si existen) */}
              {(selectedSubvencion.socL1Acomp || selectedSubvencion.socL2Contrat) && (
                <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Briefcase size={18} color={colors.primary} />
                    SOC - Líneas de Financiación
                  </h3>
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {selectedSubvencion.socL1Acomp && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>SOC: L1 Acompañamiento</span>
                          <span style={{ fontSize: '16px', fontWeight: '600', color: colors.primary }}>
                            {selectedSubvencion.socL1Acomp}
                          </span>
                        </div>
                      </div>
                    )}
                    
                    {selectedSubvencion.socL2Contrat && (
                      <div style={{
                        padding: '12px',
                        backgroundColor: colors.surface,
                        borderRadius: '8px',
                        border: `1px solid ${colors.border}`
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>SOC: L2 Contratación Trabajo</span>
                          <span style={{ fontSize: '16px', fontWeight: '600', color: colors.secondary }}>
                            {selectedSubvencion.socL2Contrat}
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
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileCheck size={18} color={colors.primary} />
                    Fases del Proyecto
                  </h3>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {(() => {
                      const fasesAnalizadas = subvencionesService.analizarFasesProyecto(selectedSubvencion.fasesProyecto);
                      return fasesAnalizadas.map((fase, index) => (
                        <div key={fase.campo} style={{
                          padding: '12px 16px',
                          backgroundColor: colors.success + '15',
                          borderRadius: '8px',
                          border: `2px solid ${colors.success}`,
                          display: 'flex',
                          alignItems: 'center',
                          gap: '16px'
                        }}>
                          <CheckCircle size={18} color={colors.success} />
                          <div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: colors.text }}>
                              {fase.nombre}
                            </div>
                            <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                              Campo: {fase.campo} | Contenido: {fase.contenido}
                            </div>
                          </div>
                        </div>
                      ));
                    })()}
                  </div>
                </div>
              )}
              
              {/* Estado y Seguimiento */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <BarChart3 size={18} color={colors.primary} />
                  Estado y Seguimiento
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
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

              {/* Comentarios */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MessageSquare size={18} color={colors.primary} />
                  Comentarios
                </h3>
                
                {/* Formulario para añadir comentario */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
                    <textarea
                      value={newComentario}
                      onChange={(e) => setNewComentario(e.target.value)}
                      placeholder="Añadir un comentario sobre esta subvención..."
                      style={{
                        flex: 1,
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px',
                        resize: 'vertical',
                        minHeight: '80px',
                        fontFamily: 'inherit'
                      }}
                    />
                    <button
                      onClick={handleAddComentario}
                      disabled={!newComentario.trim() || loading}
                      style={{
                        padding: '12px 16px',
                        backgroundColor: colors.primary,
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: newComentario.trim() && !loading ? 'pointer' : 'not-allowed',
                        opacity: newComentario.trim() && !loading ? 1 : 0.5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '14px',
                        fontWeight: '500'
                      }}
                    >
                      <Plus size={16} />
                      Añadir
                    </button>
                  </div>
                </div>

                {/* Lista de comentarios */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {selectedSubvencion.comentarios && selectedSubvencion.comentarios.length > 0 ? (
                    selectedSubvencion.comentarios.map((comentario) => (
                      <div key={comentario.id} style={{
                        padding: '12px',
                        backgroundColor: colors.surface,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        borderLeft: `4px solid ${colors.primary}`
                      }}>
                        {editingComentario === comentario.id ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <textarea
                              value={comentarioEditText}
                              onChange={(e) => setComentarioEditText(e.target.value)}
                              style={{
                                width: '100%',
                                padding: '8px',
                                border: `1px solid ${colors.border}`,
                                borderRadius: '6px',
                                backgroundColor: colors.background,
                                color: colors.text,
                                fontSize: '14px',
                                resize: 'vertical',
                                minHeight: '60px',
                                fontFamily: 'inherit'
                              }}
                            />
                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                              <button
                                onClick={handleSaveComentario}
                                disabled={!comentarioEditText.trim() || loading}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: colors.success,
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: comentarioEditText.trim() && !loading ? 'pointer' : 'not-allowed',
                                  opacity: comentarioEditText.trim() && !loading ? 1 : 0.5,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px'
                                }}
                              >
                                <Save size={14} />
                                Guardar
                              </button>
                              <button
                                onClick={handleCancelEditComentario}
                                style={{
                                  padding: '6px 12px',
                                  backgroundColor: colors.textSecondary,
                                  color: 'white',
                                  border: 'none',
                                  borderRadius: '6px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  fontSize: '12px'
                                }}
                              >
                                <X size={14} />
                                Cancelar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div>
                            <div style={{ fontSize: '14px', color: colors.text, lineHeight: '1.5', marginBottom: '8px' }}>
                              {comentario.comentario}
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ fontSize: '12px', color: colors.textSecondary }}>
                                {new Date(comentario.fecha_creacion).toLocaleString('es-ES', {
                                  year: 'numeric',
                                  month: 'short',
                                  day: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                                {comentario.created_by_user && (
                                  <span style={{ marginLeft: '8px' }}>
                                    • {comentario.created_by_user.email}
                                  </span>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: '4px' }}>
                                <button
                                  onClick={() => handleEditComentario(comentario)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: 'transparent',
                                    color: colors.primary,
                                    border: `1px solid ${colors.primary}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                  }}
                                >
                                  <Edit3 size={12} />
                                  Editar
                                </button>
                                <button
                                  onClick={() => handleDeleteComentario(comentario.id)}
                                  style={{
                                    padding: '4px 8px',
                                    backgroundColor: 'transparent',
                                    color: colors.error,
                                    border: `1px solid ${colors.error}`,
                                    borderRadius: '4px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    fontSize: '12px'
                                  }}
                                >
                                  <Trash2 size={12} />
                                  Eliminar
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div style={{
                      textAlign: 'center',
                      padding: '20px',
                      color: colors.textSecondary,
                      fontSize: '14px'
                    }}>
                      No hay comentarios aún. ¡Sé el primero en añadir uno!
                    </div>
                  )}
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

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end' }}>
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

      {/* Modal de edición de subvención */}
      {(showEditModal || showNewSubvencionModal) && editingSubvencion && (
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
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '600', color: colors.text, margin: 0 }}>
                {showNewSubvencionModal ? 'Nueva Subvención' : 'Editar Subvención'}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setShowNewSubvencionModal(false);
                  setEditingSubvencion(null);
                }}
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
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <CheckCircle size={18} color={colors.primary} />
                  Información Básica
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                      Nombre de la Subvención *
                    </label>
                    <input
                      type="text"
                      value={editingSubvencion.nombre || ''}
                      onChange={(e) => setEditingSubvencion(prev => ({ ...prev, nombre: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px'
                      }}
                      placeholder="Ej: IMPULSEM 2022-2023"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                      Proyecto/Organismo
                    </label>
                    <input
                      type="text"
                      value={editingSubvencion.proyecto || editingSubvencion.organismo || ''}
                      onChange={(e) => setEditingSubvencion(prev => ({ ...prev, proyecto: e.target.value, organismo: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px'
                      }}
                      placeholder="Ej: Generalitat de Catalunya"
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                      Imputación
                    </label>
                    <input
                      type="text"
                      value={editingSubvencion.imputacion || ''}
                      onChange={(e) => setEditingSubvencion(prev => ({ ...prev, imputacion: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px'
                      }}
                      placeholder="Ej: 2024"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Número de Expediente
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.expediente || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, expediente: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: EXP-2024-001"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Código de Subvención
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.codigo || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, codigo: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: SUB-2024-001"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Modalidad
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.modalidad || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, modalidad: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: Línea de ayudas"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Fecha de Adjudicación
                      </label>
                      <input
                        type="date"
                        value={editingSubvencion.fechaAdjudicacion || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, fechaAdjudicacion: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                      Período de Ejecución
                    </label>
                    <input
                      type="text"
                      value={editingSubvencion.periodo || editingSubvencion.periodo_ejecucion || ''}
                      onChange={(e) => setEditingSubvencion(prev => ({ ...prev, periodo: e.target.value, periodo_ejecucion: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px'
                      }}
                      placeholder="Ej: 2022-2023"
                    />
                  </div>
                </div>
              </div>

              {/* Información Financiera */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Euro size={18} color={colors.primary} />
                  Información Financiera
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Importe Solicitado (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingSubvencion.importeSolicitado || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, importeSolicitado: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Importe Otorgado (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingSubvencion.importeOtorgado || editingSubvencion.importe_otorgado || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, importeOtorgado: parseFloat(e.target.value) || 0, importe_otorgado: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        SOC L1 Acompañamiento
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.socL1Acomp || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, socL1Acomp: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: 16.800,00€ (80%) SALDO 4.200,00€ (20%)"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        SOC L2 Contratación
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.socL2Contrat || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, socL2Contrat: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: 16.800,00€ (80%) SALDO 4.200,00€ (20%)"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Saldo Pendiente (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingSubvencion.saldoPendiente || editingSubvencion.saldo_pendiente || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, saldoPendiente: parseFloat(e.target.value) || 0, saldo_pendiente: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Importes por Cobrar (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingSubvencion.importesPorCobrar || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, importesPorCobrar: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                      Saldo Pendiente (Texto)
                    </label>
                    <input
                      type="text"
                      value={editingSubvencion.saldoPendienteTexto || editingSubvencion.saldo_pendiente_texto || ''}
                      onChange={(e) => setEditingSubvencion(prev => ({ ...prev, saldoPendienteTexto: e.target.value, saldo_pendiente_texto: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px'
                      }}
                      placeholder="Ej: PEND. GESTIONAR SUBV (17/02/2025)"
                    />
                  </div>
                </div>
              </div>

              {/* Abonos */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color={colors.primary} />
                  Abonos
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Primer Abono (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingSubvencion.primerAbono || editingSubvencion.primer_abono || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, primerAbono: parseFloat(e.target.value) || 0, primer_abono: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Fecha Primer Abono
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.fechaPrimerAbono || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, fechaPrimerAbono: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: 2023-12-07 - FIARE 1720"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Segundo Abono (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={editingSubvencion.segundoAbono || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, segundoAbono: parseFloat(e.target.value) || 0 }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="0.00"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Fecha Segundo Abono
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.fechaSegundoAbono || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, fechaSegundoAbono: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: 2024-06-15 - CTA 1162"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Información Adicional */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Settings size={18} color={colors.primary} />
                  Información Adicional
                </h3>
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Previsión Pago Total
                      </label>
                      <input
                        type="text"
                        value={editingSubvencion.previsionPago || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, previsionPago: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                        placeholder="Ej: Q2 2024"
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Fecha de Justificación
                      </label>
                      <input
                        type="date"
                        value={editingSubvencion.fechaJustificacion || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, fechaJustificacion: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px',
                          boxSizing: 'border-box'
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Revisado por Gestoría
                      </label>
                      <select
                        value={editingSubvencion.revisadoGestoria ? 'si' : 'no'}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, revisadoGestoria: e.target.value === 'si' }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px'
                        }}
                      >
                        <option value="no">No</option>
                        <option value="si">Sí</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                        Estado
                      </label>
                      <select
                        value={editingSubvencion.estado || ''}
                        onChange={(e) => setEditingSubvencion(prev => ({ ...prev, estado: e.target.value }))}
                        style={{
                          width: '100%',
                          padding: '12px',
                          border: `1px solid ${colors.border}`,
                          borderRadius: '8px',
                          backgroundColor: colors.surface,
                          color: colors.text,
                          fontSize: '14px'
                        }}
                      >
                        <option value="">Seleccionar estado</option>
                        <option value="CERRADA">Cerrada</option>
                        <option value="CERRAD PDTE INGRESO DEL SALDO">Cerrada - Pendiente Ingreso</option>
                        <option value="CERRADA PDTE APROBACIÓN FINAL">Cerrada - Pendiente Aprobación</option>
                        <option value="VIGENTE">Vigente</option>
                        <option value="POR DEFINIR">Por Definir</option>
                        <option value="CERRADA DESDE EL PROVEE">Cerrada - Proveedor</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ fontSize: '14px', fontWeight: '500', color: colors.text, marginBottom: '6px', display: 'block' }}>
                      Holded Asentamiento
                    </label>
                    <input
                      type="text"
                      value={editingSubvencion.holdedAsentamiento || ''}
                      onChange={(e) => setEditingSubvencion(prev => ({ ...prev, holdedAsentamiento: e.target.value }))}
                      style={{
                        width: '100%',
                        padding: '12px',
                        border: `1px solid ${colors.border}`,
                        borderRadius: '8px',
                        backgroundColor: colors.surface,
                        color: colors.text,
                        fontSize: '14px'
                      }}
                      placeholder="Ej: Asentado"
                    />
                  </div>
                </div>
              </div>

              {/* Fases del Proyecto */}
              <div style={{ padding: '16px', backgroundColor: colors.background, borderRadius: '8px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', color: colors.text, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Layers size={18} color={colors.primary} />
                    Fases del Proyecto
                  </h3>
                  <p style={{ fontSize: '13px', color: colors.textSecondary, margin: '4px 0 0 0' }}>
                    Haz clic en las fases para activarlas o desactivarlas
                  </p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(num => {
                    const faseValue = editingSubvencion.fasesProyecto?.[`fase${num}`];
                    const isBoolean = typeof faseValue === 'boolean';
                    const isActive = isBoolean ? faseValue : (faseValue && faseValue !== 'X' && faseValue !== 'x' && faseValue.trim() !== '');
                    
                    return (
                      <div 
                        key={num} 
                        style={{ 
                          padding: '12px 16px',
                          backgroundColor: isActive ? (colors.success + '15') : colors.surface,
                          border: `2px solid ${isActive ? colors.success : colors.border}`,
                          borderRadius: '8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                        onClick={() => {
                          setEditingSubvencion(prev => ({
                            ...prev,
                            fasesProyecto: {
                              ...prev.fasesProyecto,
                              [`fase${num}`]: !isActive
                            }
                          }));
                        }}
                      >
                        <div style={{
                          width: '20px',
                          height: '20px',
                          borderRadius: '4px',
                          border: `2px solid ${isActive ? colors.success : colors.border}`,
                          backgroundColor: isActive ? colors.success : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}>
                          {isActive && <CheckCircle size={14} color="white" />}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: '14px', fontWeight: '500', color: colors.text }}>
                            Fase {num}
                          </div>
                          {!isBoolean && isActive && (
                            <div style={{ fontSize: '12px', color: colors.textSecondary, marginTop: '2px' }}>
                              {faseValue}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button
                onClick={() => {
                  setShowEditModal(false);
                  setShowNewSubvencionModal(false);
                  setEditingSubvencion(null);
                }}
                style={{
                  padding: '12px 24px',
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
                onClick={handleSaveSubvencion}
                disabled={!editingSubvencion.nombre.trim() || loading}
                style={{
                  padding: '12px 24px',
                  backgroundColor: editingSubvencion.nombre.trim() && !loading ? colors.primary : colors.border,
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: editingSubvencion.nombre.trim() && !loading ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: '500'
                }}
              >
                {loading ? 'Guardando...' : (showNewSubvencionModal ? 'Crear' : 'Guardar')}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default SubvencionesPage;
