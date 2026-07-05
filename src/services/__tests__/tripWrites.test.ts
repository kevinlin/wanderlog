import { describe, expect, it } from 'vitest';
import { createFakeClient } from '../../../api/_lib/__tests__/fakeSupabaseClient';
import {
  applyStopStructure,
  createActivity,
  createStop,
  createWaypoint,
  deleteById,
  reorderActivities,
  setActivityDone,
  setWaypointDone,
  updateActivity,
  updateStop,
  updateTripMetadata,
  upsertAccommodation,
} from '../tripWrites';

const UUID_RE = /^[0-9a-f-]{36}$/;

describe('activity writes', () => {
  it('createActivity inserts the full dense row with a fresh uuid and is_done false', async () => {
    const { calls, client } = createFakeClient([{ table: 'activities', method: 'insert' }]);
    const id = await createActivity(client, 'stop-1', 5, {
      name: 'Kayaking',
      type: 'outdoor',
      thumbnailUrl: 't.jpg',
      googlePlaceId: 'pid',
    });
    expect(id).toMatch(UUID_RE);
    expect(calls[0].payload).toEqual({
      id,
      stop_id: 'stop-1',
      sort_order: 5,
      is_done: false,
      name: 'Kayaking',
      type: 'outdoor',
      lat: null,
      lng: null,
      address: null,
      duration: null,
      url: null,
      remarks: null,
      thumbnail_url: 't.jpg',
      google_place_id: 'pid',
    });
  });

  it('createActivity throws the normalized supabase error', async () => {
    const { client } = createFakeClient([{ table: 'activities', method: 'insert', error: { message: 'denied' } }]);
    await expect(createActivity(client, 'stop-1', 0, { name: 'X' })).rejects.toThrow('denied');
  });

  it('updateActivity writes a dense row, nulling absent fields', async () => {
    const { calls, client } = createFakeClient([{ table: 'activities', method: 'update' }]);
    await updateActivity(client, 'act-1', { name: 'Renamed' });
    expect(calls[0].payload).toMatchObject({ name: 'Renamed', remarks: null, thumbnail_url: null, google_place_id: null });
  });

  it('setActivityDone and setWaypointDone patch is_done on their tables', async () => {
    const { calls, client } = createFakeClient([
      { table: 'activities', method: 'update' },
      { table: 'scenic_waypoints', method: 'update' },
    ]);
    await setActivityDone(client, 'act-1', true);
    await setWaypointDone(client, 'wp-1', false);
    expect(calls[0]).toMatchObject({ table: 'activities', payload: { is_done: true } });
    expect(calls[1]).toMatchObject({ table: 'scenic_waypoints', payload: { is_done: false } });
  });

  it('reorderActivities writes sequential sort_order per id', async () => {
    const { calls, client } = createFakeClient([]);
    await reorderActivities(client, ['b', 'a', 'c']);
    expect(calls.map((c) => c.payload)).toEqual([{ sort_order: 0 }, { sort_order: 1 }, { sort_order: 2 }]);
  });
});

describe('waypoint writes', () => {
  it('createWaypoint writes to scenic_waypoints without a type column', async () => {
    const { calls, client } = createFakeClient([{ table: 'scenic_waypoints', method: 'insert' }]);
    const id = await createWaypoint(client, 'stop-1', 2, { name: 'Lookout' });
    expect(id).toMatch(UUID_RE);
    expect(calls[0].table).toBe('scenic_waypoints');
    expect(calls[0].payload).not.toHaveProperty('type');
    expect(calls[0].payload).toMatchObject({ stop_id: 'stop-1', sort_order: 2, is_done: false, name: 'Lookout' });
  });
});

describe('accommodation writes', () => {
  it('upsertAccommodation writes the deterministic id and the full column set', async () => {
    const { calls, client } = createFakeClient([{ table: 'accommodations', method: 'upsert' }]);
    await upsertAccommodation(client, 'queenstown', { name: 'Lakeview Motel', checkIn: '2025-12-13 15:00', googlePlaceId: 'pid' });
    expect(calls[0].payload).toEqual({
      id: 'queenstown_accommodation',
      stop_id: 'queenstown',
      name: 'Lakeview Motel',
      address: null,
      check_in: '2025-12-13 15:00',
      check_out: null,
      remarks: null,
      url: null,
      confirmation: null,
      lat: null,
      lng: null,
      google_place_id: 'pid',
    });
  });
});

describe('stop writes', () => {
  it('createStop computes duration_days from the date range', async () => {
    const { calls, client } = createFakeClient([{ table: 'stops', method: 'insert' }]);
    await createStop(client, 't1', 3, { name: 'Fairlie', lat: -44.1, lng: 170.8, dateFrom: '2026-01-01', dateTo: '2026-01-03' });
    expect(calls[0].payload).toMatchObject({
      trip_id: 't1',
      sort_order: 3,
      date_from: '2026-01-01',
      date_to: '2026-01-03',
      duration_days: 2,
    });
  });

  it('updateStop patches only the provided fields', async () => {
    const { calls, client } = createFakeClient([{ table: 'stops', method: 'update' }]);
    await updateStop(client, 's1', { name: 'Renamed', dateTo: '2026-01-05' });
    expect(calls[0].payload).toEqual({ name: 'Renamed', date_to: '2026-01-05' });
  });

  it('applyStopStructure updates each stop row then the trip date span', async () => {
    const { calls, client } = createFakeClient([]);
    await applyStopStructure(
      client,
      't1',
      [
        { id: 'b', sort_order: 0, date_from: '2025-12-13', date_to: '2025-12-15' },
        { id: 'a', sort_order: 1, date_from: '2025-12-15', date_to: '2025-12-18' },
      ],
      '2025-12-13',
      '2025-12-18'
    );
    const stopUpdates = calls.filter((c) => c.table === 'stops').map((c) => c.payload);
    expect(stopUpdates).toContainEqual({ sort_order: 0, date_from: '2025-12-13', date_to: '2025-12-15', duration_days: 2 });
    expect(stopUpdates).toContainEqual({ sort_order: 1, date_from: '2025-12-15', date_to: '2025-12-18', duration_days: 3 });
    expect(calls.at(-1)).toMatchObject({ table: 'trips', payload: { start_date: '2025-12-13', end_date: '2025-12-18' } });
  });
});

describe('trip metadata and deletes', () => {
  it('updateTripMetadata maps camelCase keys sparsely', async () => {
    const { calls, client } = createFakeClient([{ table: 'trips', method: 'update' }]);
    await updateTripMetadata(client, 't1', { name: 'Renamed', startDate: '2026-01-01' });
    expect(calls[0].payload).toEqual({ name: 'Renamed', start_date: '2026-01-01' });
  });

  it('deleteById deletes by id and normalizes errors', async () => {
    const { calls, client } = createFakeClient([{ table: 'stops', method: 'delete' }]);
    await deleteById(client, 'stops', 's1');
    expect(calls[0]).toMatchObject({ table: 'stops', method: 'delete' });
    const failing = createFakeClient([{ table: 'stops', method: 'delete', error: { message: 'denied' } }]);
    await expect(deleteById(failing.client, 'stops', 's1')).rejects.toThrow('denied');
  });
});
