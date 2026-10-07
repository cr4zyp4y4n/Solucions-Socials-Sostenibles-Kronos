import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Key, 
  Upload, 
  Plus, 
  Trash2, 
  Edit2,
  CheckCircle,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  FileText
} from 'feather-icons-react';
import fichajeCodigosService from '../services/fichajeCodigosService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import AdminSectionHeader from './AdminSectionHeader';
import AdminModal from './AdminModal';

const FichajeCodigosAdmin = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  // Estados
  const [codigos, setCodigos] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modal de creación/edición
  const [showModal, setShowModal] = useState(false);
  const [editingCodigo, setEditingCodigo] = useState(null);
  const [formData, setFormData] = useState({
    codigo: '',
    empleadoId: '',
    descripcion: ''
  });
  const [generandoCodigo, setGenerandoCodigo] = useState(false);
  
  // Estados para importación Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const syncedDescripcionesRef = useRef(false);

  // Cargar empleados
  useEffect(() => {
    const loadEmpleados = async () => {
      try {
        const [empleadosSolucions, empleadosMenjar] = await Promise.all([
          holdedEmployeesService.getEmployeesTransformed('solucions').catch(() => []),
          holdedEmployeesService.getEmployeesTransformed('menjar').catch(() => [])
        ]);
        
        const todosEmpleados = [
          ...(empleadosSolucions || []),
          ...(empleadosMenjar || [])
        ];
        
        setEmpleados(todosEmpleados);
      } catch (err) {
        console.error('Error cargando empleados:', err);
      }
    };
    loadEmpleados();
  }, []);

  // Cargar códigos
  const loadCodigos = async () => {
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeCodigosService.obtenerTodosLosCodigos();
      
      if (resultado.success) {
        setCodigos(resultado.data || []);
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error cargando códigos:', err);
      setError('Error al cargar los códigos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCodigos();
  }, []);

  // Sincronizar nombres a la BD: cuando tenemos códigos y empleados, rellenar descripción vacía con el nombre del empleado
  // Así en Fichaje se muestra el nombre sin llamar a Holded. El nombre en la tabla Admin sale de Holded (empleados en memoria).
  useEffect(() => {
    if (codigos.length === 0 || empleados.length === 0 || syncedDescripcionesRef.current) return;
    syncedDescripcionesRef.current = true;
    const sync = async () => {
      const sinDescripcion = codigos.filter(c => !c.descripcion?.trim());
      for (const codigo of sinDescripcion) {
        const emp = empleados.find(e => e.id === codigo.empleado_id);
        const nombre = emp?.nombreCompleto || emp?.name;
        if (nombre) {
          await fichajeCodigosService.actualizarDescripcion(codigo.id, nombre);
        }
      }
      if (sinDescripcion.length > 0) loadCodigos();
    };
    sync();
  }, [codigos, empleados]);

  // Obtener nombre del empleado
  const getEmpleadoNombre = (empleadoId) => {
    const empleado = empleados.find(e => e.id === empleadoId);
    return empleado?.nombreCompleto || empleado?.name || 'Empleado no encontrado';
  };

  // Abrir modal para crear/editar
  const openModal = async (codigo = null) => {
    setError('');
    if (codigo) {
      setEditingCodigo(codigo);
      const descripcion = codigo.descripcion?.trim() || getEmpleadoNombre(codigo.empleado_id);
      setFormData({
        codigo: codigo.codigo,
        empleadoId: codigo.empleado_id,
        descripcion: descripcion === 'Empleado no encontrado' ? '' : descripcion
      });
      setShowModal(true);
      return;
    }

    setEditingCodigo(null);
    setFormData({
      codigo: '',
      empleadoId: '',
      descripcion: ''
    });
    setShowModal(true);
    setGenerandoCodigo(true);
    try {
      const gen = await fichajeCodigosService.generarCodigoAleatorioUnico();
      if (gen.success && gen.codigo) {
        setFormData((prev) => ({ ...prev, codigo: gen.codigo }));
      } else {
        setError(gen.error || 'No se pudo generar el código');
      }
    } finally {
      setGenerandoCodigo(false);
    }
  };

  const regenerarCodigo = async () => {
    if (editingCodigo) return;
    setGenerandoCodigo(true);
    setError('');
    try {
      const gen = await fichajeCodigosService.generarCodigoAleatorioUnico();
      if (gen.success && gen.codigo) {
        setFormData((prev) => ({ ...prev, codigo: gen.codigo }));
      } else {
        setError(gen.error || 'No se pudo generar el código');
      }
    } finally {
      setGenerandoCodigo(false);
    }
  };

  // Guardar código
  const handleSave = async () => {
    if (!editingCodigo && !formData.codigo.trim()) {
      setError('Espera a que se genere el código o pulsa regenerar');
      return;
    }
    if (!formData.codigo.trim()) {
      setError('El código es requerido');
      return;
    }
    if (!formData.empleadoId) {
      setError('Debes seleccionar un empleado');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      // Guardar nombre del empleado en descripción para que salga en Fichaje (si descripción vacía)
      const nombreEmpleado = getEmpleadoNombre(formData.empleadoId);
      const descripcionToSave = (formData.descripcion?.trim() || nombreEmpleado) || null;
      const resultado = await fichajeCodigosService.crearOActualizarCodigo(
        formData.codigo,
        formData.empleadoId,
        descripcionToSave,
        user?.id
      );
      
      if (resultado.success) {
        setSuccess(
          editingCodigo
            ? resultado.message
            : `Código ${formData.codigo} creado para ${nombreEmpleado}`
        );
        setTimeout(() => setSuccess(''), 4000);
        setShowModal(false);
        loadCodigos();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error guardando código:', err);
      setError('Error al guardar el código');
    } finally {
      setLoading(false);
    }
  };

  // Desactivar código
  const handleDesactivar = async (codigoId) => {
    if (!window.confirm('¿Estás seguro de que quieres desactivar este código?')) {
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const resultado = await fichajeCodigosService.desactivarCodigo(codigoId);
      
      if (resultado.success) {
        setSuccess('Código desactivado correctamente');
        setTimeout(() => setSuccess(''), 3000);
        loadCodigos();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error desactivando código:', err);
      setError('Error al desactivar el código');
    } finally {
      setLoading(false);
    }
  };

  // Importar desde Excel
  const handleImport = async () => {
    if (!importFile) {
      setError('Por favor, selecciona un archivo');
      return;
    }

    setImporting(true);
    setError('');
    setImportResult(null);
    
    try {
      const resultado = await fichajeCodigosService.importarCodigosDesdeExcel(importFile, user?.id);
      
      if (resultado.success) {
        setImportResult(resultado.data);
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(''), 5000);
        setShowImportModal(false);
        setImportFile(null);
        loadCodigos();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error importando códigos:', err);
      setError('Error al importar los códigos');
    } finally {
      setImporting(false);
    }
  };

  // Filtrar códigos
  const codigosFiltrados = codigos.filter(codigo => {
    const searchLower = searchTerm.toLowerCase();
    const codigoStr = codigo.codigo?.toLowerCase() || '';
    const empleadoNombre = getEmpleadoNombre(codigo.empleado_id).toLowerCase();
    const descripcion = codigo.descripcion?.toLowerCase() || '';
    
    return codigoStr.includes(searchLower) || 
           empleadoNombre.includes(searchLower) ||
           descripcion.includes(searchLower);
  });

  return (
    <div>
      <AdminSectionHeader
        title="Códigos de fichaje"
        description="Códigos que usan los trabajadores para identificarse al fichar (sin login)."
        colors={colors}
        actions={
          <>
            <button
              onClick={() => setShowImportModal(true)}
              style={{
                padding: '10px 16px',
                backgroundColor: colors.info || colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Upload size={18} />
              Importar Excel
            </button>
            <button
              onClick={() => openModal()}
              style={{
                padding: '10px 16px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Plus size={18} />
              Nuevo código
            </button>
          </>
        }
      />

      <div style={{
        display: 'flex',
        gap: '12px',
        alignItems: 'center',
        marginBottom: '20px'
      }}>
        <Search size={18} color={colors.textSecondary} />
        <input
          type="text"
          placeholder="Buscar por código, empleado o descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '10px 16px',
            border: `1px solid ${colors.border}`,
            borderRadius: '8px',
            fontSize: '14px',
            color: colors.text,
            backgroundColor: colors.background,
            outline: 'none'
          }}
        />
      </div>

      {/* Mensajes */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.error + '15',
              border: `2px solid ${colors.error}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <AlertCircle size={20} color={colors.error} />
            <span style={{ color: colors.error, fontSize: '14px', fontWeight: '500' }}>{error}</span>
            <button 
              onClick={() => setError('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.error
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              padding: '14px 18px',
              backgroundColor: colors.success + '15',
              border: `2px solid ${colors.success}`,
              borderRadius: '8px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <CheckCircle size={20} color={colors.success} />
            <span style={{ color: colors.success, fontSize: '14px', fontWeight: '500' }}>{success}</span>
            <button 
              onClick={() => setSuccess('')}
              style={{ 
                marginLeft: 'auto', 
                background: 'none', 
                border: 'none', 
                cursor: 'pointer',
                color: colors.success
              }}
            >
              <X size={18} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabla de códigos */}
      {loading && codigos.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ color: colors.textSecondary, marginTop: '16px' }}>Cargando códigos...</p>
        </div>
      ) : (
        <div style={{
          backgroundColor: colors.surface,
          borderRadius: '12px',
          border: `1px solid ${colors.border}`,
          overflow: 'hidden'
        }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ 
                  backgroundColor: colors.background,
                  borderBottom: `2px solid ${colors.border}`
                }}>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Código
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Empleado
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Descripción
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Estado
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {codigosFiltrados.length === 0 ? (
                  <tr>
                    <td colSpan="5" style={{ padding: '40px', textAlign: 'center', color: colors.textSecondary }}>
                      {searchTerm ? 'No se encontraron códigos con ese criterio' : 'No hay códigos registrados'}
                    </td>
                  </tr>
                ) : (
                  codigosFiltrados.map((codigo) => (
                    <tr key={codigo.id} style={{ borderBottom: `1px solid ${colors.border}` }}>
                      <td style={{ padding: '16px', color: colors.text, fontWeight: '600', fontFamily: 'monospace', fontSize: '16px' }}>
                        {codigo.codigo}
                      </td>
                      <td style={{ padding: '16px', color: colors.text }}>
                        {getEmpleadoNombre(codigo.empleado_id)}
                      </td>
                      <td style={{ padding: '16px', color: colors.textSecondary, fontSize: '13px' }}>
                        {codigo.descripcion || '-'}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <span style={{
                          padding: '4px 12px',
                          borderRadius: '12px',
                          fontSize: '12px',
                          fontWeight: '600',
                          backgroundColor: codigo.activo ? colors.success + '20' : colors.error + '20',
                          color: codigo.activo ? colors.success : colors.error
                        }}>
                          {codigo.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td style={{ padding: '16px', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button
                            onClick={() => openModal(codigo)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: 'transparent',
                              color: colors.primary,
                              border: `1px solid ${colors.primary}`,
                              borderRadius: '6px',
                              fontSize: '12px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            <Edit2 size={14} />
                            Editar
                          </button>
                          {codigo.activo && (
                            <button
                              onClick={() => handleDesactivar(codigo.id)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: 'transparent',
                                color: colors.error,
                                border: `1px solid ${colors.error}`,
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '4px'
                              }}
                            >
                              <Trash2 size={14} />
                              Desactivar
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AdminModal
        open={showModal}
        onClose={() => !loading && setShowModal(false)}
        title={editingCodigo ? 'Editar código' : 'Nuevo código'}
        description={
          editingCodigo
            ? 'El código existente no se modifica (solo empleado/descripción).'
            : 'Se genera un código aleatorio de 6 dígitos único en base de datos.'
        }
        colors={colors}
        closeDisabled={loading}
        footer={
          <>
            <button
              type="button"
              onClick={() => setShowModal(false)}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={{
                padding: '10px 16px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1
              }}
            >
              {loading ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Código *
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
              <input
                type="text"
                value={generandoCodigo && !editingCodigo ? 'Generando…' : formData.codigo}
                readOnly
                disabled={!!editingCodigo || generandoCodigo}
                placeholder="Se genera automáticamente"
                style={{
                  flex: 1,
                  padding: 12,
                  border: `1px solid ${colors.border}`,
                  borderRadius: 8,
                  fontSize: 18,
                  letterSpacing: '0.12em',
                  color: colors.text,
                  backgroundColor: colors.background,
                  outline: 'none',
                  fontFamily: 'monospace',
                  fontWeight: 700
                }}
              />
              {!editingCodigo ? (
                <button
                  type="button"
                  onClick={() => void regenerarCodigo()}
                  disabled={generandoCodigo || loading}
                  title="Generar otro código"
                  style={{
                    padding: '0 14px',
                    border: `1px solid ${colors.border}`,
                    borderRadius: 8,
                    background: colors.surface,
                    color: colors.text,
                    cursor: generandoCodigo ? 'wait' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    fontWeight: 600,
                    fontFamily: 'inherit'
                  }}
                >
                  <RefreshCw size={16} />
                  Otro
                </button>
              ) : null}
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Empleado *
            </label>
            <select
              value={formData.empleadoId}
              onChange={(e) => setFormData({ ...formData, empleadoId: e.target.value })}
              style={{
                width: '100%',
                padding: 12,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
                color: colors.text,
                backgroundColor: colors.background,
                outline: 'none'
              }}
            >
              <option value="">-- Selecciona un empleado --</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.nombreCompleto || emp.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Descripción (opcional)
            </label>
            <input
              type="text"
              value={formData.descripcion}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Descripción opcional del código"
              style={{
                width: '100%',
                padding: 12,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
                color: colors.text,
                backgroundColor: colors.background,
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>
      </AdminModal>

      <AdminModal
        open={showImportModal}
        onClose={() => {
          if (importing) return;
          setShowImportModal(false);
          setImportFile(null);
          setImportResult(null);
        }}
        title="Importar códigos desde Excel"
        description="El sistema buscará el empleado en Holded por nombre."
        colors={colors}
        maxWidth={600}
        closeDisabled={importing}
        footer={
          <>
            <button
              type="button"
              onClick={() => {
                setShowImportModal(false);
                setImportFile(null);
                setImportResult(null);
              }}
              disabled={importing}
              style={{
                padding: '10px 16px',
                backgroundColor: 'transparent',
                color: colors.text,
                border: `1px solid ${colors.border}`,
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: importing ? 'not-allowed' : 'pointer',
                opacity: importing ? 0.6 : 1
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importFile}
              style={{
                padding: '10px 16px',
                backgroundColor: colors.primary,
                color: 'white',
                border: 'none',
                borderRadius: 8,
                fontSize: 14,
                fontWeight: 600,
                cursor: importing || !importFile ? 'not-allowed' : 'pointer',
                opacity: importing || !importFile ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              {importing ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} />
                  Importando…
                </>
              ) : (
                <>
                  <Upload size={16} />
                  Importar
                </>
              )}
            </button>
          </>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <p style={{ fontSize: 14, color: colors.textSecondary, margin: '0 0 12px' }}>
            Columnas esperadas:
          </p>
          <ul style={{ fontSize: 13, color: colors.textSecondary, paddingLeft: 20, margin: 0 }}>
            <li><strong>CLAVE</strong> (o Código / codigo / code)</li>
            <li><strong>NOMBRE</strong> (o Nombre / empleado / employee)</li>
            <li><strong>Descripción</strong> (opcional)</li>
          </ul>
        </div>

        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={(e) => setImportFile(e.target.files?.[0] || null)}
          style={{
            width: '100%',
            padding: 12,
            border: `1px solid ${colors.border}`,
            borderRadius: 8,
            fontSize: 14,
            color: colors.text,
            backgroundColor: colors.background,
            boxSizing: 'border-box'
          }}
        />

        {importResult && (
          <div style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: (colors.info || colors.primary) + '15',
            border: `1px solid ${colors.info || colors.primary}`,
            borderRadius: 8,
            fontSize: 13,
            color: colors.text
          }}>
            <div><strong>Exitosos:</strong> {importResult.exitosos}</div>
            <div><strong>Errores:</strong> {importResult.errores}</div>
            {importResult.erroresDetalle?.length > 0 && (
              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                {importResult.erroresDetalle.slice(0, 5).map((err, idx) => (
                  <li key={idx}>Fila {err.fila}: {err.error}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </AdminModal>

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

export default FichajeCodigosAdmin;

