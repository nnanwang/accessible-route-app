// Import StrictMode to highlight potential React problems during development.
import { StrictMode } from 'react'
// Import createRoot so React can control the page's root element.
import { createRoot } from 'react-dom/client'
// Import MapLibre's required default styles once for the whole application.
import 'maplibre-gl/dist/maplibre-gl.css'
// Import the custom visual styles for this project.
import './index.css'
// Import the top-level application component.
import App from './App.jsx'

// Find the root div in index.html and create a React root inside it.
createRoot(document.getElementById('root')).render(
  // Use StrictMode to run extra development checks without changing production UI.
  <StrictMode>
    {/* Render the complete accessible map application. */}
    <App />
  </StrictMode>,
)
