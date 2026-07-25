import { dehydrate, hydrate, onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '../mutationDefaults';
import { tripKeys } from '../queryClient';
import { VISIT_MUTATION_KEY, type VisitVariables } from '../visitMutation';

const writeVisitFields = vi.hoisted(() => vi.fn());
const fetchTripById = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields, fetchTripById }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ session: { user: { id: 'u1' } }, isLoading: false }) }));

import { useTripData } from '@/hooks/useTripData';

const tickVars: VisitVariables = { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' };

const trip = (done: boolean, visitedAt?: string) => ({
  trip_id: 't1',
  trip_name: 'Japan',
  timezone: 'Asia/Tokyo',
  stops: [
    {
      stop_id: 's1',
      name: 'Tokyo',
      date: { from: '2026-07-12', to: '2026-07-15' },
      duration_days: 3,
      location: { lat: 1, lng: 2 },
      activities: [{ activity_id: 'act-1', activity_name: 'Museum', status: { done }, visited_at: visitedAt }],
    },
  ],
});

const doneInCache = (client: QueryClient) =>
  client.getQueryData<ReturnType<typeof trip>>(tripKeys.detail('t1'))?.stops[0].activities[0].status.done;

// A tab restart: the offline tick is on disk as a paused mutation, and the
// cache holds the value it optimistically applied.
const restoredClient = async () => {
  const source = new QueryClient();
  registerMutationDefaults(source);
  source.setQueryData(tripKeys.detail('t1'), trip(false));
  onlineManager.setOnline(false);
  source
    .getMutationCache()
    .build(source, { mutationKey: [...VISIT_MUTATION_KEY], scope: { id: 'visit-act-1' } })
    .execute(tickVars)
    .catch(() => undefined);
  await vi.waitFor(() => {
    expect(source.getMutationCache().getAll()[0]?.state.isPaused).toBe(true);
    expect(doneInCache(source)).toBe(true);
  });

  const restored = new QueryClient();
  registerMutationDefaults(restored);
  hydrate(restored, dehydrate(source));
  return restored;
};

describe('a queued tick resumed while the trip refetches', () => {
  beforeEach(() => {
    writeVisitFields.mockReset();
    fetchTripById.mockReset();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('keeps the write once a refetch issued before it resolves after it', async () => {
    const restored = await restoredClient();
    expect(doneInCache(restored)).toBe(true);

    // A stand-in server: a read answers with the row as it stood when the
    // request was issued, so a read issued before the queued write resolves
    // after it with pre-write data.
    let serverDone = false;
    fetchTripById.mockImplementation(() => {
      const snapshot = trip(serverDone);
      return new Promise((resolve) => setTimeout(() => resolve(snapshot), 50));
    });
    writeVisitFields.mockImplementation(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            serverDone = true;
            resolve();
          }, 10)
        )
    );

    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={restored}>{children}</QueryClientProvider>;
    renderHook(() => useTripData({ tripId: 't1' }), { wrapper });

    onlineManager.setOnline(true);
    await restored.resumePausedMutations();
    await waitFor(() => expect(restored.getQueryState(tripKeys.detail('t1'))?.fetchStatus).toBe('idle'));

    expect(writeVisitFields).toHaveBeenCalledWith('activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' });
    expect(doneInCache(restored)).toBe(true);
  });
});
