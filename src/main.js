const { app, BrowserWindow } = require('electron');
const path = require('node:path');
const { ipcMain } = require('electron');
const https = require('https');
const { autoUpdater } = require('electron-updater');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

// Configuración del auto-updater
autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'cr4zyp4y4n',
  repo: 'Solucions-Socials-Sostenibles-Kronos',
  private: false, // true si es repositorio privado
});

console.log('🔧 Auto-updater configurado para:', 'cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos');

// Configurar eventos del auto-updater
autoUpdater.on('checking-for-update', () => {
  console.log('🔍 Verificando actualizaciones...');
});

autoUpdater.on('update-available', (info) => {
  console.log('✅ Actualización disponible:', info);
  console.log('📦 Nueva versión:', info.version);
  console.log('📋 Release notes:', info.releaseNotes);
  // Enviar notificación al renderer
  if (mainWindow) {
    mainWindow.webContents.send('update-available', info);
  }
});

autoUpdater.on('update-not-available', (info) => {
  console.log('❌ No hay actualizaciones disponibles:', info);
  console.log('📦 Versión actual es la más reciente');
});

autoUpdater.on('error', (err) => {
  console.log('❌ Error en auto-updater:', err);
  console.log('🔍 Detalles del error:', err.message);
  console.log('📋 Stack trace:', err.stack);
});

autoUpdater.on('download-progress', (progressObj) => {
  console.log('⬇️ Progreso de descarga:', progressObj);
  console.log('📊 Porcentaje:', progressObj.percent);
  console.log('🚀 Velocidad:', progressObj.bytesPerSecond);
  // Enviar progreso al renderer
  if (mainWindow) {
    mainWindow.webContents.send('download-progress', progressObj);
  }
});

autoUpdater.on('update-downloaded', (info) => {
  console.log('✅ Actualización descargada:', info);
  console.log('📦 Versión descargada:', info.version);
  // Enviar notificación al renderer
  if (mainWindow) {
    mainWindow.webContents.send('update-downloaded', info);
  }
});

// Handlers IPC para el auto-updater
ipcMain.handle('check-for-updates', () => {
  autoUpdater.checkForUpdates();
});

ipcMain.handle('download-update', () => {
  autoUpdater.downloadUpdate();
});

ipcMain.handle('install-update', () => {
  autoUpdater.quitAndInstall();
});

// Handler para obtener la versión de la aplicación
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

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
  const mainWindow = new BrowserWindow({
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
