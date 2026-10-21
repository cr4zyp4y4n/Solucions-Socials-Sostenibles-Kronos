import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: '@shared-obrador', replacement: path.resolve(__dirname, '../shared/obrador') },
      // shared/obrador queda fora de portal-obrador. En Netlify només hi ha
      // node_modules aquí, i Rollup resol els imports des de la carpeta del fitxer.
      { find: /^tesseract\.js$/, replacement: path.resolve(__dirname, 'node_modules/tesseract.js') },
      { find: /^pdfjs-dist$/, replacement: path.resolve(__dirname, 'node_modules/pdfjs-dist') }
    ]
  },
  server: {
    fs: {
      allow: [path.resolve(__dirname, '..')]
    }
  },
  build: {
    outDir: 'dist'
  }
});
