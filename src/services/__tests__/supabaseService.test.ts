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
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({ from: vi.fn(() => ({ ...chain, update: mockUpdate })) }),
}));

import { fetchTripById, fetchTripSummaries, reorderActivities, setActivityDone, setWaypointDone } from '../supabaseService';

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
