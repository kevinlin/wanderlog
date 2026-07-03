# Trip Library (Phase 2, M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Authenticated family members browse all trips at `/trips` with derived past/active/upcoming status, open any trip, create new trips, and delete trips with cascade - turning the app from a single-trip viewer into a journal (Requirement 3).

**Architecture:** A `TripLibraryPage` under the existing `ProtectedRoute` renders trip summary cards from the `['trips']` query. Status derivation is a pure function of trip dates and the trip's own timezone. Create/delete are `useMutation` hooks over two new `supabaseService` functions; the DB cascade (M1 schema) does the cleanup. `HomeRedirect` falls back to `/trips` instead of the hardcoded trip id.

**Tech Stack:** react-router v7, TanStack Query v5, @supabase/supabase-js v2, date-fns, Tailwind 4.

## Global Constraints

- Prerequisite: M2 shipped ([plan_p2m2_auth-gate.md](plan_p2m2_auth-gate.md)) - router, `ProtectedRoute`, `UserMenu`, Vercel production all live.
- No schema changes: the M1 tables and their `on delete cascade` FKs already support everything here. RLS's blanket authenticated CRUD covers the new writes.
- New trip ids are client-generated `crypto.randomUUID()` (design: text PKs, natural keys for migrated rows, UUIDs for new rows).
- Domain type `TripData` stays untouched; only `TripSummary` grows fields.
- After every task: `pnpm test:run` and `pnpm build` green. One commit per task.

---

### Task 1: Extend trip summaries with library fields (TDD)

**Files:**
- Modify: `src/types/trip.ts`, `src/contexts/AppStateContext.tsx`, `src/services/supabaseService.ts`, `src/services/__tests__/supabaseService.test.ts`, `src/hooks/useTrips.ts`

**Interfaces:**
- Produces (consumed by every later task):

```typescript
// moves from AppStateContext.tsx to src/types/trip.ts
export interface TripSummary {
  trip_id: string;
  trip_name: string;
  destination: string | null;
  start_date: string;   // YYYY-MM-DD
  end_date: string;     // YYYY-MM-DD
  timezone: string;
  created_at?: string;
  updated_at?: string;
}
```

- [ ] **Step 1: Move the type**

Relocate `TripSummary` from `src/contexts/AppStateContext.tsx` to `src/types/trip.ts` with the three new fields (`destination`, `start_date`, `end_date`). Update all importers (`supabaseService.ts`, `useTrips.ts`); leave a re-export in the context file only if the build shows stragglers - prefer fixing the imports.

- [ ] **Step 2: Update the failing service test**

In `supabaseService.test.ts`, extend the `fetchTripSummaries` expectation:

```typescript
it('fetchTripSummaries maps rows to TripSummary', async () => {
  mockOrder.mockResolvedValue({
    data: [{
      id: 't1', name: 'Trip 1', destination: 'NZ', start_date: '2025-12-13',
      end_date: '2025-12-29', timezone: 'UTC', created_at: 'c', updated_at: 'u',
    }],
    error: null,
  });
  const trips = await fetchTripSummaries();
  expect(trips[0]).toEqual({
    trip_id: 't1', trip_name: 'Trip 1', destination: 'NZ', start_date: '2025-12-13',
    end_date: '2025-12-29', timezone: 'UTC', created_at: 'c', updated_at: 'u',
  });
  expect(chain.select).toHaveBeenCalledWith('id, name, destination, start_date, end_date, timezone, created_at, updated_at');
});
```

Run: `pnpm vitest run src/services/__tests__/supabaseService.test.ts` - expected FAIL.

- [ ] **Step 3: Widen the select and the mapping in `fetchTripSummaries`, re-run to green**

- [ ] **Step 4: Full suite, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: extend trip summaries with destination and date range"
```

---

### Task 2: Trip status derivation (TDD)

**Files:**
- Create: `src/utils/tripStatusUtils.ts`, `src/utils/__tests__/tripStatusUtils.test.ts`

**Interfaces:**
- Produces (consumed by Task 4):

```typescript
export type TripStatus = 'past' | 'active' | 'upcoming';
export function deriveTripStatus(trip: TripSummary, now?: Date): TripStatus;
export function pickHeroTrip(trips: TripSummary[], now?: Date): TripSummary | null;
export function sortForLibrary(trips: TripSummary[]): TripSummary[];  // start_date descending
```

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { deriveTripStatus, pickHeroTrip, sortForLibrary } from '../tripStatusUtils';
import type { TripSummary } from '@/types/trip';

const trip = (overrides: Partial<TripSummary>): TripSummary => ({
  trip_id: 't', trip_name: 'T', destination: null,
  start_date: '2026-01-10', end_date: '2026-01-20', timezone: 'UTC',
  ...overrides,
});

describe('deriveTripStatus', () => {
  const now = new Date('2026-07-03T12:00:00Z');
  it('classifies past, active and upcoming', () => {
    expect(deriveTripStatus(trip({ end_date: '2026-06-01', start_date: '2026-05-20' }), now)).toBe('past');
    expect(deriveTripStatus(trip({ start_date: '2026-07-01', end_date: '2026-07-10' }), now)).toBe('active');
    expect(deriveTripStatus(trip({ start_date: '2026-08-01', end_date: '2026-08-10' }), now)).toBe('upcoming');
  });

  it('evaluates "today" in the trip timezone, not UTC', () => {
    // 2026-07-03T11:00Z is already 2026-07-03 23:00 in Auckland (UTC+12);
    // a trip ending 2026-07-03 in Auckland is still active, not past.
    const nowUtc = new Date('2026-07-03T11:00:00Z');
    const aucklandTrip = trip({ start_date: '2026-07-01', end_date: '2026-07-03', timezone: 'Pacific/Auckland' });
    expect(deriveTripStatus(aucklandTrip, nowUtc)).toBe('active');
    // At 2026-07-03T13:00Z it is 2026-07-04 01:00 in Auckland - now past.
    expect(deriveTripStatus(aucklandTrip, new Date('2026-07-03T13:00:00Z'))).toBe('past');
  });
});

describe('pickHeroTrip', () => {
  const now = new Date('2026-07-03T12:00:00Z');
  it('prefers the active trip', () => {
    const active = trip({ trip_id: 'a', start_date: '2026-07-01', end_date: '2026-07-10' });
    const soon = trip({ trip_id: 'b', start_date: '2026-08-01', end_date: '2026-08-05' });
    expect(pickHeroTrip([soon, active], now)?.trip_id).toBe('a');
  });
  it('falls back to the next upcoming trip by soonest start', () => {
    const later = trip({ trip_id: 'c', start_date: '2026-12-01', end_date: '2026-12-10' });
    const soon = trip({ trip_id: 'b', start_date: '2026-08-01', end_date: '2026-08-05' });
    expect(pickHeroTrip([later, soon], now)?.trip_id).toBe('b');
  });
  it('returns null when only past trips exist', () => {
    expect(pickHeroTrip([trip({ start_date: '2020-01-01', end_date: '2020-01-05' })], now)).toBeNull();
  });
});

describe('sortForLibrary', () => {
  it('orders by start_date descending', () => {
    const trips = [trip({ trip_id: 'old', start_date: '2020-01-01' }), trip({ trip_id: 'new', start_date: '2026-01-01' })];
    expect(sortForLibrary(trips).map((t) => t.trip_id)).toEqual(['new', 'old']);
  });
});
```

- [ ] **Step 2: Run to verify failure, implement**

```typescript
import type { TripSummary } from '@/types/trip';

export type TripStatus = 'past' | 'active' | 'upcoming';

const todayInTimezone = (timezone: string, now: Date): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now); // en-CA yields YYYY-MM-DD; lexicographic compare is safe

export function deriveTripStatus(trip: TripSummary, now: Date = new Date()): TripStatus {
  const today = todayInTimezone(trip.timezone, now);
  if (today > trip.end_date) return 'past';
  if (today < trip.start_date) return 'upcoming';
  return 'active';
}

export function pickHeroTrip(trips: TripSummary[], now: Date = new Date()): TripSummary | null {
  const active = trips.find((t) => deriveTripStatus(t, now) === 'active');
  if (active) return active;
  const upcoming = trips
    .filter((t) => deriveTripStatus(t, now) === 'upcoming')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  return upcoming[0] ?? null;
}

export const sortForLibrary = (trips: TripSummary[]): TripSummary[] =>
  [...trips].sort((a, b) => b.start_date.localeCompare(a.start_date));
```

- [ ] **Step 3: Green, full suite, commit**

```bash
pnpm vitest run src/utils/__tests__/tripStatusUtils.test.ts && pnpm test:run
git add -A && git commit -m "feat: derive trip status in trip-local timezone"
```

---

### Task 3: createTrip / deleteTrip service functions (TDD)

**Files:**
- Modify: `src/services/supabaseService.ts`, `src/services/__tests__/supabaseService.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 6-7):

```typescript
export interface CreateTripInput {
  name: string;
  startDate: string;      // YYYY-MM-DD
  endDate: string;        // YYYY-MM-DD
  destination?: string;
  timezone: string;
}
export function createTrip(input: CreateTripInput): Promise<string>;  // returns new trip id
export function deleteTrip(tripId: string): Promise<void>;
```

- [ ] **Step 1: Write failing tests**

```typescript
const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockDeleteEq = vi.fn().mockResolvedValue({ error: null });
// extend mocked client: insert: mockInsert, delete: vi.fn(() => ({ eq: mockDeleteEq }))

it('createTrip inserts a row with a generated uuid and returns it', async () => {
  const id = await createTrip({
    name: 'Japan', startDate: '2026-10-01', endDate: '2026-10-14',
    destination: 'Japan', timezone: 'Asia/Tokyo',
  });
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  expect(mockInsert).toHaveBeenCalledWith({
    id, name: 'Japan', destination: 'Japan', description: null,
    start_date: '2026-10-01', end_date: '2026-10-14', timezone: 'Asia/Tokyo',
  });
});

it('deleteTrip deletes by id', async () => {
  await deleteTrip('t1');
  expect(mockDeleteEq).toHaveBeenCalledWith('id', 't1');
});

it('createTrip throws on error', async () => {
  mockInsert.mockResolvedValueOnce({ error: { message: 'denied' } });
  await expect(createTrip({ name: 'X', startDate: 'a', endDate: 'b', timezone: 'UTC' })).rejects.toThrow('denied');
});
```

- [ ] **Step 2: Implement**

```typescript
export async function createTrip(input: CreateTripInput): Promise<string> {
  const id = crypto.randomUUID();
  const { error } = await getSupabase().from('trips').insert({
    id,
    name: input.name,
    destination: input.destination ?? null,
    description: null,
    start_date: input.startDate,
    end_date: input.endDate,
    timezone: input.timezone,
  });
  if (error) throw new Error(error.message);
  return id;
}

export async function deleteTrip(tripId: string): Promise<void> {
  const { error } = await getSupabase().from('trips').delete().eq('id', tripId);
  if (error) throw new Error(error.message);
}
```

The DB cascade (M1 schema `on delete cascade`) removes stops, accommodations, activities, and waypoints - no client-side fan-out (Req 3.6).

- [ ] **Step 3: Green, full suite, commit**

```bash
pnpm vitest run src/services/__tests__/supabaseService.test.ts && pnpm test:run
git add -A && git commit -m "feat: add create and delete trip service functions"
```

---

### Task 4: Trip library page

**Files:**
- Create: `src/pages/TripLibraryPage.tsx`, `src/components/TripLibrary/TripLibraryCard.tsx`, `src/pages/__tests__/TripLibraryPage.test.tsx`
- Modify: `src/App.tsx` (route), `src/components/Auth/UserMenu.tsx` (Trips link)
- Delete: `src/components/TripSelectorModal.tsx` (or its actual path), other unwired trip-picker scaffolding

**Interfaces:**
- Consumes: `useTrips` (M1), `deriveTripStatus`/`pickHeroTrip`/`sortForLibrary` (Task 2).
- Produces: route `/trips` (wrapped in `ProtectedRoute`); `TripLibraryCard` with props `{ trip: TripSummary; status: TripStatus; isHero: boolean; onOpen: () => void; onDelete: () => void }`.

- [ ] **Step 1: Audit the unwired scaffolding**

`TripCard.tsx` and `TripSelectorModal.tsx` exist but nothing imports them (pre-M1 groundwork). Read `TripCard`; if its markup fits the card spec below, adapt it in place as `TripLibraryCard`. Delete `TripSelectorModal` either way - the library page replaces the modal-picker concept (per design: "reused where it fits, rebuilt small where it does not").

- [ ] **Step 2: Write failing page test**

```tsx
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it, vi } from 'vitest';

const trips = [
  { trip_id: 'nz', trip_name: 'NZ South Island', destination: 'New Zealand',
    start_date: '2025-12-13', end_date: '2025-12-29', timezone: 'Pacific/Auckland' },
  { trip_id: 'jp', trip_name: 'Japan Spring', destination: 'Japan',
    start_date: '2099-04-01', end_date: '2099-04-14', timezone: 'Asia/Tokyo' },
];
vi.mock('@/hooks/useTrips', () => ({
  useTrips: () => ({ trips, isLoading: false, error: null }),
}));
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ session: { user: { email: 'kev@example.com' } }, isLoading: false, signOut: vi.fn() }),
}));

import { TripLibraryPage } from '../TripLibraryPage';

describe('TripLibraryPage', () => {
  it('lists every trip with name, destination, dates and status', () => {
    render(<MemoryRouter><TripLibraryPage /></MemoryRouter>);
    expect(screen.getByText('NZ South Island')).toBeInTheDocument();
    expect(screen.getByText(/New Zealand/)).toBeInTheDocument();
    expect(screen.getByText(/past/i)).toBeInTheDocument();
    expect(screen.getByText(/upcoming/i)).toBeInTheDocument();
  });

  it('renders the upcoming trip as the hero card', () => {
    render(<MemoryRouter><TripLibraryPage /></MemoryRouter>);
    expect(screen.getByTestId('hero-trip')).toHaveTextContent('Japan Spring');
  });
});
```

- [ ] **Step 3: Implement the page**

- Layout: full-page scroll view on the theme background (`bg-sandy-beige/30`), heading "Our Trips", `UserMenu` top-right, "New trip" primary button (wired in Task 6; render disabled-with-tooltip until then is NOT needed - just render the button and have Task 6 fill the handler; until then it opens nothing).
- Hero card (`data-testid="hero-trip"`): `pickHeroTrip` result, full-width, larger type, status badge.
- Remaining trips from `sortForLibrary` (hero excluded) as a responsive card grid (1-col mobile, 2-3 col desktop).
- Card content: `trip_name`, `destination`, date range via `date-fns` `format` ("13 - 29 Dec 2025" style), status badge - `bg-fern-green` active, `bg-lake-blue` upcoming, `bg-gray-400` past.
- Card click → `navigate(`/trips/${trip.trip_id}`)`.
- Loading state: existing `LoadingSpinner`; error state: existing `ErrorMessage` with retry via query `refetch`.
- Register `/trips` in `App.tsx` inside `ProtectedRoute`; add a "Trips" item to `UserMenu` navigating to `/trips` (gives `TripPage` a way back to the library).

- [ ] **Step 4: Green, full suite, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: add trip library page"
```

---

### Task 5: Home redirect + last-trip restore (Req 3.4)

**Files:**
- Modify: `src/pages/HomeRedirect.tsx`, `src/pages/__tests__/HomeRedirect.test.tsx`, `src/pages/TripPage.tsx`

**Interfaces:**
- Consumes: `getCurrentTripId` (M1 viewStateStorage), `fetchTripById` returning `null` for missing trips (M1).

- [ ] **Step 1: Update the failing test**

`HomeRedirect` test gains a case: `getCurrentTripId` returns `null` → lands on the library route. Update the mock to be settable per-test and assert `/trips` renders a probe element.

- [ ] **Step 2: Implement**

```tsx
export const HomeRedirect = () => {
  const lastTripId = getCurrentTripId();
  return <Navigate to={lastTripId ? `/trips/${lastTripId}` : '/trips'} replace />;
};
```

Remove the `DEFAULT_TRIP_ID` constant (M2 Task 1) - the library is now the fallback. `TripPage` already stores each visited trip via `setCurrentTripId` (M2 Task 1), which satisfies "reopening restores the last selected trip".

- [ ] **Step 3: Handle a stale last-trip id**

If the remembered trip was deleted, `fetchTripById` resolves `null`. In `TripPage`, render a not-found state: "This trip no longer exists" + a link to `/trips`. Test: mock the trip query returning `null`, assert the link renders.

- [ ] **Step 4: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: restore last trip on open, fall back to library"
```

---

### Task 6: Create trip (Req 3.5)

**Files:**
- Create: `src/components/TripLibrary/CreateTripModal.tsx`, `src/hooks/useTripLibraryMutations.ts`, `src/components/TripLibrary/__tests__/CreateTripModal.test.tsx`
- Modify: `src/pages/TripLibraryPage.tsx` (wire the button), `src/pages/TripPage.tsx` (empty state)

**Interfaces:**
- Consumes: `createTrip` (Task 3), `tripKeys` (M1).
- Produces: `useCreateTrip(): UseMutationResult<string, Error, CreateTripInput>` - navigates to the new trip on success.

- [ ] **Step 1: Write failing tests**

```tsx
// CreateTripModal.test.tsx (mock useCreateTrip, render, fill, submit)
it('requires name and a valid date range', async () => {
  // submit with empty name -> validation message, mutation not called
  // end date before start date -> "End date must be after start date", mutation not called
});

it('submits with the browser timezone', async () => {
  // fill name + dates, submit
  expect(mockMutate).toHaveBeenCalledWith(
    expect.objectContaining({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone })
  );
});
```

- [ ] **Step 2: Implement the mutation hook**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { tripKeys } from '@/lib/queryClient';
import { createTrip, type CreateTripInput } from '@/services/supabaseService';

export function useCreateTrip() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (input: CreateTripInput) => createTrip(input),
    onSuccess: (newTripId) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      navigate(`/trips/${newTripId}`);
    },
  });
}
```

- [ ] **Step 3: Implement the modal**

shadcn-style Dialog matching `POIModal`: name (required), destination (optional), start/end date (`<input type="date">`, both required, `endDate >= startDate` validated on submit), timezone auto-filled from `Intl.DateTimeFormat().resolvedOptions().timeZone` (shown as read-only helper text, not an input - YAGNI). Submit pending state; error from the mutation rendered inline. Wire to the Task 4 "New trip" button.

- [ ] **Step 4: Empty-trip hardening**

A new trip has zero stops, and the existing UI assumes `stops[0]` exists (base-select init, map centering, timeline). In `TripPage`, when `tripData.stops.length === 0`, render the map background with an overlay card: "No stops yet - itinerary editing arrives with the next milestone", plus the trip name and a link back to `/trips`. Skip the `SELECT_BASE` init effect and route calculation for empty trips. Test: mock an empty trip, assert no crash and the message renders.

- [ ] **Step 5: Green, full suite, manual round-trip, commit**

Manual: create "Japan Spring 2027" → lands on the empty trip page → library lists it as upcoming.

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: create trips from the library"
```

---

### Task 7: Delete trip with confirmation (Req 3.6)

**Files:**
- Create: `src/components/Layout/ConfirmDialog.tsx`
- Modify: `src/hooks/useTripLibraryMutations.ts`, `src/components/TripLibrary/TripLibraryCard.tsx`, `src/pages/__tests__/TripLibraryPage.test.tsx`

**Interfaces:**
- Consumes: `deleteTrip` (Task 3), `clearPersistedCache` pattern (M2), `getCurrentTripId`/`setCurrentTripId` (M1).
- Produces: `useDeleteTrip(): UseMutationResult<void, Error, string>`; reusable `ConfirmDialog` (`{ title, message, confirmLabel, onConfirm, onCancel }`) - M4 reuses it for item deletes.

- [ ] **Step 1: Write failing tests**

Page test: click the card's delete action → dialog appears with a warning naming the trip → confirm → `deleteTrip` mutation called; cancel → not called.

Hook test: on success, `['trips']` is invalidated, `['trip', id]` is removed from the cache, and a matching `getCurrentTripId()` is cleared.

- [ ] **Step 2: Implement**

```typescript
export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tripId: string) => deleteTrip(tripId),
    onSuccess: (_data, tripId) => {
      queryClient.removeQueries({ queryKey: tripKeys.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      if (getCurrentTripId() === tripId) setCurrentTripId(null);
    },
  });
}
```

`setCurrentTripId(null)` clears the stored id (extend `viewStateStorage` if the M1 signature only accepts strings). `ConfirmDialog`: small centered modal, message like "Delete 'Japan Spring 2027'? All stops, activities, accommodations and waypoints go with it. This cannot be undone.", destructive `bg-red-600` confirm button. Delete affordance on the card: a small trash icon button visible on hover/long-press, `stopPropagation` so it doesn't open the trip.

- [ ] **Step 3: Green, manual cascade check, commit**

Manual: delete a throwaway trip; in the Supabase Table Editor confirm its stops/activities rows are gone (cascade, Req 3.6).

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: delete trips with confirmation and cascade"
```

---

### Task 8: M3 verification gate (Req 3) + sign-off

**Files:**
- Modify: `docs/specs/plan_wanderlog-phase-2.md` (M3 status)

On production, signed in, with at least the migrated NZ trip plus one created trip:

- [ ] Library lists every trip with name, destination, date range, and status badge (Req 3.1)
- [ ] Active-or-next-upcoming trip renders as the hero; the rest ordered by start date (Req 3.2)
- [ ] Opening a trip lands on the full map/timeline/activities UI (Req 3.3)
- [ ] Quit the browser, reopen the app at `/` - it restores the last opened trip (Req 3.4)
- [ ] Create a trip with just a name and dates - it appears in the library and opens without crashing (Req 3.5)
- [ ] Delete the created trip - confirmation required; Supabase Table Editor shows no orphan child rows (Req 3.6)
- [ ] Two or more trips browsable and selectable (milestone gate)

- [ ] **Sign off**

Set the M3 row in `plan_wanderlog-phase-2.md` to `Shipped (<date>)`.

```bash
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M3 trip library shipped"
```

---

## Self-Review Notes

- Status derivation runs in the trip's own timezone (design: "derived status vs today in the trip's timezone") - the Auckland test case pins the UTC-rollover behavior.
- `deleteTrip` needs no optimistic update: the confirm dialog already inserts a deliberate pause, and the library invalidation refetches in one round trip.
- Trip metadata *editing* (name, dates, description) is deliberately absent - that is M4 slice 2 (Req 4.5).
- The Task 4 "New trip" button is inert for one commit until Task 6 wires it. Same reasoning as M2 Task 1: commits are not deploys.
- `TripSummary` moving to `types/trip.ts` touches M1-era imports; the compiler enforces completeness (`tsc -b` in `pnpm build`).

## Changelog

- 2026-07-03: Initial plan.
