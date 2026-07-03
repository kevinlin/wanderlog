import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockOrder = vi.fn();
const chain = {
  select: vi.fn(() => chain),
  eq: vi.fn(() => chain),
  order: mockOrder,
  maybeSingle: mockMaybeSingle,
};
vi.mock('@/config/supabase', () => ({
  getSupabase: () => ({ from: vi.fn(() => chain) }),
}));

import { fetchTripById, fetchTripSummaries } from '../supabaseService';

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
      data: [{ id: 't1', name: 'Trip 1', timezone: 'UTC', created_at: 'c', updated_at: 'u' }],
      error: null,
    });
    const trips = await fetchTripSummaries();
    expect(trips).toEqual([{ trip_id: 't1', trip_name: 'Trip 1', timezone: 'UTC', created_at: 'c', updated_at: 'u' }]);
  });
});
