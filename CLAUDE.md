# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wanderlog is an interactive map-based travel journal built with React 19, TypeScript, Vite, and Google Maps. It allows users to plan and track trips with timeline navigation, activity tracking, and drag-and-drop reordering.

GitHub Project (https://github.com/kevinlin/wanderlog)
  - Name: wanderlog


## Common Commands

```bash
pnpm dev              # Start development server (http://localhost:5173)
pnpm build            # TypeScript check + Vite production build
pnpm test             # Run all tests with Vitest
pnpm test:run         # Run tests once (CI mode)
pnpm test:ui          # Run tests with interactive UI
pnpm test:coverage    # Run tests with coverage report
pnpm lint             # Run Ultracite (Biome formatter/linter)
pnpm migrate          # Migrate trip JSON files to Firestore
```

Run a single test file:
```bash
pnpm vitest run src/path/to/file.test.ts
```

Format and fix code issues:
```bash
npx ultracite fix     # Auto-fix formatting and linting issues
npx ultracite check   # Check for issues without fixing
```

## Architecture

### State Management

Uses React Context with useReducer pattern (`src/contexts/AppStateContext.tsx`):
- `AppState` holds trip data, current selection, user modifications, weather cache
- Actions: `SET_TRIP_DATA`, `SELECT_BASE`, `SELECT_ACTIVITY`, `TOGGLE_ACTIVITY_DONE`, `REORDER_ACTIVITIES`, etc.
- User modifications (activity completion, reorder) persist to localStorage via `storageService`

### Data Flow

1. **Trip data** loads from Firebase Firestore via `firebaseService`
   - Legacy: JSON files in `public/trip-data/` can be migrated with `pnpm migrate`
   - Format: `YYYYMM_LOCATION_trip-plan.json`
2. **useTripData hook** fetches and validates trip data via `tripDataService`
3. **AppStateContext** manages global state; components dispatch actions
4. **User modifications** sync to Firestore (with localStorage fallback) via `storageService`
5. **Offline support**: Firebase IndexedDB persistence enables full offline functionality with automatic sync

### Key Domain Types (src/types/trip.ts)

- `TripData` → contains `stops: TripBase[]`
- `TripBase` → a location/stop with `accommodation`, `activities[]`, `scenic_waypoints[]`
- `Activity` → individual activity with location, type, status
- `UserModifications` → user's completion status and custom activity ordering

### Key Services

- **firebaseService** (`src/services/firebaseService.ts`) - Firebase Firestore integration for trips, user modifications, and weather cache
- **storageService** (`src/services/storageService.ts`) - Syncs user modifications to Firestore with localStorage fallback
- **tripDataService** - Fetches and validates trip data
- **weatherService** - Fetches weather data with Firestore caching

### Component Structure

```
src/components/
├── Map/            # Google Maps integration (MapContainer, POIModal)
├── Cards/          # Activity, Accommodation, Weather, ScenicWaypoint cards
├── Timeline/       # TimelineStrip for date navigation
├── Activities/     # ActivitiesPanel with drag-and-drop (dnd-kit)
└── Layout/         # ErrorBoundary, LoadingSpinner, Toast, ErrorMessage
```

### Path Aliases

Configured in both `tsconfig.app.json` and `vitest.config.ts`:
- `@/*` → `./src/*`

## Code Style

### TypeScript
- Strict mode enabled. Prefer interfaces for objects, types for unions/intersections
- Avoid `any` (use `unknown` for genuinely unknown types)
- Use explicit return types for public functions
- Prefer `async/await` over promise chains
- Avoid JSDoc documentation (code should be self-documenting)
- Extract magic numbers into named constants

### Naming Conventions
- PascalCase for types/interfaces
- camelCase for variables/functions
- UPPER_CASE for constants
- Descriptive names with auxiliary verbs (e.g., `isLoading`, `hasError`)
- Props interfaces suffixed with `Props` (e.g., `ButtonProps`)

### React Patterns
- Use function components (not class components)
- Call hooks at top level only, never conditionally
- Specify all dependencies in hook dependency arrays
- Use `key` prop with unique IDs (prefer over array indices)
- Use `ref` as a prop (React 19 pattern, not `forwardRef`)
- Don't define components inside other components
- Remove `console.log`, `debugger`, `alert` from production code

### Styling
- Tailwind CSS with custom travel-themed colors (Alpine Teal `#4A9E9E`, Lake Blue `#6BB6D6`, Fern Green `#5B8C5A`, Sandy Beige `#F2E7D5`)
- Use utility classes over custom CSS
- Use shadcn/ui components when available
- Mobile-first responsive design

### Code Organization
- Keep type definitions close to usage
- Use barrel exports (index.ts) for organizing exports
- Keep functions focused with low cognitive complexity
- Use early returns to reduce nesting

## Environment Variables

Create `.env.local` for local development with:

```bash
# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

**Important**: Firebase must be configured with Firestore enabled. See [docs/specs/firebase-integration.md](docs/specs/firebase-integration.md) for security rules and detailed architecture.
