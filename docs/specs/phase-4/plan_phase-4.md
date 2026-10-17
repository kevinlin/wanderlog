# Visit Records (Phase 4) Implementation Plan

Milestone tracker and implementation record for [requirements_phase-4.md](requirements_phase-4.md) (Requirements 1-6) / [design_phase-4.md](design_phase-4.md). Each milestone was independently shippable and its plan was written just-in-time; the three per-milestone plan files are now sections of this file. Tasks restart at 1 in each milestone and are cited as `M<n> Task <k>`.

**Prerequisite:** Phase 2 M4 (itinerary editing, [plan_phase-2.md](../phase-2/plan_phase-2.md)) and Phase 3 M2/M3 (agent write tools and generative creation, [plan_phase-3.md](../phase-3/plan_phase-3.md)) shipped.

## Goal

Three milestones, each goal quoted from its original plan:

- **M1 - Data model and capture.** Ticking an activity or scenic waypoint records when it happened, and a small offline-capable form captures how long it took and how it went (Phase 4 Requirements 1, 2, 5, 6).
- **M2 - Visited section.** A stop's completed activities and scenic waypoints leave the planned lists and read back as one chronological record, grouped by the day they happened (Phase 4 Requirement 3).
- **M3 - Agent check-off.** "Mark the museum done, we left at 3" records a visit the same way the checkbox would, and the agent refuses to put a visit record on an item that is not done (Phase 4 Requirement 4).

## Milestones

| Milestone | Requirements | Status | Verification gate |
|-----------|--------------|--------|-------------------|
| M1 - Data model and capture | 1, 2, 5, 6 | Shipped (signed off 2026-07-26 on production `d85e29e2`) | A tick during a live trip stamps trip-local time and one outside the window does not; a trip whose timezone differs from the device stamps in the trip's zone; the form saves an out-of-range date with a warning; a note typed offline survives a tab restart, and a failure after that restart rolls back and offers retry |
| M2 - Visited section | 3 | Shipped (gate complete 2026-07-26; map-pin check on production `63234b12`) | Visited items group by day in visit order, merged across activities and waypoints, undated ones last; drag works in planned and is absent in visited; unticking returns an item to its slot; map, timeline progress, and library are unchanged |
| M3 - Agent check-off | 4 | Shipped (gate complete 2026-07-26 on a preview built from `7a5d632`) | "We left at 3" records 15:00; a no-time agent check-off stamps as the UI would; visit fields on an unticked item are refused; the change list names the item |

## Global Constraints

Apply to M1-M3 unless an entry says otherwise.

- Column names are `visited_at` (text) and `visit_duration_minutes` (integer). The existing `duration` text column holds the planned estimate and is never read, written, converted, or dropped by Phase 4 (Req 1.3).
- `visited_at` is `'YYYY-MM-DD HH:mm'` local to `trips.timezone`. Never `timestamptz`, never UTC, never ISO-8601 with a `T`.
- The stamp rule has exactly one definition, `stampIfDuringTrip` in `src/services/visitRecord.ts`. Do not re-derive "now in the trip's zone", add a second date formatter, or compare dates any other way (Req 2.4, 4.3).
- Invariant 5: `visitRecord.ts` joins the modules shared with `api/`, so any module reachable from `api/` uses relative imports with explicit `.js` extensions, no `@/` aliases, and no browser globals.
- Invariant 2: visit writes go through the module-scope visit mutation, never a raw `useMutation` with inline callbacks.
- Visit columns are written sparsely. `VISIT_COLUMNS` stays outside `ACTIVITY_COLUMNS` because the browser's item editors write that set densely and would null a visit record; the agent appends it to its `patchDefs`. `CREATE_FIELDS` is unchanged, since a created item is never done and can carry no visit record.
- The migration must reach the database before the frontend deploy that reads the columns. The change is additive, so a rolled-back frontend degrades to hiding visit data rather than breaking.
- Ordering keys come from the domain `order` field, never from array position. The merged visited order is total and deterministic (Req 3.6): `visited_at`, then `order`, then kind with activities before waypoints, then `activity_id`. The two tables number `sort_order` independently, so `0` collides routinely.
- The visit form is the one editor ungated on `useOnlineStatus` (Req 5.1). `ActivityListItem` and `WaypointListItem` own `onLogVisit`; no `isOnline ?` wrapper may be added around it. Drag stays disabled offline in the planned list and is absent in the visited section (Req 3.4).
- The map, timeline, and trip library keep reading the full stop lists from `tripData` (Req 3.10).
- Invariant 6: the agent's surface mirrors the client's. The UI rule "the visit form is offered only on done items" (Req 2.5) is the server-side guard in Req 4.5.

## Implementation Plan

### M1 Task 1: Schema, row types, and mappers

Added the two nullable columns to `activities` and `scenic_waypoints` in `20260726120000_visit_records.sql`; nothing existing is converted or dropped. The mappers now carry both fields, the waypoint `order`, and the trip's stored `start_date`/`end_date` into the domain types, because the stamp rule and the merged ordering need them. The column defs live in a separate `VISIT_COLUMNS` rather than `ACTIVITY_COLUMNS`: the item editors write `ACTIVITY_COLUMNS` densely, so a shared def would have nulled every visit record on the next edit (pinned by a regression test in `entityRows.test.ts`).

```sql
alter table activities       add column visited_at             text;
alter table activities       add column visit_duration_minutes integer;
alter table scenic_waypoints add column visited_at             text;
alter table scenic_waypoints add column visit_duration_minutes integer;
```

### M1 Task 2: The shared `visitRecord` module

`src/services/visitRecord.ts` is the one place that knows what "now, in the trip's timezone" means. `formatTripLocal` pins locale, calendar, numbering system, and hour cycle so browser and Node render the same ASCII string; `stampIfDuringTrip` returns a stamp only when the trip-local date falls inside the stored range, and null when any input is missing; `isValidTripLocal` rejects impossible calendar values. It is pure and `api/`-safe so M3's agent tools call the same functions, and `now` is always a parameter so tests need no clock mocking.

### M1 Task 3: Trip timezone correction

Added `timezone` to `TRIP_METADATA_COLUMNS`, which carries it to both the browser metadata mutation and the agent's `update_trip_metadata`, plus an IANA timezone field on `TripMetadataFormModal` validated by `isValidTimeZone`. Without it a TripIt-imported trip keeps the importing device's zone and silently stamps every visit in the wrong one. `isValidTimeZone` replaced the identical `isIanaTimezone` in `tripFileSchemas.ts` instead of shipping a second copy.

### M1 Task 4: The visit write contract at module scope

`src/lib/visitMutation.ts` holds the whole write contract with no React in scope: pure `applyVisitPatch` and `revertVisitPatch`, the mutation defaults (`mutationFn`, `onMutate`, `onError`, `onSettled`), and the `onVisitWriteError` emitter, so a mutation rebuilt by hydration after a restart runs the same code as a live one. `writeVisitFields` in `tripWrites` replaced `setActivityDone`/`setWaypointDone`; it selects the id back and throws when no row matched, because PostgREST reports an update matching nothing as success and a replayed offline write would otherwise vanish silently. `revertVisitPatch` restores only the fields the failed write set, and only where its value still stands, so a failing tick cannot undo a note queued behind it (Req 5.5).

### M1 Task 5: Registration, restart resume, and the toast bridge

`registerMutationDefaults` (imported for side effect by `main.tsx`) registers the visit defaults on the shared `queryClient`, `PersistQueryClientProvider` calls `resumePausedMutations` on restore, and the cache `buster` moved to `phase4-v1`. `ToastProvider` subscribes to `onVisitWriteError` so a resumed write, which runs outside React, still surfaces a retry toast. Without these wirings a write queued offline is persisted to IndexedDB and never runs again (Req 5.3). The retry toast stays until dismissed or retried, since it carries the only route back to a rolled-back visit.

### M1 Task 6: DurationInput and VisitDetailsModal

`DurationInput` (hours and minutes boxes over one minutes value) holds typed state, so clearing both boxes means "no duration" rather than `0`. `VisitDetailsModal` (date, time, duration, notes, prefilled from stored values) sits over the existing `ItemModalShell`. Its date input deliberately carries no `min`/`max`: the shell submits through a native `<form>`, so a violated constraint would block the out-of-range save Req 2.9 requires to succeed.

### M1 Task 7: Per-item containers, the hook, and card rendering

`useVisitRecord(itemId)` is a thin `useMutation` carrying only the constant key and a per-item `scope`, so a tick and a details save queued offline against one item run in order instead of racing. `ActivityListItem` and `WaypointListItem` own the hook and the modal state, stamp on tick through `stampIfDuringTrip`, and pass `onLogVisit` only on done items; the cards render the stored time and formatted duration. Neither container gates the checkbox or `onLogVisit` on `useOnlineStatus` (pinned by a regression test), and `TripPage.handleItemDone` kept only the celebration check.

### M1 Task 8: Import and export fields

`tripFileSchemas.ts` accepts optional `visited_at` (refined with `isValidTripLocal`) and `visit_duration_minutes` (non-negative integer) on both item schemas and carries them through `toTripData`. Export serialises mapper output and needed no change; files without the fields import exactly as before (Req 1.7, 1.8).

### M1 Task 9: M1 verification gate

Manual verification against a Vercel preview with the migration pushed first (`supabase db push --linked`, per the Phase 2 ordering rule): the stamp both ways, a trip zone differing from the device, the out-of-range save, offline capture with tab-restart survival, and the failure path. Steps 1-4 passed on the first run; the offline and failure steps failed, were fixed, and passed on production `d85e29e2`, which signed M1 off. See the Changelog.

### M2 Task 1: Partition and reorder helpers

Two pure functions in `src/utils/tripUtils.ts` carry the whole rule. `partitionByVisit` splits both item lists on `is_done` and merges the done ones into day groups under the total order (undated items form a final group in plan order). `applyPlannedOrder` folds a drag over the planned subset back into a full-list id order by substituting into the slots those items already held, and `formatVisitDay` renders day headings with a pinned locale.

### M2 Task 2: Id-based reorder

Changed `onReorder` from `(fromIndex, toIndex)` to the reordered planned ids, because drag now covers only a subset and an index into it means nothing to the write that renumbers the whole stop. `TripPage.handleActivityReorder` runs the ids through `applyPlannedOrder`, so visited items keep their `sort_order` slots and an untick returns an item to its original position. It landed while the lists were still whole, so it was behaviour-neutral and reviewable alone.

### M2 Task 3: The visited section and the panel split

`ActivitiesPanel` feeds the planned halves from `partitionByVisit` to the existing drag lists and counts only those, and a new collapsible `VisitedSection` renders the day groups with the same item containers and no `DndContext` (Req 3.4). New items are still numbered off the full arrays so their `sort_order` clears the visited ones. `VisitedSection` is its own file because the panel was already 626 lines.

### M2 Task 4: M2 verification gate

Manual verification on a Vercel preview (no migration involved): day-grouped headings in date and time order, an activity and a waypoint interleaved in one chronology, the undated group last, the drag rules, an untick returning to its slot, and the map, timeline progress, and library unchanged. Steps 1-5 passed on the preview; the map-pin check was blocked by a Maps referer restriction on the preview hostname and completed on production (`63234b12`).

### M3 Task 1: Widen the item pre-read into `fetchItemContext`

The name lookup that `update_*` and `delete_*` already ran before every write became `fetchItemContext`, which also returns the item's `is_done` and the owning trip's `timezone`, `start_date`, and `end_date` through the stop in the same round trip. That feeds the shared stamp rule and the not-done guard with no second query and no context object threaded through `AgentTool`, and it resolves correctly on library-scoped runs where no trip is prefetched. Behaviour-neutral: the same payload reached Supabase before and after.

### M3 Task 2: Visit fields, the shared stamp rule, and the not-done guard

`update_activity` and `update_waypoint` accept `visited_at` (validated by `isValidTripLocal`, nullable) and `visit_duration_minutes`, and the executor applies the same rules as the browser toggle: an untick clears the stamp, a tick without a supplied time gets `stampIfDuringTrip`, and a supplied time wins. A write that sets a visit field on an item that is not done, without `done: true` in the same call, is refused with a tool error naming the item (Req 4.5). The guard keys on the two visit fields only, so ordinary `remarks` edits on planned items still work.

### M3 Task 3: System-prompt clock, trip range, and the visit rule

`buildSystemPrompt` takes an optional `now` and gains the current date and time in the open trip's timezone (UTC on library-scoped runs), the trip's date range, and the done-before-visit rule, so the model can resolve "this morning" and marks items done rather than tripping the guard. A read-through test pins that `get_trip` returns recorded visit fields (Req 4.7). `api/agent.ts` needed no change.

### M3 Task 4: M3 verification gate

Manual verification on a Vercel preview with live-window and past-window test trips: an explicit time, the stamp matching the UI, no stamp outside the window, the not-done guard, the change list, read-back, and a relative expression. The first run exercised a preview that did not contain the M3 commits, so Steps 1, 2, 4, 6, and 7 failed for that reason; the investigation also found that `duration` and `remarks` carried no field descriptions on the item tools, fixed in [plan_phase-3.md](../phase-3/plan_phase-3.md) M3 Task 8. All steps passed on a preview built from `7a5d632`.

## Design Decisions

Cross-cutting decisions live in [design_phase-4.md](design_phase-4.md#design-decisions); the entries below are the plan-level ones.

### M1 - Data model and capture

Two nullable columns are added to `activities` and `scenic_waypoints`; nothing existing is converted or dropped. One pure module, `visitRecord.ts`, owns the wall-clock formatting and the "stamp only during the trip" rule, and is shared with `api/` under invariant 5. The whole visit-write contract - optimistic patch, rollback, retry notification - lives at module scope in `visitMutation.ts` so a mutation resumed from IndexedDB after a browser restart runs the identical code, with a per-item mutation `scope` keeping queued writes ordered.

- The visit form is offered only on done items, so `visited_at` implies `is_done` by construction with no implicit writes to reconcile. M3 adds the matching agent-side guard.
- All mutation callbacks live in `visitMutation.ts` rather than in the hook, because a mutation rebuilt by hydration resolves callbacks only through `getMutationDefaults`. Defining them once removes any chance of the live and resumed paths drifting apart.
- The per-item mutation `scope` exists for a specific sequence: offline, tick an item, then save its details. Both writes queue against the same item, and same-scope mutations run serially.
- No `min`/`max` on the date input. `ItemModalShell` submits through a native `<form>`, so constraint validation would silently block the out-of-range save Req 2.9 requires. The range is helper text and the warning is application code.
- `duration` is untouched. It holds planned estimates that are mostly ranges and prose, which is why the actual duration got its own integer column instead of migrating it.
- Restart survival means queued writes survive closing the tab, not that the app boots offline (Req 5.3). There is no service worker, so a reload while offline fails at the network before React or the persisted cache can start; the manual gate closes the tab offline and reopens it after reconnect. An offline app shell is out of Phase 4 scope.

### M2 - Visited section

Two pure functions in `src/utils/tripUtils.ts` carry the whole rule: `partitionByVisit` splits both item lists on `is_done` and merges the done ones into day groups under a total order, and `applyPlannedOrder` translates a drag over the planned subset back into a full-list id order so visited items keep their `sort_order` slots. `ActivitiesPanel` renders planned activities and planned waypoints exactly as today over the filtered lists, and a new collapsible `VisitedSection` renders the groups with no drag context. No schema change, no new query key, no mutation change.

- **Two pure functions carry the rule.** `partitionByVisit` and `applyPlannedOrder` take plain arrays and return plain data, so every ordering case — colliding `order` values, undated items, an untick returning to its slot — is a unit test rather than a drag simulation.
- **The order is total by construction.** `visited_at` then `order` then kind then id. The last two are not defensive padding: the two tables number `sort_order` independently, so `0` collides constantly, and without the id tie-break the render would depend on the order the two arrays were concatenated in.
- **Reorder speaks ids.** With drag covering only the planned subset, an index into that subset means nothing to a write that renumbers the whole stop. Substituting the reordered ids into the slots the planned items already held leaves visited items' `sort_order` untouched, which is what makes an untick return an item to its original position.
- **`VisitedSection` is its own file and its own collapsible.** `ActivitiesPanel` is already 626 lines; the grouped render is self-contained and testable. Making it collapsible follows the Scenic Waypoints idiom and keeps a long record from pushing the planned list off a phone screen.
- **The counts follow the sections.** `Activities (n)` and `Scenic Waypoints (n)` count what is in them — the planned halves — with the visited total on its own button. A count that included items rendered in a different section would be a lie.
- **Panel order left as shipped.** The design doc lists planned activities, then the waypoints group, then Visited. The shipped panel puts the waypoints group above activities; that order is kept and Visited is appended last. The requirement is that planned sits above visited (Req 3.2), and reshuffling two existing sections is a UI change this milestone was not asked for.
- **The full arrays stay in play.** New activities and waypoints are still numbered off `activities.length` / `scenicWaypoints.length`, so a fresh item's `sort_order` clears the visited ones. The map, timeline, and library keep reading the whole stop from `tripData` (Req 3.10).
- **The drag gesture itself is not unit-tested.** Simulating a dnd-kit pointer drag in jsdom tests the sensor, not this change; the id math is covered by `applyPlannedOrder` and the gesture by the manual gate.

### M3 - Agent check-off

`update_activity` / `update_waypoint` gain `visited_at` and `visit_duration_minutes`, zod-validated against the same `isValidTripLocal` the form uses. The pre-read those tools already run before every write widens from `fetchName` into `fetchItemContext`, pulling the item's `is_done` and the owning trip's `timezone`, `start_date`, and `end_date` through the stop in the same round trip — that is what lets the executor call the shared `stampIfDuringTrip` and enforce the not-done guard without a second query or a context object threaded through `AgentTool`. `systemPrompt` gains the current trip-local date-time and the trip's date range so relative expressions resolve. No schema change, no client change, no new tool.

- **One pre-read, widened.** `update_*` already selected the item's name before every write, so the trip's zone and dates and the item's `is_done` ride along for free. The alternative — threading an agent context object through `AgentTool` and `dispatchTool` — would have touched every tool and still failed on library-scoped runs, where no trip is prefetched.
- **The stamp rule is imported, never re-derived.** `stampIfDuringTrip` is the single definition of "now, in the trip's zone, if the trip is running" (Req 2.4, 4.3). The agent passes `new Date()` at the call site; the function itself never reads a clock, which is why the tests set the system time instead of mocking a module.
- **The guard keys on `visited_at` and `visit_duration_minutes` only.** `remarks` is an ordinary field that also happens to hold the visit note, and the agent has been able to edit it on planned items since Phase 3. Adding it to the guard would break note editing on planned items to enforce a rule about visit records.
- **An untick clears the stamp even if a time was supplied in the same call.** That combination is contradictory, and the untick is the unambiguous half of the request; matching `writeVisitFields`'s behaviour keeps agent and UI unticks identical. Supplied duration and remarks are still written, as the caller asked.
- **`updateById`, not `writeVisitFields`.** The select-back check in `writeVisitFields` exists for writes replayed hours later from an offline queue, where a silent no-op reads as a lost visit. An agent write runs immediately after its own pre-read of the same row, so the extra round trip buys nothing.
- **A default `now` on `buildSystemPrompt`.** Making the parameter required would have forced every existing call site and test to pass a clock for no gain. `api/agent.ts` is untouched.
- **The prompt carries the rule, not just the fields.** Stating the done-before-visit rule means the model marks an item done rather than discovering the guard by tripping it and burning a loop iteration.
- **`CREATE_FIELDS` untouched.** A created item is never done, so it can hold no visit record — the same construction that keeps `visited_at` implying `is_done` everywhere else.

## Critical Files - Summary

| Path | Why it matters |
|------|----------------|
| `supabase/migrations/20260726120000_visit_records.sql` | Must reach production before the frontend that reads the columns. |
| `src/services/visitRecord.ts` | The only definition of trip-local time, the stamp rule, and the shape and timezone validators; shared with `api/`, so a UI check-off and an agent check-off cannot drift apart. |
| `src/services/entityRows.ts` | `VISIT_COLUMNS` must stay outside `ACTIVITY_COLUMNS` or item-editor saves null out visit records; `timezone` joins `TRIP_METADATA_COLUMNS`. |
| `src/services/tripWrites.ts` | `writeVisitFields`: one write for the checkbox and the details form, and it throws when no row matched. |
| `src/services/supabaseMappers.ts` | Carries the visit fields, waypoint `order`, and the trip's stored dates into the domain. |
| `src/lib/visitMutation.ts` | The entire write contract, including the rollback that Req 5.4 and 5.5 depend on. |
| `src/lib/mutationDefaults.ts` + `src/main.tsx` | A few lines that decide whether an offline note survives a restart; `main.tsx` also holds the `phase4-v1` cache buster. |
| `src/components/Layout/Toast.tsx` | Subscribes to the module-scope error emitter; the persistent retry toast lives here. |
| `src/components/Activities/ActivityListItem.tsx` + `WaypointListItem.tsx` | Where the per-item mutation scope comes from, and where the offline carve-out must not be gated. |
| `src/components/Editing/VisitDetailsModal.tsx` | The visit form; no `min`/`max` on the date input by design. |
| `src/components/Editing/TripMetadataFormModal.tsx` | The IANA timezone correction field. |
| `src/schemas/tripFileSchemas.ts` | Validates visit fields on import with `isValidTripLocal`. |
| `src/utils/tripUtils.ts` | The only definition of the visited split and its total order; everything else is wiring. |
| `src/pages/TripPage.tsx` | `applyPlannedOrder` runs here; skip it and a planned drag renumbers visited items, so unticking drops them to the bottom of the plan. |
| `src/components/Activities/VisitedSection.tsx` | No `DndContext`, `isDraggable={false}`: the two things Req 3.4 asks for. |
| `src/components/Activities/ActivitiesPanel.tsx` | Where the planned halves and the counts must stay in step with the sections they label. |
| `api/_lib/tools/items.ts` | The agent's widened pre-read, the three visit rules, and the guard; get `patchDefs` wrong and either the fields never write or the browser's dense saves start nulling them. |
| `api/_lib/tools/tripFields.ts` | `timezone` on `update_trip_metadata`, refined with `isValidTimeZone`. |
| `api/_lib/systemPrompt.ts` | The only source of the model's clock; without it every relative time the user says is unresolvable or wrong. |

## Removed and Replaced

| Path | Change |
|------|--------|
| `src/services/tripWrites.ts`, `src/services/supabaseService.ts`: `setActivityDone`, `setWaypointDone` | Replaced by `writeVisitFields`, one write for both gestures. |
| `src/hooks/useTripMutations.ts`: `useToggleActivityDone` (and its tests) | Removed; the per-item `useVisitRecord` does the write. |
| `src/pages/TripPage.tsx`: `toggleDoneMutation`, `handleActivityToggle` | The mutation was deleted; the handler became `handleItemDone`, a celebration check that no longer writes. |
| `src/schemas/tripFileSchemas.ts`: `isIanaTimezone` | Replaced by `isValidTimeZone` in `visitRecord.ts`; the check was identical, so there is one copy. |
| `api/_lib/tools/items.ts`: `fetchName` | Widened into `fetchItemContext`. |
| `DraggableActivity`, `ActivitiesPanel`, `TripPage`: `onReorder(fromIndex, toIndex)` | Now `onReorder(orderedActivityIds)`; `TripPage` substitutes through `applyPlannedOrder`. |
| `src/components/Activities/DraggableActivity.tsx`: inline `<ActivityCard>` | Replaced by `<ActivityListItem>`; waypoints render through `WaypointListItem`. |

## Changelog

The two entries below are the newest. The milestone logs after them keep their original order, oldest first.

- 2026-10-17 — **Consolidated the per-milestone plans into this file.** `plan_p4m1_data-model-and-capture.md`, `plan_p4m2_visited-section.md`, and `plan_p4m3_agent-check-off.md` are now the M1-M3 tasks above; constraints repeated across them were deduplicated into Global Constraints and their File Structure tables folded into Critical Files. Originals recoverable via git history.
- 2026-10-17 — **Compacted post-implementation.** Removed step-by-step tasks, file-by-file diffs, code snippets, test-case lists, and verification commands now that the feature has shipped. Preserved Goal, Design Decisions, Critical Files summary, and the milestone changelogs. Task intents describe the shipped behaviour where the original snippets had drifted from it (see the M1 entries below). Original plans recoverable via git history.

### M1 - Data model and capture

- 2026-07-26: Initial plan, written from [requirements_phase-4.md](requirements_phase-4.md) and [design_phase-4.md](design_phase-4.md) after the design review.
- 2026-07-26: Tasks 1-8 implemented on `feat/p4m1-visit-records`. Full suite green (60 files, 541 tests); `tsc -b` and the production build clean.

  Two plan corrections, both made deliberately:
  - **Task 1 Step 6 reversed.** Adding the visit columns to `ACTIVITY_COLUMNS` would have destroyed visit records: `updateActivity` writes that set densely (`denseRow`), and `ActivityInput` carries no visit keys, so every save from the item editor would have nulled `visited_at` and `visit_duration_minutes`. They now live in a separate `VISIT_COLUMNS`, mirroring how `ITEM_DONE_COLUMN` is already held out of the dense set. M3 appends it to the agent's patch defs. Pinned by a regression test in `entityRows.test.ts`.
  - **`DurationInput` holds typed state** rather than re-deriving hours/minutes from the total. The plan's version redisplayed a `0` the moment the hours box was cleared, and clearing both boxes emitted `0` minutes instead of `undefined` - so "no duration" was unsayable once either box had been filled.

  Smaller deviations: `isValidTimeZone` replaced the identical `isIanaTimezone` already in `tripFileSchemas.ts` instead of shipping a second copy; the toast's Retry rebuilds the mutation with its per-item `scope`, which the plan's snippet dropped; no `src/components/Editing/index.ts` barrel was added, since that folder has none and siblings import directly.

  **Task 9 not run.** It needs `supabase db push` against a real database and browser interaction against a preview deploy; Docker was not running locally. The migration is written but has been applied nowhere. Automated coverage stands in for parts of it: both stamp directions, the trip-zone-differs-from-device case, the out-of-range save through the real Save button, offline affordance, dehydrate/hydrate resume, and post-restart rollback-and-notify. Steps 1-6 of Task 9 remain outstanding, and the migration must reach the database before the frontend deploy.

- 2026-07-26: Task 9 verification run against Vercel preview `wanderlog-5uualddp1-kevin-lins-projects-835b030f.vercel.app` after `supabase db push --linked` applied `20260726120000_visit_records.sql`. Steps 1-4 passed: the linked migration finished despite the post-apply Docker catalog-cache warning; an active-trip tick showed `11:36` in `America/Los_Angeles` while the device was in Singapore; a past-trip tick showed no time; and an out-of-range visit showed the warning, saved, and survived a fresh reload.

  Steps 5-6 failed and remain unchecked:
  - **Offline restart survival:** the offline tick and note appeared optimistically, but reloading offline showed Chrome `ERR_INTERNET_DISCONNECTED`. After reconnect, the note reached Supabase while the queued checkmark was lost.
    - **Confirmed cause of the offline reload failure:** the repository has no service worker or PWA app-shell cache. `PersistQueryClientProvider` can restore query and mutation state from IndexedDB only after the HTML and JavaScript application have loaded. A hard reload of the Vercel URL while offline therefore fails before React or the persisted cache can start.
    - **Queued checkmark loss not yet isolated:** the async-storage persister uses its default 1-second write throttle and has no explicit flush on tab close. The existing resume tests directly call `dehydrate`/`hydrate` with one handcrafted paused mutation, so they do not cover the real IndexedDB timing, a browser restart, or the two same-scope writes used by this scenario (tick, then note). The manual result proves a durability gap, but does not establish which queued-mutation snapshot was lost.
  - **Failure path:** blocking `*supabase.co/rest/v1/*` reverted the optimistic checkmark, then the invalidated trip refetch replaced the card with `Adventure Data Unavailable: TypeError: Failed to fetch`; no retry toast was present.
    - **Confirmed cause of the full-page error:** `visitMutation.onError` correctly restores the item snapshot, but `onSettled` then unconditionally invalidates the trip query. That refetch uses the same blocked Supabase REST endpoint. `useTripData` exposes any query error even when cached trip data exists, and `TripPage` gives that error precedence over the cached data by returning the full-screen error state.
    - **Retry toast gap not yet isolated:** the error listener is emitted in `onError`, and `ToastProvider` subscribes to it, but the manual run did not show a usable toast before the trip changed to the error screen. The resume test asserts only that the listener fired; it does not mount `ToastProvider` or verify toast visibility and Retry behavior during a failed invalidation. A browser-level regression test is needed to determine whether the 4-second toast expired during the transition or was never rendered.

- 2026-07-26: Steps 5-6 investigated and the code fixed; both still need a manual re-run to be checked off.

  What the queue does, established by tests rather than inference. Two writes queued for one item through the real pause path now go through `persistQueryClientSave`/`Restore` and `resumePausedMutations`, and both land in order (`visitQueueDurability.test.ts`). A resumed write also survives a trip refetch that was issued before it and answers after it with pre-write data (`visitResumeOnBoot.test.tsx`). So the queue is not where the checkmark went, and the earlier suspicion of the persister's write throttle is not supported.

  Four fixes:
  - **Full-screen error on a failed background refetch** (the confirmed cause of the step 6 failure). `TripPage` showed `error` ahead of cached data, and every failed visit write invalidates the trip, so the refetch failing on the same dead connection took the whole trip off screen and buried the toast. It now shows that state only when there is no cached trip.
  - **A rollback could undo a later queued edit.** `revertVisitPatch` restored all four fields from the failed write's snapshot, so a failing tick wiped the note queued behind it - Req 5.5's second half, and the design's own test case, which had never been written. It now restores only the fields that write set, and only where its value still stands. The failing test came first.
  - **A visit write that matched no row counted as success.** PostgREST answers an update matching nothing with no error and no rows. Replay a queued write hours later against a row that is gone, or one RLS no longer shows, and the mutation settles as success; the invalidated refetch then drops the value. No rollback, no toast - the symptom the run reported. `writeVisitFields` now selects the id back and throws when nothing returns. This is the one fix aimed at a cause that was never isolated in the browser, and it turns that whole class of silent loss into the rollback-and-retry path.
  - **The retry toast auto-dismissed after 4 seconds.** It carries the only route back to a rolled-back visit and often lands mid-reload after a restart. It now stays until dismissed or retried, covered by a test that mounts `ToastProvider`, fails a real write, and clicks Retry.

  Step 5's procedure was wrong, not just its result: it asked for a reload while offline, which needs an app-shell cache the repo does not have. Req 5.3 requires queued writes to survive a restart, not an offline boot. The step now closes the tab offline and reopens after reconnect; an offline app shell stays out of Phase 4 scope.

  All verification edits were restored and confirmed from fresh reads: Singapore trip dates/timezone, Bird Paradise and Dragon Bridge status/stamps, and Singapore Zoo remarks. M1 is not signed off until Steps 5 and 6 pass.

- 2026-07-26: Steps 5-6 re-verified against production deployment `d85e29e2` at `wanderlog-xi.vercel.app`; both passed and M1 is signed off.

  - **Step 5:** while offline, the Singapore Zoo tick and test note both appeared optimistically. The tab was closed while the writes were queued, then reopened online. Both values reached Supabase and remained present after a second fresh reload.
  - **Step 6:** while offline with `*supabase.co/rest/v1/*` blocked, the Food Republic tick and test note appeared optimistically. On reconnect, both rolled back to their prior values, the trip stayed visible, and the Retry toast remained present beyond its former 4-second timeout. After request blocking was disabled, a fresh reload confirmed that no Step 6 test data reached Supabase.

  Singapore Zoo was restored to its original note and unchecked state. The final fresh read confirmed both test items matched their original server values.

### M2 - Visited section

- 2026-07-26: Initial plan, written from [requirements_phase-4.md](requirements_phase-4.md) Requirement 3 and [design_phase-4.md](design_phase-4.md), against the code shipped by M1.
- 2026-07-26: Tasks 1-3 implemented on branch `worktree-p4m2-visited-section`. Suite green at 65 files / 567 tests, `tsc -b` clean, Ultracite clean.

  Two corrections to the plan as written:

  - Task 3's `renderPanel` helper re-applied `QueryClientProvider` by hand on `rerender`, on the premise that RTL skips the wrapper. RTL 16.3 does re-apply it (`rerender` passes `wrapper: WrapperComponent` straight back into `renderRoot`), so the hand-applied provider double-wrapped, changed the element type at that position, and remounted the panel, discarding the expand state the test had just set. The helper now passes the bare element and lets RTL wrap it.
  - The `@/hooks/useWeather` mock needed `useWeatherDisplay` as well: `WeatherCard` renders inside the expanded activities section and calls it.

  Task 1 has ten cases, not the twelve Step 4 claims. `applyPlannedOrder` avoids `queue[next++]` because Ultracite rejects the increment operator.

  **Task 4 (manual gate) not run** — it needs an authenticated account on a Vercel preview. What the automated suite does establish: day-grouped headings in date order with items in time order, an activity and a waypoint interleaved by time in one visited list, the waypoint gone from the Scenic Waypoints group and its count, the undated group rendering last as "Time not recorded", exactly one drag handle across a planned-plus-visited render, an item moving between sections when it becomes done, and `applyPlannedOrder` leaving a visited item in its held slot. Still open and browser-only: that a real drag gesture persists across a reload (Step 4), that an untick end-to-end returns the item to its original position (Step 5), and the visual confirmation that the map, timeline, and library are unchanged (Step 6).

- 2026-07-26: Task 4 manually verified on authenticated Vercel preview [wanderlog-2bwf1phl1-kevin-lins-projects-835b030f.vercel.app](https://wanderlog-2bwf1phl1-kevin-lins-projects-835b030f.vercel.app). Steps 1-5 passed: dated groups rendered in date and time order; an activity and waypoint shared one chronology; the undated item rendered last under "Time not recorded"; a keyboard drag persisted across reload with no visited drag handles; and an unticked item returned to its held slot. For Step 6, timeline progress included visited items and the trip library was unchanged. Map-pin verification is deferred because Google Maps rejected the preview hostname with `RefererNotAllowedMapError`; Step 6 remains open. The full automated suite passed at 65 files / 567 tests. All temporary verification data, completion states, and activity ordering were restored afterward.

- 2026-07-26: Step 6 completed on the production alias [wanderlog-xi.vercel.app](https://wanderlog-xi.vercel.app) after deployment of `63234b12`. Marking Red House Seafood Esplanade visited left its map pin present, changed Mandarin Oriental Singapore timeline progress from `0 of 7 done` to `1 of 7 done`, and left the five trip-library entries unchanged. The item was unticked afterward; timeline progress returned to `0 of 7 done` and the Visited section disappeared. Task 4's verification gate is complete.

### M3 - Agent check-off

- 2026-07-26: Initial plan, written from [requirements_phase-4.md](requirements_phase-4.md) Requirement 4 and [design_phase-4.md](design_phase-4.md), against the code shipped by M1 and M2.
- 2026-07-26: Tasks 1-3 implemented on branch `worktree-p4m3-agent-check-off`. Suite green at 65 files / 587 tests, `tsc -b` clean, Ultracite clean. Task 1 landed as written; the pre-read is one round trip returning the item's `is_done` and the trip window.

  One correction to the plan as written: Task 3 Step 4 gives the import as `'../src/services/visitRecord.js'`, but `systemPrompt.ts` sits in `api/_lib/`, so the correct specifier is `'../../src/services/visitRecord.js'` — matching the existing `'../../src/types/trip.js'` import in the same file.

  Two notes on the tests: `vi.setSystemTime` works without `vi.useFakeTimers()` under Vitest 4, so the Task 2 cases run as written. The Task 3 "carries recorded visit data in the embedded trip" case passed before the implementation, as the plan predicted, since the prompt already embeds the whole trip.

  **Task 4 (manual gate) not run** — it needs `vercel dev` or an authenticated Vercel preview plus a live trip whose dates include today. What the automated suite establishes: the stamp applied inside the trip window and skipped outside it, an explicit `visited_at` overriding the stamp, an untick clearing the stamp, the not-done guard refusing a write for both activities and waypoints, ordinary `remarks` edits still allowed on planned items, zod rejecting a malformed `visited_at` and a fractional or negative duration, the change list naming the item as an `updated` change, the prompt's trip-local clock and date range with a UTC fallback, and `get_trip` returning recorded visit fields. Still open and browser-only: that the model actually resolves "we left at 3" and "an hour ago" against the prompt clock, that an agent-recorded time and a checkbox-recorded time land in the same zone and shape, that the agent-marked item lands in the "Time not recorded" group outside the window, and the read-back answer preferring `visit_duration_minutes` over the planned `duration` text.

- 2026-07-26: Task 4 was run against Vercel preview `wanderlog-6u57pm3m4-kevin-lins-projects-835b030f.vercel.app` with temporary live-window and past-window trips under the test account. Steps 3 and 5 passed. The past-trip check-off wrote no time and rendered under "Time not recorded"; every agent mutation appeared in the change list as `Updated: <item>`.

  Steps 1, 2, 4, 6, and 7 failed and remain unchecked. "We left at 3" became the remark `Left at 3` and wrote no `visited_at`. A no-time agent check-off also wrote no `visited_at`, while the UI checkbox recorded `2026-07-26 12:24` in `Asia/Singapore`. "We spent 90 minutes" changed the planned `duration` text from `planned 4 hours` to `90 minutes` instead of writing `visit_duration_minutes`. Read-back then treated that planned text as an actual duration and summed it with a separately seeded 90-minute visit record. "An hour ago" marked the item done but wrote no time. A diagnostic read-only prompt also claimed the agent had no live clock despite the new prompt clock section.

  Step 8 passed. Both temporary trips were deleted, and fresh Supabase reads returned zero matching trip rows and zero matching activity rows. The M3 verification gate is not complete.

- 2026-07-26: Investigated the five failures. **The preview did not contain the M3 commits**, so the gate exercised pre-M3 code:

  - `git ls-remote --heads origin` had no `worktree-p4m3-agent-check-off`; the branch was never pushed.
  - `origin/main` was `38821b44`, this plan's own commit, with no M3 code in it.
  - `.github/workflows/vercel-deploy.yml` builds previews on push only, and the `.vercel` project link lives in the main checkout, not in this worktree, so a CLI deploy uploaded main's tree either way.
  - Locally, `toAnthropicTools(ACTIVITY_TOOLS)` emits `visited_at` and `visit_duration_minutes` with their descriptions intact, and the prompt tests pin the clock section. Neither could be absent from a build containing M3.

  Every failure matches pre-M3 behaviour exactly: with no `visited_at` field in the tool schema the model puts "we left at 3" in `remarks`; with no `visit_duration_minutes` it writes `90 minutes` over the planned `duration`; with no `resolveVisitPatch` a `done: true` write carries `is_done` alone; with no clock section the model correctly reports having no clock. Steps 3 and 5 passed because they also pass on pre-M3 code — Step 3 recorded no time for the wrong reason. No code defect accounts for the transcript; a build without M3 accounts for all of it.

  One real defect surfaced anyway, and it survives a redeploy: `duration` and `remarks` carried no `.describe()`, so nothing in the contract told the model that `duration` is the plan rather than the actual time spent, and nothing told it to read back from `visit_duration_minutes`. Fixed as [plan_phase-3.md § M3](../phase-3/plan_phase-3.md#m3-generative-creation) Task 8, since the tool-schema contract is that milestone's: descriptions on both fields, a planned-versus-actual rule in `CORE_RULES` covering the read-back direction, and a new `describe('the schema the model receives')` block asserting against `toAnthropicTools` output — closing a hole where `toAnthropicTools` was only ever tested on `READ_TOOLS`, so an undescribed or dropped write-tool field had no test that would fail. Suite at 65 files / 591 tests, `tsc -b` clean, Ultracite clean.

  Steps 1, 2, 4, 6, and 7 stay unchecked. Re-running them needs a preview built from this branch's HEAD; confirm the deployment's commit SHA before trusting the result.

- 2026-07-26: Re-ran the previously failed Task 4 steps against Vercel preview `wanderlog-v8fs5fio1-kevin-lins-projects-835b030f.vercel.app`, deployed from branch HEAD `7a5d632656e212675f0f5db63491ba66652dcb2d`. A read-only prompt returned the injected trip-local clock (`2026-07-26 12:58 PM`, `Asia/Singapore`), confirming that the preview contained the M3 prompt rather than the earlier pre-M3 build.

  Steps 1, 2, 4, 6, and 7 passed. "We left at 3" recorded `visited_at = 2026-07-26 15:00` and preserved the planned duration. A no-time agent check-off and a UI checkbox check-off both recorded `2026-07-26 12:59` in the same shape and zone. "We spent 90 minutes" marked the item done, recorded `visit_duration_minutes = 90`, stamped `visited_at = 2026-07-26 12:59`, and preserved `duration = planned 4 hours`. Read-back reported the four completed items at their recorded times and used only the 90-minute actual duration, ignoring planned duration text. "An hour ago" at 13:00 trip-local time recorded `visited_at = 2026-07-26 12:00`. The agent summaries and change lists named each updated item.

  Fresh Supabase reads confirmed the exact persisted values before cleanup. The temporary trip was then deleted, and fresh reads returned zero matching trip rows and zero matching activity rows. The full automated gate also passed at 65 files / 591 tests, with Ultracite clean, `tsc -b` clean, and the Vite production build successful. All Task 4 steps are complete.
