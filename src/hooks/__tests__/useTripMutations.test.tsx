import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockSetActivityDone = vi.fn();
const mockReorderActivities = vi.fn();
const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
const mockDeleteActivity = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  setActivityDone: (...args: unknown[]) => mockSetActivityDone(...args),
  setWaypointDone: vi.fn(),
  reorderActivities: (...args: unknown[]) => mockReorderActivities(...args),
  createActivity: (...args: unknown[]) => mockCreateActivity(...args),
  updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
  deleteActivity: (...args: unknown[]) => mockDeleteActivity(...args),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';
import { useCreateActivity, useDeleteActivity, useReorderActivities, useToggleActivityDone, useUpdateActivity } from '../useTripMutations';

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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
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

  it('shows an error toast with a working Retry action on failure', async () => {
    mockSetActivityDone.mockReset();
    mockSetActivityDone.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(undefined);
    const { wrapper } = setup();
    const { result } = renderHook(() => useToggleActivityDone('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1', isDone: true, isWaypoint: false });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(screen.getByText('Could not save the change')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    await waitFor(() => expect(mockSetActivityDone).toHaveBeenCalledTimes(2));
    expect(mockSetActivityDone).toHaveBeenLastCalledWith('act-1', true);
  });
});

describe('useCreateActivity', () => {
  it('optimistically appends the activity with the temp id', async () => {
    mockCreateActivity.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateActivity('t1'), { wrapper });

    result.current.mutate({
      stopId: 's1',
      sortOrder: 2,
      tempId: 'temp-1',
      input: { name: 'Kayaking', type: 'outdoor', lat: -45, lng: 168 },
    });

    await waitFor(() => {
      const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
      const added = trip?.stops[0].activities.at(-1);
      expect(added?.activity_id).toBe('temp-1');
      expect(added?.activity_name).toBe('Kayaking');
      expect(added?.activity_type).toBe('outdoor');
      expect(added?.order).toBe(2);
      expect(added?.status?.done).toBe(false);
    });
    expect(mockCreateActivity).toHaveBeenCalledWith('s1', 2, expect.objectContaining({ name: 'Kayaking' }));
  });

  it('rolls back the append when the write fails', async () => {
    mockCreateActivity.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateActivity('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', sortOrder: 2, tempId: 'temp-1', input: { name: 'Kayaking' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities).toHaveLength(2);
  });
});

describe('useUpdateActivity', () => {
  it('optimistically patches the matching activity in place', async () => {
    mockUpdateActivity.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateActivity('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1', input: { name: 'Renamed', remarks: 'note' } });

    await waitFor(() => {
      const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
      const updated = trip?.stops[0].activities[0];
      expect(updated?.activity_name).toBe('Renamed');
      expect(updated?.remarks).toBe('note');
      expect(updated?.status?.done).toBe(false); // untouched fields preserved
    });
    expect(mockUpdateActivity).toHaveBeenCalledWith('act-1', expect.objectContaining({ name: 'Renamed' }));
  });

  it('rolls back the patch when the write fails', async () => {
    mockUpdateActivity.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateActivity('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1', input: { name: 'Renamed' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities[0].activity_name).toBe('A');
  });
});

describe('useDeleteActivity', () => {
  it('optimistically removes the activity', async () => {
    mockDeleteActivity.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteActivity('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1' });

    await waitFor(() => {
      const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
      expect(trip?.stops[0].activities.map((a) => a.activity_id)).toEqual(['act-2']);
    });
    expect(mockDeleteActivity).toHaveBeenCalledWith('act-1');
  });

  it('restores the activity when the delete fails', async () => {
    mockDeleteActivity.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteActivity('t1'), { wrapper });

    result.current.mutate({ activityId: 'act-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities.map((a) => a.activity_id)).toEqual(['act-1', 'act-2']);
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
