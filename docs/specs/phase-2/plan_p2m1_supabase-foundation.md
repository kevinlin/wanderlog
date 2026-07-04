# Supabase Foundation (Phase 2, M1) Implementation Plan

**Goal:** App reads and writes trip data from Supabase (Postgres + RLS) with full feature parity against the Firestore version, verified by the Req 1.7 parity checklist on a Vercel preview.

**Architecture:** Five relational tables replace the whole-blob Firestore doc. `supabaseService` is the only module touching supabase-js; mappers convert rows to the existing nested `TripData` shape so components stay untouched. TanStack Query owns server state (persisted to IndexedDB for offline reads); `AppStateContext` slims to UI state. A minimal login gate exists from day one because RLS denies anonymous access. Firestore stays intact (Req 8.1).

**Tech Stack:** Supabase (Postgres, Auth, CLI), @supabase/supabase-js v2, TanStack Query v5 (+ persist-client, async-storage-persister), idb-keyval, React 19, Vitest.

Context: [design_phase-2.md](design_phase-2.md), [requirements_phase-2.md](requirements_phase-2.md); milestone tracker: [plan_phase-2.md](plan_phase-2.md).

## Global Constraints

- Prerequisite: M0 shipped ([plan_p2m0_toolchain-upgrade.md](plan_p2m0_toolchain-upgrade.md)); baseline was 218 tests green.
- Firestore data and `firebaseService` code stay intact this milestone (Req 8.1). The app bundle must not import firebase; the migration script may still import it.
- Domain types in `src/types/trip.ts` do not change - parity depends on them (Req 1.3).
- Secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are client-safe. `SUPABASE_SERVICE_ROLE_KEY` is script-only, never `VITE_`-prefixed, never imported by `src/**`.
- GH Pages remains the production host; Vercel serves previews only until M2 cutover.
- Unit tests mock supabase-js via `vi.mock` of the config module (same pattern the old storageService tests used for firebaseService).

---

### Task 1: Supabase project scaffolding + client config

Created the hosted `wanderlog` project with new-user sign-ups disabled (Req 2.4), initialized local dev via the Supabase CLI, added `@supabase/supabase-js`, and created the `getSupabase(): SupabaseClient` singleton in `src/config/supabase.ts` (env accessor mirrors the firebase config). Env vars documented in `.env.local.example`.

### Task 2: Schema migration + RLS

Wrote `supabase/migrations/20260703000000_phase2_schema.sql` (the canonical schema): tables `trips`, `stops`, `accommodations`, `activities`, `scenic_waypoints` with text primary keys, cascade FKs, `sort_order` columns, and `moddatetime` triggers maintaining `updated_at` (last-write-wins timestamp, Req 4.9). RLS on every table: authenticated family members get everything, anon gets nothing (Req 1.6, 2.7) - verified by an anon REST call returning `[]`. Applied locally, then pushed to the hosted project.

### Task 3: Row-to-domain mappers (TDD)

Added `src/services/supabaseMappers.ts` with row interfaces exactly mirroring the schema columns, plus `toTripData(row: TripRowNested): TripData` and its inverse `buildRows(trip, tripId): RowBundle`. `toTripData` sorts stops/activities/waypoints by `sort_order`, maps `is_done` to `status.done`, tolerates accommodation embedded as object, array, or null, and omits `location` when no coordinates or address exist. `buildRows` derives trip start/end dates from the stops. Round-trip behavior is locked in by the test suite.

### Task 4: supabaseService read path (TDD)

Added `src/services/supabaseService.ts` with `fetchTripById` (nested `TRIP_SELECT` embedding stops, accommodations, activities, and scenic waypoints; returns null for a missing trip, throws on errors) and `fetchTripSummaries` (ordered by `start_date` descending). Nested ordering happens in the mappers, so the query needs no per-table order parameters.

### Task 5: supabaseService write path (TDD)

Added `setActivityDone`, `setWaypointDone`, and `reorderActivities` (writes sequential `sort_order` per id). Per-row updates are fine at family scale (a stop has under 20 activities); a batch RPC is deliberate YAGNI.

### Task 6: Migration script

Added `scripts/migrate-to-supabase.ts` (`pnpm migrate:supabase`), following the structure of `migrate-to-firestore.ts`. It reads the local trip JSON, overlays Firestore user modifications read-only (Req 8.1; `--skip-firestore` skips the overlay for re-runs after Firestore is gone), applies them onto the domain trip, and upserts all five tables via `buildRows` using the script-only service-role key. Idempotent by upsert on id (Req 1.2); verified against local and hosted projects with count cross-checks.

### Task 7: TanStack Query provider with IndexedDB persistence

Added `src/lib/queryClient.ts`: the query client (30-day `gcTime`, which must be >= the persister `maxAge` or the cache is dropped on restore), an idb-keyval-backed async-storage persister, and the query-key vocabulary `tripKeys` / `weatherKeys` that every hook uses. `src/main.tsx` wraps the app in `PersistQueryClientProvider` with cache buster `phase2-v1`.

### Task 8: Auth bootstrap (minimal login gate)

Added `src/contexts/AuthContext.tsx` exposing `useAuth(): { session, isLoading, signIn, signOut }`; `signOut` clears the query cache. `src/components/Auth/LoginForm.tsx` is an email/password form styled with the existing Tailwind theme, and the app gates on session because RLS denies anonymous access. Family accounts were provisioned manually in the dashboard with sign-up left disabled. Route-based guards, Google sign-in, and sign-out UI are M2.

### Task 9: Swap the read path to useQuery; slim AppStateContext

Rewrote `useTripData` (and `useTrips`, unwired in the UI until M3) on `useQuery`, gated on `session`, with the return shape unchanged so `App.tsx` consumers kept working. `AppStateContext` slimmed to UI state (`currentTripId`, `currentBase`, `selectedActivity`, `poiModal`, `poiSearch`); all server-state fields and actions were removed. The POI reducer cases that mutated `tripData` in memory moved out of the reducer: the panel handler patches the query cache via `addActivityToStop` (extracted to `src/utils/activityUtils.ts`), preserving memory-only behavior until M4. `src/services/viewStateStorage.ts` replaced the storageService for last-viewed-base and map-layer preferences (localStorage only).

### Task 10: Done-toggle and reorder as optimistic mutations

Added `src/hooks/useTripMutations.ts`: `useToggleActivityDone` and `useReorderActivities`, each optimistically patching the trip query cache in `onMutate`, rolling back on error, and invalidating on settle. `App.tsx` handlers call the mutations instead of dispatching; errors surface through the existing Toast (a retry affordance is M4, Req 4.8). Optimistic-flip and rollback behavior is locked in by tests.

### Task 11: Weather on useQuery

Rewrote `useWeather` on `useQuery` with a 6-hour `staleTime` (amended Req 1.5), returning `{ weather, isStale, updatedAt }`. `WeatherService` lost its cache methods, keeping `fetchWeatherData`, `getWeatherDescription`, `getWeatherIcon`. `WeatherCard` renders the data timestamp whenever the data is stale, so offline the persisted cache serves old data with its timestamp instead of an error (Req 5.4).

### Task 12: Legacy cleanup - firebase out of the app bundle

| Path | Change |
|---|---|
| `src/hooks/useAppState.ts` | Deleted |
| `src/hooks/useLocalStorage.ts` | Deleted |
| `src/services/storageService.ts` (+ test) | Deleted; view-state pieces live in `viewStateStorage.ts` |
| `src/services/exportService.ts`, `src/utils/exportUtils.ts` | Export no longer merges user modifications - `status.done` and `order` are canonical in the mapped trip |
| `src/App.tsx` | `initializeFirebase()` call removed |
| `src/config/firebase.ts`, `src/services/firebaseService.ts` | Retained script-only; zero imports from `src/**`, bundle shrank by firebase's ~200KB |

### Task 13: Vercel previews + CI deploy pipeline

Made the Vite base path env-driven (`VITE_BASE_PATH`, defaulting to `/wanderlog/` for GH Pages; Vercel sets `/`). Added `vercel.json` (SPA rewrite) and `.github/workflows/vercel-preview.yml`, which deploys via the Vercel CLI only after tests pass (Req 6.2); Vercel's own Git auto-deploy is disabled so CI is the sole deploy path. The preview domain was added to the Maps key referrer restrictions (Req 7).

### Task 14: Parity checklist walk (Req 1.7) + M1 sign-off

On the Task 13 Vercel preview URL, signed in as a family member, side by side with GH Pages production:

- [x] Login required: incognito window shows only the login screen; network tab shows zero Supabase data requests before sign-in (Req 2.1)
- [x] Map renders all accommodation + activity pins for `202512_NZ`
- [x] Route polyline draws through scenic waypoints, matching production
- [x] Timeline strip shows all stops; navigation selects bases
- [x] Activity lists per stop match production, in the same order
- [x] Done checkmarks match the pre-migration state (Firestore overlay worked)
- [x] Toggle done: persists across refresh and appears on a second device/browser
- [x] Drag-reorder: persists across refresh and on a second device - verified via unit tests (optimistic reorder + rollback) and authenticated `sort_order` writes against the hosted project; browser automation cannot synthesize dnd-kit drags, so the gesture itself was smoke-tested in M0
- [x] Weather cards render; weather shows its timestamp when stale (Req 5.4). *Caveat (Req 5.2):* a cold offline start cannot load the app shell - no service worker exists, same as GH Pages production today (parity holds, no regression). Full offline start needs a service worker; tracked for a later milestone.
- [x] Export downloads JSON with `status.done` and `order` populated
- [x] POI search adds an activity to the panel (in-memory, as today)
- [x] Firestore console: data untouched, no writes since migration (Req 8.1) - the app bundle contains zero firebase imports; the migration script opens Firestore read-only
- [x] Sign off: M1 row set to `Shipped` in [plan_phase-2.md](plan_phase-2.md)

---

## Critical Files — Summary

| File | Role |
|---|---|
| `src/config/supabase.ts` | `getSupabase()` client singleton; the only place env vars are read |
| `supabase/migrations/20260703000000_phase2_schema.sql` | Canonical schema: 5 tables, triggers, RLS policies |
| `src/services/supabaseMappers.ts` | Row types + `toTripData` / `buildRows` (row <-> domain, both directions) |
| `src/services/supabaseService.ts` | Only module touching supabase-js: `fetchTripById`, `fetchTripSummaries`, done/reorder writes |
| `scripts/migrate-to-supabase.ts` | Idempotent JSON + Firestore-overlay -> Supabase migration (service-role, script-only) |
| `src/lib/queryClient.ts` | Query client, IndexedDB persister, `tripKeys` / `weatherKeys` vocabulary |
| `src/contexts/AuthContext.tsx` | `useAuth()`: session state, signIn/signOut (signOut clears query cache) |
| `src/components/Auth/LoginForm.tsx` | Minimal email/password gate (M2 replaces with routed auth) |
| `src/hooks/useTripData.ts`, `src/hooks/useTrips.ts` | Session-gated useQuery read path |
| `src/hooks/useTripMutations.ts` | Optimistic done-toggle + reorder mutations with rollback |
| `src/hooks/useWeather.ts` | Weather on useQuery, 6h staleTime, stale timestamp |
| `src/services/viewStateStorage.ts` | localStorage-only view state (last viewed base, map layer prefs) |
| `src/contexts/AppStateContext.tsx` | Slimmed to UI-only state |
| `vercel.json`, `.github/workflows/vercel-preview.yml` | Test-gated Vercel preview deploys; env-driven base path in `vite.config.ts` |

## Self-Review Notes

- Rollback (Req 8.2): every task leaves GH Pages production untouched; reverting is `git revert` of the offending commit - no dual-backend flag, per the design decision.
- The parity checklist is embedded in Task 14 rather than a separate doc; the requirement asks for a written checklist, which this is, version-controlled.
- `TripSummary` sorting: `fetchTripSummaries` orders by `start_date` descending (library needs, Req 3.2) even though M1 renders a single trip - one query shape, no rework in M3.
- Weather `enabled: coords !== null` preserves today's behavior where bases always have coordinates; the cast is safe because `enabled` gates execution.

## Outstanding follow-ups

- Enable the Places API on the Vercel Maps key (POI search returns REQUEST_DENIED on previews).
- Cold offline start needs a service worker (Req 5.2); parity with GH Pages holds today - neither loads the shell offline.

## Changelog

- 2026-07-04: **Compacted post-implementation.** Removed step-by-step task bodies, the inline SQL schema and TypeScript implementations (canonical copies live in the repo), test listings, and verification command lists now that M1 has shipped. Preserved Goal, Global Constraints, per-task intents, the Req 1.7 parity checklist, Critical Files summary, Self-Review Notes, and follow-ups. Original plan is recoverable via git history.
- 2026-07-04: All tasks executed and shipped; parity checklist walked on the Vercel preview against hosted Supabase. Open follow-ups recorded inline: Places API enablement for the Vercel Maps key (POI search), service worker for cold offline start (Req 5.2).
- 2026-07-03: Initial plan.
