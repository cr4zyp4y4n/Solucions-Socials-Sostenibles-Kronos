import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, Search, Filter, RefreshCw } from 'feather-icons-react';
import { useTheme } from './ThemeContext';

const ConfirmacionProductosSection = () => {
    const { colors } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');

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
                        Confirmación Productos Tienda
                    </h2>
                    <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: 0,
                    }}>
                        Revisa y confirma los productos pendientes de la tienda
                    </p>
                </div>

                <div style={{
                    display: 'flex',
                    gap: '12px',
                }}>
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        style={{
                            padding: '10px 20px',
                            backgroundColor: colors.surface,
                            border: `1px solid ${colors.border}`,
                            borderRadius: '8px',
                            color: colors.text,
                            fontSize: '14px',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                        }}
                    >
                        <Filter size={16} />
                        Filtrar
                    </motion.button>

                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
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
                    placeholder="Buscar productos..."
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

            {/* Stats Cards */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '16px',
            }}>
                {[
                    { label: 'Pendientes', value: '0', color: '#F59E0B' },
                    { label: 'Confirmados', value: '0', color: '#10B981' },
                    { label: 'Rechazados', value: '0', color: '#EF4444' },
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

            {/* Content Area - Placeholder */}
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
                    <CheckCircle size={36} color={colors.primary} />
                </div>

                <h3 style={{
                    fontSize: '20px',
                    fontWeight: '600',
                    color: colors.text,
                    margin: 0,
                }}>
                    No hay productos pendientes
                </h3>

                <p style={{
                    fontSize: '14px',
                    color: colors.textSecondary,
                    margin: 0,
                    maxWidth: '400px',
                }}>
                    Todos los productos han sido procesados. Los nuevos productos aparecerán aquí automáticamente.
                </p>
            </motion.div>
        </div>
    );
};

export default ConfirmacionProductosSection;
