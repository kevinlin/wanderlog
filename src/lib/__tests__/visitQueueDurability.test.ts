import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { onlineManager, QueryClient } from '@tanstack/react-query';
import { persistQueryClientRestore, persistQueryClientSave } from '@tanstack/react-query-persist-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { registerMutationDefaults } from '../mutationDefaults';
import { tripKeys } from '../queryClient';
import { VISIT_MUTATION_KEY, type VisitVariables } from '../visitMutation';

const writeVisitFields = vi.hoisted(() => vi.fn());
vi.mock('@/services/supabaseService', () => ({ writeVisitFields }));

const tickVars: VisitVariables = { tripId: 't1', itemId: 'act-1', isWaypoint: false, isDone: true, visitedAt: '2026-07-15 14:32' };
const noteVars: VisitVariables = { tripId: 't1', itemId: 'act-1', isWaypoint: false, remarks: 'great views', visitDurationMinutes: 80 };

const trip = () => ({
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
});

const memoryPersister = () => {
  const store = new Map<string, unknown>();
  return createAsyncStoragePersister({
    storage: {
      getItem: (key) => Promise.resolve(store.get(key) ?? null),
      setItem: (key, value) => {
        store.set(key, value);
        return Promise.resolve();
      },
      removeItem: (key) => {
        store.delete(key);
        return Promise.resolve();
      },
    },
    throttleTime: 0,
  });
};

const clientWithTrip = () => {
  const client = new QueryClient();
  registerMutationDefaults(client);
  client.setQueryData(tripKeys.detail('t1'), trip());
  return client;
};

// The real queue: mutate through the same per-item scope the hook uses.
const queue = (client: QueryClient, vars: VisitVariables) =>
  client
    .getMutationCache()
    .build(client, { mutationKey: [...VISIT_MUTATION_KEY], scope: { id: `visit-${vars.itemId}` } })
    .execute(vars)
    .catch(() => undefined);

describe('two writes queued offline for one item', () => {
  beforeEach(() => {
    writeVisitFields.mockReset();
    writeVisitFields.mockResolvedValue(undefined);
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('both survive a persist/restore cycle and run in order', async () => {
    onlineManager.setOnline(false);
    const source = clientWithTrip();
    const persister = memoryPersister();

    queue(source, tickVars);
    queue(source, noteVars);
    await vi.waitFor(() =>
      expect(
        source
          .getMutationCache()
          .getAll()
          .filter((m) => m.state.isPaused)
      ).toHaveLength(2)
    );

    await persistQueryClientSave({ queryClient: source, persister });

    const restored = clientWithTrip();
    await persistQueryClientRestore({ queryClient: restored, persister });

    expect(restored.getMutationCache().getAll()).toHaveLength(2);

    onlineManager.setOnline(true);
    await restored.resumePausedMutations();

    expect(writeVisitFields.mock.calls).toEqual([
      ['activities', 'act-1', { is_done: true, visited_at: '2026-07-15 14:32' }],
      ['activities', 'act-1', { visit_duration_minutes: 80, remarks: 'great views' }],
    ]);
  });

  // Req 5.5: the rollback of an earlier write must not undo a later one.
  it('does not restore over the later edit when the first write fails', async () => {
    onlineManager.setOnline(false);
    const client = clientWithTrip();

    queue(client, tickVars);
    queue(client, noteVars);
    await vi.waitFor(() =>
      expect(
        client
          .getMutationCache()
          .getAll()
          .filter((m) => m.state.isPaused)
      ).toHaveLength(2)
    );

    writeVisitFields.mockRejectedValueOnce(new Error('offline'));
    onlineManager.setOnline(true);
    await client.resumePausedMutations();

    const item = client.getQueryData<ReturnType<typeof trip>>(tripKeys.detail('t1'))?.stops[0].activities[0];
    expect(item?.remarks).toBe('great views');
    expect(item?.visit_duration_minutes).toBe(80);
  });
});
