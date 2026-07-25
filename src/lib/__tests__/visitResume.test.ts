import { dehydrate, hydrate, QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '../mutationDefaults';
import { tripKeys } from '../queryClient';
import { onVisitWriteError, VISIT_MUTATION_KEY, type VisitVariables } from '../visitMutation';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

const vars: VisitVariables = { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' };

const tripWith = (done: boolean, visitedAt?: string) => ({
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

const clientWithTrip = () => {
  const client = new QueryClient();
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), tripWith(false));
  return client;
};

// A paused mutation is what a write queued while offline looks like on disk.
const buildPausedMutation = (client: QueryClient, context: unknown) => {
  client.getMutationCache().build(
    client,
    { mutationKey: [...VISIT_MUTATION_KEY] },
    {
      context,
      data: undefined,
      error: null,
      failureCount: 0,
      failureReason: null,
      isPaused: true,
      status: 'pending',
      submittedAt: 1,
      variables: vars,
    }
  );
};

describe('resumed visit mutations', () => {
  beforeEach(() => {
    writeVisitFields.mockReset();
  });

  it('runs the write after a dehydrate/hydrate cycle', async () => {
    const source = clientWithTrip();
    buildPausedMutation(source, undefined);

    const restored = clientWithTrip();
    hydrate(restored, dehydrate(source));
    writeVisitFields.mockResolvedValue(undefined);

    await restored.resumePausedMutations();

    expect(writeVisitFields).toHaveBeenCalledWith('activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' });
  });

  it('rolls the cache back and notifies when a resumed write fails', async () => {
    const source = clientWithTrip();
    source.setQueryData(tripKeys.detail('t1'), tripWith(true, '2026-07-15 14:32'));
    buildPausedMutation(source, {
      itemId: 'act-1',
      previous: { is_done: false, visited_at: undefined, visit_duration_minutes: undefined, remarks: undefined },
    });

    const restored = clientWithTrip();
    hydrate(restored, dehydrate(source));
    restored.setQueryData(tripKeys.detail('t1'), tripWith(true, '2026-07-15 14:32'));

    const seen: VisitVariables[] = [];
    const unsubscribe = onVisitWriteError(({ variables }) => seen.push(variables));
    writeVisitFields.mockRejectedValue(new Error('offline'));

    await restored.resumePausedMutations().catch(() => undefined);

    const trip = restored.getQueryData<ReturnType<typeof tripWith>>(tripKeys.detail('t1'));
    expect(trip?.stops[0].activities[0].status.done).toBe(false);
    expect(trip?.stops[0].activities[0].visited_at).toBeUndefined();
    expect(seen).toHaveLength(1);
    unsubscribe();
  });
});
