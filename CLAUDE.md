# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Wanderlog is an interactive map-based travel journal built with React 19, TypeScript, Vite, and Google Maps. It allows users to plan and track trips with timeline navigation, activity tracking, and drag-and-drop reordering.

The backend is **Supabase** (Postgres + Auth + RLS), with **TanStack Query** as the data layer, an auth gate, multi-trip library, and react-router. Firebase/Firestore was decommissioned at the end of Phase 2 (a final export is archived in `local/firestore-export/`). See [docs/specs/phase-2/design_phase-2.md](docs/specs/phase-2/design_phase-2.md).

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
pnpm migrate:supabase # Migrate trip JSON files to Supabase
```

Husky pre-commit auto-formats staged files with Ultracite (`.husky/pre-commit`).

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

State is split in two: **server state** lives in TanStack Query, **UI state** lives in a Context reducer.

**Server state — TanStack Query** (`src/lib/queryClient.ts`):
- Query keys are centralized: `tripKeys.all` (trip list), `tripKeys.detail(tripId)`, `weatherKeys.base(baseId)`.
- Read hooks: `useTrips` (library list), `useTripData` (one trip), `useWeather`. All gated on an auth `session`.
- Mutations are optimistic with rollback (`useTripMutations`, `useTripLibraryMutations`): `onMutate` snapshots + patches the cache, `onError` restores the snapshot, `onSettled` invalidates. Follow this pattern for new writes.
- The cache is persisted to IndexedDB via an `idb-keyval` async persister (`PersistQueryClientProvider` in `main.tsx`), giving offline reads. `gcTime` must stay ≥ `PERSIST_MAX_AGE_MS` (30 days) or the cache is dropped on restore. Bump the `buster` string in `main.tsx` on breaking cache-shape changes.

**UI state — AppStateContext** (`src/contexts/AppStateContext.tsx`): reducer holds only `currentBase`, `currentTripId`, `selectedActivity`, `poiModal`, `poiSearch`. No trip/weather/done-status data here — those moved to the query cache.

**Auth — AuthContext** (`src/contexts/AuthContext.tsx`): session from `supabase.auth`; `ProtectedRoute` guards routes; sign-out purges the persisted query cache.

Provider order (`main.tsx`): `PersistQueryClientProvider` → `AuthProvider` → `AppStateProvider` → `App`.

### Data Flow

1. **Backend** is Supabase Postgres + Auth (RLS). `supabaseService` is the **only** module importing `supabase-js`; it holds all fetch/mutate functions. `supabaseMappers` converts DB rows ↔ domain types.
2. **Read**: route → `useTripData`/`useTrips` → TanStack Query → `supabaseService` → Supabase. Data is validated/mapped into the domain shapes.
3. **Write**: components call mutation hooks → optimistic cache patch → `supabaseService` → Supabase → invalidate on settle.
4. **Done-status** is a canonical `is_done` column shared by all users (no per-user `user_modifications` concept anymore).
5. **Offline**: persisted query cache serves reads; mutations retry.
6. **Migration**: legacy trip JSON (`local/trip-data/`, `YYYYMM_LOCATION_trip-plan.json`) imports via `pnpm migrate:supabase`. Schema + RLS live in `supabase/migrations/*.sql` (Supabase CLI).

### Key Domain Types (src/types/trip.ts)

- `TripData` → contains `stops: TripBase[]`
- `TripBase` → a location/stop with `accommodation`, `activities[]`, `scenic_waypoints[]`
- `Activity` → individual activity with location, type, `status.done`
- `TripSummary` → lightweight row for the trip library list

### Key Services (src/services/)

- **supabaseService** - the only module importing `supabase-js`; trip/list/mutation fetchers.
- **supabaseMappers** - DB row ↔ domain type conversion.
- **weatherService** - fetches from Open-Meteo (keyless); caching handled by TanStack Query `staleTime`.
- **placesService** - Google Places POI search.
- **exportService** - downloads trip data with progress.
- **viewStateStorage** - persists small UI view state.
### Component Structure

```
src/components/
├── Auth/           # LoginForm, ProtectedRoute, UserMenu
├── Map/            # Google Maps integration (MapContainer, POIModal)
├── Cards/          # Activity, Accommodation, Weather, ScenicWaypoint cards
├── Timeline/       # TimelineStrip for date navigation
├── Activities/     # ActivitiesPanel with drag-and-drop (dnd-kit)
├── TripLibrary/    # Multi-trip library UI
└── Layout/         # ErrorBoundary, LoadingSpinner, Toast, ErrorMessage
```

### Routing

react-router (`src/App.tsx`), pages in `src/pages/`. All routes except `/login` wrapped in `ProtectedRoute`:
- `/login` → `LoginPage`
- `/` → `HomeRedirect` (restores last trip / sends to library)
- `/trips` → `TripLibraryPage`
- `/trips/:tripId` → `TripPage` (map, timeline, activities)

Vercel SPA rewrites (`vercel.json`) route all paths to `index.html`.

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

## Deployment

Hosted on Vercel (see `vercel.json`, `.github/workflows/`):
- Push to `main` → test-gated deploy to Vercel production.
- Pull requests → automatic Vercel preview.
- Requires `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID` repo secrets. The former GitHub Pages URL is retired.

## Specs

Spec-driven docs live in `docs/specs/` (`<artifact>_<topic>.md`: requirements / design / plan). Start at [docs/specs/index.md](docs/specs/index.md) for the navigation map; [docs/specs/meta/convention.md](docs/specs/meta/convention.md) is the naming/structure source of truth. Phase 2 milestones are tracked in `phase-2/plan_phase-2.md` (M0–M4).

## Environment Variables

Create `.env.local` for local development (see `.env.local.example`):

```bash
# Google Maps
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# Supabase (current backend)
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key   # script-only (migration); never in the client bundle
```

## Design Context

Strategic design context lives in [PRODUCT.md](PRODUCT.md) (register, users, positioning, brand personality, anti-references). Visual system lives in DESIGN.md. Read them before any UI work.

- Register: `product` (working tool) · Platform: `web`, mobile-first.
- Positioning: a living plan you track as you go — not a static itinerary doc.
- Design principles:
  1. The plan is alive — every screen reflects current state (done, reordered, synced).
  2. Delight in the moments, restraint in the frame — joy in behavior and copy, not ornament.
  3. Two moments, one plan — desk planning and on-the-go phone use as equals, no mode switch.
  4. Shared and trustworthy — canonical plan reads correct for every companion.
  5. Show the trip, not a form — lead with map, timeline, place.
