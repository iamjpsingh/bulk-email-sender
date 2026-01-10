/**
 * Vite Configuration
 * Explicit proxy paths to avoid frontend route conflicts
 * 
 * Frontend routes: /, /login, /compose, /reports, /configs
 * Backend routes must NOT match these
 */
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

const API_URL = process.env.VITE_API_URL || 'http://localhost:3000'

export default defineConfig({
  plugins: [vue()],
  
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  
  server: {
    port: 5173,
    proxy: {
      // ========================================
      // Auth routes
      // ========================================
      '/auth/login': { target: API_URL, changeOrigin: true },
      '/auth/register': { target: API_URL, changeOrigin: true },
      '/auth/logout': { target: API_URL, changeOrigin: true },
      '/auth/me': { target: API_URL, changeOrigin: true },
      '/auth/google': { target: API_URL, changeOrigin: true },
      '/auth/microsoft': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // OAuth routes
      // ========================================
      '/oauth': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // User routes
      // ========================================
      '/user': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Config routes (NOT /configs - that's frontend)
      // ========================================
      '/config/list': { target: API_URL, changeOrigin: true },
      '/config/smtp': { target: API_URL, changeOrigin: true },
      '/config/create': { target: API_URL, changeOrigin: true },
      '/config/update': { target: API_URL, changeOrigin: true },
      '/config/delete': { target: API_URL, changeOrigin: true },
      '/config/test': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Report routes (NOT /reports - that's frontend)
      // ========================================
      '/report/logs': { target: API_URL, changeOrigin: true },
      '/report/stats': { target: API_URL, changeOrigin: true },
      '/report/campaigns': { target: API_URL, changeOrigin: true },
      '/report/export': { target: API_URL, changeOrigin: true },
      '/report/clear': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Dashboard routes
      // ========================================
      '/dashboard': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Send routes
      // ========================================
      '/send': { target: API_URL, changeOrigin: true },
      '/parse-excel': { target: API_URL, changeOrigin: true },
      '/provider-info': { target: API_URL, changeOrigin: true },
      '/test-notification': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Tracking routes
      // ========================================
      '/track': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Batch routes
      // ========================================
      '/batch-status': { target: API_URL, changeOrigin: true },
      '/batch-pause': { target: API_URL, changeOrigin: true },
      '/batch-resume': { target: API_URL, changeOrigin: true },
      '/batch-cancel': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Schedule routes
      // ========================================
      '/scheduled-jobs': { target: API_URL, changeOrigin: true },
      
      // ========================================
      // Health & static
      // ========================================
      '/health': { target: API_URL, changeOrigin: true },
      '/public': { target: API_URL, changeOrigin: true },
    },
  },
  
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
