
const OVERPASS_URL = 'https://overpass-api.de/api/interpreter'

export const ACCESSIBILITY_CATEGORY_LABELS = {
  accessible: 'Wheelchair accessible',
  limited: 'Limited wheelchair access',
  barrier: 'Accessibility barrier',
  steps: 'Steps',
  elevator: 'Elevator',
  information: 'Accessibility information',
}

function createRouteBoundingBox(route, padding = 0.003) {
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
  if (tags.highway === 'elevator' || tags.elevator === 'yes') {
    return 'elevator'
  }

  if (tags.highway === 'steps') {
    return 'steps'
  }

  if (tags.wheelchair === 'yes' || tags.wheelchair === 'designated') {
    return 'accessible'
  }

  if (tags.wheelchair === 'limited') {
    return 'limited'
  }

  if (
    tags.wheelchair === 'no' ||
    tags.ramp === 'no' ||
    tags.kerb === 'raised'
  ) {
    return 'barrier'
  }

  if (
    tags.ramp === 'yes' ||
    tags.tactile_paving === 'yes' ||
    tags.kerb === 'lowered' ||
    tags.kerb === 'flush'
  ) {
    return 'accessible'
  }

  return 'information'
}

function getImageUrl(tags) {
  if (/^https?:\/\//i.test(tags.image || '')) {
    return tags.image
  }

  if ((tags.wikimedia_commons || '').startsWith('File:')) {
    const filename = tags.wikimedia_commons.slice(5)
    return `https://commons.wikimedia.org/wiki/Special:Redirect/file/${encodeURIComponent(filename)}`
  }

  if (/^https?:\/\//i.test(tags.wikimedia_commons || '')) {
    return tags.wikimedia_commons
  }

  return ''
}

function getAddress(tags) {
  return [tags['addr:housenumber'], tags['addr:street'], tags['addr:city']]
    .filter(Boolean)
    .join(' ')
}

// Convert longitude and latitude to approximate local meter coordinates.
function projectToMeters([longitude, latitude], referenceLatitude) {
  const longitudeScale =
    111320 * Math.cos((referenceLatitude * Math.PI) / 180)

  return [longitude * longitudeScale, latitude * 110540]
}

// Measure the shortest distance between one point and one route segment.
function distanceToSegment(point, segmentStart, segmentEnd) {
  const segmentX = segmentEnd[0] - segmentStart[0]
  const segmentY = segmentEnd[1] - segmentStart[1]
  const segmentLengthSquared = segmentX ** 2 + segmentY ** 2

  if (segmentLengthSquared === 0) {
    return Math.hypot(point[0] - segmentStart[0], point[1] - segmentStart[1])
  }

  const position = Math.max(
    0,
    Math.min(
      1,
      ((point[0] - segmentStart[0]) * segmentX +
        (point[1] - segmentStart[1]) * segmentY) /
        segmentLengthSquared,
    ),
  )

  const nearestX = segmentStart[0] + position * segmentX
  const nearestY = segmentStart[1] + position * segmentY

  return Math.hypot(point[0] - nearestX, point[1] - nearestY)
}

// Find the minimum distance from one OSM feature to the complete route line.
function distanceToRoute(featureCoordinates, routeCoordinates) {
  const referenceLatitude = routeCoordinates[0][1]
  const projectedFeature = projectToMeters(
    featureCoordinates,
    referenceLatitude,
  )
  const projectedRoute = routeCoordinates.map((coordinate) =>
    projectToMeters(coordinate, referenceLatitude),
  )

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

  return nearestDistance
}

// Convert the Overpass response into a GeoJSON FeatureCollection for MapLibre.
function convertElementsToGeoJSON(elements, route) {
  const features = elements
    .map((element) => {
      const longitude = element.lon ?? element.center?.lon
      const latitude = element.lat ?? element.center?.lat

      if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
        return null
      }

      const tags = element.tags ?? {}
      const category = classifyAccessibilityFeature(tags)

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
