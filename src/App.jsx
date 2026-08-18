import { useState } from 'react'
import MapView from './components/MapView'
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
  const [route, setRoute] = useState(null)

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark" aria-hidden="true">
          AM
        </div>

        <div>
          <p className="eyebrow">ACCESSIBLE MAP STUDIO</p>
          <h1>Location Search &amp; Route Generation</h1>
          <p className="subtitle">
            Class 4 · Loading states and error handling
          </p>
        </div>
        <span className="class-pill">Class 4 update</span>
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

export default App
