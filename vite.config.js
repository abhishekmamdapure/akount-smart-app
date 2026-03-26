import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiUrl = env.VITE_API_BASE_URL || ''

  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
        '/invoice-processing-proxy': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/invoice-processing-proxy/, ''),
        },
        '/tally-xml-proxy': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/tally-xml-proxy/, ''),
        },
        '/gst-reconciliation-proxy': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/gst-reconciliation-proxy/, ''),
        },
        '/password-manager-proxy': {
          target: apiUrl,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/password-manager-proxy/, ''),
        },
      }
    }
  }
})
