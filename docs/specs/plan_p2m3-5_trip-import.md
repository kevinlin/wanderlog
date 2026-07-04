# Trip Import (Phase 2, M3.5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Trip creation becomes file import: drag-and-drop a trip data JSON (Wanderlog export or TripIt export) into the create modal, validate it with zod, convert TripIt files (geocoding lodging addresses), and save the trip to Supabase with fresh ids - nothing is saved without a file that passes validation (Req 3.5, 3.7-3.9).

**Architecture:** A client-side pipeline - `file → JSON.parse → detectFormat → zod validate → convert (TripIt: + geocode) → withFreshIds → buildRows → importTrip`. New modules: `src/schemas/tripFileSchemas.ts` (zod schemas), `src/services/tripImportService.ts` (detection, orchestration, TripIt conversion), `src/services/geocodingService.ts` (Maps Geocoder wrapper). `CreateTripModal` is replaced by `ImportTripModal` with drop-zone / processing / preview / error-list states. See [design_wanderlog-phase-2.md](design_wanderlog-phase-2.md) § Trip Import (M3.5).

**Tech Stack:** zod 4 (new dependency), TanStack Query v5, @supabase/supabase-js v2, @react-google-maps/api (`useJsApiLoader`), date-fns, Tailwind 4, Vitest 4.

## Global Constraints

- Prerequisite: M3 shipped ([plan_p2m3_trip-library.md](plan_p2m3_trip-library.md)).
- No DB schema changes: the M1 tables cover everything; RLS's blanket authenticated CRUD covers the new inserts.
- All imported rows get client-generated `crypto.randomUUID()` ids (Req 3.9). Never preserve ids from the file.
- `buildRows` (supabaseMappers) is reused as-is for domain→row conversion. Do not modify it.
- `validationUtils.ts` stays untouched - it serves other callers; the zod schemas are the import gate.
- Blank-trip creation is removed (Req 3.5 amendment): `createTrip`/`useCreateTrip` are deleted with their tests.
- After every task: `pnpm test:run` and `pnpm build` green. One commit per task.

---

### Task 1: zod + Wanderlog-file schema (TDD)

**Files:**
- Create: `src/schemas/tripFileSchemas.ts`, `src/schemas/__tests__/tripFileSchemas.test.ts`, `src/testing/fixtures/tripFiles.ts`
- Modify: `package.json` (zod dependency)

**Interfaces:**
- Produces (consumed by Tasks 2, 3):

```typescript
// src/schemas/tripFileSchemas.ts
export const wanderlogTripSchema: z.ZodType<...>;   // validates a TripData-shaped object
export type WanderlogTrip = z.infer<typeof wanderlogTripSchema>;
export const toTripData: (parsed: WanderlogTrip) => TripData;  // fills duration_days / defaults
```

- [x] **Step 1: Install zod**

```bash
pnpm add zod
```

Expect `zod` (^4.x) under `dependencies` in `package.json`.

- [x] **Step 2: Create shared fixtures**

`src/testing/fixtures/tripFiles.ts` - trimmed, type-loose (plain objects, `as const` not needed) versions of the real sample files. Keep them small; they are shared by schema, converter, and modal tests.

```typescript
// Trimmed from local/trip-data/202606_DaNang_trip-plan.json (native export wrapper)
export const danangFile = {
  exportDate: '2026-05-29T00:00:00.000Z',
  tripData: {
    trip_name: 'Da Nang, Vietnam — May 30 to Jun 7, 2026',
    timezone: 'Asia/Ho_Chi_Minh',
    created_at: '2026-05-29T08:00:00.000Z',
    stops: [
      {
        stop_id: 'grand-mercure-danang',
        name: 'Grand Mercure Danang',
        date: { from: '2026-05-30', to: '2026-05-31' },
        duration_days: 1,
        location: { lat: 16.0483415, lng: 108.2267041 },
        accommodation: {
          name: 'Grand Mercure Danang',
          address: 'Lot A1 Zone of the Villas, Green Island, Danang, Vietnam',
          check_in: '2026-05-30 14:00',
          check_out: '2026-05-31 12:00',
          phone: '+84 2363797777',
        },
        activities: [
          {
            activity_id: 'dragon_bridge',
            activity_name: 'Dragon Bridge (Cau Rong)',
            activity_type: 'attraction',
            duration: '~1h',
            location: { lat: 16.06111, lng: 108.22667, address: 'Dragon Bridge, Da Nang' },
            order: 2,
            status: { done: false },
            url: '',
          },
        ],
        scenic_waypoints: [],
      },
      {
        stop_id: 'mercure-bana-hills',
        name: 'Mercure Danang French Village Bana Hills',
        date: { from: '2026-05-31', to: '2026-06-02' },
        duration_days: 2,
        location: { lat: 16.0451998, lng: 108.1132212 },
        activities: [],
      },
    ],
  },
};

// Trimmed from local/trip-data/202505_tripit-zurich-switzerland.json
export const zurichTripitFile = {
  exportDate: '2026-07-04T01:00:00.000Z',
  trips: [
    {
      uuid: '43b83ff3',
      name: 'Zurich, Switzerland, May 2025',
      startDate: '2025-05-11',
      endDate: '2025-05-17',
      primaryLocation: 'Zurich, Switzerland',
      lodging: [
        {
          title: 'Mercure Zurich City',
          address: 'Vulkanstrasse 108b - 8048 ZURICH - Switzerland',
          checkIn: 'Mon, May 12, 2025 3:00 PM CEST',
          checkOut: 'Tue, May 13, 2025 12:00 PM CEST',
          confirmation: 'NBK',
          phone: '+41 435231200',
          website: null,
          notes: 'The 19m² comfort room with double bed.',
        },
        {
          title: 'Hotel Villa Toskana',
          address: 'Hauptstrasse 5, Leimen, Germany',
          checkIn: 'Tue, May 13, 2025 3:00 PM CEST',
          checkOut: 'Fri, May 16, 2025 11:00 AM CEST',
          confirmation: '87201',
          phone: '06224 82920',
          website: { href: 'http://www.hotel-villa-toskana.de/', text: 'http://www.hotel-villa-toskana.de/' },
        },
      ],
      flights: [
        {
          title: 'SIN ZRH',
          flightNumber: 'LX 177',
          airline: 'Swiss',
          route: 'SIN ZRH',
          departureText: 'Singapore May 11Terminal 2 11:30 PM GMT+8',
          arrivalText: 'Zurich May 12 6:15 AM CEST',
          confirmation: '5WK8OF',
        },
        {
          title: 'FRA SIN',
          flightNumber: 'SQ 325',
          airline: 'Singapore Airlines',
          route: 'FRA SIN',
          departureText: 'Frankfurt May 16Terminal 1•Gate B46 9:40 PM CEST',
          arrivalText: 'Singapore May 17Terminal 3•Gate B4 4:05 PM GMT+8',
          confirmation: '5WK8OF',
        },
      ],
      activities: [],
      restaurants: [],
      transport: [],
      rail: [],
    },
  ],
};

// Trimmed from local/trip-data/202702_tripit-kuala-lumpur.json - lodging has NO checkIn/checkOut,
// only checkInText; exercises the fallback parse.
export const klTripitFile = {
  exportDate: '2026-07-04T01:13:41.248Z',
  trips: [
    {
      uuid: '43b83ff3-kl',
      name: 'Kuala Lumpur, Malaysia, February 2027',
      startDate: '2027-02-05',
      endDate: '2027-02-09',
      primaryLocation: 'Kuala Lumpur, Malaysia',
      lodging: [
        {
          title: 'St. Giles Gardens Residences Kuala Lumpur',
          address: 'Lingkaran Syed Putra, Kuala Lumpur, Malaysia, 59200',
          checkIn: null,
          checkOut: null,
          checkInText: 'Check in Fri, Feb 5, 2027 3:00 PM GMT+8 Check out Tue, Feb 9, 2027 11:00 AM GMT+8',
          confirmation: '2024636927',
          website: null,
        },
      ],
      flights: [],
    },
  ],
};
```

- [x] **Step 3: Write failing schema tests**

`src/schemas/__tests__/tripFileSchemas.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { danangFile } from '@/testing/fixtures/tripFiles';
import { toTripData, wanderlogTripSchema } from '../tripFileSchemas';

describe('wanderlogTripSchema', () => {
  it('accepts the native DaNang export tripData', () => {
    const result = wanderlogTripSchema.safeParse(danangFile.tripData);
    expect(result.success).toBe(true);
  });

  it('rejects a trip without trip_name, timezone, or stops', () => {
    const result = wanderlogTripSchema.safeParse({ stops: [] });
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('trip_name');
    expect(paths).toContain('timezone');
    expect(paths).toContain('stops'); // min(1)
  });

  it('rejects an invalid IANA timezone', () => {
    const result = wanderlogTripSchema.safeParse({
      ...danangFile.tripData,
      timezone: 'Not/AZone',
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-range coordinates and bad dates with paths', () => {
    const bad = structuredClone(danangFile.tripData);
    bad.stops[0].location.lat = 123;
    bad.stops[0].date.from = '30-05-2026';
    const result = wanderlogTripSchema.safeParse(bad);
    expect(result.success).toBe(false);
    const paths = result.error?.issues.map((i) => i.path.join('.'));
    expect(paths).toContain('stops.0.location.lat');
    expect(paths).toContain('stops.0.date.from');
  });

  it('treats a degenerate accommodation (no name) as absent', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[0] as Record<string, unknown>).accommodation = {};
    const result = wanderlogTripSchema.safeParse(trip);
    expect(result.success).toBe(true);
    expect(result.data?.stops[0].accommodation).toBeUndefined();
  });

  it('rejects an unknown activity_type', () => {
    const trip = structuredClone(danangFile.tripData);
    trip.stops[0].activities[0].activity_type = 'lodging';
    expect(wanderlogTripSchema.safeParse(trip).success).toBe(false);
  });
});

describe('toTripData', () => {
  it('fills duration_days from the date range when missing', () => {
    const trip = structuredClone(danangFile.tripData);
    (trip.stops[1] as Record<string, unknown>).duration_days = undefined;
    const parsed = wanderlogTripSchema.parse(trip);
    expect(toTripData(parsed).stops[1].duration_days).toBe(2); // 05-31 → 06-02
  });
});
```

- [x] **Step 4: Run to verify failure**

Run: `pnpm vitest run src/schemas/__tests__/tripFileSchemas.test.ts`
Expected: FAIL - cannot resolve `../tripFileSchemas`.

- [x] **Step 5: Implement the schema**

`src/schemas/tripFileSchemas.ts`:

```typescript
import { differenceInCalendarDays } from 'date-fns';
import { z } from 'zod';
import { ActivityType, type TripData } from '@/types/trip';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const dateString = z.string().regex(DATE_RE, 'expected YYYY-MM-DD');

const isIanaTimezone = (timezone: string): boolean => {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
};

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

const coordinatesSchema = z.object({
  lat: z.number().min(LAT_MIN).max(LAT_MAX),
  lng: z.number().min(LNG_MIN).max(LNG_MAX),
});

const activityLocationSchema = z.object({
  lat: z.number().min(LAT_MIN).max(LAT_MAX).optional(),
  lng: z.number().min(LNG_MIN).max(LNG_MAX).optional(),
  address: z.string().optional(),
});

const activitySchema = z.object({
  activity_id: z.string().default(''), // regenerated by withFreshIds
  activity_name: z.string().min(1),
  activity_type: z.enum(Object.values(ActivityType) as [ActivityType, ...ActivityType[]]).optional(),
  location: activityLocationSchema.optional(),
  duration: z.string().optional(),
  travel_time_from_accommodation: z.string().optional(),
  url: z.string().optional(),
  remarks: z.string().optional(),
  thumbnail_url: z.string().optional(),
  google_place_id: z.string().optional(),
  order: z.number().optional(),
  status: z.object({ done: z.boolean() }).optional(),
});

const waypointSchema = z.object({
  activity_id: z.string().default(''),
  activity_name: z.string().min(1),
  location: activityLocationSchema.default({}),
  duration: z.string().optional(),
  url: z.string().optional(),
  remarks: z.string().optional(),
  thumbnail_url: z.string().optional(),
  google_place_id: z.string().optional(),
  status: z.object({ done: z.boolean() }).optional(),
});

const accommodationSchema = z.object({
  name: z.string().min(1),
  address: z.string().default(''),
  check_in: z.string().default(''),
  check_out: z.string().default(''),
  confirmation: z.string().optional(),
  url: z.string().optional(),
  thumbnail_url: z.string().optional(),
  google_place_id: z.string().optional(),
  phone: z.string().optional(),
  room: z.string().optional(),
  host: z.string().optional(),
  location: coordinatesSchema.optional(),
});

// Legacy exports can carry a degenerate {} accommodation; treat nameless as absent
// (mirrors the buildRows name guard).
const optionalAccommodation = z.preprocess(
  (value) =>
    value && typeof value === 'object' && (value as { name?: unknown }).name ? value : undefined,
  accommodationSchema.optional()
);

const stopSchema = z.object({
  stop_id: z.string().default(''), // regenerated by withFreshIds
  name: z.string().min(1),
  date: z.object({ from: dateString, to: dateString }),
  location: coordinatesSchema,
  duration_days: z.number().optional(),
  travel_time_from_previous: z.string().optional(),
  accommodation: optionalAccommodation,
  activities: z.array(activitySchema).default([]),
  scenic_waypoints: z.array(waypointSchema).default([]),
});

export const wanderlogTripSchema = z.object({
  trip_name: z.string().min(1),
  timezone: z.string().refine(isIanaTimezone, 'must be a valid IANA timezone'),
  stops: z.array(stopSchema).min(1, 'trip must contain at least one stop'),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type WanderlogTrip = z.infer<typeof wanderlogTripSchema>;

export const toTripData = (parsed: WanderlogTrip): TripData => ({
  ...parsed,
  stops: parsed.stops.map((stop) => ({
    ...stop,
    duration_days:
      stop.duration_days ??
      differenceInCalendarDays(new Date(`${stop.date.to}T00:00:00`), new Date(`${stop.date.from}T00:00:00`)),
  })),
});
```

Note: unknown keys (`constraints`, `travellers`, `vehicle`, `exportDate` siblings) are stripped by zod's default object behavior - deliberate; the DB has no columns for them.

- [x] **Step 6: Run to green, full suite, commit**

```bash
pnpm vitest run src/schemas/__tests__/tripFileSchemas.test.ts && pnpm test:run && pnpm build
git add -A && git commit -m "feat: add zod schema for wanderlog trip files"
```

---

### Task 2: Format detection, fresh ids, native parse path (TDD)

**Files:**
- Create: `src/services/tripImportService.ts`, `src/services/__tests__/tripImportService.test.ts`

**Interfaces:**
- Consumes: `wanderlogTripSchema`, `toTripData` (Task 1).
- Produces (consumed by Tasks 3, 5, 6):

```typescript
export interface ImportIssue { path: string; message: string; }
export interface ImportPreview {
  tripData: TripData;          // fresh ids already applied
  format: 'wanderlog' | 'tripit';
  warnings: string[];
  stopCount: number;
  activityCount: number;
}
export type ParseResult = { ok: true; preview: ImportPreview } | { ok: false; errors: ImportIssue[] };
export type GeocodeFn = (address: string) => Promise<{ lat: number; lng: number } | null>;

export function detectFormat(raw: unknown): 'wanderlog' | 'tripit' | 'unknown';
export function withFreshIds(trip: TripData): TripData;
export function parseTripFile(text: string, geocode: GeocodeFn): Promise<ParseResult>;
```

- [x] **Step 1: Write failing tests**

`src/services/__tests__/tripImportService.test.ts` (TripIt path lands in Task 3; a stub geocode fn is enough here):

```typescript
import { describe, expect, it, vi } from 'vitest';
import { danangFile, zurichTripitFile } from '@/testing/fixtures/tripFiles';
import { detectFormat, parseTripFile, withFreshIds } from '../tripImportService';

const geocodeStub = vi.fn(async () => ({ lat: 1, lng: 2 }));

describe('detectFormat', () => {
  it('detects the wanderlog export wrapper and bare TripData', () => {
    expect(detectFormat(danangFile)).toBe('wanderlog');
    expect(detectFormat(danangFile.tripData)).toBe('wanderlog');
  });
  it('detects a TripIt export', () => {
    expect(detectFormat(zurichTripitFile)).toBe('tripit');
  });
  it('returns unknown otherwise', () => {
    expect(detectFormat({ foo: 1 })).toBe('unknown');
    expect(detectFormat(null)).toBe('unknown');
  });
});

describe('withFreshIds', () => {
  it('mints new uuids and keeps counts and names', () => {
    const parsed = structuredClone(danangFile.tripData);
    const fresh = withFreshIds(parsed as never);
    expect(fresh.trip_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.stops[0].stop_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.stops[0].stop_id).not.toBe('grand-mercure-danang');
    expect(fresh.stops[0].activities[0].activity_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(fresh.stops[0].activities[0].activity_name).toBe('Dragon Bridge (Cau Rong)');
    // two calls never collide
    expect(withFreshIds(parsed as never).trip_id).not.toBe(fresh.trip_id);
  });
});

describe('parseTripFile - wanderlog path', () => {
  it('parses a valid native file into a preview', async () => {
    const result = await parseTripFile(JSON.stringify(danangFile), geocodeStub);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.format).toBe('wanderlog');
      expect(result.preview.stopCount).toBe(2);
      expect(result.preview.activityCount).toBe(1);
      expect(result.preview.tripData.trip_name).toContain('Da Nang');
      expect(geocodeStub).not.toHaveBeenCalled();
    }
  });

  it('rejects broken JSON with a single error', async () => {
    const result = await parseTripFile('{not json', geocodeStub);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual([{ path: 'file', message: 'not valid JSON' }]);
    }
  });

  it('rejects an unrecognized format', async () => {
    const result = await parseTripFile('{"foo": 1}', geocodeStub);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors[0].message).toMatch(/unrecognized file format/i);
    }
  });

  it('maps zod issues to path: message entries', async () => {
    const bad = structuredClone(danangFile);
    bad.tripData.stops[0].location.lat = 123;
    const result = await parseTripFile(JSON.stringify(bad), geocodeStub);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors.some((e) => e.path === 'stops[0].location.lat')).toBe(true);
    }
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/services/__tests__/tripImportService.test.ts`
Expected: FAIL - cannot resolve `../tripImportService`.

- [x] **Step 3: Implement**

`src/services/tripImportService.ts`:

```typescript
import { toTripData, wanderlogTripSchema } from '@/schemas/tripFileSchemas';
import type { TripData } from '@/types/trip';

export interface ImportIssue {
  path: string;
  message: string;
}

export interface ImportPreview {
  tripData: TripData;
  format: 'wanderlog' | 'tripit';
  warnings: string[];
  stopCount: number;
  activityCount: number;
}

export type ParseResult = { ok: true; preview: ImportPreview } | { ok: false; errors: ImportIssue[] };

export type GeocodeFn = (address: string) => Promise<{ lat: number; lng: number } | null>;

const UNKNOWN_FORMAT_MESSAGE =
  'Unrecognized file format. Supported: Wanderlog trip export (trip_name + stops) and TripIt export (trips list).';

export function detectFormat(raw: unknown): 'wanderlog' | 'tripit' | 'unknown' {
  if (!raw || typeof raw !== 'object') {
    return 'unknown';
  }
  const obj = raw as Record<string, unknown>;
  const candidate = (obj.tripData ?? obj) as Record<string, unknown>;
  if (candidate && typeof candidate === 'object' && 'trip_name' in candidate && 'stops' in candidate) {
    return 'wanderlog';
  }
  if (Array.isArray(obj.trips)) {
    return 'tripit';
  }
  return 'unknown';
}

export function withFreshIds(trip: TripData): TripData {
  return {
    ...trip,
    trip_id: crypto.randomUUID(),
    stops: trip.stops.map((stop) => ({
      ...stop,
      stop_id: crypto.randomUUID(),
      activities: stop.activities.map((activity) => ({ ...activity, activity_id: crypto.randomUUID() })),
      scenic_waypoints: (stop.scenic_waypoints ?? []).map((waypoint) => ({
        ...waypoint,
        activity_id: crypto.randomUUID(),
      })),
    })),
  };
}

const formatPath = (path: readonly PropertyKey[]): string => {
  const joined = path.reduce<string>(
    (acc, segment) =>
      typeof segment === 'number' ? `${acc}[${segment}]` : acc ? `${acc}.${String(segment)}` : String(segment),
    ''
  );
  return joined || 'file';
};

const toIssues = (error: { issues: { path: readonly PropertyKey[]; message: string }[] }): ImportIssue[] =>
  error.issues.map((issue) => ({ path: formatPath(issue.path), message: issue.message }));

const toPreview = (tripData: TripData, format: 'wanderlog' | 'tripit', warnings: string[]): ImportPreview => ({
  tripData: withFreshIds(tripData),
  format,
  warnings,
  stopCount: tripData.stops.length,
  activityCount: tripData.stops.reduce((sum, stop) => sum + stop.activities.length, 0),
});

export async function parseTripFile(text: string, geocode: GeocodeFn): Promise<ParseResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errors: [{ path: 'file', message: 'not valid JSON' }] };
  }

  const format = detectFormat(raw);
  if (format === 'unknown') {
    return { ok: false, errors: [{ path: 'file', message: UNKNOWN_FORMAT_MESSAGE }] };
  }

  if (format === 'wanderlog') {
    const candidate = ((raw as Record<string, unknown>).tripData ?? raw) as Record<string, unknown>;
    const parsed = wanderlogTripSchema.safeParse(candidate);
    if (!parsed.success) {
      return { ok: false, errors: toIssues(parsed.error) };
    }
    return { ok: true, preview: toPreview(toTripData(parsed.data), 'wanderlog', []) };
  }

  return parseTripitFile(raw, geocode);
}

// Implemented in Task 3; keeping the native path shippable on its own.
async function parseTripitFile(_raw: unknown, _geocode: GeocodeFn): Promise<ParseResult> {
  return {
    ok: false,
    errors: [{ path: 'file', message: 'TripIt import not available yet' }],
  };
}
```

- [x] **Step 4: Run to green, full suite, commit**

```bash
pnpm vitest run src/services/__tests__/tripImportService.test.ts && pnpm test:run && pnpm build
git add -A && git commit -m "feat: parse and validate wanderlog trip files with fresh ids"
```

---

### Task 3: TripIt schema + converter (TDD)

**Files:**
- Create: `src/schemas/tripitSchemas.ts`, `src/services/__tests__/tripitConverter.test.ts`
- Modify: `src/services/tripImportService.ts` (replace the Task 2 `parseTripitFile` stub)

**Interfaces:**
- Consumes: `wanderlogTripSchema`/`toTripData` (Task 1), `GeocodeFn`, `ParseResult`, `toPreview` internals (Task 2).
- Produces:

```typescript
// src/schemas/tripitSchemas.ts
export const tripitFileSchema: z.ZodType<...>;
export type TripitFile = z.infer<typeof tripitFileSchema>;

// tripImportService.ts additions (exported for direct unit testing)
export function parseTripitDateTime(text: string): { date: string; time: string } | null;
export function tripitToTripData(file: TripitFile, geocode: GeocodeFn):
  Promise<{ tripData: TripData | null; warnings: string[]; errors: ImportIssue[] }>;
```

- [x] **Step 1: Write the TripIt schema**

`src/schemas/tripitSchemas.ts` - validate only the fields consumed; everything else passes through untyped:

```typescript
import { z } from 'zod';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// TripIt website fields are either a string or a {href, text} object
const websiteSchema = z
  .union([z.string(), z.object({ href: z.string() }).transform((site) => site.href)])
  .nullish();

const lodgingSchema = z.object({
  title: z.string().min(1),
  address: z.string().nullish(),
  checkIn: z.string().nullish(),
  checkOut: z.string().nullish(),
  checkInText: z.string().nullish(),
  confirmation: z.string().nullish(),
  phone: z.string().nullish(),
  website: websiteSchema,
  notes: z.string().nullish(),
});

const flightSchema = z.object({
  title: z.string().nullish(),
  flightNumber: z.string().nullish(),
  airline: z.string().nullish(),
  route: z.string().nullish(),
  departureText: z.string().nullish(),
  arrivalText: z.string().nullish(),
  confirmation: z.string().nullish(),
});

const tripitTripSchema = z.object({
  name: z.string().min(1),
  startDate: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  endDate: z.string().regex(DATE_RE, 'expected YYYY-MM-DD'),
  primaryLocation: z.string().nullish(),
  lodging: z.array(lodgingSchema).default([]),
  flights: z.array(flightSchema).default([]),
});

export const tripitFileSchema = z.object({
  trips: z.array(tripitTripSchema).min(1, 'file contains no trips'),
});

export type TripitFile = z.infer<typeof tripitFileSchema>;
export type TripitTrip = TripitFile['trips'][number];
export type TripitLodging = TripitTrip['lodging'][number];
export type TripitFlight = TripitTrip['flights'][number];
```

- [x] **Step 2: Write failing converter tests**

`src/services/__tests__/tripitConverter.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest';
import { tripitFileSchema } from '@/schemas/tripitSchemas';
import { klTripitFile, zurichTripitFile } from '@/testing/fixtures/tripFiles';
import { parseTripFile, parseTripitDateTime, tripitToTripData } from '../tripImportService';

const geocode = vi.fn(async (address: string) =>
  address.includes('ZURICH') ? { lat: 47.39, lng: 8.49 } : { lat: 49.35, lng: 8.69 }
);

describe('parseTripitDateTime', () => {
  it('parses lodging check-in text', () => {
    expect(parseTripitDateTime('Mon, May 12, 2025 3:00 PM CEST')).toEqual({ date: '2025-05-12', time: '15:00' });
    expect(parseTripitDateTime('Fri, Feb 5, 2027 3:00 PM GMT+8')).toEqual({ date: '2027-02-05', time: '15:00' });
    expect(parseTripitDateTime('Tue, May 13, 2025 12:00 PM CEST')).toEqual({ date: '2025-05-13', time: '12:00' });
  });
  it('returns null for unparseable text', () => {
    expect(parseTripitDateTime('whenever')).toBeNull();
  });
});

describe('tripitToTripData', () => {
  it('converts Zurich: lodgings become geocoded stops, flights become transport activities', async () => {
    const file = tripitFileSchema.parse(zurichTripitFile);
    const { tripData, errors } = await tripitToTripData(file, geocode);
    expect(errors).toEqual([]);
    expect(tripData?.trip_name).toBe('Zurich, Switzerland, May 2025');
    expect(tripData?.stops).toHaveLength(2);

    const [mercure, toskana] = tripData!.stops;
    expect(mercure.name).toBe('Mercure Zurich City');
    expect(mercure.date).toEqual({ from: '2025-05-12', to: '2025-05-13' });
    expect(mercure.location).toEqual({ lat: 47.39, lng: 8.49 });
    expect(mercure.accommodation?.check_in).toBe('2025-05-12 15:00');
    expect(mercure.accommodation?.confirmation).toBe('NBK');
    expect(toskana.accommodation?.url).toBe('http://www.hotel-villa-toskana.de/');

    // LX 177 departs May 11 (before any stop) → nearest stop = Mercure;
    // SQ 325 departs May 16 → contained in Villa Toskana's range.
    const mercureFlights = mercure.activities.filter((a) => a.activity_type === 'transport');
    expect(mercureFlights).toHaveLength(1);
    expect(mercureFlights[0].activity_name).toBe('LX 177: SIN → ZRH');
    const toskanaFlights = toskana.activities.filter((a) => a.activity_type === 'transport');
    expect(toskanaFlights).toHaveLength(1);
    expect(toskanaFlights[0].activity_name).toBe('SQ 325: FRA → SIN');
  });

  it('converts KL: falls back to checkInText when checkIn is null', async () => {
    const file = tripitFileSchema.parse(klTripitFile);
    const { tripData, errors } = await tripitToTripData(file, geocode);
    expect(errors).toEqual([]);
    expect(tripData?.stops[0].date).toEqual({ from: '2027-02-05', to: '2027-02-09' });
    expect(tripData?.stops[0].accommodation?.check_in).toBe('2027-02-05 15:00');
  });

  it('reports a blocking error when geocoding fails', async () => {
    const failingGeocode = vi.fn(async () => null);
    const file = tripitFileSchema.parse(klTripitFile);
    const { tripData, errors } = await tripitToTripData(file, failingGeocode);
    expect(tripData).toBeNull();
    expect(errors[0].message).toMatch(/could not locate/i);
    expect(errors[0].message).toContain('St. Giles Gardens Residences Kuala Lumpur');
  });

  it('errors on a file with no lodging', async () => {
    const file = tripitFileSchema.parse({
      trips: [{ name: 'X', startDate: '2027-01-01', endDate: '2027-01-05', lodging: [], flights: [] }],
    });
    const { errors } = await tripitToTripData(file, geocode);
    expect(errors[0].message).toMatch(/no lodging/i);
  });
});

describe('parseTripFile - tripit path end to end', () => {
  it('produces a preview with fresh ids and a device-timezone warning', async () => {
    const result = await parseTripFile(JSON.stringify(zurichTripitFile), geocode);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview.format).toBe('tripit');
      expect(result.preview.stopCount).toBe(2);
      expect(result.preview.tripData.timezone).toBe(Intl.DateTimeFormat().resolvedOptions().timeZone);
      expect(result.preview.warnings.some((w) => w.includes('timezone'))).toBe(true);
      expect(result.preview.tripData.stops[0].stop_id).toMatch(/^[0-9a-f-]{36}$/);
    }
  });
});
```

- [x] **Step 3: Run to verify failure**

Run: `pnpm vitest run src/services/__tests__/tripitConverter.test.ts`
Expected: FAIL - `parseTripitDateTime`/`tripitToTripData` not exported.

- [x] **Step 4: Implement the converter**

Replace the Task 2 `parseTripitFile` stub in `tripImportService.ts` and add:

```typescript
import { differenceInCalendarDays } from 'date-fns';
import { tripitFileSchema, type TripitFile, type TripitFlight, type TripitLodging, type TripitTrip } from '@/schemas/tripitSchemas';
import type { Activity, TripBase } from '@/types/trip';

const MONTHS: Record<string, string> = {
  Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06',
  Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12',
};

// "Mon, May 12, 2025 3:00 PM CEST" / "Fri, Feb 5, 2027 3:00 PM GMT+8"
const DATETIME_RE = /([A-Z][a-z]{2}) (\d{1,2}),? (\d{4})\s+(\d{1,2}):(\d{2}) (AM|PM)/;
const HOURS_HALF_DAY = 12;

export function parseTripitDateTime(text: string): { date: string; time: string } | null {
  const match = DATETIME_RE.exec(text);
  if (!match) {
    return null;
  }
  const [, monthName, day, year, rawHour, minute, meridiem] = match;
  const month = MONTHS[monthName];
  if (!month) {
    return null;
  }
  let hour = Number(rawHour) % HOURS_HALF_DAY;
  if (meridiem === 'PM') {
    hour += HOURS_HALF_DAY;
  }
  return {
    date: `${year}-${month}-${day.padStart(2, '0')}`,
    time: `${String(hour).padStart(2, '0')}:${minute}`,
  };
}

// "Check in Fri, Feb 5, 2027 3:00 PM GMT+8 Check out Tue, Feb 9, 2027 11:00 AM GMT+8"
const CHECK_TEXT_RE = /Check in (.+?)\s*Check out (.+)$/;

const lodgingCheckTimes = (lodging: TripitLodging): { checkIn: string | null; checkOut: string | null } => {
  if (lodging.checkIn || lodging.checkOut) {
    return { checkIn: lodging.checkIn ?? null, checkOut: lodging.checkOut ?? null };
  }
  const match = lodging.checkInText ? CHECK_TEXT_RE.exec(lodging.checkInText) : null;
  return match ? { checkIn: match[1], checkOut: match[2] } : { checkIn: null, checkOut: null };
};

// "Singapore May 11Terminal 2 11:30 PM GMT+8" → month + day; year resolved from the
// trip start date, rolling over New Year if the resulting date precedes the trip start.
const MONTH_DAY_RE = /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})/;

const flightDate = (flight: TripitFlight, trip: TripitTrip): string | null => {
  const match = flight.departureText ? MONTH_DAY_RE.exec(flight.departureText) : null;
  if (!match) {
    return null;
  }
  const [, monthName, day] = match;
  const year = trip.startDate.slice(0, 4);
  const candidate = `${year}-${MONTHS[monthName]}-${day.padStart(2, '0')}`;
  return candidate < trip.startDate ? `${Number(year) + 1}${candidate.slice(4)}` : candidate;
};

const flightToActivity = (flight: TripitFlight): Activity => {
  const route = flight.route?.replace(' ', ' → ') ?? '';
  const label = flight.flightNumber ?? flight.title ?? 'Flight';
  const legs = [flight.departureText, flight.arrivalText].filter(Boolean).join(' → ');
  return {
    activity_id: '',
    activity_name: route ? `${label}: ${route}` : label,
    activity_type: 'transport',
    remarks: [flight.airline, legs].filter(Boolean).join('. '),
    status: { done: false },
  };
};

const nearestStopIndex = (stops: TripBase[], date: string): number => {
  const contained = stops.findIndex((stop) => stop.date.from <= date && date <= stop.date.to);
  if (contained !== -1) {
    return contained;
  }
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  stops.forEach((stop, index) => {
    const distance = Math.min(
      Math.abs(Date.parse(stop.date.from) - Date.parse(date)),
      Math.abs(Date.parse(stop.date.to) - Date.parse(date))
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  });
  return best;
};

export async function tripitToTripData(
  file: TripitFile,
  geocode: GeocodeFn
): Promise<{ tripData: TripData | null; warnings: string[]; errors: ImportIssue[] }> {
  const warnings: string[] = [];
  const errors: ImportIssue[] = [];
  const trip = file.trips[0];
  if (file.trips.length > 1) {
    warnings.push(`File contains ${file.trips.length} trips; importing "${trip.name}".`);
  }
  if (trip.lodging.length === 0) {
    return {
      tripData: null,
      warnings,
      errors: [{ path: 'trips[0].lodging', message: 'No lodging found - cannot derive stops' }],
    };
  }

  const stops: TripBase[] = [];
  for (const [index, lodging] of trip.lodging.entries()) {
    const address = lodging.address ?? lodging.title;
    let coords: { lat: number; lng: number } | null = null;
    try {
      coords = await geocode(address);
    } catch {
      coords = null;
    }
    if (!coords) {
      errors.push({
        path: `trips[0].lodging[${index}]`,
        message: `Could not locate "${address}" for stop "${lodging.title}"`,
      });
      continue;
    }
    const { checkIn, checkOut } = lodgingCheckTimes(lodging);
    const parsedIn = checkIn ? parseTripitDateTime(checkIn) : null;
    const parsedOut = checkOut ? parseTripitDateTime(checkOut) : null;
    if (!(parsedIn && parsedOut)) {
      warnings.push(`Check-in/check-out times unreadable for "${lodging.title}"; using the trip date range.`);
    }
    const from = parsedIn?.date ?? trip.startDate;
    const to = parsedOut?.date ?? trip.endDate;
    stops.push({
      stop_id: '',
      name: lodging.title,
      date: { from, to },
      location: coords,
      duration_days: differenceInCalendarDays(new Date(`${to}T00:00:00`), new Date(`${from}T00:00:00`)),
      accommodation: {
        name: lodging.title,
        address: lodging.address ?? '',
        check_in: parsedIn ? `${parsedIn.date} ${parsedIn.time}` : '',
        check_out: parsedOut ? `${parsedOut.date} ${parsedOut.time}` : '',
        confirmation: lodging.confirmation ?? undefined,
        url: lodging.website ?? undefined,
        phone: lodging.phone ?? undefined,
      },
      activities: [],
      scenic_waypoints: [],
    });
  }

  if (errors.length > 0) {
    return { tripData: null, warnings, errors };
  }

  stops.sort((a, b) => a.date.from.localeCompare(b.date.from));

  for (const flight of trip.flights) {
    const date = flightDate(flight, trip);
    const stopIndex = date ? nearestStopIndex(stops, date) : 0;
    const activity = flightToActivity(flight);
    activity.order = stops[stopIndex].activities.length;
    stops[stopIndex].activities.push(activity);
  }

  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  warnings.push(`No timezone in TripIt exports - using this device's timezone (${timezone}).`);

  return {
    tripData: { trip_name: trip.name, timezone, stops },
    warnings,
    errors,
  };
}

async function parseTripitFile(raw: unknown, geocode: GeocodeFn): Promise<ParseResult> {
  const parsed = tripitFileSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, errors: toIssues(parsed.error) };
  }
  const { tripData, warnings, errors } = await tripitToTripData(parsed.data, geocode);
  if (!tripData || errors.length > 0) {
    return { ok: false, errors };
  }
  // Final gate: converted output passes the same schema as native files.
  const validated = wanderlogTripSchema.safeParse(tripData);
  if (!validated.success) {
    return { ok: false, errors: toIssues(validated.error) };
  }
  return { ok: true, preview: toPreview(toTripData(validated.data), 'tripit', warnings) };
}
```

- [x] **Step 5: Run to green, full suite, commit**

```bash
pnpm vitest run src/services/__tests__/tripitConverter.test.ts src/services/__tests__/tripImportService.test.ts && pnpm test:run && pnpm build
git add -A && git commit -m "feat: convert TripIt exports to trip data with geocoded stops"
```

---

### Task 4: Shared Maps loader + geocoding service

**Files:**
- Create: `src/config/mapsLoader.ts`, `src/services/geocodingService.ts`, `src/services/__tests__/geocodingService.test.ts`
- Modify: `src/components/Map/MapContainer.tsx` (LoadScript → useJsApiLoader), `src/components/Map/__tests__/MapContainer.test.tsx` (mock update)

**Interfaces:**
- Produces (consumed by Task 6):

```typescript
// src/config/mapsLoader.ts
export const MAPS_LOADER_OPTIONS: { id: string; googleMapsApiKey: string; libraries: 'places'[] };

// src/services/geocodingService.ts
export const geocodeAddress: GeocodeFn;   // GeocodeFn from tripImportService
```

**Why:** `MapContainer` loads Maps via the `<LoadScript>` component, which owns the script tag and removes it on unmount. A second loader on `/trips` (where no map renders) would double-inject the API. `useJsApiLoader` with a shared `id` loads once app-wide and is safe to call from both the map and the import modal.

- [x] **Step 1: Create the shared loader options**

```typescript
// src/config/mapsLoader.ts
export const MAPS_LOADER_OPTIONS = {
  id: 'wanderlog-maps',
  googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? '',
  libraries: ['places'] as 'places'[],
};
```

- [x] **Step 2: Switch MapContainer to useJsApiLoader**

In `MapContainer.tsx`:
- Replace the `LoadScript` import with `useJsApiLoader` (keep the other imports) and add `import { MAPS_LOADER_OPTIONS } from '@/config/mapsLoader';`.
- Delete the local `const libraries: 'places'[] = ['places'];` (line ~49) - it lives in `MAPS_LOADER_OPTIONS` now.
- Add near the top of the component, with the other hooks (must run before any early return):

```typescript
const { isLoaded: isMapsLoaded } = useJsApiLoader(MAPS_LOADER_OPTIONS);
```

- Replace the `<LoadScript googleMapsApiKey={apiKey} libraries={libraries}>` wrapper and its closing tag with:

```tsx
if (!isMapsLoaded) {
  return <LoadingSpinner />; // same spinner the app already uses for route loading
}

return (
  <>
    <GoogleMap ...>   {/* unchanged */}
    ...
  </>
);
```

Keep the existing missing-API-key branch above it unchanged.

- [x] **Step 3: Update the MapContainer test mock**

In `MapContainer.test.tsx`, replace the `LoadScript` mock entry with:

```typescript
useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
```

Run: `pnpm vitest run src/components/Map/__tests__/MapContainer.test.tsx`
Expected: PASS.

- [x] **Step 4: Write failing geocoding tests, implement**

`src/services/__tests__/geocodingService.test.ts`:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { geocodeAddress } from '../geocodingService';

const mockGeocode = vi.fn();

const stubGoogle = () => {
  vi.stubGlobal('google', {
    maps: { Geocoder: class { geocode = mockGeocode; } },
  });
};

afterEach(() => vi.unstubAllGlobals());

describe('geocodeAddress', () => {
  it('returns coordinates for the first result', async () => {
    stubGoogle();
    mockGeocode.mockResolvedValue({
      results: [{ geometry: { location: { lat: () => 47.39, lng: () => 8.49 } } }],
    });
    expect(await geocodeAddress('Vulkanstrasse 108b, Zurich')).toEqual({ lat: 47.39, lng: 8.49 });
    expect(mockGeocode).toHaveBeenCalledWith({ address: 'Vulkanstrasse 108b, Zurich' });
  });

  it('returns null when geocoding rejects (ZERO_RESULTS)', async () => {
    stubGoogle();
    mockGeocode.mockRejectedValue(new Error('ZERO_RESULTS'));
    expect(await geocodeAddress('nowhere')).toBeNull();
  });
});
```

`src/services/geocodingService.ts`:

```typescript
import type { GeocodeFn } from './tripImportService';

// The Maps JS API must be loaded before calling (useJsApiLoader with MAPS_LOADER_OPTIONS).
export const geocodeAddress: GeocodeFn = async (address) => {
  const geocoder = new google.maps.Geocoder();
  try {
    const { results } = await geocoder.geocode({ address });
    const location = results[0]?.geometry.location;
    return location ? { lat: location.lat(), lng: location.lng() } : null;
  } catch {
    return null; // the JS API rejects on ZERO_RESULTS
  }
};
```

- [x] **Step 5: Run to green, full suite + manual map smoke, commit**

```bash
pnpm vitest run src/services/__tests__/geocodingService.test.ts && pnpm test:run && pnpm build
```

Manual: `pnpm dev`, open an existing trip - map, pins, and routes render as before (LoadScript swap is behavior-neutral).

```bash
git add -A && git commit -m "feat: shared maps loader and geocoding service"
```

---

### Task 5: importTrip service function (TDD)

**Files:**
- Modify: `src/services/supabaseService.ts`, `src/services/__tests__/supabaseService.test.ts`

**Interfaces:**
- Consumes: `buildRows` (supabaseMappers, unchanged), `getSupabase`.
- Produces (consumed by Task 6): `importTrip(tripData: TripData): Promise<string>` - returns the new trip id.

- [x] **Step 1: Write failing tests**

Extend `supabaseService.test.ts`. The existing mock returns one shared `chain`; give `insert`/`delete` per-table tracking:

```typescript
it('importTrip inserts the full bundle in FK order', async () => {
  mockInsert.mockResolvedValue({ error: null });
  const tripId = await importTrip(importableTrip); // helper TripData below
  expect(tripId).toBe(importableTrip.trip_id);
  const tables = fromSpy.mock.calls.map(([table]) => table);
  expect(tables).toEqual(['trips', 'stops', 'accommodations', 'activities']);
  // scenic_waypoints empty → no insert call for it
});

it('importTrip deletes the trip row and rethrows when a child insert fails', async () => {
  mockInsert
    .mockResolvedValueOnce({ error: null })                      // trips
    .mockResolvedValueOnce({ error: { message: 'stops boom' } }); // stops
  mockDeleteEq.mockResolvedValue({ error: null });
  await expect(importTrip(importableTrip)).rejects.toThrow('stops boom');
  expect(mockDeleteEq).toHaveBeenCalledWith('id', importableTrip.trip_id);
});
```

Test helper (top of file):

```typescript
const importableTrip: TripData = {
  trip_id: 'fresh-uuid',
  trip_name: 'Imported',
  timezone: 'UTC',
  stops: [
    {
      stop_id: 's1',
      name: 'Stop 1',
      date: { from: '2027-01-01', to: '2027-01-02' },
      location: { lat: 1, lng: 2 },
      duration_days: 1,
      accommodation: { name: 'Hotel', address: '', check_in: '', check_out: '' },
      activities: [
        { activity_id: 'a1', activity_name: 'Thing', status: { done: false } },
      ],
      scenic_waypoints: [],
    },
  ],
};
```

To capture table order, lift the `from` mock into a named spy:

```typescript
const fromSpy = vi.fn(() => ({ ...chain, update: mockUpdate, insert: mockInsert, delete: vi.fn(() => ({ eq: mockDeleteEq })) }));
vi.mock('@/config/supabase', () => ({ getSupabase: () => ({ from: fromSpy }) }));
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/services/__tests__/supabaseService.test.ts`
Expected: FAIL - `importTrip` not exported.

- [x] **Step 3: Implement**

In `supabaseService.ts` (import `buildRows` from `./supabaseMappers`):

```typescript
export async function importTrip(tripData: TripData): Promise<string> {
  const tripId = tripData.trip_id ?? crypto.randomUUID();
  const bundle = buildRows(tripData, tripId);
  const insert = async (table: string, rows: object[]): Promise<void> => {
    if (rows.length === 0) {
      return;
    }
    const { error } = await getSupabase().from(table).insert(rows);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  };
  await insert('trips', [bundle.trip]);
  try {
    await insert('stops', bundle.stops);
    await insert('accommodations', bundle.accommodations);
    await insert('activities', bundle.activities);
    await insert('scenic_waypoints', bundle.scenicWaypoints);
  } catch (error) {
    // Compensation: removing the trip row cascades to any children already inserted.
    await getSupabase().from('trips').delete().eq('id', tripId);
    throw error;
  }
  return tripId;
}
```

- [x] **Step 4: Run to green, full suite, commit**

```bash
pnpm vitest run src/services/__tests__/supabaseService.test.ts && pnpm test:run && pnpm build
git add -A && git commit -m "feat: import full trip bundle with compensation delete"
```

---

### Task 6: ImportTripModal + useImportTrip; remove blank-create

**Files:**
- Create: `src/components/TripLibrary/ImportTripModal.tsx`, `src/components/TripLibrary/__tests__/ImportTripModal.test.tsx`
- Modify: `src/hooks/useTripLibraryMutations.ts`, `src/pages/TripLibraryPage.tsx`
- Delete: `src/components/TripLibrary/CreateTripModal.tsx`, `src/components/TripLibrary/__tests__/CreateTripModal.test.tsx`, `createTrip`/`CreateTripInput` in `supabaseService.ts` + their tests

**Interfaces:**
- Consumes: `parseTripFile`, `ImportPreview`, `ImportIssue` (Tasks 2-3), `geocodeAddress` (Task 4), `importTrip` (Task 5), `MAPS_LOADER_OPTIONS` (Task 4), `tripKeys` (M1).
- Produces: `useImportTrip(): UseMutationResult<string, Error, TripData>`; `ImportTripModal({ isOpen, onClose })`.

- [x] **Step 1: Write failing modal tests**

`ImportTripModal.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { danangFile } from '@/testing/fixtures/tripFiles';

const mockMutate = vi.fn();
vi.mock('@/hooks/useTripLibraryMutations', () => ({
  useImportTrip: () => ({ mutate: mockMutate, isPending: false, error: null }),
}));
vi.mock('@react-google-maps/api', () => ({
  useJsApiLoader: () => ({ isLoaded: true, loadError: undefined }),
}));
vi.mock('@/services/geocodingService', () => ({
  geocodeAddress: vi.fn(async () => ({ lat: 1, lng: 2 })),
}));

import { ImportTripModal } from '../ImportTripModal';

const upload = (content: string, name = 'trip.json', type = 'application/json') => {
  const input = screen.getByTestId('trip-file-input');
  const file = new File([content], name, { type });
  fireEvent.change(input, { target: { files: [file] } });
};

describe('ImportTripModal', () => {
  it('rejects a non-JSON file and keeps Create disabled', async () => {
    render(<ImportTripModal isOpen onClose={vi.fn()} />);
    upload('hello', 'notes.txt', 'text/plain');
    expect(await screen.findByText(/only json files/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('lists field-path validation errors for an invalid trip file', async () => {
    render(<ImportTripModal isOpen onClose={vi.fn()} />);
    upload(JSON.stringify({ tripData: { trip_name: '', timezone: 'UTC', stops: [] } }));
    expect(await screen.findByText(/trip_name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create/i })).toBeDisabled();
  });

  it('previews a valid file and imports on Create', async () => {
    render(<ImportTripModal isOpen onClose={vi.fn()} />);
    upload(JSON.stringify(danangFile));
    expect(await screen.findByText(/Da Nang/)).toBeInTheDocument();
    expect(screen.getByText(/2 stops/i)).toBeInTheDocument();
    const create = screen.getByRole('button', { name: /create/i });
    expect(create).toBeEnabled();
    fireEvent.click(create);
    await waitFor(() =>
      expect(mockMutate).toHaveBeenCalledWith(expect.objectContaining({ trip_name: expect.stringContaining('Da Nang') }))
    );
  });

  it('resets to the preview of a newly dropped file after an error', async () => {
    render(<ImportTripModal isOpen onClose={vi.fn()} />);
    upload('{broken');
    expect(await screen.findByText(/not valid JSON/i)).toBeInTheDocument();
    upload(JSON.stringify(danangFile));
    expect(await screen.findByText(/Da Nang/)).toBeInTheDocument();
  });
});
```

- [x] **Step 2: Run to verify failure**

Run: `pnpm vitest run src/components/TripLibrary/__tests__/ImportTripModal.test.tsx`
Expected: FAIL - module not found.

- [x] **Step 3: Swap the mutation hook**

In `useTripLibraryMutations.ts`, replace `useCreateTrip` with:

```typescript
import { importTrip } from '@/services/supabaseService';
import type { TripData } from '@/types/trip';

export function useImportTrip() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: (tripData: TripData) => importTrip(tripData),
    onSuccess: (newTripId) => {
      queryClient.invalidateQueries({ queryKey: tripKeys.all });
      navigate(`/trips/${newTripId}`);
    },
  });
}
```

Delete `useCreateTrip`; update its hook test (`src/hooks/__tests__/`) to cover `useImportTrip` the same way (success → invalidate + navigate). Delete `createTrip` and `CreateTripInput` from `supabaseService.ts` and their test cases.

- [x] **Step 4: Implement the modal**

`ImportTripModal.tsx` - same shell as the old `CreateTripModal` (backdrop, header, close button, Tailwind classes). Internal state machine:

```typescript
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

type ModalState =
  | { phase: 'idle' }
  | { phase: 'processing' }
  | { phase: 'awaiting-maps'; text: string }   // TripIt file, Maps JS not yet loaded
  | { phase: 'preview'; preview: ImportPreview }
  | { phase: 'invalid'; errors: ImportIssue[] };
```

Behavior:

- Drop zone `div`: `onDragOver={(e) => e.preventDefault()}`, `onDrop` reads `e.dataTransfer.files[0]`; hidden `<input type="file" accept=".json,application/json" data-testid="trip-file-input">` triggered by a click on the zone. Caption: "Drop a trip JSON here or click to browse - Wanderlog export or TripIt export."
- `handleFile(file)`:
  1. Not `.json`/`application/json` → `invalid` with `[{ path: 'file', message: 'Only JSON files are supported' }]`.
  2. `file.size > MAX_FILE_SIZE_BYTES` → `invalid` ("File is larger than 5 MB").
  3. `const text = await file.text()`; `JSON.parse` fail → run through `parseTripFile` anyway (it reports "not valid JSON").
  4. If `detectFormat(JSON.parse(text)) === 'tripit'` and `!window.google?.maps` → `awaiting-maps` (render `<MapsGate>`); else run `parse(text)`.
  5. `parse(text)`: set `processing`, `const result = await parseTripFile(text, geocodeAddress)`, then `preview` or `invalid`.
- `MapsGate` - tiny inner component rendered only in `awaiting-maps`; mounting it triggers the load (conditional render = conditional hook):

```tsx
const MapsGate = ({ onReady }: { onReady: () => void }) => {
  const { isLoaded } = useJsApiLoader(MAPS_LOADER_OPTIONS);
  useEffect(() => {
    if (isLoaded) {
      onReady();
    }
  }, [isLoaded, onReady]);
  return <p className="text-gray-500 text-sm">Loading Google Maps for geocoding…</p>;
};
```

- Preview panel: trip name, `format` badge ("Wanderlog" / "TripIt"), date range (min `stops[].date.from` - max `stops[].date.to`), timezone, `stopCount` stops, `activityCount` activities; amber `warnings` list when non-empty.
- Error panel: red block, `max-h-48 overflow-y-auto`, one line per issue: `<code>{issue.path}</code>: {issue.message}`.
- Footer: Cancel (closes, resets state) + Create - disabled unless `phase === 'preview'`; `onClick={() => mutate(state.preview.tripData)}`; pending label "Importing…"; mutation `error?.message` rendered inline (same as the old modal).
- Processing phase: spinner + "Resolving locations…".

In `TripLibraryPage.tsx`: replace the `CreateTripModal` import/usage with `ImportTripModal` (same `isOpen`/`onClose` props; "New trip" button unchanged). Delete `CreateTripModal.tsx` and its test file.

- [x] **Step 5: Run to green, full suite, commit**

```bash
pnpm vitest run src/components/TripLibrary/__tests__/ImportTripModal.test.tsx && pnpm test:run && pnpm build
git add -A && git commit -m "feat: import trips from JSON files in the create modal"
```

---

### Task 7: M3.5 verification gate (Req 3.5, 3.7-3.9) + sign-off

**Files:**
- Modify: `docs/specs/plan_wanderlog-phase-2.md` (M3.5 status)

On a Vercel preview or production, signed in:

- [x] Import `local/trip-data/202606_DaNang_trip-plan.json` - preview shows name/dates/stops, Create lands on the trip page with map, timeline, and activities rendering (Req 3.5, 3.3)
- [x] Import `local/trip-data/202505_tripit-zurich-switzerland.json` - two geocoded stops (Zurich, Leimen), accommodations with check-in/out and confirmation, two transport activities on the right stops, device-timezone warning shown (Req 3.8)
- [x] Import `local/trip-data/202702_tripit-kuala-lumpur.json` - one stop with dates from `checkInText` fallback (Req 3.8)
- [x] Drop a `.txt` file, a broken-JSON file, and a valid-JSON-wrong-shape file - each shows errors, Create stays disabled, nothing appears in the library (Req 3.7)
- [x] Import the DaNang file twice - two independent trips in the library; delete one, the other still opens (Req 3.9)
- [x] Supabase Table Editor: imported rows all carry UUID ids; no orphan child rows after the delete

- [x] **Sign off**

Set the M3.5 row in `plan_wanderlog-phase-2.md` to `Shipped (<date>)`.

```bash
git add docs/specs/plan_wanderlog-phase-2.md
git commit -m "docs: mark M3.5 trip import shipped"
```

---

## Self-Review Notes

- The Task 2 `parseTripitFile` stub keeps the native path shippable alone; Task 3 replaces it. Tasks are still reviewable independently - the stub returns an honest "not available yet" error.
- `withFreshIds` runs inside `toPreview`, so the preview the user approves carries the exact ids that get inserted - what you see is what you save.
- The LoadScript → useJsApiLoader swap (Task 4) is the one change touching existing behavior; it has a manual smoke step for the map page before commit.
- TripIt flight dates carry no year; the converter resolves against the trip's start year with a New-Year rollover guard (`candidate < startDate → +1 year`). Trips spanning more than one year would mis-assign - accepted at family scale.
- `duration_days` for TripIt stops is computed from the derived date range with the same `differenceInCalendarDays` formula `toTripData` uses for native files missing it.
- Deleting `createTrip`/`useCreateTrip` is in-scope cleanup: this feature's amendment (Req 3.5) is what orphans them.

## Changelog

- 2026-07-04: Initial plan.
