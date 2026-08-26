import { useState } from 'react'
import MapView from './components/MapView'
import RouteSearch from './components/RouteSearch'

// Store the example markers shown before the user generates a route.
const points = [
  {
    id: 'grand-central',
    name: 'Grand Central Terminal',
    coordinates: [-73.9772, 40.7527],
    color: '#9b4dff',
  },
  {
    id: 'bryant-park',
    name: 'Bryant Park',
    coordinates: [-73.9832, 40.7536],
    color: '#13b8a2',
  },
  {
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
          <h1>Route Evaluation Framework</h1>
          <p className="subtitle">
            Class 5 · OpenStreetMap accessibility data and Overpass API
          </p>
        </div>
        <span className="class-pill">Class 5 update</span>
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
