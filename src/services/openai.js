// ==================== CLASS 8: OPENAI API CLIENT ====================
// Keep the local server endpoint in one reusable constant.
const AI_REPORT_URL = '/api/accessibility-report'

// Convert the route and OSM evidence into a small JSON request for the server.
function createReportRequest(route, score, features, travelerProfile) {
  // Send route names and metrics, but omit the full coordinate geometry.
  const routeSummary = {
    start: route.start.name,
    destination: route.destination.name,
    distanceMeters: Math.round(route.distanceMeters),
    durationMinutes: Math.max(1, Math.round(route.durationSeconds / 60)),
  }

  // Send only the fields the AI needs and limit the list to control token use.
  const evidence = features.slice(0, 30).map((feature) => ({
    name: feature.properties.name,
    category: feature.properties.categoryLabel,
    wheelchair: feature.properties.wheelchair,
    accessNote: feature.properties.wheelchairDescription,
    distanceToRouteMeters: feature.properties.distanceToRouteMeters,
  }))

  // Return one predictable JSON object that is easy to inspect in DevTools.
  return {
    travelerProfile,
    route: routeSummary,
    score: {
      value: score.score,
      coverage: score.coverage,
      riskLevel: score.riskLevel,
      positiveCount: score.positiveCount,
      limitedCount: score.limitedCount,
      barrierCount: score.barrierCount,
    },
    evidence,
  }
}

// Ask the local backend to generate a structured accessibility report.
export async function generateAccessibilityReport({
  route,
  score,
  features,
  travelerProfile,
  signal,
}) {
  // Build the JSON body before starting the network request.
  const requestBody = createReportRequest(
    route,
    score,
    features,
    travelerProfile,
  )

  // Call our own backend so the secret OpenAI API key never reaches React.
  const response = await fetch(AI_REPORT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
    signal,
  })

  // Parse the response once so success and error paths can reuse it.
  const result = await response.json().catch(() => ({}))

  // Convert a failed HTTP response into a message the component can display.
  if (!response.ok) {
    throw new Error(result.error || 'The AI report could not be generated.')
  }

  // Return the structured report and whether it came from AI or demo mode.
  return result
}
// ====================================================================
