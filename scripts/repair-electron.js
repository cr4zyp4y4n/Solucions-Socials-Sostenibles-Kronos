/**
 * Reparar instalación de Electron cuando postinstall no extrae electron.exe.
 * Uso: npm run repair-electron
 */
const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');

const root = path.join(__dirname, '..');
const electronDir = path.join(root, 'node_modules', 'electron');
const { version } = require(path.join(electronDir, 'package.json'));
const { downloadArtifact } = require('@electron/get');

const platform = process.platform;
const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
const platformPath = platform === 'win32' ? 'electron.exe' : 'electron';

function extractZip(zipPath, destDir) {
  if (platform === 'win32') {
    fs.mkdirSync(destDir, { recursive: true });
    execFileSync(
      'powershell.exe',
      [
        '-NoProfile',
        '-Command',
        `Expand-Archive -Path '${zipPath.replace(/'/g, "''")}' -DestinationPath '${destDir.replace(/'/g, "''")}' -Force`
      ],
      { stdio: 'inherit' }
    );
    return;
  }
  const extract = require('extract-zip');
  return extract(zipPath, { dir: destDir });
}

async function main() {
  console.log(`Reparant Electron v${version} (${platform}-${arch})...`);

  const distPath = path.join(electronDir, 'dist');
  const pathFile = path.join(electronDir, 'path.txt');
  const exePath = path.join(distPath, platformPath);
  const tempDir = path.join(os.tmpdir(), `kronos-electron-repair-${Date.now()}`);

  console.log('Descarregant (o llegint de la cache)...');
  const zipPath = await downloadArtifact({
    version,
    artifactName: 'electron',
    platform,
    arch,
    force: true
  });
  console.log('ZIP:', zipPath);

  console.log('Extraient a carpeta temporal...');
  fs.mkdirSync(tempDir, { recursive: true });
  await extractZip(zipPath, tempDir);

  const tempExe = path.join(tempDir, platformPath);
  if (!fs.existsSync(tempExe)) {
    const listing = fs.readdirSync(tempDir).join(', ') || '(buit)';
    throw new Error(
      `No s'ha trobat ${platformPath} al ZIP. Contingut: ${listing}`
    );
  }
  console.log('Extract OK a temp:', tempExe);

  if (fs.existsSync(distPath)) {
    console.log('Netejant dist anterior...');
    fs.rmSync(distPath, { recursive: true, force: true });
  }

  console.log('Copiant a node_modules/electron/dist ...');
  fs.cpSync(tempDir, distPath, { recursive: true });

  if (!fs.existsSync(exePath)) {
    throw new Error(
      `${platformPath} no ha quedat a dist després de copiar. ` +
      'Windows Defender o l\'antivirus pot estar bloquejant electron.exe dins el projecte. ' +
      'Afegeix una exclusió per a la carpeta del projecte i torna a executar npm run repair-electron.'
    );
  }

  fs.writeFileSync(pathFile, platformPath);
  fs.rmSync(tempDir, { recursive: true, force: true });

  console.log('path.txt creat.');
  console.log('Electron reparat:', exePath);
  console.log('Ara executa: npm start');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Error reparant Electron:', err.message || err);
    process.exit(1);
  });
