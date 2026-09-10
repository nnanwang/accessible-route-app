// Import the Hooks used to create, remember, and clean up the map.
import { useEffect, useMemo, useRef, useState } from 'react'
// Import the MapLibre library that renders the interactive map.
import * as maplibregl from 'maplibre-gl'
// Import MapLibre's required control, popup, and canvas styles.
import 'maplibre-gl/dist/maplibre-gl.css'
// CLASS 5: Import the Overpass query and readable category labels.
import {
  ACCESSIBILITY_CATEGORY_LABELS,
  getAccessibilityFeatures,
} from '../services/overpass'
// CLASS 6: Import the pure calculation that turns OSM evidence into a score.
import { calculateAccessibilityScore } from '../services/accessbilityScore'
// CLASS 6: Import the visual score, coverage, barrier, and risk summary.
import AccessibilityScoreCard from './AccessibilityScoreCard'


// Define a simple MapLibre style that uses OpenStreetMap raster tiles.
const MAP_STYLE = {
  // Use version 8 of the Mapbox Style Specification supported by MapLibre.
  version: 8,
  // Register every data source used by this base map.
  sources: {
    // Give the OpenStreetMap tile source a reusable name.
    openStreetMap: {
      // Tell MapLibre that this source provides raster image tiles.
      type: 'raster',
      // Provide the URL pattern used to request tiles at each zoom and position.
      tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
      // Tell MapLibre that each tile image is 256 pixels square.
      tileSize: 256,
      // Credit the data provider as required by OpenStreetMap's license.
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    },
  },

  // Define the visual layers drawn from the registered sources.
  layers: [
    // Draw the OpenStreetMap raster tiles as the base layer.
    {
      // Give the layer a stable unique ID.
      id: 'open-street-map',
      // Render this layer as raster images.
      type: 'raster',
      // Connect the layer to the source defined above.
      source: 'openStreetMap',
    },
  ],
}
// Reuse one ID for the GeoJSON route data source.
const ROUTE_SOURCE_ID = 'walking-route'
// Reuse one ID for the styled line layer drawn from that source.
const ROUTE_LAYER_ID = 'walking-route-line'
// ==================== CLASS 5: ACCESSIBILITY DATA LAYER ====================
// Reuse one ID for the GeoJSON accessibility feature collection.
const ACCESSIBILITY_SOURCE_ID = 'osm-accessibility-features'
// Reuse one ID for the colored feature circles drawn above the map.
const ACCESSIBILITY_LAYER_ID = 'osm-accessibility-points'
// Reuse a second layer ID for the soft halo behind the selected category.
const ACCESSIBILITY_HIGHLIGHT_LAYER_ID = 'osm-accessibility-highlight'
// Create an empty GeoJSON collection for reset and loading states.
const EMPTY_FEATURE_COLLECTION = {
  type: 'FeatureCollection',
  features: [],
}
// Match each accessibility category to a consistent map and legend color.
const ACCESSIBILITY_COLORS = {
  accessible: '#159f86',
  limited: '#e09b2d',
  barrier: '#d1495b',
  steps: '#8f42ed',
  elevator: '#247ba0',
  information: '#667b78',
}
// ===========================================================================

// CLASS 5: Show complete information for the facility selected on the map.
function FacilityDetail({ facility, onClose }) {
  // Remember when a remote OSM image cannot be loaded.
  const [imageFailed, setImageFailed] = useState(false)
  // Keep the normalized properties easy to read throughout this component.
  const details = facility.properties
  // Display an image only when OSM supplied a usable URL.
  const hasImage = Boolean(details.imageUrl) && !imageFailed
  // Build a direct link back to the original OpenStreetMap record.
  const osmUrl = `https://www.openstreetmap.org/${details.osmType}/${details.osmId}`

  return (
    <section className="facility-detail-section" aria-label="Facility details">
      <div className="facility-detail-header">
        <div>
          <p className="eyebrow">SELECTED FACILITY</p>
          <h2>{details.name}</h2>
        </div>
        <button
          className="facility-detail-close"
          type="button"
          aria-label="Close facility details"
          onClick={onClose}
        >
          ×
        </button>
      </div>

      {hasImage ? (
        <img
          className="facility-detail-image"
          src={details.imageUrl}
          alt={`OpenStreetMap image for ${details.name}`}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <div className="facility-image-placeholder" role="img" aria-label="No facility image available">
          <span aria-hidden="true">◇</span>
          <strong>No image in OpenStreetMap</strong>
          <small>An OSM contributor can add an image tag.</small>
        </div>
      )}

      <span
        className="facility-category-badge"
        style={{ '--facility-color': ACCESSIBILITY_COLORS[details.category] }}
      >
        {details.categoryLabel}
      </span>

      <p className="facility-description">{details.description}</p>

      <dl className="facility-detail-list">
        <div>
          <dt>Wheelchair</dt>
          <dd>{details.wheelchair}</dd>
        </div>
        {details.wheelchairDescription && (
          <div>
            <dt>Access note</dt>
            <dd>{details.wheelchairDescription}</dd>
          </div>
        )}
        {details.openingHours && (
          <div>
            <dt>Opening hours</dt>
            <dd>{details.openingHours}</dd>
          </div>
        )}
        {details.address && (
          <div>
            <dt>Address</dt>
            <dd>{details.address}</dd>
          </div>
        )}
        <div>
          <dt>Coordinates</dt>
          <dd>
            {facility.coordinates[1].toFixed(5)}, {facility.coordinates[0].toFixed(5)}
          </dd>
        </div>
      </dl>

      <a className="facility-osm-link" href={osmUrl} target="_blank" rel="noreferrer">
        View original OSM record
      </a>
    </section>
  )
}

// Render the interactive map, markers, and optional route.
function MapView({ points, route }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  // Remember the right MapView sidebar so selected details can scroll into view.
  const informationPanelRef = useRef(null)
  // CLASS 5: Store normalized OSM accessibility features returned by Overpass.
  const [accessibilityData, setAccessibilityData] = useState(
    EMPTY_FEATURE_COLLECTION,
  )
  // CLASS 5: Track whether the Overpass request is idle, loading, or complete.
  const [accessibilityStatus, setAccessibilityStatus] = useState('idle')
  // CLASS 5: Store a readable error when the Overpass request fails.
  const [accessibilityError, setAccessibilityError] = useState('')
  // CLASS 5: Store the category chosen from the interactive facility legend.
  const [activeCategory, setActiveCategory] = useState(null)
  // CLASS 5: Store the facility selected from the map's circle layer.
  const [selectedFacility, setSelectedFacility] = useState(null)
  // Store whether the combined MapLibre and OSM information panel is visible.
  const [isInformationOpen, setIsInformationOpen] = useState(true)
  // Derive the visible status so clearing the route immediately resets the UI.
  const displayedAccessibilityStatus = route ? accessibilityStatus : 'idle'
  // Do not report facilities from an older route after the route is cleared.
  const displayedFeatureCount = route ? accessibilityData.features.length : 0
  // Count each category so the facility filter communicates its result size.
  const categoryCounts = Object.keys(ACCESSIBILITY_CATEGORY_LABELS).reduce(
    (counts, category) => ({
      ...counts,
      [category]: accessibilityData.features.filter(
        (feature) => feature.properties.category === category,
      ).length,
    }),
    {},
  )
  // CLASS 6: Combine explicit barriers and steps for the risk-map shortcut.
  const activeCategoryCount =
    activeCategory === 'risk'
      ? categoryCounts.barrier + categoryCounts.steps
      : categoryCounts[activeCategory]
  // CLASS 6: Give the combined risk filter a readable summary label.
  const activeCategoryLabel =
    activeCategory === 'risk'
      ? 'Barrier and steps'
      : ACCESSIBILITY_CATEGORY_LABELS[activeCategory]
  // CLASS 6: Recalculate only when the current route's facility data changes.
  const accessibilityScore = useMemo(
    () => calculateAccessibilityScore(accessibilityData.features),
    [accessibilityData],
  )

  // Reveal the detail section appended at the sidebar's bottom after a map click.
  useEffect(() => {
    if (!selectedFacility || !isInformationOpen) {
      return
    }

    const animationFrame = window.requestAnimationFrame(() => {
      informationPanelRef.current?.scrollTo({
        top: informationPanelRef.current.scrollHeight,
        behavior: 'smooth',
      })
    })

    return () => window.cancelAnimationFrame(animationFrame)
  }, [isInformationOpen, selectedFacility])

  // Create the MapLibre map once when this component first appears.
  useEffect(() => {
    // Stop if the container is unavailable or a map already exists.
    if (!containerRef.current || mapRef.current) {
      // Return no cleanup because nothing was created.
      return undefined
    }

    // Create a new interactive MapLibre map.
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE,
      center: [-73.9822, 40.7513],
      zoom: 14,
    })

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')

    // Clean up MapLibre resources when the component is removed.
    return () => {
      // Remove every custom marker from the map.
      markersRef.current.forEach((marker) => marker.remove())
      // Reset the saved marker array.
      markersRef.current = []
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])

  // Replace the displayed markers whenever points or route changes.
  useEffect(() => {
    const map = mapRef.current
    // Stop if the first effect has not created the map yet.
    if (!map) {
      return
    }

    markersRef.current.forEach((marker) => marker.remove())
    markersRef.current = []

    // Show route endpoints after search, otherwise show example places.
    const displayPoints = route
      ? [
          // Create a purple marker for the route start.
          {
            // Give the marker a stable ID.
            id: 'route-start',
            // Prefix the selected place name for its popup and accessible label.
            name: `Start: ${route.start.name}`,
            // Use the geocoded start coordinate pair.
            coordinates: route.start.coordinates,
            // Use purple for the start marker.
            color: '#9b4dff',
          },
          // Create an orange marker for the route destination.
          {
            // Give the marker a stable ID.
            id: 'route-destination',
            // Prefix the selected destination for its popup and label.
            name: `Destination: ${route.destination.name}`,
            // Use the geocoded destination coordinate pair.
            coordinates: route.destination.coordinates,
            // Use orange for the destination marker.
            color: '#ff8559',
          },
        ]
      // Use the default examples before any route is available.
      : points

    // Build and add one MapLibre marker for every display point.
    displayPoints.forEach((point) => {
      // Create a keyboard-focusable HTML element for the marker.
      const markerElement = document.createElement('button')
      // Apply the custom pin styles from index.css.
      markerElement.className = 'map-marker'
      // Prevent the marker from behaving like a form submit button.
      markerElement.type = 'button'
      // Pass this marker's color into a CSS custom property.
      markerElement.style.setProperty('--marker-color', point.color)
      // Give screen-reader users the same place name as sighted users.
      markerElement.setAttribute('aria-label', point.name)

      // Create a popup containing the place name and coordinates.
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong>${point.name}</strong><br><span>${point.coordinates[1].toFixed(5)}, ${point.coordinates[0].toFixed(5)}</span>`,
      )

      // Create and configure the MapLibre marker.
      const marker = new maplibregl.Marker({
        // Use the accessible custom HTML button created above.
        element: markerElement,
        // Align the pointed end of the marker with its coordinate.
        anchor: 'bottom',
      })
        // Position the marker using [longitude, latitude].
        .setLngLat(point.coordinates)
        // Attach the informational popup.
        .setPopup(popup)
        // Add the completed marker to the map.
        .addTo(map)

      // Save the marker so the next effect or cleanup can remove it.
      markersRef.current.push(marker)
    })
  }, [points, route])

  // Draw or remove the route line whenever the route changes.
  useEffect(() => {
    // Read the existing MapLibre instance.
    const map = mapRef.current

    // Stop if the map has not been created yet.
    if (!map) {
      // Return no cleanup because no event listener was added.
      return undefined
    }

    // Define the work that must happen after the map style is loaded.
    function renderRoute() {
      // Remove the old line layer before replacing its source.
      if (map.getLayer(ROUTE_LAYER_ID)) {
        // A layer must be removed before its source can be removed.
        map.removeLayer(ROUTE_LAYER_ID)
      }

      // Remove the old GeoJSON source when it exists.
      if (map.getSource(ROUTE_SOURCE_ID)) {
        // Clear the previous route geometry from the style.
        map.removeSource(ROUTE_SOURCE_ID)
      }

      // Leave the map without a route line when route is null.
      if (!route) {
        return
      }

      // Add the routing API's GeoJSON geometry as a map data source.
      map.addSource(ROUTE_SOURCE_ID, {
        // Tell MapLibre that this source contains GeoJSON data.
        type: 'geojson',
        // Wrap the LineString geometry in a valid GeoJSON Feature.
        data: {
          // Identify this GeoJSON object as a Feature.
          type: 'Feature',
          // Include an empty properties object because no attributes are needed.
          properties: {},
          // Use the route LineString returned by the routing API.
          geometry: route.geometry,
        },
      })

      // Add a styled line layer that reads from the new GeoJSON source.
      map.addLayer({
        // Give the line layer its stable unique ID.
        id: ROUTE_LAYER_ID,
        // Tell MapLibre to render the geometry as a line.
        type: 'line',
        // Connect the layer to the GeoJSON source added above.
        source: ROUTE_SOURCE_ID,
        // Control how connected line segments are shaped.
        layout: {
          // Round the two ends of the route line.
          'line-cap': 'round',
          // Round the corners between line segments.
          'line-join': 'round',
        },
        // Control the visible appearance of the route.
        paint: {
          // Draw the walking route in the course's teal color.
          'line-color': '#13b8a2',
          // Make the route wide enough to stand out from streets.
          'line-width': 7,
          // Keep a little transparency so map details remain visible.
          'line-opacity': 0.9,
        },
      })

      // Create an initially empty geographic bounding box.
      const bounds = new maplibregl.LngLatBounds()
      // Expand the box to include every coordinate along the route.
      route.geometry.coordinates.forEach((coordinate) =>
        bounds.extend(coordinate),
      )
      // Move and zoom the camera so the complete route is visible.
      map.fitBounds(bounds, {
        // Leave room around the route and its markers.
        padding: 70,
        // Prevent the camera from zooming in too closely on short routes.
        maxZoom: 16,
        // Animate the camera movement over 900 milliseconds.
        duration: 900,
      })
    }

    // Draw immediately when the style is already ready.
    if (map.loaded()) {
      // Add the source and layer now.
      renderRoute()
    } else {
      // Otherwise wait for MapLibre's one-time load event.
      map.once('load', renderRoute)
    }

    // Remove a pending load listener before this effect runs again.
    return () => {
      // This prevents an outdated route from being drawn later.
      map.off('load', renderRoute)
    }
  }, [route])

  // ==================== CLASS 5: QUERY OVERPASS API ====================
  // Request nearby accessibility tags whenever a new route is generated.
  useEffect(() => {
    // Clear facilities and instructions when no route is available.
    if (!route) {
      return undefined
    }

    // Allow an outdated Overpass request to be cancelled after a new search.
    const controller = new AbortController()

    // Keep asynchronous work inside a named function used by this effect.
    async function loadAccessibilityFeatures() {
      // Close details that belong to the previously generated route.
      setSelectedFacility(null)
      // Tell the interface that the OpenStreetMap query has started.
      setAccessibilityStatus('loading')
      // Remove any error that belongs to the previous route.
      setAccessibilityError('')
      // Clear older facilities so they are not confused with the current route.
      setAccessibilityData(EMPTY_FEATURE_COLLECTION)

      try {
        // Query wheelchair, steps, elevator, ramp, tactile, and kerb tags.
        const featureCollection = await getAccessibilityFeatures(
          route,
          controller.signal,
        )
        // Save the normalized GeoJSON so the next effect can draw it.
        setAccessibilityData(featureCollection)
        // Mark the request as successful even when no tagged features exist.
        setAccessibilityStatus('success')
      } catch (requestError) {
        // Ignore AbortController errors caused by a newer route request.
        if (requestError.name === 'AbortError') {
          return
        }

        // Use a specific Error message when JavaScript provides one.
        const message =
          requestError instanceof Error
            ? requestError.message
            : 'The accessibility query could not be completed.'
        // Display the safe message above the map.
        setAccessibilityError(message)
        // Mark the request as failed for the accessible status message.
        setAccessibilityStatus('error')
      }
    }

    // Start the request after the route has been added to state.
    loadAccessibilityFeatures()

    // Cancel this route's request before the effect runs again or unmounts.
    return () => controller.abort()
  }, [route])

  // ==================== CLASS 5: VISUALIZE OSM FEATURES ====================
  // Draw the normalized Overpass results as a colored MapLibre circle layer.
  useEffect(() => {
    // Read the current MapLibre map instance.
    const map = mapRef.current

    // Stop when the map has not been created yet.
    if (!map) {
      return undefined
    }

    // Remember whether delegated layer events were registered this time.
    let listenersAttached = false
    // Listen on the topmost visible facility layer so its complete hit area works.
    let interactionLayerId = ACCESSIBILITY_LAYER_ID

    // Remove the previous facility layer and source in the required order.
    function removeAccessibilityLayer() {
      if (map.getLayer(ACCESSIBILITY_LAYER_ID)) {
        map.removeLayer(ACCESSIBILITY_LAYER_ID)
      }

      if (map.getLayer(ACCESSIBILITY_HIGHLIGHT_LAYER_ID)) {
        map.removeLayer(ACCESSIBILITY_HIGHLIGHT_LAYER_ID)
      }

      if (map.getSource(ACCESSIBILITY_SOURCE_ID)) {
        map.removeSource(ACCESSIBILITY_SOURCE_ID)
      }
    }

    // Add the latest GeoJSON and its category-based visual style.
    function renderAccessibilityLayer() {
      // Replace, rather than stack, the previous route's facility data.
      removeAccessibilityLayer()

      // Leave the map clear while idle, loading, or after an empty response.
      if (!route || !accessibilityData.features.length) {
        return
      }

      // Register the normalized Overpass result as a MapLibre GeoJSON source.
      map.addSource(ACCESSIBILITY_SOURCE_ID, {
        type: 'geojson',
        data: accessibilityData,
      })

      // CLASS 6: Select both explicit barriers and steps for the risk shortcut.
      const activeFilter =
        activeCategory === 'risk'
          ? [
              'any',
              ['==', ['get', 'category'], 'barrier'],
              ['==', ['get', 'category'], 'steps'],
            ]
          : ['==', ['get', 'category'], activeCategory]

      // CLASS 6: Use the red risk color for the combined barrier selection.
      const activeColor =
        activeCategory === 'risk'
          ? ACCESSIBILITY_COLORS.barrier
          : ACCESSIBILITY_COLORS[activeCategory]

      // Place a large translucent halo behind the category selected in the legend.
      if (activeCategory) {
        map.addLayer({
          id: ACCESSIBILITY_HIGHLIGHT_LAYER_ID,
          type: 'circle',
          source: ACCESSIBILITY_SOURCE_ID,
          filter: activeFilter,
          paint: {
            'circle-radius': [
              'interpolate',
              ['linear'],
              ['zoom'],
              12,
              11,
              17,
              17,
            ],
            'circle-color': activeColor,
            'circle-opacity': 0.24,
            'circle-stroke-color': activeColor,
            'circle-stroke-width': 2,
          },
        })
      }

      // Draw each OSM feature as a circle colored by accessibility category.
      map.addLayer({
        id: ACCESSIBILITY_LAYER_ID,
        type: 'circle',
        source: ACCESSIBILITY_SOURCE_ID,
        paint: {
          'circle-radius': activeCategory
            ? [
                'interpolate',
                ['linear'],
                ['zoom'],
                12,
                [
                  'case',
                  activeFilter,
                  7,
                  4,
                ],
                17,
                [
                  'case',
                  activeFilter,
                  12,
                  4,
                ],
              ]
            : ['interpolate', ['linear'], ['zoom'], 12, 5, 17, 9],
          'circle-color': [
            'match',
            ['get', 'category'],
            'accessible',
            ACCESSIBILITY_COLORS.accessible,
            'limited',
            ACCESSIBILITY_COLORS.limited,
            'barrier',
            ACCESSIBILITY_COLORS.barrier,
            'steps',
            ACCESSIBILITY_COLORS.steps,
            'elevator',
            ACCESSIBILITY_COLORS.elevator,
            ACCESSIBILITY_COLORS.information,
          ],
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': activeCategory
            ? [
                'case',
                activeFilter,
                3,
                1,
              ]
            : 2,
          'circle-opacity': activeCategory
            ? [
                'case',
                activeFilter,
                1,
                0.16,
              ]
            : 0.92,
        },
      })

      // When filtering, the halo is above the point layer and becomes the hit target.
      interactionLayerId = activeCategory
        ? ACCESSIBILITY_HIGHLIGHT_LAYER_ID
        : ACCESSIBILITY_LAYER_ID

      // Register interactions only after the named layer exists on the map.
      map.on('click', interactionLayerId, showAccessibilityPopup)
      map.on('mouseenter', interactionLayerId, showPointerCursor)
      map.on('mouseleave', interactionLayerId, restoreMapCursor)
      listenersAttached = true
    }

    // Build a safe popup with DOM nodes instead of inserting raw OSM HTML.
    function showAccessibilityPopup(event) {
      // Read the first clicked feature from the visible circle layer.
      const feature = event.features?.[0]

      // Stop if the click did not resolve to a feature.
      if (!feature) {
        return
      }

      // Normalize the clicked MapLibre feature for the React detail component.
      const facility = {
        id: `${feature.properties.osmType}-${feature.properties.osmId}`,
        coordinates: feature.geometry.coordinates,
        properties: feature.properties,
      }

      // Send every selected facility to one stable detail region below the map.
      setSelectedFacility(facility)
    }

    // Change the cursor so students know the facility circles are clickable.
    function showPointerCursor() {
      map.getCanvas().style.cursor = 'pointer'
    }

    // Restore the normal map cursor after leaving the circle layer.
    function restoreMapCursor() {
      map.getCanvas().style.cursor = ''
    }

    // Draw immediately after the style is ready, otherwise wait for its load.
    if (map.isStyleLoaded()) {
      renderAccessibilityLayer()
    } else {
      map.once('load', renderAccessibilityLayer)
    }

    // Remove event listeners and map data before the next result is rendered.
    return () => {
      map.off('load', renderAccessibilityLayer)
      if (listenersAttached) {
        map.off('click', interactionLayerId, showAccessibilityPopup)
        map.off('mouseenter', interactionLayerId, showPointerCursor)
        map.off('mouseleave', interactionLayerId, restoreMapCursor)
      }
      removeAccessibilityLayer()
    }
  }, [accessibilityData, activeCategory, route])

  // Return a full-size map with optional information layered above it.
  return (
    // Give the complete map its own labelled page region.
    <section className="map-card" aria-label="Accessible route map">
      {/* Give MapLibre an empty container in which it can create its canvas. */}
      <div
        ref={containerRef}
        className="map"
        role="region"
        aria-label={
          route
            ? `Interactive map showing a walking route and ${displayedFeatureCount} OpenStreetMap accessibility features`
            : 'Interactive map with three example markers'
        }
      />

      {/* Keep the information off the map when the user closes the overlay. */}
      {isInformationOpen ? (
        <aside
          ref={informationPanelRef}
          id="map-information-panel"
          className="map-information-panel"
          aria-label="Map and accessibility information"
        >
          {/* Put the title and close control on the first row of the overlay. */}
          <div className="map-card-header">
            {/* Group the MapLibre label and changing map title. */}
            <div>
              <p className="eyebrow">MAPLIBRE VIEW</p>
              <h2>{route ? 'Walking route' : 'Interactive map'}</h2>
            </div>

            {/* Remove the complete information overlay without hiding the map. */}
            <button
              className="map-information-close"
              type="button"
              aria-label="Close map information"
              aria-controls="map-information-panel"
              onClick={() => setIsInformationOpen(false)}
            >
              ×
            </button>
          </div>

          {/* Show the current interaction hint below the map title. */}
          <p className="map-interaction-hint">
            {route
              ? 'Start · route · destination'
              : 'Pan · zoom · select a marker'}
          </p>

          {/* ================= CLASS 5: OSM ACCESSIBILITY PANEL ============= */}
          {/* Explain the data source, legend, and current Overpass status. */}
          <div className="accessibility-panel">
            {/* Introduce OpenStreetMap as tagged data, not only map tiles. */}
            <div className="accessibility-intro">
              <p className="eyebrow">OPENSTREETMAP + OVERPASS API</p>
              <p>
                Query wheelchair, steps, elevator, ramp, tactile paving, and
                kerb tags near the route.
              </p>
            </div>

            {/* CLASS 5: Let the legend control which facility type is emphasized. */}
            <div className="facility-filter-toolbar">
              <strong>Facility types</strong>
              <button
                type="button"
                className="show-all-facilities"
                disabled={!activeCategory}
                onClick={() => setActiveCategory(null)}
              >
                Show all
              </button>
            </div>

            {/* Reuse the MapLibre circle colors in an interactive legend. */}
            <ul
              className="accessibility-legend"
              aria-label="Filter facilities by accessibility category"
            >
              {Object.entries(ACCESSIBILITY_CATEGORY_LABELS).map(
                ([category, label]) => (
                  <li key={category}>
                    <button
                      type="button"
                      className={`facility-filter${activeCategory === category ? ' is-active' : ''}`}
                      aria-pressed={activeCategory === category}
                      onClick={() =>
                        setActiveCategory((currentCategory) =>
                          currentCategory === category ? null : category,
                        )
                      }
                    >
                      <span
                        className="legend-dot"
                        style={{
                          '--legend-color': ACCESSIBILITY_COLORS[category],
                        }}
                        aria-hidden="true"
                      />
                      <span>{label}</span>
                      <strong className="facility-count">
                        {categoryCounts[category]}
                      </strong>
                    </button>
                  </li>
                ),
              )}
            </ul>

            {/* Announce loading, success, empty data, or errors accessibly. */}
            <div
              className={`accessibility-query-status status-${displayedAccessibilityStatus}`}
              role={
                displayedAccessibilityStatus === 'error' ? 'alert' : 'status'
              }
              aria-live="polite"
            >
              {displayedAccessibilityStatus === 'idle' &&
                'Generate a route to query nearby accessibility tags.'}
              {displayedAccessibilityStatus === 'loading' &&
                'Querying OpenStreetMap accessibility data…'}
              {displayedAccessibilityStatus === 'success' &&
                `${displayedFeatureCount} tagged features found near this route.`}
              {displayedAccessibilityStatus === 'error' && accessibilityError}
            </div>
            {activeCategory && (
              <p className="facility-filter-summary" role="status">
                Highlighting {activeCategoryCount}{' '}
                {activeCategoryLabel.toLowerCase()} features.{' '}
                Select Show all to reset.
              </p>
            )}
          </div>

          {/* ================= CLASS 6: ACCESSIBILITY SCORING =============== */}
          {/* Calculate and explain the result from the Class 5 facility data. */}
          <AccessibilityScoreCard
            result={accessibilityScore}
            status={displayedAccessibilityStatus}
            onSelectBarriers={() => setActiveCategory('risk')}
          />

          {/* CLASS 5: Append the selected marker details at this sidebar's end. */}
          {selectedFacility && route && (
            <FacilityDetail
              key={selectedFacility.id}
              facility={selectedFacility}
              onClose={() => setSelectedFacility(null)}
            />
          )}
        </aside>
      ) : (
        /* Leave a small accessible control so the information can be restored. */
        <button
          className="map-information-open"
          type="button"
          aria-expanded="false"
          aria-controls="map-information-panel"
          onClick={() => setIsInformationOpen(true)}
        >
          Map information
        </button>
      )}

    </section>
  )
}

// Export MapView so App.jsx can render it.
export default MapView
