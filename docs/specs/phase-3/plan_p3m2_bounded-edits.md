# Bounded Itinerary Edits (Phase 3, M2) Implementation Plan

**Goal:** Add the twelve write tools (activities, waypoints, accommodation, trip metadata, stops including restructure) to the agent endpoint, with zod validation, an explicit-request-only delete guard, per-write change events, and a structured change list in the modal (Phase 3 Requirements 2 and 4).

**Architecture:** The M1 tool registry grows from 2 read tools to 14 by restructuring `api/_lib/tools.ts` into an `api/_lib/tools/` module. Write executors are thin functions over the caller-scoped supabase client, writing exactly the row shapes `supabaseService` writes (M4 parity). Each successful write yields `change` events through a new `toChanges` hook on the tool interface; the loop streams them and the modal collects them into a change list grouped by entity. The delete guard is layered: system-prompt directive, per-tool description, and no `delete_trip` tool existing at all.

**Tech Stack:** zod v4 (`z.toJSONSchema`), @supabase/supabase-js v2, date-fns v4, the M1 loop/handler, React 19, Vitest 4.

## Global Constraints

- Prerequisites: Phase 2 M4 shipped ([plan_p2m4_itinerary-editing.md](../phase-2/plan_p2m4_itinerary-editing.md)) and Phase 3 M1 shipped ([plan_p3m1_agent-backend-qa.md](plan_p3m1_agent-backend-qa.md)). Symbol names below assume those plans as written; verify against the shipped code at execution time and follow the code where a name drifted, keeping row shapes identical to what `supabaseService` writes.
- Tool input field names are snake_case, matching the trip JSON the model reads (`stop_id`, `activity_id`, `date_from`).
- Update tools are partial: only fields present in the input change; zod enforces at least one editable field. This deliberately refines M4's full-replace modal semantics — the model supplies deltas, and unsupplied fields must never be nulled.
- Delete tools take only the item id; their descriptions and the system prompt restrict them to explicit user requests (Req 2.3). No tool named `delete_trip` exists (Req 2.4); Task 4 adds a structural test for this.
- New row ids are server-minted `crypto.randomUUID()`; the model never supplies ids for creation.
- Loop caps unchanged from M1: `MAX_ITERATIONS = 16`, `MAX_TOKENS_PER_CALL = 4096`, `MAX_PROMPT_CHARS = 4000`.
- The service-role key is never read by any `api/` module; every write runs under the caller's RLS.

---

## Implementation Plan

### Task 1: Registry restructure + change-event plumbing

Split `api/_lib/tools.ts` into `api/_lib/tools/{core.ts, read.ts, index.ts}`. Extended `AgentTool` with an optional `toChanges` hook and `ToolExecution` with a `changes` array. `dispatchTool` stamps `toChanges` output as `AgentChangeEvent`s on success; every non-success path returns `changes: []`. In the loop, change events are emitted after each tool execution. Replaced the static `PROGRESS_LABELS` record with `progressLabel(toolName, input)` — template-based, extracting item names from the input. Handler switched from `READ_TOOLS` to the full `AGENT_TOOLS` registry.

### Task 2: Activity + waypoint write tools (shared item factory)

Built a reusable `createFakeClient(queue)` test helper (queue-based, records calls, thenable chain) for all write-tool tests. Created `api/_lib/tools/items.ts` with a `buildItemTools` factory producing create/update/delete triples parameterized by entity, table, id field, and type support. Activities get a `type` field (enum over `ActivityType`); waypoints do not. Create tools append with a counted `sort_order` and `is_done: false`. Update tools are partial (zod refine enforces at least one editable field) and look up the current name first. Delete tools read the name, then delete. All produce change events. `thumbnail_url`/`google_place_id` deliberately omitted from agent inputs (no server-side place search).

### Task 3: Accommodation upsert + trip metadata tools

Created `api/_lib/tools/tripFields.ts` with `upsert_accommodation` (deterministic id `${stopId}_accommodation`, checks existence to report `created` vs `updated` op) and `update_trip_metadata` (partial patch with date-range validation, existence check). Added `destination` to the agent's metadata tool (the column exists; the interactive modal never exposed it).

### Task 4: Stop tools + restructure_stops with the date cascade

Created `api/_lib/tools/stops.ts` with `create_stop` (counted sort_order, computed `duration_days`), `update_stop` (partial, recomputes `duration_days` on date change by merging with stored dates, validates merged range), `delete_stop` (DB cascade removes children), and `restructure_stops` (validates ordered_stop_ids is a permutation of the trip's stops, runs `recalculateStopDates` server-side, batch-updates all stops + trip span, emits change events only for stops that actually moved). Added a structural registry test pinning the full 14-tool surface and asserting no `delete_trip` exists.

### Task 5: System prompt v2 - write rules and delete guard

Replaced the M1 read-only `CORE_RULES` with write-aware rules: read before writing, creates/updates run immediately with no undo, update tools change only provided fields, delete only on explicit request, never delete as a side effect, deleting a trip is not possible, new stops need real coordinates, restructure after stop changes, honest reporting of changes and failures.

### Task 6: Modal structured change list

Extended the modal state with a `changes: AgentChangeEvent[]` array. During a run, change events stream as progress lines and accumulate. The result view renders a "Changes" section grouped by entity in a fixed order (trip → stop → accommodation → activity → waypoint) with op labels (Added/Updated/Deleted). No change section appears for pure Q&A runs. "Ask another" clears collected changes.

### Task 7: M2 verification gate

Verified against a Vercel preview with a real model: activity creation, batch mark-done, accommodation upsert, stop reorder with date cascade, trip metadata rename. Delete guard: explicit delete works; vague "clean up" prompt does not trigger deletes; "delete the whole trip" is refused (no tool exists). Honest partial failure: a miss on a nonexistent item is reported in the summary while a successful write lands. Buffered mode `changes` array matches the UI.

---

## Design Decisions

- Named deviations from the M4 interactive path, all deliberate: partial updates instead of full-replace; `done` folded into the update tools (interactive uses `setActivityDone`); `destination` added to `update_trip_metadata`; `thumbnail_url`/`google_place_id` omitted from agent inputs (no server-side place search). Row mechanisms are identical.
- `restructure_stops` runs the M4 date cascade server-side, so the model never computes dates; the permutation check makes silent stop loss impossible.
- Change events are built only after a successful DB call, from executor output — the change list can never claim an unexecuted write. Non-success `dispatchTool` paths always return `changes: []`.
- Delete and update executors read the row first, so "not found" surfaces as a named tool error and delete change events carry the real item name.

## Critical Files — Summary

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

## Changelog

- 2026-07-10 — **Compacted post-implementation.** Removed step-by-step implementation tasks, file-by-file diffs, code snippets, test code, and verification command lists now that the feature has shipped. Preserved Goal, Architecture, Global Constraints, Design Decisions, and Critical Files summary. Original plan is recoverable via git history.
- 2026-07-04 — **UI: corner-pinned agent button on TripPage.** The `AgentButton` (shipped in M1) dropped its panel-dodge shift (`sm:right-[28rem]`) and stays corner-pinned left of the `UserMenu` (`fixed top-2 right-14 sm:top-4`). The activities panel drops to `sm:top-16` to clear the control row. Files: `src/pages/TripPage.tsx`, `src/components/Activities/ActivitiesPanel.tsx`. Companion UserMenu/panel change logged in [plan_p2m3_trip-library.md](../phase-2/plan_p2m3_trip-library.md).
- 2026-07-04: Initial plan (written ahead of M1 execution; symbol names follow the M1 and Phase 2 M4 plans).
