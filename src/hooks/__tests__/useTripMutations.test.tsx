import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockSetActivityDone = vi.fn();
const mockReorderActivities = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  setActivityDone: (...args: unknown[]) => mockSetActivityDone(...args),
  setWaypointDone: vi.fn(),
  reorderActivities: (...args: unknown[]) => mockReorderActivities(...args),
}));

import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';
import { useReorderActivities, useToggleActivityDone } from '../useTripMutations';

const seedTrip: TripData = {
  trip_id: 't1',
  trip_name: 'Trip',
  timezone: 'UTC',
  stops: [
    {
      stop_id: 's1',
      name: 'Stop',
      date: { from: '2025-12-13', to: '2025-12-14' },
      location: { lat: 0, lng: 0 },
      duration_days: 1,
      activities: [
        { activity_id: 'act-1', activity_name: 'A', order: 0, status: { done: false } },
        { activity_id: 'act-2', activity_name: 'B', order: 1, status: { done: false } },
      ],
      scenic_waypoints: [],
    },
  ],
};

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(tripKeys.detail('t1'), structuredClone(seedTrip));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
}

describe('useToggleActivityDone', () => {
  it('optimistically flips status.done before the server responds', async () => {
    mockSetActivityDone.mockReturnValue(new Promise(() => {})); // never resolves
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useToggleActivityDone('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1', isDone: true, isWaypoint: false });

    await waitFor(() => {
      const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
      expect(trip?.stops[0].activities[0].status?.done).toBe(true);
    });
  });

  it('rolls back the cache when the write fails', async () => {
    mockSetActivityDone.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useToggleActivityDone('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1', isDone: true, isWaypoint: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities[0].status?.done).toBe(false);
  });
});

describe('useReorderActivities', () => {
  it('optimistically reorders activities and renumbers order fields', async () => {
    mockReorderActivities.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useReorderActivities('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', orderedActivityIds: ['act-2', 'act-1'] });

    await waitFor(() => {
      const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
      expect(trip?.stops[0].activities.map((a) => a.activity_id)).toEqual(['act-2', 'act-1']);
      expect(trip?.stops[0].activities.map((a) => a.order)).toEqual([0, 1]);
    });
  });

  it('rolls back the order when the write fails', async () => {
    mockReorderActivities.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useReorderActivities('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', orderedActivityIds: ['act-2', 'act-1'] });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities.map((a) => a.activity_id)).toEqual(['act-1', 'act-2']);
  });
});
