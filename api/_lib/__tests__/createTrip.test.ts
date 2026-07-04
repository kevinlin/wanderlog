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
        { activity_name: 'Ghibli Museum' }, // deliberately without coordinates
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
    expect(result.changes).toEqual([{ type: 'change', op: 'created', entity: 'trip', id: output.trip_id, name: 'Tokyo with kids' }]);
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
