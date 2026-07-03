# Supabase Foundation (Phase 2, M1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App reads and writes trip data from Supabase (Postgres + RLS) with full feature parity against the Firestore version, verified by the Req 1.7 parity checklist on a Vercel preview.

**Architecture:** Five relational tables replace the whole-blob Firestore doc. `supabaseService` is the only module touching supabase-js; mappers convert rows to the existing nested `TripData` shape so components stay untouched. TanStack Query owns server state (persisted to IndexedDB for offline reads); `AppStateContext` slims to UI state. A minimal login gate exists from day one because RLS denies anonymous access. Firestore stays intact (Req 8.1).

**Tech Stack:** Supabase (Postgres, Auth, CLI), @supabase/supabase-js v2, TanStack Query v5 (+ persist-client, async-storage-persister), idb-keyval, React 19, Vitest.

## Global Constraints

- Prerequisite: M0 shipped ([plan_p2m0_toolchain-upgrade.md](plan_p2m0_toolchain-upgrade.md)); baseline is 218 tests green.
- Firestore data and `firebaseService` code stay intact this milestone (Req 8.1). The app bundle must stop importing firebase; the migration script may still import it.
- Domain types in `src/types/trip.ts` do not change - parity depends on them (Req 1.3).
- Secrets: `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are client-safe. `SUPABASE_SERVICE_ROLE_KEY` is script-only, never `VITE_`-prefixed, never imported by `src/**`.
- GH Pages remains the production host; Vercel serves previews only until M2 cutover.
- New unit tests mock supabase-js the way `src/services/__tests__/storageService.test.ts` mocks firebaseService: `vi.mock` of the config module.
- After every task: `pnpm test:run` green, `pnpm build` exits 0. One commit per task.

---

### Task 1: Supabase project scaffolding + client config

**Files:**
- Create: `src/config/supabase.ts`, `supabase/` (via CLI init)
- Modify: `package.json`, `.env.local.example`, `.gitignore`, `.env.local` (untracked)

**Interfaces:**
- Produces: `getSupabase(): SupabaseClient` singleton - every later task imports it from `@/config/supabase`.

- [ ] **Step 1: Create the hosted project (manual, dashboard)**

At https://supabase.com/dashboard: new project `wanderlog`, region closest to home. Note the project URL and anon key (Settings > API). In Authentication > Sign In / Up: **disable "Allow new users to sign up"** (Req 2.4).

- [ ] **Step 2: Install CLI + init local dev**

```bash
brew install supabase
supabase init
supabase start   # requires Docker; prints local URL + keys
```

Add to `.gitignore`:

```
supabase/.temp
```

- [ ] **Step 3: Add the client dependency and singleton**

```bash
pnpm add @supabase/supabase-js
```

Create `src/config/supabase.ts` (env accessor mirrors `src/config/firebase.ts:5-15`):

```typescript
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const getEnvVar = (key: string): string => {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    return import.meta.env[key] || '';
  }
  return process.env[key] || '';
};

let client: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient => {
  if (!client) {
    client = createClient(getEnvVar('VITE_SUPABASE_URL'), getEnvVar('VITE_SUPABASE_ANON_KEY'));
  }
  return client;
};
```

- [ ] **Step 4: Document env vars**

Append to `.env.local.example` and set real values in `.env.local`:

```bash
# Supabase
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
# Script-only (migration); never expose to the client bundle
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

- [ ] **Step 5: Verify and commit**

```bash
pnpm test:run && pnpm build
git add -A
git commit -m "feat: add supabase project scaffolding and client singleton"
```

---

### Task 2: Schema migration + RLS

**Files:**
- Create: `supabase/migrations/20260703000000_phase2_schema.sql`

**Interfaces:**
- Produces: tables `trips`, `stops`, `accommodations`, `activities`, `scenic_waypoints` exactly as below - mappers (Task 3) and the migration script (Task 6) depend on these column names.

- [ ] **Step 1: Write the migration SQL**

```sql
create extension if not exists moddatetime schema extensions;

create table trips (
  id          text primary key,
  name        text not null,
  description text,
  destination text,
  start_date  date not null,
  end_date    date not null,
  timezone    text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table stops (
  id          text primary key,
  trip_id     text not null references trips(id) on delete cascade,
  name        text not null,
  date_from   date not null,
  date_to     date not null,
  lat         double precision not null,
  lng         double precision not null,
  duration_days integer,
  travel_time_from_previous text,
  sort_order  integer not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table accommodations (
  id          text primary key,
  stop_id     text not null unique references stops(id) on delete cascade,
  name        text not null,
  address     text,
  check_in    text,
  check_out   text,
  confirmation text,
  url         text,
  thumbnail_url text,
  google_place_id text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table activities (
  id          text primary key,
  stop_id     text not null references stops(id) on delete cascade,
  name        text not null,
  type        text,
  lat         double precision,
  lng         double precision,
  address     text,
  duration    text,
  travel_time_from_accommodation text,
  url         text,
  remarks     text,
  thumbnail_url text,
  google_place_id text,
  sort_order  integer not null,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table scenic_waypoints (
  id          text primary key,
  stop_id     text not null references stops(id) on delete cascade,
  name        text not null,
  lat         double precision,
  lng         double precision,
  address     text,
  duration    text,
  url         text,
  remarks     text,
  thumbnail_url text,
  google_place_id text,
  sort_order  integer not null,
  is_done     boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index stops_trip_id_idx on stops(trip_id);
create index activities_stop_id_idx on activities(stop_id);
create index scenic_waypoints_stop_id_idx on scenic_waypoints(stop_id);

-- updated_at maintenance (last-write-wins timestamp, Req 4.9)
create trigger set_updated_at before update on trips
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on stops
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on accommodations
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on activities
  for each row execute procedure extensions.moddatetime(updated_at);
create trigger set_updated_at before update on scenic_waypoints
  for each row execute procedure extensions.moddatetime(updated_at);

-- RLS: authenticated family members get everything, anon gets nothing (Req 1.6, 2.7)
alter table trips enable row level security;
alter table stops enable row level security;
alter table accommodations enable row level security;
alter table activities enable row level security;
alter table scenic_waypoints enable row level security;

create policy authenticated_all on trips for all to authenticated using (true) with check (true);
create policy authenticated_all on stops for all to authenticated using (true) with check (true);
create policy authenticated_all on accommodations for all to authenticated using (true) with check (true);
create policy authenticated_all on activities for all to authenticated using (true) with check (true);
create policy authenticated_all on scenic_waypoints for all to authenticated using (true) with check (true);
```

- [ ] **Step 2: Apply locally and verify**

```bash
supabase db reset
```

Expected: migration applies without error. Then confirm RLS blocks anon:

```bash
curl -s "$(supabase status -o json | jq -r .API_URL)/rest/v1/trips" \
  -H "apikey: $(supabase status -o json | jq -r .ANON_KEY)"
```

Expected: `[]` (RLS filters everything for anon; no rows leak).

- [ ] **Step 3: Push to hosted project**

```bash
supabase link --project-ref <project-ref-from-dashboard>
supabase db push
```

- [ ] **Step 4: Commit**

```bash
git add supabase/
git commit -m "feat: add phase 2 relational schema with rls"
```

---

### Task 3: Row-to-domain mappers (TDD)

**Files:**
- Create: `src/services/supabaseMappers.ts`, `src/services/__tests__/supabaseMappers.test.ts`

**Interfaces:**
- Produces (consumed by Tasks 4-6):

```typescript
// Row shapes exactly mirror Task 2 columns
export interface TripRowNested extends TripRow { stops: StopRowNested[] }
export interface StopRowNested extends StopRow {
  accommodations: AccommodationRow[] | AccommodationRow | null;
  activities: ActivityRow[];
  scenic_waypoints: ScenicWaypointRow[];
}
export function toTripData(row: TripRowNested): TripData;
export function buildRows(trip: TripData, tripId: string): RowBundle;
export interface RowBundle {
  trip: TripRow; stops: StopRow[]; accommodations: AccommodationRow[];
  activities: ActivityRow[]; scenicWaypoints: ScenicWaypointRow[];
}
```

- [ ] **Step 1: Write failing tests**

```typescript
import { describe, expect, it } from 'vitest';
import { buildRows, toTripData, type TripRowNested } from '../supabaseMappers';

const tripRow: TripRowNested = {
  id: '202512_NZ',
  name: 'NZ South Island',
  description: null,
  destination: 'New Zealand',
  start_date: '2025-12-13',
  end_date: '2025-12-29',
  timezone: 'Pacific/Auckland',
  created_at: '2025-11-01T00:00:00Z',
  updated_at: '2025-11-01T00:00:00Z',
  stops: [
    {
      id: 'queenstown', trip_id: '202512_NZ', name: 'Queenstown',
      date_from: '2025-12-13', date_to: '2025-12-16',
      lat: -45.03, lng: 168.66, duration_days: 3,
      travel_time_from_previous: null, sort_order: 0,
      created_at: '2025-11-01T00:00:00Z', updated_at: '2025-11-01T00:00:00Z',
      accommodations: [{
        id: 'acc-1', stop_id: 'queenstown', name: 'Lakeview Motel',
        address: '1 Lake Rd', check_in: '2025-12-13 15:00', check_out: '2025-12-16 10:00',
        confirmation: null, url: null, thumbnail_url: null, google_place_id: null,
        created_at: '2025-11-01T00:00:00Z', updated_at: '2025-11-01T00:00:00Z',
      }],
      activities: [
        { id: 'act-2', stop_id: 'queenstown', name: 'Gondola', type: 'attraction',
          lat: -45.02, lng: 168.65, address: null, duration: '2h',
          travel_time_from_accommodation: null, url: null, remarks: null,
          thumbnail_url: null, google_place_id: null, sort_order: 1, is_done: true,
          created_at: '2025-11-01T00:00:00Z', updated_at: '2025-11-01T00:00:00Z' },
        { id: 'act-1', stop_id: 'queenstown', name: 'Fergburger', type: 'restaurant',
          lat: null, lng: null, address: '42 Shotover St', duration: null,
          travel_time_from_accommodation: null, url: null, remarks: null,
          thumbnail_url: null, google_place_id: null, sort_order: 0, is_done: false,
          created_at: '2025-11-01T00:00:00Z', updated_at: '2025-11-01T00:00:00Z' },
      ],
      scenic_waypoints: [],
    },
  ],
};

describe('toTripData', () => {
  it('maps rows to the domain TripData shape', () => {
    const trip = toTripData(tripRow);
    expect(trip.trip_id).toBe('202512_NZ');
    expect(trip.trip_name).toBe('NZ South Island');
    expect(trip.stops[0].stop_id).toBe('queenstown');
    expect(trip.stops[0].date).toEqual({ from: '2025-12-13', to: '2025-12-16' });
    expect(trip.stops[0].location).toEqual({ lat: -45.03, lng: 168.66 });
    expect(trip.stops[0].accommodation?.name).toBe('Lakeview Motel');
  });

  it('sorts activities by sort_order and maps is_done to status.done', () => {
    const activities = toTripData(tripRow).stops[0].activities;
    expect(activities.map((a) => a.activity_id)).toEqual(['act-1', 'act-2']);
    expect(activities[1].status).toEqual({ done: true });
    expect(activities[1].order).toBe(1);
  });

  it('accepts accommodation embedded as object or array, and as null', () => {
    const asObject = { ...tripRow.stops[0], accommodations: tripRow.stops[0].accommodations[0] };
    expect(toTripData({ ...tripRow, stops: [asObject] }).stops[0].accommodation?.name).toBe('Lakeview Motel');
    const asNull = { ...tripRow.stops[0], accommodations: null };
    expect(toTripData({ ...tripRow, stops: [asNull] }).stops[0].accommodation).toBeUndefined();
  });

  it('omits activity location when no coordinates or address exist', () => {
    const bare = { ...tripRow.stops[0].activities[0], lat: null, lng: null, address: null };
    const trip = toTripData({ ...tripRow, stops: [{ ...tripRow.stops[0], activities: [bare] }] });
    expect(trip.stops[0].activities[0].location).toBeUndefined();
  });
});

describe('buildRows', () => {
  it('round-trips: buildRows(toTripData(rows)) reproduces the row values', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    expect(bundle.trip.id).toBe('202512_NZ');
    expect(bundle.stops[0].sort_order).toBe(0);
    expect(bundle.activities.find((a) => a.id === 'act-2')?.is_done).toBe(true);
    expect(bundle.accommodations[0].stop_id).toBe('queenstown');
  });

  it('derives trip start/end dates from stops when building rows', () => {
    const bundle = buildRows(toTripData(tripRow), '202512_NZ');
    expect(bundle.trip.start_date).toBe('2025-12-13');
    expect(bundle.trip.end_date).toBe('2025-12-16');
  });
});
```

- [ ] **Step 2: Run to verify failure**

```bash
pnpm vitest run src/services/__tests__/supabaseMappers.test.ts
```

Expected: FAIL - module `../supabaseMappers` not found.

- [ ] **Step 3: Implement**

```typescript
import type { Accommodation, Activity, TripBase, TripData } from '@/types/trip';
import type { ScenicWaypoint } from '@/types/map';

export interface TripRow {
  id: string; name: string; description: string | null; destination: string | null;
  start_date: string; end_date: string; timezone: string;
  created_at: string; updated_at: string;
}
export interface StopRow {
  id: string; trip_id: string; name: string; date_from: string; date_to: string;
  lat: number; lng: number; duration_days: number | null;
  travel_time_from_previous: string | null; sort_order: number;
  created_at: string; updated_at: string;
}
export interface AccommodationRow {
  id: string; stop_id: string; name: string; address: string | null;
  check_in: string | null; check_out: string | null; confirmation: string | null;
  url: string | null; thumbnail_url: string | null; google_place_id: string | null;
  created_at: string; updated_at: string;
}
export interface ActivityRow {
  id: string; stop_id: string; name: string; type: string | null;
  lat: number | null; lng: number | null; address: string | null;
  duration: string | null; travel_time_from_accommodation: string | null;
  url: string | null; remarks: string | null; thumbnail_url: string | null;
  google_place_id: string | null; sort_order: number; is_done: boolean;
  created_at: string; updated_at: string;
}
export type ScenicWaypointRow = Omit<ActivityRow, 'type' | 'travel_time_from_accommodation'>;

export interface StopRowNested extends StopRow {
  accommodations: AccommodationRow[] | AccommodationRow | null;
  activities: ActivityRow[];
  scenic_waypoints: ScenicWaypointRow[];
}
export interface TripRowNested extends TripRow { stops: StopRowNested[] }

export interface RowBundle {
  trip: TripRow; stops: StopRow[]; accommodations: AccommodationRow[];
  activities: ActivityRow[]; scenicWaypoints: ScenicWaypointRow[];
}

const toLocation = (row: { lat: number | null; lng: number | null; address: string | null }) => {
  if (row.lat === null && row.lng === null && row.address === null) return undefined;
  return {
    ...(row.lat === null ? {} : { lat: row.lat }),
    ...(row.lng === null ? {} : { lng: row.lng }),
    ...(row.address === null ? {} : { address: row.address }),
  };
};

const orNothing = <T>(value: T | null): T | undefined => (value === null ? undefined : value);

const toActivity = (row: ActivityRow): Activity => ({
  activity_id: row.id,
  activity_name: row.name,
  activity_type: orNothing(row.type) as Activity['activity_type'],
  location: toLocation(row),
  duration: orNothing(row.duration),
  travel_time_from_accommodation: orNothing(row.travel_time_from_accommodation),
  url: orNothing(row.url),
  remarks: orNothing(row.remarks),
  thumbnail_url: orNothing(row.thumbnail_url),
  google_place_id: orNothing(row.google_place_id),
  order: row.sort_order,
  status: { done: row.is_done },
});

const toScenicWaypoint = (row: ScenicWaypointRow): ScenicWaypoint => ({
  activity_id: row.id,
  activity_name: row.name,
  location: toLocation(row),
  duration: orNothing(row.duration),
  url: orNothing(row.url),
  remarks: orNothing(row.remarks),
  thumbnail_url: orNothing(row.thumbnail_url),
  google_place_id: orNothing(row.google_place_id),
  status: { done: row.is_done },
});

const toAccommodation = (row: AccommodationRow): Accommodation => ({
  name: row.name,
  address: row.address ?? '',
  check_in: row.check_in ?? '',
  check_out: row.check_out ?? '',
  confirmation: orNothing(row.confirmation),
  url: orNothing(row.url),
  thumbnail_url: orNothing(row.thumbnail_url),
  google_place_id: orNothing(row.google_place_id),
});

const bySortOrder = <T extends { sort_order: number }>(a: T, b: T) => a.sort_order - b.sort_order;

const singleAccommodation = (
  value: AccommodationRow[] | AccommodationRow | null
): AccommodationRow | undefined => {
  if (value === null) return undefined;
  return Array.isArray(value) ? value[0] : value;
};

const toTripBase = (row: StopRowNested): TripBase => {
  const accommodationRow = singleAccommodation(row.accommodations);
  return {
    stop_id: row.id,
    name: row.name,
    date: { from: row.date_from, to: row.date_to },
    location: { lat: row.lat, lng: row.lng },
    duration_days: row.duration_days ?? 0,
    travel_time_from_previous: orNothing(row.travel_time_from_previous),
    accommodation: accommodationRow ? toAccommodation(accommodationRow) : undefined,
    activities: [...row.activities].sort(bySortOrder).map(toActivity),
    scenic_waypoints: [...row.scenic_waypoints].sort(bySortOrder).map(toScenicWaypoint),
  };
};

export const toTripData = (row: TripRowNested): TripData => ({
  trip_id: row.id,
  trip_name: row.name,
  timezone: row.timezone,
  stops: [...row.stops].sort(bySortOrder).map(toTripBase),
  created_at: row.created_at,
  updated_at: row.updated_at,
});

export const buildRows = (trip: TripData, tripId: string): RowBundle => {
  const now = new Date().toISOString();
  const stops: StopRow[] = [];
  const accommodations: AccommodationRow[] = [];
  const activities: ActivityRow[] = [];
  const scenicWaypoints: ScenicWaypointRow[] = [];

  trip.stops.forEach((stop, stopIndex) => {
    stops.push({
      id: stop.stop_id, trip_id: tripId, name: stop.name,
      date_from: stop.date.from, date_to: stop.date.to,
      lat: stop.location.lat, lng: stop.location.lng,
      duration_days: stop.duration_days ?? null,
      travel_time_from_previous: stop.travel_time_from_previous ?? null,
      sort_order: stopIndex, created_at: now, updated_at: now,
    });
    if (stop.accommodation) {
      accommodations.push({
        id: `${stop.stop_id}_accommodation`, stop_id: stop.stop_id,
        name: stop.accommodation.name, address: stop.accommodation.address ?? null,
        check_in: stop.accommodation.check_in ?? null, check_out: stop.accommodation.check_out ?? null,
        confirmation: stop.accommodation.confirmation ?? null, url: stop.accommodation.url ?? null,
        thumbnail_url: stop.accommodation.thumbnail_url ?? null,
        google_place_id: stop.accommodation.google_place_id ?? null,
        created_at: now, updated_at: now,
      });
    }
    stop.activities.forEach((activity, index) => {
      activities.push({
        id: activity.activity_id, stop_id: stop.stop_id, name: activity.activity_name,
        type: activity.activity_type ?? null,
        lat: activity.location?.lat ?? null, lng: activity.location?.lng ?? null,
        address: activity.location?.address ?? null,
        duration: activity.duration ?? null,
        travel_time_from_accommodation: activity.travel_time_from_accommodation ?? null,
        url: activity.url ?? null, remarks: activity.remarks ?? null,
        thumbnail_url: activity.thumbnail_url ?? null,
        google_place_id: activity.google_place_id ?? null,
        sort_order: activity.order ?? index, is_done: activity.status?.done ?? false,
        created_at: now, updated_at: now,
      });
    });
    (stop.scenic_waypoints ?? []).forEach((waypoint, index) => {
      scenicWaypoints.push({
        id: waypoint.activity_id, stop_id: stop.stop_id, name: waypoint.activity_name,
        lat: waypoint.location?.lat ?? null, lng: waypoint.location?.lng ?? null,
        address: waypoint.location?.address ?? null,
        duration: waypoint.duration ?? null,
        url: waypoint.url ?? null, remarks: waypoint.remarks ?? null,
        thumbnail_url: waypoint.thumbnail_url ?? null,
        google_place_id: waypoint.google_place_id ?? null,
        sort_order: index, is_done: waypoint.status?.done ?? false,
        created_at: now, updated_at: now,
      });
    });
  });

  const allFrom = trip.stops.map((s) => s.date.from).sort();
  const allTo = trip.stops.map((s) => s.date.to).sort();

  return {
    trip: {
      id: tripId, name: trip.trip_name, description: null, destination: null,
      start_date: allFrom[0], end_date: allTo[allTo.length - 1],
      timezone: trip.timezone,
      created_at: trip.created_at ?? now, updated_at: trip.updated_at ?? now,
    },
    stops, accommodations, activities, scenicWaypoints,
  };
};
```

- [ ] **Step 4: Run tests, expect pass; run full suite**

```bash
pnpm vitest run src/services/__tests__/supabaseMappers.test.ts
pnpm test:run
```

- [ ] **Step 5: Commit**

```bash
git add src/services/supabaseMappers.ts src/services/__tests__/supabaseMappers.test.ts
git commit -m "feat: add supabase row-domain mappers"
```

---

### Task 4: supabaseService read path (TDD)

**Files:**
- Create: `src/services/supabaseService.ts`, `src/services/__tests__/supabaseService.test.ts`

**Interfaces:**
- Consumes: `getSupabase()` (Task 1), `toTripData` (Task 3).
- Produces (consumed by hooks in Tasks 9-10 and script in Task 6):

```typescript
export const TRIP_SELECT = '*, stops(*, accommodations(*), activities(*), scenic_waypoints(*))';
export function fetchTripSummaries(): Promise<TripSummary[]>;
export function fetchTripById(tripId: string): Promise<TripData | null>;
```

`TripSummary` is the existing type from `src/contexts/AppStateContext.tsx` - export it from there if not already exported.

- [ ] **Step 1: Write failing tests**

```typescript
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const chain = {
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
};
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({ from: vi.fn(() => chain) }),
}));

import { fetchTripById, fetchTripSummaries } from '../supabaseService';

describe('supabaseService reads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchTripById returns mapped TripData', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: '202512_NZ', name: 'NZ', description: null, destination: null,
        start_date: '2025-12-13', end_date: '2025-12-29', timezone: 'Pacific/Auckland',
        created_at: 'x', updated_at: 'x', stops: [],
      },
      error: null,
    });
    const trip = await fetchTripById('202512_NZ');
    expect(trip?.trip_name).toBe('NZ');
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('scenic_waypoints(*)'));
  });

  it('fetchTripById returns null for a missing trip', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchTripById('nope')).toBeNull();
  });

  it('fetchTripById throws on a supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchTripById('202512_NZ')).rejects.toThrow('boom');
  });

  it('fetchTripSummaries maps rows to TripSummary', async () => {
    mockOrder.mockResolvedValue({
      data: [{ id: 't1', name: 'Trip 1', timezone: 'UTC', created_at: 'c', updated_at: 'u' }],
      error: null,
    });
    const trips = await fetchTripSummaries();
    expect(trips).toEqual([{ trip_id: 't1', trip_name: 'Trip 1', timezone: 'UTC', created_at: 'c', updated_at: 'u' }]);
  });
});
```

- [ ] **Step 2: Run to verify failure, then implement**

```bash
pnpm vitest run src/services/__tests__/supabaseService.test.ts
```

```typescript
import { getSupabase } from '@/config/supabase';
import type { TripSummary } from '@/contexts/AppStateContext';
import type { TripData } from '@/types/trip';
import { toTripData, type TripRowNested } from './supabaseMappers';

export const TRIP_SELECT = '*, stops(*, accommodations(*), activities(*), scenic_waypoints(*))';

export async function fetchTripById(tripId: string): Promise<TripData | null> {
  const { data, error } = await getSupabase()
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', tripId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTripData(data as TripRowNested) : null;
}

export async function fetchTripSummaries(): Promise<TripSummary[]> {
  const { data, error } = await getSupabase()
    .from('trips')
    .select('id, name, timezone, created_at, updated_at')
    .order('start_date', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => ({
    trip_id: row.id,
    trip_name: row.name,
    timezone: row.timezone,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }));
}
```

Nested ordering happens in the mappers (they sort by `sort_order`), so the query needs no per-table order parameters.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run src/services/__tests__/supabaseService.test.ts && pnpm test:run
git add src/services/supabaseService.ts src/services/__tests__/supabaseService.test.ts
git commit -m "feat: add supabase read path"
```

---

### Task 5: supabaseService write path (TDD)

**Files:**
- Modify: `src/services/supabaseService.ts`, `src/services/__tests__/supabaseService.test.ts`

**Interfaces:**
- Produces (consumed by mutation hooks, Task 10):

```typescript
export function setActivityDone(activityId: string, isDone: boolean): Promise<void>;
export function setWaypointDone(waypointId: string, isDone: boolean): Promise<void>;
export function reorderActivities(orderedActivityIds: string[]): Promise<void>;
```

- [ ] **Step 1: Add failing tests**

Extend the mock with an update chain, then:

```typescript
const mockUpdateEq = vi.fn().mockResolvedValue({ error: null });
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
// extend the mocked client from Task 4: from: vi.fn(() => ({ ...chain, update: mockUpdate }))

it('setActivityDone updates is_done by id', async () => {
  await setActivityDone('act-1', true);
  expect(mockUpdate).toHaveBeenCalledWith({ is_done: true });
  expect(mockUpdateEq).toHaveBeenCalledWith('id', 'act-1');
});

it('reorderActivities writes sequential sort_order for each id', async () => {
  await reorderActivities(['b', 'a', 'c']);
  expect(mockUpdate).toHaveBeenNthCalledWith(1, { sort_order: 0 });
  expect(mockUpdateEq).toHaveBeenNthCalledWith(1, 'id', 'b');
  expect(mockUpdateEq).toHaveBeenNthCalledWith(3, 'id', 'c');
});

it('setActivityDone throws on error', async () => {
  mockUpdateEq.mockResolvedValueOnce({ error: { message: 'denied' } });
  await expect(setActivityDone('act-1', true)).rejects.toThrow('denied');
});
```

- [ ] **Step 2: Implement**

```typescript
async function updateById(table: string, id: string, patch: Record<string, unknown>): Promise<void> {
  const { error } = await getSupabase().from(table).update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

export const setActivityDone = (activityId: string, isDone: boolean): Promise<void> =>
  updateById('activities', activityId, { is_done: isDone });

export const setWaypointDone = (waypointId: string, isDone: boolean): Promise<void> =>
  updateById('scenic_waypoints', waypointId, { is_done: isDone });

export async function reorderActivities(orderedActivityIds: string[]): Promise<void> {
  await Promise.all(
    orderedActivityIds.map((id, index) => updateById('activities', id, { sort_order: index }))
  );
}
```

Per-row updates are fine at family scale (a stop has under 20 activities); a batch RPC is deliberate YAGNI.

- [ ] **Step 3: Verify and commit**

```bash
pnpm vitest run src/services/__tests__/supabaseService.test.ts && pnpm test:run
git add -A && git commit -m "feat: add supabase write path for done status and ordering"
```

---

### Task 6: Migration script

**Files:**
- Create: `scripts/migrate-to-supabase.ts`
- Modify: `package.json` (add script `"migrate:supabase": "tsx scripts/migrate-to-supabase.ts"`)

**Interfaces:**
- Consumes: `buildRows` (Task 3), Firestore `getUserModifications` via the existing `src/services/firebaseService.ts` (the one allowed firebase import - scripts only).

- [ ] **Step 1: Write the script**

Follow the structure of `scripts/migrate-to-firestore.ts` (env loading at lines 25-41, file discovery at 98-109). Core logic:

```typescript
import { createClient } from '@supabase/supabase-js';
import { buildRows } from '../src/services/supabaseMappers';
import type { TripData } from '../src/types/trip';
import type { UserModifications } from '../src/types/storage';

// env loading identical to migrate-to-firestore.ts, plus:
const supabase = createClient(
  requireEnv('VITE_SUPABASE_URL'),
  requireEnv('SUPABASE_SERVICE_ROLE_KEY')  // bypasses RLS; script-only
);

function applyModifications(trip: TripData, mods: UserModifications | null): TripData {
  if (!mods) return trip;
  return {
    ...trip,
    stops: trip.stops.map((stop) => {
      const order = mods.activityOrders[stop.stop_id];
      const activities = order
        ? order.map((originalIndex) => stop.activities[originalIndex]).filter(Boolean)
        : stop.activities;
      return {
        ...stop,
        activities: activities.map((activity, index) => ({
          ...activity,
          order: index,
          status: { done: mods.activityStatus[activity.activity_id] ?? activity.status?.done ?? false },
        })),
        scenic_waypoints: (stop.scenic_waypoints ?? []).map((waypoint) => ({
          ...waypoint,
          status: { done: mods.activityStatus[waypoint.activity_id] ?? waypoint.status?.done ?? false },
        })),
      };
    }),
  };
}

async function migrateTrip(tripId: string, tripData: TripData, mods: UserModifications | null) {
  const bundle = buildRows(applyModifications(tripData, mods), tripId);
  const upsert = async (table: string, rows: object[]) => {
    if (rows.length === 0) return;
    const { error } = await supabase.from(table).upsert(rows, { onConflict: 'id' });
    if (error) throw new Error(`${table}: ${error.message}`);
  };
  await upsert('trips', [bundle.trip]);
  await upsert('stops', bundle.stops);
  await upsert('accommodations', bundle.accommodations);
  await upsert('activities', bundle.activities);
  await upsert('scenic_waypoints', bundle.scenicWaypoints);
  console.log(
    `${tripId}: ${bundle.stops.length} stops, ${bundle.activities.length} activities, ` +
    `${bundle.scenicWaypoints.length} waypoints, ${bundle.accommodations.length} accommodations`
  );
}
```

Firestore overlay: dynamic-import `firebaseService` the way `migrate-to-firestore.ts` does, call `getUserModifications(tripId)`; a `--skip-firestore` flag skips the overlay (for re-runs after Firestore is gone). Reads only - Firestore is never written (Req 8.1).

- [ ] **Step 2: Run against local Supabase, verify idempotency**

```bash
supabase start
pnpm migrate:supabase          # first run: prints per-table counts
pnpm migrate:supabase          # second run: same counts, exit 0 (upsert, Req 1.2)
```

Cross-check counts against the source: stops in `local/trip-data/202512_NZ_trip-plan.json` vs the printed stop count. Spot-check one activity's `is_done` against the current app's checkmark.

- [ ] **Step 3: Run against the hosted project**

Point `.env.local` values at the hosted project (or export them inline) and repeat. Verify in the dashboard Table Editor: 5 tables populated.

- [ ] **Step 4: Commit**

```bash
git add scripts/migrate-to-supabase.ts package.json
git commit -m "feat: add idempotent json+firestore to supabase migration script"
```

---

### Task 7: TanStack Query provider with IndexedDB persistence

**Files:**
- Create: `src/lib/queryClient.ts`
- Modify: `src/main.tsx`, `package.json`

**Interfaces:**
- Produces: `queryClient`, `tripKeys`, `weatherKeys` - the query-key vocabulary every hook uses:

```typescript
export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trip', tripId] as const,
};
export const weatherKeys = {
  base: (baseId: string) => ['weather', baseId] as const,
};
```

- [ ] **Step 1: Add dependencies**

```bash
pnpm add @tanstack/react-query @tanstack/react-query-persist-client \
  @tanstack/query-async-storage-persister idb-keyval
```

- [ ] **Step 2: Create the client + persister**

```typescript
import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { del, get, set } from 'idb-keyval';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: THIRTY_DAYS_MS,   // must be >= persister maxAge or cache is dropped on restore
      retry: 1,
    },
  },
});

export const persister = createAsyncStoragePersister({
  storage: { getItem: get, setItem: set, removeItem: del },
  key: 'wanderlog-query-cache',
});

export const PERSIST_MAX_AGE_MS = THIRTY_DAYS_MS;

export const tripKeys = {
  all: ['trips'] as const,
  detail: (tripId: string) => ['trip', tripId] as const,
};
export const weatherKeys = {
  base: (baseId: string) => ['weather', baseId] as const,
};
```

- [ ] **Step 3: Wrap the app in `src/main.tsx`**

```tsx
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { PERSIST_MAX_AGE_MS, persister, queryClient } from '@/lib/queryClient';

// around the existing tree:
<PersistQueryClientProvider
  client={queryClient}
  persistOptions={{ persister, maxAge: PERSIST_MAX_AGE_MS, buster: 'phase2-v1' }}
>
  {/* existing providers */}
</PersistQueryClientProvider>
```

- [ ] **Step 4: Verify and commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: add tanstack query with indexeddb persistence"
```

---

### Task 8: Auth bootstrap (minimal login gate)

**Files:**
- Create: `src/contexts/AuthContext.tsx`, `src/components/Auth/LoginForm.tsx`, `src/contexts/__tests__/AuthContext.test.tsx`
- Modify: `src/main.tsx` or `src/App.tsx` (gate)

**Interfaces:**
- Produces: `useAuth(): { session: Session | null; isLoading: boolean; signIn(email, password): Promise<void>; signOut(): Promise<void> }` - Task 9's queries gate on `session`.

- [ ] **Step 1: Write failing test**

```tsx
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockGetSession = vi.fn().mockResolvedValue({ data: { session: null } });
const mockOnAuthStateChange = vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({ auth: { getSession: mockGetSession, onAuthStateChange: mockOnAuthStateChange } }),
}));

import { AuthProvider, useAuth } from '../AuthContext';

const Probe = () => {
  const { session, isLoading } = useAuth();
  if (isLoading) return <div>loading</div>;
  return <div>{session ? 'in' : 'out'}</div>;
};

describe('AuthProvider', () => {
  it('resolves to signed-out when no session exists', async () => {
    render(<AuthProvider><Probe /></AuthProvider>);
    await waitFor(() => expect(screen.getByText('out')).toBeInTheDocument());
    expect(mockOnAuthStateChange).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Implement AuthContext**

```tsx
import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getSupabase } from '@/config/supabase';
import { queryClient } from '@/lib/queryClient';

interface AuthContextValue {
  session: Session | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = getSupabase();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setIsLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    queryClient.clear();
  };

  return (
    <AuthContext.Provider value={{ session, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextValue => {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
};
```

- [ ] **Step 3: LoginForm + gate**

`LoginForm.tsx`: email + password inputs, submit calls `signIn`, error text on failure, styled with the existing Tailwind theme (frosted-glass card, `bg-alpine-teal` button - match `POIModal` styling). In `App.tsx`: `isLoading` renders the existing `LoadingSpinner`; no session renders `<LoginForm />`; otherwise the current app tree. This is deliberately minimal - route-based guards, Google sign-in, and sign-out UI are M2.

- [ ] **Step 4: Provision family accounts (manual)**

Supabase dashboard > Authentication > Users > "Add user" for each family member (email + password). Confirm sign-up remains disabled.

- [ ] **Step 5: Verify and commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: add supabase auth bootstrap with minimal login gate"
```

---

### Task 9: Swap the read path to useQuery; slim AppStateContext

**Files:**
- Modify: `src/hooks/useTripData.ts`, `src/hooks/useTrips.ts`, `src/contexts/AppStateContext.tsx`, `src/App.tsx`, `src/contexts/__tests__/AppStateContext.test.tsx`
- Create: `src/services/viewStateStorage.ts`

**Interfaces:**
- Consumes: `fetchTripById`, `fetchTripSummaries` (Task 4), `tripKeys` (Task 7), `useAuth` (Task 8).
- Produces:
  - `useTripData({ tripId }): { tripData: TripData | null; isLoading: boolean; error: string | null; refetch: () => void }` (shape unchanged from today - `App.tsx` consumers keep working).
  - `viewStateStorage`: `getLastViewedBase/setLastViewedBase(tripId, baseId)`, `getMapLayerPreferences/setMapLayerPreferences` - localStorage-only replacements for the storageService equivalents.
  - Slimmed `AppState`: `{ currentTripId, currentBase, selectedActivity, poiModal, poiSearch }`. Removed: `tripData`, `availableTrips`, `userModifications`, `weatherData`, `loading`, `error` and their actions (`SET_TRIP_DATA`, `LOAD_TRIP`, `TOGGLE_ACTIVITY_DONE`, `REORDER_ACTIVITIES`, `SET_WEATHER_DATA`, `SET_USER_MODIFICATIONS`, `SET_AVAILABLE_TRIPS`, `SET_LOADING`, `SET_ERROR`).

- [ ] **Step 1: Rewrite `useTripData` on useQuery**

```typescript
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { tripKeys } from '@/lib/queryClient';
import { fetchTripById } from '@/services/supabaseService';

export function useTripData({ tripId }: { tripId: string }) {
  const { session } = useAuth();
  const query = useQuery({
    queryKey: tripKeys.detail(tripId),
    queryFn: () => fetchTripById(tripId),
    enabled: Boolean(session),
  });
  return {
    tripData: query.data ?? null,
    isLoading: query.isPending,
    error: query.error ? query.error.message : null,
    refetch: query.refetch,
  };
}
```

`useTrips` gets the same treatment with `tripKeys.all` + `fetchTripSummaries` (it stays unwired in the UI until M3, but the hook compiles and is tested).

- [ ] **Step 2: Slim the context**

In `AppStateContext.tsx` remove the server-state fields and actions listed in Interfaces. Keep `SELECT_BASE`, `SELECT_ACTIVITY`, `SET_CURRENT_TRIP_ID`, and all POI modal/search actions. The two POI reducer cases that mutated `tripData` in memory (`ADD_ACTIVITY_FROM_POI`, `ADD_SCENIC_WAYPOINT_FROM_POI`, lines 218-262) move out of the reducer: the ActivitiesPanel handler patches the query cache instead, preserving today's memory-only behavior (persistence arrives in M4):

```typescript
queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) =>
  old ? addActivityToStop(old, stopId, newActivity) : old
);
```

`addActivityToStop` is the same pure logic extracted from the current reducer case - move it to `src/utils/activityUtils.ts` with its existing test (`handleAddActivityFromPOI.test.ts`) updated to call it directly.

- [ ] **Step 3: Replace storageService view-state calls**

`viewStateStorage.ts`: thin localStorage wrappers keyed `wanderlog_last_viewed_base_${tripId}` and `wanderlog_map_layer_preferences` (reuse the validation logic from `storageService.ts:398-504` for map prefs). `App.tsx`'s init effect reads `getLastViewedBase(tripId)` to seed `SELECT_BASE`; the auto-save-to-Firebase effect (`App.tsx:53-61`) is deleted.

- [ ] **Step 4: Update tests, verify, commit**

Update `AppStateContext.test.tsx` for the slimmed shape (remove tests for deleted actions; keep SELECT/POI tests). Add a `useTripData` test rendering under `QueryClientProvider` + mocked service.

```bash
pnpm test:run && pnpm build
```

Expected: suite green (count will shift as removed-action tests go). Manual: sign in, app loads the trip from Supabase, map/timeline/activities render as before.

```bash
git add -A && git commit -m "feat: read trip data from supabase via tanstack query"
```

---

### Task 10: Done-toggle and reorder as optimistic mutations

**Files:**
- Create: `src/hooks/useTripMutations.ts`, `src/hooks/__tests__/useTripMutations.test.tsx`
- Modify: `src/App.tsx` (handlers call mutations)

**Interfaces:**
- Consumes: `setActivityDone`, `setWaypointDone`, `reorderActivities` (Task 5), `tripKeys` (Task 7).
- Produces:

```typescript
export function useToggleActivityDone(tripId: string): UseMutationResult<void, Error, { activityId: string; isDone: boolean; isWaypoint: boolean }>;
export function useReorderActivities(tripId: string): UseMutationResult<void, Error, { stopId: string; orderedActivityIds: string[] }>;
```

- [ ] **Step 1: Write failing tests (optimistic patch + rollback)**

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

const mockSetActivityDone = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  setActivityDone: (...args: unknown[]) => mockSetActivityDone(...args),
  setWaypointDone: vi.fn(),
  reorderActivities: vi.fn(),
}));

import { tripKeys } from '@/lib/queryClient';
import { useToggleActivityDone } from '../useTripMutations';

const seedTrip = {
  trip_id: 't1', trip_name: 'Trip', timezone: 'UTC',
  stops: [{
    stop_id: 's1', name: 'Stop', date: { from: '2025-12-13', to: '2025-12-14' },
    location: { lat: 0, lng: 0 }, duration_days: 1,
    activities: [{ activity_id: 'act-1', activity_name: 'A', order: 0, status: { done: false } }],
    scenic_waypoints: [],
  }],
};

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(tripKeys.detail('t1'), seedTrip);
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

it('optimistically flips status.done before the server responds', async () => {
  mockSetActivityDone.mockReturnValue(new Promise(() => {}));  // never resolves
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useToggleActivityDone('t1'), { wrapper });
  result.current.mutate({ activityId: 'act-1', isDone: true, isWaypoint: false });
  await waitFor(() => {
    const trip = client.getQueryData(tripKeys.detail('t1'));
    expect(trip.stops[0].activities[0].status.done).toBe(true);
  });
});

it('rolls back the cache when the write fails', async () => {
  mockSetActivityDone.mockRejectedValue(new Error('offline'));
  const { client, wrapper } = setup();
  const { result } = renderHook(() => useToggleActivityDone('t1'), { wrapper });
  result.current.mutate({ activityId: 'act-1', isDone: true, isWaypoint: false });
  await waitFor(() => expect(result.current.isError).toBe(true));
  const trip = client.getQueryData(tripKeys.detail('t1'));
  expect(trip.stops[0].activities[0].status.done).toBe(false);
});
```

- [ ] **Step 2: Implement**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { tripKeys } from '@/lib/queryClient';
import { reorderActivities, setActivityDone, setWaypointDone } from '@/services/supabaseService';
import type { TripData } from '@/types/trip';

const patchTrip = (trip: TripData, fn: (trip: TripData) => TripData) => fn(structuredClone(trip));

export function useToggleActivityDone(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ activityId, isDone, isWaypoint }: { activityId: string; isDone: boolean; isWaypoint: boolean }) =>
      isWaypoint ? setWaypointDone(activityId, isDone) : setActivityDone(activityId, isDone),
    onMutate: async ({ activityId, isDone }) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = queryClient.getQueryData<TripData>(tripKeys.detail(tripId));
      queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) =>
        old
          ? patchTrip(old, (trip) => {
              for (const stop of trip.stops) {
                for (const item of [...stop.activities, ...(stop.scenic_waypoints ?? [])]) {
                  if (item.activity_id === activityId) item.status = { done: isDone };
                }
              }
              return trip;
            })
          : old
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(tripKeys.detail(tripId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
  });
}

export function useReorderActivities(tripId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ orderedActivityIds }: { stopId: string; orderedActivityIds: string[] }) =>
      reorderActivities(orderedActivityIds),
    onMutate: async ({ stopId, orderedActivityIds }) => {
      await queryClient.cancelQueries({ queryKey: tripKeys.detail(tripId) });
      const previous = queryClient.getQueryData<TripData>(tripKeys.detail(tripId));
      queryClient.setQueryData<TripData>(tripKeys.detail(tripId), (old) =>
        old
          ? patchTrip(old, (trip) => {
              const stop = trip.stops.find((s) => s.stop_id === stopId);
              if (stop) {
                const byId = new Map(stop.activities.map((a) => [a.activity_id, a]));
                stop.activities = orderedActivityIds
                  .map((id) => byId.get(id))
                  .filter((a) => a !== undefined)
                  .map((a, index) => ({ ...a, order: index }));
              }
              return trip;
            })
          : old
      );
      return { previous };
    },
    onError: (_error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(tripKeys.detail(tripId), context.previous);
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: tripKeys.detail(tripId) }),
  });
}
```

- [ ] **Step 3: Wire into App.tsx**

`handleToggleDone` and `handleReorder` call the mutations instead of dispatching. The reorder handler translates the existing `(fromIndex, toIndex)` drag result into `orderedActivityIds` from the currently sorted list. On mutation error, show the existing `Toast` with the error message (retry affordance is an M4 requirement, Req 4.8; not built here). `sortActivitiesByOrder` keeps working because the mapper writes `order` onto each activity.

- [ ] **Step 4: Verify and commit**

```bash
pnpm test:run && pnpm build
```

Manual: toggle a checkmark, refresh - it survives (now server-side). Drag-reorder, refresh - order survives on every family device, not just this browser.

```bash
git add -A && git commit -m "feat: persist done status and activity order to supabase"
```

---

### Task 11: Weather on useQuery

**Files:**
- Modify: `src/hooks/useWeather.ts`, `src/services/weatherService.ts`, `src/components/Cards/WeatherCard.tsx`

**Interfaces:**
- Consumes: `weatherKeys` (Task 7), `WeatherService.fetchWeatherData` (unchanged Open-Meteo call).
- Produces: `useWeather(coords, baseId): { weather: WeatherData | null; isStale: boolean; updatedAt: number | null }`.

- [ ] **Step 1: Rewrite the hook**

```typescript
import { useQuery } from '@tanstack/react-query';
import { weatherKeys } from '@/lib/queryClient';
import { WeatherService } from '@/services/weatherService';
import type { Coordinates } from '@/types/map';

const SIX_HOURS_MS = 6 * 60 * 60 * 1000;

export function useWeather(coords: Coordinates | null, baseId: string) {
  const query = useQuery({
    queryKey: weatherKeys.base(baseId),
    queryFn: () => WeatherService.fetchWeatherData(coords as Coordinates),
    enabled: coords !== null,
    staleTime: SIX_HOURS_MS,
  });
  return {
    weather: query.data ?? null,
    isStale: query.isStale,
    updatedAt: query.dataUpdatedAt || null,
  };
}
```

The 6h staleness rule (amended Req 1.5) now lives in `staleTime`; delete `getWeatherData`/cache methods from `WeatherService`, keeping `fetchWeatherData`, `getWeatherDescription`, `getWeatherIcon`. Update `weatherService.test.ts` accordingly.

- [ ] **Step 2: Show the timestamp on stale data**

`WeatherCard` renders `updatedAt` ("as of 14:30") whenever `isStale` is true - offline, the persisted cache serves old data with its timestamp instead of an error (Req 5.4).

- [ ] **Step 3: Verify and commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: serve weather through tanstack query with 6h staleness"
```

---

### Task 12: Legacy cleanup - firebase out of the app bundle

**Files:**
- Delete: `src/hooks/useAppState.ts`, `src/hooks/useLocalStorage.ts`
- Modify: `src/services/storageService.ts` (gut), `src/services/exportService.ts` / `src/utils/exportUtils.ts`, `src/App.tsx`, `src/components/Activities/ActivitiesPanel.tsx`, affected tests

**Interfaces:**
- Consumes: everything above shipped; these modules are now dead weight.
- Produces: an app bundle with zero firebase imports. `firebaseService`/`firebase.ts` files stay for the migration script only.

- [ ] **Step 1: Update the export path**

Export no longer merges user modifications (they are canonical in the trip data now): `ExportService.exportAndDownload(tripData)` drops its `modifications` parameter; `mergeUserModificationsWithTripData` and `exportUtils.exportTripData`'s storage read are deleted. The exported JSON keeps its shape - `status.done` and `order` come from the mapped trip. Update `exportService.test.ts`.

- [ ] **Step 2: Delete dead modules**

Remove `useAppState.ts`, `useLocalStorage.ts`, and everything in `storageService.ts` except what `viewStateStorage.ts` replaced (if nothing imports the remainder, delete the file and its test; `getCurrentTripId`/`setCurrentTripId` move to `viewStateStorage.ts`). Remove the `initializeFirebase()` call from `App.tsx:32-34`.

- [ ] **Step 3: Prove firebase left the bundle**

```bash
grep -rn "firebase" src/ --include="*.ts" --include="*.tsx" | grep -v __tests__
pnpm build
```

Expected: only `src/config/firebase.ts` and `src/services/firebaseService.ts` remain (script-only, imported by nothing in `src/`), and the built bundle in `dist/assets/` shrinks (firebase was ~200KB+ of it; compare `ls -lh` before/after).

- [ ] **Step 4: Verify and commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "refactor: remove firestore dual-write and legacy state hooks from app"
```

---

### Task 13: Vercel previews + CI deploy pipeline

**Files:**
- Create: `vercel.json`, `.github/workflows/vercel-preview.yml`
- Modify: `vite.config.ts` (env-driven base)

**Interfaces:**
- Produces: every push gets a Vercel preview URL running against Supabase - where the Task 14 parity checklist runs. GH Pages remains production (cutover is M2).

- [ ] **Step 1: Env-driven base path**

GH Pages needs `/wanderlog/`, Vercel needs `/`. In `vite.config.ts`:

```typescript
base: process.env.VITE_BASE_PATH ?? '/wanderlog/',
```

Vercel project env sets `VITE_BASE_PATH=/`; the GH Pages workflow is untouched.

- [ ] **Step 2: Vercel project + config**

Create the project via dashboard (framework preset: Vite). `vercel.json`:

```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Vercel env vars (all environments): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_GOOGLE_MAPS_API_KEY`, `VITE_BASE_PATH=/`. Disable Vercel's Git auto-deploy (Project Settings > Git > ignored build step `exit 0`) - deploys come from CI so tests gate them (Req 6.2).

- [ ] **Step 3: CI workflow**

`.github/workflows/vercel-preview.yml`:

```yaml
name: Vercel Preview
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test-and-preview:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 10
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm test:run
      - run: pnpm dlx vercel pull --yes --environment=preview --token=${{ secrets.VERCEL_TOKEN }}
      - run: pnpm dlx vercel build --token=${{ secrets.VERCEL_TOKEN }}
      - run: pnpm dlx vercel deploy --prebuilt --token=${{ secrets.VERCEL_TOKEN }}
```

GitHub repo secrets: `VERCEL_TOKEN`, plus `VERCEL_ORG_ID`/`VERCEL_PROJECT_ID` as env vars in the workflow (from `vercel link` output). Add the preview domain to the Maps key referrer restrictions (Req 7).

- [ ] **Step 4: Verify and commit**

```bash
git add vercel.json .github/workflows/vercel-preview.yml vite.config.ts
git commit -m "ci: add vercel preview deploys gated on tests"
git push
gh run watch
```

Expected: workflow green; the printed preview URL serves the app at the root path; GH Pages deploy still green with `/wanderlog/` base.

---

### Task 14: Parity checklist walk (Req 1.7) + M1 sign-off

**Files:**
- Modify: `docs/specs/plan_wanderlog-phase-2.md` (M1 status)

On the Task 13 Vercel preview URL, signed in as a family member, side by side with GH Pages production:

- [ ] Login required: incognito window shows only the login screen; network tab shows zero Supabase data requests before sign-in (Req 2.1)
- [ ] Map renders all accommodation + activity pins for `202512_NZ`
- [ ] Route polyline draws through scenic waypoints, matching production
- [ ] Timeline strip shows all stops; navigation selects bases
- [ ] Activity lists per stop match production, in the same order
- [ ] Done checkmarks match the pre-migration state (Firestore overlay worked)
- [ ] Toggle done: persists across refresh and appears on a second device/browser
- [ ] Drag-reorder: persists across refresh and on a second device
- [ ] Weather cards render; kill the network, reload - cached trip renders read-only, weather shows its timestamp (Req 5.2, 5.4)
- [ ] Export downloads JSON with `status.done` and `order` populated
- [ ] POI search adds an activity to the panel (in-memory, as today)
- [ ] Firestore console: data untouched, no writes since migration (Req 8.1)

- [ ] **Sign off**

Set the M1 row in `plan_wanderlog-phase-2.md` to `Shipped (<date>)`.

```bash
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M1 supabase foundation shipped"
```

---

## Self-Review Notes

- Rollback (Req 8.2): every task leaves GH Pages production untouched; reverting is `git revert` of the offending commit - no dual-backend flag, per the design decision.
- The parity checklist is embedded in Task 14 rather than a separate doc; the requirement asks for a written checklist, which this is, version-controlled.
- `TripSummary` sorting: `fetchTripSummaries` orders by `start_date` descending (library needs, Req 3.2) even though M1 renders a single trip - one query shape, no rework in M3.
- Weather `enabled: coords !== null` preserves today's behavior where bases always have coordinates; the cast is safe because `enabled` gates execution.

## Changelog

- 2026-07-03: Initial plan.
