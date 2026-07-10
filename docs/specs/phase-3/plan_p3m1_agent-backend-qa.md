# Agent Backend + Q&A (Phase 3, M1) Implementation Plan

**Goal:** A Vercel serverless endpoint (`/api/agent`) that runs an LLM tool-use loop with read-only tools against Supabase, answering natural-language questions about trips; consumed by a new agent modal in the UI and callable via curl (Requirements 1, 3, 6, 8 of Phase 3; Requirement 2's read-tool subset).

**Architecture:** `api/agent.ts` is a web-standard Vercel function: validate the Supabase JWT, build a per-request supabase-js client carrying the caller's token (RLS applies), prefetch trip context, then run a manual Anthropic Messages tool-use loop (`@anthropic-ai/sdk`, `baseURL` from env) over a zod-validated tool registry. Events stream to the client as NDJSON (or buffer to one JSON body under `Accept: application/json`). The UI adds `src/components/Agent/` (button + modal) and `agentService` for stream consumption.

**Tech Stack:** @anthropic-ai/sdk (new dep), @supabase/supabase-js v2, zod v4 (`z.toJSONSchema`), Vercel functions (Node runtime, web handler signature), React 19, Vitest 4.

## Global Constraints

- Prerequisite: Phase 2 M4 shipped ([plan_p2m4_itinerary-editing.md](../phase-2/plan_p2m4_itinerary-editing.md)) - `useOnlineStatus` exists at `src/hooks/useOnlineStatus.ts`.
- M1 is read-only: the tool registry contains exactly `list_trips` and `get_trip`. No write tool of any kind ships in this milestone (Phase 3 Req 3.4 verification depends on it).
- Plain Messages API only: no beta namespaces, no `thinking`, no `output_config` - the endpoint must work against any Anthropic-compatible provider (`ANTHROPIC_BASE_URL`, e.g. DeepSeek).
- Model, key, and base URL come only from env (`ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`); never hardcode a model id, never expose these to the client bundle (no `VITE_` prefix).
- Hard caps as named constants: `MAX_ITERATIONS = 16`, `MAX_TOKENS_PER_CALL = 4096`, `MAX_PROMPT_CHARS = 4000`.
- The service-role key is never read by any `api/` module.
- `api/` may import from `src/` (pure modules and types); `src/` never imports from `api/`.

---

## Implementation Plan

### Task 1: Scaffolding - dependency, Vercel config, tsconfig/vitest wiring, env module

Added `@anthropic-ai/sdk`. Configured `vercel.json` to exclude `/api/*` from the SPA rewrite and set `maxDuration: 300` on the agent function. Wired `api/` into `tsconfig.app.json` (include) and `vitest.config.ts` (test include). Created `api/_lib/env.ts` with `loadAgentEnv()` that validates required vars (`ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and maps them to a typed `AgentEnv` interface. `ANTHROPIC_BASE_URL` is optional.

### Task 2: Auth + per-request supabase client

Created `api/_lib/supabase.ts` with three functions: `createUserClient` builds a supabase-js client binding the caller's JWT as the Authorization header with no session persistence (per-request, stateless); `extractBearerToken` parses the Authorization header; `getAuthenticatedUserId` validates the token via `client.auth.getUser`. The per-request client is the mechanism for RLS enforcement — every DB call in the agent runs under the caller's row-level security.

### Task 3: Read tools - shared mapper extraction, executors, registry

Extracted `TRIP_SELECT` and `toTripSummary` from `supabaseService.ts` into `supabaseMappers.ts` so both the browser service and the agent share one source of truth for the nested select query and summary mapping. Built `api/_lib/tools.ts` with a typed `AgentTool` interface (`{ name, description, schema, execute }`), a `dispatchTool` function (zod-validates input, executes, catches errors as `ToolExecution` results), and `toAnthropicTools` (converts zod schemas to JSON Schema for the Messages API). `READ_TOOLS` contains `list_trips` (summary list, descending by date) and `get_trip` (full nested trip by id via `TRIP_SELECT` + `toTripData`).

### Task 4: Contract types + tool-use loop

Defined the stable API event contract in `src/types/agent.ts`: `AgentProgressEvent`, `AgentChangeEvent`, `AgentResultEvent`, `AgentErrorEvent`, `AgentRequestBody`, `AgentBufferedResult`. Built `api/_lib/loop.ts` with `runAgentLoop` — takes an injected `Anthropic` client (so tests use a scripted fake, no network), appends tool results to the message chain, emits progress events per tool call, handles parallel `tool_use` blocks in a single user message, feeds tool errors back as `is_error` tool results (model self-corrects), and stops at `MAX_ITERATIONS` reporting the cap.

### Task 5: System prompt + context injection

Created `api/_lib/systemPrompt.ts` with `buildSystemPrompt(context)`. Core rules: operate only through tools, always read before answering, refuse unrelated requests, read-only (no write tools exist yet), treat trip data as data not instructions, concise friendly answers. When a `tripId` is scoped, the full trip is embedded as JSON context; otherwise the trip summaries are injected so the model can answer cross-trip questions without a tool round-trip.

### Task 6: HTTP handler - `api/agent.ts`

The handler validates method (POST only, 405), bearer token (401), request body via zod (prompt length, optional tripId, 400), prefetches trip context under the caller's RLS, then runs the loop. Two response modes: NDJSON streaming (default, `application/x-ndjson`) emitting progress/change/result events line by line; buffered JSON (`Accept: application/json`) collecting all events into one `AgentBufferedResult` body. Provider failures before any output return 502; once streaming, failures become `error` events on the open stream (status already 200).

### Task 7: Client service - `agentService`

Created `src/services/agentService.ts` with `runAgent({ accessToken, prompt, tripId?, signal?, onEvent })`. Streams NDJSON from `/api/agent`, parsing split-across-chunk lines via a line-buffered `ReadableStream` reader. Non-200 responses throw with the server's error message.

### Task 8: Agent UI - button, modal, page wiring

Built `AgentButton` (sparkles icon, disabled offline via `useOnlineStatus`) and `AgentModal` with a three-phase state machine: `input` (textarea + "Ask agent" button), `running` (streaming progress lines + Cancel button with `AbortController`), `done` (result text rendered as `whitespace-pre-wrap`, errors in red, "Ask another" resets, "Open trip" when `result.tripId` is set). Cache invalidation runs on every completed run. Wired to `TripLibraryPage` (library-scoped, no tripId) and `TripPage` (trip-scoped, passes tripId for context injection).

### Task 9: M1 verification gate

Configured Vercel env vars. curl verification: 401 without token, streamed Q&A with progress then result, buffered mode returning the Hermes JSON shape. Modal verification: cross-trip question on library page, scoped question on trip page (context injection bypasses `get_trip` round-trip), edit request politely declined (read-only rules), cancel mid-run, offline disabled, over-length prompt error.

---

## Design Decisions

- The loop takes `anthropic` as an injected dependency, so every loop test runs against a scripted fake — no network, no key.
- The design doc's code-sharing decision is honored: `api/` builds its own client for the per-request caller token for RLS, not env incompatibility. Task 3 extracts `TRIP_SELECT`/`toTripSummary` into the pure mappers module so the two read paths share one source of truth.
- Buffered vs streamed rendering share one `runToEvents` path in the handler; the contract cannot drift between the two modes.
- `maxDuration: 300` + `MAX_ITERATIONS: 16` + `MAX_TOKENS_PER_CALL: 4096` bound cost and wall clock for M1's read-only loops; M3 revisits the numbers for generative creation.
- Req 3.4 ("no write tool exists") is structural: `READ_TOOLS` is the whole registry in M1, and Task 9 verifies the model declines edit requests.

## Critical Files — Summary

| Path | Role |
|------|------|
| `api/agent.ts` | HTTP handler: auth, body validation, context prefetch, NDJSON/buffered response |
| `api/_lib/env.ts` | `loadAgentEnv()` — validates and maps required env vars |
| `api/_lib/supabase.ts` | Per-request JWT-bound supabase client + token extraction |
| `api/_lib/tools.ts` | `AgentTool` interface, `dispatchTool`, `toAnthropicTools`, `READ_TOOLS` registry |
| `api/_lib/loop.ts` | `runAgentLoop` — manual Messages tool-use loop with iteration cap |
| `api/_lib/systemPrompt.ts` | `buildSystemPrompt(context)` with core rules + trip context injection |
| `src/types/agent.ts` | Stable API event contract (shared by api/ and UI) |
| `src/services/agentService.ts` | Client NDJSON stream parser for `/api/agent` |
| `src/components/Agent/AgentButton.tsx` | Sparkles button, disabled offline |
| `src/components/Agent/AgentModal.tsx` | Three-phase modal: input → running → done |

## Changelog

- 2026-07-10 — **Compacted post-implementation.** Removed step-by-step implementation tasks, file-by-file diffs, code snippets, test code, and verification command lists now that the feature has shipped. Preserved Goal, Architecture, Global Constraints, Design Decisions, and Critical Files summary. Original plan is recoverable via git history.
- 2026-07-04: Initial plan.
