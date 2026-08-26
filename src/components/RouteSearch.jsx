import { useEffect, useState } from 'react'

const GEOCODING_URL = 'https://nominatim.openstreetmap.org/search'
const ROUTING_URL =
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving'

// Search for addresses and convert each result into coordinates.
async function searchPlaces(query, signal) {
  // Build safely encoded query-string parameters for the API request.
  const params = new URLSearchParams({
    format: 'jsonv2',
    q: query,
    limit: '5',
    addressdetails: '1',
    'accept-language': 'en',
  })

  // Send the geocoding request and support cancellation with AbortController.
  const response = await fetch(`${GEOCODING_URL}?${params}`, { signal })

  if (!response.ok) {
    throw new Error('The geocoding service is unavailable.')
  }

  const data = await response.json()

  return data.map((place) => ({
    id: String(place.place_id),
    name: place.display_name,
    coordinates: [Number(place.lon), Number(place.lat)],
  }))
}

// Request a walking route between two geocoded places.
async function getWalkingRoute(start, destination) {
  const coordinates = `${start.coordinates.join(',')};${destination.coordinates.join(',')}`
  const response = await fetch(
    `${ROUTING_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`,
  )

  if (!response.ok) {
    throw new Error('The walking route service is unavailable.')
  }

  const data = await response.json()

  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('No walking route was found between these addresses.')
  }

  const bestRoute = data.routes[0]

  return {
    start,
    destination,
    geometry: bestRoute.geometry,
    distanceMeters: bestRoute.distance,
    durationSeconds: bestRoute.duration,
  }
}

// Convert a distance in meters into an easy-to-read label.
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }

  return `${(meters / 1000).toFixed(2)} km`
}

function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))

  // Use a simple minute label for trips shorter than one hour.
  if (minutes < 60) {
    return `${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  // Return the combined hour-and-minute label.
  return `${hours} hr ${remainingMinutes} min`
}

// Render one labelled input and its optional suggestion dropdown.
function SearchField({
  id,
  label,
  placeholder,
  value,
  onChange,
  onFocus,
  suggestions,
  isSuggesting,
  isActive,
  onSelect,
  disabled,
}) {
  return (
    <div className="search-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onFocus={onFocus}
      />

      {!disabled && isActive && (isSuggesting || suggestions.length > 0) && (
        <div className="suggestions-panel">
          {isSuggesting ? (
            <p className="suggestion-status">Finding addresses…</p>
          ) : (
            <ul className="suggestions-list">
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => onSelect(suggestion)}
                  >
                    <span>{suggestion.name}</span>
                    <small>
                      {suggestion.coordinates[1].toFixed(4)},{' '}
                      {suggestion.coordinates[0].toFixed(4)}
                    </small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}

// Render the complete search panel and own all route-search state.
function RouteSearch({ onRouteReady }) {
  const [startQuery, setStartQuery] = useState(
    'Grand Central Terminal, New York',
  )
  const [destinationQuery, setDestinationQuery] = useState(
    'Empire State Building, New York',
  )
  const [selectedStart, setSelectedStart] = useState(null)
  const [selectedDestination, setSelectedDestination] = useState(null)
  const [activeField, setActiveField] = useState(null)
  const [suggestions, setSuggestions] = useState([])
  const [isSuggesting, setIsSuggesting] = useState(false)

  const [isRouting, setIsRouting] = useState(false)
  const [routeSummary, setRouteSummary] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const query = activeField === 'start' ? startQuery : destinationQuery

    if (!activeField || query.trim().length < 3) {
      return undefined
    }

    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      try {
        setIsSuggesting(true)
        const results = await searchPlaces(query, controller.signal)
        setSuggestions(results)
      } catch (requestError) {
        // Ignore cancellation errors because they are expected during typing.
        if (requestError.name !== 'AbortError') {
          // Clear stale suggestions after a real request error.
          setSuggestions([])
        }
      } finally {
        // Hide the loading message after the request finishes.
        setIsSuggesting(false)
      }
    }, 350)

    // Clean up the previous timer and request before this effect runs again.
    return () => {
      // Cancel the scheduled search when the query changes quickly.
      window.clearTimeout(timer)
      // Cancel any in-progress fetch for the outdated query.
      controller.abort()
    }
  }, [activeField, startQuery, destinationQuery])

  // Save a suggestion selected from either dropdown.
  function chooseSuggestion(field, suggestion) {
    if (field === 'start') {
      setStartQuery(suggestion.name)
      setSelectedStart(suggestion)
    } else {
      setDestinationQuery(suggestion.name)
      setSelectedDestination(suggestion)
    }

    // Close the dropdown after a selection.
    setActiveField(null)
    setSuggestions([])
    setError('')
  }

  // Return a selected place or geocode the typed text on form submission.
  async function resolvePlace(query, selectedPlace) {
    if (selectedPlace) {
      return selectedPlace
    }

    // Geocode the typed text when the user did not select a suggestion.
    const results = await searchPlaces(query)

    if (!results.length) {
      throw new Error(`No result found for “${query}”.`)
    }

    return results[0]
  }

  // Geocode both addresses and request a route when the form is submitted.
  async function handleSubmit(event) {
    event.preventDefault()

    if (!startQuery.trim() || !destinationQuery.trim()) {
      setError('Enter both a start address and a destination.')
      setRouteSummary(null)
      // Remove the older route from the parent App and MapView.
      onRouteReady(null)
      // Stop before sending any API requests.
      return
    }

    setIsRouting(true)
    setError('')
    setRouteSummary(null)
    onRouteReady(null)
    setActiveField(null)

    try {
      // Geocode both addresses at the same time for faster results.
      const [start, destination] = await Promise.all([
        // Resolve the start address to coordinates.
        resolvePlace(startQuery, selectedStart),
        // Resolve the destination address to coordinates.
        resolvePlace(destinationQuery, selectedDestination),
      ])

      setSelectedStart(start)
      setSelectedDestination(destination)
      // Display the standardized start address returned by the geocoder.
      setStartQuery(start.name)
      // Display the standardized destination address returned by the geocoder.
      setDestinationQuery(destination.name)

      // Request a walking route between the two coordinate pairs.
      const nextRoute = await getWalkingRoute(start, destination)
      // Display the returned distance, duration, and coordinates.
      setRouteSummary(nextRoute)
      onRouteReady(nextRoute)
    } catch (routeError) {
      const message =
        routeError instanceof Error
          ? routeError.message
          : 'An unexpected error stopped the route search.'
      // Display the safe, user-friendly message in the error alert.
      setError(message)
    } finally {
      setIsRouting(false)
    }
  }

  // Return the complete location-search interface.
  return (
    // Label this section so assistive technology can identify it.
    <section className="search-panel" aria-labelledby="search-heading">
      {/* Introduce the purpose of the panel. */}
      <div className="panel-intro">
        {/* Identify the current feature category. */}
        <p className="eyebrow">LOCATION SEARCH</p>
        {/* Give the search panel a clear heading. */}
        <h2 id="search-heading">Plan a walking route</h2>
        {/* Summarize the three steps performed by the component. */}
        <p>Search an address, convert it to coordinates, then request a route.</p>
      </div>

      {/* Submit both address inputs as one route request. */}
      <form
        className="search-form"
        onSubmit={handleSubmit}
        // CLASS 4: Tell assistive technology whether this form is busy.
        aria-busy={isRouting}
      >
        {/* Render the controlled start-address field. */}
        <SearchField
          // Connect the label to this unique field ID.
          id="start"
          // Display a short label above the input.
          label="Start"
          // Explain what the user should type.
          placeholder="Enter a starting address"
          // Pass the current start query into the input.
          value={startQuery}
          // CLASS 4: Lock the input while the route request is loading.
          disabled={isRouting}
          // Reset the selected place whenever the user edits the text.
          onChange={(value) => {
            // Save the new input text.
            setStartQuery(value)
            // Discard coordinates that belong to the previous text.
            setSelectedStart(null)
            // Open suggestions for the start field.
            setActiveField('start')
            // Clear stale suggestions immediately.
            setSuggestions([])
            // Reset the loading label until the delayed request begins.
            setIsSuggesting(false)
          }}
          // Open the start suggestions when this input receives focus.
          onFocus={() => setActiveField('start')}
          // Pass the shared suggestion array into the field.
          suggestions={suggestions}
          // Tell the field whether to show its loading message.
          isSuggesting={isSuggesting}
          // Only let the start field show the shared dropdown when active.
          isActive={activeField === 'start'}
          // Save a suggestion as the start place.
          onSelect={(suggestion) => chooseSuggestion('start', suggestion)}
        />

        {/* Render the controlled destination-address field. */}
        <SearchField
          // Connect the label to this unique field ID.
          id="destination"
          // Display a short label above the input.
          label="Destination"
          // Explain what the user should type.
          placeholder="Enter a destination"
          // Pass the current destination query into the input.
          value={destinationQuery}
          // CLASS 4: Lock the input while the route request is loading.
          disabled={isRouting}
          // Reset the selected place whenever the user edits the text.
          onChange={(value) => {
            // Save the new input text.
            setDestinationQuery(value)
            // Discard coordinates that belong to the previous text.
            setSelectedDestination(null)
            // Open suggestions for the destination field.
            setActiveField('destination')
            // Clear stale suggestions immediately.
            setSuggestions([])
            // Reset the loading label until the delayed request begins.
            setIsSuggesting(false)
          }}
          // Open destination suggestions when this input receives focus.
          onFocus={() => setActiveField('destination')}
          // Pass the shared suggestion array into the field.
          suggestions={suggestions}
          // Tell the field whether to show its loading message.
          isSuggesting={isSuggesting}
          // Only let the destination field show the dropdown when active.
          isActive={activeField === 'destination'}
          // Save a suggestion as the destination place.
          onSelect={(suggestion) =>
            chooseSuggestion('destination', suggestion)
          }
        />

        <button
          className="search-button"
          type="submit"
          disabled={isRouting}
          aria-describedby={isRouting || error ? 'route-feedback' : undefined}
        >
          {isRouting && <span className="loading-spinner" aria-hidden="true" />}
          <span>{isRouting ? 'Finding route…' : 'Search route'}</span>
        </button>
      </form>

      {isRouting && (
        <div
          id="route-feedback"
          className="request-status request-status-loading"
          role="status"
          aria-live="polite"
        >
          <span className="loading-spinner" aria-hidden="true" />
          <div>
            <strong>Finding your walking route…</strong>
            <span>Geocoding both addresses and calculating the route.</span>
          </div>
        </div>
      )}


      {error && (
        <div
          id="route-feedback"
          className="request-status request-status-error"
          // Use role="alert" so screen readers announce the problem immediately.
          role="alert"
        >
          <span className="error-icon" aria-hidden="true">!</span>
          <div>
            <strong>Route search failed</strong>
            <span>{error} Check the addresses and try again.</span>
          </div>
        </div>
      )}

      {routeSummary ? (
        // Announce updated route information without moving keyboard focus.
        <div className="route-summary" aria-live="polite">
          {/* Display the formatted walking distance. */}
          <div className="route-metric">
            <span>Walking distance</span>
            <strong>{formatDistance(routeSummary.distanceMeters)}</strong>
          </div>
          {/* Display the formatted estimated duration. */}
          <div className="route-metric">
            <span>Estimated duration</span>
            <strong>{formatDuration(routeSummary.durationSeconds)}</strong>
          </div>
          {/* Display the coordinate conversion results for both addresses. */}
          <div className="coordinate-summary">
            {/* Display the start latitude followed by longitude. */}
            <span>
              <b>Start coordinates</b>{' '}
              {routeSummary.start.coordinates[1].toFixed(5)},{' '}
              {routeSummary.start.coordinates[0].toFixed(5)}
            </span>
            {/* Display the destination latitude followed by longitude. */}
            <span>
              <b>Destination coordinates</b>{' '}
              {routeSummary.destination.coordinates[1].toFixed(5)},{' '}
              {routeSummary.destination.coordinates[0].toFixed(5)}
            </span>
          </div>
        </div>
      ) : (
        // Identify the two public demo services before a route is generated.
        <p className="demo-note">
          Demo APIs: OpenStreetMap Nominatim + routed-foot walking routes
        </p>
      )}
    </section>
  )
}

export default RouteSearch
