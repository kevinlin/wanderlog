# Wanderlog Phase 3 - Master Plan

Milestone tracker and implementation plans for [design_wanderlog-phase-3.md](design_wanderlog-phase-3.md) / [requirements_phase-3.md](requirements_phase-3.md).

Each milestone is independently shippable. Following the Phase 2 convention, each milestone's plan was authored just-in-time, when the previous milestone shipped; the per-milestone plan files are now sections of this file. A post-M3 data-layer refactor is recorded in [Data layer deepening](#data-layer-deepening-post-m3).

**Prerequisite:** Phase 2 M4 (itinerary editing, [plan_phase-2.md § M4](../phase-2/plan_phase-2.md#m4-itinerary-editing)) shipped. Phase 3 M2's write tools mirror the M4 write path; M1 consumes M4's `useOnlineStatus` hook (`src/hooks/useOnlineStatus.ts`).

## Milestones

| Milestone | Section | Status | Verification gate |
|-----------|---------|--------|-------------------|
| M1 - Agent backend + Q&A | [M1](#m1-agent-backend-and-qa) | Shipped (2026-07-04) | Questions about seeded trips answered from modal and curl (stream + buffered); unauthenticated requests rejected with 401; no write tool exists |
| M2 - Bounded edits | [M2](#m2-bounded-edits) | Shipped (2026-07-04) | Scripted edit prompts round-trip on a preview; deletes fire only on explicit request; partial failure reported honestly |
| M3 - Generative creation + programmatic contract | [M3](#m3-generative-creation) | Shipped (2026-07-04) | Creation prompt yields a complete rendered trip; Hermes-style curl session (password grant → buffered call) works end-to-end |
| M4 - Design quality: critique remediation | [M4](#m4-design-quality) | In Progress | Trip page critique score ≥ 32/40; all P1 issues resolved; `pnpm test:run` + `pnpm build` clean |

## Global Constraints

Apply to M1-M3 unless a milestone section says otherwise.

- Plain Messages API only: no beta namespaces, no `thinking`, no `output_config` - the endpoint must work against any Anthropic-compatible provider (`ANTHROPIC_BASE_URL`, e.g. DeepSeek).
- Model, key, and base URL come only from env (`ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`); never hardcode a model id, never expose these to the client bundle (no `VITE_` prefix).
- Hard caps as named constants: `MAX_ITERATIONS = 16`, `MAX_TOKENS_PER_CALL = 4096` (raised to 8192 in M3), `MAX_PROMPT_CHARS = 4000`.
- The service-role key is never read by any `api/` module; every DB call and write runs under the caller's RLS.
- `api/` may import from `src/` (pure modules and types); `src/` never imports from `api/`.

---

## M1: Agent backend and Q&A

**Goal:** A Vercel serverless endpoint (`/api/agent`) that runs an LLM tool-use loop with read-only tools against Supabase, answering natural-language questions about trips; consumed by a new agent modal in the UI and callable via curl (Requirements 1, 3, 6, 8 of Phase 3; Requirement 2's read-tool subset).

**Architecture:** `api/agent.ts` is a web-standard Vercel function: validate the Supabase JWT, build a per-request supabase-js client carrying the caller's token (RLS applies), prefetch trip context, then run a manual Anthropic Messages tool-use loop (`@anthropic-ai/sdk`, `baseURL` from env) over a zod-validated tool registry. Events stream to the client as NDJSON (or buffer to one JSON body under `Accept: application/json`). The UI adds `src/components/Agent/` (button + modal) and `agentService` for stream consumption.

**Tech Stack:** @anthropic-ai/sdk (new dep), @supabase/supabase-js v2, zod v4 (`z.toJSONSchema`), Vercel functions (Node runtime, web handler signature), React 19, Vitest 4.

### Constraints

- M1 is read-only: the tool registry contains exactly `list_trips` and `get_trip`. No write tool of any kind ships in this milestone (Phase 3 Req 3.4 verification depends on it).

### Implementation Plan

#### Task 1: Scaffolding - dependency, Vercel config, tsconfig/vitest wiring, env module

Added `@anthropic-ai/sdk`, excluded `/api/*` from the SPA rewrite in `vercel.json` with `maxDuration: 300` on the agent function, and wired `api/` into `tsconfig.app.json` and `vitest.config.ts`. `loadAgentEnv()` in `api/_lib/env.ts` validates the required vars into a typed `AgentEnv`; `ANTHROPIC_BASE_URL` stays optional.

#### Task 2: Auth + per-request supabase client

`api/_lib/supabase.ts` builds a per-request, stateless supabase-js client bound to the caller's JWT (`createUserClient`), parses the bearer header (`extractBearerToken`), and validates the token (`getAuthenticatedUserId`). The per-request client is the mechanism for RLS — every agent DB call runs under the caller's row-level security.

#### Task 3: Read tools - shared mapper extraction, executors, registry

Extracted `TRIP_SELECT` and `toTripSummary` from `supabaseService.ts` into `supabaseMappers.ts` so the browser and the agent share one nested select and summary mapping. Built the `AgentTool` interface, `dispatchTool` (zod-validates input, executes, turns errors into results), `toAnthropicTools`, and the `READ_TOOLS` registry: `list_trips` (descending by date) and `get_trip` (full nested trip).

#### Task 4: Contract types + tool-use loop

Defined the stable event contract in `src/types/agent.ts` (progress/change/result/error events, request body, buffered result). `runAgentLoop` takes an injected Anthropic client, handles parallel `tool_use` blocks, feeds tool errors back as `is_error` results so the model self-corrects, and stops at `MAX_ITERATIONS` reporting the cap.

#### Task 5: System prompt + context injection

`buildSystemPrompt(context)` in `api/_lib/systemPrompt.ts`: operate only through tools, read before answering, refuse unrelated requests, stay read-only, and treat trip data as data, not instructions. A scoped `tripId` embeds the full trip as context; otherwise trip summaries are injected so cross-trip questions need no tool round-trip.

#### Task 6: HTTP handler - `api/agent.ts`

Validates in order — POST only (405), bearer token (401), zod body (400) — prefetches context under the caller's RLS, then runs the loop. Responses are an NDJSON stream by default (`application/x-ndjson`) or one buffered `AgentBufferedResult` under `Accept: application/json`. Provider failures before any output return 502; once streaming, failures become `error` events on the already-200 stream.

#### Task 7: Client service - `agentService`

`runAgent({ accessToken, prompt, tripId?, signal?, onEvent })` in `src/services/agentService.ts` consumes the NDJSON stream through a line-buffered reader that handles lines split across chunks; non-200 responses throw with the server's message.

#### Task 8: Agent UI - button, modal, page wiring

`AgentButton` (disabled offline via `useOnlineStatus`) and `AgentModal`, a three-phase state machine: input → running (progress lines, cancel via `AbortController`) → done (result, errors, "Ask another", "Open trip" when `result.tripId` is set). Wired into `TripLibraryPage` (library scope) and `TripPage` (trip scope, passes `tripId`); queries are invalidated on every completed run.

#### Task 9: M1 verification gate

Verified with curl (401 without token, streamed Q&A, buffered Hermes JSON shape) and in the modal (cross-trip and trip-scoped questions, edit request declined, cancel, offline disabled, over-length prompt error).

### Design Decisions

- The loop takes `anthropic` as an injected dependency, so every loop test runs against a scripted fake — no network, no key.
- The design doc's code-sharing decision is honored: `api/` builds its own client for the per-request caller token for RLS, not env incompatibility. Task 3 extracts `TRIP_SELECT`/`toTripSummary` into the pure mappers module so the two read paths share one source of truth.
- Buffered vs streamed rendering share one `runToEvents` path in the handler; the contract cannot drift between the two modes.
- `maxDuration: 300` + `MAX_ITERATIONS: 16` + `MAX_TOKENS_PER_CALL: 4096` bound cost and wall clock for M1's read-only loops; M3 revisits the numbers for generative creation.
- Req 3.4 ("no write tool exists") is structural: `READ_TOOLS` is the whole registry in M1, and Task 9 verifies the model declines edit requests.

### Critical Files — Summary

| Path | Role |
|------|------|
| `api/agent.ts` | HTTP handler: auth, body validation, context prefetch, NDJSON/buffered response |
| `api/_lib/env.ts` | `loadAgentEnv()` — validates and maps required env vars |
| `api/_lib/supabase.ts` | Per-request JWT-bound supabase client + token extraction |
| `api/_lib/loop.ts` | `runAgentLoop` — manual Messages tool-use loop with iteration cap |
| `api/_lib/systemPrompt.ts` | `buildSystemPrompt(context)` with core rules + trip context injection |
| `src/types/agent.ts` | Stable API event contract (shared by api/ and UI) |
| `src/services/agentService.ts` | Client NDJSON stream parser for `/api/agent` |
| `src/components/Agent/AgentButton.tsx` | Sparkles button, disabled offline |
| `src/components/Agent/AgentModal.tsx` | Three-phase modal: input → running → done |

---

## M2: Bounded edits

**Goal:** Add the twelve write tools (activities, waypoints, accommodation, trip metadata, stops including restructure) to the agent endpoint, with zod validation, an explicit-request-only delete guard, per-write change events, and a structured change list in the modal (Phase 3 Requirements 2 and 4).

**Architecture:** The M1 tool registry grows from 2 read tools to 14 by restructuring `api/_lib/tools.ts` into an `api/_lib/tools/` module. Write executors are thin functions over the caller-scoped supabase client, writing exactly the row shapes `supabaseService` writes (M4 parity). Each successful write yields `change` events through a new `toChanges` hook on the tool interface; the loop streams them and the modal collects them into a change list grouped by entity. The delete guard is layered: system-prompt directive, per-tool description, and no `delete_trip` tool existing at all.

**Tech Stack:** zod v4 (`z.toJSONSchema`), @supabase/supabase-js v2, date-fns v4, the M1 loop/handler, React 19, Vitest 4.

### Constraints

- Builds on M1 (and Phase 2 M4). Row shapes stay identical to what `supabaseService` writes.
- Tool input field names are snake_case, matching the trip JSON the model reads (`stop_id`, `activity_id`, `date_from`).
- Update tools are partial: only fields present in the input change; zod enforces at least one editable field. This deliberately refines M4's full-replace modal semantics — the model supplies deltas, and unsupplied fields must never be nulled.
- Delete tools take only the item id; their descriptions and the system prompt restrict them to explicit user requests (Req 2.3). No tool named `delete_trip` exists (Req 2.4); Task 4 adds a structural test for this.
- New row ids are server-minted `crypto.randomUUID()`; the model never supplies ids for creation.

### Implementation Plan

#### Task 1: Registry restructure + change-event plumbing

Split `api/_lib/tools.ts` into `api/_lib/tools/{core,read,index}.ts`. `AgentTool` gained an optional `toChanges` hook and `ToolExecution` a `changes` array; `dispatchTool` stamps them as `AgentChangeEvent`s on success only, and the loop emits them after each execution. `progressLabel(toolName, input)` replaced the static label map, and the handler moved from `READ_TOOLS` to the full `AGENT_TOOLS`.

#### Task 2: Activity + waypoint write tools (shared item factory)

The `buildItemTools` factory in `api/_lib/tools/items.ts` produces create/update/delete triples for activities (with a `type` enum) and waypoints. Creates append with a counted `sort_order` and `is_done: false`; updates are partial (zod refine requires at least one field) and look up the current name first; deletes read the name, then delete. `thumbnail_url`/`google_place_id` are omitted from agent inputs (no server-side place search). The queue-based `createFakeClient` helper backs all write-tool tests.

#### Task 3: Accommodation upsert + trip metadata tools

`api/_lib/tools/tripFields.ts`: `upsert_accommodation` (deterministic id `${stopId}_accommodation`, reports `created` vs `updated`) and `update_trip_metadata` (partial patch, date-range validation, existence check). `destination` was added to the metadata tool — the column existed but the interactive modal never exposed it.

#### Task 4: Stop tools + restructure_stops with the date cascade

`api/_lib/tools/stops.ts`: `create_stop`, `update_stop` (partial; recomputes `duration_days` from merged stored dates and validates the merged range), `delete_stop` (DB cascade removes children), and `restructure_stops` (requires `ordered_stop_ids` to be a permutation of the trip's stops, runs `recalculateStopDates` server-side, batch-updates stops and trip span, emits changes only for stops that moved). A structural registry test pins the 14-tool surface and asserts no `delete_trip`.

#### Task 5: System prompt v2 - write rules and delete guard

Replaced the read-only `CORE_RULES` with write-aware rules: read before writing; creates and updates run immediately with no undo; updates change only provided fields; delete only on explicit request and never as a side effect; trips cannot be deleted; new stops need real coordinates; restructure after stop changes; report changes and failures honestly.

#### Task 6: Modal structured change list

`AgentModal` collects `changes: AgentChangeEvent[]` during a run and renders a "Changes" section grouped in fixed order (trip → stop → accommodation → activity → waypoint) with Added/Updated/Deleted labels. Pure Q&A runs show no change section; "Ask another" clears the list.

#### Task 7: M2 verification gate

Verified on a Vercel preview with a real model: scripted edits (create, batch mark-done, accommodation upsert, stop reorder with date cascade, metadata rename), the delete guard (explicit delete works, vague "clean up" deletes nothing, "delete the whole trip" refused), honest partial failure, and buffered `changes` matching the UI.

### Design Decisions

- Named deviations from the M4 interactive path, all deliberate: partial updates instead of full-replace; `done` folded into the update tools (interactive uses `setActivityDone`); `destination` added to `update_trip_metadata`; `thumbnail_url`/`google_place_id` omitted from agent inputs (no server-side place search). Row mechanisms are identical.
- `restructure_stops` runs the M4 date cascade server-side, so the model never computes dates; the permutation check makes silent stop loss impossible.
- Change events are built only after a successful DB call, from executor output — the change list can never claim an unexecuted write. Non-success `dispatchTool` paths always return `changes: []`.
- Delete and update executors read the row first, so "not found" surfaces as a named tool error and delete change events carry the real item name.

### Critical Files — Summary

| Path | Role |
|------|------|
| `api/_lib/tools/core.ts` | `AgentTool` interface (with `toChanges`), `dispatchTool`, `toAnthropicTools` |
| `api/_lib/tools/read.ts` | `list_trips`, `get_trip` read tools (from M1) |
| `api/_lib/tools/items.ts` | Activity + waypoint CRUD tools via shared `buildItemTools` factory |
| `api/_lib/tools/tripFields.ts` | `upsert_accommodation`, `update_trip_metadata` tools |
| `api/_lib/tools/stops.ts` | `create_stop`, `update_stop`, `delete_stop`, `restructure_stops` tools |
| `api/_lib/tools/index.ts` | `AGENT_TOOLS` — full 14-tool registry |
| `api/_lib/loop.ts` | `progressLabel` template extraction; change-event emission in the loop |
| `api/_lib/systemPrompt.ts` | Write-rules and delete-guard directives |
| `api/_lib/__tests__/fakeSupabaseClient.ts` | Queue-based fake for all write-tool tests |
| `src/components/Agent/AgentModal.tsx` | Structured change list grouped by entity |

---

## M3: Generative creation

**Goal:** The agent can create a complete trip from a description ("plan a 5-day Tokyo trip in March"): a `geocode` tool with a server-side key, a `create_trip` bundle tool running the import pipeline (validate → fresh ids → FK-order insert → compensation delete), result navigation in the modal, and the contract verified end-to-end for Hermes (Phase 3 Requirements 5 and 7).

**Architecture:** Two tools join the M2 registry. `geocode` calls the Google Geocoding REST API with `GOOGLE_GEOCODING_API_KEY` (server key; the browser Maps key is referrer-restricted and unusable here) and returns coordinates or a structured miss the model can retry. `create_trip` accepts the full nested itinerary in the same JSON shape the model reads from `get_trip`, validates it with the same `wanderlogTripSchema` gate as file import, and inserts through a shared `insertTripBundle` function extracted from `supabaseService.importTrip` — one pipeline, two callers. The handler captures the trip-created change event into `result.tripId`; the modal turns that into an "Open trip" button. Buffered JSON mode, 400-before-model validation, and NDJSON streaming shipped in M1 — this milestone verifies them as the stable Hermes contract.

**Tech Stack:** Google Geocoding REST API, zod v4 (`z.toJSONSchema`), existing schemas in `src/schemas/tripFileSchemas.ts`, `withFreshIds` (`src/services/tripImportService.ts`), `buildRows` (`src/services/supabaseMappers.ts`), Vitest 4.

### Constraints

- Builds on M2: `api/_lib/tools/` registry with `AGENT_TOOLS`, `toChanges` plumbing, `progressLabel`, write-rules system prompt.
- `GOOGLE_GEOCODING_API_KEY` is server-side only (no `VITE_` prefix, never in the client bundle); it is a separate key from the browser Maps key, restricted to the Geocoding API.
- `create_trip` is all-or-nothing via compensation delete (Req 5.4); every other write stays incremental. Trip, stop, and item ids are minted by `withFreshIds` — model-supplied ids are discarded.
- `MAX_TOKENS_PER_CALL` rises 4096 → 8192: a full trip bundle in one `tool_use` block is the largest payload the loop ever requests. `MAX_ITERATIONS = 16` stays; `maxDuration: 300` already covers the wall clock.
- `api/` imports from `src/` stay pure-module-only: `tripFileSchemas`, `tripImportService.withFreshIds`, `tripBundleInsert` (client passed in, no singleton).

### Implementation Plan

#### Task 1: Geocoding env + `geocode` tool

`GOOGLE_GEOCODING_API_KEY` became a required `AgentEnv` field. `buildGeocodeTool(apiKey)` in `api/_lib/tools/geocode.ts` returns `{ found: true, lat, lng, formatted_address }`, `{ found: false }` on `ZERO_RESULTS` (not an error, so the model retries coarser), and throws on service failures (`REQUEST_DENIED`, non-200). The registry became the builder `buildAgentTools(geocodingApiKey)` because geocode needs the key at construction; `progressLabel` gained address-carrying templates.

#### Task 2: Shared trip-bundle insert (extraction from `importTrip`)

Extracted the FK-order insert from `supabaseService.importTrip` into the pure, client-injected `insertTripBundle(client, tripData, overrides?)` in `src/services/tripBundleInsert.ts`: trips → stops → accommodations → activities → scenic_waypoints, skipping empty tables, and compensation-deleting the trip row (cascade) on any child failure. `importTrip` became a one-liner and its existing tests passed unchanged as the safety net; `overrides` lets agent-created trips carry `destination`.

#### Task 3: `create_trip` tool

`CREATE_TRIP_TOOL` in `api/_lib/tools/createTrip.ts`: the input schema mirrors the nested trip JSON the model reads (reusing leaf schemas from `tripFileSchemas.ts`), with stop `location` required so coordinates are never guessed. The executor runs the canonical `wanderlogTripSchema` gate, then `withFreshIds` → `insertTripBundle`, returns a summary listing `activities_without_coordinates`, and reports a single `created: trip` change. The registry test now pins 16 tools (14 + geocode + create_trip), still no `delete_trip`.

#### Task 4: Loop token cap + truncation handling + `result.tripId`

`MAX_TOKENS_PER_CALL` rose 4096 → 8192 for creation-sized payloads. A `max_tokens` stop reason now emits an error and halts the loop, since a truncated response may carry a mangled `tool_use` block. The handler's `runToEvents` tracks trip-created change events and injects the id as `result.tripId`, driving both stream and buffered modes.

#### Task 5: System prompt creation rules

Appended creation rules to `CORE_RULES`: geocode every stop (never guess coordinates, retry coarser on a miss), call `create_trip` exactly once with the full itinerary, derive an IANA timezone from the destination, build stop dates as a contiguous chain, and geocode activities where practical (pin-less is fine but listed in the summary). This superseded M2's stop-coordinates bullet.

#### Task 6: Modal "Open trip" navigation

The modal result view shows "Open trip" when `result.tripId` is set, navigating to `/trips/${result.tripId}` and closing the modal. The `['trips']` invalidation on run completion already lists the new trip without it.

#### Task 7: Contract finalization + M3 verification gate

Configured `GOOGLE_GEOCODING_API_KEY` on Vercel and provisioned the dedicated Hermes account in Supabase Auth. Cross-checked the design doc's API contract against the implementation (request body, four event shapes, buffered shape, status codes, `result.tripId`). Verified end-to-end with a Hermes-style buffered curl session (Tokyo prompt: `created: trip`, `tripId` set, no errors; 400 pre-model on empty body), an in-app run rendering a complete trip, and an Atlantis negative test leaving no half-created trip.

#### Task 8: Field descriptions on the item tools (added 2026-07-26, from the Phase 4 M3 gate)

The Phase 4 M3 gate ([plan_phase-4.md](../phase-4/plan_phase-4.md)) caught the model writing "we spent 90 minutes" into the planned `duration` and reading it back as an actual duration. The root cause is this milestone's contract: `z.toJSONSchema` carries `.describe()` into `input_schema` and `duration`/`remarks` had none, so `CREATE_FIELDS` (inherited by `UPDATE_FIELDS`) in `api/_lib/tools/items.ts` now describes both, and `CORE_RULES` gained the planned-versus-actual rule including the read-back direction. A new `items.test.ts` block asserts against `toAnthropicTools` output, closing a hole where that conversion was only ever tested on `READ_TOOLS`.

### Design Decisions

- One insert pipeline: `insertTripBundle` is extracted, not duplicated — file import and `create_trip` cannot drift apart on FK order or compensation semantics. Existing `importTrip` tests guard the refactor.
- The agent-facing `create_trip` schema avoids the file-import `z.preprocess` accommodation wrapper (transforms have no reliable JSON Schema form); the canonical `wanderlogTripSchema` still validates every bundle at execution, so the two shapes cannot diverge on what gets inserted.
- `MAX_TOKENS_PER_CALL = 8192` is sized for a one-block trip bundle; a `max_tokens` stop is surfaced as an explicit error instead of executing a possibly truncated `tool_use` block.
- `result.tripId` derives from the trip-created change event in one place (the handler's `emitTracked`), so stream and buffered renderings cannot disagree.
- `geocode` returns `found: false` (not an error) on `ZERO_RESULTS` so the model can retry with a coarser query — matching the client-side `geocodingService` pattern.
- A field's purpose is only knowable to the model if the schema states it: `z.toJSONSchema` carries `.describe()` into `input_schema`, so write-tool fields with a plausible-but-wrong reading (`duration` vs `visit_duration_minutes`, `remarks`) need descriptions, and tests assert on the schema the model receives (`toAnthropicTools` output), not the zod schema.

### Critical Files — Summary

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

---

## M4: Design quality

Implements the five recommended actions from the [Trip page critique](../../../.impeccable/critique/20260710_src-pages-trippage-tsx.md) (score 26/40, 0 P0, 3 P1, 2 P2). Each action maps to an `/impeccable` command and addresses specific heuristic gaps. Builds on shipped M3 (generative creation).

### Scope

| # | Action | Priority | Files | What changes |
|---|--------|----------|-------|-------------|
| 1 | `quieter` — self-consistency | P2 | AccommodationCard, ScenicWaypointCard, MapLayerPicker, AgentModal, ActivitiesPanel, DoneCheckbox | Drop `border-l-4` stripe; drop gradient card; sentence-case tracked-caps labels; standardize add buttons on teal-tint; make done checkbox emerald everywhere |
| 2 | `audit` — reduced-motion + a11y | P1 | MapContainer, index.css | Strip infinite `pulse`+glow from marker SVGs; add global `@media (prefers-reduced-motion: reduce)` block covering `scale`, `hover`, transitions; gate `Animation.DROP` on motion preference |
| 3 | `colorize` — timeline contrast | P1 | TimelineStrip | Darken rainbow fills from `-500` to `-700` (selected to `-800`); verify all 12 entries pass WCAG AA (4.5:1) with white text |
| 4 | `clarify` — undo + error copy | P2 | TripPage, ErrorMessage | Add "Undo" action to reorder toast (Toast already supports `action`); rewrite ErrorMessage suggestions in companion voice on the Supabase model |
| 5 | `polish` — final sweep | Minor | index.css, MapContainer, ActivitiesPanel, AgentModal | Remove Inter weight 300; remove production console.log/warn/error; align route-error yellow→amber |

### Implementation Plan

#### Action 1 — `quieter` (self-consistency)

Done. Aligned the cards and controls with each other: `AccommodationCard` lost its `border-l-4` stripe for a plain gray border (matching the activity card), `ScenicWaypointCard` lost its default gradient for flat white, tracked-caps section labels in `MapLayerPicker` and `AgentModal` became sentence-case, the add-accommodation/waypoint/activity buttons in `ActivitiesPanel` share one teal-tint secondary treatment (`alpine-teal` tokens), and `DoneCheckbox` is emerald everywhere (waypoints no longer violet).

#### Action 2 — `audit` (reduced-motion + pin tone-down)

Done. Removed the infinite `pulse` animation and glow filter from all marker SVGs (accommodation, activity, scenic waypoint, search-result), keeping the drop shadow on accommodation pins. `Animation.DROP` is now gated on `prefers-reduced-motion`, and the global reduced-motion block in `index.css` also suppresses `hover:scale-*`, `active:scale-*`, and transition durations.

#### Action 3 — `colorize` (timeline contrast)

Done. The `TimelineStrip` palette darkened from `-500` base / `-600` selected to `-700` / `-800` so all 12 entries clear 4.5:1 against white text; ring colors stay at `-500` since they are borders, not text backgrounds.

#### Action 4 — `clarify` (undo + error copy)

Done. `TripPage`'s `handleActivityReorder` captures the pre-reorder order and the reorder toast carries an "Undo" action that re-submits it. `ErrorMessage` suggestions were rewritten in the companion voice — no "trip data file", "browser cache", or "console" — for the `data`, `general`, `network`, and `permission` categories (copy lives in `ErrorMessage.tsx`).

#### Action 5 — `polish` (final sweep)

Done. Dropped Inter weight 300 (the type system uses 400/500/600/700), removed the production `console.warn`/`console.error` calls from `ActivitiesPanel` (`handleExport`) and `MapContainer` (route truncation, directions fallback, route fetch), and moved the route-error banner from yellow to amber to match the design system's warning color.

### Verification

The gate in the Milestones table is not yet recorded as met — see [Outstanding follow-ups](#outstanding-follow-ups).

---

## Data layer deepening (post-M3)

### Context

The client↔Supabase **write** path was duplicated across two runtimes with no shared interface:

- **Client**: `src/services/supabaseService.ts` — the only browser `supabase-js` caller; ~17 CRUD fns.
- **Agent**: `api/_lib/tools/{items,stops,tripFields}.ts` — re-implemented the same table writes server-side.

Two adapters writing the same tables caused per-entity **column knowledge and date math to live in 3–4 places and drift**:

- Client emitted `thumbnail_url` + `google_place_id` on activities/waypoints (and `google_place_id` on accommodation); the agent omitted them.
- Agent handled `destination` on trip-metadata update; the client's `TripMetadataPatch` did not.
- **Three different night-count implementations**: `nightsBetween` (client, UTC ms-round), `dayCount` (agent, local calendar-days), and the calc inside `recalculateStopDates` (local `parseISO`). They disagreed at DST/timezone edges → UI stop edits and agent stop edits wrote **different `duration_days`**. Latent bug.
- Client `updateStop` never recomputed `duration_days` on a date edit; the agent's `update_stop` did. Client value went stale.

The read path and full-trip create (`insertTripBundle`→`buildRows`) were **already shared** — not in scope.

**Goal.** Collapse the drift-prone core into deep, pure, shared modules. Two sequenced moves:

- **Move 1** — one pure module owning per-entity column mapping + date math; both adapters consume it. Delivered the drift/date-bug fix; landable alone.
- **Move 2** — parameterize the Supabase client so the CRUD *execution* is shared too; the browser service and the agent tools become two thin adapters over one client-injected module.

**Proven precedent.** `src/services/tripBundleInsert.ts` was already a pure, client-injected module imported by both sides. Import rule: **runtime/value imports → relative path with explicit `.js`; `import type` → `@/` alias (esbuild erases it)**. No build-config change needed.

**Hard constraints.**
- Preserve browser-facing signatures (`setActivityDone('act-1', true)`, etc.) — hook tests and hook call sites depend on them.
- Preserve **both** update semantics: client = dense (`?? null` overwrites unspecified columns); agent = sparse (only provided columns). The shared mapper carries the column definitions once and each caller applies its own dense/sparse policy.
- Local `vitest` under jsdom will **not** catch a missing `.js` extension. Only `vercel build` / a preview deploy exercises real Node-ESM resolution.

### Move 1 — pure shared mapping module

Created **`src/services/entityRows.ts`** (pure: no `supabase-js`, no `@/config` value import).

#### What it owns

1. **`nightsBetween(fromISO, toISO): number`** — single canonical implementation using `differenceInCalendarDays(parseISO(to), parseISO(from))` (calendar-days, DST-safe, matches `recalculateStopDates`). Retired the client's UTC ms-round version and the agent's `dayCount`. Pointed `stopDateUtils.ts` at it too so all three collapsed to one.

2. **Per-entity column definitions** — one `{ inputKey → dbColumn, nullable }` table per entity: activity, waypoint, accommodation, stop, trip-metadata. Covers the full column superset (incl. `thumbnail_url`, `google_place_id`, `destination`).

3. **Two appliers over the defs:**
   - `denseRow(defs, input)` → every column, `value ?? null` (client full-form semantics).
   - `patchRow(defs, input)` → only columns whose input key is present (agent sparse semantics).

4. **Insert conventions** as shared consts: ``accommodationId(stopId) = `${stopId}_accommodation` ``, `CREATE_DEFAULTS = { is_done: false }`. `sort_order` derivation stays caller-side (genuinely different, not forced).

#### Non-goals in Move 1

- Column-gap **closures** (adding `thumbnail_url`/`google_place_id` to agent input; `destination` to client) — behavior changes, flagged as optional follow-ups.
- Fixing client `updateStop` to recompute `duration_days` — trivial after consolidation, but a behavior change; flagged, not bundled.
- `useTripMutations`' `activityInputToDomain`/etc. — input→**domain** (optimistic cache patch), a different projection, browser-only. Untouched.

### Move 2 — parameterize the client

Extracted the CRUD **execution** into a client-injected `src/services/tripWrites.ts` — mirroring how `importTrip` already wraps `insertTripBundle`. `supabaseService.ts` became the **thin browser adapter**: each fn keeps its current signature and delegates (e.g. `export const setActivityDone = (id, isDone) => setActivityDoneImpl(getSupabase(), id, isDone)`). Agent tool `execute` bodies call the shared `tripWrites` fn, passing the request-scoped `client`. Browser call sites, `*Input` type exports, and hook tests unchanged.

Deep-module framing: `tripWrites` is the deep, client-injected implementation; `supabaseService` and the agent tools are two adapters at the **client seam**.

### Sequencing

Landed **Move 1** first and independently — it removed the column/date drift and the DST `duration_days` bug with no signature or client-wiring changes. **Move 2** built on Move 1's mappers to also share execution. Optional follow-ups (agent column-gap closures, client `updateStop` duration recompute) are separate, behavior-changing PRs.

### Critical Files — Summary

| Path | Role |
|------|------|
| `src/services/entityRows.ts` | Pure column defs, `denseRow`/`patchRow` appliers, canonical `nightsBetween` |
| `src/services/tripWrites.ts` | Client-injected CRUD execution (the deep module) |
| `src/services/supabaseService.ts` | Thin browser adapter binding `getSupabase()` |
| `api/_lib/tools/{items,stops,tripFields}.ts` | Agent tool `execute` bodies delegating to `tripWrites` |
| `src/utils/stopDateUtils.ts` | Points at `nightsBetween` from `entityRows` |

---

## Outstanding follow-ups

- **M4 gate not recorded.** All five actions are implemented. Re-run the Trip page critique (target ≥ 32/40, all P1s resolved) and confirm `pnpm test:run`, `pnpm build`, and `pnpm lint` are clean, then mark M4 Shipped in the [Milestones](#milestones) table.
- **Data layer (optional, behavior-changing, separate PRs):** still open as of the consolidation — agent item inputs omit `thumbnail_url`/`google_place_id`, the client `TripMetadataPatch` omits `destination`, and the shared `updateStop` is a plain `patchRow` with no `duration_days` recompute. See [Non-goals in Move 1](#non-goals-in-move-1).

## Changelog

- 2026-10-17 — **Compacted post-implementation.** Removed step-by-step task bodies, the M4 file-by-file checklist, quoted field descriptions, error-copy lists, and verification command lists now that M1-M3 have shipped; dropped the stale `api/_lib/tools.ts` row and execution-time caveats. Preserved Goal, Architecture, Global Constraints, Design Decisions, Critical Files summaries, the data-layer analysis, and follow-ups. Original plan recoverable via git history.
- 2026-10-17 — **Consolidated the per-milestone plans into this file.** `plan_p3m1_agent-backend-qa.md`, `plan_p3m2_bounded-edits.md`, `plan_p3m3_generative-creation.md`, `plan_p3m4_design-quality.md`, and `plan_deepen-supabase-data-layer.md` are now the M1-M4 and data-layer sections above; phase-wide constraints repeated across M1-M3 were deduplicated into Global Constraints. Originals recoverable via git history.
- 2026-07-10 — The M1, M2, and M3 plans (then separate files) were compacted post-implementation: step-by-step tasks, file-by-file diffs, code snippets, test code, and verification command lists removed. The data-layer plan was compacted the same day (Verification section and Files-touched lists removed).
- 2026-07-04 — M3 shipped - `geocode` + `create_trip` tools over the shared `insertTripBundle` pipeline, creation-sized token cap with truncation error, `result.tripId` + "Open trip" navigation, Hermes contract finalized. Verified on production: buffered Hermes curl session (password grant with the provisioned `hermes@wanderlog.local` account) created a complete 5-day Tokyo trip (tripId set, change event emitted, all stops geocoded); Atlantis negative test produced no trip and no errors; 400/401/405 pre-model status codes confirmed; in-app run rendered the trip with map pins, timeline, and activities. Phase 3 complete.
- 2026-07-04 — M2 shipped - twelve agent write tools (activities, waypoints, accommodation, trip metadata, stops incl. `restructure_stops` date cascade) with zod validation, delete guard, per-write change events, and the modal change list; verified on preview and production (scripted edits, delete-guard, honest partial failure).
- 2026-07-04 — **UI: corner-pinned agent button on TripPage.** The `AgentButton` (shipped in M1) dropped its panel-dodge shift (`sm:right-[28rem]`) and stays corner-pinned left of the `UserMenu` (`fixed top-2 right-14 sm:top-4`). The activities panel drops to `sm:top-16` to clear the control row. Files: `src/pages/TripPage.tsx`, `src/components/Activities/ActivitiesPanel.tsx`. Companion UserMenu/panel change logged in the M3 entry of the [plan_phase-2.md changelog](../phase-2/plan_phase-2.md#changelog).
- 2026-07-04 — M1 shipped - `/api/agent` (read-only tool loop, NDJSON stream + buffered mode) with agent modal on library and trip pages; verified on preview and production via curl and browser.
- 2026-07-04 — Created with M1 plan; M2-M3 plans to follow just-in-time.
- 2026-07-04 — M2 plan written (registry restructure + change-event plumbing, activity/waypoint/accommodation/metadata/stop write tools with zod validation and delete guard, `restructure_stops` date cascade, modal change list). M3 plan written ahead of execution (server-side `geocode` tool, shared `insertTripBundle` extraction, `create_trip` over the import pipeline, creation-sized token cap + `result.tripId`, "Open trip" navigation, Hermes contract finalization). Symbol names in both follow the M1 and Phase 2 M4 plans; verify against shipped code at execution time.
