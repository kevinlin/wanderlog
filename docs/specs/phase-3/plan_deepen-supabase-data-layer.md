# Deepen the Supabase data layer — Moves 1 & 2

## Context

The client↔Supabase **write** path is duplicated across two runtimes with no shared interface:

- **Client**: `src/services/supabaseService.ts` — the only browser `supabase-js` caller; ~17 CRUD fns.
- **Agent**: `api/_lib/tools/{items,stops,tripFields}.ts` — re-implement the same table writes server-side.

Two adapters write the same tables, so per-entity **column knowledge and date math live in 3–4 places and have already drifted**:

- Client emits `thumbnail_url` + `google_place_id` on activities/waypoints (and `google_place_id` on accommodation); the agent omits them.
- Agent handles `destination` on trip-metadata update; the client's `TripMetadataPatch` does not.
- **Three different night-count implementations**: `nightsBetween` (client, UTC ms-round, `supabaseService.ts:188`), `dayCount` (agent, local calendar-days, `stops.ts:18`), and the calc inside `recalculateStopDates` (local `parseISO`, `stopDateUtils.ts:12`). They disagree at DST/timezone edges → UI stop edits and agent stop edits write **different `duration_days`**. Latent bug.
- Client `updateStop` never recomputes `duration_days` on a date edit; the agent's `update_stop` does. Client value goes stale.

The read path (`read.ts` ↔ `fetchTripById`/`fetchTripSummaries`) and full-trip create (`createTrip.ts` ↔ `importTrip`, both via `insertTripBundle`→`buildRows`) are **already shared** — not in scope.

**Goal.** Collapse the drift-prone core into deep, pure, shared modules. Two sequenced moves:

- **Move 1** — one pure module owning per-entity column mapping + date math; both adapters consume it. Delivers the drift/date-bug fix; landable alone.
- **Move 2** — parameterize the Supabase client so the CRUD *execution* is shared too; the browser service and the agent tools become two thin adapters over one client-injected module.

**Proven precedent.** `src/services/tripBundleInsert.ts` is already a pure, client-injected module imported by both sides. Import rule that makes cross-boundary work: **runtime/value imports → relative path with explicit `.js`; `import type` → `@/` alias (esbuild erases it)**. No build-config change is needed for either move.

**Hard constraints.**
- Preserve browser-facing signatures (`setActivityDone('act-1', true)`, etc.) — hook tests and hook call sites depend on them (`useTripMutations.test.tsx` asserts `toHaveBeenCalledWith(...)`).
- Preserve **both** update semantics: client = dense (`?? null` overwrites unspecified columns); agent = sparse (only provided columns). The shared mapper carries the column definitions once and each caller applies its own dense/sparse policy.
- Local `vitest` runs `api/` under jsdom and resolves imports like Vite — it will **not** catch a missing `.js` extension. Only `vercel build` / a preview deploy exercises the real Node-ESM resolution. Verification must include a build/preview step.

---

## Move 1 — pure shared mapping module

Create **`src/services/entityRows.ts`** (pure: no `supabase-js`, no `@/config` value import; type imports via `@/`, runtime imports relative `.js`). Kept separate from `supabaseMappers.ts` because that file owns row↔domain + `buildRows` (full objects), whereas this owns the lighter `*Input`→row projection. New sibling test `src/services/__tests__/entityRows.test.ts` mirrors the no-mock fixture style of the existing `supabaseMappers.test.ts`.

### What it owns

1. **`nightsBetween(fromISO, toISO): number`** — single canonical implementation using `differenceInCalendarDays(parseISO(to), parseISO(from))` (calendar-days, DST-safe, matches `recalculateStopDates`). Retires the client's UTC ms-round version and the agent's `dayCount`. Point `stopDateUtils.ts:12` at it too so all three collapse to one.
   - Behavior note: identical to the old client value except at DST edges; only affects `duration_days` recomputed on the *next* write, existing rows untouched.

2. **Per-entity column definitions** — one `{ inputKey → dbColumn, nullable }` table per entity: activity, waypoint, accommodation, stop, trip-metadata. Cover the full column superset (incl. `thumbnail_url`, `google_place_id`, `destination`).

3. **Two tiny appliers over the defs**, so both semantics stay intact:
   - `denseRow(defs, input)` → every column, `value ?? null` (client full-form semantics).
   - `patchRow(defs, input)` → only columns whose input key is present (agent sparse semantics).

4. **Insert conventions** as shared consts: `accommodationId(stopId) = \`${stopId}_accommodation\``, `CREATE_DEFAULTS = { is_done: false }`. `sort_order` derivation stays caller-side (client passes an arg; agent runs a `count()` query) — genuinely different, not forced.

### Files touched

- **NEW** `src/services/entityRows.ts` + `src/services/__tests__/entityRows.test.ts`.
- `src/services/supabaseService.ts` — replace `activityInputToRow`/`waypointInputToRow`, the accommodation upsert body, inline stop-row build, and `nightsBetween` with `denseRow`/`nightsBetween`/`accommodationId` calls.
- `api/_lib/tools/items.ts` — replace `CONTENT_COLUMNS` + `contentPatch` with `patchRow(ACTIVITY_DEFS/WAYPOINT_DEFS, input)`. Import via `../../../src/services/entityRows.js`.
- `api/_lib/tools/stops.ts` — replace `dayCount` + inline column loops with `nightsBetween` + `denseRow`/`patchRow`.
- `api/_lib/tools/tripFields.ts` — replace inline accommodation object + `METADATA_COLUMNS` loop with shared defs.
- `src/utils/stopDateUtils.ts` — use the shared `nightsBetween`.

### Reuse (don't reinvent)

- `buildRows` (`supabaseMappers.ts:208`) is the existing canonical dense column list — the new per-entity defs should agree with it. Consider deriving `buildRows`' per-entity blocks from the same defs in a later pass (out of scope now).
- `recalculateStopDates` (`stopDateUtils.ts:9`) stays the stop-chain re-anchor; only its internal night calc points at the shared fn.
- Test style: `src/services/__tests__/supabaseMappers.test.ts` (zero mocks, fixture in / shape out).

### Non-goals in Move 1 (call out at review)

- The column-gap **closures** (adding `thumbnail_url`/`google_place_id` to agent input; `destination` to client) become one-line once defs are shared, but changing agent input schema / client patch type is a behavior change — leave as flagged optional follow-ups.
- Fixing client `updateStop` to recompute `duration_days` — trivial after consolidation, but a behavior change; flag, don't bundle.
- `useTripMutations`' `activityInputToDomain`/etc. are input→**domain** (optimistic cache patch), a different projection, browser-only. Untouched.

---

## Move 2 — parameterize the client

Extract the CRUD **execution** (the `.from().update()/.insert()/.delete()` plumbing + error normalization) into a client-injected module so the same functions run in both runtimes — mirroring how `importTrip = () => insertTripBundle(getSupabase(), ...)` already wraps the client-injected `insertTripBundle`.

**Recommended shape (preserves signatures, zero hook-test churn):**

- **NEW** `src/services/tripWrites.ts` — client-injected functions: `createActivity(client, stopId, sortOrder, input)`, `updateActivity(client, id, input)`, `deleteById(client, table, id)`, `upsertAccommodation(client, stopId, input)`, `createStop`/`updateStop`, `applyStopStructure`, `updateTripMetadata`, `setActivityDone`/`setWaypointDone`, `reorderActivities`. Consumes Move 1's mappers. No `@/config` import; runtime imports relative `.js`.
- `src/services/supabaseService.ts` becomes the **thin browser adapter**: each fn keeps its current signature and delegates, e.g. `export const setActivityDone = (id, isDone) => setActivityDoneImpl(getSupabase(), id, isDone)`. Browser call sites, `*Input` type exports, and hook tests are unchanged.
- `api/_lib/tools/{items,stops,tripFields}.ts` — each `execute` keeps its agent-only work (sort_order `count()`, `fetchName` for change labels, `toChanges`, zod schemas) and calls the shared `tripWrites` fn for the actual write, passing its request-scoped `client`.

Deep-module framing: `tripWrites` is the deep, client-injected implementation; `supabaseService` and the agent tools are two adapters at the **client seam**.

**Alternative (fewer files, more churn):** parameterize `supabaseService.ts` in place — add `client` as the first arg to each fn, delete `getSupabase()` calls, add `.js` to its two relative value imports (`./supabaseMappers`, `./tripBundleInsert`), and update the ~13 call sites in `useTripMutations.ts` + `useTripLibraryMutations.ts` + read hooks to pass `getSupabase()`. This changes public signatures, so `supabaseService.test.ts` must switch from `vi.mock('@/config/supabase')` to an injected fake and every hook test's `toHaveBeenCalledWith` gains a client arg. Not recommended.

### Files touched (recommended shape)

- **NEW** `src/services/tripWrites.ts` + `src/services/__tests__/tripWrites.test.ts`.
- `src/services/supabaseService.ts` — collapse write bodies into thin `getSupabase()`-binding wrappers.
- `api/_lib/tools/{items,stops,tripFields}.ts` — `execute` bodies call `tripWrites` fns.
- Read path (`fetchTripById`/`fetchTripSummaries`): optional to parameterize; already shared via `supabaseMappers`, so leave unless convenient.

### Reuse

- `api/_lib/__tests__/fakeSupabaseClient.ts` `createFakeClient(queue)` — queue-based, records `calls`, thenable chain. Use it for `tripWrites.test.ts` instead of hand-built spies.
- `tripBundleInsert.ts` — the exact client-injection + compensation pattern to copy.
- `api/_lib/supabase.ts` `createUserClient` (agent's JWT-bound client) and `src/config/supabase.ts` `getSupabase()` (browser singleton) — the two clients the adapters bind; unchanged.

---

## Verification

Run in order:

1. `pnpm test:run` — all existing suites green: `supabaseMappers.test.ts`, `supabaseService.test.ts`, `api/_lib/__tests__/{items,stops,tripFields,createTrip,tools}.test.ts`, `useTripMutations`/`useTripLibraryMutations`/`useTripData`.
2. New `entityRows.test.ts` (Move 1) / `tripWrites.test.ts` (Move 2) — pure, no mocks. Assert: full column output incl. `thumbnail_url`/`google_place_id`/`destination`; dense vs patch appliers; **`nightsBetween` across a DST boundary** (regression for the consolidation); `is_done:false` + deterministic accommodation id.
3. `pnpm build` (`tsc -b && vite build`) — type-checks `src` + `api` together; catches alias/`.js` mistakes at the type level.
4. **Cross-boundary build check (required — local vitest misses this):** `vercel build` locally, or push a PR for a Vercel preview, and confirm `api/agent` boots and imports the new shared module. A missing `.js` on a runtime import fails here and only here.
5. Manual smoke on `pnpm dev`: create/edit/toggle an activity, reorder activities, upsert accommodation, edit trip metadata, restructure stops → confirm writes persist in Supabase. Then run an agent request that creates + updates an activity and edits a stop's dates; confirm the agent writes the **same columns** and that a UI stop edit and an agent stop edit now produce the **same `duration_days`** (the divergence fix).

## Sequencing

Land **Move 1** first and independently — it removes the column/date drift and the DST `duration_days` bug with no signature or client-wiring changes. **Move 2** builds on Move 1's mappers to also share execution. Optional follow-ups (agent column-gap closures, client `updateStop` duration recompute) are separate, behavior-changing PRs.
