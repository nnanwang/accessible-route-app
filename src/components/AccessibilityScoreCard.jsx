// ==================== CLASS 6: SCORE + RISK INTERFACE ====================
// Match internal risk values with readable labels shown to the user.
const RISK_LABELS = {
  low: 'Low risk',
  moderate: 'Moderate risk',
  high: 'High risk',
  unknown: 'Unknown risk',
}

// Display the score, coverage, barriers, explanation, and visual indicators.
function AccessibilityScoreCard({ result, status, onSelectBarriers }) {
  // Wait for a successful Overpass response before presenting a calculation.
  const isReady = status === 'success'

  // Use a dash when the available OSM evidence cannot produce a score.
  const scoreLabel = result.score === null ? '—' : result.score

  // Keep the progress ring empty until a numeric score exists.
  const scoreProgress = result.score ?? 0

  // Show up to three barrier names so the compact sidebar stays readable.
  const visibleBarriers = result.barriers.slice(0, 3)

  // Render the complete Class 6 teaching section.
  return (
    <section className="score-card" aria-labelledby="score-card-title">
      <div className="score-card-heading">
        <div>
          <p className="eyebrow">CLASS 6 · ACCESSIBILITY SCORING</p>
          <h3 id="score-card-title">Route evidence score</h3>
        </div>

        <span className={`risk-badge risk-${result.riskLevel}`}>
          {RISK_LABELS[result.riskLevel]}
        </span>
      </div>

      {!isReady ? (
        <p className="score-empty-state">
          Generate a route and wait for OpenStreetMap data to calculate the score.
        </p>
      ) : (
        <>
          <div className="score-overview">
            <div
              className={`score-ring risk-${result.riskLevel}`}
              style={{ '--score-progress': `${scoreProgress * 3.6}deg` }}
              role="img"
              aria-label={
                result.score === null
                  ? 'Accessibility score unavailable'
                  : `Accessibility score ${result.score} out of 100`
              }
            >
              <strong>{scoreLabel}</strong>
              <span>/ 100</span>
            </div>

            <div className="score-metrics">
              <div>
                <span>Data coverage</span>
                <strong>{result.coverage}%</strong>
              </div>
              <div>
                <span>Detected barriers</span>
                <strong>{result.barrierCount}</strong>
              </div>
            </div>
          </div>

          <div className="coverage-track" aria-hidden="true">
            <span style={{ width: `${result.coverage}%` }} />
          </div>

          <p className="score-explanation">{result.explanation}</p>

          <div className="barrier-detection">
            <div className="barrier-heading">
              <strong>Barrier detection</strong>
              {result.barrierCount > 0 && (
                <button type="button" onClick={onSelectBarriers}>
                  Highlight on map
                </button>
              )}
            </div>

            {visibleBarriers.length > 0 ? (
              <ul>
                {visibleBarriers.map((feature) => (
                  <li key={feature.id}>
                    <span aria-hidden="true">!</span>
                    <div>
                      <strong>{feature.properties.name}</strong>
                      <small>{feature.properties.categoryLabel}</small>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No tagged barriers were detected near this route.</p>
            )}
          </div>

          <p className="score-disclaimer">
            Teaching estimate only — it is not a guarantee of route safety.
          </p>
        </>
      )}
    </section>
  )
}

export default AccessibilityScoreCard
