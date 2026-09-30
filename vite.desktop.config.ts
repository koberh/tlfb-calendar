import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';

export default defineConfig({
  root: fileURLToPath(new URL('./desktop/renderer', import.meta.url)),
  base: './', plugins: [react()],
  build: {outDir: '../../desktop-dist', emptyOutDir: true, sourcemap: false},
});
