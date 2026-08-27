import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/navigator/',
  server: {
    allowedHosts: ["ai-nav.redirectme.net", "ai-gov-navigator.mycourses.workers.dev", "localhost"],
    proxy: {
      '/aigov': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true
      },
      '/dummygov': {
        target: 'http://127.0.0.1:8001',
        changeOrigin: true
      }
    }
  },
  plugins: [react(), tailwindcss()],
})
