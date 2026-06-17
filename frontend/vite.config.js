import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// In production (Render), VITE_API_URL is '' so all /api calls hit same origin
// In development, proxy forwards /api to the local FastAPI server
export default defineConfig({
  plugins: [react()],
  publicDir: 'public',

  server: {
    port: 5173,
    proxy: {
      '/api':     { target: 'http://localhost:8000', changeOrigin: true },
      '/health':  { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },

  build: {
    // Build directly into the project root dist/ so FastAPI can serve it
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks: { vendor: ['react','react-dom','react-router-dom'] },
      },
    },
  },
  envPrefix: 'VITE_',
})
