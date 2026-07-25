# Wanderlog Phase 4 - Design Document

Design for [requirements_phase-4.md](requirements_phase-4.md): visit records on check-off, chronological ordering of visited items, agent support, offline capture. Phase 2 ([design_phase-2.md](../phase-2/design_phase-2.md)) and Phase 3 ([design_wanderlog-phase-3.md](../phase-3/design_wanderlog-phase-3.md)) carry over except where amended here.

Revised after an external design review; see the changelog for what moved.

## Design Decisions

In addition to the Scope Decisions in the requirements doc.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Stamp rule location | New pure module `src/services/visitRecord.ts`, joining the invariant-5 shared set | Both the browser toggle and the agent tool must produce identical stamps (Req 2.4, 4.3). A shared pure module is the only way to have one rule; `entityRows.ts` was rejected because column mapping and wall-clock policy are different concerns. |
| Timezone conversion | `Intl.DateTimeFormat` with a fixed locale and explicit `calendar`, `numberingSystem`, and `hourCycle` | Passing only `timeZone` leaves the output at the mercy of the runtime locale: non-Latin digits, and an `h24` cycle that renders midnight as `24:05`. Pinning all four makes browser and Node produce the same ASCII string. |
| Duration | New `visit_duration_minutes`; `duration` text untouched | Reversed from the first draft. An inventory of the checked-in trip data found roughly 31 of 40 distinct `duration` values are ranges or prose. Splitting removes the parser, the backfill script, the contract migration, and the import warning transport, and leaves `duration` readers (`PlaceHoverCard`, POI defaults, `validationUtils`, fixtures) untouched. |
| Trip dates for the stamp rule | Carried in `TripData` from the detail query | `toTripData` currently drops `start_date`/`end_date` even though `TRIP_SELECT` fetches them. Deriving them from stops was rejected: the requirement names trip metadata, and stop dates can differ from it mid-edit. Reading `TripSummary` was rejected because a persisted detail query can exist without a persisted library list, which would make offline stamping depend on unrelated cache history. |
| Out-of-range visit date | No native `min`/`max`; the range is helper text and the warning is application code | `ItemModalShell` submits through a native `<form>`, so a violated `min`/`max` would trigger constraint validation and block the submit that Req 2.9 requires to succeed. |
| Visit mutation callbacks | Defined once at module scope; the hook supplies only key, scope, and variables | A hydrated mutation runs from `setMutationDefaults`, so any callback defined in a closure exists on the live path and not the resumed one. Defining them once means live and resumed executions run the same code, and the rollback contract cannot drift between them. |
| Ordering of queued writes | TanStack mutation `scope`, keyed per item | Ticking then saving details while offline queues two writes for one item, so ordering is the normal case, not an edge. Same-scope mutations run serially and the scope survives dehydration. |
| Reorder after the split | `onReorder` becomes id-based; reordered planned ids are substituted into the slots the planned items already held | Drag now covers only the planned subset, so the old `(fromIndex, toIndex)` no longer indexes the full list. Substituting into held slots leaves visited items' `sort_order` untouched, so unticking returns an item to its original position instead of the bottom of the plan. |
| Visit form | Separate `VisitDetailsModal` over the existing `ItemModalShell`, offered only on done items | The full item editors carry a Places search that loads Maps JS; exempting them from the offline gate (Req 5.1) would mean running a Maps-dependent form offline. Restricting the affordance to done items makes `visited_at` imply `is_done` by construction. |
| Agent trip context | Widen the existing per-update lookup rather than threading a context object | `update_activity` already runs one select by id before every write. Pulling the trip's timezone and dates through the same query adds no round trip, leaves `AgentTool` and `dispatchTool` untouched, and resolves correctly on library-scoped runs where no trip was prefetched. |
| Timezone correction | `timezone` joins `TRIP_METADATA_COLUMNS` | TripIt imports default the zone to the importing device. Without a correction path, a trip imported in Singapore for Zurich stamps every visit in Singapore time, and the core chronology is wrong while looking valid. |

## Data Model

Schema delta, in `supabase/migrations/*.sql`, applied via Supabase CLI. Additive only - nothing is converted or dropped.

```sql
alter table activities        add column visited_at             text;
alter table activities        add column visit_duration_minutes integer;
alter table scenic_waypoints  add column visited_at             text;
alter table scenic_waypoints  add column visit_duration_minutes integer;
```

Schema notes:

- `visited_at` is `'YYYY-MM-DD HH:mm'` local to `trips.timezone`, matching `accommodations.check_in`/`check_out` and the Phase 2 rationale for rejecting `timestamptz` on wall-clock fields. It sorts chronologically as plain text, so ordering needs no expression index.
- `duration` keeps its meaning and its data: the planned estimate, free text, ranges and prose included (Req 1.3).
- All four columns are nullable with no default, so no table is rewritten.
- RLS is unchanged: policies are table-level and no table is added.
- The Phase 2 migration-before-deploy rule applies. Because the change is purely additive, a frontend rolled back to a build that does not know the columns degrades to hiding visit data rather than breaking.

**Domain types.** `Activity` and `ScenicWaypoint` ([src/types/trip.ts](../../../src/types/trip.ts), [src/types/map.ts](../../../src/types/map.ts)) gain `visited_at?: string` and `visit_duration_minutes?: number`; `duration?: string` stays. `ScenicWaypoint` also gains `order?: number`, which `Activity` already has and the waypoint rows already store - the merged ordering in Req 3.6 needs it.

`TripData` gains `start_date?: string` and `end_date?: string`. `TRIP_SELECT` already fetches them; `toTripData` simply drops them today. They are optional because the import path builds `TripData` from a file that may not carry trip-level dates; when they are absent the stamp rule returns null rather than guessing (Req 2.3's safe direction).

`entityRows.ts` adds `col('visitedAt', 'visited_at')` and `col('visitDurationMinutes', 'visit_duration_minutes')` to `ACTIVITY_COLUMNS`; `WAYPOINT_COLUMNS` derives from it, so waypoints inherit both. `TRIP_METADATA_COLUMNS` gains `col('timezone')`.

Mappers carry the new columns in both directions, keeping the loose `== null` guard style the Phase 2 schema-drift rule requires.

## Shared Module: `visitRecord.ts`

`src/services/visitRecord.ts` joins the modules reachable from `api/` (invariant 5): relative imports with explicit `.js` extensions, no `@/` aliases, no supabase-js, no browser globals.

| Export | Signature | Notes |
|--------|-----------|-------|
| `formatTripLocal` | `(now: Date, timeZone: string) => string` | `Intl.DateTimeFormat('en-US', { timeZone, calendar: 'gregory', numberingSystem: 'latn', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })`, read through `formatToParts` and assembled into `'YYYY-MM-DD HH:mm'`. |
| `stampIfDuringTrip` | `({ now, timeZone, startDate, endDate }) => string \| null` | Formats, then compares the date half against the range as strings. Returns the stamp inside the range, null outside, and null when any input is missing (Req 2.2, 2.3). |
| `isValidTripLocal` | `(value: string) => boolean` | Shape plus real-calendar check, so `2026-02-30 25:61` is rejected. Used by the form and by the agent tool schema's refinement. |

`now` is always a parameter, never read inside, so tests need no clock mocking. Display formatting (`'1h 20m'`) stays client-side in `src/utils/`: the agent has no use for it.

## File Format

`tripFileSchemas.ts` adds two optional fields per item - `visited_at` (refined with `isValidTripLocal`) and `visit_duration_minutes` (non-negative integer) - and carries them through `toTripData`. `duration` is unchanged, so every existing file imports exactly as it does today and no warning channel is needed (Req 1.7).

Export needs no change: it serialises mapper output, so the new fields appear once the mappers carry them (Req 1.8).

## Write Path

**Callbacks live at module scope.** `src/lib/visitMutation.ts` owns the whole contract, so the live and resumed executions are the same code:

| Export | Purpose |
|--------|---------|
| `applyVisitPatch(trip, vars)` | Pure. Returns a patched `TripData` clone with the item's visit fields set. |
| `revertVisitPatch(trip, context)` | Pure. Restores the item's prior field values from a serialised context. |
| `visitMutationDefaults` | `{ mutationFn, onMutate, onError, onSettled }`, registered with `setMutationDefaults(['visit-record'], ...)`. |
| `onVisitWriteError(listener)` | Subscribe/emit pair bridging module scope to React. |

`onMutate` cancels the detail query, snapshots only the item's four prior values, and applies `applyVisitPatch`. `onError` calls `revertVisitPatch` against the current cache and then emits; the emit carries the variables so a subscriber can offer Retry. `onSettled` invalidates using the `tripId` that travels in the variables. Nothing closes over React, so a mutation rebuilt by hydration behaves identically to one created in-session (Req 5.4).

`ToastProvider` subscribes to `onVisitWriteError` and renders the existing rollback-and-retry toast, so both paths surface the same way.

**The hook.** `useVisitRecord(tripId, itemId, isWaypoint)` is a thin `useMutation({ mutationKey: ['visit-record'], scope: { id: \`visit-${itemId}\` } })` with no inline callbacks. The constant key resolves the registered defaults through `defaultMutationOptions`; the per-item scope makes concurrent writes to one item run serially, and both survive dehydration (Req 5.5).

Because `scope` is fixed per mutation instance, the hook is called per item rather than once per page: `DraggableActivity` for activities and the waypoint row for waypoints. Both the checkbox and `VisitDetailsModal` use that instance. `TripPage` keeps a notification callback for the stop-complete and trip-complete celebrations, which need whole-trip knowledge, but no longer performs the write.

`tripWrites` gains `writeVisitFields(client, table, id, fields)` over the existing `updateById`, replacing `setActivityDone`/`setWaypointDone`. Unchecking forces `visited_at: null` in the same write (Req 2.10).

**Restart survival (Req 5.3).** Paused mutations are already dehydrated by TanStack's default `shouldDehydrateMutation`, and `QueryClient.mount()` already resumes them when the connection returns within a session. Two gaps close the restart path:

- Hydration rebuilds a mutation through `defaultMutationOptions`, which recovers callbacks only via `getMutationDefaults(mutationKey)`. `src/lib/mutationDefaults.ts` performs the registration and is imported by `main.tsx` before render.
- `PersistQueryClientProvider` gains `onSuccess={() => queryClient.resumePausedMutations()}`; it does not resume on its own.

The serialised context holds four scalar values, not a `TripData` snapshot, because `mutation.state.context` is dehydrated with the mutation and a trip tree per queued write would bloat IndexedDB.

Cache `buster` moves `phase2-v1` to `phase4-v1`: the cached trip shape changes (invariant 3).

## Ordering and Panel Layout

Two pure functions in `src/utils/tripUtils.ts`:

| Function | Signature | Purpose |
|----------|-----------|---------|
| `partitionByVisit` | `(activities, waypoints) => { planned, plannedWaypoints, visitedGroups }` | Splits both lists and merges done items of both types into `visitedGroups`, each `{ date: string \| null, items: VisitedItem[] }`. |
| `applyPlannedOrder` | `(currentOrderIds, reorderedPlannedIds) => string[]` | Substitutes reordered planned ids into the slots the planned items already occupied, leaving visited items' positions untouched. |

`VisitedItem` is `{ kind: 'activity' | 'waypoint'; order: number; item }`. The `order` comes from the domain field, which both types now carry, never from array position.

**Total order** (Req 3.6). Dated items sort by `visited_at`; undated items form the final group. Within either, ties break by `order`, then by `kind` with activities before waypoints, then by id. The last two matter because `visited_at` has minute precision and because the two tables number `sort_order` independently, so an activity and a waypoint routinely both hold `0`. The id tie-break makes rendering independent of how the two arrays were concatenated.

`ActivitiesPanel` renders, top to bottom: planned activities with drag-and-drop unchanged, then the scenic-waypoints collapsible now holding and counting planned waypoints only, then the merged Visited section with a heading per date (Req 3.7) and the undated group last (Req 3.8). Drag is absent inside Visited (Req 3.4).

`TripPage.handleActivityReorder` switches to the id-based signature and calls `applyPlannedOrder` before `reorderMutation`.

Visited cards show the visit time, formatted visit duration, and note inline (Req 2.12). The map, timeline, and trip library are untouched (Req 3.10).

## Visit Form

`VisitDetailsModal` over the existing `ItemModalShell`, serving activities and waypoints. Its affordance renders only on done items (Req 2.5), which is what keeps a visit record from existing on a planned item.

- **When** - date and time inputs carrying no `min`/`max` attributes. The trip's range appears as helper text, and a value outside it renders an inline warning while leaving Save enabled (Req 2.9). Native constraint validation would abort the shell's form submit, so the check is application code and the warning is wired to the field with `aria-describedby`.
- **Duration** - a `DurationInput` component (hours and minutes boxes, value in minutes) writing `visit_duration_minutes`. Planned `duration` stays free text in the existing item editors and is not touched here.
- **Notes** - textarea bound to `remarks`.

Every field is prefilled from current stored values, so an overwrite is always a deliberate edit (Req 2.7). The card's affordance and this modal are the only editing surfaces not gated on `useOnlineStatus` (Req 5.1); all other editors keep the Phase 2 behaviour.

## Trip Timezone Correction

`TRIP_METADATA_COLUMNS` gains `timezone`, which carries it into both the browser's `useUpdateTripMetadata` and the agent's `update_trip_metadata` with no per-client work (Req 6.1, 6.3).

`TripMetadataFormModal` gains an IANA zone field. Validation uses `Intl.supportedValuesOf('timeZone')` where available, falling back to constructing an `Intl.DateTimeFormat` with the candidate zone and treating a throw as invalid (Req 6.2). The same check refines the agent tool's schema, so an invalid zone returns a tool error instead of writing.

TripIt import keeps defaulting to the importing device's zone (Req 6.4); this only makes it fixable.

## Agent

Changes to [api/_lib/tools/items.ts](../../../api/_lib/tools/items.ts), [api/_lib/tools/tripFields.ts](../../../api/_lib/tools/tripFields.ts), and [api/_lib/systemPrompt.ts](../../../api/_lib/systemPrompt.ts):

- `UPDATE_FIELDS` adds `visited_at` (refined with `isValidTripLocal`, nullable) and `visit_duration_minutes` (non-negative integer). `CREATE_FIELDS` is unchanged - `duration` stays text.
- `fetchName` widens into `fetchItemContext`, selecting the item's name and `is_done` plus the owning trip's `timezone`, `start_date`, and `end_date` through the stop. This is the query it already ran before every update.
- The executor applies the shared rules: `done: true` without a `visited_at` gets `stampIfDuringTrip` (Req 4.3); an explicit `visited_at` wins (Req 4.4); `done: false` forces `visited_at: null`.
- **Not-done guard** (Req 4.5): if the patch sets any visit field while the item's fetched `is_done` is false and the same call does not set `done: true`, the tool returns a validation error naming the item, and writes nothing. This is why `fetchItemContext` also selects `is_done`.
- `systemPrompt` gains the current date and time in the scoped trip's timezone plus the trip's date range, both read from the prefetched trip - available because `toTripData` now carries the dates (Req 4.2). A library-scoped run has no single trip to localise to, so it gets the UTC date-time instead. The prompt also states the not-done rule so the model marks items done rather than tripping the guard.

`toChanges` is unchanged - a visit write is an `updated` change like any other (Req 4.6). Read tools need no change: `TRIP_SELECT` is a nested `*`, so the new columns flow through the mappers into the model's context (Req 4.7). Invariant 6 holds: the agent's surface still mirrors the client's.

## Error Handling

| Failure | Surface |
|---------|---------|
| Visit write fails online | `revertVisitPatch` restores the prior values; the emitter drives the retry toast |
| Visit write fails after resume from a restart | Identical path - same module-scope callbacks, same rollback, same toast |
| Two queued writes to one item, the earlier fails | Mutation scope serialises them, so the failure resolves before the later write applies |
| Visit time outside the trip's dates | Inline warning beside the field; save proceeds |
| Visit time not a real date | Rejected by `isValidTripLocal` in the form and in the tool schema |
| Agent sets visit fields on an item that is not done | Tool error naming the item; nothing written |
| Agent supplies an invalid timezone | Tool error from the schema refinement |
| Trip timezone wrong on an imported trip | Correctable from trip metadata (Req 6); until corrected, stamps use the stored zone |

## Testing

- `visitRecord`: a trip timezone different from the device's, both ends of the date range, midnight under `hourCycle: 'h23'`, a non-Latin runtime locale, and both sides of a DST transition in a zone that observes it. `isValidTripLocal` accept and reject cases.
- `partitionByVisit` and `applyPlannedOrder`: pure tests over plain arrays, including several undated activities and waypoints with colliding `order` values, and the untick-returns-to-slot case.
- Visit mutation: optimistic patch and rollback; then dehydrate a paused write, hydrate into a fresh client with the defaults registered, call `resumePausedMutations`, and assert both that the write fires and that a failing resume leaves the cache holding the prior values - not only that the emitter fired.
- Ordering: two queued writes to one item where the first fails, asserting the later value survives.
- Offline hydration: a client with only the detail query hydrated - no trip-library cache - still applies the correct in-range stamp.
- `VisitDetailsModal`: prefill; and an interaction test that types an out-of-range date, clicks the real Save button, sees the warning, and confirms the mutation ran. Calling the submit handler directly would not catch the native-validation failure this replaces.
- Item tools: stamp applied inside the trip window, skipped outside it, overridden by an explicit `visited_at`, and the not-done guard refusing a write.
- Trip metadata: timezone accepted, invalid zone rejected, and a TripIt-created trip whose destination zone differs from the importing device stamping correctly after correction.
- Import and export: both new fields round-trip; existing sample files import unchanged.

## Milestones

Matching the requirements doc. Detailed plans written just-in-time as `plan_p4m<N>_<topic>.md`.

1. **M1 - Data model and capture.** Migration, mappers including the trip's stored dates and waypoint order, `visitRecord.ts`, timezone correction in trip metadata, the module-scope visit mutation with resume wiring, `VisitDetailsModal`, `DurationInput`, card rendering, `buster` bump. *Verify: a tick during a live trip stamps trip-local time and a tick outside the window does not; a trip whose timezone differs from the device stamps in the trip's zone; the form saves an out-of-range date with a warning; a note typed offline survives a tab restart, and a failure after that restart rolls back and offers retry.*
2. **M2 - Visited section.** `partitionByVisit`, `applyPlannedOrder`, panel restructuring, id-based reorder. *Verify: a multi-night stop renders visited items grouped by day in visit order; ticking moves an item between sections; dragging works in planned and is absent in visited; unticking returns an item to its original slot; colliding order values render deterministically.*
3. **M3 - Agent check-off.** Tool fields, `fetchItemContext`, shared stamp rules server-side, the not-done guard, system-prompt clock and range. *Verify: "mark the museum done, we left at 3" records 15:00; "mark it done" during a live trip stamps as the UI would; visit fields on an unticked item are refused; the change list names the item.*

## Amendments to Earlier Designs

Applied to the Phase 2 and Phase 3 design docs alongside this one:

1. [design_phase-2.md](../phase-2/design_phase-2.md) schema - both item tables gain `visited_at` and `visit_duration_minutes`; `duration` is unchanged.
2. [design_phase-2.md](../phase-2/design_phase-2.md) data layer - `TRIP_METADATA_COLUMNS` gains `timezone`; `toTripData` carries the trip's stored dates.
3. [design_phase-2.md](../phase-2/design_phase-2.md) offline - the visit form is exempt from the edit-disable rule.
4. [design_wanderlog-phase-3.md](../phase-3/design_wanderlog-phase-3.md) tool catalog and system prompt - the item update tools gain two fields and a not-done guard; `update_trip_metadata` gains `timezone`; the prompt carries the current trip-local date-time and trip date range.

## Changelog

- 2026-07-26: Initial design (brainstormed and approved).
- 2026-07-26: Revised against an external design review (nine findings, since removed from the repo), all verified against the code and accepted. Duration reuse reversed to a split (`visit_duration_minutes` added, `duration` untouched), which removed the parser, backfill script, contract migration, and import warning transport along with it. `TripData` now carries the trip's stored dates, giving the stamp rule an offline-safe source for both clients. Native `min`/`max` dropped from the date field, since the shell's form submit would have blocked the required out-of-range save. Visit mutation callbacks moved wholesale to module scope with a pure rollback and a per-item mutation scope, so live and resumed executions share one contract and queued writes to one item stay ordered. Waypoint `order` carried into the domain and a total ordering defined with explicit tie-breaks. Visit affordance restricted to done items, with a matching agent guard. `Intl` options pinned. Trip timezone correction added, replacing a false claim that the risk was already documented and repairable.
