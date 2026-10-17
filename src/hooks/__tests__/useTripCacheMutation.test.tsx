import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '@/components/Layout/Toast';
import { tripKeys } from '@/lib/queryClient';
import type { TripData } from '@/types/trip';
import { useTripCacheMutation } from '../useTripCacheMutation';

const mutationFn = vi.fn();

const seedTrip: TripData = { trip_id: 't1', trip_name: 'Trip', timezone: 'UTC', stops: [] };

const setup = (extra: Partial<Parameters<typeof useTripCacheMutation<void, void>>[0]> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(tripKeys.detail('t1'), structuredClone(seedTrip));
  client.setQueryData(tripKeys.all, []);
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <ToastProvider>{children}</ToastProvider>
    </QueryClientProvider>
  );
  const view = renderHook(
    () => useTripCacheMutation<void, void>({ tripId: 't1', mutationFn, patch: (trip) => trip, errorMessage: 'Could not save', ...extra }),
    { wrapper }
  );
  return { client, ...view };
};

const isInvalidated = (client: QueryClient, key: readonly unknown[]) => client.getQueryState(key)?.isInvalidated;

describe('useTripCacheMutation options', () => {
  beforeEach(() => {
    mutationFn.mockReset();
  });

  afterEach(() => {
    onlineManager.setOnline(true);
  });

  describe('invalidateLibrary', () => {
    it('is off by default: only the trip detail is invalidated on settle', async () => {
      mutationFn.mockResolvedValue(undefined);
      const { client, result } = setup();

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(isInvalidated(client, tripKeys.detail('t1'))).toBe(true);
      expect(isInvalidated(client, tripKeys.all)).toBe(false);
    });

    it('also invalidates the library list when set', async () => {
      mutationFn.mockResolvedValue(undefined);
      const { client, result } = setup({ invalidateLibrary: true });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(isInvalidated(client, tripKeys.detail('t1'))).toBe(true);
      expect(isInvalidated(client, tripKeys.all)).toBe(true);
    });

    it('invalidates the library list after a failed write too', async () => {
      mutationFn.mockRejectedValue(new Error('boom'));
      const { client, result } = setup({ invalidateLibrary: true });

      result.current.mutate();

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(isInvalidated(client, tripKeys.all)).toBe(true);
    });
  });

  describe('networkMode', () => {
    it('is the TanStack default when unset: an offline write is paused and its function waits', async () => {
      onlineManager.setOnline(false);
      mutationFn.mockResolvedValue(undefined);
      const { client, result } = setup();

      result.current.mutate();

      await waitFor(() => expect(result.current.isPaused).toBe(true));
      expect(mutationFn).not.toHaveBeenCalled();
      client.getMutationCache().clear();
    });

    it('runs an offline write straight away when set to always', async () => {
      onlineManager.setOnline(false);
      mutationFn.mockResolvedValue(undefined);
      const { result } = setup({ networkMode: 'always' });

      result.current.mutate();

      await waitFor(() => expect(result.current.isSuccess).toBe(true));
      expect(mutationFn).toHaveBeenCalledTimes(1);
      expect(result.current.isPaused).toBe(false);
    });
  });

  describe('scope', () => {
    const release: Array<() => void> = [];
    const hold = () =>
      new Promise<void>((resolve) => {
        release.push(resolve);
      });

    beforeEach(() => {
      release.length = 0;
    });

    it('is unset by default: two writes run concurrently', async () => {
      mutationFn.mockImplementation(hold);
      const { result } = setup();

      result.current.mutate();
      result.current.mutate();

      await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
      for (const resolve of release) {
        resolve();
      }
    });

    it('queues a second write behind the first when both share a scope', async () => {
      mutationFn.mockImplementation(hold);
      const { result } = setup({ scope: { id: 'todos:t1' } });

      result.current.mutate();
      result.current.mutate();

      await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(1));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(mutationFn).toHaveBeenCalledTimes(1);

      release[0]();

      await waitFor(() => expect(mutationFn).toHaveBeenCalledTimes(2));
      release[1]();
    });
  });
});
