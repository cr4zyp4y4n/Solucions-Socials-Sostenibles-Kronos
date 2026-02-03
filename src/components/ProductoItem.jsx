import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Clock } from 'feather-icons-react';
import { useTheme } from './ThemeContext';

const ProductoItem = ({ producto, onEstadoChange }) => {
    const { colors } = useTheme();

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

    const getEstadoIcon = (estado) => {
        switch (estado) {
            case 'disponible':
                return <Check size={16} />;
            case 'no_disponible':
                return <X size={16} />;
            case 'pendiente':
            default:
                return <Clock size={16} />;
        }
    };

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

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                padding: '16px',
                backgroundColor: colors.surface,
                borderRadius: '8px',
                border: `1px solid ${colors.border}`,
            }}
        >
            {/* Product Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.text,
                    marginBottom: '4px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                }}>
                    {producto.producto}
                </div>
                <div style={{
                    fontSize: '12px',
                    color: colors.textSecondary,
                    display: 'flex',
                    gap: '12px',
                    flexWrap: 'wrap',
                }}>
                    {producto.cantidad && (
                        <span>
                            <strong>Cantidad:</strong> {producto.cantidad}
                        </span>
                    )}
                    <span>
                        <strong>Proveedor:</strong> {producto.proveedor}
                    </span>
                </div>
            </div>

            {/* Estado Badge */}
            <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                backgroundColor: `${getEstadoColor(producto.estado)}15`,
                color: getEstadoColor(producto.estado),
                fontSize: '12px',
                fontWeight: '600',
                whiteSpace: 'nowrap',
            }}>
                {getEstadoIcon(producto.estado)}
                {getEstadoLabel(producto.estado)}
            </div>

            {/* Action Buttons */}
            <div style={{
                display: 'flex',
                gap: '8px',
                flexShrink: 0,
            }}>
                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onEstadoChange('disponible')}
                    disabled={producto.estado === 'disponible'}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: producto.estado === 'disponible' ? '#10B981' : colors.background,
                        border: `1px solid ${producto.estado === 'disponible' ? '#10B981' : colors.border}`,
                        borderRadius: '6px',
                        color: producto.estado === 'disponible' ? 'white' : colors.text,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: producto.estado === 'disponible' ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: producto.estado === 'disponible' ? 1 : 0.8,
                    }}
                >
                    <Check size={14} />
                    Disponible
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onEstadoChange('pendiente')}
                    disabled={producto.estado === 'pendiente'}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: producto.estado === 'pendiente' ? '#F59E0B' : colors.background,
                        border: `1px solid ${producto.estado === 'pendiente' ? '#F59E0B' : colors.border}`,
                        borderRadius: '6px',
                        color: producto.estado === 'pendiente' ? 'white' : colors.text,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: producto.estado === 'pendiente' ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: producto.estado === 'pendiente' ? 1 : 0.8,
                    }}
                >
                    <Clock size={14} />
                    Pendiente
                </motion.button>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onEstadoChange('no_disponible')}
                    disabled={producto.estado === 'no_disponible'}
                    style={{
                        padding: '8px 12px',
                        backgroundColor: producto.estado === 'no_disponible' ? '#EF4444' : colors.background,
                        border: `1px solid ${producto.estado === 'no_disponible' ? '#EF4444' : colors.border}`,
                        borderRadius: '6px',
                        color: producto.estado === 'no_disponible' ? 'white' : colors.text,
                        fontSize: '12px',
                        fontWeight: '500',
                        cursor: producto.estado === 'no_disponible' ? 'default' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        opacity: producto.estado === 'no_disponible' ? 1 : 0.8,
                    }}
                >
                    <X size={14} />
                    No Disponible
                </motion.button>
            </div>
        </motion.div>
    );
};

export default ProductoItem;
