// ==================== CLASS 5: OPENSTREETMAP + OVERPASS API ====================
// Store the public Overpass API endpoint in one reusable constant.
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

// Give every accessibility category a readable label for the map popup.
export const ACCESSIBILITY_CATEGORY_LABELS = {
  accessible: 'Wheelchair accessible',
  limited: 'Limited wheelchair access',
  barrier: 'Accessibility barrier',
  steps: 'Steps',
  elevator: 'Elevator',
  information: 'Accessibility information',
}

// Add a small geographic margin around the route before querying OpenStreetMap.
function createRouteBoundingBox(route, padding = 0.003) {
  // Read every [longitude, latitude] pair from the route's GeoJSON LineString.
  const coordinates = route.geometry.coordinates

  // Start with values that will be replaced by the first real coordinate.
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity

  // Expand the four edges until the complete route is inside the box.
  coordinates.forEach(([longitude, latitude]) => {
    west = Math.min(west, longitude)
    south = Math.min(south, latitude)
    east = Math.max(east, longitude)
    north = Math.max(north, latitude)
  })

  // Overpass expects the order south, west, north, east.
  return [south - padding, west - padding, north + padding, east + padding]
}

// Convert OpenStreetMap tags into one simple category used by MapLibre styling.
function classifyAccessibilityFeature(tags) {
  // Elevators are useful route facilities even when wheelchair tags are absent.
  if (tags.highway === 'elevator' || tags.elevator === 'yes') {
    return 'elevator'
  }

  // Steps are a possible accessibility barrier and need their own symbol color.
  if (tags.highway === 'steps') {
    return 'steps'
  }

  // Read explicit wheelchair access values before less specific tags.
  if (tags.wheelchair === 'yes' || tags.wheelchair === 'designated') {
    return 'accessible'
  }

  // Keep limited access separate from both yes and no.
  if (tags.wheelchair === 'limited') {
    return 'limited'
  }

  // Treat an explicit no, raised kerb, or missing ramp as a barrier.
  if (
    tags.wheelchair === 'no' ||
    tags.ramp === 'no' ||
    tags.kerb === 'raised'
  ) {
    return 'barrier'
  }

  // Recognize common positive accessibility details in OpenStreetMap.
  if (
    tags.ramp === 'yes' ||
    tags.tactile_paving === 'yes' ||
    tags.kerb === 'lowered' ||
    tags.kerb === 'flush'
  ) {
    return 'accessible'
  }

  // Keep tagged features visible when their value needs human interpretation.
  return 'information'
}

// CLASS 5: Turn image-related OSM tags into a URL that an <img> can display.
function getImageUrl(tags) {
  // Use a direct image URL when the contributor supplied one.
  if (/^https?:\/\//i.test(tags.image || '')) {
    return tags.image
  }

  // Wikimedia Commons commonly stores a filename such as "File:Example.jpg".
  if ((tags.wikimedia_commons || '').startsWith('File:')) {
    const filename = tags.wikimedia_commons.slice(5)
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`
  }

  // Some records already contain a complete Commons URL.
  if (/^https?:\/\//i.test(tags.wikimedia_commons || '')) {
    return tags.wikimedia_commons
  }

  // Return an empty string so the detail card can show an honest placeholder.
  return ''
}

// CLASS 5: Combine separate OpenStreetMap address tags into one readable line.
function getAddress(tags) {
  return [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
    .filter(Boolean)
    .join(' ')
}

// Convert longitude and latitude to approximate local meter coordinates.
function projectToMeters([longitude, latitude], referenceLatitude) {
  // Longitude degrees get physically smaller farther from the equator.
  const longitudeScale =
    111320 * Math.cos((referenceLatitude * Math.PI) / 180)

  // Return a simple local x/y point suitable for a short urban route.
  return [longitude * longitudeScale, latitude * 110540]
}

// Measure the shortest distance between one point and one route segment.
function distanceToSegment(point, segmentStart, segmentEnd) {
  // Calculate the direction and squared length of the route segment.
  const segmentX = segmentEnd[0] - segmentStart[0]
  const segmentY = segmentEnd[1] - segmentStart[1]
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  // Treat a zero-length segment as a single point.
  if (segmentLengthSquared === 0) {
    return Math.hypot(point[0] - segmentStart[0], point[1] - segmentStart[1])
  }

  // Find where the perpendicular projection falls along the segment.
  const position = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - segmentStart[0]) * segmentX +
        (point[1] - segmentStart[1]) * segmentY) /
        segmentLengthSquared,
    ),
  )

  // Calculate the nearest coordinate on that segment.
  const nearestX = segmentStart[0] + position * segmentX
  const nearestY = segmentStart[1] + position * segmentY

  // Return the straight-line distance in approximate meters.
  return Math.hypot(point[0] - nearestX, point[1] - nearestY)
}

// Find the minimum distance from one OSM feature to the complete route line.
function distanceToRoute(featureCoordinates, routeCoordinates) {
  // Use the route's first latitude as a stable local projection reference.
  const referenceLatitude = routeCoordinates[0][1]
  // Project the facility once before checking every route segment.
  const projectedFeature = projectToMeters(
    featureCoordinates,
    referenceLatitude,
  )
  // Project every route coordinate into the same local meter space.
  const projectedRoute = routeCoordinates.map((coordinate) =>
    projectToMeters(coordinate, referenceLatitude),
  )

  // Start above any realistic city-scale route distance.
  let nearestDistance = Infinity

  // Compare the feature with each consecutive segment of the route.
  for (let index = 1; index < projectedRoute.length; index += 1) {
    nearestDistance = Math.min(
      nearestDistance,
      distanceToSegment(
        projectedFeature,
        projectedRoute[index - 1],
        projectedRoute[index],
      ),
    )
  }

  // Return the closest measured segment distance.
  return nearestDistance
}

// Convert the Overpass response into a GeoJSON FeatureCollection for MapLibre.
function convertElementsToGeoJSON(elements, route) {
  // Transform every usable OpenStreetMap node, way, or relation into a point.
  const features = elements
    .map((element) => {
      // Nodes provide lon/lat; ways and relations use the requested center value.
      const longitude = element.lon ?? element.center?.lon
      const latitude = element.lat ?? element.center?.lat

      // Ignore elements that do not contain a drawable coordinate.
      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
      }

      // Use an empty object when OpenStreetMap returned no tags.
      const tags = element.tags ?? {}
      // Reduce many OSM tag combinations to one visual category.
      const category = classifyAccessibilityFeature(tags)

      // Return one valid GeoJSON point feature.
      return {
        type: 'Feature',
        id: `${element.type}-${element.id}`,
        geometry: {
          type: 'Point',
          coordinates: [longitude, latitude],
        },
        properties: {
          category,
          categoryLabel: ACCESSIBILITY_CATEGORY_LABELS[category],
          name: tags.name || tags.description || 'Unnamed OSM feature',
          description:
            tags.description ||
            tags['wheelchair:description'] ||
            'No description has been added to OpenStreetMap.',
          imageUrl: getImageUrl(tags),
          address: getAddress(tags),
          openingHours: tags.opening_hours || '',
          website: tags.website || tags['contact:website'] || '',
          wheelchair: tags.wheelchair || 'not tagged',
          wheelchairDescription: tags['wheelchair:description'] || '',
          highway: tags.highway || '',
          ramp: tags.ramp || '',
          tactilePaving: tags.tactile_paving || '',
          kerb: tags.kerb || '',
          access: tags.access || '',
          amenity: tags.amenity || '',
          tourism: tags.tourism || '',
          shop: tags.shop || '',
          entrance: tags.entrance || '',
          osmType: element.type,
          osmId: String(element.id),
        },
      }
    })
    // Remove the null entries produced by elements without coordinates.
    .filter(Boolean)

  // Keep only facilities close enough to influence the walking route.
  const routeFeatures = features
    .filter(
      (feature) =>
        distanceToRoute(
          feature.geometry.coordinates,
          route.geometry.coordinates,
        ) <= 120,
    )
    // Protect the teaching demo from becoming unreadable in dense city areas.
    .slice(0, 150)

  // Wrap the filtered point array in the collection MapLibre expects.
  return {
    type: 'FeatureCollection',
    features: routeFeatures,
  }
}

// Query accessibility-related OpenStreetMap tags around a generated route.
export async function getAccessibilityFeatures(route, signal) {
  // Calculate a small bounding box around the route geometry.
  const boundingBox = createRouteBoundingBox(route)
  // Convert its four numbers to Overpass's comma-separated bbox syntax.
  const bbox = boundingBox.join(',')

  // CLASS 5: Ask for several common accessibility-related OSM tag families.
  const query = `
    [out:json][timeout:25];
    (
      nwr["wheelchair"](${bbox});
      nwr["highway"="steps"](${bbox});
      nwr["highway"="elevator"](${bbox});
      nwr["elevator"](${bbox});
      nwr["ramp"](${bbox});
      nwr["tactile_paving"](${bbox});
      nwr["kerb"](${bbox});
    );
    out center tags 800;
  `

  // Send the Overpass QL query as a POST body to avoid an extremely long URL.
  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: new URLSearchParams({ data: query }),
    signal,
  })

  // Convert unsuccessful HTTP responses into a readable interface error.
  if (!response.ok) {
    throw new Error('OpenStreetMap accessibility data is unavailable.')
  }

  // Parse the JSON document returned by Overpass.
  const data = await response.json()

  // Normalize the raw OSM elements before sending them to MapLibre.
  return convertElementsToGeoJSON(data.elements ?? [], route)
}
