# Itinerary Editing (Phase 2, M4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** All itinerary details editable in the UI with optimistic persistence to Supabase, delivered in three shippable slices: activities CRUD; accommodation + trip metadata; scenic waypoints + stop restructuring (Requirement 4).

**Architecture:** Every edit is a `useMutation` over a single-row (or small-batch) `supabaseService` write, wrapped in one shared optimistic helper: patch the `['trip', tripId]` cache in `onMutate`, roll back on error with a retry toast (Req 4.8), invalidate on settle. Editing UX is a pencil-icon-opens-modal pattern per card (design decision), reusing M3's `ConfirmDialog` for deletes. Offline disables all edit affordances via a `useOnlineStatus` hook (Req 4.10). One additive migration extends `accommodations` with the columns Req 4.4 needs.

**Tech Stack:** TanStack Query v5 mutations, @supabase/supabase-js v2, dnd-kit, existing placesService for location picking, Tailwind 4.

## Global Constraints

- Prerequisite: M3 shipped ([plan_p2m3_trip-library.md](plan_p2m3_trip-library.md)) - library, `ConfirmDialog`, create/delete trip all live.
- Slices ship in order (A: Tasks 1-5, B: Tasks 6-8, C: Tasks 9-11); each slice ends with its own round-trip verification and is independently deployable.
- New row ids are client-generated `crypto.randomUUID()`.
- Domain types may gain optional fields only (`Accommodation.remarks`); nothing existing is renamed or removed - the export JSON shape must stay backward-compatible (Req 8.3).
- Last-write-wins needs no client code: the `moddatetime` trigger stamps `updated_at` on every update (Req 4.9); Task 11 verifies the behavior.
- After every task: `pnpm test:run` and `pnpm build` green. One commit per task.

---

## Slice A - Activities CRUD (Req 4.1, 4.2, 4.3, 4.8, 4.10)

### Task 1: Activity write-path service functions (TDD)

**Files:**
- Modify: `src/services/supabaseService.ts`, `src/services/__tests__/supabaseService.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 3-4; Task 9 mirrors it for waypoints):

```typescript
export interface ActivityInput {
  name: string;
  type?: string;
  lat?: number;
  lng?: number;
  address?: string;
  duration?: string;
  url?: string;
  remarks?: string;
  thumbnailUrl?: string;
  googlePlaceId?: string;
}
export function createActivity(stopId: string, sortOrder: number, input: ActivityInput): Promise<string>;
export function updateActivity(activityId: string, input: ActivityInput): Promise<void>;
export function deleteActivity(activityId: string): Promise<void>;
```

- [x] **Step 1: Write failing tests**

```typescript
it('createActivity inserts with generated uuid, stop_id and sort_order', async () => {
  const id = await createActivity('stop-1', 5, { name: 'Kayaking', type: 'outdoor', lat: -45, lng: 168 });
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
    id, stop_id: 'stop-1', sort_order: 5, name: 'Kayaking', type: 'outdoor',
    lat: -45, lng: 168, is_done: false,
  }));
});

it('updateActivity patches the row by id, mapping undefined to null', async () => {
  await updateActivity('act-1', { name: 'Renamed', remarks: undefined });
  expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed', remarks: null }));
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'act-1');
});

it('deleteActivity deletes by id', async () => {
  await deleteActivity('act-1');
  expect(mockDeleteEq).toHaveBeenCalledWith('id', 'act-1');
});
```

- [x] **Step 2: Implement**

```typescript
const activityInputToRow = (input: ActivityInput) => ({
  name: input.name,
  type: input.type ?? null,
  lat: input.lat ?? null,
  lng: input.lng ?? null,
  address: input.address ?? null,
  duration: input.duration ?? null,
  url: input.url ?? null,
  remarks: input.remarks ?? null,
  thumbnail_url: input.thumbnailUrl ?? null,
  google_place_id: input.googlePlaceId ?? null,
});

export async function createActivity(stopId: string, sortOrder: number, input: ActivityInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await getSupabase().from('activities').insert({
    id, stop_id: stopId, sort_order: sortOrder, is_done: false, ...activityInputToRow(input),
  });
  if (error) throw new Error(error.message);
  return id;
}

export const updateActivity = (activityId: string, input: ActivityInput): Promise<void> =>
  updateById('activities', activityId, activityInputToRow(input));

export const deleteActivity = (activityId: string): Promise<void> =>
  deleteById('activities', activityId);
```

Add the `deleteById(table, id)` helper next to M1's `updateById`, throwing on error the same way; M3's `deleteTrip` can be refactored onto it in passing (same file, three lines).

- [x] **Step 3: Green, full suite, commit**

```bash
pnpm vitest run src/services/__tests__/supabaseService.test.ts && pnpm test:run
git add -A && git commit -m "feat: add activity crud service functions"
```

---

### Task 2: Retry toasts + offline edit-disable plumbing (Req 4.8, 4.10)

**Files:**
- Create: `src/hooks/useOnlineStatus.ts`, `src/hooks/__tests__/useOnlineStatus.test.ts`
- Modify: `src/components/Layout/Toast.tsx` (optional action button), `src/components/Layout/OfflineIndicator.tsx` (copy)

**Interfaces:**
- Produces (consumed by every edit surface and Task 3's helper):

```typescript
export function useOnlineStatus(): boolean;
// Toast gains: action?: { label: string; onClick: () => void }
```

- [x] **Step 1: TDD the hook**

```typescript
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useOnlineStatus } from '../useOnlineStatus';

describe('useOnlineStatus', () => {
  it('tracks offline/online events', () => {
    const { result } = renderHook(() => useOnlineStatus());
    expect(result.current).toBe(true);  // jsdom default
    act(() => window.dispatchEvent(new Event('offline')));
    expect(result.current).toBe(false);
    act(() => window.dispatchEvent(new Event('online')));
    expect(result.current).toBe(true);
  });
});
```

Implementation via `useSyncExternalStore`:

```typescript
import { useSyncExternalStore } from 'react';

const subscribe = (callback: () => void) => {
  window.addEventListener('online', callback);
  window.addEventListener('offline', callback);
  return () => {
    window.removeEventListener('online', callback);
    window.removeEventListener('offline', callback);
  };
};

export const useOnlineStatus = (): boolean =>
  useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
```

- [x] **Step 2: Toast action button**

Extend the existing `Toast` props with `action?: { label: string; onClick: () => void }`, rendered as an underlined button after the message. Existing call sites compile unchanged (optional prop).

- [x] **Step 3: Offline copy**

`OfflineIndicator` message becomes "You're offline - viewing cached data, editing disabled" (the old "changes will sync" promise was never true and offline editing is out of scope by design).

- [x] **Step 4: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: add online-status hook and retryable toasts"
```

---

### Task 3: Shared optimistic mutation helper; refactor M1 mutations onto it (TDD)

**Files:**
- Create: `src/hooks/useTripCacheMutation.ts`
- Modify: `src/hooks/useTripMutations.ts`, `src/hooks/__tests__/useTripMutations.test.tsx`

**Interfaces:**
- Produces (every M4 mutation builds on this):

```typescript
export function useTripCacheMutation<TVars, TResult = void>(options: {
  tripId: string;
  mutationFn: (vars: TVars) => Promise<TResult>;
  patch: (trip: TripData, vars: TVars) => TripData;   // pure, applied optimistically
  errorMessage: string;                               // toast text on failure
}): UseMutationResult<TResult, Error, TVars>;
```

- [x] **Step 1: Extract the pattern**

M1's `useToggleActivityDone`/`useReorderActivities` duplicate cancel/snapshot/patch/rollback/invalidate. Move that boilerplate into `useTripCacheMutation`:

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripKeys } from '@/lib/queryClient';
import { useToast } from '@/components/Layout/Toast';  // or the existing toast trigger mechanism
import type { TripData } from '@/types/trip';

export function useTripCacheMutation<TVars, TResult = void>({ tripId, mutationFn, patch, errorMessage }: {
  tripId: string;
  mutationFn: (vars: TVars) => Promise<TResult>;
  patch: (trip: TripData, vars: TVars) => TripData;
  errorMessage: string;
}) {
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const mutation = useMutation({
    mutationFn,
    onMutate: async (vars: TVars) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = queryClient.getQueryData<TripData>(tripKeys.detail(tripId));
      queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) =>
        old ? patch(structuredClone(old), vars) : old
      );
      return { previous };
    },
    onError: (_error, vars, context) => {
      if (context?.previous) queryClient.setQueryData(tripKeys.detail(tripId), context.previous);
      showToast({ message: errorMessage, action: { label: 'Retry', onClick: () => mutation.mutate(vars) } });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
  });
  return mutation;
}
```

Match `showToast` to the actual Toast API in the repo (Task 2 extended it); if Toast is prop-driven rather than hook-driven, thread a callback - the retry contract is the fixed part, the wiring follows the existing component.

- [x] **Step 2: Refactor the two M1 hooks onto the helper**

`useToggleActivityDone` and `useReorderActivities` shrink to a `mutationFn` + `patch` pair each. Their existing optimistic/rollback tests must pass unchanged - that is the refactor's safety net. Add one new test: on error, the toast fires with a working Retry action (assert `mutationFn` called twice after clicking retry).

- [x] **Step 3: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "refactor: shared optimistic trip mutation helper with retry toast"
```

---

### Task 4: Activity mutations + edit modal

**Files:**
- Create: `src/components/Editing/ItemModalShell.tsx`, `src/components/Editing/ActivityFormModal.tsx`, `src/components/Editing/__tests__/ActivityFormModal.test.tsx`
- Modify: `src/hooks/useTripMutations.ts`, `src/components/Cards/ActivityCard.tsx`, `src/components/Activities/ActivitiesPanel.tsx`

**Interfaces:**
- Consumes: Task 1 service functions, Task 3 helper, M3 `ConfirmDialog`, Task 2 `useOnlineStatus`.
- Produces:
  - `useCreateActivity(tripId)`, `useUpdateActivity(tripId)`, `useDeleteActivity(tripId)` in `useTripMutations.ts`.
  - `ItemModalShell` - the generic editing dialog every entity form reuses: `{ title, isOpen, onClose, onSubmit, isPending, error, children }` with Save/Cancel footer (design: one reusable modal pattern).
  - `ActivityFormModal` with props `{ stopId, activity?: Activity, isOpen, onClose }` - `activity` absent means create mode.

- [x] **Step 1: Mutations via the helper (test first)**

Tests mirror Task 3's pattern - for each hook assert the optimistic cache patch and rollback. Create appends at the end of the stop's list:

```typescript
export function useCreateActivity(tripId: string) {
  return useTripCacheMutation({
    tripId,
    mutationFn: ({ stopId, sortOrder, input }: { stopId: string; sortOrder: number; input: ActivityInput; tempId: string }) =>
      createActivity(stopId, sortOrder, input),
    patch: (trip, { stopId, input, tempId, sortOrder }) => {
      const stop = trip.stops.find((s) => s.stop_id === stopId);
      if (stop) stop.activities.push({ activity_id: tempId, activity_name: input.name, ...inputToDomain(input), order: sortOrder, status: { done: false } });
      return trip;
    },
    errorMessage: 'Could not add the activity',
  });
}
```

`tempId = crypto.randomUUID()` from the caller; `onSettled` invalidation swaps it for the server row (same id semantics, different generator call - acceptable flicker: none, ids are client-side anyway). `inputToDomain` is a small local mapper from `ActivityInput` to the domain activity fields. Update/delete hooks patch/remove the matching activity in place.

- [x] **Step 2: The modal (test first)**

`ActivityFormModal` fields: name (required), type (select over `ActivityType` values), address (text) with a "Find place" button that runs the existing `placesService` search and fills `lat`/`lng`/`google_place_id`/`thumbnail_url` from the picked result, duration, url, remarks (textarea). Component test: create mode submits `ActivityInput` with entered values; edit mode pre-fills from the `activity` prop; empty name blocks submit.

- [x] **Step 3: Wire the cards**

- `ActivityCard`: pencil icon (edit modal) + trash icon (M3 `ConfirmDialog` → `useDeleteActivity`), both hidden when `!useOnlineStatus()`.
- `ActivitiesPanel`: "Add activity" button opens create mode; the M1 POI-add cache patch is replaced by `useCreateActivity` - POI results now persist (closing the M1 parity note).
- Drag-and-drop: pass `disabled={!isOnline}` into the dnd-kit sortable context.

- [x] **Step 4: Slice A round-trip verification, commit**

Manual on a preview: add an activity (with a place search), see its pin appear; edit its name, pin/card update; delete it, pin gone; refresh - all changes persisted; second browser sees them. Offline (DevTools network offline): pencils/add/delete/drag disabled, banner shows (Req 4.10).

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: activity crud editing with optimistic persistence"
```

---

### Task 5: Slice A ship gate

- [ ] All Task 4 manual checks pass on production after deploy (verified locally against local Supabase; production re-check pending merge + deploy)
- [x] Req 4.1: add activity with name, type, location, notes - persists
- [x] Req 4.2: edit + delete persist, map pins update
- [x] Req 4.3: drag-reorder persists canonically (M1 behavior, re-verified under the refactored helper)
- [x] Req 4.8: kill network mid-edit - error toast with Retry appears; retry after reconnect succeeds
- [x] Update the M4 row in `plan_wanderlog-phase-2.md`: `Slice A shipped (<date>)`

```bash
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M4 slice A (activities crud) shipped"
```

---

## Slice B - Accommodation + trip metadata (Req 4.4, 4.5)

### Task 6: Accommodation columns migration + service functions (TDD)

**Files:**
- Create: `supabase/migrations/<timestamp>_accommodation_edit_fields.sql`
- Modify: `src/services/supabaseService.ts` + tests, `src/services/supabaseMappers.ts` + tests, `src/types/trip.ts`

**Interfaces:**
- Produces:

```typescript
export interface AccommodationInput {
  name: string;
  address?: string;
  checkIn?: string;    // 'YYYY-MM-DD HH:mm'
  checkOut?: string;
  remarks?: string;
  url?: string;
  confirmation?: string;
  lat?: number;
  lng?: number;
  googlePlaceId?: string;
}
export function upsertAccommodation(stopId: string, input: AccommodationInput): Promise<void>;
export interface TripMetadataPatch { name?: string; description?: string; startDate?: string; endDate?: string }
export function updateTripMetadata(tripId: string, patch: TripMetadataPatch): Promise<void>;
```

- [ ] **Step 1: Migration**

Req 4.4 needs notes and a pin that follows the accommodation; the M1 table has neither a remarks column nor coordinates:

```sql
alter table accommodations
  add column remarks text,
  add column lat double precision,
  add column lng double precision;
```

`supabase db reset` locally, then `supabase db push`. RLS and the `updated_at` trigger already cover the table.

- [ ] **Step 2: Types + mappers (test first)**

- `Accommodation` (types/trip.ts) gains `remarks?: string` (additive; `location?: Coordinates` already exists as a legacy field - it now becomes live again).
- `AccommodationRow` gains `remarks/lat/lng`; `toAccommodation` maps `remarks` and builds `location` when lat/lng are present; `buildRows` writes them back (null-safe). Mapper tests extend the Task-3 (M1) fixture with the new columns.
- `MapContainer` already prefers `accommodation.location` over the stop location (legacy path), so a located accommodation moves its pin with no map changes.

- [ ] **Step 3: Service functions (test first)**

```typescript
export async function upsertAccommodation(stopId: string, input: AccommodationInput): Promise<void> {
  const { error } = await getSupabase().from('accommodations').upsert({
    id: `${stopId}_accommodation`,   // deterministic, matches the migration script convention
    stop_id: stopId,
    name: input.name,
    address: input.address ?? null,
    check_in: input.checkIn ?? null,
    check_out: input.checkOut ?? null,
    remarks: input.remarks ?? null,
    url: input.url ?? null,
    confirmation: input.confirmation ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    google_place_id: input.googlePlaceId ?? null,
  }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function updateTripMetadata(tripId: string, patch: TripMetadataPatch): Promise<void> {
  const row: Record<string, unknown> = {};
  if (patch.name !== undefined) row.name = patch.name;
  if (patch.description !== undefined) row.description = patch.description;
  if (patch.startDate !== undefined) row.start_date = patch.startDate;
  if (patch.endDate !== undefined) row.end_date = patch.endDate;
  const { error } = await getSupabase().from('trips').update(row).eq('id', tripId);
  if (error) throw new Error(error.message);
}
```

Upsert (not update) because a stop may have no accommodation yet - the same edit modal covers add and edit. Tests: upsert payload shape incl. the deterministic id; metadata patch skips undefined fields.

- [ ] **Step 4: Green, migration counts re-check, commit**

Re-run `pnpm migrate:supabase` against local - still idempotent with the new columns (they default to null for migrated rows; the NZ JSON has no accommodation coordinates).

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: accommodation edit columns and metadata write path"
```

---

### Task 7: Accommodation edit modal

**Files:**
- Create: `src/components/Editing/AccommodationFormModal.tsx` + test
- Modify: `src/hooks/useTripMutations.ts`, `src/components/Cards/AccommodationCard.tsx`

**Interfaces:**
- Consumes: `upsertAccommodation` (Task 6), `ItemModalShell` (Task 4), `useTripCacheMutation` (Task 3).
- Produces: `useUpsertAccommodation(tripId)`; pencil on `AccommodationCard`, "Add accommodation" affordance on stops without one.

- [ ] **Step 1: Mutation via the helper (test first)** - patch replaces `stop.accommodation` with the input-mapped domain object.

- [ ] **Step 2: Modal** - fields per `AccommodationInput`: name (required), address + "Find place" (same placesService flow as Task 4, fills lat/lng/place id), check-in / check-out (`<input type="datetime-local">`, serialized to `'YYYY-MM-DD HH:mm'` - the storage format is local-to-trip text by design), confirmation, url, remarks. Component test: edit mode pre-fills; submit maps datetime-local values to the text format.

- [ ] **Step 3: Wire the card** - pencil (edit), and when a stop has no accommodation the panel shows "Add accommodation" opening create mode. Hidden offline.

- [ ] **Step 4: Verify round-trip, commit** - edit the Queenstown accommodation address via place search; pin moves; refresh persists (Req 4.4).

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: accommodation editing with map pin update"
```

---

### Task 8: Trip metadata editing + Slice B ship gate

**Files:**
- Create: `src/components/Editing/TripMetadataFormModal.tsx` + test
- Modify: `src/hooks/useTripLibraryMutations.ts`, `src/pages/TripLibraryPage.tsx`, `src/pages/TripPage.tsx` (edit entry point, e.g. in the UserMenu or a header pencil)

**Interfaces:**
- Consumes: `updateTripMetadata` (Task 6), `tripKeys` (M1).
- Produces: `useUpdateTripMetadata()` - invalidates both `['trips']` and `['trip', tripId]` (the library and the open trip both reflect the change, Req 4.5).

- [ ] **Step 1: Mutation (test first)** - no optimistic cache patch needed (metadata is low-frequency); pending state on the modal + invalidation on success is enough. On error: retry toast, consistent with everything else.

- [ ] **Step 2: Modal** - name (required), description (textarea), start/end date (same `end >= start` validation as M3's create modal). Entry points: an "Edit trip" item in `UserMenu` on the trip page, and a pencil on the library card.

- [ ] **Step 3: Slice B ship gate**

- [ ] Req 4.4: accommodation name/address/check-in/check-out/notes edits persist; pin updates on address change
- [ ] Req 4.5: trip rename + date change appear in the library and the trip page after refresh
- [ ] Update the M4 row: `Slices A-B shipped (<date>)`

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: trip metadata editing"
git add docs/specs/plan_wanderlog-phase-2.md && git commit -m "docs: mark M4 slice B shipped"
```

---

## Slice C - Scenic waypoints + stop restructuring (Req 4.6, 4.7)

### Task 9: Waypoint CRUD (service + mutations + modal)

**Files:**
- Modify: `src/services/supabaseService.ts` + tests, `src/hooks/useTripMutations.ts` + tests, `src/components/Cards/ScenicWaypointCard.tsx`, `src/components/Activities/ActivitiesPanel.tsx`
- Create: `src/components/Editing/WaypointFormModal.tsx` + test

**Interfaces:**
- Produces:

```typescript
export interface WaypointInput {  // ActivityInput minus type
  name: string; lat?: number; lng?: number; address?: string;
  duration?: string; url?: string; remarks?: string;
  thumbnailUrl?: string; googlePlaceId?: string;
}
export function createWaypoint(stopId: string, sortOrder: number, input: WaypointInput): Promise<string>;
export function updateWaypoint(waypointId: string, input: WaypointInput): Promise<void>;
export function deleteWaypoint(waypointId: string): Promise<void>;
```

plus `useCreateWaypoint/useUpdateWaypoint/useDeleteWaypoint(tripId)` hooks.

- [ ] **Step 1: Service functions (test first)** - mirror Task 1 against `scenic_waypoints` (no `type`, no `travel_time_from_accommodation`). Same `insert`/`updateById`/`deleteById` shapes and error tests.

- [ ] **Step 2: Mutations (test first)** - via `useTripCacheMutation`, patching `stop.scenic_waypoints`. The M1 POI waypoint-add cache patch is replaced by `useCreateWaypoint` (persistent now).

- [ ] **Step 3: Modal + wiring** - `WaypointFormModal` = `ActivityFormModal` minus the type select (build it from `ItemModalShell` directly; the two forms stay separate - a shared "generic item form" abstraction for exactly two variants is not worth it). Pencil/trash on `ScenicWaypointCard`, "Add waypoint" in the panel's waypoint section, offline-hidden.

- [ ] **Step 4: Route re-render verification (Req 4.6), commit**

Manual: add a waypoint between two stops - the polyline re-routes through it; delete it - route reverts. This works because `MapContainer`'s directions effect recomputes from `tripData` (cache invalidation triggers it).

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: scenic waypoint crud editing"
```

---

### Task 10: Stop restructuring (Req 4.7)

**Files:**
- Create: `src/utils/stopDateUtils.ts` + test, `src/components/Editing/StopsEditor.tsx` + test, `src/components/Editing/StopFormModal.tsx`
- Modify: `src/services/supabaseService.ts` + tests, `src/hooks/useTripMutations.ts`, `src/pages/TripPage.tsx` (entry point)

**Interfaces:**
- Produces:

```typescript
// pure date cascade - TDD this first
export function recalculateStopDates(stops: TripBase[], tripStartDate: string): TripBase[];
// service
export interface StopInput { name: string; lat: number; lng: number; dateFrom: string; dateTo: string }
export function createStop(tripId: string, sortOrder: number, input: StopInput): Promise<string>;
export function updateStop(stopId: string, patch: Partial<StopInput>): Promise<void>;
export function deleteStop(stopId: string): Promise<void>;
export interface StopStructureRow { id: string; sort_order: number; date_from: string; date_to: string }
export function applyStopStructure(tripId: string, rows: StopStructureRow[], tripStartDate: string, tripEndDate: string): Promise<void>;
```

- [ ] **Step 1: TDD the date cascade**

Rule (design: "date shifts cascade to subsequent stops client-side"): each stop keeps its duration (`date_to - date_from` in days); the chain re-anchors so stop 0 starts at `tripStartDate` and each subsequent stop starts the day its predecessor ends (matching the current data's pattern where checkout day = next check-in day). Tests:

```typescript
it('re-anchors the chain preserving each stop duration', () => {
  const stops = [
    stub({ stop_id: 'a', date: { from: '2025-12-13', to: '2025-12-16' } }),  // 3 nights
    stub({ stop_id: 'b', date: { from: '2025-12-16', to: '2025-12-18' } }),  // 2 nights
  ];
  const result = recalculateStopDates([stops[1], stops[0]], '2025-12-13');  // reordered b, a
  expect(result[0].date).toEqual({ from: '2025-12-13', to: '2025-12-15' }); // b keeps 2 nights
  expect(result[1].date).toEqual({ from: '2025-12-15', to: '2025-12-18' }); // a keeps 3 nights
});
```

Implement with date-fns (`differenceInCalendarDays`, `addDays`, `format`).

- [ ] **Step 2: Service functions (test first)**

`createStop`/`updateStop`/`deleteStop` follow the Task 1 shapes against `stops`. `applyStopStructure` batches the cascade result: per-row `update` of `sort_order`/`date_from`/`date_to` via `Promise.all`, then updates the trip row's `start_date`/`end_date` to the new span. Rule stated in the UI copy and here: **when stops exist, stop restructuring recomputes the trip's date span; direct metadata date edits (Task 8) set the trip dates but never move stops.** Last write wins between the two, by design.

- [ ] **Step 3: StopsEditor**

Entry: "Edit stops" item in the trip page (UserMenu or a pencil on the timeline header). A modal listing stops as dnd-kit sortable rows (reuse the `DraggableActivity` pattern): drag to reorder, per-row pencil (opens `StopFormModal`: name, dates, location via place search - same flow as Task 4), per-row trash (M3 `ConfirmDialog`, warns that the stop's activities/accommodation/waypoints go with it - DB cascade), "Add stop" appends via `StopFormModal` in create mode. Every structural change runs `recalculateStopDates` and shows the resulting date chain before "Save" commits it through one `useApplyStopStructure` mutation (optimistic via the Task 3 helper; patch = reordered/re-dated stops array).

- [ ] **Step 4: Consistency verification (Req 4.7), commit**

Manual: reorder two stops - timeline re-orders, dates cascade, route polyline redraws in the new sequence, weather cards refetch per re-dated base; refresh - persisted; library shows the updated trip date span.

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: stop restructuring with date cascade"
```

---

### Task 11: M4 + Phase 2 verification gate, decommission follow-through

**Files:**
- Modify: `docs/specs/plan_wanderlog-phase-2.md`

- [ ] **Slice C gate:** Req 4.6 (waypoint edits re-route) and Req 4.7 (stop changes update dates/timeline/routes consistently) verified on production
- [ ] **Req 4.9 (LWW):** two browsers edit the same activity name concurrently; the later save wins after both refresh; no error surfaces
- [ ] **Req 4.10:** offline disables every edit affordance added in M4 (activities, accommodation, metadata, waypoints, stops editor)
- [ ] **Req 8.3:** export still downloads well-formed trip JSON including edited data
- [ ] **Post-cutover tail (design):** archive a final Firestore export into the repo (`local/firestore-export/`), then remove `firebase` from `package.json`, delete `src/config/firebase.ts` + `src/services/firebaseService.ts`, and drop the `--skip-firestore` overlay path from the migration script (Req 8.4 - the export happens before the removal, in this order)
- [ ] Update the M4 row: `Shipped (<date>)`; Phase 2 complete

```bash
git add -A
git commit -m "chore: archive firestore export and decommission firebase"
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M4 itinerary editing shipped - phase 2 complete"
```

---

## Self-Review Notes

- Req 4.3 (canonical reorder) shipped in M1; Slice A re-verifies it after the helper refactor rather than rebuilding it.
- The accommodation migration is the only schema change in M4, and it is additive-only - migrated rows get nulls, `buildRows` stays idempotent.
- `ActivityFormModal` and `WaypointFormModal` stay separate components on one `ItemModalShell`; a config-driven generic form for two-and-a-half variants would cost more than it saves.
- Trip-dates-vs-stop-dates policy is stated once (Task 10 Step 2) and encoded nowhere else: stops drive the span on restructure, metadata edits don't move stops, LWW arbitrates.
- Firebase decommission lands here (Task 11) rather than a separate milestone: it only becomes safe once nothing can need a Firestore fallback, which is true after the last slice ships.

## Changelog

- 2026-07-04: Initial plan.
