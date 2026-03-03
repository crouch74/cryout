import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'pages' ? './' : '/',
  plugins: [react()],
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./core', import.meta.url)),
      '@scenarios': fileURLToPath(new URL('./scenarios', import.meta.url)),
      '@engine-legacy': fileURLToPath(new URL('./engine/legacy', import.meta.url)),
    },
  },
}));
