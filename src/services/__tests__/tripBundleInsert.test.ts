import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import type { TripData } from '@/types/trip';
import { insertTripBundle } from '../tripBundleInsert';

interface Call {
  method: 'delete' | 'insert';
  payload?: unknown;
  table: string;
}

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
    expect(calls.filter((c) => c.method === 'insert').map((c) => c.table)).toEqual(['trips', 'stops', 'accommodations', 'activities']); // scenic_waypoints skipped: no rows
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
