# Visit Records - Data Model and Capture (Phase 4, M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ticking an activity or scenic waypoint records when it happened, and a small offline-capable form captures how long it took and how it went (Phase 4 Requirements 1, 2, 5, 6).

**Architecture:** Two nullable columns are added to `activities` and `scenic_waypoints`; nothing existing is converted or dropped. One pure module, `visitRecord.ts`, owns the wall-clock formatting and the "stamp only during the trip" rule, and is shared with `api/` under invariant 5. The whole visit-write contract - optimistic patch, rollback, retry notification - lives at module scope in `visitMutation.ts` so a mutation resumed from IndexedDB after a browser restart runs the identical code, with a per-item mutation `scope` keeping queued writes ordered.

**Tech Stack:** Supabase CLI migrations, @tanstack/react-query v5 (mutation defaults, scope, persistence), React 19, zod v4, Vitest 4, Tailwind 4.

## Global Constraints

- Prerequisites: Phase 2 M4 and Phase 3 M2/M3 shipped. Symbol names below were read from the shipped code; if one has drifted, follow the code and keep row shapes identical to what `supabaseService` writes.
- Column names are `visited_at` (text) and `visit_duration_minutes` (integer). The existing `duration` text column is **never** read, written, or dropped by this milestone (Req 1.3).
- `visited_at` is `'YYYY-MM-DD HH:mm'` local to `trips.timezone`. Never `timestamptz`, never UTC, never ISO-8601 with a `T`.
- Modules reachable from `api/` use relative imports with explicit `.js` extensions and no `@/` aliases (invariant 5). This milestone adds `src/services/visitRecord.ts` to that set.
- All writes go through `useTripCacheMutation` or the module-scope visit mutation - never a raw `useMutation` (invariant 2).
- Migration must be pushed before the frontend deploy that reads the columns. The change is additive, so a rolled-back frontend degrades to hiding visit data.
- Run the full suite with `pnpm test:run`; a single file with `pnpm vitest run <path>`. Husky runs the full suite on commit.
- M2 (planned/visited section split) and M3 (agent check-off) are out of scope. Until M2 lands, visited items keep rendering in the existing single list.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `supabase/migrations/20260726120000_visit_records.sql` | Create | The two additive columns on both item tables. |
| `src/services/visitRecord.ts` | Create | Pure, `api/`-safe: trip-local formatting, the stamp rule, and validation. |
| `src/lib/visitMutation.ts` | Create | The whole visit-write contract at module scope: pure patch, pure revert, mutation defaults, error emitter. |
| `src/lib/mutationDefaults.ts` | Create | Registers the defaults on the shared `queryClient`. Imported for side effect by `main.tsx`. |
| `src/hooks/useVisitRecord.ts` | Create | Per-item hook: key, scope, variables. No callbacks. |
| `src/components/Editing/DurationInput.tsx` | Create | Hours + minutes boxes over a single minutes value. |
| `src/components/Editing/VisitDetailsModal.tsx` | Create | The three-field visit form. |
| `src/components/Activities/ActivityListItem.tsx` | Create | Per-activity container owning the hook and modal state. |
| `src/components/Activities/WaypointListItem.tsx` | Create | Per-waypoint equivalent. |
| `src/services/supabaseMappers.ts` | Modify | Carry the new columns, waypoint order, and the trip's stored dates. |
| `src/services/entityRows.ts` | Modify | New column defs; `timezone` on trip metadata. |
| `src/services/tripWrites.ts` | Modify | `writeVisitFields`; `timezone` on `TripMetadataPatch`. |
| `src/types/trip.ts`, `src/types/map.ts` | Modify | Domain fields. |
| `src/schemas/tripFileSchemas.ts` | Modify | Optional import fields. |
| `src/components/Editing/TripMetadataFormModal.tsx` | Modify | IANA timezone field. |
| `src/components/Layout/Toast.tsx` | Modify | Subscribe to the visit-write error emitter. |
| `src/main.tsx` | Modify | Resume paused mutations; bump the cache buster. |
| `api/_lib/tools/tripFields.ts` | Modify | `timezone` on `update_trip_metadata`. |

---

## Implementation Plan

### Task 1: Schema, row types, and mappers

Adds the columns and makes every field the later tasks depend on reachable from the query cache. `ScenicWaypointRow` is `Omit<ActivityRow, 'type' | 'travel_time_from_accommodation'>` and `WAYPOINT_COLUMNS` derives from `ACTIVITY_COLUMNS`, so activities and waypoints are covered by one edit each.

**Files:**
- Create: `supabase/migrations/20260726120000_visit_records.sql`
- Modify: `src/services/supabaseMappers.ts`, `src/services/entityRows.ts`, `src/types/trip.ts`, `src/types/map.ts`
- Test: `src/services/__tests__/supabaseMappers.test.ts`

**Interfaces:**
- Produces: `Activity.visited_at?: string`, `Activity.visit_duration_minutes?: number`, `ScenicWaypoint.visited_at?: string`, `ScenicWaypoint.visit_duration_minutes?: number`, `ScenicWaypoint.order?: number`, `TripData.start_date?: string`, `TripData.end_date?: string`. Column defs `visitedAt`/`visit_duration_minutes` on `ACTIVITY_COLUMNS`.

- [x] **Step 1: Write the migration**

Create `supabase/migrations/20260726120000_visit_records.sql`:

```sql
-- Phase 4: visit records. Additive only - `duration` keeps the planned
-- estimate (free text, often a range) and is never converted.
alter table activities       add column visited_at             text;
alter table activities       add column visit_duration_minutes integer;
alter table scenic_waypoints add column visited_at             text;
alter table scenic_waypoints add column visit_duration_minutes integer;
```

- [x] **Step 2: Write the failing mapper tests**

Add to `src/services/__tests__/supabaseMappers.test.ts`:

```ts
it('maps visit fields and waypoint order onto the domain', () => {
  const trip = toTripData(
    tripRowWith({
      activities: [activityRow({ id: 'act-1', visited_at: '2026-07-15 14:32', visit_duration_minutes: 80 })],
      scenic_waypoints: [waypointRow({ id: 'wp-1', sort_order: 3, visited_at: null, visit_duration_minutes: null })],
    })
  );
  const [stop] = trip.stops;
  expect(stop.activities[0].visited_at).toBe('2026-07-15 14:32');
  expect(stop.activities[0].visit_duration_minutes).toBe(80);
  expect(stop.scenic_waypoints?.[0].order).toBe(3);
  expect(stop.scenic_waypoints?.[0].visited_at).toBeUndefined();
});

it('carries the trip stored date range into TripData', () => {
  const trip = toTripData(tripRowWith({ start_date: '2026-07-12', end_date: '2026-07-19' }));
  expect(trip.start_date).toBe('2026-07-12');
  expect(trip.end_date).toBe('2026-07-19');
});
```

Use the file's existing row-builder helpers; if it builds rows inline, follow that style instead of introducing new helpers.

- [x] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run src/services/__tests__/supabaseMappers.test.ts`
Expected: FAIL - `visited_at` undefined, `order` undefined, `start_date` undefined.

- [x] **Step 4: Add the domain fields**

In `src/types/trip.ts`, add to `Activity`:

```ts
  visit_duration_minutes?: number;
  visited_at?: string; // 'YYYY-MM-DD HH:mm' local to the trip timezone
```

and to `TripData`:

```ts
  end_date?: string; // YYYY-MM-DD, from the stored trip row
  start_date?: string; // YYYY-MM-DD, from the stored trip row
```

In `src/types/map.ts`, add to `ScenicWaypoint`:

```ts
  order?: number;
  visit_duration_minutes?: number;
  visited_at?: string;
```

- [x] **Step 5: Add the row fields and map them**

In `src/services/supabaseMappers.ts`, add to `ActivityRow` (which `ScenicWaypointRow` derives from):

```ts
  visit_duration_minutes: number | null;
  visited_at: string | null;
```

In `toActivity`, add:

```ts
  visited_at: orNothing(row.visited_at),
  visit_duration_minutes: orNothing(row.visit_duration_minutes),
```

In `toScenicWaypoint`, add the same two lines plus `order: row.sort_order,`.

In `toTripData`, add:

```ts
  start_date: row.start_date,
  end_date: row.end_date,
```

In `buildRows`, write both new columns for activities and waypoints alongside the existing `is_done`:

```ts
        visited_at: activity.visited_at ?? null,
        visit_duration_minutes: activity.visit_duration_minutes ?? null,
```

and the waypoint equivalent using `waypoint.`.

- [x] **Step 6: Add the column defs**

In `src/services/entityRows.ts`, append to `ACTIVITY_COLUMNS`:

```ts
  col('visitedAt', 'visited_at'),
  col('visitDurationMinutes', 'visit_duration_minutes'),
```

`WAYPOINT_COLUMNS` filters only `type`, so both are inherited with no second edit.

- [x] **Step 7: Run the tests to verify they pass**

Run: `pnpm vitest run src/services/__tests__/supabaseMappers.test.ts`
Expected: PASS.

- [x] **Step 8: Apply the migration locally and typecheck**

Run: `supabase db push --local && pnpm build`
Expected: migration applies; `tsc -b` clean.

- [x] **Step 9: Commit**

```bash
git add supabase/migrations src/types src/services/entityRows.ts src/services/supabaseMappers.ts src/services/__tests__/supabaseMappers.test.ts
git commit -m "feat: add visit_at and visit_duration_minutes columns with mapper support"
```

---

### Task 2: The shared `visitRecord` module

The one place that knows what "now, in the trip's timezone" means and when a tick earns a stamp. Pure and `api/`-safe so M3's agent tools call the same functions.

**Files:**
- Create: `src/services/visitRecord.ts`
- Test: `src/services/__tests__/visitRecord.test.ts`

**Interfaces:**
- Produces: `formatTripLocal(now: Date, timeZone: string): string`, `stampIfDuringTrip(input: StampInput): string | null` where `StampInput = { now: Date; timeZone?: string; startDate?: string; endDate?: string }`, `isValidTripLocal(value: string): boolean`.

- [x] **Step 1: Write the failing tests**

Create `src/services/__tests__/visitRecord.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { formatTripLocal, isValidTripLocal, stampIfDuringTrip } from '../visitRecord';

// 2026-07-15T05:32:00Z is 14:32 in Tokyo and 07:32 in Zurich.
const INSTANT = new Date('2026-07-15T05:32:00Z');

describe('formatTripLocal', () => {
  it('renders the instant in the given zone', () => {
    expect(formatTripLocal(INSTANT, 'Asia/Tokyo')).toBe('2026-07-15 14:32');
    expect(formatTripLocal(INSTANT, 'Europe/Zurich')).toBe('2026-07-15 07:32');
  });

  it('renders midnight as 00:xx, never 24:xx', () => {
    // 2026-07-14T15:05:00Z is 00:05 the next day in Tokyo.
    expect(formatTripLocal(new Date('2026-07-14T15:05:00Z'), 'Asia/Tokyo')).toBe('2026-07-15 00:05');
  });

  it('is unaffected by a DST shift', () => {
    // Zurich is UTC+2 in July, UTC+1 in January.
    expect(formatTripLocal(new Date('2026-01-15T12:00:00Z'), 'Europe/Zurich')).toBe('2026-01-15 13:00');
    expect(formatTripLocal(new Date('2026-07-15T12:00:00Z'), 'Europe/Zurich')).toBe('2026-07-15 14:00');
  });
});

describe('stampIfDuringTrip', () => {
  const trip = { timeZone: 'Asia/Tokyo', startDate: '2026-07-12', endDate: '2026-07-19' };

  it('stamps inside the range', () => {
    expect(stampIfDuringTrip({ now: INSTANT, ...trip })).toBe('2026-07-15 14:32');
  });

  it('stamps on both boundary days', () => {
    expect(stampIfDuringTrip({ now: new Date('2026-07-12T01:00:00Z'), ...trip })).toBe('2026-07-12 10:00');
    expect(stampIfDuringTrip({ now: new Date('2026-07-19T01:00:00Z'), ...trip })).toBe('2026-07-19 10:00');
  });

  it('returns null outside the range', () => {
    expect(stampIfDuringTrip({ now: new Date('2026-07-20T01:00:00Z'), ...trip })).toBeNull();
    expect(stampIfDuringTrip({ now: new Date('2026-07-11T01:00:00Z'), ...trip })).toBeNull();
  });

  it('returns null when the trip has no dates or zone', () => {
    expect(stampIfDuringTrip({ now: INSTANT, timeZone: 'Asia/Tokyo' })).toBeNull();
    expect(stampIfDuringTrip({ now: INSTANT, startDate: '2026-07-12', endDate: '2026-07-19' })).toBeNull();
  });

  it('uses the trip zone, not the range interpretation of the device zone', () => {
    // 2026-07-19T20:00:00Z is 20 Jul 05:00 in Tokyo - past the trip end.
    expect(stampIfDuringTrip({ now: new Date('2026-07-19T20:00:00Z'), ...trip })).toBeNull();
  });
});

describe('isValidTripLocal', () => {
  it('accepts a real wall-clock value', () => {
    expect(isValidTripLocal('2026-07-15 14:32')).toBe(true);
  });

  it('rejects bad shapes and impossible dates', () => {
    for (const bad of ['2026-07-15T14:32', '2026-7-15 14:32', '2026-02-30 10:00', '2026-07-15 25:61', '', 'yesterday']) {
      expect(isValidTripLocal(bad)).toBe(false);
    }
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run src/services/__tests__/visitRecord.test.ts`
Expected: FAIL - cannot resolve `../visitRecord`.

- [x] **Step 3: Implement the module**

Create `src/services/visitRecord.ts`:

```ts
// Pure module shared by the browser toggle and the api/ agent tools (Vercel
// Node ESM): no supabase-js, no @/ imports, no browser globals. It owns the
// wall-clock policy so a check-off made in the UI and one made by the agent
// produce the same value.

export interface StampInput {
  endDate?: string;
  now: Date;
  startDate?: string;
  timeZone?: string;
}

// Locale, calendar, numbering and hour cycle are all pinned: passing only
// timeZone leaves the output at the mercy of the runtime locale, which can
// yield non-Latin digits or render midnight as 24:05.
const formatterFor = (timeZone: string): Intl.DateTimeFormat =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    calendar: 'gregory',
    numberingSystem: 'latn',
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

export const formatTripLocal = (now: Date, timeZone: string): string => {
  const parts = new Map(formatterFor(timeZone)
    .formatToParts(now)
    .map((part) => [part.type, part.value]));
  return `${parts.get('year')}-${parts.get('month')}-${parts.get('day')} ${parts.get('hour')}:${parts.get('minute')}`;
};

export const stampIfDuringTrip = ({ now, timeZone, startDate, endDate }: StampInput): string | null => {
  if (!(timeZone && startDate && endDate)) {
    return null;
  }
  const stamp = formatTripLocal(now, timeZone);
  const date = stamp.slice(0, 10);
  return date >= startDate && date <= endDate ? stamp : null;
};

const SHAPE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;

export const isValidTripLocal = (value: string): boolean => {
  if (!SHAPE.test(value)) {
    return false;
  }
  // Round-trip through UTC to reject impossible calendar values: Date would
  // otherwise silently roll 2026-02-30 forward to 2026-03-02.
  const [date, time] = value.split(' ');
  const parsed = new Date(`${date}T${time}:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(`${date}T${time}`);
};
```

- [x] **Step 4: Run the tests to verify they pass**

Run: `pnpm vitest run src/services/__tests__/visitRecord.test.ts`
Expected: PASS, all cases.

- [x] **Step 5: Commit**

```bash
git add src/services/visitRecord.ts src/services/__tests__/visitRecord.test.ts
git commit -m "feat: add shared visitRecord module for trip-local stamping"
```

---

### Task 3: Trip timezone correction

Without this, a TripIt-imported trip carries the importing device's zone and stamps every visit in the wrong one, silently. `TRIP_METADATA_COLUMNS` is shared, so adding the column def carries `timezone` to both the browser mutation and the agent tool.

**Files:**
- Modify: `src/services/entityRows.ts`, `src/services/tripWrites.ts`, `src/components/Editing/TripMetadataFormModal.tsx`, `api/_lib/tools/tripFields.ts`
- Test: `src/services/__tests__/visitRecord.test.ts` (extend), `src/components/Editing/__tests__/TripMetadataFormModal.test.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `isValidTimeZone(value: string): boolean` exported from `src/services/visitRecord.ts`; `TripMetadataPatch.timezone?: string`.

- [x] **Step 1: Write the failing validator test**

Add to `src/services/__tests__/visitRecord.test.ts`:

```ts
describe('isValidTimeZone', () => {
  it('accepts IANA zone names', () => {
    expect(isValidTimeZone('Asia/Tokyo')).toBe(true);
    expect(isValidTimeZone('Europe/Zurich')).toBe(true);
    expect(isValidTimeZone('UTC')).toBe(true);
  });

  it('rejects anything the runtime does not know', () => {
    for (const bad of ['Mars/Olympus', 'GMT+8', '', 'Tokyo']) {
      expect(isValidTimeZone(bad)).toBe(false);
    }
  });
});
```

Add `isValidTimeZone` to the import at the top of the file.

- [x] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/services/__tests__/visitRecord.test.ts -t isValidTimeZone`
Expected: FAIL - `isValidTimeZone is not a function`.

- [x] **Step 3: Implement the validator**

Append to `src/services/visitRecord.ts`:

```ts
export const isValidTimeZone = (value: string): boolean => {
  if (!value) {
    return false;
  }
  try {
    // Throws RangeError on an unknown zone in both the browser and Node.
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format();
    return true;
  } catch {
    return false;
  }
};
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/services/__tests__/visitRecord.test.ts -t isValidTimeZone`
Expected: PASS.

- [x] **Step 5: Carry timezone through the shared write layer**

In `src/services/entityRows.ts`, append to `TRIP_METADATA_COLUMNS`:

```ts
  col('timezone'),
```

In `src/services/tripWrites.ts`, add to `TripMetadataPatch`:

```ts
  timezone?: string;
```

- [x] **Step 6: Write the failing modal test**

Add to `src/components/Editing/__tests__/TripMetadataFormModal.test.tsx` (create it following the sibling modal tests if absent):

```tsx
it('saves a corrected timezone', async () => {
  const user = userEvent.setup();
  renderModal({ trip: { ...tripSummary, timezone: 'Asia/Singapore' } });

  const field = screen.getByLabelText(/timezone/i);
  await user.clear(field);
  await user.type(field, 'Europe/Zurich');
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(mutate).toHaveBeenCalledWith(
    expect.objectContaining({ patch: expect.objectContaining({ timezone: 'Europe/Zurich' }) }),
    expect.anything()
  );
});

it('rejects an unknown timezone without saving', async () => {
  const user = userEvent.setup();
  renderModal({ trip: tripSummary });

  const field = screen.getByLabelText(/timezone/i);
  await user.clear(field);
  await user.type(field, 'Mars/Olympus');
  await user.click(screen.getByRole('button', { name: /save/i }));

  expect(screen.getByText(/not a recognised timezone/i)).toBeInTheDocument();
  expect(mutate).not.toHaveBeenCalled();
});
```

- [x] **Step 7: Run to verify it fails**

Run: `pnpm vitest run src/components/Editing/__tests__/TripMetadataFormModal.test.tsx`
Expected: FAIL - no timezone field.

- [x] **Step 8: Add the field to the modal**

In `src/components/Editing/TripMetadataFormModal.tsx`, add state beside the existing fields:

```tsx
  const [timezone, setTimezone] = useState(trip.timezone);
```

Extend `handleSubmit`'s validation, before the existing mutate call:

```tsx
    if (!isValidTimeZone(timezone.trim())) {
      setValidationError('That is not a recognised timezone. Use an IANA name such as Asia/Tokyo.');
      return;
    }
```

Add `timezone: timezone.trim(),` to the `patch` object, and render the input alongside the existing ones, matching their markup:

```tsx
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700 text-sm">Timezone</span>
          <input
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal/30"
            list="iana-timezones"
            onChange={(event) => setTimezone(event.target.value)}
            value={timezone}
          />
          <datalist id="iana-timezones">
            {(Intl.supportedValuesOf?.('timeZone') ?? []).map((zone) => (
              <option key={zone} value={zone} />
            ))}
          </datalist>
        </label>
```

Import `isValidTimeZone` from `@/services/visitRecord`.

- [x] **Step 9: Add timezone to the agent tool**

In `api/_lib/tools/tripFields.ts`, add to `updateTripMetadataSchema`'s object:

```ts
    timezone: z.string().refine(isValidTimeZone, { message: 'must be an IANA timezone name' }).optional(),
```

Import it with the shared-module convention: `import { isValidTimeZone } from '../../../src/services/visitRecord.js';`. Add `timezone` to the tool's `description` field list.

- [x] **Step 10: Run the tests to verify they pass**

Run: `pnpm vitest run src/components/Editing/__tests__/TripMetadataFormModal.test.tsx src/services/__tests__/visitRecord.test.ts`
Expected: PASS.

- [x] **Step 11: Commit**

```bash
git add src/services src/components/Editing api/_lib/tools/tripFields.ts
git commit -m "feat: make trip timezone correctable from metadata and the agent"
```

---

### Task 4: The visit write contract at module scope

Everything a visit write does lives here, with no React in scope, so a mutation rebuilt by hydration after a browser restart executes the same code as one created live.

**Files:**
- Create: `src/lib/visitMutation.ts`
- Modify: `src/services/tripWrites.ts`, `src/services/supabaseService.ts`
- Test: `src/lib/__tests__/visitMutation.test.ts`

**Interfaces:**
- Consumes: `tripKeys.detail` from `@/lib/queryClient`; `Activity`/`ScenicWaypoint` domain fields from Task 1.
- Produces:
  - `VisitVariables = { tripId: string; itemId: string; isWaypoint: boolean; isDone?: boolean; visitedAt?: string | null; visitDurationMinutes?: number | null; remarks?: string | null }`
  - `VisitContext = { itemId: string; previous: { is_done: boolean; visited_at?: string; visit_duration_minutes?: number; remarks?: string } | null }`
  - `applyVisitPatch(trip: TripData, vars: VisitVariables): TripData`
  - `revertVisitPatch(trip: TripData, context: VisitContext): TripData`
  - `buildVisitMutationDefaults(queryClient: QueryClient)` returning `{ mutationFn, onMutate, onError, onSettled }`
  - `snapshotVisit(trip: TripData | undefined, itemId: string): VisitSnapshot | null`
  - `onVisitWriteError(listener: (failure: { variables: VisitVariables }) => void): () => void`
  - `VISIT_MUTATION_KEY = ['visit-record']`
  - `writeVisitFields(client, table, id, fields)` in `tripWrites`, plus its `supabaseService` binding.

- [x] **Step 1: Write the failing pure-function tests**

Create `src/lib/__tests__/visitMutation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { applyVisitPatch, revertVisitPatch } from '../visitMutation';
import type { TripData } from '@/types/trip';

const trip = (): TripData => ({
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  start_date: '2026-07-12',
  end_date: '2026-07-19',
  stops: [
    {
      stop_id: 'stop-1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 35.6, lng: 139.7 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', remarks: 'book ahead', status: { done: false } }],
      scenic_waypoints: [{ activity_id: 'wp-1', activity_name: 'Lake', location: {}, status: { done: false } }],
    },
  ],
});

describe('applyVisitPatch', () => {
  it('sets only the supplied fields on the named activity', () => {
    const next = applyVisitPatch(trip(), {
      tripId: 't1',
      itemId: 'act-1',
      isWaypoint: false,
      isDone: true,
      visitedAt: '2026-07-15 14:32',
    });
    const activity = next.stops[0].activities[0];
    expect(activity.status).toEqual({ done: true });
    expect(activity.visited_at).toBe('2026-07-15 14:32');
    expect(activity.remarks).toBe('book ahead');
  });

  it('clears visited_at when passed null', () => {
    const started = applyVisitPatch(trip(), { tripId: 't1', itemId: 'act-1', isWaypoint: false, visitedAt: '2026-07-15 14:32' });
    const cleared = applyVisitPatch(started, { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: false, visitedAt: null });
    expect(cleared.stops[0].activities[0].visited_at).toBeUndefined();
  });

  it('patches waypoints too', () => {
    const next = applyVisitPatch(trip(), { tripId: 't1', itemId: 'wp-1', isWaypoint: true, isDone: true, visitDurationMinutes: 20 });
    expect(next.stops[0].scenic_waypoints?.[0].visit_duration_minutes).toBe(20);
  });
});

describe('revertVisitPatch', () => {
  it('restores the captured prior values', () => {
    const before = trip();
    const after = applyVisitPatch(before, {
      tripId: 't1',
      itemId: 'act-1',
      isWaypoint: false,
      isDone: true,
      visitedAt: '2026-07-15 14:32',
      remarks: 'queue was long',
    });
    const restored = revertVisitPatch(after, {
      itemId: 'act-1',
      previous: { is_done: false, visited_at: undefined, visit_duration_minutes: undefined, remarks: 'book ahead' },
    });
    const activity = restored.stops[0].activities[0];
    expect(activity.status).toEqual({ done: false });
    expect(activity.visited_at).toBeUndefined();
    expect(activity.remarks).toBe('book ahead');
  });

  it('is a no-op when there is no snapshot', () => {
    const current = trip();
    expect(revertVisitPatch(current, { itemId: 'act-1', previous: null })).toEqual(current);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/visitMutation.test.ts`
Expected: FAIL - cannot resolve `../visitMutation`.

- [x] **Step 3: Add the write function**

In `src/services/tripWrites.ts`, replace `setActivityDone` and `setWaypointDone` with:

```ts
export interface VisitFields {
  is_done?: boolean;
  remarks?: string | null;
  visit_duration_minutes?: number | null;
  visited_at?: string | null;
}

// One write for both gestures: the checkbox sends is_done + visited_at, the
// details form sends the three detail fields. Absent keys are left alone.
export const writeVisitFields = (
  client: SupabaseClient,
  table: 'activities' | 'scenic_waypoints',
  id: string,
  fields: VisitFields
): Promise<void> => updateById(client, table, id, fields as Record<string, unknown>);
```

In `src/services/supabaseService.ts`, replace the `setActivityDone`/`setWaypointDone` bindings with:

```ts
export const writeVisitFields = (table: 'activities' | 'scenic_waypoints', id: string, fields: writes.VisitFields): Promise<void> =>
  writes.writeVisitFields(getSupabase(), table, id, fields);
```

- [x] **Step 4: Implement `visitMutation.ts`**

Create `src/lib/visitMutation.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query';
import { tripKeys } from '@/lib/queryClient';
import { writeVisitFields } from '@/services/supabaseService';
import type { Activity } from '@/types/trip';
import type { TripData } from '@/types/trip';

export const VISIT_MUTATION_KEY = ['visit-record'] as const;

export interface VisitVariables {
  isDone?: boolean;
  isWaypoint: boolean;
  itemId: string;
  remarks?: string | null;
  tripId: string;
  visitDurationMinutes?: number | null;
  visitedAt?: string | null;
}

export interface VisitSnapshot {
  is_done: boolean;
  remarks?: string;
  visit_duration_minutes?: number;
  visited_at?: string;
}

export interface VisitContext {
  itemId: string;
  previous: VisitSnapshot | null;
}

type VisitItem = Activity | NonNullable<TripData['stops'][number]['scenic_waypoints']>[number];

const findItem = (trip: TripData, itemId: string): VisitItem | undefined => {
  for (const stop of trip.stops) {
    const match = [...stop.activities, ...(stop.scenic_waypoints ?? [])].find((item) => item.activity_id === itemId);
    if (match) {
      return match;
    }
  }
  return undefined;
};

// undefined means "not supplied, leave alone"; null means "clear it".
const assign = <T>(current: T | undefined, next: T | null | undefined): T | undefined =>
  next === undefined ? current : (next ?? undefined);

export const snapshotVisit = (trip: TripData | undefined, itemId: string): VisitSnapshot | null => {
  const item = trip && findItem(trip, itemId);
  if (!item) {
    return null;
  }
  return {
    is_done: item.status?.done ?? false,
    visited_at: item.visited_at,
    visit_duration_minutes: item.visit_duration_minutes,
    remarks: item.remarks,
  };
};

export const applyVisitPatch = (trip: TripData, vars: VisitVariables): TripData => {
  const next = structuredClone(trip);
  const item = findItem(next, vars.itemId);
  if (!item) {
    return next;
  }
  if (vars.isDone !== undefined) {
    item.status = { done: vars.isDone };
  }
  item.visited_at = assign(item.visited_at, vars.visitedAt);
  item.visit_duration_minutes = assign(item.visit_duration_minutes, vars.visitDurationMinutes);
  item.remarks = assign(item.remarks, vars.remarks);
  return next;
};

export const revertVisitPatch = (trip: TripData, context: VisitContext): TripData => {
  if (!context.previous) {
    return trip;
  }
  const next = structuredClone(trip);
  const item = findItem(next, context.itemId);
  if (!item) {
    return next;
  }
  item.status = { done: context.previous.is_done };
  item.visited_at = context.previous.visited_at;
  item.visit_duration_minutes = context.previous.visit_duration_minutes;
  item.remarks = context.previous.remarks;
  return next;
};

// Module-scope bridge: a mutation resumed from IndexedDB runs outside React,
// so it cannot reach the toast provider. ToastProvider subscribes to this.
type VisitErrorListener = (failure: { variables: VisitVariables }) => void;
const listeners = new Set<VisitErrorListener>();

export const onVisitWriteError = (listener: VisitErrorListener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const toRow = (vars: VisitVariables) => ({
  ...(vars.isDone !== undefined && { is_done: vars.isDone }),
  ...(vars.visitedAt !== undefined && { visited_at: vars.visitedAt }),
  ...(vars.visitDurationMinutes !== undefined && { visit_duration_minutes: vars.visitDurationMinutes }),
  ...(vars.remarks !== undefined && { remarks: vars.remarks }),
});

// Every callback lives here, not in a hook closure, so the live path and the
// path resumed after a restart are the same code (Phase 4 Req 5.4).
export const buildVisitMutationDefaults = (queryClient: QueryClient) => ({
  mutationFn: (vars: VisitVariables) => writeVisitFields(vars.isWaypoint ? 'scenic_waypoints' : 'activities', vars.itemId, toRow(vars)),
  onMutate: async (vars: VisitVariables): Promise<VisitContext> => {
    await queryClient.cancelQueries({ queryKey: tripKeys.detail(vars.tripId) });
    const current = queryClient.getQueryData<TripData>(tripKeys.detail(vars.tripId));
    const previous = snapshotVisit(current, vars.itemId);
    queryClient.setQueryData<TripData>(tripKeys.detail(vars.tripId), (old) => (old ? applyVisitPatch(old, vars) : old));
    return { itemId: vars.itemId, previous };
  },
  onError: (_error: Error, vars: VisitVariables, context: VisitContext | undefined) => {
    if (context) {
      queryClient.setQueryData<TripData>(tripKeys.detail(vars.tripId), (old) => (old ? revertVisitPatch(old, context) : old));
    }
    for (const listener of listeners) {
      listener({ variables: vars });
    }
  },
  onSettled: (_data: void, _error: Error | null, vars: VisitVariables) =>
    queryClient.invalidateQueries({ queryKey: tripKeys.detail(vars.tripId) }),
});
```

- [x] **Step 5: Run to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/visitMutation.test.ts`
Expected: PASS.

- [x] **Step 6: Fix the now-broken callers**

`setActivityDone`/`setWaypointDone` are gone. Run `pnpm build` and update every compile error - `useTripMutations.ts` (`useToggleActivityDone`) and its tests are the expected ones. Leave `useToggleActivityDone` in place for now; Task 7 removes it.

Run: `pnpm build`
Expected: clean.

- [x] **Step 7: Commit**

```bash
git add src/lib/visitMutation.ts src/lib/__tests__/visitMutation.test.ts src/services/tripWrites.ts src/services/supabaseService.ts src/hooks src/services/__tests__
git commit -m "feat: add module-scope visit write contract with pure patch and revert"
```

---

### Task 5: Registration, restart resume, and the toast bridge

Three small wirings that together make Req 5.3 true: without them a queued write is persisted to IndexedDB and never runs again.

**Files:**
- Create: `src/lib/mutationDefaults.ts`
- Modify: `src/main.tsx`, `src/components/Layout/Toast.tsx`
- Test: `src/lib/__tests__/visitResume.test.ts`

**Interfaces:**
- Consumes: `buildVisitMutationDefaults`, `VISIT_MUTATION_KEY`, `onVisitWriteError` from Task 4.
- Produces: `registerMutationDefaults(queryClient: QueryClient): void`.

- [x] **Step 1: Write the failing resume test**

Create `src/lib/__tests__/visitResume.test.ts`:

```ts
import { QueryClient } from '@tanstack/react-query';
import { dehydrate, hydrate } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '../mutationDefaults';
import { onVisitWriteError, VISIT_MUTATION_KEY, type VisitVariables } from '../visitMutation';
import { tripKeys } from '../queryClient';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

const vars: VisitVariables = { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' };

const tripWith = (done: boolean, visitedAt?: string) => ({
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', status: { done }, visited_at: visitedAt }],
    },
  ],
});

const clientWithTrip = () => {
  const client = new QueryClient();
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), tripWith(false));
  return client;
};

describe('resumed visit mutations', () => {
  beforeEach(() => {
    writeVisitFields.mockReset();
  });

  it('runs the write after a dehydrate/hydrate cycle', async () => {
    const source = clientWithTrip();
    // Pause by going offline, so the mutation dehydrates as paused.
    source.getMutationCache().build(source, { mutationKey: [...VISIT_MUTATION_KEY] }, {
      context: undefined,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: 'pending',
      submittedAt: 1,
      variables: vars,
    });

    const restored = clientWithTrip();
    hydrate(restored, dehydrate(source));
    writeVisitFields.mockResolvedValue(undefined);

    await restored.resumePausedMutations();

    expect(writeVisitFields).toHaveBeenCalledWith('activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' });
  });

  it('rolls the cache back and notifies when a resumed write fails', async () => {
    const source = clientWithTrip();
    source.setQueryData(tripKeys.detail('t1'), tripWith(true, '2026-07-15 14:32'));
    source.getMutationCache().build(source, { mutationKey: [...VISIT_MUTATION_KEY] }, {
      context: { itemId: 'act-1', previous: { is_done: false, visited_at: undefined, visit_duration_minutes: undefined, remarks: undefined } },
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: 'pending',
      submittedAt: 1,
      variables: vars,
    });

    const restored = clientWithTrip();
    restored.setQueryData(tripKeys.detail('t1'), tripWith(true, '2026-07-15 14:32'));
    hydrate(restored, dehydrate(source));

    const seen: VisitVariables[] = [];
    onVisitWriteError(({ variables }) => seen.push(variables));
    writeVisitFields.mockRejectedValue(new Error('offline'));

    await restored.resumePausedMutations().catch(() => undefined);

    const trip = restored.getQueryData<ReturnType<typeof tripWith>>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities[0].status.done).toBe(false);
    expect(trip?.stops[0].activities[0].visited_at).toBeUndefined();
    expect(seen).toHaveLength(1);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/lib/__tests__/visitResume.test.ts`
Expected: FAIL - cannot resolve `../mutationDefaults`.

- [x] **Step 3: Implement the registration**

Create `src/lib/mutationDefaults.ts`:

```ts
import type { QueryClient } from '@tanstack/react-query';
import { buildVisitMutationDefaults, VISIT_MUTATION_KEY } from '@/lib/visitMutation';

// Hydration rebuilds a mutation through defaultMutationOptions, which recovers
// its callbacks only via getMutationDefaults(mutationKey). Without this a write
// queued offline is persisted and then never runs again.
export const registerMutationDefaults = (queryClient: QueryClient): void => {
  queryClient.setMutationDefaults([...VISIT_MUTATION_KEY], buildVisitMutationDefaults(queryClient));
};
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/lib/__tests__/visitResume.test.ts`
Expected: PASS - both the write firing and the rollback-plus-notify case.

- [x] **Step 5: Wire the app entry point**

In `src/main.tsx`, register the defaults and resume on restore, and bump the buster because the cached trip shape changed:

```tsx
import { registerMutationDefaults } from '@/lib/mutationDefaults';

registerMutationDefaults(queryClient);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      onSuccess={() => queryClient.resumePausedMutations()}
      persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: 'phase4-v1' }}
    >
```

- [x] **Step 6: Subscribe the toast provider**

In `src/components/Layout/Toast.tsx`, inside `ToastProvider`, below the existing `showToast` callback:

```tsx
  // Resumed writes run outside React and cannot call showToast directly.
  useEffect(
    () =>
      onVisitWriteError(({ variables }) => {
        showToast({
          message: 'Could not save your visit note',
          type: 'error',
          action: { label: 'Retry', onClick: () => queryClient.getMutationCache().build(queryClient, { mutationKey: [...VISIT_MUTATION_KEY] }).execute(variables) },
        });
      }),
    [showToast]
  );
```

Import `useEffect` from react, `onVisitWriteError` and `VISIT_MUTATION_KEY` from `@/lib/visitMutation`, and `queryClient` from `@/lib/queryClient`.

- [x] **Step 7: Run the full suite**

Run: `pnpm test:run`
Expected: PASS.

- [x] **Step 8: Commit**

```bash
git add src/lib/mutationDefaults.ts src/lib/__tests__/visitResume.test.ts src/main.tsx src/components/Layout/Toast.tsx
git commit -m "feat: resume queued visit writes after restart and surface failures"
```

---

### Task 6: DurationInput and VisitDetailsModal

The form itself. Deliberately carries no `min`/`max` on the date input: `ItemModalShell` submits through a native `<form>`, so a violated constraint would block the submit that Req 2.9 requires to succeed.

**Files:**
- Create: `src/components/Editing/DurationInput.tsx`, `src/components/Editing/VisitDetailsModal.tsx`
- Modify: `src/components/Editing/index.ts`
- Test: `src/components/Editing/__tests__/VisitDetailsModal.test.tsx`

**Interfaces:**
- Consumes: `formatTripLocal`, `isValidTripLocal` (Task 2); `useVisitRecord` (Task 7) is injected as an `onSave` prop so this task is testable before Task 7 exists.
- Produces: `<DurationInput minutes={number | undefined} onChange={(minutes: number | undefined) => void} />`; `<VisitDetailsModal item isOpen onClose onSave tripTimezone tripStartDate tripEndDate />` where `onSave: (fields: { visitedAt: string | null; visitDurationMinutes: number | null; remarks: string | null }) => void`.

- [x] **Step 1: Write the failing modal tests**

Create `src/components/Editing/__tests__/VisitDetailsModal.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { VisitDetailsModal } from '../VisitDetailsModal';

const item = { activity_id: 'act-1', activity_name: 'Museum', visited_at: '2026-07-15 09:10', visit_duration_minutes: 90, remarks: 'early start' };

const renderModal = (overrides = {}) => {
  const onSave = vi.fn();
  render(
    <VisitDetailsModal
      isOpen
      item={item}
      onClose={vi.fn()}
      onSave={onSave}
      tripEndDate="2026-07-19"
      tripStartDate="2026-07-12"
      tripTimezone="Asia/Tokyo"
      {...overrides}
    />
  );
  return { onSave };
};

describe('VisitDetailsModal', () => {
  it('prefills every field from the stored values', () => {
    renderModal();
    expect(screen.getByLabelText(/date/i)).toHaveValue('2026-07-15');
    expect(screen.getByLabelText(/^time/i)).toHaveValue('09:10');
    expect(screen.getByLabelText(/hours/i)).toHaveValue(1);
    expect(screen.getByLabelText(/minutes/i)).toHaveValue(30);
    expect(screen.getByLabelText(/notes/i)).toHaveValue('early start');
  });

  it('saves an out-of-range date with a warning rather than blocking', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.clear(screen.getByLabelText(/date/i));
    await user.type(screen.getByLabelText(/date/i), '2026-07-25');
    expect(screen.getByText(/outside this trip/i)).toBeInTheDocument();

    // Clicking the real button exercises native form validation; calling the
    // submit handler directly would not catch a min/max regression.
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({
      visitedAt: '2026-07-25 09:10',
      visitDurationMinutes: 90,
      remarks: 'early start',
    });
  });

  it('sends nulls when the fields are cleared', async () => {
    const user = userEvent.setup();
    const { onSave } = renderModal();

    await user.clear(screen.getByLabelText(/date/i));
    await user.clear(screen.getByLabelText(/hours/i));
    await user.clear(screen.getByLabelText(/minutes/i));
    await user.clear(screen.getByLabelText(/notes/i));
    await user.click(screen.getByRole('button', { name: /save/i }));

    expect(onSave).toHaveBeenCalledWith({ visitedAt: null, visitDurationMinutes: null, remarks: null });
  });

  it('defaults the date and time to now in the trip zone when unset', () => {
    renderModal({ item: { activity_id: 'act-2', activity_name: 'Ramen' } });
    expect(screen.getByLabelText(/date/i)).toHaveValue(expect.any(String));
    expect((screen.getByLabelText(/date/i) as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/components/Editing/__tests__/VisitDetailsModal.test.tsx`
Expected: FAIL - cannot resolve `../VisitDetailsModal`.

- [x] **Step 3: Implement DurationInput**

Create `src/components/Editing/DurationInput.tsx`:

```tsx
const MINUTES_PER_HOUR = 60;

interface DurationInputProps {
  minutes: number | undefined;
  onChange: (minutes: number | undefined) => void;
}

// Two boxes over one integer. Planned `duration` stays free text elsewhere;
// this only ever edits visit_duration_minutes.
export const DurationInput = ({ minutes, onChange }: DurationInputProps) => {
  const hoursValue = minutes === undefined ? '' : Math.floor(minutes / MINUTES_PER_HOUR);
  const minutesValue = minutes === undefined ? '' : minutes % MINUTES_PER_HOUR;

  const update = (nextHours: number | '', nextMinutes: number | '') => {
    if (nextHours === '' && nextMinutes === '') {
      onChange(undefined);
      return;
    }
    onChange((Number(nextHours) || 0) * MINUTES_PER_HOUR + (Number(nextMinutes) || 0));
  };

  const box = 'w-20 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal/30';

  return (
    <div className="flex items-end gap-3">
      <label className="block">
        <span className="mb-1 block font-medium text-gray-700 text-sm">Hours</span>
        <input
          className={box}
          min={0}
          onChange={(event) => update(event.target.value === '' ? '' : Number(event.target.value), minutesValue)}
          type="number"
          value={hoursValue}
        />
      </label>
      <label className="block">
        <span className="mb-1 block font-medium text-gray-700 text-sm">Minutes</span>
        <input
          className={box}
          max={59}
          min={0}
          onChange={(event) => update(hoursValue, event.target.value === '' ? '' : Number(event.target.value))}
          type="number"
          value={minutesValue}
        />
      </label>
    </div>
  );
};
```

- [x] **Step 4: Implement VisitDetailsModal**

Create `src/components/Editing/VisitDetailsModal.tsx`:

```tsx
import { useState } from 'react';
import { DurationInput } from '@/components/Editing/DurationInput';
import { ItemModalShell } from '@/components/Editing/ItemModalShell';
import { formatTripLocal } from '@/services/visitRecord';

export interface VisitFormValues {
  remarks: string | null;
  visitDurationMinutes: number | null;
  visitedAt: string | null;
}

interface VisitItem {
  activity_id: string;
  activity_name: string;
  remarks?: string;
  visit_duration_minutes?: number;
  visited_at?: string;
}

interface VisitDetailsModalProps {
  isOpen: boolean;
  item: VisitItem;
  onClose: () => void;
  onSave: (values: VisitFormValues) => void;
  tripEndDate?: string;
  tripStartDate?: string;
  tripTimezone: string;
}

const field = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-alpine-teal focus:outline-hidden focus:ring-1 focus:ring-alpine-teal/30';

export const VisitDetailsModal = ({ item, isOpen, onClose, onSave, tripTimezone, tripStartDate, tripEndDate }: VisitDetailsModalProps) => {
  const fallback = formatTripLocal(new Date(), tripTimezone);
  const stored = item.visited_at ?? fallback;
  const [date, setDate] = useState(stored.slice(0, 10));
  const [time, setTime] = useState(stored.slice(11, 16));
  const [minutes, setMinutes] = useState(item.visit_duration_minutes);
  const [notes, setNotes] = useState(item.remarks ?? '');

  // Deliberately no min/max on the date input: ItemModalShell submits through a
  // native <form>, and constraint validation would block the out-of-range save
  // that Req 2.9 requires to succeed. The range is guidance, not a gate.
  const outOfRange = Boolean(date && tripStartDate && tripEndDate && (date < tripStartDate || date > tripEndDate));

  const handleSubmit = () => {
    onSave({
      visitedAt: date ? `${date} ${time || '00:00'}` : null,
      visitDurationMinutes: minutes ?? null,
      remarks: notes.trim() || null,
    });
    onClose();
  };

  return (
    <ItemModalShell isOpen={isOpen} onClose={onClose} onSubmit={handleSubmit} title={`Visit: ${item.activity_name}`}>
      <div className="flex gap-3">
        <label className="block flex-1">
          <span className="mb-1 block font-medium text-gray-700 text-sm">Date</span>
          <input aria-describedby="visit-date-help" className={field} onChange={(event) => setDate(event.target.value)} type="date" value={date} />
        </label>
        <label className="block">
          <span className="mb-1 block font-medium text-gray-700 text-sm">Time</span>
          <input className={field} onChange={(event) => setTime(event.target.value)} type="time" value={time} />
        </label>
      </div>
      <p className="text-gray-500 text-xs" id="visit-date-help">
        {tripStartDate && tripEndDate ? `This trip runs ${tripStartDate} to ${tripEndDate}.` : 'This trip has no stored date range.'}
      </p>
      {outOfRange && <p className="text-amber-600 text-sm">That date is outside this trip. Saving it anyway.</p>}

      <DurationInput minutes={minutes} onChange={setMinutes} />

      <label className="block">
        <span className="mb-1 block font-medium text-gray-700 text-sm">Notes</span>
        <textarea className={field} onChange={(event) => setNotes(event.target.value)} rows={3} value={notes} />
      </label>
    </ItemModalShell>
  );
};
```

Add both components to `src/components/Editing/index.ts`.

- [x] **Step 5: Run to verify it passes**

Run: `pnpm vitest run src/components/Editing/__tests__/VisitDetailsModal.test.tsx`
Expected: PASS, including the out-of-range save.

- [x] **Step 6: Commit**

```bash
git add src/components/Editing
git commit -m "feat: add visit details modal with hours and minutes duration entry"
```

---

### Task 7: Per-item containers, the hook, and card rendering

The per-item container is what makes the mutation `scope` per item, which is what keeps a tick and a details save queued offline against the same item from racing. It also removes `useToggleActivityDone`.

**Files:**
- Create: `src/hooks/useVisitRecord.ts`, `src/components/Activities/ActivityListItem.tsx`, `src/components/Activities/WaypointListItem.tsx`
- Modify: `src/components/Activities/DraggableActivity.tsx`, `src/components/Activities/ActivitiesPanel.tsx`, `src/components/Cards/ActivityCard.tsx`, `src/components/Cards/ScenicWaypointCard.tsx`, `src/pages/TripPage.tsx`, `src/hooks/useTripMutations.ts`
- Test: `src/hooks/__tests__/useVisitRecord.test.tsx`

**Interfaces:**
- Consumes: `VISIT_MUTATION_KEY`, `VisitVariables` (Task 4); `stampIfDuringTrip` (Task 2); `VisitDetailsModal`, `VisitFormValues` (Task 6).
- Produces: `useVisitRecord(itemId: string): UseMutationResult<void, Error, VisitVariables, VisitContext>`.

- [x] **Step 1: Write the failing hook test**

Create `src/hooks/__tests__/useVisitRecord.test.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { tripKeys } from '@/lib/queryClient';
import { useVisitRecord } from '../useVisitRecord';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

const trip = {
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', status: { done: false } }],
    },
  ],
};

const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  const wrapper = ({ children }: { children: React.ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe('useVisitRecord', () => {
  it('applies the patch optimistically and writes', async () => {
    writeVisitFields.mockResolvedValue(undefined);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisitRecord('act-1'), { wrapper });

    result.current.mutate({ tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' });

    await waitFor(() => expect(writeVisitFields).toHaveBeenCalled());
    const cached = client.getQueryData<typeof trip>(tripKeys.detail('t1'));
    expect(cached?.stops[0].activities[0].status.done).toBe(true);
  });

  it('rolls back when the write fails', async () => {
    writeVisitFields.mockRejectedValue(new Error('nope'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisitRecord('act-1'), { wrapper });

    result.current.mutate({ tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = client.getQueryData<typeof trip>(tripKeys.detail('t1'));
    expect(cached?.stops[0].activities[0].status.done).toBe(false);
    expect(cached?.stops[0].activities[0].visited_at).toBeUndefined();
  });
});
```

- [x] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/hooks/__tests__/useVisitRecord.test.tsx`
Expected: FAIL - cannot resolve `../useVisitRecord`.

- [x] **Step 3: Implement the hook**

Create `src/hooks/useVisitRecord.ts`:

```ts
import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { VISIT_MUTATION_KEY, type VisitContext, type VisitVariables } from '@/lib/visitMutation';

// No callbacks here on purpose: they live in visitMutation at module scope so a
// write resumed from IndexedDB runs identical code. The per-item scope makes
// two queued writes to one item run in order rather than racing.
export function useVisitRecord(itemId: string): UseMutationResult<void, Error, VisitVariables, VisitContext> {
  return useMutation<void, Error, VisitVariables, VisitContext>({
    mutationKey: [...VISIT_MUTATION_KEY],
    scope: { id: `visit-${itemId}` },
  });
}
```

- [x] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/hooks/__tests__/useVisitRecord.test.tsx`
Expected: PASS.

- [x] **Step 5: Build the per-item containers**

Create `src/components/Activities/ActivityListItem.tsx`:

```tsx
import { useState } from 'react';
import { ActivityCard } from '@/components/Cards/ActivityCard';
import { VisitDetailsModal, type VisitFormValues } from '@/components/Editing';
import { useVisitRecord } from '@/hooks/useVisitRecord';
import { stampIfDuringTrip } from '@/services/visitRecord';
import type { Accommodation, Activity } from '@/types';
import type { TripData } from '@/types/trip';

interface ActivityListItemProps {
  accommodation?: Accommodation;
  activity: Activity;
  isDraggable: boolean;
  isSelected: boolean;
  onDelete?: (activity: Activity) => void;
  onDone: (activityId: string) => void;
  onEdit?: (activity: Activity) => void;
  onSelect: (activityId: string) => void;
  trip: TripData;
  tripId: string;
}

export const ActivityListItem = ({ activity, trip, tripId, accommodation, isDraggable, isSelected, onSelect, onDone, onEdit, onDelete }: ActivityListItemProps) => {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const visitMutation = useVisitRecord(activity.activity_id);
  const isDone = activity.status?.done ?? false;

  // tripId comes from the route, never trip.trip_id - that field is optional on
  // TripData and an empty string would silently target the wrong query key.
  const base = { tripId, itemId: activity.activity_id, isWaypoint: false };

  const handleToggle = (done: boolean) => {
    visitMutation.mutate({
      ...base,
      isDone: done,
      visitedAt: done
        ? stampIfDuringTrip({ now: new Date(), timeZone: trip.timezone, startDate: trip.start_date, endDate: trip.end_date })
        : null,
    });
    if (done) {
      onDone(activity.activity_id);
    }
  };

  const handleSave = (values: VisitFormValues) => {
    visitMutation.mutate({ ...base, visitedAt: values.visitedAt, visitDurationMinutes: values.visitDurationMinutes, remarks: values.remarks });
  };

  return (
    <>
      <ActivityCard
        accommodation={accommodation}
        activity={activity}
        isDone={isDone}
        isDraggable={isDraggable}
        isSelected={isSelected}
        onDelete={onDelete}
        onEdit={onEdit}
        onLogVisit={isDone ? () => setIsVisitModalOpen(true) : undefined}
        onSelect={onSelect}
        onToggleDone={(_id, done) => handleToggle(done)}
      />
      {isVisitModalOpen && (
        <VisitDetailsModal
          isOpen
          item={activity}
          onClose={() => setIsVisitModalOpen(false)}
          onSave={handleSave}
          tripEndDate={trip.end_date}
          tripStartDate={trip.start_date}
          tripTimezone={trip.timezone}
        />
      )}
    </>
  );
};
```

Create `src/components/Activities/WaypointListItem.tsx`. The two cards take different props, so a shared wrapper would need a union neither card wants - the duplication is deliberate:

```tsx
import { useState } from 'react';
import { ScenicWaypointCard } from '@/components/Cards/ScenicWaypointCard';
import { VisitDetailsModal, type VisitFormValues } from '@/components/Editing';
import { useVisitRecord } from '@/hooks/useVisitRecord';
import { stampIfDuringTrip } from '@/services/visitRecord';
import type { Accommodation } from '@/types';
import type { ScenicWaypoint } from '@/types/map';
import type { TripData } from '@/types/trip';

interface WaypointListItemProps {
  accommodation?: Accommodation;
  isSelected: boolean;
  onDelete?: (waypoint: ScenicWaypoint) => void;
  onDone: (waypointId: string) => void;
  onEdit?: (waypoint: ScenicWaypoint) => void;
  onSelect: (waypointId: string) => void;
  trip: TripData;
  tripId: string;
  waypoint: ScenicWaypoint;
}

export const WaypointListItem = ({ waypoint, trip, tripId, accommodation, isSelected, onSelect, onDone, onEdit, onDelete }: WaypointListItemProps) => {
  const [isVisitModalOpen, setIsVisitModalOpen] = useState(false);
  const visitMutation = useVisitRecord(waypoint.activity_id);
  const isDone = waypoint.status?.done ?? false;

  const base = { tripId, itemId: waypoint.activity_id, isWaypoint: true };

  const handleToggle = (done: boolean) => {
    visitMutation.mutate({
      ...base,
      isDone: done,
      visitedAt: done
        ? stampIfDuringTrip({ now: new Date(), timeZone: trip.timezone, startDate: trip.start_date, endDate: trip.end_date })
        : null,
    });
    if (done) {
      onDone(waypoint.activity_id);
    }
  };

  const handleSave = (values: VisitFormValues) => {
    visitMutation.mutate({ ...base, visitedAt: values.visitedAt, visitDurationMinutes: values.visitDurationMinutes, remarks: values.remarks });
  };

  return (
    <>
      <ScenicWaypointCard
        accommodation={accommodation}
        isDone={isDone}
        isSelected={isSelected}
        onDelete={onDelete}
        onEdit={onEdit}
        onLogVisit={isDone ? () => setIsVisitModalOpen(true) : undefined}
        onSelect={onSelect}
        onToggleDone={(_id, done) => handleToggle(done)}
        waypoint={waypoint}
      />
      {isVisitModalOpen && (
        <VisitDetailsModal
          isOpen
          item={waypoint}
          onClose={() => setIsVisitModalOpen(false)}
          onSave={handleSave}
          tripEndDate={trip.end_date}
          tripStartDate={trip.start_date}
          tripTimezone={trip.timezone}
        />
      )}
    </>
  );
};
```

**Offline (Req 5.1):** neither container gates `onLogVisit` or the checkbox on `useOnlineStatus`. `ActivitiesPanel` wraps `onEdit`/`onDelete` in `isOnline ? … : undefined` - do **not** copy that pattern for `onLogVisit`. The visit form is the one editor that must work offline, and the containers own the prop, so the panel's gate never reaches it.

- [x] **Step 6: Add the log affordance to the cards**

In `src/components/Cards/ActivityCard.tsx`, add `onLogVisit?: () => void;` to the props, destructure it, and render it beside the existing edit/delete buttons - so it appears only when the container passes it, which is only when the item is done (Req 2.5):

```tsx
                      {onLogVisit && (
                        <button
                          aria-label="Log visit details"
                          className="rounded-md p-1.5 text-gray-400 transition-colors hover:bg-emerald-500/10 hover:text-emerald-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            onLogVisit();
                          }}
                          type="button"
                        >
                          <PencilSquareIcon className="h-4 w-4" />
                        </button>
                      )}
```

Below the title, render the stored values when present:

```tsx
                {isDone && (activity.visited_at || activity.visit_duration_minutes) && (
                  <p className="text-emerald-700 text-xs">
                    {activity.visited_at?.slice(11, 16)}
                    {activity.visited_at && activity.visit_duration_minutes ? ' · ' : ''}
                    {activity.visit_duration_minutes ? formatMinutes(activity.visit_duration_minutes) : ''}
                  </p>
                )}
```

Add `formatMinutes` to `src/utils/tripUtils.ts`:

```ts
const MINUTES_PER_HOUR = 60;

export const formatMinutes = (minutes: number): string => {
  const hours = Math.floor(minutes / MINUTES_PER_HOUR);
  const rest = minutes % MINUTES_PER_HOUR;
  if (!hours) {
    return `${rest}m`;
  }
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
};
```

Mirror both edits in `src/components/Cards/ScenicWaypointCard.tsx`.

- [x] **Step 7: Rewire the panel and page**

In `DraggableActivity.tsx`, replace the inline `<ActivityCard>` with `<ActivityListItem>`, threading a new `trip` prop and renaming `onToggleDone` to `onDone: (activityId: string) => void`. In `ActivitiesPanel.tsx`, do the same for the waypoint list with `WaypointListItem`, and pass `tripData` down.

In `src/pages/TripPage.tsx`, delete `toggleDoneMutation` and reduce `handleActivityToggle` to the celebration check only, renamed `handleItemDone(activityId: string)`; it no longer writes. Delete `useToggleActivityDone` from `src/hooks/useTripMutations.ts` and its tests.

- [x] **Step 8: Lock the offline carve-out with a regression test**

Add to `src/components/Activities/__tests__/ActivityListItem.test.tsx`:

```tsx
it('offers the visit form while offline', () => {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
  renderItem({ activity: { activity_id: 'act-1', activity_name: 'Museum', status: { done: true } } });
  expect(screen.getByLabelText(/log visit details/i)).toBeInTheDocument();
});

it('offers no visit form on an item that is not done', () => {
  renderItem({ activity: { activity_id: 'act-1', activity_name: 'Museum', status: { done: false } } });
  expect(screen.queryByLabelText(/log visit details/i)).not.toBeInTheDocument();
});
```

Run: `pnpm vitest run src/components/Activities/__tests__/ActivityListItem.test.tsx`
Expected: PASS. If the first test fails, an `isOnline` gate was copied onto `onLogVisit` - remove it.

- [x] **Step 9: Run the full suite and build**

Run: `pnpm test:run && pnpm build`
Expected: PASS and clean.

- [x] **Step 10: Commit**

```bash
git add src/hooks src/components src/pages/TripPage.tsx src/utils/tripUtils.ts
git commit -m "feat: capture visit details from per-item containers on check-off"
```

---

### Task 8: Import and export fields

**Files:**
- Modify: `src/schemas/tripFileSchemas.ts`
- Test: `src/schemas/__tests__/tripFileSchemas.test.ts`

**Interfaces:**
- Consumes: `isValidTripLocal` (Task 2).
- Produces: nothing later tasks depend on.

- [x] **Step 1: Write the failing tests**

Add to `src/schemas/__tests__/tripFileSchemas.test.ts`:

```ts
it('accepts visit fields and carries them into TripData', () => {
  const file = validTripFile();
  (file.stops[0].activities[0] as Record<string, unknown>).visited_at = '2026-07-15 14:32';
  (file.stops[0].activities[0] as Record<string, unknown>).visit_duration_minutes = 80;

  const trip = toTripData(wanderlogTripSchema.parse(file));

  expect(trip.stops[0].activities[0].visited_at).toBe('2026-07-15 14:32');
  expect(trip.stops[0].activities[0].visit_duration_minutes).toBe(80);
});

it('rejects a malformed visited_at', () => {
  const file = validTripFile();
  (file.stops[0].activities[0] as Record<string, unknown>).visited_at = '2026-07-15T14:32';
  expect(wanderlogTripSchema.safeParse(file).success).toBe(false);
});

it('imports files without visit fields unchanged', () => {
  const trip = toTripData(wanderlogTripSchema.parse(validTripFile()));
  expect(trip.stops[0].activities[0].visited_at).toBeUndefined();
});
```

Use the file's existing fixture helper in place of `validTripFile()` if it is named differently.

- [x] **Step 2: Run to verify it fails**

Run: `pnpm vitest run src/schemas/__tests__/tripFileSchemas.test.ts`
Expected: FAIL - the fields are stripped, and the malformed value is accepted.

- [x] **Step 3: Add the fields to both schemas**

In `src/schemas/tripFileSchemas.ts`, add to `activitySchema` and `waypointSchema`:

```ts
  visited_at: z.string().refine(isValidTripLocal, { message: "must be 'YYYY-MM-DD HH:mm'" }).optional(),
  visit_duration_minutes: z.number().int().nonnegative().optional(),
```

Import with the shared-module convention already used in that file: `import { isValidTripLocal } from '../services/visitRecord.js';`. If `toTripData` maps activity fields explicitly rather than spreading, add both fields there too.

- [x] **Step 4: Run to verify it passes**

Run: `pnpm vitest run src/schemas/__tests__/tripFileSchemas.test.ts`
Expected: PASS.

- [x] **Step 5: Confirm export carries the fields**

Export serialises mapper output, so no code change should be needed. Verify:

Run: `pnpm vitest run src/services/__tests__/exportService.test.ts`
Expected: PASS. If the export builds its shape field-by-field, add the two fields and a test asserting they appear.

- [x] **Step 6: Commit**

```bash
git add src/schemas src/services
git commit -m "feat: round-trip visit fields through trip import and export"
```

---

### Task 9: M1 verification gate

Manual verification against a Vercel preview with the migration pushed. Not a code task; record the results in the plan's changelog.

- [ ] **Step 1: Push the migration to the preview database**

Run: `supabase db push --linked`
Expected: the two columns exist on both tables. This must happen before the frontend deploy (Phase 2 ordering rule).

- [ ] **Step 2: Verify the stamp rule both ways**

On a trip whose date range includes today, tick an activity and confirm the card shows a time matching the trip's timezone. On a trip that ended in the past, tick an item and confirm no time appears.

- [ ] **Step 3: Verify a timezone that differs from the device**

Set a trip's timezone to a zone several hours from yours, tick an item, and confirm the recorded time is the trip's local time, not the device's.

- [ ] **Step 4: Verify the out-of-range save**

Open the visit form, enter a date outside the trip, confirm the warning appears and that Save still persists the value.

- [ ] **Step 5: Verify offline capture and restart survival**

Go offline in devtools, tick an item and save a note, confirm both appear. Close the tab. Reopen it still offline and confirm the note is still shown. Go online and confirm the write lands in Supabase.

- [ ] **Step 6: Verify the failure path**

Repeat step 5 but block the Supabase request on reconnect. Confirm the card reverts to its prior values and a retry toast appears.

- [ ] **Step 7: Record the results**

Add a changelog entry to this plan naming what was verified and anything deferred.

---

## Design Decisions

- The visit form is offered only on done items, so `visited_at` implies `is_done` by construction with no implicit writes to reconcile. M3 adds the matching agent-side guard.
- All mutation callbacks live in `visitMutation.ts` rather than in the hook, because a mutation rebuilt by hydration resolves callbacks only through `getMutationDefaults`. Defining them once removes any chance of the live and resumed paths drifting apart.
- The per-item mutation `scope` exists for a specific sequence: offline, tick an item, then save its details. Both writes queue against the same item, and same-scope mutations run serially.
- No `min`/`max` on the date input. `ItemModalShell` submits through a native `<form>`, so constraint validation would silently block the out-of-range save Req 2.9 requires. The range is helper text and the warning is application code.
- `duration` is untouched. It holds planned estimates that are mostly ranges and prose, which is why the actual duration got its own integer column instead of migrating it.

## Critical Files - Summary

| Path | Why it matters |
|------|----------------|
| `src/services/visitRecord.ts` | The only definition of trip-local time and the stamp rule; shared with `api/` for M3. |
| `src/lib/visitMutation.ts` | The entire write contract, including the rollback that Req 5.4 depends on. |
| `src/lib/mutationDefaults.ts` + `src/main.tsx` | Three lines that decide whether an offline note survives a restart. |
| `src/components/Activities/ActivityListItem.tsx` | Where the per-item mutation scope comes from. |
| `supabase/migrations/20260726120000_visit_records.sql` | Must reach production before the frontend that reads the columns. |

## Changelog

- 2026-07-26: Initial plan, written from [requirements_phase-4.md](requirements_phase-4.md) and [design_phase-4.md](design_phase-4.md) after the design review.
- 2026-07-26: Tasks 1-8 implemented on `feat/p4m1-visit-records`. Full suite green (60 files, 541 tests); `tsc -b` and the production build clean.

  Two plan corrections, both made deliberately:
  - **Task 1 Step 6 reversed.** Adding the visit columns to `ACTIVITY_COLUMNS` would have destroyed visit records: `updateActivity` writes that set densely (`denseRow`), and `ActivityInput` carries no visit keys, so every save from the item editor would have nulled `visited_at` and `visit_duration_minutes`. They now live in a separate `VISIT_COLUMNS`, mirroring how `ITEM_DONE_COLUMN` is already held out of the dense set. M3 appends it to the agent's patch defs. Pinned by a regression test in `entityRows.test.ts`.
  - **`DurationInput` holds typed state** rather than re-deriving hours/minutes from the total. The plan's version redisplayed a `0` the moment the hours box was cleared, and clearing both boxes emitted `0` minutes instead of `undefined` - so "no duration" was unsayable once either box had been filled.

  Smaller deviations: `isValidTimeZone` replaced the identical `isIanaTimezone` already in `tripFileSchemas.ts` instead of shipping a second copy; the toast's Retry rebuilds the mutation with its per-item `scope`, which the plan's snippet dropped; no `src/components/Editing/index.ts` barrel was added, since that folder has none and siblings import directly.

  **Task 9 not run.** It needs `supabase db push` against a real database and browser interaction against a preview deploy; Docker was not running locally. The migration is written but has been applied nowhere. Automated coverage stands in for parts of it: both stamp directions, the trip-zone-differs-from-device case, the out-of-range save through the real Save button, offline affordance, dehydrate/hydrate resume, and post-restart rollback-and-notify. Steps 1-6 of Task 9 remain outstanding, and the migration must reach the database before the frontend deploy.
