import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, ChevronUp, Calendar, User, Package } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import ProductoItem from './ProductoItem';

const HojaRutaProductosCard = ({ hojaRuta, onProductoUpdate }) => {
    const { colors } = useTheme();
    const [expanded, setExpanded] = useState(false);

    // Calculate summary
    const summary = {
        total: hojaRuta.productos.length,
        pendientes: hojaRuta.productos.filter(p => p.estado === 'pendiente').length,
        disponibles: hojaRuta.productos.filter(p => p.estado === 'disponible').length,
        noDisponibles: hojaRuta.productos.filter(p => p.estado === 'no_disponible').length,
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Sin fecha';
        const date = new Date(dateStr);
        return date.toLocaleDateString('es-ES', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                overflow: 'hidden',
            }}
        >
            {/* Header */}
            <div
                onClick={() => setExpanded(!expanded)}
                style={{
                    padding: '20px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    transition: 'background-color 0.2s',
                    backgroundColor: expanded ? colors.surface : 'transparent',
                }}
                onMouseEnter={(e) => {
                    if (!expanded) e.currentTarget.style.backgroundColor = colors.surface;
                }}
                onMouseLeave={(e) => {
                    if (!expanded) e.currentTarget.style.backgroundColor = 'transparent';
                }}
            >
                {/* Main Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{
                        fontSize: '18px',
                        fontWeight: '600',
                        color: colors.text,
                        margin: '0 0 8px 0',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                    }}>
                        {hojaRuta.cliente}
                    </h3>

                    <div style={{
                        display: 'flex',
                        gap: '16px',
                        flexWrap: 'wrap',
                        fontSize: '13px',
                        color: colors.textSecondary,
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calendar size={14} />
                            {formatDate(hojaRuta.fechaServicio)}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Package size={14} />
                            {summary.total} productos
                        </div>
                    </div>
                </div>

                {/* Summary Badges */}
                <div style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                }}>
                    {summary.disponibles > 0 && (
                        <div style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: '#10B98115',
                            color: '#10B981',
                            fontSize: '12px',
                            fontWeight: '600',
                        }}>
                            {summary.disponibles} disponibles
                        </div>
                    )}
                    {summary.pendientes > 0 && (
                        <div style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: '#F59E0B15',
                            color: '#F59E0B',
                            fontSize: '12px',
                            fontWeight: '600',
                        }}>
                            {summary.pendientes} pendientes
                        </div>
                    )}
                    {summary.noDisponibles > 0 && (
                        <div style={{
                            padding: '4px 10px',
                            borderRadius: '12px',
                            backgroundColor: '#EF444415',
                            color: '#EF4444',
                            fontSize: '12px',
                            fontWeight: '600',
                        }}>
                            {summary.noDisponibles} no disponibles
                        </div>
                    )}
                </div>

                {/* Expand Icon */}
                <div style={{
                    color: colors.textSecondary,
                    transition: 'transform 0.2s',
                    transform: expanded ? 'rotate(0deg)' : 'rotate(0deg)',
                }}>
                    {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {/* Products List */}
            <AnimatePresence>
                {expanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                            overflow: 'hidden',
                        }}
                    >
                        <div style={{
                            padding: '0 20px 20px 20px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                        }}>
                            {hojaRuta.productos.map((producto) => (
                                <ProductoItem
                                    key={producto.id}
                                    producto={producto}
                                    onEstadoChange={(nuevoEstado) =>
                                        onProductoUpdate(hojaRuta.hojaRutaId, producto.id, nuevoEstado)
                                    }
                                />
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

export default HojaRutaProductosCard;
