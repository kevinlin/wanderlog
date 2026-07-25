import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '@/lib/mutationDefaults';
import { tripKeys } from '@/lib/queryClient';
import { useVisitRecord } from '../useVisitRecord';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

const trip = {
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', status: { done: false } }],
    },
  ],
};

const setup = () => {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), structuredClone(trip));
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { client, wrapper };
};

describe('useVisitRecord', () => {
  it('applies the patch optimistically and writes', async () => {
    writeVisitFields.mockResolvedValue(undefined);
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisitRecord('act-1'), { wrapper });

    result.current.mutate({ tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' });

    await waitFor(() => expect(writeVisitFields).toHaveBeenCalled());
    const cached = client.getQueryData<typeof trip>(tripKeys.detail('t1'));
    expect(cached?.stops[0].activities[0].status.done).toBe(true);
  });

  it('rolls back when the write fails', async () => {
    writeVisitFields.mockRejectedValue(new Error('nope'));
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useVisitRecord('act-1'), { wrapper });

    result.current.mutate({ tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const cached = client.getQueryData<typeof trip>(tripKeys.detail('t1'));
    expect(cached?.stops[0].activities[0].status.done).toBe(false);
    expect(cached?.stops[0].activities[0].visited_at).toBeUndefined();
  });

  // The per-item scope exists for one sequence: tick an item, then save its
  // details before the tick has landed. Without it the two writes race.
  it('runs two writes to the same item serially, in the order they were made', async () => {
    let releaseFirst: () => void = () => undefined;
    writeVisitFields.mockReset();
    writeVisitFields
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseFirst = resolve;
          })
      )
      .mockResolvedValue(undefined);

    const { wrapper } = setup();
    const { result } = renderHook(() => useVisitRecord('act-1'), { wrapper });

    result.current.mutate({ tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' });
    result.current.mutate({ tripId: 't1', itemId: 'act-1', isWaypoint: false, remarks: 'queue was long' });

    await waitFor(() => expect(writeVisitFields).toHaveBeenCalledTimes(1));
    expect(writeVisitFields).toHaveBeenLastCalledWith('activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' });

    releaseFirst();

    await waitFor(() => expect(writeVisitFields).toHaveBeenCalledTimes(2));
    expect(writeVisitFields).toHaveBeenLastCalledWith('activities', 'act-1', { remarks: 'queue was long' });
  });
});
