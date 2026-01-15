import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Download, Upload } from 'feather-icons-react';
import { useTheme } from './ThemeContext';

const HojasTecnicasSection = () => {
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
                        Hojas Técnicas
                    </h2>
                    <p style={{
                        fontSize: '14px',
                        color: colors.textSecondary,
                        margin: 0,
                    }}>
                        Gestiona las hojas técnicas de los productos
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
                        <Upload size={16} />
                        Importar
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
                        <Plus size={16} />
                        Nueva Hoja Técnica
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
                    placeholder="Buscar hojas técnicas..."
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

            {/* Content Area - Placeholder */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                style={{
                    backgroundColor: colors.card,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '12px',
                    padding: '60px 40px',
                    textAlign: 'center',
                    minHeight: '400px',
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
                    No hay hojas técnicas disponibles
                </h3>

                <p style={{
                    fontSize: '14px',
                    color: colors.textSecondary,
                    margin: 0,
                    maxWidth: '400px',
                }}>
                    Comienza creando una nueva hoja técnica o importa hojas existentes desde un archivo.
                </p>

                <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    style={{
                        marginTop: '16px',
                        padding: '12px 24px',
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
                    <Plus size={18} />
                    Crear Primera Hoja Técnica
                </motion.button>
            </motion.div>
        </div>
    );
};

export default HojasTecnicasSection;
