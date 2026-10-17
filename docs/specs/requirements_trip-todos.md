# Wanderlog Phase 5 - Requirements Document

## Introduction

Phase 5 adds trip todos: the bookings and checks that have to happen before a day arrives. The driving case is a Chengdu and Chongqing family plan whose booking section lists eight items, each tied to a dated visit or train, each with a "when to act" hint. Some hints are a fixed date: train tickets go on sale 27 Nov. Some are a rule relative to the visit, such as panda base tickets opening 14 days ahead. The rest are vague ("a few days ahead"). Today Wanderlog has nowhere to put them, so they live in a chat transcript and get forgotten.

A todo turns *active* once it can be acted on. The app shows the active count everywhere you land, so nobody has to open the list to know there is something to book. Reminders themselves are not sent by Wanderlog. The owner's personal agent (Hermes) reads active todos over Supabase's REST API and sends WhatsApp nudges on its own schedule. It can also create todos from a pasted list, so the eight items go in by pasting the plan into WhatsApp.

Phases 1-4 carry over unchanged. The in-app agent's behaviour is untouched.

**Prerequisite:** Phase 3 M3 shipped, which provisioned the `hermes@wanderlog.local` Supabase account and the password-grant flow Hermes already uses.

## Scope Decisions

Settled during brainstorming. Changing any of them reopens the spec.

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Who sends reminders | Hermes, not Wanderlog | The app has no service worker or push backend, and iPhone web push needs an installed PWA plus a push server. Hermes already runs on a schedule and talks WhatsApp. Wanderlog's job is to hold the truth and show the count. |
| Hermes access | Supabase's built-in REST API under Hermes's own login | No new server code, RLS stays the only gate, filtering, insert and update come free. Accepted cost: Hermes is coupled to table and column names. A dedicated `/api/todos` endpoint with a static token was rejected because it needs the service-role key in Vercel. |
| Where todos live in the UI | One trip-wide list behind a "To do" button in the top-right cluster (mockup option A) | Train tickets and other between-stop items fit without picking a stop, and the count is always on screen. Per-stop sections inside the activities panel (option B) were rejected. |
| Timing model | Two optional dates: "from" (actionable from) and "by" (deadline) | Covers all three hint forms in the source plan. Relative rules ("14 days before") are resolved to a date when the todo is written. Hermes does that arithmetic when it parses a list. |
| Shared or personal | Shared and canonical, like `is_done` | Matches Phase 2's removal of per-user state. A booking done by one traveller is done for everyone. |
| Ended trips | Their todos stop counting | Stops Hermes nagging about a trip that is over, and keeps the library honest. |

## Requirements

### 1. Todo Data

**User Story:** As a traveller, I want to record a booking task against my trip with the window in which it can be done, so that it is tracked alongside the plan instead of in a chat log.

1. A todo belongs to exactly one trip and has a required title with at least one non-whitespace character. Optionally it has notes, a URL, a "from" date, a "by" date, and a link to one stop and/or one activity.
2. A todo has a done flag, shared by everyone who can see the trip.
3. When both dates are set, "from" is on or before "by". The database enforces this and the non-blank title, so a bad write from Hermes is rejected with an error.
4. Deleting a trip deletes its todos. Deleting a linked stop or activity keeps the todo and drops that link.

### 2. Todo State

**User Story:** As a traveller, I want each todo to know whether it can be acted on yet, so that the app only counts what I can do something about today.

1. *Done*: the done flag is set.
2. *Coming up*: not done, and the "from" date is after today.
3. *Ready*: not done, and the "from" date is empty or on or before today.
4. *Overdue*: ready, and the "by" date is before today.
5. "Today" is the current calendar date in the trip's timezone.
6. A todo is *active* when it is ready or overdue and the trip's end date is on or after today. Todos on an ended trip are never active.
7. The app and the Hermes read path use the same rule (Requirement 6.2).

### 3. Active Count

**User Story:** As a traveller, I want to see how many todos need me the moment I open Wanderlog, without opening the list.

1. The trip page shows a "To do" button in the top-right cluster, next to the agent button. When the active count is above zero, a numbered badge sits on it.
2. The button and badge are visible on phone and desktop with no panel open, and the button's accessible name includes the count.
3. Each trip card in the library shows its active count when it is above zero.
4. A change made in the app updates the trip page's count immediately. The library count follows once the write settles. A change made by Hermes shows up on the next refetch.
5. The count follows the clock. When the trip-local date changes, the count changes with it, even if the page was left open and nothing refetched.

### 4. Todo List

**User Story:** As a traveller, I want one list of everything to book for the trip, ordered by what needs me first.

1. Tapping the button opens one list for the whole trip, grouped as *Ready now* (overdue first, then by "by" date), *Coming up* (by "from" date), and *Done*.
2. Each row shows a checkbox, the title, what it is linked to (activity or stop name), a date chip, the notes, and an open-link control when a URL is set.
3. Overdue is labelled in text as well as colour.
4. The list is a bottom sheet on a phone and a panel on desktop. It closes on Escape, on the close control, and on a backdrop tap.
5. A trip with no todos shows an empty state that invites adding one.
6. An activity card shows a small chip when it has a todo that isn't done, with that todo's state.

### 5. Editing in the App

**User Story:** As a traveller, I want to add, fix, tick off, and remove todos myself without going through Hermes.

1. Todos can be added, edited, and deleted from the list through a form with title, notes, URL, link, "from" date, and "by" date. Delete asks for confirmation.
2. Ticking and unticking update the list and the count at once. A failed write rolls back and offers a retry, like every other edit.
3. Writes need connectivity. Offline, the list stays readable from the cached trip and its controls are disabled. A write attempted anyway, such as a retry tapped as the connection drops, fails and rolls back at once. It is never queued for later.
4. Ticking off the last active todo is celebrated with a short toast in the app's voice.

### 6. Hermes API

**User Story:** As the app owner, I want my personal agent to read, create, and update todos directly, so that it can remind me on WhatsApp and turn a pasted booking list into todos.

1. Hermes authenticates with its existing Supabase account through the password grant, as for the agent endpoint.
2. One read returns all active todos across trips, computed by the database with the rule in Requirement 2, with each todo's trip name and an overdue flag.
3. Hermes can create todos singly or in bulk, and update any todo field including done, through Supabase REST. Invalid input comes back as a 4xx with the database's message.
4. Hermes can read each trip's stops (ids, names, dates) and their activities (ids, names) to link todos to them. Activities carry no date of their own, so the stop's range is the date context.
5. The contract is documented in the design doc, with copy-paste requests, as the stable Hermes integration surface.

### 7. Release

1. The app version becomes 3.2.0.
2. A `CHANGELOG.md` at the repo root records this release.
3. The migration is applied to the hosted database before any build of this branch is deployed, preview included. The new browser selects embed `todos` and fail against a schema without it.

## Out of Scope

- **Reminders sent by Wanderlog**: push, email, or in-browser notifications. Hermes owns delivery.
- **App-icon badge** (`navigator.setAppBadge`). It works only for installed desktop PWAs, and on iPhone needs notification permission the app never asks for. The in-app badge covers the requirement.
- **Todo tools for the in-app agent.** Its prompt, tools, and trip context stay exactly as in Phase 4. A later phase can add tools over the same shared write functions.
- **Todos in import and export.** Export serialises the cached trip and so includes todos incidentally. Import ignores them (zod strips unknown keys).
- Per-person assignment, recurring todos, and manual reordering.

## Milestones

1. **M1 - Data and API.** Migration (table, view, grants), domain types, mappers, shared write functions, the state rule, and their tests. *Verify: Hermes-style curl session (password grant, bulk insert of the eight source items, read active todos, patch one done) against a local Supabase stack.*
2. **M2 - In-app experience.** Button with badge, list sheet/panel, form, activity-card chip, library count, celebration. *Verify: the eight items render in the right groups on phone and desktop widths, ticking updates the badge, offline disables the controls.*
3. **M3 - Release.** Version 3.2.0, `CHANGELOG.md`, architecture and index updates, migration applied to the hosted project with the owner's go-ahead.
