// ==================== CLASS 6: ACCESSIBILITY SCORING SYSTEM ====================
// Keep the category names in one place so the scoring rules are easy to teach.
const POSITIVE_CATEGORIES = new Set(['accessible', 'elevator'])

// Treat limited access as useful evidence without calling it fully accessible.
const LIMITED_CATEGORIES = new Set(['limited'])

// Treat explicit barriers and steps as route risks that need attention.
const BARRIER_CATEGORIES = new Set(['barrier', 'steps'])

// Keep every percentage and score inside the expected 0–100 range.
function clamp(value) {
  return Math.min(100, Math.max(0, value))
}

// Convert a numeric score and detected barriers into a readable risk level.
function getRiskLevel(score, barrierCount, coverage) {
  // Low coverage cannot support a confident low-risk conclusion.
  if (coverage < 20 && barrierCount === 0) {
    return 'unknown'
  }

  // Multiple barriers or a low score indicate a high-risk route segment.
  if (barrierCount >= 3 || score < 45) {
    return 'high'
  }

  // Any barrier or a middling score deserves a moderate-risk warning.
  if (barrierCount > 0 || score < 75) {
    return 'moderate'
  }

  // Only well-supported positive evidence receives a low-risk label.
  return 'low'
}

// Build one short explanation from the evidence used by the calculation.
function createExplanation({ positiveCount, limitedCount, barrierCount, coverage }) {
  // Lead with the evidence counts so students can verify the result themselves.
  const evidenceSummary = `${positiveCount} positive, ${limitedCount} limited, and ${barrierCount} barrier signals were found.`

  // Add a clear caveat when OSM coverage is too sparse for confidence.
  if (coverage < 20) {
    return `${evidenceSummary} Data coverage is low, so this is a preliminary estimate.`
  }

  // Explain the strongest concern when at least one barrier was detected.
  if (barrierCount > 0) {
    return `${evidenceSummary} Review the highlighted barriers before using this route.`
  }

  // Keep a safety caveat even when the available evidence is positive.
  return `${evidenceSummary} No tagged barrier was found, but missing OSM data may still exist.`
}

// Calculate the Class 6 score from the normalized Class 5 GeoJSON features.
export function calculateAccessibilityScore(features = []) {
  // Count every facility returned near the current route.
  const totalCount = features.length

  // Count positive facilities such as wheelchair access and elevators.
  const positiveCount = features.filter((feature) =>
    POSITIVE_CATEGORIES.has(feature.properties.category),
  ).length

  // Count facilities explicitly tagged as having limited access.
  const limitedCount = features.filter((feature) =>
    LIMITED_CATEGORIES.has(feature.properties.category),
  ).length

  // Keep the complete barrier feature objects for the warning list.
  const barriers = features.filter((feature) =>
    BARRIER_CATEGORIES.has(feature.properties.category),
  )

  // Convert the barrier array length into a reusable count.
  const barrierCount = barriers.length

  // Count evidence with a clear positive, limited, or negative interpretation.
  const decisiveCount = positiveCount + limitedCount + barrierCount

  // Measure coverage separately from quality: information-only tags are incomplete.
  const coverage = totalCount
    ? Math.round((decisiveCount / totalCount) * 100)
    : 0

  // Return an honest empty state before a route produces usable evidence.
  if (decisiveCount === 0) {
    return {
      score: null,
      coverage,
      riskLevel: 'unknown',
      positiveCount,
      limitedCount,
      barrierCount,
      barriers,
      explanation:
        'Not enough explicit accessibility tags are available to calculate a score.',
    }
  }

  // Give full weight to positive evidence and partial credit to limited access.
  const positiveWeight = positiveCount + limitedCount * 0.4

  // Make barriers slightly stronger than positive signals in the denominator.
  const evidenceWeight = positiveCount + limitedCount + barrierCount * 1.25

  // Convert the weighted evidence ratio into a rounded 0–100 score.
  const score = Math.round(clamp((positiveWeight / evidenceWeight) * 100))

  // Derive a visual risk level from score, barriers, and coverage together.
  const riskLevel = getRiskLevel(score, barrierCount, coverage)

  // Return every value needed by the Class 6 interface.
  return {
    score,
    coverage,
    riskLevel,
    positiveCount,
    limitedCount,
    barrierCount,
    barriers,
    explanation: createExplanation({
      positiveCount,
      limitedCount,
      barrierCount,
      coverage,
    }),
  }
}