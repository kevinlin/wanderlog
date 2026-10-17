import { dehydrate, onlineManager, QueryClient } from '@tanstack/react-query';
import { afterEach, describe, expect, it } from 'vitest';
import { shouldPersistMutation } from '../mutationDefaults';
import { VISIT_MUTATION_KEY } from '../visitMutation';

// Offline, a default-networkMode mutation pauses before its function runs.
const pausedMutation = (client: QueryClient, mutationKey: readonly unknown[]) => {
  const mutation = client.getMutationCache().build(client, { mutationKey: [...mutationKey], mutationFn: () => Promise.resolve() });
  mutation.execute(undefined).catch(() => undefined);
  return mutation;
};

describe('shouldPersistMutation', () => {
  afterEach(() => {
    onlineManager.setOnline(true);
  });

  it('keeps a paused visit write, which its registered defaults can revive, and drops every other paused write', async () => {
    onlineManager.setOnline(false);
    const client = new QueryClient();
    const visit = pausedMutation(client, VISIT_MUTATION_KEY);
    const other = pausedMutation(client, ['todo']);
    await Promise.resolve();

    expect(visit.state.isPaused).toBe(true);
    expect(other.state.isPaused).toBe(true);
    expect(shouldPersistMutation(visit)).toBe(true);
    expect(shouldPersistMutation(other)).toBe(false);
    expect(dehydrate(client, { shouldDehydrateMutation: shouldPersistMutation }).mutations.map((m) => m.mutationKey)).toEqual([
      [...VISIT_MUTATION_KEY],
    ]);
  });
});
