import React, { useState, useEffect, useMemo } from 'react';
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
  Pen,
  Search
} from 'lucide-react';
import { useTheme } from './ThemeContext';
import productosIdoniService from '../services/productosIdoniSupabaseService';
import { supabase } from '../config/supabase';
import holdedApi from '../services/holdedApi';

const HojaRutaViewModal = ({
  isOpen,
  onClose,
  hojaRuta
}) => {
  const { colors } = useTheme();
  const [productosIdoni, setProductosIdoni] = useState([]);

  // Inventario (Holded) para enlazar equipamiento
  const invCompany = 'solucions'; // REQUERIMIENTO: SOLO Solucions
  const [invWarehouses, setInvWarehouses] = useState([]);
  const [invSelectedWarehouseId, setInvSelectedWarehouseId] = useState(''); // warehouseId
  const [invProducts, setInvProducts] = useState([]);
  const [invWarehouseStock, setInvWarehouseStock] = useState({}); // { [productId]: stock }
  const [invLoading, setInvLoading] = useState(false);
  const [invError, setInvError] = useState('');
  const [equipmentLinks, setEquipmentLinks] = useState({}); // { [normItem]: { productId, method, score } }
  const allowedProductIds = useMemo(() => new Set(Object.keys(invWarehouseStock || {})), [invWarehouseStock]);
  const [equipSearch, setEquipSearch] = useState('');
  const [productPicker, setProductPicker] = useState({ normKey: null, query: '' }); // { normKey: string|null, query: string }

  const TARGET_WAREHOUSE_NORM = 'font honrada catering';

  const normalizeText = (text) => {
    const s = String(text || '').toLowerCase().trim();
    if (!s) return '';
    return s
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const tokenize = (text) => normalizeText(text).split(' ').filter(Boolean);

  const similarityScore = (a, b) => {
    const aNorm = normalizeText(a);
    const bNorm = normalizeText(b);
    if (!aNorm || !bNorm) return 0;
    if (aNorm === bNorm) return 1;
    if (aNorm.length >= 5 && bNorm.includes(aNorm)) return 0.98;
    if (bNorm.length >= 5 && aNorm.includes(bNorm)) return 0.98;

    const aTokens = new Set(tokenize(aNorm));
    const bTokens = new Set(tokenize(bNorm));
    if (aTokens.size === 0 || bTokens.size === 0) return 0;
    let inter = 0;
    for (const t of aTokens) if (bTokens.has(t)) inter += 1;
    const union = aTokens.size + bTokens.size - inter;
    return union > 0 ? inter / union : 0;
  };

  const aliasStorageKey = () => `kronos.equipmentAlias.v1.solucions.font-honrada-catering`;
  const loadAliasMap = () => {
    try {
      const raw = localStorage.getItem(aliasStorageKey());
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  };

  const saveAliasMap = (map) => {
    try {
      localStorage.setItem(aliasStorageKey(), JSON.stringify(map || {}));
    } catch {
      // noop
    }
  };

  const getProductIdCandidates = (p) => {
    const candidates = [p?.id, p?._id]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    return [...new Set(candidates)];
  };

  const getProductName = (p) => String(p?.name || p?.nombre || '').trim();

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

  // Cargar inventario (productos + almacenes) para enlazar equipamiento
  useEffect(() => {
    const run = async () => {
      if (!isOpen) return;
      setInvError('');
      setInvLoading(true);
      try {
        const [products, warehouses] = await Promise.all([
          holdedApi.getAllProducts(invCompany),
          holdedApi.getWarehouses(invCompany)
        ]);
        setInvProducts(Array.isArray(products) ? products : []);
        setInvWarehouses(Array.isArray(warehouses) ? warehouses : []);
      } catch (e) {
        setInvError(e?.message || 'Error cargando inventario de Holded');
      } finally {
        setInvLoading(false);
      }
    };
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invCompany]);

  // Seleccionar automáticamente el almacén objetivo (Font Honrada (Càtering))
  useEffect(() => {
    if (!isOpen) return;
    if (!Array.isArray(invWarehouses) || invWarehouses.length === 0) return;
    const target = invWarehouses.find((w) => normalizeText(w?.name) === TARGET_WAREHOUSE_NORM);
    if (!target?.id) {
      setInvError('No se ha encontrado el almacén "Font Honrada (Càtering)" en Holded.');
      return;
    }
    setInvSelectedWarehouseId(String(target.id));
    setInvError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, invWarehouses]);

  // Cargar stock por almacén si aplica
  useEffect(() => {
    const run = async () => {
      if (!isOpen) return;
      if (!invSelectedWarehouseId) {
        setInvWarehouseStock({});
        return;
      }
      setInvError('');
      setInvLoading(true);
      try {
        const res = await holdedApi.getWarehouseStock(invSelectedWarehouseId, invCompany);
        const list = res?.warehouse?.products;
        const map = {};
        if (Array.isArray(list)) {
          for (const row of list) {
            const pid = String(row?.product_id || '').trim();
            if (!pid) continue;
            map[pid] = typeof row?.stock === 'number' ? row.stock : Number(row?.stock || 0);
          }
        }
        setInvWarehouseStock(map);
      } catch (e) {
        setInvError(e?.message || 'Error cargando stock del almacén');
        setInvWarehouseStock({});
      } finally {
        setInvLoading(false);
      }
    };
    run();
  }, [isOpen, invCompany, invSelectedWarehouseId]);

  // Auto-enlazar equipamiento cuando cambian datos
  useEffect(() => {
    if (!isOpen) return;
    const items = Array.isArray(hojaRuta?.equipamiento) ? hojaRuta.equipamiento : [];
    if (items.length === 0) return;

    const aliasMap = loadAliasMap();
    const byId = new Map();
    const byNormName = new Map();
    for (const p of (Array.isArray(invProducts) ? invProducts : [])) {
      const pid = getProductIdCandidates(p)[0];
      // REQUERIMIENTO: SOLO productos existentes en el almacén Font Honrada (Càtering)
      if (!pid || !allowedProductIds.has(pid)) continue;
      if (pid) byId.set(pid, p);
      const nm = getProductName(p);
      const nn = normalizeText(nm);
      if (pid && nn && !byNormName.has(nn)) byNormName.set(nn, pid);
    }

    const nextLinks = {};
    for (const it of items) {
      const rawName = String(it?.item || '').trim();
      const norm = normalizeText(rawName);
      if (!norm) continue;

      const aliasProductId = String(aliasMap[norm] || '').trim();
      if (aliasProductId && byId.has(aliasProductId)) {
        nextLinks[norm] = { productId: aliasProductId, method: 'alias', score: 1 };
        continue;
      }

      // Exact por nombre normalizado
      const exactPid = byNormName.get(norm);
      if (exactPid) {
        nextLinks[norm] = { productId: exactPid, method: 'exact', score: 1 };
        continue;
      }

      // Fuzzy controlado: solo si es clarísimo
      let best = { pid: null, score: 0 };
      for (const p of (Array.isArray(invProducts) ? invProducts : [])) {
        const pid = getProductIdCandidates(p)[0];
        if (!pid || !allowedProductIds.has(pid)) continue;
        const nm = getProductName(p);
        const sc = similarityScore(rawName, nm);
        if (sc > best.score) best = { pid, score: sc };
      }
      if (best.pid && best.score >= 0.92) {
        nextLinks[norm] = { productId: best.pid, method: 'fuzzy', score: best.score };
      }
    }

    setEquipmentLinks(nextLinks);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, hojaRuta, invCompany, invSelectedWarehouseId, invProducts, allowedProductIds]);

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

  const filteredEquipamiento = useMemo(() => {
    const list = Array.isArray(hojaRuta?.equipamiento) ? hojaRuta.equipamiento : [];
    const term = normalizeText(equipSearch);
    if (!term) return list;
    return list.filter((it) => normalizeText(it?.item).includes(term));
  }, [hojaRuta, equipSearch]);

  const allowedProducts = useMemo(() => {
    if (!Array.isArray(invProducts) || invProducts.length === 0) return [];
    if (!allowedProductIds || allowedProductIds.size === 0) return [];
    return invProducts.filter((p) => {
      const pid = getProductIdCandidates(p)[0];
      return pid && allowedProductIds.has(pid);
    });
  }, [invProducts, allowedProductIds]);

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

                  {/* Estado de vinculación (fijo: Solucions + Font Honrada (Càtering)) */}
                  <div style={{
                    display: 'flex',
                    gap: '10px',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    marginBottom: 14
                  }}>
                    <span style={{
                      fontSize: 11,
                      color: colors.textSecondary,
                      padding: '6px 10px',
                      borderRadius: 999,
                      border: `1px solid ${colors.border}`,
                      background: colors.surface
                    }}>
                      Inventario: <b style={{ color: colors.text }}>Solucions</b> · Almacén: <b style={{ color: colors.text }}>Font Honrada (Càtering)</b>
                    </span>

                    {invLoading ? (
                      <span style={{ fontSize: 11, color: colors.textSecondary }}>Cargando inventario…</span>
                    ) : null}
                    {invError ? (
                      <span style={{ fontSize: 11, color: colors.error, display: 'flex', alignItems: 'center', gap: 6 }}>
                        <AlertCircle size={14} />
                        {invError}
                      </span>
                    ) : null}
                  </div>

                  {/* Buscar equipamiento */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 12px',
                    border: `1px solid ${colors.border}`,
                    background: colors.surface,
                    borderRadius: 10,
                    marginBottom: 12
                  }}>
                    <Search size={16} color={colors.textSecondary} />
                    <input
                      value={equipSearch}
                      onChange={(e) => setEquipSearch(e.target.value)}
                      placeholder="Buscar equipamiento…"
                      style={{
                        width: '100%',
                        border: 'none',
                        outline: 'none',
                        background: 'transparent',
                        color: colors.text,
                        fontSize: 12
                      }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
                    {filteredEquipamiento.map((item, index) => (
                      <div key={index} style={{
                        padding: '8px',
                        backgroundColor: colors.surface,
                        borderRadius: '6px',
                        border: `1px solid ${colors.border}`
                      }}>
                        {(() => {
                          const rawName = String(item?.item || '').trim();
                          const norm = normalizeText(rawName);
                          const link = norm ? equipmentLinks[norm] : null;
                          const productId = link?.productId || null;
                          const product = productId
                            ? (invProducts || []).find((p) => getProductIdCandidates(p)[0] === productId)
                            : null;

                          const suggestions = (() => {
                            if (!rawName || allowedProducts.length === 0) return [];
                            const scored = allowedProducts
                              .map((p) => {
                                const pid = getProductIdCandidates(p)[0];
                                const nm = getProductName(p);
                                return { pid, name: nm, score: similarityScore(rawName, nm) };
                              })
                              .filter((x) => x.pid && x.name)
                              .sort((a, b) => b.score - a.score)
                              .slice(0, 6);
                            return scored;
                          })();

                          const stockValue = (() => {
                            if (!productId) return null;
                            if (invSelectedWarehouseId && invSelectedWarehouseId !== 'all') {
                              return invWarehouseStock?.[productId];
                            }
                            return product?.stock;
                          })();

                          const status = productId ? (link?.method === 'alias' ? 'manual' : 'auto') : 'pending';
                          const badge = (() => {
                            if (status === 'auto') return { text: 'Auto', bg: colors.primary + '18', fg: colors.primary };
                            if (status === 'manual') return { text: 'Manual', bg: colors.primary + '18', fg: colors.primary };
                            return { text: 'Pendiente', bg: colors.error + '18', fg: colors.error };
                          })();

                          const onPickProduct = (pid) => {
                            const normKey = normalizeText(rawName);
                            if (!normKey) return;
                            const aliasMap = loadAliasMap();
                            const nextMap = { ...aliasMap, [normKey]: pid };
                            saveAliasMap(nextMap);
                            setEquipmentLinks((prev) => ({
                              ...(prev || {}),
                              [normKey]: { productId: pid, method: 'alias', score: 1 }
                            }));
                            setProductPicker({ normKey: null, query: '' });
                          };

                          const onClear = () => {
                            const normKey = normalizeText(rawName);
                            if (!normKey) return;
                            const aliasMap = loadAliasMap();
                            const nextMap = { ...aliasMap };
                            delete nextMap[normKey];
                            saveAliasMap(nextMap);
                            setEquipmentLinks((prev) => {
                              const n = { ...(prev || {}) };
                              delete n[normKey];
                              return n;
                            });
                          };

                          return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
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

                                {/* Enlace a inventario */}
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                    <span style={{
                                      fontSize: 10,
                                      padding: '3px 8px',
                                      borderRadius: 999,
                                      background: badge.bg,
                                      color: badge.fg,
                                      border: `1px solid ${badge.fg}33`,
                                      fontWeight: 700
                                    }}>
                                      {badge.text}
                                    </span>

                                    {product ? (
                                      <span style={{ fontSize: 11, color: colors.textSecondary }}>
                                        Producto: <b style={{ color: colors.text }}>{getProductName(product)}</b>
                                        {stockValue !== undefined && stockValue !== null ? (
                                          <> · Stock: <b style={{ color: colors.text }}>{stockValue}</b></>
                                        ) : null}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: 11, color: colors.textSecondary }}>
                                        No enlazado a inventario
                                      </span>
                                    )}
                                  </div>

                                  {/* Selector manual si no hay match */}
                                  <div style={{ marginTop: 8 }}>
                                    <motion.button
                                      whileHover={{ scale: 1.01 }}
                                      whileTap={{ scale: 0.99 }}
                                      onClick={() => {
                                        const normKey = normalizeText(rawName);
                                        if (!normKey) return;
                                        setProductPicker((prev) => ({
                                          normKey,
                                          query: prev.normKey === normKey ? prev.query : ''
                                        }));
                                      }}
                                      style={{
                                        width: '100%',
                                        padding: '8px 10px',
                                        borderRadius: 8,
                                        border: `1px solid ${colors.border}`,
                                        background: colors.background,
                                        color: colors.text,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        fontWeight: 600,
                                        textAlign: 'left'
                                      }}
                                      title="Buscar y seleccionar producto (solo Font Honrada)"
                                    >
                                      {product ? 'Cambiar producto…' : 'Seleccionar producto…'}
                                    </motion.button>

                                    {productPicker.normKey === normalizeText(rawName) && (
                                      <div style={{
                                        marginTop: 8,
                                        padding: 10,
                                        borderRadius: 10,
                                        border: `1px solid ${colors.border}`,
                                        background: colors.background
                                      }}>
                                        <div style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          padding: '8px 10px',
                                          borderRadius: 10,
                                          border: `1px solid ${colors.border}`,
                                          background: colors.surface
                                        }}>
                                          <Search size={14} color={colors.textSecondary} />
                                          <input
                                            value={productPicker.query}
                                            onChange={(e) => setProductPicker((p) => ({ ...p, query: e.target.value }))}
                                            placeholder="Buscar producto…"
                                            style={{
                                              width: '100%',
                                              border: 'none',
                                              outline: 'none',
                                              background: 'transparent',
                                              color: colors.text,
                                              fontSize: 12
                                            }}
                                            autoFocus
                                          />
                                        </div>

                                        <div style={{ marginTop: 8, maxHeight: 220, overflowY: 'auto' }}>
                                          {(() => {
                                            const term = normalizeText(productPicker.query);
                                            const base = allowedProducts;
                                            const ranked = (term
                                              ? base
                                                .filter((p) => normalizeText(getProductName(p)).includes(term))
                                                .slice(0, 30)
                                              : base.slice(0, 30)
                                            ).map((p) => {
                                              const pid = getProductIdCandidates(p)[0];
                                              const name = getProductName(p);
                                              const score = similarityScore(rawName, name);
                                              return { pid, name, score };
                                            }).sort((a, b) => (b.score - a.score));

                                            const top = ranked.slice(0, 12);
                                            if (top.length === 0) {
                                              return (
                                                <div style={{ fontSize: 12, color: colors.textSecondary, padding: 8 }}>
                                                  No hay resultados.
                                                </div>
                                              );
                                            }
                                            return (
                                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                {top.map((opt) => (
                                                  <motion.button
                                                    key={opt.pid}
                                                    whileHover={{ scale: 1.01 }}
                                                    whileTap={{ scale: 0.99 }}
                                                    onClick={() => onPickProduct(opt.pid)}
                                                    style={{
                                                      textAlign: 'left',
                                                      padding: '8px 10px',
                                                      borderRadius: 10,
                                                      border: `1px solid ${colors.border}`,
                                                      background: colors.surface,
                                                      color: colors.text,
                                                      cursor: 'pointer',
                                                      display: 'flex',
                                                      justifyContent: 'space-between',
                                                      gap: 10,
                                                      alignItems: 'center'
                                                    }}
                                                    title={opt.pid}
                                                  >
                                                    <span style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                      {opt.name}
                                                    </span>
                                                    <span style={{
                                                      fontSize: 11,
                                                      color: opt.score >= 0.92 ? colors.primary : colors.textSecondary,
                                                      fontWeight: 800,
                                                      whiteSpace: 'nowrap'
                                                    }}>
                                                      {opt.score >= 0.92 ? '✓' : ''}{opt.score.toFixed(2)}
                                                    </span>
                                                  </motion.button>
                                                ))}
                                              </div>
                                            );
                                          })()}
                                        </div>

                                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                                          <button
                                            type="button"
                                            onClick={() => setProductPicker({ normKey: null, query: '' })}
                                            style={{
                                              padding: '6px 10px',
                                              borderRadius: 8,
                                              border: `1px solid ${colors.border}`,
                                              background: colors.surface,
                                              color: colors.textSecondary,
                                              cursor: 'pointer',
                                              fontSize: 11,
                                              fontWeight: 700
                                            }}
                                          >
                                            Cerrar
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>

                                  {product && link?.method === 'alias' ? (
                                    <div style={{ marginTop: 8 }}>
                                      <button
                                        type="button"
                                        onClick={onClear}
                                        style={{
                                          padding: '6px 10px',
                                          borderRadius: 8,
                                          border: `1px solid ${colors.border}`,
                                          background: colors.background,
                                          color: colors.textSecondary,
                                          cursor: 'pointer',
                                          fontSize: 11
                                        }}
                                      >
                                        Quitar enlace manual
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          );
                        })()}
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
