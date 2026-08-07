import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'

function MapView({ points }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markersRef = useRef([])
  
  useEffect(() => {
    mapRef.current = new maplibregl.Map({
      container: containerRef.current,
      style: 'https://demotiles.maplibre.org/style.json',
      center: [-73.982, 40.751],
      zoom: 14,
    })
    
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right')
    
    return () => {
      mapRef.current?.remove()
      mapRef.current = null
    }
  }, [])
  
  useEffect(() => {
    if (!mapRef.current) return
    
    markersRef.current.forEach((marker) => marker.remove())
    
    markersRef.current = points.map((point) => {
      const markerElement = document.createElement('button')
      markerElement.type = 'button'
      markerElement.className = 'map-marker'
      markerElement.style.backgroundColor = point.color
      markerElement.setAttribute('aria-label', point.name)
      
      const popupContent = document.createElement('div')
      popupContent.className = 'map-popup'
      
      const popupTitle = document.createElement('strong')
      popupTitle.textContent = point.name
      
      const popupCoordinates = document.createElement('span')
      popupCoordinates.textContent = point.coordinates.join(', ')
      
      popupContent.append(popupTitle, popupCoordinates)
      
      return new maplibregl.Marker({ element: markerElement })
      .setLngLat(point.coordinates)
      .setPopup(new maplibregl.Popup({ offset: 22 }).setDOMContent(popupContent))
      .addTo(mapRef.current)
    })
  }, [points])
  
  return (
    <section className="map-panel" aria-labelledby="map-title">
    <div className="map-heading">
    <div>
    <p className="section-kicker">Your route</p>
    <h2 id="map-title">Map View</h2>
    </div>
    </div>
    
    <div
    ref={containerRef}
    className="map"
    role="region"
    aria-label="Interactive map with three location markers"
    />
    </section>
  )
}

export default MapView
