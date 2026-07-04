# Trip Import (Phase 2, M3.5) Implementation Plan

**Goal:** Trip creation becomes file import: drag-and-drop a trip data JSON (Wanderlog export or TripIt export) into the create modal, validate it with zod, convert TripIt files (geocoding lodging addresses), and save the trip to Supabase with fresh ids - nothing is saved without a file that passes validation (Req 3.5, 3.7-3.9).

**Architecture:** A client-side pipeline - `file → JSON.parse → detectFormat → zod validate → convert (TripIt: + geocode) → withFreshIds → buildRows → importTrip`. New modules: `src/schemas/tripFileSchemas.ts` (zod schemas), `src/services/tripImportService.ts` (detection, orchestration, TripIt conversion), `src/services/geocodingService.ts` (Maps Geocoder wrapper). `CreateTripModal` is replaced by `ImportTripModal` with drop-zone / processing / preview / error-list states. See [design_phase-2.md](design_phase-2.md) § Trip Import (M3.5).

**Tech Stack:** zod 4 (new dependency), TanStack Query v5, @supabase/supabase-js v2, @react-google-maps/api (`useJsApiLoader`), date-fns, Tailwind 4, Vitest 4.

## Global Constraints

- Prerequisite: M3 shipped ([plan_p2m3_trip-library.md](plan_p2m3_trip-library.md)).
- No DB schema changes: the M1 tables cover everything; RLS's blanket authenticated CRUD covers the new inserts.
- All imported rows get client-generated `crypto.randomUUID()` ids (Req 3.9). Never preserve ids from the file.
- `buildRows` (supabaseMappers) is reused as-is for domain→row conversion; do not modify it.
- `validationUtils.ts` stays untouched - it serves other callers; the zod schemas are the import gate.
- Blank-trip creation is removed (Req 3.5 amendment): `createTrip`/`useCreateTrip` are deleted with their tests.

---

### Task 1: zod + Wanderlog-file schema (TDD)

Added `zod` (^4) and `src/schemas/tripFileSchemas.ts`: `wanderlogTripSchema` validates a `TripData`-shaped object (required `trip_name`/`timezone`/`stops.min(1)`, an IANA-timezone refinement, lat/lng range checks, `YYYY-MM-DD` date format, a closed `ActivityType` enum, and a `preprocess` that treats a nameless accommodation as `undefined`), and `toTripData` fills missing `duration_days` from each stop's date range. Unknown keys (`constraints`, `travellers`, etc.) are stripped by zod's default object behavior - deliberate, since the DB has no columns for them. Shared trimmed fixtures live in `src/testing/fixtures/tripFiles.ts` (native DaNang export plus Zurich and KL TripIt exports), reused by the schema, converter, and modal tests.

### Task 2: Format detection, fresh ids, native parse path (TDD)

Added `src/services/tripImportService.ts` pipeline primitives: `detectFormat` (wanderlog wrapper/bare vs TripIt `trips[]` vs unknown), `withFreshIds` (mints new UUIDs for trip/stop/activity/waypoint ids so imports never reuse file ids), and `parseTripFile(text, geocode)` which JSON-parses, detects the format, runs the native path through `wanderlogTripSchema`, and maps zod issues to `{ path, message }` entries. `withFreshIds` runs inside `toPreview`, so the preview the user approves carries the exact ids that get inserted. The TripIt branch shipped as a stub returning an honest "not available yet" error, keeping the native path independently shippable.

### Task 3: TripIt schema + converter (TDD)

Added `src/schemas/tripitSchemas.ts` (validates only the consumed fields; `website` accepts a string or `{href}`) and replaced the Task 2 stub with the real converter. `parseTripitDateTime` parses TripIt's human date strings; `tripitToTripData` turns each lodging into a geocoded stop (address via `geocodeAddress`; check-in/out from `checkIn`/`checkOut`, falling back to parsing `checkInText`), assigns flights to the nearest stop as `transport` activities (flight year resolved from the trip start date with a New-Year rollover guard), and stamps the device timezone with a warning since TripIt exports carry none. A geocoding failure is a blocking error that names the address; the converted output is re-validated through `wanderlogTripSchema` as a final gate before preview.

### Task 4: Shared Maps loader + geocoding service

Introduced `src/config/mapsLoader.ts` (`MAPS_LOADER_OPTIONS` with a stable `id`) and switched `MapContainer` from `<LoadScript>` to `useJsApiLoader`. Rationale: `<LoadScript>` owns the script tag and removes it on unmount, so a second loader on `/trips` would double-inject the API; `useJsApiLoader` with a shared `id` loads Maps once app-wide and is safe to call from both the map and the import modal. Added `src/services/geocodingService.ts` - `geocodeAddress` wraps `google.maps.Geocoder`, returning the first result's coordinates or `null` (the JS API rejects on `ZERO_RESULTS`). The loader swap is behavior-neutral, verified with a manual map smoke test.

### Task 5: importTrip service function (TDD)

Added `importTrip(tripData): Promise<string>` to `supabaseService`, reusing `buildRows` (unchanged) and inserting in FK order (`trips` → `stops` → `accommodations` → `activities` → `scenic_waypoints`, skipping empty tables). On any child-insert failure it compensates by deleting the trip row - which cascades away any already-inserted children - and rethrows.

### Task 6: ImportTripModal + useImportTrip; remove blank-create

Added `ImportTripModal` (a drop-zone / processing / awaiting-maps / preview / error-list state machine) and `useImportTrip`, and removed blank-trip creation per the Req 3.5 amendment (deleted `CreateTripModal`, `useCreateTrip`, and `createTrip`/`CreateTripInput` with their tests). The modal rejects non-JSON and files over 5 MB, runs `parseTripFile` with `geocodeAddress`, lists field-path validation errors, and enables "Create" only in the `preview` phase; a small `MapsGate` inner component lazily loads Maps for TripIt files before geocoding (conditional render keeps the hook unconditional). On success `useImportTrip` invalidates `['trips']` and navigates to the new trip.

### Task 7: M3.5 verification gate (Req 3.5, 3.7-3.9) + sign-off

Verified on a preview/production: the native DaNang file and both TripIt files import and render (Zurich → two geocoded stops with transport activities; KL → one stop via the `checkInText` fallback); `.txt`, broken-JSON, and valid-JSON-wrong-shape files each show errors with "Create" disabled and nothing saved; re-importing the DaNang file yields two independent trips, all rows carrying UUID ids with no orphan children after a delete. Marked the M3.5 row `Shipped` in `plan_wanderlog-phase-2.md`.

---

## Critical Files - Summary

| Path | Role |
|------|------|
| `src/schemas/tripFileSchemas.ts` | `wanderlogTripSchema` + `toTripData`; the import validation gate. |
| `src/schemas/tripitSchemas.ts` | `tripitFileSchema` - TripIt fields the converter consumes. |
| `src/services/tripImportService.ts` | Pipeline: `detectFormat`, `withFreshIds`, `parseTripFile`, TripIt converter. |
| `src/config/mapsLoader.ts` | Shared `MAPS_LOADER_OPTIONS` (single app-wide Maps load). |
| `src/services/geocodingService.ts` | `geocodeAddress` (Maps Geocoder wrapper). |
| `src/services/supabaseService.ts` | `importTrip` - FK-ordered insert with compensation delete. |
| `src/hooks/useTripLibraryMutations.ts` | `useImportTrip` (replaced `useCreateTrip`). |
| `src/components/TripLibrary/ImportTripModal.tsx` | Import UI: drop-zone / preview / error state machine. |
| `src/components/Map/MapContainer.tsx` | Loads Maps via `useJsApiLoader` + the shared loader. |
| `src/testing/fixtures/tripFiles.ts` | Shared trimmed sample files for import tests. |

## Self-Review Notes

- The Task 2 `parseTripitFile` stub keeps the native path shippable alone; Task 3 replaces it. Tasks are still reviewable independently - the stub returns an honest "not available yet" error.
- `withFreshIds` runs inside `toPreview`, so the preview the user approves carries the exact ids that get inserted - what you see is what you save.
- The LoadScript → useJsApiLoader swap (Task 4) is the one change touching existing behavior; it has a manual smoke step for the map page before commit.
- TripIt flight dates carry no year; the converter resolves against the trip's start year with a New-Year rollover guard (`candidate < startDate → +1 year`). Trips spanning more than one year would mis-assign - accepted at family scale.
- `duration_days` for TripIt stops is computed from the derived date range with the same `differenceInCalendarDays` formula `toTripData` uses for native files missing it.
- Deleting `createTrip`/`useCreateTrip` is in-scope cleanup: this feature's amendment (Req 3.5) is what orphans them.

## Changelog

- 2026-07-04 — **Compacted post-implementation.** Removed step-by-step tasks, code snippets, fixtures, `Files:`/`Interfaces:` preambles, and verification command lists now that M3.5 has shipped. Preserved Goal/Architecture, Global Constraints, Self-Review Notes, and added a Critical Files summary. Original plan recoverable via git history.
- 2026-07-04: Initial plan.
