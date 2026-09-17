import { useState } from 'react'
import MapView from './components/MapView'
// Import the route search component that owns all search and routing logic.
import RouteSearch from './components/RouteSearch'

// Store the example markers shown before the user generates a route.
const points = [
  {
    // Give React and MapLibre a stable identifier for this marker.
    id: 'grand-central',
    name: 'Grand Central Terminal',
    coordinates: [-73.9772, 40.7527],
    color: '#9b4dff',
  },
  {
    // Give this marker its own stable identifier.
    id: 'bryant-park',
    name: 'Bryant Park',
    coordinates: [-73.9832, 40.7536],
    color: '#13b8a2',
  },
  {
    // Give this marker its own stable identifier.
    id: 'empire-state',
    name: 'Empire State Building',
    coordinates: [-73.9857, 40.7484],
    color: '#ff8559',
  },
]

function App() {
  // Save the route returned by RouteSearch so MapView can draw it.
  const [route, setRoute] = useState(null)

  // Return the page structure that React renders in the browser.
  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          AM
        </div>

        <div>
          <p className="eyebrow">ACCESSIBLE MAP STUDIO</p>
          {/* CLASS 8: Update the app heading to match the live AI lesson. */}
          <h1>AI Accessibility Assistant</h1>
          {/* CLASS 8: Tell students which new layer this version demonstrates. */}
          <p className="subtitle">
            Class 8 · Live OpenAI reports from route evidence
          </p>
        </div>
        {/* CLASS 8: Keep the lesson label visible during the live demo. */}
        <span className="class-pill">Class 8 API</span>
      </header>

      <main className="app-layout">
        {/* Pass setRoute as a callback so RouteSearch can publish a new route. */}
        <RouteSearch onRouteReady={setRoute} />
        {/* Pass the default markers and current route into the map. */}
        <MapView points={points} route={route} />
      </main>
    </div>
  )
}

// Export App so main.jsx can render it.
export default App

