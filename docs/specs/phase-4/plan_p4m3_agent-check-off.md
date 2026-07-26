# Agent Check-off (Phase 4, M3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** "Mark the museum done, we left at 3" records a visit the same way the checkbox would, and the agent refuses to put a visit record on an item that is not done (Phase 4 Requirement 4).

**Architecture:** `update_activity` / `update_waypoint` gain `visited_at` and `visit_duration_minutes`, zod-validated against the same `isValidTripLocal` the form uses. The pre-read those tools already run before every write widens from `fetchName` into `fetchItemContext`, pulling the item's `is_done` and the owning trip's `timezone`, `start_date`, and `end_date` through the stop in the same round trip — that is what lets the executor call the shared `stampIfDuringTrip` and enforce the not-done guard without a second query or a context object threaded through `AgentTool`. `systemPrompt` gains the current trip-local date-time and the trip's date range so relative expressions resolve. No schema change, no client change, no new tool.

**Tech Stack:** Vercel Node ESM function (`api/`), zod v4, `@anthropic-ai/sdk` tool use, supabase-js under the caller's RLS, Vitest 4.

## Global Constraints

- Requirement 4 only. M1 shipped `visitRecord.ts`, the columns, the mappers, and `VISIT_COLUMNS`; M2 shipped the panel split. Nothing in `src/` changes this milestone.
- Everything under `api/` is Node ESM (invariant 5): **relative imports with explicit `.js` extensions**, no `@/` aliases, no browser globals. `items.ts` and `systemPrompt.ts` already follow this — match the existing import comments.
- The stamp rule has exactly one definition: `stampIfDuringTrip` in [src/services/visitRecord.ts](../../../src/services/visitRecord.ts). Do not re-derive "now in the trip's zone", do not add a second date formatter, do not compare dates any other way (Req 4.3, design decision "Stamp rule location").
- `visited_at` is `'YYYY-MM-DD HH:mm'` local to `trips.timezone`. Never `timestamptz`, never UTC in the column, never ISO-8601 with a `T`.
- Visit columns are written **sparsely**. `VISIT_COLUMNS` is deliberately outside `ACTIVITY_COLUMNS` (see the comment in [src/services/entityRows.ts](../../../src/services/entityRows.ts)) because the browser's item editors write `ACTIVITY_COLUMNS` densely and would null a visit record out. Append it to the agent's `patchDefs`; never to `ACTIVITY_COLUMNS`.
- `CREATE_FIELDS` is unchanged. A newly created item is never done, so it can carry no visit record.
- `duration` (free text, planned estimate) is never read, written, or converted here.
- Invariant 6 holds: the agent's surface mirrors the client's. The UI rule "the visit form is offered only on done items" (Req 2.5) becomes the server-side guard in Req 4.5.
- `api/` is not served by Vite. Manual verification needs `vercel dev` or a preview deploy.
- Ultracite owns formatting (`npx ultracite fix`); no hand-formatting, no JSDoc on new code — comments explain *why*.
- Run the full suite with `pnpm test:run`; a single file with `pnpm vitest run <path>`. Husky runs the full suite on commit.

---

## File Structure

| File | | Responsibility |
|------|---|----------------|
| `api/_lib/tools/items.ts` | Modify | `fetchItemContext`, the two visit fields on `UPDATE_FIELDS`, the stamp/override/untick rules, the not-done guard. The whole milestone's write behaviour. |
| `api/_lib/systemPrompt.ts` | Modify | Trip-local clock, trip date range, and the done-before-visit rule in the core rules. |
| `api/_lib/__tests__/fakeSupabaseClient.ts` | Modify | Record the requested column list on `select` calls so the widened pre-read is assertable. |
| `api/_lib/__tests__/items.test.ts` | Modify | Context pre-read, stamp both ways, explicit override, untick clear, guard, change list, schema rejects. |
| `api/_lib/__tests__/systemPrompt.test.ts` | Modify | Clock in the trip zone, UTC fallback, missing-dates case, the rule text, visit data present in the embedded trip. |
| `api/_lib/__tests__/tools.test.ts` | Modify | One read-through case: `get_trip` returns recorded visit fields (Req 4.7). |

---

## Implementation Plan

### Task 1: Widen the item pre-read into `fetchItemContext`

`update_*` and `delete_*` already select the item's `name` before every write. This task widens that one query to also return the item's `is_done` and the owning trip's timezone and dates, and changes nothing about what gets written. Behaviour-neutral and reviewable on its own: the same payload reaches Supabase before and after.

**Files:**
- Modify: `api/_lib/tools/items.ts`, `api/_lib/__tests__/fakeSupabaseClient.ts`
- Test: `api/_lib/__tests__/items.test.ts`

**Interfaces:**
- Consumes: `client.from(table).select(columns).eq('id', id).maybeSingle()` — the query `fetchName` already ran.
- Produces:
  - `interface ItemContext { endDate?: string; isDone: boolean; name: string; startDate?: string; timeZone?: string }`
  - `fetchItemContext(client: SupabaseClient, table: string, id: string, noun: string): Promise<ItemContext>` (module-private to `items.ts`; `ItemContext` is exported for the helpers in Task 2)
  - `ITEM_CONTEXT_SELECT = 'name, is_done, stops(trips(timezone, start_date, end_date))'`
  - `FakeCall.payload` now carries the column string for `select` calls.

- [x] **Step 1: Make the fake client record select columns**

In `api/_lib/__tests__/fakeSupabaseClient.ts`, change the `select` entry on the returned builder:

```ts
        select: (columns?: string, _options?: unknown) => exec('select', columns),
```

Nothing asserts `payload` on a `select` call today, so this is additive.

- [x] **Step 2: Write the failing pre-read test**

Add to `api/_lib/__tests__/items.test.ts`, inside the existing `describe('update_activity')`:

```ts
  it('reads the item state and the owning trip window in one pre-read', async () => {
    const { calls, client } = createFakeClient([
      {
        table: 'activities',
        method: 'select',
        data: {
          name: 'Museum',
          is_done: false,
          stops: { trips: { timezone: 'Asia/Tokyo', start_date: '2026-07-12', end_date: '2026-07-19' } },
        },
      },
      { table: 'activities', method: 'update' },
    ]);

    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', address: 'Ueno' });

    expect(result.isError).toBe(false);
    const selects = calls.filter((call) => call.method === 'select');
    // One round trip, not two: the stamp rule's inputs ride along with the name.
    expect(selects).toHaveLength(1);
    expect(selects[0].payload).toBe('name, is_done, stops(trips(timezone, start_date, end_date))');
    expect(result.changes[0]).toMatchObject({ name: 'Museum' });
  });
```

- [x] **Step 3: Run the test to verify it fails**

Run: `pnpm vitest run api/_lib/__tests__/items.test.ts`
Expected: FAIL — the pre-read still selects `'name'`.

- [x] **Step 4: Replace `fetchName` with `fetchItemContext`**

In `api/_lib/tools/items.ts`, delete `fetchName` and put this in its place:

```ts
// The item's done state and the owning trip's zone and dates arrive through the
// same round trip this pre-read already made, so the stamp rule and the
// not-done guard cost no extra query and resolve on library-scoped runs where
// no trip was prefetched into the prompt.
const ITEM_CONTEXT_SELECT = 'name, is_done, stops(trips(timezone, start_date, end_date))';

// PostgREST returns a many-to-one embed as an object, but the same nested shape
// arrives as a single-element array on some relationship shapes - which is why
// supabaseMappers already unwraps both for accommodations.
type Embedded<T> = T | T[] | null;

interface TripContextRow {
  end_date: string | null;
  start_date: string | null;
  timezone: string | null;
}

interface ItemContextRow {
  is_done: boolean | null;
  name: string;
  stops: Embedded<{ trips: Embedded<TripContextRow> }>;
}

export interface ItemContext {
  endDate?: string;
  isDone: boolean;
  name: string;
  startDate?: string;
  timeZone?: string;
}

const unwrap = <T>(value: Embedded<T> | undefined): T | undefined => {
  if (value == null) {
    return;
  }
  return Array.isArray(value) ? value[0] : value;
};

const fetchItemContext = async (client: SupabaseClient, table: string, id: string, noun: string): Promise<ItemContext> => {
  const { data, error } = await client.from(table).select(ITEM_CONTEXT_SELECT).eq('id', id).maybeSingle();
  if (error) {
    throw new Error(error.message);
  }
  if (!data) {
    throw new Error(`No ${noun} found with id ${id}`);
  }
  const row = data as ItemContextRow;
  const trip = unwrap(unwrap(row.stops)?.trips);
  return {
    name: row.name,
    isDone: row.is_done ?? false,
    timeZone: trip?.timezone ?? undefined,
    startDate: trip?.start_date ?? undefined,
    endDate: trip?.end_date ?? undefined,
  };
};
```

- [x] **Step 5: Point both executors at it**

In the `update_${entity}` executor:

```ts
      execute: async (client, input) => {
        const id = input[idField] as string;
        const context = await fetchItemContext(client, table, id, noun);
        // Sparse update stays agent policy; the shared updateById does the write.
        await updateById(client, table, id, patchRow(patchDefs, input));
        return { id, name: (input.name as string | undefined) ?? context.name };
      },
```

In the `delete_${entity}` executor:

```ts
      execute: async (client, input) => {
        const id = input[idField] as string;
        const { name } = await fetchItemContext(client, table, id, noun);
        await deleteById(client, table, id);
        return { id, name, deleted: true };
      },
```

- [x] **Step 6: Run the item tests and typecheck**

Run: `pnpm vitest run api/_lib/__tests__/items.test.ts && pnpm build`
Expected: PASS including the existing "errors when the id does not exist, without writing" case (the missing-row throw is unchanged), and `tsc -b` clean.

- [x] **Step 7: Commit**

```bash
git add api/_lib/tools/items.ts api/_lib/__tests__/items.test.ts api/_lib/__tests__/fakeSupabaseClient.ts
git commit -m "refactor: widen the agent item pre-read into fetchItemContext"
```

---

### Task 2: Visit fields, the shared stamp rule, and the not-done guard

The behavioural core. Both update tools accept the two visit fields; the executor applies the same three rules the browser toggle applies and refuses a visit record on an item that is not done.

**Files:**
- Modify: `api/_lib/tools/items.ts`
- Test: `api/_lib/__tests__/items.test.ts`

**Interfaces:**
- Consumes: `ItemContext`, `fetchItemContext` (Task 1); `VISIT_COLUMNS` from `../../../src/services/entityRows.js`; `isValidTripLocal`, `stampIfDuringTrip` from `../../../src/services/visitRecord.js`.
- Produces: `update_activity` and `update_waypoint` accept `visited_at: string | null` (optional) and `visit_duration_minutes: number | null` (optional, non-negative integer). Module-private `setsVisitField(patch: Record<string, unknown>): boolean` and `resolveVisitPatch(patch: Record<string, unknown>, context: ItemContext, now: Date): Record<string, unknown>`.

- [x] **Step 1: Write the failing tests**

Add to `api/_lib/__tests__/items.test.ts`. Extend the imports at the top of the file to `import { afterEach, describe, expect, it, vi } from 'vitest';` and `import { createFakeClient, type FakeCall } from './fakeSupabaseClient';`, then append:

```ts
const TOKYO_TRIP = { timezone: 'Asia/Tokyo', start_date: '2026-07-12', end_date: '2026-07-19' };

const itemRow = (over: Record<string, unknown> = {}) => ({ name: 'Museum', is_done: false, stops: { trips: TOKYO_TRIP }, ...over });

const clientFor = (row: Record<string, unknown>, table = 'activities') =>
  createFakeClient([
    { table, method: 'select', data: row },
    { table, method: 'update' },
  ]);

const updatePayload = (calls: FakeCall[]) => calls.find((call) => call.method === 'update')?.payload;

describe('update_activity visit records', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stamps the trip-local time when marking done without one', async () => {
    vi.setSystemTime(new Date('2026-07-15T05:32:00Z')); // 14:32 in Tokyo
    const { calls, client } = clientFor(itemRow());

    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', done: true });

    expect(result.isError).toBe(false);
    expect(updatePayload(calls)).toEqual({ is_done: true, visited_at: '2026-07-15 14:32' });
  });

  it('records no time when the tick lands outside the trip window', async () => {
    vi.setSystemTime(new Date('2026-09-01T05:32:00Z'));
    const { calls, client } = clientFor(itemRow());

    await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', done: true });

    expect(updatePayload(calls)).toEqual({ is_done: true, visited_at: null });
  });

  it('uses an explicit visited_at instead of the stamp', async () => {
    vi.setSystemTime(new Date('2026-07-15T05:32:00Z'));
    const { calls, client } = clientFor(itemRow());

    await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', {
      activity_id: 'act-1',
      done: true,
      visited_at: '2026-07-15 15:00',
      visit_duration_minutes: 90,
    });

    expect(updatePayload(calls)).toEqual({ is_done: true, visited_at: '2026-07-15 15:00', visit_duration_minutes: 90 });
  });

  it('writes visit fields on an item that is already done', async () => {
    const { calls, client } = clientFor(itemRow({ is_done: true }));

    await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', {
      activity_id: 'act-1',
      visit_duration_minutes: 45,
      remarks: 'queue was long',
    });

    expect(updatePayload(calls)).toEqual({ visit_duration_minutes: 45, remarks: 'queue was long' });
  });

  it('clears the stamp when unticking', async () => {
    const { calls, client } = clientFor(itemRow({ is_done: true }));

    await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', done: false });

    expect(updatePayload(calls)).toEqual({ is_done: false, visited_at: null });
  });

  it('accepts an explicit null to clear a recorded time', async () => {
    const { calls, client } = clientFor(itemRow({ is_done: true }));

    await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', visited_at: null });

    expect(updatePayload(calls)).toEqual({ visited_at: null });
  });

  it('refuses visit fields on an item that is not done, without writing', async () => {
    const { calls, client } = clientFor(itemRow());

    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', visited_at: '2026-07-15 15:00' });

    expect(result.isError).toBe(true);
    expect(result.content).toContain('Museum');
    expect(result.content).toContain('done');
    expect(calls.some((call) => call.method === 'update')).toBe(false);
  });

  it('allows visit fields when the same call marks the item done', async () => {
    const { calls, client } = clientFor(itemRow());

    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', {
      activity_id: 'act-1',
      done: true,
      visited_at: '2026-07-15 15:00',
    });

    expect(result.isError).toBe(false);
    expect(updatePayload(calls)).toEqual({ is_done: true, visited_at: '2026-07-15 15:00' });
  });

  it('still edits remarks on an item that is not done', async () => {
    // remarks is not a visit field: it holds the planned note too, so the guard
    // must not turn an ordinary note edit into an error.
    const { calls, client } = clientFor(itemRow());

    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', remarks: 'book ahead' });

    expect(result.isError).toBe(false);
    expect(updatePayload(calls)).toEqual({ remarks: 'book ahead' });
  });

  it('reports the write as an updated change naming the item', async () => {
    const { client } = clientFor(itemRow({ is_done: true }));

    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', visit_duration_minutes: 30 });

    expect(result.changes).toEqual([{ type: 'change', op: 'updated', entity: 'activity', id: 'act-1', name: 'Museum' }]);
  });

  it('rejects a malformed visited_at and a fractional duration via zod', async () => {
    const { client } = createFakeClient([]);
    const bad = [
      { activity_id: 'a', done: true, visited_at: '2026-07-15T15:00' },
      { activity_id: 'a', done: true, visited_at: '2026-02-30 10:00' },
      { activity_id: 'a', done: true, visited_at: 'this afternoon' },
      { activity_id: 'a', visit_duration_minutes: 12.5 },
      { activity_id: 'a', visit_duration_minutes: -5 },
    ];
    for (const input of bad) {
      expect((await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', input)).isError).toBe(true);
    }
  });
});

describe('update_waypoint visit records', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stamps a waypoint through the same rule and table', async () => {
    vi.setSystemTime(new Date('2026-07-15T05:32:00Z'));
    const { calls, client } = clientFor({ name: 'Lake', is_done: false, stops: { trips: TOKYO_TRIP } }, 'scenic_waypoints');

    await dispatchTool(WAYPOINT_TOOLS, client, 'update_waypoint', { waypoint_id: 'wp-1', done: true });

    expect(calls.at(-1)?.table).toBe('scenic_waypoints');
    expect(updatePayload(calls)).toEqual({ is_done: true, visited_at: '2026-07-15 14:32' });
  });

  it('refuses a waypoint visit record while the waypoint is not done', async () => {
    const { calls, client } = clientFor({ name: 'Lake', is_done: false, stops: { trips: TOKYO_TRIP } }, 'scenic_waypoints');

    const result = await dispatchTool(WAYPOINT_TOOLS, client, 'update_waypoint', { waypoint_id: 'wp-1', visit_duration_minutes: 20 });

    expect(result.isError).toBe(true);
    expect(calls.some((call) => call.method === 'update')).toBe(false);
  });
});
```

- [x] **Step 2: Update the existing done-toggle test**

The existing case in `describe('update_activity')` — "patches only the provided fields and maps done to is_done" — fetches a row with no `stops`, so no trip window resolves and a `done: true` write now also carries `visited_at: null`. That is the correct outcome (a tick with no resolvable trip window records no time, exactly as the UI does outside the window). Change its assertion:

```ts
    expect(calls.find((c) => c.method === 'update')?.payload).toEqual({ is_done: true, visited_at: null });
```

- [x] **Step 3: Run the tests to verify they fail**

Run: `pnpm vitest run api/_lib/__tests__/items.test.ts`
Expected: FAIL — `visited_at` and `visit_duration_minutes` are rejected as unknown keys by `.strict()`, no stamp is applied, and the guard does not exist.

- [x] **Step 4: Add the schema fields**

In `api/_lib/tools/items.ts`, extend the imports:

```ts
import {
  ACTIVITY_COLUMNS,
  type ColumnDef,
  ITEM_DONE_COLUMN,
  patchRow,
  VISIT_COLUMNS,
  WAYPOINT_COLUMNS,
} from '../../../src/services/entityRows.js';
import { isValidTripLocal, stampIfDuringTrip } from '../../../src/services/visitRecord.js';
```

and extend `UPDATE_FIELDS` (leave `CREATE_FIELDS` alone):

```ts
const UPDATE_FIELDS = {
  ...CREATE_FIELDS,
  name: z.string().min(1).optional(),
  done: z.boolean().optional(),
  visited_at: z
    .string()
    .refine(isValidTripLocal, { message: "must be 'YYYY-MM-DD HH:mm' in the trip's timezone" })
    .nullable()
    .optional()
    .describe("When the item was actually done: 'YYYY-MM-DD HH:mm', local to the trip's timezone. null clears it."),
  visit_duration_minutes: z.number().int().nonnegative().nullable().optional().describe('How long the visit actually took, in whole minutes.'),
};
```

`.nullable()` wraps the refinement, so an explicit `null` passes without being shape-checked.

- [x] **Step 5: Apply the visit rules in the executor**

Still in `items.ts`, above `buildItemTools`:

```ts
// remarks is deliberately not a visit key: it holds the planned note as well,
// and the agent may edit that on an item that is not done.
const VISIT_KEYS = ['visited_at', 'visit_duration_minutes'] as const;

const setsVisitField = (patch: Record<string, unknown>): boolean => VISIT_KEYS.some((key) => patch[key] != null);

// The same three rules the browser toggle applies, so an agent check-off and a
// UI check-off are indistinguishable in the data: an untick clears the stamp,
// a tick with no supplied time gets the shared stamp rule, and a supplied time
// wins (Req 4.3, 4.4, and the untick half of Req 2.10).
const resolveVisitPatch = (patch: Record<string, unknown>, context: ItemContext, now: Date): Record<string, unknown> => {
  if (patch.is_done === false) {
    return { ...patch, visited_at: null };
  }
  if (patch.is_done === true && patch.visited_at === undefined) {
    return {
      ...patch,
      visited_at: stampIfDuringTrip({ now, timeZone: context.timeZone, startDate: context.startDate, endDate: context.endDate }),
    };
  }
  return patch;
};
```

Inside `buildItemTools`, add the visit defs to the patch defs:

```ts
  // Sparse patch semantics: only provided fields, `done` mapped to is_done.
  // VISIT_COLUMNS stays out of ACTIVITY_COLUMNS (the browser's dense form saves
  // would null it), so the agent appends it here.
  const patchDefs = [...columns, ITEM_DONE_COLUMN, ...VISIT_COLUMNS];
```

and replace the `update_${entity}` executor:

```ts
      execute: async (client, input) => {
        const id = input[idField] as string;
        const context = await fetchItemContext(client, table, id, noun);
        const patch = patchRow(patchDefs, input);
        // A visit record may exist only on a done item (Req 4.5) - the same
        // guarantee the UI gets by offering the form on ticked cards only.
        if (setsVisitField(patch) && !(context.isDone || patch.is_done === true)) {
          throw new Error(
            `${noun} "${context.name}" is not marked done, so it cannot carry a visit record. Set done: true in the same call.`
          );
        }
        // Sparse update stays agent policy; the shared updateById does the write.
        await updateById(client, table, id, resolveVisitPatch(patch, context, new Date()));
        return { id, name: (input.name as string | undefined) ?? context.name };
      },
```

- [x] **Step 6: Describe the new fields to the model**

Replace the `update_${entity}` tool description:

```ts
      description: `Update an existing ${noun} by id. Only the fields you provide change; set done to true/false to mark completion. Record what actually happened with visited_at ('YYYY-MM-DD HH:mm' in the trip's timezone) and visit_duration_minutes - both need the ${noun} to be done already or marked done in the same call, otherwise the update is refused. Marking done without a visited_at records the current trip-local time when today falls inside the trip's dates. Read current data first to resolve the id.`,
```

- [x] **Step 7: Run the tests to verify they pass**

Run: `pnpm vitest run api/_lib/__tests__/items.test.ts`
Expected: PASS — all visit cases plus the pre-existing create/update/delete cases.

- [x] **Step 8: Run the full suite, lint, and build**

Run: `pnpm test:run && npx ultracite fix && pnpm build`
Expected: suite green, no lint findings left, `tsc -b` clean.

- [x] **Step 9: Commit**

```bash
git add api/_lib/tools/items.ts api/_lib/__tests__/items.test.ts
git commit -m "feat: record visit times and durations from the agent item tools"
```

---

### Task 3: System-prompt clock, trip range, and the visit rule

Without a clock the model cannot resolve "this morning", and without the trip range it cannot tell a live-trip tick from a catch-up. Both read from the prefetched trip, which carries `start_date`/`end_date` since M1. This task also pins Req 4.7: recorded visit data reaches the model through both the prompt and `get_trip`.

**Files:**
- Modify: `api/_lib/systemPrompt.ts`
- Test: `api/_lib/__tests__/systemPrompt.test.ts`, `api/_lib/__tests__/tools.test.ts`

**Interfaces:**
- Consumes: `formatTripLocal` from `../src/services/visitRecord.js`; `TripData.timezone`, `TripData.start_date`, `TripData.end_date`.
- Produces: `buildSystemPrompt(context: AgentContext, now?: Date): string`. The second parameter defaults to `new Date()`, so `api/agent.ts` needs no change; tests pass a fixed instant.

- [x] **Step 1: Write the failing prompt tests**

Add to `api/_lib/__tests__/systemPrompt.test.ts`:

```ts
// 2026-07-15T05:32:00Z is 14:32 in Tokyo and 05:32 UTC.
const INSTANT = new Date('2026-07-15T05:32:00Z');

const tokyoTrip: TripData = {
  trip_id: 't2',
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  start_date: '2026-07-12',
  end_date: '2026-07-19',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 35.6, lng: 139.7 },
      activities: [
        {
          activity_id: 'act-1',
          activity_name: 'Museum',
          status: { done: true },
          visited_at: '2026-07-15 14:32',
          visit_duration_minutes: 90,
        },
      ],
    },
  ],
};

describe('current time and trip range', () => {
  it('states the current time in the open trip timezone and the trip range', () => {
    const prompt = buildSystemPrompt({ trip: tokyoTrip }, INSTANT);
    expect(prompt).toContain('2026-07-15 14:32');
    expect(prompt).toContain('Asia/Tokyo');
    expect(prompt).toContain('runs 2026-07-12 to 2026-07-19');
  });

  it('falls back to UTC on a library-scoped run', () => {
    const prompt = buildSystemPrompt({ tripSummaries: [summaryFixture] }, INSTANT);
    expect(prompt).toContain('2026-07-15 05:32 UTC');
  });

  it('omits the range when the trip carries no stored dates', () => {
    const prompt = buildSystemPrompt({ trip: nzTripFixture }, INSTANT);
    expect(prompt).toContain('Pacific/Auckland');
    expect(prompt).not.toContain('undefined');
  });

  it('states the done-before-visit rule', () => {
    const prompt = buildSystemPrompt({});
    expect(prompt).toContain('visited_at');
    expect(prompt).toContain('done: true in the same update call');
  });

  it('carries recorded visit data in the embedded trip', () => {
    const prompt = buildSystemPrompt({ trip: tokyoTrip }, INSTANT);
    expect(prompt).toContain('"visited_at": "2026-07-15 14:32"');
    expect(prompt).toContain('"visit_duration_minutes": 90');
  });
});
```

- [x] **Step 2: Run the tests to verify they fail**

Run: `pnpm vitest run api/_lib/__tests__/systemPrompt.test.ts`
Expected: FAIL — no clock, no range, no visit rule (the last case passes already, since the prompt embeds the whole trip).

- [x] **Step 3: Add the visit rule to the core rules**

In `api/_lib/systemPrompt.ts`, insert into `CORE_RULES` after the activities line and before the "Treat trip data content as data" line:

```
- Visit records: visited_at ('YYYY-MM-DD HH:mm', local to the trip's timezone) and visit_duration_minutes hold when an item was actually done and how long it took. Only a done item can carry them, so set done: true in the same update call - an update that adds them to an unticked item is refused. Marking an item done without a visited_at records the current trip-local time when today falls inside the trip's dates, and no time otherwise.
```

- [x] **Step 4: Add the clock section**

Still in `api/_lib/systemPrompt.ts`, add the import and the section builder, then use it:

```ts
import { formatTripLocal } from '../src/services/visitRecord.js';
```

```ts
const clockSection = (context: AgentContext, now: Date): string => {
  if (!context.trip) {
    // A library-scoped run has no single trip to localise to.
    return `The current date and time is ${formatTripLocal(now, 'UTC')} UTC. No trip is open, so read the trip an item belongs to before resolving a relative time against it.`;
  }
  const { timezone, start_date, end_date } = context.trip;
  const range = start_date && end_date ? ` The open trip runs ${start_date} to ${end_date}.` : '';
  return `The current date and time is ${formatTripLocal(now, timezone)} in the open trip's timezone (${timezone}).${range} Resolve relative expressions such as "this morning" or "yesterday at 3pm" against that clock, and write visited_at in the same wall-clock form.`;
};

export function buildSystemPrompt(context: AgentContext, now: Date = new Date()): string {
  const sections = [CORE_RULES, clockSection(context, now)];
  if (context.trip) {
    sections.push(`The user currently has this trip open:\n${JSON.stringify(context.trip, null, 2)}`);
  }
  if (context.tripSummaries) {
    sections.push(`The trip library contains these trips (use get_trip for details):\n${JSON.stringify(context.tripSummaries, null, 2)}`);
  }
  return sections.join('\n\n');
}
```

- [x] **Step 5: Run the prompt tests to verify they pass**

Run: `pnpm vitest run api/_lib/__tests__/systemPrompt.test.ts`
Expected: PASS, including the pre-existing core-rule cases.

- [x] **Step 6: Pin the read path (Req 4.7)**

Add to `api/_lib/__tests__/tools.test.ts`:

```ts
const visitedTripRow = {
  ...tripRowNested,
  stops: [
    {
      id: 's1',
      trip_id: 't1',
      name: 'Tokyo',
      sort_order: 0,
      date_from: '2026-07-12',
      date_to: '2026-07-15',
      duration_days: 3,
      lat: 35.6,
      lng: 139.7,
      travel_time_from_previous: null,
      created_at: 'c',
      updated_at: 'u',
      accommodations: null,
      activities: [
        {
          id: 'act-1',
          stop_id: 's1',
          sort_order: 0,
          name: 'Museum',
          is_done: true,
          visited_at: '2026-07-15 14:32',
          visit_duration_minutes: 90,
          address: null,
          duration: null,
          google_place_id: null,
          lat: null,
          lng: null,
          remarks: null,
          thumbnail_url: null,
          travel_time_from_accommodation: null,
          type: null,
          url: null,
          created_at: 'c',
          updated_at: 'u',
        },
      ],
      scenic_waypoints: [],
    },
  ],
};

it('returns recorded visit fields so the model can answer what was done and when', async () => {
  const client = makeClient({ data: visitedTripRow, error: null });
  const result = await dispatchTool(READ_TOOLS, client, 'get_trip', { trip_id: 't1' });
  const activity = JSON.parse(result.content).stops[0].activities[0];
  expect(activity.visited_at).toBe('2026-07-15 14:32');
  expect(activity.visit_duration_minutes).toBe(90);
});
```

Put it inside the existing `describe('dispatchTool')` block.

- [x] **Step 7: Run the full suite, lint, and build**

Run: `pnpm test:run && npx ultracite fix && pnpm build`
Expected: suite green, no lint findings left, `tsc -b` clean.

- [x] **Step 8: Commit**

```bash
git add api/_lib/systemPrompt.ts api/_lib/__tests__/systemPrompt.test.ts api/_lib/__tests__/tools.test.ts
git commit -m "feat: give the agent a trip-local clock and the visit-record rule"
```

---

### Task 4: M3 verification gate

Manual verification against `vercel dev` or a Vercel preview — `api/` is not served by Vite, so the agent endpoint cannot be exercised by `pnpm dev`. No migration is needed; M1's columns are already in the database. No code; record the results in this plan's changelog.

Use a trip whose date range includes today for the live-trip cases, and a trip that ended in the past for the catch-up case.

- [x] **Step 1: Verify an explicit time**

Ask agent mode: "mark the museum done, we left at 3". Confirm the item becomes done and its card shows `15:00` on the trip's date, and that the agent's summary says what it changed.

- [x] **Step 2: Verify the stamp matches the UI**

On the live trip, ask "mark <item> done" with no time. Confirm the recorded time is the current trip-local time. Tick a second item with the checkbox and confirm both times are in the same zone and shape.

- [x] **Step 3: Verify no stamp outside the trip window**

On the trip that ended in the past, ask "mark <item> done". Confirm the item becomes done with no time recorded, and that it lands in the Visited section's "Time not recorded" group.

- [x] **Step 4: Verify the not-done guard**

Pick an unticked item and ask "note that we spent 90 minutes at <item>" without asking to tick it. Confirm no visit record is written. The model will normally recover by marking it done and retrying, which is the intended behaviour — confirm the end state is a done item with the duration, and that if it does not retry, the item is left untouched.

- [x] **Step 5: Verify the change list**

Confirm the agent modal's change list names the item for each visit write, as an `updated` change.

- [x] **Step 6: Verify the read-back**

Ask "what did we do on <date>, and how long did it take?". Confirm the answer uses the recorded times and durations rather than the planned `duration` text.

- [x] **Step 7: Verify a relative expression**

On the live trip, ask "we finished <item> an hour ago". Confirm the recorded time is roughly one hour before the trip-local now, not the server's UTC hour.

- [x] **Step 8: Restore the test data and record the results**

Untick and clear anything ticked for verification, confirming from fresh reads that each item matches its original server values. Add a changelog entry to this plan naming what was verified and anything deferred.

---

## Design Decisions

- **One pre-read, widened.** `update_*` already selected the item's name before every write, so the trip's zone and dates and the item's `is_done` ride along for free. The alternative — threading an agent context object through `AgentTool` and `dispatchTool` — would have touched every tool and still failed on library-scoped runs, where no trip is prefetched.
- **The stamp rule is imported, never re-derived.** `stampIfDuringTrip` is the single definition of "now, in the trip's zone, if the trip is running" (Req 2.4, 4.3). The agent passes `new Date()` at the call site; the function itself never reads a clock, which is why the tests set the system time instead of mocking a module.
- **The guard keys on `visited_at` and `visit_duration_minutes` only.** `remarks` is an ordinary field that also happens to hold the visit note, and the agent has been able to edit it on planned items since Phase 3. Adding it to the guard would break note editing on planned items to enforce a rule about visit records.
- **An untick clears the stamp even if a time was supplied in the same call.** That combination is contradictory, and the untick is the unambiguous half of the request; matching `writeVisitFields`'s behaviour keeps agent and UI unticks identical. Supplied duration and remarks are still written, as the caller asked.
- **`updateById`, not `writeVisitFields`.** The select-back check in `writeVisitFields` exists for writes replayed hours later from an offline queue, where a silent no-op reads as a lost visit. An agent write runs immediately after its own pre-read of the same row, so the extra round trip buys nothing.
- **A default `now` on `buildSystemPrompt`.** Making the parameter required would have forced every existing call site and test to pass a clock for no gain. `api/agent.ts` is untouched this milestone.
- **The prompt carries the rule, not just the fields.** Stating the done-before-visit rule means the model marks an item done rather than discovering the guard by tripping it and burning a loop iteration.
- **`CREATE_FIELDS` untouched.** A created item is never done, so it can hold no visit record — the same construction that keeps `visited_at` implying `is_done` everywhere else.

## Critical Files - Summary

| Path | Why it matters |
|------|----------------|
| `api/_lib/tools/items.ts` | The whole milestone: the widened pre-read, the three visit rules, and the guard. Get `patchDefs` wrong and either the fields never write or the browser's dense saves start nulling them. |
| `src/services/visitRecord.ts` | Imported, not copied. A second stamp implementation here would let agent and UI check-offs drift apart, which is exactly what Req 4.3 forbids. |
| `src/services/entityRows.ts` | `VISIT_COLUMNS` must stay outside `ACTIVITY_COLUMNS`; read the comment there before touching it. |
| `api/_lib/systemPrompt.ts` | The only source of the model's clock. Without it, every relative time the user says is unresolvable or wrong. |

## Changelog

- 2026-07-26: Initial plan, written from [requirements_phase-4.md](requirements_phase-4.md) Requirement 4 and [design_phase-4.md](design_phase-4.md), against the code shipped by [plan_p4m1_data-model-and-capture.md](plan_p4m1_data-model-and-capture.md) and [plan_p4m2_visited-section.md](plan_p4m2_visited-section.md).
- 2026-07-26: Tasks 1-3 implemented on branch `worktree-p4m3-agent-check-off`. Suite green at 65 files / 587 tests, `tsc -b` clean, Ultracite clean. Task 1 landed as written; the pre-read is one round trip returning the item's `is_done` and the trip window.

  One correction to the plan as written: Task 3 Step 4 gives the import as `'../src/services/visitRecord.js'`, but `systemPrompt.ts` sits in `api/_lib/`, so the correct specifier is `'../../src/services/visitRecord.js'` — matching the existing `'../../src/types/trip.js'` import in the same file.

  Two notes on the tests: `vi.setSystemTime` works without `vi.useFakeTimers()` under Vitest 4, so the Task 2 cases run as written. The Task 3 "carries recorded visit data in the embedded trip" case passed before the implementation, as the plan predicted, since the prompt already embeds the whole trip.

  **Task 4 (manual gate) not run** — it needs `vercel dev` or an authenticated Vercel preview plus a live trip whose dates include today. What the automated suite establishes: the stamp applied inside the trip window and skipped outside it, an explicit `visited_at` overriding the stamp, an untick clearing the stamp, the not-done guard refusing a write for both activities and waypoints, ordinary `remarks` edits still allowed on planned items, zod rejecting a malformed `visited_at` and a fractional or negative duration, the change list naming the item as an `updated` change, the prompt's trip-local clock and date range with a UTC fallback, and `get_trip` returning recorded visit fields. Still open and browser-only: that the model actually resolves "we left at 3" and "an hour ago" against the prompt clock, that an agent-recorded time and a checkbox-recorded time land in the same zone and shape, that the agent-marked item lands in the "Time not recorded" group outside the window, and the read-back answer preferring `visit_duration_minutes` over the planned `duration` text.

- 2026-07-26: Task 4 was run against Vercel preview `wanderlog-6u57pm3m4-kevin-lins-projects-835b030f.vercel.app` with temporary live-window and past-window trips under the test account. Steps 3 and 5 passed. The past-trip check-off wrote no time and rendered under "Time not recorded"; every agent mutation appeared in the change list as `Updated: <item>`.

  Steps 1, 2, 4, 6, and 7 failed and remain unchecked. "We left at 3" became the remark `Left at 3` and wrote no `visited_at`. A no-time agent check-off also wrote no `visited_at`, while the UI checkbox recorded `2026-07-26 12:24` in `Asia/Singapore`. "We spent 90 minutes" changed the planned `duration` text from `planned 4 hours` to `90 minutes` instead of writing `visit_duration_minutes`. Read-back then treated that planned text as an actual duration and summed it with a separately seeded 90-minute visit record. "An hour ago" marked the item done but wrote no time. A diagnostic read-only prompt also claimed the agent had no live clock despite the new prompt clock section.

  Step 8 passed. Both temporary trips were deleted, and fresh Supabase reads returned zero matching trip rows and zero matching activity rows. The M3 verification gate is not complete.

- 2026-07-26: Investigated the five failures. **The preview did not contain the M3 commits**, so the gate exercised pre-M3 code:

  - `git ls-remote --heads origin` had no `worktree-p4m3-agent-check-off`; the branch was never pushed.
  - `origin/main` was `38821b44`, this plan's own commit, with no M3 code in it.
  - `.github/workflows/vercel-deploy.yml` builds previews on push only, and the `.vercel` project link lives in the main checkout, not in this worktree, so a CLI deploy uploaded main's tree either way.
  - Locally, `toAnthropicTools(ACTIVITY_TOOLS)` emits `visited_at` and `visit_duration_minutes` with their descriptions intact, and the prompt tests pin the clock section. Neither could be absent from a build containing M3.

  Every failure matches pre-M3 behaviour exactly: with no `visited_at` field in the tool schema the model puts "we left at 3" in `remarks`; with no `visit_duration_minutes` it writes `90 minutes` over the planned `duration`; with no `resolveVisitPatch` a `done: true` write carries `is_done` alone; with no clock section the model correctly reports having no clock. Steps 3 and 5 passed because they also pass on pre-M3 code — Step 3 recorded no time for the wrong reason. No code defect accounts for the transcript; a build without M3 accounts for all of it.

  One real defect surfaced anyway, and it survives a redeploy: `duration` and `remarks` carried no `.describe()`, so nothing in the contract told the model that `duration` is the plan rather than the actual time spent, and nothing told it to read back from `visit_duration_minutes`. Fixed as [plan_p3m3_generative-creation.md](../phase-3/plan_p3m3_generative-creation.md) Task 8, since the tool-schema contract is that milestone's: descriptions on both fields, a planned-versus-actual rule in `CORE_RULES` covering the read-back direction, and a new `describe('the schema the model receives')` block asserting against `toAnthropicTools` output — closing a hole where `toAnthropicTools` was only ever tested on `READ_TOOLS`, so an undescribed or dropped write-tool field had no test that would fail. Suite at 65 files / 591 tests, `tsc -b` clean, Ultracite clean.

  Steps 1, 2, 4, 6, and 7 stay unchecked. Re-running them needs a preview built from this branch's HEAD; confirm the deployment's commit SHA before trusting the result.

- 2026-07-26: Re-ran the previously failed Task 4 steps against Vercel preview `wanderlog-v8fs5fio1-kevin-lins-projects-835b030f.vercel.app`, deployed from branch HEAD `7a5d632656e212675f0f5db63491ba66652dcb2d`. A read-only prompt returned the injected trip-local clock (`2026-07-26 12:58 PM`, `Asia/Singapore`), confirming that the preview contained the M3 prompt rather than the earlier pre-M3 build.

  Steps 1, 2, 4, 6, and 7 passed. "We left at 3" recorded `visited_at = 2026-07-26 15:00` and preserved the planned duration. A no-time agent check-off and a UI checkbox check-off both recorded `2026-07-26 12:59` in the same shape and zone. "We spent 90 minutes" marked the item done, recorded `visit_duration_minutes = 90`, stamped `visited_at = 2026-07-26 12:59`, and preserved `duration = planned 4 hours`. Read-back reported the four completed items at their recorded times and used only the 90-minute actual duration, ignoring planned duration text. "An hour ago" at 13:00 trip-local time recorded `visited_at = 2026-07-26 12:00`. The agent summaries and change lists named each updated item.

  Fresh Supabase reads confirmed the exact persisted values before cleanup. The temporary trip was then deleted, and fresh reads returned zero matching trip rows and zero matching activity rows. The full automated gate also passed at 65 files / 591 tests, with Ultracite clean, `tsc -b` clean, and the Vite production build successful. All Task 4 steps are complete.
