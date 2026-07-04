import { describe, expect, it } from 'vitest';
import { dispatchTool } from '../tools';
import { TRIP_FIELD_TOOLS } from '../tools/tripFields';
import { createFakeClient } from './fakeSupabaseClient';

describe('upsert_accommodation', () => {
  it('creates with the deterministic id and reports op created when none existed', async () => {
    const { calls, client } = createFakeClient([
      { table: 'accommodations', method: 'select', data: null },
      { table: 'accommodations', method: 'upsert' },
    ]);
    const result = await dispatchTool(TRIP_FIELD_TOOLS, client, 'upsert_accommodation', {
      stop_id: 'stop-1',
      name: 'Park Hyatt',
      address: '3-7-1-2 Nishi-Shinjuku',
      check_in: '2026-03-02 15:00',
    });
    const upserted = calls.find((c) => c.method === 'upsert')?.payload as Record<string, unknown>;
    expect(upserted).toMatchObject({
      id: 'stop-1_accommodation',
      stop_id: 'stop-1',
      name: 'Park Hyatt',
      address: '3-7-1-2 Nishi-Shinjuku',
      check_in: '2026-03-02 15:00',
      check_out: null,
      confirmation: null,
      url: null,
      remarks: null,
      lat: null,
      lng: null,
    });
    expect(result.changes).toEqual([
      { type: 'change', op: 'created', entity: 'accommodation', id: 'stop-1_accommodation', name: 'Park Hyatt' },
    ]);
  });

  it('reports op updated when the row already existed', async () => {
    const { client } = createFakeClient([
      { table: 'accommodations', method: 'select', data: { id: 'stop-1_accommodation' } },
      { table: 'accommodations', method: 'upsert' },
    ]);
    const result = await dispatchTool(TRIP_FIELD_TOOLS, client, 'upsert_accommodation', {
      stop_id: 'stop-1',
      name: 'Park Hyatt',
    });
    expect(result.changes[0]).toMatchObject({ op: 'updated' });
  });
});

describe('update_trip_metadata', () => {
  it('patches only provided fields and validates the trip exists', async () => {
    const { calls, client } = createFakeClient([
      { table: 'trips', method: 'select', data: { name: 'NZ Trip' } },
      { table: 'trips', method: 'update' },
    ]);
    const result = await dispatchTool(TRIP_FIELD_TOOLS, client, 'update_trip_metadata', {
      trip_id: 't1',
      destination: 'New Zealand',
    });
    expect(calls.find((c) => c.method === 'update')?.payload).toEqual({ destination: 'New Zealand' });
    expect(result.changes).toEqual([{ type: 'change', op: 'updated', entity: 'trip', id: 't1', name: 'NZ Trip' }]);
  });

  it('rejects an empty patch and a reversed date range via zod', async () => {
    const { client } = createFakeClient([]);
    expect((await dispatchTool(TRIP_FIELD_TOOLS, client, 'update_trip_metadata', { trip_id: 't1' })).isError).toBe(true);
    expect(
      (
        await dispatchTool(TRIP_FIELD_TOOLS, client, 'update_trip_metadata', {
          trip_id: 't1',
          start_date: '2026-03-10',
          end_date: '2026-03-01',
        })
      ).isError
    ).toBe(true);
  });

  it('errors on an unknown trip id without writing', async () => {
    const { calls, client } = createFakeClient([{ table: 'trips', method: 'select', data: null }]);
    const result = await dispatchTool(TRIP_FIELD_TOOLS, client, 'update_trip_metadata', { trip_id: 'ghost', name: 'X' });
    expect(result.isError).toBe(true);
    expect(calls.some((c) => c.method === 'update')).toBe(false);
  });
});
