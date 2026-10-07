import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  Upload, 
  Plus, 
  Trash2, 
  Edit2,
  CheckCircle,
  X,
  AlertCircle,
  RefreshCw,
  Search,
  FileText,
  Coffee,
  Activity
} from 'feather-icons-react';
import fichajeDescansosService from '../services/fichajeDescansosService';
import holdedEmployeesService from '../services/holdedEmployeesService';
import { useTheme } from './ThemeContext';
import { useAuth } from './AuthContext';
import AdminSectionHeader from './AdminSectionHeader';
import AdminModal from './AdminModal';

const FichajeDescansosAdmin = () => {
  const { colors } = useTheme();
  const { user } = useAuth();
  
  // Estados
  const [reglas, setReglas] = useState([]);
  const [empleados, setEmpleados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Estados para modal de creación/edición
  const [showModal, setShowModal] = useState(false);
  const [editingRegla, setEditingRegla] = useState(null);
  const [formData, setFormData] = useState({
    empleadoId: '',
    jornada_laboral: '',
    tipo_descanso: '',
    horas_minimas: '',
    duracion_minutos: '',
    centro: '',
    empresa: '',
    convenio: '',
    activo: true
  });
  
  // Estados para importación Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);

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

  // Cargar reglas
  const loadReglas = async () => {
    setLoading(true);
    setError('');
    try {
      const resultado = await fichajeDescansosService.obtenerTodasLasReglas();
      
      if (resultado.success) {
        setReglas(resultado.data || []);
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error cargando reglas:', err);
      setError('Error al cargar las reglas de descanso');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReglas();
  }, []);

  // Obtener nombre del empleado
  const getEmpleadoNombre = (empleadoId) => {
    const empleado = empleados.find(e => e.id === empleadoId);
    return empleado?.nombreCompleto || empleado?.name || 'Empleado no encontrado';
  };

  // Filtrar reglas
  const filteredReglas = reglas.filter(regla => {
    const nombreEmpleado = getEmpleadoNombre(regla.empleado_id).toLowerCase();
    return nombreEmpleado.includes(searchTerm.toLowerCase());
  });

  // Abrir modal para crear/editar
  const openModal = (regla = null) => {
    if (regla) {
      setEditingRegla(regla);
      setFormData({
        empleadoId: regla.empleado_id,
        jornada_laboral: regla.jornada_laboral || '',
        tipo_descanso: regla.tipo_descanso || '',
        horas_minimas: regla.horas_minimas || '',
        duracion_minutos: regla.duracion_minutos || '',
        centro: regla.centro || '',
        empresa: regla.empresa || '',
        convenio: regla.convenio || '',
        activo: regla.activo !== undefined ? regla.activo : true
      });
    } else {
      setEditingRegla(null);
      setFormData({
        empleadoId: '',
        jornada_laboral: '',
        tipo_descanso: '',
        horas_minimas: '',
        duracion_minutos: '',
        centro: '',
        empresa: '',
        convenio: '',
        activo: true
      });
    }
    setShowModal(true);
  };

  // Guardar regla
  const handleSave = async () => {
    if (!formData.empleadoId) {
      setError('Debes seleccionar un empleado');
      return;
    }

    setLoading(true);
    setError('');
    
    try {
      const reglaData = {
        jornada_laboral: formData.jornada_laboral || null,
        tipo_descanso: formData.tipo_descanso || null,
        horas_minimas: formData.horas_minimas ? parseFloat(formData.horas_minimas) : null,
        duracion_minutos: formData.duracion_minutos ? parseInt(formData.duracion_minutos) : null,
        centro: formData.centro || null,
        empresa: formData.empresa || null,
        convenio: formData.convenio || null,
        activo: formData.activo
      };

      const resultado = await fichajeDescansosService.crearOActualizarRegla(
        formData.empleadoId,
        reglaData,
        user?.id
      );
      
      if (resultado.success) {
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(''), 3000);
        setShowModal(false);
        loadReglas();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error guardando regla:', err);
      setError('Error al guardar la regla');
    } finally {
      setLoading(false);
    }
  };

  // Importar desde Excel
  const handleImport = async () => {
    if (!importFile) {
      setError('Debes seleccionar un archivo');
      return;
    }

    setImporting(true);
    setError('');
    setImportResult(null);
    
    try {
      const resultado = await fichajeDescansosService.importarReglasDesdeExcel(importFile, user?.id);
      
      if (resultado.success) {
        setImportResult(resultado.data);
        setSuccess(resultado.message);
        setTimeout(() => setSuccess(''), 5000);
        loadReglas();
      } else {
        setError(resultado.error);
      }
    } catch (err) {
      console.error('Error importando reglas:', err);
      setError('Error al importar las reglas');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div>
      <AdminSectionHeader
        title="Reglas de descanso"
        description="Pausas obligatorias o condicionales por empleado (comida / descanso)."
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
              Nueva regla
            </button>
          </>
        }
      />

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
            <span style={{ color: colors.error, fontSize: '14px' }}>{error}</span>
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
            <span style={{ color: colors.success, fontSize: '14px' }}>{success}</span>
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

      {/* Búsqueda */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative' }}>
          <Search 
            size={20} 
            color={colors.textSecondary} 
            style={{ 
              position: 'absolute', 
              left: '12px', 
              top: '50%', 
              transform: 'translateY(-50%)' 
            }} 
          />
          <input
            type="text"
            placeholder="Buscar por nombre de empleado..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 12px 12px 44px',
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              fontSize: '14px',
              color: colors.text,
              backgroundColor: colors.surface,
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* Tabla de reglas */}
      <div style={{
        backgroundColor: colors.surface,
        borderRadius: '12px',
        overflow: 'hidden',
        border: `1px solid ${colors.border}`
      }}>
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <RefreshCw size={32} color={colors.primary} style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: colors.textSecondary, marginTop: '16px' }}>Cargando reglas...</p>
          </div>
        ) : filteredReglas.length === 0 ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>
            <Clock size={48} color={colors.border} style={{ marginBottom: '16px' }} />
            <p style={{ color: colors.textSecondary }}>No se encontraron reglas de descanso</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: colors.background, borderBottom: `2px solid ${colors.border}` }}>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    EMPLEADO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    JORNADA
                  </th>
                  <th style={{ padding: '16px', textAlign: 'left', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    TIPO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    HORAS MÍN.
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    DURACIÓN
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ESTADO
                  </th>
                  <th style={{ padding: '16px', textAlign: 'center', color: colors.text, fontWeight: '600', fontSize: '13px' }}>
                    ACCIONES
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredReglas.map((regla, index) => (
                  <motion.tr
                    key={regla.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: index * 0.05 }}
                    style={{
                      borderBottom: `1px solid ${colors.border}`,
                      backgroundColor: !regla.activo ? colors.error + '08' : 'transparent'
                    }}
                  >
                    <td style={{ padding: '16px' }}>
                      <div style={{ color: colors.text, fontWeight: '600', fontSize: '14px' }}>
                        {getEmpleadoNombre(regla.empleado_id)}
                      </div>
                    </td>
                    <td style={{ padding: '16px', color: colors.text, fontSize: '14px' }}>
                      {regla.jornada_laboral || '-'}
                    </td>
                    <td style={{ padding: '16px' }}>
                      {regla.tipo_descanso ? (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: colors.info + '15',
                          borderRadius: '6px',
                          fontSize: '13px',
                          color: colors.info,
                          fontWeight: '600'
                        }}>
                          <Coffee size={14} />
                          {regla.tipo_descanso}
                        </div>
                      ) : (
                        <span style={{ color: colors.textSecondary }}>Sin descanso</span>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: colors.text, fontSize: '14px' }}>
                      {regla.horas_minimas ? `${regla.horas_minimas}h` : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center', color: colors.text, fontSize: '14px' }}>
                      {regla.duracion_minutos ? `${regla.duracion_minutos} min` : '-'}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      {regla.activo ? (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: colors.success + '15',
                          borderRadius: '6px'
                        }}>
                          <Activity size={14} color={colors.success} />
                          <span style={{ color: colors.success, fontSize: '13px', fontWeight: '600' }}>
                            Activa
                          </span>
                        </div>
                      ) : (
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          padding: '4px 10px',
                          backgroundColor: colors.error + '15',
                          borderRadius: '6px'
                        }}>
                          <X size={14} color={colors.error} />
                          <span style={{ color: colors.error, fontSize: '13px', fontWeight: '600' }}>
                            Inactiva
                          </span>
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                        <button
                          onClick={() => openModal(regla)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: colors.primary + '15',
                            color: colors.primary,
                            border: 'none',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                        >
                          <Edit2 size={14} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AdminModal
        open={showModal}
        onClose={() => !loading && setShowModal(false)}
        title={editingRegla ? 'Editar regla de descanso' : 'Nueva regla de descanso'}
        description="Define cuándo y cuánto debe pausar cada empleado."
        colors={colors}
        maxWidth={600}
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
              <option value="">Seleccionar empleado…</option>
              {empleados.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.nombreCompleto || emp.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Jornada laboral
            </label>
            <input
              type="text"
              value={formData.jornada_laboral}
              onChange={(e) => setFormData({ ...formData, jornada_laboral: e.target.value })}
              placeholder="Ej: Completa, Parcial…"
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
                Horas mínimas
              </label>
              <input
                type="number"
                step="0.5"
                value={formData.horas_minimas}
                onChange={(e) => setFormData({ ...formData, horas_minimas: e.target.value })}
                placeholder="Ej: 5.0"
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
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
                Duración (minutos)
              </label>
              <input
                type="number"
                value={formData.duracion_minutos}
                onChange={(e) => setFormData({ ...formData, duracion_minutos: e.target.value })}
                placeholder="Ej: 20, 30"
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

          <div>
            <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: colors.text, marginBottom: 8 }}>
              Tipo de descanso
            </label>
            <select
              value={formData.tipo_descanso}
              onChange={(e) => setFormData({ ...formData, tipo_descanso: e.target.value })}
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
              <option value="">Sin descanso</option>
              <option value="descanso">Descanso</option>
              <option value="comida">Comida</option>
              <option value="cafe">Café</option>
            </select>
          </div>

          <label style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 14,
            fontWeight: 500,
            color: colors.text,
            cursor: 'pointer'
          }}>
            <input
              type="checkbox"
              checked={formData.activo}
              onChange={(e) => setFormData({ ...formData, activo: e.target.checked })}
              style={{ width: 18, height: 18, cursor: 'pointer' }}
            />
            Regla activa
          </label>
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
        title="Importar reglas desde Excel"
        description="Usa la hoja 2 del archivo. El empleado se resuelve por nombre en Holded."
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
        <ul style={{ fontSize: 13, color: colors.textSecondary, paddingLeft: 20, margin: '0 0 16px' }}>
          <li><strong>TRABAJADOR</strong> (o Nombre / Empleado)</li>
          <li><strong>JORNADA LABORAL</strong></li>
          <li><strong>BREAK</strong> (o Descanso / Pausa): ej. 20m, 30m, comida</li>
          <li><strong>CENTRO</strong>, <strong>EMPRESA</strong>, <strong>CONVENIO</strong> (opcionales)</li>
        </ul>

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

export default FichajeDescansosAdmin;










