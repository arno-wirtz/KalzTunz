import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

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
    outDir: '../dist',
    emptyOutDir: true,
    sourcemap: false,
    // Fixed: Vite 8's rolldown bundler no longer bundles esbuild itself.
    // Explicitly requesting minify:'esbuild' now requires esbuild as a
    // standalone dependency, which isn't installed in this project.
    // Omit the option (or set 'oxc') to use rolldown's built-in minifier.
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        // vite 8 requires manualChunks as a Function, not Object
        manualChunks(id) {
          if (id.includes('node_modules/react') ||
              id.includes('node_modules/react-dom') ||
              id.includes('node_modules/react-router-dom') ||
              id.includes('node_modules/scheduler')) {
            return 'vendor'
          }
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'pdf'
          }
        },
      },
    },
  },
  envPrefix: 'VITE_',
})
