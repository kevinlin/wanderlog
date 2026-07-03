# Wanderlog Phase 2 - Requirements Document

## Introduction

Phase 2 turns Wanderlog from a read-mostly viewer of a single trip into an editable, login-protected travel journal that manages multiple trips. The backend moves from Firebase Firestore to Supabase (Postgres), authenticated family members can browse past and future trips, and itinerary details become editable in the UI with changes persisted to the backend.

The application remains a React 19 + TypeScript + Vite single-page app with Google Maps integration. Existing UI behavior defined in `requirements_travel-journal.md` carries over unchanged except where this document amends it.

## Scope Decisions

These decisions were settled before drafting and size everything below. Changing any of them reopens the spec.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Users | Single family, shared trips | Everyone sees and edits the same trips. Auth is a gate against strangers, not user isolation. No account management flows. |
| Backend | Migrate to Supabase (Postgres) | Trip data is relational (trips → stops → activities). Document modeling forces whole-blob rewrites and approaches Firestore's 1MB document limit. |
| Auth | Supabase Auth, email/password; optional Google sign-in | Integrates directly with row-level security. Auth0 was evaluated and rejected: feasible via SPA SDK + PKCE, but adds a third vendor and JWT-to-RLS wiring for no benefit at family scale. |
| Offline | View-only | Cached trips readable without connectivity; edits require a connection. This is the accepted price of leaving Firestore's built-in offline sync. |
| Hosting | Move off GitHub Pages to Vercel (Netlify or Cloudflare Pages are acceptable substitutes) | SPA rewrites, clean auth callback URLs, root path instead of `/wanderlog/` subpath. GitHub Pages is not broken; the alternatives are better at the same cost. |
| Server-side code | None | Weather API (Open-Meteo) is keyless, so there is no key to proxy. No hosted server, no API layer between UI and database. Revisit Edge Functions if a keyed third-party API is added. |
| Write conflicts | Last-write-wins with `updated_at` timestamp | Family scale needs no locking or merge logic. |
| Sequencing | Five milestones, toolchain first | See Milestones section. Frameworks are upgraded before migration work starts; editing is built once, on the final schema. |

## Requirements

### 1. Relational Backend Migration

**User Story:** As the app owner, I want trip data stored in a relational Supabase schema, so that individual itinerary items can be created, updated, and deleted without rewriting whole trip documents.

**Acceptance Criteria:**
1. WHEN the schema is defined, THEN it SHALL model trips, stops, accommodations, activities, and scenic waypoints as separate tables with foreign keys and explicit ordering columns.
2. WHEN the migration script runs, THEN it SHALL transfer all existing trip data from Firestore (or the source JSON files in `local/trip-data/`) into Supabase without data loss, and SHALL be re-runnable (idempotent).
3. WHEN the app loads trip data, THEN it SHALL read from Supabase and render identically to the pre-migration Firestore version (feature parity).
4. WHEN activity completion and ordering are stored, THEN they SHALL be canonical columns (`is_done`, `sort_order`) on the itinerary tables, shared by all family members; device-level view state (last viewed stop/date, map layer preferences, last selected trip) remains in localStorage.
5. WHEN weather data is cached, THEN it SHALL be cached client-side in a persisted query cache with the same 6-hour staleness rule as the current Firestore cache; no server-side weather cache is required.
6. WHEN any table is accessed, THEN row-level security policies SHALL deny all access to unauthenticated clients.
7. WHEN parity is being verified, THEN a written checklist SHALL confirm each existing feature (map rendering, routes, timeline, activity status, weather, export) against the Supabase read path before Firestore is decommissioned.

### 2. Authentication and Access Protection

**User Story:** As a family member, I want the app protected by a login, so that our trip data is not publicly readable or editable.

**Acceptance Criteria:**
1. WHEN an unauthenticated user opens the app, THEN they SHALL see only a login screen; no trip data SHALL be fetched or rendered.
2. WHEN a user signs in with a valid email and password via Supabase Auth, THEN they SHALL gain full read and write access to all trips.
3. WHEN Google sign-in is configured, THEN family members SHALL be able to authenticate with their Google accounts as an alternative to email/password.
4. WHEN public sign-up is attempted, THEN it SHALL be rejected; accounts are provisioned manually by the app owner.
5. WHEN a session exists, THEN it SHALL persist across browser restarts until explicit sign-out or token expiry.
6. WHEN a user signs out, THEN cached credentials SHALL be cleared and the login screen SHALL be shown.
7. WHEN any Supabase query executes, THEN access SHALL be enforced server-side by row-level security, not only by UI routing.

### 3. Trip Library

**User Story:** As a family member, I want to browse our past and future trips and open any of them, so that the app works as a journal of all our travels rather than a viewer for one trip.

**Acceptance Criteria:**
1. WHEN a user is authenticated, THEN the app SHALL display a trip library listing all trips with name, destination, date range, and a derived status (past, active, upcoming) based on the current date.
2. WHEN the trip list is displayed, THEN trips SHALL be ordered by start date with the active or next upcoming trip most prominent.
3. WHEN a trip is selected, THEN the existing map, timeline, and activities UI SHALL load that trip's data.
4. WHEN the app is reopened, THEN it SHALL restore the last selected trip.
5. WHEN a user creates a new trip, THEN they SHALL provide at minimum a name and date range, and the trip SHALL appear in the library ready for itinerary editing.
6. WHEN a trip is deleted, THEN the user SHALL confirm the action, and all dependent rows (stops, activities, accommodations, waypoints) SHALL be removed with it.

### 4. Itinerary Editing

**User Story:** As a family member, I want to edit itinerary details directly in the UI and have changes saved to the backend, so that trip planning no longer requires editing JSON files.

**Acceptance Criteria:**

*Activities*
1. WHEN a user adds an activity to a stop, THEN they SHALL be able to set its name, type, location, and notes, and it SHALL persist to Supabase.
2. WHEN a user edits or deletes an activity, THEN the change SHALL persist and the map pins SHALL update accordingly.
3. WHEN a user reorders activities via the existing drag-and-drop, THEN the new order SHALL persist to Supabase as the canonical order (replacing the current per-user local ordering).

*Accommodation and trip metadata*
4. WHEN a user edits accommodation details (name, address, check-in/check-out, notes) for a stop, THEN the changes SHALL persist and the accommodation pin SHALL update.
5. WHEN a user edits trip metadata (name, description, date range), THEN the changes SHALL persist and the trip library SHALL reflect them.

*Scenic waypoints and stops*
6. WHEN a user adds, edits, or removes a scenic waypoint, THEN the change SHALL persist and the route SHALL re-render through the updated waypoint sequence.
7. WHEN a user adds, removes, or reorders stops, THEN dependent dates, the timeline, and route polylines SHALL update consistently, and the change SHALL persist.

*Editing behavior*
8. WHEN an edit is saved, THEN the UI SHALL update optimistically and SHALL show an error with a retry option if the write fails.
9. WHEN two sessions edit the same record, THEN the last write SHALL win, tracked by an `updated_at` timestamp; no locking or merge UI is required.
10. WHEN the app is offline, THEN editing controls SHALL be disabled with a visible offline indicator; read access follows Requirement 5.

### 5. Offline Read Access

**User Story:** As a traveler, I want to view my itinerary without connectivity, so that the app remains useful on the road where mobile signal is unreliable.

**Acceptance Criteria:**
1. WHEN trip data is successfully loaded, THEN it SHALL be cached locally (IndexedDB or localStorage).
2. WHEN the app starts without connectivity, THEN it SHALL render the cached trips in read-only mode, including map-independent content (timeline, activity lists, accommodation details).
3. WHEN connectivity returns, THEN the app SHALL refresh from Supabase and re-enable editing.
4. WHEN cached weather data is stale and the app is offline, THEN the stale data SHALL be shown with its timestamp rather than an error.

### 6. Hosting and Deployment

**User Story:** As the app owner, I want the app hosted on a platform with first-class SPA support, so that routing, auth callbacks, and deployments work without GitHub Pages workarounds.

**Acceptance Criteria:**
1. WHEN the app is deployed, THEN it SHALL be served from the root path (removing the `/wanderlog/` Vite base) on Vercel or an equivalent platform with SPA fallback rewrites.
2. WHEN code is pushed to `main`, THEN CI SHALL run the test suite and deploy only on success.
3. WHEN environment configuration is needed, THEN all keys SHALL be managed in the hosting platform's environment settings, not committed to the repository.
4. WHEN the new hosting is verified, THEN the GitHub Pages deployment workflow SHALL be removed and the old URL SHALL redirect or be documented as retired.

### 7. Third-Party API Key Protection

**User Story:** As the app owner, I want third-party API keys kept out of the client bundle where possible, so that they cannot be lifted and abused.

**Acceptance Criteria:**
1. WHEN the app fetches weather data, THEN it MAY call Open-Meteo directly from the client, since Open-Meteo requires no API key. IF a keyed third-party API is introduced later, THEN its key SHALL be held server-side (e.g. a Supabase Edge Function proxy) and SHALL NOT appear in the client bundle.
2. WHEN Google Maps loads, THEN the Maps JavaScript API key MAY remain client-side (the API requires it) and SHALL be protected by HTTP referrer restrictions scoped to the production and development origins.

### 8. Migration Safety and Rollback

**User Story:** As the app owner, I want an escape hatch during the backend migration, so that a failed cutover never loses trip data or leaves the app unusable.

**Acceptance Criteria:**
1. WHEN migration to Supabase is in progress (Milestone 1), THEN Firestore data SHALL remain intact and readable; no destructive changes SHALL be made to it.
2. WHEN the parity checklist (Requirement 1.7) is not fully satisfied, THEN the app SHALL be revertible to the Firestore read path by configuration or rollback of the deployment.
3. WHEN cutover is complete, THEN the trip JSON files in `local/trip-data/` SHALL be retained in the repository as a last-resort export, and the existing JSON export feature SHALL work against Supabase data.
4. WHEN Firestore is decommissioned, THEN a final export of its data SHALL be archived first.

## Milestones

Each milestone is independently shippable and verifiable.

0. **M0 - Toolchain:** Upgrade frontend frameworks and toolchain to latest stable (Tailwind 4, Vite 8, Vitest 4, TypeScript 6, Ultracite/Biome, minor bumps; CI Node 24 LTS) before any Phase 2 code. The Firebase SDK is excluded — it is decommissioned within this phase. *Verification: build and full test suite green; manual smoke of map, routes, timeline, drag-reorder, export.*
1. **M1 - Foundation:** Supabase schema, data migration, app reads from Supabase with full feature parity (Requirements 1, 8). Firestore untouched. *Verification: parity checklist passes.*
2. **M2 - Auth gate:** Login screen, Supabase Auth, RLS enforcement (Requirement 2). *Verification: unauthenticated access is fully blocked; family members can sign in.*
3. **M3 - Trip library:** Multi-trip browsing, selection, creation (Requirement 3). *Verification: two or more trips browsable and selectable.*
4. **M4 - Itinerary editing:** Delivered in slices — activities CRUD first, then accommodation and trip metadata, then scenic waypoints and stop restructuring (Requirement 4). *Verification: each slice edits and persists round-trip.*

Hosting (Requirement 6) and the Maps key referrer restrictions (Requirement 7) land alongside M1/M2 as infrastructure tasks.

## Out of Scope (Deferred)

- **Server-validated write API layer.** Row-level security covers the family threat model. Revisit only if the user base changes.
- **Multi-user data isolation, trip sharing, or public sign-up.** The family-only assumption sizes this spec; changing it reopens Requirements 2 and 3.
- **Auth0 integration.** Evaluated and rejected (see Scope Decisions).
- **Offline editing with sync.** View-only offline is the accepted trade; hand-rolled conflict sync is out.
- **Realtime collaboration.** Last-write-wins is sufficient.
- **Native mobile app.** Responsive web only.
- **Weather key proxying via Edge Functions.** Open-Meteo is keyless; there is no key to protect. Revisit if a keyed third-party API is adopted.

## Changelog

- 2026-07-03: Amended alongside [design_wanderlog-phase-2.md](design_wanderlog-phase-2.md): user modifications become canonical columns (Req 1.4); weather cache moves client-side (Req 1.5); Edge Function weather proxy dropped (Req 7, Scope Decisions); Milestone 0 (toolchain upgrades) added.
