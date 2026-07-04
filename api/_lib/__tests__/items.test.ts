import { describe, expect, it } from 'vitest';
import { dispatchTool } from '../tools';
import { ACTIVITY_TOOLS, WAYPOINT_TOOLS } from '../tools/items';
import { createFakeClient } from './fakeSupabaseClient';

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
    expect(calls.find((c) => c.method === 'update')?.payload).toEqual({ is_done: true });
    expect(result.changes).toEqual([{ type: 'change', op: 'updated', entity: 'activity', id: 'act-1', name: 'Old name' }]);
  });

  it('rejects an update with no editable field', async () => {
    const { client } = createFakeClient([]);
    expect((await dispatchTool(ACTIVITY_TOOLS, client, 'update_activity', { activity_id: 'act-1' })).isError).toBe(true);
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
