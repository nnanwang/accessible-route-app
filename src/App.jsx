import MapView from './components/MapView'

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

function SearchPanel() {
  function handleSubmit(event) {
    event.preventDefault()
  }

return (
  <section className="search-panel" aria-labelledby="search-panel-title">
    <div className="search-panel-heading">
      <p className="section-kicker">Search your route</p>
        <h2 id="search-panel-title">Search Panel</h2>
    </div>

      <form className="search-form" onSubmit={handleSubmit}>
        <label className="search-field">
          <span>Start</span>
          <input
            type="text"
            name="start"
            placeholder="Enter a starting address"
            autoComplete="street-address"
          />
        </label>

        <label className="search-field">
          <span>Destination</span>
          <input
            type="text"
            name="destination"
            placeholder="Enter a destination"
            autoComplete="street-address"
          />
        </label>

        <button type="submit" className="search-button">
          Search
        </button>
      </form>

                                                                                                                                                                                                                                        
    </section>
  )
}

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
          <SearchPanel />
          <MapView points={points} />
        </main>
      </div>
    )
    }

  export default App