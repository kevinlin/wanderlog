import { afterEach, describe, expect, it, vi } from 'vitest';
import { dispatchTool } from '../tools';
import { ACTIVITY_TOOLS, WAYPOINT_TOOLS } from '../tools/items';
import { createFakeClient, type FakeCall } from './fakeSupabaseClient';

const UUID_RE = /^[0-9a-f-]{36}$/;

describe('tool names', () => {
  it('exposes create/update/delete for both entities', () => {
    expect(ACTIVITY_TOOLS.map((t) => t.name).sort()).toEqual(['create_activity', 'delete_activity', 'update_activity']);
    expect(WAYPOINT_TOOLS.map((t) => t.name).sort()).toEqual(['create_waypoint', 'delete_waypoint', 'update_waypoint']);
  });
});

describe('create_activity', () => {
  it('appends with a fresh uuid, counted sort_order, and is_done false', async () => {
    const { calls, client } = createFakeClient([
      { table: 'activities', method: 'select', count: 3 },
      { table: 'activities', method: 'insert' },
    ]);
    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'create_activity', {
      stop_id: 'stop-1',
      name: 'Ramen dinner',
      type: 'restaurant',
      lat: 35.66,
      lng: 139.7,
    });
    expect(result.isError).toBe(false);
    const inserted = calls.find((c) => c.method === 'insert')?.payload as Record<string, unknown>;
    expect(inserted).toMatchObject({
      stop_id: 'stop-1',
      sort_order: 3,
      is_done: false,
      name: 'Ramen dinner',
      type: 'restaurant',
      lat: 35.66,
      lng: 139.7,
    });
    expect(inserted.id).toMatch(UUID_RE);
    expect(result.changes).toEqual([{ type: 'change', op: 'created', entity: 'activity', id: inserted.id, name: 'Ramen dinner' }]);
  });

  it('rejects unknown keys and a missing stop_id via zod', async () => {
    const { client } = createFakeClient([]);
    expect((await dispatchTool(ACTIVITY_TOOLS, client, 'create_activity', { name: 'x' })).isError).toBe(true);
    expect((await dispatchTool(ACTIVITY_TOOLS, client, 'create_activity', { stop_id: 's', name: 'x', bogus: 1 })).isError).toBe(true);
  });
});

describe('update_activity', () => {
  it('patches only the provided fields and maps done to is_done', async () => {
    const { calls, client } = createFakeClient([
      { table: 'activities', method: 'select', data: { name: 'Old name' } },
      { table: 'activities', method: 'update' },
    ]);
    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1', done: true });
    expect(calls.find((c) => c.method === 'update')?.payload).toEqual({ is_done: true, visited_at: null });
    expect(result.changes).toEqual([{ type: 'change', op: 'updated', entity: 'activity', id: 'act-1', name: 'Old name' }]);
  });

  it('rejects an update with no editable field', async () => {
    const { client } = createFakeClient([]);
    expect((await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1' })).isError).toBe(true);
  });

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

  it('errors when the id does not exist, without writing', async () => {
    const { calls, client } = createFakeClient([{ table: 'activities', method: 'select', data: null }]);
    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'ghost', name: 'X' });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('No activity found');
    expect(calls.some((c) => c.method === 'update')).toBe(false);
  });
});

describe('delete_activity', () => {
  it('reads the name, deletes, and reports the deletion', async () => {
    const { calls, client } = createFakeClient([
      { table: 'activities', method: 'select', data: { name: 'Museum visit' } },
      { table: 'activities', method: 'delete' },
    ]);
    const result = await dispatchTool(ACTIVITY_TOOLS, client, 'delete_activity', { activity_id: 'act-2' });
    expect(calls.map((c) => c.method)).toEqual(['select', 'delete']);
    expect(result.changes).toEqual([{ type: 'change', op: 'deleted', entity: 'activity', id: 'act-2', name: 'Museum visit' }]);
  });
});

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

describe('waypoint variants', () => {
  it('create_waypoint rejects a type field (waypoints have none)', async () => {
    const { client } = createFakeClient([]);
    const result = await dispatchTool(WAYPOINT_TOOLS, client, 'create_waypoint', {
      stop_id: 's1',
      name: 'Lookout',
      type: 'scenic',
    });
    expect(result.isError).toBe(true);
  });

  it('create_waypoint writes to scenic_waypoints with entity waypoint', async () => {
    const { calls, client } = createFakeClient([
      { table: 'scenic_waypoints', method: 'select', count: 0 },
      { table: 'scenic_waypoints', method: 'insert' },
    ]);
    const result = await dispatchTool(WAYPOINT_TOOLS, client, 'create_waypoint', { stop_id: 's1', name: 'Lookout' });
    expect(calls.at(-1)?.table).toBe('scenic_waypoints');
    expect(result.changes[0]).toMatchObject({ entity: 'waypoint', op: 'created', name: 'Lookout' });
  });
});
