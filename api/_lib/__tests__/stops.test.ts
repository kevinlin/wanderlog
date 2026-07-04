import { describe, expect, it } from 'vitest';
import { dispatchTool } from '../tools';
import { STOP_TOOLS } from '../tools/stops';
import { createFakeClient } from './fakeSupabaseClient';

describe('create_stop', () => {
  it('inserts with counted sort_order and computed duration_days', async () => {
    const { calls, client } = createFakeClient([
      { table: 'stops', method: 'select', count: 2 },
      { table: 'stops', method: 'insert' },
    ]);
    const result = await dispatchTool(STOP_TOOLS, client, 'create_stop', {
      trip_id: 't1',
      name: 'Queenstown',
      lat: -45.03,
      lng: 168.66,
      date_from: '2026-03-02',
      date_to: '2026-03-05',
    });
    const inserted = calls.find((c) => c.method === 'insert')?.payload as Record<string, unknown>;
    expect(inserted).toMatchObject({
      trip_id: 't1',
      name: 'Queenstown',
      lat: -45.03,
      lng: 168.66,
      date_from: '2026-03-02',
      date_to: '2026-03-05',
      duration_days: 3,
      sort_order: 2,
    });
    expect(result.changes[0]).toMatchObject({ op: 'created', entity: 'stop', name: 'Queenstown' });
  });

  it('rejects a reversed date range via zod', async () => {
    const { client } = createFakeClient([]);
    const result = await dispatchTool(STOP_TOOLS, client, 'create_stop', {
      trip_id: 't1',
      name: 'X',
      lat: 0,
      lng: 0,
      date_from: '2026-03-05',
      date_to: '2026-03-02',
    });
    expect(result.isError).toBe(true);
  });
});

describe('update_stop', () => {
  it('recomputes duration_days when one date changes, merging with stored dates', async () => {
    const { calls, client } = createFakeClient([
      { table: 'stops', method: 'select', data: { name: 'Queenstown', date_from: '2026-03-02', date_to: '2026-03-05' } },
      { table: 'stops', method: 'update' },
    ]);
    await dispatchTool(STOP_TOOLS, client, 'update_stop', { stop_id: 's1', date_to: '2026-03-07' });
    expect(calls.find((c) => c.method === 'update')?.payload).toEqual({ date_to: '2026-03-07', duration_days: 5 });
  });

  it('errors when the merged date range is reversed', async () => {
    const { client } = createFakeClient([
      { table: 'stops', method: 'select', data: { name: 'Q', date_from: '2026-03-02', date_to: '2026-03-05' } },
    ]);
    const result = await dispatchTool(STOP_TOOLS, client, 'update_stop', { stop_id: 's1', date_to: '2026-02-01' });
    expect(result.isError).toBe(true);
  });
});

describe('delete_stop', () => {
  it('reads the name then deletes (DB cascade removes children)', async () => {
    const { calls, client } = createFakeClient([
      { table: 'stops', method: 'select', data: { name: 'Wanaka' } },
      { table: 'stops', method: 'delete' },
    ]);
    const result = await dispatchTool(STOP_TOOLS, client, 'delete_stop', { stop_id: 's2' });
    expect(calls.map((c) => c.method)).toEqual(['select', 'delete']);
    expect(result.changes[0]).toMatchObject({ op: 'deleted', entity: 'stop', name: 'Wanaka' });
  });
});

describe('restructure_stops', () => {
  const tripSelect = { table: 'trips', method: 'select' as const, data: { name: 'NZ Trip', start_date: '2026-03-01' } };
  const stopsSelect = {
    table: 'stops',
    method: 'select' as const,
    data: [
      { id: 'a', name: 'Auckland', lat: -36.8, lng: 174.7, date_from: '2026-03-01', date_to: '2026-03-04', sort_order: 0 },
      { id: 'b', name: 'Rotorua', lat: -38.1, lng: 176.2, date_from: '2026-03-04', date_to: '2026-03-06', sort_order: 1 },
    ],
  };

  it('rejects ids that are not a permutation of the trip stops', async () => {
    const { client } = createFakeClient([tripSelect, stopsSelect]);
    const result = await dispatchTool(STOP_TOOLS, client, 'restructure_stops', {
      trip_id: 't1',
      ordered_stop_ids: ['a'],
    });
    expect(result.isError).toBe(true);
    expect(result.content).toContain('permutation');
  });

  it('reorders, cascades dates from the trip start, and updates the trip span', async () => {
    const { calls, client } = createFakeClient([
      tripSelect,
      stopsSelect,
      { table: 'stops', method: 'update' },
      { table: 'stops', method: 'update' },
      { table: 'trips', method: 'update' },
    ]);
    const result = await dispatchTool(STOP_TOOLS, client, 'restructure_stops', {
      trip_id: 't1',
      ordered_stop_ids: ['b', 'a'],
    });
    expect(result.isError).toBe(false);
    const stopUpdates = calls.filter((c) => c.table === 'stops' && c.method === 'update').map((c) => c.payload);
    // b keeps 2 nights anchored at the trip start; a keeps 3 nights after it
    expect(stopUpdates).toContainEqual({ sort_order: 0, date_from: '2026-03-01', date_to: '2026-03-03', duration_days: 2 });
    expect(stopUpdates).toContainEqual({ sort_order: 1, date_from: '2026-03-03', date_to: '2026-03-06', duration_days: 3 });
    expect(calls.find((c) => c.table === 'trips' && c.method === 'update')?.payload).toEqual({
      start_date: '2026-03-01',
      end_date: '2026-03-06',
    });
    // both stops changed → change events for each, plus the trip span
    expect(result.changes).toHaveLength(3);
    expect(result.changes.at(-1)).toMatchObject({ entity: 'trip', op: 'updated', name: 'NZ Trip' });
  });
});
