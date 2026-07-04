# Generative Trip Creation + Programmatic Contract (Phase 3, M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The agent can create a complete trip from a description ("plan a 5-day Tokyo trip in March"): a `geocode` tool with a server-side key, a `create_trip` bundle tool running the import pipeline (validate → fresh ids → FK-order insert → compensation delete), result navigation in the modal, and the contract verified end-to-end for Hermes (Phase 3 Requirements 5 and 7).

**Architecture:** Two tools join the M2 registry. `geocode` calls the Google Geocoding REST API with `GOOGLE_GEOCODING_API_KEY` (server key; the browser Maps key is referrer-restricted and unusable here) and returns coordinates or a structured miss the model can retry. `create_trip` accepts the full nested itinerary in the same JSON shape the model reads from `get_trip`, validates it with the same `wanderlogTripSchema` gate as file import, and inserts through a shared `insertTripBundle` function extracted from `supabaseService.importTrip` - one pipeline, two callers. The handler captures the trip-created change event into `result.tripId`; the modal turns that into an "Open trip" button. Buffered JSON mode, 400-before-model validation, and NDJSON streaming shipped in M1 - this milestone verifies them as the stable Hermes contract.

**Tech Stack:** Google Geocoding REST API, zod v4 (`z.toJSONSchema`), existing schemas in `src/schemas/tripFileSchemas.ts`, `withFreshIds` (`src/services/tripImportService.ts`), `buildRows` (`src/services/supabaseMappers.ts`), Vitest 4.

## Global Constraints

- Prerequisite: Phase 3 M2 shipped ([plan_p3m2_bounded-edits.md](plan_p3m2_bounded-edits.md)) - `api/_lib/tools/` registry with `AGENT_TOOLS`, `toChanges` plumbing, `progressLabel`, write-rules system prompt.
- `GOOGLE_GEOCODING_API_KEY` is server-side only (no `VITE_` prefix, never in the client bundle); it is a separate key from the browser Maps key, restricted to the Geocoding API.
- `create_trip` is all-or-nothing via compensation delete (Req 5.4); every other write stays incremental. Trip, stop, and item ids are minted by `withFreshIds` - model-supplied ids are discarded.
- `MAX_TOKENS_PER_CALL` rises 4096 → 8192: a full trip bundle in one `tool_use` block is the largest payload the loop ever requests. `MAX_ITERATIONS = 16` stays (a creation run is ~1 list/read + a handful of geocodes + 1 `create_trip`); `maxDuration: 300` already covers the wall clock.
- Plain Messages API only, provider-agnostic via `ANTHROPIC_BASE_URL` - unchanged from M1.
- `api/` imports from `src/` stay pure-module-only: `tripFileSchemas`, `tripImportService.withFreshIds`, the new `tripBundleInsert` (client passed in, no singleton).
- After every task: `pnpm test:run` and `pnpm build` green. One commit per task.

---

### Task 1: Geocoding env + `geocode` tool

**Files:**
- Modify: `api/_lib/env.ts`, `api/_lib/__tests__/env.test.ts`, `.env.local.example`, `api/_lib/tools/index.ts`, `api/agent.ts`, `api/_lib/loop.ts`
- Create: `api/_lib/tools/geocode.ts`, `api/_lib/__tests__/geocode.test.ts`

**Interfaces:**
- Consumes: `AgentEnv`/`loadAgentEnv` (M1), `AgentTool` (M2), `dispatchTool`, `createFakeClient` (M2 test helper).
- Produces (consumed by Task 3 and the handler):

```typescript
// api/_lib/env.ts - AgentEnv gains:
export interface AgentEnv {
  anthropicApiKey: string;
  anthropicBaseUrl: string | undefined;
  anthropicModel: string;
  googleGeocodingApiKey: string;    // new, required
  supabaseAnonKey: string;
  supabaseUrl: string;
}

// api/_lib/tools/geocode.ts
export function buildGeocodeTool(apiKey: string): AgentTool;

// api/_lib/tools/index.ts - the registry becomes a builder (geocode needs the key)
export function buildAgentTools(geocodingApiKey: string): AgentTool[];  // = [...AGENT_TOOLS, geocode] (+ create_trip in Task 3)
```

- [x] **Step 1: Extend the env module (test first)**

In `api/_lib/__tests__/env.test.ts`: add `GOOGLE_GEOCODING_API_KEY: 'geo-key'` to `FULL_ENV`, add `googleGeocodingApiKey: 'geo-key'` to the expected object, and extend the missing-vars regex to `/ANTHROPIC_API_KEY.*ANTHROPIC_MODEL.*GOOGLE_GEOCODING_API_KEY.*VITE_SUPABASE_URL.*VITE_SUPABASE_ANON_KEY/s` (the `REQUIRED` list stays alphabetically grouped as written). Run - FAIL. Then in `api/_lib/env.ts` add `'GOOGLE_GEOCODING_API_KEY'` to `REQUIRED` and `googleGeocodingApiKey: env.GOOGLE_GEOCODING_API_KEY as string` to the returned object. Append to `.env.local.example`:

```bash
GOOGLE_GEOCODING_API_KEY=xxx   # server-side Geocoding API key; NOT the referrer-restricted browser Maps key
```

- [x] **Step 2: Write failing geocode-tool tests**

`api/_lib/__tests__/geocode.test.ts` - stub the global `fetch`; the supabase client is unused by this tool, so pass any fake:

```typescript
import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchTool } from '../tools';
import { buildGeocodeTool } from '../tools/geocode';
import { createFakeClient } from './fakeSupabaseClient';

const { client } = createFakeClient([]);
const tool = buildGeocodeTool('geo-key');

const geoResponse = (body: unknown, ok = true, status = 200) =>
  ({ ok, status, json: async () => body }) as Response;

const fetchMock = vi.fn();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => fetchMock.mockReset());

describe('geocode', () => {
  it('returns coordinates and the formatted address on a match', async () => {
    fetchMock.mockResolvedValue(
      geoResponse({
        status: 'OK',
        results: [{ formatted_address: 'Shinjuku, Tokyo, Japan', geometry: { location: { lat: 35.69, lng: 139.7 } } }],
      })
    );
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Shinjuku, Tokyo' });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content)).toEqual({
      found: true, lat: 35.69, lng: 139.7, formatted_address: 'Shinjuku, Tokyo, Japan',
    });
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain('address=Shinjuku%2C%20Tokyo');
    expect(url).toContain('key=geo-key');
  });

  it('returns found: false (not an error) on ZERO_RESULTS so the model can retry coarser', async () => {
    fetchMock.mockResolvedValue(geoResponse({ status: 'ZERO_RESULTS', results: [] }));
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Atlantis' });
    expect(result.isError).toBe(false);
    expect(JSON.parse(result.content).found).toBe(false);
  });

  it('surfaces service-level failures as tool errors', async () => {
    fetchMock.mockResolvedValue(geoResponse({ status: 'REQUEST_DENIED', error_message: 'bad key', results: [] }));
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Tokyo' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('REQUEST_DENIED');
  });

  it('surfaces a non-200 HTTP response as a tool error', async () => {
    fetchMock.mockResolvedValue(geoResponse({}, false, 503));
    const result = await dispatchTool([tool], client, 'geocode', { address: 'Tokyo' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('503');
  });
});
```

Run: expect FAIL. (The service-error-throws / no-match-returns-miss split mirrors `geocodingService.ts` on the client: retrying a coarser query helps with a miss, never with a denied key.)

- [x] **Step 3: Implement `api/_lib/tools/geocode.ts`**

```typescript
import { z } from 'zod';
import type { AgentTool } from './core';

const geocodeSchema = z.object({ address: z.string().min(1) }).strict();

const GEOCODE_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

interface GeocodeResponse {
  error_message?: string;
  results: { formatted_address: string; geometry: { location: { lat: number; lng: number } } }[];
  status: string;
}

export function buildGeocodeTool(apiKey: string): AgentTool {
  return {
    name: 'geocode',
    description:
      'Look up coordinates for an address or place name. Returns lat/lng and the formatted address, or found: false when there is no match - then retry with a coarser query (e.g. just the town) before giving up. Required before creating stops: never guess coordinates.',
    schema: geocodeSchema,
    execute: async (_client, input) => {
      const url = `${GEOCODE_URL}?address=${encodeURIComponent(input.address as string)}&key=${apiKey}`;
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Geocoding request failed (HTTP ${response.status})`);
      }
      const data = (await response.json()) as GeocodeResponse;
      const first = data.results?.[0];
      if (data.status === 'OK' && first) {
        return {
          found: true,
          lat: first.geometry.location.lat,
          lng: first.geometry.location.lng,
          formatted_address: first.formatted_address,
        };
      }
      if (data.status === 'ZERO_RESULTS') {
        return { found: false, reason: `No match for "${input.address}"` };
      }
      throw new Error(`Geocoding service error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}`);
    },
  };
}
```

In `api/_lib/tools/index.ts` add the builder (write tools keep living in `AGENT_TOOLS`):

```typescript
import { buildGeocodeTool } from './geocode';

export function buildAgentTools(geocodingApiKey: string): AgentTool[] {
  return [...AGENT_TOOLS, buildGeocodeTool(geocodingApiKey)];
}
```

In `api/agent.ts`, replace `tools: AGENT_TOOLS` with `tools: buildAgentTools(env.googleGeocodingApiKey)`. In `api/_lib/loop.ts`, extend `progressLabel` for address-carrying inputs - change the name extraction to:

```typescript
const fields = input as { address?: unknown; name?: unknown; trip_name?: unknown } | null;
const raw = fields?.name ?? fields?.trip_name ?? fields?.address;
const name = typeof raw === 'string' && raw ? ` "${raw}"` : '';
```

and add the template `geocode: 'Looking up{name}…'` (the `trip_name` case is used by Task 3's `create_trip: 'Creating trip{name}…'` - add both templates now, with a `progressLabel('geocode', { address: 'Tokyo' })` assertion in the loop test).

- [x] **Step 4: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: server-side geocode tool with dedicated api key"
```

---

### Task 2: Shared trip-bundle insert (extraction from `importTrip`)

**Files:**
- Create: `src/services/tripBundleInsert.ts`, `src/services/__tests__/tripBundleInsert.test.ts`
- Modify: `src/services/supabaseService.ts`

**Interfaces:**
- Consumes: `buildRows` (`src/services/supabaseMappers.ts`), `TripData`.
- Produces (consumed by Task 3; `supabaseService.importTrip` becomes a thin wrapper):

```typescript
// src/services/tripBundleInsert.ts - pure module (client injected), importable from api/
export async function insertTripBundle(
  client: SupabaseClient,
  tripData: TripData,
  overrides?: { destination?: string }
): Promise<string>;   // returns the trip id; compensation-deletes the trip row on any child insert failure
```

- [x] **Step 1: Write failing tests**

`src/services/__tests__/tripBundleInsert.test.ts` - a minimal local fake capturing `from().insert()` / `from().delete().eq()` calls (same pattern as `api/_lib/__tests__/fakeSupabaseClient.ts`, but this module lives in `src/`, so keep the fake local to the test file):

```typescript
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TripData } from '@/types/trip';
import { insertTripBundle } from '../tripBundleInsert';

interface Call { method: 'delete' | 'insert'; payload?: unknown; table: string }

function fakeClient(failOnTable?: string): { calls: Call[]; client: SupabaseClient } {
  const calls: Call[] = [];
  const client = {
    from(table: string) {
      return {
        insert(rows: unknown) {
          calls.push({ table, method: 'insert', payload: rows });
          const error = table === failOnTable ? { message: 'boom' } : null;
          return Promise.resolve({ error });
        },
        delete() {
          calls.push({ table, method: 'delete' });
          return { eq: () => Promise.resolve({ error: null }) };
        },
      };
    },
  };
  return { calls, client: client as unknown as SupabaseClient };
}

const trip: TripData = {
  trip_id: 'trip-1',
  trip_name: 'Tokyo 5 days',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      stop_id: 'stop-1',
      name: 'Shinjuku',
      date: { from: '2026-03-02', to: '2026-03-05' },
      location: { lat: 35.69, lng: 139.7 },
      duration_days: 3,
      accommodation: { name: 'Park Hyatt', address: '', check_in: '', check_out: '' },
      activities: [{ activity_id: 'act-1', activity_name: 'Ramen dinner', status: { done: false } }],
      scenic_waypoints: [],
    },
  ],
};

describe('insertTripBundle', () => {
  it('inserts in FK order and returns the trip id', async () => {
    const { calls, client } = fakeClient();
    const tripId = await insertTripBundle(client, trip);
    expect(tripId).toBe('trip-1');
    expect(calls.filter((c) => c.method === 'insert').map((c) => c.table)).toEqual([
      'trips', 'stops', 'accommodations', 'activities',
    ]); // scenic_waypoints skipped: no rows
  });

  it('applies the destination override to the trip row', async () => {
    const { calls, client } = fakeClient();
    await insertTripBundle(client, trip, { destination: 'Tokyo, Japan' });
    const tripRows = calls.find((c) => c.table === 'trips')?.payload as Record<string, unknown>[];
    expect(tripRows[0].destination).toBe('Tokyo, Japan');
  });

  it('compensation-deletes the trip row when a child insert fails', async () => {
    const { calls, client } = fakeClient('activities');
    await expect(insertTripBundle(client, trip)).rejects.toThrow('activities: boom');
    expect(calls.at(-1)).toMatchObject({ table: 'trips', method: 'delete' });
  });
});
```

Run: expect FAIL.

- [x] **Step 2: Implement by moving the body of `importTrip`**

`src/services/tripBundleInsert.ts`:

```typescript
import type { SupabaseClient } from '@supabase/supabase-js';
import type { TripData } from '@/types/trip';
import { buildRows } from './supabaseMappers';

export async function insertTripBundle(
  client: SupabaseClient,
  tripData: TripData,
  overrides?: { destination?: string }
): Promise<string> {
  const tripId = tripData.trip_id ?? crypto.randomUUID();
  const bundle = buildRows(tripData, tripId);
  const insert = async (table: string, rows: object[]): Promise<void> => {
    if (rows.length === 0) {
      return;
    }
    const { error } = await client.from(table).insert(rows);
    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }
  };
  await insert('trips', [{ ...bundle.trip, destination: overrides?.destination ?? bundle.trip.destination }]);
  try {
    await insert('stops', bundle.stops);
    await insert('accommodations', bundle.accommodations);
    await insert('activities', bundle.activities);
    await insert('scenic_waypoints', bundle.scenicWaypoints);
  } catch (error) {
    // Compensation: removing the trip row cascades to any children already inserted.
    await client.from('trips').delete().eq('id', tripId);
    throw error;
  }
  return tripId;
}
```

`src/services/supabaseService.ts` - `importTrip` becomes:

```typescript
import { insertTripBundle } from './tripBundleInsert';

export const importTrip = (tripData: TripData): Promise<string> => insertTripBundle(getSupabase(), tripData);
```

The existing `importTrip` tests in `supabaseService.test.ts` must pass unchanged - they are the refactor's safety net.

- [x] **Step 3: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "refactor: extract shared trip bundle insert with compensation delete"
```

---

### Task 3: `create_trip` tool

**Files:**
- Modify: `src/schemas/tripFileSchemas.ts` (export leaf schemas), `api/_lib/tools/index.ts`, `api/_lib/__tests__/tools.test.ts` (registry test)
- Create: `api/_lib/tools/createTrip.ts`, `api/_lib/__tests__/createTrip.test.ts`

**Interfaces:**
- Consumes: `wanderlogTripSchema`/`toTripData` and the leaf schemas (`tripFileSchemas`), `withFreshIds` (`tripImportService`), `insertTripBundle` (Task 2), `AgentTool`/`toChanges` (M2).
- Produces:

```typescript
// api/_lib/tools/createTrip.ts
export const CREATE_TRIP_TOOL: AgentTool;   // name: 'create_trip'
```

- [x] **Step 1: Export the leaf schemas**

In `src/schemas/tripFileSchemas.ts`, add `export` to the existing `dateString`, `activitySchema`, `waypointSchema`, and `accommodationSchema` declarations. No other change; existing schema tests stay untouched.

- [x] **Step 2: Write failing tests**

`api/_lib/__tests__/createTrip.test.ts`:

```typescript
import { describe, expect, it } from 'vitest';
import { dispatchTool, toAnthropicTools } from '../tools';
import { CREATE_TRIP_TOOL } from '../tools/createTrip';
import { createFakeClient } from './fakeSupabaseClient';

const UUID_RE = /^[0-9a-f-]{36}$/;

const tripInput = {
  trip_name: 'Tokyo with kids',
  destination: 'Tokyo, Japan',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      name: 'Shinjuku',
      date: { from: '2026-03-02', to: '2026-03-05' },
      location: { lat: 35.69, lng: 139.7 },
      accommodation: { name: 'Park Hyatt' },
      activities: [
        { activity_name: 'Ramen dinner', activity_type: 'restaurant', location: { lat: 35.66, lng: 139.7 } },
        { activity_name: 'Ghibli Museum' },   // deliberately without coordinates
      ],
    },
  ],
};

const happyQueue = [
  { table: 'trips', method: 'insert' as const },
  { table: 'stops', method: 'insert' as const },
  { table: 'accommodations', method: 'insert' as const },
  { table: 'activities', method: 'insert' as const },
];

describe('create_trip', () => {
  it('converts to a JSON Schema with the required top-level fields', () => {
    const [def] = toAnthropicTools([CREATE_TRIP_TOOL]);
    expect(def.input_schema).toMatchObject({ type: 'object' });
    expect((def.input_schema as { required: string[] }).required).toEqual(
      expect.arrayContaining(['trip_name', 'destination', 'timezone', 'stops'])
    );
  });

  it('creates the trip with fresh ids and reports a trip-created change', async () => {
    const { calls, client } = createFakeClient(happyQueue);
    const result = await dispatchTool([CREATE_TRIP_TOOL], client, 'create_trip', tripInput);
    expect(result.isError).toBe(false);
    const tripRows = calls.find((c) => c.table === 'trips')?.payload as Record<string, unknown>[];
    expect(tripRows[0].id).toMatch(UUID_RE);
    expect(tripRows[0].destination).toBe('Tokyo, Japan');
    const output = JSON.parse(result.content);
    expect(output).toMatchObject({
      trip_name: 'Tokyo with kids',
      stop_count: 1,
      activity_count: 2,
      activities_without_coordinates: ['Ghibli Museum'],
    });
    expect(result.changes).toEqual([
      { type: 'change', op: 'created', entity: 'trip', id: output.trip_id, name: 'Tokyo with kids' },
    ]);
  });

  it('rejects an invalid timezone at execution via the canonical import gate', async () => {
    const { calls, client } = createFakeClient(happyQueue);
    const result = await dispatchTool([CREATE_TRIP_TOOL], client, 'create_trip', {
      ...tripInput,
      timezone: 'Not/AZone',
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('validation');
    expect(calls).toHaveLength(0);
  });

  it('rejects a stop without coordinates via zod (never silently placed)', async () => {
    const stops = [{ ...tripInput.stops[0], location: undefined }];
    const { client } = createFakeClient([]);
    const result = await dispatchTool([CREATE_TRIP_TOOL], client, 'create_trip', { ...tripInput, stops });
    expect(result.isError).toBe(true);
  });

  it('surfaces a mid-insert failure after compensation delete', async () => {
    const { calls, client } = createFakeClient([
      { table: 'trips', method: 'insert' },
      { table: 'stops', method: 'insert', error: { message: 'boom' } },
    ]);
    const result = await dispatchTool([CREATE_TRIP_TOOL], client, 'create_trip', tripInput);
    expect(result.isError).toBe(true);
    expect(result.changes).toEqual([]);
    expect(calls.at(-1)).toMatchObject({ table: 'trips', method: 'delete' });
  });
});
```

Run: expect FAIL.

- [x] **Step 3: Implement `api/_lib/tools/createTrip.ts`**

The input schema mirrors the trip JSON the model already reads (nested `date`/`location`), reusing the exported leaf schemas; the accommodation preprocess wrapper from the file-import path is deliberately not reused (its transform has no stable JSON Schema form). Canonical validation still runs `wanderlogTripSchema` inside the executor - the same gate as file import:

```typescript
import { z } from 'zod';
import {
  accommodationSchema,
  activitySchema,
  dateString,
  toTripData,
  wanderlogTripSchema,
  waypointSchema,
} from '@/schemas/tripFileSchemas';
import { insertTripBundle } from '@/services/tripBundleInsert';
import { withFreshIds } from '@/services/tripImportService';
import type { AgentTool } from './core';

const LAT_MIN = -90;
const LAT_MAX = 90;
const LNG_MIN = -180;
const LNG_MAX = 180;

const agentStopSchema = z.object({
  name: z.string().min(1),
  date: z.object({ from: dateString, to: dateString }),
  location: z
    .object({ lat: z.number().min(LAT_MIN).max(LAT_MAX), lng: z.number().min(LNG_MIN).max(LNG_MAX) })
    .describe('Coordinates returned by the geocode tool - never guessed'),
  travel_time_from_previous: z.string().optional(),
  accommodation: accommodationSchema.optional(),
  activities: z.array(activitySchema).default([]),
  scenic_waypoints: z.array(waypointSchema).default([]),
});

const createTripSchema = z
  .object({
    trip_name: z.string().min(1),
    destination: z.string().min(1).describe('Shown in the trip library, e.g. "Tokyo, Japan"'),
    timezone: z.string().min(1).describe('IANA timezone of the destination, e.g. "Asia/Tokyo"'),
    stops: z
      .array(agentStopSchema)
      .min(1)
      .describe("Contiguous chain: each stop's date.from equals the previous stop's date.to"),
  })
  .strict();

export const CREATE_TRIP_TOOL: AgentTool = {
  name: 'create_trip',
  description:
    'Create a complete new trip from a full itinerary: stops (each with geocoded coordinates, dates, optional accommodation), activities, and scenic waypoints. All ids are generated server-side. Call at most once per request, after geocoding every stop location. The insert is all-or-nothing.',
  schema: createTripSchema,
  execute: async (client, input) => {
    const { destination, ...tripFields } = input as z.infer<typeof createTripSchema>;
    const validated = wanderlogTripSchema.safeParse(tripFields);   // same gate as file import (Req 5.4)
    if (!validated.success) {
      throw new Error(
        `Trip failed validation: ${validated.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`
      );
    }
    const trip = withFreshIds(toTripData(validated.data));
    const tripId = await insertTripBundle(client, trip, { destination });
    const activitiesWithoutCoordinates = trip.stops.flatMap((stop) =>
      stop.activities
        .filter((activity) => activity.location?.lat === undefined || activity.location?.lng === undefined)
        .map((activity) => activity.activity_name)
    );
    return {
      trip_id: tripId,
      trip_name: trip.trip_name,
      stop_count: trip.stops.length,
      activity_count: trip.stops.reduce((sum, stop) => sum + stop.activities.length, 0),
      activities_without_coordinates: activitiesWithoutCoordinates,
    };
  },
  toChanges: (_input, output) => {
    const o = output as { trip_id: string; trip_name: string };
    return [{ op: 'created', entity: 'trip', id: o.trip_id, name: o.trip_name }];
  },
};
```

Register it in `api/_lib/tools/index.ts`:

```typescript
import { CREATE_TRIP_TOOL } from './createTrip';

export function buildAgentTools(geocodingApiKey: string): AgentTool[] {
  return [...AGENT_TOOLS, buildGeocodeTool(geocodingApiKey), CREATE_TRIP_TOOL];
}
```

Update the registry completeness test in `api/_lib/__tests__/tools.test.ts` to assert `buildAgentTools('k')` contains the M2 fourteen plus `create_trip` and `geocode` (sixteen total), and still no `delete_trip`.

- [x] **Step 4: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: create_trip tool over the shared import pipeline"
```

---

### Task 4: Loop token cap + truncation handling + `result.tripId`

**Files:**
- Modify: `api/_lib/loop.ts`, `api/_lib/__tests__/loop.test.ts`, `api/agent.ts`, `api/__tests__/agent.test.ts`

**Interfaces:**
- Consumes: `runAgentLoop`, the handler's `runToEvents` closure (M1), `AgentChangeEvent`.
- Produces: `MAX_TOKENS_PER_CALL = 8192`; a `max_tokens` stop emits an `error` event; the `result` event's `tripId` carries the id from a trip-created `change` event.

- [x] **Step 1: Write failing loop test**

```typescript
it('surfaces a max_tokens truncation as an error event and stops', async () => {
  createMock.mockResolvedValueOnce({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'partial' }] });
  const { finalText } = await runAgentLoop(deps, 'sys', 'plan a big trip');
  expect(finalText).toBe('partial');
  expect(emitted).toContainEqual({
    type: 'error',
    message: 'The model response was cut off before finishing; results may be incomplete.',
    detail: null,
  });
  expect(createMock).toHaveBeenCalledTimes(1);
});
```

- [x] **Step 2: Implement in `loop.ts`**

Set `MAX_TOKENS_PER_CALL = 8192`. After extracting `lastText` and before the `stop_reason !== 'tool_use'` return, add:

```typescript
if (response.stop_reason === 'max_tokens') {
  deps.emit({
    type: 'error',
    message: 'The model response was cut off before finishing; results may be incomplete.',
    detail: null,
  });
  return { finalText: lastText, hitIterationCap: false };
}
```

(A truncated response can carry a mangled or incomplete `tool_use` block; executing it would be worse than stopping and telling the user.)

- [x] **Step 3: Write failing handler tests**

```typescript
it('sets result.tripId from a trip-created change event (buffered)', async () => {
  runAgentLoopMock.mockImplementation(async (deps) => {
    deps.emit({ type: 'change', op: 'created', entity: 'trip', id: 't-9', name: 'Tokyo with kids' });
    return { finalText: 'Created the Tokyo trip.', hitIterationCap: false };
  });
  const res = await handler(post({ prompt: 'plan tokyo' }, 'token', { Accept: 'application/json' }));
  const body = await res.json();
  expect(body.tripId).toBe('t-9');
  expect(body.changes).toEqual([{ type: 'change', op: 'created', entity: 'trip', id: 't-9', name: 'Tokyo with kids' }]);
});

it('sets result.tripId in the streamed result event', async () => {
  runAgentLoopMock.mockImplementation(async (deps) => {
    deps.emit({ type: 'change', op: 'created', entity: 'trip', id: 't-9', name: 'Tokyo with kids' });
    return { finalText: 'Created.', hitIterationCap: false };
  });
  const res = await handler(post({ prompt: 'plan tokyo' }, 'token'));
  const lines = (await res.text()).trim().split('\n').map((line) => JSON.parse(line));
  expect(lines.at(-1)).toMatchObject({ type: 'result', tripId: 't-9' });
});
```

- [x] **Step 4: Implement in `api/agent.ts`**

Inside `runToEvents`, watch changes while forwarding events:

```typescript
const runToEvents = async (emit: (event: AgentEvent) => void): Promise<void> => {
  let createdTripId: string | null = null;
  const emitTracked = (event: AgentEvent): void => {
    if (event.type === 'change' && event.entity === 'trip' && event.op === 'created') {
      createdTripId = event.id;
    }
    emit(event);
  };
  const { finalText, hitIterationCap } = await runAgentLoop(
    { anthropic, emit: emitTracked, model: env.anthropicModel, signal: request.signal, supabase, tools, },
    systemPrompt,
    prompt
  );
  if (hitIterationCap) {
    emit({ type: 'error', message: `Stopped after ${MAX_ITERATIONS} steps without finishing.`, detail: null });
  }
  emit({ type: 'result', summary: finalText, answer: finalText || null, tripId: createdTripId });
};
```

- [x] **Step 5: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: creation-sized token cap, truncation error, result tripId"
```

---

### Task 5: System prompt creation rules

**Files:**
- Modify: `api/_lib/systemPrompt.ts`, `api/_lib/__tests__/systemPrompt.test.ts`

- [x] **Step 1: Write failing tests**

```typescript
it('states the trip creation rules', () => {
  const prompt = buildSystemPrompt({});
  expect(prompt).toContain('create_trip exactly once');
  expect(prompt).toContain('never place a stop at coordinates you guessed');
  expect(prompt).toContain('IANA');
});
```

- [x] **Step 2: Append to `CORE_RULES`**

Add these bullets to the rules list (all M2 rules stay; the M2 stop-coordinates bullet is superseded by the first bullet below - replace it):

```
- Stops need real coordinates: use the geocode tool, coordinates already present in trip data, or ones the user supplies - never place a stop at coordinates you guessed. If geocoding misses, retry a coarser query or pick a nearby alternative; otherwise report the failure.
- To create a whole new trip, call create_trip exactly once with the full itinerary after geocoding every stop location. Derive the timezone from the destination as an IANA name (e.g. "Asia/Tokyo"). Build stop dates as a contiguous chain: each stop's date.from is the previous stop's date.to.
- Activities in a new trip: geocode where practical; an activity without coordinates is fine (it renders without a map pin) but list such activities in your summary.
```

The M2 tests (delete guard, honest reporting) must keep passing.

- [x] **Step 3: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: agent system prompt trip creation rules"
```

---

### Task 6: Modal "Open trip" navigation

**Files:**
- Modify: `src/components/Agent/AgentModal.tsx`, `src/components/Agent/__tests__/AgentModal.test.tsx`

**Interfaces:**
- Consumes: `result.tripId` (Task 4), `useNavigate` (react-router), the modal's `handleClose`.
- Produces: an "Open trip" button in the result view when `result.tripId` is set (Req 5.5).

The M1 plan sketched this button in its render outline; this task makes it a tested guarantee - implement whatever the M1 build left out.

- [x] **Step 1: Write failing test**

Mock `useNavigate` (keep the rest of react-router real):

```tsx
const navigateMock = vi.fn();
vi.mock('react-router', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  useNavigate: () => navigateMock,
}));

it('shows Open trip and navigates when the result carries a tripId', async () => {
  runAgentMock.mockImplementation(async ({ onEvent }) => {
    onEvent({ type: 'change', op: 'created', entity: 'trip', id: 't-new', name: 'Tokyo with kids' });
    onEvent({ type: 'result', summary: 'Created the Tokyo trip.', answer: null, tripId: 't-new' });
  });
  render(<AgentModal isOpen onClose={vi.fn()} />);
  await userEvent.type(screen.getByRole('textbox'), 'plan a tokyo trip');
  await userEvent.click(screen.getByRole('button', { name: /ask agent/i }));
  await userEvent.click(await screen.findByRole('button', { name: /open trip/i }));
  expect(navigateMock).toHaveBeenCalledWith('/trips/t-new');
});

it('shows no Open trip button when tripId is null', async () => {
  runAgentMock.mockImplementation(async ({ onEvent }) => {
    onEvent({ type: 'result', summary: 'Two trips.', answer: 'Two trips.', tripId: null });
  });
  // submit, then:
  expect(screen.queryByRole('button', { name: /open trip/i })).not.toBeInTheDocument();
});
```

- [x] **Step 2: Implement**

In the result view:

```tsx
{result?.tripId && (
  <button
    type="button"
    className="rounded-lg bg-alpine-teal px-3 py-2 text-sm text-white"
    onClick={() => {
      navigate(`/trips/${result.tripId}`);
      handleClose();
    }}
  >
    Open trip
  </button>
)}
```

Match the classes to the modal's existing primary button. The `['trips']` invalidation on run completion (M1) already makes the new trip appear in the library without this button being pressed.

- [x] **Step 3: Green, commit**

```bash
pnpm test:run && pnpm build
git add -A && git commit -m "feat: open created trip from the agent modal"
```

---

### Task 7: Contract finalization + M3 verification gate

**Files:**
- Modify: `docs/specs/phase-3/design_wanderlog-phase-3.md` (changelog), `docs/specs/phase-3/plan_phase-3.md` (status rows)

- [ ] **Step 1: Configure Vercel + provision Hermes**

- Vercel env settings: add `GOOGLE_GEOCODING_API_KEY` (all environments). Restrict the key to the Geocoding API in the Google Cloud console (API restriction; no referrer restriction - this is a server key).
- Supabase Auth dashboard: manually provision the dedicated Hermes family-member account (email + password), so its actions are attributable (Req 7.1).

- [x] **Step 2: Contract cross-check**

Read the "API Contract" section of [design_wanderlog-phase-3.md](design_wanderlog-phase-3.md) line by line against the implementation: request body, all four event shapes, buffered shape, status codes (200/400/401/502), `result.tripId` semantics. Fix any drift in the design doc (it is the Hermes integration doc, Req 7.3) and append a changelog line: `M3 shipped - contract verified as the stable Hermes integration surface`.

- [ ] **Step 3: Hermes-style curl session against a preview (Req 7.1, 7.2, 7.4)**

```bash
PREVIEW=https://<preview-url>
TOKEN=$(curl -s -X POST "$VITE_SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $VITE_SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"<hermes-account>","password":"<password>"}' | jq -r .access_token)

# Buffered creation - the Hermes shape
curl -s -X POST "$PREVIEW/api/agent" -H "Authorization: Bearer $TOKEN" \
  -H "Accept: application/json" -H "Content-Type: application/json" \
  -d '{"prompt":"Plan a 5-day Tokyo trip in early March for a family with two kids. One stop per neighbourhood, a realistic accommodation suggestion per stop, 2-3 activities per day."}' | jq .
# expect: changes contains {op:"created", entity:"trip"}; tripId set; errors []

# 400 before any model call
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$PREVIEW/api/agent" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{}'   # expect 400
```

- [ ] **Step 4: Creation verification in the app (Req 5)**

- Library page → agent modal → the same Tokyo prompt: progress lines show geocoding and creation; result shows the summary and "Open trip"; clicking it lands on a fully rendered trip (stops pinned, timeline navigable, activities listed; un-geocoded activities render without pins and are named in the summary).
- The new trip appears in the library with destination and date range; its timezone is a plausible IANA zone for the destination (Req 5.6).
- Negative test: "Plan a 3-day trip to the lost city of Atlantis" → geocoding fails; the agent reports failure; the library contains no new or half-created trip (Req 5.2, 5.4).

- [ ] **Step 5: Ship**

- Merge to `main`; re-run Step 3's buffered call against production with the Hermes account.
- Update `plan_phase-3.md`: M3 row `Shipped (<date>)`; note Phase 3 complete.

```bash
git add docs/specs/phase-3/plan_phase-3.md docs/specs/phase-3/design_wanderlog-phase-3.md
git commit -m "docs: mark phase 3 m3 shipped - agent mode complete"
```

---

## Self-Review Notes

- Requirement coverage: 5.1 full-itinerary creation with fresh ids (Task 3: `withFreshIds`, server-minted); 5.2 stop coordinates only via geocode (schema requires `location`, prompt forbids guessing, gate negative test); 5.3 pin-less activities allowed and reported (`activities_without_coordinates` in the tool output + prompt rule); 5.4 import-grade validation + compensation delete (Task 3 runs `wanderlogTripSchema`, Task 2 owns the all-or-nothing insert); 5.5 navigation + library appearance (Task 6 + M1 invalidation); 5.6 destination-derived timezone (prompt rule; IANA refine enforced at execution - the tool JSON Schema cannot carry the refine, so a bad zone comes back as a tool error the model corrects). 7.1 password grant with a provisioned account (gate Steps 1, 3); 7.2 buffered mode (shipped in M1, re-verified); 7.3 contract documented and cross-checked (gate Step 2); 7.4 400 pre-model (shipped in M1, re-verified).
- One insert pipeline: `insertTripBundle` is extracted, not duplicated - file import and `create_trip` cannot drift apart on FK order or compensation semantics. Existing `importTrip` tests guard the refactor.
- The agent-facing `create_trip` schema avoids the file-import `z.preprocess` accommodation wrapper (transforms have no reliable JSON Schema form); the canonical `wanderlogTripSchema` still validates every bundle at execution, so the two shapes cannot diverge on what gets inserted.
- `MAX_TOKENS_PER_CALL = 8192` is sized for a one-block trip bundle; a `max_tokens` stop is surfaced as an explicit error instead of executing a possibly truncated `tool_use` block.
- `result.tripId` derives from the trip-created change event in one place (the handler's `emitTracked`), so stream and buffered renderings cannot disagree.
- Type consistency checked: `buildAgentTools` returns the M2 registry plus `geocode`/`create_trip` (registry test pins all sixteen names, still no `delete_trip`); `CREATE_TRIP_TOOL.toChanges` matches the `AgentChangeEvent` shape; the loop truncation event uses the M1 `AgentErrorEvent` shape.

## Changelog

- 2026-07-04: Initial plan (written ahead of M1/M2 execution; symbol names follow the M1 and M2 plans).
