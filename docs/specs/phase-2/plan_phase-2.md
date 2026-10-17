# Wanderlog Phase 2 - Plan

Plan for [design_phase-2.md](design_phase-2.md) / [requirements_phase-2.md](requirements_phase-2.md). The milestone tracker comes first; each milestone's detailed plan follows as its own `##` section (previously one `plan_p2m<N>_<topic>.md` file per milestone, folded in here).

Detailed plans were written just-in-time: each milestone's plan was authored when the previous milestone shipped, so task detail reflects the real code shape rather than speculation. Each milestone is independently shippable.

## Milestone Tracker

| Milestone | Status | Verification gate |
|-----------|--------|-------------------|
| [M0 - Toolchain](#m0-toolchain-upgrade) | Shipped (2026-07-03) | Build + 218 tests green; manual smoke (map, routes, timeline, drag-reorder, export); one GH Pages deploy |
| [M1 - Foundation](#m1-supabase-foundation) | Shipped (2026-07-04) | Parity checklist (Req 1.7) passes on a Vercel preview |
| [M2 - Auth gate](#m2-auth-gate) | Shipped (2026-07-04) | Unauthenticated access fully blocked; family members sign in |
| [M3 - Trip library](#m3-trip-library) | Shipped (2026-07-04) | 2+ trips browsable and selectable |
| [M3.5 - Trip import](#m35-trip-import) | Shipped (2026-07-04) | Each sample file (native + 2 TripIt) imports and renders; invalid files rejected with listed errors; re-import creates an independent copy |
| [M4 - Itinerary editing](#m4-itinerary-editing) | Shipped (2026-07-04) | Each slice (activities; accommodation + trip metadata; waypoints + stops) edits and persists round-trip |

Infrastructure that lands alongside milestones (see design):

- Vercel project + CI deploy pipeline: with M1, verified on preview URLs
- Production cutover + GH Pages retirement: with M2
- Maps key referrer restrictions: with hosting
- Post-cutover: final Firestore export archived, Firebase deps removed

---

## M0: Toolchain Upgrade

**Goal:** Upgrade all frontend frameworks and toolchain to latest stable before any Phase 2 feature work, keeping the app pixel-identical and all 218 tests green.

**Architecture:** No production code changes intended; this was a dependency and config migration. Each cluster was bumped and committed separately so regressions bisect to one commit. Verification was the existing test suite plus a manual smoke of the running app.

### Global Constraints

- Package manager: pnpm. Never edit `pnpm-lock.yaml` by hand.
- `firebase` stayed at `^12.6.0` - excluded from all upgrades (decommissioned within Phase 2).
- Version numbers were latest stable as of 2026-07-03; upgrades stayed within the planned majors.
- One commit per task, conventional-commit style (`chore: ...`).
- No refactoring or reformatting of app code beyond what an upgrade forced (Ultracite task excepted - its job is formatting).
- GH Pages was still the live host during M0; `base: '/wanderlog/'` in `vite.config.ts` stayed.

### Tasks

#### Task 1: Baseline + minor/patch sweep

Recorded the green baseline (218 tests, clean build), then bumped all minor/patch dependencies with majors and firebase excluded. `@types/node` stays on major 24 deliberately - it matches the Node 24 LTS runtime, not the newest types major.

#### Task 2: Vite 8 + Vitest 4 cluster

Bumped Vite 8, plugin-react 6, Vitest 4 (+ coverage and UI companions), and jsdom 29 in one commit: Vitest 3's Vite peer range tops out at 7, so bumping Vite alone leaves a broken peer graph. Only two test files needed changes, for Vitest 4's constructor-mock behavior.

#### Task 3: TypeScript 6

Bumped to TypeScript 6; fixes were config-only - removed the deprecated `baseUrl` and added `"types": ["node"]` to both tsconfigs, since TS 6 defaults `types` to `[]`.

#### Task 4: Tailwind CSS 4

Ran the official `@tailwindcss/upgrade` tool: the four travel-theme colors and the Inter stack moved into a CSS-first `@theme` block in `src/index.css`, `tailwind.config.js` was deleted, and PostCSS switched to `@tailwindcss/postcss`. The never-registered `@tailwindcss/typography` plugin was dropped rather than migrated; verified visually against production side by side.

#### Task 5: Ultracite 7 + Biome 2.5, retire stale eslint remnants

Bumped Ultracite 7 / Biome 2.5 (presets renamed to `ultracite/biome/core` + `ultracite/biome/react`; `style/noSubstr` disabled rather than rewriting app code). Fixed the broken `lint` script - it called an eslint that was never installed - to `ultracite check`.

#### Task 6: CI on Node 24 LTS + deploy verification

Bumped the deploy workflow from Node 22 to 24. Push triggers were disabled, so the verification run was dispatched manually; build, tests, and the GH Pages deploy all passed on Node 24.

#### Task 7: Final M0 verification gate

Full local verification plus a manual smoke of the deployed site (map, route polyline, timeline, drag-reorder and done-toggle surviving refresh, export, POI search, no new console errors). Marked M0 shipped in the [tracker](#milestone-tracker).

### Critical Files - Summary

| File | Change |
|---|---|
| `tsconfig.app.json`, `tsconfig.node.json` | TS 6: no `baseUrl`, `"types": ["node"]` |
| `src/index.css` | Tailwind 4 CSS-first config: `@theme` holds the four travel colors + Inter stack |
| `biome.jsonc` | Ultracite 7 preset names; `style/noSubstr` disabled |

Deleted: `tailwind.config.js` (replaced by the CSS-first `@theme` config).

### Self-Review Notes

- Vite/Vitest merged into one task because of the peer-dependency coupling; the design doc's table listed them as separate rows, superseded here.

---

## M1: Supabase Foundation

**Goal:** App reads and writes trip data from Supabase (Postgres + RLS) with full feature parity against the Firestore version, verified by the Req 1.7 parity checklist on a Vercel preview.

**Architecture:** Five relational tables replace the whole-blob Firestore doc. `supabaseService` is the only module touching supabase-js; mappers convert rows to the existing nested `TripData` shape so components stay untouched. TanStack Query owns server state (persisted to IndexedDB for offline reads); `AppStateContext` slims to UI state. A minimal login gate exists from day one because RLS denies anonymous access. Firestore stays intact (Req 8.1).

### Global Constraints

- Prerequisite: [M0](#m0-toolchain-upgrade) shipped; baseline was 218 tests green.
- Firestore data and `firebaseService` code stay intact this milestone (Req 8.1). The app bundle must not import firebase; the migration script may still import it.
- Domain types in `src/types/trip.ts` do not change - parity depends on them (Req 1.3).
- Secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are client-safe. `SUPABASE_SERVICE_ROLE_KEY` is script-only, never `VITE_`-prefixed, never imported by `src/**`.
- GH Pages remains the production host; Vercel serves previews only until M2 cutover.
- Unit tests mock supabase-js via `vi.mock` of the config module (same pattern the old storageService tests used for firebaseService).

### Tasks

#### Task 1: Supabase project scaffolding + client config

Created the hosted `wanderlog` project with new-user sign-ups disabled (Req 2.4), initialized local dev via the Supabase CLI, and added `getSupabase()` in `src/config/supabase.ts` as the single place env vars are read.

#### Task 2: Schema migration + RLS

Wrote `supabase/migrations/20260703000000_phase2_schema.sql`, the canonical schema: five tables with text primary keys, cascade FKs, `sort_order` columns, and `moddatetime` triggers maintaining `updated_at` (the last-write-wins timestamp, Req 4.9). RLS on every table gives authenticated family members full access and anon none (Req 1.6, 2.7), verified by an anon REST call returning `[]`.

#### Task 3: Row-to-domain mappers (TDD)

Added `supabaseMappers` with `toTripData` (row → domain) and its inverse `buildRows`, so components keep consuming the existing nested `TripData`. The mapper is tolerant by design: accommodation may arrive as object, array, or null, and `location` is omitted when no coordinates or address exist; `buildRows` derives trip start/end dates from the stops.

#### Task 4: supabaseService read path (TDD)

Added `fetchTripById` (one nested `TRIP_SELECT`; null for a missing trip, throws on errors) and `fetchTripSummaries` (ordered by `start_date` descending). Ordering by `sort_order` happens in the mappers, so the query needs no per-table order parameters.

#### Task 5: supabaseService write path (TDD)

Added `setActivityDone`, `setWaypointDone`, and `reorderActivities` (sequential `sort_order` per id). Per-row updates are fine at family scale (a stop has under 20 activities); a batch RPC is deliberate YAGNI.

#### Task 6: Migration script

Added `scripts/migrate-to-supabase.ts` (`pnpm migrate:supabase`): it reads the local trip JSON, overlays Firestore user modifications read-only (Req 8.1; `--skip-firestore` for re-runs after Firestore is gone), and upserts all five tables via `buildRows` with the script-only service-role key. Idempotent by upsert on id (Req 1.2).

#### Task 7: TanStack Query provider with IndexedDB persistence

Added `src/lib/queryClient.ts`: the query client with a 30-day `gcTime` (which must be >= the persister `maxAge` or the cache is dropped on restore), an idb-keyval persister, and the `tripKeys` / `weatherKeys` vocabulary every hook uses. `main.tsx` wraps the app in `PersistQueryClientProvider` with cache buster `phase2-v1`.

#### Task 8: Auth bootstrap (minimal login gate)

Added `AuthContext` (`useAuth`: session, signIn, signOut; signOut clears the query cache) and an email/password `LoginForm`; the app gates on session because RLS denies anonymous access. Accounts were provisioned manually in the dashboard with sign-up disabled; route guards, Google sign-in, and sign-out UI are M2.

#### Task 9: Swap the read path to useQuery; slim AppStateContext

Rewrote `useTripData` and `useTrips` on `useQuery`, gated on `session`, keeping the return shape so consumers were untouched. `AppStateContext` slimmed to UI state only; the POI reducer cases that mutated trip data in memory became cache patches (`addActivityToStop`), preserving memory-only behavior until M4, and `viewStateStorage` replaced `storageService` for localStorage-only view preferences.

#### Task 10: Done-toggle and reorder as optimistic mutations

Added optimistic `useToggleActivityDone` and `useReorderActivities` (patch the cache in `onMutate`, roll back on error, invalidate on settle); errors surface through the existing Toast, with a retry affordance deferred to M4 (Req 4.8).

#### Task 11: Weather on useQuery

Rewrote `useWeather` on `useQuery` with a 6-hour `staleTime` (amended Req 1.5), returning `{ weather, isStale, updatedAt }`. `WeatherCard` shows the data timestamp whenever the data is stale, so offline the persisted cache serves old data with its timestamp instead of an error (Req 5.4).

#### Task 12: Legacy cleanup - firebase out of the app bundle

| Path | Change |
|---|---|
| `src/hooks/useAppState.ts` | Deleted |
| `src/hooks/useLocalStorage.ts` | Deleted |
| `src/services/storageService.ts` (+ test) | Deleted; view-state pieces live in `viewStateStorage.ts` |
| `src/services/exportService.ts`, `src/utils/exportUtils.ts` | Export no longer merges user modifications - `status.done` and `order` are canonical in the mapped trip |
| `src/App.tsx` | `initializeFirebase()` call removed |
| `src/config/firebase.ts`, `src/services/firebaseService.ts` | Retained script-only; zero imports from `src/**`, bundle shrank by firebase's ~200KB |

#### Task 13: Vercel previews + CI deploy pipeline

Made the Vite base path env-driven (`VITE_BASE_PATH`: `/wanderlog/` for GH Pages, `/` on Vercel), added `vercel.json` (SPA rewrite) and a test-gated Vercel preview workflow (Req 6.2). Vercel's own Git auto-deploy is disabled so CI is the sole deploy path; the preview domain was added to the Maps key referrer restrictions (Req 7).

#### Task 14: Parity checklist walk (Req 1.7) + M1 sign-off

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
- [x] Sign off: M1 row set to `Shipped` in the [tracker](#milestone-tracker)

### Critical Files - Summary

| File | Role |
|---|---|
| `src/config/supabase.ts` | `getSupabase()` client singleton; the only place env vars are read |
| `supabase/migrations/20260703000000_phase2_schema.sql` | Canonical schema: 5 tables, triggers, RLS policies |
| `src/services/supabaseMappers.ts` | Row types + `toTripData` / `buildRows` (row <-> domain, both directions) |
| `src/services/supabaseService.ts` | Browser's data-access entry point (`fetchTripById`, `fetchTripSummaries`, writes); write logic since extracted to the shared `tripWrites.ts`, which `api/` also uses |
| `scripts/migrate-to-supabase.ts` | Idempotent JSON + Firestore-overlay -> Supabase migration (service-role, script-only) |
| `src/lib/queryClient.ts` | Query client, IndexedDB persister, `tripKeys` / `weatherKeys` vocabulary |
| `src/contexts/AuthContext.tsx` | `useAuth()`: session state, signIn/signOut (signOut clears query cache) |
| `src/hooks/useTripData.ts`, `src/hooks/useTrips.ts` | Session-gated useQuery read path |
| `src/hooks/useTripMutations.ts` | Optimistic mutations with rollback; M1's done-toggle was superseded in Phase 4 by `writeVisitFields` / `useVisitRecord` |
| `src/hooks/useWeather.ts` | Weather on useQuery, 6h staleTime, stale timestamp |
| `src/services/viewStateStorage.ts` | localStorage-only view state (last viewed base, map layer prefs) |
| `src/contexts/AppStateContext.tsx` | Slimmed to UI-only state |
| `vercel.json` | SPA rewrite for Vercel |

Deleted: `.github/workflows/vercel-preview.yml` (renamed to `vercel-deploy.yml` in M2).

### Self-Review Notes

- Rollback (Req 8.2): every task leaves GH Pages production untouched; reverting is `git revert` of the offending commit - no dual-backend flag, per the design decision.
- The parity checklist is embedded in Task 14 rather than a separate doc; the requirement asks for a written checklist, which this is, version-controlled.
- `TripSummary` sorting: `fetchTripSummaries` orders by `start_date` descending (library needs, Req 3.2) even though M1 renders a single trip - one query shape, no rework in M3.
- Weather `enabled: coords !== null` preserves today's behavior where bases always have coordinates; the cast is safe because `enabled` gates execution.

---

## M2: Auth Gate

**Goal:** The app is fully login-protected behind route guards with polished email/password and Google sign-in, production moves to Vercel, and GitHub Pages retires (Requirements 2, 6.4).

**Architecture:** react-router replaces conditional rendering at the top level: `/login`, `/trips/:tripId`, and `/` (redirect to the last-selected trip). A `ProtectedRoute` wrapper enforces the gate client-side; RLS (live since M1) enforces it server-side. Google sign-in uses supabase-js PKCE flow - no dedicated callback route needed. Sign-out purges the query cache and its IndexedDB persistence.

### Global Constraints

- Prerequisite: [M1](#m1-supabase-foundation) shipped - `AuthProvider`/`useAuth`, `LoginForm`, `queryClient`/`persister`, `viewStateStorage`, Vercel previews all existed.
- No schema or RLS changes this milestone.
- Secrets: the Google OAuth client secret lives only in the Supabase dashboard provider config - never in the repo or Vercel env.
- Interim dual-hosting: GH Pages (base `/wanderlog/`) stayed production until Task 6; all router code works under both base paths via `basename={import.meta.env.BASE_URL}`.

### Tasks

#### Task 1: Introduce react-router

Added `react-router` and turned `App.tsx` into a router shell (`/login`, `/`, `/trips/:tripId`, `*`), extracting the authenticated UI into `TripPage`; `HomeRedirect` sends `/` to the last-selected trip, falling back to a hardcoded `DEFAULT_TRIP_ID` (removed in M3). The router mounts under `basename={import.meta.env.BASE_URL}` so it works on both GH Pages (`/wanderlog/`) and Vercel (`/`).

#### Task 2: ProtectedRoute - the client-side gate

Added `ProtectedRoute`: a spinner while the session loads, a redirect to `/login` (attempted path kept in `location.state.from`) without one, children otherwise; `LoginPage` bounces signed-in users back to `from`. Verified no Supabase REST traffic occurs pre-auth (Req 2.1).

#### Task 3: Login page polish

Styled `LoginPage` as a full-viewport frosted-glass card matching `POIModal`, with password-manager `autocomplete` attributes, verbatim Supabase error text, and a mobile-first layout for on-the-road use.

#### Task 4: Google sign-in (Req 2.3)

Switched the supabase-js client to the PKCE flow with `detectSessionInUrl`, so the OAuth round-trip completes on whatever page the user lands on - no `/callback` route. Added `signInWithGoogle` and a "Continue with Google" button; the Google Cloud OAuth client and Supabase provider config are dashboard-only, and the client secret never leaves the Supabase dashboard.

#### Task 5: Sign-out with cache purge (Req 2.6)

`signOut` now calls `supabase.auth.signOut()`, then `queryClient.clear()`, then `clearPersistedCache()` (deletes the `wanderlog-query-cache` IndexedDB key), so no trip data survives sign-out. Added `UserMenu` with a Sign out item; the auth listener nulls the session and `ProtectedRoute` performs the redirect, so there is no manual navigation.

#### Task 6: Production cutover to Vercel

Renamed the preview workflow to `vercel-deploy.yml` and split it: PRs get previews, `main` pushes get test-gated production deploys (Req 6.2). The production domain, Maps key referrers, Supabase Site URL, and Google OAuth origins were repointed at the Vercel domain (dashboard steps); GH Pages kept deploying in parallel until Task 7.

#### Task 7: Retire GitHub Pages (Req 6.4)

Deleted `deploy.yml`, collapsed the Vite `base` to `/` (the `basename` trick degrades to a no-op), removed `VITE_BASE_PATH` from the Vercel env, disabled repo Pages, and dropped the GH Pages origin from the Maps key referrers. The retired `https://kevinlin.github.io/wanderlog/` URL is documented in the README.

#### Task 9: Password reset + invitation acceptance (post-M2 addition, Req 2.8/2.9)

Closed a gap after M2 sign-off: manual provisioning (Req 2.4) gave invitees no in-app way to set an initial password and members no way to recover a forgotten one, so `AuthContext` gained `resetPassword` / `updatePassword` and the app gained public `/forgot-password` (non-enumerating confirmation) and `/reset-password` pages. Recovery and invitation share the one landing page because both emails deliver a PKCE `?code=` link that `detectSessionInUrl` exchanges into a session, after which the user sets a password via `updateUser`; the routes sit outside `ProtectedRoute` because guarding them would bounce the link to `/login` and drop the code. Dashboard-only, documented but not coded: add `<origin>/reset-password` to the Auth Redirect URLs and point the invite email template at it.

#### Task 8: M2 verification gate (Req 2) + sign-off

Verified Req 2 and Req 6.1/6.4 against production (https://wanderlog-xi.vercel.app): zero pre-auth Supabase REST traffic, email/password and Google sign-in work, sign-up is rejected, the session survives a browser restart, sign-out purges the token and IndexedDB cache, anonymous REST returns `[]`, and the old GH Pages URL 404s. Marked the M2 row `Shipped` in the [tracker](#milestone-tracker).

### Critical Files - Summary

| Path | Role |
|------|------|
| `src/App.tsx` | Router shell: route table with `ProtectedRoute`-wrapped authenticated routes. |
| `src/pages/TripPage.tsx` | Authenticated trip UI (map/timeline/activities); reads `:tripId`, records it via `setCurrentTripId`. |
| `src/pages/LoginPage.tsx` | Frosted-glass login surface (email/password + Google), redirects signed-in users. |
| `src/pages/ForgotPasswordPage.tsx`, `src/pages/ResetPasswordPage.tsx` | Public reset entry and the shared recovery/invitation landing (Req 2.8/2.9). |
| `src/pages/HomeRedirect.tsx` | Redirects `/` to the last-selected trip. |
| `src/components/Auth/ProtectedRoute.tsx` | Client-side auth gate: spinner / `/login` redirect / children. |
| `src/components/Auth/UserMenu.tsx` | Floating control with sign-out. |
| `src/contexts/AuthContext.tsx` | `signInWithGoogle` (PKCE), `signOut` with cache purge, `resetPassword`, `updatePassword`. |
| `.github/workflows/vercel-deploy.yml` | Preview (PR) + production (main) deploy pipeline. |

Deleted: `.github/workflows/deploy.yml` (GH Pages deploy, Task 7).

### Self-Review Notes

- Task 1 leaves a one-commit window where `/trips/:tripId` renders without a session but fetches nothing (queries stay `enabled: !!session`); Task 2 closes it. Acceptable because commits within a milestone are not deploys - production cutover happens in Task 6, after the gate is complete.
- `/trips` (library) is deliberately absent from the route table - it arrives in M3; the catch-all redirects unknown paths home.

---

## M3: Trip Library

**Goal:** Authenticated family members browse all trips at `/trips` with derived past/active/upcoming status, open any trip, create new trips, and delete trips with cascade - turning the app from a single-trip viewer into a journal (Requirement 3).

**Architecture:** A `TripLibraryPage` under the existing `ProtectedRoute` renders trip summary cards from the `['trips']` query. Status derivation is a pure function of trip dates and the trip's own timezone. Create/delete are `useMutation` hooks over two new `supabaseService` functions; the DB cascade (M1 schema) does the cleanup. `HomeRedirect` falls back to `/trips` instead of the hardcoded trip id.

### Global Constraints

- Prerequisite: [M2](#m2-auth-gate) shipped - router, `ProtectedRoute`, `UserMenu`, Vercel production all live.
- No schema changes: the M1 tables and their `on delete cascade` FKs already support everything here. RLS's blanket authenticated CRUD covers the new writes.
- New trip ids are client-generated `crypto.randomUUID()` (design: text PKs, natural keys for migrated rows, UUIDs for new rows).
- Domain type `TripData` stays untouched; only `TripSummary` grows fields.

### Tasks

#### Task 1: Extend trip summaries with library fields (TDD)

Moved `TripSummary` from `AppStateContext.tsx` to `src/types/trip.ts` and grew it with `destination`, `start_date`, `end_date`, `timezone`, `created_at`, and `updated_at`, widening the `fetchTripSummaries` select to hydrate them.

#### Task 2: Trip status derivation (TDD)

Added `src/utils/tripStatusUtils.ts`: `deriveTripStatus` (past/active/upcoming against "today" in the trip's own timezone via `Intl.DateTimeFormat('en-CA', { timeZone })`, so lexicographic `YYYY-MM-DD` compares are safe), `pickHeroTrip` (active, else soonest upcoming, else null), and `sortForLibrary` (start_date descending).

#### Task 3: createTrip / deleteTrip service functions (TDD)

Added `createTrip` (client-minted `crypto.randomUUID()`; removed again in M3.5) and `deleteTrip`; delete relies on the M1 `on delete cascade` FKs with no client-side fan-out (Req 3.6).

#### Task 4: Trip library page

Added `TripLibraryPage` (`/trips`, inside `ProtectedRoute`) and `TripLibraryCard`: the `pickHeroTrip` result renders as a full-width hero card and the rest as a responsive grid with date range and a status badge (`fern-green` active / `lake-blue` upcoming / `gray-400` past). Added a "Trips" item to `UserMenu` and deleted the unwired pre-M1 `TripSelectorModal` scaffolding.

#### Task 5: Home redirect + last-trip restore (Req 3.4)

`HomeRedirect` now sends `/` to `/trips/:lastTripId` when one is remembered, otherwise to `/trips` (the M2 `DEFAULT_TRIP_ID` was removed). `TripPage` shows a "This trip no longer exists" state with a link to `/trips` when a remembered-but-deleted trip resolves `null`.

#### Task 6: Create trip (Req 3.5)

Added `CreateTripModal` and `useCreateTrip` (name, optional destination, dates validated `endDate >= startDate`, timezone auto-filled from the device); on success it invalidates `['trips']` and navigates to the new trip. Also hardened `TripPage` for empty trips (`stops.length === 0`) with a map-background overlay card instead of assuming `stops[0]`.

#### Task 7: Delete trip with confirmation (Req 3.6)

Added a reusable destructive `ConfirmDialog` (reused in M4) and `useDeleteTrip`: a hover/long-press trash affordance on the card opens the dialog, and confirming deletes, drops `['trip', id]` from the cache, invalidates `['trips']`, and clears the stored current-trip id if it matches.

#### Task 8: M3 verification gate (Req 3) + sign-off

Verified Req 3.1-3.6 on production: the library lists every trip with status badges, the hero is the active/next-upcoming trip, `/` restores the last opened trip, create opens without crashing, and delete requires confirmation with no orphan child rows (cascade confirmed in the Supabase Table Editor). Marked the M3 row `Shipped` in the [tracker](#milestone-tracker).

### Critical Files - Summary

| Path | Role |
|------|------|
| `src/types/trip.ts` | Home of `TripSummary` (now with destination + date range fields). |
| `src/utils/tripStatusUtils.ts` | Pure `deriveTripStatus` / `pickHeroTrip` / `sortForLibrary`; timezone-aware status. |
| `src/services/supabaseService.ts` | `deleteTrip` (cascade via DB FKs); `createTrip` was removed in M3.5. |
| `src/hooks/useTripLibraryMutations.ts` | `useDeleteTrip`; `useCreateTrip` was replaced by `useImportTrip` in M3.5. |
| `src/pages/TripLibraryPage.tsx` | `/trips` library page: hero + card grid. |
| `src/components/TripLibrary/TripLibraryCard.tsx` | Trip card with status badge and delete affordance. |
| `src/components/Layout/ConfirmDialog.tsx` | Reusable destructive-confirm dialog (reused in M4). |

Deleted: `src/components/TripLibrary/CreateTripModal.tsx` (replaced by the import flow in M3.5; see M3.5 Critical Files for its current home).

### Self-Review Notes

- Status derivation runs in the trip's own timezone (design: "derived status vs today in the trip's timezone") - the Auckland test case pins the UTC-rollover behavior.
- `deleteTrip` needs no optimistic update: the confirm dialog already inserts a deliberate pause, and the library invalidation refetches in one round trip.
- Trip metadata *editing* (name, dates, description) is deliberately absent - that is M4 slice 2 (Req 4.5).

---

## M3.5: Trip Import

**Goal:** Trip creation becomes file import: drag-and-drop a trip data JSON (Wanderlog export or TripIt export) into the create modal, validate it with zod, convert TripIt files (geocoding lodging addresses), and save the trip to Supabase with fresh ids - nothing is saved without a file that passes validation (Req 3.5, 3.7-3.9).

**Architecture:** A client-side pipeline - `file → JSON.parse → detectFormat → zod validate → convert (TripIt: + geocode) → withFreshIds → buildRows → importTrip`. New modules: `src/schemas/tripFileSchemas.ts` (zod schemas), `src/services/tripImportService.ts` (detection, orchestration, TripIt conversion), `src/services/geocodingService.ts` (Maps Geocoder wrapper). `CreateTripModal` is replaced by `ImportTripModal` with drop-zone / processing / preview / error-list states. See [design_phase-2.md](design_phase-2.md) § Trip Import (M3.5).

### Global Constraints

- Prerequisite: [M3](#m3-trip-library) shipped.
- No DB schema changes: the M1 tables cover everything; RLS's blanket authenticated CRUD covers the new inserts.
- All imported rows get client-generated `crypto.randomUUID()` ids (Req 3.9). Never preserve ids from the file.
- `buildRows` (supabaseMappers) is reused as-is for domain→row conversion; do not modify it.
- `validationUtils.ts` stays untouched - it serves other callers; the zod schemas are the import gate.
- Blank-trip creation is removed (Req 3.5 amendment): `createTrip`/`useCreateTrip` are deleted with their tests.

### Tasks

#### Task 1: zod + Wanderlog-file schema (TDD)

Added `zod` (^4) and `wanderlogTripSchema`, which validates a `TripData`-shaped object (required name/timezone/at least one stop, IANA-timezone and lat/lng range checks, `YYYY-MM-DD` dates, a closed `ActivityType` enum, and a nameless accommodation treated as absent); `toTripData` fills missing `duration_days` from each stop's dates. Unknown keys (`constraints`, `travellers`, ...) are stripped on purpose, since the DB has no columns for them. Trimmed shared fixtures (native DaNang plus Zurich and KL TripIt exports) back the schema, converter, and modal tests.

#### Task 2: Format detection, fresh ids, native parse path (TDD)

Added the `tripImportService` pipeline primitives: `detectFormat` (Wanderlog wrapper/bare vs TripIt `trips[]` vs unknown), `withFreshIds` (new UUIDs for trip/stop/activity/waypoint so imports never reuse file ids), and `parseTripFile`, which maps zod issues to `{ path, message }` entries. The TripIt branch shipped as an honest "not available yet" stub, keeping the native path independently shippable.

#### Task 3: TripIt schema + converter (TDD)

Added `tripitSchemas` (only the consumed fields) and replaced the stub with the real converter: each lodging becomes a geocoded stop (check-in/out from `checkIn`/`checkOut`, falling back to parsing `checkInText`), flights attach to the nearest stop as `transport` activities (year resolved from the trip start with a New-Year rollover guard), and the device timezone is stamped with a warning since TripIt exports carry none. A geocoding failure is a blocking error naming the address, and the converted output is re-validated through `wanderlogTripSchema` as a final gate before preview.

#### Task 4: Shared Maps loader + geocoding service

Introduced `src/config/mapsLoader.ts` (`MAPS_LOADER_OPTIONS`, stable `id`) and switched `MapContainer` from `<LoadScript>` to `useJsApiLoader`: `<LoadScript>` owns the script tag and removes it on unmount, so a second loader on `/trips` would double-inject the API, whereas a shared-`id` `useJsApiLoader` loads Maps once app-wide. Added `geocodeAddress`, a `google.maps.Geocoder` wrapper returning the first result's coordinates or `null` (the JS API rejects on `ZERO_RESULTS`); the loader swap is behavior-neutral, verified with a manual map smoke test.

#### Task 5: importTrip service function (TDD)

Added `importTrip(tripData)`, reusing `buildRows` unchanged and inserting in FK order (`trips` → `stops` → `accommodations` → `activities` → `scenic_waypoints`, skipping empty tables). On any child-insert failure it compensates by deleting the trip row, which cascades away already-inserted children, and rethrows.

#### Task 6: ImportTripModal + useImportTrip; remove blank-create

Added `ImportTripModal` (drop-zone / processing / awaiting-maps / preview / error-list states) and `useImportTrip`, and removed blank-trip creation per the Req 3.5 amendment (`CreateTripModal`, `useCreateTrip`, `createTrip`/`CreateTripInput` and their tests). The modal rejects non-JSON and files over 5 MB, lists field-path validation errors, enables "Create" only in `preview`, and lazily loads Maps for TripIt files before geocoding; on success `useImportTrip` invalidates `['trips']` and navigates to the new trip.

#### Task 7: M3.5 verification gate (Req 3.5, 3.7-3.9) + sign-off

Verified on a preview/production: the native DaNang file and both TripIt files (Zurich → two geocoded stops with transport activities; KL → one stop via the `checkInText` fallback) import and render; `.txt`, broken-JSON, and wrong-shape files show errors with "Create" disabled and nothing saved; re-importing DaNang yields two independent trips with UUID ids and no orphan children after a delete. Marked the M3.5 row `Shipped` in the [tracker](#milestone-tracker).

### Critical Files - Summary

| Path | Role |
|------|------|
| `src/schemas/tripFileSchemas.ts` | `wanderlogTripSchema` + `toTripData`; the import validation gate. |
| `src/schemas/tripitSchemas.ts` | `tripitFileSchema` - TripIt fields the converter consumes. |
| `src/services/tripImportService.ts` | Pipeline: `detectFormat`, `withFreshIds`, `parseTripFile`, TripIt converter. |
| `src/config/mapsLoader.ts` | Shared `MAPS_LOADER_OPTIONS` (single app-wide Maps load). |
| `src/services/geocodingService.ts` | `geocodeAddress` (Maps Geocoder wrapper). |
| `src/services/supabaseService.ts` | `importTrip` - FK-ordered insert with compensation delete; the logic since moved to the shared `insertTripBundle` in `tripBundleInsert.ts`, which the agent's `create_trip` also uses. |
| `src/hooks/useTripLibraryMutations.ts` | `useImportTrip` (replaced `useCreateTrip`). |

Replaced later: `src/components/TripLibrary/ImportTripModal.tsx` became `ImportTripPanel.tsx`, rendered by `NewTripPage` (post-Phase 2).

### Self-Review Notes

- `withFreshIds` runs inside `toPreview`, so the preview the user approves carries the exact ids that get inserted - what you see is what you save.
- TripIt flight dates carry no year; the converter resolves against the trip's start year with a New-Year rollover guard (`candidate < startDate → +1 year`). Trips spanning more than one year would mis-assign - accepted at family scale.
- `duration_days` for TripIt stops is computed from the derived date range with the same `differenceInCalendarDays` formula `toTripData` uses for native files missing it.

---

## M4: Itinerary Editing

**Goal:** All itinerary details editable in the UI with optimistic persistence to Supabase, delivered in three shippable slices: activities CRUD; accommodation + trip metadata; scenic waypoints + stop restructuring (Requirement 4).

**Architecture:** Every edit is a `useMutation` over a single-row (or small-batch) `supabaseService` write, wrapped in one shared optimistic helper: patch the `['trip', tripId]` cache in `onMutate`, roll back on error with a retry toast (Req 4.8), invalidate on settle. Editing UX is a pencil-icon-opens-modal pattern per card (design decision), reusing M3's `ConfirmDialog` for deletes. Offline disables all edit affordances via a `useOnlineStatus` hook (Req 4.10). One additive migration extends `accommodations` with the columns Req 4.4 needs.

### Global Constraints

- Prerequisite: [M3](#m3-trip-library) shipped - library, `ConfirmDialog`, create/delete trip all live.
- Slices ship in order (A: Tasks 1-5, B: Tasks 6-8, C: Tasks 9-11); each slice ends with its own round-trip verification and is independently deployable.
- New row ids are client-generated `crypto.randomUUID()`.
- Domain types may gain optional fields only (`Accommodation.remarks`); nothing existing is renamed or removed - the export JSON shape must stay backward-compatible (Req 8.3).
- Last-write-wins needs no client code: the `moddatetime` trigger stamps `updated_at` on every update (Req 4.9); Task 11 verifies the behavior.

### Slice A - Activities CRUD (Req 4.1, 4.2, 4.3, 4.8, 4.10)

#### Task 1: Activity write-path service functions (TDD)

Added `createActivity`, `updateActivity`, and `deleteActivity` write functions with an `ActivityInput` type; an `activityInputToRow` mapper converts camelCase input to snake_case columns, defaulting unspecified optional fields to null.

#### Task 2: Retry toasts + offline edit-disable plumbing (Req 4.8, 4.10)

Added `useOnlineStatus` (`useSyncExternalStore` over `online`/`offline` events), gave `Toast` an optional retry `action`, and changed the `OfflineIndicator` copy to "editing disabled" - the old "changes will sync" was never true.

#### Task 3: Shared optimistic mutation helper; refactor M1 mutations onto it (TDD)

Extracted the cancel/snapshot/patch/rollback/invalidate boilerplate from M1's done-toggle and reorder hooks into the generic `useTripCacheMutation<TVars, TResult>` (`{ tripId, mutationFn, patch, errorMessage }`), which restores the snapshot and shows a retry toast on error. Both M1 hooks moved onto it with their existing optimistic/rollback tests passing unchanged as the safety net.

#### Task 4: Activity mutations + edit modal

Built `useCreateActivity` / `useUpdateActivity` / `useDeleteActivity` on the shared helper, the reusable `ItemModalShell` (Save/Cancel footer), and `ActivityFormModal` (with "Find place" via `placesService`), wired as pencil/trash icons on `ActivityCard` and "Add activity" on `ActivitiesPanel`; the dnd-kit sortable context is disabled offline. The M1 in-memory POI-add cache patch was replaced by `useCreateActivity`, so POI results now persist.

#### Task 5: Slice A ship gate

Verified Req 4.1 (add persists), 4.2 (edit/delete persist, pins update), 4.3 (drag-reorder canonical), and 4.8 (error toast with Retry on network failure).

### Slice B - Accommodation + trip metadata (Req 4.4, 4.5)

#### Task 6: Accommodation columns migration + service functions (TDD)

Added `remarks`, `lat`, and `lng` to `accommodations` via an additive migration, extended the `Accommodation` type and mappers, and added `upsertAccommodation` (deterministic id `${stopId}_accommodation`, so one modal covers add and edit) and a partial-patch `updateTripMetadata`. `pnpm migrate:supabase` idempotency was re-verified.

> **Post-ship fix (2026-07-04): production outage from unpushed migration.** The frontend shipped to Vercel while the migration was only applied locally — production had no `accommodations.lat/lng/remarks` columns. The mapper guard `row.lat !== null` passed for `undefined`, producing `location: { lat: undefined, lng: undefined }` (truthy), so the accommodation-pin fallback never fired and Google Maps threw a fatal error on every trip page.
>
> Remediation: applied the migration with `supabase db push --linked`; hardened mapper coordinate guards to `== null` so absent columns behave like nulls. Lesson: push migrations to production before or with the frontend deploy that depends on them.

#### Task 7: Accommodation edit modal

Built `AccommodationFormModal` on `ItemModalShell` (address with "Find place", check-in/out via `datetime-local`, confirmation, url, remarks) with `useUpsertAccommodation`; a pencil on `AccommodationCard` and "Add accommodation" on stops without one, both hidden offline.

#### Task 8: Trip metadata editing + Slice B ship gate

Built `TripMetadataFormModal` (name, description, dates with `end >= start`), reachable from "Edit trip" in the trip-page `UserMenu` and the library card pencil; `useUpdateTripMetadata` invalidates both `['trips']` and `['trip', tripId]`. The Slice B gate verified Req 4.4 (accommodation edits persist, the pin follows the address) and Req 4.5 (rename/date change shows in the library and on the trip page).

### Slice C - Scenic waypoints + stop restructuring (Req 4.6, 4.7)

#### Task 9: Waypoint CRUD (service + mutations + modal)

Mirrored the activity pattern against `scenic_waypoints` (`WaypointInput` has no `type`; three service functions and hooks; `WaypointFormModal`); `useCreateWaypoint` replaced the M1 in-memory POI waypoint patch, so waypoints now persist. Verified Req 4.6: waypoint add/edit/delete re-routes the polyline because `MapContainer`'s directions effect recomputes from `tripData`.

#### Task 10: Stop restructuring (Req 4.7)

Added the pure `recalculateStopDates` date cascade (each stop keeps its night count; stop 0 starts at `tripStartDate`; each later stop starts the day its predecessor ends), stop service functions with a batched `applyStopStructure` that also updates the trip span, and a `StopsEditor` modal with dnd-kit sortable rows, per-row `StopFormModal`, and a cascade warning on delete. Policy: stop restructuring recomputes the trip's date span; direct metadata date edits (Task 8) set trip dates but never move stops; LWW arbitrates.

#### Task 11: M4 + Phase 2 verification gate, decommission follow-through

Verified Req 4.6, 4.7 (reorder cascades dates, timeline, and routes), 4.9 (concurrent edits: later save wins, no error), 4.10 (offline disables every M4 edit affordance), and 8.3 (export downloads valid trip JSON with edited data). Completed the Firebase decommission: final Firestore export archived to `local/firestore-export/`, the `firebase` dependency removed, and `src/config/firebase.ts`, `src/services/firebaseService.ts`, `src/types/storage.ts`, and `scripts/migrate-to-firestore.ts` deleted.

### Design Decisions

- `ActivityFormModal` and `WaypointFormModal` stay separate components on one `ItemModalShell`; a config-driven generic form for two-and-a-half variants would cost more than it saves.
- Trip-dates-vs-stop-dates policy: stops drive the span on restructure, metadata edits don't move stops, LWW arbitrates. Stated once in Task 10; encoded nowhere else.
- The accommodation migration is the only schema change in M4, additive-only — migrated rows get nulls, `buildRows` stays idempotent.
- Req 4.3 (canonical reorder) shipped in M1; Slice A re-verifies it after the helper refactor rather than rebuilding it.
- Firebase decommission lands in Task 11 rather than a separate milestone: it only becomes safe once nothing can need a Firestore fallback, which is true after the last slice ships.

### Critical Files - Summary

| Path | Role |
|------|------|
| `src/hooks/useTripCacheMutation.ts` | Shared optimistic mutation helper (snapshot/patch/rollback/invalidate/retry) |
| `src/hooks/useTripMutations.ts` | All entity mutation hooks (activity, waypoint, accommodation, stop; metadata via `useUpdateTripMetadata`) |
| `src/hooks/useOnlineStatus.ts` | `useSyncExternalStore` hook for online/offline tracking |
| `src/components/Editing/` | `ItemModalShell` plus `ActivityFormModal`, `AccommodationFormModal`, `WaypointFormModal`, `TripMetadataFormModal`, and `StopsEditor` (place search wherever an address is edited) |
| `src/services/supabaseService.ts` | Exports the M4 write functions (`createActivity`, `upsertAccommodation`, `applyStopStructure`, ...) as thin adapters; the logic since moved to the shared `tripWrites.ts` |
| `src/utils/stopDateUtils.ts` | Pure `recalculateStopDates` date cascade function |
| `supabase/migrations/*_accommodation_edit_fields.sql` | Additive `remarks`, `lat`, `lng` columns |

---

## Outstanding Follow-ups

- (M1) Enable the Places API on the Vercel Maps key (POI search returns REQUEST_DENIED on previews).
- (M1) Cold offline start needs a service worker (Req 5.2); parity with GH Pages holds today - neither loads the shell offline.

## Changelog

- 2026-10-17 — **Compacted post-implementation.** Thinned per-task bodies to intent, trimmed Critical Files and Self-Review Notes to forward-useful entries, and removed the per-milestone Tech Stack lines (`package.json` owns them) now that Phase 2 has shipped. Preserved the tracker, each milestone's Goal/Architecture and Global Constraints, the Req 1.7 parity checklist, the M4 Design Decisions and Task 6 incident note, the follow-ups, and every changelog entry. Critical Files now point at post-Phase-2 homes where code moved (`ImportTripPanel`, the shared `tripWrites` / `tripBundleInsert`, Phase 4's `writeVisitFields`). Original text is recoverable via git history.
- 2026-10-17 — **Folded the per-milestone plans into this file.** The M0, M1, M2, M3, M3.5, and M4 plans (`plan_p2m0_toolchain-upgrade.md` … `plan_p2m4_itinerary-editing.md`) are now the `##` sections above and the files were removed; inbound links were repointed here. Each had already been compacted post-implementation on its own (2026-07-04 for M0-M3.5, 2026-07-10 for M4). Their changelogs are merged below with a milestone tag; entries that duplicated an event already logged here were dropped, and same-day order is approximate. Original files are recoverable via git history.
- 2026-07-04: M4 Slice C (waypoints + stop restructuring) shipped and M4 verification gate passed - Phase 2 complete. Waypoint CRUD persists (replacing the M1 cache-only POI add); StopsEditor reorders/adds/edits/deletes stops with a client-side date cascade committed as one structure write that also updates the trip span. LWW, offline lockout of all M4 edit affordances, and export re-verified locally. Firebase decommissioned: final Firestore export archived in `local/firestore-export/`, firebase dep + config/service/legacy migration script removed, Supabase migration script no longer reads Firestore. Production re-check after deploy.
- 2026-07-04 — **M4:** Task 6 post-ship fix documented - production outage from the accommodation migration not being pushed before deploy; migration applied, mapper coordinate guards hardened to `== null` with regression tests.
- 2026-07-04: M4 Slice B (accommodation + trip metadata) shipped. Accommodation add/edit via upsert modal with place search, remarks and pin coordinates (additive migration); trip rename/description/date edits from the library card pencil and the trip page UserMenu, reflected in both views via invalidation. Verified end-to-end against local Supabase; production re-check after deploy.
- 2026-07-04: M4 Slice A (activities CRUD) shipped. Add/edit/delete with place search, optimistic persistence with retry toasts, offline editing lockout, drag-reorder re-verified under the shared mutation helper. Verified end-to-end against local Supabase; production re-check after deploy.
- 2026-07-04 — **M2: Task 9 added (post-M2) — password reset + invitation acceptance (Req 2.8/2.9).** `AuthContext.resetPassword`/`updatePassword`, `LoginForm` "Forgot password?" link, public `/forgot-password` + `/reset-password` pages (one shared landing for recovery and invite via PKCE code exchange), 13 new/updated unit tests. Full suite green (356), build + lint clean. Requirements Req 2.8/2.9 and the design Authentication section updated alongside. Remaining (dashboard-only): add `<origin>/reset-password` to Auth Redirect URLs and point the invite email template at it.
- 2026-07-04 — **M3: UI: corner-pinned controls on TripPage.** The `UserMenu` no longer shifts left (`sm:right-[25rem]`) to dodge the activities panel; it stays pinned to the top-right corner. The activities panel now starts below the control row on desktop (`sm:top-16`, was `sm:top-4`) and its expanded height gains a `sm:h-[calc(100vh-5rem)]` cap so it clears the buttons without overflowing. Library-page `UserMenu` placement is unchanged. Files: `src/pages/TripPage.tsx`, `src/components/Activities/ActivitiesPanel.tsx`. Companion AgentButton change logged in the [Phase 3 plan changelog](../phase-3/plan_phase-3.md#changelog).
- 2026-07-04: M3 shipped; M3.5 (trip import) specced and planned - trip creation becomes file import (Req 3.5 amendment), slotting between M3 and M4.
- 2026-07-04 — **M2:** Task 8 verification gate passed against production (https://wanderlog-xi.vercel.app). Automated checks: pre-auth zero supabase requests, signup rejected (422 signup_disabled), anonymous REST returns [], sign-out purges token + IndexedDB cache, checkmark toggle persists round-trip, GH Pages URL 404s. Manual confirmations: Google sign-in round-trips, family accounts work, session survives browser restart. M2 signed off.
- 2026-07-04: M2 shipped. Production is https://wanderlog-xi.vercel.app (login-gated, Google + email sign-in, sign-out cache purge); GH Pages retired. Verification gate passed against production.
- 2026-07-04 — **M2:** Tasks 1-7 code shipped (react-router, ProtectedRoute, login polish, Google sign-in PKCE, sign-out with cache purge, Vercel deploy workflow, GH Pages retirement). Remaining before Task 8 sign-off: manual dashboard setup (Google OAuth client + Supabase provider/URL config, Vercel domain + env cleanup, Maps key referrers, repo Pages disable), push to main, and production verification.
- 2026-07-04: M4 plan written (three slices: activities CRUD with retry/offline plumbing; accommodation + trip metadata incl. additive accommodations migration; waypoints + stop restructuring with date cascade; Firebase decommission tail).
- 2026-07-04: M1 shipped. Parity checklist passed on the Vercel preview (hosted Supabase, migrated data, CI deploys). Two follow-ups: enable Places API on the Vercel Maps key (POI search returns REQUEST_DENIED); cold offline start needs a service worker (parity with GH Pages holds - neither loads the shell offline).
- 2026-07-03: M3 plan written (library page, timezone-aware status, create/delete trips, last-trip restore).
- 2026-07-03: M2 plan written (react-router gate, Google sign-in, Vercel production cutover, GH Pages retirement).
- 2026-07-03: M1 plan written ahead of M0 execution on request; task detail targets the post-M0 toolchain. Plan files adopt the `plan_p2m<N>_<topic>.md` scheme.
- 2026-07-03: Created with M0 plan; M1-M4 plans to follow just-in-time.
