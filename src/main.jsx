import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Import the MapLibre GL CSS file to ensure proper styling of the map and its controls
import 'maplibre-gl/dist/maplibre-gl.css'

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
