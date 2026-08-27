import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  base: '/navigator/',
  server: {
    allowedHosts: ["ai-nav.redirectme.net", "ai-gov-navigator.mycourses.workers.dev", "localhost"],
  },
  plugins: [react(), tailwindcss()],
})
