# Review: Wanderlog Phase 4 Design

## Scope

Reviewed:

- [requirements_phase-4.md](requirements_phase-4.md)
- [design_phase-4.md](design_phase-4.md)
- The Phase 2 editable-journal requirements and design
- The Phase 3 agent-mode requirements and design
- The current query, mapper, import, editing, panel, and agent boundaries referenced by the design

## Verdict

Changes requested. The main architecture is sound: the shared stamp rule, expand/backfill/contract migration, planned/visited split, and keyed persisted mutation are the right directions. The design is not implementation-ready yet because several required behaviors lack a viable data source or conflict with the current browser and mutation behavior.

## Findings

### P1: The browser and scoped agent prompt do not have the trip dates required by the stamp rule

Phase 4 Req 2.2 and 2.3 require comparison against the stored `trips.start_date` and `trips.end_date`. The design says the checkbox uses the cached trip's timezone and dates, and the agent system prompt also needs those dates. But the proposed domain change only adds fields to `Activity` and `ScenicWaypoint`. `TripData` currently has `timezone` but no top-level `start_date` or `end_date`, and `toTripData` discards both columns. The trip-scoped agent context is built from that same mapper.

This is especially important offline. A persisted detail query may exist without a persisted trip-library summary, so relying implicitly on `TripSummary` would make offline stamping dependent on unrelated cache history.

Required design change:

- Define the source of `{ timezone, startDate, endDate }` for both browser and server paths.
- Prefer carrying the stored dates in the detailed trip domain/mapping, or define a separate persisted temporal context returned by the detail query. Do not derive them from stops because the requirement explicitly names trip metadata and stop dates can temporarily differ.
- Specify how the agent prompt receives the same values before `buildSystemPrompt` runs.
- Add a test where only the detail query is hydrated offline and a check-off still applies the correct in-range rule.

Evidence: [design_phase-4.md lines 42-54](design_phase-4.md#L42), [design_phase-4.md lines 85-92](design_phase-4.md#L85), [requirements_phase-4.md lines 48-55](requirements_phase-4.md#L48), [src/types/trip.ts lines 16-27](../../../src/types/trip.ts#L16), [src/services/supabaseMappers.ts lines 199-206](../../../src/services/supabaseMappers.ts#L199).

### P1: Native `min` and `max` constraints would block the required out-of-range save

The design assigns the trip dates to the date input's `min` and `max` while also requiring an out-of-range value to save with only a warning. `VisitDetailsModal` is designed on top of `ItemModalShell`, which uses a native `<form>` submit. Browser constraint validation prevents that submit event when a date input violates `min` or `max`, so the stated behavior cannot be achieved as written.

Required design change:

- Either omit native `min` and `max` and implement the range hint and warning in application code, or explicitly disable native form validation and reproduce the intended validation accessibly.
- Add an interaction test that enters an out-of-range date, clicks the real Save button, observes the warning, and verifies that the mutation still runs. Calling the submit handler directly would not catch this failure.

Evidence: [design_phase-4.md lines 122-130](design_phase-4.md#L122), [requirements_phase-4.md lines 52-57](requirements_phase-4.md#L52), [src/components/Editing/ItemModalShell.tsx lines 26-34](../../../src/components/Editing/ItemModalShell.tsx#L26).

### P1: The resumed-mutation failure path does not define the required rollback

The current `useTripCacheMutation` snapshots the full `TripData` and closes over React's toast API. The Phase 4 design says `useVisitRecord` composes that helper, but then changes the context to four prior fields and moves resumed callbacks into module-level mutation defaults. Those are different callback and context contracts.

The proposed module-level `onError` only says it emits variables for a retry toast. It does not say how it restores the four prior values in the hydrated query cache. `onSettled` invalidation is not the existing optimistic rollback, and it can leave the optimistic value visible if the refetch also fails. This does not fully cover Phase 4 Req 5.4.

Required design change:

- Specify the refactor to `useTripCacheMutation`, including support for `mutationKey`, the serializable context shape, and callbacks shared by live and hydrated executions.
- Define a pure cache rollback function that the module-level default `onError` calls before emitting the retry notification.
- Define ordering for multiple paused writes to the same item, so an earlier failure cannot restore values over a later optimistic edit. A mutation scope keyed by item, or an equivalent revision check, would make this deterministic.
- Test cache contents after a resumed failure, not only that the emitter fired.

Evidence: [design_phase-4.md lines 83-105](design_phase-4.md#L83), [requirements_phase-4.md lines 91-95](requirements_phase-4.md#L91), [src/hooks/useTripCacheMutation.ts lines 14-46](../../../src/hooks/useTripCacheMutation.ts#L14).

### P1: TripIt timezone errors can corrupt the core timestamp and have no stated repair path

The error table says a wrong TripIt timezone can be fixed through trip-metadata editing and calls this a known risk in the requirements. Neither statement matches the current contract. Phase 4 requirements do not name this risk, and the shipped trip metadata form and write patch do not expose `timezone`.

TripIt imports currently use the importing device's timezone. A trip imported in Singapore for Zurich will therefore auto-stamp Zurich visits in Singapore time unless the timezone can be corrected. That makes the core visit chronology wrong while appearing valid.

Required design change:

- Add an IANA-timezone correction path to trip metadata, including validation and the shared browser/agent write mapping, or make correct timezone resolution a Phase 4 prerequisite with a migration/report for existing trips.
- Remove the inaccurate claim that the risk is already documented and repairable.
- Verify a TripIt-created trip whose destination timezone differs from the import device.

Evidence: [design_phase-4.md lines 144-154](design_phase-4.md#L144), [src/components/Editing/TripMetadataFormModal.tsx lines 12-43](../../../src/components/Editing/TripMetadataFormModal.tsx#L12).

### P2: The duration conversion contract is undefined for the data that will be migrated

The design establishes one parser but does not define its accepted grammar or how a range becomes one integer. The checked-in trip data contains values such as `1-2 hours`, `1.5–2.5h`, `45–90m`, `1h 45m–2h cruise (+stops)`, `Flexible`, and `Full day`. The integer model requires an explicit policy for ranges and approximate values. Without one, the backfill and old-file import can make different judgment calls or turn most existing durations into null before the source column is dropped.

The rename also affects more surfaces than the design lists. Current map hover cards read `duration`, and POI creation writes range strings such as `1-2 hours` and `30 mins - 1 hour`. Saying the map is untouched does not resolve those callers.

Required design change:

- Document the parser grammar, normalization, range policy, rounding rule, maximum value, and examples of values intentionally treated as unparseable.
- Inventory the repository's distinct duration values and make the expected conversion report part of the migration review gate.
- List every domain consumer and producer that moves to minutes, including map hover content, POI defaults, validation utilities, fixtures, and agent trip creation.
- Do not run the contract migration until the backfill report and a zero-old-column-read/write check pass.

Evidence: [design_phase-4.md lines 13 and 46-81](design_phase-4.md#L13), [requirements_phase-4.md lines 34-41](requirements_phase-4.md#L34), [src/components/Map/PlaceHoverCard.tsx lines 73-81](../../../src/components/Map/PlaceHoverCard.tsx#L73), [src/components/Map/MapContainer.tsx lines 885-927](../../../src/components/Map/MapContainer.tsx#L885).

### P2: Non-blocking import warnings have no field-path transport

Req 1.7 requires an unparseable duration to import as null and appear in the preview's per-field messages without blocking. The design says this uses the existing per-field message list, but the current success preview carries `warnings: string[]`; only blocking errors use `{ path, message }`. The proposed schema and `toTripData` signatures also have no warning accumulator.

Required design change:

- Define a structured warning type, preferably the existing `ImportIssue`, on successful previews.
- Specify which conversion layer records paths such as `stops[2].activities[4].duration` while returning usable trip data.
- Verify that the preview renders the path and still enables Import.

Evidence: [design_phase-4.md lines 71-81](design_phase-4.md#L71), [requirements_phase-4.md lines 39-40](requirements_phase-4.md#L39), [src/services/tripImportService.ts lines 9-22 and 68-99](../../../src/services/tripImportService.ts#L9).

### P2: Undated mixed activity/waypoint ordering is not fully defined

The visited section merges activities and scenic waypoints, then orders undated items by `sort_order`. Today activities expose their order in the domain model, but scenic waypoints do not, even though their database rows have `sort_order`. In addition, the two tables have independent order sequences, so an activity and waypoint can both have order zero. The proposed `partitionByVisit` return type does not define a source-order field or a deterministic tie-breaker.

Required design change:

- Carry waypoint order through the mapper/domain, or pass the source array index explicitly into the partition function.
- Define the total ordering for equal `sort_order` values across the two item types. Include a stable final tie-breaker so rendering does not depend on JavaScript input concatenation details.
- Add tests for several undated activities and waypoints with colliding order values.

Evidence: [design_phase-4.md lines 107-120](design_phase-4.md#L107), [requirements_phase-4.md lines 64-72](requirements_phase-4.md#L64), [src/types/map.ts lines 8-24](../../../src/types/map.ts#L8), [src/services/supabaseMappers.ts lines 150-160](../../../src/services/supabaseMappers.ts#L150).

### P2: The design does not state the invariant between `is_done` and visit details

The form writes only `visited_at`, `duration_minutes`, and `remarks`. The agent update tool also accepts those fields independently from `done`. Unless the visit affordance is restricted to completed items, a user or agent can write a visit timestamp while leaving `is_done = false`; the item then stays in Planned even though it carries a visit record. The requirements frame visit details as an extension of check-off, but the design never states how this state is prevented or rendered.

Required design change:

- Choose and document one rule: the form is available only for done items, saving visit details also marks the item done, or a timestamp on a planned item is an allowed state with defined rendering.
- Apply the same rule in the agent executor and system prompt.
- Cover the chosen behavior in UI and tool tests.

Evidence: [design_phase-4.md lines 85-94 and 122-142](design_phase-4.md#L85), [requirements_phase-4.md lines 43-58](requirements_phase-4.md#L43).

### P2: `Intl.DateTimeFormat` needs explicit locale-independent options

Passing only `timeZone` does not make `formatToParts` deterministic across browser and Node locales. Digit systems and midnight hour cycles can differ, including output such as `24:05`. That can violate the promised ASCII `YYYY-MM-DD HH:mm` shape and make browser and agent stamps differ.

Required design change:

- Specify a fixed Gregorian calendar, Latin numbering system, and `hourCycle: 'h23'`, with explicit two-digit parts.
- Validate real calendar/time values, not only the string shape, for form and agent input.
- Test midnight, a non-Latin runtime locale, and both sides of a daylight-saving transition in a timezone that observes DST.

Evidence: [design_phase-4.md lines 11-12 and 46-56](design_phase-4.md#L11), [requirements_phase-4.md lines 34 and 49-51](requirements_phase-4.md#L34).

## What is already strong

- The expand/backfill/contract migration preserves a useful rollback window.
- One pure stamp module is the correct way to keep browser and agent check-offs aligned.
- Keeping the visit form separate from Maps-dependent editors is a good fit for offline capture.
- Preserving visited activity slots while reordering only planned activities avoids a subtle untick-order regression.
- The restart-survival test is correctly identified as a high-risk verification gate.

## Approval condition

Resolve the four P1 findings before writing the M1 implementation plan. Resolve the P2 contracts in the design before the milestone that consumes each one. No requirements rewrite is necessary unless the intended `is_done`/visit-details invariant or mixed-type tie-break policy changes product behavior.
