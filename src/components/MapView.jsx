import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Define a simple MapLibre style that uses OpenStreetMap raster tiles.
const MAP_STYLE = {
  version: 8,
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
      id: 'open-street-map',
      type: 'raster',
      source: 'openStreetMap',
    },
  ],
}
// Reuse one ID for the GeoJSON route data source.
const ROUTE_SOURCE_ID = 'walking-route'
// Reuse one ID for the styled line layer drawn from that source.
const ROUTE_LAYER_ID = 'walking-route-line'

// Render the interactive map, markers, and optional route.
function MapView({ points, route }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])

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
      const markerElement = document.createElement('button')
      markerElement.className = 'map-marker'
      markerElement.type = 'button'
      markerElement.style.setProperty('--marker-color', point.color)
      // Give screen-reader users the same place name as sighted users.
      markerElement.setAttribute('aria-label', point.name)

      // Create a popup containing the place name and coordinates.
      const popup = new maplibregl.Popup({ offset: 18 }).setHTML(
        `<strong>${point.name}</strong>
        <br>
        <span>${point.coordinates[1].toFixed(5)}, ${point.coordinates[0].toFixed(5)}</span>`,
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
    const map = mapRef.current

    // Stop if the map has not been created yet.
    if (!map) {
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
        padding: 70,
        maxZoom: 16,
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

  return (
    <section className="map-card" aria-labelledby="map-heading">
      <div className="map-card-header">
        <div>
          <p className="eyebrow">MAPLIBRE VIEW</p>
          <h2 id="map-heading">
            {route ? 'Walking route' : 'Interactive map'}
          </h2>
        </div>
        <span>
          {route
            ? 'Start · route · destination'
            : 'Pan · zoom · select a marker'}
        </span>
      </div>

      {/* Give MapLibre an empty container in which it can create its canvas. */}
      <div
        ref={containerRef}
        className="map"
        role="region"
        aria-label={
          route
            ? 'Interactive map showing a generated walking route'
            : 'Interactive map with three example markers'
        }
      />
    </section>
  )
}

export default MapView