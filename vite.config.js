import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// ==================== CLASS 8: PROTECTED LOCAL BACKEND ====================
// CLASS 8: Import the protected local API route used by the React app.
import { createOpenAIApiPlugin } from './server/openaiRoute.js'

// CLASS 8: Export a function so Vite can load server-only environment variables.
export default defineConfig(({ mode }) => {
  // CLASS 8: Read .env without exposing values through VITE_ browser variables.
  const environment = loadEnv(mode, '.', '')

  // Return the complete Vite configuration for this lesson app.
  return {
    // Run React first, then register the Class 8 backend middleware.
    plugins: [react(), createOpenAIApiPlugin(environment)],
    // Keep MapLibre out of Vite's optimizer to avoid its worker-file error.
    optimizeDeps: {
      exclude: ['maplibre-gl'],
    },
  }
})
// ==========================================================================
