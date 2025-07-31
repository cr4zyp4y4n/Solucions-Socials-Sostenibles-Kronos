const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { ipcMain } = require('electron');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Configurar AppUserModelId para Windows
app.setAppUserModelId('com.squirrel.sss-kronos.SSSKronos');

// Verificar si es el primer arranque de Squirrel
const isFirstRun = process.argv.includes('--squirrel-firstrun');
if (isFirstRun) {
  console.log('🔄 Primer arranque de Squirrel detectado, esperando 10 segundos...');
  setTimeout(() => {
    console.log('✅ Primer arranque completado');
  }, 10000);
}

// Configuración del auto-updater
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'cr4zyp4y4n',
  repo: 'Solucions-Socials-Sostenibles-Kronos',
  private: false
});

console.log('🔧 Auto-updater configurado para GitHub: cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos');
console.log('📡 Feed URL configurada:', autoUpdater.getFeedURL());

// Variable global para mainWindow
let mainWindow = null;

// Función para configurar eventos del auto-updater
function setupAutoUpdaterEvents() {
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Verificando actualizaciones...');
    console.log('📡 URL del feed:', autoUpdater.getFeedURL());
  });

  autoUpdater.on('update-available', (info) => {
    console.log('✅ Actualización disponible:', info);
    console.log('📦 Nueva versión:', info.version);
    console.log('📋 Release notes:', info.releaseNotes);
    console.log('📅 Fecha del release:', info.releaseDate);
    console.log('🔗 URL del release:', info.updateURL);
    console.log('📁 Archivos del release:', info.files || 'No disponible');
    console.log('🔧 Información completa:', JSON.stringify(info, null, 2));
    console.log('🔄 Iniciando descarga automática...');
    
    // Iniciar descarga automáticamente
    try {
      autoUpdater.downloadUpdate();
      console.log('✅ downloadUpdate() iniciado automáticamente');
    } catch (error) {
      console.error('❌ Error iniciando descarga automática:', error);
    }
    
    // Enviar notificación al renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', (info) => {
    console.log('❌ No hay actualizaciones disponibles:', info);
    console.log('📦 Versión actual es la más reciente');
    console.log('🔍 Información del auto-updater:', JSON.stringify(info, null, 2));
    // Enviar notificación al renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-not-available', info);
    }
  });

  autoUpdater.on('error', (err) => {
    console.log('❌ Error en auto-updater:', err);
    console.log('🔍 Detalles del error:', err.message);
    console.log('📋 Stack trace:', err.stack);
    console.log('🔧 Código de error:', err.code);
    // Enviar error al renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-error', err);
    }
  });

  autoUpdater.on('download-progress', (progressObj) => {
  console.log('⬇️ Progreso de descarga:', progressObj);
  console.log('📊 Porcentaje:', progressObj.percent);
  console.log('🚀 Velocidad:', progressObj.bytesPerSecond);
  console.log('📦 Tamaño total:', progressObj.total);
  console.log('📥 Bytes descargados:', progressObj.transferred);
  console.log('🔗 URL del archivo:', progressObj.url || 'No disponible');
  console.log('📁 Nombre del archivo:', progressObj.filename || 'No disponible');
  // Enviar progreso al renderer
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

  autoUpdater.on('update-downloaded', (info) => {
    console.log('✅ Actualización descargada:', info);
    console.log('📦 Versión descargada:', info.version);
    console.log('📋 Release notes:', info.releaseNotes);
    console.log('📅 Fecha del release:', info.releaseDate);
    console.log('🔗 URL del release:', info.updateURL);
    // Enviar notificación al renderer
    if (mainWindow) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });
}

// Función para configurar handlers IPC
function setupIpcHandlers() {
  // Handlers IPC para el auto-updater
  ipcMain.handle('check-for-updates', () => {
    console.log('📡 Handler IPC: check-for-updates llamado');
    console.log('🔧 Auto-updater disponible:', !!autoUpdater);
    console.log('🔧 Función checkForUpdates disponible:', typeof autoUpdater.checkForUpdates);
    try {
      autoUpdater.checkForUpdates();
      console.log('✅ checkForUpdates() ejecutado correctamente');
      console.log('⏳ Esperando eventos de actualización...');
    } catch (error) {
      console.error('❌ Error en checkForUpdates():', error);
      throw error;
    }
  });

  ipcMain.handle('download-update', () => {
    console.log('📡 Handler IPC: download-update llamado');
    console.log('🔧 Auto-updater disponible:', !!autoUpdater);
    console.log('🔧 Función downloadUpdate disponible:', typeof autoUpdater.downloadUpdate);
    try {
      autoUpdater.downloadUpdate();
      console.log('✅ downloadUpdate() ejecutado correctamente');
    } catch (error) {
      console.error('❌ Error en downloadUpdate():', error);
      throw error;
    }
  });

  ipcMain.handle('install-update', () => {
    autoUpdater.quitAndInstall();
  });

  // Handler para obtener la versión de la aplicación
  ipcMain.handle('get-app-version', () => {
    return app.getVersion();
  });

  // Handler para verificar archivos del release
  ipcMain.handle('check-release-files', async () => {
    return new Promise((resolve, reject) => {
      https.get('https://api.github.com/repos/cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos/releases/latest', {
        headers: {
          'User-Agent': 'SSS-Kronos-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const releaseInfo = JSON.parse(data);
            console.log('🔍 Información del release:', releaseInfo);
            console.log('📁 Assets disponibles:', releaseInfo.assets?.map(asset => ({
              name: asset.name,
              size: asset.size,
              download_url: asset.browser_download_url
            })));
            resolve(releaseInfo);
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    });
  });
}

// Handler IPC para tasas de cambio usando https nativo
ipcMain.handle('get-exchange-rates', async () => {
  return new Promise((resolve, reject) => {
    https.get('https://v6.exchangerate-api.com/v6/91eff644eb7dc35f0dc510de/latest/EUR', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
});



// Handler IPC para peticiones a la API de Holded
ipcMain.handle('make-holded-request', async (event, { url, options }) => {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || 443,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      }
    };

    const req = https.request(requestOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const responseData = JSON.parse(data);
          resolve({
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode,
            statusText: res.statusMessage,
            data: responseData
          });
        } catch (e) {
          reject(new Error(`Error parsing response: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    // Si hay body en la petición, enviarlo
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
});

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: path.resolve(__dirname, 'assets', 'LogoMinimalistSSSHighestOpacity.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
      webSecurity: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Configurar Content Security Policy
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' https://v6.exchangerate-api.com https://api.exchangerate-api.com https://zalnsacawwekmibhoiba.supabase.co https://*.supabase.co wss://zalnsacawwekmibhoiba.supabase.co wss://*.supabase.co https://api.holded.com https://api.github.com; " +
          "img-src 'self' data:;"
        ]
      }
    });
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Permitir abrir DevTools solo bajo demanda (por IPC)
  ipcMain.on('open-devtools', () => {
    mainWindow.webContents.openDevTools();
  });

  // Configurar eventos del auto-updater después de crear la ventana
  setupAutoUpdaterEvents();
  
  // Configurar handlers IPC
  setupIpcHandlers();
  console.log('✅ Handlers IPC configurados correctamente');
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  createWindow();

  // Verificar actualizaciones automáticamente al iniciar
  setTimeout(() => {
    autoUpdater.checkForUpdates();
  }, 3000); // Esperar 3 segundos para que la app esté completamente cargada

  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
