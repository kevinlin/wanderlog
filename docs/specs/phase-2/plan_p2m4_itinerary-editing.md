# Itinerary Editing (Phase 2, M4) Implementation Plan

**Goal:** All itinerary details editable in the UI with optimistic persistence to Supabase, delivered in three shippable slices: activities CRUD; accommodation + trip metadata; scenic waypoints + stop restructuring (Requirement 4).

**Architecture:** Every edit is a `useMutation` over a single-row (or small-batch) `supabaseService` write, wrapped in one shared optimistic helper: patch the `['trip', tripId]` cache in `onMutate`, roll back on error with a retry toast (Req 4.8), invalidate on settle. Editing UX is a pencil-icon-opens-modal pattern per card (design decision), reusing M3's `ConfirmDialog` for deletes. Offline disables all edit affordances via a `useOnlineStatus` hook (Req 4.10). One additive migration extends `accommodations` with the columns Req 4.4 needs.

**Tech Stack:** TanStack Query v5 mutations, @supabase/supabase-js v2, dnd-kit, existing placesService for location picking, Tailwind 4.

## Global Constraints

- Prerequisite: M3 shipped ([plan_p2m3_trip-library.md](plan_p2m3_trip-library.md)) - library, `ConfirmDialog`, create/delete trip all live.
- Slices ship in order (A: Tasks 1-5, B: Tasks 6-8, C: Tasks 9-11); each slice ends with its own round-trip verification and is independently deployable.
- New row ids are client-generated `crypto.randomUUID()`.
- Domain types may gain optional fields only (`Accommodation.remarks`); nothing existing is renamed or removed - the export JSON shape must stay backward-compatible (Req 8.3).
- Last-write-wins needs no client code: the `moddatetime` trigger stamps `updated_at` on every update (Req 4.9); Task 11 verifies the behavior.

---

## Slice A - Activities CRUD (Req 4.1, 4.2, 4.3, 4.8, 4.10)

### Task 1: Activity write-path service functions (TDD)

Added `createActivity`, `updateActivity`, `deleteActivity` to `supabaseService.ts` with an `ActivityInput` interface and a `deleteById` helper. The `activityInputToRow` mapper converts camelCase input to snake_case DB columns, defaulting unspecified optional fields to null.

### Task 2: Retry toasts + offline edit-disable plumbing (Req 4.8, 4.10)

Created `useOnlineStatus` hook using `useSyncExternalStore` tracking `online`/`offline` events. Extended `Toast` with an optional `action` button for retries. Updated `OfflineIndicator` copy to "editing disabled" (the old "changes will sync" was never true).

### Task 3: Shared optimistic mutation helper; refactor M1 mutations onto it (TDD)

Extracted the cancel/snapshot/patch/rollback/invalidate boilerplate from M1's `useToggleActivityDone`/`useReorderActivities` into `useTripCacheMutation<TVars, TResult>` — a generic helper taking `{ tripId, mutationFn, patch, errorMessage }`. On error, it restores the snapshot and shows a retry toast. Both M1 hooks were refactored onto it (existing optimistic/rollback tests passed unchanged as the safety net).

### Task 4: Activity mutations + edit modal

Built three hooks (`useCreateActivity`, `useUpdateActivity`, `useDeleteActivity`) on the shared helper, plus `ItemModalShell` (reusable editing dialog with Save/Cancel footer) and `ActivityFormModal` (name, type select, address with "Find place" via `placesService`, duration, url, remarks). Wired pencil/trash icons on `ActivityCard`, "Add activity" on `ActivitiesPanel`, and `disabled={!isOnline}` on the dnd-kit sortable context. The M1 POI-add cache patch was replaced by `useCreateActivity` so POI results now persist.

### Task 5: Slice A ship gate

Verified Req 4.1 (add activity persists), Req 4.2 (edit/delete persist, pins update), Req 4.3 (drag-reorder canonical), Req 4.8 (error toast with Retry on network failure).

---

## Slice B - Accommodation + trip metadata (Req 4.4, 4.5)

### Task 6: Accommodation columns migration + service functions (TDD)

Added `remarks`, `lat`, `lng` columns to `accommodations` via a migration. Extended `Accommodation` domain type and mappers. Implemented `upsertAccommodation` (deterministic id `${stopId}_accommodation`, upsert so the same modal covers add and edit) and `updateTripMetadata` (partial patch of name/description/start/end date). Re-verified `pnpm migrate:supabase` idempotency.

> **Post-ship fix (2026-07-04): production outage from unpushed migration.** The frontend shipped to Vercel while the migration was only applied locally — production had no `accommodations.lat/lng/remarks` columns. The mapper guard `row.lat !== null` passed for `undefined`, producing `location: { lat: undefined, lng: undefined }` (truthy), so the accommodation-pin fallback never fired and Google Maps threw a fatal error on every trip page.
>
> Remediation: applied the migration with `supabase db push --linked`; hardened mapper coordinate guards to `== null` so absent columns behave like nulls. Lesson: push migrations to production before or with the frontend deploy that depends on them.

### Task 7: Accommodation edit modal

Built `AccommodationFormModal` on `ItemModalShell` with fields per `AccommodationInput` (name, address + "Find place", check-in/check-out via `datetime-local`, confirmation, url, remarks). `useUpsertAccommodation` via the shared helper. Pencil on `AccommodationCard`; "Add accommodation" on stops without one; both hidden offline.

### Task 8: Trip metadata editing + Slice B ship gate

Built `TripMetadataFormModal` (name, description, start/end date with `end >= start` validation). Entry points: "Edit trip" in `UserMenu` on trip page, pencil on library card. `useUpdateTripMetadata` invalidates both `['trips']` and `['trip', tripId]`. Verified Req 4.4 (accommodation edits persist, pin updates on address change) and Req 4.5 (trip rename/date change appears in library and trip page).

---

## Slice C - Scenic waypoints + stop restructuring (Req 4.6, 4.7)

### Task 9: Waypoint CRUD (service + mutations + modal)

Mirrored the activity pattern against `scenic_waypoints` — `WaypointInput` (no `type` field), three service functions, three hooks on the shared helper, `WaypointFormModal` on `ItemModalShell`. The M1 POI waypoint-add cache patch was replaced by `useCreateWaypoint` (persistent). Verified Req 4.6: waypoint add/edit/delete re-routes the polyline through `MapContainer`'s directions effect recomputing from `tripData`.

### Task 10: Stop restructuring (Req 4.7)

Created `recalculateStopDates` (TDD, pure) implementing the date cascade: each stop keeps its night count, the chain re-anchors so stop 0 starts at `tripStartDate`, each subsequent stop starts the day its predecessor ends. Service functions for `createStop`/`updateStop`/`deleteStop`/`applyStopStructure` (batched updates via `Promise.all` + trip span update). `StopsEditor` modal with dnd-kit sortable stop rows, per-row `StopFormModal` (name, dates, location via place search), delete with cascade warning. Policy: stop restructuring recomputes the trip's date span; direct metadata date edits (Task 8) set trip dates but never move stops; LWW arbitrates.

### Task 11: M4 + Phase 2 verification gate, decommission follow-through

Verified Req 4.6 (waypoint route), Req 4.7 (stop reorder cascades dates/timeline/routes), Req 4.9 (LWW — concurrent edits, later save wins, no error), Req 4.10 (offline disables all M4 edit affordances), Req 8.3 (export downloads valid trip JSON with edited data). Completed Firebase decommission: archived final Firestore export to `local/firestore-export/`, removed `firebase` dep, deleted `src/config/firebase.ts`, `src/services/firebaseService.ts`, `src/types/storage.ts`, `scripts/migrate-to-firestore.ts`, scrubbed overlay paths and docs.

---

## Design Decisions

- `ActivityFormModal` and `WaypointFormModal` stay separate components on one `ItemModalShell`; a config-driven generic form for two-and-a-half variants would cost more than it saves.
- Trip-dates-vs-stop-dates policy: stops drive the span on restructure, metadata edits don't move stops, LWW arbitrates. Stated once in Task 10; encoded nowhere else.
- The accommodation migration is the only schema change in M4, additive-only — migrated rows get nulls, `buildRows` stays idempotent.
- Req 4.3 (canonical reorder) shipped in M1; Slice A re-verifies it after the helper refactor rather than rebuilding it.
- Firebase decommission lands in Task 11 rather than a separate milestone: it only becomes safe once nothing can need a Firestore fallback, which is true after the last slice ships.

## Critical Files — Summary

| Path | Role |
|------|------|
| `src/hooks/useTripCacheMutation.ts` | Shared optimistic mutation helper (snapshot/patch/rollback/invalidate/retry) |
| `src/hooks/useTripMutations.ts` | All entity mutation hooks (activity, waypoint, accommodation, metadata, stop) |
| `src/hooks/useOnlineStatus.ts` | `useSyncExternalStore` hook for online/offline tracking |
| `src/components/Editing/ItemModalShell.tsx` | Reusable editing dialog (title, Save/Cancel, pending state) |
| `src/components/Editing/ActivityFormModal.tsx` | Activity create/edit form with place search |
| `src/components/Editing/AccommodationFormModal.tsx` | Accommodation upsert form with place search |
| `src/components/Editing/WaypointFormModal.tsx` | Waypoint create/edit form with place search |
| `src/components/Editing/TripMetadataFormModal.tsx` | Trip name/description/dates form |
| `src/components/Editing/StopsEditor.tsx` | Stop reorder/add/delete with date cascade preview |
| `src/utils/stopDateUtils.ts` | Pure `recalculateStopDates` date cascade function |
| `supabase/migrations/*_accommodation_edit_fields.sql` | Additive `remarks`, `lat`, `lng` columns |

## Changelog

- 2026-07-10 — **Compacted post-implementation.** Removed step-by-step implementation tasks, file-by-file diffs, code snippets, test code, and verification command lists now that the feature has shipped. Preserved Goal, Architecture, Global Constraints, Design Decisions, Critical Files summary, and the Task 6 post-ship incident note. Original plan is recoverable via git history.
- 2026-07-04: Task 6 post-ship fix documented - production outage from the accommodation migration not being pushed before deploy; migration applied, mapper coordinate guards hardened to `== null` with regression tests.
- 2026-07-04: Initial plan.
