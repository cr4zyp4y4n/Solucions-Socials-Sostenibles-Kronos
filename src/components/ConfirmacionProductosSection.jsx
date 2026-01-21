import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Search, Filter, RefreshCw, FileText } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import productosIdoniService from '../services/productosIdoniService';
import HojaRutaProductosCard from './HojaRutaProductosCard';

const ConfirmacionProductosSection = () => {
    const { colors } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [productosAgrupados, setProductosAgrupados] = useState([]);
    const [filteredProductos, setFilteredProductos] = useState([]);
    const [estadisticas, setEstadisticas] = useState({
        total: 0,
        pendientes: 0,
        disponibles: 0,
        noDisponibles: 0
    });
    const [filtroEstado, setFiltroEstado] = useState('todos'); // todos, pendientes, disponibles, no_disponibles

    // Load products on mount
    useEffect(() => {
        cargarProductos();
    }, []);

    // Filter products when search term or filter changes
    useEffect(() => {
        aplicarFiltros();
    }, [searchTerm, filtroEstado, productosAgrupados]);

    const cargarProductos = () => {
        try {
            const productos = productosIdoniService.getProductosPorHojaRuta();
            const stats = productosIdoniService.getEstadisticas();

            console.log('📦 Productos IDONI/BONCOR cargados:', productos.length, 'hojas de ruta');
            console.log('📊 Estadísticas:', stats);

            setProductosAgrupados(productos);
            setFilteredProductos(productos);
            setEstadisticas(stats);
        } catch (error) {
            console.error('Error cargando productos:', error);
        }
    };

    const aplicarFiltros = () => {
        let filtered = [...productosAgrupados];

        // Apply search filter
        if (searchTerm.trim()) {
            const term = searchTerm.toLowerCase();
            filtered = filtered
                .map(hoja => ({
                    ...hoja,
                    productos: hoja.productos.filter(p =>
                        p.producto.toLowerCase().includes(term) ||
                        p.proveedor.toLowerCase().includes(term) ||
                        hoja.cliente.toLowerCase().includes(term)
                    )
                }))
                .filter(hoja => hoja.productos.length > 0);
        }

        // Apply estado filter
        if (filtroEstado !== 'todos') {
            filtered = filtered
                .map(hoja => ({
                    ...hoja,
                    productos: hoja.productos.filter(p => p.estado === filtroEstado)
                }))
                .filter(hoja => hoja.productos.length > 0);
        }

        setFilteredProductos(filtered);
    };

    const handleProductoUpdate = (hojaRutaId, productoId, nuevoEstado) => {
        const success = productosIdoniService.updateProductoEstado(hojaRutaId, productoId, nuevoEstado);
        if (success) {
            cargarProductos(); // Reload to update stats
        }
    };

    const handleRefresh = () => {
        cargarProductos();
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '24px',
        }}>
            {/* Header Section */}
            <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '16px',
            }}>
                <div>
                    <h2 style={{
                        fontSize: '24px',
                        fontWeight: '700',
                        color: colors.text,
                        margin: '0 0 8px 0',
                    }}>
                        Confirmación Productos IDONI/BONCOR
                    </h2>
                    <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: 0,
                    }}>
                        Revisa y confirma la disponibilidad de productos de proveedores IDONI y BONCOR
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                            const newFilter = filtroEstado === 'todos' ? 'pendientes' :
                                filtroEstado === 'pendientes' ? 'disponibles' :
                                    filtroEstado === 'disponibles' ? 'no_disponible' : 'todos';
                            setFiltroEstado(newFilter);
                        }}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: filtroEstado !== 'todos' ? colors.primary : colors.surface,
                            border: `1px solid ${filtroEstado !== 'todos' ? colors.primary : colors.border}`,
                            borderRadius: '8px',
                            color: filtroEstado !== 'todos' ? 'white' : colors.text,
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <Filter size={16} />
                        {filtroEstado === 'todos' ? 'Todos' :
                            filtroEstado === 'pendientes' ? 'Pendientes' :
                                filtroEstado === 'disponibles' ? 'Disponibles' : 'No Disponibles'}
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleRefresh}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: colors.primary,
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <RefreshCw size={16} />
                        Actualizar
                    </motion.button>
                </div>
            </div>

            {/* Search Bar */}
            {productosAgrupados.length > 0 && (
                <div style={{
                    position: 'relative',
                    maxWidth: '400px',
                }}>
                    <Search
                        size={18}
                        style={{
                            position: 'absolute',
                            left: '14px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: colors.textSecondary,
                        }}
                    />
                    <input
                        type="text"
                        placeholder="Buscar productos, cliente o proveedor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        style={{
                            width: '100%',
                            padding: '12px 14px 12px 44px',
                            backgroundColor: colors.surface,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            color: colors.text,
                            fontSize: '14px',
                            outline: 'none',
                        }}
                    />
                </div>
            )}

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
            }}>
                {[
                    { label: 'Total Productos', value: estadisticas.total, color: colors.primary },
                    { label: 'Pendientes', value: estadisticas.pendientes, color: '#F59E0B' },
                    { label: 'Disponibles', value: estadisticas.disponibles, color: '#10B981' },
                    { label: 'No Disponibles', value: estadisticas.noDisponibles, color: '#EF4444' },
                ].map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        style={{
                            backgroundColor: colors.card,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                        }}
                    >
                        <div style={{
                            fontSize: '13px',
                            color: colors.textSecondary,
                            fontWeight: '500',
                        }}>
                            {stat.label}
                        </div>
                        <div style={{
                            fontSize: '28px',
                            fontWeight: '700',
                            color: stat.color,
                        }}>
                            {stat.value}
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Content Area */}
            {productosAgrupados.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    style={{
                        backgroundColor: colors.card,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '60px 40px',
                        textAlign: 'center',
                        minHeight: '300px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                    }}
                >
                    <div style={{
                        width: '80px',
                        height: '80px',
                        borderRadius: '50%',
                        backgroundColor: `${colors.primary}15`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginBottom: '8px',
                    }}>
                        <FileText size={36} color={colors.primary} />
                    </div>

                    <h3 style={{
                        fontSize: '20px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: 0,
                    }}>
                        No hay productos IDONI/BONCOR
                    </h3>

                    <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: 0,
                        maxWidth: '400px',
                    }}>
                        Sube una hoja de ruta con productos de proveedores IDONI o BONCOR para que aparezcan aquí automáticamente.
                    </p>
                </motion.div>
            ) : filteredProductos.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                        backgroundColor: colors.card,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '60px 40px',
                        textAlign: 'center',
                        minHeight: '200px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                    }}
                >
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: 0,
                    }}>
                        No se encontraron productos
                    </h3>
                    <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: 0,
                    }}>
                        Intenta con otros términos de búsqueda o cambia el filtro
                    </p>
                </motion.div>
            ) : (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                }}>
                    {filteredProductos.map((hoja) => (
                        <HojaRutaProductosCard
                            key={hoja.hojaRutaId}
                            hojaRuta={hoja}
                            onProductoUpdate={handleProductoUpdate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default ConfirmacionProductosSection;

