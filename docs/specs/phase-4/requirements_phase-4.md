# Wanderlog Phase 4 - Requirements Document

## Introduction

Phase 4 turns check-off from a boolean into a visit record. Today ticking an activity or scenic waypoint sets `is_done` and nothing else: the app knows *that* something happened, never *when*, *how long*, or *how it went*. Phase 4 adds an optional time, duration, and note to each ticked item, teaches agent mode to write them, and re-orders completed items by when they actually happened.

Everything shipped in Phases 1-3 carries over. Two earlier rules are overridden and are listed under [Amendments to Earlier Phases](#amendments-to-earlier-phases).

**Prerequisite:** Phase 2 M4 (itinerary editing) and Phase 3 M2 (bounded edits) shipped. The visit form reuses the M4 modal pattern; the agent capability extends the M2 tool surface.

## Scope Decisions

Settled during requirement grilling and sized everything below. Changing any of them reopens the spec.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Check-off friction | Instant tick unchanged; details opt-in | Ticking things off while walking past them is the core gesture. A modal on every tick would tax the common path to serve the rare one. |
| Auto-stamp | Stamp the time only when today falls inside the trip's date range | Ticks during a live trip happen close to the event. Ticking a backlog of three days on the train would stamp them all to that evening, minutes apart, recording when they were ticked and not when they happened. |
| Time storage | `text` `'YYYY-MM-DD HH:mm'`, local to `trips.timezone` | Matches `accommodations.check_in`/`check_out` and the Phase 2 rationale for rejecting `timestamptz` on wall-clock fields. Sorts chronologically as plain text. |
| Notes | Reuse the existing `remarks` column | A family journal has one note per item. Accepted cost: once visited, the planned note is unrecoverable in-app. |
| Duration | New `visit_duration_minutes` (integer); the existing `duration` text is untouched | An inventory of the checked-in trip data found roughly 31 of 40 distinct `duration` values are ranges or prose (`1-2.5h`, `1h 45m-2h cruise (+stops)`, `Full day`, `3 nights`). An integer cannot hold them, so reusing the column would destroy most planned estimates and invent midpoints for the rest. Splitting keeps the plan intact, gives the actual a sortable type, and removes the need for any migration of existing data. |
| Visit details require completion | The visit form is offered only on items already ticked | Keeps `visited_at` implying `is_done` true by construction, with no implicit writes and nothing to reconcile in the two sections. |
| Ordering | Completed items move to a separate Visited section, sorted by visit time | A timestamp and a drag-order index have no comparable key, so interleaving them in one list has no coherent rule. Two sections keeps drag-and-drop meaningful in the half that owns plan order. |
| Surfaces | Activities panel only | The panel is where ticking happens. A trip-wide journal view needs its own page, route, and empty states, and can be added later without changing any data decision here. |
| Offline | The visit form works offline | Notes get written where signal is worst. Requiring connectivity means recalling the moment hours later, which is the part only the traveller can supply. Carved out of Phase 2 Req 4.10. |
| Per-user records | None; the visit record is canonical and shared, like `is_done` | Phase 2 removed the per-user modification concept deliberately. Reintroducing it for one field would reopen that decision. |

## Requirements

### 1. Visit Record Data Model

**User Story:** As the app owner, I want the visit time and a structured duration stored on itinerary items, so that completed items carry a record of what actually happened rather than a bare boolean.

**Acceptance Criteria:**
1. WHEN the schema is migrated, THEN `activities` and `scenic_waypoints` SHALL each gain a nullable `visited_at` column of type `text` holding `'YYYY-MM-DD HH:mm'` local to the owning trip's timezone.
2. WHEN the schema is migrated, THEN both tables SHALL gain a nullable `visit_duration_minutes` column of type `integer`.
3. WHEN the schema is migrated, THEN the existing `duration` text column SHALL be left unchanged on both tables and SHALL continue to hold the planned estimate; no existing duration data SHALL be converted, moved, or dropped.
4. WHEN a visit note is recorded, THEN it SHALL be written to the existing `remarks` column; no separate notes column SHALL be added.
5. WHEN the trip detail query is read, THEN the trip's stored `start_date` and `end_date` SHALL be carried into the trip domain type, so that the stamp rule in Requirement 2 has a data source that does not depend on the trip library being cached.
6. WHEN visit data is read, THEN it SHALL flow through the existing nested trip select and row-to-domain mappers with no new query key.
7. WHEN a trip file is imported, THEN `visited_at` and `visit_duration_minutes` SHALL be accepted as optional fields; files without them SHALL import exactly as they do today.
8. WHEN a trip is exported, THEN the file SHALL carry `visited_at` and `visit_duration_minutes` alongside the unchanged `duration`.

### 2. Check-off Capture

**User Story:** As a traveller, I want to note when I did something, how long it took, and how it went, without slowing down the act of ticking it off.

**Acceptance Criteria:**
1. WHEN a user ticks an activity or scenic waypoint, THEN `is_done` SHALL be written immediately with no intervening dialog, exactly as today.
2. WHEN an item is ticked and the current date falls within the trip's `start_date`..`end_date`, THEN `visited_at` SHALL be set to the current time converted into the trip's timezone.
3. WHEN an item is ticked and the current date falls outside that range, THEN `visited_at` SHALL remain null.
4. WHEN the stamp rule is applied, THEN it SHALL live in a single shared module used by both the browser toggle and the agent tool path, so the two produce identical results.
5. WHEN an item is not done, THEN no visit-details affordance SHALL be offered for it, so a visit record can never exist on an unticked item.
6. WHEN a user opens the visit-details form for a done item, THEN it SHALL offer a date-and-time field, hours and minutes duration fields, and a free-text note, all optional.
7. WHEN the form opens, THEN every field SHALL be prefilled from the item's current stored values, so that saving never silently discards existing text.
8. WHEN the form opens on an item with no `visited_at`, THEN the date-and-time field SHALL default to the current time in the trip's timezone.
9. WHEN the entered date-and-time falls outside the trip's dates, THEN the form SHALL show an inline warning and SHALL still save; the trip's range SHALL be visible as guidance.
10. WHEN a user unchecks an item, THEN `visited_at` SHALL be cleared and `visit_duration_minutes` and `remarks` SHALL be left untouched.
11. WHEN the form is saved, THEN the write SHALL follow the existing optimistic mutation path, including rollback and retry on failure.
12. WHEN a visited item is rendered, THEN its visit time, visit duration, and note SHALL be visible on the card without opening the form.

### 3. Visited Ordering and Display

**User Story:** As a family member, I want completed items shown in the order they actually happened, so that a stop reads back as a record of the days we spent there.

**Acceptance Criteria:**
1. WHEN a stop's items are listed, THEN they SHALL be split into a planned section holding items that are not done and a visited section holding items that are.
2. WHEN the planned section is rendered, THEN it SHALL appear above the visited section, keep `sort_order`, and keep drag-and-drop reordering unchanged.
3. WHEN the visited section is rendered, THEN items SHALL be sorted by `visited_at` ascending, and items without a `visited_at` SHALL fall back to their plan order.
4. WHEN the visited section is rendered, THEN drag-and-drop SHALL be disabled within it, since chronology owns that order.
5. WHEN a stop has both activities and scenic waypoints, THEN the visited section SHALL hold both types in one chronological list; the scenic-waypoints group SHALL retain only items that are not done.
6. WHEN activities and scenic waypoints are merged, THEN the ordering SHALL be total and deterministic, including a defined tie-break for items of different types carrying equal order values.
7. WHEN visited items span more than one date, THEN they SHALL be grouped under a heading per date.
8. WHEN visited items have no `visited_at`, THEN they SHALL be grouped last, after all dated groups, in plan order.
9. WHEN an item is ticked or unticked, THEN it SHALL move between the two sections without a page reload.
10. WHEN visit data changes, THEN the map, timeline, and trip library SHALL be unaffected beyond carrying the data.

### 4. Agent Check-off Support

**User Story:** As a family member, I want to tell the agent what we did and when, so that catching up on a day's ticking does not mean opening a form per item.

**Acceptance Criteria:**
1. WHEN the agent's item update tools are defined, THEN `update_activity` and `update_waypoint` SHALL accept `visited_at` and `visit_duration_minutes` alongside the existing `done` and `remarks` fields, each zod-validated.
2. WHEN the system prompt is assembled, THEN it SHALL state the current date and time in the scoped trip's timezone and the trip's date range, so that relative expressions such as "this morning" or "yesterday at 3pm" are resolvable.
3. WHEN the agent marks an item done without supplying a time, THEN the same shared stamp rule as the UI SHALL apply, so agent and UI check-offs are indistinguishable in the data.
4. WHEN the agent supplies a `visited_at`, THEN it SHALL be used as given, overriding the stamp rule.
5. WHEN the agent sets visit fields on an item that is not done and does not mark it done in the same call, THEN the tool SHALL return a validation error rather than writing, matching the UI rule in Req 2.5.
6. WHEN the agent writes a visit record, THEN the change SHALL appear in the run's structured change list like any other write.
7. WHEN the agent reads trip data, THEN `visited_at` and `visit_duration_minutes` SHALL be present in the returned trip so that questions about what was done and when can be answered.

### 5. Offline Capture

**User Story:** As a traveller with no signal, I want to record what we just did while I remember it, so that the note survives until the phone finds data again.

**Acceptance Criteria:**
1. WHEN the app is offline, THEN the visit-details form SHALL remain open-able and savable, unlike every other editor.
2. WHEN a visit record is saved offline, THEN it SHALL apply optimistically and the write SHALL be queued until connectivity returns.
3. WHEN the browser tab is closed before connectivity returns, THEN queued visit writes SHALL survive the restart and flush on reconnect.
4. WHEN a queued write fails after reconnect, THEN the optimistic value SHALL be rolled back in the cache and the failure SHALL surface with a retry option, whether or not the app restarted in between.
5. WHEN more than one queued write targets the same item, THEN they SHALL be applied in the order they were made, and a failure SHALL NOT restore values over a later edit.

### 6. Trip Timezone Correction

**User Story:** As the app owner, I want to fix a trip's timezone, so that visit times recorded against an imported trip are stamped in the zone the trip actually happened in.

**Acceptance Criteria:**
1. WHEN a user edits trip metadata, THEN the trip's timezone SHALL be editable as an IANA zone name.
2. WHEN a timezone is submitted, THEN it SHALL be validated as a zone the runtime recognises, and an unrecognised value SHALL be rejected with a field error.
3. WHEN the agent updates trip metadata, THEN it SHALL be able to set the timezone under the same validation.
4. WHEN a trip is created by TripIt import, THEN its timezone SHALL remain the importing device's zone as today, but correcting it SHALL be possible before or after visits are recorded.

## Amendments to Earlier Phases

1. **Phase 2 Req 4.10** ("WHEN the app is offline, THEN editing controls SHALL be disabled") is amended: the visit-details form is exempt. All other editors remain offline-disabled.
2. **Phase 2 design, database schema**: `activities` and `scenic_waypoints` gain `visited_at` (text) and `visit_duration_minutes` (integer). The existing `duration` text column is unchanged.
3. **Phase 2 design, trip metadata**: `TRIP_METADATA_COLUMNS` gains `timezone`, making it editable from the metadata form and the agent's `update_trip_metadata`.
4. **Phase 3 tool surface**: `update_activity` and `update_waypoint` gain two fields; the system prompt gains the current date-time and trip date range.

## Milestones

Risk-ordered. Each is independently shippable and verifiable.

1. **M1 - Data model and capture:** Schema migration, mappers including the trip's stored dates, timezone correction in trip metadata, shared stamp rule, auto-stamp on tick, visit-details form including the offline carve-out, card rendering (Requirements 1, 2, 5, 6). *Verify: a tick during a live trip stamps the trip-local time and a tick outside the window does not; the form round-trips all three fields; a trip whose timezone differs from the device stamps in the trip's zone; a note typed offline survives a tab restart, and a failure after that restart rolls back and offers retry.*
2. **M2 - Visited section:** Planned/visited split, merged activity and waypoint chronology with a total order, day headings, undated group, drag rules (Requirement 3). *Verify: a multi-night stop renders its visited items grouped by day in visit order; ticking moves an item between sections; dragging still works in planned and is absent in visited; activities and waypoints with colliding order values render deterministically.*
3. **M3 - Agent check-off:** Tool fields, system-prompt clock and trip range, shared stamp rule applied server-side, the not-done guard (Requirement 4). *Verify: "mark the museum done, we left at 3" records 15:00; "mark it done" during a live trip stamps the same way the UI would; setting visit fields on an unticked item is refused; the change list names the item.*

## Out of Scope (Deferred)

- **Trip journal view.** A trip-wide chronological read-back of everything visited, across stops. New page, new route, new empty states; none of the data decisions above change if it is added later.
- **Timeline completion markers.** Showing per-day visited counts on the timeline. The timeline is primary navigation and currently shows plan structure only.
- **Structured planned durations.** `duration` stays free text holding ranges and prose. Comparing planned against actual duration is therefore eyeball-only; parsing the plan into minutes is a separate problem.
- **Recovering a planned note after a visit.** `remarks` is reused, so the pre-trip note is overwritten once the visit note is saved.
- **Per-user visit records.** The record is canonical and shared, like `is_done`.
- **Photos, ratings, or companions on a visit.** Free text covers these at family scale.
- **Visit records on accommodations or stops.** Neither is checkable; neither has `is_done`.
- **Undo.** No undo exists anywhere in the app.
- **Automatic duration from consecutive visit times.** Inferring that the museum took 90 minutes because the next tick was 90 minutes later guesses at lunch, transit, and forgotten ticks.
- **Timezone inference from the destination on import.** Req 6 makes the zone correctable by hand; deriving it from geocoded coordinates is a separate change.

## Changelog

- 2026-07-26: Initial draft (grilled and approved).
- 2026-07-26: Amended after design review ([review_design-phase-4.md](review_design-phase-4.md)). Duration reuse reversed: an inventory found roughly 31 of 40 distinct `duration` values in the checked-in trip data are ranges or prose that an integer cannot hold, so `duration` stays untouched and a new `visit_duration_minutes` column holds the actual (Scope Decisions, Req 1.2, 1.3, 1.7, 1.8). The text-to-minutes parser, the backfill, the contract migration, and the import warning transport are all removed with it. Req 1.5 added: the trip's stored dates must reach the detail domain type, since the stamp rule had no offline-safe data source. Req 2.5 added: the visit form is offered only on done items, with the matching agent guard in Req 4.5. Req 2.9 reworded so the date range is guidance rather than a native input constraint that would block the required out-of-range save. Req 3.6 added: the merged ordering must be total and deterministic. Req 5.4 widened to cover the post-restart path and Req 5.5 added for ordering of multiple queued writes. Requirement 6 added: the trip timezone must be correctable, without which a TripIt-imported trip stamps every visit in the importing device's zone.
