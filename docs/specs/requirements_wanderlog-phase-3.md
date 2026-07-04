# Wanderlog Phase 3 - Requirements Document

## Introduction

Phase 3 adds an agent mode: family members (and their personal agents) drive trip creation, questions, and itinerary edits through natural-language prompts. A backend endpoint runs an LLM tool-use loop against the same Supabase data the interactive UI edits, then reports what it did in plain language.

This is the first server-side code in the project. Phase 2's scope decision "Server-side code: None" is superseded by this document: an LLM API key cannot live in the client bundle, so the agent runs behind a serverless endpoint. Everything shipped in Phase 2 (Supabase backend, auth gate, trip library, import, itinerary editing) carries over unchanged.

**Prerequisite:** Phase 2 M4 (itinerary editing) shipped. The agent's write tools mirror the M4 write path; building them against an unfinished write path would mean speccing the same operations twice.

## Scope Decisions

Settled during brainstorming and sized everything below. Changing any of them reopens the spec.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Capabilities | All three in v1: Q&A over trip data, bounded itinerary edits, generative trip creation | The owner wants the full loop; milestones stage the risk (read-only ships first). |
| Execution model | Server-side tool-use loop (Anthropic Messages API) within a single HTTP request | The model must read current data (resolve "the museum" to an id) and react to failures (retry a geocode). A one-shot "return a JSON plan" call can do neither. |
| Backend host | Vercel serverless function in the same repo (`api/`) | Same deploy pipeline, Node + TypeScript imports the existing zod schemas and domain types. Supabase Edge Functions (Deno) cannot import `src/` modules and need a second deploy step. |
| Model provider | Any Anthropic-compatible endpoint, configured by env vars (`ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`) | One SDK (`@anthropic-ai/sdk` with `baseURL` override) covers Anthropic, DeepSeek, and other compatible providers without code changes. |
| Tool surface | ~15 fine-grained tools mirroring the `supabaseService` write path, each zod-validated | Tool definitions are the machine-readable form of "synthesize the backend APIs into the system prompt". A coarse batch-edit tool would need its own operation mini-language speccing anyway. |
| Write guard | Creates/updates execute immediately; item deletes only on explicit user request; no trip deletion tool at all | Family scale needs low ceremony. A two-phase plan/approve flow adds temp-id plumbing for chained writes and was rejected. |
| Conversation | One-shot per prompt; no history stored anywhere | Cheapest v1. Follow-up turns and persistent chat are out of scope. |
| Auth | Supabase JWT required; all DB access through the caller's token so RLS applies | The agent can never do more than the signed-in family member. The service-role key stays out of the endpoint. |
| Programmatic access | The endpoint is a documented API; external agents authenticate as a family member | The owner's personal assistant (Hermes) calls the same endpoint with a JWT from Supabase Auth's password grant. |
| Safety | Tool whitelist + RLS + loop caps + input length cap; no moderation-model pre-flight | The endpoint is reachable only by authenticated family members. The whitelist bounds what any prompt can do. |

## Requirements

### 1. Agent Backend Endpoint

**User Story:** As the app owner, I want a single backend endpoint that turns a natural-language prompt into tool calls against our trip data, so that agent capabilities exist without exposing model API keys or raw database access to clients.

**Acceptance Criteria:**
1. WHEN a request arrives without a valid Supabase access token, THEN the endpoint SHALL reject it with 401 and SHALL make no model or database calls.
2. WHEN a request is authenticated, THEN the endpoint SHALL run a tool-use loop against the configured model until the model finishes or a cap is hit, executing whitelisted tools only.
3. WHEN the endpoint accesses the database, THEN it SHALL use a client authenticated with the caller's token, so row-level security applies to every operation; the service-role key SHALL NOT be used.
4. WHEN the model provider is configured, THEN `ANTHROPIC_BASE_URL`, `ANTHROPIC_MODEL`, and `ANTHROPIC_API_KEY` env vars SHALL select the endpoint, model, and key; none of these SHALL appear in the client bundle.
5. WHEN the loop runs, THEN it SHALL enforce hard caps: maximum iterations, maximum prompt length, and a request duration below the platform limit; hitting a cap SHALL surface as a reported error, not a hang.
6. WHEN the loop makes progress, THEN the endpoint SHALL stream progress events (one human-readable line per tool call) followed by a final result event, so clients can show live status.

### 2. Tool Surface and Write Safety

**User Story:** As the app owner, I want the model limited to a fixed, validated set of operations, so that no prompt - however malformed or malicious - can perform actions outside what the interactive UI already allows.

**Acceptance Criteria:**
1. WHEN tools are defined, THEN they SHALL mirror the existing read and write operations: read trip(s), create/update/delete activities and scenic waypoints, upsert accommodation, update trip metadata, create/update/delete stops, restructure stops with the date cascade, create a full trip, and geocode an address.
2. WHEN the model supplies tool input, THEN it SHALL be validated with zod before execution; invalid input SHALL be returned to the model as a tool error, not executed.
3. WHEN a prompt does not explicitly ask for removal of an item, THEN delete tools SHALL NOT be invoked for it (system-prompt directive).
4. WHEN any prompt is processed, THEN no tool for deleting a whole trip SHALL exist; trips are deleted only through the existing UI confirm flow.
5. WHEN the model requests anything outside the tool whitelist, THEN the request SHALL fail as an unknown tool; the endpoint SHALL NOT execute arbitrary SQL, PostgREST, or HTTP.

### 3. Question Answering

**User Story:** As a family member, I want to ask questions about our trips in plain language, so that I can find plan details without clicking through the UI.

**Acceptance Criteria:**
1. WHEN a prompt is a question (e.g. "what's our plan for Tuesday?", "which bookings lack confirmation numbers?"), THEN the agent SHALL answer from current Supabase data via read tools, and the answer SHALL be shown as text.
2. WHEN the prompt is scoped to an open trip, THEN that trip's data SHALL be provided to the model without requiring a read tool round-trip.
3. WHEN a question spans trips (asked from the library), THEN the agent SHALL be able to list trips and read any of them.
4. WHEN a prompt is answered without any write tool call, THEN no data SHALL be modified.

### 4. Bounded Itinerary Edits

**User Story:** As a family member, I want to make itinerary changes by describing them (e.g. "add a ramen dinner near the hotel on day 2", "mark all Queenstown activities done"), so that routine edits don't require form filling.

**Acceptance Criteria:**
1. WHEN an edit prompt names existing items, THEN the agent SHALL resolve them to real row ids by reading current data before writing.
2. WHEN the agent writes, THEN changes SHALL persist through the same operations the interactive editors use, subject to the same validation.
3. WHEN the run completes, THEN the user SHALL see a summary plus a structured list of every change (created / updated / deleted, with item names).
4. WHEN some writes succeed and others fail, THEN the result SHALL report both honestly (e.g. "added 2 of 3 activities; geocoding failed for X"); successful writes SHALL NOT be rolled back.
5. WHEN the run finishes, THEN the UI SHALL refresh affected trip data through the normal query invalidation path.

### 5. Generative Trip Creation

**User Story:** As a family member, I want to describe a trip (e.g. "plan a 5-day Tokyo trip in March") and get a complete draft itinerary as a new trip, so that planning starts from a scaffold instead of a blank library.

**Acceptance Criteria:**
1. WHEN a creation prompt runs, THEN the model SHALL invent the itinerary (stops, accommodations, activities) and create it as one new trip with fresh ids.
2. WHEN stops are created, THEN their coordinates SHALL come from the geocode tool; a stop that cannot be geocoded SHALL NOT be silently placed - the model must choose an alternative or report failure.
3. WHEN an activity cannot be geocoded, THEN it SHALL be created without coordinates (rendered without a map pin) and noted in the result, rather than blocking the trip.
4. WHEN the trip bundle is inserted, THEN it SHALL pass the same validation as file import, and a mid-insert failure SHALL trigger the same compensation delete - no half-created trips.
5. WHEN the trip is created, THEN the result SHALL offer navigation to it, and it SHALL appear in the library like any other trip.
6. WHEN no timezone is stated, THEN the trip timezone SHALL be derived from the destination.

### 6. Agent UI

**User Story:** As a family member, I want an agent button in the app that opens a prompt box and shows me what the agent did, so that agent mode is usable without any external tooling.

**Acceptance Criteria:**
1. WHEN viewing the trip library, THEN an agent button SHALL open the agent modal scoped to all trips (creation, cross-trip questions).
2. WHEN viewing a trip, THEN an agent button SHALL open the modal scoped to that trip (edits, questions about it).
3. WHEN a prompt is submitted, THEN the modal SHALL show streamed progress lines while the loop runs and SHALL allow cancelling the request.
4. WHEN the run completes, THEN the modal SHALL show the model's summary, the structured change list, and any errors in user-friendly wording; question answers render as text.
5. WHEN the app is offline, THEN the agent button SHALL be disabled.
6. WHEN the modal is closed or a new prompt submitted, THEN prior state SHALL be cleared (one-shot semantics).

### 7. Programmatic API Access

**User Story:** As the app owner, I want to call the agent endpoint from my personal assistant agent (Hermes) after authenticating as a family member, so that trips can be created and edited without opening the app.

**Acceptance Criteria:**
1. WHEN an external client authenticates via Supabase Auth (email/password grant) with a provisioned family-member account, THEN the resulting JWT SHALL grant the same agent access as the web UI; a dedicated account for the external agent SHALL be provisioned manually like any family member.
2. WHEN a client sends `Accept: application/json`, THEN the endpoint SHALL respond with a single buffered JSON result (summary, changes, errors, optional answer) instead of a stream.
3. WHEN the request/response contract is defined, THEN it SHALL be documented in the design doc as a stable integration contract: request body, every stream event type, the buffered shape, and error status codes.
4. WHEN invalid input is submitted (missing prompt, over-length prompt, unknown trip id), THEN the endpoint SHALL return 400 with a machine-readable error, before any model call.

### 8. Configuration and Key Protection

**User Story:** As the app owner, I want all agent-related keys held server-side and configured per environment, so that nothing sensitive ships to the browser.

**Acceptance Criteria:**
1. WHEN the model provider key, base URL, and model name are configured, THEN they SHALL live in Vercel env settings (and `.env.local` for local dev), never in the client bundle or repository.
2. WHEN the agent geocodes server-side, THEN it SHALL use a separate Google Geocoding API key restricted for server use; the browser Maps key (referrer-restricted) SHALL NOT be reused.
3. WHEN the SPA rewrite is configured, THEN `/api/*` paths SHALL be excluded so the function is reachable.

## Milestones

Each milestone is independently shippable and verifiable. Risk-ordered: the read-only slice proves the full pipe before any write tool exists.

1. **M1 - Agent backend + Q&A:** Endpoint with auth, env-based model config, tool-use loop, streaming, read tools only; agent button + modal (Requirements 1, 2 partial, 3, 6, 8). *Verification: questions about seeded trips answered correctly from both the modal and a curl call; unauthenticated requests rejected; no write possible.*
2. **M2 - Bounded edits:** Write tools with zod validation and delete guard; structured change list; cache invalidation (Requirements 2, 4). *Verification: scripted edit prompts round-trip against a preview; delete fires only on explicit request; partial failure reported honestly.*
3. **M3 - Generative creation + programmatic contract:** create-trip bundle tool, server-side geocoding, buffered JSON mode, documented contract for Hermes (Requirements 5, 7). *Verification: a creation prompt yields a complete rendered trip; Hermes-style curl session (password grant → buffered call) works end-to-end.*

## Out of Scope (Deferred)

- **Multi-turn conversation and persistent chat history.** One-shot prompts only; re-state context in each prompt.
- **Two-phase plan/approve for writes.** Immediate execution with delete guard is the accepted trade at family scale.
- **Trip deletion via agent.** UI confirm flow only.
- **Moderation-model pre-flight on prompts.** Auth + tool whitelist + RLS bound the blast radius; revisit if the endpoint is ever exposed beyond the family.
- **MCP server packaging.** Hermes integrates over plain HTTP; wrapping the endpoint as an MCP server can come later without changing the contract.
- **Per-user rate limiting and cost tracking.** Family scale; loop caps bound each request's cost.
- **Undo/rollback of agent edits.** Same as interactive edits: no undo exists anywhere in the app.
- **Token-by-token answer streaming.** Progress streams per tool call; the final answer arrives whole.

## Changelog

- 2026-07-04: Initial draft (brainstormed and approved). Supersedes Phase 2's "Server-side code: None" scope decision.
