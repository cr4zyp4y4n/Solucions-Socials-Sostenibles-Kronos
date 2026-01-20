import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Upload, Image as ImageIcon } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import hojasTecnicasService from '../services/hojasTecnicasService';
import { createImagePreview, revokeImagePreview } from '../utils/imageCompression';

const HojaTecnicaModal = ({ isOpen, onClose, hoja, onSave }) => {
    const { colors } = useTheme();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isDragging, setIsDragging] = useState(false);

    // Form state
    const [nombrePlato, setNombrePlato] = useState('');
    const [imagen, setImagen] = useState(null);
    const [imagenPreview, setImagenPreview] = useState(null);
    const [ingredientes, setIngredientes] = useState([]);
    const [alergenos, setAlergenos] = useState([]);
    const [otrosAlergeno, setOtrosAlergeno] = useState('');

    // Predefined allergen list
    const alergenosPredefinidos = [
        'Gluten',
        'Crustacis i derivats',
        'Ous i Derivats',
        'Peix i derivats',
        'Fruita seca i derivats',
        'Soja i derivats',
        'Llet i derivats',
        'Cacauet',
        'Mostassa i Derivats',
        'Apit i derivats',
        'Llavors de Sèsam altres',
        'Molusc i derivats',
        'Anhidrid i sulfits>10mg',
        'Fruits vermells'
    ];

    // Initialize form when hoja changes or modal opens
    useEffect(() => {
        if (isOpen) {
            if (hoja) {
                setNombrePlato(hoja.nombre_plato || '');
                setImagenPreview(hoja.imagen_url || null);
                setIngredientes(hoja.ingredientes || []);

                // Convert allergens array to selected state
                const alergenosArray = hoja.alergenos || [];
                const selectedAlergenos = alergenosArray.map(a => a.tipo_alergeno);

                // Check if there's a custom "Otros" allergen
                const otrosItem = alergenosArray.find(a =>
                    !alergenosPredefinidos.includes(a.tipo_alergeno) && a.tipo_alergeno.trim() !== ''
                );

                setAlergenos(selectedAlergenos);
                setOtrosAlergeno(otrosItem ? otrosItem.tipo_alergeno : '');
            } else {
                resetForm();
            }
        }
    }, [hoja, isOpen]);

    // Cleanup preview URL on unmount
    useEffect(() => {
        return () => {
            if (imagenPreview && imagenPreview.startsWith('blob:')) {
                revokeImagePreview(imagenPreview);
            }
        };
    }, [imagenPreview]);

    const resetForm = () => {
        setNombrePlato('');
        setImagen(null);
        setImagenPreview(null);
        setIngredientes([]);
        setAlergenos([]);
        setOtrosAlergeno('');
        setError(null);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            processImageFile(file);
        }
    };

    const processImageFile = (file) => {
        // Revoke old preview if exists
        if (imagenPreview && imagenPreview.startsWith('blob:')) {
            revokeImagePreview(imagenPreview);
        }

        setImagen(file);
        const preview = createImagePreview(file);
        setImagenPreview(preview);
    };

    const handleRemoveImage = () => {
        if (imagenPreview && imagenPreview.startsWith('blob:')) {
            revokeImagePreview(imagenPreview);
        }
        setImagen(null);
        setImagenPreview(null);
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            const file = files[0];
            // Validate it's an image
            if (file.type.startsWith('image/')) {
                processImageFile(file);
            } else {
                setError('Por favor, arrastra solo archivos de imagen');
            }
        }
    };

    const handleAddIngrediente = () => {
        setIngredientes([
            ...ingredientes,
            {
                id: `temp-${Date.now()}`,
                nombre_ingrediente: '',
                peso_gramos: 0,
                coste_euros: 0,
                gastos_euros: 0,
            }
        ]);
    };

    const handleRemoveIngrediente = (index) => {
        setIngredientes(ingredientes.filter((_, i) => i !== index));
    };

    const handleIngredienteChange = (index, field, value) => {
        const updated = [...ingredientes];
        updated[index] = { ...updated[index], [field]: value };
        setIngredientes(updated);
    };

    const handleAlergenoToggle = (alergeno) => {
        if (alergenos.includes(alergeno)) {
            setAlergenos(alergenos.filter(a => a !== alergeno));
        } else {
            setAlergenos([...alergenos, alergeno]);
        }
    };

    const calculateResumen = () => {
        const resumen = {
            total_peso: 0,
            total_coste: 0,
            total_gastos: 0,
            coste_total: 0,
        };

        ingredientes.forEach(ing => {
            resumen.total_peso += parseFloat(ing.peso_gramos) || 0;
            resumen.total_coste += parseFloat(ing.coste_euros) || 0;
            resumen.total_gastos += parseFloat(ing.gastos_euros) || 0;
        });

        resumen.coste_total = resumen.total_coste + resumen.total_gastos;

        return resumen;
    };

    const handleSave = async () => {
        try {
            setError(null);

            // Validation
            if (!nombrePlato.trim()) {
                setError('El nombre del plato es obligatorio');
                return;
            }

            setLoading(true);

            // Prepare allergens data
            const alergenosData = [...alergenos];
            if (otrosAlergeno.trim()) {
                alergenosData.push(otrosAlergeno.trim());
            }

            const hojaData = {
                nombre_plato: nombrePlato,
                imagen: imagen,
                ingredientes: ingredientes.filter(ing => ing.nombre_ingrediente.trim()),
                alergenos: alergenosData.map(tipo => ({ tipo_alergeno: tipo })),
            };

            let result;
            if (hoja) {
                // Update existing
                result = await hojasTecnicasService.updateHojaTecnica(hoja.id, hojaData);
            } else {
                // Create new
                result = await hojasTecnicasService.createHojaTecnica(hojaData);
            }

            onSave(result);
            handleClose();
        } catch (err) {
            console.error('Error saving hoja técnica:', err);
            setError(err.message || 'Error al guardar la hoja técnica');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!hoja) return;

        const confirmed = window.confirm('¿Estás seguro de que quieres borrar esta hoja técnica?');
        if (!confirmed) return;

        try {
            setLoading(true);
            await hojasTecnicasService.deleteHojaTecnica(hoja.id);
            onSave(null); // Signal deletion
            handleClose();
        } catch (err) {
            console.error('Error deleting hoja técnica:', err);
            setError(err.message || 'Error al borrar la hoja técnica');
        } finally {
            setLoading(false);
        }
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const resumen = calculateResumen();

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    padding: '20px',
                }}
                onClick={handleClose}
            >
                <motion.div
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                        backgroundColor: colors.background,
                        borderRadius: '16px',
                        width: '100%',
                        maxWidth: '900px',
                        maxHeight: '90vh',
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column',
                    }}
                >
                    {/* Header */}
                    <div style={{
                        padding: '24px',
                        borderBottom: `1px solid ${colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}>
                        <h2 style={{
                            fontSize: '24px',
                            fontWeight: '700',
                            color: colors.text,
                            margin: 0,
                        }}>
                            {hoja ? 'Editar Hoja Técnica' : 'Nueva Hoja Técnica'}
                        </h2>
                        <button
                            onClick={handleClose}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                padding: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: '8px',
                                transition: 'background-color 0.2s',
                            }}
                            onMouseEnter={(e) => e.target.style.backgroundColor = colors.surface}
                            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
                        >
                            <X size={24} color={colors.text} />
                        </button>
                    </div>

                    {/* Content */}
                    <div style={{
                        flex: 1,
                        overflowY: 'auto',
                        padding: '24px',
                    }}>
                        {error && (
                            <div style={{
                                padding: '12px 16px',
                                backgroundColor: '#fee2e2',
                                border: '1px solid #fecaca',
                                borderRadius: '8px',
                                color: '#991b1b',
                                fontSize: '14px',
                                marginBottom: '20px',
                            }}>
                                {error}
                            </div>
                        )}

                        {/* Nombre del Plato */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: colors.text,
                                marginBottom: '8px',
                            }}>
                                Nombre del Plato <span style={{ color: '#ef4444' }}>*</span>
                            </label>
                            <input
                                type="text"
                                value={nombrePlato}
                                onChange={(e) => setNombrePlato(e.target.value)}
                                placeholder="Ej: Paella Valenciana"
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '14px',
                                    outline: 'none',
                                }}
                            />
                        </div>

                        {/* Foto del Plato */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: colors.text,
                                marginBottom: '8px',
                            }}>
                                Foto del Plato (Opcional)
                            </label>

                            {imagenPreview ? (
                                <div style={{
                                    position: 'relative',
                                    width: '200px',
                                    height: '200px',
                                    borderRadius: '8px',
                                    overflow: 'hidden',
                                    border: `1px solid ${colors.border}`,
                                }}>
                                    <img
                                        src={imagenPreview}
                                        alt="Preview"
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'cover',
                                        }}
                                    />
                                    <button
                                        onClick={handleRemoveImage}
                                        style={{
                                            position: 'absolute',
                                            top: '8px',
                                            right: '8px',
                                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                                            border: 'none',
                                            borderRadius: '50%',
                                            width: '32px',
                                            height: '32px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <X size={18} color="white" />
                                    </button>
                                </div>
                            ) : (
                                <label
                                    onDragEnter={handleDragEnter}
                                    onDragOver={handleDragOver}
                                    onDragLeave={handleDragLeave}
                                    onDrop={handleDrop}
                                    style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '200px',
                                        height: '200px',
                                        border: `2px dashed ${isDragging ? colors.primary : colors.border}`,
                                        borderRadius: '8px',
                                        cursor: 'pointer',
                                        backgroundColor: isDragging ? `${colors.primary}10` : colors.surface,
                                        transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={(e) => {
                                        if (!isDragging) {
                                            e.currentTarget.style.borderColor = colors.primary;
                                        }
                                    }}
                                    onMouseLeave={(e) => {
                                        if (!isDragging) {
                                            e.currentTarget.style.borderColor = colors.border;
                                        }
                                    }}
                                >
                                    <Upload size={32} color={isDragging ? colors.primary : colors.textSecondary} />
                                    <span style={{
                                        marginTop: '8px',
                                        fontSize: '14px',
                                        color: isDragging ? colors.primary : colors.textSecondary,
                                        fontWeight: isDragging ? '600' : '400',
                                    }}>
                                        {isDragging ? 'Suelta aquí' : 'Subir o arrastrar imagen'}
                                    </span>
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        style={{ display: 'none' }}
                                    />
                                </label>
                            )}
                        </div>

                        {/* Ingredientes */}
                        <div style={{ marginBottom: '24px' }}>
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '12px',
                            }}>
                                <label style={{
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    color: colors.text,
                                }}>
                                    Ingredientes y Costes
                                </label>
                                <motion.button
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    onClick={handleAddIngrediente}
                                    style={{
                                        padding: '8px 16px',
                                        backgroundColor: colors.primary,
                                        border: 'none',
                                        borderRadius: '6px',
                                        color: 'white',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px',
                                    }}
                                >
                                    <Plus size={14} />
                                    Añadir Ingrediente
                                </motion.button>
                            </div>

                            {ingredientes.length === 0 ? (
                                <div style={{
                                    padding: '24px',
                                    backgroundColor: colors.surface,
                                    borderRadius: '8px',
                                    textAlign: 'center',
                                    color: colors.textSecondary,
                                    fontSize: '14px',
                                }}>
                                    No hay ingredientes. Haz clic en "Añadir Ingrediente" para empezar.
                                </div>
                            ) : (
                                <div style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '12px',
                                }}>
                                    {ingredientes.map((ing, index) => (
                                        <div
                                            key={ing.id || index}
                                            style={{
                                                display: 'grid',
                                                gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                                                gap: '8px',
                                                padding: '12px',
                                                backgroundColor: colors.surface,
                                                borderRadius: '8px',
                                                alignItems: 'center',
                                            }}
                                        >
                                            <input
                                                type="text"
                                                value={ing.nombre_ingrediente}
                                                onChange={(e) => handleIngredienteChange(index, 'nombre_ingrediente', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddIngrediente();
                                                    }
                                                }}
                                                placeholder="Nombre"
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: colors.background,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: '6px',
                                                    color: colors.text,
                                                    fontSize: '13px',
                                                    outline: 'none',
                                                }}
                                            />
                                            <input
                                                type="number"
                                                value={ing.peso_gramos}
                                                onChange={(e) => handleIngredienteChange(index, 'peso_gramos', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddIngrediente();
                                                    }
                                                }}
                                                placeholder="Peso (g)"
                                                min="0"
                                                step="0.01"
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: colors.background,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: '6px',
                                                    color: colors.text,
                                                    fontSize: '13px',
                                                    outline: 'none',
                                                }}
                                            />
                                            <input
                                                type="number"
                                                value={ing.coste_euros}
                                                onChange={(e) => handleIngredienteChange(index, 'coste_euros', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddIngrediente();
                                                    }
                                                }}
                                                placeholder="Coste (€)"
                                                min="0"
                                                step="0.01"
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: colors.background,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: '6px',
                                                    color: colors.text,
                                                    fontSize: '13px',
                                                    outline: 'none',
                                                }}
                                            />
                                            <input
                                                type="number"
                                                value={ing.gastos_euros}
                                                onChange={(e) => handleIngredienteChange(index, 'gastos_euros', e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        e.preventDefault();
                                                        handleAddIngrediente();
                                                    }
                                                }}
                                                placeholder="Gastos (€)"
                                                min="0"
                                                step="0.01"
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: colors.background,
                                                    border: `1px solid ${colors.border}`,
                                                    borderRadius: '6px',
                                                    color: colors.text,
                                                    fontSize: '13px',
                                                    outline: 'none',
                                                }}
                                            />
                                            <button
                                                onClick={() => handleRemoveIngrediente(index)}
                                                style={{
                                                    padding: '8px',
                                                    backgroundColor: 'transparent',
                                                    border: 'none',
                                                    borderRadius: '6px',
                                                    cursor: 'pointer',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}
                                            >
                                                <Trash2 size={16} color="#ef4444" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Alérgenos */}
                        <div style={{ marginBottom: '24px' }}>
                            <label style={{
                                display: 'block',
                                fontSize: '14px',
                                fontWeight: '600',
                                color: colors.text,
                                marginBottom: '12px',
                            }}>
                                Alérgenos
                            </label>

                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
                                gap: '12px',
                                padding: '16px',
                                backgroundColor: colors.surface,
                                borderRadius: '8px',
                                border: `1px solid ${colors.border}`,
                            }}>
                                {alergenosPredefinidos.map((alergeno) => (
                                    <label
                                        key={alergeno}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            padding: '8px',
                                            borderRadius: '6px',
                                            transition: 'background-color 0.2s',
                                            backgroundColor: alergenos.includes(alergeno) ? `${colors.primary}15` : 'transparent',
                                        }}
                                        onMouseEnter={(e) => {
                                            if (!alergenos.includes(alergeno)) {
                                                e.currentTarget.style.backgroundColor = colors.background;
                                            }
                                        }}
                                        onMouseLeave={(e) => {
                                            if (!alergenos.includes(alergeno)) {
                                                e.currentTarget.style.backgroundColor = 'transparent';
                                            }
                                        }}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={alergenos.includes(alergeno)}
                                            onChange={() => handleAlergenoToggle(alergeno)}
                                            style={{
                                                width: '18px',
                                                height: '18px',
                                                cursor: 'pointer',
                                                accentColor: colors.primary,
                                            }}
                                        />
                                        <span style={{
                                            fontSize: '13px',
                                            color: colors.text,
                                            userSelect: 'none',
                                        }}>
                                            {alergeno}
                                        </span>
                                    </label>
                                ))}

                                {/* Otros - Custom allergen input */}
                                <div style={{
                                    gridColumn: '1 / -1',
                                    marginTop: '8px',
                                    paddingTop: '12px',
                                    borderTop: `1px solid ${colors.border}`,
                                }}>
                                    <label style={{
                                        display: 'block',
                                        fontSize: '13px',
                                        fontWeight: '500',
                                        color: colors.text,
                                        marginBottom: '8px',
                                    }}>
                                        Otros (especificar):
                                    </label>
                                    <input
                                        type="text"
                                        value={otrosAlergeno}
                                        onChange={(e) => setOtrosAlergeno(e.target.value)}
                                        placeholder="Escribe otro alérgeno no listado..."
                                        style={{
                                            width: '100%',
                                            padding: '10px',
                                            backgroundColor: colors.background,
                                            border: `1px solid ${colors.border}`,
                                            borderRadius: '6px',
                                            color: colors.text,
                                            fontSize: '13px',
                                            outline: 'none',
                                        }}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Resumen de Costes */}
                        <div style={{
                            padding: '20px',
                            backgroundColor: colors.surface,
                            borderRadius: '12px',
                            border: `1px solid ${colors.border}`,
                        }}>
                            <h3 style={{
                                fontSize: '16px',
                                fontWeight: '600',
                                color: colors.text,
                                marginBottom: '16px',
                                marginTop: 0,
                            }}>
                                Resumen de Costes
                            </h3>
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                                gap: '16px',
                            }}>
                                <div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: colors.textSecondary,
                                        marginBottom: '4px',
                                    }}>
                                        Total Peso
                                    </div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: colors.text,
                                    }}>
                                        {resumen.total_peso.toFixed(2)} g
                                    </div>
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: colors.textSecondary,
                                        marginBottom: '4px',
                                    }}>
                                        Total Coste
                                    </div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: colors.text,
                                    }}>
                                        {resumen.total_coste.toFixed(2)} €
                                    </div>
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: colors.textSecondary,
                                        marginBottom: '4px',
                                    }}>
                                        Total Gastos
                                    </div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '600',
                                        color: colors.text,
                                    }}>
                                        {resumen.total_gastos.toFixed(2)} €
                                    </div>
                                </div>
                                <div>
                                    <div style={{
                                        fontSize: '12px',
                                        color: colors.textSecondary,
                                        marginBottom: '4px',
                                    }}>
                                        Coste Total
                                    </div>
                                    <div style={{
                                        fontSize: '18px',
                                        fontWeight: '700',
                                        color: colors.primary,
                                    }}>
                                        {resumen.coste_total.toFixed(2)} €
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Footer */}
                    <div style={{
                        padding: '24px',
                        borderTop: `1px solid ${colors.border}`,
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: '12px',
                    }}>
                        <div>
                            {hoja && (
                                <motion.button
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleDelete}
                                    disabled={loading}
                                    style={{
                                        padding: '12px 24px',
                                        backgroundColor: '#ef4444',
                                        border: 'none',
                                        borderRadius: '8px',
                                        color: 'white',
                                        fontSize: '14px',
                                        fontWeight: '600',
                                        cursor: loading ? 'not-allowed' : 'pointer',
                                        opacity: loading ? 0.6 : 1,
                                    }}
                                >
                                    Borrar Ficha
                                </motion.button>
                            )}
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleClose}
                                disabled={loading}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: colors.surface,
                                    border: `1px solid ${colors.border}`,
                                    borderRadius: '8px',
                                    color: colors.text,
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1,
                                }}
                            >
                                Cancelar
                            </motion.button>
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={handleSave}
                                disabled={loading}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: colors.primary,
                                    border: 'none',
                                    borderRadius: '8px',
                                    color: 'white',
                                    fontSize: '14px',
                                    fontWeight: '600',
                                    cursor: loading ? 'not-allowed' : 'pointer',
                                    opacity: loading ? 0.6 : 1,
                                }}
                            >
                                {loading ? 'Guardando...' : 'Guardar Ficha'}
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};

export default HojaTecnicaModal;
