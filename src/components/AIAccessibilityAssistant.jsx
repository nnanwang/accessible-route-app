// Import the Hook used for traveler choices, request state, and report data.
import { useState } from 'react'
// Import the browser-side service that calls our protected backend endpoint.
import { generateAccessibilityReport } from '../services/openai'

// ==================== CLASS 8: LIVE AI ACCESSIBILITY ASSISTANT ====================
// Offer a few simple profiles so recommendations can respond to user needs.
const TRAVELER_PROFILES = [
  { value: 'wheelchair-user', label: 'Wheelchair user' },
  { value: 'limited-mobility', label: 'Limited mobility' },
  { value: 'low-vision', label: 'Low vision' },
]

// Display AI-generated explanation, recommendations, reminders, and cautions.
function AIAccessibilityAssistant({ route, score, features, status }) {
  // Store the selected traveler profile used to personalize the prompt.
  const [travelerProfile, setTravelerProfile] = useState('wheelchair-user')
  // Store the structured report returned by the local backend.
  const [report, setReport] = useState(null)
  // Track idle, loading, success, and error interface states.
  const [reportStatus, setReportStatus] = useState('idle')
  // Store a user-friendly error separately from the report data.
  const [error, setError] = useState('')
  // Remember whether the backend used OpenAI or the no-key classroom demo.
  const [responseMode, setResponseMode] = useState('')

  // Enable generation only after the route and OSM query are complete.
  const canGenerate = Boolean(route) && status === 'success'

  // Generate a new report when the user presses the Class 8 action button.
  async function handleGenerate() {
    // Stop when required route evidence is not ready yet.
    if (!canGenerate) {
      return
    }

    // Create a controller so this request can be cancelled during cleanup.
    const controller = new AbortController()

    // Enter the loading state and clear older output.
    setReportStatus('loading')
    setError('')
    setReport(null)

    try {
      // Send only structured route evidence to the protected local endpoint.
      const result = await generateAccessibilityReport({
        route,
        score,
        features,
        travelerProfile,
        signal: controller.signal,
      })

      // Save the structured report returned by the backend.
      setReport(result.report)
      // Label demo output honestly when no OpenAI API key is configured.
      setResponseMode(result.mode)
      // Move the interface to its completed state.
      setReportStatus('success')
    } catch (requestError) {
      // Ignore cancellations but display all other failures.
      if (requestError.name !== 'AbortError') {
        setError(requestError.message)
        setReportStatus('error')
      }
    }
  }

  // Return the complete Class 8 teaching section.
  return (
    // CLASS 8: Give the complete assistant region an accessible heading.
    <section className="ai-assistant" aria-labelledby="ai-assistant-title">
      {/* CLASS 8: Identify the feature as an AI-generated report. */}
      <div className="ai-assistant-heading">
        <div>
          {/* CLASS 9: Replace the API lesson label with a user benefit. */}
          <p className="eyebrow">PERSONALIZED GUIDANCE</p>
          <h3 id="ai-assistant-title">Route guidance</h3>
        </div>
        <span className="ai-badge">AI</span>
      </div>

      {/* CLASS 9: Explain the feature without naming internal data pipelines. */}
      <p className="ai-intro">
        Get a plain-language summary based on the route score and mapped
        accessibility information.
      </p>

      {/* CLASS 8: Let the same evidence be explained for different needs. */}
      <label className="profile-field" htmlFor="traveler-profile">
        <span>Traveler profile</span>
        <select
          id="traveler-profile"
          value={travelerProfile}
          disabled={reportStatus === 'loading'}
          onChange={(event) => {
            // Save the newly selected traveler profile.
            setTravelerProfile(event.target.value)
            // Remove the old report because it belongs to another profile.
            setReport(null)
            // Return the component to its initial state.
            setReportStatus('idle')
          }}
        >
          {/* Convert every profile object into one select option. */}
          {TRAVELER_PROFILES.map((profile) => (
            <option key={profile.value} value={profile.value}>
              {profile.label}
            </option>
          ))}
        </select>
      </label>

      {/* CLASS 8: Start the API request and expose its loading state. */}
      <button
        className="generate-report-button"
        type="button"
        disabled={!canGenerate || reportStatus === 'loading'}
        onClick={handleGenerate}
      >
        {/* CLASS 9: Use guidance language instead of report/API terminology. */}
        {reportStatus === 'loading' ? (
          <>
            <span className="loading-spinner" aria-hidden="true" />
            Preparing guidance…
          </>
        ) : (
          'Generate route guidance'
        )}
      </button>

      {/* CLASS 8: Explain why the action is disabled before evidence is ready. */}
      {!canGenerate && (
        <p className="ai-empty-state">
          Search for a route and wait for accessibility information before
          generating guidance.
        </p>
      )}

      {/* CLASS 8: Announce backend or OpenAI failures to assistive technology. */}
      {reportStatus === 'error' && (
        <p className="ai-error" role="alert">
          {error}
        </p>
      )}

      {/* CLASS 8: Render the schema-constrained report only after success. */}
      {report && (
        <article className="ai-report" aria-live="polite">
          {/* CLASS 9: Label generated content without exposing provider details. */}
          <div className="ai-report-label-row">
            <strong>Route guidance</strong>
            <span>
              {responseMode === 'demo'
                ? 'Sample guidance'
                : 'AI-generated guidance'}
            </span>
          </div>

          {/* Render the model's short route summary. */}
          <p>{report.summary}</p>

          {/* Render the natural-language explanation of the existing score. */}
          <div className="ai-report-block">
            <h4>Why this score?</h4>
            <p>{report.scoreExplanation}</p>
          </div>

          {/* Render personalized recommendations as a semantic list. */}
          <div className="ai-report-block">
            <h4>Personalized recommendations</h4>
            <ul>
              {report.recommendations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Render practical reminders as a second semantic list. */}
          <div className="ai-report-block">
            <h4>Travel reminders</h4>
            <ul>
              {report.reminders.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>

          {/* Keep the model's safety limitation visually prominent. */}
          <p className="ai-safety-notice">
            <strong>Safety notice:</strong> {report.safetyNotice}
          </p>
          {/* Keep uncertainty visible instead of presenting advice as certainty. */}
          <p className="ai-confidence-note">{report.confidenceNote}</p>
        </article>
      )}

      {/* CLASS 9: Replace the developer architecture note with a data-source note. */}
      <p className="ai-architecture-note">
        Based on the route score and available mapped accessibility data.
      </p>
    </section>
  )
}

// Export the component so MapView can place it below the score card.
export default AIAccessibilityAssistant
// ===========================================================================
