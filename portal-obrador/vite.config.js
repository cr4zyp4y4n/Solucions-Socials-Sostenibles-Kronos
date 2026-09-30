import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared-obrador': path.resolve(__dirname, '../shared/obrador')
    }
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
