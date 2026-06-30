import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { UploadCloud } from 'feather-icons-react';
import { useTheme } from './ThemeContext';
import SectionHeader from './SectionHeader';
import { KronosTabs } from './kronos';
import InnuvaHoldedTab from './innuva/InnuvaHoldedTab';
import InnuvaPersonalTab from './innuva/InnuvaPersonalTab';

const TABS = [
  { id: 'holded', label: 'Innuva → Holded' },
  { id: 'innuva', label: 'Excel → Innuva' }
];

const InnuvaConverterPage = () => {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('holded');

  return (
    <div style={{ padding: '20px 24px 32px', color: colors.text, maxWidth: 1100, margin: '0 auto' }}>
      <SectionHeader
        icon={UploadCloud}
        title="Conversor Innuva"
        subtitle="Herramientas para convertir archivos entre Innuva, Holded y plantillas propias. Todo el procesamiento es local."
      />

      <div style={{ marginBottom: 18 }}>
        <KronosTabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'holded' ? (
          <motion.div
            key="tab-holded"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.2 }}
          >
            <InnuvaHoldedTab />
          </motion.div>
        ) : (
          <motion.div
            key="tab-innuva"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.2 }}
          >
            <InnuvaPersonalTab />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default InnuvaConverterPage;
