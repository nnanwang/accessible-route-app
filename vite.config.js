import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  
  // Exclude maplibre-gl from optimization to avoid issues with its WebAssembly module
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  }
})
