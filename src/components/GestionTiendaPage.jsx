import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import HojasTecnicasSection from './HojasTecnicasSection';
import ConfirmacionProductosSection from './ConfirmacionProductosSection';

const GestionTiendaPage = () => {
    const { colors } = useTheme();
    const [activeTab, setActiveTab] = useState('hojas-tecnicas');

    const tabs = [
        {
            key: 'hojas-tecnicas',
            label: 'Hojas Técnicas',
            icon: FileText
        },
        {
            key: 'confirmacion-productos',
            label: 'Confirmación Productos Tienda',
            icon: CheckCircle
        }
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'hojas-tecnicas':
                return <HojasTecnicasSection />;
            case 'confirmacion-productos':
                return <ConfirmacionProductosSection />;
            default:
                return <HojasTecnicasSection />;
        }
    };

    return (
        <div style={{
            padding: '30px',
            height: '100%',
            overflow: 'auto',
            backgroundColor: colors.background,
        }}>
            {/* Tabs Navigation */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '30px',
                borderBottom: `2px solid ${colors.border}`,
                paddingBottom: '0',
            }}>
                {tabs.map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;

                    return (
                        <motion.button
                            key={tab.key}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setActiveTab(tab.key)}
                            style={{
                                background: 'none',
                                border: 'none',
                                padding: '14px 24px',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                borderBottom: isActive ? `3px solid ${colors.primary}` : '3px solid transparent',
                                color: isActive ? colors.primary : colors.textSecondary,
                                fontSize: '15px',
                                fontWeight: isActive ? '600' : '500',
                                transition: 'all 0.2s ease',
                                position: 'relative',
                                marginBottom: '-2px',
                            }}
                        >
                            <Icon size={18} />
                            <span>{tab.label}</span>
                        </motion.button>
                    );
                })}
            </div>

            {/* Content Area with Animation */}
            <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
            >
                {renderContent()}
            </motion.div>
        </div>
    );
};

export default GestionTiendaPage;
