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
        {/* ================= CLASS 9: USER-FACING PRODUCT HEADER ============ */}
        {/* Replace classroom labels with a product name and task-focused copy. */}
        <div className="brand-mark" aria-hidden="true">
          AR
        </div>

        <div>
          <p className="eyebrow">ACCESSIBLE ROUTE GUIDE</p>
          {/* CLASS 9: Name the complete experience instead of one component. */}
          <h1>Accessible Route Explorer</h1>
          {/* CLASS 9: Describe the user benefit instead of the lesson number. */}
          <p className="subtitle">
            Explore mapped accessibility features and personalized guidance
          </p>
        </div>
        {/* CLASS 9: Replace the Class 8 badge with a feature-oriented label. */}
        <span className="class-pill">Route insights</span>
        {/* ================================================================= */}
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
