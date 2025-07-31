// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // API para tasas de cambio
  getExchangeRates: () => ipcRenderer.invoke('get-exchange-rates'),
  
  // API para peticiones a Holded
  makeHoldedRequest: (requestData) => ipcRenderer.invoke('make-holded-request', requestData),
  
  // API para auto-updater
  checkForUpdates: () => ipcRenderer.invoke('check-for-updates'),
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),

  // API para obtener versión de la aplicación
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  
  // API para verificar archivos del release
  checkReleaseFiles: () => ipcRenderer.invoke('check-release-files'),
  
  // Listeners para eventos del auto-updater
  onUpdateAvailable: (callback) => ipcRenderer.on('update-available', callback),
  onUpdateNotAvailable: (callback) => ipcRenderer.on('update-not-available', callback),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', callback),
  onUpdateDownloaded: (callback) => ipcRenderer.on('update-downloaded', callback),
  onUpdateError: (callback) => ipcRenderer.on('update-error', callback),
  
  // Remover listeners
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
