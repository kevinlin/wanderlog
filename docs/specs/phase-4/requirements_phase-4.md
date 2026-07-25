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
| Plan vs actual | One field per concept: the existing `duration` and `remarks` columns hold both | A family journal has one duration and one note per item. Accepted cost: once visited, the planned value is unrecoverable in-app and plan-vs-actual comparison is permanently out. |
| Duration type | `duration` (text) migrates to `duration_minutes` (integer) | The form asks for hours and minutes. An integer sorts, sums per day, and renders consistently; free text does none of these and cannot round-trip through h/m inputs. |
| Ordering | Completed items move to a separate Visited section, sorted by visit time | A timestamp and a drag-order index have no comparable key, so interleaving them in one list has no coherent rule. Two sections keeps drag-and-drop meaningful in the half that owns plan order. |
| Surfaces | Activities panel only | The panel is where ticking happens. A trip-wide journal view needs its own page, route, and empty states, and can be added later without changing any data decision here. |
| Offline | The visit form works offline | Notes get written where signal is worst. Requiring connectivity means recalling the moment hours later, which is the part only the traveller can supply. Carved out of Phase 2 Req 4.10. |
| Per-user records | None; the visit record is canonical and shared, like `is_done` | Phase 2 removed the per-user modification concept deliberately. Reintroducing it for one field would reopen that decision. |

## Requirements

### 1. Visit Record Data Model

**User Story:** As the app owner, I want the visit time and a structured duration stored on itinerary items, so that completed items carry a record of what actually happened rather than a bare boolean.

**Acceptance Criteria:**
1. WHEN the schema is migrated, THEN `activities` and `scenic_waypoints` SHALL each gain a nullable `visited_at` column of type `text` holding `'YYYY-MM-DD HH:mm'` local to the owning trip's timezone.
2. WHEN the schema is migrated, THEN the existing `duration` text column on both tables SHALL be replaced by a nullable `duration_minutes` integer column.
3. WHEN existing `duration` text is migrated, THEN parseable values SHALL be converted to minutes, unparseable values SHALL become null, and every unparseable value SHALL be listed in the migration output with its row id.
4. WHEN a visit note is recorded, THEN it SHALL be written to the existing `remarks` column; no separate notes column SHALL be added.
5. WHEN visit data is read, THEN it SHALL flow through the existing nested trip select and row-to-domain mappers with no new query key.
6. WHEN a trip file is imported, THEN the importer SHALL accept either `duration` (text, parsed to minutes) or `duration_minutes` (integer, taking precedence when both are present), so that every file previously exported by the app still imports.
7. WHEN text duration in an imported file cannot be parsed, THEN the item SHALL import with a null duration and the failure SHALL appear in the import preview's per-field messages, without blocking the import.
8. WHEN a trip is exported, THEN the file SHALL carry `duration_minutes` and `visited_at`.

### 2. Check-off Capture

**User Story:** As a traveller, I want to note when I did something, how long it took, and how it went, without slowing down the act of ticking it off.

**Acceptance Criteria:**
1. WHEN a user ticks an activity or scenic waypoint, THEN `is_done` SHALL be written immediately with no intervening dialog, exactly as today.
2. WHEN an item is ticked and the current date falls within the trip's `start_date`..`end_date`, THEN `visited_at` SHALL be set to the current time converted into the trip's timezone.
3. WHEN an item is ticked and the current date falls outside that range, THEN `visited_at` SHALL remain null.
4. WHEN the stamp rule is applied, THEN it SHALL live in a single shared module used by both the browser toggle and the agent tool path, so the two produce identical results.
5. WHEN a user opens the visit-details form for an item, THEN it SHALL offer a date-and-time field, hours and minutes duration fields, and a free-text note, all optional.
6. WHEN the form opens, THEN every field SHALL be prefilled from the item's current stored values, so that saving never silently discards existing text.
7. WHEN the form opens on an item with no `visited_at`, THEN the date-and-time field SHALL default to the current time in the trip's timezone.
8. WHEN the date-and-time field is presented, THEN its selectable range SHALL be bounded to the trip's dates; a value outside that range SHALL still save and SHALL show an inline warning rather than blocking.
9. WHEN a user unchecks an item, THEN `visited_at` SHALL be cleared and `duration_minutes` and `remarks` SHALL be left untouched.
10. WHEN the form is saved, THEN the write SHALL follow the existing optimistic mutation path, including rollback and retry on failure.
11. WHEN a visited item is rendered, THEN its visit time, duration, and note SHALL be visible on the card without opening the form.

### 3. Visited Ordering and Display

**User Story:** As a family member, I want completed items shown in the order they actually happened, so that a stop reads back as a record of the days we spent there.

**Acceptance Criteria:**
1. WHEN a stop's items are listed, THEN they SHALL be split into a planned section holding items that are not done and a visited section holding items that are.
2. WHEN the planned section is rendered, THEN it SHALL appear above the visited section, keep `sort_order`, and keep drag-and-drop reordering unchanged.
3. WHEN the visited section is rendered, THEN items SHALL be sorted by `visited_at` ascending, and items without a `visited_at` SHALL fall back to `sort_order`.
4. WHEN the visited section is rendered, THEN drag-and-drop SHALL be disabled within it, since chronology owns that order.
5. WHEN a stop has both activities and scenic waypoints, THEN the visited section SHALL hold both types in one chronological list; the scenic-waypoints group SHALL retain only items that are not done.
6. WHEN visited items span more than one date, THEN they SHALL be grouped under a heading per date.
7. WHEN visited items have no `visited_at`, THEN they SHALL be grouped last, after all dated groups, ordered by `sort_order`.
8. WHEN an item is ticked or unticked, THEN it SHALL move between the two sections without a page reload.
9. WHEN visit data changes, THEN the map, timeline, and trip library SHALL be unaffected beyond carrying the data.

### 4. Agent Check-off Support

**User Story:** As a family member, I want to tell the agent what we did and when, so that catching up on a day's ticking does not mean opening a form per item.

**Acceptance Criteria:**
1. WHEN the agent's item update tools are defined, THEN `update_activity` and `update_waypoint` SHALL accept `visited_at` and `duration_minutes` alongside the existing `done` and `remarks` fields, each zod-validated.
2. WHEN the system prompt is assembled, THEN it SHALL state the current date and time in the scoped trip's timezone and the trip's date range, so that relative expressions such as "this morning" or "yesterday at 3pm" are resolvable.
3. WHEN the agent marks an item done without supplying a time, THEN the same shared stamp rule as the UI SHALL apply, so agent and UI check-offs are indistinguishable in the data.
4. WHEN the agent supplies a `visited_at`, THEN it SHALL be used as given, overriding the stamp rule.
5. WHEN the agent writes a visit record, THEN the change SHALL appear in the run's structured change list like any other write.
6. WHEN the agent reads trip data, THEN `visited_at` and `duration_minutes` SHALL be present in the returned trip so that questions about what was done and when can be answered.

### 5. Offline Capture

**User Story:** As a traveller with no signal, I want to record what we just did while I remember it, so that the note survives until the phone finds data again.

**Acceptance Criteria:**
1. WHEN the app is offline, THEN the visit-details form SHALL remain open-able and savable, unlike every other editor.
2. WHEN a visit record is saved offline, THEN it SHALL apply optimistically and the write SHALL be queued until connectivity returns.
3. WHEN the browser tab is closed before connectivity returns, THEN queued visit writes SHALL survive the restart and flush on reconnect.
4. WHEN a queued write fails after reconnect, THEN it SHALL surface through the existing rollback-and-retry path.

## Amendments to Earlier Phases

1. **Phase 2 Req 4.10** ("WHEN the app is offline, THEN editing controls SHALL be disabled") is amended: the visit-details form is exempt. All other editors remain offline-disabled.
2. **Phase 2 design, database schema**: `activities.duration` and `scenic_waypoints.duration` become `duration_minutes` (integer); both tables gain `visited_at` (text).
3. **Phase 3 tool surface**: `update_activity` and `update_waypoint` gain two fields; the system prompt gains the current date-time and trip date range.

## Milestones

Risk-ordered. Each is independently shippable and verifiable.

1. **M1 - Data model and capture:** Schema migration, mappers, import/export dual spelling, shared stamp rule, auto-stamp on tick, visit-details form including the offline carve-out, card rendering (Requirements 1, 2, 5). *Verify: a tick during a live trip stamps the trip-local time and a tick outside the window does not; the form round-trips all three fields; every existing export file in `local/trip-data/` still imports; a note typed offline survives a tab restart and flushes on reconnect.*
2. **M2 - Visited section:** Planned/visited split, merged activity and waypoint chronology, day headings, undated group, drag rules (Requirement 3). *Verify: a multi-night stop renders its visited items grouped by day in visit order; ticking moves an item between sections; dragging still works in planned and is absent in visited.*
3. **M3 - Agent check-off:** Tool fields, system-prompt clock and trip range, shared stamp rule applied server-side (Requirement 4). *Verify: "mark the museum done, we left at 3" records 15:00; "mark it done" during a live trip stamps the same way the UI would; the change list names the item.*

## Out of Scope (Deferred)

- **Trip journal view.** A trip-wide chronological read-back of everything visited, across stops. New page, new route, new empty states; none of the data decisions above change if it is added later.
- **Timeline completion markers.** Showing per-day visited counts on the timeline. The timeline is primary navigation and currently shows plan structure only.
- **Plan-versus-actual comparison.** Structurally impossible once `duration` and `remarks` are reused for actual values. Reopening it means reopening the Scope Decision.
- **Per-user visit records.** The record is canonical and shared, like `is_done`.
- **Photos, ratings, or companions on a visit.** Free text covers these at family scale.
- **Visit records on accommodations or stops.** Neither is checkable; neither has `is_done`.
- **Undo.** No undo exists anywhere in the app.
- **Automatic duration from consecutive visit times.** Inferring that the museum took 90 minutes because the next tick was 90 minutes later guesses at lunch, transit, and forgotten ticks.

## Changelog

- 2026-07-26: Initial draft (grilled and approved).
