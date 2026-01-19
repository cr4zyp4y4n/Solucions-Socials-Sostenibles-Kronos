import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, FileText, Upload } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import hojasTecnicasService from '../services/hojasTecnicasService';
import HojaTecnicaCard from './HojaTecnicaCard';
import HojaTecnicaModal from './HojaTecnicaModal';

const HojasTecnicasSection = () => {
    const { colors } = useTheme();
    const [searchTerm, setSearchTerm] = useState('');
    const [hojasTecnicas, setHojasTecnicas] = useState([]);
    const [filteredHojas, setFilteredHojas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [selectedHoja, setSelectedHoja] = useState(null);

    // Load hojas técnicas on mount
    useEffect(() => {
        loadHojasTecnicas();
    }, []);

    // Filter hojas when search term changes
    useEffect(() => {
        if (searchTerm.trim() === '') {
            setFilteredHojas(hojasTecnicas);
        } else {
            const filtered = hojasTecnicas.filter(hoja =>
                hoja.nombre_plato.toLowerCase().includes(searchTerm.toLowerCase())
            );
            setFilteredHojas(filtered);
        }
    }, [searchTerm, hojasTecnicas]);

    const loadHojasTecnicas = async () => {
        try {
            setLoading(true);
            setError(null);
            const data = await hojasTecnicasService.getHojasTecnicas();
            setHojasTecnicas(data);
            setFilteredHojas(data);
        } catch (err) {
            console.error('Error loading hojas técnicas:', err);
            setError('Error al cargar las hojas técnicas');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenModal = (hoja = null) => {
        setSelectedHoja(hoja);
        setModalOpen(true);
    };

    const handleCloseModal = () => {
        setModalOpen(false);
        setSelectedHoja(null);
    };

    const handleSaveHoja = (savedHoja) => {
        // Reload the list
        loadHojasTecnicas();
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
                        onClick={() => handleOpenModal()}
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
            {hojasTecnicas.length > 0 && (
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
            )}

            {/* Content Area */}
            {loading ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    style={{
                        backgroundColor: colors.card,
                        border: `1px solid ${colors.border}`,
                        borderRadius: '12px',
                        padding: '60px 40px',
                        textAlign: 'center',
                        minHeight: '400px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}
                >
                    <p style={{
                        fontSize: '16px',
                        color: colors.textSecondary,
                        margin: 0,
                    }}>
                        Cargando hojas técnicas...
                    </p>
                </motion.div>
            ) : error ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
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
                    <p style={{
                        fontSize: '16px',
                        color: '#ef4444',
                        margin: 0,
                    }}>
                        {error}
                    </p>
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={loadHojasTecnicas}
                        style={{
                            padding: '12px 24px',
                            backgroundColor: colors.primary,
                            border: 'none',
                            borderRadius: '8px',
                            color: 'white',
                            fontSize: '14px',
                            fontWeight: '600',
                            cursor: 'pointer',
                        }}
                    >
                        Reintentar
                    </motion.button>
                </motion.div>
            ) : hojasTecnicas.length === 0 ? (
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
                        onClick={() => handleOpenModal()}
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
            ) : (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                        gap: '20px',
                    }}
                >
                    {filteredHojas.map((hoja) => (
                        <HojaTecnicaCard
                            key={hoja.id}
                            hoja={hoja}
                            onClick={() => handleOpenModal(hoja)}
                        />
                    ))}
                </motion.div>
            )}

            {/* Modal */}
            <HojaTecnicaModal
                isOpen={modalOpen}
                onClose={handleCloseModal}
                hoja={selectedHoja}
                onSave={handleSaveHoja}
            />
        </div>
    );
};

export default HojasTecnicasSection;

