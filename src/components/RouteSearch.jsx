import { useEffect, useState } from 'react'

// Store the OpenStreetMap geocoding endpoint in one reusable constant.
const GEOCODING_URL = 'https://nominatim.openstreetmap.org/search'
// Store the pedestrian routing endpoint in one reusable constant.
const ROUTING_URL =
  'https://routing.openstreetmap.de/routed-foot/route/v1/driving'

// Search for addresses and convert each result into coordinates.
async function searchPlaces(query, signal) {
  // Build safely encoded query-string parameters for the API request.
  const params = new URLSearchParams({
    // Ask the API to return JSON data.
    format: 'jsonv2',
    // Send the user's address text as the search query.
    q: query,
    // Limit the dropdown to five useful suggestions.
    limit: '5',
    // Request detailed address information from Nominatim.
    addressdetails: '1',
    // Prefer English place labels for this English-language lesson.
    'accept-language': 'en',
  })

  // Send the geocoding request and support cancellation with AbortController.
  const response = await fetch(`${GEOCODING_URL}?${params}`, { signal })

  // Stop with a readable error if the server rejects the request.
  if (!response.ok) {
    throw new Error('The geocoding service is unavailable.')
  }

  const data = await response.json()

  // Reshape the API data into the smaller format used by this app.
  return data.map((place) => ({
    id: String(place.place_id),
    name: place.display_name,
    coordinates: [Number(place.lon), Number(place.lat)],
  }))
}

// Request a walking route between two geocoded places.
async function getWalkingRoute(start, destination) {
  // Convert both coordinate arrays to the URL format expected by OSRM.
  const coordinates = `${start.coordinates.join(',')};${destination.coordinates.join(',')}`
  // Ask for a complete GeoJSON line so MapLibre can draw the route.
  const response = await fetch(
    `${ROUTING_URL}/${coordinates}?overview=full&geometries=geojson&steps=false`,
  )

  // Stop with a readable error if the routing server fails.
  if (!response.ok) {
    throw new Error('The walking route service is unavailable.')
  }

  const data = await response.json()

  // Verify that the API returned at least one valid route.
  if (data.code !== 'Ok' || !data.routes?.length) {
    throw new Error('No walking route was found between these addresses.')
  }

  // Select the first route, which is the API's recommended route.
  const bestRoute = data.routes[0]

  // Return one normalized route object for the rest of the app.
  return {
    // Keep the geocoded start place for its name and marker.
    start,
    // Keep the geocoded destination for its name and marker.
    destination,
    // Keep the GeoJSON LineString used by MapLibre.
    geometry: bestRoute.geometry,
    // Keep the route distance in the API's original meter unit.
    distanceMeters: bestRoute.distance,
    // Keep the route duration in the API's original second unit.
    durationSeconds: bestRoute.duration,
  }
}

// Convert a distance in meters into an easy-to-read label.
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)} m`
  }

  // Convert longer distances to kilometers with two decimal places.
  return `${(meters / 1000).toFixed(2)} km`
}

// Convert a duration in seconds into minutes or hours and minutes.
function formatDuration(seconds) {
  const minutes = Math.max(1, Math.round(seconds / 60))

  // Use a simple minute label for trips shorter than one hour.
  if (minutes < 60) {
    return `${minutes} min`
  }

  // Calculate the complete number of hours.
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60

  return `${hours} hr ${remainingMinutes} min`
}

// Render one labelled input and its optional suggestion dropdown.
function SearchField({
  id,
  label,
  // Receive the hint shown when the input is empty.
  placeholder,
  // Receive the controlled input value from RouteSearch.
  value,
  // Receive the callback used whenever the user types.
  onChange,
  // Receive the callback used whenever the input gains focus.
  onFocus,
  // Receive the current array of address suggestions.
  suggestions,
  // Receive whether a suggestion request is still loading.
  isSuggesting,
  // Receive whether this field currently owns the dropdown.
  isActive,
  // Receive the callback used when the user chooses a suggestion.
  onSelect,
  // CLASS 4: Receive whether the parent request is loading.
  disabled,
}) {
  // Return the input and its dynamic dropdown.
  return (
    <div className="search-field">
      <label htmlFor={id}>{label}</label>
      <input
        // Match this input with the label above.
        id={id}
        type="text"
        value={value}
        placeholder={placeholder}
        // Disable unrelated browser autocomplete suggestions.
        autoComplete="off"
        // Prevent edits while the route request is running.
        disabled={disabled}
        // Send the latest text value back to RouteSearch.
        onChange={(event) => onChange(event.target.value)}
        // Mark this field as active when the user focuses it.
        onFocus={onFocus}
      />

      {/* Only show the dropdown for the active field while it has content. */}
      {!disabled && isActive && (isSuggesting || suggestions.length > 0) && (
        // Place suggestions in a floating panel below the input.
        <div className="suggestions-panel">
          {/* Switch between a loading message and the result list. */}
          {isSuggesting ? (
            // Tell the user that the geocoding request is running.
            <p className="suggestion-status">Finding addresses…</p>
          ) : (
            // Render the returned suggestions as a semantic list.
            <ul className="suggestions-list">
              {/* Create one list item for every geocoding result. */}
              {suggestions.map((suggestion) => (
                <li key={suggestion.id}>
                  <button
                    type="button"
                    // Keep the input focused until the click handler runs.
                    onMouseDown={(event) => event.preventDefault()}
                    // Send the selected place back to RouteSearch.
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

function RouteSearch({ onRouteReady }) {
    const [startQuery, setStartQuery] = useState(
        'Grand Central Terminal, New York',
    )
    const [destinationQuery, setDestinationQuery] = useState(
        'Empire State Building, New York',
    )
    // Store the exact geocoding result selected for the start and destination.
    const [selectedStart, setSelectedStart] = useState(null)
    const [selectedDestination, setSelectedDestination] = useState(null)
        
    // Remember which input currently controls the suggestion dropdown.
    const [activeField, setActiveField] = useState(null)
    // Store the latest address suggestions returned by Nominatim.
    const [suggestions, setSuggestions] = useState([])
    // Track whether the suggestion API request is loading.
    const [isSuggesting, setIsSuggesting] = useState(false)

        // Store whether the complete route request is currently running.
    const [isRouting, setIsRouting] = useState(false)
    // Store route metrics displayed below the form after a successful request.
    const [routeSummary, setRouteSummary] = useState(null)
    // Store a message that explains the latest request failure.
    const [error, setError] = useState('')

  // Search for suggestions after the user pauses typing.
  useEffect(() => {
    // Read the query that belongs to the currently active input.
    const query = activeField === 'start' ? startQuery : destinationQuery

    // Skip the API request when no field is active or the query is too short.
    if (!activeField || query.trim().length < 3) {
      // Return no cleanup function because no timer was created.
      return undefined
    }

    // Create a controller so an outdated fetch can be cancelled.
    const controller = new AbortController()
    // Wait briefly so the app does not request on every keystroke.
    const timer = window.setTimeout(async () => {
      // Handle both successful and failed API requests.
      try {
        // Show the loading message in the dropdown.
        setIsSuggesting(true)
        // Fetch address suggestions for the current query.
        const results = await searchPlaces(query, controller.signal)
        // Display the returned suggestions.
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
    // Update the start state when the start field owns the dropdown.
    if (field === 'start') {
      // Replace the typed query with the selected full address.
      setStartQuery(suggestion.name)
      // Remember the selected coordinates.
      setSelectedStart(suggestion)
    } else {
      // Replace the destination query with the selected full address.
      setDestinationQuery(suggestion.name)
      // Remember the selected destination coordinates.
      setSelectedDestination(suggestion)
    }

    // Close the dropdown after a selection.
    setActiveField(null)
    // Remove suggestions that are no longer needed.
    setSuggestions([])
    // Clear any older error message.
    setError('')
  }

  // Return a selected place or geocode the typed text on form submission.
  async function resolvePlace(query, selectedPlace) {
    // Reuse the selected suggestion when it is already available.
    if (selectedPlace) {
      // Avoid an unnecessary second API request.
      return selectedPlace
    }

    // Geocode the typed text when the user did not select a suggestion.
    const results = await searchPlaces(query)

    // Stop if the geocoder could not find a matching place.
    if (!results.length) {
      // Include the original query so the error is easy to understand.
      throw new Error(`No result found for “${query}”.`)
    }

    // Use the geocoder's best match.
    return results[0]
  }

  // Geocode both addresses and request a route when the form is submitted.
  async function handleSubmit(event) {
    // Stop the browser from reloading the page.
    event.preventDefault()

    // Validate that both required fields contain text.
    if (!startQuery.trim() || !destinationQuery.trim()) {
      // CLASS 4 ERROR: Explain what information is missing.
      setError('Enter both a start address and a destination.')
      // Remove route metrics that belong to an older request.
      setRouteSummary(null)
      // Remove the older route from the parent App and MapView.
      onRouteReady(null)
      // Stop before sending any API requests.
      return
    }

    // Enter the loading state before asynchronous work starts.
    setIsRouting(true)
    // CLASS 4 ERROR: Clear the previous error before trying again.
    setError('')
    // Clear old metrics so users do not mistake them for the new request.
    setRouteSummary(null)
    // Clear the old map route while the new route is being calculated.
    onRouteReady(null)
    // Close any open suggestion dropdown.
    setActiveField(null)

    // Use try, catch, and finally for the complete request lifecycle.
    try {
      // Geocode both addresses at the same time for faster results.
      const [start, destination] = await Promise.all([
        // Resolve the start address to coordinates.
        resolvePlace(startQuery, selectedStart),
        // Resolve the destination address to coordinates.
        resolvePlace(destinationQuery, selectedDestination),
      ])

      // Save the resolved start place for future submissions.
      setSelectedStart(start)
      // Save the resolved destination for future submissions.
      setSelectedDestination(destination)
      // Display the standardized start address returned by the geocoder.
      setStartQuery(start.name)
      // Display the standardized destination address returned by the geocoder.
      setDestinationQuery(destination.name)

      // Request a walking route between the two coordinate pairs.
      const nextRoute = await getWalkingRoute(start, destination)
      // Display the returned distance, duration, and coordinates.
      setRouteSummary(nextRoute)
      // Send the route to App so MapView can draw it.
      onRouteReady(nextRoute)
    } catch (routeError) {
      // CLASS 4 ERROR: Check whether JavaScript gave us a real Error object.
      const message =
        routeError instanceof Error
          ? routeError.message
          : 'An unexpected error stopped the route search.'
      // Display the safe, user-friendly message in the error alert.
      setError(message)
    } finally {
      // CLASS 4 LOADING: Always leave loading after success or failure.
      setIsRouting(false)
    }
  }

  // Return the complete location-search interface.
  return (
    // Label this section so assistive technology can identify it.
    <section className="search-panel" aria-labelledby="search-heading">
      <div className="panel-intro">
        <p className="eyebrow">LOCATION SEARCH</p>
        <h2 id="search-heading">Plan a walking route</h2>
        <p>Search an address, convert it to coordinates, then request a route.</p>
      </div>

      <form
        className="search-form"
        onSubmit={handleSubmit}
        // Tell assistive technology whether this form is busy.
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
          // Lock the input while the route request is loading.
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
          // Lock the input while the route request is loading.
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

        {/* Disable repeated submissions while one request is loading. */}
        <button
          className="search-button"
          type="submit"
          disabled={isRouting}
          aria-describedby={isRouting || error ? 'route-feedback' : undefined}
        >
          {/*  Add a visual spinner only during loading. */}
          {isRouting && <span className="loading-spinner" aria-hidden="true" />}
          {/*  Replace the normal label with immediate loading feedback. */}
          <span>{isRouting ? 'Finding route…' : 'Search route'}</span>
        </button>
      </form>

      {/* ================= LOADING FEEDBACK ================= */}
      {/* Render a visible and screen-reader-friendly status while waiting. */}
      {isRouting && (
        <div
          id="route-feedback"
          className="request-status request-status-loading"
          role="status"
          aria-live="polite"
        >
          {/* Repeat the spinner so the page status is easy to find. */}
          <span className="loading-spinner" aria-hidden="true" />
          {/* Explain which asynchronous work is happening. */}
          <div>
            <strong>Finding your walking route…</strong>
            <span>Geocoding both addresses and calculating the route.</span>
          </div>
        </div>
      )}

      {/* ================== ERROR FEEDBACK ================== */}
      {/* Announce the error only when an error message exists. */}
      {error && (
        <div
          id="route-feedback"
          className="request-status request-status-error"
          // Use role="alert" so screen readers announce the problem immediately.
          role="alert"
        >
          {/* Use a simple symbol that does not depend on an icon library. */}
          <span className="error-icon" aria-hidden="true">!</span>
          {/* Give the error a heading and a specific recovery message. */}
          <div>
            <strong>Route search failed</strong>
            <span>{error} Check the addresses and try again.</span>
          </div>
        </div>
      )}

      {/* Switch between live route metrics and the default API note. */}
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
