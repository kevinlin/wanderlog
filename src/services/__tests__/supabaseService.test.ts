import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const chain = {
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
};
const mockUpdateEq = vi.fn();
const mockUpdate = vi.fn(() => ({ eq: mockUpdateEq }));
const mockInsert = vi.fn();
const mockDeleteEq = vi.fn();
const fromSpy = vi.fn(() => ({
  ...chain,
  update: mockUpdate,
  insert: mockInsert,
  delete: vi.fn(() => ({ eq: mockDeleteEq })),
}));
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({ from: fromSpy }),
}));

import type { TripData } from '@/types/trip';
import {
  createActivity,
  deleteActivity,
  deleteTrip,
  fetchTripById,
  fetchTripSummaries,
  importTrip,
  reorderActivities,
  setActivityDone,
  setWaypointDone,
  updateActivity,
} from '../supabaseService';

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
      activities: [{ activity_id: 'a1', activity_name: 'Thing', status: { done: false } }],
      scenic_waypoints: [],
    },
  ],
};

describe('supabaseService reads', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetchTripById returns mapped TripData', async () => {
    mockMaybeSingle.mockResolvedValue({
      data: {
        id: '202512_NZ',
        name: 'NZ',
        description: null,
        destination: null,
        start_date: '2025-12-13',
        end_date: '2025-12-29',
        timezone: 'Pacific/Auckland',
        created_at: 'x',
        updated_at: 'x',
        stops: [],
      },
      error: null,
    });
    const trip = await fetchTripById('202512_NZ');
    expect(trip?.trip_name).toBe('NZ');
    expect(chain.select).toHaveBeenCalledWith(expect.stringContaining('scenic_waypoints(*)'));
  });

  it('fetchTripById returns null for a missing trip', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await fetchTripById('nope')).toBeNull();
  });

  it('fetchTripById throws on a supabase error', async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'boom' } });
    await expect(fetchTripById('202512_NZ')).rejects.toThrow('boom');
  });

  it('fetchTripSummaries maps rows to TripSummary', async () => {
    mockOrder.mockResolvedValue({
      data: [
        {
          id: 't1',
          name: 'Trip 1',
          destination: 'NZ',
          start_date: '2025-12-13',
          end_date: '2025-12-29',
          timezone: 'UTC',
          created_at: 'c',
          updated_at: 'u',
        },
      ],
      error: null,
    });
    const trips = await fetchTripSummaries();
    expect(trips[0]).toEqual({
      trip_id: 't1',
      trip_name: 'Trip 1',
      destination: 'NZ',
      start_date: '2025-12-13',
      end_date: '2025-12-29',
      timezone: 'UTC',
      created_at: 'c',
      updated_at: 'u',
    });
    expect(chain.select).toHaveBeenCalledWith('id, name, destination, start_date, end_date, timezone, created_at, updated_at');
  });
});

describe('supabaseService writes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateEq.mockResolvedValue({ error: null });
  });

  it('setActivityDone updates is_done by id', async () => {
    await setActivityDone('act-1', true);
    expect(mockUpdate).toHaveBeenCalledWith({ is_done: true });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'act-1');
  });

  it('setWaypointDone updates is_done by id', async () => {
    await setWaypointDone('wp-1', false);
    expect(mockUpdate).toHaveBeenCalledWith({ is_done: false });
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'wp-1');
  });

  it('reorderActivities writes sequential sort_order for each id', async () => {
    await reorderActivities(['b', 'a', 'c']);
    expect(mockUpdate).toHaveBeenNthCalledWith(1, { sort_order: 0 });
    expect(mockUpdateEq).toHaveBeenNthCalledWith(1, 'id', 'b');
    expect(mockUpdateEq).toHaveBeenNthCalledWith(3, 'id', 'c');
  });

  it('setActivityDone throws on error', async () => {
    mockUpdateEq.mockResolvedValueOnce({ error: { message: 'denied' } });
    await expect(setActivityDone('act-1', true)).rejects.toThrow('denied');
  });
});

describe('supabaseService activity crud', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
    mockUpdateEq.mockResolvedValue({ error: null });
    mockDeleteEq.mockResolvedValue({ error: null });
  });

  it('createActivity inserts with generated uuid, stop_id and sort_order', async () => {
    const id = await createActivity('stop-1', 5, { name: 'Kayaking', type: 'outdoor', lat: -45, lng: 168 });
    expect(id).toMatch(/^[0-9a-f-]{36}$/);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id,
        stop_id: 'stop-1',
        sort_order: 5,
        name: 'Kayaking',
        type: 'outdoor',
        lat: -45,
        lng: 168,
        is_done: false,
      })
    );
  });

  it('createActivity throws on error', async () => {
    mockInsert.mockResolvedValueOnce({ error: { message: 'denied' } });
    await expect(createActivity('stop-1', 0, { name: 'Kayaking' })).rejects.toThrow('denied');
  });

  it('updateActivity patches the row by id, mapping undefined to null', async () => {
    await updateActivity('act-1', { name: 'Renamed', remarks: undefined });
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ name: 'Renamed', remarks: null }));
    expect(mockUpdateEq).toHaveBeenCalledWith('id', 'act-1');
  });

  it('deleteActivity deletes by id', async () => {
    await deleteActivity('act-1');
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 'act-1');
  });

  it('deleteActivity throws on error', async () => {
    mockDeleteEq.mockResolvedValueOnce({ error: { message: 'denied' } });
    await expect(deleteActivity('act-1')).rejects.toThrow('denied');
  });
});

describe('supabaseService trip delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteEq.mockResolvedValue({ error: null });
  });

  it('deleteTrip deletes by id', async () => {
    await deleteTrip('t1');
    expect(mockDeleteEq).toHaveBeenCalledWith('id', 't1');
  });
});

describe('supabaseService importTrip', () => {
  beforeEach(() => vi.clearAllMocks());

  it('importTrip inserts the full bundle in FK order', async () => {
    mockInsert.mockResolvedValue({ error: null });
    const tripId = await importTrip(importableTrip);
    expect(tripId).toBe(importableTrip.trip_id);
    const tables = fromSpy.mock.calls.map(([table]) => table);
    expect(tables).toEqual(['trips', 'stops', 'accommodations', 'activities']);
    // scenic_waypoints empty → no insert call for it
  });

  it('importTrip deletes the trip row and rethrows when a child insert fails', async () => {
    mockInsert
      .mockResolvedValueOnce({ error: null }) // trips
      .mockResolvedValueOnce({ error: { message: 'stops boom' } }); // stops
    mockDeleteEq.mockResolvedValue({ error: null });
    await expect(importTrip(importableTrip)).rejects.toThrow('stops boom');
    expect(mockDeleteEq).toHaveBeenCalledWith('id', importableTrip.trip_id);
  });
});
