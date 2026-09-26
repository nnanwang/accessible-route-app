# Accessible Route Explorer

Accessible Route Explorer is a React-based mapping application that helps travelers investigate accessibility information around a walking route. It combines route search, interactive mapping, OpenStreetMap accessibility data, a transparent scoring system, and AI-generated guidance in one responsive interface.

The project explores an important design question: **How can a digital map communicate accessibility evidence without presenting incomplete data as certainty?**

Rather than claiming that a route is fully accessible, the application shows the available evidence, explains how the score was calculated, highlights possible barriers, and clearly communicates uncertainty.

## Project Overview

Many navigation tools optimize for speed or distance, but a short route may still contain steps, limited wheelchair access, inaccessible entrances, or missing accessibility information. Accessible Route Explorer was created to make those factors easier to inspect before a journey.

Users can:

- Search for a start and destination.
- Generate a walking route with distance and estimated duration.
- Explore the route on an interactive MapLibre map.
- Inspect accessibility-related OpenStreetMap features near the route.
- Filter and highlight different facility categories.
- Review an explainable accessibility score and data-coverage estimate.
- Generate personalized route guidance for different traveler profiles.

This is an educational and portfolio prototype, not a real-time navigation or safety-guarantee system.

## Key Features

### Address Search and Route Generation

- Keyboard-accessible address suggestions powered by Nominatim.
- Conversion of human-readable addresses into longitude and latitude.
- Walking-route geometry, distance, and estimated duration from an OpenStreetMap routing service.
- Clear loading, empty, success, and error states.

### Interactive Map

- MapLibre GL JS map with zoom and navigation controls.
- GeoJSON route rendering with start and destination markers.
- Automatic map fitting after a successful route search.
- Selectable accessibility markers with details shown inside the map panel.
- Responsive, full-screen layout with floating information panels.

### Accessibility Evidence

- Overpass API queries for accessibility-related OpenStreetMap tags near the route.
- Categories for wheelchair access, limited access, barriers, steps, elevators, and general accessibility information.
- Facility counts and category filters.
- Map highlighting for a selected facility category or detected barriers.
- Explicit treatment of missing tags as **unknown information**, not proof of inaccessibility.

### Explainable Accessibility Score

- Deterministic JavaScript calculation rather than an AI-generated score.
- Separate measurements for accessibility quality and data coverage.
- Positive weighting for wheelchair-accessible features and elevators.
- Partial weighting for limited-access features.
- Stronger penalties for barriers and steps.
- Human-readable risk labels and score explanations.

### AI Route Guidance

- Traveler profiles for wheelchair users, people with limited mobility, and people with low vision.
- Structured OpenAI Responses API output.
- Plain-language score explanation, personalized recommendations, travel reminders, and safety notices.
- Protected local backend route that keeps the OpenAI API key out of browser code.
- Honest demo mode for lessons or offline demonstrations without a live API request.

## User Journey

1. Enter a start and destination.
2. Select both addresses from the suggestion lists.
3. Generate the walking route.
4. Review the route distance and estimated duration.
5. Inspect mapped accessibility features near the route.
6. Filter facilities or highlight detected barriers.
7. Read the accessibility score, coverage, risk level, and explanation.
8. Select a traveler profile and generate personalized route guidance.

## System Architecture

```text
User input
   │
   ▼
Nominatim geocoding
   │
   ▼
Walking-route service ───────────────► Route geometry and metrics
   │                                             │
   │                                             ▼
   └──────────────────────────────► MapLibre route visualization
                                                 │
                                                 ▼
                                      Overpass accessibility query
                                                 │
                           ┌─────────────────────┴─────────────────────┐
                           ▼                                           ▼
                 Accessibility score                         Facility visualization
                           │
                           ▼
                 Protected local backend
                           │
                           ▼
                   OpenAI Responses API
                           │
                           ▼
              Personalized route guidance
```

The application separates three responsibilities:

1. **Evidence:** OpenStreetMap and Overpass provide mapped accessibility information.
2. **Calculation:** JavaScript converts the available evidence into a reproducible score.
3. **Explanation:** OpenAI explains the existing evidence and score for the selected traveler profile.

The AI does not invent the route score and does not independently verify real-world conditions.

## Accessibility Scoring Method

The scoring system is implemented in `src/services/accessibilityScore.js`.

### Evidence Groups

- **Positive:** wheelchair-accessible locations and elevators
- **Limited:** explicitly limited wheelchair access
- **Barrier:** barriers and steps
- **Information only:** useful accessibility descriptions without a clear positive or negative value

### Calculation

Limited-access evidence receives partial credit, while barriers receive additional weight in the denominator:

```text
positive weight = positive features + (limited features × 0.4)

evidence weight = positive features
                + limited features
                + (barriers × 1.25)

score = (positive weight ÷ evidence weight) × 100
```

The result is rounded and limited to a range from 0 to 100. Risk level also considers the number of barriers and the amount of available data.

Data coverage is reported separately because a high score based on sparse data should not be interpreted as high confidence.

## Technology Stack

| Area | Technology | Purpose |
| --- | --- | --- |
| Interface | React | Components, state, props, events, and conditional rendering |
| Development | Vite | Development server, environment loading, and production builds |
| Map | MapLibre GL JS | Interactive map, GeoJSON route, and facility markers |
| Geocoding | Nominatim | Address suggestions and coordinates |
| Routing | OpenStreetMap routing service | Walking-route geometry, distance, and duration |
| Accessibility data | Overpass API | OpenStreetMap accessibility tags near the route |
| Scoring | JavaScript | Transparent and reproducible accessibility calculation |
| AI | OpenAI Responses API | Structured, personalized route guidance |
| Styling | CSS | Responsive map layout, floating panels, and interface states |

## Project Structure

```text
accessible-route-app/
├── public/
├── server/
│   └── openaiRoute.js
├── src/
│   ├── components/
│   │   ├── AccessibilityScoreCard.jsx
│   │   ├── AIAccessibilityAssistant.jsx
│   │   ├── MapView.jsx
│   │   └── RouteSearch.jsx
│   ├── services/
│   │   ├── accessibilityScore.js
│   │   ├── openai.js
│   │   └── overpass.js
│   ├── App.jsx
│   ├── index.css
│   └── main.jsx
├── .env.example
├── .gitignore
├── package.json
├── README.md
└── vite.config.js
```

### Important Files

- `src/App.jsx` composes the application and owns the shared route state.
- `src/components/RouteSearch.jsx` manages suggestions, geocoding, route generation, and route-search states.
- `src/components/MapView.jsx` coordinates the map, route layers, markers, filters, selected facility, score card, and AI panel.
- `src/components/AccessibilityScoreCard.jsx` presents the score, coverage, detected barriers, and explanation.
- `src/components/AIAccessibilityAssistant.jsx` manages traveler profiles and AI request states.
- `src/services/overpass.js` builds Overpass queries and normalizes OpenStreetMap features.
- `src/services/accessibilityScore.js` contains the scoring and risk rules.
- `src/services/openai.js` creates the structured request sent to the protected endpoint.
- `server/openaiRoute.js` validates the request and calls OpenAI without exposing the secret key to React.

## Getting Started

### Requirements

- Node.js 20.19 or later, or Node.js 22.12 or later
- npm
- An OpenAI API key for live AI-generated guidance

### Installation

Clone the repository and open the project folder:

```bash
git clone https://github.com/nnanwang/accessible-route-app.git
cd accessible-route-app
```

Install the dependencies:

```bash
npm install
```

Create the local environment file:

```bash
cp .env.example .env
```

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Add the following values to `.env`:

```env
OPENAI_API_KEY="your-key-here"
OPENAI_MODEL=gpt-5-mini
OPENAI_DEMO_MODE=false
```

Start the development server:

```bash
npm run dev
```

Open the local address displayed in the terminal, usually `http://localhost:5173`.

> Never place a real API key in React code, a `VITE_...` variable, README.md, or GitHub. The `.env` file is ignored by Git, while `.env.example` contains safe placeholders only.

## Available Commands

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Create a production build |
| `npm run preview` | Preview the production build locally |
| `npm run lint` | Check the project with ESLint |

## Accessibility and Inclusive Design

Accessibility is both the subject of the project and a design requirement for the interface.

- Inputs have visible, programmatically connected labels.
- Search suggestions and primary actions are keyboard accessible.
- Loading and error messages communicate the current state.
- Text summaries supplement the visual map.
- Color is supported by labels, counts, written explanations, and risk text.
- Disabled actions explain what information is still required.
- Safety and uncertainty messages remain visible beside generated guidance.
- The responsive layout keeps core controls available on smaller screens.

## Responsible AI Design

The AI assistant is intentionally limited to explanation and personalized guidance.

- The model receives structured route metrics, score data, selected traveler profile, and a limited set of mapped features.
- The route score is calculated before the AI request.
- Structured output keeps the response format predictable.
- The API key remains on the server side.
- The interface identifies AI-generated content.
- Every report includes uncertainty and safety language.
- The application does not claim that AI has inspected or verified the physical route.

## Data and Safety Limitations

- OpenStreetMap is community-maintained and may contain incomplete, outdated, or incorrect information.
- Missing accessibility tags represent unknown conditions.
- The application analyzes features near the route, not every surface or entrance along it.
- Public geocoding, routing, and Overpass services may be temporarily unavailable or rate-limited.
- Construction, weather, temporary closures, broken elevators, and untagged barriers may not be represented.
- AI-generated guidance may contain errors and cannot confirm current physical conditions.
- Travelers should verify critical accessibility information through official or local sources before traveling.

## Engineering Highlights

- Separated interface components from data-service functions.
- Normalized third-party API responses into predictable application objects.
- Used GeoJSON as the shared format between routing data and MapLibre.
- Added cancellation and delayed requests to reduce unnecessary geocoding calls.
- Implemented explicit idle, loading, success, and error states.
- Kept scoring deterministic and auditable instead of delegating it to AI.
- Protected the OpenAI key with server-side Vite middleware.
- Designed the final interface around traveler tasks instead of classroom component names.

## Challenges and Learning

This project required combining several asynchronous systems with different data formats and failure modes. The most important lessons were:

- Breaking a complex interface into components with clear responsibilities.
- Tracing data from user input through APIs, JSON responses, React state, props, and rendered UI.
- Synchronizing React with an external map library through effects and cleanup functions.
- Designing useful loading and error feedback for slow or unavailable services.
- Distinguishing data quality, accessibility quality, and AI explanation.
- Communicating uncertainty as a core product feature rather than hiding it.
- Protecting secrets and separating browser responsibilities from server responsibilities.

## Future Development

- Add user-submitted accessibility feedback with moderation and verification.
- Integrate official transit, elevator-status, and temporary-closure data.
- Support more mobility, sensory, and cognitive accessibility profiles.
- Add route alternatives and allow users to prioritize different accessibility needs.
- Introduce automated tests for scoring rules, API normalization, and interface states.
- Move the local backend to a production serverless endpoint.
- Conduct usability testing with disabled travelers and accessibility specialists.
- Add multilingual support and more extensive screen-reader testing.

## Acknowledgements

- Map data: [OpenStreetMap contributors](https://www.openstreetmap.org/copyright)
- Map rendering: [MapLibre GL JS](https://maplibre.org/)
- Address search: [Nominatim](https://nominatim.org/)
- Accessibility queries: [Overpass API](https://overpass-api.de/)
- AI-generated guidance: [OpenAI API](https://platform.openai.com/docs/)

## Project Status

The current version is a working portfolio prototype developed through a nine-class accessible mapping course. Its purpose is to demonstrate web development, interactive mapping, API integration, accessible interface design, transparent data interpretation, and responsible use of generative AI.
