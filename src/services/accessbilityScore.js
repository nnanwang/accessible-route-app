const POSITIVE_CATEGORIES = new Set(['accessible', 'elevator'])

const LIMITED_CATEGORIES = new Set(['limited'])

const BARRIER_CATEGORIES = new Set(['barrier', 'steps'])

function clamp(value) {
    return Math.min(100, Math.max(0, value))
}

function getRiskLevel(score, barrierCount, coverage) {
    // low coverage
    if (coverage < 20 && barrierCount === 0) {
        return 'unknown'
    }

    // high risk
    if (barrierCount >= 3 || score < 45) {
        return 'high'
    }

    // moderate risk
    if (barrierCount > 0 || score < 75) {
        return 'moderate'
    }

    return 'low'
}

function createExplanation({ positiveCount, limitedCount, barrierCount, coverage }) {
    const evidenceSummary = `${positiveCount} positive, ${limitedCount} limited, and ${barrierCount} barrier signals were found!`

    if (coverage < 20) {
        return `${evidenceSummary} Data coverage is low, so this is a preliminary estimate.`
    }

    if (barrierCount > 0) {
        return `${evidenceSummary} Review the highlighted barriers before using this route.`
    }

    return `${evidenceSummary} No tagged barrier was found, but missing OSM data may still exist.`
    
}

export function calculateAccessibilityScore(features = []) {
    const totalCount = features.length

    const positiveCount = features.filter((feature) =>
        POSITIVE_CATEGORIES.has(feature.properties.category)).length

    const limitedCount = features.filter((feature) =>
        LIMITED_CATEGORIES.has(feature.properties.category)).length

    const barrierCount = features.filter((feature) =>
        BARRIER_CATEGORIES.has(feature.properties.category)).length

    const decisiveCount = positiveCount + limitedCount + barrierCount

    const coverage = totalCount 
        ? Math.round((decisiveCount / totalCount) * 100)
        : 0
    
    if (decisiveCount === 0) {
        return {
            score: null,
            coverage,
            riskLevel: 'unknown',
            positiveCount,
            limitedCount,
            barrierCount,
            explanation: 'Not enough explicit accessibility tags are available to calculate a score.',
        }
    }

    const positiveWeight = positiveCount + limitedCount * 0.4
    const evidenceWeight = positiveCount + limitedCount + barrierCount * 1.25

    const score = Math.round(clamp((positiveWeight / evidenceWeight) * 100))

    const riskLevel = getRiskLevel(score, barrierCount, coverage)

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
        })

    }
    
}