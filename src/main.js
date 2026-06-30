const path = require('node:path');
const fs = require('node:fs');

// Cargar .env desde rutas probables (cwd y raíz del proyecto en dev con webpack en .webpack/main)
(function loadProjectEnv() {
  const candidates = [
    path.resolve(process.cwd(), '.env'),
    path.resolve(__dirname, '..', '..', '.env'),
    path.resolve(__dirname, '..', '.env')
  ];
  for (const envPath of candidates) {
    if (fs.existsSync(envPath)) {
      require('dotenv').config({ path: envPath });
      return;
    }
  }
  require('dotenv').config();
})();

const { app, BrowserWindow, dialog, shell, ipcMain, clipboard } = require('electron');
const {
  openEmailDraftInSystem,
  openMailtoInSystem,
  getEmailDebugInfo
} = require('./main/openSystemEmail');
const https = require('https');
const http = require('http');
const zlib = require('node:zlib');
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

// Configuración del auto-updater (usar GitHub explícitamente para Forge/Squirrel)
autoUpdater.autoDownload = true;
autoUpdater.allowPrerelease = false;
autoUpdater.autoInstallOnAppQuit = true;

// En builds con Electron Forge no se genera app-update.yml.
// Definimos el feed de GitHub explícitamente para evitar ENOENT.
try {
  autoUpdater.setFeedURL({
    provider: 'github',
    owner: 'cr4zyp4y4n',
    repo: 'Solucions-Socials-Sostenibles-Kronos',
    releaseType: 'release',
    vPrefixedTagName: true,
  });
  console.log('🔧 Feed del auto-updater configurado: GitHub cr4zyp4y4n/Solucions-Socials-Sostenibles-Kronos');
} catch (e) {
  console.error('❌ Error configurando feed del auto-updater:', e);
}

// Variable global para mainWindow
let mainWindow = null;
let ipcHandlersConfigured = false;

// Función para configurar eventos del auto-updater
function setupAutoUpdaterEvents() {
  autoUpdater.on('checking-for-update', () => {
    console.log('🔍 Verificando actualizaciones...');
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
  if (ipcHandlersConfigured) {
    return;
  }
  ipcHandlersConfigured = true;

  // Abrir enlaces en el navegador del sistema (evita limitaciones de Electron con PDFs/DevTools)
  ipcMain.handle('open-external', async (event, url) => {
    if (typeof url !== 'string' || !url) {
      throw new Error('URL inválida');
    }
    const trimmed = url.trim();
    const isHttp = /^https?:\/\//i.test(trimmed);
    const isMailto = /^mailto:/i.test(trimmed);
    if (!isHttp && !isMailto) {
      throw new Error('Solo se permiten URLs http/https o mailto');
    }
    if (trimmed.length > 12000) {
      throw new Error('URL demasiado larga');
    }
    if (isMailto) {
      await openMailtoInSystem(trimmed);
      return true;
    }
    await shell.openExternal(trimmed);
    return true;
  });

  ipcMain.handle('open-mailto', async (_event, url) => {
    await openMailtoInSystem(url);
    return true;
  });

  ipcMain.handle('open-email-draft', async (_event, draft) => {
    try {
      const result = await openEmailDraftInSystem(draft);
      return { ok: true, via: result.via, debug: result.debug };
    } catch (err) {
      const debug = {
        ...getEmailDebugInfo(),
        error: String(err?.message || err || 'Error desconocido'),
        showInUi: String(process.env.FIRMA_EMAIL_DEBUG || '').trim() === '1'
      };
      console.error('[firma-email] Error open-email-draft:', debug);
      throw err;
    }
  });

  ipcMain.handle('get-firma-email-debug', () => getEmailDebugInfo());

  /** Firma (portal): API SMS + base de enlaces /firmar desde .env (todas las máquinas, sin localStorage). */
  ipcMain.handle('get-firma-sms-config', () => ({
    apiBase: String(process.env.FIRMA_SMS_API_BASE || '').trim(),
    apiSecret: String(process.env.FIRMA_SMS_API_SECRET || '').trim(),
    portalBaseUrl: String(process.env.FIRMA_PORTAL_BASE_URL || '').trim(),
    // Debug/experimentos: forzar que el SMS de enlace NO incluya URL (para aislar filtros de operadora).
    linkTextOnly: String(process.env.FIRMA_SMS_LINK_TEXT_ONLY || '').trim(),
    // Debug/experimentos: controlar qué URL se incluye en el SMS de enlace.
    // - full (default): URL completa con token (portalLink)
    // - base: solo el dominio (origin), sin token
    // - none: no incluir ninguna URL (equivalente a linkTextOnly=1)
    linkUrlMode: String(process.env.FIRMA_SMS_LINK_URL_MODE || '').trim()
  }));

  ipcMain.handle('clipboard-write-text', (_event, text) => {
    clipboard.writeText(String(text ?? ''));
    return true;
  });

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

  // Handler para descargar el ejecutable del último release
  console.log('🔧 Registrando handler: download-latest-executable');
  ipcMain.handle('download-latest-executable', async () => {
    console.log('📡 Handler IPC: download-latest-executable llamado');
    try {
      const downloadToFile = ({ url, filePath }) => new Promise((resolve, reject) => {
        const cleanup = (err) => {
          try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch (_) {}
          reject(err);
        };

        const doGet = (u, redirectsLeft = 5) => {
          https.get(u, {
            headers: {
              'User-Agent': 'SSS-Kronos-App',
              'Accept': 'application/octet-stream'
            }
          }, (res) => {
            const sc = res.statusCode || 0;
            const isRedirect = sc >= 300 && sc < 400 && !!res.headers.location;
            if (isRedirect) {
              if (redirectsLeft <= 0) {
                res.resume();
                cleanup(new Error('Demasiadas redirecciones descargando el archivo'));
                return;
              }
              const nextUrl = res.headers.location.startsWith('http')
                ? res.headers.location
                : new URL(res.headers.location, u).toString();
              res.resume();
              doGet(nextUrl, redirectsLeft - 1);
              return;
            }

            if (sc < 200 || sc >= 300) {
              res.resume();
              cleanup(new Error(`Descarga fallida. HTTP ${sc}`));
              return;
            }

            const file = fs.createWriteStream(filePath);
            let hadError = false;

            file.on('error', (err) => {
              hadError = true;
              try { file.close(); } catch (_) {}
              cleanup(err);
            });

            res.on('error', (err) => {
              hadError = true;
              try { file.close(); } catch (_) {}
              cleanup(err);
            });

            file.on('finish', () => {
              if (hadError) return;
              file.close(() => resolve(true));
            });

            res.pipe(file);
          }).on('error', cleanup);
        };

        doGet(url);
      });

      // 1. Obtener información del último release
      const releaseInfo = await new Promise((resolve, reject) => {
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
              resolve(JSON.parse(data));
            } catch (e) {
              reject(e);
            }
          });
        }).on('error', reject);
      });

      // 2. Buscar el archivo ejecutable (.exe o Setup.exe)
      const executableAsset = releaseInfo.assets?.find(asset =>
        asset.name.endsWith('.exe') &&
        (asset.name.includes('Setup') || asset.name.includes('SSS Kronos'))
      );

      if (!executableAsset) {
        throw new Error('No se encontró un archivo ejecutable en el último release');
      }

      console.log('📦 Archivo encontrado:', executableAsset.name);
      console.log('📥 URL de descarga:', executableAsset.browser_download_url);

      // 3. Mostrar diálogo para elegir dónde guardar
      const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
        title: 'Guardar última versión de SSS Kronos',
        defaultPath: path.join(app.getPath('downloads'), executableAsset.name),
        filters: [
          { name: 'Ejecutables', extensions: ['exe'] },
          { name: 'Todos los archivos', extensions: ['*'] }
        ]
      });

      if (canceled || !filePath) {
        return { success: false, message: 'Descarga cancelada por el usuario' };
      }

      // 4. Descargar el archivo
      await downloadToFile({ url: executableAsset.browser_download_url, filePath });
      console.log('✅ Archivo descargado exitosamente:', filePath);
      return {
        success: true,
        message: 'Archivo descargado exitosamente',
        filePath: filePath,
        version: releaseInfo.tag_name
      };

    } catch (error) {
      console.error('❌ Error descargando ejecutable:', error);
      return {
        success: false,
        message: `Error al descargar: ${error.message}`
      };
    }
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

// Ubicación aproximada por IP (fallback para fichaje cuando la geolocalización del navegador falla, p. ej. 403 en Electron)
function tryParseLatLng(json, latKey, lngKey) {
  const lat = json[latKey] != null ? Number(json[latKey]) : null;
  const lng = (json[lngKey] != null ? Number(json[lngKey]) : null);
  if (typeof lat === 'number' && !Number.isNaN(lat) && typeof lng === 'number' && !Number.isNaN(lng)) {
    return { lat, lng };
  }
  return null;
}

ipcMain.handle('get-location-by-ip', async () => {
  const tryIpApiCo = () => new Promise((resolve) => {
    const req = https.get('https://ipapi.co/json/', { headers: { 'User-Agent': 'SSS-Kronos/1.0' } }, (res) => {
      const isRedirect = res.statusCode >= 301 && res.statusCode <= 302;
      const location = res.headers.location;
      if (isRedirect && location) {
        let url = location;
        if (url.startsWith('//')) url = 'https:' + url;
        https.get(url, { headers: { 'User-Agent': 'SSS-Kronos/1.0' } }, (res2) => {
          let data = '';
          res2.on('data', chunk => data += chunk);
          res2.on('end', () => {
            try {
              const json = JSON.parse(data);
              const result = tryParseLatLng(json, 'latitude', 'longitude');
              if (result) resolve(result);
              else resolve('retry');
            } catch (_) { resolve('retry'); }
          });
        }).on('error', () => resolve('retry'));
        return;
      }
      if (res.statusCode !== 200) {
        resolve('retry');
        return;
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const result = tryParseLatLng(json, 'latitude', 'longitude');
          if (result) resolve(result);
          else resolve('retry');
        } catch (_) { resolve('retry'); }
      });
    });
    req.on('error', () => resolve('retry'));
  });

  const tryIpApiCom = () => new Promise((resolve) => {
    http.get('http://ip-api.com/json/?fields=status,lat,lon', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          if (json.status !== 'success') {
            resolve(null);
            return;
          }
          const result = tryParseLatLng(json, 'lat', 'lon');
          resolve(result || null);
        } catch (_) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });

  // Probar primero ip-api.com (menos restricciones); ipapi.co suele devolver RateLimited en desarrollo
  const first = await tryIpApiCom();
  if (first) return first;
  return tryIpApiCo().then((r) => (r && r !== 'retry' ? r : null));
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
        // Primero intentar parsear como JSON, independientemente del Content-Type
        // Algunos servidores pueden devolver JSON válido sin el header correcto
        let responseData;
        let isJsonValid = false;

        try {
          // Si la respuesta está vacía, tratar como array vacío
          if (data.trim() === '') {
            responseData = [];
            isJsonValid = true;
          } else {
            responseData = JSON.parse(data);
            isJsonValid = true;
          }
        } catch (e) {
          // No es JSON válido, verificar el Content-Type y el código de estado
          const contentType = res.headers['content-type'] || '';
          const isJsonContentType = contentType.includes('application/json');

          // Si el Content-Type dice JSON pero no se puede parsear, es un error real
          if (isJsonContentType) {
            const errorPreview = data.substring(0, 200).replace(/\s+/g, ' ');
            reject(new Error(`Error parsing JSON response: ${e.message}. Respuesta recibida: ${errorPreview}...`));
            return;
          }

          // Si no es JSON y es un error del servidor (5xx) o gateway (502, 503, 504)
          if (res.statusCode >= 500 || res.statusCode === 502 || res.statusCode === 503 || res.statusCode === 504) {
            const errorPreview = data.substring(0, 100).replace(/\s+/g, ' ');
            reject(new Error(`Error del servidor Holded (${res.statusCode}): ${res.statusMessage}. Respuesta: ${errorPreview}...`));
            return;
          }

          // Si es un error de autenticación (401) o no autorizado (403)
          if (res.statusCode === 401 || res.statusCode === 403) {
            reject(new Error(`Error de autenticación Holded (${res.statusCode}): API key inválida o no autorizada.`));
            return;
          }

          // Para otros errores, mostrar el contenido truncado
          const errorPreview = data.substring(0, 200).replace(/\s+/g, ' ');
          reject(new Error(`Error en respuesta Holded (${res.statusCode}): La respuesta no es JSON válido. Contenido: ${errorPreview}...`));
          return;
        }

        // Si llegamos aquí, el JSON es válido
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage,
          data: responseData
        });
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

const LICITACIONS_HTTP_HOSTS = new Set([
  'api.ted.europa.eu',
  'opendata.aoc.cat',
  'analisi.transparenciacatalunya.cat',
  'contrataciondelestado.es'
]);

function licitacionsHttpRequest({ url, method = 'GET', headers = {}, body = null }) {
  return new Promise((resolve, reject) => {
    const MAX_REDIRECTS = 5;

    const doRequest = (currentUrl, redirectsLeft) => {
      const urlObj = new URL(currentUrl);
      if (!LICITACIONS_HTTP_HOSTS.has(urlObj.hostname)) {
        reject(new Error(`Host no permès per a licitacions: ${urlObj.hostname}`));
        return;
      }

      const lib = urlObj.protocol === 'http:' ? http : https;
      const baseHeaders = {
        // User-Agent ayuda mucho con endpoints que devuelven HTML/bloqueos si parece "bot"
        'User-Agent': 'SSS-Kronos/licitacions (+electron)',
        'Accept': headers.Accept || headers.accept || '*/*',
        'Accept-Language': headers['Accept-Language'] || headers['accept-language'] || 'es-ES,es;q=0.9,ca;q=0.8,en;q=0.7',
        // Muchos endpoints sirven gzip por defecto; lo soportamos para poder parsear XML/JSON
        'Accept-Encoding': 'gzip,deflate',
        ...headers
      };

      const requestOptions = {
        hostname: urlObj.hostname,
        port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
        path: urlObj.pathname + urlObj.search,
        method: method || 'GET',
        headers: baseHeaders
      };

      const req = lib.request(requestOptions, (res) => {
        const sc = res.statusCode || 0;
        const isRedirect = sc >= 300 && sc < 400 && !!res.headers.location;
        if (isRedirect) {
          if (redirectsLeft <= 0) {
            res.resume();
            reject(new Error('Demasiadas redirecciones en licitacions-http-request'));
            return;
          }
          const nextUrl = res.headers.location.startsWith('http')
            ? res.headers.location
            : new URL(res.headers.location, currentUrl).toString();
          res.resume();
          doRequest(nextUrl, redirectsLeft - 1);
          return;
        }

        const encoding = String(res.headers['content-encoding'] || '').toLowerCase();
        const contentType = String(res.headers['content-type'] || '');

        const chunks = [];
        res.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
        res.on('end', () => {
          const buffer = Buffer.concat(chunks);

          const finish = (buf) => resolve({
            ok: sc >= 200 && sc < 300,
            status: sc,
            statusText: res.statusMessage,
            text: buf.toString('utf8'),
            headers: {
              'content-type': contentType,
              'content-encoding': encoding
            }
          });

          if (encoding === 'gzip') {
            zlib.gunzip(buffer, (err, out) => {
              if (err) {
                finish(buffer); // fallback sin descomprimir
                return;
              }
              finish(out);
            });
            return;
          }

          if (encoding === 'deflate') {
            zlib.inflate(buffer, (err, out) => {
              if (err) {
                finish(buffer);
                return;
              }
              finish(out);
            });
            return;
          }

          finish(buffer);
        });
      });

      req.on('error', (error) => {
        reject(new Error(`Request failed: ${error.message}`));
      });

      if (body != null && body !== '') {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    };

    doRequest(url, MAX_REDIRECTS);
  });
}

/** Peticions TED/PSCP/PLACSP des del main (evita CSP del renderer). */
ipcMain.handle('licitacions-http-request', async (_event, payload) => {
  const { url, method, headers, body } = payload || {};
  if (!url || typeof url !== 'string') {
    throw new Error('URL requerida');
  }
  return licitacionsHttpRequest({ url, method, headers, body });
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

  // mailto: y http(s) deben abrirse en apps del sistema, no en pestañas de Chrome dentro de Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const u = String(url || '');
    if (/^mailto:/i.test(u)) {
      openMailtoInSystem(u).catch((err) => console.warn('openExternal mailto:', err?.message || err));
      return { action: 'deny' };
    }
    if (/^https?:\/\//i.test(u)) {
      shell.openExternal(u).catch((err) => console.warn('openExternal http:', err?.message || err));
      return { action: 'deny' };
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (/^mailto:/i.test(url)) {
      event.preventDefault();
      openMailtoInSystem(url).catch((err) => console.warn('will-navigate mailto:', err?.message || err));
    }
  });

  // Configurar Content Security Policy (muy permisiva para permitir Tesseract workers)
  // Asegurarse de que worker-src permita blob: explícitamente
  mainWindow.webContents.session.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self' 'unsafe-inline' data:; " +
          "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
          "style-src 'self' 'unsafe-inline'; " +
          "connect-src 'self' http://127.0.0.1:* http://localhost:* https://*.netlify.app https://*.vercel.app https://*.solucionssocials.org https://v6.exchangerate-api.com https://api.exchangerate-api.com https://zalnsacawwekmibhoiba.supabase.co https://*.supabase.co wss://zalnsacawwekmibhoiba.supabase.co wss://*.supabase.co https://api.holded.com https://api.github.com https://ipapi.co https://api.ted.europa.eu https://opendata.aoc.cat https://contrataciondelestado.es; " +
          "img-src 'self' data: blob: https://zalnsacawwekmibhoiba.supabase.co https://*.supabase.co;"
        ]
      }
    });
  });

  // Permitir geolocalización para el módulo de fichajes (ubicación al fichar entrada)
  mainWindow.webContents.session.setPermissionRequestHandler((_webContents, permission, callback) => {
    if (permission === 'geolocation') {
      callback(true);
    } else {
      callback(false);
    }
  });

  // and load the index.html of the app.
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);

  // Abrir DevTools automáticamente en desarrollo
  if (process.env.NODE_ENV === 'development' || process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  // Permitir abrir DevTools con F12 o Ctrl+Shift+I
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'F12' ||
      (input.control && input.shift && input.key === 'I') ||
      (input.control && input.shift && input.key === 'i')) {
      mainWindow.webContents.toggleDevTools();
    }
  });

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

  try {
    const cron = require('node-cron');
    cron.schedule(
      '0 8 * * 1',
      () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('licitacions-cron-sync');
          console.log('[licitacions] Cron semanal: sync solicitada al renderer');
        }
      },
      { timezone: 'Europe/Madrid' }
    );
    console.log('[licitacions] Cron semanal programado (lunes 08:00 Europe/Madrid)');
  } catch (err) {
    console.warn('[licitacions] No se pudo programar cron:', err?.message || err);
  }

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
