import React from 'react';
import { motion } from 'framer-motion';
import { FileText, DollarSign } from 'feather-icons-react';
import { useTheme } from './ThemeContext';

const HojaTecnicaCard = ({ hoja, onClick }) => {
    const { colors } = useTheme();

    const { resumen_costes, ingredientes = [], alergenos = [] } = hoja;

    return (
        <motion.div
            whileHover={{ scale: 1.02, y: -4 }}
            whileTap={{ scale: 0.98 }}
            onClick={onClick}
            style={{
                backgroundColor: colors.card,
                border: `1px solid ${colors.border}`,
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                transition: 'all 0.2s ease',
            }}
        >
            {/* Image Section */}
            <div style={{
                width: '100%',
                height: '200px',
                borderRadius: '8px',
                overflow: 'hidden',
                backgroundColor: colors.surface,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}>
                {hoja.imagen_url ? (
                    <img
                        src={hoja.imagen_url}
                        alt={hoja.nombre_plato}
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                        }}
                        onError={(e) => {
                            console.error('Error loading image:', hoja.imagen_url);
                            e.target.style.display = 'none';
                        }}
                    />
                ) : (
                    <FileText size={48} color={colors.textSecondary} />
                )}
            </div>

            {/* Dish Name */}
            <h3 style={{
                fontSize: '18px',
                fontWeight: '600',
                color: colors.text,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
            }}>
                {hoja.nombre_plato}
            </h3>

            {/* Summary Info */}
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
            }}>
                {/* Ingredients Count */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: colors.textSecondary,
                }}>
                    <div style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: colors.primary,
                    }} />
                    {ingredientes.length} ingrediente{ingredientes.length !== 1 ? 's' : ''}
                </div>

                {/* Allergens Count */}
                {alergenos.length > 0 && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        fontSize: '13px',
                        color: colors.textSecondary,
                    }}>
                        <div style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            backgroundColor: '#f59e0b',
                        }} />
                        {alergenos.length} alérgeno{alergenos.length !== 1 ? 's' : ''}
                    </div>
                )}

                {/* Total Cost */}
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: colors.primary,
                    marginTop: '4px',
                }}>
                    <DollarSign size={16} />
                    {resumen_costes?.coste_total?.toFixed(2) || '0.00'}€
                </div>
            </div>
        </motion.div>
    );
};

export default HojaTecnicaCard;
