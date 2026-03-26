import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/invoice-processing-proxy': {
        target: 'https://gst-tools-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/invoice-processing-proxy/, ''),
      },
      '/tally-xml-proxy': {
        target: 'https://gst-tools-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/tally-xml-proxy/, ''),
      },
      '/gst-reconciliation-proxy': {
        target: 'https://gst-tools-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/gst-reconciliation-proxy/, ''),
      },
      '/password-manager-proxy': {
        target: 'https://gst-tools-production.up.railway.app',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/password-manager-proxy/, ''),
      },
    }
  }
})
