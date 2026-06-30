// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // API para tasas de cambio
  getExchangeRates: () => ipcRenderer.invoke('get-exchange-rates'),
  // Ubicación aproximada por IP (fallback para fichaje; no sujeta a CSP del renderer)
  getLocationByIP: () => ipcRenderer.invoke('get-location-by-ip'),
  
  // API para peticiones a Holded
  makeHoldedRequest: (requestData) => ipcRenderer.invoke('make-holded-request', requestData),

  /** TED / PSCP / PLACSP — via main process (no afectado por CSP del renderer). */
  licitacionsHttpRequest: (requestData) => ipcRenderer.invoke('licitacions-http-request', requestData),
  
  // API para auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // API para obtener versión de la aplicación
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // API para verificar archivos del release
  checkReleaseFiles: () => ipcRenderer.invoke('check-release-files'),
  
  // API para descargar el ejecutable del último release
  downloadLatestExecutable: () => ipcRenderer.invoke('download-latest-executable'),

  // Abrir enlaces en el navegador del sistema
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  /** Cliente de correo del sistema (mailto:). */
  openMailto: (url) => ipcRenderer.invoke('open-mailto', url),
  /** Borrador de email (para, asunto, cuerpo) → cliente del sistema. */
  openEmailDraft: (draft) => ipcRenderer.invoke('open-email-draft', draft),
  /** Diagnóstico correo Firma (handler mailto, modo, etc.). */
  getFirmaEmailDebug: () => ipcRenderer.invoke('get-firma-email-debug'),

  /** Firma (portal): IPC al main — FIRMA_SMS_* y FIRMA_PORTAL_BASE_URL desde .env. */
  getFirmaSmsConfig: () => ipcRenderer.invoke('get-firma-sms-config'),
  /** Portapapeles del sistema (fallback si navigator.clipboard falla en Electron). */
  writeClipboardText: (text) => ipcRenderer.invoke('clipboard-write-text', text),
  
  // Listeners para eventos del auto-updater
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),

  onLicitacionsCronSync: (callback) => {
    const wrapped = (_event, ...args) => callback(...args);
    ipcRenderer.on('licitacions-cron-sync', wrapped);
    return () => ipcRenderer.removeListener('licitacions-cron-sync', wrapped);
  },

  // Remover listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
