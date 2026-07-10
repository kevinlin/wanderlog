# Deepen the Supabase data layer — Moves 1 & 2

## Context

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

---

## Move 1 — pure shared mapping module

Created **`src/services/entityRows.ts`** (pure: no `supabase-js`, no `@/config` value import).

### What it owns

1. **`nightsBetween(fromISO, toISO): number`** — single canonical implementation using `differenceInCalendarDays(parseISO(to), parseISO(from))` (calendar-days, DST-safe, matches `recalculateStopDates`). Retired the client's UTC ms-round version and the agent's `dayCount`. Pointed `stopDateUtils.ts` at it too so all three collapsed to one.

2. **Per-entity column definitions** — one `{ inputKey → dbColumn, nullable }` table per entity: activity, waypoint, accommodation, stop, trip-metadata. Covers the full column superset (incl. `thumbnail_url`, `google_place_id`, `destination`).

3. **Two appliers over the defs:**
   - `denseRow(defs, input)` → every column, `value ?? null` (client full-form semantics).
   - `patchRow(defs, input)` → only columns whose input key is present (agent sparse semantics).

4. **Insert conventions** as shared consts: `accommodationId(stopId) = \`${stopId}_accommodation\``, `CREATE_DEFAULTS = { is_done: false }`. `sort_order` derivation stays caller-side (genuinely different, not forced).

### Non-goals in Move 1

- Column-gap **closures** (adding `thumbnail_url`/`google_place_id` to agent input; `destination` to client) — behavior changes, flagged as optional follow-ups.
- Fixing client `updateStop` to recompute `duration_days` — trivial after consolidation, but a behavior change; flagged, not bundled.
- `useTripMutations`' `activityInputToDomain`/etc. — input→**domain** (optimistic cache patch), a different projection, browser-only. Untouched.

---

## Move 2 — parameterize the client

Extracted the CRUD **execution** into a client-injected `src/services/tripWrites.ts` — mirroring how `importTrip` already wraps `insertTripBundle`. `supabaseService.ts` became the **thin browser adapter**: each fn keeps its current signature and delegates (e.g. `export const setActivityDone = (id, isDone) => setActivityDoneImpl(getSupabase(), id, isDone)`). Agent tool `execute` bodies call the shared `tripWrites` fn, passing the request-scoped `client`. Browser call sites, `*Input` type exports, and hook tests unchanged.

Deep-module framing: `tripWrites` is the deep, client-injected implementation; `supabaseService` and the agent tools are two adapters at the **client seam**.

---

## Critical Files — Summary

| Path | Role |
|------|------|
| `src/services/entityRows.ts` | Pure column defs, `denseRow`/`patchRow` appliers, canonical `nightsBetween` |
| `src/services/tripWrites.ts` | Client-injected CRUD execution (the deep module) |
| `src/services/supabaseService.ts` | Thin browser adapter binding `getSupabase()` |
| `api/_lib/tools/{items,stops,tripFields}.ts` | Agent tool `execute` bodies delegating to `tripWrites` |
| `src/utils/stopDateUtils.ts` | Points at `nightsBetween` from `entityRows` |

## Sequencing

Landed **Move 1** first and independently — it removed the column/date drift and the DST `duration_days` bug with no signature or client-wiring changes. **Move 2** built on Move 1's mappers to also share execution. Optional follow-ups (agent column-gap closures, client `updateStop` duration recompute) are separate, behavior-changing PRs.

## Changelog

- 2026-07-10 — **Compacted post-implementation.** Removed the detailed Verification section and Files-touched lists now that both moves have shipped. Preserved Context (drift analysis), design rationale for both moves, non-goals, and Critical Files summary. Original plan is recoverable via git history.
