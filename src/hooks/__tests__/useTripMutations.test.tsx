import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, renderHook, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const mockSetActivityDone = vi.fn();
const mockReorderActivities = vi.fn();
const mockCreateActivity = vi.fn();
const mockUpdateActivity = vi.fn();
const mockDeleteActivity = vi.fn();
const mockUpsertAccommodation = vi.fn();
const mockCreateWaypoint = vi.fn();
const mockUpdateWaypoint = vi.fn();
const mockDeleteWaypoint = vi.fn();
const mockCreateStop = vi.fn();
const mockUpdateStop = vi.fn();
const mockDeleteStop = vi.fn();
const mockApplyStopStructure = vi.fn();
vi.mock('@/services/supabaseService', () => ({
  setActivityDone: (...args: unknown[]) => mockSetActivityDone(...args),
  setWaypointDone: vi.fn(),
  reorderActivities: (...args: unknown[]) => mockReorderActivities(...args),
  createActivity: (...args: unknown[]) => mockCreateActivity(...args),
  updateActivity: (...args: unknown[]) => mockUpdateActivity(...args),
  deleteActivity: (...args: unknown[]) => mockDeleteActivity(...args),
  upsertAccommodation: (...args: unknown[]) => mockUpsertAccommodation(...args),
  createWaypoint: (...args: unknown[]) => mockCreateWaypoint(...args),
  updateWaypoint: (...args: unknown[]) => mockUpdateWaypoint(...args),
  deleteWaypoint: (...args: unknown[]) => mockDeleteWaypoint(...args),
  createStop: (...args: unknown[]) => mockCreateStop(...args),
  updateStop: (...args: unknown[]) => mockUpdateStop(...args),
  deleteStop: (...args: unknown[]) => mockDeleteStop(...args),
  applyStopStructure: (...args: unknown[]) => mockApplyStopStructure(...args),
}));

import { ToastProvider } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';
import {
  useApplyStopStructure,
  useCreateActivity,
  useCreateStop,
  useCreateWaypoint,
  useDeleteActivity,
  useDeleteStop,
  useDeleteWaypoint,
  useReorderActivities,
  useToggleActivityDone,
  useUpdateActivity,
  useUpdateStop,
  useUpdateWaypoint,
  useUpsertAccommodation,
} from '../useTripMutations';

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
      scenic_waypoints: [{ activity_id: 'wp-1', activity_name: 'Falls', location: { lat: 1, lng: 2 }, status: { done: false } }],
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

describe('useUpsertAccommodation', () => {
  it('optimistically replaces the stop accommodation with the mapped input', async () => {
    mockUpsertAccommodation.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpsertAccommodation('t1'), { wrapper });

    result.current.mutate({
      stopId: 's1',
      input: {
        name: 'Lakeview Motel',
        address: '1 Lake Rd',
        checkIn: '2025-12-13 15:00',
        checkOut: '2025-12-14 10:00',
        remarks: 'Lake-facing room',
        lat: -45.03,
        lng: 168.66,
      },
    });

    await waitFor(() => {
      const accommodation = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops[0].accommodation;
      expect(accommodation?.name).toBe('Lakeview Motel');
      expect(accommodation?.address).toBe('1 Lake Rd');
      expect(accommodation?.check_in).toBe('2025-12-13 15:00');
      expect(accommodation?.check_out).toBe('2025-12-14 10:00');
      expect(accommodation?.remarks).toBe('Lake-facing room');
      expect(accommodation?.location).toEqual({ lat: -45.03, lng: 168.66 });
    });
    expect(mockUpsertAccommodation).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Lakeview Motel' }));
  });

  it('preserves the existing thumbnail when editing', async () => {
    mockUpsertAccommodation.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const seeded = structuredClone(seedTrip);
    seeded.stops[0].accommodation = {
      name: 'Old Motel',
      address: '',
      check_in: '',
      check_out: '',
      thumbnail_url: 'https://img.example/thumb.jpg',
    };
    client.setQueryData(tripKeys.detail('t1'), seeded);
    const { result } = renderHook(() => useUpsertAccommodation('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', input: { name: 'New Motel' } });

    await waitFor(() => {
      const accommodation = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops[0].accommodation;
      expect(accommodation?.name).toBe('New Motel');
      expect(accommodation?.thumbnail_url).toBe('https://img.example/thumb.jpg');
    });
  });

  it('rolls back the accommodation when the write fails', async () => {
    mockUpsertAccommodation.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpsertAccommodation('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', input: { name: 'Lakeview Motel' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].accommodation).toBeUndefined();
  });
});

describe('useCreateWaypoint', () => {
  it('optimistically appends the waypoint with the temp id', async () => {
    mockCreateWaypoint.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateWaypoint('t1'), { wrapper });

    result.current.mutate({
      stopId: 's1',
      sortOrder: 1,
      tempId: 'temp-wp',
      input: { name: 'Devils Punchbowl', lat: -42.94, lng: 171.56 },
    });

    await waitFor(() => {
      const waypoints = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops[0].scenic_waypoints;
      const added = waypoints?.at(-1);
      expect(added?.activity_id).toBe('temp-wp');
      expect(added?.activity_name).toBe('Devils Punchbowl');
      expect(added?.location).toEqual({ lat: -42.94, lng: 171.56 });
      expect(added?.status?.done).toBe(false);
    });
    expect(mockCreateWaypoint).toHaveBeenCalledWith('s1', 1, expect.objectContaining({ name: 'Devils Punchbowl' }));
  });

  it('rolls back the append when the write fails', async () => {
    mockCreateWaypoint.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateWaypoint('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', sortOrder: 1, tempId: 'temp-wp', input: { name: 'Falls' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].scenic_waypoints).toHaveLength(1);
  });
});

describe('useUpdateWaypoint', () => {
  it('optimistically patches the matching waypoint in place', async () => {
    mockUpdateWaypoint.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateWaypoint('t1'), { wrapper });

    result.current.mutate({ waypointId: 'wp-1', input: { name: 'Renamed Falls', remarks: 'note' } });

    await waitFor(() => {
      const updated = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops[0].scenic_waypoints?.[0];
      expect(updated?.activity_name).toBe('Renamed Falls');
      expect(updated?.remarks).toBe('note');
      expect(updated?.status?.done).toBe(false); // untouched fields preserved
    });
    expect(mockUpdateWaypoint).toHaveBeenCalledWith('wp-1', expect.objectContaining({ name: 'Renamed Falls' }));
  });

  it('rolls back the patch when the write fails', async () => {
    mockUpdateWaypoint.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateWaypoint('t1'), { wrapper });

    result.current.mutate({ waypointId: 'wp-1', input: { name: 'Renamed Falls' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].scenic_waypoints?.[0].activity_name).toBe('Falls');
  });
});

describe('useDeleteWaypoint', () => {
  it('optimistically removes the waypoint', async () => {
    mockDeleteWaypoint.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteWaypoint('t1'), { wrapper });

    result.current.mutate({ waypointId: 'wp-1' });

    await waitFor(() => {
      const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
      expect(trip?.stops[0].scenic_waypoints).toHaveLength(0);
    });
    expect(mockDeleteWaypoint).toHaveBeenCalledWith('wp-1');
  });

  it('restores the waypoint when the delete fails', async () => {
    mockDeleteWaypoint.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteWaypoint('t1'), { wrapper });

    result.current.mutate({ waypointId: 'wp-1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const trip = client.getQueryData<TripData>(tripKeys.detail('t1'));
    expect(trip?.stops[0].scenic_waypoints?.map((w) => w.activity_id)).toEqual(['wp-1']);
  });
});

describe('useCreateStop', () => {
  it('optimistically appends the stop with the temp id', async () => {
    mockCreateStop.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateStop('t1'), { wrapper });

    result.current.mutate({
      sortOrder: 1,
      tempId: 'temp-stop',
      input: { name: 'Fairlie', lat: -44.1, lng: 170.8, dateFrom: '2025-12-14', dateTo: '2025-12-15' },
    });

    await waitFor(() => {
      const stops = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops;
      const added = stops?.at(-1);
      expect(added?.stop_id).toBe('temp-stop');
      expect(added?.name).toBe('Fairlie');
      expect(added?.location).toEqual({ lat: -44.1, lng: 170.8 });
      expect(added?.date).toEqual({ from: '2025-12-14', to: '2025-12-15' });
      expect(added?.activities).toEqual([]);
    });
    expect(mockCreateStop).toHaveBeenCalledWith('t1', 1, expect.objectContaining({ name: 'Fairlie' }));
  });

  it('rolls back the append when the write fails', async () => {
    mockCreateStop.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useCreateStop('t1'), { wrapper });

    result.current.mutate({
      sortOrder: 1,
      tempId: 'temp-stop',
      input: { name: 'Fairlie', lat: -44.1, lng: 170.8, dateFrom: '2025-12-14', dateTo: '2025-12-15' },
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops).toHaveLength(1);
  });
});

describe('useUpdateStop', () => {
  it('optimistically patches the matching stop in place', async () => {
    mockUpdateStop.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateStop('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', patch: { name: 'Renamed stop', lat: -44.5, lng: 170.1 } });

    await waitFor(() => {
      const stop = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops[0];
      expect(stop?.name).toBe('Renamed stop');
      expect(stop?.location).toEqual({ lat: -44.5, lng: 170.1 });
      expect(stop?.activities).toHaveLength(2); // untouched fields preserved
    });
    expect(mockUpdateStop).toHaveBeenCalledWith('s1', expect.objectContaining({ name: 'Renamed stop' }));
  });

  it('rolls back the patch when the write fails', async () => {
    mockUpdateStop.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useUpdateStop('t1'), { wrapper });

    result.current.mutate({ stopId: 's1', patch: { name: 'Renamed stop' } });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops[0].name).toBe('Stop');
  });
});

describe('useDeleteStop', () => {
  it('optimistically removes the stop', async () => {
    mockDeleteStop.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteStop('t1'), { wrapper });

    result.current.mutate({ stopId: 's1' });

    await waitFor(() => {
      expect(client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops).toHaveLength(0);
    });
    expect(mockDeleteStop).toHaveBeenCalledWith('s1');
  });

  it('restores the stop when the delete fails', async () => {
    mockDeleteStop.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useDeleteStop('t1'), { wrapper });

    result.current.mutate({ stopId: 's1' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops).toHaveLength(1);
  });
});

describe('useApplyStopStructure', () => {
  const secondStop = {
    stop_id: 's2',
    name: 'Second',
    date: { from: '2025-12-14', to: '2025-12-16' },
    location: { lat: 1, lng: 1 },
    duration_days: 2,
    activities: [],
    scenic_waypoints: [],
  };

  it('optimistically replaces the stops array and sends structure rows', async () => {
    mockApplyStopStructure.mockReturnValue(new Promise(() => {}));
    const { client, wrapper } = setup();
    const seeded = structuredClone(seedTrip);
    seeded.stops.push(structuredClone(secondStop));
    client.setQueryData(tripKeys.detail('t1'), seeded);
    const { result } = renderHook(() => useApplyStopStructure('t1'), { wrapper });

    const reordered = [
      { ...structuredClone(secondStop), date: { from: '2025-12-13', to: '2025-12-15' }, duration_days: 2 },
      {
        ...structuredClone(seeded.stops[0]),
        date: { from: '2025-12-15', to: '2025-12-16' },
        duration_days: 1,
      },
    ];
    result.current.mutate({ stops: reordered, tripStartDate: '2025-12-13', tripEndDate: '2025-12-16' });

    await waitFor(() => {
      const stops = client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops;
      expect(stops?.map((s) => s.stop_id)).toEqual(['s2', 's1']);
      expect(stops?.[0].date).toEqual({ from: '2025-12-13', to: '2025-12-15' });
    });
    expect(mockApplyStopStructure).toHaveBeenCalledWith(
      't1',
      [
        { id: 's2', sort_order: 0, date_from: '2025-12-13', date_to: '2025-12-15' },
        { id: 's1', sort_order: 1, date_from: '2025-12-15', date_to: '2025-12-16' },
      ],
      '2025-12-13',
      '2025-12-16'
    );
  });

  it('rolls back the stops array when the write fails', async () => {
    mockApplyStopStructure.mockRejectedValue(new Error('offline'));
    const { client, wrapper } = setup();
    const seeded = structuredClone(seedTrip);
    seeded.stops.push(structuredClone(secondStop));
    client.setQueryData(tripKeys.detail('t1'), seeded);
    const { result } = renderHook(() => useApplyStopStructure('t1'), { wrapper });

    result.current.mutate({
      stops: [seeded.stops[1], seeded.stops[0]],
      tripStartDate: '2025-12-13',
      tripEndDate: '2025-12-16',
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(client.getQueryData<TripData>(tripKeys.detail('t1'))?.stops.map((s) => s.stop_id)).toEqual(['s1', 's2']);
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
