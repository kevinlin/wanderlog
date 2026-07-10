# Generative Trip Creation + Programmatic Contract (Phase 3, M3) Implementation Plan

**Goal:** The agent can create a complete trip from a description ("plan a 5-day Tokyo trip in March"): a `geocode` tool with a server-side key, a `create_trip` bundle tool running the import pipeline (validate → fresh ids → FK-order insert → compensation delete), result navigation in the modal, and the contract verified end-to-end for Hermes (Phase 3 Requirements 5 and 7).

**Architecture:** Two tools join the M2 registry. `geocode` calls the Google Geocoding REST API with `GOOGLE_GEOCODING_API_KEY` (server key; the browser Maps key is referrer-restricted and unusable here) and returns coordinates or a structured miss the model can retry. `create_trip` accepts the full nested itinerary in the same JSON shape the model reads from `get_trip`, validates it with the same `wanderlogTripSchema` gate as file import, and inserts through a shared `insertTripBundle` function extracted from `supabaseService.importTrip` — one pipeline, two callers. The handler captures the trip-created change event into `result.tripId`; the modal turns that into an "Open trip" button. Buffered JSON mode, 400-before-model validation, and NDJSON streaming shipped in M1 — this milestone verifies them as the stable Hermes contract.

**Tech Stack:** Google Geocoding REST API, zod v4 (`z.toJSONSchema`), existing schemas in `src/schemas/tripFileSchemas.ts`, `withFreshIds` (`src/services/tripImportService.ts`), `buildRows` (`src/services/supabaseMappers.ts`), Vitest 4.

## Global Constraints

- Prerequisite: Phase 3 M2 shipped ([plan_p3m2_bounded-edits.md](plan_p3m2_bounded-edits.md)) - `api/_lib/tools/` registry with `AGENT_TOOLS`, `toChanges` plumbing, `progressLabel`, write-rules system prompt.
- `GOOGLE_GEOCODING_API_KEY` is server-side only (no `VITE_` prefix, never in the client bundle); it is a separate key from the browser Maps key, restricted to the Geocoding API.
- `create_trip` is all-or-nothing via compensation delete (Req 5.4); every other write stays incremental. Trip, stop, and item ids are minted by `withFreshIds` — model-supplied ids are discarded.
- `MAX_TOKENS_PER_CALL` rises 4096 → 8192: a full trip bundle in one `tool_use` block is the largest payload the loop ever requests. `MAX_ITERATIONS = 16` stays; `maxDuration: 300` already covers the wall clock.
- Plain Messages API only, provider-agnostic via `ANTHROPIC_BASE_URL` — unchanged from M1.
- `api/` imports from `src/` stay pure-module-only: `tripFileSchemas`, `tripImportService.withFreshIds`, `tripBundleInsert` (client passed in, no singleton).

---

## Implementation Plan

### Task 1: Geocoding env + `geocode` tool

Extended `AgentEnv` with `googleGeocodingApiKey` (required). Created `api/_lib/tools/geocode.ts` with `buildGeocodeTool(apiKey)` — calls the Google Geocoding REST API, returns `{ found: true, lat, lng, formatted_address }` on a match, `{ found: false }` on `ZERO_RESULTS` (not an error — the model retries with a coarser query), and throws on service-level failures (`REQUEST_DENIED`, non-200 HTTP). The tool registry became a builder `buildAgentTools(geocodingApiKey)` since geocode needs the API key at construction time. Handler passes `env.googleGeocodingApiKey`. Extended `progressLabel` templates for address-carrying inputs.

### Task 2: Shared trip-bundle insert (extraction from `importTrip`)

Extracted the FK-order insert body from `supabaseService.importTrip` into `src/services/tripBundleInsert.ts` — a pure, client-injected `insertTripBundle(client, tripData, overrides?)` function. Inserts in FK order (trips → stops → accommodations → activities → scenic_waypoints), skipping empty tables. On any child insert failure, compensation-deletes the trip row (cascade removes children). `supabaseService.importTrip` became a one-liner: `insertTripBundle(getSupabase(), tripData)`. Existing `importTrip` tests passed unchanged as the refactor's safety net. The `overrides` parameter allows setting `destination` (agent-created trips carry it; file imports don't).

### Task 3: `create_trip` tool

Created `api/_lib/tools/createTrip.ts` with `CREATE_TRIP_TOOL`. The input schema mirrors the nested trip JSON the model reads (stops with `date`/`location`, optional accommodation, activities, waypoints), reusing exported leaf schemas from `tripFileSchemas.ts`. Stop `location` is required (never guess coordinates). The executor runs the canonical `wanderlogTripSchema` validation gate (same as file import), then `withFreshIds` → `insertTripBundle`. Returns a summary including `activities_without_coordinates` (activities without map pins are fine but should be listed). The `toChanges` hook reports a single `created: trip` event. Registry test updated to pin all 16 tools (14 M2 + geocode + create_trip), still no `delete_trip`.

### Task 4: Loop token cap + truncation handling + `result.tripId`

Raised `MAX_TOKENS_PER_CALL` from 4096 to 8192 for creation-sized payloads. Added `max_tokens` stop-reason handling: a truncated response may carry a mangled `tool_use` block, so the loop emits an error event and stops instead of executing. In the handler, `runToEvents` now tracks trip-created change events and injects the trip id into the `result` event's `tripId` field — the same mechanism drives both stream and buffered modes.

### Task 5: System prompt creation rules

Appended creation-specific rules to `CORE_RULES`: use geocode for stop coordinates (never guess), retry coarser on a miss; call `create_trip` exactly once with the full itinerary after geocoding every stop; derive timezone from destination as an IANA name; build stop dates as a contiguous chain; geocode activities where practical (pin-less is fine but list them in the summary). Superseded the M2 stop-coordinates bullet with the expanded version.

### Task 6: Modal "Open trip" navigation

Implemented the "Open trip" button in the modal result view: renders when `result.tripId` is set, navigates to `/trips/${result.tripId}` and closes the modal. The `['trips']` invalidation on run completion (from M1) already makes the new trip appear in the library without pressing this button.

### Task 7: Contract finalization + M3 verification gate

Configured Vercel env vars (`GOOGLE_GEOCODING_API_KEY`). Provisioned the dedicated Hermes family-member account in Supabase Auth. Cross-checked the design doc's API contract section against the implementation (request body, four event shapes, buffered shape, status codes, `result.tripId` semantics). Verified end-to-end: Hermes-style buffered curl session with the Tokyo prompt (changes contains `created: trip`, `tripId` set, `errors: []`); 400 pre-model on empty body. In-app: agent creates a fully rendered trip (stops pinned, timeline navigable, activities listed, un-geocoded activities render without pins and are named in summary), appears in library with destination and date range, plausible IANA timezone. Negative test: "plan a trip to Atlantis" — geocoding fails, agent reports failure, no half-created trip.

---

## Design Decisions

- One insert pipeline: `insertTripBundle` is extracted, not duplicated — file import and `create_trip` cannot drift apart on FK order or compensation semantics. Existing `importTrip` tests guard the refactor.
- The agent-facing `create_trip` schema avoids the file-import `z.preprocess` accommodation wrapper (transforms have no reliable JSON Schema form); the canonical `wanderlogTripSchema` still validates every bundle at execution, so the two shapes cannot diverge on what gets inserted.
- `MAX_TOKENS_PER_CALL = 8192` is sized for a one-block trip bundle; a `max_tokens` stop is surfaced as an explicit error instead of executing a possibly truncated `tool_use` block.
- `result.tripId` derives from the trip-created change event in one place (the handler's `emitTracked`), so stream and buffered renderings cannot disagree.
- `geocode` returns `found: false` (not an error) on `ZERO_RESULTS` so the model can retry with a coarser query — matching the client-side `geocodingService` pattern.

## Critical Files — Summary

| Path | Role |
|------|------|
| `api/_lib/tools/geocode.ts` | `buildGeocodeTool(apiKey)` — Google Geocoding REST API wrapper |
| `api/_lib/tools/createTrip.ts` | `CREATE_TRIP_TOOL` — full itinerary creation with fresh ids + compensation delete |
| `api/_lib/tools/index.ts` | `buildAgentTools(geocodingApiKey)` — 16-tool registry builder |
| `api/_lib/loop.ts` | `MAX_TOKENS_PER_CALL = 8192`, `max_tokens` truncation handling |
| `api/agent.ts` | `result.tripId` tracking from trip-created change events |
| `src/services/tripBundleInsert.ts` | Shared client-injected FK-order insert with compensation delete |
| `src/schemas/tripFileSchemas.ts` | Exported leaf schemas reused by the `create_trip` input schema |
| `src/components/Agent/AgentModal.tsx` | "Open trip" navigation button |

## Changelog

- 2026-07-10 — **Compacted post-implementation.** Removed step-by-step implementation tasks, file-by-file diffs, code snippets, test code, and verification command lists now that the feature has shipped. Preserved Goal, Architecture, Global Constraints, Design Decisions, and Critical Files summary. Original plan is recoverable via git history.
- 2026-07-04: Initial plan (written ahead of M1/M2 execution; symbol names follow the M1 and M2 plans).
