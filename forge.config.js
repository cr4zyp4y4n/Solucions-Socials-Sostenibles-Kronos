const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('node:path');
const fs = require('node:fs');
const pngToIco = require('png-to-ico');
const sharp = require('sharp');

async function ensureWindowsIco() {
  const pngPath = path.resolve(__dirname, 'src', 'assets', 'Logo Minimalist SSS High Opacity.PNG');
  const outDir = path.resolve(__dirname, 'src', 'assets', 'icons');
  const icoPath = path.resolve(outDir, 'app.ico');

  if (!fs.existsSync(pngPath)) {
    throw new Error(`No se encontró el PNG del logo: ${pngPath}`);
  }
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(icoPath)) {
    // png-to-ico requiere PNG cuadrado; normalizamos a 256x256 con fondo transparente.
    const normalizedPng = await sharp(pngPath)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    const buf = await pngToIco(normalizedPng);
    fs.writeFileSync(icoPath, buf);
  }
  return icoPath;
}

module.exports = {
  packagerConfig: {
    asar: true,
    // Icono del ejecutable (.exe) y del acceso directo (Windows).
    // En Windows Electron Packager espera una ruta a .ico (o sin extensión).
    icon: path.resolve(__dirname, 'src', 'assets', 'icons', 'app.ico'),
  },
  rebuildConfig: {},
  hooks: {
    // Asegura que el .ico exista antes de empaquetar (Windows).
    prePackage: async () => {
      await ensureWindowsIco();
    },
  },
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Icono del instalador Squirrel (Setup.exe)
        setupIcon: path.resolve(__dirname, 'src', 'assets', 'icons', 'app.ico'),
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    // maker-dmg, maker-deb, maker-rpm quitados para evitar error en Windows si no están instalados
    // Para publicar en Mac/Linux, instala @electron-forge/maker-dmg (Mac) o maker-deb/maker-rpm (Linux) y añádelos aquí
  ],
  publishers: [
    {
      name: '@electron-forge/publisher-github',
      config: {
        repository: {
          owner: 'cr4zyp4y4n',
          name: 'Solucions-Socials-Sostenibles-Kronos'
        },
        prerelease: false,
        draft: false,
        // Token de GitHub desde variable de entorno
        token: process.env.GITHUB_TOKEN
      }
    }
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    {
      name: '@electron-forge/plugin-webpack',
      config: {
        mainConfig: './webpack.main.config.js',
        renderer: {
          config: './webpack.renderer.config.js',
          entryPoints: [
            {
              html: './src/index.html',
              js: './src/renderer.js',
              name: 'main_window',
              preload: {
                js: './src/preload.js',
              },
            },
          ],
        },
      },
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
