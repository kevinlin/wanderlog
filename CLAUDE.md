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
pnpm lint             # Run ESLint
```

Run a single test file:
```bash
pnpm vitest run src/path/to/file.test.ts
```

## Architecture

### State Management

Uses React Context with useReducer pattern (`src/contexts/AppStateContext.tsx`):
- `AppState` holds trip data, current selection, user modifications, weather cache
- Actions: `SET_TRIP_DATA`, `SELECT_BASE`, `SELECT_ACTIVITY`, `TOGGLE_ACTIVITY_DONE`, `REORDER_ACTIVITIES`, etc.
- User modifications (activity completion, reorder) persist to localStorage via `storageService`

### Data Flow

1. **Trip data** loads from JSON files in `public/trip-data/` (format: `YYYYMM_LOCATION_trip-plan.json`)
2. **useTripData hook** fetches and validates trip data via `tripDataService`
3. **AppStateContext** manages global state; components dispatch actions
4. **storageService** persists user modifications to localStorage

### Key Domain Types (src/types/trip.ts)

- `TripData` → contains `stops: TripBase[]`
- `TripBase` → a location/stop with `accommodation`, `activities[]`, `scenic_waypoints[]`
- `Activity` → individual activity with location, type, status
- `UserModifications` → user's completion status and custom activity ordering

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

- **TypeScript**: Strict mode enabled. Prefer interfaces for objects, avoid `any` (use `unknown`).
- **Naming**: PascalCase for types/interfaces, camelCase for variables/functions, UPPER_CASE for constants.
- **Props**: Suffix with `Props` (e.g., `ButtonProps`).
- **Styling**: Tailwind CSS with custom travel-themed colors (Alpine Teal, Lake Blue, Fern Green, Sandy Beige).
- **Components**: Use shadcn/ui patterns when applicable.

## Environment

Requires `VITE_GOOGLE_MAPS_API_KEY` in `.env.local` for local development. GitHub Actions uses the `GOOGLE_MAPS_API_KEY` secret for deployment.
