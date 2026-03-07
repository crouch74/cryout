import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    allowedHosts: ['887f-2001-1c00-5605-6900-987-e15a-3501-d2af.ngrok-free.app'],
    proxy: {
      '/api': {
        target: 'http://dashboard-api:8000',
        changeOrigin: true,
      }
    }
  }
})
