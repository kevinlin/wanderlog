# Wanderlog Phase 4 - Design Document

Design for [requirements_phase-4.md](requirements_phase-4.md): visit records on check-off, chronological ordering of visited items, agent support, offline capture. Phase 2 ([design_phase-2.md](../phase-2/design_phase-2.md)) and Phase 3 ([design_wanderlog-phase-3.md](../phase-3/design_wanderlog-phase-3.md)) carry over except where amended here.

## Design Decisions

In addition to the Scope Decisions in the requirements doc.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stamp rule location | New pure module `src/services/visitRecord.ts`, joining the invariant-5 shared set | Both the browser toggle and the agent tool must produce identical stamps (Req 2.4, 4.3). A shared pure module is the only way to have one rule; `entityRows.ts` was rejected because column mapping and wall-clock policy are different concerns. |
| Timezone conversion | `Intl.DateTimeFormat(...).formatToParts` with an explicit `timeZone`, assembled by hand | Zero new dependencies, full ICU in both the browser and Vercel's Node 24. Assembling parts rather than relying on a locale's format string keeps output deterministic. `date-fns-tz` would add a dependency to do what the platform already does. |
| Duration migration | Expand, backfill in TypeScript, contract in a later migration | The importer needs a text-to-minutes parser anyway (Req 1.6), so the backfill reuses it: one parser, one test suite, one definition of what `'1.5h'` means. Both columns coexist between the two migrations, so a frontend rollback still renders durations. |
| Reorder after the split | `onReorder` becomes id-based; reordered planned ids are substituted into the slots the planned items already held | Drag now covers only the planned subset, so the old `(fromIndex, toIndex)` no longer indexes the full list. Substituting into held slots leaves visited items' `sort_order` untouched, so unticking returns an item to its original position instead of the bottom of the plan. |
| Visit form | Separate `VisitDetailsModal` over the existing `ItemModalShell` | The full item editors carry name, type, address, URL and a Places search that loads Maps JS; exempting them from the offline gate (Req 5.1) would mean running a Maps-dependent form offline. A three-field modal is also the right weight for jotting a note. |
| Agent trip context | Widen the existing per-update lookup rather than threading a context object | `update_activity` already runs one select by id before every write. Pulling the trip's timezone and dates through the same query adds no round trip, leaves `AgentTool` and `dispatchTool` untouched, and resolves correctly on library-scoped runs where no trip was prefetched. |
| Check-off and details as one mutation | A single `useVisitRecord` hook serves both the checkbox and the form | Invariant 2 says writes go through `useTripCacheMutation`. Two gestures writing the same four columns through one keyed mutation keeps one optimistic patch, one rollback, and one registered `mutationFn` for resume. |

## Data Model

Schema delta, in `supabase/migrations/*.sql`, applied via Supabase CLI.

```sql
-- 20260726_visit_records.sql
alter table activities        add column visited_at      text;
alter table activities        add column duration_minutes integer;
alter table scenic_waypoints  add column visited_at      text;
alter table scenic_waypoints  add column duration_minutes integer;

-- a later migration, once the backfill report is reviewed
alter table activities        drop column duration;
alter table scenic_waypoints  drop column duration;
```

Schema notes:

- `visited_at` is `'YYYY-MM-DD HH:mm'` local to `trips.timezone`, matching `accommodations.check_in`/`check_out` and the Phase 2 rationale for rejecting `timestamptz` on wall-clock fields. It sorts chronologically as plain text, so ordering needs no expression index.
- Both columns are nullable with no default, so neither `alter table` rewrites the tables.
- RLS is unchanged: policies are table-level, and no table is added.
- The Phase 2 migration-before-deploy rule applies. Between the two migrations `duration` and `duration_minutes` both exist, which is the rollback window.

Domain types ([src/types/trip.ts](../../../src/types/trip.ts), [src/types/map.ts](../../../src/types/map.ts)): `Activity` and `ScenicWaypoint` replace `duration?: string` with `duration_minutes?: number` and gain `visited_at?: string`.

`supabaseMappers` maps both new columns in each direction, keeping the loose `== null` guard style the Phase 2 schema-drift rule requires. `entityRows.ts` swaps `col('duration')` for `col('durationMinutes', 'duration_minutes')` and adds `col('visitedAt', 'visited_at')`; `WAYPOINT_COLUMNS` derives from `ACTIVITY_COLUMNS`, so waypoints inherit both without a second edit.

## Shared Module: `visitRecord.ts`

`src/services/visitRecord.ts` joins the modules reachable from `api/` (invariant 5): relative imports with explicit `.js` extensions, no `@/` aliases, no supabase-js, no browser globals.

| Export | Signature | Notes |
|--------|-----------|-------|
| `formatTripLocal` | `(now: Date, timeZone: string) => string` | `Intl.DateTimeFormat` with `timeZone`, `formatToParts`, assembled into `'YYYY-MM-DD HH:mm'`. |
| `stampIfDuringTrip` | `({ now, timeZone, startDate, endDate }) => string \| null` | Formats, then compares the date half against the range as strings. Returns the stamp inside the range, null outside (Req 2.2, 2.3). |
| `parseDurationText` | `(text: string) => number \| null` | The one text-to-minutes parser. Used by the backfill script and the importer (Req 1.3, 1.6). |

`now` is always a parameter, never read inside, so tests need no clock mocking.

Display formatting (`'1h 20m'`) stays client-side in `src/utils/`: the agent has no use for it, and keeping it out preserves the module's single purpose.

## Migration and Backfill

`scripts/backfill-duration.ts` (service-role key, local env only, same shape as `scripts/migrate-to-supabase.ts`):

1. Read every `activities` and `scenic_waypoints` row with a non-null `duration`.
2. Convert through `parseDurationText`.
3. Write `duration_minutes`; leave it null where the parse failed.
4. Print every unparseable value with its row id and table (Req 1.3).

Re-runnable: rows already carrying `duration_minutes` are skipped. The drop migration follows once the report is reviewed.

## File Format

`tripFileSchemas.ts` accepts either spelling on import (Req 1.6):

- `duration: z.string().optional()` - parsed through `parseDurationText` in `toTripData`.
- `duration_minutes: z.number().int().nonnegative().optional()` - taken as-is, and taking precedence when both are present.
- `visited_at: z.string().optional()`, validated against the `'YYYY-MM-DD HH:mm'` shape.

An unparseable text duration imports as null and is reported through the existing per-field message list rather than blocking (Req 1.7).

Export needs no change: it serialises mapper output, so it emits `duration_minutes` and `visited_at` once the mappers do (Req 1.8).

## Write Path

**One mutation, two gestures.** `useVisitRecord(tripId)` replaces `useToggleActivityDone`:

```
{ tripId, itemId, isWaypoint, isDone?, visitedAt?, durationMinutes?, remarks? }
```

- The checkbox calls it with `{ isDone, visitedAt }`, where `visitedAt` comes from `stampIfDuringTrip` using the cached trip's timezone and dates, or `null` on an uncheck (Req 2.9).
- `VisitDetailsModal` calls it with the three detail fields.

It composes `useTripCacheMutation` (invariant 2), so the optimistic patch, rollback, and retry toast are inherited. `tripWrites` gains `writeVisitFields(client, table, id, fields)` over the existing `updateById`, replacing `setActivityDone`/`setWaypointDone`.

**Restart survival (Req 5.3).** Paused mutations are already dehydrated by TanStack's default `shouldDehydrateMutation`, and `QueryClient.mount()` already resumes them when the connection returns within a session. Two gaps close the restart path:

- `src/lib/mutationDefaults.ts` registers `setMutationDefaults(['visit-record'], { mutationFn, onSettled })`, imported by `main.tsx` before render. Hydration rebuilds a mutation through `defaultMutationOptions`, which recovers a `mutationFn` only via `getMutationDefaults(mutationKey)` - so the hook must carry `mutationKey: ['visit-record']`.
- `PersistQueryClientProvider` gains `onSuccess={() => queryClient.resumePausedMutations()}`; it does not resume on its own.

`tripId` travels in the variables so the registered `onSettled` can invalidate without a closure. `onMutate` returns a slim context - the item's four prior field values, not a `TripData` snapshot - because `mutation.state.context` is serialised with the paused mutation, and a trip tree per queued write would bloat IndexedDB.

A mutation resumed after a restart runs from module scope, where React context is out of reach, so its `onError` cannot call `showToast` directly. To keep Req 5.4 true on that path too, `mutationDefaults.ts` exports a minimal subscribe/emit pair: the registered `onError` emits the failure with its variables, and `ToastProvider` subscribes and renders the same rollback-and-retry toast the in-session path shows, with Retry re-running the keyed mutation. The alternative - invalidating silently - would make a note typed offline disappear with no explanation, which is the failure this feature exists to prevent.

Cache `buster` moves `phase2-v1` to `phase4-v1`: the cached trip shape changes with `duration_minutes` (invariant 3).

## Ordering and Panel Layout

Two pure functions in `src/utils/tripUtils.ts`:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `partitionByVisit` | `(activities, waypoints) => { planned, plannedWaypoints, visitedGroups }` | Splits both lists; merges done items of both types into `visitedGroups`, each `{ date: string \| null, items }`, sorted by `visited_at` then `sort_order`, undated group last (Req 3.1, 3.3, 3.5-3.7). |
| `applyPlannedOrder` | `(currentOrderIds, reorderedPlannedIds) => string[]` | Substitutes reordered planned ids into the slots the planned items already occupied, leaving visited items' positions untouched. |

`ActivitiesPanel` renders, top to bottom: planned activities with drag-and-drop unchanged, then the scenic-waypoints collapsible now holding and counting planned waypoints only, then the merged Visited section with a heading per date. Drag is absent inside Visited (Req 3.4).

`TripPage.handleActivityReorder` switches to the id-based signature and calls `applyPlannedOrder` before `reorderMutation`. The stop-complete and trip-complete celebrations are unchanged.

Visited cards show the visit time, formatted duration, and note inline (Req 2.11). The map, timeline, and trip library are untouched (Req 3.9).

## Visit Form

`VisitDetailsModal` over the existing `ItemModalShell`, serving activities and waypoints:

- **When** - date and time inputs, prefilled from `visited_at` or defaulted to the current time in the trip's timezone (Req 2.7). `min`/`max` are the trip's dates; a value outside still saves and shows an inline warning (Req 2.8).
- **Duration** - a shared `DurationInput` component (hours and minutes boxes, value in minutes), also adopted by `ActivityFormModal` and `WaypointFormModal` so duration entry is consistent wherever it appears.
- **Notes** - textarea bound to `remarks`.

Every field is prefilled from current stored values, so an overwrite is always a deliberate edit (Req 2.6). The card's log affordance and this modal are the only editing surfaces not gated on `useOnlineStatus` (Req 5.1); all other editors keep the Phase 2 behaviour.

## Agent

Changes to [api/_lib/tools/items.ts](../../../api/_lib/tools/items.ts) and [api/_lib/systemPrompt.ts](../../../api/_lib/systemPrompt.ts):

- `CREATE_FIELDS.duration` becomes `duration_minutes: z.number().int().nonnegative().optional()`.
- `UPDATE_FIELDS` adds `visited_at`, validated against the `'YYYY-MM-DD HH:mm'` shape and nullable (Req 4.1).
- `fetchName` widens into `fetchItemContext`, selecting the item's name plus the owning trip's `timezone`, `start_date`, and `end_date` through the stop - the query it already ran before every update.
- The executor applies the shared rules: `done: true` without a `visited_at` gets `stampIfDuringTrip` (Req 4.3); an explicit `visited_at` wins (Req 4.4); `done: false` forces `visited_at: null`, mirroring the UI's uncheck.
- `systemPrompt` gains the current date and time in the scoped trip's timezone plus the trip's date range (Req 4.2). A library-scoped run has no single trip to localise to, so it gets the UTC date-time instead.

`toChanges` is unchanged - a visit write is an `updated` change like any other (Req 4.5). Read tools need no change: `TRIP_SELECT` is a nested `*`, so the new columns flow through the mappers into the model's context (Req 4.6). This keeps invariant 6 intact: the agent's surface still mirrors the client's.

## Error Handling

| Failure | Surface |
|---------|---------|
| Visit write fails online | Existing rollback plus retry toast from `useTripCacheMutation` |
| Visit write fails after resume from a restart | Same rollback plus retry toast, bridged from module scope by the `mutationDefaults` emitter |
| Visit time outside the trip's dates | Inline warning under the field; save proceeds |
| Duration text unparseable at import | Field imports null, listed in the import preview's messages |
| Duration text unparseable at backfill | Row left null, printed in the script's report |
| Agent supplies a malformed `visited_at` | zod rejects; tool error returns to the model, which retries |
| Trip timezone wrong (e.g. a TripIt import defaulted to the browser zone) | Stamps are skewed silently; the only fix is trip-metadata editing. Named as a known risk in the requirements doc. |

## Testing

- `visitRecord`: pure tests with a trip timezone deliberately different from the device's, both ends of the date range, and the parser's accept and reject cases.
- `partitionByVisit` and `applyPlannedOrder`: pure tests over plain arrays, including the untick-returns-to-slot case.
- `useVisitRecord`: optimistic patch and rollback, following the existing `useTripMutations.test.tsx` pattern.
- Restart resume: dehydrate a paused visit mutation, hydrate into a fresh client with the defaults registered, call `resumePausedMutations`, and assert the write fires. This is the requirement most likely to break silently.
- Resumed-write failure: the same path with a failing `mutationFn`, asserting the emitter fires and a subscriber receives the variables needed to retry.
- Item tools: stamp applied inside the trip window, skipped outside it, and overridden by an explicit `visited_at`.
- `VisitDetailsModal`: prefill, the out-of-range warning, and save wiring.
- Import: both duration spellings, precedence when both are present, and the unparseable-to-null path.
- Backfill script: run against local Supabase; verify counts and spot-check parsed values.

## Milestones

Matching the requirements doc. Detailed plans written just-in-time as `plan_p4m<N>_<topic>.md`.

1. **M1 - Data model and capture.** Migration, backfill script, `visitRecord.ts`, mappers and domain types, import/export, `useVisitRecord` with the mutation-key and resume wiring, `VisitDetailsModal`, `DurationInput`, card rendering, `buster` bump. *Verify: a tick during a live trip stamps trip-local time and a tick outside the window does not; the form round-trips all three fields; every file in `local/trip-data/` still imports; a note typed offline survives a tab restart and flushes on reconnect.*
2. **M2 - Visited section.** `partitionByVisit`, `applyPlannedOrder`, panel restructuring, id-based reorder. *Verify: a multi-night stop renders visited items grouped by day in visit order; ticking moves an item between sections; dragging works in planned and is absent in visited; unticking returns an item to its original slot.*
3. **M3 - Agent check-off.** Tool fields, `fetchItemContext`, shared stamp rules server-side, system-prompt clock and range. *Verify: "mark the museum done, we left at 3" records 15:00; "mark it done" during a live trip stamps as the UI would; the change list names the item.*

## Amendments to Earlier Designs

Applied to the Phase 2 and Phase 3 design docs alongside this one:

1. [design_phase-2.md](../phase-2/design_phase-2.md) schema - `duration` becomes `duration_minutes`; both item tables gain `visited_at`.
2. [design_phase-2.md](../phase-2/design_phase-2.md) offline - the visit form is exempt from the edit-disable rule.
3. [design_wanderlog-phase-3.md](../phase-3/design_wanderlog-phase-3.md) tool catalog and system prompt - the item update tools gain two fields; the prompt carries the current trip-local date-time and trip date range.

## Changelog

- 2026-07-26: Initial design (brainstormed and approved).
