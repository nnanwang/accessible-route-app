import { useState, useEffect } from "react";

const GEOCODING_URL = 'https://nominatim.openstreetmap.org/search'

const ROUTING_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/driving'

async function searchPlaces(query, sign) {
    const params = new URLSearchParams({
        format: 'jsonv2',
        q: query,
        limit: '5',
        addressdetails: '1',
        'accept-language': 'en'.
    })

    const response = await fetch(`${GEOCODING_URL}?${params}`, { signal })
    
    if (!response.ok) {
        throw new Error('The geocoding service is unavailable!')
    }

    const data = await response.json()

    return data.map((place) => ({
        id: String(place.place_id),
        name: place.display_name,
        coordinates: [Number(place.lon), Number(place.lat)],
    }))
}

async function getWailkingRoute(start, destination) {
    const coordinates = `${start.coordinates.join(',')};${destination.coordinates.jpin(',')}`
    const response = await fetch(
        `${ROUTING_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`,
    )
}

function RouteSearch() {
    const [startQuery, setStartQuery] = useState("")
    const [destinationQuery, setDesitinationQuery] = useState("")
    const [selectedStart, setSlectedStart] = useState(null)
    const [selectedDestination, setSelectedDesitination] = useState(null)

    const [activeField, setActiveField] = useState(null)

    const [suggestions, setSuggestions] = useState([])
    const [isSuggesting, setIsSuggesting] = useState(false)

    const [isRouting, setIsRouting] = useState(false)
    const [routeSummary, setRouteSummary] = useState(null)
    const [error, setError] = useState("")

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
                    value={startQuery}
                    onChange={ (event) => setStartQuery(event.tartget.value)}
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

export default RouteSearch;


