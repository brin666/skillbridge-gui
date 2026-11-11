import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.SKILLBRIDGE_API_TARGET || 'http://127.0.0.1:17321'
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
