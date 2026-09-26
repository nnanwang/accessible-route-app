// Import the official server-side OpenAI JavaScript SDK.
import OpenAI from 'openai'
// Import Node's Buffer utility for combining streamed request chunks.
import { Buffer } from 'node:buffer'

// ==================== CLASS 8: REAL OPENAI API BACKEND ====================
// Limit incoming JSON so one browser request cannot consume unlimited memory.
const MAX_BODY_SIZE = 100_000

// Describe the exact JSON structure expected from the model.
const REPORT_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    summary: { type: 'string' },
    scoreExplanation: { type: 'string' },
    recommendations: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4,
    },
    reminders: {
      type: 'array',
      items: { type: 'string' },
      minItems: 2,
      maxItems: 4,
    },
    safetyNotice: { type: 'string' },
    confidenceNote: { type: 'string' },
  },
  required: [
    'summary',
    'scoreExplanation',
    'recommendations',
    'reminders',
    'safetyNotice',
    'confidenceNote',
  ],
}

// Read and parse the small JSON request sent by the React app.
async function readJsonBody(request) {
  // Collect each incoming body chunk in an array.
  const chunks = []
  // Count bytes so oversized requests can be rejected early.
  let size = 0

  // Iterate over the Node request stream asynchronously.
  for await (const chunk of request) {
    // Add the current chunk size to the running total.
    size += chunk.length

    // Stop before parsing if the request is larger than our teaching API needs.
    if (size > MAX_BODY_SIZE) {
      throw new Error('The report request is too large.')
    }

    // Save the safe chunk for final parsing.
    chunks.push(chunk)
  }

  // Join the chunks, decode them as UTF-8, and parse the JSON document.
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

// Send one JSON response with a matching HTTP status code.
function sendJson(response, statusCode, body) {
  // Set the status before ending the response.
  response.statusCode = statusCode
  // Tell the browser that the response contains JSON text.
  response.setHeader('Content-Type', 'application/json; charset=utf-8')
  // Serialize the JavaScript object and finish the response.
  response.end(JSON.stringify(body))
}

// Check the minimum evidence required before spending API tokens.
function validateReportInput(input) {
  // Reject missing or non-object request bodies.
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return 'The request body must be a JSON object.'
  }

  // Require the two route labels displayed in the interface.
  if (!input.route?.start || !input.route?.destination) {
    return 'The route start and destination are required.'
  }

  // Require the deterministic score object produced by Class 6.
  if (!input.score || typeof input.score !== 'object') {
    return 'The accessibility score is required.'
  }

  // Require an array even when Overpass found no nearby features.
  if (!Array.isArray(input.evidence)) {
    return 'Accessibility evidence must be an array.'
  }

  // Return an empty string when all required fields are ready.
  return ''
}

// Convert common OpenAI failures into safe classroom messages.
function getOpenAIErrorMessage(error) {
  // Explain authentication failures without sending the secret key to React.
  if (error?.status === 401) {
    return 'OpenAI rejected the API key. Check OPENAI_API_KEY and restart Vite.'
  }

  // Explain account limits separately from programming errors.
  if (error?.status === 429) {
    return 'OpenAI could not process the request because of a rate or billing limit.'
  }

  // Keep every other provider detail in the server terminal only.
  return 'The OpenAI report is unavailable. Check the server terminal and try again.'
}

// Produce useful classroom output when a teacher has not configured an API key.
function createDemoReport(input) {
  // Read the score values with safe fallbacks for sparse OSM data.
  const score = input.score?.value ?? 'unavailable'
  const coverage = input.score?.coverage ?? 0
  const barriers = input.score?.barrierCount ?? 0
  // Convert the selected profile ID into natural language.
  const profile = (input.travelerProfile || 'traveler').replaceAll('-', ' ')

  // Return the same shape as a real structured OpenAI response.
  return {
    summary: `This route has an accessibility score of ${score}/100 with ${coverage}% tagged-data coverage.`,
    scoreExplanation: `The calculation found ${barriers} barrier signal(s). The score comes from OSM evidence; missing tags do not prove that a route is accessible.`,
    recommendations: [
      `Review highlighted barriers before traveling as a ${profile}.`,
      'Check entrances, kerbs, lifts, and temporary street conditions close to departure time.',
    ],
    reminders: [
      'Allow extra travel time and keep an alternative stopping point in mind.',
      'Confirm critical accessibility details with the venue or local transit provider.',
    ],
    safetyNotice:
      'This teaching report is not real-time navigation or a guarantee of safety.',
    confidenceNote:
      'Confidence is limited by OpenStreetMap coverage and the age of contributed tags.',
  }
}

// Create the Vite middleware used by the browser-side OpenAI service.
export function createOpenAIApiPlugin(environment) {
  // Return a named Vite plugin so students can find it in debugging output.
  return {
    name: 'class-8-openai-api',

    // Register a local backend route on Vite's development server.
    configureServer(server) {
      // Add middleware before Vite's normal page fallback.
      server.middlewares.use('/api/accessibility-report', async (request, response) => {
        // Reject unsupported HTTP methods with an explicit message.
        if (request.method !== 'POST') {
          sendJson(response, 405, { error: 'Use POST for AI reports.' })
          return
        }

        try {
          // Parse the structured evidence sent by the React app.
          const input = await readJsonBody(request)

          // Stop before the API call when required route evidence is missing.
          const validationError = validateReportInput(input)

          // Return a client error so students can distinguish bad input from API failure.
          if (validationError) {
            sendJson(response, 400, { error: validationError })
            return
          }

          // Use demo output only when the teacher explicitly enables offline mode.
          if (environment.OPENAI_DEMO_MODE === 'true') {
            sendJson(response, 200, {
              mode: 'demo',
              report: createDemoReport(input),
            })
            return
          }

          // Make a missing key visible instead of silently pretending the API worked.
          if (!environment.OPENAI_API_KEY) {
            sendJson(response, 503, {
              error:
                'OpenAI is not configured. Add OPENAI_API_KEY to .env and restart Vite.',
            })
            return
          }

          // Create the SDK client only on the server where the key is protected.
          const client = new OpenAI({ apiKey: environment.OPENAI_API_KEY })

          // Ask the Responses API to ground its output only in supplied evidence.
          const aiResponse = await client.responses.create({
            model: environment.OPENAI_MODEL || 'gpt-5-mini',
            instructions:
              'You are an accessibility route assistant. Use only the supplied route score and OpenStreetMap evidence. Never invent facilities, live conditions, or safety guarantees. Clearly state uncertainty and keep every item concise.',
            input: JSON.stringify(input),
            // Do not retain this classroom route report for later retrieval.
            store: false,
            // Leave enough room for reasoning tokens and the final structured JSON.
            max_output_tokens: 3000,
            text: {
              format: {
                type: 'json_schema',
                name: 'accessibility_route_report',
                strict: true,
                schema: REPORT_SCHEMA,
              },
            },
          })

          // Stop with a useful message when the model reaches an output limit.
          if (aiResponse.status && aiResponse.status !== 'completed') {
            // Log only response metadata, never the API key or private request headers.
            console.error('OpenAI returned an incomplete report:', {
              status: aiResponse.status,
              incompleteDetails: aiResponse.incomplete_details,
            })
            // Tell React that the provider returned no complete report to display.
            sendJson(response, 502, {
              error:
                'OpenAI did not finish the structured report. Try the request again.',
            })
            return
          }

          // Remove surrounding whitespace before checking and parsing the result.
          const outputText = aiResponse.output_text?.trim()

          // Avoid calling JSON.parse when the response contains no output text.
          if (!outputText) {
            // Keep enough metadata in the terminal to diagnose refusals or empty output.
            console.error('OpenAI returned no output text:', {
              status: aiResponse.status,
              outputTypes: aiResponse.output?.map((item) => item.type),
            })
            // Return a specific message instead of an Unexpected end of JSON error.
            sendJson(response, 502, {
              error:
                'OpenAI returned an empty report. Check the server terminal and retry.',
            })
            return
          }

          // Convert the model's schema-constrained JSON text back to an object.
          const report = JSON.parse(outputText)

          // Return the structured AI report to the React component.
          sendJson(response, 200, { mode: 'openai', report })
        } catch (error) {
          // Keep secret provider details out of the browser error message.
          console.error('Class 8 OpenAI report error:', error)
          // Return a short message that the React component can display safely.
          sendJson(response, 500, {
            error: getOpenAIErrorMessage(error),
          })
        }
      })
    },
  }
}
// ===========================================================================
