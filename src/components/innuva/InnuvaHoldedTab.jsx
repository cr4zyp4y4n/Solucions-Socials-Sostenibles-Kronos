import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useTheme } from '../ThemeContext';
import InnuvaCuentasPanel from './InnuvaCuentasPanel';
import InnuvaEmpresaSelector from './InnuvaEmpresaSelector';
import InnuvaPreviewSection from './InnuvaPreviewSection';
import InnuvaUploadPanel from './InnuvaUploadPanel';
import { useInnuvaHoldedConverter } from './useInnuvaHoldedConverter';

export default function InnuvaHoldedTab() {
  const { colors } = useTheme();
  const converter = useInnuvaHoldedConverter();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <AnimatePresence>
        {converter.message ? (
          <motion.div
            key="msg"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            style={{
              padding: 12,
              borderRadius: 12,
              background: `${colors.success}14`,
              border: `1px solid ${colors.success}44`,
              fontSize: 13
            }}
          >
            {converter.message}
          </motion.div>
        ) : null}
      </AnimatePresence>

      <input
        ref={converter.fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        style={{ display: 'none' }}
        onChange={converter.handleFileChange}
      />

      <InnuvaEmpresaSelector
        empresa={converter.empresa}
        onChange={converter.setEmpresa}
        disabled={converter.isProcessing}
      />

      <InnuvaCuentasPanel
        cuentasCount={converter.cuentasByCodigo.size}
        cuentasLoading={converter.cuentasLoading}
        cuentasError={converter.cuentasError}
        cuentasCsvFile={converter.cuentasCsvFile}
        onCuentasCsvChange={converter.setCuentasCsvFile}
        onRefresh={converter.refreshCuentasFromDb}
        onImport={converter.importCuentasCsvToDb}
      />

      <InnuvaUploadPanel
        innuvaFile={converter.innuvaFile}
        isProcessing={converter.isProcessing}
        error={converter.error}
        hasData={converter.hasData}
        onSelectFile={converter.handleFileButtonClick}
        onReset={converter.handleReset}
        onDownload={converter.handleDownloadDraft}
        canDownload={converter.holdedDraft.length > 0}
      />

      <AnimatePresence>
        {converter.hasData ? (
          <motion.div
            key="preview"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22 }}
          >
            <InnuvaPreviewSection
              sourceCount={converter.sourceObjects.length}
              holdedCount={converter.holdedDraft.length}
              sourceHeaders={converter.sourceHeaders}
              previewSourceRows={converter.previewSourceRows}
              previewHoldedRows={converter.previewHoldedRows}
              conversionLog={converter.conversionLog}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
