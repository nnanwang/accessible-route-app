import MapView from './components/MapView'
import RouteSearch from './components/RouteSearch'

const points = [
  {
    id: 'start',
    name: 'Grand Central Terminal',
    coordinates: [-73.9772, 40.7527],
    color: '#9b4dff',
  },
  {
    id: 'landmark',
    name: 'Bryant Park',
    coordinates: [-73.9832, 40.7536],
    color: '#ff8559',
  },
  {
    id: 'destination',
    name: 'Empire State Building',
    coordinates: [-73.9857, 40.7484],
    color: '#16b89f',
  },
]


  function App() {
    return (
      <div className="app-shell">
        <header className="topbar">
          <div className="brand-mark" aria-hidden="true">
            AM
          </div>
            
          <div className="brand-copy">
            <h1>Accessible Map Lab</h1>
            <p>Class 2 · React, MapLibre, layout, and markers</p>
          </div>
          <span className="demo-pill">Interactive map</span>
        </header>

        <main className="app-layout">
          <RouteSearch />
          <MapView points={points} />
        </main>
      </div>
    )
    }

  export default App