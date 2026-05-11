import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from './ThemeContext';
import { useCurrency } from './CurrencyContext';
import { useAuth } from './AuthContext';
import holdedApi from '../services/holdedApi';
import ProductFormModal from './ProductFormModal';
import { Package, RefreshCw, ChevronDown, ChevronUp, Plus, Edit, Trash2, Loader2 } from 'lucide-react';

const InventoryPage = () => {
  const { formatCurrency } = useCurrency();
  const { user } = useAuth();
  const { colors } = useTheme();
  
  const [loading, setLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Cargando productos...');
  const [error, setError] = useState('');
  
  // Estados para datos
  const [products, setProducts] = useState({
    solucions: [],
    menjar: []
  });

  const [warehouses, setWarehouses] = useState({
    solucions: [],
    menjar: []
  });
  const [selectedWarehouseId, setSelectedWarehouseId] = useState('all'); // 'all' = stock general (tal cual viene en /products)
  // Con almacén seleccionado, mostramos siempre SOLO productos de ese almacén (patrón "canales" de Análisis)
  const onlyWarehouseProducts = true;
  const [warehouseStock, setWarehouseStock] = useState({
    solucions: {}, // { [warehouseId]: { [productId]: stockNumber } }
    menjar: {}
  });
  
  const [selectedCompany, setSelectedCompany] = useState('solucions');
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [isChangingCompany, setIsChangingCompany] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pageSize, setPageSize] = useState(50);
  const [page, setPage] = useState(1);
  
  // Estados para el modal y CRUD
  const [showProductModal, setShowProductModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);

  // Columnas de la tabla
  const columns = [
    { key: 'name', label: 'Nombre', sortable: true },
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'barcode', label: 'Código de barras', sortable: true },
    { key: 'desc', label: 'Descripción', sortable: false },
    { key: 'price', label: 'Precio', sortable: true },
    { key: 'cost', label: 'Coste', sortable: true },
    { key: 'purchasePrice', label: 'Precio compra', sortable: true },
    { key: 'stock', label: 'Stock', sortable: true },
    { key: 'weight', label: 'Peso', sortable: true },
    { key: 'tax', label: 'IVA %', sortable: true },
    { key: 'tags', label: 'Tags', sortable: false },
    { key: 'kind', label: 'Tipo', sortable: true }
  ];

  // Cargar productos desde Holded
  const loadProducts = async () => {
    setLoading(true);
    setError('');
    
    try {
      setLoadingMessage('Cargando productos de Solucions Socials...');
      const solucionsProducts = await holdedApi.getAllProducts('solucions');
      
      setLoadingMessage('Cargando productos de Menjar D\'Hort...');
      const menjarProducts = await holdedApi.getAllProducts('menjar');
      
      setProducts({
        solucions: Array.isArray(solucionsProducts) ? solucionsProducts : [],
        menjar: Array.isArray(menjarProducts) ? menjarProducts : []
      });

      // Cargar almacenes (para poder diferenciar inventarios/almacenes dentro de Holded)
      try {
        setLoadingMessage('Cargando almacenes de Holded...');
        const [solWarehouses, menjarWarehouses] = await Promise.all([
          holdedApi.getWarehouses('solucions').catch(() => []),
          holdedApi.getWarehouses('menjar').catch(() => [])
        ]);
        setWarehouses({
          solucions: Array.isArray(solWarehouses) ? solWarehouses : [],
          menjar: Array.isArray(menjarWarehouses) ? menjarWarehouses : []
        });
      } catch {
        // Si falla, no bloqueamos la pantalla de inventario
      }
      
    } catch (err) {
      console.error('Error cargando productos:', err);
      setError(err.message || 'Error al cargar productos desde Holded');
    } finally {
      setLoading(false);
      setLoadingMessage('Cargando productos...');
    }
  };

  // Cargar productos al montar el componente
  useEffect(() => {
    loadProducts();
  }, []);

  // Función para cambiar de empresa
  const handleCompanyChange = (newCompany) => {
    if (newCompany !== selectedCompany) {
      setIsChangingCompany(true);
      setTimeout(() => {
        setSelectedCompany(newCompany);
        setSearchTerm('');
        setSelectedWarehouseId('all');
        setPage(1);
        setIsChangingCompany(false);
      }, 150);
    }
  };

  const handleWarehouseChange = (warehouseId) => {
    const next = warehouseId || 'all';
    if (next !== selectedWarehouseId) {
      setSelectedWarehouseId(next);
      setPage(1);
    }
  };

  const getProductIdCandidates = (p) => {
    const candidates = [
      p?.id,
      p?._id,
      p?.productId,
      p?.productID,
      p?.itemId,
      p?.itemID
    ]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    // De-dup preservando orden
    return [...new Set(candidates)];
  };

  const ensureWarehouseStockLoaded = async (company, warehouseId) => {
    if (!warehouseId || warehouseId === 'all') return;
    if (warehouseStock?.[company]?.[warehouseId]) return;

    setLoading(true);
    setError('');
    try {
      setLoadingMessage('Cargando stock del almacén...');
      const res = await holdedApi.getWarehouseStock(warehouseId, company);
      const list = res?.warehouse?.products;
      const map = {};
      if (Array.isArray(list)) {
        for (const row of list) {
          // IMPORTANTE: Holded devuelve un id propio de la fila de stock (_id)
          // y el id del producto real (product_id). Para cruzar con /products necesitamos product_id.
          const id = String(row?.product_id || row?._id || '').trim();
          if (!id) continue;
          map[id] = typeof row?.stock === 'number' ? row.stock : Number(row?.stock || 0);
        }
      }
      setWarehouseStock((prev) => ({
        ...prev,
        [company]: {
          ...(prev?.[company] || {}),
          [warehouseId]: map
        }
      }));
    } catch (err) {
      console.error('Error cargando stock por almacén:', err);
      setError(err?.message || 'Error al cargar stock por almacén');
    } finally {
      setLoading(false);
      setLoadingMessage('Cargando productos...');
    }
  };

  useEffect(() => {
    if (selectedWarehouseId && selectedWarehouseId !== 'all') {
      ensureWarehouseStockLoaded(selectedCompany, selectedWarehouseId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCompany, selectedWarehouseId]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, selectedCompany, selectedWarehouseId, pageSize]);

  // Función para ordenar
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
    setPage(1);
  };

  // Datos filtrados y ordenados
  const filteredAndSortedProducts = useMemo(() => {
    let data = products[selectedCompany] || [];

    // Si hay almacén seleccionado, sustituimos el "stock" por el stock de ese almacén
    if (selectedWarehouseId && selectedWarehouseId !== 'all') {
      const map = warehouseStock?.[selectedCompany]?.[selectedWarehouseId] || {};
      const mapKeys = Object.keys(map);
      const mapKeySet = new Set(mapKeys);

      data = data.map((p) => {
        const ids = getProductIdCandidates(p);
        const matchedId = ids.find((id) => mapKeySet.has(id));
        const stock = matchedId ? (map[matchedId] ?? 0) : 0;
        const inWarehouse = !!matchedId;

        return { ...p, stock, __inWarehouse: inWarehouse, __warehouseProductId: matchedId || null };
      });

      if (onlyWarehouseProducts) {
        data = data.filter((p) => p.__inWarehouse);
      }
    }
    
    // Filtrar por búsqueda
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      data = data.filter(product => {
        const name = (product.name || '').toLowerCase();
        const sku = (product.sku || '').toLowerCase();
        const barcode = (product.barcode || '').toLowerCase();
        const desc = (product.desc || '').toLowerCase();
        return name.includes(term) || sku.includes(term) || barcode.includes(term) || desc.includes(term);
      });
    }
    
    // Ordenar
    if (sortConfig.key) {
      data = [...data].sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        // Si son números
        if (typeof aVal === 'number' && typeof bVal === 'number') {
          return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }
        
        // Si son strings
        const aStr = String(aVal).toLowerCase();
        const bStr = String(bVal).toLowerCase();
        return sortConfig.direction === 'asc' 
          ? aStr.localeCompare(bStr)
          : bStr.localeCompare(aStr);
      });
    }
    
    return data;
  }, [products, selectedCompany, searchTerm, sortConfig, selectedWarehouseId, warehouseStock, onlyWarehouseProducts]);

  const totalPages = useMemo(() => {
    const total = filteredAndSortedProducts.length || 0;
    return Math.max(1, Math.ceil(total / pageSize));
  }, [filteredAndSortedProducts.length, pageSize]);

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAndSortedProducts.slice(start, start + pageSize);
  }, [filteredAndSortedProducts, page, pageSize]);

  // Componente de header ordenable
  const SortableHeader = ({ label, sortKey, currentSortKey, currentDirection, onSort }) => {
    const isActive = currentSortKey === sortKey;
    return (
      <th
        onClick={() => onSort(sortKey)}
        style={{
          borderBottom: `1px solid ${colors.border}`,
          padding: '12px 8px',
          textAlign: 'left',
          color: colors.primary,
          fontWeight: 600,
          background: colors.surface,
          cursor: 'pointer',
          userSelect: 'none',
          position: 'relative'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {label}
          {isActive && (
            currentDirection === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
          )}
        </div>
      </th>
    );
  };

  // Función para formatear tags
  const formatTags = (tags) => {
    if (!tags || !Array.isArray(tags) || tags.length === 0) return '-';
    return tags.join(', ');
  };

  // Función para formatear tipo
  const formatKind = (kind) => {
    if (!kind) return 'Simple';
    const kindMap = {
      'simple': 'Simple',
      'variants': 'Variantes',
      'lots': 'Lotes',
      'pack': 'Pack'
    };
    return kindMap[kind] || kind;
  };

  // Funciones CRUD
  const handleCreateProduct = () => {
    setSelectedProduct(null);
    setShowProductModal(true);
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setShowProductModal(true);
  };

  const handleDeleteProduct = async (product) => {
    if (!window.confirm(`¿Estás seguro de que quieres eliminar el producto "${product.name || product.id}"?`)) {
      return;
    }

    const productId = getProductIdCandidates(product)[0];
    setDeletingProduct(productId);
    try {
      await holdedApi.deleteProduct(productId, selectedCompany);
      // Recargar productos
      await loadProducts();
    } catch (err) {
      console.error('Error eliminando producto:', err);
      alert(`Error al eliminar el producto: ${err.message || 'Error desconocido'}`);
    } finally {
      setDeletingProduct(null);
    }
  };

  const handleSaveProduct = async (productData, productId) => {
    if (productId) {
      // Actualizar producto existente
      await holdedApi.updateProduct(productId, productData, selectedCompany);
    } else {
      // Crear nuevo producto
      await holdedApi.createProduct(productData, selectedCompany);
    }
    // Recargar productos
    await loadProducts();
  };

  const handleCloseModal = () => {
    setShowProductModal(false);
    setSelectedProduct(null);
  };

  return (
    <div style={{
      padding: '32px',
      maxWidth: '1600px',
      margin: '0 auto',
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
            <Package size={32} color={colors.primary} />
            <div>
              <h1 style={{ fontSize: '28px', fontWeight: '700', margin: 0, color: colors.text }}>
                Inventario de Holded
              </h1>
              <p style={{ fontSize: '14px', color: colors.textSecondary, margin: '4px 0 0 0' }}>
                Gestión de productos e inventario desde Holded
              </p>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={loadProducts}
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
            {loading ? loadingMessage : 'Recargar productos'}
          </motion.button>
        </div>
      </motion.div>

      {/* Tarjetas de selección de empresa */}
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
          Seleccionar Empresa
        </h3>
        <div style={{
          display: 'flex',
          gap: '18px',
          flexWrap: 'wrap',
        }}>
          {[
            { id: 'solucions', name: 'Solucions Socials' },
            { id: 'menjar', name: 'Menjar D\'Hort' }
          ].map((company) => (
            <motion.div
              key={company.id}
              whileHover={{ scale: 1.04, boxShadow: selectedCompany === company.id ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleCompanyChange(company.id)}
              style={{
                minWidth: 200,
                flex: '1 1 200px',
                background: colors.card,
                borderRadius: 12,
                boxShadow: selectedCompany === company.id ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
                border: selectedCompany === company.id ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
                color: selectedCompany === company.id ? colors.primary : colors.text,
                cursor: isChangingCompany ? 'not-allowed' : 'pointer',
                padding: '22px 18px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'center',
                transition: 'all 0.18s',
                fontWeight: selectedCompany === company.id ? 600 : 400,
                fontSize: 16,
                outline: selectedCompany === company.id ? `2px solid ${colors.primary}` : 'none',
                position: 'relative',
                opacity: isChangingCompany ? 0.6 : 1
              }}
            >
              <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                {company.name}
              </span>
              <span style={{ 
                fontSize: 13, 
                color: selectedCompany === company.id ? colors.primary : colors.textSecondary, 
                marginTop: 2 
              }}>
                {products[company.id]?.length > 0 ? `${products[company.id].length} productos` : 'No hay productos cargados'}
              </span>
            </motion.div>
          ))}
        </div>
      </motion.div>

      {/* Tarjetas de selección de almacén */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{ marginBottom: '22px' }}
      >
        <h3 style={{
          margin: '0 0 20px 0',
          color: colors.text,
          fontSize: '20px',
          fontWeight: '600'
        }}>
          Seleccionar Almacén
        </h3>

        <div style={{
          display: 'flex',
          gap: '18px',
          flexWrap: 'wrap',
        }}>
          {/* "Todos" */}
          <motion.div
            key="wh-all"
            whileHover={{ scale: 1.04, boxShadow: selectedWarehouseId === 'all' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
            whileTap={{ scale: 0.98 }}
            onClick={() => handleWarehouseChange('all')}
            style={{
              minWidth: 220,
              flex: '1 1 220px',
              background: colors.card,
              borderRadius: 12,
              boxShadow: selectedWarehouseId === 'all' ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
              border: selectedWarehouseId === 'all' ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
              color: selectedWarehouseId === 'all' ? colors.primary : colors.text,
              cursor: 'pointer',
              padding: '22px 18px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              justifyContent: 'center',
              transition: 'all 0.18s',
              fontWeight: selectedWarehouseId === 'all' ? 600 : 400,
              fontSize: 16,
              outline: selectedWarehouseId === 'all' ? `2px solid ${colors.primary}` : 'none',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
              Todos (stock general)
            </span>
            <span style={{
              fontSize: 13,
              color: selectedWarehouseId === 'all' ? colors.primary : colors.textSecondary,
              marginTop: 2
            }}>
              {products[selectedCompany]?.length > 0 ? `${products[selectedCompany].length} productos` : 'No hay productos cargados'}
            </span>
          </motion.div>

          {(warehouses[selectedCompany] || []).map((w) => {
            const isActive = selectedWarehouseId === w.id;
            const stockCount = Object.keys(warehouseStock?.[selectedCompany]?.[w.id] || {}).length;
            const hasStockLoaded = !!warehouseStock?.[selectedCompany]?.[w.id];
            return (
              <motion.div
                key={w.id}
                whileHover={{ scale: 1.04, boxShadow: isActive ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 ${colors.primary}22` }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleWarehouseChange(w.id)}
                style={{
                  minWidth: 220,
                  flex: '1 1 220px',
                  background: colors.card,
                  borderRadius: 12,
                  boxShadow: isActive ? `0 4px 16px 0 ${colors.primary}33` : `0 2px 8px 0 rgba(0,0,0,0.04)`,
                  border: isActive ? `2.5px solid ${colors.primary}` : `1.5px solid ${colors.border}`,
                  color: isActive ? colors.primary : colors.text,
                  cursor: 'pointer',
                  padding: '22px 18px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  justifyContent: 'center',
                  transition: 'all 0.18s',
                  fontWeight: isActive ? 600 : 400,
                  fontSize: 16,
                  outline: isActive ? `2px solid ${colors.primary}` : 'none',
                  position: 'relative',
                }}
              >
                {/* Indicador de carga (cuando es el activo y está cargando stock) */}
                <AnimatePresence>
                  {loading && isActive && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      style={{
                        position: 'absolute',
                        top: '50%',
                        right: '18px',
                        transform: 'translateY(-50%)',
                        zIndex: 10
                      }}
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}
                        style={{
                          width: '16px',
                          height: '16px',
                          border: `2px solid ${colors.border}`,
                          borderTop: `2px solid ${colors.primary}`,
                          borderRadius: '50%'
                        }}
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                <span style={{ fontSize: 17, fontWeight: 600, marginBottom: 6 }}>
                  {w.name || w.id}
                </span>
                <span style={{
                  fontSize: 13,
                  color: isActive ? colors.primary : colors.textSecondary,
                  marginTop: 2
                }}>
                  {hasStockLoaded ? `${stockCount} productos en almacén` : 'Click para cargar stock'}
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      {/* Mensaje de error */}
      {error && (
        <div style={{
          padding: '16px',
          borderRadius: '8px',
          background: `${colors.error}15`,
          border: `1px solid ${colors.error}33`,
          color: colors.error,
          marginBottom: '24px'
        }}>
          {error}
        </div>
      )}

      {/* Búsqueda y botón crear */}
      <div style={{ 
        display: 'flex', 
        gap: '12px', 
        marginBottom: '24px',
        alignItems: 'center'
      }}>
        <input
          type="text"
          placeholder="Buscar por nombre, SKU, código de barras o descripción..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={{
            flex: 1,
            padding: '12px 16px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: colors.text,
            fontSize: '14px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = colors.primary}
          onBlur={(e) => e.target.style.borderColor = colors.border}
        />

        {/* Tamaño de página (performance) */}
        <select
          value={pageSize}
          onChange={(e) => setPageSize(Number(e.target.value))}
          style={{
            width: 160,
            padding: '12px 12px',
            borderRadius: '8px',
            border: `1px solid ${colors.border}`,
            background: colors.card,
            color: colors.text,
            fontSize: '14px',
            outline: 'none',
            cursor: 'pointer'
          }}
          title="Filas por página"
        >
          <option value={25}>25 / pág</option>
          <option value={50}>50 / pág</option>
          <option value={100}>100 / pág</option>
          <option value={200}>200 / pág</option>
        </select>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleCreateProduct}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 20px',
            backgroundColor: colors.primary,
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '600',
          }}
        >
          <Plus size={16} />
          Nuevo Producto
        </motion.button>
      </div>

      {/* Tabla de productos */}
      <AnimatePresence mode="wait">
        {isChangingCompany ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '60px',
              color: colors.textSecondary
            }}
          >
            <Loader2 size={32} style={{ animation: 'spin 1s linear infinite' }} />
          </motion.div>
        ) : (
          <motion.div
            key={selectedCompany}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              background: colors.card,
              borderRadius: '12px',
              overflow: 'hidden',
              border: `1px solid ${colors.border}`
            }}
          >
            {/* Barra de estado/paginación */}
            <div
              style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.border}`,
                background: colors.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                flexWrap: 'wrap'
              }}
            >
              <div style={{ color: colors.textSecondary, fontSize: 13 }}>
                Mostrando <b style={{ color: colors.text }}>{pagedProducts.length}</b> de{' '}
                <b style={{ color: colors.text }}>{filteredAndSortedProducts.length}</b> (total empresa:{' '}
                {products[selectedCompany]?.length || 0})
                {selectedWarehouseId !== 'all' ? (
                  <>
                    {' '}· Almacén:{' '}
                    <b style={{ color: colors.text }}>
                      {(warehouses[selectedCompany] || []).find(w => w.id === selectedWarehouseId)?.name || selectedWarehouseId}
                    </b>
                    {' '}· Stock cargado:{' '}
                    <b style={{ color: colors.text }}>
                      {Object.keys(warehouseStock?.[selectedCompany]?.[selectedWarehouseId] || {}).length}
                    </b>
                  </>
                ) : null}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: colors.text,
                    cursor: page <= 1 ? 'not-allowed' : 'pointer',
                    opacity: page <= 1 ? 0.6 : 1
                  }}
                >
                  Anterior
                </motion.button>

                <div style={{ color: colors.textSecondary, fontSize: 13 }}>
                  Página <b style={{ color: colors.text }}>{page}</b> / <b style={{ color: colors.text }}>{totalPages}</b>
                </div>

                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  style={{
                    padding: '8px 12px',
                    borderRadius: 8,
                    border: `1px solid ${colors.border}`,
                    background: colors.card,
                    color: colors.text,
                    cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: page >= totalPages ? 0.6 : 1
                  }}
                >
                  Siguiente
                </motion.button>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{
                width: '100%',
                borderCollapse: 'collapse',
                minWidth: '800px'
              }}>
                <thead>
                  <tr>
                    {columns.map(col => (
                      col.sortable ? (
                        <SortableHeader
                          key={col.key}
                          label={col.label}
                          sortKey={col.key}
                          currentSortKey={sortConfig.key}
                          currentDirection={sortConfig.direction}
                          onSort={handleSort}
                        />
                      ) : (
                        <th
                          key={col.key}
                          style={{
                            borderBottom: `1px solid ${colors.border}`,
                            padding: '12px 8px',
                            textAlign: 'left',
                            color: colors.primary,
                            fontWeight: 600,
                            background: colors.surface
                          }}
                        >
                          {col.label}
                        </th>
                      )
                    ))}
                    <th
                      style={{
                        borderBottom: `1px solid ${colors.border}`,
                        padding: '12px 8px',
                        textAlign: 'center',
                        color: colors.primary,
                        fontWeight: 600,
                        background: colors.surface,
                        width: '120px'
                      }}
                    >
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAndSortedProducts.length === 0 ? (
                      <tr>
                      <td
                        colSpan={columns.length + 1}
                        style={{
                          padding: '40px',
                          textAlign: 'center',
                          color: colors.textSecondary
                        }}
                      >
                        {loading ? 'Cargando productos...' : 'No se encontraron productos'}
                      </td>
                    </tr>
                  ) : (
                    pagedProducts.map((product, index) => (
                      <tr
                        key={getProductIdCandidates(product)[0] || index}
                        style={{
                          background: index % 2 === 0 ? colors.card : colors.surface,
                          transition: 'background 0.2s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = colors.surface}
                        onMouseLeave={(e) => e.currentTarget.style.background = index % 2 === 0 ? colors.card : colors.surface}
                      >
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.name || '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.sku || '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.barcode || '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}`, maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {product.desc || '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.price !== undefined && product.price !== null ? formatCurrency(product.price) : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.cost !== undefined && product.cost !== null ? formatCurrency(product.cost) : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.purchasePrice !== undefined && product.purchasePrice !== null ? formatCurrency(product.purchasePrice) : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.stock !== undefined && product.stock !== null ? product.stock : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.weight !== undefined && product.weight !== null ? `${product.weight} kg` : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {product.tax !== undefined && product.tax !== null ? `${product.tax}%` : '-'}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {formatTags(product.tags)}
                        </td>
                        <td style={{ padding: '12px 8px', borderBottom: `1px solid ${colors.border}` }}>
                          {formatKind(product.kind)}
                        </td>
                        <td style={{ 
                          padding: '12px 8px', 
                          borderBottom: `1px solid ${colors.border}`,
                          textAlign: 'center'
                        }}>
                          <div style={{ 
                            display: 'flex', 
                            gap: '8px', 
                            justifyContent: 'center',
                            alignItems: 'center'
                          }}>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleEditProduct(product)}
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: `1px solid ${colors.border}`,
                                backgroundColor: colors.surface,
                                color: colors.primary,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                              title="Editar producto"
                            >
                              <Edit size={16} />
                            </motion.button>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              onClick={() => handleDeleteProduct(product)}
                              disabled={deletingProduct === getProductIdCandidates(product)[0]}
                              style={{
                                padding: '6px',
                                borderRadius: '6px',
                                border: `1px solid ${colors.error}`,
                                backgroundColor: deletingProduct === getProductIdCandidates(product)[0] ? colors.surface : 'transparent',
                                color: colors.error,
                                cursor: deletingProduct === getProductIdCandidates(product)[0] ? 'not-allowed' : 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                opacity: deletingProduct === product.id ? 0.6 : 1
                              }}
                              title="Eliminar producto"
                            >
                              <Trash2 size={16} />
                            </motion.button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Resumen */}
      {!loading && filteredAndSortedProducts.length > 0 && (
        <div style={{
          marginTop: '24px',
          padding: '16px',
          background: colors.surface,
          borderRadius: '8px',
          border: `1px solid ${colors.border}`,
          fontSize: '14px',
          color: colors.textSecondary
        }}>
          Mostrando {filteredAndSortedProducts.length} de {products[selectedCompany]?.length || 0} productos
        </div>
      )}

      {/* Modal de producto */}
      <ProductFormModal
        isOpen={showProductModal}
        onClose={handleCloseModal}
        product={selectedProduct}
        onSave={handleSaveProduct}
        company={selectedCompany}
      />
    </div>
  );
};

export default InventoryPage;

