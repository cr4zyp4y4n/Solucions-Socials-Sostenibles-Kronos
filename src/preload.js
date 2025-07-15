// See the Electron documentation for details on how to use preload scripts:
// https://www.electronjs.org/docs/latest/tutorial/process-model#preload-scripts

const { contextBridge, ipcRenderer } = require('electron');

// Exponer APIs seguras al renderer process
contextBridge.exposeInMainWorld('electronAPI', {
  // API para tasas de cambio
  getExchangeRates: () => ipcRenderer.invoke('get-exchange-rates'),
  
  // API para peticiones a Holded
  makeHoldedRequest: (requestData) => ipcRenderer.invoke('make-holded-request', requestData)
});
